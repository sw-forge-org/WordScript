//! Your server: an OpenAI-compatible endpoint somebody else operates
//! (ADR 0113, D1a; configured since D1b, ADR 0165).
//!
//! **The lane that was refused on a sentence about the world, and the sentence
//! was wrong.** `src/screens/data.ts` said *"Speech has no OpenAI-compatible
//! shape to talk to"* and `docs/PROVIDERS.md` said it too — eleven paragraphs
//! after recording that whisper.cpp ships `whisper-server`, *"an HTTP server
//! with an OpenAI-compatible API"*. Both cannot be true. What is true is
//! narrower and is about WordScript: there was no adapter. This file is the
//! adapter, and `/v1/audio/transcriptions` is the de-facto standard three
//! independent servers answer on — `whisper-server` with
//! `--inference-path`, faster-whisper-server/speaches, and LocalAI.
//!
//! **It is not the Local lane and the difference is not a detail.** Local runs
//! `whisper-cli` on this disk and reads the file where it lies. This posts an
//! upload to a machine that is not this one, over a network, to a program this
//! build did not install and cannot inspect. That is why it is a *cloud-shaped*
//! adapter with a user-typed host rather than a second local runtime, and why
//! it is the one place in this module tree where a base URL is a security
//! boundary instead of a constant.
//!
//! **D1b gave the lane the configuration D1a left as a drawing** (ADR 0165).
//! The base URL and the model id are `AppConfig` fields typed on the connection
//! card; the optional bearer token is in the OS secret store like every other
//! credential in this build; and the three environment variables stay as the
//! door for a machine nobody has typed on. **What is typed outranks the
//! environment** — the reverse of `WORDSCRIPT_LOCAL_MODEL_DIR`'s precedence,
//! because a field that stores a value the runtime then ignores is the false
//! affordance ADR 0067 rule 1 exists to prevent, and because the status says
//! which of the two answered so no surface has to guess.
//!
//! **No catalogue rows, and that is the lane rather than a gap** (ADR 0115).
//! The model list belongs to whoever runs the server. Nothing here substitutes
//! a default onto a typed id, because there is no default that could be right:
//! a server serving one model under a name its operator chose is the ordinary
//! case, not the exception.
//!
//! **Speech only.** A chat endpoint behind a user's URL is G3's, and
//! `/v1/audio/speech` on such a server is explicitly not claimed: ADR 0113 was
//! scoped to the transcription path because that is what was read, and whether
//! these servers answer for synthesis as reliably is unverified.

use crate::core::{config::AppConfig, runtime_log};

use super::{
    aggregate_credential,
    credential_store::{self, KeyShape, OsSecretStore},
    openai_compatible::{is_secure_endpoint, CompatibleClient, TranscriptionPlan},
    registry::{Provider, ProviderFuture, SpeechProvider},
    CredentialKind, ModelCapabilities, ProviderCapabilities, ProviderCaptureLimits,
    ProviderCommandError, ProviderCredentialStatus, ProviderErrorKind, ProviderMode,
    ProviderProfile, ProviderRole, ProviderStatus, ProviderStatusRequest, ProviderTier,
    RoleCredentialStatus, SelfHostedEndpointStatus, SelfHostedSource,
    TranscribeAudioFileRequest, TranscriptionResponse, ValidateProviderApiKeyResponse,
};

pub const SELF_HOSTED_PROVIDER_ID: &str = "self_hosted";
/// What a sentence a user reads calls this lane. It matches `LANE_LABEL` on the
/// surface (ADR 0160) rather than the identifier, because every error built
/// from it is read rather than stored.
const SELF_HOSTED_VENDOR: &str = "Your server";

/// **The three expert doors, and they are no longer the whole configuration
/// surface** (D1b).
///
/// Named after `WORDSCRIPT_LOCAL_CHAT_BASE_URL` and its siblings in `local.rs`,
/// which is the precedent this lane followed in shape as well as in spelling.
/// They are kept because a headless machine, a CI job and an expert's shell are
/// all real, and because removing a door somebody may already have walked
/// through is a migration nobody asked for. They now answer **second**: what is
/// typed on the connection card wins, and the status names the winner.
const SELF_HOSTED_BASE_URL_ENV: &str = "WORDSCRIPT_SELF_HOSTED_BASE_URL";
const SELF_HOSTED_MODEL_ENV: &str = "WORDSCRIPT_SELF_HOSTED_MODEL";
const SELF_HOSTED_TOKEN_ENV: &str = "WORDSCRIPT_SELF_HOSTED_TOKEN";

/// The endpoint's own default. `verbose_json` is a whisper.cpp-and-OpenAI
/// spelling and a server that does not know it answers 400, which costs the
/// whole request; the coverage instrument going quiet costs a verdict.
const RESPONSE_FORMAT_JSON: &str = "json";

const SELF_HOSTED_CREDENTIAL_ROLES: &[ProviderRole] = &[ProviderRole::Speech];

/// **An API key, and `requires_api_key` stays false** (D1b, ADR 0165).
///
/// D1a left this list empty because the registry held `requires_api_key` and
/// this list to each other, and declaring `ApiKey` would have made a lane
/// demand a credential the commonest server behind it does not issue.
/// **The invariant was the thing that was wrong.** *May* and *must* are two
/// questions: `whisper-server` takes no bearer token at all, speaches and
/// LocalAI may, and this list now answers the first while
/// `ProviderCapabilities::requires_api_key` answers the second. What keeps them
/// from drifting is no longer an equality but the pair of claims in
/// `registry.rs` — a lane that demands a key accepts one, and a lane that
/// accepts nothing can store nothing.
const SELF_HOSTED_CREDENTIAL_KINDS: &[CredentialKind] = &[CredentialKind::ApiKey];

const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const DEFAULT_MAX_RETRIES: u8 = 1;

/// What is wrong with the endpoint, before anything is sent to it.
#[derive(Debug, PartialEq, Eq)]
enum EndpointProblem {
    /// Nothing is configured. Not an error in the ordinary sense — it is the
    /// state of every machine that has not opted in.
    Unset,
    /// Configured, and not somewhere a credential may go.
    Insecure { url: String },
}

impl EndpointProblem {
    /// The sentence a surface prints, naming the next action.
    ///
    /// **It names the screen and no longer the environment variable** (D1b).
    /// Until this step the variable *was* the next action; now it is the second
    /// door, and telling somebody to export a shell variable while a field for
    /// it sits on the card they are reading is the wrong instruction.
    fn sentence(&self) -> String {
        match self {
            Self::Unset => "No server is configured yet. Type the base URL of your OpenAI-compatible server on the connection card in AI Models — the path this lane posts to is {base}/audio/transcriptions.".to_string(),
            Self::Insecure { url } => format!(
                "The endpoint '{url}' is plain HTTP to a public host, so WordScript will not send audio or a token to it. Use HTTPS, or an address on your own network — a LAN, loopback or tailnet host over plain HTTP is accepted.",
            ),
        }
    }
}

/// What a job needs and cannot get from a list, because there is no list.
const NO_MODEL_SENTENCE: &str = "Your server is reachable and no model id is set. A server behind a URL publishes no list to pick from, so type the id its operator gave it on the connection card in AI Models.";

/// The endpoint in force, and which door supplied it.
#[derive(Debug, Clone, PartialEq, Eq)]
struct ResolvedEndpoint {
    url: String,
    source: SelfHostedSource,
}

/// Everything this lane holds, read once (D1b).
///
/// **One read rather than four.** The status answers three questions about this
/// lane — is there an endpoint, is there a model id, is a token stored — and
/// each of them used to be its own trip to the config or the secret store. A
/// struct built once and asked three times is also what makes the answers
/// consistent with each other: two reads a millisecond apart can disagree, and
/// a surface printing one of each is the two-copies-of-one-fact defect this
/// screen has grown four times.
struct LaneConfiguration {
    endpoint: Result<ResolvedEndpoint, EndpointProblem>,
    model: Option<(String, SelfHostedSource)>,
    token: Option<String>,
}

impl LaneConfiguration {
    /// The impure half: the connection on disk, the environment, the secret
    /// store.
    ///
    /// **The URL and the model id are read off the connection** (ADR 0208).
    /// They were `AppConfig` fields because there was nowhere else for them to
    /// live, which is what ADR 0165 recorded; a profile that points at another
    /// server now reads that server here, and the token beside it belongs to
    /// the same object — so this lane cannot assemble one connection's endpoint
    /// with another's credential.
    fn read(connection: &str) -> Result<Self, ProviderCommandError> {
        let (base_url, model) = stored_endpoint_fields(connection);

        Ok(Self {
            endpoint: resolve_endpoint_from(
                Some(base_url.as_str()),
                std::env::var(SELF_HOSTED_BASE_URL_ENV).ok().as_deref(),
            ),
            model: resolve_model_from(
                Some(model.as_str()),
                std::env::var(SELF_HOSTED_MODEL_ENV).ok().as_deref(),
            ),
            token: stored_token(connection)?,
        })
    }

    /// **What the lane is missing, endpoint first.**
    ///
    /// A missing model id is a real refusal — `resolve_model` will not guess
    /// one — so a lane with a reachable server and no id is not ready, and
    /// saying it is would be readiness this build cannot deliver. The endpoint
    /// is named first because a model id typed against no server is the second
    /// thing to fix, not the first.
    fn missing(&self) -> Option<String> {
        match &self.endpoint {
            Err(problem) => Some(problem.sentence()),
            Ok(_) if self.model.is_none() => Some(NO_MODEL_SENTENCE.to_string()),
            Ok(_) => None,
        }
    }

    /// **What the lane is missing, in the field a surface already reads for it.**
    ///
    /// `configured` means *this lane can run a job*, which on a cloud vendor is
    /// a stored key and here is a usable endpoint plus an id to send to it. The
    /// credential half of this struct answers for the OPTIONAL token: `kind`
    /// and `key_preview` are `None` when none is stored, and neither of them
    /// moves `configured`, because a `whisper-server` that issues no token is
    /// the case this lane was built for.
    fn role_credential_status(&self, role: ProviderRole) -> RoleCredentialStatus {
        let missing = self.missing();

        RoleCredentialStatus {
            provider: SELF_HOSTED_PROVIDER_ID.to_string(),
            role,
            kind: self.token.as_ref().map(|_| CredentialKind::ApiKey),
            configured: missing.is_none(),
            /* Where a credential for this lane LIVES, which is the question the
               field's name asks. D1a answered `environment` here because that
               was true of the token then; it is the secret store now, and the
               endpoint's own door is reported in `SelfHostedEndpointStatus`
               rather than borrowed from a field that means something else. */
            storage: "os_secret_store".to_string(),
            key_preview: self
                .token
                .as_ref()
                .map(|token| credential_store::mask_api_key(token)),
            missing,
        }
    }

    /// The endpoint as the surface has to render it (D1b).
    ///
    /// **It carries the URL even when the URL is refused.** A base URL that
    /// fails the security check is what the user typed, and a row that blanked
    /// it would ask them to fix something it declined to show them; `missing`
    /// carries the reason beside it.
    fn endpoint_status(&self) -> SelfHostedEndpointStatus {
        let (base_url, base_url_source) = match &self.endpoint {
            Ok(endpoint) => (Some(endpoint.url.clone()), endpoint.source),
            Err(EndpointProblem::Insecure { url }) => {
                (Some(url.clone()), SelfHostedSource::Config)
            }
            Err(EndpointProblem::Unset) => (None, SelfHostedSource::Unset),
        };

        SelfHostedEndpointStatus {
            base_url,
            base_url_source,
            base_url_problem: self.endpoint.as_ref().err().map(EndpointProblem::sentence),
            model: self.model.as_ref().map(|(model, _)| model.clone()),
            model_source: self
                .model
                .as_ref()
                .map_or(SelfHostedSource::Unset, |(_, source)| *source),
        }
    }
}

/// Your server as the registry sees it: recognition, behind a URL you own.
pub struct SelfHosted;

pub static SELF_HOSTED: SelfHosted = SelfHosted;

impl Provider for SelfHosted {
    fn status(
        &self,
        request: &ProviderStatusRequest,
    ) -> Result<ProviderStatus, ProviderCommandError> {
        provider_status(&request.connection, request.model.as_deref())
    }

    fn capabilities(&self) -> ProviderCapabilities {
        provider_capabilities()
    }

    fn model_capabilities(&self, model: &str) -> ModelCapabilities {
        model_capabilities(model)
    }

    fn credential_kinds(&self) -> &'static [CredentialKind] {
        SELF_HOSTED_CREDENTIAL_KINDS
    }

    fn credential_status(
        &self,
        connection: &str,
        role: ProviderRole,
    ) -> Result<RoleCredentialStatus, ProviderCommandError> {
        Ok(LaneConfiguration::read(connection)?.role_credential_status(role))
    }

    fn save_api_key(
        &self,
        connection: &str,
        role: ProviderRole,
        kind: CredentialKind,
        api_key: &str,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        save_api_key(connection, role, kind, api_key)
    }

    fn clear_api_key(
        &self,
        connection: &str,
        role: ProviderRole,
        kind: CredentialKind,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        clear_api_key(connection, role, kind)
    }

    /// **`/models` rather than nothing, and the key it checks may be absent.**
    ///
    /// On the cloud lanes this asks *does this key authenticate*. Here the
    /// question a user actually has is *does WordScript reach the server I
    /// configured*, and the same endpoint answers it — with or without a token,
    /// because most of these servers take none.
    fn validate_api_key(
        &self,
        connection: &str,
        _api_key: Option<String>,
    ) -> ProviderFuture<ValidateProviderApiKeyResponse> {
        Box::pin(validate_endpoint(connection.to_string()))
    }
}

impl SpeechProvider for SelfHosted {
    fn transcribe_audio_file(
        &self,
        request: TranscribeAudioFileRequest,
    ) -> ProviderFuture<TranscriptionResponse> {
        Box::pin(transcribe_audio_file(request))
    }

    /// **No plans, because nobody is selling anything.** An empty list is the
    /// honest answer for a lane whose ceiling is the operator's own `nginx`
    /// config, and `provider_tiers` already returns an empty list for a lane
    /// with nothing to choose between.
    fn tiers(&self) -> Vec<ProviderTier> {
        Vec::new()
    }

    /// **Unbounded, and deliberately not a borrowed number.**
    ///
    /// `UploadCapacity::Unbounded`'s own definition names this lane: *the local
    /// runtime reads the file where it lies, and a self-hosted endpoint is the
    /// user's own*. Lending it Groq's 25 MiB would put a ceiling on the surface
    /// that no server behind this URL agreed to, and `ProviderCaptureLimits`
    /// exists in this shape precisely so a guess cannot be dressed as a
    /// measurement.
    fn capture_limits(&self, _model: &str, _tier_id: &str) -> ProviderCaptureLimits {
        ProviderCaptureLimits::unbounded()
    }
}

fn provider_status(
    connection: &str,
    model: Option<&str>,
) -> Result<ProviderStatus, ProviderCommandError> {
    let lane = LaneConfiguration::read(connection)?;
    let role_credentials: Vec<RoleCredentialStatus> = SELF_HOSTED_CREDENTIAL_ROLES
        .iter()
        .map(|role| lane.role_credential_status(*role))
        .collect();

    Ok(ProviderStatus {
        provider: SELF_HOSTED_PROVIDER_ID.to_string(),
        /* Stamped by `provider_status`, which holds the account this was
           asked about (ADR 0209). */
        connection: String::new(),
        default_profile: "self-hosted".to_string(),
        credential: aggregate_credential(SELF_HOSTED_PROVIDER_ID, &role_credentials),
        profiles: provider_profiles(),
        capabilities: provider_capabilities(),
        model_capabilities: model_capabilities(model.unwrap_or_default()),
        role_credentials,
        /* `local_setup` is the LOCAL lane's probe of this disk. A server on
           another machine has no such answer, and borrowing the field would put
           this lane's readiness under a name that means something else. */
        local_setup: None,
        self_hosted_endpoint: Some(lane.endpoint_status()),
    })
}

/// A value somebody typed, or nothing. Whitespace is nothing.
fn typed(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

/// The endpoint this lane posts to, or why there is none — **from the two doors
/// as arguments**, so the rule can be asserted without a config on disk.
///
/// **The security check happens here and not at the call site**, so there is
/// exactly one place a base URL becomes usable. Every path below — the
/// transcription, the reachability probe, the status the screen reads — goes
/// through it, which is the property that makes the check worth having: a
/// second door with a second check is a second thing to get wrong.
fn resolve_endpoint_from(
    stored: Option<&str>,
    from_env: Option<&str>,
) -> Result<ResolvedEndpoint, EndpointProblem> {
    let (raw, source) = typed(stored)
        .map(|url| (url, SelfHostedSource::Config))
        .or_else(|| typed(from_env).map(|url| (url, SelfHostedSource::Environment)))
        .ok_or(EndpointProblem::Unset)?;

    if !is_secure_endpoint(&raw) {
        return Err(EndpointProblem::Insecure { url: raw });
    }

    Ok(ResolvedEndpoint {
        url: raw.trim_end_matches('/').to_string(),
        source,
    })
}

fn resolve_endpoint(connection: &str) -> Result<ResolvedEndpoint, EndpointProblem> {
    resolve_endpoint_from(
        Some(stored_endpoint_fields(connection).0.as_str()),
        std::env::var(SELF_HOSTED_BASE_URL_ENV).ok().as_deref(),
    )
}

/// The base URL and model id one connection carries, or two empty strings for
/// one this machine no longer holds.
///
/// **One read for the pair**, because two reads a millisecond apart can
/// disagree and a lane assembled from both is the two-copies-of-one-fact defect
/// this file already names once.
fn stored_endpoint_fields(connection: &str) -> (String, String) {
    AppConfig::load_from_disk()
        .connection(connection)
        .map(|entry| (entry.base_url.clone(), entry.model.clone()))
        .unwrap_or_default()
}

/// The model id this server is told to use when a job names none, and which
/// door supplied it. Same precedence as the URL, for the same reason.
fn resolve_model_from(
    stored: Option<&str>,
    from_env: Option<&str>,
) -> Option<(String, SelfHostedSource)> {
    typed(stored)
        .map(|model| (model, SelfHostedSource::Config))
        .or_else(|| typed(from_env).map(|model| (model, SelfHostedSource::Environment)))
}

fn configured_model(connection: &str) -> Option<(String, SelfHostedSource)> {
    resolve_model_from(
        Some(stored_endpoint_fields(connection).1.as_str()),
        std::env::var(SELF_HOSTED_MODEL_ENV).ok().as_deref(),
    )
}

/// The optional bearer token. Absent is the ordinary case, not a failure.
///
/// **The store first, the environment second, and a store that is broken is not
/// an absent token.** `Ok(None)` is a machine with no token stored; an `Err` is
/// a secret store that could not be read, and answering that with an
/// unauthenticated request would turn a keyring problem into a 401 from
/// somebody else's server.
fn stored_token(connection: &str) -> Result<Option<String>, ProviderCommandError> {
    let kind = CredentialKind::ApiKey;
    let user = credential_entry_user(connection, ProviderRole::Speech, kind);

    if let Some(token) = credential_store::cached(&user) {
        return Ok(Some(token));
    }

    match credential_store::read_from(&OsSecretStore, connection, ProviderRole::Speech, kind)
        .map_err(secret_store_error)?
    {
        Some(token) => {
            credential_store::cache_key(&user, Some(token.clone()));
            Ok(Some(token))
        }
        None => Ok(typed(std::env::var(SELF_HOSTED_TOKEN_ENV).ok().as_deref())),
    }
}

fn resolve_token(connection: &str) -> Result<String, ProviderCommandError> {
    Ok(stored_token(connection)?.unwrap_or_default())
}

/// The model id, which is typed and never substituted.
///
/// **This is the one adapter with no fallback row**, and the absence is the
/// lane. `openai.rs` and `openrouter.rs` substitute their own default when a
/// request carries another lane's id, because they know which ids are theirs.
/// Nothing here knows: a server may serve `ggml-large-v3-turbo`, `whisper-1`,
/// or a name its operator invented this morning, and all three are correct. So
/// a request that names nothing is refused with the door named rather than sent
/// with a guess attached.
///
/// **The job names it and the lane answers when it does not** (D1b). The
/// capture puts the configured id on every request it builds, exactly as it
/// puts the local model on a local one; this second read is for the callers
/// that are not the capture, and it resolves to the same value.
fn resolve_model(connection: &str, model: Option<&str>) -> Result<String, ProviderCommandError> {
    typed(model)
        .or_else(|| configured_model(connection).map(|(model, _)| model))
        .ok_or_else(|| ProviderCommandError::invalid_request(NO_MODEL_SENTENCE))
}

fn self_hosted_client(
    connection: &str,
    timeout_ms: u64,
    max_retries: u8,
) -> Result<CompatibleClient, ProviderCommandError> {
    /* THE ENDPOINT IS RESOLVED BEFORE THE TOKEN IS READ, AND THE `?` IS WHAT
       HOLDS IT. A refused URL must never reach the line that fetches a
       credential, let alone the one that attaches it — the security boundary is
       this order, and `a_public_plain_http_endpoint_is_refused_before_a_token_reaches_it`
       asserts it through this function because this is the only door to a
       request on this lane. */
    let endpoint = resolve_endpoint(connection).map_err(|problem| {
        ProviderCommandError::new(
            ProviderErrorKind::InvalidRequest,
            problem.sentence(),
            None,
            None,
        )
    })?;

    CompatibleClient::new(
        SELF_HOSTED_VENDOR,
        endpoint.url,
        resolve_token(connection)?,
        timeout_ms,
        max_retries,
    )
    .map_err(ProviderCommandError::from)
}

/// **A key is refused for a role this lane does not serve.**
///
/// The same rule `openrouter.rs` states: a credential is never written for a
/// role with no implementation behind it, because a key stored there would pay
/// for nothing. This lane serves speech and nothing else.
fn ensure_supported_role(role: ProviderRole) -> Result<(), ProviderCommandError> {
    if SELF_HOSTED_CREDENTIAL_ROLES.contains(&role) {
        return Ok(());
    }

    Err(ProviderCommandError::invalid_request(format!(
        "WordScript cannot store a credential for {} on your server. This lane transcribes and nothing else — a chat endpoint behind your own URL has no adapter yet.",
        role.label(),
    )))
}

/// **A subscription is not a thing a server you run issues**, and ADR 0102
/// permits the kind on one vendor anyway. The refusal names both halves.
fn ensure_supported_kind(kind: CredentialKind) -> Result<(), ProviderCommandError> {
    if SELF_HOSTED_CREDENTIAL_KINDS.contains(&kind) {
        return Ok(());
    }

    Err(ProviderCommandError::invalid_request(format!(
        "Your server accepts {} and nothing else. {} is a vendor account and there is no vendor here — the server is yours.",
        CredentialKind::ApiKey.label(),
        kind.label(),
    )))
}

/// **No prefix check, and the absence is not an oversight.** The token is
/// whatever string the operator put in their own server's config; a shape rule
/// invented here would refuse valid tokens on a lane whose whole point is that
/// the operator decides.
fn normalize_token(token: &str) -> Result<String, ProviderCommandError> {
    credential_store::normalized_key(token, None)
        .map(ToOwned::to_owned)
        .map_err(|shape| match shape {
            KeyShape::Empty | KeyShape::WrongPrefix => ProviderCommandError::invalid_request(
                "An empty token is not a token. Leave the credential unset instead — most servers on this lane take none.",
            ),
        })
}

fn save_api_key(
    connection: &str,
    role: ProviderRole,
    kind: CredentialKind,
    api_key: &str,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    ensure_supported_role(role)?;
    ensure_supported_kind(kind)?;
    let token = normalize_token(api_key)?;

    credential_store::write_to(&OsSecretStore, connection, role, kind, &token)
        .map_err(secret_store_error)?;
    credential_store::cache_key(&credential_entry_user(connection, role, kind), Some(token));

    credential_status(connection)
}

fn clear_api_key(
    connection: &str,
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    ensure_supported_role(role)?;
    ensure_supported_kind(kind)?;

    credential_store::clear_in(&OsSecretStore, connection, role, kind)
        .map_err(secret_store_error)?;
    credential_store::cache_key(&credential_entry_user(connection, role, kind), None);

    credential_status(connection)
}

fn credential_status(connection: &str) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    let lane = LaneConfiguration::read(connection)?;
    let role_credentials: Vec<RoleCredentialStatus> = SELF_HOSTED_CREDENTIAL_ROLES
        .iter()
        .map(|role| lane.role_credential_status(*role))
        .collect();

    Ok(aggregate_credential(SELF_HOSTED_PROVIDER_ID, &role_credentials))
}

fn credential_entry_user(connection: &str, role: ProviderRole, kind: CredentialKind) -> String {
    credential_store::entry_user(connection, role, kind)
}

fn secret_store_error(error: keyring::Error) -> ProviderCommandError {
    ProviderCommandError::new(
        ProviderErrorKind::SecretStoreUnavailable,
        format!("The OS secret store did not answer for your server's token: {error}"),
        None,
        None,
    )
}

async fn validate_endpoint(
    connection: String,
) -> Result<ValidateProviderApiKeyResponse, ProviderCommandError> {
    let client = self_hosted_client(&connection, DEFAULT_TIMEOUT_MS, 0)?;
    client
        .validate_models_endpoint()
        .await
        .map_err(ProviderCommandError::from)?;

    Ok(ValidateProviderApiKeyResponse {
        ok: true,
        provider: SELF_HOSTED_PROVIDER_ID.to_string(),
        checked_with: "configured_endpoint".to_string(),
    })
}

/// **The lane never asks for segments, whatever the caller asked for** (D1b).
///
/// `provider_capabilities` says `supports_segments: false` here, and the
/// capture asks every lane that is not `local` for `verbose_json` — a
/// whisper.cpp-and-OpenAI spelling that a server which does not know it answers
/// **400** to, costing the whole dictation. The knowledge is the lane's, so the
/// downgrade is the lane's: a request that asked for a segment-carrying format
/// gets `json` and the log says the format was changed, rather than the user
/// getting an error about a word they never typed.
fn response_format_for(requested: Option<String>) -> (String, bool) {
    match typed(requested.as_deref()) {
        Some(format) if format == RESPONSE_FORMAT_JSON => (format, false),
        Some(_) => (RESPONSE_FORMAT_JSON.to_string(), true),
        None => (RESPONSE_FORMAT_JSON.to_string(), false),
    }
}

async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<TranscriptionResponse, ProviderCommandError> {
    let model = resolve_model(&request.connection, request.model.as_deref())?;
    let client = self_hosted_client(
        &request.connection,
        request.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS),
        request.max_retries.unwrap_or(DEFAULT_MAX_RETRIES),
    )?;

    let (file_name, audio_bytes) = client
        .read_audio(&request.audio_path)
        .await
        .map_err(ProviderCommandError::from)?;

    let (response_format, downgraded) = response_format_for(request.response_format);

    // Same reason as on OpenRouter, different cause: there the vendor answers
    // no format that carries segments, here nobody knows what this server
    // answers. Either way the coverage verdict cannot be read as healthy.
    runtime_log::record(format!(
        "[WordScript] Your server transcription without segments model={} format={} downgraded={} coverage=unavailable",
        model, response_format, downgraded,
    ));

    let plan = TranscriptionPlan {
        file_name,
        audio_bytes,
        model,
        response_format,
        language: request.language.filter(|value| !value.trim().is_empty()),
        prompt: request.prompt.filter(|value| !value.trim().is_empty()),
    };

    client
        .transcribe(plan)
        .await
        .map_err(ProviderCommandError::from)
}

/// One profile, and it names no model.
///
/// Every other lane's profiles carry a catalogued id. Here the id is the
/// operator's, so the profile carries the empty string and `resolve_model`
/// refuses rather than inventing one — a profile that named a plausible model
/// would be this build guessing what somebody else installed.
fn provider_profiles() -> Vec<ProviderProfile> {
    vec![ProviderProfile {
        id: "self-hosted".to_string(),
        provider: SELF_HOSTED_PROVIDER_ID.to_string(),
        mode: ProviderMode::SelfHosted,
        model: String::new(),
        label: "Your server, with the model id you type".to_string(),
        default: true,
        requires_api_key: false,
    }]
}

fn provider_capabilities() -> ProviderCapabilities {
    ProviderCapabilities {
        transcription: true,
        /* A chat endpoint behind a user's URL is G3's, and the drawn writing
           jobs on this lane have said `typed on the endpoint` since Leg 6. The
           seam names that gap as this build's rather than the server's. */
        chat_completion: false,
        speech_synthesis: false,
        /* **`false`, and it is the field most likely to be misread here.** It
           means *runs on this machine*, and this lane's whole definition is a
           machine that is not this one. A user's own server is private; it is
           not local, and the capture budget and the surface both read this
           field for the local meaning. */
        local: false,
        /* **Still false, and now it means something narrower** (D1b, ADR 0165).
           It answers *must a credential be present for a job to run*, and on
           this lane the answer is no however many tokens are stored:
           `whisper-server` issues none. What MAY be stored is
           `SELF_HOSTED_CREDENTIAL_KINDS`, which is no longer empty, and the two
           fields stopped being one claim read twice. */
        requires_api_key: false,
        supports_prompt_bias: true,
        supports_language: true,
        /* Unknowable and therefore not claimed. Some of these servers answer
           `verbose_json` and this adapter does not ask for it — see
           `response_format_for`, which is where that decision is enforced
           rather than merely declared. */
        supports_segments: false,
        model_management: false,
    }
}

/// **`Unknown` for everything, and it is the most honest use of that value in
/// the build** (ADR 0110).
///
/// OpenRouter's list is somebody else's and at least enumerable. This one is a
/// program the user compiled, on a machine this build cannot see, serving ids
/// it chose. Answering anything but `Unknown` would be inventing a measurement.
fn model_capabilities(model: &str) -> ModelCapabilities {
    ModelCapabilities::unknown(model)
}

#[cfg(test)]
mod tests {
    /// The connection these tests configure and store against (ADR 0208).
    /// **Named rather than the vendor id**, because the endpoint and the token
    /// belong to one account now — this lane's whole point is that the server
    /// is somebody's own, and two of them are two connections.
    const TEST_CONNECTION: &str = "connection-my-server";

    use std::{cell::RefCell, collections::HashMap};

    use keyring::Error as KeyringError;

    use super::super::credential_store::SecretStore;
    use super::*;
    use crate::core::providers::ModelSupport;

    /// `CompatibleClient` is not `Debug` — a transport holding a bearer token
    /// deliberately does not print itself — so the refusal is read by matching
    /// rather than by `expect_err`, which would want to format the Ok side.
    fn refusal(outcome: Result<CompatibleClient, ProviderCommandError>) -> ProviderCommandError {
        match outcome {
            Ok(_) => panic!("a client was built where none should have been"),
            Err(error) => error,
        }
    }

    /// Env vars are process-global and the suite is threaded, so the cases that
    /// set them run under one lock and put back exactly what they found.
    fn with_env<T>(pairs: &[(&str, Option<&str>)], body: impl FnOnce() -> T) -> T {
        use std::sync::Mutex;
        static LOCK: Mutex<()> = Mutex::new(());
        let guard = LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());

        let restore: Vec<(String, Option<std::ffi::OsString>)> = pairs
            .iter()
            .map(|(key, _)| ((*key).to_string(), std::env::var_os(key)))
            .collect();

        for (key, value) in pairs {
            match value {
                Some(value) => std::env::set_var(key, value),
                None => std::env::remove_var(key),
            }
        }

        let outcome = body();

        for (key, value) in restore {
            match value {
                Some(value) => std::env::set_var(&key, value),
                None => std::env::remove_var(&key),
            }
        }

        drop(guard);
        outcome
    }

    /// A lane assembled from arguments, so a case can state a machine's whole
    /// configuration without one existing on the disk this suite runs on.
    fn lane(
        stored_url: Option<&str>,
        env_url: Option<&str>,
        stored_model: Option<&str>,
        token: Option<&str>,
    ) -> LaneConfiguration {
        LaneConfiguration {
            endpoint: resolve_endpoint_from(stored_url, env_url),
            model: resolve_model_from(stored_model, None),
            token: token.map(ToOwned::to_owned),
        }
    }

    #[derive(Default)]
    struct FakeSecretStore {
        entries: RefCell<HashMap<(String, String), String>>,
    }

    impl SecretStore for FakeSecretStore {
        fn read(&self, service: &str, user: &str) -> Result<Option<String>, KeyringError> {
            Ok(self
                .entries
                .borrow()
                .get(&(service.to_string(), user.to_string()))
                .cloned())
        }

        fn write(&self, service: &str, user: &str, secret: &str) -> Result<(), KeyringError> {
            self.entries
                .borrow_mut()
                .insert((service.to_string(), user.to_string()), secret.to_string());
            Ok(())
        }

        fn delete(&self, service: &str, user: &str) -> Result<(), KeyringError> {
            self.entries
                .borrow_mut()
                .remove(&(service.to_string(), user.to_string()));
            Ok(())
        }
    }

    /// **The refusal this lane owes a test** (D1a's own validation line): a URL
    /// that fails the check is refused BEFORE a token is attached to it.
    ///
    /// Asserted through `self_hosted_client`, which is the only door to a
    /// request on this lane — so the claim is *no request can be built*, rather
    /// than *this function returns false*.
    #[test]
    fn a_public_plain_http_endpoint_is_refused_before_a_token_reaches_it() {
        with_env(
            &[
                (SELF_HOSTED_BASE_URL_ENV, Some("http://speech.example.com/v1")),
                (SELF_HOSTED_TOKEN_ENV, Some("a-token-that-must-not-travel")),
            ],
            || {
                let refused = refusal(self_hosted_client(TEST_CONNECTION, 5_000, 0));

                assert_eq!(refused.kind, ProviderErrorKind::InvalidRequest);
                assert!(refused.message.contains("speech.example.com"));
                /* AND THE TOKEN IS NOT IN THE SENTENCE. A refusal that printed
                   the credential it was protecting would put it in a log, which
                   is the second path out of the runtime `without_secrets()`
                   exists for. */
                assert!(!refused.message.contains("a-token-that-must-not-travel"));
            },
        );
    }

    /// The lane's own reason for existing: the machine under the desk, over
    /// plain HTTP, reachable and accepted.
    #[test]
    fn a_lan_server_on_plain_http_is_accepted() {
        let resolved = resolve_endpoint_from(Some("http://10.0.0.2:8080/v1/"), None)
            .expect("a private host on plain http is this lane's ordinary case");

        assert_eq!(resolved.url, "http://10.0.0.2:8080/v1");
        assert_eq!(resolved.source, SelfHostedSource::Config);
    }

    /// **WHAT IS TYPED OUTRANKS THE ENVIRONMENT** (D1b, ADR 0165).
    ///
    /// The reverse of `WORDSCRIPT_LOCAL_MODEL_DIR`'s precedence, and the reason
    /// is the field rather than the variable: a URL row that stores a value the
    /// runtime then ignores is a control that reports a state the runtime never
    /// reached, which is the defect ADR 0067 rule 1 exists to prevent.
    #[test]
    fn a_typed_endpoint_outranks_the_environment_and_the_status_says_which_answered() {
        let typed = resolve_endpoint_from(
            Some("https://typed.example.com/v1"),
            Some("https://from-the-shell.example.com/v1"),
        )
        .expect("a typed endpoint is used");
        assert_eq!(typed.url, "https://typed.example.com/v1");
        assert_eq!(typed.source, SelfHostedSource::Config);

        /* And the environment is not dead: it is what a machine nobody has
           typed on starts with, which is every machine D1a left behind. */
        let inherited =
            resolve_endpoint_from(Some("   "), Some("https://from-the-shell.example.com/v1"))
                .expect("the environment still answers when nothing is typed");
        assert_eq!(inherited.source, SelfHostedSource::Environment);

        let status = lane(None, Some("https://from-the-shell.example.com/v1"), Some("tiny"), None)
            .endpoint_status();
        assert_eq!(status.base_url_source, SelfHostedSource::Environment);
        assert_eq!(
            status.base_url.as_deref(),
            Some("https://from-the-shell.example.com/v1"),
        );
    }

    /// **Unconfigured is a state and not a fault**, and the sentence names the
    /// screen rather than the shell — because since D1b the screen is where the
    /// next action is.
    #[test]
    fn an_unconfigured_lane_names_the_surface_that_configures_it() {
        let lane = lane(None, None, None, None);
        let status = lane.role_credential_status(ProviderRole::Speech);

        assert!(!status.configured);
        let missing = status.missing.expect("an unconfigured lane names its door");
        assert!(missing.contains("AI Models"), "{missing}");
        assert!(
            !missing.contains(SELF_HOSTED_BASE_URL_ENV),
            "the environment variable is the second door, not the instruction: {missing}",
        );
        /* And it draws no key row, because no token is stored. */
        assert!(status.kind.is_none());
        assert_eq!(lane.endpoint_status().base_url_source, SelfHostedSource::Unset);
    }

    /// **A reachable server with no model id is not a ready lane** (D1b).
    ///
    /// `resolve_model` refuses rather than guessing, so a `configured: true`
    /// here would be readiness this build cannot deliver — the fake-ready state
    /// `CLAUDE.md` forbids, one field over from where it is usually looked for.
    #[test]
    fn an_endpoint_without_a_model_id_is_reported_as_not_ready() {
        let status = lane(Some("https://speech.example.com/v1"), None, None, None)
            .role_credential_status(ProviderRole::Speech);

        assert!(!status.configured);
        let missing = status.missing.expect("a lane with no model id says so");
        assert!(missing.contains("model id"), "{missing}");
    }

    /// A configured endpoint AND a model id report the lane as usable, which is
    /// what `configured` means for a lane whose readiness is not a credential.
    #[test]
    fn an_endpoint_with_a_model_id_reports_the_lane_as_usable() {
        let lane = lane(
            Some("https://speech.example.com/v1"),
            None,
            Some("Systran/faster-whisper-medium"),
            None,
        );
        let status = lane.role_credential_status(ProviderRole::Speech);

        assert!(status.configured);
        assert!(status.missing.is_none());
        /* The token's home, not the endpoint's — the endpoint's own door is
           reported in the block beside it. */
        assert_eq!(status.storage, "os_secret_store");

        let endpoint = lane.endpoint_status();
        assert_eq!(endpoint.model.as_deref(), Some("Systran/faster-whisper-medium"));
        assert_eq!(endpoint.model_source, SelfHostedSource::Config);
    }

    /// **The token is optional and the lane says so in both directions**
    /// (ADR 0165): stored, it is masked and named; absent, the lane is still
    /// ready, because `whisper-server` issues no token at all.
    #[test]
    fn an_optional_token_is_previewed_when_stored_and_missed_by_nobody_when_it_is_not() {
        let without = lane(Some("https://speech.example.com/v1"), None, Some("tiny"), None)
            .role_credential_status(ProviderRole::Speech);
        assert!(without.configured);
        assert!(without.kind.is_none());
        assert!(without.key_preview.is_none());

        let with = lane(
            Some("https://speech.example.com/v1"),
            None,
            Some("tiny"),
            Some("a-token-long-enough-to-mask"),
        )
        .role_credential_status(ProviderRole::Speech);
        assert!(with.configured);
        assert_eq!(with.kind, Some(CredentialKind::ApiKey));
        assert_eq!(
            with.key_preview.as_deref(),
            Some(credential_store::mask_api_key("a-token-long-enough-to-mask")).as_deref(),
        );
        /* AND THE TOKEN ITSELF IS NOT IN THE STATUS. A preview is a preview. */
        assert!(!format!("{with:?}").contains("a-token-long-enough-to-mask"));
    }

    /// **The one adapter that refuses rather than substituting**, because there
    /// is no id it could substitute that would be more likely right than wrong.
    #[test]
    fn a_request_naming_no_model_is_refused_rather_than_given_a_guess() {
        assert_eq!(resolve_model_from(None, None), None);
        assert_eq!(resolve_model_from(Some(""), None), None);

        // A typed id survives untouched — no catalogue, no substitution.
        assert_eq!(
            resolve_model(TEST_CONNECTION, Some("ggml-large-v3-turbo")).unwrap(),
            "ggml-large-v3-turbo",
        );
        // Including one another lane catalogues, which every other adapter
        // would replace. Here it is very likely exactly what is installed.
        assert_eq!(
            resolve_model(TEST_CONNECTION, Some("whisper-1")).unwrap(),
            "whisper-1",
        );
    }

    #[test]
    fn the_environment_supplies_the_model_when_nothing_is_typed() {
        assert_eq!(
            resolve_model_from(None, Some("Systran/faster-whisper-medium")),
            Some((
                "Systran/faster-whisper-medium".to_string(),
                SelfHostedSource::Environment,
            )),
        );
        // And what is typed outranks it, exactly as the URL does.
        assert_eq!(
            resolve_model_from(Some("tiny.en"), Some("Systran/faster-whisper-medium")),
            Some(("tiny.en".to_string(), SelfHostedSource::Config)),
        );
    }

    /// **The lane never asks a server for `verbose_json`** (D1b).
    ///
    /// The capture asks every non-local lane for it, and a server that does not
    /// know the spelling answers 400 — which costs the whole dictation rather
    /// than the segments. `supports_segments: false` is the claim; this is
    /// where it is enforced.
    #[test]
    fn a_segment_carrying_format_is_downgraded_rather_than_sent() {
        assert_eq!(
            response_format_for(Some("verbose_json".to_string())),
            ("json".to_string(), true),
        );
        assert_eq!(
            response_format_for(Some("json".to_string())),
            ("json".to_string(), false),
        );
        assert_eq!(response_format_for(None), ("json".to_string(), false));
        assert_eq!(response_format_for(Some("  ".to_string())), ("json".to_string(), false));
    }

    /// **Not the local lane, and the field that says so.** `local: true` means
    /// *runs on this machine*, which the capture budget and the surface both
    /// read for that meaning. A server on the LAN is private and is not local.
    #[test]
    fn a_private_server_is_not_a_local_runtime() {
        let capabilities = provider_capabilities();

        assert!(!capabilities.local);
        assert!(capabilities.transcription);
        assert!(!capabilities.supports_segments);
    }

    /// **`may` and `must` are two questions, and this is the lane that proves
    /// it** (ADR 0165). The lane accepts a bearer token and requires none.
    #[test]
    fn the_lane_accepts_a_token_and_requires_none() {
        assert!(!provider_capabilities().requires_api_key);
        assert_eq!(SELF_HOSTED_CREDENTIAL_KINDS, &[CredentialKind::ApiKey]);
        assert!(ensure_supported_kind(CredentialKind::ApiKey).is_ok());

        let refused = ensure_supported_kind(CredentialKind::Subscription)
            .expect_err("nobody subscribes to a machine they own");
        assert!(refused.message.contains("server is yours"), "{}", refused.message);
    }

    /// The ceiling is nobody's to state, and stating one anyway is the mistake
    /// `ProviderCaptureLimits::unbounded` exists to make impossible.
    #[test]
    fn no_ceiling_is_borrowed_from_a_lane_that_publishes_one() {
        let limits = SELF_HOSTED.capture_limits("anything", "any-tier");

        assert!(limits.max_audio_bytes.is_none());
        assert!(limits.realtime_factor.is_none());
        assert!(SELF_HOSTED.tiers().is_empty());
    }

    #[test]
    fn the_registry_registers_speech_and_nothing_else() {
        let entry = super::super::registry::resolve_entry(SELF_HOSTED_PROVIDER_ID)
            .expect("self_hosted is registered");

        assert_eq!(entry.roles(), SELF_HOSTED_CREDENTIAL_ROLES.to_vec());
        assert!(entry.speech.is_some());
        assert!(entry.chat.is_none());
        assert!(entry.voice.is_none());
    }

    /// Nothing on this lane may be catalogued, whatever id it is handed.
    #[test]
    fn every_model_on_this_lane_answers_unknown() {
        for id in ["whisper-1", "ggml-base", "something-its-operator-named"] {
            let answer = model_capabilities(id);
            assert_eq!(answer.model, id);
            assert_eq!(answer.transcription_streaming, ModelSupport::Unknown);
            assert_eq!(answer.reports_detected_language, ModelSupport::Unknown);
            assert_eq!(answer.synthesis_streaming, ModelSupport::Unknown);
        }
    }

    /// **The token goes where every other credential in this build goes**
    /// (D1b), under the entry name scheme A3 established — asserted against a
    /// fake store, because a test may not write into the developer's keyring.
    #[test]
    fn a_token_round_trips_through_the_secret_store_under_this_lanes_own_entry() {
        let store = FakeSecretStore::default();
        let (role, kind) = (ProviderRole::Speech, CredentialKind::ApiKey);

        assert_eq!(
            credential_entry_user(TEST_CONNECTION, role, kind),
            "connection-my-server.speech.api_key",
        );

        credential_store::write_to(&store, TEST_CONNECTION, role, kind, "a-server-token")
            .expect("the fake store accepts a write");
        assert_eq!(
            credential_store::read_from(&store, TEST_CONNECTION, role, kind).unwrap(),
            Some("a-server-token".to_string()),
        );

        credential_store::clear_in(&store, TEST_CONNECTION, role, kind)
            .expect("the fake store accepts a delete");
        assert_eq!(
            credential_store::read_from(&store, TEST_CONNECTION, role, kind).unwrap(),
            None,
        );

        /* And nothing may be stored for a role this lane does not serve, which
           is where a token would pay for nothing. */
        assert!(ensure_supported_role(ProviderRole::Speech).is_ok());
        assert!(ensure_supported_role(ProviderRole::Chat).is_err());
    }

    /// An empty token is a mistake rather than a way to clear one, and the
    /// refusal says which door does clear it.
    #[test]
    fn an_empty_token_is_refused_with_the_alternative_named() {
        let refused = normalize_token("   ").expect_err("an empty token is not a token");
        assert!(refused.message.contains("Leave the credential unset"));
        assert_eq!(normalize_token("  a-token  ").unwrap(), "a-token");
    }
}
