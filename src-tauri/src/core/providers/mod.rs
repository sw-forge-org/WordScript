use serde::{Deserialize, Serialize};

pub mod groq;
pub mod local_preview;
pub mod registry;

pub use registry::{
    ChatProvider, Provider, ProviderEntry, ProviderFuture, SpeechProvider, VoiceProvider,
};

pub const DEFAULT_PROVIDER_ID: &str = "groq";
pub const LOCAL_PREVIEW_PROVIDER_ID: &str = "local_preview";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderErrorKind {
    MissingApiKey,
    SecretStoreUnavailable,
    InvalidRequest,
    Unauthorized,
    RateLimited,
    Timeout,
    Network,
    ProviderStatus,
    Parse,
    Io,
    LocalSetup,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderErrorAction {
    ConfigureCredential,
    CheckSecretStore,
    ChangeRequest,
    WaitAndRetry,
    Retry,
    CheckNetwork,
    CheckProviderStatus,
    CheckLocalSetup,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderCommandError {
    pub kind: ProviderErrorKind,
    pub message: String,
    pub status: Option<u16>,
    pub retry_after_seconds: Option<u64>,
    pub retryable: bool,
    pub user_action: ProviderErrorAction,
}

impl ProviderCommandError {
    pub fn new(
        kind: ProviderErrorKind,
        message: impl Into<String>,
        status: Option<u16>,
        retry_after_seconds: Option<u64>,
    ) -> Self {
        let retryable = provider_error_is_retryable(&kind);
        let user_action = provider_error_action(&kind);

        Self {
            kind,
            message: message.into(),
            status,
            retry_after_seconds,
            retryable,
            user_action,
        }
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(ProviderErrorKind::InvalidRequest, message, None, None)
    }

    pub fn local_setup(message: impl Into<String>) -> Self {
        Self::new(ProviderErrorKind::LocalSetup, message, None, None)
    }
}

fn provider_error_is_retryable(kind: &ProviderErrorKind) -> bool {
    matches!(
        kind,
        ProviderErrorKind::RateLimited
            | ProviderErrorKind::Timeout
            | ProviderErrorKind::Network
            | ProviderErrorKind::ProviderStatus
            | ProviderErrorKind::Io
    )
}

fn provider_error_action(kind: &ProviderErrorKind) -> ProviderErrorAction {
    match kind {
        ProviderErrorKind::MissingApiKey => ProviderErrorAction::ConfigureCredential,
        ProviderErrorKind::SecretStoreUnavailable => ProviderErrorAction::CheckSecretStore,
        ProviderErrorKind::InvalidRequest | ProviderErrorKind::Parse => {
            ProviderErrorAction::ChangeRequest
        }
        ProviderErrorKind::Unauthorized => ProviderErrorAction::ConfigureCredential,
        ProviderErrorKind::RateLimited => ProviderErrorAction::WaitAndRetry,
        ProviderErrorKind::Timeout => ProviderErrorAction::Retry,
        ProviderErrorKind::Network => ProviderErrorAction::CheckNetwork,
        ProviderErrorKind::ProviderStatus => ProviderErrorAction::CheckProviderStatus,
        ProviderErrorKind::Io => ProviderErrorAction::Retry,
        ProviderErrorKind::LocalSetup => ProviderErrorAction::CheckLocalSetup,
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderCredentialStatus {
    pub provider: String,
    pub configured: bool,
    pub storage: String,
    pub key_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderMode {
    Fast,
    Quality,
    Local,
    SelfHosted,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderProfile {
    pub id: String,
    pub provider: String,
    pub mode: ProviderMode,
    pub model: String,
    pub label: String,
    pub default: bool,
    pub requires_api_key: bool,
}

/// An account plan, and the upload it buys.
///
/// Declared per provider rather than hardcoded anywhere that reads it, so a new
/// lane ships its own plans and every surface picks them up without edits. An
/// empty list means the lane has no plans to choose between — the local runtime
/// is not billed by request size.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProviderTier {
    pub id: String,
    pub label: String,
    pub max_audio_bytes: u64,
    pub default: bool,
}

/// What a provider can accept from one capture.
///
/// Two different shapes of limit, because the lanes are bound by different
/// things: a cloud lane by request size, a local one by decode time. A lane
/// states whichever binds it and leaves the other `None`; a lane that states
/// neither is unbounded, and the configured maximum is what remains.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProviderCaptureLimits {
    /// Largest upload the provider accepts, when bounded by request size.
    pub max_audio_bytes: Option<u64>,
    /// Seconds of decode per second of audio, when bounded by compute.
    pub realtime_factor: Option<f64>,
    /// The binding cause, phrased for a settings row: "the 25 MiB upload size".
    pub detail: String,
}

impl ProviderCaptureLimits {
    /// No limit this lane knows about. Deliberately not a borrowed number from
    /// another lane: a guessed ceiling reads as authoritative and sends the fix
    /// in the wrong direction when it is wrong.
    pub fn unbounded() -> Self {
        Self {
            max_audio_bytes: None,
            realtime_factor: None,
            detail: String::new(),
        }
    }
}

/// The account plans a provider offers, for the settings surface to render.
///
/// A provider that does not listen has nothing to choose between, and so does
/// one this build does not know: both answer with an empty list rather than
/// with another lane's plans.
pub fn provider_tiers(provider: &str) -> Vec<ProviderTier> {
    registry::resolve_entry(provider)
        .ok()
        .and_then(|entry| entry.speech)
        .map(|speech| speech.tiers())
        .unwrap_or_default()
}

/// What one capture may cost on this provider, under this model and plan.
///
/// The dispatch every other provider capability already uses. The capture
/// budget calls this and knows nothing about any particular lane.
pub fn capture_limits(provider: &str, model: &str, tier_id: &str) -> ProviderCaptureLimits {
    registry::resolve_entry(provider)
        .ok()
        .and_then(|entry| entry.speech)
        .map(|speech| speech.capture_limits(model, tier_id))
        .unwrap_or_else(ProviderCaptureLimits::unbounded)
}

/// What a model does on this provider (ADR 0110).
///
/// **Both arguments, always**, for the reason `capture_limits` takes both: the
/// answer is a property of the pair and not of either half. A provider this
/// build does not know cannot answer for its models either, and says so rather
/// than lending them the default lane's answer.
pub fn model_capabilities(provider: &str, model: &str) -> ModelCapabilities {
    registry::resolve_entry(provider)
        .map(|entry| entry.provider.model_capabilities(model))
        .unwrap_or_else(|_| ModelCapabilities::unknown(model))
}

/// What roles a provider serves, and how it must be talked to.
///
/// **The provider axis.** Every field here answers a question about the vendor
/// as this build operates it: *can it listen*, *can it transform*, *can it
/// speak*, *does it need a key*. What a particular model does inside one of
/// those roles is the other axis and lives on `ModelCapabilities` (ADR 0110).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProviderCapabilities {
    pub transcription: bool,
    pub chat_completion: bool,
    /// Whether this vendor speaks at all, in this build.
    ///
    /// A role question, and therefore the one capability of ADR 0094's four
    /// that stays on the provider (ADR 0110). It is false for every provider
    /// registered today, because `VoiceProvider` is implemented by nobody — and
    /// the registry test holds it to that, so a lane cannot claim a voice it
    /// has no implementation for.
    pub speech_synthesis: bool,
    pub local: bool,
    pub requires_api_key: bool,
    pub supports_prompt_bias: bool,
    pub supports_language: bool,
    pub supports_segments: bool,
    pub model_management: bool,
}

/// What a model does, or whether this build knows.
///
/// Three states rather than a `bool`, because one of the drawn lanes serves a
/// model list that belongs to somebody else — OpenRouter's — and cannot be
/// enumerated ahead of time. **A model whose capability is unknown is not a
/// model that streams** (ADR 0110), and a `bool` forces that case into one of
/// the two real answers at the point where the value is written, where nothing
/// downstream can tell a measurement from a guess.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModelSupport {
    Supported,
    Unsupported,
    Unknown,
}

/// What one model does inside a role its provider serves.
///
/// **The model axis** (ADR 0110). `ProviderCapabilities` answers *which of the
/// three roles can this vendor serve*; this answers *what does this model do
/// inside one of them*, and the two are not interchangeable: one OpenAI key and
/// one endpoint serve `gpt-4o-transcribe`, which streams, and `whisper-1`,
/// which does not. So a caller that knows only the provider is holding half a
/// question, and every door to this type takes both halves.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ModelCapabilities {
    /// The model this answer describes — the resolved one, not the requested
    /// one, when a caller named none. A surface that says *this will stream*
    /// can then also say which model it means.
    pub model: String,
    pub transcription_streaming: ModelSupport,
    pub reports_detected_language: ModelSupport,
    pub synthesis_streaming: ModelSupport,
}

impl ModelCapabilities {
    /// A model this build has nothing to say about.
    ///
    /// Deliberately not "no": an unlisted model on a lane whose list is the
    /// vendor's own is a gap in this build's knowledge, and stating it as a
    /// denial is the same class of mistake as borrowing another lane's capture
    /// ceiling in `ProviderCaptureLimits::unbounded`.
    pub fn unknown(model: &str) -> Self {
        Self {
            model: model.trim().to_string(),
            transcription_streaming: ModelSupport::Unknown,
            reports_detected_language: ModelSupport::Unknown,
            synthesis_streaming: ModelSupport::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LocalProviderReadiness {
    Ready,
    SetupRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LocalProviderIssueCode {
    MissingRunner,
    InvalidRunnerPath,
    RunnerProbeFailed,
    RunnerProbeTimedOut,
    MissingModel,
    InvalidModelPath,
    UnreadableModelDirectory,
    ModelNotFound,
    MissingRunnerAndModel,
    InvalidChatEndpoint,
    ChatBackendUnavailable,
    MissingChatModel,
    ChatModelNotFound,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalProviderSetupStatus {
    pub readiness: LocalProviderReadiness,
    pub runner_ready: bool,
    pub model_ready: bool,
    pub chat_ready: bool,
    pub issue_code: Option<LocalProviderIssueCode>,
    pub resolved_runner: Option<String>,
    pub resolved_model: Option<String>,
    pub resolved_chat_base_url: Option<String>,
    pub resolved_chat_model: Option<String>,
    pub available_chat_models: Vec<String>,
    pub guidance: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderStatus {
    pub provider: String,
    pub default_profile: String,
    pub credential: ProviderCredentialStatus,
    pub profiles: Vec<ProviderProfile>,
    pub capabilities: ProviderCapabilities,
    /// The model axis, answered for the model the request named (ADR 0110).
    ///
    /// It travels here rather than on a command of its own because the pair is
    /// what the question needs and `ProviderStatusRequest` already carries the
    /// model — and because a registered command with no caller is a defect this
    /// repo has swept for twice (ADR 0089, ADR 0103). A caller asking about a
    /// second model asks again with that model.
    pub model_capabilities: ModelCapabilities,
    pub local_setup: Option<LocalProviderSetupStatus>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProviderStatusRequest {
    pub provider: String,
    pub model: Option<String>,
    pub correction_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaveProviderApiKeyRequest {
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClearProviderApiKeyRequest {
    pub provider: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ValidateProviderApiKeyRequest {
    pub provider: String,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidateProviderApiKeyResponse {
    pub ok: bool,
    pub provider: String,
    pub checked_with: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TranscribeAudioFileRequest {
    pub provider: String,
    pub audio_path: String,
    pub model: Option<String>,
    pub profile: Option<String>,
    pub language: Option<String>,
    pub prompt: Option<String>,
    pub carry_initial_prompt: Option<bool>,
    pub beam_size: Option<u8>,
    pub best_of: Option<u8>,
    pub response_format: Option<String>,
    pub timeout_ms: Option<u64>,
    pub max_retries: Option<u8>,
}

/// One Whisper segment as returned by `verbose_json`. The three optional
/// metrics are the model's own confidence signals; they are what makes a
/// hallucinated block distinguishable from speech the model simply found hard.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub start: f64,
    #[serde(default)]
    pub end: f64,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub avg_logprob: Option<f64>,
    #[serde(default)]
    pub no_speech_prob: Option<f64>,
    #[serde(default)]
    pub compression_ratio: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResponse {
    pub text: String,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub duration: Option<f64>,
    #[serde(default)]
    pub segments: Option<Vec<TranscriptionSegment>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: f32,
    pub max_tokens: u32,
    pub timeout_ms: Option<u64>,
    pub max_retries: Option<u8>,
}

pub fn normalize_provider_value(provider: &str) -> String {
    registry::resolve_entry(provider)
        .map(|entry| entry.id)
        .unwrap_or(DEFAULT_PROVIDER_ID)
        .to_string()
}

pub fn default_provider_id() -> &'static str {
    DEFAULT_PROVIDER_ID
}

pub fn provider_credentials_configured(provider: &str) -> Result<bool, ProviderCommandError> {
    Ok(provider_status(ProviderStatusRequest {
        provider: provider.to_string(),
        model: None,
        correction_model: None,
    })?
    .credential
    .configured)
}

pub fn migrate_legacy_provider_api_key(
    provider: &str,
    api_key: &str,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    registry::resolve_entry(provider)?
        .provider
        .save_api_key(api_key)
}

#[tauri::command]
pub fn provider_status(
    request: ProviderStatusRequest,
) -> Result<ProviderStatus, ProviderCommandError> {
    registry::resolve_entry(&request.provider)?
        .provider
        .status(&request)
}

#[tauri::command]
pub fn save_provider_api_key(
    request: SaveProviderApiKeyRequest,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    registry::resolve_entry(&request.provider)?
        .provider
        .save_api_key(&request.api_key)
}

#[tauri::command]
pub fn clear_provider_api_key(
    request: ClearProviderApiKeyRequest,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    registry::resolve_entry(&request.provider)?
        .provider
        .clear_api_key()
}

#[tauri::command]
pub async fn validate_provider_api_key(
    request: ValidateProviderApiKeyRequest,
) -> Result<ValidateProviderApiKeyResponse, ProviderCommandError> {
    registry::resolve_entry(&request.provider)?
        .provider
        .validate_api_key(request.api_key)
        .await
}

#[tauri::command]
pub async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<TranscriptionResponse, ProviderCommandError> {
    registry::resolve_entry(&request.provider)?
        .require_speech()?
        .transcribe_audio_file(request)
        .await
}

pub async fn create_chat_completion(
    request: ChatCompletionRequest,
) -> Result<String, ProviderCommandError> {
    registry::resolve_entry(&request.provider)?
        .require_chat()?
        .create_chat_completion(request)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_provider_values_to_supported_ids() {
        assert_eq!(normalize_provider_value("groq"), "groq");
        assert_eq!(normalize_provider_value(" GrOq "), "groq");
        assert_eq!(normalize_provider_value("local_preview"), "local_preview");
        assert_eq!(normalize_provider_value("local"), "local_preview");
        assert_eq!(normalize_provider_value(""), "groq");
        assert_eq!(normalize_provider_value("openai"), "groq");
    }

    #[test]
    fn rejects_unknown_provider_dispatch() {
        let error = registry::resolve_entry("openai").unwrap_err();

        assert!(matches!(error.kind, ProviderErrorKind::InvalidRequest));
        assert!(error.message.contains("openai"));
    }

    /// The resolver takes the pair and declines to guess without it.
    ///
    /// A provider this build cannot resolve has no models to answer for, and
    /// `Unknown` is what that costs: borrowing the default lane's answer would
    /// state *this will not stream* about a lane nobody has looked at, which is
    /// the failure `ProviderCaptureLimits::unbounded` already refuses.
    #[test]
    fn a_model_answer_resolves_from_the_pair_and_never_from_the_provider_alone() {
        assert_eq!(
            model_capabilities("groq", "whisper-large-v3").transcription_streaming,
            ModelSupport::Unsupported,
        );
        assert_eq!(
            model_capabilities("groq", "").model,
            "whisper-large-v3-turbo",
        );
        assert_eq!(
            model_capabilities("local", "large").model,
            "large-v3",
            "the alias resolves to the entry and the entry names the model",
        );

        let unknown_lane = model_capabilities("openai", "gpt-4o-transcribe");
        assert_eq!(unknown_lane.model, "gpt-4o-transcribe");
        assert_eq!(unknown_lane.transcription_streaming, ModelSupport::Unknown);
    }

    #[test]
    fn provider_errors_have_stable_recovery_semantics() {
        let missing_key =
            ProviderCommandError::new(ProviderErrorKind::MissingApiKey, "missing", None, None);
        assert!(!missing_key.retryable);
        assert_eq!(
            missing_key.user_action,
            ProviderErrorAction::ConfigureCredential
        );

        let rate_limited = ProviderCommandError::new(
            ProviderErrorKind::RateLimited,
            "slow down",
            Some(429),
            Some(3),
        );
        assert!(rate_limited.retryable);
        assert_eq!(rate_limited.user_action, ProviderErrorAction::WaitAndRetry);
        assert_eq!(rate_limited.retry_after_seconds, Some(3));

        let local_setup = ProviderCommandError::local_setup("missing whisper-cli");
        assert!(!local_setup.retryable);
        assert_eq!(
            local_setup.user_action,
            ProviderErrorAction::CheckLocalSetup
        );
    }
}
