use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

use super::config::ProcessingMode;

static MODE_OVERRIDE: Mutex<Option<ProcessingMode>> = Mutex::new(None);

/// Cycle order mirrors Settings → Modes and the in-overlay tap cycler
/// (`MODE_CYCLE` in OverlayWindow.tsx / OverlayGallery.tsx):
/// Auto → Verbatim → Cleanup → Rewrite → Agent → Prompt Enhance → Auto.
pub const MODE_CYCLE_ORDER: [ProcessingMode; 6] = [
    ProcessingMode::Auto,
    ProcessingMode::Verbatim,
    ProcessingMode::Cleanup,
    ProcessingMode::Rewrite,
    ProcessingMode::Agent,
    ProcessingMode::PromptEnhance,
];

/// Returns the next mode in the cycle after `current`. Falls back to the
/// first entry (Auto) when `current` is not found in the cycle array.
pub fn next_mode_in_cycle(current: ProcessingMode) -> ProcessingMode {
    let index = MODE_CYCLE_ORDER
        .iter()
        .position(|mode| *mode == current)
        .unwrap_or(0);
    let next_index = (index + 1) % MODE_CYCLE_ORDER.len();
    MODE_CYCLE_ORDER[next_index]
}

/// Emits a `wordscript-mode-event` so every overlay / settings listener can
/// re-fetch the effective mode after a hotkey-driven mode change. The payload
/// matches the frontend `ProcessingModeEvent` shape.
pub fn emit_mode_event<R: Runtime>(app: &AppHandle<R>, context: &ProcessingContext) {
    let _ = app.emit(
        "wordscript-mode-event",
        serde_json::json!({
            "mode": context.mode.as_str(),
            "is_override": context.is_override,
            "auto_detected": context.auto_detected,
        }),
    );
}

#[derive(Debug, Clone, Serialize)]
pub struct ProcessingContext {
    pub mode: ProcessingMode,
    pub is_override: bool,
    pub auto_detected: bool,
    pub detected_from: Option<String>,
}

/// Resolves the effective processing mode for a session.
///
/// Priority:
/// 1. Manual override (set via the overlay cycle or a per-mode hotkey)
/// 2. Profile default (or global fallback)
///
/// `Auto` is returned as-is when no override is set and the profile default is
/// `Auto`. The pipeline is responsible for resolving `Auto` into a concrete
/// mode once the transcript is available — see [`resolve_auto_mode`].
///
/// The previous workspace-app-mapping layer was removed because browser and
/// IDE detection proved too unreliable to drive deterministic mode selection.
/// Workspace context is still collected and fed into the auto-mode intent
/// detection as a probability signal.
pub fn resolve_processing_mode(
    profile_mode: ProcessingMode,
    manual_override: Option<ProcessingMode>,
) -> ProcessingContext {
    if let Some(override_mode) = manual_override {
        return ProcessingContext {
            mode: override_mode,
            is_override: true,
            auto_detected: false,
            detected_from: None,
        };
    }

    ProcessingContext {
        mode: profile_mode.clone(),
        is_override: false,
        auto_detected: profile_mode.is_auto(),
        detected_from: None,
    }
}

/// Resolves `Auto` into a concrete processing mode using the transcript text
/// and optional workspace context as signals.
///
/// When the effective mode is already concrete, it is returned unchanged.
///
/// Detection signals (in priority order):
/// 1. Agent-name + imperative verb → Agent
/// 2. Imperative + IDE workspace context → Prompt Enhance
/// 3. Otherwise → Cleanup (the safe default)
///
/// This is a deterministic first pass. The agent intent detection in
/// `agent.rs` runs a second, LLM-backed classifier in the uncertain zone
/// before the agent transform actually executes.
pub fn resolve_auto_mode(
    effective_mode: ProcessingMode,
    transcript: &str,
    workspace_category: Option<&str>,
    agent_name: &str,
) -> ProcessingMode {
    if !effective_mode.is_auto() {
        return effective_mode;
    }

    let agent_score = super::agent::detect_agent_intent_heuristic(transcript, agent_name);
    if agent_score >= super::agent::HEURISTIC_CERTAIN_THRESHOLD {
        return ProcessingMode::Agent;
    }

    let is_ide = workspace_category.map(|c| c == "ide").unwrap_or(false);
    let has_imperative = super::agent::text_starts_with_imperative(transcript);

    if has_imperative && is_ide {
        return ProcessingMode::PromptEnhance;
    }

    // Default safe fallback for Auto mode.
    ProcessingMode::Cleanup
}

// Validation helper for the mode-conflict UI; exercised by unit tests.
#[allow(dead_code)]
pub fn is_invalid_mode_combination(mode_a: &ProcessingMode, mode_b: &ProcessingMode) -> bool {
    matches!(
        (mode_a, mode_b),
        (ProcessingMode::Verbatim, ProcessingMode::Agent)
            | (ProcessingMode::Verbatim, ProcessingMode::PromptEnhance)
            | (ProcessingMode::Agent, ProcessingMode::Verbatim)
            | (ProcessingMode::PromptEnhance, ProcessingMode::Verbatim)
    )
}

#[tauri::command]
pub fn set_processing_mode_override(mode: String) -> Result<(), String> {
    let parsed = ProcessingMode::from_str(&mode);
    // `from_str` falls back to Cleanup for unknown values. Detect that fallback
    // and reject so the frontend gets a clear error for typos.
    if parsed == ProcessingMode::Cleanup && !is_known_processing_mode(&mode) {
        return Err(format!("Unknown processing mode: {}", mode));
    }
    let mut override_lock = MODE_OVERRIDE.lock().map_err(|e| e.to_string())?;
    *override_lock = Some(parsed);
    Ok(())
}

#[tauri::command]
pub fn clear_processing_mode_override() -> Result<(), String> {
    let mut override_lock = MODE_OVERRIDE.lock().map_err(|e| e.to_string())?;
    *override_lock = None;
    Ok(())
}

pub fn current_mode_override() -> Option<ProcessingMode> {
    MODE_OVERRIDE.lock().ok().and_then(|guard| guard.clone())
}

/// Persists the processing mode into the active profile's work_mode and saves
/// to disk. Used by the overlay cycle so that a mode change sticks across
/// sessions instead of being a transient runtime override.
///
/// Also sets a runtime override so the change takes effect immediately for an
/// in-flight session without waiting for the next config load, and emits a
/// `ready` event so the Settings window picks up the change.
#[tauri::command]
pub fn set_active_profile_processing_mode<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    mode: String,
) -> Result<super::config::AppConfig, String> {
    let parsed = ProcessingMode::from_str(&mode);
    if parsed == ProcessingMode::Cleanup && !is_known_processing_mode(&mode) {
        return Err(format!("Unknown processing mode: {}", mode));
    }

    // read-modify-write under the config file lock so a concurrent save_config
    // (frontend writing e.g. insert_behavior) cannot be clobbered by this
    // command writing back a stale snapshot it read first. Without this, the
    // mode hotkey racing a settings save reverted the user's insert_behavior.
    let config = super::config::with_config_file_lock(|| {
        let mut config = super::config::AppConfig::load_from_disk();

        // Update the active profile's work_mode.
        if let Some(profile) = config
            .text_profiles
            .iter_mut()
            .find(|p| p.id == config.active_text_profile_id)
        {
            profile.work_mode.processing_mode = parsed.clone();
        } else {
            return Err("No active text profile found.".to_string());
        }

        // Also update the global fallback so it stays in sync.
        config.processing_mode = parsed.clone();

        config.save_to_disk()?;
        Ok::<super::config::AppConfig, String>(config)
    })??;

    // Set a runtime override so the change is immediate for an in-flight
    // session (the next transcription picks it up without a config reload).
    let mut override_lock = MODE_OVERRIDE.lock().map_err(|e| e.to_string())?;
    *override_lock = Some(parsed);

    // Emit a ready event so the Settings window syncs its form.
    super::config::emit_ready_event(&app, &config);

    Ok(config.without_secrets())
}

/// Joins the active profile's mode and any manual override into a single
/// resolved `ProcessingContext`. This is the seam the frontend uses to know
/// which mode a dictation will actually run in.
///
/// Priority:
/// 1. Manual override (set via the overlay cycle or a per-mode hotkey)
/// 2. Active profile work-mode (`work_mode.processing_mode`)
/// 3. Global `config.processing_mode` (serde fallback for pre-migration configs)
///
/// The Modes tab writes the mode into the active profile's work_mode, so the
/// profile is the primary control surface. The global field is only a
/// fallback for very old configs that predate per-profile modes.
///
/// Note: when the resolved mode is `Auto`, the concrete mode is not yet known
/// — it is resolved per-transcription in the pipeline once the transcript text
/// is available. The frontend receives `auto_detected: true` in that case.
#[tauri::command]
pub async fn resolve_current_processing_mode() -> Result<ProcessingContext, String> {
    let config = super::config::AppConfig::load_from_disk();

    let profile_mode = config
        .text_profiles
        .iter()
        .find(|profile| profile.id == config.active_text_profile_id)
        .map(|profile| profile.work_mode.effective_processing_mode())
        .unwrap_or_else(|| config.processing_mode.clone());

    let manual_override = current_mode_override();

    Ok(resolve_processing_mode(profile_mode, manual_override))
}

fn is_known_processing_mode(value: &str) -> bool {
    matches!(
        value,
        "auto" | "cleanup" | "rewrite" | "agent" | "prompt_enhance" | "verbatim"
    )
}

/// Synchronous variant of `resolve_current_processing_mode` for use inside
/// the global-shortcut handler (which must not be async). Returns the same
/// `ProcessingContext` the async IPC command would.
pub fn resolve_current_processing_mode_sync() -> ProcessingContext {
    let config = super::config::AppConfig::load_from_disk();

    let profile_mode = config
        .text_profiles
        .iter()
        .find(|profile| profile.id == config.active_text_profile_id)
        .map(|profile| profile.work_mode.effective_processing_mode())
        .unwrap_or_else(|| config.processing_mode.clone());

    let manual_override = current_mode_override();

    resolve_processing_mode(profile_mode, manual_override)
}

/// Persists the processing mode into the active profile's work_mode, saves to
/// disk, sets a runtime override for in-flight sessions, and emits a
/// `wordscript-mode-event` so the overlay / settings sync immediately. Used by
/// the global mode-select and per-mode hotkeys — persistent, identical to the
/// overlay tap cycler so every mode-change path survives a restart.
pub fn set_mode_override_and_emit<R: Runtime>(
    app: &AppHandle<R>,
    mode: ProcessingMode,
) -> Result<ProcessingContext, String> {
    set_active_profile_processing_mode(app.clone(), mode.as_str().to_string())?;

    let context = resolve_current_processing_mode_sync();
    emit_mode_event(app, &context);
    Ok(context)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manual_override_wins_over_profile_default() {
        let result = resolve_processing_mode(
            ProcessingMode::Rewrite,
            Some(ProcessingMode::Verbatim),
        );
        assert_eq!(result.mode, ProcessingMode::Verbatim);
        assert!(result.is_override);
        assert!(!result.auto_detected);
    }

    #[test]
    fn auto_profile_default_reports_auto_detected() {
        let result = resolve_processing_mode(ProcessingMode::Auto, None);
        assert_eq!(result.mode, ProcessingMode::Auto);
        assert!(!result.is_override);
        assert!(result.auto_detected);
    }

    #[test]
    fn concrete_profile_default_not_auto_detected() {
        let result = resolve_processing_mode(ProcessingMode::Cleanup, None);
        assert_eq!(result.mode, ProcessingMode::Cleanup);
        assert!(!result.is_override);
        assert!(!result.auto_detected);
    }

    #[test]
    fn invalid_combination_verbatim_and_agent_is_detected() {
        assert!(is_invalid_mode_combination(
            &ProcessingMode::Verbatim,
            &ProcessingMode::Agent
        ));
        assert!(is_invalid_mode_combination(
            &ProcessingMode::Agent,
            &ProcessingMode::Verbatim
        ));
    }

    #[test]
    fn invalid_combination_verbatim_and_prompt_enhance_is_detected() {
        assert!(is_invalid_mode_combination(
            &ProcessingMode::Verbatim,
            &ProcessingMode::PromptEnhance
        ));
        assert!(is_invalid_mode_combination(
            &ProcessingMode::PromptEnhance,
            &ProcessingMode::Verbatim
        ));
    }

    #[test]
    fn valid_combinations_are_not_flagged_invalid() {
        assert!(!is_invalid_mode_combination(
            &ProcessingMode::Agent,
            &ProcessingMode::PromptEnhance
        ));
        assert!(!is_invalid_mode_combination(
            &ProcessingMode::Rewrite,
            &ProcessingMode::Agent
        ));
        assert!(!is_invalid_mode_combination(
            &ProcessingMode::Rewrite,
            &ProcessingMode::Rewrite
        ));
    }

    #[test]
    fn override_cleared_after_clear() {
        let _ = set_processing_mode_override("agent".to_string());
        assert_eq!(current_mode_override(), Some(ProcessingMode::Agent));
        let _ = clear_processing_mode_override();
        assert_eq!(current_mode_override(), None);
    }

    #[test]
    fn set_processing_mode_override_rejects_unknown_mode() {
        let result = set_processing_mode_override("invalid_mode".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn set_processing_mode_override_accepts_auto() {
        let result = set_processing_mode_override("auto".to_string());
        assert!(result.is_ok());
        assert_eq!(current_mode_override(), Some(ProcessingMode::Auto));
        let _ = clear_processing_mode_override();
    }

    #[test]
    fn set_processing_mode_override_accepts_aliases() {
        let result = set_processing_mode_override("polished".to_string());
        assert!(result.is_ok());
        assert_eq!(current_mode_override(), Some(ProcessingMode::Rewrite));
        let _ = clear_processing_mode_override();
    }

    #[test]
    fn resolve_auto_mode_passes_through_concrete_mode() {
        assert_eq!(
            resolve_auto_mode(ProcessingMode::Verbatim, "hello", None, "WordScript"),
            ProcessingMode::Verbatim
        );
        assert_eq!(
            resolve_auto_mode(ProcessingMode::Cleanup, "hello", None, "WordScript"),
            ProcessingMode::Cleanup
        );
    }

    #[test]
    fn resolve_auto_mode_detects_agent_when_name_at_start() {
        let mode = resolve_auto_mode(
            ProcessingMode::Auto,
            "WordScript schreib eine E-Mail an Joe",
            None,
            "WordScript",
        );
        assert_eq!(mode, ProcessingMode::Agent);
    }

    #[test]
    fn resolve_auto_mode_detects_prompt_enhance_in_ide() {
        let mode = resolve_auto_mode(
            ProcessingMode::Auto,
            "Schreib mir eine Schleife und vereinfache sie",
            Some("ide"),
            "WordScript",
        );
        assert_eq!(mode, ProcessingMode::PromptEnhance);
    }

    #[test]
    fn resolve_auto_mode_falls_back_to_cleanup() {
        let mode = resolve_auto_mode(
            ProcessingMode::Auto,
            "Ich wollte mal fragen ob wir uns morgen treffen",
            None,
            "WordScript",
        );
        assert_eq!(mode, ProcessingMode::Cleanup);
    }

    #[test]
    fn resolve_auto_mode_does_not_route_to_prompt_enhance_without_ide() {
        let mode = resolve_auto_mode(
            ProcessingMode::Auto,
            "Schreib mir eine Schleife",
            Some("browser"),
            "WordScript",
        );
        assert_eq!(mode, ProcessingMode::Cleanup);
    }

    #[test]
    fn cycle_order_matches_settings_modes_tab() {
        assert_eq!(
            MODE_CYCLE_ORDER,
            [
                ProcessingMode::Auto,
                ProcessingMode::Verbatim,
                ProcessingMode::Cleanup,
                ProcessingMode::Rewrite,
                ProcessingMode::Agent,
                ProcessingMode::PromptEnhance,
            ]
        );
    }

    #[test]
    fn next_mode_in_cycle_wraps_around() {
        assert_eq!(
            next_mode_in_cycle(ProcessingMode::Auto),
            ProcessingMode::Verbatim
        );
        assert_eq!(
            next_mode_in_cycle(ProcessingMode::Verbatim),
            ProcessingMode::Cleanup
        );
        assert_eq!(
            next_mode_in_cycle(ProcessingMode::Cleanup),
            ProcessingMode::Rewrite
        );
        assert_eq!(
            next_mode_in_cycle(ProcessingMode::Rewrite),
            ProcessingMode::Agent
        );
        assert_eq!(
            next_mode_in_cycle(ProcessingMode::Agent),
            ProcessingMode::PromptEnhance
        );
        // Last entry wraps back to Auto.
        assert_eq!(
            next_mode_in_cycle(ProcessingMode::PromptEnhance),
            ProcessingMode::Auto
        );
    }
}