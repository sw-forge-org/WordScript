use std::{
    collections::HashSet,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    Device, SampleFormat, Stream, StreamConfig,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use super::{
    communication_style::CommunicationStyle,
    config::{
        AppConfig, DictionaryEntry, SnippetEntry, TextProfileWorkMode, TranslateSettings,
        DEFAULT_CORRECTION_MODEL,
    },
    paths::user_data_dir,
    providers::default_provider_id,
    runtime_log,
};

fn default_agent_name() -> String {
    super::config::DEFAULT_AGENT_NAME.to_string()
}

const DEFAULT_MAX_RECORDING_SECONDS: u64 = 720;
const DEFAULT_SILENCE_TIMEOUT_SECONDS: u64 = 30;
const DEFAULT_VOICE_THRESHOLD: f32 = 0.02;
const AUDIO_LEVEL_INTERVAL_MS: u64 = 42;
const MIN_SILENCE_AUTOSTOP_SECONDS: u64 = 1;
const WAVEFORM_BUCKET_COUNT: usize = 19;
const TRANSCRIPTION_SAMPLE_RATE: u32 = 16_000;
const TRANSCRIPTION_CHANNELS: u16 = 1;
/// Below this the signal is indistinguishable from a muted or wrong device.
const SILENT_PEAK_THRESHOLD: f32 = 0.001;
/// A sample this close to full scale has lost its peak to the converter.
const CLIPPING_SAMPLE_THRESHOLD: f32 = 0.99;
/// Sustained clipping, not the occasional transient.
const CLIPPING_RATIO_THRESHOLD: f32 = 0.005;
/// Window the silence trim scans in, and the pad it keeps on either side of
/// the detected speech so a soft onset survives.
const TRIM_WINDOW_MS: u64 = 30;
const TRIM_PAD_MS: u64 = 150;
/// Well below `DEFAULT_VOICE_THRESHOLD`: the trim only removes what is
/// unambiguously quiet, the speech decision itself stays with the capture.
const TRIM_SILENCE_THRESHOLD: f32 = 0.005;
/// Shortest capture that still gets transcribed, measured after the trim.
const MIN_SPEECH_MS: u64 = 200;

/// What the measured input level says about the microphone setup.
///
/// This is diagnosis only. WordScript never writes the operating system's
/// input volume: that setting is per device, not per application, so changing
/// it would silently re-level every other app using the same microphone.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InputLevelVerdict {
    /// Usable signal.
    Ok,
    /// Signal present, but never loud enough to count as speech.
    TooQuiet,
    /// Effectively nothing arrived.
    Silent,
    /// Sustained full-scale samples; the recording is distorted.
    Clipping,
    /// Loud enough, but too brief to be speech once silence was trimmed off.
    /// A click, a cough or a breath into the microphone.
    TooShort,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct InputLevelSummary {
    pub peak: f32,
    pub peak_dbfs: f32,
    pub clipped_ratio: f32,
    pub verdict: InputLevelVerdict,
    /// The threshold speech detection had to clear, so the UI can state the
    /// measurement against the bar it failed.
    pub voice_threshold_dbfs: f32,
}

impl InputLevelSummary {
    fn new(peak: f32, clipped_samples: u64, total_samples: u64) -> Self {
        let clipped_ratio = if total_samples == 0 {
            0.0
        } else {
            clipped_samples as f32 / total_samples as f32
        };
        let verdict = if clipped_ratio > CLIPPING_RATIO_THRESHOLD {
            InputLevelVerdict::Clipping
        } else if peak < SILENT_PEAK_THRESHOLD {
            InputLevelVerdict::Silent
        } else if peak <= DEFAULT_VOICE_THRESHOLD {
            InputLevelVerdict::TooQuiet
        } else {
            InputLevelVerdict::Ok
        };

        Self {
            peak,
            peak_dbfs: to_dbfs(peak),
            clipped_ratio,
            verdict,
            voice_threshold_dbfs: to_dbfs(DEFAULT_VOICE_THRESHOLD),
        }
    }

    /// A sentence naming the measurement and the next concrete step. The user
    /// otherwise only sees that the recording vanished.
    pub fn message(&self) -> String {
        match self.verdict {
            InputLevelVerdict::Silent => format!(
                "No microphone signal arrived (peak {:.0} dBFS). Check that the right input device is selected and not muted.",
                self.peak_dbfs
            ),
            InputLevelVerdict::TooQuiet => format!(
                "No speech detected. The loudest moment reached {:.0} dBFS, below the {:.0} dBFS needed to register as speech. Raise the input level for this microphone in your system sound settings.",
                self.peak_dbfs, self.voice_threshold_dbfs
            ),
            InputLevelVerdict::Clipping => format!(
                "The input is clipping ({:.0}% of samples at full scale), which distorts the recording. Lower the input level for this microphone in your system sound settings.",
                self.clipped_ratio * 100.0
            ),
            InputLevelVerdict::TooShort => format!(
                "No speech detected. Only {}ms of audio remained after silence was trimmed, too short to transcribe. Hold the shortcut until you have finished speaking.",
                min_speech_ms()
            ),
            InputLevelVerdict::Ok => "No speech detected in recording.".to_string(),
        }
    }

    fn too_short(self) -> Self {
        Self {
            verdict: InputLevelVerdict::TooShort,
            ..self
        }
    }
}

fn to_dbfs(amplitude: f32) -> f32 {
    if amplitude <= 0.0 {
        return -120.0;
    }
    (20.0 * amplitude.log10()).max(-120.0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeCaptureConfig {
    pub provider: String,
    pub model: String,
    pub local_profile: String,
    pub local_prompt_strength: String,
    pub local_prompt_carry: bool,
    pub local_beam_size: u8,
    pub local_best_of: u8,
    pub language: String,
    pub language_locked: bool,
    pub prompt: String,
    /// The opted-in subset, for the recognizer's initial prompt only.
    pub stt_hints: String,
    /// Every vocabulary term, regardless of the recognizer opt-in. Granular
    /// profile context for the transform stages, and the input to deterministic
    /// repair (ADR 0033).
    #[serde(default)]
    pub vocabulary: Vec<String>,
    pub work_mode: TextProfileWorkMode,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
    // The correction switches (post_process / filter_fillers / professionalize)
    // are deliberately absent. They follow from the EFFECTIVE processing mode,
    // which is only known once the override and Auto resolution have run — long
    // after this struct is loaded. Resolving them here is what let a session run
    // with flags derived from the profile's stored mode instead of the one it was
    // actually running in. `work_mode` carries the stored mode; the pipeline
    // supplies the preset explicitly.
    pub correction_model: String,
    // Snapshotted with everything else the session runs on, so "only the
    // processing mode can still change mid-recording" is literally true. These
    // used to be re-read from disk at pipeline time, which meant editing the
    // agent name or the style during a recording applied to it while editing
    // the profile text did not — one rule with two answers.
    // `default` so a payload written before these existed still loads. They
    // ride in the same event as everything else, so a missing key would fail
    // the whole capture rather than one setting (ADR 0015).
    #[serde(default)]
    pub profile_label: String,
    #[serde(default = "default_agent_name")]
    pub agent_name: String,
    #[serde(default)]
    pub communication_style: CommunicationStyle,
    /// What Translate runs with, snapshotted for the same reason the style is:
    /// changing the target language during a recording lands on the next
    /// session, not on half of this one.
    #[serde(default)]
    pub translate: TranslateSettings,
    pub audio_device: String,
    pub max_recording_seconds: u64,
    pub silence_timeout_seconds: u64,
    pub temp_audio_dir: String,
}

impl Default for NativeCaptureConfig {
    fn default() -> Self {
        Self {
            provider: default_provider_id().to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            local_profile: "local-preview-base-fast".to_string(),
            local_prompt_strength: "profile".to_string(),
            local_prompt_carry: false,
            local_beam_size: 1,
            local_best_of: 1,
            language: String::new(),
            language_locked: false,
            prompt: String::new(),
            vocabulary: Vec::new(),
            stt_hints: String::new(),
            profile_label: String::new(),
            agent_name: super::config::DEFAULT_AGENT_NAME.to_string(),
            communication_style: CommunicationStyle::default(),
            translate: TranslateSettings::default(),
            work_mode: TextProfileWorkMode::default(),
            dictionary_entries: Vec::new(),
            snippet_entries: Vec::new(),
            correction_model: DEFAULT_CORRECTION_MODEL.to_string(),
            audio_device: String::new(),
            max_recording_seconds: DEFAULT_MAX_RECORDING_SECONDS,
            silence_timeout_seconds: DEFAULT_SILENCE_TIMEOUT_SECONDS,
            temp_audio_dir: String::new(),
        }
    }
}

impl NativeCaptureConfig {
    pub fn load_from_disk() -> Self {
        let app_config = AppConfig::load_from_disk();
        let active_profile = app_config.active_text_profile();
        let work_mode = app_config.resolved_active_text_profile_work_mode();

        // Read per-profile settings. The modes block is not read here: it no
        // longer carries anything the capture needs.
        let speech = active_profile.resolved_speech();
        let capture = active_profile.resolved_capture();
        let profile_label = active_profile.label.clone();
        let agent_name = app_config.active_text_profile_agent_name();
        let communication_style = app_config.active_text_profile_communication_style();
        let translate = app_config.active_text_profile_translate_settings();

        let provider = speech.provider.clone();
        let local_provider_selected = provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID;
        let model = if provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID {
            if speech.local_model.trim().is_empty() {
                "base".to_string()
            } else {
                speech.local_model
            }
        } else {
            speech.model
        };

        Self {
            provider,
            model,
            local_profile: speech.local_profile,
            local_prompt_strength: speech.local_prompt_strength,
            local_prompt_carry: speech.local_prompt_carry,
            local_beam_size: speech.local_beam_size,
            local_best_of: speech.local_best_of,
            language: speech.language,
            language_locked: speech.language_locked,
            // The slots the runtime allocated, not a per-entry opt-in. The
            // switch was there, and its intuitive use spent every slot on the
            // long terms that repair already recovers (ADR 0035). Everything in
            // the vocabulary still reaches the transform stages and the
            // deterministic repair either way.
            stt_hints: active_profile.recognizer_slot_phrases().join("\n"),
            vocabulary: active_profile.vocabulary_phrases(),
            prompt: active_profile.prompt,
            work_mode,
            dictionary_entries: active_profile.dictionary_entries,
            snippet_entries: active_profile.snippet_entries,
            correction_model: if local_provider_selected {
                speech.local_correction_model
            } else {
                speech.correction_model
            },
            profile_label: profile_label.clone(),
            agent_name,
            communication_style,
            translate,
            audio_device: app_config.audio_device,
            max_recording_seconds: capture.max_recording_seconds,
            silence_timeout_seconds: capture.silence_timeout_seconds,
            temp_audio_dir: app_config.temp_audio_dir,
        }
    }

    /// The single place a transcription request is derived from a capture.
    ///
    /// Both the preview panel and the runtime used to build this independently
    /// from loose JSON keys, and the runtime's copy silently omitted the bias
    /// policy and every local decode setting, so a profile's configuration was
    /// rendered faithfully and then discarded before the provider call. Keeping
    /// the derivation on the struct that owns the fields is what stops the two
    /// from drifting apart again.
    pub fn resolve_transcription_request(
        &self,
        audio_path: &str,
        timeout_ms: u64,
    ) -> super::providers::TranscribeAudioFileRequest {
        let is_local = self.provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID;
        let context = super::transcription_hints::BiasRequestContext::from_work_mode(
            &self.work_mode,
            &self.local_prompt_strength,
            self.local_prompt_carry,
        );
        let preview = super::transcription_hints::analyze_transcription_bias_with_mode(
            &self.stt_hints,
            &self.dictionary_entries,
            &context,
        );

        super::providers::TranscribeAudioFileRequest {
            provider: self.provider.clone(),
            audio_path: audio_path.to_string(),
            model: non_empty(&self.model),
            profile: is_local.then(|| non_empty(&self.local_profile)).flatten(),
            language: non_empty(&self.language),
            prompt: if is_local {
                preview.local_prompt_preview
            } else {
                preview.cloud_prompt_preview
            },
            carry_initial_prompt: is_local.then_some(self.local_prompt_carry),
            beam_size: is_local.then_some(self.local_beam_size),
            best_of: is_local.then_some(self.local_best_of),
            // verbose_json carries the per-segment confidence metrics the
            // hallucination gate reads. The local lane has no segment output.
            response_format: Some(if is_local { "json" } else { "verbose_json" }.to_string()),
            timeout_ms: Some(timeout_ms),
            max_retries: Some(1),
        }
    }
}

fn non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

/// The `audio_ready` payload. `NativeCaptureConfig` is flattened in whole
/// rather than field-picked, so a field added to it reaches the runtime
/// without a second, hand-maintained copy of the same schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioReadyEvent {
    pub event: String,
    pub input_level: InputLevelSummary,
    pub audio_path: String,
    pub audio_duration_seconds: f64,
    #[serde(flatten)]
    pub config: NativeCaptureConfig,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeCaptureStatus {
    pub is_recording: bool,
    pub muted: bool,
    pub paused: bool,
    pub device_name: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub sample_format: Option<String>,
    pub active_capture_id: Option<String>,
    pub silence_seconds: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeInputDevice {
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NativeCaptureMonitorState {
    Continue,
    Finished,
    Stop(NativeCaptureStopReason),
    RebuildEligible,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RebuildOutcome {
    Rebuilt,
    Failed,
    NotEligible,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NativeCaptureStopReason {
    MaxDuration,
    SilenceTimeout,
    StreamError,
}

impl NativeCaptureStopReason {
    pub fn message(self) -> &'static str {
        match self {
            Self::MaxDuration => "Max recording duration reached.",
            Self::SilenceTimeout => "Recording stopped after silence timeout.",
            Self::StreamError => "Audio stream failed; capture stopped.",
        }
    }
}

pub struct NativeCaptureState {
    config: NativeCaptureConfig,
    counter: u64,
    active: Option<ActiveCapture>,
}

struct ActiveCapture {
    id: String,
    config: NativeCaptureConfig,
    device_name: String,
    sample_rate: u32,
    channels: u16,
    sample_format: String,
    stream: Stream,
    shared: Arc<Mutex<SharedCaptureData>>,
    stream_error: Arc<AtomicBool>,
    rebuild_attempted: bool,
}

struct SharedCaptureData {
    started_at: Instant,
    last_voice_at: Instant,
    last_level_emit_at: Instant,
    muted: bool,
    paused: bool,
    paused_at: Option<Instant>,
    accumulated_paused: Duration,
    has_voice_activity: bool,
    peak_observed: f32,
    clipped_samples: u64,
    measured_samples: u64,
    samples: Vec<i16>,
    max_samples: usize,
    rebuild_in_progress: bool,
    // Level-emit accounting (overlay-recording-freeze investigation). The
    // overlay renders once per delivered `audio_level`, so a shortfall against
    // the expected count is the runtime-side signature of a stalled webview.
    // `slowest_level_emit` measures `app.emit` itself from inside the realtime
    // audio callback — a large value indicates the emit path is blocking there.
    level_emits_attempted: u64,
    level_emits_failed: u64,
    slowest_level_emit: Duration,
}

/// Accounting for the `audio_level` events of one capture.
///
/// The overlay re-renders once per delivered event, so comparing the number of
/// events the runtime actually attempted against the number the 42 ms interval
/// implies turns "the overlay looked frozen" into a number. A shortfall means
/// the emit path itself stalled; `slowest_emit_ms` says whether `app.emit`
/// blocked inside the realtime audio callback while that happened.
#[derive(Debug, Clone, PartialEq)]
struct LevelEmitSummary {
    wall_seconds: f64,
    expected: u64,
    attempted: u64,
    failed: u64,
    shortfall_ratio: f64,
    slowest_emit_ms: u128,
}

impl LevelEmitSummary {
    fn new(wall: Duration, attempted: u64, failed: u64, slowest: Duration) -> Self {
        let expected = (wall.as_millis() as u64) / AUDIO_LEVEL_INTERVAL_MS;
        let shortfall_ratio = if expected == 0 {
            0.0
        } else {
            let delivered = attempted.saturating_sub(failed);
            (expected.saturating_sub(delivered)) as f64 / expected as f64
        };

        Self {
            wall_seconds: wall.as_secs_f64(),
            expected,
            attempted,
            failed,
            shortfall_ratio,
            slowest_emit_ms: slowest.as_millis(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConfigureNativeCaptureRequest {
    pub audio_device: String,
    pub max_recording_seconds: u64,
    pub silence_timeout_seconds: u64,
}

impl NativeCaptureState {
    pub fn load(config: NativeCaptureConfig) -> Self {
        Self {
            config,
            counter: 0,
            active: None,
        }
    }

    pub fn is_recording(&self) -> bool {
        self.active.is_some()
    }

    fn status(&self) -> NativeCaptureStatus {
        if let Some(active) = &self.active {
            let (muted, paused, silence_seconds) = active
                .shared
                .lock()
                .map(|shared| {
                    let silence =
                        if shared.paused || effective_elapsed(&shared) < Duration::from_secs(1) {
                            0.0
                        } else {
                            effective_silence_elapsed(&shared).as_secs_f64()
                        };
                    (shared.muted, shared.paused, silence)
                })
                .unwrap_or((false, false, 0.0));

            NativeCaptureStatus {
                is_recording: true,
                muted,
                paused,
                device_name: Some(active.device_name.clone()),
                sample_rate: Some(active.sample_rate),
                channels: Some(active.channels),
                sample_format: Some(active.sample_format.clone()),
                active_capture_id: Some(active.id.clone()),
                silence_seconds,
            }
        } else {
            NativeCaptureStatus {
                is_recording: false,
                muted: false,
                paused: false,
                device_name: None,
                sample_rate: None,
                channels: None,
                sample_format: None,
                active_capture_id: None,
                silence_seconds: 0.0,
            }
        }
    }

    fn configure(&mut self, request: ConfigureNativeCaptureRequest) -> NativeCaptureStatus {
        self.config.audio_device = request.audio_device;
        self.config.max_recording_seconds = request.max_recording_seconds;
        self.config.silence_timeout_seconds = request.silence_timeout_seconds;
        self.status()
    }
}

#[tauri::command]
pub fn native_capture_status(
    state: State<'_, Mutex<NativeCaptureState>>,
) -> Result<NativeCaptureStatus, String> {
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

pub fn current_status_for_app<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<NativeCaptureStatus, String> {
    let state = app
        .try_state::<Mutex<NativeCaptureState>>()
        .ok_or_else(|| "Native capture state is not available.".to_string())?;
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

#[tauri::command]
pub fn configure_native_capture(
    request: ConfigureNativeCaptureRequest,
    state: State<'_, Mutex<NativeCaptureState>>,
) -> Result<NativeCaptureStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.configure(request))
}

#[tauri::command]
pub fn list_native_input_devices() -> Result<Vec<NativeInputDevice>, String> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|device| device.name().ok());
    let devices = host
        .input_devices()
        .map_err(|error| format!("Could not list input devices: {error}"))?;

    let mut seen = HashSet::new();
    let mut options = Vec::new();

    for device in devices {
        let Ok(name) = device.name() else {
            continue;
        };

        if !seen.insert(name.clone()) {
            continue;
        }

        let is_default = default_name.as_ref().is_some_and(|value| value == &name);
        options.push(NativeInputDevice { name, is_default });
    }

    if let Some(default_name) = default_name {
        if seen.insert(default_name.clone()) {
            options.push(NativeInputDevice {
                name: default_name,
                is_default: true,
            });
        }
    }

    options.sort_by(|left, right| {
        right
            .is_default
            .cmp(&left.is_default)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(options)
}

#[tauri::command]
pub fn toggle_native_capture_mute(
    app: AppHandle,
    state: State<'_, Mutex<NativeCaptureState>>,
) -> Result<NativeCaptureStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let active = state
        .active
        .as_mut()
        .ok_or_else(|| "No native capture is active.".to_string())?;
    let muted = {
        let mut shared = active.shared.lock().map_err(|error| error.to_string())?;
        shared.muted = !shared.muted;
        shared.muted
    };
    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({ "event": "muted", "muted": muted }),
    );
    Ok(state.status())
}

#[tauri::command]
pub fn toggle_native_capture_pause(
    app: AppHandle,
    state: State<'_, Mutex<NativeCaptureState>>,
) -> Result<NativeCaptureStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    toggle_native_capture_pause_inner(&app, &mut state)
}

pub fn toggle_native_capture_pause_for_app<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<NativeCaptureStatus, String> {
    let state = app
        .try_state::<Mutex<NativeCaptureState>>()
        .ok_or_else(|| "Native capture state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    toggle_native_capture_pause_inner(app, &mut state)
}

fn toggle_native_capture_pause_inner<R: Runtime>(
    app: &AppHandle<R>,
    state: &mut NativeCaptureState,
) -> Result<NativeCaptureStatus, String> {
    let active = state
        .active
        .as_mut()
        .ok_or_else(|| "No native capture is active.".to_string())?;

    let paused = {
        let mut shared = active.shared.lock().map_err(|error| error.to_string())?;
        if shared.paused {
            if let Some(paused_at) = shared.paused_at.take() {
                shared.accumulated_paused += paused_at.elapsed();
            }
            shared.paused = false;
            shared.last_voice_at = Instant::now();
            shared.last_level_emit_at =
                Instant::now() - Duration::from_millis(AUDIO_LEVEL_INTERVAL_MS);
        } else {
            shared.paused = true;
            shared.paused_at = Some(Instant::now());
        }
        shared.paused
    };

    if paused {
        active
            .stream
            .pause()
            .map_err(|error| format!("Could not pause native capture stream: {error}"))?;
    } else {
        active
            .stream
            .play()
            .map_err(|error| format!("Could not resume native capture stream: {error}"))?;
    }

    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({ "event": "paused", "paused": paused }),
    );
    Ok(state.status())
}

pub fn start_native_capture<R: Runtime + 'static>(
    app: &AppHandle<R>,
) -> Result<NativeCaptureStatus, String> {
    let state = app
        .try_state::<Mutex<NativeCaptureState>>()
        .ok_or_else(|| "Native capture state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;

    if state.active.is_some() {
        return Err("A native audio capture is already active.".to_string());
    }

    let config = NativeCaptureConfig::load_from_disk();
    let host = cpal::default_host();
    let device = select_input_device(&host, &config.audio_device)?;
    let device_name = device
        .name()
        .unwrap_or_else(|_| "Default microphone".to_string());
    let supported_config = device
        .default_input_config()
        .map_err(|error| format!("Could not read input stream config: {error}"))?;
    let sample_format = supported_config.sample_format();
    let stream_config = supported_config.config();

    runtime_log::record(format!(
        "[WordScript] Native capture start host={} device={} sample_rate={} channels={} sample_format={}",
        host.id().name(),
        device_name,
        stream_config.sample_rate,
        stream_config.channels,
        sample_format_label(sample_format),
    ));

    let max_recording_seconds = config.max_recording_seconds.max(1);
    let max_samples = (max_recording_seconds as usize)
        .saturating_mul(stream_config.sample_rate as usize)
        .saturating_mul(stream_config.channels.max(1) as usize);

    let stream_error = Arc::new(AtomicBool::new(false));

    let shared = Arc::new(Mutex::new(SharedCaptureData {
        started_at: Instant::now(),
        last_voice_at: Instant::now(),
        last_level_emit_at: Instant::now() - Duration::from_millis(AUDIO_LEVEL_INTERVAL_MS),
        muted: false,
        paused: false,
        paused_at: None,
        accumulated_paused: Duration::ZERO,
        has_voice_activity: false,
        peak_observed: 0.0,
        clipped_samples: 0,
        measured_samples: 0,
        samples: Vec::new(),
        max_samples,
        rebuild_in_progress: false,
        level_emits_attempted: 0,
        level_emits_failed: 0,
        slowest_level_emit: Duration::ZERO,
    }));

    let stream = build_stream(
        app.clone(),
        &device,
        &stream_config,
        sample_format,
        shared.clone(),
        stream_error.clone(),
    )?;
    stream
        .play()
        .map_err(|error| format!("Could not start native capture stream: {error}"))?;

    state.counter += 1;
    state.config = config.clone();
    state.active = Some(ActiveCapture {
        id: format!("capture-{}", state.counter),
        config,
        device_name,
        sample_rate: stream_config.sample_rate,
        channels: stream_config.channels,
        sample_format: sample_format_label(sample_format).to_string(),
        stream,
        shared,
        stream_error,
        rebuild_attempted: false,
    });

    Ok(state.status())
}

/// Why a capture ended, so the caller can explain an empty result instead of
/// only reporting that one happened.
pub enum CaptureOutcome {
    Ready(serde_json::Value),
    Empty(InputLevelSummary),
}

pub fn stop_native_capture<R: Runtime>(app: &AppHandle<R>) -> Result<CaptureOutcome, String> {
    let state = app
        .try_state::<Mutex<NativeCaptureState>>()
        .ok_or_else(|| "Native capture state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let active = state
        .active
        .take()
        .ok_or_else(|| "No native audio capture is active.".to_string())?;
    if !active.stream_error.load(Ordering::Relaxed) {
        let _ = active.stream.pause();
    }

    let (has_voice_activity, samples, level, level_emits) = active
        .shared
        .lock()
        .map_err(|error| error.to_string())
        .map(|shared| {
            (
                shared.has_voice_activity,
                shared.samples.clone(),
                InputLevelSummary::new(
                    shared.peak_observed,
                    shared.clipped_samples,
                    shared.measured_samples,
                ),
                LevelEmitSummary::new(
                    shared.started_at.elapsed(),
                    shared.level_emits_attempted,
                    shared.level_emits_failed,
                    shared.slowest_level_emit,
                ),
            )
        })?;

    // Always recorded, including for discarded captures: the shortfall between
    // expected and attempted level emits is the runtime-side measurement for
    // the overlay-recording-freeze investigation, and a discarded capture is
    // exactly as interesting as a kept one there.
    runtime_log::record(format!(
        "[WordScript] Capture level emits wall_seconds={:.3} expected={} attempted={} failed={} shortfall_ratio={:.4} slowest_emit_ms={}",
        level_emits.wall_seconds,
        level_emits.expected,
        level_emits.attempted,
        level_emits.failed,
        level_emits.shortfall_ratio,
        level_emits.slowest_emit_ms,
    ));

    if samples.is_empty() || !has_voice_activity {
        runtime_log::record(format!(
            "[WordScript] Capture discarded as empty peak_dbfs={:.1} verdict={:?} clipped_ratio={:.4}",
            level.peak_dbfs, level.verdict, level.clipped_ratio,
        ));
        return Ok(CaptureOutcome::Empty(level));
    }

    if level.verdict == InputLevelVerdict::Clipping {
        runtime_log::record(format!(
            "[WordScript] Capture input clipping clipped_ratio={:.4} peak_dbfs={:.1}",
            level.clipped_ratio, level.peak_dbfs,
        ));
    }

    // Trimmed before the length check and before the file is written, so the
    // gate measures the audio a provider would actually receive rather than
    // the raw capture with its silent head and tail.
    let transcription_samples =
        prepare_transcription_samples(&samples, active.sample_rate, active.channels);

    if samples_below_min_speech(transcription_samples.len(), TRANSCRIPTION_SAMPLE_RATE) {
        runtime_log::record(format!(
            "[WordScript] Capture discarded as too short trimmed_samples={} min_speech_ms={} peak_dbfs={:.1}",
            transcription_samples.len(),
            min_speech_ms(),
            level.peak_dbfs,
        ));
        return Ok(CaptureOutcome::Empty(level.too_short()));
    }

    let audio_path = write_transcription_wav(
        &active.config,
        &active.id,
        active.sample_rate,
        active.channels,
        samples.len(),
        &transcription_samples,
    )?;
    let audio_duration_seconds = capture_duration_seconds(
        transcription_samples.len(),
        TRANSCRIPTION_SAMPLE_RATE,
        TRANSCRIPTION_CHANNELS,
    );

    let event = AudioReadyEvent {
        event: "audio_ready".to_string(),
        input_level: level,
        audio_path: audio_path.to_string_lossy().to_string(),
        audio_duration_seconds,
        config: active.config.clone(),
    };

    Ok(CaptureOutcome::Ready(serde_json::to_value(&event).map_err(
        |error| format!("Could not serialize the capture result: {error}"),
    )?))
}


pub fn abort_native_capture<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let state = app
        .try_state::<Mutex<NativeCaptureState>>()
        .ok_or_else(|| "Native capture state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let Some(active) = state.active.take() else {
        return Ok(());
    };
    if !active.stream_error.load(Ordering::Relaxed) {
        let _ = active.stream.pause();
    }
    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({ "event": "muted", "muted": false }),
    );
    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({ "event": "paused", "paused": false }),
    );
    Ok(())
}

pub fn monitor_native_capture<R: Runtime>(
    app: &AppHandle<R>,
    capture_id: &str,
) -> Result<NativeCaptureMonitorState, String> {
    let state = app
        .try_state::<Mutex<NativeCaptureState>>()
        .ok_or_else(|| "Native capture state is not available.".to_string())?;
    let state = state.lock().map_err(|error| error.to_string())?;
    let Some(active) = state.active.as_ref() else {
        return Ok(NativeCaptureMonitorState::Finished);
    };

    if active.id != capture_id {
        return Ok(NativeCaptureMonitorState::Finished);
    }

    if active.stream_error.load(Ordering::Relaxed) {
        if !active.rebuild_attempted {
            return Ok(NativeCaptureMonitorState::RebuildEligible);
        }
        return Ok(NativeCaptureMonitorState::Stop(
            NativeCaptureStopReason::StreamError,
        ));
    }

    let shared = active.shared.lock().map_err(|error| error.to_string())?;
    if let Some(reason) = capture_stop_reason(&active.config, &shared) {
        return Ok(NativeCaptureMonitorState::Stop(reason));
    }

    Ok(NativeCaptureMonitorState::Continue)
}

pub fn rebuild_stream_after_error<R: Runtime + 'static>(
    app: &AppHandle<R>,
    capture_id: &str,
) -> Result<RebuildOutcome, String> {
    let host = cpal::default_host();
    let host_id_name = host.id().name().to_string();

    let mut state = app
        .try_state::<Mutex<NativeCaptureState>>()
        .ok_or_else(|| "Native capture state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;

    let Some(active) = state.active.as_mut() else {
        return Ok(RebuildOutcome::NotEligible);
    };

    if active.id != capture_id {
        return Ok(RebuildOutcome::NotEligible);
    }

    if !active.stream_error.load(Ordering::Relaxed) || active.rebuild_attempted {
        return Ok(RebuildOutcome::NotEligible);
    }

    active.rebuild_attempted = true;

    let old_sample_rate = active.sample_rate;
    let old_channels = active.channels;
    let old_sample_format_label = active.sample_format.clone();
    let shared = active.shared.clone();

    {
        let mut shared_guard = shared.lock().map_err(|error| error.to_string())?;
        shared_guard.rebuild_in_progress = true;
        shared_guard.paused = true;
    }

    let device = match host.default_input_device() {
        Some(device) => device,
        None => {
            rollback_rebuild_pause(&shared);
            runtime_log::record(format!(
                "[WordScript] Native capture stream rebuild failed session_id={} reason=no_default_device rebuild_attempt=1",
                capture_id,
            ));
            return Ok(RebuildOutcome::Failed);
        }
    };

    let supported_config = match device.default_input_config() {
        Ok(config) => config,
        Err(error) => {
            rollback_rebuild_pause(&shared);
            runtime_log::record(format!(
                "[WordScript] Native capture stream rebuild failed session_id={} reason=config_read_error error={error} rebuild_attempt=1",
                capture_id,
            ));
            return Ok(RebuildOutcome::Failed);
        }
    };

    let new_sample_format = supported_config.sample_format();
    let new_stream_config = supported_config.config();
    let new_sample_rate = new_stream_config.sample_rate;
    let new_channels = new_stream_config.channels;
    let new_sample_format_label = sample_format_label(new_sample_format);

    if new_sample_rate != old_sample_rate
        || new_channels != old_channels
        || new_sample_format_label != old_sample_format_label
    {
        rollback_rebuild_pause(&shared);
        runtime_log::record(format!(
            "[WordScript] Native capture stream rebuild not eligible session_id={} reason=config_mismatch old_rate={} old_channels={} old_format={} new_rate={} new_channels={} new_format={} rebuild_attempt=1",
            capture_id, old_sample_rate, old_channels, old_sample_format_label,
            new_sample_rate, new_channels, new_sample_format_label,
        ));
        return Ok(RebuildOutcome::Failed);
    }

    let new_device_name = device
        .name()
        .unwrap_or_else(|_| "Default microphone".to_string());

    let new_stream_error = Arc::new(AtomicBool::new(false));

    let new_stream = match build_stream(
        app.clone(),
        &device,
        &new_stream_config,
        new_sample_format,
        shared.clone(),
        new_stream_error.clone(),
    ) {
        Ok(stream) => stream,
        Err(error) => {
            rollback_rebuild_pause(&shared);
            runtime_log::record(format!(
                "[WordScript] Native capture stream rebuild failed session_id={} reason=build_stream error={error} rebuild_attempt=1",
                capture_id,
            ));
            return Ok(RebuildOutcome::Failed);
        }
    };

    if let Err(error) = new_stream.play() {
        runtime_log::record(format!(
            "[WordScript] Native capture stream rebuild failed session_id={} reason=play error={error} rebuild_attempt=1",
            capture_id,
        ));
        rollback_rebuild_pause(&shared);
        return Ok(RebuildOutcome::Failed);
    }

    let Some(active) = state.active.as_mut() else {
        runtime_log::record(format!(
            "[WordScript] Native capture stream rebuild aborted session_id={} reason=active_capture_vanished rebuild_attempt=1",
            capture_id,
        ));
        rollback_rebuild_pause(&shared);
        return Ok(RebuildOutcome::Failed);
    };

    if active.id != capture_id {
        runtime_log::record(format!(
            "[WordScript] Native capture stream rebuild aborted session_id={} reason=id_mismatch rebuild_attempt=1",
            capture_id,
        ));
        rollback_rebuild_pause(&shared);
        return Ok(RebuildOutcome::Failed);
    }

    active.stream = new_stream;
    active.stream_error = new_stream_error;
    active.device_name = new_device_name.clone();

    {
        let mut shared_guard = shared.lock().map_err(|error| error.to_string())?;
        shared_guard.rebuild_in_progress = false;
        shared_guard.paused = false;
        shared_guard.paused_at = None;
        shared_guard.last_voice_at = Instant::now();
        shared_guard.last_level_emit_at =
            Instant::now() - Duration::from_millis(AUDIO_LEVEL_INTERVAL_MS);
    }

    runtime_log::record(format!(
        "[WordScript] Native capture stream rebuilt session_id={} host={} new_device={} new_sample_rate={} new_channels={} new_sample_format={} rebuild_attempt=1",
        capture_id, host_id_name, new_device_name, new_sample_rate, new_channels, new_sample_format_label,
    ));

    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({ "event": "capture_rebuilt" }),
    );

    Ok(RebuildOutcome::Rebuilt)
}

fn rollback_rebuild_pause(shared: &Arc<Mutex<SharedCaptureData>>) {
    if let Ok(mut shared_guard) = shared.lock() {
        shared_guard.rebuild_in_progress = false;
        if shared_guard.paused {
            shared_guard.paused = false;
            shared_guard.paused_at = None;
        }
    }
}

fn select_input_device(host: &cpal::Host, preferred_name: &str) -> Result<Device, String> {
    if !preferred_name.trim().is_empty() {
        let devices = host
            .input_devices()
            .map_err(|error| format!("Could not list input devices: {error}"))?;
        let preferred = preferred_name.to_lowercase();
        for device in devices {
            let Ok(name) = device.name() else {
                continue;
            };
            if name.to_lowercase().contains(&preferred) {
                return Ok(device);
            }
        }
    }

    host.default_input_device()
        .ok_or_else(|| default_input_error())
}

fn build_stream<R: Runtime + 'static>(
    app: AppHandle<R>,
    device: &Device,
    config: &StreamConfig,
    sample_format: SampleFormat,
    shared: Arc<Mutex<SharedCaptureData>>,
    stream_error: Arc<AtomicBool>,
) -> Result<Stream, String> {
    let error_app = app.clone();
    let error_callback = move |error| {
        stream_error.store(true, Ordering::Relaxed);
        let raw = format!("Native capture stream error: {error}");
        runtime_log::record(format!("[WordScript] {raw}"));
        let message = classify_capture_stream_error(&raw);
        let _ = error_app.emit(
            "wordscript-event",
            serde_json::json!({ "event": "error", "message": message }),
        );
    };

    match sample_format {
        SampleFormat::F32 => device
            .build_input_stream(
                config,
                move |data: &[f32], _| handle_f32_input(&app, &shared, data),
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build native input stream: {error}")),
        SampleFormat::I16 => device
            .build_input_stream(
                config,
                move |data: &[i16], _| handle_i16_input(&app, &shared, data),
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build native input stream: {error}")),
        SampleFormat::U16 => device
            .build_input_stream(
                config,
                move |data: &[u16], _| handle_u16_input(&app, &shared, data),
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build native input stream: {error}")),
        other => Err(format!(
            "Unsupported native audio sample format '{}'.",
            sample_format_label(other)
        )),
    }
}

fn handle_f32_input<R: Runtime>(
    app: &AppHandle<R>,
    shared: &Arc<Mutex<SharedCaptureData>>,
    data: &[f32],
) {
    process_samples(
        app,
        shared,
        data.iter().copied().map(|sample| sample.clamp(-1.0, 1.0)),
    );
}

fn handle_i16_input<R: Runtime>(
    app: &AppHandle<R>,
    shared: &Arc<Mutex<SharedCaptureData>>,
    data: &[i16],
) {
    process_samples(
        app,
        shared,
        data.iter()
            .copied()
            .map(|sample| f32::from(sample) / f32::from(i16::MAX)),
    );
}

fn handle_u16_input<R: Runtime>(
    app: &AppHandle<R>,
    shared: &Arc<Mutex<SharedCaptureData>>,
    data: &[u16],
) {
    process_samples(
        app,
        shared,
        data.iter()
            .copied()
            .map(|sample| (f32::from(sample) / f32::from(u16::MAX)) * 2.0 - 1.0),
    );
}

fn process_samples<R: Runtime>(
    app: &AppHandle<R>,
    shared: &Arc<Mutex<SharedCaptureData>>,
    samples: impl IntoIterator<Item = f32>,
) {
    let mut peak = 0.0_f32;
    let mut rms = 0.0_f32;
    let mut waveform = vec![0.0_f32; WAVEFORM_BUCKET_COUNT];
    let mut should_emit_level = false;
    let mut muted = false;
    let mut paused = false;

    if let Ok(mut shared) = shared.lock() {
        muted = shared.muted;
        paused = shared.paused || shared.rebuild_in_progress;
        let normalized_samples = samples
            .into_iter()
            .map(|normalized| {
                if muted || paused {
                    0.0
                } else {
                    normalized.clamp(-1.0, 1.0)
                }
            })
            .collect::<Vec<_>>();

        for sample in &normalized_samples {
            peak = peak.max(sample.abs());
            rms += sample.powi(2);
            if !paused && shared.samples.len() < shared.max_samples {
                shared.samples.push(f32_to_i16(*sample));
            }
        }

        // Level statistics for the whole capture, so an empty result can name
        // its own cause instead of just reporting that nothing was heard.
        if !muted && !paused {
            for sample in &normalized_samples {
                if sample.abs() >= CLIPPING_SAMPLE_THRESHOLD {
                    shared.clipped_samples += 1;
                }
            }
            shared.measured_samples += normalized_samples.len() as u64;
            shared.peak_observed = shared.peak_observed.max(peak);
        }

        if !normalized_samples.is_empty() && !paused {
            rms = (rms / normalized_samples.len() as f32).sqrt();
            waveform = waveform_buckets(&normalized_samples).to_vec();
        }

        if !muted && !paused && peak > DEFAULT_VOICE_THRESHOLD {
            shared.last_voice_at = Instant::now();
            shared.has_voice_activity = true;
        }

        if shared.last_level_emit_at.elapsed() >= Duration::from_millis(AUDIO_LEVEL_INTERVAL_MS) {
            shared.last_level_emit_at = Instant::now();
            should_emit_level = true;
        }
    }

    if should_emit_level {
        let emit_started_at = Instant::now();
        let outcome = app.emit(
            "wordscript-event",
            serde_json::json!({
                "event": "audio_level",
                "level": if muted || paused { 0.0 } else { peak },
                "rms": if muted || paused { 0.0 } else { rms },
                "waveform": if muted || paused { vec![0.0_f32; WAVEFORM_BUCKET_COUNT] } else { waveform }
            }),
        );
        let emit_elapsed = emit_started_at.elapsed();

        // Record the outcome instead of discarding it. A silently dropped emit
        // is one lost overlay frame, and dropping them without a trace is what
        // made the freeze unfalsifiable in the first place.
        if let Ok(mut shared) = shared.lock() {
            shared.level_emits_attempted += 1;
            if outcome.is_err() {
                shared.level_emits_failed += 1;
            }
            shared.slowest_level_emit = shared.slowest_level_emit.max(emit_elapsed);
        }
    }
}

fn effective_elapsed(shared: &SharedCaptureData) -> Duration {
    let current_pause = shared
        .paused_at
        .map(|paused_at| paused_at.elapsed())
        .unwrap_or(Duration::ZERO);
    shared
        .started_at
        .elapsed()
        .saturating_sub(shared.accumulated_paused + current_pause)
}

fn effective_silence_elapsed(shared: &SharedCaptureData) -> Duration {
    if shared.paused {
        Duration::ZERO
    } else {
        shared.last_voice_at.elapsed()
    }
}

fn capture_duration_seconds(sample_count: usize, sample_rate: u32, channels: u16) -> f64 {
    let frames_per_second = f64::from(sample_rate.max(1)) * f64::from(channels.max(1));
    sample_count as f64 / frames_per_second
}

fn waveform_buckets(samples: &[f32]) -> [f32; WAVEFORM_BUCKET_COUNT] {
    let mut sums = [0.0_f32; WAVEFORM_BUCKET_COUNT];
    let mut peaks = [0.0_f32; WAVEFORM_BUCKET_COUNT];
    let mut counts = [0_usize; WAVEFORM_BUCKET_COUNT];

    if samples.is_empty() {
        return sums;
    }

    for (index, sample) in samples.iter().enumerate() {
        let bucket = (index * WAVEFORM_BUCKET_COUNT / samples.len()).min(WAVEFORM_BUCKET_COUNT - 1);
        let amplitude = sample.abs();
        sums[bucket] += amplitude;
        peaks[bucket] = peaks[bucket].max(amplitude);
        counts[bucket] += 1;
    }

    let mut buckets = [0.0_f32; WAVEFORM_BUCKET_COUNT];
    for index in 0..WAVEFORM_BUCKET_COUNT {
        if counts[index] == 0 {
            continue;
        }
        let average = sums[index] / counts[index] as f32;
        buckets[index] = (average * 0.42 + peaks[index] * 0.58).clamp(0.0, 1.0);
    }

    buckets
}

fn write_transcription_wav(
    config: &NativeCaptureConfig,
    capture_id: &str,
    sample_rate: u32,
    channels: u16,
    input_sample_count: usize,
    transcription_samples: &[i16],
) -> Result<PathBuf, String> {
    let directory = capture_temp_dir(config)?;
    let file_path = directory.join(format!("{capture_id}.wav"));
    let spec = hound::WavSpec {
        channels: TRANSCRIPTION_CHANNELS,
        sample_rate: TRANSCRIPTION_SAMPLE_RATE,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::create(&file_path, spec)
        .map_err(|error| format!("Could not create native capture WAV file: {error}"))?;
    for sample in transcription_samples {
        writer
            .write_sample(*sample)
            .map_err(|error| format!("Could not write native capture sample: {error}"))?;
    }
    writer
        .finalize()
        .map_err(|error| format!("Could not finalize native capture WAV file: {error}"))?;
    restrict_capture_permissions(&file_path);

    if let Ok(metadata) = std::fs::metadata(&file_path) {
        runtime_log::record(format!(
            "[WordScript] Native capture export done input_rate={} input_channels={} output_rate={} output_channels={} input_samples={} output_samples={} file_bytes={}",
            sample_rate,
            channels,
            TRANSCRIPTION_SAMPLE_RATE,
            TRANSCRIPTION_CHANNELS,
            input_sample_count,
            transcription_samples.len(),
            metadata.len(),
        ));
    }

    Ok(file_path)
}

fn prepare_transcription_samples(samples: &[i16], sample_rate: u32, channels: u16) -> Vec<i16> {
    let mono = downmix_to_mono(samples, channels);
    let resampled = resample_mono_samples(&mono, sample_rate, TRANSCRIPTION_SAMPLE_RATE);
    trim_leading_trailing_silence(&resampled, TRANSCRIPTION_SAMPLE_RATE)
}

/// Whisper invents subtitle boilerplate when it is handed silence, so the
/// quiet head and tail of a capture are cut off before the audio ever reaches
/// a provider. The trim keeps a pad on both sides so a soft word onset is not
/// clipped, and it deliberately leaves the middle untouched: a pause inside a
/// sentence is speech, not silence to remove.
fn trim_leading_trailing_silence(samples: &[i16], sample_rate: u32) -> Vec<i16> {
    if samples.is_empty() || sample_rate == 0 {
        return samples.to_vec();
    }

    let window = ((sample_rate as u64 * TRIM_WINDOW_MS) / 1000).max(1) as usize;
    let pad = ((sample_rate as u64 * TRIM_PAD_MS) / 1000) as usize;
    let threshold = (TRIM_SILENCE_THRESHOLD * f32::from(i16::MAX)) as i32;

    let is_loud = |chunk: &[i16]| {
        chunk
            .iter()
            .any(|sample| i32::from(*sample).abs() > threshold)
    };

    let first_loud = samples
        .chunks(window)
        .position(|chunk| is_loud(chunk))
        .map(|index| index * window);
    let Some(first_loud) = first_loud else {
        return Vec::new();
    };
    let last_loud = samples
        .chunks(window)
        .rposition(|chunk| is_loud(chunk))
        .map(|index| ((index + 1) * window).min(samples.len()))
        .unwrap_or(samples.len());

    let start = first_loud.saturating_sub(pad);
    let end = (last_loud + pad).min(samples.len());

    samples[start..end].to_vec()
}

/// Deliberately far below the length of a real word: "Ja." runs 400-600ms, so
/// this rejects clicks, coughs and breath noise without ever swallowing a
/// short dictation. A gate that silently eats real speech is a worse failure
/// than a hallucination that the post-transcription filters can still catch.
fn min_speech_ms() -> u64 {
    std::env::var("WORDSCRIPT_MIN_SPEECH_MS")
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|value| value.clamp(0, 2_000))
        .unwrap_or(MIN_SPEECH_MS)
}

fn samples_below_min_speech(sample_count: usize, sample_rate: u32) -> bool {
    if sample_rate == 0 {
        return false;
    }
    let duration_ms = (sample_count as u64 * 1000) / u64::from(sample_rate);
    duration_ms < min_speech_ms()
}

fn downmix_to_mono(samples: &[i16], channels: u16) -> Vec<i16> {
    let channel_count = usize::from(channels.max(1));

    if channel_count == 1 {
        return samples.to_vec();
    }

    samples
        .chunks(channel_count)
        .map(|frame| {
            let frame_len = i32::try_from(frame.len()).unwrap_or(1);
            let sum = frame
                .iter()
                .fold(0_i32, |acc, sample| acc + i32::from(*sample));
            (sum / frame_len).clamp(i32::from(i16::MIN), i32::from(i16::MAX)) as i16
        })
        .collect()
}

fn resample_mono_samples(
    samples: &[i16],
    input_sample_rate: u32,
    output_sample_rate: u32,
) -> Vec<i16> {
    if samples.is_empty() {
        return Vec::new();
    }

    let normalized_input_rate = input_sample_rate.max(1);
    let normalized_output_rate = output_sample_rate.max(1);

    if normalized_input_rate == normalized_output_rate {
        return samples.to_vec();
    }

    let last_index = samples.len().saturating_sub(1);
    let output_len = (((last_index as f64) * f64::from(normalized_output_rate)
        / f64::from(normalized_input_rate))
    .floor() as usize)
        + 1;

    (0..output_len)
        .map(|index| {
            let source_position =
                index as f64 * f64::from(normalized_input_rate) / f64::from(normalized_output_rate);
            let left_index = source_position.floor() as usize;
            let right_index = (left_index + 1).min(last_index);
            let fraction = source_position - left_index as f64;
            let left = f64::from(samples[left_index.min(last_index)]);
            let right = f64::from(samples[right_index]);

            (left + (right - left) * fraction)
                .round()
                .clamp(f64::from(i16::MIN), f64::from(i16::MAX)) as i16
        })
        .collect()
}

fn capture_temp_dir(config: &NativeCaptureConfig) -> Result<PathBuf, String> {
    let directory = if config.temp_audio_dir.trim().is_empty() {
        user_data_dir().join("tmp")
    } else {
        PathBuf::from(config.temp_audio_dir.trim())
    };
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create native capture temp dir: {error}"))?;
    Ok(directory)
}

/// How long a retained capture stays on disk, and how many may pile up.
///
/// A recording kept for a retry is worth keeping until the retry happens, but
/// not forever: these are raw WAVs of everything the microphone heard, and an
/// unbounded directory of them is both a disk problem and a privacy one.
const RETAINED_CAPTURE_MAX_AGE: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const RETAINED_CAPTURE_MAX_FILES: usize = 20;

/// Whether a path is a capture this app wrote, in the directory it writes to.
///
/// The membership test the retry path uses before re-sending a file to a
/// provider. Both halves matter: the name proves the shape, the directory
/// proves it is ours.
pub fn is_retained_capture_path(path: &str) -> bool {
    let path = std::path::Path::new(path);
    let config = super::config::AppConfig::load_from_disk();
    let expected = if config.temp_audio_dir.trim().is_empty() {
        user_data_dir().join("tmp")
    } else {
        PathBuf::from(config.temp_audio_dir.trim())
    };

    is_retained_capture_file(path) && path.parent().is_some_and(|parent| parent == expected)
}

/// Whether a path is a capture file this app wrote.
fn is_retained_capture_file(path: &std::path::Path) -> bool {
    path.extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("wav"))
        && path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .is_some_and(|stem| {
                stem.strip_prefix("capture-")
                    .is_some_and(|rest| !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit()))
            })
}

/// Restrict a captured file to owner-only access.
///
/// A retained capture is a raw recording of everything the microphone heard,
/// and it now survives a failure by up to a week instead of being deleted at
/// once. The default 0644 that leaves it readable by every local account was
/// tolerable for a file that lived for two seconds; it is not for one that
/// lives for days.
#[cfg(unix)]
fn restrict_capture_permissions(path: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn restrict_capture_permissions(_path: &std::path::Path) {}

/// Prune captures kept for a retry, oldest first.
///
/// Reads the same directory `capture_temp_dir` writes to, using the on-disk
/// config rather than a live capture's, so it can run at startup when no
/// capture exists. Failures are logged and swallowed: a sweep that cannot run
/// must never take a session down with it.
pub fn prune_retained_captures() {
    let config = super::config::AppConfig::load_from_disk();
    let directory = if config.temp_audio_dir.trim().is_empty() {
        user_data_dir().join("tmp")
    } else {
        PathBuf::from(config.temp_audio_dir.trim())
    };

    let Ok(entries) = std::fs::read_dir(&directory) else {
        return;
    };

    let mut captures: Vec<(std::time::SystemTime, PathBuf)> = entries
        .flatten()
        // Only files this app wrote. `temp_audio_dir` is user-configurable, so
        // "every .wav in the directory" would delete the user's own recordings
        // the moment they point it at a folder that has some — a sweep is not
        // allowed to be destructive outside what it created. The name pattern
        // is the one `start_native_capture` writes (`capture-<n>.wav`).
        .filter(|entry| is_retained_capture_file(&entry.path()))
        .filter_map(|entry| {
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((modified, entry.path()))
        })
        .collect();

    // Newest first, so the count rule keeps the most recent — the ones a retry
    // is most likely to want.
    captures.sort_by(|a, b| b.0.cmp(&a.0));

    let now = std::time::SystemTime::now();
    let mut removed = 0usize;
    for (index, (modified, path)) in captures.iter().enumerate() {
        let too_old = now
            .duration_since(*modified)
            .map(|age| age > RETAINED_CAPTURE_MAX_AGE)
            .unwrap_or(false);
        let past_count = index >= RETAINED_CAPTURE_MAX_FILES;

        if (too_old || past_count) && std::fs::remove_file(path).is_ok() {
            removed += 1;
        }
    }

    if removed > 0 {
        runtime_log::record(format!(
            "[WordScript] Retained capture sweep removed={} kept={}",
            removed,
            captures.len().saturating_sub(removed),
        ));
    }
}

fn sample_format_label(sample_format: SampleFormat) -> &'static str {
    match sample_format {
        SampleFormat::F32 => "f32",
        SampleFormat::I16 => "i16",
        SampleFormat::U16 => "u16",
        _ => "unsupported",
    }
}

fn f32_to_i16(sample: f32) -> i16 {
    let clamped = sample.clamp(-1.0, 1.0);
    (clamped * f32::from(i16::MAX)).round() as i16
}

fn default_input_error() -> String {
    if cfg!(target_os = "linux") {
        "No audio input device found. Check PulseAudio/PipeWire and microphone permissions."
            .to_string()
    } else if cfg!(target_os = "macos") {
        "No audio input device found. Check System Settings -> Privacy & Security -> Microphone."
            .to_string()
    } else {
        "No audio input device found. Check the microphone connection and whether another app is blocking it.".to_string()
    }
}

fn classify_capture_stream_error(raw: &str) -> String {
    let lowered = raw.to_ascii_lowercase();

    if lowered.contains("permission") || lowered.contains("denied") || lowered.contains("access") {
        return "Audio input permission revoked. Check PulseAudio/PipeWire permissions and that no other app holds exclusive control.".to_string();
    }

    if lowered.contains("device")
        && (lowered.contains("invalid")
            || lowered.contains("removed")
            || lowered.contains("not found")
            || lowered.contains("no such"))
    {
        return "Audio input device was lost during recording (disconnect, suspend or compositor restart). The transcript up to this point is preserved.".to_string();
    }

    if lowered.contains("timeout") || lowered.contains("timed out") {
        return "Audio input stream timed out. Check PulseAudio/PipeWire daemon health."
            .to_string();
    }

    raw.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn round_trip(config: &NativeCaptureConfig) -> NativeCaptureConfig {
        let event = AudioReadyEvent {
            event: "audio_ready".to_string(),
            input_level: InputLevelSummary::new(0.4, 0, 16_000),
            audio_path: "/tmp/capture.wav".to_string(),
            audio_duration_seconds: 3.0,
            config: config.clone(),
        };
        let value = serde_json::to_value(&event).expect("event serializes");
        serde_json::from_value::<AudioReadyEvent>(value)
            .expect("event deserializes")
            .config
    }

    /// The regression guard for the wiring gap: the bias policy and every
    /// local decode setting used to be dropped between the capture event and
    /// the provider request, so a configured profile was rendered in the
    /// preview and then silently ignored on every real recording.
    #[test]
    fn audio_ready_round_trip_preserves_bias_policy_and_local_decode_settings() {
        let config = NativeCaptureConfig {
            provider: super::super::providers::LOCAL_PREVIEW_PROVIDER_ID.to_string(),
            local_profile: "local-preview-large-v3".to_string(),
            local_prompt_strength: "profile_and_terms".to_string(),
            local_prompt_carry: true,
            local_beam_size: 5,
            local_best_of: 4,
            language: "de".to_string(),
            work_mode: TextProfileWorkMode {
                bias_mode: super::super::config::BiasMode::Manual,
                manual_bias: super::super::config::ManualBias {
                    cloud_include_profile_terms: true,
                    local_include_profile_terms: true,
                    stt_hints_override: "WordScript".to_string(),
                },
                ..TextProfileWorkMode::default()
            },
            ..Default::default()
        };

        let restored = round_trip(&config);

        assert_eq!(
            restored.work_mode.bias_mode,
            super::super::config::BiasMode::Manual
        );
        assert!(restored.work_mode.manual_bias.cloud_include_profile_terms);
        assert!(restored.work_mode.manual_bias.local_include_profile_terms);
        assert_eq!(restored.local_prompt_strength, "profile_and_terms");
        assert!(restored.local_prompt_carry);
        assert_eq!(restored.local_beam_size, 5);
        assert_eq!(restored.local_best_of, 4);
        assert_eq!(restored.local_profile, "local-preview-large-v3");

        let request = restored.resolve_transcription_request("/tmp/capture.wav", 20_000);

        assert_eq!(request.carry_initial_prompt, Some(true));
        assert_eq!(request.beam_size, Some(5));
        assert_eq!(request.best_of, Some(4));
        assert_eq!(request.profile.as_deref(), Some("local-preview-large-v3"));
        assert_eq!(request.language.as_deref(), Some("de"));
    }

    /// The session belongs to the profile it started in. Agent name, label and
    /// communication style used to be re-read from disk once the audio was
    /// ready, so editing them mid-recording applied to that recording while
    /// editing the profile text did not — one rule with two answers (ADR 0025).
    #[test]
    fn audio_ready_round_trip_preserves_the_profile_identity_and_style() {
        use super::super::communication_style::{
            CommunicationLength, CommunicationRegister, CommunicationStyle,
        };

        let config = NativeCaptureConfig {
            profile_label: "Product and engineering".to_string(),
            agent_name: "Scribe".to_string(),
            stt_hints: "Kubernetes".to_string(),
            communication_style: CommunicationStyle {
                register: CommunicationRegister::Quick,
                length: CommunicationLength::Terse,
                instructions: "no emoji".to_string(),
                sample: "morning, moving the call".to_string(),
            },
            ..Default::default()
        };

        let restored = round_trip(&config);

        assert_eq!(restored.profile_label, "Product and engineering");
        assert_eq!(restored.agent_name, "Scribe");
        assert_eq!(restored.stt_hints, "Kubernetes");
        assert_eq!(
            restored.communication_style.register,
            CommunicationRegister::Quick
        );
        assert_eq!(
            restored.communication_style.length,
            CommunicationLength::Terse
        );
        assert_eq!(restored.communication_style.instructions, "no emoji");
        assert_eq!(restored.communication_style.sample, "morning, moving the call");

        // And they reach the transform the pipeline builds, rather than being
        // re-resolved there.
        let transform = super::super::transform::NativeTransformConfig::from_capture_config(
            &restored,
            super::super::config::ProcessingMode::Agent.transform_preset(),
        );
        assert_eq!(transform.agent_name, "Scribe");
        assert_eq!(transform.profile_label, "Product and engineering");
        assert_eq!(transform.style.register, CommunicationRegister::Quick);
    }

    /// A config written before the fields existed must still load. They travel
    /// in the same event payload as everything else, so a missing key would
    /// otherwise fail the whole capture rather than one setting.
    #[test]
    fn a_payload_without_the_new_fields_still_deserializes() {
        let mut value = serde_json::to_value(NativeCaptureConfig::default()).expect("serializes");
        let object = value.as_object_mut().expect("object");
        object.remove("profile_label");
        object.remove("agent_name");
        object.remove("communication_style");

        let restored: NativeCaptureConfig =
            serde_json::from_value(value).expect("legacy payload deserializes");
        assert_eq!(restored.profile_label, "");
        assert_eq!(restored.agent_name, super::super::config::DEFAULT_AGENT_NAME);
        assert!(!restored.communication_style.is_active());
    }

    #[test]
    fn cloud_requests_ask_for_the_segment_carrying_response_format() {
        let config = NativeCaptureConfig::default();
        let request = config.resolve_transcription_request("/tmp/capture.wav", 20_000);

        assert_eq!(request.response_format.as_deref(), Some("verbose_json"));
        // Local decode settings belong to the local lane only.
        assert_eq!(request.beam_size, None);
        assert_eq!(request.best_of, None);
        assert_eq!(request.carry_initial_prompt, None);
    }

    /// The context field never reaches the recognizer, in any bias mode and
    /// under any legacy manual flag (ADR 0032). It carries topics, and an
    /// initial prompt can only be conditioned on literal tokens. The profile's
    /// lexical channel is `vocabulary_hints`, which arrives as `stt_hints`.
    #[test]
    fn the_profile_context_field_never_reaches_the_recognizer() {
        let profile_terms = "WordScript\nGroq";
        let conservative = NativeCaptureConfig {
            prompt: profile_terms.to_string(),
            ..Default::default()
        };
        let manual = NativeCaptureConfig {
            prompt: profile_terms.to_string(),
            work_mode: TextProfileWorkMode {
                bias_mode: super::super::config::BiasMode::Manual,
                manual_bias: super::super::config::ManualBias {
                    cloud_include_profile_terms: true,
                    ..Default::default()
                },
                ..TextProfileWorkMode::default()
            },
            ..Default::default()
        };

        for config in [conservative, manual] {
            let prompt = config
                .resolve_transcription_request("/tmp/capture.wav", 20_000)
                .prompt
                .unwrap_or_default();

            assert!(
                !prompt.contains("WordScript") && !prompt.contains("Groq"),
                "context terms must not reach the recognizer, got: {prompt}"
            );
        }
    }

    #[test]
    fn the_opted_in_vocabulary_is_what_the_recognizer_receives() {
        let config = NativeCaptureConfig {
            prompt: "platform constraints".to_string(),
            stt_hints: "WordScript\nTauri".to_string(),
            ..Default::default()
        };

        let prompt = config
            .resolve_transcription_request("/tmp/capture.wav", 20_000)
            .prompt
            .expect("vocabulary produces an initial prompt");

        assert!(prompt.contains("Likely phrases: WordScript; Tauri"));
        assert!(!prompt.contains("platform constraints"));
    }

    /// The state most users are in. It used to send the provider no initial
    /// prompt at all, which is not a neutral request but an invitation for the
    /// decoder to fall back on its subtitle training (ADR 0036). Asserted on
    /// the request the runtime actually builds, because the defect this repeats
    /// is a floor that shows up in the preview and never in the call
    /// (`stt-hints-bypass-the-vocabulary-opt-in.md`).
    #[test]
    fn an_unconfigured_profile_still_sends_the_recognizer_the_blank_state_floor() {
        let cloud = NativeCaptureConfig::default();
        let local = NativeCaptureConfig {
            provider: super::super::providers::LOCAL_PREVIEW_PROVIDER_ID.to_string(),
            ..Default::default()
        };

        for config in [cloud, local] {
            let provider = config.provider.clone();
            let prompt = config
                .resolve_transcription_request("/tmp/capture.wav", 20_000)
                .prompt;

            assert_eq!(
                prompt.as_deref(),
                Some(super::super::transcription_hints::BLANK_STATE_RECOGNIZER_PROMPT),
                "provider {provider} got no floor"
            );
        }
    }

    fn loud_block(sample_count: usize) -> Vec<i16> {
        (0..sample_count)
            .map(|index| if index % 2 == 0 { 12_000 } else { -12_000 })
            .collect()
    }

    #[test]
    fn trim_removes_a_silent_head_and_tail_but_keeps_a_pad() {
        let pad_samples = (TRANSCRIPTION_SAMPLE_RATE as u64 * TRIM_PAD_MS / 1000) as usize;
        let speech = loud_block(TRANSCRIPTION_SAMPLE_RATE as usize);
        let mut samples = vec![0_i16; TRANSCRIPTION_SAMPLE_RATE as usize];
        samples.extend_from_slice(&speech);
        samples.extend(vec![0_i16; TRANSCRIPTION_SAMPLE_RATE as usize]);

        let trimmed = trim_leading_trailing_silence(&samples, TRANSCRIPTION_SAMPLE_RATE);

        assert!(trimmed.len() < samples.len(), "silence must be removed");
        assert!(
            trimmed.len() >= speech.len(),
            "the speech itself must survive the trim"
        );
        // The trim is window-quantised, so it can keep up to one scan window
        // more per side. Erring towards keeping audio is the safe direction.
        let window_samples = (TRANSCRIPTION_SAMPLE_RATE as u64 * TRIM_WINDOW_MS / 1000) as usize;
        assert!(
            trimmed.len() <= speech.len() + 2 * (pad_samples + window_samples),
            "no more than the pad plus one scan window may be kept per side, got {}",
            trimmed.len()
        );
    }

    #[test]
    fn trim_returns_nothing_for_pure_silence() {
        let samples = vec![0_i16; TRANSCRIPTION_SAMPLE_RATE as usize];

        assert!(trim_leading_trailing_silence(&samples, TRANSCRIPTION_SAMPLE_RATE).is_empty());
    }

    #[test]
    fn trim_leaves_continuous_speech_untouched() {
        let samples = loud_block(TRANSCRIPTION_SAMPLE_RATE as usize);

        assert_eq!(
            trim_leading_trailing_silence(&samples, TRANSCRIPTION_SAMPLE_RATE).len(),
            samples.len()
        );
    }

    #[test]
    fn trim_keeps_a_pause_inside_the_utterance() {
        // A pause between two words is speech, not silence to cut away.
        let word = loud_block(TRANSCRIPTION_SAMPLE_RATE as usize / 4);
        let pause = vec![0_i16; TRANSCRIPTION_SAMPLE_RATE as usize / 2];
        let mut samples = word.clone();
        samples.extend_from_slice(&pause);
        samples.extend_from_slice(&word);

        let trimmed = trim_leading_trailing_silence(&samples, TRANSCRIPTION_SAMPLE_RATE);

        assert_eq!(trimmed.len(), samples.len());
    }

    #[test]
    fn short_utterances_stay_above_the_minimum_speech_gate() {
        // 400ms is the low end of a real single word; it must never be gated.
        let short_word = loud_block((TRANSCRIPTION_SAMPLE_RATE as usize * 400) / 1000);

        assert!(!samples_below_min_speech(
            short_word.len(),
            TRANSCRIPTION_SAMPLE_RATE
        ));
    }

    #[test]
    fn a_click_falls_below_the_minimum_speech_gate() {
        let click = loud_block((TRANSCRIPTION_SAMPLE_RATE as usize * 40) / 1000);

        assert!(samples_below_min_speech(
            click.len(),
            TRANSCRIPTION_SAMPLE_RATE
        ));
    }

    #[test]
    fn too_short_captures_explain_themselves() {
        let level = InputLevelSummary::new(0.4, 0, 16_000).too_short();

        assert_eq!(level.verdict, InputLevelVerdict::TooShort);
        assert!(level.message().contains("No speech detected"));
    }

    #[test]
    fn level_emit_summary_reports_no_shortfall_when_every_interval_landed() {
        let summary = LevelEmitSummary::new(Duration::from_secs(10), 238, 0, Duration::ZERO);

        assert_eq!(summary.expected, 10_000 / AUDIO_LEVEL_INTERVAL_MS);
        assert_eq!(summary.attempted, 238);
        assert_eq!(summary.shortfall_ratio, 0.0);
    }

    #[test]
    fn level_emit_summary_quantifies_a_stalled_overlay_window() {
        // The observed 52 s capture: ~17 s of missing UI activity.
        let summary = LevelEmitSummary::new(Duration::from_secs(52), 833, 0, Duration::ZERO);

        assert_eq!(summary.expected, 52_000 / AUDIO_LEVEL_INTERVAL_MS);
        assert!(
            (summary.shortfall_ratio - 0.327).abs() < 0.01,
            "expected roughly a third of the emits to be missing, got {}",
            summary.shortfall_ratio
        );
    }

    #[test]
    fn level_emit_summary_counts_failed_emits_as_undelivered() {
        let summary = LevelEmitSummary::new(Duration::from_secs(1), 23, 23, Duration::from_millis(4));

        assert_eq!(summary.failed, 23);
        assert_eq!(summary.shortfall_ratio, 1.0);
        assert_eq!(summary.slowest_emit_ms, 4);
    }

    #[test]
    fn level_emit_summary_stays_defined_for_a_capture_shorter_than_one_interval() {
        let summary = LevelEmitSummary::new(Duration::from_millis(10), 0, 0, Duration::ZERO);

        assert_eq!(summary.expected, 0);
        assert_eq!(summary.shortfall_ratio, 0.0);
    }

    #[test]
    fn clamps_f32_to_i16_range() {
        assert_eq!(f32_to_i16(1.5), i16::MAX);
        assert_eq!(f32_to_i16(-1.5), i16::MIN + 1);
        assert_eq!(f32_to_i16(0.0), 0);
    }

    #[test]
    fn a_peak_below_the_voice_threshold_is_reported_as_too_quiet() {
        // This is the case that used to vanish: the capture is discarded and
        // the user is told nothing, so a microphone at a low input level looks
        // exactly like a broken app.
        let summary = InputLevelSummary::new(0.01, 0, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::TooQuiet);
        assert!(summary.peak_dbfs < summary.voice_threshold_dbfs);
        assert!(summary.message().contains("dBFS"));
        assert!(summary.message().contains("input level"));
    }

    #[test]
    fn a_dead_input_is_reported_as_silent_not_merely_quiet() {
        let summary = InputLevelSummary::new(0.0, 0, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Silent);
        assert_eq!(summary.peak_dbfs, -120.0);
        assert!(summary.message().contains("muted"));
    }

    #[test]
    fn sustained_full_scale_samples_are_reported_as_clipping() {
        let summary = InputLevelSummary::new(1.0, 1_000, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Clipping);
        assert!(summary.message().contains("clipping"));
    }

    #[test]
    fn an_occasional_transient_is_not_clipping() {
        // A handful of full-scale samples in a long capture is a transient,
        // not a badly set input level. Flagging it would train the user to
        // ignore the warning.
        let summary = InputLevelSummary::new(1.0, 10, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Ok);
    }

    #[test]
    fn a_healthy_speech_peak_is_reported_as_ok() {
        let summary = InputLevelSummary::new(0.4, 0, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Ok);
        assert!(summary.peak_dbfs > summary.voice_threshold_dbfs);
    }

    #[test]
    fn clipping_outranks_a_quiet_peak() {
        // Both cannot be acted on at once; the distorting one is the problem
        // worth naming.
        let summary = InputLevelSummary::new(0.005, 5_000, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Clipping);
    }

    #[test]
    fn an_empty_measurement_does_not_divide_by_zero() {
        let summary = InputLevelSummary::new(0.0, 0, 0);
        assert_eq!(summary.clipped_ratio, 0.0);
        assert_eq!(summary.verdict, InputLevelVerdict::Silent);
    }

    #[test]
    fn dbfs_conversion_matches_known_reference_points() {
        assert!((to_dbfs(1.0) - 0.0).abs() < 0.001);
        assert!((to_dbfs(0.5) + 6.02).abs() < 0.01);
        assert!((to_dbfs(0.1) + 20.0).abs() < 0.01);
        assert_eq!(to_dbfs(0.0), -120.0);
        assert_eq!(to_dbfs(-1.0), -120.0);
    }

    #[test]
    fn builds_waveform_buckets_from_real_sample_amplitudes() {
        let samples = [
            0.0, 0.5, -1.0, 0.25, 0.75, -0.25, 0.0, 1.0, -0.5, 0.25, 0.0, 0.0, 0.25, 0.5, 0.75,
            1.0, 0.0, 0.0, -0.25,
        ];
        let buckets = waveform_buckets(&samples);

        assert_eq!(buckets.len(), WAVEFORM_BUCKET_COUNT);
        assert_eq!(buckets[0], 0.0);
        assert_eq!(buckets[2], 1.0);
        assert!(buckets.iter().any(|bucket| *bucket > 0.7));
    }

    #[test]
    fn writes_transcription_friendly_wav() {
        let temp_dir = std::env::temp_dir().join(format!(
            "wordscript-capture-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let config = NativeCaptureConfig {
            temp_audio_dir: temp_dir.to_string_lossy().to_string(),
            ..NativeCaptureConfig::default()
        };
        let mut stereo_samples = Vec::with_capacity(48_000 * 2);

        for index in 0..48_000 {
            let left = if index % 2 == 0 { 12_000 } else { -12_000 };
            let right = 6_000;
            stereo_samples.push(left);
            stereo_samples.push(right);
        }

        let transcription_samples = prepare_transcription_samples(&stereo_samples, 48_000, 2);
        let file_path = write_transcription_wav(
            &config,
            "capture-test",
            48_000,
            2,
            stereo_samples.len(),
            &transcription_samples,
        )
        .expect("capture wav should be written");

        let reader = hound::WavReader::open(&file_path).expect("capture wav should be readable");
        let spec = reader.spec();
        let output_samples = reader
            .into_samples::<i16>()
            .collect::<Result<Vec<_>, _>>()
            .expect("samples should decode");

        assert_eq!(spec.sample_rate, TRANSCRIPTION_SAMPLE_RATE);
        assert_eq!(spec.channels, TRANSCRIPTION_CHANNELS);
        assert_eq!(output_samples.len(), TRANSCRIPTION_SAMPLE_RATE as usize);
        assert!(output_samples.iter().any(|sample| *sample != 0));

        let _ = std::fs::remove_file(&file_path);
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn the_sweep_only_claims_files_this_app_wrote() {
        // `temp_audio_dir` is user-configurable. Pointed at a folder holding the
        // user's own recordings, "every .wav here" would delete them.
        assert!(is_retained_capture_file(std::path::Path::new("capture-7.wav")));
        assert!(is_retained_capture_file(std::path::Path::new("capture-1042.WAV")));

        assert!(!is_retained_capture_file(std::path::Path::new("interview.wav")));
        assert!(!is_retained_capture_file(std::path::Path::new("capture-.wav")));
        assert!(!is_retained_capture_file(std::path::Path::new("capture-notes.wav")));
        assert!(!is_retained_capture_file(std::path::Path::new("my-capture-3.wav")));
        assert!(!is_retained_capture_file(std::path::Path::new("capture-3.mp3")));
    }

    #[test]
    fn a_retry_will_not_re_send_a_file_from_outside_the_capture_directory() {
        // history.json is a plain file; anything able to write it must not be
        // able to make WordScript upload an arbitrary path to a provider.
        assert!(!is_retained_capture_path("/etc/passwd"));
        assert!(!is_retained_capture_path("/home/someone/Documents/capture-1.wav"));
        assert!(!is_retained_capture_path(""));
    }

    #[test]
    fn stops_when_max_duration_is_reached() {
        let shared = Arc::new(Mutex::new(SharedCaptureData {
            started_at: Instant::now() - Duration::from_secs(5),
            last_voice_at: Instant::now(),
            last_level_emit_at: Instant::now(),
            muted: false,
            paused: false,
            paused_at: None,
            accumulated_paused: Duration::ZERO,
            has_voice_activity: true,
            peak_observed: 0.0,
            clipped_samples: 0,
            measured_samples: 0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: false,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
        }));

        let reason = capture_stop_reason(
            &NativeCaptureConfig {
                max_recording_seconds: 4,
                silence_timeout_seconds: 30,
                ..NativeCaptureConfig::default()
            },
            &shared.lock().unwrap(),
        );

        assert_eq!(reason, Some(NativeCaptureStopReason::MaxDuration));
    }

    #[test]
    fn stops_when_silence_timeout_is_reached() {
        let shared = Arc::new(Mutex::new(SharedCaptureData {
            started_at: Instant::now() - Duration::from_secs(6),
            last_voice_at: Instant::now() - Duration::from_secs(4),
            last_level_emit_at: Instant::now(),
            muted: false,
            paused: false,
            paused_at: None,
            accumulated_paused: Duration::ZERO,
            has_voice_activity: true,
            peak_observed: 0.0,
            clipped_samples: 0,
            measured_samples: 0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: false,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
        }));

        let reason = capture_stop_reason(
            &NativeCaptureConfig {
                max_recording_seconds: 30,
                silence_timeout_seconds: 3,
                ..NativeCaptureConfig::default()
            },
            &shared.lock().unwrap(),
        );

        assert_eq!(reason, Some(NativeCaptureStopReason::SilenceTimeout));
    }

    #[test]
    fn does_not_stop_while_capture_is_paused() {
        let shared = SharedCaptureData {
            started_at: Instant::now() - Duration::from_secs(8),
            last_voice_at: Instant::now() - Duration::from_secs(5),
            last_level_emit_at: Instant::now(),
            muted: false,
            paused: true,
            paused_at: Some(Instant::now() - Duration::from_secs(6)),
            accumulated_paused: Duration::ZERO,
            has_voice_activity: true,
            peak_observed: 0.0,
            clipped_samples: 0,
            measured_samples: 0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: false,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
        };

        let reason = capture_stop_reason(
            &NativeCaptureConfig {
                max_recording_seconds: 4,
                silence_timeout_seconds: 3,
                ..NativeCaptureConfig::default()
            },
            &shared,
        );

        assert_eq!(reason, None);
    }

    #[test]
    fn classify_capture_stream_error_recognises_permission_denied() {
        let classified = classify_capture_stream_error(
            "Native capture stream error: PulseAudio: permission denied",
        );
        assert_eq!(
            classified,
            "Audio input permission revoked. Check PulseAudio/PipeWire permissions and that no other app holds exclusive control."
        );
    }

    #[test]
    fn classify_capture_stream_error_recognises_access_revoked() {
        let classified = classify_capture_stream_error(
            "Native capture stream error: Access revoked by portal session",
        );
        assert_eq!(
            classified,
            "Audio input permission revoked. Check PulseAudio/PipeWire permissions and that no other app holds exclusive control."
        );
    }

    #[test]
    fn classify_capture_stream_error_recognises_device_invalid() {
        let classified = classify_capture_stream_error(
            "Native capture stream error: Device invalid after resume",
        );
        assert_eq!(
            classified,
            "Audio input device was lost during recording (disconnect, suspend or compositor restart). The transcript up to this point is preserved."
        );
    }

    #[test]
    fn classify_capture_stream_error_recognises_device_removed() {
        let classified = classify_capture_stream_error(
            "Native capture stream error: No such device (USB disconnect)",
        );
        assert_eq!(
            classified,
            "Audio input device was lost during recording (disconnect, suspend or compositor restart). The transcript up to this point is preserved."
        );
    }

    #[test]
    fn classify_capture_stream_error_recognises_timeout() {
        let classified = classify_capture_stream_error(
            "Native capture stream error: Stream timed out waiting for buffer",
        );
        assert_eq!(
            classified,
            "Audio input stream timed out. Check PulseAudio/PipeWire daemon health."
        );
    }

    #[test]
    fn classify_capture_stream_error_preserves_unclassified_raw_string() {
        let raw = "Native capture stream error: Unknown PulseAudio fault 0x1234";
        let classified = classify_capture_stream_error(raw);
        assert_eq!(classified, raw);
    }

    #[test]
    fn does_not_stop_while_rebuild_is_in_progress() {
        let shared = SharedCaptureData {
            started_at: Instant::now() - Duration::from_secs(6),
            last_voice_at: Instant::now() - Duration::from_secs(5),
            last_level_emit_at: Instant::now(),
            muted: false,
            paused: false,
            paused_at: None,
            accumulated_paused: Duration::ZERO,
            has_voice_activity: true,
            peak_observed: 0.0,
            clipped_samples: 0,
            measured_samples: 0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: true,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
        };

        let reason = capture_stop_reason(
            &NativeCaptureConfig {
                max_recording_seconds: 30,
                silence_timeout_seconds: 3,
                ..NativeCaptureConfig::default()
            },
            &shared,
        );

        assert_eq!(reason, None);
    }

    #[test]
    fn rollback_rebuild_pause_clears_in_progress_and_unpauses() {
        let shared = Arc::new(Mutex::new(SharedCaptureData {
            started_at: Instant::now(),
            last_voice_at: Instant::now(),
            last_level_emit_at: Instant::now(),
            muted: false,
            paused: true,
            paused_at: Some(Instant::now()),
            accumulated_paused: Duration::ZERO,
            has_voice_activity: false,
            peak_observed: 0.0,
            clipped_samples: 0,
            measured_samples: 0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: true,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
        }));

        rollback_rebuild_pause(&shared);

        let guard = shared.lock().unwrap();
        assert!(!guard.rebuild_in_progress);
        assert!(!guard.paused);
        assert!(guard.paused_at.is_none());
    }

    #[test]
    fn rollback_rebuild_pause_preserves_user_pause_state() {
        let shared = Arc::new(Mutex::new(SharedCaptureData {
            started_at: Instant::now(),
            last_voice_at: Instant::now(),
            last_level_emit_at: Instant::now(),
            muted: false,
            paused: false,
            paused_at: None,
            accumulated_paused: Duration::ZERO,
            has_voice_activity: false,
            peak_observed: 0.0,
            clipped_samples: 0,
            measured_samples: 0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: true,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
        }));

        rollback_rebuild_pause(&shared);

        let guard = shared.lock().unwrap();
        assert!(!guard.rebuild_in_progress);
        assert!(!guard.paused);
        assert!(guard.paused_at.is_none());
    }
}

#[test]
fn derives_capture_duration_from_samples() {
    let duration = capture_duration_seconds(32_000, 16_000, 1);
    assert!((duration - 2.0).abs() < f64::EPSILON);

    let stereo_duration = capture_duration_seconds(96_000, 48_000, 2);
    assert!((stereo_duration - 1.0).abs() < f64::EPSILON);
}
fn capture_stop_reason(
    config: &NativeCaptureConfig,
    shared: &SharedCaptureData,
) -> Option<NativeCaptureStopReason> {
    let elapsed = effective_elapsed(shared);
    let silence = effective_silence_elapsed(shared);

    if config.max_recording_seconds > 0
        && elapsed >= Duration::from_secs(config.max_recording_seconds)
    {
        return Some(NativeCaptureStopReason::MaxDuration);
    }

    if shared.paused || shared.rebuild_in_progress {
        return None;
    }

    if config.silence_timeout_seconds > 0
        && elapsed >= Duration::from_secs(MIN_SILENCE_AUTOSTOP_SECONDS)
        && silence >= Duration::from_secs(config.silence_timeout_seconds)
    {
        return Some(NativeCaptureStopReason::SilenceTimeout);
    }

    None
}
