//! OpenRouter: batch recognition, on D1's shape and a different base URL
//! (ADR 0113, D1a).
//!
//! **This module is the evidence for ADR 0113's claim.** That record said the
//! OpenAI-compatible audio shape reaches a further lane for a base URL, and the
//! whole of the transport here is `CompatibleClient::new` with
//! `https://openrouter.ai/api/v1` in it. What is left is the part the record
//! said does NOT travel with the shape: the ceiling, the timeout, the model
//! list and the credential, each of which this vendor answers for itself.
//!
//! **Speech only, and the absence is the statement** (ADR 0109). OpenRouter
//! serves `/chat/completions` — `docs/PROVIDERS.md` reads it, `data.ts` draws
//! the row `llm: true`, and none of that makes it this step's. ADR 0113 leaves
//! the chat role in G3 and this entry registers `chat: None`, which is a fact
//! about WordScript. **The screen must not report it as a fact about the
//! vendor**, and until D1a it could not have told the difference: every
//! registered provider served every role its drawn row claimed. That is the
//! seam correction in `src/lib/providerSeam.ts` and it is half of what this
//! step cost.
//!
//! **The model list is somebody else's and that is the interesting part**
//! (ADR 0110). Behind one id sits an upstream this build never talks to
//! directly, so `Unknown` is the honest answer for nearly every capability
//! question here — not because the ids are obscure, but because the vendor
//! routes and the routing is not published per request. ADR 0110's third value
//! was written about this lane before there was a lane.

use crate::core::model_catalogue;
use crate::core::runtime_log;

use super::{
    aggregate_credential,
    credential_store::{self, KeyShape, OsSecretStore},
    openai_compatible::{format_audio_size, CompatibleClient, CompatibleError, TranscriptionPlan},
    registry::{Provider, ProviderFuture, SpeechProvider},
    CredentialKind, ModelCapabilities, ModelSupport, ProviderCapabilities, ProviderCaptureLimits,
    ProviderCommandError, ProviderCredentialStatus, ProviderErrorKind, ProviderMode,
    ProviderProfile, ProviderRole, ProviderStatus, ProviderStatusRequest, ProviderTier,
    RoleCredentialStatus, TranscribeAudioFileRequest, TranscriptionResponse,
    ValidateProviderApiKeyResponse,
};

pub const OPENROUTER_PROVIDER_ID: &str = "openrouter";
const OPENROUTER_VENDOR: &str = "OpenRouter";
/// The base URL the vendor documents for pointing an OpenAI client at it.
const OPENROUTER_API_BASE: &str = "https://openrouter.ai/api/v1";

/// The catalogue rows this adapter operates, by slug (ADR 0115).
const OPENROUTER_SPEECH_WHISPER_ROW: &str = "openrouter-speech-whisper-large-v3";
const OPENROUTER_SPEECH_GPT_4O_ROW: &str = "openrouter-speech-gpt-4o-transcribe";
const OPENROUTER_SPEECH_GPT_4O_MINI_ROW: &str = "openrouter-speech-gpt-4o-mini-transcribe";

/// **`json`, and never `verbose_json`.**
///
/// `verbose_json` is what carries `duration` and `segments`, which is what
/// `TranscriptionCoverage` reads to say *the recogniser stopped before the
/// audio did*. OpenAI documents that format for `whisper-1` alone and this
/// vendor documents it for nothing: the announcement names JSON in and JSON
/// out, and says explicitly that SRT and VTT are not served. Asking for a
/// format the endpoint does not answer costs the whole request; asking for the
/// endpoint's own default costs a coverage verdict, and `transcribe_audio_file`
/// below says so in the log rather than letting `unknown` read as healthy.
const RESPONSE_FORMAT_JSON: &str = "json";

const OPENROUTER_CREDENTIAL_ROLES: &[ProviderRole] = &[ProviderRole::Speech];
const OPENROUTER_CREDENTIAL_KINDS: &[CredentialKind] = &[CredentialKind::ApiKey];

/// 25 **MB**, decimal, and the unit is the reason for this comment.
///
/// The vendor writes "25MB" on the multipart path and does not disambiguate the
/// unit; Groq and OpenAI both publish numbers this repo records as MiB. The two
/// readings differ by 1.2 MiB and one of them has to be picked before a request
/// is built. **Decimal is the smaller of the two, and being wrong towards
/// smaller costs a sentence while being wrong the other way costs the upload** —
/// the same direction `openai.rs` argues for its response format, for the same
/// reason.
const OPENROUTER_MAX_AUDIO_BYTES: usize = 25_000_000;

pub const OPENROUTER_STANDARD_TIER_ID: &str = "standard";

/// **Longer than the vendor's own cut, on purpose.**
///
/// OpenRouter documents a 60-second upstream timeout: at that point IT gives up
/// on whoever is serving the model and answers. A client timeout below 60 s
/// would report *WordScript timed out* for a request the vendor was about to
/// explain, and the vendor's sentence is the one that says which upstream was
/// slow. So this waits past the cut and lets the answer arrive.
const DEFAULT_TIMEOUT_MS: u64 = 70_000;
const DEFAULT_MAX_RETRIES: u8 = 2;

type OpenRouterError = CompatibleError;

/// OpenRouter as the registry sees it: one key, many upstreams, recognition.
pub struct OpenRouter;

pub static OPENROUTER: OpenRouter = OpenRouter;

impl Provider for OpenRouter {
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
        OPENROUTER_CREDENTIAL_KINDS
    }

    fn credential_status(
        &self,
        connection: &str,
        role: ProviderRole,
    ) -> Result<RoleCredentialStatus, ProviderCommandError> {
        role_credential_status(connection, role).map_err(ProviderCommandError::from)
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

    fn validate_api_key(
        &self,
        connection: &str,
        api_key: Option<String>,
    ) -> ProviderFuture<ValidateProviderApiKeyResponse> {
        Box::pin(validate_api_key(connection.to_string(), api_key))
    }
}

impl SpeechProvider for OpenRouter {
    fn transcribe_audio_file(
        &self,
        request: TranscribeAudioFileRequest,
    ) -> ProviderFuture<TranscriptionResponse> {
        Box::pin(transcribe_audio_file(request))
    }

    fn tiers(&self) -> Vec<ProviderTier> {
        tiers()
    }

    /// One published ceiling, and neither argument moves it. **The plan behind
    /// the key does not** — this vendor bills by credit rather than by tier —
    /// **and the model does not either**, because the 25 MB is a limit on the
    /// multipart request OpenRouter accepts, before it decides which upstream
    /// sees it.
    fn capture_limits(&self, _model: &str, _tier_id: &str) -> ProviderCaptureLimits {
        capture_limits()
    }
}

fn provider_status(
    connection: &str,
    model: Option<&str>,
) -> Result<ProviderStatus, ProviderCommandError> {
    let role_credentials = role_credentials(connection).map_err(ProviderCommandError::from)?;

    Ok(ProviderStatus {
        provider: OPENROUTER_PROVIDER_ID.to_string(),
        default_profile: "openrouter-quality".to_string(),
        credential: aggregate_credential(OPENROUTER_PROVIDER_ID, &role_credentials),
        profiles: provider_profiles(),
        capabilities: provider_capabilities(),
        model_capabilities: model_capabilities(model.unwrap_or_default()),
        role_credentials,
        local_setup: None,
        self_hosted_endpoint: None,
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
    let api_key = normalize_api_key(api_key)?;
    credential_store::write_to(&OsSecretStore, connection, role, kind, &api_key)
        .map_err(secret_store_error)?;
    credential_store::cache_key(&credential_entry_user(connection, role, kind), Some(api_key));
    credential_status(connection).map_err(ProviderCommandError::from)
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
    credential_status(connection).map_err(ProviderCommandError::from)
}

/// **A key is refused for a role this lane does not serve, and the sentence
/// says which role it does.**
///
/// ADR 0105's rule is that a job never inherits a credential its role cannot
/// use; the storage half of it is that a credential is never written for a role
/// with no implementation behind it. On every other vendor in this build the
/// case is unreachable, because they register every role they are asked about.
/// Here it is reachable the moment somebody stores a chat key in the hope the
/// writing jobs will follow — and the honest answer is that they will not,
/// because there is nothing to route them to (G3).
fn ensure_supported_role(role: ProviderRole) -> Result<(), ProviderCommandError> {
    if OPENROUTER_CREDENTIAL_ROLES.contains(&role) {
        return Ok(());
    }

    Err(ProviderCommandError::invalid_request(format!(
        "WordScript cannot store a credential for {} on OpenRouter. The vendor serves that role and this build has no adapter for it yet, so a key stored here would pay for nothing.",
        role.label(),
    )))
}

fn ensure_supported_kind(kind: CredentialKind) -> Result<(), ProviderCommandError> {
    if OPENROUTER_CREDENTIAL_KINDS.contains(&kind) {
        return Ok(());
    }

    Err(ProviderCommandError::invalid_request(format!(
        "WordScript cannot store {} for OpenRouter. ADR 0102 permits a subscription credential for one vendor, and it is not this one.",
        kind.label(),
    )))
}

async fn validate_api_key(
    connection: String,
    api_key: Option<String>,
) -> Result<ValidateProviderApiKeyResponse, ProviderCommandError> {
    let (api_key, checked_with) = match api_key {
        Some(value) if !value.trim().is_empty() => {
            (normalize_api_key(&value)?, "provided_key".to_string())
        }
        _ => (
            load_api_key(&connection, ProviderRole::Speech)?,
            "stored_key".to_string(),
        ),
    };

    let client = openrouter_client(api_key, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RETRIES)?;
    client
        .validate_models_endpoint()
        .await
        .map_err(ProviderCommandError::from)?;

    Ok(ValidateProviderApiKeyResponse {
        ok: true,
        provider: OPENROUTER_PROVIDER_ID.to_string(),
        checked_with,
    })
}

fn openrouter_client(
    api_key: String,
    timeout_ms: u64,
    max_retries: u8,
) -> Result<CompatibleClient, ProviderCommandError> {
    CompatibleClient::new(
        OPENROUTER_VENDOR,
        OPENROUTER_API_BASE,
        api_key,
        timeout_ms,
        max_retries,
    )
    .map_err(ProviderCommandError::from)
}

async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<TranscriptionResponse, ProviderCommandError> {
    let api_key = load_api_key(&request.connection, ProviderRole::Speech)?;
    let client = openrouter_client(
        api_key,
        request.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS),
        request.max_retries.unwrap_or(DEFAULT_MAX_RETRIES),
    )?;

    let (file_name, audio_bytes) = client
        .read_audio(&request.audio_path)
        .await
        .map_err(ProviderCommandError::from)?;

    validate_audio_upload_size(&file_name, audio_bytes.len())
        .map_err(ProviderCommandError::from)?;

    let model = resolve_speech_model(request.model.as_deref().unwrap_or_default());
    let response_format = request
        .response_format
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| RESPONSE_FORMAT_JSON.to_string());

    // Said out loud on every request rather than on the exceptional one,
    // because on this lane there is no exception: no id here answers
    // `verbose_json`, so the coverage instrument cannot answer at all and a
    // silent `unknown` would read as a healthy transcript.
    runtime_log::record(format!(
        "[WordScript] OpenRouter transcription without segments model={} format={} coverage=unavailable",
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

/// The model a recognition request runs, with another lane's id substituted.
///
/// The same rule `openai.rs` states and for the same case: a profile that
/// recognised on Groq holds `whisper-large-v3-turbo`, and switching the
/// connection leaves that string in place. **The question asked is whose id
/// this is**, never *do I know this id*, because an id the catalogue has never
/// seen is the user's own typed override and ADR 0115 requires it to survive.
///
/// **On this lane that second half matters more than anywhere else.**
/// OpenRouter's list is thousands long and this build catalogues five of them;
/// treating an uncatalogued id as unknown-and-therefore-replaced would break
/// the lane's entire reason for existing, which is reaching models nobody here
/// wrote a row for.
fn resolve_speech_model(model: &str) -> String {
    let model = model.trim();
    if model.is_empty() {
        return model_catalogue::model_id(OPENROUTER_SPEECH_WHISPER_ROW).to_string();
    }

    match model_catalogue::provider_for_model_id(model, ProviderRole::Speech) {
        Some(owner) if owner != OPENROUTER_PROVIDER_ID => {
            let substitute = model_catalogue::model_id(OPENROUTER_SPEECH_WHISPER_ROW);
            runtime_log::record(format!(
                "[WordScript] OpenRouter substituted a model belonging to another lane role=speech requested={} owner={} using={}",
                model, owner, substitute,
            ));
            substitute.to_string()
        }
        _ => model.to_string(),
    }
}

fn provider_profiles() -> Vec<ProviderProfile> {
    vec![
        ProviderProfile {
            id: "openrouter-fast".to_string(),
            provider: OPENROUTER_PROVIDER_ID.to_string(),
            mode: ProviderMode::Fast,
            model: model_catalogue::model_id(OPENROUTER_SPEECH_GPT_4O_MINI_ROW).to_string(),
            label: "OpenRouter fast transcription".to_string(),
            default: false,
            requires_api_key: true,
        },
        /* THE DEFAULT IS THE ID WHOSE UPSTREAM IS LEAST LIKELY TO MOVE. On a
           lane that routes, the risk that decides a default is not accuracy but
           availability: `openai/whisper-large-v3` names weights several
           providers behind this vendor serve, so a single upstream going down
           is not this lane going down. `openai.rs` picks its default for
           coverage instead, and can, because there the endpoint is the
           vendor's own. */
        ProviderProfile {
            id: "openrouter-quality".to_string(),
            provider: OPENROUTER_PROVIDER_ID.to_string(),
            mode: ProviderMode::Quality,
            model: model_catalogue::model_id(OPENROUTER_SPEECH_WHISPER_ROW).to_string(),
            label: "OpenRouter transcription".to_string(),
            default: true,
            requires_api_key: true,
        },
    ]
}

fn provider_capabilities() -> ProviderCapabilities {
    ProviderCapabilities {
        transcription: true,
        /* **FALSE ABOUT THIS BUILD, NOT ABOUT THE VENDOR** (ADR 0113, G3).
           OpenRouter serves `/chat/completions` and this entry registers no
           chat role, so the field is `false` and the registry test holds it to
           `chat.is_some()`. The sentence a surface makes of it is the seam's
           job, and `providerSeam.ts` was corrected in this same step so it says
           *WordScript has no chat adapter for OpenRouter* rather than
           *OpenRouter does not do chat completion*. */
        chat_completion: false,
        /* `/audio/speech` exists here too and reaches four vendors' synthesis
           on one key — the cheapest row in G3's own list. It is still nothing
           this build can operate, and ADR 0109 keeps the adapter behind the row
           that runs it. */
        speech_synthesis: false,
        local: false,
        requires_api_key: true,
        supports_prompt_bias: true,
        supports_language: true,
        /* **The one field on this struct that is a guess anywhere, and here it
           is a no.** No id on this lane answers `verbose_json`, so no request
           this adapter builds can come back with segments. */
        supports_segments: false,
        model_management: false,
    }
}

/// What one of OpenRouter's ids does — **and `Unknown` is the answer for nearly
/// all of it, on the lane ADR 0110's third value was written about.**
///
/// The registry's own fixture has carried this case since A2 under the comment
/// *"the OpenRouter case, which ADR 0110 stops treating as an exception"*. Now
/// there is a vendor behind it. Two ids name weights whose upstream
/// documentation this repo HAS read — they are the same models OpenAI serves —
/// and even for those the streaming answer stays `Unknown`, because what is
/// asked is whether the request WordScript builds against THIS endpoint
/// streams, and the vendor documents no streaming transcription at all.
fn model_capabilities(model: &str) -> ModelCapabilities {
    let model = resolve_speech_model(model);
    let names_languages = [
        model_catalogue::model_id(OPENROUTER_SPEECH_GPT_4O_ROW),
        model_catalogue::model_id(OPENROUTER_SPEECH_GPT_4O_MINI_ROW),
    ];

    ModelCapabilities {
        /* **`Unsupported`, and it is a measurement rather than a shrug.** The
           vendor's announcement names the audio endpoints and says streaming
           applies to speech OUT; `docs/PROVIDERS.md` records that streaming
           transcription is still undocumented here, and that half of the entry
           survived the correction that rewrote the rest of it. A request built
           by this adapter does not stream, whatever the upstream can do. */
        transcription_streaming: ModelSupport::Unsupported,
        /* And this one is `Unknown` for the ids nobody read and `Supported`
           for the two whose upstream documents naming the languages it heard.
           The pair is the reason this function exists rather than a constant:
           one key, one endpoint, two answers (ADR 0110). */
        reports_detected_language: if names_languages.contains(&model.as_str()) {
            ModelSupport::Supported
        } else {
            ModelSupport::Unknown
        },
        /* No voice role is registered, so nothing here can answer for one. */
        synthesis_streaming: ModelSupport::Unknown,
        model,
    }
}

fn credential_status(connection: &str) -> Result<ProviderCredentialStatus, OpenRouterError> {
    Ok(aggregate_credential(
        OPENROUTER_PROVIDER_ID,
        &role_credentials(connection)?,
    ))
}

fn role_credentials(connection: &str) -> Result<Vec<RoleCredentialStatus>, OpenRouterError> {
    OPENROUTER_CREDENTIAL_ROLES
        .iter()
        .map(|role| role_credential_status(connection, *role))
        .collect()
}

fn role_credential_status(connection: &str, role: ProviderRole) -> Result<RoleCredentialStatus, OpenRouterError> {
    let kind = CredentialKind::ApiKey;

    match credential_store::read_from(&OsSecretStore, connection, role, kind)
        .map_err(secret_store_error)?
    {
        Some(api_key) => {
            credential_store::cache_key(&credential_entry_user(connection, role, kind), Some(api_key.clone()));
            Ok(RoleCredentialStatus {
                provider: OPENROUTER_PROVIDER_ID.to_string(),
                role,
                kind: Some(kind),
                configured: true,
                storage: "os_secret_store".to_string(),
                key_preview: Some(credential_store::mask_api_key(&api_key)),
                missing: None,
            })
        }
        None => Ok(RoleCredentialStatus {
            provider: OPENROUTER_PROVIDER_ID.to_string(),
            role,
            kind: Some(kind),
            configured: false,
            storage: "os_secret_store".to_string(),
            key_preview: None,
            missing: Some(format!("{} for {}", kind.label(), role.label())),
        }),
    }
}

fn credential_entry_user(connection: &str, role: ProviderRole, kind: CredentialKind) -> String {
    credential_store::entry_user(connection, role, kind)
}

fn load_api_key(connection: &str, role: ProviderRole) -> Result<String, ProviderCommandError> {
    let kind = CredentialKind::ApiKey;
    let user = credential_entry_user(connection, role, kind);

    if let Some(api_key) = credential_store::cached(&user) {
        return Ok(api_key);
    }

    match credential_store::read_from(&OsSecretStore, connection, role, kind)
        .map_err(secret_store_error)?
    {
        Some(api_key) => {
            let normalized = normalize_api_key(&api_key)?;
            credential_store::cache_key(&user, Some(normalized.clone()));
            Ok(normalized)
        }
        None => Err(ProviderCommandError::from(OpenRouterError {
            kind: ProviderErrorKind::MissingApiKey,
            message: format!(
                "No OpenRouter API key is stored for {}. Save one for that job's role in AI Models.",
                role.label(),
            ),
            status: None,
            retry_after_seconds: None,
        })),
    }
}

/// **No prefix check, and the absence is deliberate.**
///
/// `groq.rs` refuses a key that does not start with `gsk_` and `openai.rs` one
/// that does not start with `sk-`, and both prefixes are recorded in this repo
/// against a vendor page. Nothing here has read one for OpenRouter. Inventing
/// the check from memory refuses valid keys on a lane whose whole point is that
/// it is easy to get into, and the cost of the two mistakes is not symmetric: a
/// wrong-vendor key pasted here fails on the first `/models` call with the
/// vendor's own 401, which is a sentence the user can act on.
fn normalize_api_key(api_key: &str) -> Result<String, ProviderCommandError> {
    credential_store::normalized_key(api_key, None)
        .map(str::to_string)
        .map_err(|shape| {
            ProviderCommandError::from(match shape {
                KeyShape::Empty => OpenRouterError {
                    kind: ProviderErrorKind::MissingApiKey,
                    message: "OpenRouter API key must not be empty.".to_string(),
                    status: None,
                    retry_after_seconds: None,
                },
                KeyShape::WrongPrefix => OpenRouterError {
                    kind: ProviderErrorKind::InvalidRequest,
                    message: "OpenRouter API key was refused by its shape.".to_string(),
                    status: None,
                    retry_after_seconds: None,
                },
            })
        })
}

fn secret_store_error(error: keyring::Error) -> OpenRouterError {
    OpenRouterError {
        kind: ProviderErrorKind::SecretStoreUnavailable,
        message: format!("OS secret store is unavailable: {error}"),
        status: None,
        retry_after_seconds: None,
    }
}

fn validate_audio_upload_size(
    file_name: &str,
    audio_bytes_len: usize,
) -> Result<(), OpenRouterError> {
    if audio_bytes_len <= OPENROUTER_MAX_AUDIO_BYTES {
        return Ok(());
    }

    Err(OpenRouterError {
        kind: ProviderErrorKind::InvalidRequest,
        message: format!(
            "OpenRouter cannot accept '{}' because {} exceeds the documented maximum of {} on its multipart path. Shorten the recording or export it at a lower bitrate before upload.",
            file_name,
            format_audio_size(audio_bytes_len),
            format_audio_size(OPENROUTER_MAX_AUDIO_BYTES),
        ),
        status: Some(413),
        retry_after_seconds: None,
    })
}

/// One ceiling for every key. **This vendor bills by credit, not by plan**, so
/// there is no second tier to choose — and one entry rather than none, because
/// an empty list reads on the surface as a runtime that did not answer.
fn tiers() -> Vec<ProviderTier> {
    vec![ProviderTier {
        id: OPENROUTER_STANDARD_TIER_ID.to_string(),
        label: "Standard — 25 MB per request".to_string(),
        max_audio_bytes: OPENROUTER_MAX_AUDIO_BYTES as u64,
        default: true,
    }]
}

fn capture_limits() -> ProviderCaptureLimits {
    ProviderCaptureLimits {
        max_audio_bytes: Some(OPENROUTER_MAX_AUDIO_BYTES as u64),
        /* **The 60-second upstream timeout is not a `realtime_factor` and must
           not be written as one.** That field means seconds of decode per
           second of audio — a compute bound, which is the local lane's shape.
           This is a wall clock on the whole request regardless of how long the
           audio is, so a long file fails on it and a short slow one does too.
           `docs/PROVIDERS.md` says a meeting does not fit through this door,
           and it is the timeout rather than the size that shuts it. */
        realtime_factor: None,
        detail: "the 25 MB multipart limit OpenRouter documents, under a 60-second upstream timeout that no file size accounts for".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// **ADR 0113's claim, as a test rather than as prose.** The transport is
    /// the shared one; what this module holds is the four answers the record
    /// said do not travel with it.
    #[test]
    fn the_lane_is_a_base_url_on_the_shared_shape() {
        assert_eq!(OPENROUTER_API_BASE, "https://openrouter.ai/api/v1");
        // Built through the shared constructor, which is what "calls the helper
        // rather than copying it" means where it can be checked.
        assert!(openrouter_client("test-key".to_string(), 5_000, 0).is_ok());
    }

    /// **The ceilings do not travel with the shape** (ADR 0113). Three vendors
    /// on one request builder, three different numbers, and this is the one
    /// that would be silently borrowed if `capture_limits` were shared.
    #[test]
    fn the_ceiling_is_this_vendors_own_and_smaller_than_the_openai_one() {
        let limits = capture_limits();

        assert_eq!(limits.max_audio_bytes, Some(25_000_000));
        assert!(limits.max_audio_bytes < Some(25 * 1024 * 1024));
        assert!(limits.realtime_factor.is_none());
        // The timeout is a fact about the door and belongs in the sentence,
        // because no file size predicts it.
        assert!(limits.detail.contains("60-second"));
    }

    #[test]
    fn an_upload_above_the_documented_ceiling_is_refused_before_the_request() {
        let error = validate_audio_upload_size("meeting.wav", 30_000_000)
            .expect_err("30 MB is above the published 25");

        assert_eq!(error.kind, ProviderErrorKind::InvalidRequest);
        assert!(error.message.contains("meeting.wav"));
        assert!(validate_audio_upload_size("short.wav", 1024).is_ok());
    }

    /// **The half of this lane that is not built, refused where it would be
    /// stored.** ADR 0113 leaves the chat role in G3; a key saved for it would
    /// be a credential paying for a route that does not exist.
    #[test]
    fn a_credential_for_the_role_this_build_has_not_written_is_refused() {
        let refused = ensure_supported_role(ProviderRole::Chat)
            .expect_err("the chat adapter is G3's");

        assert!(refused.message.contains("no adapter"));
        assert!(ensure_supported_role(ProviderRole::Speech).is_ok());
    }

    #[test]
    fn no_subscription_is_accepted_here() {
        let refused = ensure_supported_kind(CredentialKind::Subscription)
            .expect_err("ADR 0102 permits one vendor and it is OpenAI");

        assert!(refused.message.contains("ADR 0102"));
    }

    /// **The lane's own reason for existing, as an assertion.** OpenRouter is
    /// worth an adapter because it reaches models nobody here catalogued, so an
    /// id this build has never seen has to survive untouched — while an id
    /// belonging demonstrably to another lane is still substituted.
    #[test]
    fn an_uncatalogued_id_survives_and_another_lanes_id_does_not() {
        // Somebody else's id, catalogued, and therefore replaced.
        assert_eq!(
            resolve_speech_model("whisper-large-v3-turbo"),
            "openai/whisper-large-v3",
        );
        // An id nobody wrote a row for. This is the lane's whole point.
        assert_eq!(
            resolve_speech_model("deepgram/nova-3"),
            "deepgram/nova-3",
        );
        assert_eq!(resolve_speech_model(""), "openai/whisper-large-v3");
        // And this lane's own catalogued ids are left alone.
        assert_eq!(
            resolve_speech_model("openai/gpt-4o-transcribe"),
            "openai/gpt-4o-transcribe",
        );
    }

    /// **Two ids, one key, one endpoint, two answers** — the shape ADR 0110
    /// was written about, on the lane whose model list is somebody else's.
    #[test]
    fn a_model_this_build_has_read_about_answers_and_the_rest_answer_unknown() {
        let read = model_capabilities("openai/gpt-4o-transcribe");
        let unread = model_capabilities("google/chirp-3");

        assert_eq!(read.reports_detected_language, ModelSupport::Supported);
        assert_eq!(unread.reports_detected_language, ModelSupport::Unknown);

        // AND NEITHER STREAMS, because the question is what the request THIS
        // adapter builds does, not what the upstream is capable of.
        assert_eq!(read.transcription_streaming, ModelSupport::Unsupported);
        assert_eq!(unread.transcription_streaming, ModelSupport::Unsupported);
    }

    /// The registry is the one answer to which roles exist here, and this lane
    /// is the first where that list is shorter than the drawn row's claim.
    #[test]
    fn the_credential_roles_are_the_roles_the_registry_registered() {
        let entry = super::super::registry::resolve_entry(OPENROUTER_PROVIDER_ID)
            .expect("openrouter is registered");

        assert_eq!(entry.roles(), OPENROUTER_CREDENTIAL_ROLES.to_vec());
        assert!(entry.chat.is_none(), "the chat role is G3's");
        assert!(entry.speech.is_some());
    }

    /// A default profile that named an id the catalogue does not carry would
    /// resolve to a literal somewhere else, which is the state ADR 0115 ended.
    #[test]
    fn the_default_profile_runs_a_catalogued_id() {
        let profiles = provider_profiles();
        let default = profiles
            .iter()
            .find(|profile| profile.default)
            .expect("openrouter declares a default profile");

        assert_eq!(
            default.model,
            model_catalogue::model_id(OPENROUTER_SPEECH_WHISPER_ROW),
        );
        assert_eq!(resolve_speech_model(&default.model), default.model);
    }
}
