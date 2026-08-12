use serde::{Deserialize, Serialize};

use crate::core::config::TextProfileWorkMode;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SliceStage {
    Idle,
    Capturing,
    Processing,
    Completed,
    Error,
}

impl Default for SliceStage {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SlicePipelineStep {
    Capture,
    Provider,
    Transform,
    Insert,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SlicePipelineState {
    Idle,
    Running,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize)]
pub struct SlicePipelineStepStatus {
    pub step: SlicePipelineStep,
    pub state: SlicePipelineState,
    pub duration_ms: Option<u64>,
    pub error_code: Option<String>,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceCapabilities {
    pub cloud_transcription: bool,
    pub local_transcription: bool,
    pub insertion_fallback: bool,
    pub typed_contracts: bool,
    pub rebuild_lab: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceLocalContract {
    pub provider_profile: String,
    pub model: String,
    pub prompt_strength: String,
    pub prompt_carry: bool,
    pub beam_size: u8,
    pub best_of: u8,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceLocalProviderSetupContract {
    pub readiness: String,
    pub runner_ready: bool,
    pub model_ready: bool,
    pub chat_ready: bool,
    pub issue_code: Option<String>,
    pub resolved_runner: Option<String>,
    pub resolved_model: Option<String>,
    pub resolved_chat_base_url: Option<String>,
    pub resolved_chat_model: Option<String>,
    pub guidance: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceProviderRuntimeStatus {
    pub ready: bool,
    pub detail: Option<String>,
    pub local_setup: Option<SliceLocalProviderSetupContract>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceCaptureRuntimeStatus {
    pub is_recording: bool,
    pub muted: bool,
    pub paused: bool,
    pub device_name: Option<String>,
    pub silence_seconds: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceRuntimeContract {
    pub provider: String,
    pub provider_profile: String,
    pub model: String,
    pub work_mode: TextProfileWorkMode,
    pub provider_status: SliceProviderRuntimeStatus,
    pub capture_status: SliceCaptureRuntimeStatus,
    pub local: Option<SliceLocalContract>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceStatus {
    pub stage: SliceStage,
    pub session_id: Option<String>,
    pub active_trigger: Option<String>,
    pub preferred_provider: String,
    pub architecture_mode: String,
    pub runtime_contract: SliceRuntimeContract,
    pub last_transcript: Option<String>,
    pub last_insert_target: Option<String>,
    pub last_error: Option<String>,
    pub pipeline: Vec<SlicePipelineStepStatus>,
    pub capabilities: SliceCapabilities,
    pub next_milestones: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InsertMode {
    InAppPreview,
    ClipboardFallbackPlanned,
}

#[derive(Debug, Deserialize)]
pub struct StartCaptureRequest {
    pub trigger: String,
}

#[derive(Debug, Deserialize)]
pub struct CompleteCaptureRequest {
    pub raw_text: String,
    pub insert_target: String,
    pub profile: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceTranscript {
    pub raw_text: String,
    pub final_text: String,
    pub provider_mode: String,
    pub profile: String,
    pub applied_rules: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceInsertionPlan {
    pub target: String,
    pub mode: InsertMode,
    pub fallback: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceResult {
    pub status: SliceStatus,
    pub transcript: SliceTranscript,
    pub insertion: SliceInsertionPlan,
}
