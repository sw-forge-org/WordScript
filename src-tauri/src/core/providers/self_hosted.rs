//! Your server: an OpenAI-compatible endpoint somebody else operates
//! (ADR 0113, D1a).
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
//! **What is built here is the adapter, and what is not built is everywhere a
//! user could type the URL.** The connection card draws a URL field, a token
//! row and a `Test` button, and all three are `DrawnField`/`DrawnButton`s that
//! store nowhere. So the endpoint is read from the environment, exactly as the
//! local lane's was before B5 gave it a surface, and the lane stays locked
//! under ADR 0067 rule 1 — a lane that is offered must be operable, and one
//! that cannot be configured from the screen offering it is not. `LockedLanes`
//! in `Models.tsx` states that in the product; this note states it here so the
//! next reader does not take the missing config for an oversight.
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

use crate::core::runtime_log;

use super::{
    aggregate_credential,
    openai_compatible::{is_secure_endpoint, CompatibleClient, TranscriptionPlan},
    registry::{Provider, ProviderFuture, SpeechProvider},
    CredentialKind, ModelCapabilities, ProviderCapabilities, ProviderCaptureLimits,
    ProviderCommandError, ProviderCredentialStatus, ProviderErrorKind, ProviderMode,
    ProviderProfile, ProviderRole, ProviderStatus, ProviderStatusRequest, ProviderTier,
    RoleCredentialStatus, TranscribeAudioFileRequest, TranscriptionResponse,
    ValidateProviderApiKeyResponse,
};

pub const SELF_HOSTED_PROVIDER_ID: &str = "self_hosted";
/// What a sentence a user reads calls this lane. It matches `LANE_LABEL` on the
/// surface (ADR 0160) rather than the identifier, because every error built
/// from it is read rather than stored.
const SELF_HOSTED_VENDOR: &str = "Your server";

/// **The three expert doors, and they are the whole configuration surface.**
///
/// Named after `WORDSCRIPT_LOCAL_CHAT_BASE_URL` and its siblings in `local.rs`,
/// which is the precedent this lane follows in shape as well as in spelling: a
/// lane whose surface is not wired is configured by environment, says so, and
/// is not offered until it has one.
const SELF_HOSTED_BASE_URL_ENV: &str = "WORDSCRIPT_SELF_HOSTED_BASE_URL";
const SELF_HOSTED_MODEL_ENV: &str = "WORDSCRIPT_SELF_HOSTED_MODEL";
const SELF_HOSTED_TOKEN_ENV: &str = "WORDSCRIPT_SELF_HOSTED_TOKEN";

/// The endpoint's own default. `verbose_json` is a whisper.cpp-and-OpenAI
/// spelling and a server that does not know it answers 400, which costs the
/// whole request; the coverage instrument going quiet costs a verdict.
const RESPONSE_FORMAT_JSON: &str = "json";

const SELF_HOSTED_CREDENTIAL_ROLES: &[ProviderRole] = &[ProviderRole::Speech];

/// **Empty, because the token on this lane is optional and `requires_api_key`
/// is not a three-valued field.**
///
/// `whisper-server` takes no bearer token at all; speaches and LocalAI may.
/// Declaring `ApiKey` here would make `requires_api_key` true — the registry
/// holds those two to each other — and a lane that demands a credential the
/// commonest server behind it does not issue is a lane that refuses the case it
/// was built for. So the optional token rides the environment with the URL it
/// belongs to, and the empty list says what is true today: **WordScript stores
/// no credential for this lane.** A surface that wants to offer one is asking
/// for the configuration half, which is not built.
const SELF_HOSTED_CREDENTIAL_KINDS: &[CredentialKind] = &[];

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
    fn sentence(&self) -> String {
        match self {
            Self::Unset => format!(
                "No self-hosted endpoint is configured. Set {SELF_HOSTED_BASE_URL_ENV} to the base URL of an OpenAI-compatible server — the path this lane posts to is {{base}}/audio/transcriptions.",
            ),
            Self::Insecure { url } => format!(
                "The endpoint '{url}' is plain HTTP to a public host, so WordScript will not send audio or a token to it. Use HTTPS, or an address on your own network — a LAN, loopback or tailnet host over plain HTTP is accepted.",
            ),
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
        Ok(provider_status(request.model.as_deref()))
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
        role: ProviderRole,
    ) -> Result<RoleCredentialStatus, ProviderCommandError> {
        Ok(role_credential_status(role))
    }

    fn save_api_key(
        &self,
        _role: ProviderRole,
        _kind: CredentialKind,
        _api_key: &str,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        Err(ProviderCommandError::invalid_request(format!(
            "WordScript has nowhere to store a token for your server yet. The optional bearer token rides {SELF_HOSTED_TOKEN_ENV} beside the URL it belongs to, until this lane has a configuration surface.",
        )))
    }

    fn clear_api_key(
        &self,
        _role: ProviderRole,
        _kind: CredentialKind,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        Err(ProviderCommandError::invalid_request(format!(
            "There is no stored token to clear for your server. This lane reads {SELF_HOSTED_TOKEN_ENV} and writes nothing to the OS secret store.",
        )))
    }

    /// **`/models` rather than nothing, and the key it checks may be absent.**
    ///
    /// On the cloud lanes this asks *does this key authenticate*. Here the
    /// question a user actually has is *does WordScript reach the server I
    /// configured*, and the same endpoint answers it — with or without a token,
    /// because most of these servers take none.
    fn validate_api_key(
        &self,
        _api_key: Option<String>,
    ) -> ProviderFuture<ValidateProviderApiKeyResponse> {
        Box::pin(validate_endpoint())
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

fn provider_status(model: Option<&str>) -> ProviderStatus {
    let role_credentials: Vec<RoleCredentialStatus> = SELF_HOSTED_CREDENTIAL_ROLES
        .iter()
        .map(|role| role_credential_status(*role))
        .collect();

    ProviderStatus {
        provider: SELF_HOSTED_PROVIDER_ID.to_string(),
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
    }
}

/// The endpoint this lane posts to, or why there is none.
///
/// **The security check happens here and not at the call site**, so there is
/// exactly one place a base URL becomes usable. Every path below — the
/// transcription, the reachability probe, the status the screen reads — goes
/// through it, which is the property that makes the check worth having: a
/// second door with a second check is a second thing to get wrong.
fn resolve_endpoint() -> Result<String, EndpointProblem> {
    let raw = std::env::var(SELF_HOSTED_BASE_URL_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or(EndpointProblem::Unset)?;

    if !is_secure_endpoint(&raw) {
        return Err(EndpointProblem::Insecure { url: raw });
    }

    Ok(raw.trim_end_matches('/').to_string())
}

/// The optional bearer token. Absent is the ordinary case, not a failure.
fn resolve_token() -> String {
    std::env::var(SELF_HOSTED_TOKEN_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
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
fn resolve_model(model: Option<&str>) -> Result<String, ProviderCommandError> {
    model
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            std::env::var(SELF_HOSTED_MODEL_ENV)
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .ok_or_else(|| {
            ProviderCommandError::invalid_request(format!(
                "This job names no model and your server publishes no list to pick one from. Set {SELF_HOSTED_MODEL_ENV}, or give the job a model id of its own.",
            ))
        })
}

fn self_hosted_client(
    timeout_ms: u64,
    max_retries: u8,
) -> Result<CompatibleClient, ProviderCommandError> {
    let base_url = resolve_endpoint().map_err(|problem| {
        ProviderCommandError::new(
            ProviderErrorKind::InvalidRequest,
            problem.sentence(),
            None,
            None,
        )
    })?;

    CompatibleClient::new(
        SELF_HOSTED_VENDOR,
        base_url,
        resolve_token(),
        timeout_ms,
        max_retries,
    )
    .map_err(ProviderCommandError::from)
}

async fn validate_endpoint() -> Result<ValidateProviderApiKeyResponse, ProviderCommandError> {
    let client = self_hosted_client(DEFAULT_TIMEOUT_MS, 0)?;
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

async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<TranscriptionResponse, ProviderCommandError> {
    let model = resolve_model(request.model.as_deref())?;
    let client = self_hosted_client(
        request.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS),
        request.max_retries.unwrap_or(DEFAULT_MAX_RETRIES),
    )?;

    let (file_name, audio_bytes) = client
        .read_audio(&request.audio_path)
        .await
        .map_err(ProviderCommandError::from)?;

    let response_format = request
        .response_format
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| RESPONSE_FORMAT_JSON.to_string());

    // Same reason as on OpenRouter, different cause: there the vendor answers
    // no format that carries segments, here nobody knows what this server
    // answers. Either way the coverage verdict cannot be read as healthy.
    runtime_log::record(format!(
        "[WordScript] Your server transcription without segments model={} format={} coverage=unavailable",
        model, response_format,
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
        /* No credential is stored for this lane at all — see
           `SELF_HOSTED_CREDENTIAL_KINDS`. The registry holds this field to that
           list, which is what keeps the two from drifting. */
        requires_api_key: false,
        supports_prompt_bias: true,
        supports_language: true,
        /* Unknowable and therefore not claimed. Some of these servers answer
           `verbose_json` and this adapter does not ask for it. */
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

/// **What the lane is missing, in the field a surface already reads for it.**
///
/// `configured` means *this lane can run a job*, which on a cloud vendor is a
/// stored key and here is a usable endpoint. `missing` carries the sentence
/// naming the next action, which is the shape `local.rs` already uses for a
/// lane whose readiness is not a credential at all.
fn role_credential_status(role: ProviderRole) -> RoleCredentialStatus {
    let problem = resolve_endpoint().err();

    RoleCredentialStatus {
        provider: SELF_HOSTED_PROVIDER_ID.to_string(),
        role,
        /* `None`, because no KIND of credential answers here. A `Some(ApiKey)`
           would draw a key row on a lane that stores no key. */
        kind: None,
        configured: problem.is_none(),
        storage: "environment".to_string(),
        key_preview: None,
        missing: problem.map(|problem| problem.sentence()),
    }
}

#[cfg(test)]
mod tests {
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

    /// **The refusal this step owes a test** (D1a's own validation line): a URL
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
                let refused = refusal(self_hosted_client(5_000, 0));

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
    fn a_lan_server_on_plain_http_builds_a_client() {
        with_env(
            &[
                (SELF_HOSTED_BASE_URL_ENV, Some("http://10.0.0.2:8080/v1/")),
                (SELF_HOSTED_TOKEN_ENV, None),
            ],
            || {
                assert_eq!(resolve_endpoint(), Ok("http://10.0.0.2:8080/v1".to_string()));
                assert!(self_hosted_client(5_000, 0).is_ok());
            },
        );
    }

    /// **Unconfigured is a state and not a fault**, and the sentence names the
    /// door rather than reporting a failure the user did not cause.
    #[test]
    fn an_unconfigured_lane_says_what_to_set_rather_than_failing_obscurely() {
        with_env(&[(SELF_HOSTED_BASE_URL_ENV, None)], || {
            assert_eq!(resolve_endpoint(), Err(EndpointProblem::Unset));

            let status = role_credential_status(ProviderRole::Speech);
            assert!(!status.configured);
            assert!(status
                .missing
                .expect("an unconfigured lane names its door")
                .contains(SELF_HOSTED_BASE_URL_ENV));
            /* And it draws no key row, because there is no key. */
            assert!(status.kind.is_none());
        });
    }

    /// A configured endpoint reports the lane as usable, which is what
    /// `configured` means for a lane whose readiness is not a credential.
    #[test]
    fn a_configured_endpoint_reports_the_lane_as_usable() {
        with_env(
            &[(SELF_HOSTED_BASE_URL_ENV, Some("https://speech.example.com/v1"))],
            || {
                let status = role_credential_status(ProviderRole::Speech);
                assert!(status.configured);
                assert!(status.missing.is_none());
                assert_eq!(status.storage, "environment");
            },
        );
    }

    /// **The one adapter that refuses rather than substituting**, because there
    /// is no id it could substitute that would be more likely right than wrong.
    #[test]
    fn a_request_naming_no_model_is_refused_rather_than_given_a_guess() {
        with_env(&[(SELF_HOSTED_MODEL_ENV, None)], || {
            let refused = resolve_model(None).expect_err("nothing here knows what is installed");
            assert!(refused.message.contains(SELF_HOSTED_MODEL_ENV));

            // A typed id survives untouched — no catalogue, no substitution.
            assert_eq!(
                resolve_model(Some("ggml-large-v3-turbo")).unwrap(),
                "ggml-large-v3-turbo",
            );
            // Including one another lane catalogues, which every other adapter
            // would replace. Here it is very likely exactly what is installed.
            assert_eq!(resolve_model(Some("whisper-1")).unwrap(), "whisper-1");
        });
    }

    #[test]
    fn the_environment_supplies_the_model_when_the_job_names_none() {
        with_env(&[(SELF_HOSTED_MODEL_ENV, Some("Systran/faster-whisper-medium"))], || {
            assert_eq!(
                resolve_model(None).unwrap(),
                "Systran/faster-whisper-medium",
            );
            // And the job still outranks the environment.
            assert_eq!(resolve_model(Some("tiny.en")).unwrap(), "tiny.en");
        });
    }

    /// **Not the local lane, and the field that says so.** `local: true` means
    /// *runs on this machine*, which the capture budget and the surface both
    /// read for that meaning. A server on the LAN is private and is not local.
    #[test]
    fn a_private_server_is_not_a_local_runtime() {
        let capabilities = provider_capabilities();

        assert!(!capabilities.local);
        assert!(capabilities.transcription);
        assert!(!capabilities.requires_api_key);
        assert!(!capabilities.supports_segments);
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

    /// Saving a token is refused with the door named, rather than accepted into
    /// a store nothing reads — the fake-state defect with the user's own action
    /// as its cause.
    #[test]
    fn a_token_cannot_be_stored_and_the_refusal_says_where_it_goes_instead() {
        let refused = SELF_HOSTED
            .save_api_key(ProviderRole::Speech, CredentialKind::ApiKey, "a-token")
            .expect_err("this lane has no configuration surface yet");

        assert!(refused.message.contains(SELF_HOSTED_TOKEN_ENV));
    }
}
