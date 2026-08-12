//! OpenAI: batch recognition and completions on one key (ADR 0096, step 1).
//!
//! **The first adapter the registry was built for**, and the vendor ADR 0110
//! was written about. Everything it needs already existed: A1 gave it three
//! traits and a registry line, A2 the model axis, A3 a credential per role,
//! B1 the seam that lets a surface say why a row is inert, and B3 the catalogue
//! its model ids are rows in. **If this file had to change any of them, one of
//! those steps was incomplete.** It did not.
//!
//! **The one thing it could not inherit is the response format.** Groq answers
//! `verbose_json` for every model it serves; OpenAI documents that format for
//! `whisper-1` alone (`developers.openai.com/api/docs/guides/speech-to-text`,
//! read 2026-08-12). A shared default would have made every
//! `gpt-4o-transcribe` request a 400, which is why `openai_compatible` takes
//! the format as an argument rather than holding one.
//!
//! **And the consequence goes further than a parameter.** `verbose_json` is
//! what carries `duration` and `segments`, and those are what
//! `TranscriptionCoverage` reads to say *the recogniser stopped before the
//! audio did* — the instrument `known-issues/transcript-stops-before-the-audio-does.md`
//! exists for. So on this lane the choice of model decides whether that check
//! can answer at all, and this adapter says so out loud rather than letting the
//! verdict quietly become `unknown` on a model somebody picked for its accuracy.
//!
//! **No `VoiceProvider`.** OpenAI serves `/v1/audio/speech` and this build
//! registers no voice role for it: `VoiceProvider` carries no method until F1
//! (ADR 0114), and ADR 0109 keeps every adapter behind the row that operates
//! it. The registry entry's `voice: None` is the whole statement.
//!
//! **No subscription credential.** ADR 0102 permits one for this vendor and one
//! only, and `credential_kinds` below is where that permission would be
//! declared. It is not declared here because D3 builds the OAuth flow and a
//! kind with no way to acquire it is a control that fails after the user has
//! done everything the screen asked.

use crate::core::model_catalogue;
use crate::core::runtime_log;

use super::{
    aggregate_credential,
    credential_store::{self, KeyShape, OsSecretStore},
    openai_compatible::{format_audio_size, CompatibleClient, CompatibleError, TranscriptionPlan},
    registry::{ChatProvider, Provider, ProviderFuture, SpeechProvider},
    ChatCompletionRequest, CredentialKind, ModelCapabilities, ModelSupport, ProviderCapabilities,
    ProviderCaptureLimits, ProviderCommandError, ProviderCredentialStatus, ProviderErrorKind,
    ProviderMode, ProviderProfile, ProviderRole, ProviderStatus, ProviderStatusRequest,
    ProviderTier, RoleCredentialStatus, TranscribeAudioFileRequest, TranscriptionResponse,
    ValidateProviderApiKeyResponse,
};

pub const OPENAI_PROVIDER_ID: &str = "openai";
const OPENAI_VENDOR: &str = "OpenAI";
const OPENAI_API_BASE: &str = "https://api.openai.com/v1";
/// Both `sk-` and `sk-proj-` keys start here, so the prefix catches a Groq key
/// in this field without refusing either of the vendor's own shapes.
const OPENAI_KEY_PREFIX: &str = "sk-";

/// The catalogue rows this adapter operates, by slug (ADR 0115). **An adapter
/// names a row, never a model id** — the ids themselves live in
/// `shared/model_catalogue.json` and are read once, there.
const OPENAI_SPEECH_WHISPER_ROW: &str = "openai-speech-whisper-1";
const OPENAI_SPEECH_GPT_4O_ROW: &str = "openai-speech-gpt-4o-transcribe";
const OPENAI_SPEECH_GPT_ROW: &str = "openai-speech-gpt-transcribe";
const OPENAI_SPEECH_GPT_4O_MINI_ROW: &str = "openai-speech-gpt-4o-mini-transcribe";
const OPENAI_CHAT_DEFAULT_ROW: &str = "openai-chat-terra";

/// The two formats this endpoint answers, and the rule that picks between them.
const RESPONSE_FORMAT_VERBOSE: &str = "verbose_json";
const RESPONSE_FORMAT_JSON: &str = "json";

const OPENAI_CREDENTIAL_ROLES: &[ProviderRole] = &[ProviderRole::Speech, ProviderRole::Chat];
/// **An API key, and only an API key, until D3.** See the module note.
const OPENAI_CREDENTIAL_KINDS: &[CredentialKind] = &[CredentialKind::ApiKey];

/// 25 MB per uploaded file, documented and not plan-dependent.
///
/// Groq's ceiling moves with the account plan, so it declares two tiers and the
/// user picks one. OpenAI publishes one number for every account, which is why
/// `tiers()` below answers with a single entry rather than with an empty list:
/// a plan row that offered nothing to choose would read as a runtime that did
/// not answer.
const OPENAI_MAX_AUDIO_BYTES: usize = 25 * 1024 * 1024;

pub const OPENAI_STANDARD_TIER_ID: &str = "standard";

const DEFAULT_TIMEOUT_MS: u64 = 55_000;
const DEFAULT_MAX_RETRIES: u8 = 2;

type OpenAiError = CompatibleError;

/// OpenAI as the registry sees it: recognition and completions on one key.
pub struct OpenAi;

pub static OPENAI: OpenAi = OpenAi;

impl Provider for OpenAi {
    fn status(
        &self,
        request: &ProviderStatusRequest,
    ) -> Result<ProviderStatus, ProviderCommandError> {
        provider_status(request.model.as_deref())
    }

    fn capabilities(&self) -> ProviderCapabilities {
        provider_capabilities()
    }

    fn model_capabilities(&self, model: &str) -> ModelCapabilities {
        model_capabilities(model)
    }

    fn credential_kinds(&self) -> &'static [CredentialKind] {
        OPENAI_CREDENTIAL_KINDS
    }

    fn credential_status(
        &self,
        role: ProviderRole,
    ) -> Result<RoleCredentialStatus, ProviderCommandError> {
        role_credential_status(role).map_err(ProviderCommandError::from)
    }

    fn save_api_key(
        &self,
        role: ProviderRole,
        kind: CredentialKind,
        api_key: &str,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        save_api_key(role, kind, api_key)
    }

    fn clear_api_key(
        &self,
        role: ProviderRole,
        kind: CredentialKind,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        clear_api_key(role, kind)
    }

    fn validate_api_key(
        &self,
        api_key: Option<String>,
    ) -> ProviderFuture<ValidateProviderApiKeyResponse> {
        Box::pin(validate_api_key(api_key))
    }
}

impl SpeechProvider for OpenAi {
    fn transcribe_audio_file(
        &self,
        request: TranscribeAudioFileRequest,
    ) -> ProviderFuture<TranscriptionResponse> {
        Box::pin(transcribe_audio_file(request))
    }

    fn tiers(&self) -> Vec<ProviderTier> {
        tiers()
    }

    /// One published ceiling for every account, so neither argument moves it.
    fn capture_limits(&self, _model: &str, _tier_id: &str) -> ProviderCaptureLimits {
        capture_limits()
    }
}

impl ChatProvider for OpenAi {
    fn create_chat_completion(&self, request: ChatCompletionRequest) -> ProviderFuture<String> {
        Box::pin(create_chat_completion(request))
    }
}

fn provider_status(model: Option<&str>) -> Result<ProviderStatus, ProviderCommandError> {
    let role_credentials = role_credentials().map_err(ProviderCommandError::from)?;

    Ok(ProviderStatus {
        provider: OPENAI_PROVIDER_ID.to_string(),
        default_profile: "openai-quality".to_string(),
        credential: aggregate_credential(OPENAI_PROVIDER_ID, &role_credentials),
        profiles: provider_profiles(),
        capabilities: provider_capabilities(),
        model_capabilities: model_capabilities(model.unwrap_or_default()),
        role_credentials,
        local_setup: None,
    })
}

fn save_api_key(
    role: ProviderRole,
    kind: CredentialKind,
    api_key: &str,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    ensure_supported_kind(kind)?;
    let api_key = normalize_api_key(api_key)?;
    credential_store::write_to(&OsSecretStore, OPENAI_PROVIDER_ID, role, kind, &api_key)
        .map_err(secret_store_error)?;
    credential_store::cache_key(&credential_entry_user(role, kind), Some(api_key));
    credential_status().map_err(ProviderCommandError::from)
}

fn clear_api_key(
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    ensure_supported_kind(kind)?;
    credential_store::clear_in(&OsSecretStore, OPENAI_PROVIDER_ID, role, kind)
        .map_err(secret_store_error)?;
    credential_store::cache_key(&credential_entry_user(role, kind), None);
    credential_status().map_err(ProviderCommandError::from)
}

/// A subscription is refused where it would be stored, and the sentence says
/// what is missing rather than that the kind is wrong.
///
/// ADR 0102 permits this vendor a subscription and the flow that acquires one
/// is D3. Accepting the kind before then would store a credential nothing can
/// fill, which reads on the surface as a configured connection that fails on
/// first use — the fake-state defect with the user's own action as its cause.
fn ensure_supported_kind(kind: CredentialKind) -> Result<(), ProviderCommandError> {
    if OPENAI_CREDENTIAL_KINDS.contains(&kind) {
        return Ok(());
    }

    Err(ProviderCommandError::invalid_request(format!(
        "WordScript cannot store {} for OpenAI yet. The sign-in that acquires one is not built, so an API key is the credential this lane has.",
        kind.label(),
    )))
}

async fn validate_api_key(
    api_key: Option<String>,
) -> Result<ValidateProviderApiKeyResponse, ProviderCommandError> {
    let (api_key, checked_with) = match api_key {
        Some(value) if !value.trim().is_empty() => {
            (normalize_api_key(&value)?, "provided_key".to_string())
        }
        _ => (load_any_stored_api_key()?, "stored_key".to_string()),
    };

    let client = openai_client(api_key, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RETRIES)?;
    client
        .validate_models_endpoint()
        .await
        .map_err(ProviderCommandError::from)?;

    Ok(ValidateProviderApiKeyResponse {
        ok: true,
        provider: OPENAI_PROVIDER_ID.to_string(),
        checked_with,
    })
}

fn openai_client(
    api_key: String,
    timeout_ms: u64,
    max_retries: u8,
) -> Result<CompatibleClient, ProviderCommandError> {
    CompatibleClient::new(
        OPENAI_VENDOR,
        OPENAI_API_BASE,
        api_key,
        timeout_ms,
        max_retries,
    )
    .map_err(ProviderCommandError::from)
}

async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<TranscriptionResponse, ProviderCommandError> {
    let api_key = load_api_key(ProviderRole::Speech)?;
    let client = openai_client(
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
        .unwrap_or_else(|| response_format_for(&model).to_string());

    if response_format != RESPONSE_FORMAT_VERBOSE {
        // The coverage instrument reads `duration` and `segments`, and only
        // `verbose_json` carries them. Saying so here is what keeps a `unknown`
        // verdict from reading as a healthy transcript later.
        runtime_log::record(format!(
            "[WordScript] OpenAI transcription without segments model={} format={} coverage=unavailable",
            model, response_format,
        ));
    }

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

async fn create_chat_completion(
    request: ChatCompletionRequest,
) -> Result<String, ProviderCommandError> {
    let api_key = load_api_key(ProviderRole::Chat)?;
    let client = openai_client(
        api_key,
        request.timeout_ms.unwrap_or(8_000),
        request.max_retries.unwrap_or(1),
    )?;

    let mut request = request;
    request.model = resolve_chat_model(&request.model);

    client
        .chat_completion(request)
        .await
        .map_err(ProviderCommandError::from)
}

/// **Which format this model answers, and it is not a preference.**
///
/// `verbose_json` and `timestamp_granularities[]` are documented for
/// `whisper-1` alone; the `gpt-*-transcribe` family refuses them. Groq needs no
/// such rule because its endpoint takes `verbose_json` for everything, which is
/// exactly why the format could not stay a shared default when the second lane
/// arrived.
///
/// An id this build does not recognise gets `json`, the endpoint's own default:
/// being wrong towards "fewer fields came back" costs a coverage verdict,
/// being wrong the other way costs the whole request.
fn response_format_for(model: &str) -> &'static str {
    if model.trim() == model_catalogue::model_id(OPENAI_SPEECH_WHISPER_ROW) {
        RESPONSE_FORMAT_VERBOSE
    } else {
        RESPONSE_FORMAT_JSON
    }
}

/// The model a recognition request runs, with another vendor's id landed on
/// this lane's default.
///
/// **This is the case a connection change creates and nothing else cleans up.**
/// A profile that recognised on Groq holds `whisper-large-v3-turbo`; switching
/// the connection to OpenAI leaves that string in place, and sending it spends
/// a request to be told the model does not exist. The catalogue knows whose id
/// it is, so this lane substitutes its own default and says so in the log.
///
/// **An id the catalogue has never seen passes through untouched**, because
/// that is a user's own typed override and ADR 0115 requires it to survive. The
/// two cases look alike and need opposite treatment, which is why the question
/// asked is *whose id is this* rather than *do I know this id*.
fn resolve_speech_model(model: &str) -> String {
    resolve_model(model, ProviderRole::Speech, || {
        model_catalogue::model_id(OPENAI_SPEECH_WHISPER_ROW)
    })
}

fn resolve_chat_model(model: &str) -> String {
    resolve_model(model, ProviderRole::Chat, || {
        model_catalogue::model_id(OPENAI_CHAT_DEFAULT_ROW)
    })
}

fn resolve_model(
    model: &str,
    role: ProviderRole,
    fallback: impl Fn() -> &'static str,
) -> String {
    let model = model.trim();
    if model.is_empty() {
        return fallback().to_string();
    }

    match model_catalogue::provider_for_model_id(model, role) {
        Some(owner) if owner != OPENAI_PROVIDER_ID => {
            let substitute = fallback();
            runtime_log::record(format!(
                "[WordScript] OpenAI substituted a model belonging to another lane role={} requested={} owner={} using={}",
                role.as_str(),
                model,
                owner,
                substitute,
            ));
            substitute.to_string()
        }
        _ => model.to_string(),
    }
}

fn provider_profiles() -> Vec<ProviderProfile> {
    vec![
        ProviderProfile {
            id: "openai-fast".to_string(),
            provider: OPENAI_PROVIDER_ID.to_string(),
            mode: ProviderMode::Fast,
            model: model_catalogue::model_id(OPENAI_SPEECH_GPT_4O_MINI_ROW).to_string(),
            label: "OpenAI fast transcription".to_string(),
            default: false,
            requires_api_key: true,
        },
        /* THE DEFAULT IS THE ONE THAT ANSWERS FOR ITS OWN COVERAGE, not the one
           with the best word error rate. `whisper-1` is the only model on this
           lane that returns segments, and a transcript that silently stops
           short is the failure `docs/known-issues/` carries five records
           about. A user who wants the newer models picks one; the default is
           the one this build can check. */
        ProviderProfile {
            id: "openai-quality".to_string(),
            provider: OPENAI_PROVIDER_ID.to_string(),
            mode: ProviderMode::Quality,
            model: model_catalogue::model_id(OPENAI_SPEECH_WHISPER_ROW).to_string(),
            label: "OpenAI transcription with segment timings".to_string(),
            default: true,
            requires_api_key: true,
        },
    ]
}

fn provider_capabilities() -> ProviderCapabilities {
    ProviderCapabilities {
        transcription: true,
        chat_completion: true,
        /* `/v1/audio/speech` exists and this build registers no voice role for
           it (ADR 0109, ADR 0114). A capability answers what can be operated
           here, and today that is nothing. */
        speech_synthesis: false,
        local: false,
        requires_api_key: true,
        supports_prompt_bias: true,
        supports_language: true,
        /* **Per model, and this field is per provider** — which is the tension
           ADR 0110 names and does not remove. It answers for the lane's
           default, `whisper-1`, which does return segments; a caller that needs
           the per-model truth asks `model_capabilities` for the pair. */
        supports_segments: true,
        model_management: false,
    }
}

/// What one of OpenAI's models does — **and the first lane where the answers
/// differ** (ADR 0110).
///
/// Groq answers the same three values for every id because its endpoint decides
/// the matter. Here the model does: `gpt-4o-transcribe` streams and names the
/// languages it heard, `whisper-1` is documented as doing neither, and both
/// arrive on one key at one URL. That pair is the evidence ADR 0110 was written
/// from, and until this file existed it was asserted against a fixture.
///
/// **An id this build has not read about answers `Unknown`, never `Unsupported`.**
/// The model list here is the vendor's and it changes on their schedule; saying
/// *this does not stream* about an id nobody has read is a guess wearing a
/// measurement's clothes.
fn model_capabilities(model: &str) -> ModelCapabilities {
    let model = resolve_speech_model(model);
    let whisper = model_catalogue::model_id(OPENAI_SPEECH_WHISPER_ROW);
    let streaming_family = [
        model_catalogue::model_id(OPENAI_SPEECH_GPT_4O_ROW),
        model_catalogue::model_id(OPENAI_SPEECH_GPT_ROW),
        model_catalogue::model_id(OPENAI_SPEECH_GPT_4O_MINI_ROW),
    ];

    if model == whisper {
        return ModelCapabilities {
            model,
            transcription_streaming: ModelSupport::Unsupported,
            /* `verbose_json` carries a `language` field, and whether it names
               what was heard or echoes what it was told is not documented
               either way. ADR 0094 defines this axis as the first of those, so
               the honest answer is the third value rather than a guess in
               whichever direction reads better. */
            reports_detected_language: ModelSupport::Unknown,
            synthesis_streaming: ModelSupport::Unsupported,
        };
    }

    if streaming_family.contains(&model.as_str()) {
        return ModelCapabilities {
            model,
            transcription_streaming: ModelSupport::Supported,
            reports_detected_language: ModelSupport::Supported,
            /* These are recognition models. Synthesis is a different family on
               this vendor and no voice role is registered for it. */
            synthesis_streaming: ModelSupport::Unsupported,
        };
    }

    ModelCapabilities {
        model,
        transcription_streaming: ModelSupport::Unknown,
        reports_detected_language: ModelSupport::Unknown,
        synthesis_streaming: ModelSupport::Unknown,
    }
}

fn credential_status() -> Result<ProviderCredentialStatus, OpenAiError> {
    Ok(aggregate_credential(
        OPENAI_PROVIDER_ID,
        &role_credentials()?,
    ))
}

fn role_credentials() -> Result<Vec<RoleCredentialStatus>, OpenAiError> {
    OPENAI_CREDENTIAL_ROLES
        .iter()
        .map(|role| role_credential_status(*role))
        .collect()
}

fn role_credential_status(role: ProviderRole) -> Result<RoleCredentialStatus, OpenAiError> {
    let kind = CredentialKind::ApiKey;

    match credential_store::read_from(&OsSecretStore, OPENAI_PROVIDER_ID, role, kind)
        .map_err(secret_store_error)?
    {
        Some(api_key) => {
            credential_store::cache_key(&credential_entry_user(role, kind), Some(api_key.clone()));
            Ok(RoleCredentialStatus {
                provider: OPENAI_PROVIDER_ID.to_string(),
                role,
                kind: Some(kind),
                configured: true,
                storage: "os_secret_store".to_string(),
                key_preview: Some(credential_store::mask_api_key(&api_key)),
                missing: None,
            })
        }
        None => Ok(RoleCredentialStatus {
            provider: OPENAI_PROVIDER_ID.to_string(),
            role,
            kind: Some(kind),
            configured: false,
            storage: "os_secret_store".to_string(),
            key_preview: None,
            missing: Some(format!("{} for {}", kind.label(), role.label())),
        }),
    }
}

fn credential_entry_user(role: ProviderRole, kind: CredentialKind) -> String {
    credential_store::entry_user(OPENAI_PROVIDER_ID, role, kind)
}

/// The key that pays for one role — **never another role's, and never another
/// vendor's** (ADR 0105).
fn load_api_key(role: ProviderRole) -> Result<String, ProviderCommandError> {
    let kind = CredentialKind::ApiKey;
    let user = credential_entry_user(role, kind);

    if let Some(api_key) = credential_store::cached(&user) {
        return Ok(api_key);
    }

    match credential_store::read_from(&OsSecretStore, OPENAI_PROVIDER_ID, role, kind)
        .map_err(secret_store_error)?
    {
        Some(api_key) => {
            let normalized = normalize_api_key(&api_key)?;
            credential_store::cache_key(&user, Some(normalized.clone()));
            Ok(normalized)
        }
        None => Err(ProviderCommandError::from(OpenAiError {
            kind: ProviderErrorKind::MissingApiKey,
            message: format!(
                "No OpenAI API key is stored for {}. Save one for that job's role in AI Models.",
                role.label(),
            ),
            status: None,
            retry_after_seconds: None,
        })),
    }
}

fn load_any_stored_api_key() -> Result<String, ProviderCommandError> {
    for role in OPENAI_CREDENTIAL_ROLES {
        match load_api_key(*role) {
            Ok(api_key) => return Ok(api_key),
            Err(error) if error.kind == ProviderErrorKind::MissingApiKey => continue,
            Err(error) => return Err(error),
        }
    }

    Err(ProviderCommandError::from(OpenAiError {
        kind: ProviderErrorKind::MissingApiKey,
        message: "No OpenAI API key is stored for WordScript.".to_string(),
        status: None,
        retry_after_seconds: None,
    }))
}

fn normalize_api_key(api_key: &str) -> Result<String, ProviderCommandError> {
    credential_store::normalized_key(api_key, Some(OPENAI_KEY_PREFIX))
        .map(str::to_string)
        .map_err(|shape| {
            ProviderCommandError::from(match shape {
                KeyShape::Empty => OpenAiError {
                    kind: ProviderErrorKind::MissingApiKey,
                    message: "OpenAI API key must not be empty.".to_string(),
                    status: None,
                    retry_after_seconds: None,
                },
                KeyShape::WrongPrefix => OpenAiError {
                    kind: ProviderErrorKind::InvalidRequest,
                    message: format!("OpenAI API key should start with {OPENAI_KEY_PREFIX}."),
                    status: None,
                    retry_after_seconds: None,
                },
            })
        })
}

fn secret_store_error(error: keyring::Error) -> OpenAiError {
    OpenAiError {
        kind: ProviderErrorKind::SecretStoreUnavailable,
        message: format!("OS secret store is unavailable: {error}"),
        status: None,
        retry_after_seconds: None,
    }
}

/// Refused before the upload rather than after it.
///
/// The number is the vendor's published one, and the sentence names the file so
/// a user with several recordings knows which one to shorten.
fn validate_audio_upload_size(
    file_name: &str,
    audio_bytes_len: usize,
) -> Result<(), OpenAiError> {
    if audio_bytes_len <= OPENAI_MAX_AUDIO_BYTES {
        return Ok(());
    }

    Err(OpenAiError {
        kind: ProviderErrorKind::InvalidRequest,
        message: format!(
            "OpenAI cannot accept '{}' because {} exceeds the documented maximum uploaded audio size of {}. Shorten the recording or export it at a lower bitrate before upload.",
            file_name,
            format_audio_size(audio_bytes_len),
            format_audio_size(OPENAI_MAX_AUDIO_BYTES),
        ),
        status: Some(413),
        retry_after_seconds: None,
    })
}

/// One published ceiling for every account.
fn tiers() -> Vec<ProviderTier> {
    vec![ProviderTier {
        id: OPENAI_STANDARD_TIER_ID.to_string(),
        label: "Standard — 25 MiB per request".to_string(),
        max_audio_bytes: OPENAI_MAX_AUDIO_BYTES as u64,
        default: true,
    }]
}

fn capture_limits() -> ProviderCaptureLimits {
    ProviderCaptureLimits {
        max_audio_bytes: Some(OPENAI_MAX_AUDIO_BYTES as u64),
        realtime_factor: None,
        detail: "the 25 MiB upload size OpenAI documents for every account".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verbose_json_is_whisper_only_and_everything_else_takes_json() {
        // THE ONE THING THIS ADAPTER COULD NOT INHERIT FROM GROQ. A shared
        // `verbose_json` default would have made every request on the newer
        // models a 400, and no test on the Groq side could have caught it.
        assert_eq!(response_format_for("whisper-1"), RESPONSE_FORMAT_VERBOSE);
        assert_eq!(response_format_for("gpt-4o-transcribe"), RESPONSE_FORMAT_JSON);
        assert_eq!(response_format_for("gpt-transcribe"), RESPONSE_FORMAT_JSON);
        assert_eq!(
            response_format_for("a-model-nobody-has-read-about"),
            RESPONSE_FORMAT_JSON,
        );
    }

    #[test]
    fn one_key_and_one_endpoint_answer_differently_for_two_models() {
        // ADR 0110's thesis, on the vendor it was written about, asserted
        // against the adapter rather than against `registry.rs`'s fixture.
        let streams = model_capabilities("gpt-4o-transcribe");
        let does_not = model_capabilities("whisper-1");

        assert_eq!(streams.transcription_streaming, ModelSupport::Supported);
        assert_eq!(streams.reports_detected_language, ModelSupport::Supported);
        assert_eq!(does_not.transcription_streaming, ModelSupport::Unsupported);
    }

    #[test]
    fn a_model_this_build_has_not_read_about_answers_unknown() {
        let answer = model_capabilities("gpt-9-transcribe-from-the-future");

        assert_eq!(answer.transcription_streaming, ModelSupport::Unknown);
        assert_eq!(answer.reports_detected_language, ModelSupport::Unknown);
        assert_eq!(answer.synthesis_streaming, ModelSupport::Unknown);
    }

    #[test]
    fn another_lanes_model_id_is_substituted_and_a_typed_one_is_not() {
        // The case a connection change creates: the profile still holds the
        // Groq id it recognised on yesterday.
        assert_eq!(resolve_speech_model("whisper-large-v3-turbo"), "whisper-1");
        assert_eq!(resolve_chat_model("llama-3.3-70b-versatile"), "gpt-5.6-terra");

        // And the case ADR 0115 protects: an id nobody catalogued is the user's
        // own and survives.
        assert_eq!(
            resolve_speech_model("gpt-4o-transcribe-diarize"),
            "gpt-4o-transcribe-diarize",
        );
        assert_eq!(resolve_speech_model("gpt-4o-transcribe"), "gpt-4o-transcribe");
        assert_eq!(resolve_speech_model(""), "whisper-1");
    }

    #[test]
    fn a_key_for_another_vendor_is_refused_before_it_is_stored() {
        let refused = normalize_api_key("gsk_thisisagroqkeyentirely")
            .expect_err("a Groq key in the OpenAI field is the everyday mistake");

        assert_eq!(refused.kind, ProviderErrorKind::InvalidRequest);
        assert!(refused.message.contains("sk-"));
        assert!(normalize_api_key("sk-proj-abcdefghijklmnop").is_ok());
    }

    #[test]
    fn a_subscription_is_refused_until_the_flow_that_acquires_one_exists() {
        // ADR 0102 permits this vendor a subscription; D3 builds the flow. The
        // kind is refused at the door with the reason named, which is not the
        // same sentence as Groq's "it sells none".
        let refused = ensure_supported_kind(CredentialKind::Subscription)
            .expect_err("no OAuth flow exists yet");

        assert!(refused.message.contains("not built"));
    }

    #[test]
    fn the_credential_roles_are_the_roles_the_registry_registered() {
        let entry = super::super::registry::resolve_entry(OPENAI_PROVIDER_ID)
            .expect("openai is registered");

        assert_eq!(entry.roles(), OPENAI_CREDENTIAL_ROLES.to_vec());
    }

    #[test]
    fn the_default_profile_is_the_one_that_can_report_its_own_coverage() {
        let profiles = provider_profiles();
        let default = profiles
            .iter()
            .find(|profile| profile.default)
            .expect("openai declares a default profile");

        assert_eq!(default.model, "whisper-1");
        assert_eq!(response_format_for(&default.model), RESPONSE_FORMAT_VERBOSE);
    }

    #[test]
    fn an_upload_above_the_documented_ceiling_is_refused_before_the_request() {
        let error = validate_audio_upload_size("meeting.wav", 30 * 1024 * 1024)
            .expect_err("30 MiB is above the published 25");

        assert_eq!(error.kind, ProviderErrorKind::InvalidRequest);
        assert!(error.message.contains("meeting.wav"));
        assert!(error.message.contains("25.0 MiB"));
        assert!(validate_audio_upload_size("short.wav", 1024).is_ok());
    }
}
