use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

use super::config::ProcessingMode;
use super::providers::JobKey;

/// Cycle order mirrors AI Models' job list and the in-overlay tap cycler
/// (`MODE_CYCLE` in `OverlayWindow.tsx`; `OverlayGallery.tsx` was folded into
/// `/gallery` by ADR 0055 and this line outlived it by six legs):
/// Auto → Verbatim → Cleanup → Rewrite → Translate → Agent → Prompt Enhance →
/// Auto.
///
/// Translate sits where the drawn mode list puts it, between Rewrite and the
/// assistant, so the cycle keeps reading as the order the modes are ordered by:
/// how far each one moves from the transcript. Seven is not a comfortable cycle
/// length and ADR 0041 says so; the answer to that is the mode-select overlay,
/// not a shorter cycle with modes left out of it.
pub const MODE_CYCLE_ORDER: [ProcessingMode; 7] = [
    ProcessingMode::Auto,
    ProcessingMode::Verbatim,
    ProcessingMode::Cleanup,
    ProcessingMode::Rewrite,
    ProcessingMode::Translate,
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
            "auto_detected": context.auto_detected,
        }),
    );
}

#[derive(Debug, Clone, Serialize)]
pub struct ProcessingContext {
    pub mode: ProcessingMode,
    pub auto_detected: bool,
    pub detected_from: Option<String>,
}

/// Resolves the effective processing mode for a session.
///
/// **The active profile's `work_mode.processing_mode` is the only source.**
///
/// There used to be a second one: a process-global `MODE_OVERRIDE` that the
/// overlay tap cycler and the per-mode hotkeys set, and that outranked the
/// profile. It was set and never cleared — `clear_processing_mode_override`
/// had no caller, because its only consumer, `useProcessingMode.ts`, was
/// imported by nothing but its own test. So the first tap or mode hotkey after
/// a start pinned the mode for the rest of the process: every later change in
/// Settings was written to the profile, resolved away here, and the overlay
/// kept showing the old mode. It was not only cosmetic — the pipeline reads
/// this same resolver, so it also kept *processing* under the stale value.
///
/// Removing it loses nothing, because every path that set it also persisted
/// the mode first (`set_active_profile_processing_mode` writes to disk before
/// it returns), and the pipeline loads the config fresh once the recording has
/// ended. A mode changed mid-recording is therefore already on disk by the time
/// the mode is resolved. The override was a second, invisible copy of a value
/// that was already correct, and the copy outranked the original.
///
/// `Auto` is returned as-is; the pipeline resolves it into a concrete mode once
/// the transcript is available — see [`resolve_auto_mode`].
///
/// The previous workspace-app-mapping layer was removed because browser and
/// IDE detection proved too unreliable to drive deterministic mode selection.
/// Workspace context is still collected and fed into the auto-mode intent
/// detection as a probability signal.
pub fn resolve_processing_mode(profile_mode: ProcessingMode) -> ProcessingContext {
    ProcessingContext {
        auto_detected: profile_mode.is_auto(),
        mode: profile_mode,
        detected_from: None,
    }
}

/// The outcome of the deterministic Auto pass.
///
/// `NeedsClassifier` exists so this function can stay synchronous and pure —
/// its unit tests are the routing contract — while the one LLM call the
/// uncertain zone needs is made by the caller, at the single point that commits
/// to a mode.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AutoRoute {
    Decided {
        mode: ProcessingMode,
        /// Which rule fired, for the runtime log.
        signal: &'static str,
    },
    NeedsClassifier,
}

/// Resolves `Auto` into one concrete processing mode.
///
/// Resolution order, first match wins:
/// 1. agent name addressed with a task (heuristic ≥ certain threshold) → Agent
/// 2. imperative + IDE workspace context → Prompt Enhance
/// 3. heuristic in the uncertain zone → `NeedsClassifier`
/// 4. otherwise → Cleanup
///
/// `Verbatim` and `Rewrite` are deliberately not reachable. Rewrite is a
/// deliberate stylistic choice that must not be guessed. Verbatim was measured
/// as a candidate and rejected: a "nothing to clean" proxy over 75 real
/// transcripts matched 75% of them, yet cleanup still materially changed 54% of
/// those — German verb order, discourse particles, capitalization and internal
/// commas are not detectable without the model, so auto-selecting Verbatim would
/// silently discard real corrections. Both invariants are enforced by tests.
pub fn resolve_auto_mode(
    transcript: &str,
    workspace_category: Option<&str>,
    agent_name: &str,
) -> AutoRoute {
    let agent_score = super::agent::detect_agent_intent_heuristic(transcript, agent_name);
    if agent_score >= super::agent::HEURISTIC_CERTAIN_THRESHOLD {
        return AutoRoute::Decided {
            mode: ProcessingMode::Agent,
            signal: "agent_name_heuristic",
        };
    }

    let is_ide = workspace_category.map(|c| c == "ide").unwrap_or(false);
    if is_ide && super::agent::text_starts_with_imperative(transcript) {
        return AutoRoute::Decided {
            mode: ProcessingMode::PromptEnhance,
            signal: "imperative_in_ide",
        };
    }

    if agent_score >= super::agent::HEURISTIC_UNCERTAIN_THRESHOLD {
        return AutoRoute::NeedsClassifier;
    }

    AutoRoute::Decided {
        mode: ProcessingMode::Cleanup,
        signal: "default_cleanup",
    }
}

/// Persists the processing mode into the active profile's work_mode and saves
/// to disk. Used by the overlay cycle so that a mode change sticks across
/// sessions.
///
/// Emits `ready` so the Settings window picks up the change, and a
/// `wordscript-mode-event` so the overlay does — the write is the only thing
/// that makes the change effective, so every writer owes both signals.
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
        let mut config = super::config::AppConfig::load_from_disk_within_lock();

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

    // Both signals, from the one place that changed the mode. `ready` carries
    // the whole config for the Settings form; the mode event is what the
    // overlay listens on. Emitting only the first left the overlay depending on
    // a config-identity side effect, which is how it fell out of sync.
    super::config::emit_ready_event(&app, &config);
    emit_mode_event(&app, &resolve_processing_mode(parsed));

    Ok(config.without_secrets())
}

/// Cycles the active profile's Translate target language, and persists it.
///
/// Its own command rather than a `save_config` from the overlay, for the reason
/// the mode cycle has one: the overlay holds no config draft, so a
/// read-modify-write from there would send back whatever snapshot it happened
/// to be holding and clobber a concurrent settings save. Under the file lock,
/// this reads and writes one field.
///
/// The step is `+1` through `TRANSLATE_LANGUAGES` in its declared order, which
/// is the order the two selects draw. An unknown stored value lands on the
/// first entry rather than refusing, which is the same permissive rule the rest
/// of the translate settings follow.
#[tauri::command]
pub fn cycle_active_profile_translate_language<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<super::config::AppConfig, String> {
    let config = super::config::with_config_file_lock(|| {
        let mut config = super::config::AppConfig::load_from_disk_within_lock();
        let active_id = config.active_text_profile_id.clone();

        let Some(profile) = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
        else {
            return Err("No active text profile found.".to_string());
        };

        let modes = profile.modes.get_or_insert_with(Default::default);
        modes.translate_target_language = next_translate_language(&modes.translate_target_language);

        config.save_to_disk()?;
        Ok::<super::config::AppConfig, String>(config)
    })??;

    // The config event only. There is no mode event to emit: the mode did not
    // change, and a mode event that says the same mode twice is a signal every
    // listener has to learn to ignore.
    super::config::emit_ready_event(&app, &config);

    Ok(config.without_secrets())
}

fn next_translate_language(current: &str) -> String {
    let languages = super::config::TRANSLATE_LANGUAGES;
    let normalized = super::config::normalize_translate_language(current);
    let index = languages
        .iter()
        .position(|(code, _)| *code == normalized)
        .unwrap_or(0);
    languages[(index + 1) % languages.len()].0.to_string()
}

/// The active profile's mode as a resolved `ProcessingContext`. This is the seam
/// the frontend uses to know which mode a dictation will actually run in.
///
/// Priority:
/// 1. Active profile work-mode (`work_mode.processing_mode`)
/// 2. Global `config.processing_mode` (serde fallback for pre-migration configs)
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

    Ok(resolve_processing_mode(profile_mode))
}

fn is_known_processing_mode(value: &str) -> bool {
    matches!(
        value,
        "auto" | "cleanup" | "rewrite" | "translate" | "agent" | "prompt_enhance" | "verbatim"
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

    resolve_processing_mode(profile_mode)
}

/// Persists the processing mode into the active profile's work_mode, saves to
/// disk and emits both sync signals. Used by the global mode-select and
/// per-mode hotkeys — persistent, identical to the overlay tap cycler so every
/// mode-change path survives a restart.
pub fn set_mode_and_emit<R: Runtime>(
    app: &AppHandle<R>,
    mode: ProcessingMode,
) -> Result<ProcessingContext, String> {
    set_active_profile_processing_mode(app.clone(), mode.as_str().to_string())?;
    Ok(resolve_current_processing_mode_sync())
}

/// WHICH TRANSFORM A CONCRETE MODE RUNS, and it is one answer for every caller
/// (ADR 0075).
///
/// It lived inline in the native pipeline, which meant the pipeline was the
/// only thing that could route by mode. The history retry could not, so a
/// retried Agent, Prompt Enhance or Translate record came back as a
/// conservative cleanup — the transform was re-run through
/// `apply_native_transform` for every mode, and three of the seven do not go
/// through it at all.
///
/// `mode` must already be concrete. `Auto` is resolved exactly once per
/// session, upstream, and re-deciding it here would be the second
/// classification ADR 0020 forbids — so it falls to the cleanup family rather
/// than reaching for the classifier, and the caller is expected not to hand it
/// one.
///
/// The result is NOT finalized: `finalize_with_text_rules` is the single exit
/// every mode passes through afterwards, and keeping it outside this function
/// is what stops a branch from bypassing the profile's dictionary.
pub async fn apply_mode_transform(
    text: &str,
    mode: &ProcessingMode,
    config: &super::transform::NativeTransformConfig,
    app_config: &super::config::AppConfig,
    active_profile: Option<&super::config::TextProfile>,
) -> super::transform::NativeTransformResult {
    // The chat model, not the correction model. Agent, Translate and Prompt
    // Enhance are instruction-following jobs and are explicitly not on the
    // fastest path (ADR 0041, ADR 0042).
    //
    // **Each arm names its own job** (ADR 0094). It is not derived from the
    // mode by a second mapping: the arm already knows which job it is running,
    // and a lookup beside the match is a place for the two to disagree. The
    // model follows the job's vendor rather than one connection, because the
    // local lane names its models differently from every cloud one.
    let chat_model = |job: JobKey| {
        if config.providers.resolve(job).provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID {
            app_config.local_agent_model.clone()
        } else {
            app_config.agent_model.clone()
        }
    };

    match mode {
        ProcessingMode::Agent => {
            let agent_config = super::agent::AgentConfig {
                provider: config.providers.resolve(JobKey::Assistant).provider,
                agent_name: config.agent_name.clone(),
                agent_model: chat_model(JobKey::Assistant),
                profile_label: config.profile_label.clone(),
                profile_prompt: config.profile_prompt.clone(),
                vocabulary: config.vocabulary.clone(),
                dictionary_entries: config.dictionary_entries.clone(),
                snippet_entries: config.snippet_entries.clone(),
                workspace_context: config.workspace_hint.clone(),
                style: config.style.clone(),
            };
            // No second classification. Reaching this arm already means the
            // mode is Agent: either the user selected it, or Auto committed to
            // it upstream.
            let result = super::agent::apply_agent_transform(text, &agent_config).await;
            super::transform::NativeTransformResult {
                text: result.text,
                corrected: result.was_agent,
                applied_rules: vec!["agent_mode".to_string()],
                warning: result.warning,
            }
        }
        ProcessingMode::Translate => {
            let translate_config = super::translate::TranslateConfig {
                provider: config.providers.resolve(JobKey::Translate).provider,
                model: chat_model(JobKey::Translate),
                settings: config.translate.clone(),
                profile_prompt: config.profile_prompt.clone(),
                vocabulary: config.vocabulary.clone(),
            };
            let result = super::translate::apply_translate(text, &translate_config).await;
            super::transform::NativeTransformResult {
                text: result.text,
                corrected: result.translated,
                applied_rules: vec!["translate_mode".to_string()],
                warning: result.warning,
            }
        }
        ProcessingMode::PromptEnhance => {
            let enhance_sub_mode = active_profile
                .and_then(|profile| profile.work_mode.enhance_sub_mode.clone())
                .or(app_config.enhance_sub_mode.clone())
                .unwrap_or_default();
            let enhance_target = active_profile
                .and_then(|profile| profile.work_mode.target.clone())
                .or(Some(app_config.enhance_target.clone()))
                .unwrap_or_default();
            let enhance_config = super::prompt_enhance::PromptEnhanceConfig {
                provider: config.providers.resolve(JobKey::Enhance).provider,
                model: chat_model(JobKey::Enhance),
                sub_mode: enhance_sub_mode.as_str().to_string(),
                target: enhance_target.as_str().to_string(),
                profile_prompt: config.profile_prompt.clone(),
                vocabulary: config.vocabulary.clone(),
                workspace_context: config.workspace_hint.clone(),
            };
            let result =
                super::prompt_enhance::apply_prompt_enhance(text, &enhance_config).await;
            super::transform::NativeTransformResult {
                text: result.text,
                corrected: result.enhanced,
                applied_rules: vec!["prompt_enhance".to_string()],
                warning: result.warning,
            }
        }
        _ => super::transform::apply_native_transform(text, config.clone()).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Superseded `manual_override_wins_over_profile_default` and the four
    /// override lifecycle tests. They asserted a second source of truth that
    /// nothing ever cleared — the mechanism that made a settings change
    /// invisible in the overlay for the rest of the process.
    #[test]
    fn the_profile_mode_is_the_resolved_mode() {
        for mode in MODE_CYCLE_ORDER {
            let result = resolve_processing_mode(mode);
            assert_eq!(result.mode, mode);
        }
    }

    #[test]
    fn auto_profile_default_reports_auto_detected() {
        let result = resolve_processing_mode(ProcessingMode::Auto);
        assert_eq!(result.mode, ProcessingMode::Auto);
        assert!(result.auto_detected);
    }

    #[test]
    fn concrete_profile_default_not_auto_detected() {
        let result = resolve_processing_mode(ProcessingMode::Cleanup);
        assert_eq!(result.mode, ProcessingMode::Cleanup);
        assert!(!result.auto_detected);
    }

    // Helper: the concrete mode an Auto resolution commits to, treating the
    // uncertain zone as the classifier's job (it is exercised separately).
    fn decided(transcript: &str, category: Option<&str>) -> AutoRoute {
        resolve_auto_mode(transcript, category, "WordScript")
    }

    #[test]
    fn resolve_auto_mode_detects_agent_when_name_at_start() {
        assert_eq!(
            decided("WordScript schreib eine E-Mail an Joe", None),
            AutoRoute::Decided {
                mode: ProcessingMode::Agent,
                signal: "agent_name_heuristic"
            }
        );
    }

    #[test]
    fn resolve_auto_mode_detects_prompt_enhance_in_ide() {
        assert_eq!(
            decided("Schreib mir eine Schleife und vereinfache sie", Some("ide")),
            AutoRoute::Decided {
                mode: ProcessingMode::PromptEnhance,
                signal: "imperative_in_ide"
            }
        );
    }

    #[test]
    fn resolve_auto_mode_falls_back_to_cleanup() {
        assert_eq!(
            decided("Ich wollte mal fragen ob wir uns morgen treffen", None),
            AutoRoute::Decided {
                mode: ProcessingMode::Cleanup,
                signal: "default_cleanup"
            }
        );
    }

    #[test]
    fn resolve_auto_mode_does_not_route_to_prompt_enhance_without_ide() {
        // An imperative outside an IDE is dictation, not a prompt. It scores in
        // the uncertain zone, so the classifier decides rather than the heuristic.
        assert_eq!(
            decided("Schreib mir eine Schleife", Some("browser")),
            AutoRoute::NeedsClassifier
        );
    }

    #[test]
    fn resolve_auto_mode_defers_to_the_classifier_in_the_uncertain_zone() {
        let route = decided("Kannst du mir das nochmal zusammenfassen", None);
        assert_eq!(route, AutoRoute::NeedsClassifier);
    }

    #[test]
    fn a_concrete_mode_never_enters_the_auto_resolution() {
        // The structural half of "one decision, one commit point": only `Auto`
        // reaches `resolve_auto_mode`, so a mode the user picked — Agent included
        // — cannot be re-decided by the classifier. The Agent branch used to run
        // `detect_agent_intent` a second time and silently degrade a manually
        // selected Agent dictation into a cleanup.
        for mode in [
            ProcessingMode::Verbatim,
            ProcessingMode::Cleanup,
            ProcessingMode::Rewrite,
            ProcessingMode::Agent,
            ProcessingMode::PromptEnhance,
        ] {
            let resolved = resolve_processing_mode(mode);
            assert_eq!(resolved.mode, mode);
            assert!(
                !resolved.mode.is_auto(),
                "{} would fall into the Auto branch",
                mode.as_str()
            );
            assert!(!resolved.auto_detected);
        }
    }

    #[test]
    fn auto_never_resolves_to_verbatim_or_rewrite() {
        // The invariant, enforced rather than merely documented. Verbatim was
        // measured as a candidate and rejected (54% of "clean-looking"
        // transcripts are still materially corrected); Rewrite is a deliberate
        // stylistic choice. Neither may be guessed.
        let transcripts = [
            "",
            "ja",
            "Danke.",
            "Kurz und knapp.",
            "WordScript schreib eine E-Mail an Joe",
            "Schreib mir eine Schleife und vereinfache sie",
            "Ich wollte mal fragen ob wir uns morgen treffen",
            "äh also ähm ich glaube das passt so",
            "okay das finde ich sehr interessant das sollten wir dokumentieren",
            "Bitte korrigier das und mach es professioneller.",
        ];
        let categories = [None, Some("ide"), Some("browser"), Some("chat"), Some("terminal")];

        for transcript in transcripts {
            for category in categories {
                if let AutoRoute::Decided { mode, .. } = decided(transcript, category) {
                    assert!(
                        mode != ProcessingMode::Verbatim && mode != ProcessingMode::Rewrite,
                        "Auto resolved to {} for transcript={transcript:?} category={category:?}",
                        mode.as_str()
                    );
                }
            }
        }
    }

    /// The cycle is `+1` through the declared order and it wraps. Its whole
    /// job is being predictable from the surface that draws the same order.
    #[test]
    fn the_translate_language_cycle_steps_and_wraps() {
        assert_eq!(next_translate_language("en"), "de");
        assert_eq!(next_translate_language("de"), "fr");
        assert_eq!(
            next_translate_language(super::super::config::TRANSLATE_LANGUAGES.last().unwrap().0),
            "en"
        );
    }

    /// A stored value nothing recognises must still step rather than refuse,
    /// which is the rule the rest of the translate settings follow.
    #[test]
    fn an_unknown_stored_language_still_steps() {
        assert_eq!(next_translate_language("klingon"), "de");
        assert_eq!(next_translate_language(""), "de");
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
                ProcessingMode::Translate,
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
            ProcessingMode::Translate
        );
        assert_eq!(
            next_mode_in_cycle(ProcessingMode::Translate),
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