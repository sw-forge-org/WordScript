use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::config::{AppConfig, ProcessingMode, TextProfileWorkMode};
use super::insertion::{
    insert_transcription_from_legacy, NativeClipboardRestoreStatus, NativeInsertDriver,
    NativeInsertMode, NativeInsertRecoveryAction, NativeInsertResult,
};
use super::paths::history_file_path;
use super::runtime_log;
use super::sessions::now_ms;
use super::transform::{finalize_with_text_rules, NativeTransformConfig, NativeTransformResult};

const DEFAULT_HISTORY_LIMIT: usize = 200;
const MS_PER_DAY: u64 = 86_400_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionHistoryStatus {
    Completed,
    Empty,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionHistorySource {
    NativePipeline,
    Retry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionHistoryEntry {
    pub id: String,
    pub created_at_ms: u64,
    pub status: TranscriptionHistoryStatus,
    pub source: TranscriptionHistorySource,
    pub retry_of: Option<String>,
    pub provider: String,
    pub model: Option<String>,
    pub language: Option<String>,
    pub active_profile: Option<String>,
    #[serde(default)]
    pub work_mode: Option<TextProfileWorkMode>,
    /// WHAT ACTUALLY RAN, which `work_mode.processing_mode` is not.
    ///
    /// The work mode is the profile's stored setting, and `Auto` stays `Auto`
    /// in it — the resolution happens once, in the pipeline, and was recorded
    /// nowhere. Two things need the answer: the transcript file states the mode
    /// its text was produced under (ADR 0074), and a retry has to re-run the
    /// mode the record ran in rather than a correction (ADR 0075).
    ///
    /// `None` on every entry written before the field existed, and on the paths
    /// that never reached a transform.
    #[serde(default)]
    pub effective_mode: Option<ProcessingMode>,
    /// The Markdown file this record was written to (ADR 0074).
    ///
    /// `None` where there was no text to write, and on entries older than the
    /// store. It is also the ONLY thing that authorises a delete: the runtime
    /// removes paths an entry names and never walks the directory.
    #[serde(default)]
    pub transcript_path: Option<String>,
    pub provider_profile: Option<String>,
    pub local_prompt_strength: Option<String>,
    pub local_prompt_carry: Option<bool>,
    pub local_beam_size: Option<u8>,
    pub local_best_of: Option<u8>,
    pub raw_transcript: Option<String>,
    pub transformed_transcript: Option<String>,
    pub corrected: bool,
    pub applied_rules: Vec<String>,
    pub transform_warning: Option<String>,
    pub insert_mode: Option<NativeInsertMode>,
    pub active_driver: Option<NativeInsertDriver>,
    pub pasted: Option<bool>,
    pub fallback_available: Option<bool>,
    pub fallback_reason: Option<String>,
    pub recovery_action: Option<NativeInsertRecoveryAction>,
    pub recovery_message: Option<String>,
    pub clipboard_restore: Option<NativeClipboardRestoreStatus>,
    pub error: Option<String>,
    /// Where the capture this entry failed on is still sitting, when the
    /// runtime kept it for a retry. `None` on every entry that has nothing to
    /// retry from — a successful run deletes its audio, and so does an
    /// unrecoverable failure.
    #[serde(default)]
    pub audio_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RecordHistoryEntryRequest {
    pub status: TranscriptionHistoryStatus,
    pub source: TranscriptionHistorySource,
    pub retry_of: Option<String>,
    pub provider: String,
    pub model: Option<String>,
    pub language: Option<String>,
    pub active_profile: Option<String>,
    /// The mode the transform actually ran in, where the caller knows it. The
    /// paths that never reached a transform pass `None`.
    pub effective_mode: Option<ProcessingMode>,
    pub provider_profile: Option<String>,
    pub local_prompt_strength: Option<String>,
    pub local_prompt_carry: Option<bool>,
    pub local_beam_size: Option<u8>,
    pub local_best_of: Option<u8>,
    pub raw_transcript: Option<String>,
    pub transformed_transcript: Option<String>,
    pub corrected: bool,
    pub applied_rules: Vec<String>,
    pub transform_warning: Option<String>,
    pub insert_mode: Option<NativeInsertMode>,
    pub active_driver: Option<NativeInsertDriver>,
    pub pasted: Option<bool>,
    pub fallback_available: Option<bool>,
    pub fallback_reason: Option<String>,
    pub recovery_action: Option<NativeInsertRecoveryAction>,
    pub recovery_message: Option<String>,
    pub clipboard_restore: Option<NativeClipboardRestoreStatus>,
    pub error: Option<String>,
    pub audio_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteTranscriptionHistoryEntryRequest {
    pub id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RetryTranscriptionHistoryEntryRequest {
    pub id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct TranscriptionHistoryQuery {
    pub limit: Option<usize>,
    pub provider: Option<String>,
    pub status: Option<TranscriptionHistoryStatus>,
    pub source: Option<TranscriptionHistorySource>,
    pub active_profile: Option<String>,
    pub search: Option<String>,
    pub include_errors_only: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExportTranscriptionHistoryRequest {
    pub path: String,
    #[serde(default)]
    pub query: TranscriptionHistoryQuery,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportTranscriptionHistoryResponse {
    pub path: String,
    pub exported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionHistoryStorageStatus {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TranscriptionHistoryExportDocument {
    exported_at_ms: u64,
    history_limit: usize,
    history_retention_days: u32,
    count: usize,
    entries: Vec<TranscriptionHistoryEntry>,
}

#[derive(Debug, Clone, Default)]
struct LocalHistoryContext {
    provider_profile: Option<String>,
    local_prompt_strength: Option<String>,
    local_prompt_carry: Option<bool>,
    local_beam_size: Option<u8>,
    local_best_of: Option<u8>,
}

#[derive(Debug, Default)]
struct TranscriptionHistoryStore {
    loaded: bool,
    entries: VecDeque<TranscriptionHistoryEntry>,
}

fn history_store() -> &'static Mutex<TranscriptionHistoryStore> {
    static STORE: OnceLock<Mutex<TranscriptionHistoryStore>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(TranscriptionHistoryStore::default()))
}

#[cfg(test)]
fn history_path_override() -> &'static Mutex<Option<PathBuf>> {
    static OVERRIDE: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    OVERRIDE.get_or_init(|| Mutex::new(None))
}

#[cfg(test)]
fn history_policy_override() -> &'static Mutex<Option<(usize, u32)>> {
    static OVERRIDE: OnceLock<Mutex<Option<(usize, u32)>>> = OnceLock::new();
    OVERRIDE.get_or_init(|| Mutex::new(None))
}

fn resolved_history_file_path() -> PathBuf {
    #[cfg(test)]
    if let Ok(guard) = history_path_override().lock() {
        if let Some(path) = guard.clone() {
            return path;
        }
    }

    history_file_path()
}

fn ensure_loaded(store: &mut TranscriptionHistoryStore) {
    if store.loaded {
        return;
    }

    store.entries = load_history_entries();
    store.loaded = true;
}

fn load_history_entries() -> VecDeque<TranscriptionHistoryEntry> {
    let path = resolved_history_file_path();
    let Ok(raw) = std::fs::read_to_string(path) else {
        return VecDeque::with_capacity(DEFAULT_HISTORY_LIMIT);
    };

    let mut entries = serde_json::from_str::<VecDeque<TranscriptionHistoryEntry>>(&raw)
        .or_else(|_| {
            serde_json::from_str::<Vec<TranscriptionHistoryEntry>>(&raw).map(VecDeque::from)
        })
        .unwrap_or_else(|_| VecDeque::with_capacity(DEFAULT_HISTORY_LIMIT));
    prune_entries_for_runtime(&mut entries);
    entries
}

fn save_history_entries(entries: &VecDeque<TranscriptionHistoryEntry>) -> Result<(), String> {
    let path = resolved_history_file_path();
    let raw = serde_json::to_string_pretty(entries).map_err(|error| error.to_string())?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(path, raw).map_err(|error| error.to_string())
}

fn next_history_id(created_at_ms: u64, entries_len: usize) -> String {
    format!("history-{created_at_ms}-{entries_len}")
}

#[cfg(test)]
pub fn record_entry(
    request: RecordHistoryEntryRequest,
) -> Result<TranscriptionHistoryEntry, String> {
    record_entry_with_work_mode(request, None)
}

fn record_entry_with_work_mode(
    request: RecordHistoryEntryRequest,
    work_mode: Option<TextProfileWorkMode>,
) -> Result<TranscriptionHistoryEntry, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);

    let created_at_ms = now_ms();
    let id = next_history_id(created_at_ms, store.entries.len());

    /* THE FILE IS WRITTEN HERE BECAUSE THIS IS WHERE A RECORD COMES INTO
       EXISTENCE (ADR 0074). Every path arrives at this function — the native
       pipeline, an empty result, an insert failure, a transcription failure and
       a retry — so "one file per session on every path" is structural rather
       than a rule five callers have to remember. A record with no written text
       gets no file, and `write_transcript` answers `None` for it. */
    let transcript_path = super::transcript_store::write_transcript(
        &super::transcript_store::TranscriptDocument {
            id: id.clone(),
            created_at_ms,
            written: request.transformed_transcript.clone().unwrap_or_default(),
            heard: request.raw_transcript.clone(),
            profile: request.active_profile.clone(),
            // What ran, falling back to what the profile was set to. The
            // fallback is only reached on paths that never resolved a mode,
            // and `Auto` is then the honest answer rather than a guess at
            // which concrete mode it would have become.
            mode: request
                .effective_mode
                .clone()
                .or_else(|| work_mode.as_ref().map(|mode| mode.processing_mode.clone())),
            provider: request.provider.clone(),
            model: request.model.clone(),
            insert_mode: request.insert_mode.clone(),
            audio_path: request.audio_path.clone(),
        },
    );

    let entry = TranscriptionHistoryEntry {
        id,
        created_at_ms,
        status: request.status,
        source: request.source,
        retry_of: request.retry_of,
        provider: request.provider,
        model: request.model,
        language: request.language,
        active_profile: request.active_profile,
        work_mode,
        effective_mode: request.effective_mode,
        transcript_path,
        provider_profile: request.provider_profile,
        local_prompt_strength: request.local_prompt_strength,
        local_prompt_carry: request.local_prompt_carry,
        local_beam_size: request.local_beam_size,
        local_best_of: request.local_best_of,
        raw_transcript: request.raw_transcript,
        transformed_transcript: request.transformed_transcript,
        corrected: request.corrected,
        applied_rules: request.applied_rules,
        transform_warning: request.transform_warning,
        insert_mode: request.insert_mode,
        active_driver: request.active_driver,
        pasted: request.pasted,
        fallback_available: request.fallback_available,
        fallback_reason: request.fallback_reason,
        recovery_action: request.recovery_action,
        recovery_message: request.recovery_message,
        clipboard_restore: request.clipboard_restore,
        error: request.error,
        audio_path: request.audio_path,
    };

    store.entries.push_front(entry.clone());
    prune_entries_for_runtime(&mut store.entries);

    save_history_entries(&store.entries)?;
    Ok(entry)
}

fn entries_snapshot() -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    prune_entries_for_runtime(&mut store.entries);
    Ok(store.entries.iter().cloned().collect())
}

#[tauri::command]
pub fn transcription_history_entries(
    query: Option<TranscriptionHistoryQuery>,
) -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let entries = entries_snapshot()?;
    Ok(filter_history_entries(entries, &query.unwrap_or_default()))
}

#[tauri::command]
pub fn transcription_history_storage_status() -> Result<TranscriptionHistoryStorageStatus, String> {
    Ok(TranscriptionHistoryStorageStatus {
        path: resolved_history_file_path().to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn clear_transcription_history_entries() -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    // The record is the entry AND its file since ADR 0074. Clearing one and
    // leaving the other is the drift the ADR exists to prevent, and on this
    // command it is also what the button says it does.
    let cleared: Vec<TranscriptionHistoryEntry> = store.entries.drain(..).collect();
    save_history_entries(&store.entries)?;
    remove_transcript_files(&cleared);
    Ok(Vec::new())
}

#[tauri::command]
pub fn delete_transcription_history_entry(
    request: DeleteTranscriptionHistoryEntryRequest,
) -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    let removed: Vec<TranscriptionHistoryEntry> = store
        .entries
        .iter()
        .filter(|entry| entry.id == request.id)
        .cloned()
        .collect();
    store.entries.retain(|entry| entry.id != request.id);
    save_history_entries(&store.entries)?;
    remove_transcript_files(&removed);
    Ok(store.entries.iter().cloned().collect())
}

#[tauri::command]
pub fn export_transcription_history(
    request: ExportTranscriptionHistoryRequest,
) -> Result<ExportTranscriptionHistoryResponse, String> {
    let entries = filter_history_entries(entries_snapshot()?, &request.query);
    let path = PathBuf::from(request.path.trim());
    if path.as_os_str().is_empty() {
        return Err("Choose a file path for the history export.".to_string());
    }

    let (history_limit, history_retention_days) = runtime_history_policy();
    let document = TranscriptionHistoryExportDocument {
        exported_at_ms: now_ms(),
        history_limit,
        history_retention_days,
        count: entries.len(),
        entries,
    };
    let raw = serde_json::to_string_pretty(&document).map_err(|error| error.to_string())?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(&path, raw).map_err(|error| error.to_string())?;

    Ok(ExportTranscriptionHistoryResponse {
        path: path.to_string_lossy().to_string(),
        exported_count: document.count,
    })
}

/// Re-transcribe the capture an entry kept, and return the raw text.
///
/// The retry path for a failure that never produced a transcript. It rebuilds
/// the provider request from the *current* capture config rather than the one
/// the original run used: the retry happens because something was wrong, and
/// the fix is often a setting the user changed in between.
async fn transcribe_retained_capture(
    entry: &TranscriptionHistoryEntry,
) -> Result<String, String> {
    let audio_path = entry
        .audio_path
        .clone()
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| {
            "This history entry has neither a transcript nor a kept recording, so there is nothing to re-process."
                .to_string()
        })?;

    // The path comes out of history.json, which is a plain file on disk. Anything
    // that can write it could otherwise point a retry at an arbitrary file and
    // have WordScript upload it to the transcription provider — turning a local
    // write into an exfiltration path. A retry may only ever re-send a capture
    // this app wrote, in the directory it writes them to.
    if !super::capture::is_retained_capture_path(&audio_path) {
        return Err(
            "This entry does not point at a WordScript recording, so it will not be re-sent."
                .to_string(),
        );
    }

    let metadata = std::fs::metadata(&audio_path).map_err(|_| {
        "The recording for this entry is no longer on disk. Kept recordings are pruned after seven days."
            .to_string()
    })?;

    // Duration from file size, because the export is a fixed-rate mono WAV and
    // the budget only needs it to size the wait. Reading the header to learn
    // what the writer already guarantees would be a second source for it.
    let audio_seconds = metadata.len() as f64 / super::capture_budget::EXPORT_BYTES_PER_SECOND as f64;
    let timeout_ms = super::capture_budget::transcription_timeout_ms(Some(audio_seconds));

    let capture_config = super::capture::NativeCaptureConfig::load_from_disk();
    let request = capture_config.resolve_transcription_request(&audio_path, timeout_ms);

    runtime_log::record(format!(
        "[WordScript] History retry from audio entry_id={} path={} audio_seconds={:.1} timeout_ms={}",
        entry.id, audio_path, audio_seconds, timeout_ms,
    ));

    let response = super::providers::transcribe_audio_file(request)
        .await
        .map_err(|error| error.message)?;

    let text = response.text.trim().to_string();
    if text.is_empty() {
        return Err("The recording was transcribed but produced no text.".to_string());
    }

    Ok(text)
}

#[tauri::command]
pub async fn retry_transcription_history_entry<R: Runtime>(
    app: AppHandle<R>,
    request: RetryTranscriptionHistoryEntryRequest,
) -> Result<TranscriptionHistoryEntry, String> {
    let existing = entries_snapshot()?
        .into_iter()
        .find(|entry| entry.id == request.id)
        .ok_or_else(|| format!("History entry '{}' was not found.", request.id))?;

    // Two kinds of retry, and which one this is depends on how far the original
    // run got. With a transcript, only the transform re-runs. Without one — a
    // transcription that timed out — the retry starts from the audio the
    // runtime kept, which is the whole reason it is kept.
    let raw_transcript = match existing
        .raw_transcript
        .clone()
        .filter(|value| !value.trim().is_empty())
    {
        Some(transcript) => transcript,
        None => transcribe_retained_capture(&existing).await?,
    };

    let app_config = AppConfig::load_from_disk();
    let mut transform_config = transform_config_from_app_config(&app_config);
    let local_history = local_history_context(&app_config);

    /* THE MODE THE RECORD RAN IN, not a correction (ADR 0075).
       This function used to call `apply_native_transform` for every entry,
       which is the cleanup family's transform and only theirs — so a retried
       Agent, Translate or Prompt Enhance record came back conservatively
       tidied instead of re-run.

       The record is the source, in this order: what actually ran, then the
       profile's stored mode as it was at record time, then this machine's
       current one for entries older than either field. Auto is resolved here
       rather than carried, because an Auto record has no concrete mode to
       repeat and the router is what decides one. */
    let retry_mode = resolve_retry_mode(&existing, &app_config);
    transform_config.apply_preset(retry_mode.transform_preset());

    runtime_log::record(format!(
        "[WordScript] History retry start entry_id={} provider={} mode={} post_process={}",
        existing.id,
        transform_config.provider,
        retry_mode.as_str(),
        transform_config.post_process,
    ));

    let active_profile = app_config
        .text_profiles
        .iter()
        .find(|profile| profile.id == app_config.active_text_profile_id);

    // Text rules are the pipeline's final stage and no longer run inside
    // `apply_native_transform`, so the retry has to finalize too — otherwise a
    // retried entry would come back without the profile's dictionary applied.
    let transformed = finalize_with_text_rules(
        super::mode_router::apply_mode_transform(
            &raw_transcript,
            &retry_mode,
            &transform_config,
            &app_config,
            active_profile,
        )
        .await,
        &transform_config,
    );
    let transformed_text = transformed.text.trim().to_string();

    let retried_entry = if transformed_text.is_empty() {
        record_entry_with_work_mode(
            RecordHistoryEntryRequest {
                status: TranscriptionHistoryStatus::Empty,
                source: TranscriptionHistorySource::Retry,
                retry_of: Some(existing.id.clone()),
                provider: transform_config.provider,
                model: Some(active_model_for_provider(&app_config)),
                language: optional_non_empty(&app_config.language),
                active_profile: app_config.active_text_profile_label(),
                effective_mode: Some(retry_mode.clone()),
                provider_profile: local_history.provider_profile,
                local_prompt_strength: local_history.local_prompt_strength,
                local_prompt_carry: local_history.local_prompt_carry,
                local_beam_size: local_history.local_beam_size,
                local_best_of: local_history.local_best_of,
                raw_transcript: Some(raw_transcript),
                transformed_transcript: None,
                corrected: transformed.corrected,
                applied_rules: transformed.applied_rules,
                transform_warning: transformed.warning,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: Some("Retry produced no usable transcript.".to_string()),
                audio_path: None,
            },
            Some(app_config.resolved_active_text_profile_work_mode()),
        )?
    } else {
        let insert_result = insert_transcription_from_legacy(
            &app,
            &transformed_text,
            transformed.corrected,
            Some(app_config.active_text_profile_auto_paste()),
        )
        .map_err(|error| error.to_string())?;

        let entry = history_entry_from_insert_result(
            &app_config,
            Some(existing.id.as_str()),
            Some(raw_transcript),
            transformed,
            &insert_result,
            Some(retry_mode.clone()),
        )?;

        if insert_result.ok {
            let _ = app.emit(
                "wordscript-event",
                serde_json::json!({
                    "event": "transcription",
                    "text": transformed_text,
                    "corrected": entry.corrected,
                    "provider": entry.provider,
                    "active_profile": entry.active_profile,
                    "work_mode": entry.work_mode,
                    "raw_text": entry.raw_transcript,
                    "transform": {
                        "applied_rules": entry.applied_rules,
                        "warning": entry.transform_warning,
                    },
                    "history": {
                        "entry_id": entry.id,
                        "retry_of": entry.retry_of,
                    },
                    "delivery": insert_result.insert_mode.delivery_label(),
                    "insertion": insert_result,
                }),
            );
            // The retry's delivery point, next to the event that tells the UI
            // the same thing (ADR 0012).
            super::sound::play_if_enabled(super::sound::SoundCue::Done);
        } else {
            super::sound::play_if_enabled(super::sound::SoundCue::Error);
        }

        entry
    };

    runtime_log::record(format!(
        "[WordScript] History retry done entry_id={} retry_of={:?} status={:?}",
        retried_entry.id, retried_entry.retry_of, retried_entry.status,
    ));

    Ok(retried_entry)
}

pub fn history_entry_from_insert_result(
    app_config: &AppConfig,
    retry_of: Option<&str>,
    raw_transcript: Option<String>,
    transformed: NativeTransformResult,
    insert_result: &NativeInsertResult,
    // The mode the transform ran in, where the caller resolved one. `None` on
    // the paths that never consulted the mode router.
    effective_mode: Option<ProcessingMode>,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: if insert_result.ok {
                TranscriptionHistoryStatus::Completed
            } else {
                TranscriptionHistoryStatus::Failed
            },
            source: if retry_of.is_some() {
                TranscriptionHistorySource::Retry
            } else {
                TranscriptionHistorySource::NativePipeline
            },
            retry_of: retry_of.map(ToString::to_string),
            provider: app_config.provider.clone(),
            model: Some(active_model_for_provider(app_config)),
            language: optional_non_empty(&app_config.language),
            active_profile: app_config.active_text_profile_label(),
            effective_mode,
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript,
            transformed_transcript: Some(insert_result.text.clone()),
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: Some(insert_result.insert_mode.clone()),
            active_driver: Some(insert_result.active_driver),
            pasted: Some(insert_result.pasted),
            fallback_available: Some(insert_result.fallback_available),
            fallback_reason: insert_result.fallback_reason.clone(),
            recovery_action: Some(insert_result.recovery_action),
            recovery_message: Some(insert_result.recovery_message.clone()),
            clipboard_restore: Some(insert_result.clipboard_restore),
            error: insert_result.error.clone(),
            audio_path: None,
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
    )
}

pub fn record_insert_failure(
    app_config: &AppConfig,
    raw_transcript: String,
    transformed_text: String,
    transformed: NativeTransformResult,
    error: String,
    effective_mode: Option<ProcessingMode>,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: app_config.provider.clone(),
            model: Some(active_model_for_provider(app_config)),
            language: optional_non_empty(&app_config.language),
            active_profile: app_config.active_text_profile_label(),
            effective_mode,
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: Some(raw_transcript),
            transformed_transcript: Some(transformed_text),
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some(error),
            audio_path: None,
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
    )
}

/// Record a transcription that never produced text.
///
/// `audio_path` is `Some` when the runtime kept the capture because the failure
/// could succeed on a second attempt. It is what makes the entry retryable at
/// all: there is no transcript to re-run the transform from, so the audio is
/// the only thing left to work with.
pub fn record_transcription_failure(
    app_config: &AppConfig,
    provider: &str,
    model: Option<String>,
    language: Option<String>,
    error: String,
    audio_path: Option<String>,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: provider.to_string(),
            model,
            language,
            active_profile: app_config.active_text_profile_label(),
            // Nothing was transcribed, so no mode ever ran over anything.
            effective_mode: None,
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: None,
            transformed_transcript: None,
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some(error),
            audio_path,
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
    )
}

pub fn record_empty_result(
    app_config: &AppConfig,
    raw_transcript: String,
    transformed: NativeTransformResult,
    effective_mode: Option<ProcessingMode>,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Empty,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: app_config.provider.clone(),
            model: Some(active_model_for_provider(app_config)),
            language: optional_non_empty(&app_config.language),
            active_profile: app_config.active_text_profile_label(),
            effective_mode,
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: Some(raw_transcript),
            transformed_transcript: None,
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some("Pipeline produced no usable transcript.".to_string()),
            audio_path: None,
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
    )
}

fn transform_config_from_app_config(config: &AppConfig) -> NativeTransformConfig {
    let active_profile = config.active_text_profile();
    // All three correction switches come from the active profile's mode. This
    // path used to take `post_process` from the global field while taking the
    // other two from the profile, so a re-transform could run under a mix of the
    // two that no live session would ever produce.
    let preset = config.active_text_profile_transform_preset();

    NativeTransformConfig {
        provider: config.provider.clone(),
        profile_prompt: active_profile.prompt,
        dictionary_entries: active_profile.dictionary_entries,
        snippet_entries: active_profile.snippet_entries,
        post_process: preset.post_process,
        correction_model: if config.provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID {
            config.local_correction_model.clone()
        } else {
            config.correction_model.clone()
        },
        filter_fillers: preset.filter_fillers,
        professionalize: preset.professionalize,
        // Through the same resolver the live session uses. Reaching into
        // `profile.modes` here instead would let a re-transform run under a
        // style the session never had — the mixing defect this function's
        // comment above already records for the correction switches.
        style: config.active_text_profile_communication_style(),
        // Through the same resolver too, and for now it only travels: this path
        // runs the correction transform for every mode, so a retried Translate
        // record comes back cleaned up rather than translated, exactly as a
        // retried Agent or Prompt Enhance record does. That is the conservative
        // arm `ProcessingMode::transform_preset` documents, and routing the
        // retry by mode is one job for all three rather than one for Translate.
        translate: config.active_text_profile_translate_settings(),
        ..Default::default()
    }
}

fn active_model_for_provider(config: &AppConfig) -> String {
    if config.provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID {
        let trimmed = config.local_model.trim();
        if trimmed.is_empty() {
            "base".to_string()
        } else {
            trimmed.to_string()
        }
    } else {
        let trimmed = config.model.trim();
        if trimmed.is_empty() {
            "whisper-large-v3-turbo".to_string()
        } else {
            trimmed.to_string()
        }
    }
}

fn local_history_context(config: &AppConfig) -> LocalHistoryContext {
    if config.provider != super::providers::LOCAL_PREVIEW_PROVIDER_ID {
        return LocalHistoryContext::default();
    }

    LocalHistoryContext {
        provider_profile: optional_non_empty(&config.local_profile),
        local_prompt_strength: optional_non_empty(&config.local_prompt_strength),
        local_prompt_carry: Some(config.local_prompt_carry),
        local_beam_size: Some(config.local_beam_size),
        local_best_of: Some(config.local_best_of),
    }
}

fn optional_non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn runtime_history_policy() -> (usize, u32) {
    #[cfg(test)]
    if let Ok(guard) = history_policy_override().lock() {
        if let Some((history_limit, history_retention_days)) = *guard {
            return (
                history_limit.clamp(25, 1000),
                history_retention_days.min(3650),
            );
        }
    }

    let app_config = AppConfig::load_from_disk();
    (
        configured_history_limit(&app_config),
        configured_history_retention_days(&app_config),
    )
}

fn configured_history_limit(config: &AppConfig) -> usize {
    config.history_limit.clamp(25, 1000)
}

fn configured_history_retention_days(config: &AppConfig) -> u32 {
    config.history_retention_days.min(3650)
}

/// WHICH MODE A RETRY RE-RUNS (ADR 0075).
///
/// Three sources in order, and the order is the point:
///
/// 1. `effective_mode` — what actually ran. Present on everything recorded
///    since the field existed, and the only source that is right for a record
///    dictated under `Auto`.
/// 2. `work_mode.processing_mode` — the profile's stored mode at record time.
///    Right for every concrete mode on an older entry.
/// 3. This machine's current active profile, for an entry that carries neither.
///
/// **`Auto` is resolved rather than repeated.** An Auto record has no concrete
/// mode to re-run; the router decides one from the transcript, exactly as it
/// did the first time. The classifier is deliberately not consulted here — that
/// arm is asynchronous and costs a model call, and `resolve_auto_mode` answers
/// deterministically for everything a retry can see. Where it cannot, Cleanup
/// is the conservative answer and is also what the retry did for every mode
/// before this record.
fn resolve_retry_mode(entry: &TranscriptionHistoryEntry, app_config: &AppConfig) -> ProcessingMode {
    let recorded = entry
        .effective_mode
        .clone()
        .or_else(|| {
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.processing_mode.clone())
        })
        .unwrap_or_else(|| {
            app_config
                .text_profiles
                .iter()
                .find(|profile| profile.id == app_config.active_text_profile_id)
                .map(|profile| profile.work_mode.effective_processing_mode())
                .unwrap_or_else(|| app_config.processing_mode.clone())
        });

    if !recorded.is_auto() {
        return recorded;
    }

    let text = entry
        .raw_transcript
        .as_deref()
        .or(entry.transformed_transcript.as_deref())
        .unwrap_or_default();

    match super::mode_router::resolve_auto_mode(text, None, &app_config.agent_name) {
        super::mode_router::AutoRoute::Decided { mode, .. } => mode,
        super::mode_router::AutoRoute::NeedsClassifier => ProcessingMode::Cleanup,
    }
}

/// Prune, and take the pruned records' files with them.
///
/// Retention is a promise Privacy & Data prints as two numbers, and it was only
/// ever true of the index. Since ADR 0074 a record is also a file, so the sweep
/// that drops the entry removes the file the entry named — in the same call,
/// because a retention rule that holds for one of the two stores is worse than
/// none: it reads as a guarantee and is not one.
fn prune_entries_for_runtime(entries: &mut VecDeque<TranscriptionHistoryEntry>) {
    let (history_limit, history_retention_days) = runtime_history_policy();
    let dropped = prune_entries(entries, history_limit, history_retention_days, now_ms());
    remove_transcript_files(&dropped);
}

/// The files of records that are going away, and nothing else. Never a
/// directory walk (ADR 0074).
fn remove_transcript_files(entries: &[TranscriptionHistoryEntry]) {
    for entry in entries {
        if let Some(path) = entry.transcript_path.as_deref() {
            super::transcript_store::remove_transcript(path);
        }
    }
}

/// Answers with what it dropped, so the caller can decide what else that record
/// owned. Kept pure of side effects for the same reason it takes its clock as
/// an argument: the retention tests drive it directly.
fn prune_entries(
    entries: &mut VecDeque<TranscriptionHistoryEntry>,
    history_limit: usize,
    history_retention_days: u32,
    reference_now_ms: u64,
) -> Vec<TranscriptionHistoryEntry> {
    let mut dropped = Vec::new();

    if history_retention_days > 0 {
        let cutoff_ms =
            reference_now_ms.saturating_sub(u64::from(history_retention_days) * MS_PER_DAY);
        let mut kept = VecDeque::with_capacity(entries.len());
        for entry in entries.drain(..) {
            if entry.created_at_ms >= cutoff_ms {
                kept.push_back(entry);
            } else {
                dropped.push(entry);
            }
        }
        *entries = kept;
    }

    while entries.len() > history_limit {
        if let Some(entry) = entries.pop_back() {
            dropped.push(entry);
        }
    }

    dropped
}

fn filter_history_entries(
    entries: Vec<TranscriptionHistoryEntry>,
    query: &TranscriptionHistoryQuery,
) -> Vec<TranscriptionHistoryEntry> {
    let provider_filter = normalized_filter(&query.provider);
    let profile_filter = normalized_filter(&query.active_profile);
    let search_filter = normalized_filter(&query.search);
    let limit = query.limit.map(|value| value.clamp(1, 1000));

    let mut filtered = entries
        .into_iter()
        .filter(|entry| match &provider_filter {
            Some(provider) => entry.provider.eq_ignore_ascii_case(provider),
            None => true,
        })
        .filter(|entry| match &query.status {
            Some(status) => &entry.status == status,
            None => true,
        })
        .filter(|entry| match &query.source {
            Some(source) => &entry.source == source,
            None => true,
        })
        .filter(|entry| match &profile_filter {
            Some(active_profile) => entry
                .active_profile
                .as_deref()
                .map(|value| value.eq_ignore_ascii_case(active_profile))
                .unwrap_or(false),
            None => true,
        })
        .filter(|entry| !query.include_errors_only || entry.error.as_deref().is_some())
        .filter(|entry| match &search_filter {
            Some(search) => history_entry_matches_search(entry, search),
            None => true,
        })
        .collect::<Vec<_>>();

    if let Some(limit) = limit {
        filtered.truncate(limit);
    }

    filtered
}

fn normalized_filter(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
}

fn history_entry_matches_search(entry: &TranscriptionHistoryEntry, search: &str) -> bool {
    let contains = |value: Option<&str>| {
        value
            .map(|candidate| candidate.to_ascii_lowercase().contains(search))
            .unwrap_or(false)
    };

    entry.provider.to_ascii_lowercase().contains(search)
        || contains(entry.model.as_deref())
        || contains(entry.language.as_deref())
        || contains(entry.active_profile.as_deref())
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.rewrite_style.as_str()),
        )
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.insert_behavior.as_str()),
        )
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.recovery_behavior.as_str()),
        )
        || contains(entry.provider_profile.as_deref())
        || contains(entry.local_prompt_strength.as_deref())
        || contains(entry.raw_transcript.as_deref())
        || contains(entry.transformed_transcript.as_deref())
        || contains(entry.transform_warning.as_deref())
        || contains(entry.fallback_reason.as_deref())
        || contains(entry.recovery_message.as_deref())
        || contains(entry.error.as_deref())
}

#[cfg(test)]
fn set_history_path_override_for_tests(path: PathBuf) {
    if let Ok(mut guard) = history_path_override().lock() {
        *guard = Some(path);
    }
}

#[cfg(test)]
fn set_history_policy_override_for_tests(history_limit: usize, history_retention_days: u32) {
    if let Ok(mut guard) = history_policy_override().lock() {
        *guard = Some((history_limit, history_retention_days));
    }
}

#[cfg(test)]
fn reset_store_for_tests() {
    if let Ok(mut store) = history_store().lock() {
        store.loaded = false;
        store.entries.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn test_history_path(test_name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wordscript-history-tests-{test_name}"));
        let _ = std::fs::create_dir_all(&dir);
        dir.join("history.json")
    }

    fn prepare_test_history_path(test_name: &str) -> PathBuf {
        let path = test_history_path(test_name);
        let _ = std::fs::remove_file(&path);
        set_history_path_override_for_tests(path.clone());
        set_history_policy_override_for_tests(DEFAULT_HISTORY_LIMIT, 90);
        reset_store_for_tests();
        path
    }

    #[test]
    fn records_and_reads_history_entries_with_retention() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("retention");

        for index in 0..(DEFAULT_HISTORY_LIMIT + 5) {
            record_entry(RecordHistoryEntryRequest {
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: Some("whisper-large-v3-turbo".to_string()),
                language: Some("de".to_string()),
                active_profile: None,
                effective_mode: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some(format!("raw-{index}")),
                transformed_transcript: Some(format!("final-{index}")),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
                audio_path: None,
            })
            .expect("record history entry");
        }

        let entries = transcription_history_entries(None).expect("history entries");

        assert_eq!(entries.len(), DEFAULT_HISTORY_LIMIT);
        assert!(path.is_file());
        assert_eq!(
            entries
                .last()
                .and_then(|entry| entry.raw_transcript.as_deref()),
            Some("raw-5")
        );
    }

    #[test]
    fn deletes_history_entries_by_id() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("delete");

        let first = record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: None,
            language: None,
            active_profile: None,
            effective_mode: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("eins".to_string()),
            transformed_transcript: Some("eins".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
        })
        .expect("first history entry");
        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: None,
            language: None,
            active_profile: None,
            effective_mode: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("zwei".to_string()),
            transformed_transcript: Some("zwei".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
        })
        .expect("second history entry");

        let remaining =
            delete_transcription_history_entry(DeleteTranscriptionHistoryEntryRequest {
                id: first.id,
            })
            .expect("delete history entry");

        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].raw_transcript.as_deref(), Some("zwei"));
    }

    #[test]
    fn filters_history_entries_by_provider_status_and_search() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("filtering");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            language: Some("de".to_string()),
            active_profile: Some("developer".to_string()),
            effective_mode: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("ship release notes".to_string()),
            transformed_transcript: Some("Ship release notes.".to_string()),
            corrected: true,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
        })
        .expect("groq history entry");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::Retry,
            retry_of: Some("history-old".to_string()),
            provider: "local_preview".to_string(),
            model: Some("base.en".to_string()),
            language: Some("en".to_string()),
            active_profile: Some("support".to_string()),
            effective_mode: None,
            provider_profile: Some("local-preview-base-quality".to_string()),
            local_prompt_strength: Some("profile_and_terms".to_string()),
            local_prompt_carry: Some(true),
            local_beam_size: Some(5),
            local_best_of: Some(5),
            raw_transcript: Some("follow up".to_string()),
            transformed_transcript: None,
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some("Model missing".to_string()),
            audio_path: None,
        })
        .expect("local preview history entry");

        let filtered = transcription_history_entries(Some(TranscriptionHistoryQuery {
            provider: Some("local_preview".to_string()),
            status: Some(TranscriptionHistoryStatus::Failed),
            source: Some(TranscriptionHistorySource::Retry),
            search: Some("model missing".to_string()),
            include_errors_only: true,
            ..TranscriptionHistoryQuery::default()
        }))
        .expect("filtered history entries");

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].provider, "local_preview");
        assert_eq!(filtered[0].active_profile.as_deref(), Some("support"));
        assert_eq!(
            filtered[0].provider_profile.as_deref(),
            Some("local-preview-base-quality")
        );
    }

    #[test]
    fn exports_filtered_history_entries_with_policy_metadata() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let export_path = test_history_path("export").with_file_name("history-export.json");
        let _ = std::fs::remove_file(&export_path);
        prepare_test_history_path("export");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            language: Some("de".to_string()),
            active_profile: Some("developer".to_string()),
            effective_mode: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("eins".to_string()),
            transformed_transcript: Some("eins".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
        })
        .expect("first export history entry");
        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "local_preview".to_string(),
            model: Some("base".to_string()),
            language: Some("en".to_string()),
            active_profile: Some("support".to_string()),
            effective_mode: None,
            provider_profile: Some("local-preview-base-fast".to_string()),
            local_prompt_strength: Some("profile".to_string()),
            local_prompt_carry: Some(false),
            local_beam_size: Some(1),
            local_best_of: Some(1),
            raw_transcript: Some("zwei".to_string()),
            transformed_transcript: Some("zwei".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
        })
        .expect("second export history entry");

        let response = export_transcription_history(ExportTranscriptionHistoryRequest {
            path: export_path.to_string_lossy().to_string(),
            query: TranscriptionHistoryQuery {
                provider: Some("groq".to_string()),
                ..TranscriptionHistoryQuery::default()
            },
        })
        .expect("export history response");

        let raw = std::fs::read_to_string(export_path).expect("read export file");
        let document: TranscriptionHistoryExportDocument =
            serde_json::from_str(&raw).expect("parse export document");

        assert_eq!(response.exported_count, 1);
        assert_eq!(document.count, 1);
        assert_eq!(document.history_limit, DEFAULT_HISTORY_LIMIT);
        assert_eq!(document.history_retention_days, 90);
        assert_eq!(document.entries[0].provider, "groq");
    }

    #[test]
    fn prune_entries_drops_old_entries_before_limit_is_applied() {
        let cutoff_reference = 10 * MS_PER_DAY;
        let mut entries = VecDeque::from(vec![
            TranscriptionHistoryEntry {
                id: "old".to_string(),
                created_at_ms: cutoff_reference.saturating_sub(8 * MS_PER_DAY),
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                active_profile: None,
                work_mode: None,
                effective_mode: None,
                transcript_path: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("old".to_string()),
                transformed_transcript: Some("old".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
                audio_path: None,
            },
            TranscriptionHistoryEntry {
                id: "fresh-a".to_string(),
                created_at_ms: cutoff_reference.saturating_sub(MS_PER_DAY),
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                active_profile: None,
                work_mode: None,
                effective_mode: None,
                transcript_path: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("fresh-a".to_string()),
                transformed_transcript: Some("fresh-a".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
                audio_path: None,
            },
            TranscriptionHistoryEntry {
                id: "fresh-b".to_string(),
                created_at_ms: cutoff_reference,
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                active_profile: None,
                work_mode: None,
                effective_mode: None,
                transcript_path: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("fresh-b".to_string()),
                transformed_transcript: Some("fresh-b".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
                audio_path: None,
            },
        ]);

        prune_entries(&mut entries, 1, 3, cutoff_reference);

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "fresh-a");
    }

    #[test]
    fn history_entry_preserves_insert_recovery_semantics() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("insert-recovery-semantics");

        let entry = history_entry_from_insert_result(
            &AppConfig::default(),
            None,
            Some("raw text".to_string()),
            NativeTransformResult {
                text: "final text".to_string(),
                corrected: false,
                applied_rules: vec!["removed_fillers".to_string()],
                warning: None,
            },
            &NativeInsertResult {
                ok: false,
                text: "final text".to_string(),
                insert_mode: NativeInsertMode::ClipboardFallback,
                active_driver: NativeInsertDriver::Arboard,
                clipboard_written: true,
                paste_attempted: true,
                pasted: false,
                scratchpad_entry: super::super::insertion::ScratchpadEntry {
                    id: "scratch-1".to_string(),
                    text: "final text".to_string(),
                    source: "native_insert".to_string(),
                    created_at_ms: 1,
                    corrected: false,
                    insert_mode: NativeInsertMode::ClipboardFallback,
                    active_driver: NativeInsertDriver::Arboard,
                    clipboard_written: true,
                    paste_attempted: true,
                    pasted: false,
                    fallback_reason: Some("xdotool failed".to_string()),
                    error: Some("xdotool failed".to_string()),
                    recovery_action: NativeInsertRecoveryAction::ManualPaste,
                    recovery_message: Some(
                        "Transcript is on the clipboard. Paste manually.".to_string(),
                    ),
                    clipboard_restore: NativeClipboardRestoreStatus::NotAttempted,
                },
                fallback_available: true,
                fallback_reason: Some("xdotool failed".to_string()),
                error: Some("xdotool failed".to_string()),
                recovery_action: NativeInsertRecoveryAction::ManualPaste,
                recovery_message: "Transcript is on the clipboard. Paste manually.".to_string(),
                clipboard_restore: NativeClipboardRestoreStatus::NotAttempted,
            },
            None,
        )
        .expect("history entry from insert result");

        assert_eq!(
            entry.recovery_action,
            Some(NativeInsertRecoveryAction::ManualPaste)
        );
        assert_eq!(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.rewrite_style.as_str()),
            Some("clean")
        );
        assert_eq!(
            entry.clipboard_restore,
            Some(NativeClipboardRestoreStatus::NotAttempted)
        );
        assert_eq!(
            entry.recovery_message.as_deref(),
            Some("Transcript is on the clipboard. Paste manually.")
        );
    }

    /// A helper shaped like the funnel's happy path, so the ADR 0074 tests read
    /// as "record something, then look at what else the record owns".
    fn completed_request(text: &str) -> RecordHistoryEntryRequest {
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            language: Some("de".to_string()),
            active_profile: Some("General writing".to_string()),
            effective_mode: Some(ProcessingMode::Cleanup),
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some(format!("{text} uh")),
            transformed_transcript: Some(text.to_string()),
            corrected: true,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: Some(NativeInsertMode::DirectPaste),
            active_driver: None,
            pasted: Some(true),
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
        }
    }

    #[test]
    fn a_recorded_transcript_is_also_a_file_and_the_entry_names_it() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file");

        let entry = record_entry(completed_request("Der Beleg wird eine Datei."))
            .expect("history entry");

        let path = entry.transcript_path.clone().expect("a transcript path");
        let body = std::fs::read_to_string(&path).expect("the file");
        assert!(body.contains(&format!("id: {}", entry.id)));
        assert!(body.contains("Der Beleg wird eine Datei."));
        // The heard text differed, so it is kept under its own heading.
        assert!(body.contains("## Heard"));

        super::super::transcript_store::remove_transcript(&path);
    }

    /// The `Empty` and `Failed` paths reach the same funnel and must not leave
    /// an empty document behind (ADR 0074).
    #[test]
    fn a_record_without_text_names_no_file() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file-empty");

        let mut request = completed_request("ignored");
        request.status = TranscriptionHistoryStatus::Empty;
        request.transformed_transcript = None;

        let entry = record_entry(request).expect("history entry");
        assert_eq!(entry.transcript_path, None);
    }

    #[test]
    fn deleting_a_record_deletes_the_file_it_named() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file-delete");

        let entry = record_entry(completed_request("Wird wieder geloescht."))
            .expect("history entry");
        let path = entry.transcript_path.clone().expect("a transcript path");
        assert!(PathBuf::from(&path).exists());

        delete_transcription_history_entry(DeleteTranscriptionHistoryEntryRequest {
            id: entry.id.clone(),
        })
        .expect("delete");

        assert!(!PathBuf::from(&path).exists(), "the file outlived its record");
    }

    #[test]
    fn clearing_the_history_clears_the_files_with_it() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file-clear");

        let first = record_entry(completed_request("Erster Satz.")).expect("first");
        let second = record_entry(completed_request("Zweiter Satz.")).expect("second");
        let paths: Vec<String> = [first, second]
            .iter()
            .filter_map(|entry| entry.transcript_path.clone())
            .collect();
        assert_eq!(paths.len(), 2);

        clear_transcription_history_entries().expect("clear");

        for path in paths {
            assert!(!PathBuf::from(&path).exists(), "{path} outlived the clear");
        }
    }

    /// Retention is printed on Privacy & Data as a promise about everything the
    /// product keeps. Before ADR 0074 it was only ever true of the index.
    #[test]
    fn retention_takes_the_pruned_records_files_with_them() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file-retention");
        // 25 is the floor `runtime_history_policy` clamps to, so the oldest of
        // 26 is the one the limit pushes out.
        const LIMIT: usize = 25;
        set_history_policy_override_for_tests(LIMIT, 90);

        let first = record_entry(completed_request("Faellt aus dem Limit.")).expect("first");
        let dropped = first.transcript_path.clone().expect("a transcript path");
        let kept: Vec<String> = (0..LIMIT)
            .map(|index| {
                record_entry(completed_request(&format!("Satz Nummer {index}.")))
                    .expect("entry")
                    .transcript_path
                    .expect("a transcript path")
            })
            .collect();

        assert!(!PathBuf::from(&dropped).exists(), "retention left a file behind");
        for path in kept {
            assert!(PathBuf::from(&path).exists());
            super::super::transcript_store::remove_transcript(&path);
        }
    }

    /// ADR 0075's precedence, and the reason the field exists: an `Auto` record
    /// carries `auto` in its work mode and the concrete mode nowhere else.
    #[test]
    fn a_retry_runs_what_the_record_ran() {
        let mut entry = sample_entry_for_mode(Some(ProcessingMode::Translate), ProcessingMode::Auto);
        let config = AppConfig::default();
        assert_eq!(resolve_retry_mode(&entry, &config), ProcessingMode::Translate);

        // No `effective_mode` — an entry older than the field falls back to the
        // profile's stored mode.
        entry.effective_mode = None;
        entry.work_mode = Some(TextProfileWorkMode {
            processing_mode: ProcessingMode::Agent,
            ..TextProfileWorkMode::default()
        });
        assert_eq!(resolve_retry_mode(&entry, &config), ProcessingMode::Agent);
    }

    #[test]
    fn a_retry_of_an_auto_record_resolves_auto_rather_than_repeating_it() {
        let entry = sample_entry_for_mode(None, ProcessingMode::Auto);
        let resolved = resolve_retry_mode(&entry, &AppConfig::default());
        assert!(!resolved.is_auto(), "Auto reached the transform");
    }

    fn sample_entry_for_mode(
        effective_mode: Option<ProcessingMode>,
        stored: ProcessingMode,
    ) -> TranscriptionHistoryEntry {
        TranscriptionHistoryEntry {
            id: "history-1-0".to_string(),
            created_at_ms: 1,
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: None,
            language: None,
            active_profile: None,
            work_mode: Some(TextProfileWorkMode {
                processing_mode: stored,
                ..TextProfileWorkMode::default()
            }),
            effective_mode,
            transcript_path: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("Bitte den Absatz aufraeumen.".to_string()),
            transformed_transcript: None,
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
        }
    }
}
