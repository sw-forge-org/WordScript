use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::config::AppConfig;
use super::providers::{self, JobKey, ProviderCaptureLimits};

/// Bytes per second of the exported capture: 16 kHz, mono, i16.
/// Mirrors `capture::TRANSCRIPTION_SAMPLE_RATE` and the export path's
/// single-channel i16 write. A byte rate guessed here rather than derived is
/// how a ceiling drifts away from the file it is supposed to describe.
pub const EXPORT_BYTES_PER_SECOND: u64 = 16_000 * 2;

/// The WAV header the export writes ahead of the samples.
const EXPORT_HEADER_BYTES: u64 = 44;

/// The configuration ceiling, unchanged from `normalize_for_runtime`.
pub const CONFIGURED_MAX_RECORDING_SECONDS: u64 = 1_800;
pub const CONFIGURED_MIN_RECORDING_SECONDS: u64 = 60;

/// Floor under the transcription wait, for captures short enough that the
/// round trip dominates.
pub const MIN_TRANSCRIPTION_TIMEOUT_MS: u64 = 18_000;

/// Ceiling on a single transcription attempt. Ten minutes is long enough for a
/// capture at the provider ceiling to upload and decode on a slow link, and
/// short enough that a genuinely wedged request still ends.
pub const MAX_TRANSCRIPTION_TIMEOUT_MS: u64 = 600_000;

/// Wait granted per second of audio. Covers upload *and* decode: on the cloud
/// lane the upload dominates, which is why this is not a decode-rate factor.
pub const TRANSCRIPTION_TIMEOUT_PER_AUDIO_SECOND_MS: u64 = 800;

/// Attempts a transcription request makes before it gives up
/// (`groq.rs` uses `max_retries.unwrap_or(1)`, so one retry after the first
/// try). The watchdog has to outlast all of them or it fires mid-retry and
/// reports a hang that is really a second attempt in flight.
const TRANSCRIPTION_ATTEMPTS: u64 = 2;

/// Headroom over the transcription attempts for transform and insert.
const PIPELINE_TAIL_MS: u64 = 45_000;

/// Why a recording cannot be longer than the ceiling. The UI states the reason
/// next to the control, so the cause has to survive the trip.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureCeilingReason {
    /// The provider rejects uploads past a request size.
    ProviderUploadLimit,
    /// The lane cannot decode more than this within the wait budget.
    DecodeBudget,
    /// Nothing provider-side binds first; the configuration maximum does.
    ConfiguredMaximum,
}

/// What a recording may cost under the current provider and settings.
///
/// One source for four consumers: the pipeline's timeouts, the capture monitor's
/// auto-stop, the settings surface, and the overlay tab. Each of them used to
/// answer this separately, which is how a capture path that permitted 30 minutes
/// ended up feeding a pipeline that waited 35 seconds.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CaptureBudget {
    /// Provider the ceiling was derived for.
    pub provider: String,
    /// Longest recording this provider + settings combination can process.
    pub ceiling_seconds: u64,
    pub ceiling_reason: CaptureCeilingReason,
    /// The cause, phrased for display: "the 25 MiB upload size".
    pub ceiling_detail: String,
    /// The auto-stop in force: the configured value, clamped to the ceiling.
    pub auto_stop_seconds: u64,
    /// What the profile stores, before clamping.
    pub configured_auto_stop_seconds: u64,
    /// True when the stored value was above the ceiling. The stored value is
    /// never rewritten — a setting the user made is not the runtime's to edit
    /// (ADR 0020) — so the surfaces say it is clamped instead.
    pub auto_stop_clamped: bool,
    /// Headroom the auto-stop should keep below the ceiling.
    pub safety_margin_seconds: u64,
    /// The longest auto-stop that still keeps that headroom. What the settings
    /// surface recommends, and what a fresh profile should sit at or below.
    pub recommended_auto_stop_seconds: u64,
    /// True when the auto-stop is inside the margin — legal, but with no room
    /// left for the capture to overrun or the upload to be a little larger
    /// than the estimate.
    pub auto_stop_in_margin: bool,
}

impl CaptureBudget {
    /// Seconds of audio that fit in a provider request of `limit_bytes`.
    fn seconds_for_upload_limit(limit_bytes: u64) -> u64 {
        limit_bytes.saturating_sub(EXPORT_HEADER_BYTES) / EXPORT_BYTES_PER_SECOND
    }
}

/// Headroom between the auto-stop and the ceiling.
///
/// The ceiling is exact arithmetic on an estimate: the capture monitor checks
/// on a 200 ms tick, the export writes a header, and a provider's accounting of
/// "request size" need not match ours to the byte. An auto-stop sitting exactly
/// on the ceiling therefore produces recordings that are occasionally a second
/// too long — and being a second too long costs the whole recording, which is
/// the asymmetry this margin exists for.
///
/// Ten percent, bounded: enough to absorb the overrun on a short ceiling,
/// never so much on a long one that it eats usable minutes.
fn safety_margin_for(ceiling_seconds: u64) -> u64 {
    (ceiling_seconds / 10).clamp(30, 120)
}

/// Turn a lane's declared limits into a number of seconds.
///
/// Knows the two shapes a limit can take, not the lanes that declare them: a
/// provider states what binds it, this states what that means in recording
/// time. A new lane is a new declaration, not a new branch here.
fn ceiling_from_limits(limits: &ProviderCaptureLimits) -> Option<(u64, CaptureCeilingReason)> {
    let upload = limits.max_audio_bytes.map(|bytes| {
        (
            CaptureBudget::seconds_for_upload_limit(bytes),
            CaptureCeilingReason::ProviderUploadLimit,
        )
    });

    let decode = limits.realtime_factor.filter(|f| *f > 0.0).map(|factor| {
        (
            ((MAX_TRANSCRIPTION_TIMEOUT_MS as f64 / 1_000.0) / factor).floor() as u64,
            CaptureCeilingReason::DecodeBudget,
        )
    });

    // A lane may declare both. The tighter one is the one that actually binds.
    match (upload, decode) {
        (Some(a), Some(b)) => Some(if a.0 <= b.0 { a } else { b }),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}

/// Resolve the budget from the active profile.
pub fn resolve(config: &AppConfig) -> CaptureBudget {
    let profile = config.active_text_profile();
    let speech = profile.resolved_speech();
    let capture = profile.resolved_capture();
    // The budget is the recogniser's ceiling, so it is `Dictation`'s vendor and
    // never the connection's — a profile that routes listening to Local is
    // bound by decode time even while its chat jobs sit on a cloud plan.
    let provider = profile.job_provider(JobKey::Dictation).provider;

    // The model matters to lanes bound by decode time; the tier to lanes bound
    // by request size. Both are passed for every lane, and each lane uses what
    // applies to it.
    let model = if speech.local_model.trim().is_empty() {
        speech.model.clone()
    } else {
        speech.local_model.clone()
    };
    let limits = providers::capture_limits(&provider, &model, &config.provider_tier);

    // The earliest real limit wins, and the reason follows the winner — a
    // ceiling that names a cause which is not the binding one is worse than
    // none, because it sends the fix in the wrong direction. A lane that
    // declares nothing lands on the configured maximum, which is honest: the
    // runtime does not know that lane's boundary and does not invent one.
    let (ceiling_seconds, ceiling_reason, ceiling_detail) = match ceiling_from_limits(&limits) {
        Some((seconds, reason)) if seconds < CONFIGURED_MAX_RECORDING_SECONDS => (
            seconds.max(CONFIGURED_MIN_RECORDING_SECONDS),
            reason,
            limits.detail.clone(),
        ),
        _ => (
            CONFIGURED_MAX_RECORDING_SECONDS,
            CaptureCeilingReason::ConfiguredMaximum,
            "the 30 minute maximum".to_string(),
        ),
    };

    let safety_margin_seconds = safety_margin_for(ceiling_seconds);
    let recommended_auto_stop_seconds = ceiling_seconds
        .saturating_sub(safety_margin_seconds)
        .max(CONFIGURED_MIN_RECORDING_SECONDS);

    let configured = capture.max_recording_seconds;
    let auto_stop_seconds = configured.min(ceiling_seconds);

    CaptureBudget {
        provider,
        ceiling_seconds,
        ceiling_reason,
        ceiling_detail,
        auto_stop_seconds,
        configured_auto_stop_seconds: configured,
        auto_stop_clamped: configured > ceiling_seconds,
        safety_margin_seconds,
        recommended_auto_stop_seconds,
        auto_stop_in_margin: auto_stop_seconds > recommended_auto_stop_seconds,
    }
}

/// How long a single transcription attempt may take for `audio_seconds`.
///
/// Scales across the whole duration. It used to cap the input at 60 seconds
/// before scaling, so every capture longer than a minute was granted the same
/// wait as a one-minute one and an 11-minute recording could not finish.
pub fn transcription_timeout_ms(audio_seconds: Option<f64>) -> u64 {
    let audio_ms = audio_seconds
        .filter(|duration| duration.is_finite() && *duration > 0.0)
        .map(|duration| (duration * 1_000.0).round() as u64)
        .unwrap_or_default();

    MIN_TRANSCRIPTION_TIMEOUT_MS
        .saturating_add(
            audio_ms.saturating_mul(TRANSCRIPTION_TIMEOUT_PER_AUDIO_SECOND_MS) / 1_000,
        )
        .clamp(MIN_TRANSCRIPTION_TIMEOUT_MS, MAX_TRANSCRIPTION_TIMEOUT_MS)
}

/// The watchdog deadline for the whole pipeline.
///
/// Derived from the transcription budget rather than fixed, because a watchdog
/// shorter than the request it supervises is a second timeout that nothing
/// names: it reported "the pipeline did not complete" while the provider call
/// was still legitimately running.
pub fn pipeline_deadline(audio_seconds: Option<f64>) -> Duration {
    let attempts = transcription_timeout_ms(audio_seconds).saturating_mul(TRANSCRIPTION_ATTEMPTS);
    Duration::from_millis(attempts.saturating_add(PIPELINE_TAIL_MS))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set_profile_auto_stop(config: &mut AppConfig, seconds: u64) {
        let active_id = config.active_text_profile_id.clone();
        let profile = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
            .expect("active profile");
        profile.capture = Some(crate::core::config::ProfileCaptureSettings {
            max_recording_seconds: seconds,
            silence_timeout_seconds: 30,
        });
    }

    fn set_profile_provider(config: &mut AppConfig, provider: &str) {
        let active_id = config.active_text_profile_id.clone();
        let profile = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
            .expect("active profile");
        let mut providers = profile.resolved_providers();
        providers.default = provider.to_string();
        profile.providers = Some(providers);
    }

    #[test]
    fn long_audio_is_granted_a_proportional_wait() {
        // The capture that started this: 679.58 s got 35 s and could not finish.
        let timeout = transcription_timeout_ms(Some(679.58));
        assert!(
            timeout > 500_000,
            "an 11-minute capture must get minutes, got {timeout}ms"
        );
        assert!(timeout <= MAX_TRANSCRIPTION_TIMEOUT_MS);
    }

    #[test]
    fn the_wait_grows_with_the_audio() {
        let short = transcription_timeout_ms(Some(30.0));
        let medium = transcription_timeout_ms(Some(120.0));
        let long = transcription_timeout_ms(Some(600.0));
        assert!(short < medium, "{short} < {medium}");
        assert!(medium < long, "{medium} < {long}");
    }

    #[test]
    fn a_missing_duration_falls_back_to_the_floor() {
        assert_eq!(transcription_timeout_ms(None), MIN_TRANSCRIPTION_TIMEOUT_MS);
        assert_eq!(
            transcription_timeout_ms(Some(f64::NAN)),
            MIN_TRANSCRIPTION_TIMEOUT_MS
        );
        assert_eq!(
            transcription_timeout_ms(Some(-4.0)),
            MIN_TRANSCRIPTION_TIMEOUT_MS
        );
    }

    #[test]
    fn the_wait_is_bounded() {
        assert_eq!(
            transcription_timeout_ms(Some(100_000.0)),
            MAX_TRANSCRIPTION_TIMEOUT_MS
        );
    }

    #[test]
    fn the_watchdog_outlasts_every_attempt() {
        for seconds in [5.0_f64, 60.0, 679.58, 1_800.0] {
            let attempt = transcription_timeout_ms(Some(seconds));
            let deadline = pipeline_deadline(Some(seconds)).as_millis() as u64;
            assert!(
                deadline > attempt * TRANSCRIPTION_ATTEMPTS,
                "deadline {deadline}ms must outlast {TRANSCRIPTION_ATTEMPTS} attempts of {attempt}ms"
            );
        }
    }

    #[test]
    fn the_upload_ceiling_matches_the_export_rate() {
        // 25 MiB of 16 kHz mono i16 is 13:39 of audio.
        let seconds = CaptureBudget::seconds_for_upload_limit(25 * 1024 * 1024);
        assert_eq!(seconds, 819);
    }

    #[test]
    fn a_decode_bound_lane_gets_a_decode_ceiling() {
        let limits = ProviderCaptureLimits {
            max_audio_bytes: None,
            realtime_factor: Some(2.0),
            detail: "decode".to_string(),
        };
        let (seconds, reason) = ceiling_from_limits(&limits).expect("a bound lane has a ceiling");
        assert_eq!(reason, CaptureCeilingReason::DecodeBudget);
        assert_eq!(seconds, 300);
    }

    #[test]
    fn a_lane_that_declares_both_is_bound_by_the_tighter_one() {
        let limits = ProviderCaptureLimits {
            // 25 MiB ≈ 819 s, against a decode factor allowing 300 s.
            max_audio_bytes: Some(25 * 1024 * 1024),
            realtime_factor: Some(2.0),
            detail: "both".to_string(),
        };
        let (seconds, reason) = ceiling_from_limits(&limits).expect("a bound lane has a ceiling");
        assert_eq!(reason, CaptureCeilingReason::DecodeBudget);
        assert_eq!(seconds, 300);
    }

    #[test]
    fn a_lane_that_declares_nothing_has_no_ceiling_of_its_own() {
        // A provider this build has never seen must not inherit another lane's
        // number; it falls through to the configured maximum.
        assert_eq!(ceiling_from_limits(&ProviderCaptureLimits::unbounded()), None);

        let mut config = AppConfig::default();
        set_profile_provider(&mut config, "some-future-provider");
        let budget = resolve(&config);
        assert_eq!(budget.ceiling_reason, CaptureCeilingReason::ConfiguredMaximum);
        assert_eq!(budget.ceiling_seconds, CONFIGURED_MAX_RECORDING_SECONDS);
    }

    #[test]
    fn the_recommendation_keeps_headroom_under_the_ceiling() {
        let budget = resolve(&AppConfig::default());
        assert!(
            budget.recommended_auto_stop_seconds < budget.ceiling_seconds,
            "the recommendation must leave room: {} vs {}",
            budget.recommended_auto_stop_seconds,
            budget.ceiling_seconds
        );
        assert_eq!(
            budget.ceiling_seconds - budget.recommended_auto_stop_seconds,
            budget.safety_margin_seconds
        );
        // The 720 s default sits under the 738 s recommendation for the free
        // plan, so the shipped default is not itself in the margin.
        assert!(!budget.auto_stop_in_margin);
    }

    #[test]
    fn an_auto_stop_against_the_ceiling_is_flagged_but_allowed() {
        let mut config = AppConfig::default();
        let ceiling = resolve(&config).ceiling_seconds;
        set_profile_auto_stop(&mut config, ceiling);

        let budget = resolve(&config);
        assert_eq!(budget.auto_stop_seconds, ceiling, "still allowed");
        assert!(!budget.auto_stop_clamped, "it is not past the ceiling");
        assert!(budget.auto_stop_in_margin, "but it has no headroom left");
    }

    #[test]
    fn the_margin_is_bounded_at_both_ends() {
        assert_eq!(safety_margin_for(60), 30, "a short ceiling still gets 30 s");
        assert_eq!(safety_margin_for(819), 81);
        assert_eq!(
            safety_margin_for(1_800),
            120,
            "a long ceiling does not lose minutes to the margin"
        );
    }

    #[test]
    fn a_paid_plan_raises_the_ceiling() {
        let mut config = AppConfig::default();
        let free = resolve(&config);

        config.provider_tier = crate::core::providers::groq::GROQ_DEV_TIER_ID.to_string();
        let dev = resolve(&config);

        assert!(
            dev.ceiling_seconds > free.ceiling_seconds,
            "the developer plan buys a longer recording: {} vs {}",
            dev.ceiling_seconds,
            free.ceiling_seconds
        );
        // 100 MiB is past the 30-minute configuration maximum, so that is what
        // binds instead — and the reason has to say so.
        assert_eq!(dev.ceiling_reason, CaptureCeilingReason::ConfiguredMaximum);
    }

    #[test]
    fn an_unknown_plan_falls_back_to_the_default_not_the_largest() {
        let mut config = AppConfig::default();
        config.provider_tier = "enterprise-unlimited".to_string();
        let budget = resolve(&config);
        assert_eq!(budget.ceiling_seconds, 819);
    }

    #[test]
    fn the_default_config_reports_the_upload_ceiling() {
        let config = AppConfig::default();
        let budget = resolve(&config);
        assert_eq!(budget.ceiling_reason, CaptureCeilingReason::ProviderUploadLimit);
        assert_eq!(budget.ceiling_seconds, 819);
        // The 720 s default fits under it and is therefore untouched.
        assert_eq!(budget.auto_stop_seconds, 720);
        assert!(!budget.auto_stop_clamped);
    }

    #[test]
    fn a_configured_value_past_the_ceiling_is_clamped_but_not_rewritten() {
        let mut config = AppConfig::default();
        let profile = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == config.active_text_profile_id)
            .expect("active profile");
        profile.capture = Some(crate::core::config::ProfileCaptureSettings {
            max_recording_seconds: 1_800,
            silence_timeout_seconds: 30,
        });

        let budget = resolve(&config);
        assert_eq!(budget.auto_stop_seconds, budget.ceiling_seconds);
        assert_eq!(budget.configured_auto_stop_seconds, 1_800);
        assert!(budget.auto_stop_clamped);
    }
}
