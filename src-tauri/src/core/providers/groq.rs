use std::{
    path::Path,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

use keyring::{Entry, Error as KeyringError};
use reqwest::{header, multipart, StatusCode};
use serde::Deserialize;
use tokio::time::sleep;

use crate::core::runtime_log;

use super::{
    registry::{ChatProvider, Provider, ProviderFuture, SpeechProvider},
    ChatCompletionRequest, ProviderCapabilities, ProviderCaptureLimits, ProviderCommandError,
    ProviderCredentialStatus, ProviderErrorKind, ProviderMode, ProviderProfile, ProviderStatus,
    ProviderStatusRequest, ProviderTier, TranscribeAudioFileRequest, TranscriptionResponse,
    ValidateProviderApiKeyResponse,
};

const GROQ_API_BASE: &str = "https://api.groq.com/openai/v1";
const GROQ_KEY_SERVICE: &str = "io.github.sw-forge-org.wordscript";
const LEGACY_GROQ_KEY_SERVICES: &[&str] = &["io.github.swbench.wordscript"];
const GROQ_KEY_USER: &str = "groq_api_key";
const DEFAULT_TIMEOUT_MS: u64 = 55_000;
const DEFAULT_MAX_RETRIES: u8 = 2;
const GROQ_FREE_TIER_MAX_AUDIO_BYTES: usize = 25 * 1024 * 1024;
const GROQ_DEV_TIER_MAX_AUDIO_BYTES: usize = 100 * 1024 * 1024;

static GROQ_API_KEY_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();

#[derive(Debug)]
struct GroqProviderError {
    kind: ProviderErrorKind,
    message: String,
    status: Option<u16>,
    retry_after_seconds: Option<u64>,
}

impl From<GroqProviderError> for ProviderCommandError {
    fn from(error: GroqProviderError) -> Self {
        Self::new(
            error.kind,
            error.message,
            error.status,
            error.retry_after_seconds,
        )
    }
}

pub type GroqProviderStatus = ProviderStatus;

pub type ValidateGroqApiKeyResponse = ValidateProviderApiKeyResponse;

pub type GroqTranscriptionResponse = TranscriptionResponse;

#[derive(Debug, Deserialize)]
struct GroqChatCompletionResponse {
    choices: Vec<GroqChatChoice>,
}

#[derive(Debug, Deserialize)]
struct GroqChatChoice {
    message: GroqChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct GroqChatChoiceMessage {
    content: String,
}

struct GroqClient {
    http: reqwest::Client,
    api_key: String,
    timeout: Duration,
    max_retries: u8,
}

/// Groq as the registry sees it: recognition and completions on one key.
///
/// It implements no `VoiceProvider`, and there is no stub saying so — the
/// registry entry's `voice: None` is the whole statement (ADR 0094).
pub struct Groq;

pub static GROQ: Groq = Groq;

impl Provider for Groq {
    /// The request carries a model and a correction model for the lane that
    /// needs them to answer. Groq's status does not depend on either.
    fn status(
        &self,
        _request: &ProviderStatusRequest,
    ) -> Result<ProviderStatus, ProviderCommandError> {
        provider_status()
    }

    fn save_api_key(
        &self,
        api_key: &str,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        save_api_key(api_key)
    }

    fn clear_api_key(&self) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        clear_api_key()
    }

    fn validate_api_key(
        &self,
        api_key: Option<String>,
    ) -> ProviderFuture<ValidateProviderApiKeyResponse> {
        Box::pin(validate_api_key(api_key))
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

fn provider_status() -> Result<GroqProviderStatus, ProviderCommandError> {
    Ok(GroqProviderStatus {
        provider: "groq".to_string(),
        default_profile: "cloud-fast".to_string(),
        credential: credential_status().map_err(ProviderCommandError::from)?,
        profiles: provider_profiles(),
        capabilities: provider_capabilities(),
        local_setup: None,
    })
}

fn save_api_key(api_key: &str) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    let api_key = normalize_api_key(api_key)?;
    write_api_key_to(&OsSecretStore, &api_key).map_err(secret_store_error)?;
    cache_groq_api_key(Some(api_key));
    credential_status().map_err(ProviderCommandError::from)
}

fn clear_api_key() -> Result<ProviderCredentialStatus, ProviderCommandError> {
    clear_api_key_in(&OsSecretStore).map_err(secret_store_error)?;
    cache_groq_api_key(None);
    credential_status().map_err(ProviderCommandError::from)
}

async fn validate_api_key(
    api_key: Option<String>,
) -> Result<ValidateGroqApiKeyResponse, ProviderCommandError> {
    let (api_key, checked_with) = match api_key {
        Some(value) if !value.trim().is_empty() => {
            (normalize_api_key(&value)?, "provided_key".to_string())
        }
        _ => (load_groq_api_key()?, "stored_key".to_string()),
    };

    let client = GroqClient::new(api_key, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RETRIES)
        .map_err(ProviderCommandError::from)?;
    client
        .validate_models_endpoint()
        .await
        .map_err(ProviderCommandError::from)?;

    Ok(ValidateGroqApiKeyResponse {
        ok: true,
        provider: "groq".to_string(),
        checked_with,
    })
}

async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<GroqTranscriptionResponse, ProviderCommandError> {
    let api_key = load_groq_api_key()?;
    let client = GroqClient::new(
        api_key,
        request.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS),
        request.max_retries.unwrap_or(DEFAULT_MAX_RETRIES),
    )
    .map_err(ProviderCommandError::from)?;

    client
        .transcribe_file(request)
        .await
        .map_err(ProviderCommandError::from)
}

async fn create_chat_completion(
    request: ChatCompletionRequest,
) -> Result<String, ProviderCommandError> {
    let api_key = load_groq_api_key()?;
    let client = GroqClient::new(
        api_key,
        request.timeout_ms.unwrap_or(8_000),
        request.max_retries.unwrap_or(1),
    )
    .map_err(ProviderCommandError::from)?;

    client
        .chat_completion(request)
        .await
        .map_err(ProviderCommandError::from)
}

impl GroqClient {
    fn new(api_key: String, timeout_ms: u64, max_retries: u8) -> Result<Self, GroqProviderError> {
        let timeout = Duration::from_millis(timeout_ms.max(5_000));
        let http = reqwest::Client::builder()
            .timeout(timeout)
            .connect_timeout(Duration::from_secs(8))
            .build()
            .map_err(|error| GroqProviderError {
                kind: ProviderErrorKind::InvalidRequest,
                message: format!("Could not build Groq HTTP client: {error}"),
                status: None,
                retry_after_seconds: None,
            })?;

        Ok(Self {
            http,
            api_key,
            timeout,
            max_retries,
        })
    }

    async fn validate_models_endpoint(&self) -> Result<(), GroqProviderError> {
        let response = self
            .send_with_retries("models.validate", || {
                self.http
                    .get(format!("{GROQ_API_BASE}/models"))
                    .bearer_auth(&self.api_key)
            })
            .await?;

        drop(response);
        Ok(())
    }

    async fn transcribe_file(
        &self,
        request: TranscribeAudioFileRequest,
    ) -> Result<GroqTranscriptionResponse, GroqProviderError> {
        let started_at = Instant::now();
        let audio_path = Path::new(&request.audio_path);
        let file_name = audio_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("wordscript-audio.wav")
            .to_string();

        let audio_bytes = tokio::fs::read(audio_path)
            .await
            .map_err(|error| GroqProviderError {
                kind: ProviderErrorKind::Io,
                message: format!("Could not read audio file: {error}"),
                status: None,
                retry_after_seconds: None,
            })?;

        let model = request
            .model
            .unwrap_or_else(|| "whisper-large-v3-turbo".to_string());
        let language = request.language.filter(|value| !value.trim().is_empty());
        let prompt = request.prompt.filter(|value| !value.trim().is_empty());
        let response_format = request
            .response_format
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "verbose_json".to_string());

        // `prompt_chars` is here so the blank-state floor can be verified where
        // it matters. A floor that only shows up in the settings preview is the
        // defect `stt-hints-bypass-the-vocabulary-opt-in.md` records, and until
        // this line carried the number there was no way to tell from a real
        // dictation whether the provider got a prompt at all (ADR 0036). The
        // count, not the text: the prompt can carry the user's own terms.
        runtime_log::record(format!(
            "[WordScript] Groq transcription start file={} bytes={} model={} timeout_ms={} retries={} prompt_chars={}",
            file_name,
            audio_bytes.len(),
            model,
            self.timeout.as_millis(),
            self.max_retries,
            prompt.as_deref().map(str::len).unwrap_or(0),
        ));

        validate_audio_upload_size(&file_name, audio_bytes.len())?;

        if audio_bytes.len() > GROQ_FREE_TIER_MAX_AUDIO_BYTES {
            runtime_log::record(format!(
                "[WordScript] Groq transcription upload warning file={} size={} free_tier_limit={} dev_tier_limit={}",
                file_name,
                format_audio_size(audio_bytes.len()),
                format_audio_size(GROQ_FREE_TIER_MAX_AUDIO_BYTES),
                format_audio_size(GROQ_DEV_TIER_MAX_AUDIO_BYTES),
            ));
        }

        let response = match self
            .send_with_retries("audio.transcriptions", || {
                let mut form = multipart::Form::new()
                    .text("model", model.clone())
                    .text("response_format", response_format.clone())
                    .text("temperature", "0")
                    .part(
                        "file",
                        multipart::Part::bytes(audio_bytes.clone()).file_name(file_name.clone()),
                    );

                if let Some(language) = &language {
                    form = form.text("language", language.clone());
                }
                if let Some(prompt) = &prompt {
                    form = form.text("prompt", prompt.clone());
                }

                self.http
                    .post(format!("{GROQ_API_BASE}/audio/transcriptions"))
                    .bearer_auth(&self.api_key)
                    .multipart(form)
            })
            .await
        {
            Ok(response) => response,
            Err(error) => {
                return Err(annotate_transcription_error(
                    error,
                    &file_name,
                    audio_bytes.len(),
                ));
            }
        };

        let payload = response
            .json::<GroqTranscriptionResponse>()
            .await
            .map_err(|error| GroqProviderError {
                kind: ProviderErrorKind::Parse,
                message: format!("Could not parse Groq transcription response: {error}"),
                status: None,
                retry_after_seconds: None,
            })?;

        runtime_log::record(format!(
            "[WordScript] Groq transcription complete elapsed_ms={} text_len={} duration={:?}",
            started_at.elapsed().as_millis(),
            payload.text.len(),
            payload.duration,
        ));

        Ok(payload)
    }

    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<String, GroqProviderError> {
        let started_at = Instant::now();
        let prompt_chars = request
            .messages
            .iter()
            .map(|message| message.content.len())
            .sum::<usize>();
        runtime_log::record(format!(
            "[WordScript] Groq correction start model={} timeout_ms={} retries={} prompt_chars={} max_tokens={}",
            request.model,
            self.timeout.as_millis(),
            self.max_retries,
            prompt_chars,
            request.max_tokens,
        ));

        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        });

        let response = self
            .send_with_retries("chat.completions", || {
                self.http
                    .post(format!("{GROQ_API_BASE}/chat/completions"))
                    .bearer_auth(&self.api_key)
                    .json(&body)
            })
            .await?;

        let payload = response
            .json::<GroqChatCompletionResponse>()
            .await
            .map_err(|error| GroqProviderError {
                kind: ProviderErrorKind::Parse,
                message: format!("Could not parse Groq chat completion response: {error}"),
                status: None,
                retry_after_seconds: None,
            })?;

        payload
            .choices
            .first()
            .map(|choice| choice.message.content.trim().to_string())
            .filter(|content| !content.is_empty())
            .ok_or(GroqProviderError {
                kind: ProviderErrorKind::Parse,
                message: "Groq chat completion returned no text choices.".to_string(),
                status: None,
                retry_after_seconds: None,
            })
            .inspect(|content| {
                runtime_log::record(format!(
                    "[WordScript] Groq correction complete elapsed_ms={} text_len={}",
                    started_at.elapsed().as_millis(),
                    content.len(),
                ));
            })
    }

    async fn send_with_retries<F>(
        &self,
        label: &str,
        request_factory: F,
    ) -> Result<reqwest::Response, GroqProviderError>
    where
        F: Fn() -> reqwest::RequestBuilder,
    {
        let mut attempt = 0;
        loop {
            let attempt_number = attempt + 1;
            let started_at = Instant::now();
            let response = request_factory().send().await;
            match response {
                Ok(response) if response.status().is_success() => {
                    runtime_log::record(format!(
                        "[WordScript] Groq {} success attempt={} status={} elapsed_ms={}",
                        label,
                        attempt_number,
                        response.status().as_u16(),
                        started_at.elapsed().as_millis(),
                    ));
                    return Ok(response);
                }
                Ok(response) => {
                    let status = response.status();
                    let retry_after_seconds = retry_after_seconds(&response);
                    let body = response.text().await.unwrap_or_default();
                    let error = status_error(status, body, retry_after_seconds);

                    runtime_log::record(format!(
                        "[WordScript] Groq {} failure attempt={} status={} elapsed_ms={} retry_after={:?}",
                        label,
                        attempt_number,
                        status.as_u16(),
                        started_at.elapsed().as_millis(),
                        retry_after_seconds,
                    ));

                    if should_retry_status(status) && attempt < self.max_retries {
                        attempt += 1;
                        runtime_log::record(format!(
                            "[WordScript] Groq {} retrying after status failure attempt={} next_attempt={} delay_ms={}",
                            label,
                            attempt_number,
                            attempt + 1,
                            retry_delay(attempt, retry_after_seconds).as_millis(),
                        ));
                        sleep(retry_delay(attempt, retry_after_seconds)).await;
                        continue;
                    }

                    return Err(error);
                }
                Err(error) if error.is_timeout() => {
                    runtime_log::record(format!(
                        "[WordScript] Groq {} timeout attempt={} elapsed_ms={} timeout_ms={}",
                        label,
                        attempt_number,
                        started_at.elapsed().as_millis(),
                        self.timeout.as_millis(),
                    ));
                    if attempt < self.max_retries {
                        attempt += 1;
                        runtime_log::record(format!(
                            "[WordScript] Groq {} retrying after timeout attempt={} next_attempt={} delay_ms={}",
                            label,
                            attempt_number,
                            attempt + 1,
                            retry_delay(attempt, None).as_millis(),
                        ));
                        sleep(retry_delay(attempt, None)).await;
                        continue;
                    }

                    return Err(GroqProviderError {
                        kind: ProviderErrorKind::Timeout,
                        message: format!(
                            "Groq request timed out after {}ms",
                            self.timeout.as_millis()
                        ),
                        status: None,
                        retry_after_seconds: None,
                    });
                }
                Err(error) => {
                    runtime_log::record(format!(
                        "[WordScript] Groq {} network error attempt={} elapsed_ms={} error={}",
                        label,
                        attempt_number,
                        started_at.elapsed().as_millis(),
                        error,
                    ));
                    if attempt < self.max_retries {
                        attempt += 1;
                        runtime_log::record(format!(
                            "[WordScript] Groq {} retrying after network error attempt={} next_attempt={} delay_ms={}",
                            label,
                            attempt_number,
                            attempt + 1,
                            retry_delay(attempt, None).as_millis(),
                        ));
                        sleep(retry_delay(attempt, None)).await;
                        continue;
                    }

                    return Err(GroqProviderError {
                        kind: ProviderErrorKind::Network,
                        message: format!("Groq network request failed: {error}"),
                        status: None,
                        retry_after_seconds: None,
                    });
                }
            }
        }
    }
}

fn provider_profiles() -> Vec<ProviderProfile> {
    vec![
        ProviderProfile {
            id: "cloud-fast".to_string(),
            provider: "groq".to_string(),
            mode: ProviderMode::Fast,
            model: "whisper-large-v3-turbo".to_string(),
            label: "Groq fast multilingual transcription".to_string(),
            default: true,
            requires_api_key: true,
        },
        ProviderProfile {
            id: "cloud-quality".to_string(),
            provider: "groq".to_string(),
            mode: ProviderMode::Quality,
            model: "whisper-large-v3".to_string(),
            label: "Groq high-accuracy multilingual transcription".to_string(),
            default: false,
            requires_api_key: true,
        },
    ]
}

fn provider_capabilities() -> ProviderCapabilities {
    ProviderCapabilities {
        transcription: true,
        chat_completion: true,
        local: false,
        requires_api_key: true,
        supports_prompt_bias: true,
        supports_language: true,
        supports_segments: true,
        model_management: false,
    }
}

fn credential_status() -> Result<ProviderCredentialStatus, GroqProviderError> {
    match read_api_key_from(&OsSecretStore).map_err(secret_store_error)? {
        Some(api_key) => {
            cache_groq_api_key(Some(api_key.clone()));
            Ok(ProviderCredentialStatus {
                provider: "groq".to_string(),
                configured: true,
                storage: "os_secret_store".to_string(),
                key_preview: Some(mask_api_key(&api_key)),
            })
        }
        None => Ok(ProviderCredentialStatus {
            provider: "groq".to_string(),
            configured: false,
            storage: "os_secret_store".to_string(),
            key_preview: None,
        }),
    }
}

fn load_groq_api_key() -> Result<String, ProviderCommandError> {
    if let Some(api_key) = cached_groq_api_key() {
        return Ok(api_key);
    }

    match read_api_key_from(&OsSecretStore).map_err(secret_store_error)? {
        Some(api_key) => {
            let normalized = normalize_api_key(&api_key).map_err(ProviderCommandError::from)?;
            cache_groq_api_key(Some(normalized.clone()));
            Ok(normalized)
        }
        None => Err(ProviderCommandError::from(GroqProviderError {
            kind: ProviderErrorKind::MissingApiKey,
            message: "No Groq API key is stored for WordScript.".to_string(),
            status: None,
            retry_after_seconds: None,
        })),
    }
}

fn normalize_api_key(api_key: &str) -> Result<String, GroqProviderError> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err(GroqProviderError {
            kind: ProviderErrorKind::MissingApiKey,
            message: "Groq API key must not be empty.".to_string(),
            status: None,
            retry_after_seconds: None,
        });
    }

    if !trimmed.starts_with("gsk_") {
        return Err(GroqProviderError {
            kind: ProviderErrorKind::InvalidRequest,
            message: "Groq API key should start with gsk_.".to_string(),
            status: None,
            retry_after_seconds: None,
        });
    }

    Ok(trimmed.to_string())
}

/// The secret-store surface used for the Groq key.
///
/// The keyring is process-global OS state, so the legacy-service migration
/// below sits behind this trait: the tests exercise it against an in-memory
/// store instead of writing into the developer's real secret store.
trait SecretStore {
    fn read(&self, service: &str) -> Result<Option<String>, KeyringError>;
    fn write(&self, service: &str, secret: &str) -> Result<(), KeyringError>;
    fn delete(&self, service: &str) -> Result<(), KeyringError>;
}

struct OsSecretStore;

impl SecretStore for OsSecretStore {
    fn read(&self, service: &str) -> Result<Option<String>, KeyringError> {
        match Entry::new(service, GROQ_KEY_USER)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(error) => Err(error),
        }
    }

    fn write(&self, service: &str, secret: &str) -> Result<(), KeyringError> {
        Entry::new(service, GROQ_KEY_USER)?.set_password(secret)
    }

    fn delete(&self, service: &str) -> Result<(), KeyringError> {
        match Entry::new(service, GROQ_KEY_USER)?.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(error),
        }
    }
}

/// Reads the stored key and, when only a retired service name still holds it,
/// moves it onto the current one. `Ok(None)` means no known service name holds
/// a key -- which is a legitimate state, not a store failure.
fn read_api_key_from(store: &impl SecretStore) -> Result<Option<String>, KeyringError> {
    if let Some(api_key) = store.read(GROQ_KEY_SERVICE)? {
        return Ok(Some(api_key));
    }

    for legacy_service in LEGACY_GROQ_KEY_SERVICES {
        let Some(api_key) = store.read(legacy_service)? else {
            continue;
        };

        store.write(GROQ_KEY_SERVICE, &api_key)?;
        store.delete(legacy_service)?;
        runtime_log::record(format!(
            "groq secret store: moved the stored API key from the retired service name '{legacy_service}' to '{GROQ_KEY_SERVICE}'"
        ));
        return Ok(Some(api_key));
    }

    Ok(None)
}

/// Retired service names are dropped on every write so no copy of the secret
/// outlives the rename, and so a cleared key cannot be resurrected from an old
/// entry by the next read.
fn write_api_key_to(store: &impl SecretStore, api_key: &str) -> Result<(), KeyringError> {
    store.write(GROQ_KEY_SERVICE, api_key)?;
    clear_legacy_api_keys_in(store)
}

fn clear_api_key_in(store: &impl SecretStore) -> Result<(), KeyringError> {
    store.delete(GROQ_KEY_SERVICE)?;
    clear_legacy_api_keys_in(store)
}

fn clear_legacy_api_keys_in(store: &impl SecretStore) -> Result<(), KeyringError> {
    for legacy_service in LEGACY_GROQ_KEY_SERVICES {
        store.delete(legacy_service)?;
    }

    Ok(())
}

fn secret_store_error(error: KeyringError) -> GroqProviderError {
    GroqProviderError {
        kind: ProviderErrorKind::SecretStoreUnavailable,
        message: format!("OS secret store is unavailable: {error}"),
        status: None,
        retry_after_seconds: None,
    }
}

fn status_error(
    status: StatusCode,
    body: String,
    retry_after_seconds: Option<u64>,
) -> GroqProviderError {
    let kind = match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => ProviderErrorKind::Unauthorized,
        StatusCode::TOO_MANY_REQUESTS => ProviderErrorKind::RateLimited,
        StatusCode::BAD_REQUEST
        | StatusCode::PAYLOAD_TOO_LARGE
        | StatusCode::UNPROCESSABLE_ENTITY => ProviderErrorKind::InvalidRequest,
        _ => ProviderErrorKind::ProviderStatus,
    };

    GroqProviderError {
        kind,
        message: if body.is_empty() {
            format!("Groq returned HTTP {status}")
        } else {
            format!("Groq returned HTTP {status}: {body}")
        },
        status: Some(status.as_u16()),
        retry_after_seconds,
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

fn format_audio_size(audio_bytes_len: usize) -> String {
    format!(
        "{:.1} MiB ({} bytes)",
        audio_bytes_len as f64 / 1_048_576.0,
        audio_bytes_len,
    )
}

fn should_retry_status(status: StatusCode) -> bool {
    status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error()
}

fn retry_delay(attempt: u8, retry_after_seconds: Option<u64>) -> Duration {
    if let Some(seconds) = retry_after_seconds {
        return Duration::from_secs(seconds.min(10));
    }

    Duration::from_millis(250 * u64::from(attempt))
}

fn retry_after_seconds(response: &reqwest::Response) -> Option<u64> {
    response
        .headers()
        .get(header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
}

fn mask_api_key(api_key: &str) -> String {
    let trimmed = api_key.trim();
    if trimmed.len() <= 10 {
        return "configured".to_string();
    }

    format!("{}...{}", &trimmed[..4], &trimmed[trimmed.len() - 4..])
}

fn groq_api_key_cache() -> &'static Mutex<Option<String>> {
    GROQ_API_KEY_CACHE.get_or_init(|| Mutex::new(None))
}

fn cached_groq_api_key() -> Option<String> {
    groq_api_key_cache()
        .lock()
        .ok()
        .and_then(|value| value.clone())
}

fn cache_groq_api_key(value: Option<String>) {
    if let Ok(mut cache) = groq_api_key_cache().lock() {
        *cache = value;
    }
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, collections::HashMap};

    use super::*;

    #[derive(Default)]
    struct FakeSecretStore {
        entries: RefCell<HashMap<String, String>>,
    }

    impl FakeSecretStore {
        fn with_entry(service: &str, secret: &str) -> Self {
            let store = Self::default();
            store.set(service, secret);
            store
        }

        fn set(&self, service: &str, secret: &str) {
            self.entries
                .borrow_mut()
                .insert(service.to_string(), secret.to_string());
        }

        fn get(&self, service: &str) -> Option<String> {
            self.entries.borrow().get(service).cloned()
        }
    }

    impl SecretStore for FakeSecretStore {
        fn read(&self, service: &str) -> Result<Option<String>, KeyringError> {
            Ok(self.get(service))
        }

        fn write(&self, service: &str, secret: &str) -> Result<(), KeyringError> {
            self.set(service, secret);
            Ok(())
        }

        fn delete(&self, service: &str) -> Result<(), KeyringError> {
            self.entries.borrow_mut().remove(service);
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
        let masked = mask_api_key("gsk_1234567890abcdef");
        assert_eq!(masked, "gsk_...cdef");
    }

    #[test]
    fn uses_single_neutral_product_namespace_for_key_service() {
        assert_eq!(GROQ_KEY_SERVICE, "io.github.sw-forge-org.wordscript");
        assert!(LEGACY_GROQ_KEY_SERVICES.contains(&"io.github.swbench.wordscript"));
        assert!(!LEGACY_GROQ_KEY_SERVICES.contains(&GROQ_KEY_SERVICE));
    }

    #[test]
    fn moves_a_key_stored_under_a_retired_service_name() {
        let store = FakeSecretStore::with_entry("io.github.swbench.wordscript", "gsk_legacy_key");

        let api_key = read_api_key_from(&store).expect("read must succeed");

        assert_eq!(api_key.as_deref(), Some("gsk_legacy_key"));
        assert_eq!(
            store.get(GROQ_KEY_SERVICE).as_deref(),
            Some("gsk_legacy_key")
        );
        assert_eq!(store.get("io.github.swbench.wordscript"), None);
    }

    #[test]
    fn prefers_the_current_service_over_a_retired_one() {
        let store = FakeSecretStore::with_entry(GROQ_KEY_SERVICE, "gsk_current_key");
        store.set("io.github.swbench.wordscript", "gsk_legacy_key");

        let api_key = read_api_key_from(&store).expect("read must succeed");

        assert_eq!(api_key.as_deref(), Some("gsk_current_key"));
    }

    #[test]
    fn reports_no_stored_key_instead_of_a_store_failure() {
        let store = FakeSecretStore::default();

        assert_eq!(read_api_key_from(&store).expect("read must succeed"), None);
    }

    #[test]
    fn clearing_removes_the_retired_entry_so_the_key_cannot_return() {
        let store = FakeSecretStore::with_entry(GROQ_KEY_SERVICE, "gsk_current_key");
        store.set("io.github.swbench.wordscript", "gsk_legacy_key");

        clear_api_key_in(&store).expect("clear must succeed");

        assert_eq!(store.get(GROQ_KEY_SERVICE), None);
        assert_eq!(store.get("io.github.swbench.wordscript"), None);
        assert_eq!(read_api_key_from(&store).expect("read must succeed"), None);
    }

    #[test]
    fn saving_leaves_no_copy_under_a_retired_service_name() {
        let store = FakeSecretStore::with_entry("io.github.swbench.wordscript", "gsk_legacy_key");

        write_api_key_to(&store, "gsk_current_key").expect("write must succeed");

        assert_eq!(
            store.get(GROQ_KEY_SERVICE).as_deref(),
            Some("gsk_current_key")
        );
        assert_eq!(store.get("io.github.swbench.wordscript"), None);
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
