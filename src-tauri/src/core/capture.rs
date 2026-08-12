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
        AppConfig, DictionaryEntry, ProfileProviderSettings, SnippetEntry, TextProfileWorkMode,
        TranslateSettings, DEFAULT_CORRECTION_MODEL,
    },
    paths::user_data_dir,
    providers::{JobKey, JobProvider},
    runtime_log,
};

fn default_agent_name() -> String {
    super::config::DEFAULT_AGENT_NAME.to_string()
}

const DEFAULT_MAX_RECORDING_SECONDS: u64 = 720;
const DEFAULT_SILENCE_TIMEOUT_SECONDS: u64 = 30;
pub(crate) const DEFAULT_VOICE_THRESHOLD: f32 = 0.02;
pub(crate) const AUDIO_LEVEL_INTERVAL_MS: u64 = 42;
const MIN_SILENCE_AUTOSTOP_SECONDS: u64 = 1;
pub(crate) const WAVEFORM_BUCKET_COUNT: usize = 19;
const TRANSCRIPTION_SAMPLE_RATE: u32 = 16_000;
const TRANSCRIPTION_CHANNELS: u16 = 1;
/// Below this the signal is indistinguishable from a muted or wrong device.
const SILENT_PEAK_THRESHOLD: f32 = 0.001;
/// A sample this close to full scale has lost its peak to the converter.
pub(crate) const CLIPPING_SAMPLE_THRESHOLD: f32 = 0.99;
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
/// The fraction of its own wall clock a capture may be missing before it has to
/// say so. Derived from the 2026-08-03 measurement and re-run on 2026-08-10 over
/// 608 paired captures: the healthy ones lose a median of 0.1 % and at most
/// 4.0 %, while the smallest real failure lost 12.0 %. There is no continuum
/// between the two, so 10 % sits an order of magnitude above the baseline and
/// below every observed defect (ADR 0079).
const CAPTURE_GAP_THRESHOLD: f64 = 0.10;
/// Below this a capture is too short for the ratio to mean anything: at one
/// second, a single late callback is already several percent.
const CAPTURE_INTEGRITY_MIN_WALL_SECONDS: f64 = 2.0;

/// How long the input stream may deliver nothing before the stretch is worth
/// naming. An ALSA period at 44.1 kHz is on the order of 10–25 ms, so 200 ms is
/// roughly ten missed periods — far outside ordinary scheduling jitter and far
/// below the multi-second stretches
/// `capture-loses-half-the-recording.md` implies.
const CALLBACK_GAP_THRESHOLD_MS: u128 = 200;
/// How many gaps one capture keeps. The realtime callback must not grow a
/// buffer without bound, and a capture that has already produced 64 of these
/// has answered the question the log is being read for.
const MAX_RECORDED_CALLBACK_GAPS: usize = 64;

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
    /// The root mean square over every measured sample of the capture, and the
    /// half of this summary that says what the microphone was doing rather than
    /// what its loudest instant was.
    ///
    /// A peak is set by one sample. A cough, a keyboard or a chair sets it just
    /// as well as speech does, so a capture dictated too quietly to transcribe
    /// can still report a healthy peak — which is exactly the case
    /// `transcription-accuracy.md` needs separated from "the recogniser is
    /// wrong". Defaulted so a payload written before it existed still loads.
    #[serde(default)]
    pub rms: f32,
    #[serde(default = "silent_dbfs")]
    pub rms_dbfs: f32,
    pub clipped_ratio: f32,
    pub verdict: InputLevelVerdict,
    /// The threshold speech detection had to clear, so the UI can state the
    /// measurement against the bar it failed.
    pub voice_threshold_dbfs: f32,
}

fn silent_dbfs() -> f32 {
    -120.0
}

impl InputLevelSummary {
    pub(crate) fn new(
        peak: f32,
        clipped_samples: u64,
        total_samples: u64,
        sum_squares: f64,
    ) -> Self {
        let clipped_ratio = if total_samples == 0 {
            0.0
        } else {
            clipped_samples as f32 / total_samples as f32
        };
        let rms = if total_samples == 0 {
            0.0
        } else {
            (sum_squares / total_samples as f64).sqrt() as f32
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
            rms,
            rms_dbfs: to_dbfs(rms),
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

    /// A capture whose loudest instant cleared the speech threshold while its
    /// mean stayed far below it — a microphone that is simply too quiet. It
    /// goes through `new` so a fixture and the runtime cannot disagree about
    /// what the numbers mean.
    #[cfg(test)]
    pub(crate) fn quiet_for_tests() -> Self {
        let total = 48_000;
        let typical = 0.004_f64;
        Self::new(0.03, 0, total, typical * typical * total as f64)
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
    /// The whole provider axis, not the recogniser's vendor (ADR 0094).
    ///
    /// **This struct is where the two used to be conflated.** It carried one
    /// `provider`, the transcription request took it, and then
    /// `NativeTransformConfig::from_capture_config` took the *same* string for
    /// the cleanup, the rewrite, the translation and the assistant — so the
    /// recogniser's vendor silently decided four chat jobs. Carrying the axis
    /// instead means every stage downstream resolves its own job, from one
    /// derivation taken once off the active profile.
    pub providers: ProfileProviderSettings,
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
            providers: ProfileProviderSettings::default(),
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

        // The recogniser's own job, resolved off the axis rather than read off
        // a field of its own — the model and the correction lane below follow
        // from which vendor *listens*, and that is `Dictation` and nothing else.
        let providers = active_profile.resolved_providers();
        let local_provider_selected =
            providers.resolve(JobKey::Dictation).provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID;
        let model = if local_provider_selected {
            if speech.local_model.trim().is_empty() {
                "base".to_string()
            } else {
                speech.local_model
            }
        } else {
            speech.model
        };

        Self {
            providers,
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

    /// What one of this capture's jobs runs on, and what pays for it
    /// (ADR 0094).
    pub fn job_provider(&self, job: JobKey) -> JobProvider {
        self.providers.resolve(job)
    }

    /// The vendor that listens. Every "is this the local lane" question on the
    /// recognition path asks this, so the answer is derived in one place rather
    /// than compared against a field eight call sites can drift from.
    pub fn speech_provider(&self) -> String {
        self.job_provider(JobKey::Dictation).provider
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
        let provider = self.speech_provider();
        let is_local = provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID;
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
            provider,
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
    /// Defaulted rather than required, so a payload written before ADR 0079 —
    /// a retained capture replayed from an older build — still deserializes.
    #[serde(default = "CaptureIntegrity::unmeasured")]
    pub capture_integrity: CaptureIntegrity,
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
    /// Summed squares over the same samples `measured_samples` counts, so the
    /// capture can state a mean level and not only its loudest instant. `f64`
    /// because a ten-minute capture at 44.1 kHz stereo sums 52 million terms
    /// and an `f32` accumulator stops growing long before that.
    sum_squares: f64,
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
    // Callback cadence (capture-loses-half-the-recording, step 2). The emit
    // accounting above measures the path OUT of the callback; this measures
    // whether the callback was called at all, which is the layer the loss was
    // finally traced to.
    cadence: CallbackCadence,
}

/// One stretch in which the input stream delivered no samples at all.
#[derive(Debug, Clone, Copy, PartialEq)]
struct CallbackGap {
    /// Milliseconds from the start of the capture to the callback that ENDED
    /// the gap, so a `verdict=short` line and this one name the same window.
    at_ms: u128,
    gap_ms: u128,
    /// Samples the resuming callback carried. **This is the discriminator.**
    /// A resuming callback of ordinary size means the audio for the gap was
    /// never delivered and is gone (hypothesis 1, a suspended stream); a
    /// callback carrying roughly a gap's worth of samples means the audio
    /// arrived late in one block and only the clock disagreed (hypothesis 3).
    samples: usize,
}

/// Whether the input stream kept being called, and what it delivered when it
/// was.
///
/// `capture-loses-half-the-recording.md` measured the loss twice and located it
/// nowhere: no stream error, no rebuild, no device change, and every emit that
/// was attempted succeeded immediately. The one thing nothing observed is the
/// cadence of the cpal callback itself, which is where the samples either
/// arrive or do not.
///
/// **Nothing here writes to the log from the audio callback.** The gaps are
/// accumulated in memory under the lock the callback already takes and flushed
/// at `stop_native_capture`. Writing a file from a realtime audio thread to
/// report a dropout is a good way to cause the next one — the observer would
/// become the effect — and the forensic value is identical, because the record
/// is read after the capture ends. The cost is that a capture that never stops
/// reports nothing, which is acceptable: this defect always ends with a
/// transcript.
#[derive(Debug, Clone)]
pub(crate) struct CallbackCadence {
    /// Interleaved samples the device produces per second — `sample_rate ×
    /// channels`. It converts a callback's size into the audio time it carries,
    /// which is what makes a late callback distinguishable from a lost one.
    samples_per_second: f64,
    /// `None` before the first callback and after every resume, so a paused
    /// stretch is not counted as a gap. Pausing calls `Stream::pause`, which
    /// stops the callback outright — the same construction artifact ADR 0079
    /// removed from `shortfall_ratio`, one layer down.
    last_callback_at: Option<Instant>,
    callbacks: u64,
    samples_total: u64,
    /// The first callback's size, which ALSA holds constant for the life of a
    /// stream. It is what a resuming callback is compared against.
    nominal_samples: usize,
    longest_gap: Duration,
    /// Summed audio time the gaps past the threshold did not deliver: each
    /// gap's length minus the audio the resuming callback actually carried.
    /// Compared against the missing audio it says whether the named gaps
    /// account for the loss or only part of it.
    lost_in_gaps: Duration,
    gaps_over_threshold: u64,
    gaps: Vec<CallbackGap>,
}

impl CallbackCadence {
    pub(crate) fn new(sample_rate: u32, channels: u16) -> Self {
        Self {
            samples_per_second: f64::from(sample_rate.max(1)) * f64::from(channels.max(1)),
            last_callback_at: None,
            callbacks: 0,
            samples_total: 0,
            nominal_samples: 0,
            longest_gap: Duration::ZERO,
            lost_in_gaps: Duration::ZERO,
            gaps_over_threshold: 0,
            gaps: Vec::new(),
        }
    }

    /// Called from the realtime audio callback, under the shared lock. Cheap by
    /// construction: arithmetic, and at most `MAX_RECORDED_CALLBACK_GAPS`
    /// pushes for the whole capture.
    ///
    /// `now` is passed in rather than read here so the cadence can be driven
    /// over a synthetic timeline in a test. A dropout instrumentation asserted
    /// with `thread::sleep` would be measuring the test runner's scheduler.
    pub(crate) fn observe(&mut self, started_at: Instant, now: Instant, samples: usize) {
        self.callbacks += 1;
        self.samples_total += samples as u64;
        if self.nominal_samples == 0 {
            self.nominal_samples = samples;
        }

        if let Some(previous) = self.last_callback_at {
            let gap = now.saturating_duration_since(previous);
            self.longest_gap = self.longest_gap.max(gap);
            if gap.as_millis() >= CALLBACK_GAP_THRESHOLD_MS {
                self.gaps_over_threshold += 1;
                self.lost_in_gaps += gap.saturating_sub(self.audio_time(samples));
                if self.gaps.len() < MAX_RECORDED_CALLBACK_GAPS {
                    self.gaps.push(CallbackGap {
                        at_ms: now.saturating_duration_since(started_at).as_millis(),
                        gap_ms: gap.as_millis(),
                        samples,
                    });
                }
            }
        }

        self.last_callback_at = Some(now);
    }

    /// How much recorded time a callback of this many samples carries.
    fn audio_time(&self, samples: usize) -> Duration {
        Duration::from_secs_f64(samples as f64 / self.samples_per_second)
    }

    /// Cleared on resume so the paused stretch is not read as a dropout.
    fn resumed(&mut self) {
        self.last_callback_at = None;
    }

    /// The interval the stream is supposed to keep, derived from the callback
    /// size the device chose rather than assumed.
    fn nominal_interval(&self) -> Duration {
        self.audio_time(self.nominal_samples)
    }

    /// A callback carrying more than twice its nominal size arrived late with
    /// the audio still in it — the stream did not stop, the delivery did.
    fn oversized_resumes(&self) -> usize {
        self.gaps
            .iter()
            .filter(|gap| gap.samples > self.nominal_samples.saturating_mul(2))
            .count()
    }

    /// Which of the record's three hypotheses the cadence supports.
    ///
    /// This is the whole reason the instrumentation exists, so it names a
    /// hypothesis rather than leaving three numbers for a reader to combine —
    /// but only ever from what was observed, and `no_gaps` on a short capture
    /// is a positive finding, not an absence of one: it means the loss is
    /// spread across the whole capture rather than concentrated in stretches,
    /// which is starvation and not a suspend.
    fn signature(&self, integrity: &CaptureIntegrity) -> &'static str {
        if self.gaps_over_threshold == 0 {
            return if integrity.is_short() {
                "no_gaps_but_audio_missing"
            } else {
                "no_gaps"
            };
        }

        let oversized = self.oversized_resumes();
        match (oversized, self.gaps.len()) {
            (0, _) => "stream_suspended",
            (over, total) if over == total => "late_delivery",
            _ => "mixed",
        }
    }

    /// What fraction of the capture's missing audio the named gaps account for.
    /// `None` when nothing is missing, because the ratio has no denominator.
    fn share_of_missing_audio(&self, integrity: &CaptureIntegrity) -> Option<f64> {
        let missing_seconds = integrity.wall_seconds - integrity.recorded_seconds;
        (missing_seconds > 0.0).then(|| self.lost_in_gaps.as_secs_f64() / missing_seconds)
    }
}

/// What the cadence writes to the runtime log at the end of a capture.
///
/// The summary line is written on **every** capture, healthy ones included. The
/// 2026-08-03 measurement only became readable because 345 healthy captures
/// stood next to the eight broken ones; a cadence line that only appeared on
/// failures would have no baseline to be read against, and the first question
/// asked of the first gap would be whether gaps are normal.
pub(crate) fn cadence_log_lines(
    cadence: &CallbackCadence,
    integrity: &CaptureIntegrity,
) -> Vec<String> {
    let share = cadence
        .share_of_missing_audio(integrity)
        .map(|share| format!("{share:.3}"))
        .unwrap_or_else(|| "n/a".to_string());

    let mut lines = vec![format!(
        "[WordScript] Capture callback cadence callbacks={} nominal_samples={} nominal_interval_ms={:.1} longest_gap_ms={} gaps_over_{}ms={} oversized_resumes={} lost_in_gaps_seconds={:.3} share_of_missing={} signature={}",
        cadence.callbacks,
        cadence.nominal_samples,
        cadence.nominal_interval().as_secs_f64() * 1000.0,
        cadence.longest_gap.as_millis(),
        CALLBACK_GAP_THRESHOLD_MS,
        cadence.gaps_over_threshold,
        cadence.oversized_resumes(),
        cadence.lost_in_gaps.as_secs_f64(),
        share,
        cadence.signature(integrity),
    )];

    for gap in &cadence.gaps {
        lines.push(format!(
            "[WordScript] Capture callback gap at_ms={} gap_ms={} resumed_with_samples={} nominal_samples={}",
            gap.at_ms, gap.gap_ms, gap.samples, cadence.nominal_samples,
        ));
    }

    // The list is bounded and the count is not, so a truncated list says so
    // rather than letting the log imply the capture had 64 gaps exactly.
    let recorded = cadence.gaps.len() as u64;
    if cadence.gaps_over_threshold > recorded {
        lines.push(format!(
            "[WordScript] Capture callback gap list truncated recorded={} total={}",
            recorded, cadence.gaps_over_threshold,
        ));
    }

    lines
}

/// Accounting for the `audio_level` events of one capture.
///
/// The overlay re-renders once per delivered event, so comparing the number of
/// events the runtime actually attempted against the number the 42 ms interval
/// implies turns "the overlay looked frozen" into a number. A shortfall means
/// the emit path itself stalled; `slowest_emit_ms` says whether `app.emit`
/// blocked inside the realtime audio callback while that happened.
///
/// **`wall` is the EFFECTIVE elapsed time, with paused stretches removed.**
/// Pausing calls `Stream::pause`, which stops the cpal callback outright, so a
/// paused capture emits nothing and records nothing while its clock keeps
/// running: measured against the raw clock every paused capture reported a
/// shortfall by construction, and the metric was unreadable on exactly the long
/// dictations it exists for. A stream REBUILD also sets `paused`, and that one
/// is deliberately not excused — the samples during a rebuild are genuinely
/// lost, and a metric that hides real loss is worse than no metric.
#[derive(Debug, Clone, PartialEq)]
struct LevelEmitSummary {
    wall_seconds: f64,
    expected: u64,
    attempted: u64,
    failed: u64,
    shortfall_ratio: f64,
    slowest_emit_ms: u128,
}

/// Whether a capture kept the audio its own clock says it ran for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureIntegrityVerdict {
    /// The recording matches the clock, within the startup transient.
    Intact,
    /// Audio is missing. The transcript is of what was recorded, not of what
    /// was said, and nothing downstream can tell the difference.
    Short,
    /// Too brief for the ratio to carry information.
    NotMeasured,
}

/// The comparison nobody had made: how long the capture ran against how much
/// audio it kept.
///
/// Both numbers were already logged — `wall_seconds` on the level-emit line and
/// the sample count on the export line — and the 2026-08-03 measurement found
/// them correlated at r = 0.9999 across 353 captures, which means they are one
/// measurement read off two counters. Eight captures had silently lost between
/// 12 % and 52 % of a dictation, and the product said nothing at all.
///
/// This makes the same comparison at the moment it stops being recoverable, so
/// a capture that recorded half of what the clock says can say so instead of
/// delivering a transcript that looks complete (ADR 0079).
///
/// `recorded_seconds` is derived from the UNTRIMMED buffer on purpose. The
/// silence trim (`trim_leading_trailing_silence`) removes a quiet head and tail
/// deliberately and can account for several seconds of a healthy capture; using
/// the trimmed length here would report every ordinary dictation as damaged.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct CaptureIntegrity {
    /// Wall clock with paused time removed — see `LevelEmitSummary::new`.
    pub wall_seconds: f64,
    pub recorded_seconds: f64,
    /// The fraction of the clock that produced no audio, clamped to 0..=1.
    pub missing_ratio: f64,
    pub verdict: CaptureIntegrityVerdict,
}

impl CaptureIntegrity {
    pub(crate) fn new(
        wall: Duration,
        sample_count: usize,
        sample_rate: u32,
        channels: u16,
    ) -> Self {
        let wall_seconds = wall.as_secs_f64();
        let recorded_seconds = capture_duration_seconds(sample_count, sample_rate, channels);
        let missing_ratio = if wall_seconds <= 0.0 {
            0.0
        } else {
            (1.0 - recorded_seconds / wall_seconds).clamp(0.0, 1.0)
        };

        let verdict = if wall_seconds < CAPTURE_INTEGRITY_MIN_WALL_SECONDS {
            CaptureIntegrityVerdict::NotMeasured
        } else if missing_ratio >= CAPTURE_GAP_THRESHOLD {
            CaptureIntegrityVerdict::Short
        } else {
            CaptureIntegrityVerdict::Intact
        };

        Self {
            wall_seconds,
            recorded_seconds,
            missing_ratio,
            verdict,
        }
    }

    /// The state of a capture nobody measured — an older payload, or a replay.
    /// Deliberately not `Intact`: "we did not look" and "we looked and it was
    /// fine" are different facts, and collapsing them would put a clean verdict
    /// on a capture that never had one.
    fn unmeasured() -> Self {
        Self {
            wall_seconds: 0.0,
            recorded_seconds: 0.0,
            missing_ratio: 0.0,
            verdict: CaptureIntegrityVerdict::NotMeasured,
        }
    }

    pub fn is_short(&self) -> bool {
        self.verdict == CaptureIntegrityVerdict::Short
    }

    /// The corpus states a capture in seconds, which is how the measurement
    /// reads it out of the two log lines. It still goes through `new`, so the
    /// corpus and the runtime cannot disagree about where the threshold sits.
    #[cfg(test)]
    pub(crate) fn from_seconds_for_tests(wall_seconds: f64, recorded_seconds: f64) -> Self {
        Self::new(
            Duration::from_secs_f64(wall_seconds),
            (recorded_seconds * f64::from(TRANSCRIPTION_SAMPLE_RATE)) as usize,
            TRANSCRIPTION_SAMPLE_RATE,
            TRANSCRIPTION_CHANNELS,
        )
    }

    /// The sentence the user reads, on the history record and behind the
    /// overlay's gap tab.
    ///
    /// It states the two numbers and stops. It does not apologise, does not
    /// guess what was lost, and above all does not offer to recover it — the
    /// audio was never captured, so there is nothing to recover, and a sentence
    /// implying otherwise would be the same invisible-damage failure one layer
    /// up.
    pub fn message(&self) -> String {
        format!(
            "This capture recorded {:.0} s of the {:.0} s it ran. {:.0} % of the audio was never captured, so the text is of what was recorded, not of what was said.",
            self.recorded_seconds,
            self.wall_seconds,
            self.missing_ratio * 100.0,
        )
    }

    /// The overlay tab's label. Short enough for the side strip, and it names
    /// the quantity rather than a mood.
    pub fn short_label(&self) -> String {
        format!("−{:.0} % audio", self.missing_ratio * 100.0)
    }
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
            // `Stream::pause` stopped the callback outright, so the first one
            // after `play()` is a gap the length of the pause. Forgetting the
            // last callback here is what keeps a deliberate pause out of the
            // dropout accounting.
            shared.cadence.resumed();
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
        sum_squares: 0.0,
        samples: Vec::new(),
        max_samples,
        rebuild_in_progress: false,
        level_emits_attempted: 0,
        level_emits_failed: 0,
        slowest_level_emit: Duration::ZERO,
        cadence: CallbackCadence::new(stream_config.sample_rate, stream_config.channels),
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

    let (has_voice_activity, samples, level, level_emits, effective_wall, cadence) = active
        .shared
        .lock()
        .map_err(|error| error.to_string())
        .map(|shared| {
            // One clock for both accountings, and it is the one that excludes
            // paused stretches — `effective_elapsed` already owns that
            // arithmetic for the silence timeout, so restating it here would be
            // a second definition of the same thing.
            let effective_wall = effective_elapsed(&shared);
            (
                shared.has_voice_activity,
                shared.samples.clone(),
                InputLevelSummary::new(
                    shared.peak_observed,
                    shared.clipped_samples,
                    shared.measured_samples,
                    shared.sum_squares,
                ),
                LevelEmitSummary::new(
                    effective_wall,
                    shared.level_emits_attempted,
                    shared.level_emits_failed,
                    shared.slowest_level_emit,
                ),
                effective_wall,
                shared.cadence.clone(),
            )
        })?;

    let integrity = CaptureIntegrity::new(
        effective_wall,
        samples.len(),
        active.sample_rate,
        active.channels,
    );

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

    // Recorded on every capture, kept or discarded, and BEFORE the discard
    // branches below: the comparison is what says whether a capture that is
    // about to be thrown away as empty was empty or merely unrecorded.
    runtime_log::record(format!(
        "[WordScript] Capture integrity wall_seconds={:.3} recorded_seconds={:.3} missing_ratio={:.4} verdict={:?}",
        integrity.wall_seconds,
        integrity.recorded_seconds,
        integrity.missing_ratio,
        integrity.verdict,
    ));

    for line in cadence_log_lines(&cadence, &integrity) {
        runtime_log::record(line);
    }

    // On every capture, kept or discarded, for the same reason the two lines
    // above are: the level of a capture that produced a fluent transcript is
    // the interesting one, and until now it was only ever reported on the
    // captures that produced nothing at all.
    runtime_log::record(format!(
        "[WordScript] Capture input level peak_dbfs={:.1} rms_dbfs={:.1} voice_threshold_dbfs={:.1} clipped_ratio={:.4} verdict={:?}",
        level.peak_dbfs,
        level.rms_dbfs,
        level.voice_threshold_dbfs,
        level.clipped_ratio,
        level.verdict,
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
        capture_integrity: integrity,
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
        // The rebuild's own stretch is already named by the
        // `Native capture stream rebuilt` line above; carrying it into the gap
        // list a second time would attribute an explained outage to the
        // unexplained defect this instrumentation is hunting.
        shared_guard.cadence.resumed();
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
        shared_guard.cadence.resumed();
    }
}

pub(crate) fn select_input_device(
    host: &cpal::Host,
    preferred_name: &str,
) -> Result<Device, String> {
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

        // Before anything else the callback does with the data, and on every
        // callback including the muted and paused ones: the question this
        // answers is whether the callback ran at all, and skipping it under a
        // condition would put a hole in the very measurement that exists to
        // find holes. A paused stretch is excluded at the resume instead, where
        // the cause is known.
        if paused {
            shared.cadence.resumed();
        } else {
            let started_at = shared.started_at;
            shared
                .cadence
                .observe(started_at, Instant::now(), normalized_samples.len());
        }

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
                shared.sum_squares += f64::from(*sample) * f64::from(*sample);
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

pub(crate) fn waveform_buckets(samples: &[f32]) -> [f32; WAVEFORM_BUCKET_COUNT] {
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

pub(crate) fn sample_format_label(sample_format: SampleFormat) -> &'static str {
    match sample_format {
        SampleFormat::F32 => "f32",
        SampleFormat::I16 => "i16",
        SampleFormat::U16 => "u16",
        _ => "unsupported",
    }
}

pub(crate) fn f32_to_i16(sample: f32) -> i16 {
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

    /// A profile whose whole axis sits on the local runtime.
    fn local_lane_providers() -> ProfileProviderSettings {
        ProfileProviderSettings {
            default: super::super::providers::LOCAL_PREVIEW_PROVIDER_ID.to_string(),
            ..Default::default()
        }
    }

    /// A level summary for the tests that are about the verdict rather than
    /// the mean. The sum of squares is derived from the peak so the fixture is
    /// at least physically possible: a capture cannot peak at 0.4 and have an
    /// RMS of zero, and a fixture that says so would be the only place in this
    /// file where the numbers do not agree with each other.
    fn level_summary_for_tests(
        peak: f32,
        clipped_samples: u64,
        total_samples: u64,
    ) -> InputLevelSummary {
        let typical = f64::from(peak) * 0.25;
        InputLevelSummary::new(
            peak,
            clipped_samples,
            total_samples,
            typical * typical * total_samples as f64,
        )
    }

    fn round_trip(config: &NativeCaptureConfig) -> NativeCaptureConfig {
        let event = AudioReadyEvent {
            event: "audio_ready".to_string(),
            input_level: level_summary_for_tests(0.4, 0, 16_000),
            capture_integrity: CaptureIntegrity::unmeasured(),
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
            providers: local_lane_providers(),
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
            providers: local_lane_providers(),
            ..Default::default()
        };

        for config in [cloud, local] {
            let provider = config.speech_provider();
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
        let level = level_summary_for_tests(0.4, 0, 16_000).too_short();

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

    /// Audio at the capture's own rate, as the shared buffer holds it:
    /// interleaved, so `channels` samples per frame.
    fn samples_for(seconds: f64, sample_rate: u32, channels: u16) -> usize {
        (seconds * f64::from(sample_rate) * f64::from(channels)) as usize
    }

    /// A freshly started capture with nothing recorded yet. The pause and clock
    /// tests move `started_at` backwards and set the pause fields, which is the
    /// only state they are about.
    fn shared_for_tests() -> SharedCaptureData {
        SharedCaptureData {
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
            sum_squares: 0.0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: false,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
            cadence: CallbackCadence::new(44_100, 2),
        }
    }

    // ── Callback cadence ────────────────────────────────────────────────────
    //
    // The environment these describe: `host=Alsa sample_rate=44100 channels=2`,
    // identical across all 497 capture starts in the runtime log. At a 1024
    // frame period that is 2048 interleaved samples every ~23 ms.

    const PERIOD_SAMPLES: usize = 2_048;
    const PERIOD_MS: u64 = 23;

    /// Drives a cadence over a synthetic timeline: `gaps` names the callbacks
    /// after which an extra stretch of silence is inserted, and the size the
    /// resuming callback then carries.
    fn cadence_over(
        callbacks: usize,
        gaps: &[(usize, u64, usize)],
    ) -> (CallbackCadence, Duration) {
        let mut cadence = CallbackCadence::new(44_100, 2);
        let started_at = Instant::now();
        let mut clock = started_at;

        for index in 0..callbacks {
            let gap = gaps.iter().find(|(after, _, _)| *after == index);
            let (step_ms, samples) = match gap {
                Some((_, gap_ms, samples)) => (*gap_ms, *samples),
                None => (PERIOD_MS, PERIOD_SAMPLES),
            };
            clock += Duration::from_millis(step_ms);
            cadence.observe(started_at, clock, samples);
        }

        let elapsed = clock.saturating_duration_since(started_at);
        (cadence, elapsed)
    }

    /// An integrity verdict for a capture that ran `wall` and kept `recorded`.
    fn integrity_for(wall: Duration, recorded_seconds: f64) -> CaptureIntegrity {
        CaptureIntegrity::new(
            wall,
            samples_for(recorded_seconds, 44_100, 2),
            44_100,
            2,
        )
    }

    /// The baseline. 345 of the 353 measured captures look like this, and
    /// without it a gap on a broken capture would have nothing to be unusual
    /// against.
    #[test]
    fn a_steady_stream_reports_no_callback_gaps() {
        let (cadence, elapsed) = cadence_over(400, &[]);
        let integrity = integrity_for(elapsed, elapsed.as_secs_f64());

        assert_eq!(cadence.callbacks, 400);
        assert_eq!(cadence.gaps_over_threshold, 0);
        assert!(cadence.longest_gap < Duration::from_millis(CALLBACK_GAP_THRESHOLD_MS as u64));
        assert_eq!(cadence.signature(&integrity), "no_gaps");
        assert_eq!(cadence.nominal_samples, PERIOD_SAMPLES);
    }

    /// Hypothesis 1: the stream is suspended and resumed without an error. The
    /// callback stops arriving, and when it comes back it carries an ordinary
    /// period — the audio for the gap was never delivered and is gone.
    #[test]
    fn a_suspended_stream_is_named_and_its_lost_audio_counted() {
        // 400 callbacks with one 8 s outage in the middle.
        let (cadence, elapsed) = cadence_over(400, &[(200, 8_000, PERIOD_SAMPLES)]);
        let recorded = elapsed.as_secs_f64() - 8.0;
        let integrity = integrity_for(elapsed, recorded);

        assert_eq!(cadence.gaps_over_threshold, 1);
        assert_eq!(cadence.oversized_resumes(), 0);
        assert_eq!(cadence.signature(&integrity), "stream_suspended");
        assert_eq!(cadence.gaps.len(), 1);
        assert_eq!(cadence.gaps[0].gap_ms, 8_000);
        assert_eq!(cadence.gaps[0].samples, PERIOD_SAMPLES);

        // The gap accounts for the loss, which is the finding that would
        // separate this from a metric artifact.
        let share = cadence.share_of_missing_audio(&integrity).expect("audio is missing");
        assert!(
            (share - 1.0).abs() < 0.05,
            "the 8 s gap should account for the 8 s of missing audio, got {share}"
        );
    }

    /// Hypothesis 3: the samples arrived late in one block rather than being
    /// lost. The gap is the same length, and the resuming callback carries the
    /// audio for it — so nothing is missing and the instrumentation must not
    /// report a suspend.
    #[test]
    fn a_late_delivery_is_not_reported_as_a_suspended_stream() {
        let catch_up = samples_for(8.0, 44_100, 2);
        let (cadence, elapsed) = cadence_over(400, &[(200, 8_000, catch_up)]);
        let integrity = integrity_for(elapsed, elapsed.as_secs_f64());

        assert_eq!(cadence.gaps_over_threshold, 1);
        assert_eq!(cadence.oversized_resumes(), 1);
        assert_eq!(cadence.signature(&integrity), "late_delivery");
        assert_eq!(cadence.lost_in_gaps, Duration::ZERO);
    }

    /// Hypothesis 2: callback starvation. No single stretch is long enough to
    /// name, and yet the audio is short — which is a positive finding about
    /// where to look, not an absence of one.
    #[test]
    fn audio_missing_without_a_single_gap_is_its_own_signature() {
        let (cadence, elapsed) = cadence_over(400, &[]);
        let integrity = integrity_for(elapsed, elapsed.as_secs_f64() * 0.5);

        assert!(integrity.is_short());
        assert_eq!(cadence.gaps_over_threshold, 0);
        assert_eq!(cadence.signature(&integrity), "no_gaps_but_audio_missing");
        assert_eq!(
            cadence.share_of_missing_audio(&integrity),
            Some(0.0),
            "no gap can account for any of the loss"
        );
    }

    /// A deliberate pause stops the cpal callback outright, so the first
    /// callback after it is a gap the length of the pause. Counting it would
    /// reproduce, one layer down, exactly the artifact ADR 0079 removed from
    /// `shortfall_ratio`.
    #[test]
    fn a_pause_is_not_counted_as_a_callback_gap() {
        let mut cadence = CallbackCadence::new(44_100, 2);
        let started_at = Instant::now();
        let mut clock = started_at;

        for _ in 0..10 {
            clock += Duration::from_millis(PERIOD_MS);
            cadence.observe(started_at, clock, PERIOD_SAMPLES);
        }

        // Paused for two minutes, then resumed.
        cadence.resumed();
        clock += Duration::from_secs(120);
        cadence.observe(started_at, clock, PERIOD_SAMPLES);

        assert_eq!(cadence.gaps_over_threshold, 0);
        assert_eq!(cadence.gaps, Vec::new());
        assert!(cadence.longest_gap < Duration::from_millis(CALLBACK_GAP_THRESHOLD_MS as u64));
    }

    /// The gap list is bounded because it lives in a realtime audio callback.
    /// A truncated list has to say so, or the log implies the capture had
    /// exactly `MAX_RECORDED_CALLBACK_GAPS` gaps.
    #[test]
    fn a_truncated_gap_list_says_it_was_truncated() {
        // From the second callback onwards, so every one of them has a
        // predecessor to be a gap against.
        let gaps: Vec<(usize, u64, usize)> = (0..MAX_RECORDED_CALLBACK_GAPS + 5)
            .map(|index| (index * 2 + 1, 500, PERIOD_SAMPLES))
            .collect();
        let (cadence, elapsed) = cadence_over(200, &gaps);
        let integrity = integrity_for(elapsed, elapsed.as_secs_f64() * 0.5);

        assert_eq!(cadence.gaps.len(), MAX_RECORDED_CALLBACK_GAPS);
        assert_eq!(
            cadence.gaps_over_threshold,
            MAX_RECORDED_CALLBACK_GAPS as u64 + 5
        );

        let lines = cadence_log_lines(&cadence, &integrity);
        assert!(
            lines.iter().any(|line| line.contains("gap list truncated recorded=64 total=69")),
            "{lines:#?}"
        );
    }

    /// A healthy capture writes the line too. The measurement that found this
    /// defect only worked because the healthy captures were in the same log.
    #[test]
    fn the_cadence_line_is_written_on_a_healthy_capture_too() {
        let (cadence, elapsed) = cadence_over(400, &[]);
        let integrity = integrity_for(elapsed, elapsed.as_secs_f64());
        let lines = cadence_log_lines(&cadence, &integrity);

        assert_eq!(lines.len(), 1, "{lines:#?}");
        assert!(lines[0].contains("Capture callback cadence callbacks=400"), "{}", lines[0]);
        assert!(lines[0].contains("signature=no_gaps"), "{}", lines[0]);
        assert!(lines[0].contains("gaps_over_200ms=0"), "{}", lines[0]);
        assert!(lines[0].contains("share_of_missing=0.000"), "{}", lines[0]);
    }

    /// A share with no denominator is printed as `n/a` rather than as zero.
    /// Zero would read as "the gaps explain none of the loss", which is a
    /// finding, and there is no loss to have a finding about.
    #[test]
    fn a_capture_that_lost_nothing_reports_no_share_rather_than_zero() {
        let (cadence, _) = cadence_over(400, &[]);
        let integrity = CaptureIntegrity::new(
            Duration::from_secs(10),
            samples_for(10.0, 44_100, 2),
            44_100,
            2,
        );

        assert_eq!(cadence.share_of_missing_audio(&integrity), None);
        assert!(
            cadence_log_lines(&cadence, &integrity)[0].contains("share_of_missing=n/a"),
            "{:?}",
            cadence_log_lines(&cadence, &integrity)[0]
        );
    }

    /// The gap line names the window a `verdict=short` line points at, and the
    /// size of the callback that ended it — which is what separates the three
    /// hypotheses when the log is read.
    #[test]
    fn a_gap_line_carries_the_window_and_the_resuming_callback_size() {
        let (cadence, elapsed) = cadence_over(400, &[(200, 8_000, PERIOD_SAMPLES)]);
        let integrity = integrity_for(elapsed, elapsed.as_secs_f64() - 8.0);
        let lines = cadence_log_lines(&cadence, &integrity);

        assert_eq!(lines.len(), 2, "{lines:#?}");
        assert!(lines[0].contains("signature=stream_suspended"), "{}", lines[0]);
        assert!(lines[0].contains("gaps_over_200ms=1"), "{}", lines[0]);
        assert!(
            lines[1].contains("gap_ms=8000") && lines[1].contains("resumed_with_samples=2048"),
            "{}",
            lines[1]
        );
    }

    #[test]
    fn capture_integrity_calls_a_complete_recording_intact() {
        let integrity = CaptureIntegrity::new(
            Duration::from_secs(60),
            samples_for(59.9, 44_100, 2),
            44_100,
            2,
        );

        assert_eq!(integrity.verdict, CaptureIntegrityVerdict::Intact);
        assert!(!integrity.is_short());
        assert!(integrity.missing_ratio < 0.01);
    }

    /// The worst capture in the 2026-08-03 measurement: 405.7 s on the clock,
    /// 194.3 s of audio. It was delivered as a finished transcript.
    #[test]
    fn capture_integrity_reports_the_worst_observed_capture() {
        let integrity = CaptureIntegrity::new(
            Duration::from_millis(405_700),
            samples_for(194.3, 44_100, 2),
            44_100,
            2,
        );

        assert_eq!(integrity.verdict, CaptureIntegrityVerdict::Short);
        assert!(
            (integrity.missing_ratio - 0.521).abs() < 0.005,
            "expected 52 % missing, got {}",
            integrity.missing_ratio
        );
        assert!(integrity.message().contains("52 %"));
        assert_eq!(integrity.short_label(), "−52 % audio");
    }

    /// The baseline's worst healthy capture stays intact, and the smallest real
    /// failure does not. The threshold has to separate exactly these two, and
    /// the gap between them is the whole reason it can be a constant.
    #[test]
    fn capture_integrity_separates_the_baseline_from_the_smallest_real_failure() {
        let healthy =
            CaptureIntegrity::new(Duration::from_secs(100), samples_for(96.0, 16_000, 1), 16_000, 1);
        let failure =
            CaptureIntegrity::new(Duration::from_secs(100), samples_for(88.0, 16_000, 1), 16_000, 1);

        assert_eq!(healthy.verdict, CaptureIntegrityVerdict::Intact);
        assert_eq!(failure.verdict, CaptureIntegrityVerdict::Short);
    }

    #[test]
    fn capture_integrity_declines_to_judge_a_capture_too_short_to_measure() {
        let integrity =
            CaptureIntegrity::new(Duration::from_millis(900), samples_for(0.4, 16_000, 1), 16_000, 1);

        assert_eq!(integrity.verdict, CaptureIntegrityVerdict::NotMeasured);
        assert!(!integrity.is_short());
    }

    /// A capture that recorded MORE than its effective clock — possible by a
    /// rounding hair once paused time is subtracted — is intact, not negative.
    #[test]
    fn capture_integrity_never_reports_a_negative_gap() {
        let integrity =
            CaptureIntegrity::new(Duration::from_secs(10), samples_for(10.4, 16_000, 1), 16_000, 1);

        assert_eq!(integrity.missing_ratio, 0.0);
        assert_eq!(integrity.verdict, CaptureIntegrityVerdict::Intact);
    }

    /// A payload from before ADR 0079 carries no verdict, and must not be given
    /// a clean one. Reached in practice by a retained capture written by an
    /// older build and replayed after an update.
    #[test]
    fn an_audio_ready_payload_without_integrity_is_not_measured() {
        let event = AudioReadyEvent {
            event: "audio_ready".to_string(),
            input_level: level_summary_for_tests(0.4, 0, 16_000),
            capture_integrity: CaptureIntegrity::new(
                Duration::from_secs(60),
                samples_for(30.0, 16_000, 1),
                16_000,
                1,
            ),
            audio_path: "/tmp/capture.wav".to_string(),
            audio_duration_seconds: 12.0,
            config: NativeCaptureConfig::default(),
        };
        let mut value = serde_json::to_value(&event).expect("event serializes");
        value
            .as_object_mut()
            .expect("object payload")
            .remove("capture_integrity")
            .expect("the field was there to remove");

        let payload: AudioReadyEvent =
            serde_json::from_value(value).expect("legacy audio_ready payload");

        assert_eq!(
            payload.capture_integrity.verdict,
            CaptureIntegrityVerdict::NotMeasured
        );
    }

    /// Pausing stops the cpal callback, so a paused capture records nothing
    /// while the raw clock runs. The effective clock is what both accountings
    /// are measured against, and against it the capture is intact.
    #[test]
    fn paused_time_is_not_counted_as_missing_audio() {
        let mut shared = shared_for_tests();
        shared.started_at = Instant::now() - Duration::from_secs(100);
        shared.accumulated_paused = Duration::from_secs(40);

        let effective = effective_elapsed(&shared);
        let integrity =
            CaptureIntegrity::new(effective, samples_for(59.5, 16_000, 1), 16_000, 1);
        let emits = LevelEmitSummary::new(effective, 1_420, 0, Duration::ZERO);

        assert_eq!(integrity.verdict, CaptureIntegrityVerdict::Intact);
        assert!(
            emits.shortfall_ratio < 0.02,
            "the emit shortfall must be readable on a paused capture, got {}",
            emits.shortfall_ratio
        );
    }

    /// A pause that is still open at stop counts too — the user can stop a
    /// capture without resuming it first.
    #[test]
    fn an_open_pause_is_subtracted_as_well() {
        let mut shared = shared_for_tests();
        shared.started_at = Instant::now() - Duration::from_secs(60);
        shared.paused = true;
        shared.paused_at = Some(Instant::now() - Duration::from_secs(30));

        let effective = effective_elapsed(&shared);

        assert!(
            (effective.as_secs_f64() - 30.0).abs() < 1.0,
            "expected roughly 30 s of effective capture, got {:?}",
            effective
        );
    }

    /// A stream rebuild also sets `paused`, and it is deliberately NOT excused:
    /// `accumulated_paused` is never advanced for it, so the samples lost to a
    /// rebuild stay visible as missing audio.
    #[test]
    fn a_stream_rebuild_is_not_excused_the_way_a_pause_is() {
        let mut shared = shared_for_tests();
        shared.started_at = Instant::now() - Duration::from_secs(100);
        shared.rebuild_in_progress = true;
        shared.paused = true;

        let effective = effective_elapsed(&shared);
        let integrity =
            CaptureIntegrity::new(effective, samples_for(70.0, 16_000, 1), 16_000, 1);

        assert_eq!(integrity.verdict, CaptureIntegrityVerdict::Short);
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
        let summary = level_summary_for_tests(0.01, 0, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::TooQuiet);
        assert!(summary.peak_dbfs < summary.voice_threshold_dbfs);
        assert!(summary.message().contains("dBFS"));
        assert!(summary.message().contains("input level"));
    }

    #[test]
    fn a_dead_input_is_reported_as_silent_not_merely_quiet() {
        let summary = level_summary_for_tests(0.0, 0, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Silent);
        assert_eq!(summary.peak_dbfs, -120.0);
        assert!(summary.message().contains("muted"));
    }

    #[test]
    fn sustained_full_scale_samples_are_reported_as_clipping() {
        let summary = level_summary_for_tests(1.0, 1_000, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Clipping);
        assert!(summary.message().contains("clipping"));
    }

    /// The case the mean exists for, and the reason the peak alone was not
    /// enough: a capture whose loudest instant clears the speech threshold
    /// while everything else sits far below it. The verdict is `Ok`, the
    /// transcript reads like any other, and only the mean says the microphone
    /// was too quiet.
    #[test]
    fn a_quiet_capture_with_one_loud_instant_is_only_visible_in_the_mean() {
        let total = 48_000;
        let typical = 0.004_f64;
        let summary =
            InputLevelSummary::new(0.30, 0, total, typical * typical * total as f64);

        assert_eq!(summary.verdict, InputLevelVerdict::Ok);
        assert!(
            summary.peak_dbfs > summary.voice_threshold_dbfs,
            "the peak clears the bar: {} vs {}",
            summary.peak_dbfs,
            summary.voice_threshold_dbfs
        );
        assert!(
            summary.rms_dbfs < summary.voice_threshold_dbfs,
            "the mean does not: {} vs {}",
            summary.rms_dbfs,
            summary.voice_threshold_dbfs
        );
    }

    /// A capture at a healthy level has a mean above the threshold too, so the
    /// number above is a signal rather than something every capture reports.
    #[test]
    fn a_healthy_capture_has_a_mean_above_the_speech_threshold() {
        let total = 48_000;
        let typical = 0.08_f64;
        let summary =
            InputLevelSummary::new(0.45, 0, total, typical * typical * total as f64);

        assert_eq!(summary.verdict, InputLevelVerdict::Ok);
        assert!((summary.rms - 0.08).abs() < 0.001, "rms {}", summary.rms);
        assert!(summary.rms_dbfs > summary.voice_threshold_dbfs);
    }

    /// A capture that measured nothing reports silence rather than a division
    /// by zero.
    #[test]
    fn a_capture_with_no_measured_samples_reports_a_silent_mean() {
        let summary = InputLevelSummary::new(0.0, 0, 0, 0.0);

        assert_eq!(summary.rms, 0.0);
        assert_eq!(summary.rms_dbfs, -120.0);
    }

    /// An older payload has no mean in it, and must deserialize to silence
    /// rather than fail the whole capture (ADR 0015).
    #[test]
    fn a_level_payload_without_a_mean_still_loads() {
        let summary: InputLevelSummary = serde_json::from_value(serde_json::json!({
            "peak": 0.4,
            "peak_dbfs": -8.0,
            "clipped_ratio": 0.0,
            "verdict": "ok",
            "voice_threshold_dbfs": -34.0,
        }))
        .expect("a pre-mean payload");

        assert_eq!(summary.rms, 0.0);
        assert_eq!(summary.rms_dbfs, -120.0);
    }

    #[test]
    fn an_occasional_transient_is_not_clipping() {
        // A handful of full-scale samples in a long capture is a transient,
        // not a badly set input level. Flagging it would train the user to
        // ignore the warning.
        let summary = level_summary_for_tests(1.0, 10, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Ok);
    }

    #[test]
    fn a_healthy_speech_peak_is_reported_as_ok() {
        let summary = level_summary_for_tests(0.4, 0, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Ok);
        assert!(summary.peak_dbfs > summary.voice_threshold_dbfs);
    }

    #[test]
    fn clipping_outranks_a_quiet_peak() {
        // Both cannot be acted on at once; the distorting one is the problem
        // worth naming.
        let summary = level_summary_for_tests(0.005, 5_000, 48_000);
        assert_eq!(summary.verdict, InputLevelVerdict::Clipping);
    }

    #[test]
    fn an_empty_measurement_does_not_divide_by_zero() {
        let summary = level_summary_for_tests(0.0, 0, 0);
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
            sum_squares: 0.0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: false,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
            cadence: CallbackCadence::new(44_100, 2),
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
            sum_squares: 0.0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: false,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
            cadence: CallbackCadence::new(44_100, 2),
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
            sum_squares: 0.0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: false,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
            cadence: CallbackCadence::new(44_100, 2),
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
            sum_squares: 0.0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: true,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
            cadence: CallbackCadence::new(44_100, 2),
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
            sum_squares: 0.0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: true,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
            cadence: CallbackCadence::new(44_100, 2),
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
            sum_squares: 0.0,
            samples: vec![],
            max_samples: 0,
            rebuild_in_progress: true,
            level_emits_attempted: 0,
            level_emits_failed: 0,
            slowest_level_emit: Duration::ZERO,
            cadence: CallbackCadence::new(44_100, 2),
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
