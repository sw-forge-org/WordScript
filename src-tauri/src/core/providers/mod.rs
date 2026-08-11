use serde::{Deserialize, Serialize};

pub mod groq;
pub mod local_preview;
pub mod registry;

pub use registry::{
    ChatProvider, Provider, ProviderEntry, ProviderFuture, SpeechProvider, VoiceProvider,
};

/// Which role a credential answers for (ADR 0105).
///
/// The three roles are the three traits, as a value: a credential is resolved
/// from the pair `(provider, role)` and never from the provider alone, because
/// one account may hold an API key for recognition and a subscription for chat
/// at the same time (ADR 0102). It is the same axis `registry.rs` splits in the
/// type — stated as data here because a stored secret has to be keyed by it.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ProviderRole {
    Speech,
    Chat,
    Voice,
}

impl ProviderRole {
    /// Registry order, and the order a credential is looked for in.
    pub const ALL: [ProviderRole; 3] = [Self::Speech, Self::Chat, Self::Voice];

    /// The stable id a secret-store entry is keyed by. Changing one of these
    /// strings orphans every credential already stored under it.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Speech => "speech",
            Self::Chat => "chat",
            Self::Voice => "voice",
        }
    }

    /// Phrased for a sentence on a settings row, not for a log line.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Speech => "speech recognition",
            Self::Chat => "chat completion",
            Self::Voice => "speech synthesis",
        }
    }
}

/// How a role is paid for (ADR 0102).
///
/// **Admissibility is decided here, in the type, and never as a runtime
/// "unsupported" reply.** A ChatGPT subscription reaches
/// `chatgpt.com/backend-api/codex`, which serves no `/v1/audio/transcriptions`
/// and no `/v1/audio/speech` — so there is no speech call to make with it and
/// no error to return from one.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum CredentialKind {
    ApiKey,
    Subscription,
}

impl CredentialKind {
    /// What a caller that named no kind means. ADR 0102 keeps the API key the
    /// default and the only path for every provider but one.
    pub const DEFAULT: CredentialKind = CredentialKind::ApiKey;

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ApiKey => "api_key",
            Self::Subscription => "subscription",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::ApiKey => "an API key",
            Self::Subscription => "a subscription",
        }
    }

    /// Whether this kind can pay for that role at all (ADR 0102).
    pub fn is_admissible_for(&self, role: ProviderRole) -> bool {
        match self {
            Self::ApiKey => true,
            Self::Subscription => matches!(role, ProviderRole::Chat),
        }
    }
}

/// What answers for one `(provider, role)` pair — or the name of what does not.
///
/// **A role with no credential is inert and says which one it is missing**
/// (ADR 0105). It never falls back to the kind the same provider holds for
/// another role: that is the role-shaped version of the mistake ADR 0094's
/// security rule prevents, and it is not softer for happening inside one vendor.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RoleCredentialStatus {
    pub provider: String,
    pub role: ProviderRole,
    /// The kind that answers for this role, or `None` when the lane needs no
    /// credential at all — which is what Local *is*, rather than a Local that
    /// is missing one.
    pub kind: Option<CredentialKind>,
    pub configured: bool,
    pub storage: String,
    pub key_preview: Option<String>,
    /// What is missing, named, and `None` while the role is configured.
    pub missing: Option<String>,
}

/// The connection-level answer, folded from the per-role ones.
///
/// **Conservative on purpose**: configured means *every* role this provider
/// serves has a credential. A vendor holding one for recognition and none for
/// chat is genuinely half-usable, and a `bool` cannot say so — so it says the
/// half that is safe to be wrong about. Claiming ready and then failing a
/// transform silently is the fake-state defect; claiming not-ready while
/// dictation would have run is a visible, correctable understatement. Which
/// role is missing is answered by `ProviderStatus::role_credentials`, not by
/// widening this block, because a third state here would decide a drawing that
/// does not exist yet (ADR 0057, ADR 0106).
pub(crate) fn aggregate_credential(
    provider: &str,
    roles: &[RoleCredentialStatus],
) -> ProviderCredentialStatus {
    ProviderCredentialStatus {
        provider: provider.to_string(),
        configured: !roles.is_empty() && roles.iter().all(|role| role.configured),
        storage: roles
            .first()
            .map(|role| role.storage.clone())
            .unwrap_or_default(),
        key_preview: roles
            .iter()
            .find_map(|role| role.key_preview.clone()),
    }
}

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
    /// One entry per role this provider registered (ADR 0105).
    ///
    /// `credential` above is the connection-level fold of exactly these, and it
    /// is what the one drawn credential row reads today. A surface that draws a
    /// key row for chat and a missing-key row for speech on the same provider
    /// cannot be fed by one block, so the unfolded answer travels beside it —
    /// available before the drawing that needs it exists, and not pretending to
    /// be that drawing.
    pub role_credentials: Vec<RoleCredentialStatus>,
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
    /// Which role this credential is being stored for.
    ///
    /// **Absent means every role this provider serves that the kind can pay
    /// for**, which is what the one drawn key row on a connection card means: a
    /// key is a way into an account, not into a job. A save that landed on one
    /// role would leave the user having done everything the surface asked while
    /// half the jobs stayed inert.
    #[serde(default)]
    pub role: Option<ProviderRole>,
    /// Absent means `api_key` — the default, and the only kind any registered
    /// provider accepts today (ADR 0102).
    #[serde(default)]
    pub kind: Option<CredentialKind>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClearProviderApiKeyRequest {
    pub provider: String,
    /// Absent means every role this provider serves, for the named kind only.
    /// **Clearing one role never clears another's** (ADR 0105), and clearing a
    /// key never reaches a subscription: "remove the key" is not "sign out".
    #[serde(default)]
    pub role: Option<ProviderRole>,
    #[serde(default)]
    pub kind: Option<CredentialKind>,
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

/// Whether every role this provider serves has a credential.
///
/// The fold `aggregate_credential` states, without building the whole status:
/// the local lane's status probes the runner and the model, and this question
/// does not need either.
pub fn provider_credentials_configured(provider: &str) -> Result<bool, ProviderCommandError> {
    let entry = registry::resolve_entry(provider)?;
    let roles = role_credentials(entry)?;

    Ok(aggregate_credential(entry.id, &roles).configured)
}

/// Every role this provider registered, answered.
fn role_credentials(
    entry: &'static ProviderEntry,
) -> Result<Vec<RoleCredentialStatus>, ProviderCommandError> {
    entry
        .roles()
        .into_iter()
        .map(|role| entry.provider.credential_status(role))
        .collect()
}

/// Which roles one save or clear touches.
///
/// A named role must be one the provider registered — storing a credential for
/// a role that has no implementation is the storage-shaped version of a lane
/// claiming a role it cannot serve, and the registry is the same answer in both
/// cases. A named role must also be one the kind can pay for, and an unnamed
/// role means every registered role that passes both tests: a subscription
/// therefore reaches chat and stops, with or without the caller saying so.
fn credential_target_roles(
    entry: &'static ProviderEntry,
    role: Option<ProviderRole>,
    kind: CredentialKind,
) -> Result<Vec<ProviderRole>, ProviderCommandError> {
    let registered = entry.roles();

    if let Some(role) = role {
        if !registered.contains(&role) {
            return Err(ProviderCommandError::invalid_request(format!(
                "Provider '{}' does not perform {}. There is no credential to store for it.",
                entry.id,
                role.label(),
            )));
        }
        if !kind.is_admissible_for(role) {
            return Err(ProviderCommandError::invalid_request(format!(
                "{} cannot pay for {} on '{}'. That backend serves no such call.",
                kind.label(),
                role.label(),
                entry.id,
            )));
        }
        return Ok(vec![role]);
    }

    let targets: Vec<ProviderRole> = registered
        .into_iter()
        .filter(|role| kind.is_admissible_for(*role))
        .collect();

    if targets.is_empty() {
        return Err(ProviderCommandError::invalid_request(format!(
            "Provider '{}' has no role {} can pay for.",
            entry.id,
            kind.label(),
        )));
    }

    Ok(targets)
}

/// Moves a key out of the config file and into the per-role store.
///
/// The legacy field held one string for a whole provider, which is what every
/// role of that provider used; it therefore lands on each of them rather than
/// on a role picked here. A migration that guessed one would silently disable
/// the other.
pub fn migrate_legacy_provider_api_key(
    provider: &str,
    api_key: &str,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    save_provider_api_key(SaveProviderApiKeyRequest {
        provider: provider.to_string(),
        api_key: api_key.to_string(),
        role: None,
        kind: None,
    })
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
    let entry = registry::resolve_entry(&request.provider)?;
    let kind = request.kind.unwrap_or(CredentialKind::DEFAULT);

    for role in credential_target_roles(entry, request.role, kind)? {
        entry.provider.save_api_key(role, kind, &request.api_key)?;
    }

    Ok(aggregate_credential(entry.id, &role_credentials(entry)?))
}

#[tauri::command]
pub fn clear_provider_api_key(
    request: ClearProviderApiKeyRequest,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    let entry = registry::resolve_entry(&request.provider)?;
    let kind = request.kind.unwrap_or(CredentialKind::DEFAULT);

    for role in credential_target_roles(entry, request.role, kind)? {
        entry.provider.clear_api_key(role, kind)?;
    }

    Ok(aggregate_credential(entry.id, &role_credentials(entry)?))
}

/// What answers for one job's role on one provider (ADR 0105).
///
/// **"Follow the connection" follows the provider and never the credential**,
/// so the caller resolves the provider first — from the job's override, or from
/// the connection when there is none — and asks this for the role the job runs
/// in. A role with no credential answers `configured: false` and names what is
/// missing; it never returns the other kind the same provider holds.
pub fn resolve_role_credential(
    provider: &str,
    role: ProviderRole,
) -> Result<RoleCredentialStatus, ProviderCommandError> {
    let entry = registry::resolve_entry(provider)?;

    if !entry.roles().contains(&role) {
        return Err(ProviderCommandError::invalid_request(format!(
            "Provider '{}' does not perform {}. Route this job to one that does.",
            entry.id,
            role.label(),
        )));
    }

    entry.provider.credential_status(role)
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

    /// **A subscription cannot pay for recognition, and the type is where that
    /// is said** (ADR 0102). The backend a ChatGPT plan reaches serves no
    /// `/v1/audio/transcriptions`, so there is no call to fail — which means
    /// nothing downstream may be allowed to make one.
    #[test]
    fn a_subscription_is_admissible_for_chat_and_for_nothing_else() {
        assert!(CredentialKind::Subscription.is_admissible_for(ProviderRole::Chat));
        assert!(!CredentialKind::Subscription.is_admissible_for(ProviderRole::Speech));
        assert!(!CredentialKind::Subscription.is_admissible_for(ProviderRole::Voice));

        for role in ProviderRole::ALL {
            assert!(
                CredentialKind::ApiKey.is_admissible_for(role),
                "a key pays for every role a provider serves",
            );
        }
    }

    /// A save that names no role means the connection, which is what the one
    /// drawn key row means: a key is a way into an account. It fans out across
    /// the roles the provider registered — and an inadmissible kind is filtered
    /// out of that fan-out rather than riding along with it.
    #[test]
    fn a_save_without_a_role_reaches_every_role_the_kind_can_pay_for() {
        let entry = registry::resolve_entry("groq").expect("groq entry");

        assert_eq!(
            credential_target_roles(entry, None, CredentialKind::ApiKey).expect("api key targets"),
            vec![ProviderRole::Speech, ProviderRole::Chat],
        );
        assert_eq!(
            credential_target_roles(entry, None, CredentialKind::Subscription)
                .expect("subscription targets"),
            vec![ProviderRole::Chat],
            "a subscription reaches chat with or without the caller saying so",
        );
        assert_eq!(
            credential_target_roles(entry, Some(ProviderRole::Chat), CredentialKind::ApiKey)
                .expect("named role"),
            vec![ProviderRole::Chat],
        );
    }

    /// Two refusals with different reasons, and neither is a generic failure:
    /// a role with no implementation has nothing to store a credential for, and
    /// a kind that cannot pay for a role must not be stored against it even
    /// when the vendor serves that role.
    #[test]
    fn a_credential_cannot_be_stored_for_a_role_that_cannot_use_it() {
        let entry = registry::resolve_entry("groq").expect("groq entry");

        let no_such_role =
            credential_target_roles(entry, Some(ProviderRole::Voice), CredentialKind::ApiKey)
                .expect_err("groq registers no voice role");
        assert!(no_such_role.message.contains("speech synthesis"));
        assert_eq!(no_such_role.user_action, ProviderErrorAction::ChangeRequest);

        let inadmissible = credential_target_roles(
            entry,
            Some(ProviderRole::Speech),
            CredentialKind::Subscription,
        )
        .expect_err("a subscription cannot pay for recognition");
        assert!(inadmissible.message.contains("speech recognition"));
    }

    /// The fold is conservative: half a connection reads as not ready, because
    /// claiming ready and then failing a transform silently is the defect, and
    /// understating readiness is visible and correctable.
    #[test]
    fn the_connection_answer_is_configured_only_when_every_role_is() {
        let configured = |role: ProviderRole, configured: bool| RoleCredentialStatus {
            provider: "groq".to_string(),
            role,
            kind: Some(CredentialKind::ApiKey),
            configured,
            storage: "os_secret_store".to_string(),
            key_preview: configured.then(|| "gsk_...4f2a".to_string()),
            missing: (!configured).then(|| "an API key for chat completion".to_string()),
        };

        let both = [
            configured(ProviderRole::Speech, true),
            configured(ProviderRole::Chat, true),
        ];
        assert!(aggregate_credential("groq", &both).configured);

        let half = [
            configured(ProviderRole::Speech, true),
            configured(ProviderRole::Chat, false),
        ];
        let folded = aggregate_credential("groq", &half);
        assert!(
            !folded.configured,
            "a connection whose chat role cannot pay is not a configured connection",
        );
        assert_eq!(folded.key_preview.as_deref(), Some("gsk_...4f2a"));

        assert!(
            !aggregate_credential("groq", &[]).configured,
            "a provider with no roles has no credential to be configured",
        );
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
