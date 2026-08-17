use reqwest::StatusCode;

use crate::core::model_catalogue;
use crate::core::runtime_log;

use super::{
    aggregate_credential,
    credential_store::{self, KeyShape, OsSecretStore},
    openai_compatible::{
        format_audio_size, CompatibleClient, CompatibleError, TranscriptionPlan,
    },
    registry::{ChatProvider, Provider, ProviderFuture, SpeechProvider},
    ChatCompletionRequest, CredentialKind, ModelCapabilities, ModelSupport, ProviderCapabilities,
    ProviderCaptureLimits, ProviderCommandError, ProviderCredentialStatus, ProviderErrorKind,
    ProviderMode, ProviderProfile, ProviderRole, ProviderStatus, ProviderStatusRequest,
    ProviderTier, RoleCredentialStatus, TranscribeAudioFileRequest, TranscriptionResponse,
    ValidateProviderApiKeyResponse,
};

/// The registry id, and the one string a credential entry is keyed by.
pub const GROQ_PROVIDER_ID: &str = "groq";
/// How this vendor is named in a sentence a user reads.
const GROQ_VENDOR: &str = "Groq";
/// **Already the OpenAI shape with a Groq host** — the finding ADR 0113 is
/// built on, and the reason `openai_compatible` exists rather than a second
/// copy of this file's transport.
const GROQ_API_BASE: &str = "https://api.groq.com/openai/v1";
/// Groq issues `gsk_`-prefixed keys, and catching a key pasted into the wrong
/// vendor's field here is cheaper than a 401 that does not say which one.
const GROQ_KEY_PREFIX: &str = "gsk_";
/// Groq runs `verbose_json` on every model it serves, which is what gives the
/// coverage instrument its segments. **OpenAI does not**, and that difference
/// is why the format is a per-vendor decision rather than a shared default.
const GROQ_RESPONSE_FORMAT: &str = "verbose_json";
/// The roles Groq's key pays for. Held to the registry entry by a test in this
/// module — the entry is the answer, this list is what a save with no named
/// role fans out across, and two lists that disagreed would strand a
/// credential.
const GROQ_CREDENTIAL_ROLES: &[ProviderRole] = &[ProviderRole::Speech, ProviderRole::Chat];
/// **A bearer token is the only shape here, not the chosen one.** Groq sells no
/// consumer subscription, so there is nothing for a second kind to authenticate
/// against (`docs/PROVIDERS.md`, ADR 0102).
const GROQ_CREDENTIAL_KINDS: &[CredentialKind] = &[CredentialKind::ApiKey];
/// The catalogue rows this adapter operates, named by their slugs (ADR 0115).
///
/// **An adapter names a row, never a model id.** The two ids Groq's profiles
/// offer and the one a request falls back to are the same three strings the
/// drawing lists and the survey dates, and they lived in three places until this
/// file stopped spelling them. What is left here is which *row* this lane runs
/// on, which is an adapter's own business.
const GROQ_SPEECH_TURBO_ROW: &str = "groq-speech-turbo";
const GROQ_SPEECH_QUALITY_ROW: &str = "groq-speech-large-v3";
const DEFAULT_TIMEOUT_MS: u64 = 55_000;
const DEFAULT_MAX_RETRIES: u8 = 2;
const GROQ_FREE_TIER_MAX_AUDIO_BYTES: usize = 25 * 1024 * 1024;
const GROQ_DEV_TIER_MAX_AUDIO_BYTES: usize = 100 * 1024 * 1024;

/// This lane's transport error. **The type is shared and the wording is not** —
/// every message it carries names `Groq`, because the first question about a
/// refused key is which vendor refused it.
type GroqProviderError = CompatibleError;

pub type GroqProviderStatus = ProviderStatus;

pub type ValidateGroqApiKeyResponse = ValidateProviderApiKeyResponse;

pub type GroqTranscriptionResponse = TranscriptionResponse;

/// Groq as the registry sees it: recognition and completions on one key.
///
/// It implements no `VoiceProvider`, and there is no stub saying so — the
/// registry entry's `voice: None` is the whole statement (ADR 0094).
pub struct Groq;

pub static GROQ: Groq = Groq;

impl Provider for Groq {
    /// The request's model is read for the model axis and nothing else: Groq's
    /// credential, profiles and roles do not vary by it. The correction model
    /// names a chat model, and no field on either axis is a chat question.
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
        GROQ_CREDENTIAL_KINDS
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

impl SpeechProvider for Groq {
    fn transcribe_audio_file(
        &self,
        request: TranscribeAudioFileRequest,
    ) -> ProviderFuture<TranscriptionResponse> {
        Box::pin(transcribe_audio_file(request))
    }

    fn tiers(&self) -> Vec<ProviderTier> {
        tiers()
    }

    /// Bound by the plan, never by the model: the ceiling is an upload size.
    fn capture_limits(&self, _model: &str, tier_id: &str) -> ProviderCaptureLimits {
        capture_limits(tier_id)
    }
}

impl ChatProvider for Groq {
    fn create_chat_completion(&self, request: ChatCompletionRequest) -> ProviderFuture<String> {
        Box::pin(create_chat_completion(request))
    }
}

fn provider_status(
    connection: &str,
    model: Option<&str>,
) -> Result<GroqProviderStatus, ProviderCommandError> {
    let role_credentials = role_credentials(connection).map_err(ProviderCommandError::from)?;

    Ok(GroqProviderStatus {
        provider: "groq".to_string(),
        default_profile: "cloud-fast".to_string(),
        credential: aggregate_credential("groq", &role_credentials),
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
    ensure_supported_kind(kind)?;
    let api_key = normalize_api_key(api_key)?;
    credential_store::write_to(&OsSecretStore, connection, role, kind, &api_key).map_err(secret_store_error)?;
    credential_store::cache_key(&credential_entry_user(connection, role, kind), Some(api_key));
    credential_status(connection).map_err(ProviderCommandError::from)
}

fn clear_api_key(
    connection: &str,
    role: ProviderRole,
    kind: CredentialKind,
) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    ensure_supported_kind(kind)?;
    credential_store::clear_in(&OsSecretStore, connection, role, kind).map_err(secret_store_error)?;
    credential_store::cache_key(&credential_entry_user(connection, role, kind), None);
    credential_status(connection).map_err(ProviderCommandError::from)
}

/// A kind this lane cannot authenticate with is refused where it would be
/// stored, with the reason named. It is not a call that fails later: there is
/// no Groq endpoint a subscription could reach, so there is no call to make.
fn ensure_supported_kind(kind: CredentialKind) -> Result<(), ProviderCommandError> {
    if GROQ_CREDENTIAL_KINDS.contains(&kind) {
        return Ok(());
    }

    Err(ProviderCommandError::invalid_request(format!(
        "Groq does not accept {}. It sells no consumer plan, so an API key is the only credential it has.",
        kind.label(),
    )))
}

async fn validate_api_key(
    connection: String,
    api_key: Option<String>,
) -> Result<ValidateGroqApiKeyResponse, ProviderCommandError> {
    let (api_key, checked_with) = match api_key {
        Some(value) if !value.trim().is_empty() => {
            (normalize_api_key(&value)?, "provided_key".to_string())
        }
        _ => (load_any_stored_api_key(&connection)?, "stored_key".to_string()),
    };

    let client = groq_client(api_key, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RETRIES)?;
    client
        .validate_models_endpoint()
        .await
        .map_err(ProviderCommandError::from)?;

    Ok(ValidateGroqApiKeyResponse {
        ok: true,
        provider: GROQ_PROVIDER_ID.to_string(),
        checked_with,
    })
}

fn groq_client(
    api_key: String,
    timeout_ms: u64,
    max_retries: u8,
) -> Result<CompatibleClient, ProviderCommandError> {
    CompatibleClient::new(GROQ_VENDOR, GROQ_API_BASE, api_key, timeout_ms, max_retries)
        .map_err(ProviderCommandError::from)
}

async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<GroqTranscriptionResponse, ProviderCommandError> {
    let api_key = load_groq_api_key(&request.connection, ProviderRole::Speech)?;
    let client = groq_client(
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

    if audio_bytes.len() > GROQ_FREE_TIER_MAX_AUDIO_BYTES {
        runtime_log::record(format!(
            "[WordScript] Groq transcription upload warning file={} size={} free_tier_limit={} dev_tier_limit={}",
            file_name,
            format_audio_size(audio_bytes.len()),
            format_audio_size(GROQ_FREE_TIER_MAX_AUDIO_BYTES),
            format_audio_size(GROQ_DEV_TIER_MAX_AUDIO_BYTES),
        ));
    }

    let audio_bytes_len = audio_bytes.len();
    let plan = TranscriptionPlan {
        file_name: file_name.clone(),
        audio_bytes,
        model: resolve_speech_model(request.model.as_deref().unwrap_or_default()),
        response_format: request
            .response_format
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| GROQ_RESPONSE_FORMAT.to_string()),
        language: request.language.filter(|value| !value.trim().is_empty()),
        prompt: request.prompt.filter(|value| !value.trim().is_empty()),
    };

    client
        .transcribe(plan)
        .await
        .map_err(|error| annotate_transcription_error(error, &file_name, audio_bytes_len))
        .map_err(ProviderCommandError::from)
}

async fn create_chat_completion(
    request: ChatCompletionRequest,
) -> Result<String, ProviderCommandError> {
    let api_key = load_groq_api_key(&request.connection, ProviderRole::Chat)?;
    let client = groq_client(
        api_key,
        request.timeout_ms.unwrap_or(8_000),
        request.max_retries.unwrap_or(1),
    )?;

    client
        .chat_completion(request)
        .await
        .map_err(ProviderCommandError::from)
}

fn provider_profiles() -> Vec<ProviderProfile> {
    vec![
        ProviderProfile {
            id: "cloud-fast".to_string(),
            provider: "groq".to_string(),
            mode: ProviderMode::Fast,
            model: model_catalogue::model_id(GROQ_SPEECH_TURBO_ROW).to_string(),
            label: "Groq fast multilingual transcription".to_string(),
            default: true,
            requires_api_key: true,
        },
        ProviderProfile {
            id: "cloud-quality".to_string(),
            provider: "groq".to_string(),
            mode: ProviderMode::Quality,
            model: model_catalogue::model_id(GROQ_SPEECH_QUALITY_ROW).to_string(),
            label: "Groq high-accuracy multilingual transcription".to_string(),
            default: false,
            requires_api_key: true,
        },
    ]
}

/// The profile a recognition model runs under, or nothing when this lane ships
/// no profile for it.
///
/// **Answered off `provider_profiles()` rather than beside it.** The v1 slice
/// used to answer the same question with a two-arm match on model literals,
/// which was a second copy of the table above and could disagree with it — and
/// after ADR 0115 it would have been a second copy of two catalogue rows as
/// well. A caller with an id this lane does not ship gets `None` and names its
/// own fallback, which is what the slice already did.
pub fn speech_profile_id(model: &str) -> Option<String> {
    let model = model.trim();

    provider_profiles()
        .into_iter()
        .find(|profile| profile.model == model)
        .map(|profile| profile.id)
}

fn provider_capabilities() -> ProviderCapabilities {
    ProviderCapabilities {
        transcription: true,
        chat_completion: true,
        // Groq sells the Orpheus voices; this build registers no `VoiceProvider`
        // for it, and a capability answers what can be operated here. The row
        // that says why is ADR 0096's missing adapter, not a model answer.
        speech_synthesis: false,
        local: false,
        requires_api_key: true,
        supports_prompt_bias: true,
        supports_language: true,
        supports_segments: true,
        model_management: false,
    }
}

/// What Groq's models do — and why every one of them says the same thing.
///
/// **Groq's speech endpoint is batch only**: one file in, one result out, no
/// websocket, no `stream=true`, no partial results (`docs/PROVIDERS.md`, read
/// 2026-08-11). That is a property of the endpoint rather than of the weights,
/// so an id this build has never heard of answers exactly like the two it
/// ships, and the answer is `Unsupported` rather than `Unknown`: nothing that
/// arrives on this URL will stream.
///
/// **This is not a counter-example to ADR 0110.** The axis is the model on
/// every lane; on this one every model happens to agree, and the vendor
/// scheduled next is the one where they do not.
///
/// Language is a hint here and never an answer — supplying ISO-639-1 improves
/// accuracy and latency, and the response does not say what it heard. Synthesis
/// is `Unsupported` because these are recognition models; the Orpheus voices
/// are not listed at all, because no voice job can route to them until an
/// adapter exists (ADR 0109), and a model answer is the wrong place to say so.
fn model_capabilities(model: &str) -> ModelCapabilities {
    ModelCapabilities {
        model: resolve_speech_model(model),
        transcription_streaming: ModelSupport::Unsupported,
        reports_detected_language: ModelSupport::Unsupported,
        synthesis_streaming: ModelSupport::Unsupported,
    }
}

fn resolve_speech_model(model: &str) -> String {
    let model = model.trim();
    if model.is_empty() {
        model_catalogue::model_id(GROQ_SPEECH_TURBO_ROW).to_string()
    } else {
        model.to_string()
    }
}

fn credential_status(connection: &str) -> Result<ProviderCredentialStatus, GroqProviderError> {
    Ok(aggregate_credential("groq", &role_credentials(connection)?))
}

fn role_credentials(connection: &str) -> Result<Vec<RoleCredentialStatus>, GroqProviderError> {
    GROQ_CREDENTIAL_ROLES
        .iter()
        .map(|role| role_credential_status(connection, *role))
        .collect()
}

/// What answers for one role, or the name of what is missing.
///
/// The kind is `api_key` on every role because it is the only one this lane
/// has; the field is still present rather than implied, because the surface
/// that eventually draws two kinds reads it, and a lane that omitted it would
/// be the one exception a reader has to special-case.
fn role_credential_status(
    connection: &str,
    role: ProviderRole,
) -> Result<RoleCredentialStatus, GroqProviderError> {
    let kind = CredentialKind::ApiKey;

    match credential_store::read_from(&OsSecretStore, connection, role, kind).map_err(secret_store_error)? {
        Some(api_key) => {
            credential_store::cache_key(&credential_entry_user(connection, role, kind), Some(api_key.clone()));
            Ok(RoleCredentialStatus {
                provider: "groq".to_string(),
                role,
                kind: Some(kind),
                configured: true,
                storage: "os_secret_store".to_string(),
                key_preview: Some(credential_store::mask_api_key(&api_key)),
                missing: None,
            })
        }
        None => Ok(RoleCredentialStatus {
            provider: "groq".to_string(),
            role,
            kind: Some(kind),
            configured: false,
            storage: "os_secret_store".to_string(),
            key_preview: None,
            missing: Some(format!("{} for {}", kind.label(), role.label())),
        }),
    }
}

/// The key that pays for one role — **never another role's** (ADR 0105).
fn load_groq_api_key(
    connection: &str,
    role: ProviderRole,
) -> Result<String, ProviderCommandError> {
    let kind = CredentialKind::ApiKey;
    let user = credential_entry_user(connection, role, kind);

    if let Some(api_key) = credential_store::cached(&user) {
        return Ok(api_key);
    }

    match credential_store::read_from(&OsSecretStore, connection, role, kind).map_err(secret_store_error)? {
        Some(api_key) => {
            let normalized = normalize_api_key(&api_key).map_err(ProviderCommandError::from)?;
            credential_store::cache_key(&user, Some(normalized.clone()));
            Ok(normalized)
        }
        None => Err(ProviderCommandError::from(GroqProviderError {
            kind: ProviderErrorKind::MissingApiKey,
            message: format!(
                "No Groq API key is stored for {}. Save one for that job's role in AI Models.",
                role.label(),
            ),
            status: None,
            retry_after_seconds: None,
        })),
    }
}

/// The stored key a validation runs against.
///
/// Validation asks the vendor whether a key works, which is not a question
/// about a role: `/models` is neither recognition nor completion. So it checks
/// the first role that holds one and says nothing about the others — a key that
/// authenticates for one role authenticates for all of them on this lane.
fn load_any_stored_api_key(connection: &str) -> Result<String, ProviderCommandError> {
    for role in GROQ_CREDENTIAL_ROLES {
        match load_groq_api_key(connection, *role) {
            Ok(api_key) => return Ok(api_key),
            Err(error) if error.kind == ProviderErrorKind::MissingApiKey => continue,
            Err(error) => return Err(error),
        }
    }

    Err(ProviderCommandError::from(GroqProviderError {
        kind: ProviderErrorKind::MissingApiKey,
        message: "No Groq API key is stored for WordScript.".to_string(),
        status: None,
        retry_after_seconds: None,
    }))
}

/// The shape a Groq key has, with the sentence this vendor puts on it.
///
/// **The check moved and the wording did not.** `credential_store` knows what
/// an empty key and a wrong prefix are; only this file knows that the prefix is
/// `gsk_` and that the vendor is called Groq, which is the half a user reads.
fn normalize_api_key(api_key: &str) -> Result<String, GroqProviderError> {
    credential_store::normalized_key(api_key, Some(GROQ_KEY_PREFIX))
        .map(str::to_string)
        .map_err(|shape| match shape {
            KeyShape::Empty => GroqProviderError {
                kind: ProviderErrorKind::MissingApiKey,
                message: "Groq API key must not be empty.".to_string(),
                status: None,
                retry_after_seconds: None,
            },
            KeyShape::WrongPrefix => GroqProviderError {
                kind: ProviderErrorKind::InvalidRequest,
                message: format!("Groq API key should start with {GROQ_KEY_PREFIX}."),
                status: None,
                retry_after_seconds: None,
            },
        })
}

fn credential_entry_user(connection: &str, role: ProviderRole, kind: CredentialKind) -> String {
    credential_store::entry_user(connection, role, kind)
}

fn secret_store_error(error: keyring::Error) -> GroqProviderError {
    GroqProviderError {
        kind: ProviderErrorKind::SecretStoreUnavailable,
        message: format!("OS secret store is unavailable: {error}"),
        status: None,
        retry_after_seconds: None,
    }
}

fn annotate_transcription_error(
    error: GroqProviderError,
    file_name: &str,
    audio_bytes_len: usize,
) -> GroqProviderError {
    let payload_too_large = error.status == Some(StatusCode::PAYLOAD_TOO_LARGE.as_u16())
        || error.message.contains("request_too_large")
        || error.message.contains("Payload Too Large");

    if !payload_too_large {
        return error;
    }

    GroqProviderError {
        kind: ProviderErrorKind::InvalidRequest,
        message: format!(
            "Groq rejected the audio upload for '{}' because {} exceeds the request size limit. Groq speech-to-text is limited by file size, not only by recording minutes: free tier allows up to 25 MiB per uploaded file and dev tier up to 100 MiB. Use a shorter recording, a lower-bandwidth export, or a hosted audio URL for larger files.",
            file_name,
            format_audio_size(audio_bytes_len),
        ),
        status: error.status,
        retry_after_seconds: error.retry_after_seconds,
    }
}

fn validate_audio_upload_size(
    file_name: &str,
    audio_bytes_len: usize,
) -> Result<(), GroqProviderError> {
    if audio_bytes_len <= GROQ_DEV_TIER_MAX_AUDIO_BYTES {
        return Ok(());
    }

    Err(GroqProviderError {
        kind: ProviderErrorKind::InvalidRequest,
        message: format!(
            "Groq cannot accept '{}' because {} exceeds the maximum uploaded audio size of {}. Provide the audio through a hosted URL or shorten the recording before upload.",
            file_name,
            format_audio_size(audio_bytes_len),
            format_audio_size(GROQ_DEV_TIER_MAX_AUDIO_BYTES),
        ),
        status: Some(StatusCode::PAYLOAD_TOO_LARGE.as_u16()),
        retry_after_seconds: None,
    })
}

pub const GROQ_FREE_TIER_ID: &str = "free";
pub const GROQ_DEV_TIER_ID: &str = "dev";

/// Groq's plans, and the upload each one buys.
///
/// The two limits were already in this file as the thresholds the upload
/// validator checks; stating them as plans is what lets a paying account record
/// to its real ceiling instead of the free one.
fn tiers() -> Vec<ProviderTier> {
    vec![
        ProviderTier {
            id: GROQ_FREE_TIER_ID.to_string(),
            label: "Free — 25 MiB per request".to_string(),
            max_audio_bytes: GROQ_FREE_TIER_MAX_AUDIO_BYTES as u64,
            default: true,
        },
        ProviderTier {
            id: GROQ_DEV_TIER_ID.to_string(),
            label: "Developer — 100 MiB per request".to_string(),
            max_audio_bytes: GROQ_DEV_TIER_MAX_AUDIO_BYTES as u64,
            default: false,
        },
    ]
}

/// What one capture may cost on Groq: bounded by request size, on the selected
/// plan. An unrecognised plan id falls back to the default one rather than to
/// the larger — being wrong towards "you may record less" costs a retry, being
/// wrong the other way costs the recording.
fn capture_limits(tier_id: &str) -> ProviderCaptureLimits {
    let tiers = tiers();
    let tier = tiers
        .iter()
        .find(|tier| tier.id == tier_id.trim())
        .or_else(|| tiers.iter().find(|tier| tier.default))
        .expect("groq always declares a default tier");

    ProviderCaptureLimits {
        max_audio_bytes: Some(tier.max_audio_bytes),
        realtime_factor: None,
        detail: format!(
            "the {} upload size on your {} plan",
            format_upload_limit(tier.max_audio_bytes as usize),
            tier.id,
        ),
    }
}

/// A limit phrased for a settings row: "25 MiB", not
/// "25.0 MiB (26214400 bytes)". The diagnostic form belongs in an error, the
/// short one in a sentence a user reads while choosing a number.
pub fn format_upload_limit(limit_bytes: usize) -> String {
    format!("{} MiB", limit_bytes / 1_048_576)
}

#[cfg(test)]
mod tests {
    /// The account these entries are stored under (ADR 0208). It was the
    /// vendor id until the connection axis landed, and the assertion the tests
    /// here make — one role never reads another's key — is unchanged by which
    /// scope leads.
    const TEST_CONNECTION: &str = "connection-default";

    use std::{cell::RefCell, collections::HashMap};

    use keyring::Error as KeyringError;

    use super::super::credential_store::SecretStore;
    use super::*;

    #[derive(Default)]
    struct FakeSecretStore {
        entries: RefCell<HashMap<(String, String), String>>,
    }

    impl FakeSecretStore {
        fn set(&self, service: &str, user: &str, secret: &str) {
            self.entries
                .borrow_mut()
                .insert((service.to_string(), user.to_string()), secret.to_string());
        }

        fn get(&self, service: &str, user: &str) -> Option<String> {
            self.entries
                .borrow()
                .get(&(service.to_string(), user.to_string()))
                .cloned()
        }

        fn role_key(&self, role: ProviderRole) -> Option<String> {
            self.get(
                credential_store::KEY_SERVICE,
                &credential_entry_user(TEST_CONNECTION, role, CredentialKind::ApiKey),
            )
        }
    }

    impl SecretStore for FakeSecretStore {
        fn read(&self, service: &str, user: &str) -> Result<Option<String>, KeyringError> {
            Ok(self.get(service, user))
        }

        fn write(&self, service: &str, user: &str, secret: &str) -> Result<(), KeyringError> {
            self.set(service, user, secret);
            Ok(())
        }

        fn delete(&self, service: &str, user: &str) -> Result<(), KeyringError> {
            self.entries
                .borrow_mut()
                .remove(&(service.to_string(), user.to_string()));
            Ok(())
        }
    }

    #[test]
    fn rejects_empty_api_key() {
        let result = normalize_api_key(" ");
        assert!(result.is_err());
    }

    #[test]
    fn masks_api_key_without_exposing_secret() {
        let masked = credential_store::mask_api_key("gsk_1234567890abcdef");
        assert_eq!(masked, "gsk_...cdef");
    }

    #[test]
    fn uses_single_neutral_product_namespace_for_key_service() {
        assert_eq!(credential_store::KEY_SERVICE, "io.github.sw-forge-org.wordscript");
    }

    /// The roles a save with no named role fans out across are the roles the
    /// registry registered. Two lists that drifted apart would strand a
    /// credential under an entry nothing reads.
    #[test]
    fn the_credential_roles_are_the_roles_the_registry_registered() {
        let entry = crate::core::providers::registry::resolve_entry("groq").expect("groq entry");

        assert_eq!(entry.roles(), GROQ_CREDENTIAL_ROLES.to_vec());
    }

    /// One entry per `(role, kind)` and no second place to look. The pre-role
    /// name and the retired service went with ADR 0112, so a role with nothing
    /// stored answers `None` rather than inheriting another role's key.
    #[test]
    fn a_role_reads_only_its_own_entry() {
        let store = FakeSecretStore::default();
        store.set(
            credential_store::KEY_SERVICE,
            &credential_entry_user(TEST_CONNECTION, ProviderRole::Speech, CredentialKind::ApiKey),
            "gsk_speech_key",
        );

        assert_eq!(
            credential_store::read_from(&store, TEST_CONNECTION, ProviderRole::Speech, CredentialKind::ApiKey)
                .expect("read must succeed")
                .as_deref(),
            Some("gsk_speech_key"),
        );
        assert_eq!(
            credential_store::read_from(&store, TEST_CONNECTION, ProviderRole::Chat, CredentialKind::ApiKey)
                .expect("read must succeed"),
            None,
        );
    }

    #[test]
    fn reports_no_stored_key_instead_of_a_store_failure() {
        let store = FakeSecretStore::default();

        assert_eq!(
            credential_store::read_from(&store, TEST_CONNECTION, ProviderRole::Speech, CredentialKind::ApiKey)
                .expect("read must succeed"),
            None
        );
    }

    /// **Clearing one role does not clear another** (ADR 0105). The bug this
    /// prevents is a single provider-keyed delete taking the chat credential
    /// with the speech one, which is the storage-shaped version of a job
    /// spending a credential it was never given.
    #[test]
    fn clearing_one_role_leaves_the_other_paid_for() {
        let store = FakeSecretStore::default();
        credential_store::write_to(
            &store,
            TEST_CONNECTION,
            ProviderRole::Speech,
            CredentialKind::ApiKey,
            "gsk_speech_key",
        )
        .expect("write must succeed");
        credential_store::write_to(
            &store,
            TEST_CONNECTION,
            ProviderRole::Chat,
            CredentialKind::ApiKey,
            "gsk_chat_key",
        )
        .expect("write must succeed");

        credential_store::clear_in(
            &store,
            TEST_CONNECTION,
            ProviderRole::Chat,
            CredentialKind::ApiKey,
        )
        .expect("clear must succeed");

        assert_eq!(
            store.role_key(ProviderRole::Speech).as_deref(),
            Some("gsk_speech_key"),
        );
        assert_eq!(store.role_key(ProviderRole::Chat), None);
        assert_eq!(
            credential_store::read_from(&store, TEST_CONNECTION, ProviderRole::Chat, CredentialKind::ApiKey)
                .expect("read must succeed"),
            None,
        );
    }

    /// A kind this lane cannot authenticate with is refused where it would be
    /// stored, and the message says why rather than failing a call later.
    #[test]
    fn groq_refuses_a_subscription_because_it_sells_none() {
        let error = ensure_supported_kind(CredentialKind::Subscription)
            .expect_err("groq must refuse a subscription");

        assert!(matches!(error.kind, ProviderErrorKind::InvalidRequest));
        assert!(error.message.contains("subscription"));
        assert!(ensure_supported_kind(CredentialKind::ApiKey).is_ok());
    }

    #[test]
    fn groq_capabilities_match_cloud_product_lane() {
        let capabilities = provider_capabilities();

        assert!(capabilities.transcription);
        assert!(capabilities.chat_completion);
        assert!(capabilities.requires_api_key);
        assert!(capabilities.supports_prompt_bias);
        assert!(capabilities.supports_segments);
        assert!(!capabilities.local);
        assert!(!capabilities.model_management);
        assert!(
            !capabilities.speech_synthesis,
            "Groq sells the Orpheus voices and this build registers no voice role for it",
        );
    }

    /// **The lane decides this one, so an id this build never heard of gets the
    /// same answer as the two it ships.** Groq's speech endpoint takes a file
    /// and returns a result; there is no socket to open and no `stream=true` to
    /// send, which is why the unlisted id answers `Unsupported` rather than
    /// `Unknown`. The vendor where the models disagree is the next one.
    #[test]
    fn every_groq_model_denies_streaming_including_one_it_does_not_ship() {
        for model in [
            "whisper-large-v3",
            "whisper-large-v3-turbo",
            "whisper-large-v9-imaginary",
        ] {
            let capabilities = model_capabilities(model);

            assert_eq!(capabilities.model, model);
            assert_eq!(
                capabilities.transcription_streaming,
                ModelSupport::Unsupported,
            );
            assert_eq!(
                capabilities.reports_detected_language,
                ModelSupport::Unsupported,
                "language is a hint on this lane and the response never names one",
            );
        }
    }

    #[test]
    fn an_unnamed_model_answers_for_the_one_a_request_would_run() {
        assert_eq!(model_capabilities("").model, model_catalogue::model_id(GROQ_SPEECH_TURBO_ROW));
        assert_eq!(resolve_speech_model("  "), model_catalogue::model_id(GROQ_SPEECH_TURBO_ROW));
        assert_eq!(resolve_speech_model(" whisper-large-v3 "), "whisper-large-v3");
    }

    #[test]
    fn groq_profiles_declare_fast_and_quality_modes() {
        let profiles = provider_profiles();

        assert_eq!(profiles[0].mode, ProviderMode::Fast);
        assert_eq!(profiles[1].mode, ProviderMode::Quality);
    }

    #[test]
    fn annotates_request_too_large_transcription_errors_with_size_guidance() {
        let error = annotate_transcription_error(
            GroqProviderError {
                kind: ProviderErrorKind::ProviderStatus,
                message: "Groq returned HTTP 413 Payload Too Large".to_string(),
                status: Some(StatusCode::PAYLOAD_TOO_LARGE.as_u16()),
                retry_after_seconds: None,
            },
            "capture-2.wav",
            36_284_708,
        );

        assert!(matches!(error.kind, ProviderErrorKind::InvalidRequest));
        assert!(error.message.contains("capture-2.wav"));
        assert!(error.message.contains("34.6 MiB (36284708 bytes)"));
        assert!(error.message.contains("25 MiB"));
        assert!(error.message.contains("100 MiB"));
        assert!(error
            .message
            .contains("file size, not only by recording minutes"));
    }

    #[test]
    fn leaves_non_size_transcription_errors_unchanged() {
        let error = annotate_transcription_error(
            GroqProviderError {
                kind: ProviderErrorKind::Network,
                message: "Groq network request failed: boom".to_string(),
                status: None,
                retry_after_seconds: None,
            },
            "capture.wav",
            1024,
        );

        assert!(matches!(error.kind, ProviderErrorKind::Network));
        assert_eq!(error.message, "Groq network request failed: boom");
    }

    #[test]
    fn rejects_audio_above_documented_max_upload_size() {
        let error = validate_audio_upload_size("capture-oversize.wav", 120 * 1024 * 1024)
            .expect_err("oversized uploads should be rejected before the request");

        assert!(matches!(error.kind, ProviderErrorKind::InvalidRequest));
        assert_eq!(error.status, Some(StatusCode::PAYLOAD_TOO_LARGE.as_u16()));
        assert!(error.message.contains("capture-oversize.wav"));
        assert!(error.message.contains("120.0 MiB"));
        assert!(error.message.contains("100.0 MiB"));
    }
}
