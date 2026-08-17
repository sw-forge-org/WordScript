use super::contracts::{
    CompleteCaptureRequest, InsertMode, SliceCapabilities, SliceCaptureRuntimeStatus,
    SliceInsertionPlan, SliceLocalContract, SliceLocalProviderSetupContract,
    SlicePipelineState, SlicePipelineStep, SlicePipelineStepStatus, SliceProviderRuntimeStatus,
    SliceResult, SliceRuntimeContract, SliceStage, SliceStatus, SliceTranscript,
    StartCaptureRequest,
};
use std::time::Instant;
use tauri::{AppHandle, Runtime};

use crate::core::{
    capture::{self, NativeCaptureStatus},
    config::{default_speech_model, normalize_local_profile_id, AppConfig},
    providers::{
        self, groq, JobKey, LocalProviderIssueCode, LocalProviderReadiness,
        LocalProviderSetupStatus, ProviderCommandError, ProviderStatus, ProviderStatusRequest,
        LOCAL_PROVIDER_ID,
    },
};

#[derive(Debug, Clone)]
struct ActiveSession {
    id: String,
    trigger: String,
}

#[derive(Debug, Default)]
pub struct V1SliceState {
    session_counter: u64,
    stage: SliceStage,
    active_session: Option<ActiveSession>,
    last_session_id: Option<String>,
    last_transcript: Option<SliceTranscript>,
    last_insert_target: Option<String>,
    last_error: Option<String>,
    capture_started_at: Option<Instant>,
    pipeline: Vec<SlicePipelineStepStatus>,
}

impl V1SliceState {
    #[cfg(test)]
    pub fn status(&self) -> SliceStatus {
        let runtime_contract = test_runtime_contract();
        self.status_with_runtime(runtime_contract)
    }

    pub fn status_with_runtime(&self, runtime_contract: SliceRuntimeContract) -> SliceStatus {
        let cloud_transcription = runtime_contract.provider != LOCAL_PROVIDER_ID;
        let local_transcription = runtime_contract.provider == LOCAL_PROVIDER_ID;

        SliceStatus {
            stage: self.stage.clone(),
            session_id: self.last_session_id.clone(),
            active_trigger: self
                .active_session
                .as_ref()
                .map(|session| session.trigger.clone()),
            preferred_provider: runtime_contract.provider_profile.clone(),
            architecture_mode: "native-rebuild-slice".to_string(),
            runtime_contract,
            last_transcript: self
                .last_transcript
                .as_ref()
                .map(|transcript| transcript.final_text.clone()),
            last_insert_target: self.last_insert_target.clone(),
            last_error: self.last_error.clone(),
            pipeline: if self.pipeline.is_empty() {
                default_pipeline_statuses()
            } else {
                self.pipeline.clone()
            },
            capabilities: SliceCapabilities {
                cloud_transcription,
                local_transcription,
                insertion_fallback: true,
                typed_contracts: true,
                rebuild_lab: true,
            },
            next_milestones: vec![
                "native global hotkey".to_string(),
                "native audio capture".to_string(),
                "real insertion adapters".to_string(),
                "cloud provider retries and timeouts".to_string(),
            ],
        }
    }

    #[cfg(test)]
    pub fn reset(&mut self) -> SliceStatus {
        let runtime_contract = test_runtime_contract();
        self.reset_with_runtime(runtime_contract)
    }

    pub fn reset_with_runtime(&mut self, runtime_contract: SliceRuntimeContract) -> SliceStatus {
        self.stage = SliceStage::Idle;
        self.active_session = None;
        self.last_session_id = None;
        self.last_transcript = None;
        self.last_insert_target = None;
        self.last_error = None;
        self.capture_started_at = None;
        self.pipeline = default_pipeline_statuses();
        self.status_with_runtime(runtime_contract)
    }

    #[cfg(test)]
    pub fn start_capture(&mut self, request: StartCaptureRequest) -> Result<SliceStatus, String> {
        let runtime_contract = test_runtime_contract();
        self.start_capture_with_runtime(request, runtime_contract)
    }

    pub fn start_capture_with_runtime(
        &mut self,
        request: StartCaptureRequest,
        runtime_contract: SliceRuntimeContract,
    ) -> Result<SliceStatus, String> {
        if self.active_session.is_some() {
            return Err("A capture session is already active.".to_string());
        }

        let trigger = request.trigger.trim();
        if trigger.is_empty() {
            return Err("Trigger must not be empty.".to_string());
        }

        self.session_counter += 1;
        let session_id = format!("slice-{}", self.session_counter);
        self.active_session = Some(ActiveSession {
            id: session_id.clone(),
            trigger: trigger.to_string(),
        });
        self.last_session_id = Some(session_id);
        self.last_error = None;
        self.capture_started_at = Some(Instant::now());
        self.pipeline = vec![
            pipeline_step(
                SlicePipelineStep::Capture,
                SlicePipelineState::Running,
                None,
                None,
                Some(format!("Listening for live audio via {}.", trigger)),
            ),
            pipeline_step(
                SlicePipelineStep::Provider,
                SlicePipelineState::Idle,
                None,
                None,
                None,
            ),
            pipeline_step(
                SlicePipelineStep::Transform,
                SlicePipelineState::Idle,
                None,
                None,
                None,
            ),
            pipeline_step(
                SlicePipelineStep::Insert,
                SlicePipelineState::Idle,
                None,
                None,
                None,
            ),
        ];
        self.stage = SliceStage::Capturing;

        Ok(self.status_with_runtime(runtime_contract))
    }

    #[cfg(test)]
    pub fn complete_capture(
        &mut self,
        request: CompleteCaptureRequest,
    ) -> Result<SliceResult, String> {
        let runtime_contract = test_runtime_contract();
        self.complete_capture_with_runtime(request, runtime_contract)
    }

    pub fn complete_capture_with_runtime(
        &mut self,
        request: CompleteCaptureRequest,
        runtime_contract: SliceRuntimeContract,
    ) -> Result<SliceResult, String> {
        let active_session = self
            .active_session
            .clone()
            .ok_or_else(|| "No active capture session. Start capture first.".to_string())?;

        let raw_text = request.raw_text.trim();
        let capture_duration_ms = self.capture_started_at.take().map(elapsed_ms);
        if raw_text.is_empty() {
            self.pipeline =
                vec![
                pipeline_step(
                    SlicePipelineStep::Capture,
                    SlicePipelineState::Completed,
                    capture_duration_ms,
                    None,
                    Some("Capture stopped, but the diagnostic request carried no raw transcript."
                        .to_string()),
                ),
                pipeline_step(
                    SlicePipelineStep::Provider,
                    SlicePipelineState::Failed,
                    None,
                    Some("empty_raw_text".to_string()),
                    Some("Raw text must not be empty.".to_string()),
                ),
                pipeline_step(
                    SlicePipelineStep::Transform,
                    SlicePipelineState::Skipped,
                    None,
                    None,
                    Some("Provider stage did not yield text for transform.".to_string()),
                ),
                pipeline_step(
                    SlicePipelineStep::Insert,
                    SlicePipelineState::Skipped,
                    None,
                    None,
                    Some("Transform stage did not yield text for insert planning.".to_string()),
                ),
            ];
            self.stage = SliceStage::Error;
            self.last_error = Some("Raw text must not be empty.".to_string());
            return Err("Raw text must not be empty.".to_string());
        }

        self.stage = SliceStage::Processing;

        let provider_started_at = Instant::now();
        let provider_mode = runtime_contract.provider_profile.clone();
        let provider_duration_ms = elapsed_ms(provider_started_at);

        let transform_started_at = Instant::now();
        let transcript = build_transcript(
            raw_text,
            &request.profile,
            &provider_mode,
            &runtime_contract.work_mode,
        );
        let transform_duration_ms = elapsed_ms(transform_started_at);

        let insert_started_at = Instant::now();
        let insertion = build_insertion_plan(&request.insert_target, &runtime_contract.work_mode);
        let insert_duration_ms = elapsed_ms(insert_started_at);

        self.last_session_id = Some(active_session.id);
        self.last_transcript = Some(transcript.clone());
        self.last_insert_target = Some(insertion.target.clone());
        self.last_error = None;
        self.pipeline = vec![
            pipeline_step(
                SlicePipelineStep::Capture,
                SlicePipelineState::Completed,
                capture_duration_ms,
                None,
                Some("Capture finished and handed text to the provider preview stage.".to_string()),
            ),
            pipeline_step(
                SlicePipelineStep::Provider,
                SlicePipelineState::Completed,
                Some(provider_duration_ms),
                None,
                Some(format!(
                    "Simulated {} transcription response prepared.",
                    provider_mode
                )),
            ),
            pipeline_step(
                SlicePipelineStep::Transform,
                SlicePipelineState::Completed,
                Some(transform_duration_ms),
                None,
                Some(format!(
                    "Applied {} runtime rules to the transcript.",
                    transcript.applied_rules.len()
                )),
            ),
            pipeline_step(
                SlicePipelineStep::Insert,
                SlicePipelineState::Completed,
                Some(insert_duration_ms),
                None,
                Some(format!(
                    "Planned {:?} toward {} with fallback {}.",
                    insertion.mode, insertion.target, insertion.fallback
                )),
            ),
        ];
        self.active_session = None;
        self.stage = SliceStage::Completed;

        Ok(SliceResult {
            status: self.status_with_runtime(runtime_contract),
            transcript,
            insertion,
        })
    }
}

pub fn runtime_contract_for_app<R: Runtime>(app: &AppHandle<R>) -> SliceRuntimeContract {
    let config = AppConfig::load_from_disk();
    let provider = normalized_runtime_provider(&config);
    let model = runtime_model_for_provider(&config, &provider).to_string();
    // The correction model follows the correction's own job, which is where the
    // local lane's model names live — asking the recogniser's vendor for it is
    // how a local model id ends up beside a cloud endpoint (ADR 0094).
    let correction_job = config.active_text_profile_transform_preset().correction_job();
    let correction_is_local =
        config.job_provider(correction_job).provider == LOCAL_PROVIDER_ID;
    let provider_status = providers::provider_status(ProviderStatusRequest {
        connection: config.job_provider(JobKey::Dictation).connection,
        provider,
        model: Some(model),
        correction_model: Some(if correction_is_local {
            config.local_correction_model.clone()
        } else {
            config.correction_model.clone()
        }),
    });
    let capture_status = capture::current_status_for_app(app).ok();

    runtime_contract_from_sources(&config, capture_status, Some(provider_status))
}

fn default_pipeline_statuses() -> Vec<SlicePipelineStepStatus> {
    vec![
        pipeline_step(
            SlicePipelineStep::Capture,
            SlicePipelineState::Idle,
            None,
            None,
            None,
        ),
        pipeline_step(
            SlicePipelineStep::Provider,
            SlicePipelineState::Idle,
            None,
            None,
            None,
        ),
        pipeline_step(
            SlicePipelineStep::Transform,
            SlicePipelineState::Idle,
            None,
            None,
            None,
        ),
        pipeline_step(
            SlicePipelineStep::Insert,
            SlicePipelineState::Idle,
            None,
            None,
            None,
        ),
    ]
}

fn pipeline_step(
    step: SlicePipelineStep,
    state: SlicePipelineState,
    duration_ms: Option<u64>,
    error_code: Option<String>,
    detail: Option<String>,
) -> SlicePipelineStepStatus {
    SlicePipelineStepStatus {
        step,
        state,
        duration_ms,
        error_code,
        detail,
    }
}

fn elapsed_ms(started_at: Instant) -> u64 {
    started_at.elapsed().as_millis() as u64
}

#[cfg(test)]
fn runtime_contract_from_config(config: &AppConfig) -> SliceRuntimeContract {
    runtime_contract_from_sources(config, None, None)
}

#[cfg(test)]
fn test_runtime_contract() -> SliceRuntimeContract {
    runtime_contract_from_config(&AppConfig::default())
}

fn runtime_contract_from_sources(
    config: &AppConfig,
    capture_status: Option<NativeCaptureStatus>,
    provider_status: Option<Result<ProviderStatus, ProviderCommandError>>,
) -> SliceRuntimeContract {
    let provider = normalized_runtime_provider(config);
    let local_model = normalized_local_model(config);
    let provider_profile = runtime_provider_profile(config);

    SliceRuntimeContract {
        provider: provider.clone(),
        provider_profile,
        model: runtime_model_for_provider(config, &provider).to_string(),
        work_mode: config.resolved_active_text_profile_work_mode(),
        provider_status: map_provider_runtime_status(provider_status),
        capture_status: map_capture_runtime_status(capture_status),
        local: if provider == LOCAL_PROVIDER_ID {
            Some(SliceLocalContract {
                provider_profile: normalized_local_profile(config),
                model: local_model.to_string(),
                prompt_strength: config.local_prompt_strength.trim().to_string(),
                prompt_carry: config.local_prompt_carry,
                beam_size: config.local_beam_size,
                best_of: config.local_best_of,
            })
        } else {
            None
        },
    }
}

/// The vendor this machine listens with.
///
/// The slice's contract describes the recognition lane — `cloud_transcription`
/// and `local_transcription` are read off it — so it is `Dictation`'s provider
/// and not the connection's (ADR 0094). A profile whose chat jobs sit on
/// another vendor does not make this slice read local.
fn normalized_runtime_provider(config: &AppConfig) -> String {
    config.job_provider(JobKey::Dictation).provider
}

fn normalized_cloud_model(config: &AppConfig) -> &str {
    if config.model.trim().is_empty() {
        default_speech_model()
    } else {
        config.model.trim()
    }
}

fn normalized_local_model(config: &AppConfig) -> &str {
    if config.local_model.trim().is_empty() {
        "base"
    } else {
        config.local_model.trim()
    }
}

fn normalized_local_profile(config: &AppConfig) -> String {
    normalize_local_profile_id(&config.local_profile, normalized_local_model(config))
}

fn runtime_model_for_provider<'a>(config: &'a AppConfig, provider: &str) -> &'a str {
    if provider == LOCAL_PROVIDER_ID {
        normalized_local_model(config)
    } else {
        normalized_cloud_model(config)
    }
}

fn map_provider_runtime_status(
    provider_status: Option<Result<ProviderStatus, ProviderCommandError>>,
) -> SliceProviderRuntimeStatus {
    match provider_status {
        Some(Ok(status)) => SliceProviderRuntimeStatus {
            ready: status.credential.configured,
            detail: status.credential.key_preview,
            local_setup: status.local_setup.map(map_local_provider_setup),
        },
        Some(Err(error)) => SliceProviderRuntimeStatus {
            ready: false,
            detail: Some(error.message),
            local_setup: None,
        },
        None => SliceProviderRuntimeStatus {
            ready: false,
            detail: None,
            local_setup: None,
        },
    }
}

fn map_local_provider_setup(setup: LocalProviderSetupStatus) -> SliceLocalProviderSetupContract {
    SliceLocalProviderSetupContract {
        readiness: match setup.readiness {
            LocalProviderReadiness::Ready => "ready".to_string(),
            LocalProviderReadiness::SetupRequired => "setup_required".to_string(),
        },
        runner_ready: setup.runner_ready,
        model_ready: setup.model_ready,
        chat_ready: setup.chat_ready,
        issue_code: setup.issue_code.map(local_provider_issue_code_value),
        resolved_runner: setup.resolved_runner,
        resolved_model: setup.resolved_model,
        resolved_chat_base_url: setup.resolved_chat_base_url,
        resolved_chat_model: setup.resolved_chat_model,
        guidance: setup.guidance,
    }
}

fn local_provider_issue_code_value(code: LocalProviderIssueCode) -> String {
    match code {
        LocalProviderIssueCode::MissingRunner => "missing_runner".to_string(),
        LocalProviderIssueCode::InvalidRunnerPath => "invalid_runner_path".to_string(),
        LocalProviderIssueCode::RunnerProbeFailed => "runner_probe_failed".to_string(),
        LocalProviderIssueCode::RunnerProbeTimedOut => "runner_probe_timed_out".to_string(),
        LocalProviderIssueCode::MissingModel => "missing_model".to_string(),
        LocalProviderIssueCode::InvalidModelPath => "invalid_model_path".to_string(),
        LocalProviderIssueCode::UnreadableModelDirectory => {
            "unreadable_model_directory".to_string()
        }
        LocalProviderIssueCode::ModelNotFound => "model_not_found".to_string(),
        LocalProviderIssueCode::MissingRunnerAndModel => "missing_runner_and_model".to_string(),
        LocalProviderIssueCode::InvalidChatEndpoint => "invalid_chat_endpoint".to_string(),
        LocalProviderIssueCode::ChatBackendUnavailable => "chat_backend_unavailable".to_string(),
        LocalProviderIssueCode::MissingChatModel => "missing_chat_model".to_string(),
        LocalProviderIssueCode::ChatModelNotFound => "chat_model_not_found".to_string(),
    }
}

fn map_capture_runtime_status(
    capture_status: Option<NativeCaptureStatus>,
) -> SliceCaptureRuntimeStatus {
    match capture_status {
        Some(status) => SliceCaptureRuntimeStatus {
            is_recording: status.is_recording,
            muted: status.muted,
            paused: status.paused,
            device_name: status.device_name,
            silence_seconds: status.silence_seconds,
        },
        None => SliceCaptureRuntimeStatus {
            is_recording: false,
            muted: false,
            paused: false,
            device_name: None,
            silence_seconds: 0.0,
        },
    }
}

fn runtime_provider_profile(config: &AppConfig) -> String {
    let provider = normalized_runtime_provider(config);

    if provider == LOCAL_PROVIDER_ID {
        return normalized_local_profile(config);
    }

    // The lane answers which profile its own models run under; a model it does
    // not ship keeps the derived name. This used to be two arms matching model
    // literals — a second copy of `groq::provider_profiles()`'s table, and after
    // ADR 0115 a second copy of two catalogue rows on top of that.
    let model = normalized_cloud_model(config);
    groq::speech_profile_id(model)
        .unwrap_or_else(|| format!("groq-model-{}", sanitize_runtime_profile_segment(model)))
}

fn sanitize_runtime_profile_segment(value: &str) -> String {
    value
        .trim()
        .chars()
        .map(|character| match character {
            'a'..='z' | '0'..='9' => character,
            'A'..='Z' => character.to_ascii_lowercase(),
            _ => '-',
        })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn build_transcript(
    raw_text: &str,
    profile: &str,
    provider_mode: &str,
    work_mode: &crate::core::config::TextProfileWorkMode,
) -> SliceTranscript {
    let mut applied_rules = Vec::new();
    let trimmed = raw_text.trim();
    if trimmed != raw_text {
        applied_rules.push("trimmed_edges".to_string());
    }

    let rewrite_style = work_mode.rewrite_style.as_str();
    let words: Vec<&str> = if matches!(rewrite_style, "clean" | "polished") {
        let filtered_words: Vec<&str> = trimmed
            .split_whitespace()
            .filter(|token| !is_filler(token))
            .collect();
        if filtered_words.len() != trimmed.split_whitespace().count() {
            applied_rules.push("removed_fillers".to_string());
        }
        filtered_words
    } else {
        trimmed.split_whitespace().collect()
    };

    let mut final_text = words.join(" ");

    let collapsed = final_text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed != final_text {
        applied_rules.push("collapsed_whitespace".to_string());
    }
    final_text = collapsed;

    if matches!(rewrite_style, "clean" | "polished") {
        if let Some(first) = final_text.chars().next() {
            let upper = first.to_uppercase().to_string();
            if upper != first.to_string() {
                final_text.replace_range(0..first.len_utf8(), &upper);
                applied_rules.push("capitalized_sentence_start".to_string());
            }
        }

        if !final_text.is_empty()
            && !matches!(final_text.chars().last(), Some('.') | Some('!') | Some('?'))
        {
            final_text.push('.');
            applied_rules.push("added_terminal_punctuation".to_string());
        }
    }

    if rewrite_style == "polished" {
        applied_rules.push("polished_rewrite_requested".to_string());
    }

    SliceTranscript {
        raw_text: raw_text.to_string(),
        final_text,
        provider_mode: provider_mode.to_string(),
        profile: profile.trim().to_string(),
        applied_rules,
    }
}

fn build_insertion_plan(
    insert_target: &str,
    work_mode: &crate::core::config::TextProfileWorkMode,
) -> SliceInsertionPlan {
    let normalized_target = insert_target.trim();
    let mode = if work_mode.insert_behavior == "clipboard_only"
        || normalized_target.contains("clipboard")
    {
        InsertMode::ClipboardFallbackPlanned
    } else {
        InsertMode::InAppPreview
    };

    SliceInsertionPlan {
        target: normalized_target.to_string(),
        mode,
        fallback: work_mode.recovery_behavior.clone(),
    }
}

fn is_filler(token: &str) -> bool {
    matches!(
        normalize_token(token).as_str(),
        "um" | "uh" | "uhm" | "hmm" | "ah" | "eh" | "äh" | "ähm"
    )
}

fn normalize_token(token: &str) -> String {
    token
        .trim_matches(|ch: char| !ch.is_alphanumeric())
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_work_mode() -> crate::core::config::TextProfileWorkMode {
        crate::core::config::TextProfileWorkMode::default()
    }

    /// Puts the active profile's whole provider axis on one vendor.
    fn set_profile_connection(config: &mut AppConfig, provider: &str) {
        let active_id = config.active_text_profile_id.clone();
        let profile = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
            .expect("active profile");
        let connection = crate::core::config::test_connection(provider);
        profile.providers = Some(crate::core::config::ProfileProviderSettings {
            default: connection.id.clone(),
            ..Default::default()
        });
        config.connections = Some(vec![connection]);
    }

    #[test]
    fn transforms_text_for_the_first_slice() {
        let transcript = build_transcript(
            " ähm wir shippen das morgen ",
            "developer",
            "cloud-fast",
            &test_work_mode(),
        );

        assert_eq!(transcript.final_text, "Wir shippen das morgen.");
        assert!(transcript
            .applied_rules
            .contains(&"removed_fillers".to_string()));
        assert!(transcript
            .applied_rules
            .contains(&"added_terminal_punctuation".to_string()));
    }

    #[test]
    fn requires_active_session_before_completion() {
        let mut state = V1SliceState::default();
        let result = state.complete_capture(CompleteCaptureRequest {
            raw_text: "hello world".to_string(),
            insert_target: "editor".to_string(),
            profile: "developer".to_string(),
        });

        assert!(result.is_err());
    }

    #[test]
    fn status_reports_pipeline_steps_and_durations_after_completion() {
        let mut state = V1SliceState::default();
        state
            .start_capture(StartCaptureRequest {
                trigger: "diagnostic_demo".to_string(),
            })
            .expect("start capture");

        let result = state
            .complete_capture(CompleteCaptureRequest {
                raw_text: "hello world".to_string(),
                insert_target: "editor_preview".to_string(),
                profile: "developer".to_string(),
            })
            .expect("complete capture");

        assert_eq!(result.status.pipeline.len(), 4);
        assert!(matches!(
            result.status.pipeline[0].state,
            SlicePipelineState::Completed
        ));
        assert!(result.status.pipeline[0].duration_ms.is_some());
        assert!(matches!(
            result.status.pipeline[1].step,
            SlicePipelineStep::Provider
        ));
        assert!(matches!(
            result.status.pipeline[3].step,
            SlicePipelineStep::Insert
        ));
        assert!(result.status.pipeline[3]
            .detail
            .as_deref()
            .unwrap_or_default()
            .contains("fallback"));
        assert_eq!(result.status.runtime_contract.provider, "groq");
        assert_eq!(
            result.status.runtime_contract.provider_profile,
            "cloud-fast"
        );
        assert_eq!(
            result.status.runtime_contract.work_mode.rewrite_style,
            "clean"
        );
        assert_eq!(result.status.preferred_provider, "cloud-fast");
        assert_eq!(result.transcript.provider_mode, "cloud-fast");
    }

    #[test]
    fn clipboard_only_work_mode_changes_the_insert_plan() {
        let work_mode = crate::core::config::TextProfileWorkMode {
            rewrite_style: "clean".to_string(),
            insert_behavior: "clipboard_only".to_string(),
            recovery_behavior: "standard".to_string(),
            ..Default::default()
        };

        let insertion = build_insertion_plan("editor_preview", &work_mode);

        assert_eq!(insertion.mode, InsertMode::ClipboardFallbackPlanned);
        assert_eq!(insertion.fallback, "standard");
    }

    #[test]
    fn runtime_contract_uses_explicit_cloud_profile_ids_instead_of_model_heuristics() {
        let config = AppConfig {
            model: "whisper-large-v3".to_string(),
            ..AppConfig::default()
        };

        let runtime_contract = runtime_contract_from_config(&config);

        assert_eq!(runtime_contract.provider, "groq");
        assert_eq!(runtime_contract.provider_profile, "cloud-quality");
    }

    #[test]
    fn runtime_contract_labels_unknown_cloud_models_without_collapsing_to_quality() {
        let config = AppConfig {
            model: "custom/cloud model@edge".to_string(),
            ..AppConfig::default()
        };

        let runtime_contract = runtime_contract_from_config(&config);

        assert_eq!(
            runtime_contract.provider_profile,
            "groq-model-custom-cloud-model-edge"
        );
    }

    #[test]
    fn runtime_contract_surfaces_local_settings() {
        let mut config = AppConfig {
            local_model: "large-v3-q5_0".to_string(),
            local_profile: "local-large-v3-q5_0-quality".to_string(),
            local_prompt_strength: "profile_and_terms".to_string(),
            local_prompt_carry: true,
            local_beam_size: 7,
            local_best_of: 6,
            ..AppConfig::default()
        };
        // The contract describes the recognition lane, so the local answer has
        // to come from `Dictation`'s vendor and not from a machine-wide field.
        set_profile_connection(&mut config, LOCAL_PROVIDER_ID);

        let runtime_contract = runtime_contract_from_sources(
            &config,
            Some(NativeCaptureStatus {
                is_recording: true,
                muted: false,
                paused: false,
                device_name: Some("Studio Mic".to_string()),
                sample_rate: Some(16_000),
                channels: Some(1),
                sample_format: Some("i16".to_string()),
                active_capture_id: Some("capture-1".to_string()),
                silence_seconds: 0.4,
            }),
            Some(Ok(ProviderStatus {
                provider: LOCAL_PROVIDER_ID.to_string(),
                /* The Local lane names no account — it stores no credential
                   (ADR 0209). */
                connection: String::new(),
                default_profile: "local-base-fast".to_string(),
                credential: crate::core::providers::ProviderCredentialStatus {
                    provider: LOCAL_PROVIDER_ID.to_string(),
                    configured: true,
                    storage: "Local runtime".to_string(),
                    key_preview: Some("/usr/bin/whisper-cli · ggml-large-v3-q5_0.bin".to_string()),
                },
                profiles: Vec::new(),
                capabilities: crate::core::providers::ProviderCapabilities {
                    transcription: true,
                    chat_completion: false,
                    speech_synthesis: false,
                    local: true,
                    requires_api_key: false,
                    supports_prompt_bias: true,
                    supports_language: true,
                    supports_segments: false,
                    model_management: true,
                },
                model_capabilities: crate::core::providers::model_capabilities(
                    LOCAL_PROVIDER_ID,
                    "large-v3-q5_0",
                ),
                // The slice reads the folded connection answer above; the
                // unfolded per-role one travels beside it and is exercised
                // where it is built (ADR 0105).
                role_credentials: Vec::new(),
                local_setup: Some(LocalProviderSetupStatus {
                    readiness: LocalProviderReadiness::Ready,
                    runner_ready: true,
                    model_ready: true,
                    chat_ready: true,
                    issue_code: None,
                    resolved_runner: Some("/usr/bin/whisper-cli".to_string()),
                    resolved_model: Some("/models/ggml-large-v3-q5_0.bin".to_string()),
                    resolved_chat_base_url: Some("http://127.0.0.1:11434".to_string()),
                    resolved_chat_model: Some("llama3.2:latest".to_string()),
                    available_chat_models: vec!["llama3.2:latest".to_string()],
                    guidance: "Local runtime is ready.".to_string(),
                }),
                self_hosted_endpoint: None,
            })),
        );

        assert_eq!(runtime_contract.provider, LOCAL_PROVIDER_ID);
        assert_eq!(
            runtime_contract.provider_profile,
            "local-large-v3-q5_0-quality"
        );
        assert_eq!(runtime_contract.model, "large-v3-q5_0");
        assert!(runtime_contract.provider_status.ready);
        assert_eq!(
            runtime_contract
                .provider_status
                .local_setup
                .as_ref()
                .and_then(|setup| setup.resolved_runner.as_deref()),
            Some("/usr/bin/whisper-cli")
        );
        assert_eq!(
            runtime_contract.capture_status.device_name.as_deref(),
            Some("Studio Mic")
        );
        assert_eq!(
            runtime_contract
                .local
                .as_ref()
                .map(|contract| contract.provider_profile.as_str()),
            Some("local-large-v3-q5_0-quality")
        );
        assert_eq!(
            runtime_contract
                .local
                .as_ref()
                .map(|contract| contract.prompt_strength.as_str()),
            Some("profile_and_terms")
        );
        assert_eq!(
            runtime_contract
                .local
                .as_ref()
                .map(|contract| contract.beam_size),
            Some(7)
        );
        assert_eq!(
            runtime_contract
                .local
                .as_ref()
                .map(|contract| contract.best_of),
            Some(6)
        );
    }

    #[test]
    fn empty_raw_text_sets_pipeline_error_code_and_skips_remaining_steps() {
        let mut state = V1SliceState::default();
        state
            .start_capture(StartCaptureRequest {
                trigger: "diagnostic_demo".to_string(),
            })
            .expect("start capture");

        let result = state.complete_capture(CompleteCaptureRequest {
            raw_text: "   ".to_string(),
            insert_target: "editor_preview".to_string(),
            profile: "developer".to_string(),
        });

        assert!(result.is_err());

        let status = state.status();
        assert!(matches!(status.stage, SliceStage::Error));
        assert_eq!(
            status.pipeline[1].error_code.as_deref(),
            Some("empty_raw_text")
        );
        assert!(matches!(
            status.pipeline[2].state,
            SlicePipelineState::Skipped
        ));
        assert!(matches!(
            status.pipeline[3].state,
            SlicePipelineState::Skipped
        ));
    }

    #[test]
    fn reset_returns_slice_to_idle_state() {
        let mut state = V1SliceState::default();
        state
            .start_capture(StartCaptureRequest {
                trigger: "diagnostic_demo".to_string(),
            })
            .expect("start capture");

        let status = state.reset();

        assert!(matches!(status.stage, SliceStage::Idle));
        assert!(status.session_id.is_none());
        assert!(status
            .pipeline
            .iter()
            .all(|step| matches!(step.state, SlicePipelineState::Idle)));
    }
}
