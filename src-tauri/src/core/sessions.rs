use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use super::capture::{CaptureIntegrity, InputLevelSummary};
use super::config::{AppConfig, ProcessingMode, TextProfileWorkMode};
use super::history;
use super::insertion::{insert_transcription_from_legacy, NativeInsertResult};
use super::providers::JobKey;
use super::sound;
use super::transform::NativeTransformResult;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeSessionStage {
    Idle,
    Capturing,
    Processing,
    Completed,
    Aborted,
    Error,
}

impl Default for NativeSessionStage {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeSessionStatus {
    pub stage: NativeSessionStage,
    pub active_session_id: Option<String>,
    pub active_trigger: Option<String>,
    pub started_at_ms: Option<u64>,
    pub completed_at_ms: Option<u64>,
    pub last_transcript: Option<String>,
    pub last_error: Option<String>,
    pub capture_owner: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeSessionEvent {
    pub event: String,
    pub status: NativeSessionStatus,
}

// `StartNativeSessionRequest` and `CompleteNativeSessionRequest` stood here
// until 2026-08-11 and went with the two commands that deserialized them
// (ADR 0091). Neither is a `#[warn(dead_code)]` candidate — a `pub` struct with
// no user compiles silently — which is the same reason a registered command
// with no caller survives a build: nothing in the toolchain asks who wants it.

#[derive(Debug, Clone, Serialize)]
pub struct PendingTranscriptionPreviewTransform {
    pub applied_rules: Vec<String>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PendingTranscriptionPreviewEvent {
    pub provider: String,
    pub active_profile: Option<String>,
    pub work_mode: TextProfileWorkMode,
    pub raw_text: String,
    pub text: String,
    pub corrected: bool,
    pub transform: PendingTranscriptionPreviewTransform,
    /// Which staging this payload belongs to. The window carries it back when it
    /// asks the runtime to wait (ADR 0152), so a request in flight across a
    /// session change cannot extend the next dictation's deadline.
    pub preview_epoch: u64,
    pub occurred_at_ms: u64,
}

/// What a window that has just mounted needs to repaint a session already in
/// progress (ADR 0151).
///
/// It carries only what the surface is drawn from. A session that has already
/// ended is `stage` and nothing else: the path that ended it owed the surface
/// that reported it (ADR 0019), and a remount re-reporting it would be a second
/// surface for one ending.
#[derive(Debug, Clone, Serialize)]
pub struct NativeSessionSnapshot {
    pub stage: NativeSessionStage,
    pub session_id: Option<String>,
    /// When the runtime started this session, so a restored pill shows the
    /// elapsed time the session actually has rather than counting from the
    /// remount.
    pub started_at_ms: Option<u64>,
    pub muted: bool,
    pub paused: bool,
    /// The staged preview, if one is still waiting. Absent the instant the
    /// deadline takes it, which is what keeps a restored surface from offering
    /// a commit it has already lost (ADR 0134).
    pub pending_preview: Option<PendingTranscriptionPreviewEvent>,
}

/// How long the runtime waits for a window to finish a staged preview before it
/// finishes the session itself (ADR 0134).
///
/// Not configurable, and deliberately not a frontend timer: a frontend timer
/// dies with the frontend, which is the entire defect. Sized as a safety net
/// rather than an abort window — p90 of a healthy commit is 2.27 s, so this is
/// invisible whenever the window works and still bounds the loss when it does
/// not.
pub const PREVIEW_COMMIT_DEADLINE_MS: u64 = 10_000;

/// Which path completed a session. The runtime says what it did, so the next
/// investigation can count deadline commits instead of inferring them from
/// timing (ADR 0134).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommitPath {
    Frontend,
    Deadline,
}

impl CommitPath {
    fn as_str(self) -> &'static str {
        match self {
            Self::Frontend => "frontend",
            Self::Deadline => "deadline",
        }
    }
}

#[derive(Debug, Clone)]
struct ActiveSession {
    id: String,
    trigger: String,
    started_at_ms: u64,
}

#[derive(Debug, Clone)]
struct PendingTranscriptionPreview {
    app_config: AppConfig,
    provider: String,
    raw_text: String,
    transformed: NativeTransformResult,
    /// The mode this text was produced under. Carried on the preview rather
    /// than re-derived at commit time: a preview can sit on screen while the
    /// profile's mode is changed underneath it, and the record has to state
    /// what ran (ADR 0075).
    effective_mode: Option<ProcessingMode>,
    /// What the capture behind this preview measured about itself (ADR 0079).
    /// Carried for the same reason `effective_mode` is: the commit writes the
    /// record, and by then the capture is long over.
    capture_integrity: Option<CaptureIntegrity>,
    /// What the microphone delivered into it, carried alongside the verdict for
    /// the same reason: the commit writes the record, and by then the capture
    /// is long over.
    input_level: Option<InputLevelSummary>,
    /// Which staging this preview came from. The deadline armed for one preview
    /// may not commit another: an abort inside the deadline window frees the
    /// session for a new capture, and that capture can stage its own preview
    /// before the first deadline expires. A session id would not separate them
    /// on every path — `force_processing_for_active_capture` reuses one — so
    /// the epoch counts stagings rather than sessions.
    epoch: u64,
    /// The instant the deadline may commit this preview. Stored rather than
    /// baked into the sleep so a window that is still working can push it out
    /// (ADR 0152) — and so that pushing it out is a value the deadline re-reads
    /// rather than a channel it listens on, which keeps ADR 0134's rule that
    /// the staged preview IS the cancellation state.
    commit_at_ms: u64,
    occurred_at_ms: u64,
}

impl PendingTranscriptionPreview {
    fn event_payload(&self) -> PendingTranscriptionPreviewEvent {
        PendingTranscriptionPreviewEvent {
            provider: self.provider.clone(),
            active_profile: self.app_config.active_text_profile_label(),
            work_mode: self.app_config.resolved_active_text_profile_work_mode(),
            raw_text: self.raw_text.clone(),
            text: self.transformed.text.trim().to_string(),
            corrected: self.transformed.corrected,
            transform: PendingTranscriptionPreviewTransform {
                applied_rules: self.transformed.applied_rules.clone(),
                warning: self.transformed.warning.clone(),
            },
            preview_epoch: self.epoch,
            occurred_at_ms: self.occurred_at_ms,
        }
    }
}

#[derive(Debug, Default)]
pub struct NativeSessionState {
    counter: u64,
    stage: NativeSessionStage,
    active_session: Option<ActiveSession>,
    completed_at_ms: Option<u64>,
    last_transcript: Option<String>,
    last_error: Option<String>,
    pending_preview: Option<PendingTranscriptionPreview>,
    preview_counter: u64,
}

impl NativeSessionState {
    pub fn status(&self) -> NativeSessionStatus {
        NativeSessionStatus {
            stage: self.stage.clone(),
            active_session_id: self
                .active_session
                .as_ref()
                .map(|session| session.id.clone()),
            active_trigger: self
                .active_session
                .as_ref()
                .map(|session| session.trigger.clone()),
            started_at_ms: self
                .active_session
                .as_ref()
                .map(|session| session.started_at_ms),
            completed_at_ms: self.completed_at_ms,
            last_transcript: self.last_transcript.clone(),
            last_error: self.last_error.clone(),
            capture_owner: "native_core_capture".to_string(),
        }
    }

    pub fn processing_session_id(&self) -> Option<String> {
        if !matches!(self.stage, NativeSessionStage::Processing) {
            return None;
        }

        self.active_session
            .as_ref()
            .map(|session| session.id.clone())
    }

    fn stage_pending_preview(
        &mut self,
        app_config: AppConfig,
        provider: String,
        raw_text: String,
        transformed: NativeTransformResult,
        effective_mode: Option<ProcessingMode>,
        capture_integrity: Option<CaptureIntegrity>,
        input_level: Option<InputLevelSummary>,
    ) -> Result<(u64, PendingTranscriptionPreviewEvent), String> {
        if !matches!(self.stage, NativeSessionStage::Processing) || self.active_session.is_none() {
            return Err("No native session is waiting for a preview commit.".to_string());
        }

        self.preview_counter += 1;
        let preview = PendingTranscriptionPreview {
            app_config,
            provider,
            raw_text,
            transformed,
            effective_mode,
            capture_integrity,
            input_level,
            epoch: self.preview_counter,
            commit_at_ms: now_ms().saturating_add(PREVIEW_COMMIT_DEADLINE_MS),
            occurred_at_ms: now_ms(),
        };
        let payload = preview.event_payload();
        let epoch = preview.epoch;
        self.pending_preview = Some(preview);
        Ok((epoch, payload))
    }

    /// Whether the staging this epoch names is still the one waiting to be
    /// committed. Read by the deadline before it decides to act, so an already
    /// settled session logs as settled rather than as a failed commit.
    fn preview_epoch_is_pending(&self, epoch: u64) -> bool {
        matches!(self.stage, NativeSessionStage::Processing)
            && self
                .pending_preview
                .as_ref()
                .map(|preview| preview.epoch == epoch)
                .unwrap_or(false)
    }

    /// When the deadline armed for `epoch` may commit, or `None` if that
    /// staging is no longer the pending one. One read answers both questions the
    /// waking deadline has — *is it still mine* and *is it due yet* — so the two
    /// cannot be answered under different locks and disagree.
    fn pending_preview_commit_at(&self, epoch: u64) -> Option<u64> {
        if !matches!(self.stage, NativeSessionStage::Processing) {
            return None;
        }

        self.pending_preview
            .as_ref()
            .filter(|preview| preview.epoch == epoch)
            .map(|preview| preview.commit_at_ms)
    }

    /// The window says it is still on this preview, so the deadline waits
    /// (ADR 0152).
    ///
    /// A full deadline from *now* rather than a pause that has to be lifted: the
    /// caller renews while its surface is open, and a caller that stops renewing
    /// — because the user closed the surface, or because the webview died — is
    /// left with exactly the ordinary window ADR 0134 grants. There is no state
    /// here that a dead window can leave set.
    fn defer_pending_preview_commit(&mut self, epoch: u64) -> Result<u64, String> {
        if !matches!(self.stage, NativeSessionStage::Processing) {
            return Err("No native session is waiting for a preview commit.".to_string());
        }

        let preview = self
            .pending_preview
            .as_mut()
            .filter(|preview| preview.epoch == epoch)
            .ok_or_else(|| {
                "The staged preview this deferral names is no longer pending.".to_string()
            })?;
        preview.commit_at_ms = now_ms().saturating_add(PREVIEW_COMMIT_DEADLINE_MS);
        Ok(preview.commit_at_ms)
    }

    /// What a freshly mounted window needs to repaint a live session
    /// (ADR 0151). `muted` and `paused` are the capture's, passed in rather than
    /// read here, so this stays a pure read of one lock.
    fn snapshot(&self, muted: bool, paused: bool) -> NativeSessionSnapshot {
        NativeSessionSnapshot {
            stage: self.stage.clone(),
            session_id: self
                .active_session
                .as_ref()
                .map(|session| session.id.clone()),
            started_at_ms: self
                .active_session
                .as_ref()
                .map(|session| session.started_at_ms),
            muted,
            paused,
            pending_preview: self
                .pending_preview
                .as_ref()
                .map(|preview| preview.event_payload()),
        }
    }

    /// Takes the staged preview so exactly one path can commit it (ADR 0018).
    ///
    /// `expected_epoch` is the deadline's guard: `None` takes whatever this
    /// session staged, which is what a window commit means, while `Some(epoch)`
    /// refuses any preview but the one the deadline was armed for.
    fn take_pending_preview(
        &mut self,
        expected_epoch: Option<u64>,
    ) -> Result<(String, PendingTranscriptionPreview), String> {
        if !matches!(self.stage, NativeSessionStage::Processing) {
            return Err("No native session is waiting for a preview commit.".to_string());
        }

        let session_id = self
            .active_session
            .as_ref()
            .map(|session| session.id.clone())
            .ok_or_else(|| "No native session is waiting for a preview commit.".to_string())?;
        if let Some(expected) = expected_epoch {
            if !self.preview_epoch_is_pending(expected) {
                return Err(
                    "The staged preview is no longer the one this deadline was armed for."
                        .to_string(),
                );
            }
        }
        let preview = self
            .pending_preview
            .take()
            .ok_or_else(|| "No pending transcription preview is available.".to_string())?;

        Ok((session_id, preview))
    }

    pub fn is_processing_session_current(&self, session_id: &str) -> bool {
        matches!(self.stage, NativeSessionStage::Processing)
            && self
                .active_session
                .as_ref()
                .map(|session| session.id == session_id)
                .unwrap_or(false)
    }

    pub fn start_capture(
        &mut self,
        trigger: impl Into<String>,
    ) -> Result<NativeSessionStatus, String> {
        if matches!(
            self.stage,
            NativeSessionStage::Capturing | NativeSessionStage::Processing
        ) {
            return Err("A native capture session is already active.".to_string());
        }

        let trigger = trigger.into().trim().to_string();
        if trigger.is_empty() {
            return Err("Trigger must not be empty.".to_string());
        }

        self.counter += 1;
        self.stage = NativeSessionStage::Capturing;
        self.completed_at_ms = None;
        self.last_error = None;
        self.pending_preview = None;
        self.active_session = Some(ActiveSession {
            id: format!("native-{}", self.counter),
            trigger,
            started_at_ms: now_ms(),
        });

        Ok(self.status())
    }

    pub fn stop_for_processing(&mut self) -> Result<NativeSessionStatus, String> {
        if self.active_session.is_none() || !matches!(self.stage, NativeSessionStage::Capturing) {
            return Err("No native capture session is currently recording.".to_string());
        }

        self.stage = NativeSessionStage::Processing;
        self.last_error = None;
        Ok(self.status())
    }

    pub fn enter_processing(
        &mut self,
        recovery_trigger: impl Into<String>,
        capture_is_recording: bool,
    ) -> Result<NativeSessionStatus, String> {
        match self.stop_for_processing() {
            Ok(status) => Ok(status),
            Err(_) if capture_is_recording => {
                Ok(self.force_processing_for_active_capture(recovery_trigger))
            }
            Err(error) => Err(error),
        }
    }

    pub fn force_processing_for_active_capture(
        &mut self,
        trigger: impl Into<String>,
    ) -> NativeSessionStatus {
        if self.active_session.is_none() {
            self.counter += 1;
            self.active_session = Some(ActiveSession {
                id: format!("native-{}", self.counter),
                trigger: trigger.into().trim().to_string(),
                started_at_ms: now_ms(),
            });
        }

        self.stage = NativeSessionStage::Processing;
        self.last_error = None;
        self.status()
    }

    pub fn complete_transcription(&mut self, text: impl Into<String>) -> NativeSessionStatus {
        self.stage = NativeSessionStage::Completed;
        self.active_session = None;
        self.completed_at_ms = Some(now_ms());
        self.last_error = None;
        self.pending_preview = None;
        self.last_transcript = Some(text.into());
        self.status()
    }

    // `complete_current_transcription` stood here until 2026-08-11 and went
    // with `complete_native_session`, its only caller (ADR 0091). It completed
    // whichever session happened to be processing instead of the one the
    // result belongs to — the session-id guard `AGENTS.md` requires, taken back
    // out one frame after `complete_processing_session` applies it. Every
    // completion path goes through the guarded method below.

    pub fn complete_processing_session(
        &mut self,
        session_id: &str,
        text: impl Into<String>,
    ) -> Option<NativeSessionStatus> {
        if !self.is_processing_session_current(session_id) {
            return None;
        }

        Some(self.complete_transcription(text))
    }

    pub fn abort(&mut self, reason: impl Into<String>) -> NativeSessionStatus {
        self.stage = NativeSessionStage::Aborted;
        self.active_session = None;
        self.completed_at_ms = Some(now_ms());
        self.pending_preview = None;
        self.last_error = Some(reason.into());
        self.status()
    }

    pub fn empty_processing_session(
        &mut self,
        session_id: &str,
        reason: impl Into<String>,
    ) -> Option<NativeSessionStatus> {
        if !self.is_processing_session_current(session_id) {
            return None;
        }

        Some(self.abort(reason))
    }

    pub fn fail(&mut self, message: impl Into<String>) -> NativeSessionStatus {
        self.stage = NativeSessionStage::Error;
        self.active_session = None;
        self.completed_at_ms = Some(now_ms());
        self.pending_preview = None;
        self.last_error = Some(message.into());
        self.status()
    }

    pub fn fail_processing_session(
        &mut self,
        session_id: &str,
        message: impl Into<String>,
    ) -> Option<NativeSessionStatus> {
        if !self.is_processing_session_current(session_id) {
            return None;
        }

        Some(self.fail(message))
    }
}

// `native_session_status`, `start_native_session`, `stop_native_session` and
// `complete_native_session` stood here until 2026-08-11 and were removed by
// Leg 10 (ADR 0091). They are the Python sidecar's IPC command set — the old
// `wordscript/ipc.py` documents the Tauri -> Python channel as
// `start_recording` / `stop_recording` / `abort_recording`, and the sidecar
// owned the session state, so the host had to drive it from outside the
// process. `febc452` carried that shape across as `#[tauri::command]`s and the
// rewrite it belonged to moved trigger, capture and pipeline INTO this process,
// so the caller became internal Rust: `start_from_native`,
// `processing_from_native`, `complete_processing_session`. Those are unchanged
// and are what a future in-process caller (the roadmap's MCP bridge) calls —
// a Tauri command is reachable only from this app's own webviews.
//
// `git log --all -S` finds no commit in which any of the four was invoked from
// `src/`. `abort_native_session` below is the one of the five that survives,
// because abort is the one lifecycle transition a USER makes: the overlay draws
// it, and the other four come from hotkeys the runtime already owns.

#[tauri::command]
pub fn abort_native_session(
    app: AppHandle,
    _state: State<'_, Mutex<NativeSessionState>>,
) -> Result<NativeSessionStatus, String> {
    abort_from_native(&app, "Capture aborted by native trigger.")
}

/// What a window that has just mounted asks for (ADR 0151).
///
/// One command rather than two, because two round trips can straddle a state
/// change: a session that ends between them would restore a pill for a capture
/// that is over.
///
/// The capture flags are read *before* the session lock is taken and never
/// under it — the two mutexes are not held at the same time anywhere in this
/// process and this is not the place to start. That order also puts the fresher
/// read on the session, which is what decides the surface; mute and pause only
/// decorate one it has already chosen.
#[tauri::command]
pub fn native_session_snapshot(
    app: AppHandle,
    state: State<'_, Mutex<NativeSessionState>>,
) -> Result<NativeSessionSnapshot, String> {
    let capture = super::capture::current_status_for_app(&app)?;
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.snapshot(capture.muted, capture.paused))
}

/// The overlay's edit surface says it is still open, so the runtime waits
/// (ADR 0152).
///
/// The window renews this while the surface is open. It is deliberately not a
/// "hold" that has to be released: whatever kills the window also stops the
/// renewals, and the deadline then runs out on its own.
#[tauri::command]
pub fn defer_pending_transcription_preview_commit(
    epoch: u64,
    state: State<'_, Mutex<NativeSessionState>>,
) -> Result<u64, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.defer_pending_preview_commit(epoch)
}

#[tauri::command]
pub async fn commit_pending_transcription_preview(
    app: AppHandle,
    // The overlay's edit surface sends the corrected text back through the
    // commit instead of writing it out on its own. Editing before delivery is
    // the whole point of the clipboard_only preview, and going through the
    // commit is what keeps session completion, history and the insert result
    // consistent with an unedited commit — a separate `insert_text_native`
    // call would deliver the text while the session ended with the stale one.
    text: Option<String>,
    _state: State<'_, Mutex<NativeSessionState>>,
) -> Result<NativeInsertResult, String> {
    commit_pending_preview(&app, text, CommitPath::Frontend, None).await
}

/// Commits a staged preview: insert, history record, transcript file, session
/// completion and the authoritative event.
///
/// The window may reach this and so may the runtime's own deadline (ADR 0134);
/// there is one body for both, because a deadline commit that took a different
/// path would be a second way for a session to end and ADR 0018 allows one.
/// Which path arrived is a log line, not a behaviour difference.
pub async fn commit_pending_preview<R: Runtime>(
    app: &AppHandle<R>,
    text: Option<String>,
    path: CommitPath,
    // `Some` only for the deadline, which may commit the staging it was armed
    // for and no other.
    expected_epoch: Option<u64>,
) -> Result<NativeInsertResult, String> {
    // MUST be async: the clipboard write (wl-copy + verify) can block for up to
    // 800ms. A sync command runs on Tauri's main thread and blocks the webview's
    // JS event loop — frontend safety timeouts cannot fire, the spinner stays
    // forever (State 09), and the overlay freezes. Running the blocking work on
    // a background thread via spawn_blocking keeps the main thread free so JS
    // timers and IPC events flow normally.
    let (session_id, mut preview) = {
        let state = app
            .try_state::<Mutex<NativeSessionState>>()
            .ok_or_else(|| "Native session state is not available.".to_string())?;
        let mut state = state.lock().map_err(|error| error.to_string())?;
        state.take_pending_preview(expected_epoch)?
    };

    if let Some(edited) = text {
        apply_edited_preview_text(&mut preview.transformed, &edited)?;
    }

    let final_text = preview.transformed.text.trim().to_string();
    /* Titled from what is BEING COMMITTED, not from what was staged: the
       overlay can edit a preview before it lands, and a file named after the
       text somebody just corrected would be named after the mistake
       (ADR 0077). */
    /* On the assistant's resolution, for ADR 0087's reason: the title row
       states rather than sets, so it follows the same chat job the assistant
       does and carries no override of its own (ADR 0094). */
    let title = super::transcript_store::title_for(
        &final_text,
        &preview.app_config.job_provider(JobKey::Assistant).provider,
        &preview.app_config.chat_model_for_job(JobKey::Assistant),
    )
    .await;
    if final_text.is_empty() {
        return Err(
            "Pending transcription preview does not contain any text to commit.".to_string(),
        );
    }

    let app_for_blocking = app.clone();
    let corrected = preview.transformed.corrected;
    let auto_paste = preview.app_config.active_text_profile_auto_paste();
    let text_for_insert = final_text.clone();
    let insert_result = tauri::async_runtime::spawn_blocking(move || {
        insert_transcription_from_legacy(
            &app_for_blocking,
            &text_for_insert,
            corrected,
            Some(auto_paste),
        )
    })
    .await
    .map_err(|e| format!("Commit task panicked: {e}"))?;

    match insert_result {
        Ok(result) if result.ok => {
            let history_entry = history::history_entry_from_insert_result(
                &preview.app_config,
                None,
                Some(preview.raw_text.clone()),
                preview.transformed.clone(),
                &result,
                preview.effective_mode.clone(),
                title.clone(),
                preview.capture_integrity,
                preview.input_level,
            )
            .ok();

            // The one path that holds both the pre-edit text and the user's own
            // wording at the same moment, which makes a hand correction a
            // precise signal needing no storage. It stays a secondary source,
            // though: people normally paste into their target document and
            // correct there, so most sessions never reach this branch at all
            // (ADR 0035).
            if let Some(entry) = history_entry.as_ref() {
                let active_profile = preview.app_config.active_text_profile();
                super::vocabulary_learning::learn_from_session(
                    app,
                    super::vocabulary_learning::LearnFromSessionRequest {
                        profile_id: preview.app_config.active_text_profile_id.clone(),
                        observation_id: entry.id.clone(),
                        raw_transcript: preview.raw_text.clone(),
                        final_text: final_text.clone(),
                        known_terms: super::vocabulary_learning::known_terms(
                            &active_profile.vocabulary_phrases(),
                            &active_profile.dictionary_entries,
                        ),
                        applied_rules: preview.transformed.applied_rules.clone(),
                        source: if preview
                            .transformed
                            .applied_rules
                            .iter()
                            .any(|rule| rule == "overlay_edit")
                        {
                            super::vocabulary_learning::LearningSource::HandEdit
                        } else {
                            super::vocabulary_learning::LearningSource::Correction
                        },
                    },
                );
            }

            match complete_processing_session_from_transcription(
                app,
                &session_id,
                &final_text,
                preview.transformed.corrected,
            ) {
                Ok(true) => {
                    // A commit the user did not ask for is a runtime decision,
                    // so the runtime says which path took it (ADR 0134). The
                    // count of deadline commits is the measurement this whole
                    // step is for; inferring it from timing is what the
                    // investigation had to do before.
                    super::runtime_log::record(format!(
                        "[WordScript] Native session completed path={} session_id={} delivery={} text_len={}",
                        path.as_str(),
                        session_id,
                        result.insert_mode.delivery_label(),
                        final_text.len(),
                    ));
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "transcription",
                            "text": final_text,
                            "corrected": preview.transformed.corrected,
                            "provider": preview.provider,
                            "active_profile": preview.app_config.active_text_profile_label(),
                            "work_mode": preview.app_config.resolved_active_text_profile_work_mode(),
                            "raw_text": preview.raw_text,
                            "transform": {
                                "applied_rules": preview.transformed.applied_rules,
                                "warning": preview.transformed.warning,
                            },
                            "history": history_entry.as_ref().map(|entry| serde_json::json!({
                                "entry_id": entry.id,
                                "retry_of": entry.retry_of,
                            })),
                            "delivery": result.insert_mode.delivery_label(),
                            "insertion": result,
                            "capture_integrity": preview.capture_integrity
                        }),
                    );
                    // The delivery point for this mode: the user committed and
                    // the text has landed. Same position in the lifecycle as
                    // the auto_paste pipeline's Done, so both modes sound the
                    // same thing at the same meaning (ADR 0012).
                    sound::play_if_enabled(sound::SoundCue::Done);
                    Ok(result)
                }
                Ok(false) => {
                    Err("The pending transcription preview is no longer current.".to_string())
                }
                Err(error) => {
                    fail_from_native_error(app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                    sound::play_if_enabled(sound::SoundCue::Error);
                    Err("The pending transcription preview is no longer current.".to_string())
                }
            }
        }
        Ok(result) => {
            let _ = history::history_entry_from_insert_result(
                &preview.app_config,
                None,
                Some(preview.raw_text.clone()),
                preview.transformed.clone(),
                &result,
                preview.effective_mode.clone(),
                title.clone(),
                preview.capture_integrity,
                preview.input_level,
            );
            let error = result
                .error
                .clone()
                .unwrap_or_else(|| "Native insertion failed.".to_string());
            let _ = fail_processing_session_from_native_error(app, &session_id, &error);
            let _ = app.emit(
                "wordscript-event",
                serde_json::json!({
                    "event": "error",
                    "message": format!("Native insertion failed: {error}"),
                    "provider": preview.provider,
                    "transform": {
                        "applied_rules": preview.transformed.applied_rules,
                        "warning": preview.transformed.warning,
                    },
                    "insertion": result
                }),
            );
            sound::play_if_enabled(sound::SoundCue::Error);
            Ok(result)
        }
        Err(error) => {
            let _ = history::record_insert_failure(
                &preview.app_config,
                preview.raw_text,
                final_text,
                preview.transformed,
                error.clone(),
                preview.effective_mode,
                title,
                preview.capture_integrity,
                preview.input_level,
            );
            let _ = fail_processing_session_from_native_error(app, &session_id, &error);
            let _ = app.emit(
                "wordscript-event",
                serde_json::json!({
                    "event": "error",
                    "message": format!("Native insertion failed: {error}")
                }),
            );
            sound::play_if_enabled(sound::SoundCue::Error);
            Err(error)
        }
    }
}

/// Replaces a pending preview's text with what the user typed in the overlay's
/// edit surface, before it is delivered.
fn apply_edited_preview_text(
    transformed: &mut NativeTransformResult,
    edited: &str,
) -> Result<(), String> {
    let edited = edited.trim();
    if edited.is_empty() {
        return Err("The edited transcript does not contain any text to commit.".to_string());
    }
    if edited == transformed.text.trim() {
        return Ok(());
    }

    transformed.text = edited.to_string();
    // The text is now the user's, not the transform's. Reporting it as
    // machine-corrected would make history and the diagnostics claim a rewrite
    // that never ran over this wording.
    transformed.corrected = false;
    transformed.applied_rules.push("overlay_edit".to_string());
    Ok(())
}

pub fn stage_pending_transcription_preview<R: Runtime>(
    app: &AppHandle<R>,
    app_config: AppConfig,
    provider: String,
    raw_text: String,
    transformed: NativeTransformResult,
    effective_mode: Option<ProcessingMode>,
    capture_integrity: Option<CaptureIntegrity>,
    input_level: Option<InputLevelSummary>,
) -> Result<PendingTranscriptionPreviewEvent, String> {
    let (epoch, payload, session_id) = {
        let state = app
            .try_state::<Mutex<NativeSessionState>>()
            .ok_or_else(|| "Native session state is not available.".to_string())?;
        let mut state = state.lock().map_err(|error| error.to_string())?;
        let (epoch, payload) = state.stage_pending_preview(
            app_config,
            provider,
            raw_text,
            transformed,
            effective_mode,
            capture_integrity,
            input_level,
        )?;
        (epoch, payload, state.processing_session_id())
    };

    // Armed here rather than after the event, so no ordering between the two
    // can leave a staged preview with nothing behind it.
    arm_preview_commit_deadline(app, session_id.unwrap_or_else(|| "unknown".to_string()), epoch);
    Ok(payload)
}

/// Starts the runtime's deadline for a staged preview (ADR 0134).
///
/// The window may still commit or abort, and normally does — at p90 = 2.27 s
/// this task finds the preview already gone. What it exists for is the case
/// where the window never comes back: everything the user can later reach is
/// created by the commit, so a destroyed webview would otherwise discard a
/// finished dictation with nothing reporting it.
///
/// There is no cancellation channel on purpose. The staged preview IS the
/// cancellation state: a commit or an abort takes it, and a task that wakes to
/// find it gone does nothing.
///
/// A deferral (ADR 0152) is read the same way — as a value on the preview, not
/// as a message. The task wakes, finds the commit instant has moved, and sleeps
/// to the new one. Nothing outside can leave this task waiting forever: the
/// instant only ever moves by a full deadline at a time, so a window that stops
/// asking is one deadline from being finished for.
fn arm_preview_commit_deadline<R: Runtime>(app: &AppHandle<R>, session_id: String, epoch: u64) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut wake_at_ms = now_ms().saturating_add(PREVIEW_COMMIT_DEADLINE_MS);
        loop {
            tokio::time::sleep(Duration::from_millis(wake_at_ms.saturating_sub(now_ms()))).await;

            let commit_at_ms = app
                .try_state::<Mutex<NativeSessionState>>()
                .and_then(|state| {
                    state
                        .lock()
                        .ok()
                        .and_then(|state| state.pending_preview_commit_at(epoch))
                });
            // Taken, aborted, or replaced by a later staging: nothing to do.
            let Some(commit_at_ms) = commit_at_ms else {
                return;
            };

            let now = now_ms();
            if commit_at_ms <= now {
                break;
            }

            super::runtime_log::record(format!(
                "[WordScript] Native preview deadline deferred session_id={session_id} outcome=window_still_editing waited_ms={}",
                commit_at_ms - now
            ));
            wake_at_ms = commit_at_ms;
        }

        super::runtime_log::record(format!(
            "[WordScript] Native preview deadline expired session_id={session_id} deadline_ms={PREVIEW_COMMIT_DEADLINE_MS} outcome=committing"
        ));
        if let Err(error) =
            commit_pending_preview(&app, None, CommitPath::Deadline, Some(epoch)).await
        {
            super::runtime_log::record(format!(
                "[WordScript] Native preview deadline session_id={session_id} outcome=not_committed reason={error}"
            ));
        }
    });
}

pub fn complete_processing_session_from_transcription<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    text: &str,
    corrected: bool,
) -> Result<bool, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let Some(status) = state.complete_processing_session(session_id, text.to_string()) else {
        return Ok(false);
    };

    emit_session_event(
        app,
        if corrected {
            "transcription_corrected"
        } else {
            "transcription"
        },
        &status,
    );
    Ok(true)
}

pub fn start_from_native<R: Runtime>(
    app: &AppHandle<R>,
    trigger: &str,
) -> Result<NativeSessionStatus, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let status = state.start_capture(trigger)?;
    emit_session_event(app, "recording_started", &status);
    Ok(status)
}

pub fn fail_from_native_error<R: Runtime>(app: &AppHandle<R>, message: &str) {
    if let Some(state) = app.try_state::<Mutex<NativeSessionState>>() {
        if let Ok(mut state) = state.lock() {
            let status = state.fail(message.to_string());
            emit_session_event(app, "error", &status);
        }
    }
}

pub fn fail_processing_session_from_native_error<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    message: &str,
) -> Result<bool, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let Some(status) = state.fail_processing_session(session_id, message.to_string()) else {
        return Ok(false);
    };
    emit_session_event(app, "error", &status);
    Ok(true)
}

pub fn processing_from_native<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<NativeSessionStatus, String> {
    processing_or_recover_from_native(app, false, "native_capture_recovery")
}

pub fn processing_or_recover_from_native<R: Runtime>(
    app: &AppHandle<R>,
    capture_is_recording: bool,
    recovery_trigger: &str,
) -> Result<NativeSessionStatus, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let status = state.enter_processing(recovery_trigger, capture_is_recording)?;
    emit_session_event(app, "recording_stopped", &status);
    emit_session_event(app, "processing", &status);
    Ok(status)
}

pub fn abort_from_native<R: Runtime>(
    app: &AppHandle<R>,
    reason: &str,
) -> Result<NativeSessionStatus, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let status = state.abort(reason.to_string());
    emit_session_event(app, "aborted", &status);
    emit_session_event(app, "empty", &status);
    Ok(status)
}

pub fn empty_processing_session_from_native<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    message: &str,
) -> Result<bool, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let Some(status) = state.empty_processing_session(session_id, message.to_string()) else {
        return Ok(false);
    };
    emit_session_event(app, "empty", &status);
    Ok(true)
}

pub fn current_processing_session_id<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    let state = app.try_state::<Mutex<NativeSessionState>>()?;
    let state = state.lock().ok()?;
    state.processing_session_id()
}

pub fn is_processing_session_current<R: Runtime>(app: &AppHandle<R>, session_id: &str) -> bool {
    let Some(state) = app.try_state::<Mutex<NativeSessionState>>() else {
        return false;
    };
    state
        .lock()
        .map(|state| state.is_processing_session_current(session_id))
        .unwrap_or(false)
}

/// Whether a capture or its pipeline is running right now.
///
/// The guard for settings that a running session has already snapshotted. The
/// only one that matters is the active profile: the capture config is taken at
/// capture start, while the pipeline resolves the profile again once the audio
/// is ready — so switching profiles mid-session mixed the two, and no later
/// step could undo the transcription that had already run under the first one.
///
/// `Completed`, `Aborted` and `Error` are terminal stages of a finished
/// session, not a running one, so they are deliberately not included.
pub fn session_is_active<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Some(state) = app.try_state::<Mutex<NativeSessionState>>() else {
        return false;
    };
    state
        .lock()
        .map(|state| {
            matches!(
                state.status().stage,
                NativeSessionStage::Capturing | NativeSessionStage::Processing
            )
        })
        .unwrap_or(false)
}

/// The message every blocked write shares, so the reason reads the same
/// wherever the user meets it.
pub const PROFILE_LOCKED_DURING_SESSION: &str =
    "The active profile cannot be changed while a recording is running. It decides the recognizer settings, which are fixed the moment recording starts. Finish or abort the recording first — the processing mode can still be changed at any time.";

pub fn emit_session_event<R: Runtime>(
    app: &AppHandle<R>,
    event: &str,
    status: &NativeSessionStatus,
) {
    let _ = app.emit(
        "wordscript-native-event",
        NativeSessionEvent {
            event: event.to_string(),
            status: status.clone(),
        },
    );
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn transformed(text: &str, corrected: bool) -> NativeTransformResult {
        NativeTransformResult {
            text: text.to_string(),
            corrected,
            applied_rules: vec!["removed_fillers".to_string()],
            warning: None,
        }
    }

    #[test]
    fn an_overlay_edit_replaces_the_pending_text_and_drops_the_corrected_claim() {
        let mut result = transformed("Wir shippen das morgen.", true);

        apply_edited_preview_text(&mut result, "  Wir shippen das übermorgen.  ").unwrap();

        assert_eq!(result.text, "Wir shippen das übermorgen.");
        // The wording is the user's now; claiming a machine correction over it
        // would misreport history and the diagnostics.
        assert!(!result.corrected);
        assert!(result.applied_rules.iter().any(|rule| rule == "overlay_edit"));
    }

    #[test]
    fn an_unchanged_overlay_edit_leaves_the_preview_untouched() {
        let mut result = transformed("Wir shippen das morgen.", true);

        apply_edited_preview_text(&mut result, "Wir shippen das morgen.").unwrap();

        assert!(result.corrected, "opening the editor is not itself an edit");
        assert_eq!(result.applied_rules, vec!["removed_fillers".to_string()]);
    }

    #[test]
    fn an_emptied_overlay_edit_is_refused_instead_of_delivering_nothing() {
        let mut result = transformed("Wir shippen das morgen.", true);

        let error = apply_edited_preview_text(&mut result, "   ").unwrap_err();

        assert!(error.contains("does not contain any text"));
        assert_eq!(result.text, "Wir shippen das morgen.");
    }

    #[test]
    fn resolves_capture_to_completed_session() {
        let mut state = NativeSessionState::default();
        let started = state.start_capture("hotkey").unwrap();
        assert_eq!(started.stage, NativeSessionStage::Capturing);

        let processing = state.stop_for_processing().unwrap();
        assert_eq!(processing.stage, NativeSessionStage::Processing);

        let completed = state.complete_transcription("Hello world.");
        assert_eq!(completed.stage, NativeSessionStage::Completed);
        assert_eq!(completed.last_transcript.as_deref(), Some("Hello world."));
        assert!(completed.active_session_id.is_none());
    }

    #[test]
    fn guarded_completion_requires_matching_processing_session() {
        let mut state = NativeSessionState::default();
        let started = state.start_capture("hotkey").unwrap();
        let session_id = started.active_session_id.unwrap();

        assert!(state
            .complete_processing_session(&session_id, "too early")
            .is_none());

        state.stop_for_processing().unwrap();
        let completed = state
            .complete_processing_session(&session_id, "Hello world.")
            .unwrap();

        assert_eq!(completed.stage, NativeSessionStage::Completed);
        assert_eq!(completed.last_transcript.as_deref(), Some("Hello world."));
        assert!(state
            .complete_processing_session(&session_id, "second result")
            .is_none());
    }

    #[test]
    fn stale_processing_completion_does_not_overwrite_new_session() {
        let mut state = NativeSessionState::default();
        let first = state.start_capture("first_hotkey").unwrap();
        let first_session_id = first.active_session_id.unwrap();
        state.stop_for_processing().unwrap();
        state.abort("user cancelled");

        let second = state.start_capture("second_hotkey").unwrap();
        let second_session_id = second.active_session_id.clone().unwrap();

        assert!(state
            .complete_processing_session(&first_session_id, "old transcript")
            .is_none());

        let status = state.status();
        assert_eq!(status.stage, NativeSessionStage::Capturing);
        assert_eq!(
            status.active_session_id.as_deref(),
            Some(second_session_id.as_str())
        );
        assert_eq!(status.active_trigger.as_deref(), Some("second_hotkey"));
        assert!(status.last_transcript.is_none());
    }

    #[test]
    fn stale_processing_failure_does_not_overwrite_completed_session() {
        let mut state = NativeSessionState::default();
        let started = state.start_capture("hotkey").unwrap();
        let session_id = started.active_session_id.unwrap();
        state.stop_for_processing().unwrap();
        state
            .complete_processing_session(&session_id, "fresh transcript")
            .unwrap();

        assert!(state
            .fail_processing_session(&session_id, "late provider error")
            .is_none());

        let status = state.status();
        assert_eq!(status.stage, NativeSessionStage::Completed);
        assert_eq!(status.last_transcript.as_deref(), Some("fresh transcript"));
        assert!(status.last_error.is_none());
    }

    #[test]
    fn force_processing_recovers_when_capture_state_is_authoritative() {
        let mut state = NativeSessionState::default();

        let recovered = state.force_processing_for_active_capture("native_capture_recovery");

        assert_eq!(recovered.stage, NativeSessionStage::Processing);
        assert_eq!(
            recovered.active_trigger.as_deref(),
            Some("native_capture_recovery")
        );
        assert!(recovered.active_session_id.is_some());
    }

    #[test]
    fn enter_processing_recovers_when_capture_state_is_authoritative() {
        let mut state = NativeSessionState::default();

        let recovered = state
            .enter_processing("native_capture_recovery", true)
            .unwrap();

        assert_eq!(recovered.stage, NativeSessionStage::Processing);
        assert_eq!(
            recovered.active_trigger.as_deref(),
            Some("native_capture_recovery")
        );
        assert!(recovered.active_session_id.is_some());
    }

    #[test]
    fn abort_clears_active_session_and_keeps_reason() {
        let mut state = NativeSessionState::default();

        state.start_capture("hotkey").unwrap();
        let aborted = state.abort("user cancelled");

        assert_eq!(aborted.stage, NativeSessionStage::Aborted);
        assert_eq!(aborted.last_error.as_deref(), Some("user cancelled"));
        assert!(aborted.active_session_id.is_none());
    }

    fn stage_preview(state: &mut NativeSessionState, text: &str) -> u64 {
        let (epoch, _) = state
            .stage_pending_preview(
                AppConfig::default(),
                "groq".to_string(),
                "raw transcript".to_string(),
                NativeTransformResult {
                    text: text.to_string(),
                    corrected: true,
                    applied_rules: vec!["removed_fillers".to_string()],
                    warning: None,
                },
                None,
                None,
                None,
            )
            .unwrap();
        epoch
    }

    #[test]
    fn abort_clears_pending_preview_commit_state() {
        let mut state = NativeSessionState::default();

        state.start_capture("hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let (epoch, staged) = state
            .stage_pending_preview(
                AppConfig::default(),
                "groq".to_string(),
                "raw transcript".to_string(),
                NativeTransformResult {
                    text: "Final transcript".to_string(),
                    corrected: true,
                    applied_rules: vec!["removed_fillers".to_string()],
                    warning: None,
                },
                None,
                None,
                None,
            )
            .unwrap();

        assert_eq!(staged.text, "Final transcript");
        assert!(state.pending_preview.is_some());
        assert!(state.preview_epoch_is_pending(epoch));

        state.abort("user cancelled");

        assert!(state.pending_preview.is_none());
        // The abort is the cancellation: the deadline armed for this staging
        // wakes to find nothing and does nothing (ADR 0134).
        assert!(!state.preview_epoch_is_pending(epoch));
    }

    #[test]
    fn a_window_commit_leaves_its_deadline_nothing_to_take() {
        let mut state = NativeSessionState::default();
        state.start_capture("hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let epoch = stage_preview(&mut state, "Final transcript");

        let (session_id, preview) = state.take_pending_preview(None).unwrap();
        assert_eq!(session_id, "native-1");
        assert_eq!(preview.transformed.text, "Final transcript");

        // ADR 0134's third rule from the other side: whichever path arrives
        // second finds the preview gone, and there is exactly one commit.
        let error = state.take_pending_preview(Some(epoch)).unwrap_err();
        assert!(error.contains("deadline was armed for"));
    }

    #[test]
    fn a_deadline_may_not_commit_a_preview_it_was_not_armed_for() {
        let mut state = NativeSessionState::default();
        state.start_capture("first_hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let first_epoch = stage_preview(&mut state, "First transcript");

        // An abort inside the deadline window frees the session, and the next
        // capture can stage its own preview before the first deadline expires.
        state.abort("user cancelled");
        state.start_capture("second_hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let second_epoch = stage_preview(&mut state, "Second transcript");
        assert_ne!(first_epoch, second_epoch);

        let error = state.take_pending_preview(Some(first_epoch)).unwrap_err();
        assert!(error.contains("deadline was armed for"));
        assert!(
            state.pending_preview.is_some(),
            "a stale deadline must leave the current staging alone"
        );

        let (session_id, preview) = state.take_pending_preview(Some(second_epoch)).unwrap();
        assert_eq!(session_id, "native-2");
        assert_eq!(preview.transformed.text, "Second transcript");
    }

    #[test]
    fn a_deadline_does_not_reach_a_session_that_already_ended() {
        let mut state = NativeSessionState::default();
        state.start_capture("hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let epoch = stage_preview(&mut state, "Final transcript");

        state.complete_transcription("Final transcript");

        assert!(!state.preview_epoch_is_pending(epoch));
        let error = state.take_pending_preview(Some(epoch)).unwrap_err();
        assert!(error.contains("No native session is waiting"));
    }

    #[test]
    fn a_deferral_pushes_the_commit_a_full_deadline_out() {
        let mut state = NativeSessionState::default();
        state.start_capture("hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let epoch = stage_preview(&mut state, "Final transcript");

        let armed = state.pending_preview_commit_at(epoch).unwrap();
        let deferred = state.defer_pending_preview_commit(epoch).unwrap();

        assert!(
            deferred >= armed,
            "a deferral must not bring the commit closer: {deferred} < {armed}"
        );
        assert_eq!(state.pending_preview_commit_at(epoch), Some(deferred));
        // The window is granted the ordinary window from now, not an open-ended
        // hold — this is the arithmetic that makes a dead window's last
        // deferral expire on its own (ADR 0152).
        assert!(deferred.saturating_sub(now_ms()) <= PREVIEW_COMMIT_DEADLINE_MS);
    }

    /// The failure this exists against: a deferral in flight across a session
    /// change extends the NEXT dictation's deadline. The epoch is the same guard
    /// ADR 0134 gave the deadline itself, applied to the request that moves it.
    #[test]
    fn a_deferral_may_not_move_a_deadline_it_does_not_name() {
        let mut state = NativeSessionState::default();
        state.start_capture("first_hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let first_epoch = stage_preview(&mut state, "First transcript");

        state.abort("user cancelled");
        state.start_capture("second_hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let second_epoch = stage_preview(&mut state, "Second transcript");
        let second_commit_at = state.pending_preview_commit_at(second_epoch).unwrap();

        let error = state.defer_pending_preview_commit(first_epoch).unwrap_err();

        assert!(error.contains("no longer pending"));
        assert_eq!(
            state.pending_preview_commit_at(second_epoch),
            Some(second_commit_at),
            "the staging that is actually pending must keep its own deadline"
        );
    }

    #[test]
    fn a_deferral_finds_nothing_once_the_preview_is_committed() {
        let mut state = NativeSessionState::default();
        state.start_capture("hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let epoch = stage_preview(&mut state, "Final transcript");

        state.take_pending_preview(None).unwrap();

        assert!(state.defer_pending_preview_commit(epoch).is_err());
        assert_eq!(state.pending_preview_commit_at(epoch), None);
    }

    #[test]
    fn a_snapshot_carries_a_live_capture_back_to_a_window_that_missed_it() {
        let mut state = NativeSessionState::default();
        state.start_capture("hotkey").unwrap();

        let snapshot = state.snapshot(true, false);

        assert_eq!(snapshot.stage, NativeSessionStage::Capturing);
        assert_eq!(snapshot.session_id.as_deref(), Some("native-1"));
        // The elapsed time a restored pill shows is the session's, not the
        // remount's (ADR 0151).
        assert!(snapshot.started_at_ms.is_some());
        assert!(snapshot.muted);
        assert!(!snapshot.paused);
        assert!(snapshot.pending_preview.is_none());
    }

    #[test]
    fn a_snapshot_offers_the_preview_that_is_still_waiting() {
        let mut state = NativeSessionState::default();
        state.start_capture("hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let epoch = stage_preview(&mut state, "Final transcript");

        let snapshot = state.snapshot(false, false);
        let preview = snapshot.pending_preview.expect("a staged preview");

        assert_eq!(snapshot.stage, NativeSessionStage::Processing);
        assert_eq!(preview.text, "Final transcript");
        // The window needs the epoch to ask for more time (ADR 0152), and a
        // restored window is exactly the one that never saw the event carrying
        // it.
        assert_eq!(preview.preview_epoch, epoch);
    }

    /// ADR 0134's obligation on the restore: once the deadline has taken the
    /// preview, no window may be handed it back as something to commit.
    #[test]
    fn a_snapshot_after_the_deadline_committed_offers_nothing() {
        let mut state = NativeSessionState::default();
        state.start_capture("hotkey").unwrap();
        state.stop_for_processing().unwrap();
        let epoch = stage_preview(&mut state, "Final transcript");

        state.take_pending_preview(Some(epoch)).unwrap();
        state.complete_transcription("Final transcript");

        let snapshot = state.snapshot(false, false);

        assert_eq!(snapshot.stage, NativeSessionStage::Completed);
        assert!(snapshot.pending_preview.is_none());
        assert!(
            snapshot.session_id.is_none(),
            "a session that ended has nothing live for a window to repaint"
        );
    }

    #[test]
    fn enter_processing_without_capture_or_recovery_errors() {
        let mut state = NativeSessionState::default();

        let error = state
            .enter_processing("native_capture_recovery", false)
            .unwrap_err();

        assert_eq!(error, "No native capture session is currently recording.");
    }
}
