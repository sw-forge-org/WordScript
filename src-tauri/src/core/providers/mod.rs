use serde::{Deserialize, Serialize};

pub mod credential_store;
pub mod groq;
pub mod local;
pub mod openai;
pub mod openai_compatible;
pub mod openrouter;
pub mod registry;
pub mod self_hosted;

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

/// One thing WordScript does with a provider (ADR 0094).
///
/// **The unit an override is stored at, and the unit a credential resolves
/// for.** A role says *what kind of call this is*; a job says *which of this
/// machine's uses of that kind* — three jobs run the `Speech` role and five run
/// `Chat`, and the whole point of the axis is that they may run it on different
/// vendors. The eight names are `src/screens/data.ts`'s `JobKey`, which the
/// `AI Models` matrix has drawn one column per since Leg 6; ADR 0109 and
/// ADR 0119 add the ninth and tenth with the row that operates them.
///
/// **Two of the eight have no call site in this build**, and that is the
/// honest state rather than an omission: `Meetings` and `Upload` are drawn
/// columns whose runtime path does not exist — there is one transcription path
/// and it is `Dictation`. They are variants here because the axis is the
/// drawing's and an override stored against one of them must survive the build
/// that grows its path, not because something routes to them today.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum JobKey {
    Dictation,
    Meetings,
    Upload,
    Cleanup,
    Rewrite,
    Translate,
    Enhance,
    Assistant,
}

impl JobKey {
    /// Drawn order — the order the `AI Models` matrix lists its rows in, and
    /// the order an override map iterates in.
    pub const ALL: [JobKey; 8] = [
        Self::Dictation,
        Self::Meetings,
        Self::Upload,
        Self::Cleanup,
        Self::Rewrite,
        Self::Translate,
        Self::Enhance,
        Self::Assistant,
    ];

    /// The stable id an override is keyed by on disk. Changing one of these
    /// strings silently drops the override stored under it.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Dictation => "dictation",
            Self::Meetings => "meetings",
            Self::Upload => "upload",
            Self::Cleanup => "cleanup",
            Self::Rewrite => "rewrite",
            Self::Translate => "translate",
            Self::Enhance => "enhance",
            Self::Assistant => "assistant",
        }
    }

    /// Which kind of call this job makes, and therefore which credential
    /// answers for it (ADR 0105).
    ///
    /// **This is the whole bridge between the two axes.** A job resolves a
    /// provider; the role decides which of that provider's credentials is
    /// spent. Nothing else may derive a role from a job, because a second
    /// mapping is a second place for the two to disagree.
    pub fn role(&self) -> ProviderRole {
        match self {
            Self::Dictation | Self::Meetings | Self::Upload => ProviderRole::Speech,
            Self::Cleanup | Self::Rewrite | Self::Translate | Self::Enhance | Self::Assistant => {
                ProviderRole::Chat
            }
        }
    }

    /// Phrased for a sentence on a settings row, not for a log line.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Dictation => "dictation",
            Self::Meetings => "meetings",
            Self::Upload => "uploads",
            Self::Cleanup => "cleanup",
            Self::Rewrite => "rewrite",
            Self::Translate => "translate",
            Self::Enhance => "prompt enhance",
            Self::Assistant => "the assistant",
        }
    }
}

/// What one job runs on, and what pays for it (ADR 0094).
///
/// **The provider and the credential travel together and neither is available
/// without the other.** That is the record's security rule expressed as a
/// type: an override changes the host a request goes to, and a key resolved
/// before that change is a credential sent to a host it was never entered for.
/// A caller holding this value cannot take the provider and reach for a
/// credential from somewhere else, because the only credential door on the
/// resolution is [`JobProvider::credential`] and it reads the provider beside
/// it.
///
/// The keyring is not touched to build one. `credential()` is a method rather
/// than a field for the reason `Provider::capabilities` is separate from
/// `Provider::status` (ADR 0110): every transform on the hot path needs the
/// provider, and none of them needs a secret-store read to name it — the
/// adapter behind the call loads the key itself, keyed by the very provider on
/// the request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JobProvider {
    pub job: JobKey,
    /// The connection the job actually runs on: its own override, or the
    /// profile's default when it has none (ADR 0208).
    ///
    /// **This is the credential's scope**, so it travels beside the provider
    /// for the same reason the provider travels beside the job: a caller
    /// holding this cannot reach for an account that belongs to another
    /// connection, because there is no id here but this one.
    pub connection: String,
    /// The vendor behind that connection.
    ///
    /// **Derived, never stored twice.** The profile names a connection and the
    /// connection names the vendor; empty means the profile names a connection
    /// this machine no longer holds, which is a state the surface states and
    /// the runtime refuses rather than repairs.
    pub provider: String,
    /// Whether the job named this provider itself. It is what decides whether a
    /// surface draws a key row of its own for the job (ADR 0094), and it is not
    /// derivable afterwards — an override that happens to name the same vendor
    /// as the connection is still an override.
    pub overridden: bool,
    /// The model this job was told to run on, as stored, and empty where the
    /// profile named none (ADR 0211).
    ///
    /// **Beside the provider for the reason the connection is beside it**: a
    /// model id is only meaningful for a vendor, so a caller holding this cannot
    /// pair a model with a vendor that never served it. Read through
    /// [`JobProvider::named_model`] rather than directly — this field is what
    /// was stored, that method is what may be sent.
    pub model: String,
}

impl JobProvider {
    pub fn role(&self) -> ProviderRole {
        self.job.role()
    }

    /// The model this job runs on, where the profile named one **and this job's
    /// vendor serves it** (ADR 0211).
    ///
    /// `None` means *fall back to the profile's default for this role*, and it
    /// covers two states on purpose: nothing was named, or what was named belongs
    /// to somebody else. The second is a value left behind by a connection
    /// change, and it is the one worth refusing here — sending it either spends a
    /// request to be told the model does not exist, or gets silently swapped for
    /// the vendor's own default by the adapter (`openai::resolve_model`,
    /// `openrouter`), which leaves the surface naming one model and the log
    /// another. The lie is quieter than the failure and therefore worse
    /// (ADR 0067).
    ///
    /// **An id the catalogue has never seen passes** (ADR 0115). It is a typed
    /// override — a vendor's newest model, or the id somebody's own server
    /// answers to, which publishes no list at all — and refusing it would make
    /// this build's read-date the limit of what the product can run.
    ///
    /// A job whose connection resolves to no vendor answers `None`: there is
    /// nothing to check the id against, and a job with no vendor is inert anyway
    /// (`credential`).
    pub fn named_model(&self) -> Option<&str> {
        let named = self.model.trim();
        if named.is_empty() || self.provider.is_empty() {
            return None;
        }

        match super::model_catalogue::provider_for_model_id(named, self.role()) {
            Some(owner) if owner != self.provider => None,
            _ => Some(named),
        }
    }

    /// What answers for this job, resolved from the provider this job runs on.
    ///
    /// **Never the connection's credential when the job overrides**, and never
    /// another role's when this one has none: both are `resolve_role_credential`'s
    /// contract (ADR 0105), and this method exists so that no call site has to
    /// restate the pair correctly on its own.
    pub fn credential(&self) -> Result<RoleCredentialStatus, ProviderCommandError> {
        if self.provider.is_empty() {
            return Err(ProviderCommandError::invalid_request(format!(
                "The connection {} runs on no longer exists. Pick one on AI Models.",
                self.job.label(),
            )));
        }

        resolve_role_credential(&self.connection, &self.provider, self.role())
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
pub const LOCAL_PROVIDER_ID: &str = "local";

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
    capture_limits_if_known(provider, model, tier_id)
        .unwrap_or_else(ProviderCaptureLimits::unbounded)
}

/// The same question, with the two answers `capture_limits` folds together kept
/// apart (B7).
///
/// `capture_limits` returns `unbounded()` both for a lane that declares no limit
/// and for a provider this build has never heard of, and for its caller that is
/// right: the capture budget wants a number and the configured maximum is the
/// honest one in either case. **Asked in the other direction it is not right.**
/// *This lane is not bound by request size* and *this build cannot answer for
/// that vendor* are different sentences to put under a greyed option, and
/// collapsing them would tell a user their file fits a provider nothing here
/// knows anything about — the missing-field-is-not-a-false rule (ADR 0106) one
/// axis over.
pub fn capture_limits_if_known(
    provider: &str,
    model: &str,
    tier_id: &str,
) -> Option<ProviderCaptureLimits> {
    registry::resolve_entry(provider)
        .ok()
        .and_then(|entry| entry.speech)
        .map(|speech| speech.capture_limits(model, tier_id))
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

/// One provider this build holds an adapter for, and what it serves.
///
/// **The seam's first question, and the one `provider_status` cannot answer**
/// (ADR 0124). A screen drawing ten vendors needs to know which of them the
/// registry knows at all before it can ask anything else about them: a vendor
/// missing from this list has no adapter (ADR 0096), one present whose `roles`
/// omit a role is denied by the lane (ADR 0106), and only the second of those
/// is a question `provider_status` has an answer for.
///
/// **It reads nothing.** No secret store, no local probe, no network — which is
/// exactly why `Provider::capabilities` was split from `Provider::status` in the
/// first place (A2). Asking ten times for a screen that opens is a cost the
/// split exists to avoid, and a keyring prompt is not a thing a settings screen
/// may trigger by being looked at.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RegisteredProvider {
    /// The canonical id, never an alias.
    pub provider: String,
    /// The roles the entry registered, in `ProviderRole::ALL` order. Derived
    /// from the entry rather than declared beside it, so it cannot claim a role
    /// with no implementation behind it.
    pub roles: Vec<ProviderRole>,
    pub capabilities: ProviderCapabilities,
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

/// Which of the two doors supplied the `Your server` lane's endpoint
/// (D1b, ADR 0165).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SelfHostedSource {
    /// Typed on the connection card and stored in `AppConfig`. It outranks the
    /// environment, which is what makes the field on that card honest.
    Config,
    /// Read from the environment — where a machine nobody has typed on starts,
    /// and where every installation configured before D1b still is.
    Environment,
    /// Neither door answered.
    Unset,
}

/// The `Your server` lane's endpoint as the runtime resolved it (D1b, ADR 0165).
///
/// **A lane-specific block on the shared status, exactly as `local_setup` is
/// one**, and for the same reason: the question is real, it is one lane's, and
/// folding it into a field that means something else is how a screen ends up
/// with two facts under one name.
///
/// **It exists so no surface has to derive the precedence for itself.** A
/// second implementation of *typed outranks environment* in TypeScript would
/// print a URL that is not the one in force the first time the order changed —
/// and this screen has grown four separate copies of one fact already
/// (ADR 0160, 0161, 0162, 0164).
///
/// It carries no token and no preview of one: what is stored for this lane is a
/// credential and travels where every other credential does, in
/// `role_credentials`.
#[derive(Debug, Clone, Serialize)]
pub struct SelfHostedEndpointStatus {
    /// The base URL that would be used — **including one that was refused**,
    /// because a row that blanked what the user typed would ask them to fix
    /// something it declined to show them. `None` when neither door answered.
    pub base_url: Option<String>,
    pub base_url_source: SelfHostedSource,
    /// Why this URL cannot be used, when it cannot.
    ///
    /// **The parts of the fold, not a second copy of it.** `RoleCredentialStatus::missing`
    /// answers *why can this lane not run a job* in one sentence, which is what
    /// the job rows read; the connection card has one row per thing that can be
    /// wrong and has to know WHICH is. That is the same relationship
    /// `credential` and `role_credentials` already have on this struct.
    pub base_url_problem: Option<String>,
    /// The model id sent when a job names none, and where it came from.
    pub model: Option<String>,
    pub model_source: SelfHostedSource,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderStatus {
    pub provider: String,
    /// Which account this answer is about — the request's value, echoed back
    /// (ADR 0209).
    ///
    /// **The request has carried the account since ADR 0208 and the answer did
    /// not**, so a surface holding a status could not tell whose credential it
    /// was describing. It has to: the status is keyed by VENDOR on the way in to
    /// keep one screen open to one keyring read (ADR 0124), while the rows that
    /// render a credential are scoped to an ACCOUNT. Without the echo, a vendor
    /// with two accounts had one answer and two rows, and the badge described a
    /// different account from the field beneath it.
    ///
    /// **The adapters do not fill this in and cannot get it wrong.** They emit an
    /// empty string and `provider_status` stamps the account it was asked about,
    /// because an adapter restating an argument it was handed adds nothing except
    /// a fifth place for the two to drift apart.
    ///
    /// Empty means *no account was named*, which is what the Local lane's probe
    /// sends: that lane stores no credential and has nothing to name.
    pub connection: String,
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
    /// The `Your server` lane's endpoint, and `None` for every other lane
    /// (D1b, ADR 0165) — the shape `local_setup` has for the disk.
    pub self_hosted_endpoint: Option<SelfHostedEndpointStatus>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProviderStatusRequest {
    pub provider: String,
    /// Which account this status is about (ADR 0208).
    ///
    /// **The vendor names the adapter and the connection names the account**,
    /// which is why both travel: a status answers *what does this vendor do*
    /// from the registry and *is there a key* from the OS store, and only the
    /// second question has an account in it.
    ///
    /// Empty is a legitimate request and means *no account named* — it is what
    /// the machine tab's local probe sends, because that lane stores no
    /// credential and has nothing to name. On a lane that does, an empty
    /// connection answers `configured: false` rather than inventing one.
    #[serde(default)]
    pub connection: String,
    pub model: Option<String>,
    pub correction_model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaveProviderApiKeyRequest {
    pub provider: String,
    /// The account this key belongs to — the scope it is stored under
    /// (ADR 0208).
    #[serde(default)]
    pub connection: String,
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
    /// The account being cleared. **Clearing one connection never clears
    /// another's**, which is ADR 0105's rule one axis out: two accounts on one
    /// vendor are two keys, and forgetting the scope here would sign the reader
    /// out of the profile they were not looking at.
    #[serde(default)]
    pub connection: String,
    /// Absent means every role this provider serves, for the named kind only.
    /// **Clearing one role never clears another's** (ADR 0105), and clearing a
    /// key never reaches a subscription: "remove the key" is not "sign out".
    #[serde(default)]
    pub role: Option<ProviderRole>,
    #[serde(default)]
    pub kind: Option<CredentialKind>,
}

/// Forget everything one account holds, because the account is going
/// (ADR 0210).
#[derive(Debug, Clone, Deserialize)]
pub struct ClearConnectionCredentialsRequest {
    pub provider: String,
    /// The account being removed, and the scope every entry this reaches is
    /// stored under. **Empty clears nothing**, rather than clearing an entry
    /// named `.speech.api_key` that belongs to no account.
    #[serde(default)]
    pub connection: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ValidateProviderApiKeyRequest {
    pub provider: String,
    /// Whose stored key to check when `api_key` is absent (ADR 0208).
    #[serde(default)]
    pub connection: String,
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
    /// Which account pays for this call, and — on the lane that types its own —
    /// which server it goes to (ADR 0208).
    ///
    /// **Carried on the request rather than read from the config at the
    /// adapter**, for the reason the capture snapshots everything else: the
    /// session runs on the connection it started on, and a profile switched
    /// between the recording and the retry does not redirect a call that is
    /// already in flight.
    #[serde(default)]
    pub connection: String,
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

/// The fraction of the audio a recognizer may leave uncovered before the
/// transcript has to say so.
///
/// Deliberately the same 10 % as `CAPTURE_GAP_THRESHOLD` in `core::capture`.
/// The user who reports "half of my dictation is gone" does not know which
/// side of the seam lost it, and two thresholds would put the same sentence on
/// two different numbers.
const TRANSCRIPTION_GAP_THRESHOLD: f64 = 0.10;

/// Below this the ratio carries no information, for the same reason
/// `CAPTURE_INTEGRITY_MIN_WALL_SECONDS` exists: on a short clip a single
/// trailing breath is already several percent.
const TRANSCRIPTION_COVERAGE_MIN_SECONDS: f64 = 2.0;

/// A ratio alone would call an ordinary pause a truncation, so the gap must
/// also be large in absolute terms.
///
/// The exported file is silence-trimmed before it is uploaded
/// (`trim_leading_trailing_silence`), so a healthy transcript's last segment
/// ends within a breath of the audio. Two seconds sits above what a trim
/// leaves behind and an order of magnitude below the observed case: 72.1 s of
/// audio whose transcript stopped mid-sentence.
const TRANSCRIPTION_UNCOVERED_FLOOR_SECONDS: f64 = 2.0;

/// Whether a transcript reaches the end of the audio it was made from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionCoverageVerdict {
    /// The segments run to the end of the audio.
    Complete,
    /// The recognizer stopped before the audio did. The transcript is of the
    /// beginning of the dictation, it is fluent and plausible, and nothing
    /// downstream has any evidence that the rest was ever spoken.
    Truncated,
    /// No segments, no duration, or audio too short for the ratio to mean
    /// anything. Deliberately not `Complete`: "we did not look" and "we looked
    /// and it was fine" are different facts.
    NotMeasured,
}

/// The comparison the response already carried and nobody made: how long the
/// audio was against how far the segments got.
///
/// `verbose_json` returns `duration` and a segment list, and both were parsed
/// and then only `text` was read. On 2026-08-12 a 72.1 s dictation came back as
/// 424 characters ending mid-sentence while the capture read
/// `missing_ratio=0.0004 verdict=Intact` and the provider itself reported
/// `duration=72.144437248` — the audio was complete and the transcript was not.
///
/// This is the same instrument as `CaptureIntegrity` one stage later: it names
/// a loss at the moment it stops being recoverable, on the other side of the
/// seam. `CaptureIntegrity` answers whether the audio reached the file;
/// this answers whether the file reached the transcript.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct TranscriptionCoverage {
    pub duration_seconds: f64,
    /// Where the last segment ends. Whisper segments are contiguous from zero,
    /// so the end of the last one is how far the recognizer got.
    pub covered_seconds: f64,
    /// The fraction of the audio no segment covers, clamped to 0..=1.
    pub uncovered_ratio: f64,
    /// The last segment's own confidence. A decoder that stopped early tends to
    /// end on a poor one, which is what separates a truncation from a dictation
    /// that simply ended in silence.
    pub last_segment_avg_logprob: Option<f64>,
    pub verdict: TranscriptionCoverageVerdict,
}

impl TranscriptionCoverage {
    fn new(duration: Option<f64>, segments: Option<&[TranscriptionSegment]>) -> Self {
        let Some(duration_seconds) = duration.filter(|value| *value > 0.0) else {
            return Self::unmeasured();
        };
        let Some(segments) = segments else {
            return Self::unmeasured();
        };

        let last = segments.last();
        let covered_seconds = last.map(|segment| segment.end).unwrap_or(0.0).max(0.0);
        let uncovered_seconds = (duration_seconds - covered_seconds).max(0.0);
        let uncovered_ratio = (uncovered_seconds / duration_seconds).clamp(0.0, 1.0);

        let verdict = if duration_seconds < TRANSCRIPTION_COVERAGE_MIN_SECONDS {
            TranscriptionCoverageVerdict::NotMeasured
        } else if uncovered_ratio >= TRANSCRIPTION_GAP_THRESHOLD
            && uncovered_seconds >= TRANSCRIPTION_UNCOVERED_FLOOR_SECONDS
        {
            TranscriptionCoverageVerdict::Truncated
        } else {
            TranscriptionCoverageVerdict::Complete
        };

        Self {
            duration_seconds,
            covered_seconds,
            uncovered_ratio,
            last_segment_avg_logprob: last.and_then(|segment| segment.avg_logprob),
            verdict,
        }
    }

    fn unmeasured() -> Self {
        Self {
            duration_seconds: 0.0,
            covered_seconds: 0.0,
            uncovered_ratio: 0.0,
            last_segment_avg_logprob: None,
            verdict: TranscriptionCoverageVerdict::NotMeasured,
        }
    }

    pub fn is_truncated(&self) -> bool {
        self.verdict == TranscriptionCoverageVerdict::Truncated
    }

    /// One line, in the shape `Capture integrity` already writes, so a reader
    /// comparing the two stages of one dictation is comparing like with like.
    /// It lives here rather than in an adapter because every adapter that
    /// returns segments answers the same question.
    pub fn log_line(&self) -> String {
        let logprob = self
            .last_segment_avg_logprob
            .map(|value| format!("{value:.3}"))
            .unwrap_or_else(|| "n/a".to_string());

        format!(
            "[WordScript] Transcription coverage duration_seconds={:.3} covered_seconds={:.3} uncovered_ratio={:.4} last_segment_avg_logprob={} verdict={:?}",
            self.duration_seconds, self.covered_seconds, self.uncovered_ratio, logprob, self.verdict,
        )
    }
}

impl TranscriptionResponse {
    pub fn coverage(&self) -> TranscriptionCoverage {
        TranscriptionCoverage::new(self.duration, self.segments.as_deref())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub provider: String,
    /// Which account pays for this call (ADR 0208). Every chat job resolves it
    /// from its own `JobProvider`, so a profile transforming on its employer's
    /// account and dictating on a private one is two connections and not one.
    #[serde(default)]
    pub connection: String,
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

/// Whether this build can resolve the id at all.
///
/// The half of `normalize_provider_value` that does *not* substitute the
/// default. A per-job override needs it: an id this build cannot resolve has to
/// be dropped so the job reads as *follow the connection*, and normalising it
/// onto Groq instead would leave a row silently claiming the user chose the
/// connection's vendor.
pub fn resolves_to_a_known_provider(provider: &str) -> bool {
    registry::resolve_entry(provider).is_ok()
}

pub fn default_provider_id() -> &'static str {
    DEFAULT_PROVIDER_ID
}

/// Whether every role this provider serves has a credential.
///
/// The fold `aggregate_credential` states, without building the whole status:
/// the local lane's status probes the runner and the model, and this question
/// does not need either.
pub fn provider_credentials_configured(
    connection: &str,
    provider: &str,
) -> Result<bool, ProviderCommandError> {
    let entry = registry::resolve_entry(provider)?;
    let roles = role_credentials(connection, entry)?;

    Ok(aggregate_credential(entry.id, &roles).configured)
}

/// Every role this provider registered, answered for one connection.
fn role_credentials(
    connection: &str,
    entry: &'static ProviderEntry,
) -> Result<Vec<RoleCredentialStatus>, ProviderCommandError> {
    entry
        .roles()
        .into_iter()
        .map(|role| entry.provider.credential_status(connection, role))
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

/// Every provider this build can operate, and the roles each one serves.
///
/// **One call for the whole table** (ADR 0124). The alternative the record
/// weighed was asking `provider_status` once per drawn vendor, which reads the
/// OS secret store and probes the local runtime once per vendor — and answers
/// most of them with `Err("not supported yet")`, making an error the normal
/// result for the majority of a screen. Absence from this list is how *no
/// adapter* is stated, and stating it is what lets a surface tell it apart from
/// *the lane denies that role*.
///
/// It takes no argument on purpose: a filtered list would be the caller's
/// drawing deciding what the runtime may admit to registering.
#[tauri::command]
pub fn registered_providers() -> Vec<RegisteredProvider> {
    registry::entries()
        .iter()
        .map(|entry| RegisteredProvider {
            provider: entry.id.to_string(),
            roles: entry.roles(),
            capabilities: entry.provider.capabilities(),
        })
        .collect()
}

/// **A KEY MAY NOT BE WRITTEN INTO ANOTHER VENDOR'S ACCOUNT** (ADR 0094's one
/// security rule, made structural).
///
/// **The secret-store entry is keyed by `connection.role.kind` and carries no
/// vendor** (`credential_store::entry_user`), which is correct — an account is
/// the thing a credential belongs to — and it means the pair arriving here is
/// the only thing standing between a Groq key and the slot the self-hosted
/// adapter reads its bearer token from. Until this check the surface could send
/// the pair `(groq, connection-self_hosted)` and the store took it: the key went
/// to the reader's own server on the next request, and the token that had been
/// there was gone. It was not a hypothetical — the surface did send it.
///
/// **A rule the surface has to remember is a rule that gets broken**, so this is
/// the runtime's own answer rather than a comment on a screen. Both writing
/// doors ask it; reading does not, because a read of the wrong slot answers
/// *nothing stored* and destroys nothing.
///
/// **An id no connection carries is allowed through, and that is not a hole.**
/// `patch` is optimistic: the surface writes a new account into its own copy of
/// the config and lets the disk catch up, so a key typed into a freshly created
/// account legitimately names an id this file has not seen yet. What is refused
/// is the case that can destroy something — an id this machine holds AND holds
/// for somebody else.
fn refuse_foreign_account(provider: &str, connection: &str) -> Result<(), ProviderCommandError> {
    let connection = connection.trim();
    if connection.is_empty() {
        return Ok(());
    }

    let config = crate::core::config::AppConfig::load_from_disk();
    refuse_foreign_account_in(config.connections(), provider, connection)
}

/// The rule itself, against a list rather than against the disk.
fn refuse_foreign_account_in(
    connections: &[crate::core::config::Connection],
    provider: &str,
    connection: &str,
) -> Result<(), ProviderCommandError> {
    let Some(entry) = connections.iter().find(|entry| entry.id == connection) else {
        return Ok(());
    };

    if entry.provider == provider {
        return Ok(());
    }

    /* The account's own name, because that is what the reader picked it by. An
       id is the fallback for a connection whose label was cleared by hand. */
    let named = if entry.label.trim().is_empty() {
        entry.id.as_str()
    } else {
        entry.label.as_str()
    };

    Err(ProviderCommandError::invalid_request(format!(
        "The account '{named}' belongs to {}, not to {provider}. A credential is stored under the account, so writing this one there would overwrite {}'s and be sent to it.",
        entry.provider, entry.provider,
    )))
}

#[tauri::command]
pub fn provider_status(
    request: ProviderStatusRequest,
) -> Result<ProviderStatus, ProviderCommandError> {
    let mut status = registry::resolve_entry(&request.provider)?
        .provider
        .status(&request)?;
    /* THE ONE PLACE THE ACCOUNT IS STAMPED (ADR 0209). Here rather than in each
       adapter, because the fact being reported is *which account was asked
       about* — which this function holds and an adapter can only copy. Five
       copies of one argument is five chances for a status to name an account it
       did not read. */
    status.connection = request.connection.trim().to_string();
    Ok(status)
}

#[tauri::command]
pub fn save_provider_api_key(
    request: SaveProviderApiKeyRequest,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    let entry = registry::resolve_entry(&request.provider)?;
    /* BEFORE ANYTHING IS WRITTEN. The store overwrites what is under a slot, so
       a refusal that came after the first role had been saved would already have
       destroyed the token it exists to protect. */
    refuse_foreign_account(&request.provider, &request.connection)?;
    let kind = request.kind.unwrap_or(CredentialKind::DEFAULT);

    for role in credential_target_roles(entry, request.role, kind)? {
        entry
            .provider
            .save_api_key(&request.connection, role, kind, &request.api_key)?;
    }

    Ok(aggregate_credential(
        entry.id,
        &role_credentials(&request.connection, entry)?,
    ))
}

#[tauri::command]
pub fn clear_provider_api_key(
    request: ClearProviderApiKeyRequest,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    let entry = registry::resolve_entry(&request.provider)?;
    /* A DELETION IS A WRITE. Clearing `(groq, connection-self_hosted)` reaches
       the slot the server's token lives in and empties it — the same crossing as
       a save, with nothing typed to make it look deliberate. */
    refuse_foreign_account(&request.provider, &request.connection)?;
    let kind = request.kind.unwrap_or(CredentialKind::DEFAULT);

    for role in credential_target_roles(entry, request.role, kind)? {
        entry
            .provider
            .clear_api_key(&request.connection, role, kind)?;
    }

    Ok(aggregate_credential(
        entry.id,
        &role_credentials(&request.connection, entry)?,
    ))
}

/// Moves every credential stored under a vendor id onto the connection that
/// owns it now (ADR 0208).
///
/// **The registry decides what there is to move**, so a vendor that registers
/// one role has one entry looked for and a vendor that accepts two kinds has
/// two — the same table that decides where a credential may be stored decides
/// what a migration carries. An id no adapter claims moves nothing, because
/// nothing could have been stored under it.
///
/// Returns how many entries moved, which is what makes this testable against an
/// in-memory store without asking the caller to guess how many there should
/// have been.
pub fn rekey_connection_credentials(
    store: &impl credential_store::SecretStore,
    provider: &str,
    connection: &str,
) -> Result<usize, keyring::Error> {
    let Ok(entry) = registry::resolve_entry(provider) else {
        return Ok(0);
    };

    let mut moved = 0;
    for role in entry.roles() {
        for kind in entry.provider.credential_kinds() {
            if credential_store::rekey(store, provider, connection, role, *kind)? {
                moved += 1;
            }
        }
    }

    Ok(moved)
}

/// Forgets every credential one account holds, because the account is going
/// (ADR 0210).
///
/// **The other end of [`rekey_connection_credentials`], and it exists because
/// the delete button built the state the migration was written to avoid.** That
/// function MOVES rather than copies, on the argument ADR 0208 states: a key
/// left behind under a name nothing points at is a secret no surface can show
/// and no reader can clear. Removing the account it was moved onto then left the
/// key under the account's own name, which is the same orphan reached from the
/// other side.
///
/// **The registry decides what there is to forget**, exactly as it decides what
/// there is to move — the same table, walked the same way, so a vendor that
/// registers a second role tomorrow is covered here without a line.
///
/// Returns how many entries were carrying something, which is what makes this
/// testable against an in-memory store without the test knowing what this
/// machine happened to hold. An id no adapter claims forgets nothing: nothing
/// could have been stored under it.
pub fn clear_connection_credentials_in(
    store: &impl credential_store::SecretStore,
    provider: &str,
    connection: &str,
) -> Result<usize, keyring::Error> {
    let connection = connection.trim();
    if connection.is_empty() {
        return Ok(0);
    }

    let Ok(entry) = registry::resolve_entry(provider) else {
        return Ok(0);
    };

    let mut cleared = 0;
    for role in entry.roles() {
        for kind in entry.provider.credential_kinds() {
            if credential_store::clear_stored(store, connection, role, *kind)? {
                cleared += 1;
            }
        }
    }

    Ok(cleared)
}

/// **The credential half of removing an account, and it runs first** (ADR 0210).
///
/// The surface clears before it writes the config: a config write that landed
/// while the keyring call failed would leave the orphan with nothing naming it,
/// and this call is the only one that still knows the account's id.
#[tauri::command]
pub fn clear_connection_credentials(
    request: ClearConnectionCredentialsRequest,
) -> Result<usize, ProviderCommandError> {
    /* The third writing door, under the same rule as the other two. This one
       walks every role the named VENDOR registers and empties that many slots
       under the named ACCOUNT, so a crossed pair forgets somebody else's
       credentials wholesale rather than one of them. */
    refuse_foreign_account(&request.provider, &request.connection)?;
    clear_connection_credentials_in(
        &credential_store::OsSecretStore,
        &request.provider,
        &request.connection,
    )
    .map_err(|error| {
        ProviderCommandError::new(
            ProviderErrorKind::SecretStoreUnavailable,
            format!(
                "The OS secret store did not answer, so this account still holds its credential: {error}"
            ),
            None,
            None,
        )
    })
}

/// What answers for one job's role on one provider (ADR 0105).
///
/// **"Follow the connection" follows the provider and never the credential**,
/// so the caller resolves the provider first — from the job's override, or from
/// the connection when there is none — and asks this for the role the job runs
/// in. A role with no credential answers `configured: false` and names what is
/// missing; it never returns the other kind the same provider holds.
pub fn resolve_role_credential(
    connection: &str,
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

    entry.provider.credential_status(connection, role)
}

#[tauri::command]
pub async fn validate_provider_api_key(
    request: ValidateProviderApiKeyRequest,
) -> Result<ValidateProviderApiKeyResponse, ProviderCommandError> {
    registry::resolve_entry(&request.provider)?
        .provider
        .validate_api_key(&request.connection, request.api_key)
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

    /// An id no adapter will ever claim.
    ///
    /// **Six tests here and in `config.rs` used to spell `openai` for this**,
    /// which made them assertions about the shape of the registry on the day
    /// they were written rather than about the fallback they were testing —
    /// and D1 failed all six by registering the vendor ADR 0096 scheduled
    /// first. A registry with ten entries would have retired the stand-in ten
    /// times. This one is retired never, and it says what it means.
    const UNREGISTERABLE_ID: &str = "not-a-vendor-this-build-carries";

    /// **A STATUS SAYS WHICH ACCOUNT IT IS ABOUT, FOR EVERY REGISTERED VENDOR**
    /// (ADR 0209).
    ///
    /// The echo exists so a surface holding a status can tell whether it is the
    /// account it is rendering — the check is worth nothing if one adapter
    /// forgets to answer, and the adapters are exactly where it must not be
    /// possible to forget. So this walks the registry rather than naming a
    /// vendor: `provider_status` stamps the value after the adapter answers, and
    /// an adapter added tomorrow is covered without a line here.
    ///
    /// The keyring is read on the way through, which is why the assertion is
    /// only about the echo: whether a key is stored on THIS machine is not
    /// something a test may assume either way.
    #[test]
    fn every_status_names_the_account_it_was_asked_about() {
        for entry in registry::entries() {
            let status = provider_status(ProviderStatusRequest {
                provider: entry.id.to_string(),
                connection: "  connection-work  ".to_string(),
                model: None,
                correction_model: None,
            });

            let Ok(status) = status else { continue };
            assert_eq!(
                status.connection, "connection-work",
                "{} answered about a different account than the one it was asked about",
                entry.id,
            );
        }
    }

    /// Two accounts on two vendors, which is the pair the rule is about.
    fn two_vendors() -> Vec<crate::core::config::Connection> {
        vec![
            crate::core::config::Connection {
                id: "connection-default".to_string(),
                label: "Groq".to_string(),
                provider: "groq".to_string(),
                ..Default::default()
            },
            crate::core::config::Connection {
                id: "connection-self_hosted".to_string(),
                label: "Home box".to_string(),
                provider: "self_hosted".to_string(),
                ..Default::default()
            },
        ]
    }

    /// **A KEY TYPED FOR ONE VENDOR MAY NOT REACH ANOTHER VENDOR'S ACCOUNT.**
    ///
    /// The store keys a secret by `connection.role.kind` and carries no vendor,
    /// so this pair is the whole of the protection: `(groq, connection-self_hosted)`
    /// writes into the slot `self_hosted` reads its bearer token from, and the
    /// next transcription sends a Groq key to the reader's own machine.
    #[test]
    fn a_key_may_not_be_written_into_another_vendors_account() {
        let refused = refuse_foreign_account_in(&two_vendors(), "groq", "connection-self_hosted");

        let error = refused.expect_err("a crossed pair was accepted");
        assert!(
            error.message.contains("Home box"),
            "the refusal names the vendor rather than the account the reader picked: {}",
            error.message,
        );
    }

    /// The ordinary case, and the one that must not be caught by the rule.
    #[test]
    fn a_key_reaches_its_own_vendors_account() {
        assert!(refuse_foreign_account_in(&two_vendors(), "groq", "connection-default").is_ok());
    }

    /// **AN ID THIS MACHINE DOES NOT HOLD IS NOT A CROSSING, AND REFUSING IT
    /// WOULD BREAK THE ORDINARY PATH.** `patch` is optimistic: the surface
    /// creates an account in its own copy of the config and lets the disk catch
    /// up, so the first key typed into a new account legitimately names an id
    /// this file has never seen.
    #[test]
    fn an_account_this_machine_does_not_hold_yet_is_let_through() {
        assert!(refuse_foreign_account_in(&two_vendors(), "groq", "connection-groq-2").is_ok());
    }

    /// An empty connection is *no account named* and is a legitimate request
    /// (`ProviderStatusRequest::connection`), so it is not a crossing either.
    #[test]
    fn naming_no_account_is_not_a_crossing() {
        assert!(refuse_foreign_account_in(&two_vendors(), "groq", "   ").is_ok());
    }

    /// **The migration moves the key, and the registry decides what there is
    /// to move** (ADR 0208). Groq registers speech and chat and accepts one
    /// kind, so a machine with both keys stored under the vendor id ends up
    /// with both under the connection — and with nothing left behind, because a
    /// copy would leave a secret no surface can reach.
    #[test]
    fn the_re_key_moves_every_entry_the_registry_knows_about() {
        use credential_store::{MemorySecretStore, SecretStore, KEY_SERVICE};

        let store = MemorySecretStore::default();
        store
            .write(KEY_SERVICE, "groq.speech.api_key", "gsk_speech")
            .unwrap();
        store
            .write(KEY_SERVICE, "groq.chat.api_key", "gsk_chat")
            .unwrap();

        let moved = rekey_connection_credentials(&store, "groq", "connection-default").unwrap();

        assert_eq!(moved, 2, "one per registered role, for the kind Groq accepts");
        assert_eq!(
            store.read(KEY_SERVICE, "connection-default.speech.api_key").unwrap(),
            Some("gsk_speech".to_string()),
        );
        assert_eq!(
            store.read(KEY_SERVICE, "connection-default.chat.api_key").unwrap(),
            Some("gsk_chat".to_string()),
        );
        assert_eq!(store.read(KEY_SERVICE, "groq.speech.api_key").unwrap(), None);
        assert_eq!(store.read(KEY_SERVICE, "groq.chat.api_key").unwrap(), None);
    }

    /// A vendor no adapter claims moves nothing, because nothing could have
    /// been stored under it — and a lane that stores no credential at all is
    /// the same answer for the opposite reason.
    #[test]
    fn the_re_key_is_silent_for_a_vendor_with_nothing_to_move() {
        use credential_store::MemorySecretStore;

        let store = MemorySecretStore::default();

        assert_eq!(
            rekey_connection_credentials(&store, UNREGISTERABLE_ID, "connection-default").unwrap(),
            0,
        );
        assert_eq!(
            rekey_connection_credentials(&store, LOCAL_PROVIDER_ID, "connection-local").unwrap(),
            0,
            "the local lane authenticates against nothing, so it carries nothing",
        );
    }

    /// **AN ACCOUNT REMOVED LEAVES NO ENTRY UNDER ITS SCOPE** (ADR 0210).
    ///
    /// The sentence the step exists for, and the one nothing checked: the
    /// migration was made to MOVE rather than copy because a key under a name
    /// nothing points at is unreachable from inside the product, and the delete
    /// button then created that state from the other end.
    #[test]
    fn removing_an_account_forgets_every_credential_it_held() {
        use credential_store::{MemorySecretStore, SecretStore, KEY_SERVICE};

        let store = MemorySecretStore::default();
        store
            .write(KEY_SERVICE, "connection-work.speech.api_key", "gsk_speech")
            .unwrap();
        store
            .write(KEY_SERVICE, "connection-work.chat.api_key", "gsk_chat")
            .unwrap();

        let cleared =
            clear_connection_credentials_in(&store, "groq", "  connection-work  ").unwrap();

        assert_eq!(cleared, 2, "one per registered role, for the kind Groq accepts");
        assert_eq!(
            store.read(KEY_SERVICE, "connection-work.speech.api_key").unwrap(),
            None,
        );
        assert_eq!(
            store.read(KEY_SERVICE, "connection-work.chat.api_key").unwrap(),
            None,
        );
    }

    /// **Clearing one account never clears another's** (ADR 0208's rule, which a
    /// removal is the loudest possible way to break). Two accounts on one vendor
    /// is the case the connection axis exists for, so the second key is the one
    /// worth asserting rather than a second vendor's.
    #[test]
    fn removing_an_account_leaves_the_other_account_on_that_vendor_alone() {
        use credential_store::{MemorySecretStore, SecretStore, KEY_SERVICE};

        let store = MemorySecretStore::default();
        store
            .write(KEY_SERVICE, "connection-work.speech.api_key", "gsk_work")
            .unwrap();
        store
            .write(KEY_SERVICE, "connection-private.speech.api_key", "gsk_private")
            .unwrap();

        clear_connection_credentials_in(&store, "groq", "connection-work").unwrap();

        assert_eq!(
            store.read(KEY_SERVICE, "connection-private.speech.api_key").unwrap(),
            Some("gsk_private".to_string()),
        );
    }

    /// A vendor no adapter claims forgets nothing, a lane that stores no
    /// credential forgets nothing, and an unnamed account forgets nothing — the
    /// last one because `{scope}` is the leading component of every entry name,
    /// so an empty scope is a prefix and not an account.
    #[test]
    fn a_removal_with_nothing_to_forget_is_not_a_failure() {
        use credential_store::{MemorySecretStore, SecretStore, KEY_SERVICE};

        let store = MemorySecretStore::default();
        store
            .write(KEY_SERVICE, ".speech.api_key", "belongs-to-no-account")
            .unwrap();

        assert_eq!(
            clear_connection_credentials_in(&store, UNREGISTERABLE_ID, "connection-work").unwrap(),
            0,
        );
        assert_eq!(
            clear_connection_credentials_in(&store, LOCAL_PROVIDER_ID, "connection-local").unwrap(),
            0,
            "the local lane authenticates against nothing, so it holds nothing",
        );
        assert_eq!(
            clear_connection_credentials_in(&store, "groq", "   ").unwrap(),
            0,
        );
        assert_eq!(
            store.read(KEY_SERVICE, ".speech.api_key").unwrap(),
            Some("belongs-to-no-account".to_string()),
            "an empty scope names no account, so nothing under it is this call's to delete",
        );
    }

    #[test]
    fn normalizes_provider_values_to_supported_ids() {
        assert_eq!(normalize_provider_value("groq"), "groq");
        assert_eq!(normalize_provider_value(" GrOq "), "groq");
        assert_eq!(normalize_provider_value("local"), "local");
        // ADR 0121 renamed the lane and kept no alias behind it: the retired id
        // is as unknown as any other, and lands on the default.
        assert_eq!(normalize_provider_value("local_preview"), "groq");
        assert_eq!(normalize_provider_value(""), "groq");
        // A SYNTHETIC ID, AND DELIBERATELY SO. This assertion used to name
        // `openai`, which made it a test about which vendors happen to be
        // registered rather than about the fallback — and D1 broke it by doing
        // the thing the plan scheduled. What it means is *an id this build
        // cannot resolve*, and only an id nothing will ever register says that
        // for good.
        assert_eq!(normalize_provider_value(UNREGISTERABLE_ID), "groq");
    }

    #[test]
    fn rejects_unknown_provider_dispatch() {
        let error = registry::resolve_entry(UNREGISTERABLE_ID).unwrap_err();

        assert!(matches!(error.kind, ProviderErrorKind::InvalidRequest));
        assert!(error.message.contains(UNREGISTERABLE_ID));
    }

    /// **The list is the table, not a copy of it** (ADR 0124). Walked over the
    /// registry rather than asserted against the two ids registered today, so
    /// the tenth adapter appears here without this test being edited — and a
    /// row that claimed a role its entry did not register would fail on the
    /// entry, which is where `registry.rs` already holds the same rule.
    #[test]
    fn the_registered_list_states_every_entry_and_the_roles_it_registered() {
        let listed = registered_providers();

        assert_eq!(listed.len(), registry::entries().len());

        for (row, entry) in listed.iter().zip(registry::entries()) {
            assert_eq!(row.provider, entry.id);
            assert_eq!(row.roles, entry.roles());
            assert_eq!(row.capabilities, entry.provider.capabilities());
            assert_eq!(
                row.roles.contains(&ProviderRole::Speech),
                row.capabilities.transcription,
                "{} lists roles {:?} and states transcription={}",
                row.provider,
                row.roles,
                row.capabilities.transcription,
            );
            assert_eq!(
                row.roles.contains(&ProviderRole::Chat),
                row.capabilities.chat_completion,
            );
            assert_eq!(
                row.roles.contains(&ProviderRole::Voice),
                row.capabilities.speech_synthesis,
            );
        }
    }

    /// **The absence is the answer** (ADR 0124, ADR 0096). A vendor the drawing
    /// names and the registry does not carry is missing from this list, and
    /// that is precisely how a surface says *no adapter* rather than inventing
    /// a capability block full of `false` — which would read as *this vendor
    /// cannot listen* about a vendor that listens perfectly well elsewhere.
    #[test]
    fn a_vendor_with_no_adapter_is_absent_rather_than_denied() {
        let listed = registered_providers();

        assert!(!listed
            .iter()
            .any(|row| row.provider == UNREGISTERABLE_ID));
        assert!(!resolves_to_a_known_provider(UNREGISTERABLE_ID));

        // And the two that are present are present with their roles, so the
        // absence above is the registry's answer and not an empty list.
        assert!(listed
            .iter()
            .any(|row| row.provider == DEFAULT_PROVIDER_ID && !row.roles.is_empty()));
        assert!(listed
            .iter()
            .any(|row| row.provider == LOCAL_PROVIDER_ID && !row.roles.is_empty()));
    }

    /// **A capability answer carries no credential.** The whole reason
    /// `capabilities()` is split from `status()` (A2) is that this question is
    /// answerable without reading the OS secret store — and the payload is
    /// where that would stop being true first, because the easy way to add a
    /// *ready* column later is to fold `credential.configured` into this row.
    ///
    /// Asserted on the serialized keys rather than on a substring search,
    /// because `requires_api_key` is a capability and would fail that search
    /// while carrying nothing — and asserted on the wire rather than on the
    /// struct, because the wire is what a second window and a log line see: an
    /// event is a path out of the runtime and this one must not become a second
    /// door to a key preview (ADR 0108's `without_secrets()`, same reason).
    ///
    /// **It pins the whole wire shape**, which is the other half of its worth:
    /// `src/lib/providerSeam.ts` reads exactly these keys, and a field renamed
    /// here without the mirror moving fails on this side first.
    #[test]
    fn the_registered_list_carries_no_credential_on_the_wire() {
        let payload = serde_json::to_value(registered_providers()).expect("the list serializes");
        let rows = payload.as_array().expect("the list is an array");
        assert!(!rows.is_empty());

        for row in rows {
            let row = row.as_object().expect("a row is an object");
            let mut keys: Vec<&str> = row.keys().map(String::as_str).collect();
            keys.sort_unstable();
            assert_eq!(
                keys,
                ["capabilities", "provider", "roles"],
                "the row carries a field the capability answer has no business in",
            );

            let capabilities = row["capabilities"]
                .as_object()
                .expect("the capability block is an object");
            let mut fields: Vec<&str> = capabilities.keys().map(String::as_str).collect();
            fields.sort_unstable();
            assert_eq!(
                fields,
                [
                    "chat_completion",
                    "local",
                    "model_management",
                    "requires_api_key",
                    "speech_synthesis",
                    "supports_language",
                    "supports_prompt_bias",
                    "supports_segments",
                    "transcription",
                ],
                "the nine fields the TypeScript mirror reads",
            );
        }
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

        let unknown_lane = model_capabilities(UNREGISTERABLE_ID, "some-model");
        assert_eq!(unknown_lane.model, "some-model");
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

    fn segment(start: f64, end: f64, avg_logprob: Option<f64>) -> TranscriptionSegment {
        TranscriptionSegment {
            id: 0,
            start,
            end,
            text: "…".to_string(),
            avg_logprob,
            no_speech_prob: None,
            compression_ratio: None,
        }
    }

    fn response(duration: Option<f64>, segments: Option<Vec<TranscriptionSegment>>) -> TranscriptionResponse {
        TranscriptionResponse {
            text: "…".to_string(),
            language: Some("de".to_string()),
            duration,
            segments,
        }
    }

    #[test]
    fn a_transcript_that_reaches_the_end_of_the_audio_is_complete() {
        let coverage = response(
            Some(72.144),
            Some(vec![segment(0.0, 36.0, Some(-0.21)), segment(36.0, 71.8, Some(-0.19))]),
        )
        .coverage();

        assert_eq!(coverage.verdict, TranscriptionCoverageVerdict::Complete);
        assert!(!coverage.is_truncated());
        assert!(coverage.uncovered_ratio < 0.01, "{coverage:?}");
    }

    /// The observed case, 2026-08-12: 72.1 s of audio the capture read as
    /// `Intact`, and a transcript that stopped mid-sentence.
    #[test]
    fn a_recognizer_that_stopped_early_is_named_rather_than_delivered_whole() {
        let coverage = response(
            Some(72.144),
            Some(vec![segment(0.0, 38.1, Some(-0.94))]),
        )
        .coverage();

        assert_eq!(coverage.verdict, TranscriptionCoverageVerdict::Truncated);
        assert!(coverage.uncovered_ratio > 0.45, "{coverage:?}");
        assert_eq!(coverage.last_segment_avg_logprob, Some(-0.94));

        let line = coverage.log_line();
        assert!(line.contains("verdict=Truncated"), "{line}");
        assert!(line.contains("covered_seconds=38.100"), "{line}");
        assert!(line.contains("last_segment_avg_logprob=-0.940"), "{line}");
    }

    /// The false positive that would make the instrument useless: a dictation
    /// that simply ends on a pause must not be reported as a loss.
    #[test]
    fn an_ordinary_trailing_pause_is_not_a_truncation() {
        let coverage = response(Some(14.0), Some(vec![segment(0.0, 12.6, Some(-0.18))])).coverage();

        assert_eq!(coverage.verdict, TranscriptionCoverageVerdict::Complete);

        // Ten percent of a short clip is under the absolute floor, so the ratio
        // alone must not carry the verdict.
        assert!(coverage.uncovered_ratio >= TRANSCRIPTION_GAP_THRESHOLD, "{coverage:?}");
    }

    #[test]
    fn a_response_without_segments_is_not_reported_as_complete() {
        let no_segments = response(Some(72.144), None).coverage();
        assert_eq!(no_segments.verdict, TranscriptionCoverageVerdict::NotMeasured);

        let no_duration = response(None, Some(vec![segment(0.0, 10.0, None)])).coverage();
        assert_eq!(no_duration.verdict, TranscriptionCoverageVerdict::NotMeasured);

        let too_short = response(Some(1.4), Some(vec![])).coverage();
        assert_eq!(too_short.verdict, TranscriptionCoverageVerdict::NotMeasured);

        assert!(no_segments.log_line().contains("verdict=NotMeasured"));
    }

    /// A recognizer that returned nothing at all for minutes of audio is the
    /// strongest form of the finding, not a missing measurement.
    #[test]
    fn an_empty_segment_list_over_real_audio_is_a_truncation() {
        let coverage = response(Some(197.5), Some(vec![])).coverage();

        assert_eq!(coverage.verdict, TranscriptionCoverageVerdict::Truncated);
        assert_eq!(coverage.covered_seconds, 0.0);
        assert!((coverage.uncovered_ratio - 1.0).abs() < f64::EPSILON, "{coverage:?}");
    }
}
