use std::path::{Path, PathBuf};
use std::process::{Command as BlockingCommand, Stdio};
use std::time::{Duration, Instant};

use reqwest::{blocking::Client as BlockingClient, Url};
use serde::Deserialize;
use tokio::process::Command;
use tokio::time::timeout;

use crate::core::confidence_gate::{MAX_NO_SPEECH_PROB, MIN_AVG_LOGPROB};
use crate::core::model_catalogue;
use crate::core::runtime_log;

use super::{
    aggregate_credential,
    registry::{ChatProvider, Provider, ProviderFuture, SpeechProvider},
    ChatCompletionRequest, CredentialKind, LocalProviderIssueCode, LocalProviderReadiness,
    LocalProviderSetupStatus, ModelCapabilities, ModelSupport, ProviderCapabilities,
    ProviderCaptureLimits, ProviderCommandError, ProviderCredentialStatus, ProviderErrorKind,
    ProviderMode, ProviderProfile, ProviderRole, ProviderStatus, ProviderStatusRequest,
    ProviderTier, RoleCredentialStatus, TranscribeAudioFileRequest, TranscriptionResponse,
    ValidateProviderApiKeyResponse, LOCAL_PROVIDER_ID,
};

const DEFAULT_TIMEOUT_MS: u64 = 90_000;
const LOCAL_STORAGE_LABEL: &str = "local_runtime";
/// The roles this lane serves. Held to the registry entry by a test below.
const LOCAL_CREDENTIAL_ROLES: &[ProviderRole] = &[ProviderRole::Speech, ProviderRole::Chat];
const LOCAL_WHISPER_BINARY_ENV: &str = "WORDSCRIPT_LOCAL_WHISPER_CLI";
const LOCAL_MODEL_PATH_ENV: &str = "WORDSCRIPT_LOCAL_MODEL_PATH";
const LOCAL_MODEL_DIR_ENV: &str = "WORDSCRIPT_LOCAL_MODEL_DIR";
const LOCAL_VAD_MODEL_PATH_ENV: &str = "WORDSCRIPT_LOCAL_VAD_MODEL_PATH";
const LOCAL_RUNNER_PROBE_TIMEOUT_MS: u64 = 750;
/// Silero defaults as documented by whisper.cpp. The pad matches the capture
/// side trim: erring towards keeping audio, never towards cutting a word.
const VAD_THRESHOLD: f32 = 0.5;
const VAD_MIN_SPEECH_DURATION_MS: u32 = 250;
const VAD_MIN_SILENCE_DURATION_MS: u32 = 350;
const VAD_SPEECH_PAD_MS: u32 = 200;
const LOCAL_CHAT_BASE_URL_ENV: &str = "WORDSCRIPT_LOCAL_CHAT_BASE_URL";
const LOCAL_CHAT_MODEL_ENV: &str = "WORDSCRIPT_LOCAL_CHAT_MODEL";
const DEFAULT_LOCAL_CHAT_BASE_URL: &str = "http://127.0.0.1:11434";
/// The catalogue row this lane's chat requests fall back to (ADR 0115).
///
/// A slug rather than the tag itself, because the tag belongs to whichever
/// OpenAI-compatible server the user runs and is a row with a source and a date
/// like every other. The speech side keeps naming a *stem* (`base`) rather than
/// a row: a local recogniser is a file this module resolves to
/// `ggml-{stem}.bin`, and a file on this disk is not a vendor's model id.
const LOCAL_CHAT_DEFAULT_ROW: &str = "local-chat-ollama-llama32";
const LOCAL_CHAT_PROBE_TIMEOUT_MS: u64 = 1_500;

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    #[serde(default)]
    models: Vec<OllamaModelDescriptor>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelDescriptor {
    #[serde(default)]
    name: String,
    #[serde(default)]
    model: String,
}

#[derive(Debug, Deserialize)]
struct OllamaChatCompletionResponse {
    message: OllamaChatMessage,
}

#[derive(Debug, Deserialize)]
struct OllamaChatMessage {
    #[serde(default)]
    content: String,
}

#[derive(Debug, Clone)]
struct LocalChatRuntime {
    base_url: String,
    model: String,
    available_models: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LocalDecodePreset {
    Fast,
    Quality,
}

impl LocalDecodePreset {
    fn id_suffix(self) -> &'static str {
        match self {
            Self::Fast => "fast",
            Self::Quality => "quality",
        }
    }

    fn mode(self) -> ProviderMode {
        match self {
            Self::Fast => ProviderMode::Fast,
            Self::Quality => ProviderMode::Quality,
        }
    }

    fn beam_size(self) -> u8 {
        match self {
            Self::Fast => 1,
            Self::Quality => 5,
        }
    }

    fn best_of(self) -> u8 {
        match self {
            Self::Fast => 1,
            Self::Quality => 5,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LocalProfileSelection {
    model: String,
    preset: LocalDecodePreset,
}

impl LocalProfileSelection {
    fn new(model: &str, preset: LocalDecodePreset) -> Self {
        Self {
            model: normalize_local_model_name(model),
            preset,
        }
    }

    fn profile_id(&self) -> String {
        format!("local-{}-{}", self.model, self.preset.id_suffix())
    }
}

/// The local runtime as the registry sees it: recognition on whisper-cli,
/// completions on a local AI runtime, and no key for either.
///
/// It implements no `VoiceProvider`. Nothing in this build synthesises, and a
/// stub returning "unsupported" would be a role the type says exists (ADR 0094).
pub struct Local;

pub static LOCAL: Local = Local;

impl Provider for Local {
    /// Both model fields are read here: the local status is a statement about
    /// the runner, the STT model and the chat model that were actually asked
    /// for, and answering for a different model is how a setup surface reports
    /// a readiness the run will not have.
    fn status(
        &self,
        request: &ProviderStatusRequest,
    ) -> Result<ProviderStatus, ProviderCommandError> {
        provider_status(
            request.model.as_deref(),
            request.correction_model.as_deref(),
        )
    }

    fn capabilities(&self) -> ProviderCapabilities {
        provider_capabilities()
    }

    fn model_capabilities(&self, model: &str) -> ModelCapabilities {
        model_capabilities(model)
    }

    /// **Empty, and that is what this lane is.** Local is not a lane missing a
    /// credential — it authenticates against nothing, so there is no kind to
    /// accept and no key row for a surface to draw.
    fn credential_kinds(&self) -> &'static [CredentialKind] {
        &[]
    }

    /// **The connection is ignored, and that is what this lane is** (ADR 0208).
    /// A local runtime authenticates against nothing, so there is no account to
    /// scope a credential by — the argument exists on the trait because every
    /// other lane needs it, and answering it with the runtime's readiness is
    /// the honest reply rather than an error.
    fn credential_status(
        &self,
        _connection: &str,
        role: ProviderRole,
    ) -> Result<RoleCredentialStatus, ProviderCommandError> {
        let setup = inspect_local_setup(default_status_model().as_str(), &resolve_local_chat_model_name(None));

        Ok(role_credential_status(role, &setup))
    }

    fn save_api_key(
        &self,
        _connection: &str,
        _role: ProviderRole,
        _kind: CredentialKind,
        api_key: &str,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        save_api_key(api_key)
    }

    fn clear_api_key(
        &self,
        _connection: &str,
        _role: ProviderRole,
        _kind: CredentialKind,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
        clear_api_key()
    }

    fn validate_api_key(
        &self,
        _connection: &str,
        api_key: Option<String>,
    ) -> ProviderFuture<ValidateProviderApiKeyResponse> {
        Box::pin(validate_api_key(api_key))
    }
}

impl SpeechProvider for Local {
    fn transcribe_audio_file(
        &self,
        request: TranscribeAudioFileRequest,
    ) -> ProviderFuture<TranscriptionResponse> {
        Box::pin(transcribe_audio_file(request))
    }

    fn tiers(&self) -> Vec<ProviderTier> {
        tiers()
    }

    /// Bound by the model, never by the plan: the ceiling is decode time.
    fn capture_limits(&self, model: &str, _tier_id: &str) -> ProviderCaptureLimits {
        capture_limits(model)
    }
}

impl ChatProvider for Local {
    fn create_chat_completion(&self, request: ChatCompletionRequest) -> ProviderFuture<String> {
        Box::pin(create_chat_completion(request))
    }
}

fn provider_status(
    model: Option<&str>,
    correction_model: Option<&str>,
) -> Result<ProviderStatus, ProviderCommandError> {
    let profiles = provider_profiles();
    let default_profile_id = profiles
        .iter()
        .find(|profile| profile.default)
        .map(|profile| profile.id.clone())
        .unwrap_or_else(|| "local-base-fast".to_string());
    let requested_model = model
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            profiles
                .iter()
                .find(|profile| profile.default)
                .map(|profile| profile.model.as_str())
        })
        .unwrap_or("base");
    let requested_chat_model = resolve_local_chat_model_name(correction_model);
    let model_capabilities = model_capabilities(requested_model);
    let local_setup = inspect_local_setup(requested_model, &requested_chat_model);
    let configured = matches!(local_setup.readiness, LocalProviderReadiness::Ready);
    let status_detail = Some(if configured {
        format!(
            "{} · {} · {}",
            local_setup
                .resolved_runner
                .clone()
                .unwrap_or_else(|| "whisper-cli".to_string()),
            local_setup
                .resolved_model
                .as_deref()
                .map(Path::new)
                .and_then(|path| path.file_name())
                .and_then(|value| value.to_str())
                .unwrap_or("model.bin"),
            local_setup
                .resolved_chat_model
                .as_deref()
                .unwrap_or(model_catalogue::model_id(LOCAL_CHAT_DEFAULT_ROW)),
        )
    } else {
        local_setup.guidance.clone()
    });

    // Built from the inspection already in hand rather than by asking per role:
    // `inspect_local_setup` probes the runner and the chat backend, and a
    // status call must not run those probes once per role.
    let role_credentials: Vec<RoleCredentialStatus> = LOCAL_CREDENTIAL_ROLES
        .iter()
        .map(|role| RoleCredentialStatus {
            provider: LOCAL_PROVIDER_ID.to_string(),
            role: *role,
            kind: None,
            configured,
            storage: LOCAL_STORAGE_LABEL.to_string(),
            key_preview: status_detail.clone(),
            missing: (!configured).then(|| local_setup.guidance.clone()),
        })
        .collect();

    Ok(ProviderStatus {
        provider: LOCAL_PROVIDER_ID.to_string(),
        default_profile: default_profile_id,
        credential: aggregate_credential(LOCAL_PROVIDER_ID, &role_credentials),
        profiles,
        capabilities: provider_capabilities(),
        model_capabilities,
        role_credentials,
        local_setup: Some(local_setup),
        self_hosted_endpoint: None,
    })
}

/// The model a status question means when the caller named none.
fn default_status_model() -> String {
    provider_profiles()
        .into_iter()
        .find(|profile| profile.default)
        .map(|profile| profile.model)
        .unwrap_or_else(|| "base".to_string())
}

/// What answers for one role on a lane that authenticates against nothing.
///
/// `kind: None` is the statement — not "no credential stored", but "no
/// credential exists to store". What stands in for one is the runtime being
/// installed, so `missing` carries the setup guidance the surface already
/// shows: the next action, in the place a missing key would be named.
fn role_credential_status(
    role: ProviderRole,
    setup: &LocalProviderSetupStatus,
) -> RoleCredentialStatus {
    let configured = matches!(setup.readiness, LocalProviderReadiness::Ready);

    RoleCredentialStatus {
        provider: LOCAL_PROVIDER_ID.to_string(),
        role,
        kind: None,
        configured,
        storage: LOCAL_STORAGE_LABEL.to_string(),
        key_preview: None,
        missing: (!configured).then(|| setup.guidance.clone()),
    }
}

fn save_api_key(_api_key: &str) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    Err(ProviderCommandError::invalid_request(
        "Local runtime does not use API keys. Configure whisper-cli, a local STT model, and a local AI runtime instead.",
    ))
}

fn clear_api_key() -> Result<ProviderCredentialStatus, ProviderCommandError> {
    Err(ProviderCommandError::invalid_request(
        "Local runtime does not use API keys. There is no stored key to clear.",
    ))
}

async fn validate_api_key(
    _api_key: Option<String>,
) -> Result<ValidateProviderApiKeyResponse, ProviderCommandError> {
    let status = provider_status(None, None)?;
    if !status.credential.configured {
        return Err(ProviderCommandError::local_setup(
            local_setup_message("base"),
        ));
    }

    Ok(ValidateProviderApiKeyResponse {
        ok: true,
        provider: LOCAL_PROVIDER_ID.to_string(),
        checked_with: "local_runner".to_string(),
    })
}

async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<TranscriptionResponse, ProviderCommandError> {
    let selected_profile = request
        .profile
        .as_deref()
        .and_then(local_profile_selection_from_id);
    let requested_model = selected_profile
        .as_ref()
        .map(|profile| profile.model.clone())
        .or_else(|| {
            request
                .model
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .map(normalize_local_model_name)
        })
        .unwrap_or_else(|| "base".to_string());
    let started_at = Instant::now();
    let binary = resolve_local_whisper_binary()
        .map_err(|issue| ProviderCommandError::local_setup(issue.guidance(&requested_model)))?;
    // A probe failure is not fatal here: the health surface already reports it,
    // and running with the base flag set beats refusing to transcribe.
    let capabilities = probe_local_whisper_runner(&binary).unwrap_or_default();
    let vad_model_path = resolve_local_vad_model_path();
    let profile = selected_profile.unwrap_or_else(|| {
        LocalProfileSelection::new(
            &requested_model,
            preferred_local_decode_preset(&requested_model),
        )
    });
    let model_path = resolve_local_model_path(&profile.model)
        .map_err(|issue| ProviderCommandError::local_setup(issue.guidance()))?;
    let language = request.language.filter(|value| !value.trim().is_empty());
    let prompt = request.prompt.filter(|value| !value.trim().is_empty());
    let carry_initial_prompt = request.carry_initial_prompt.unwrap_or(false) && prompt.is_some();
    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).max(10_000);
    let beam_size = normalize_local_decode_value(request.beam_size, profile.preset.beam_size());
    let best_of = normalize_local_decode_value(request.best_of, profile.preset.best_of());

    let command_args = whisper_cli_args(
        &request.audio_path,
        &model_path,
        language.as_deref(),
        prompt.as_deref(),
        carry_initial_prompt,
        beam_size,
        best_of,
        &capabilities,
        vad_model_path.as_deref(),
    );

    if !capabilities.supports_vad {
        runtime_log::record(
            "[WordScript] Local runtime VAD skipped reason=flag_unsupported_by_whisper_cli"
                .to_string(),
        );
    } else if vad_model_path.is_none() {
        runtime_log::record(format!(
            "[WordScript] Local runtime VAD skipped reason=no_model_configured env={LOCAL_VAD_MODEL_PATH_ENV}"
        ));
    }

    let mut command = Command::new(&binary);
    command
        .args(&command_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    runtime_log::record(format!(
        "[WordScript] Local runtime transcription start binary={} model={} profile={} timeout_ms={} audio_path={} prompt_chars={} carry_initial_prompt={} beam_size={} best_of={}",
        binary,
        model_path.display(),
        profile.profile_id(),
        timeout_ms,
        request.audio_path,
        prompt.as_ref().map(|value| value.len()).unwrap_or(0),
        carry_initial_prompt,
        beam_size,
        best_of,
    ));

    let output = timeout(Duration::from_millis(timeout_ms), command.output())
        .await
        .map_err(|_| {
            ProviderCommandError::new(
                ProviderErrorKind::Timeout,
                format!(
                "Local runtime transcription timed out after {} ms while waiting for whisper-cli.",
                timeout_ms,
            ),
                None,
                None,
            )
        })?
        .map_err(|error| {
            ProviderCommandError::new(
                ProviderErrorKind::Io,
                format!("Could not start local runtime transcription: {error}"),
                None,
                None,
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(ProviderCommandError::new(
            ProviderErrorKind::ProviderStatus,
            if stderr.is_empty() {
                format!(
                    "Local runtime transcription failed with status {}.",
                    output.status,
                )
            } else {
                format!("Local runtime transcription failed: {stderr}")
            },
            output.status.code().map(|code| code as u16),
            None,
        ));
    }

    let text = normalize_transcription_stdout(&output.stdout);
    if text.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(ProviderCommandError::new(
            ProviderErrorKind::Parse,
            if stderr.is_empty() {
                "Local runtime returned no transcription text on stdout.".to_string()
            } else {
                format!(
                    "Local runtime returned no transcription text. whisper-cli stderr: {}",
                    stderr,
                )
            },
            None,
            None,
        ));
    }

    runtime_log::record(format!(
        "[WordScript] Local runtime transcription done elapsed_ms={} chars={}",
        started_at.elapsed().as_millis(),
        text.len(),
    ));

    Ok(TranscriptionResponse {
        text,
        language,
        duration: None,
        segments: None,
    })
}

fn whisper_cli_args(
    audio_path: &str,
    model_path: &Path,
    language: Option<&str>,
    prompt: Option<&str>,
    carry_initial_prompt: bool,
    beam_size: u8,
    best_of: u8,
    capabilities: &WhisperCliCapabilities,
    vad_model_path: Option<&Path>,
) -> Vec<String> {
    let mut args = vec![
        "-m".to_string(),
        model_path.display().to_string(),
        "-f".to_string(),
        audio_path.to_string(),
        "-nt".to_string(),
        "-np".to_string(),
        "-bs".to_string(),
        beam_size.to_string(),
        "-bo".to_string(),
        best_of.to_string(),
    ];

    if let Some(language) = language.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("-l".to_string());
        args.push(language.to_string());
    }

    if let Some(prompt) = prompt.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("--prompt".to_string());
        args.push(prompt.to_string());

        if carry_initial_prompt {
            args.push("--carry-initial-prompt".to_string());
        }
    }

    if capabilities.supports_max_context {
        // whisper.cpp carries decoded text from one window into the next as
        // context. That is the internal amplifier behind stuck repetition
        // loops on longer dictations, and it is separate from the user's
        // `--carry-initial-prompt` bias setting.
        args.push("--max-context".to_string());
        args.push("0".to_string());
    }

    if capabilities.supports_logprob_thold {
        args.push("--logprob-thold".to_string());
        args.push(format!("{MIN_AVG_LOGPROB}"));
    }

    if capabilities.supports_no_speech_thold {
        args.push("--no-speech-thold".to_string());
        args.push(format!("{MAX_NO_SPEECH_PROB}"));
    }

    if let Some(vad_model_path) = vad_model_path.filter(|_| capabilities.supports_vad) {
        args.push("--vad".to_string());
        args.push("--vad-model".to_string());
        args.push(vad_model_path.display().to_string());
        args.push("--vad-threshold".to_string());
        args.push(format!("{VAD_THRESHOLD}"));
        args.push("--vad-min-speech-duration-ms".to_string());
        args.push(VAD_MIN_SPEECH_DURATION_MS.to_string());
        args.push("--vad-min-silence-duration-ms".to_string());
        args.push(VAD_MIN_SILENCE_DURATION_MS.to_string());
        args.push("--vad-speech-pad-ms".to_string());
        args.push(VAD_SPEECH_PAD_MS.to_string());
    }

    args
}

/// The Silero VAD model whisper.cpp needs for `--vad`. WordScript does not
/// ship it, so the flag stays off until the user points at one.
fn resolve_local_vad_model_path() -> Option<PathBuf> {
    let raw = std::env::var(LOCAL_VAD_MODEL_PATH_ENV).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    path.is_file().then_some(path)
}

fn normalize_local_decode_value(value: Option<u8>, fallback: u8) -> u8 {
    match value.unwrap_or(fallback) {
        1..=8 => value.unwrap_or(fallback),
        _ => fallback.clamp(1, 8),
    }
}

async fn create_chat_completion(
    request: ChatCompletionRequest,
) -> Result<String, ProviderCommandError> {
    let started_at = Instant::now();
    let timeout_ms = request.timeout_ms.unwrap_or(8_000).max(5_000);
    let chat_runtime = inspect_local_chat_runtime_async(Some(&request.model), timeout_ms)
        .await
        .map_err(|issue| ProviderCommandError::local_setup(issue.guidance()))?;
    let http = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .connect_timeout(Duration::from_millis(1_500))
        .build()
        .map_err(|error| {
            ProviderCommandError::new(
                ProviderErrorKind::InvalidRequest,
                format!("Could not build local runtime HTTP client: {error}"),
                None,
                None,
            )
        })?;
    let prompt_chars = request
        .messages
        .iter()
        .map(|message| message.content.len())
        .sum::<usize>();

    runtime_log::record(format!(
        "[WordScript] Local runtime correction start endpoint={} model={} timeout_ms={} prompt_chars={} max_tokens={}",
        chat_runtime.base_url,
        chat_runtime.model,
        timeout_ms,
        prompt_chars,
        request.max_tokens,
    ));

    let response = http
        .post(format!("{}/api/chat", chat_runtime.base_url))
        .json(&serde_json::json!({
            "model": chat_runtime.model,
            "messages": request.messages,
            "stream": false,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            },
        }))
        .send()
        .await
        .map_err(|error| {
            ProviderCommandError::new(
                if error.is_timeout() {
                    ProviderErrorKind::Timeout
                } else {
                    ProviderErrorKind::Network
                },
                format!(
                    "Local runtime cleanup request to {} failed: {}",
                    chat_runtime.base_url, error,
                ),
                None,
                None,
            )
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let detail = response
            .text()
            .await
            .unwrap_or_else(|_| String::new())
            .trim()
            .to_string();

        return Err(ProviderCommandError::new(
            ProviderErrorKind::ProviderStatus,
            if detail.is_empty() {
                format!(
                    "Local runtime cleanup failed with status {} from {}.",
                    status, chat_runtime.base_url,
                )
            } else {
                format!(
                    "Local runtime cleanup failed with status {} from {}: {}",
                    status, chat_runtime.base_url, detail,
                )
            },
            Some(status.as_u16()),
            None,
        ));
    }

    let payload = response
        .json::<OllamaChatCompletionResponse>()
        .await
        .map_err(|error| {
            ProviderCommandError::new(
                ProviderErrorKind::Parse,
                format!("Could not parse local runtime cleanup response: {error}"),
                None,
                None,
            )
        })?;
    let content = payload.message.content.trim().to_string();

    if content.is_empty() {
        return Err(ProviderCommandError::new(
            ProviderErrorKind::Parse,
            "Local runtime cleanup returned no assistant text.".to_string(),
            None,
            None,
        ));
    }

    runtime_log::record(format!(
        "[WordScript] Local runtime correction done elapsed_ms={} corrected_len={}",
        started_at.elapsed().as_millis(),
        content.len(),
    ));

    Ok(content)
}

fn provider_profiles() -> Vec<ProviderProfile> {
    discover_local_provider_profiles().unwrap_or_else(fallback_provider_profiles)
}

/// The local runtime has no account plans: nothing here is billed by request
/// size, so there is nothing to choose between.
fn tiers() -> Vec<ProviderTier> {
    Vec::new()
}

/// Seconds of decode per second of audio, by model size.
///
/// Deliberately pessimistic — a ceiling that assumes a fast machine is a
/// ceiling that fails on the machine that needed one. The names are matched as
/// substrings because the model field carries whatever the user downloaded
/// ("large-v3", "ggml-medium.en"), not a closed enum.
fn realtime_factor(model: &str) -> f64 {
    let model = model.trim().to_ascii_lowercase();
    if model.contains("large") {
        2.0
    } else if model.contains("medium") {
        1.0
    } else if model.contains("small") {
        0.5
    } else if model.contains("tiny") {
        0.15
    } else {
        // "base", and anything this build has not seen before.
        0.25
    }
}

/// What one capture may cost locally: bounded by how long the model takes to
/// decode it, never by an upload.
fn capture_limits(model: &str) -> ProviderCaptureLimits {
    let model = if model.trim().is_empty() {
        "base"
    } else {
        model.trim()
    };

    ProviderCaptureLimits {
        max_audio_bytes: None,
        realtime_factor: Some(realtime_factor(model)),
        detail: format!("how long {model} takes to decode on this machine"),
    }
}

fn provider_capabilities() -> ProviderCapabilities {
    ProviderCapabilities {
        transcription: true,
        chat_completion: true,
        // Kokoro-82M is the surveyed local voice and carries a Python runtime
        // this build does not host. No `VoiceProvider`, so no claim.
        speech_synthesis: false,
        local: true,
        requires_api_key: false,
        supports_prompt_bias: true,
        supports_language: true,
        supports_segments: false,
        model_management: true,
    }
}

/// What the local models do **on the path this runtime actually drives**.
///
/// whisper.cpp can stream — its `stream` example samples every ~0.5 s — and
/// sherpa-onnx ships online Parakeet models that both stream and report a
/// detected language. **None of that is what runs here.** This lane shells out
/// to `whisper-cli`, one file in and one transcript out, and the `language` on
/// the response is the one the request passed in, echoed back (see
/// `transcribe_audio_file` below). Both answers are therefore `Unsupported`,
/// and they are answers about this build rather than about whisper.cpp.
///
/// **F3 is the step that changes them**, by picking one of the four local
/// shapes (ADR 0096 step 3). When it lands, an online model and an offline one
/// will disagree on the same runtime — which is the local half of ADR 0110's
/// evidence, and the reason this answer takes a model at all today, when every
/// model on the lane still agrees.
fn model_capabilities(model: &str) -> ModelCapabilities {
    ModelCapabilities {
        model: normalize_local_model_name(model),
        transcription_streaming: ModelSupport::Unsupported,
        reports_detected_language: ModelSupport::Unsupported,
        synthesis_streaming: ModelSupport::Unsupported,
    }
}

/// **No profiles at all, and that is the answer B5 replaced four inventions
/// with** (ADR 0122).
///
/// This used to offer `base`, `small`, `medium` and `large-v3` whether or not a
/// single one of them was on the disk — four rows naming four files that may not
/// exist, which is the fake-readiness defect the runtime rules forbid, sitting
/// under the one lane whose whole difficulty is that its dependencies are the
/// user's problem. What a machine with nothing installed has is nothing
/// installed; the surface says *installable* about the catalogue's rows
/// (`core::model_install`), which is a different sentence and a true one.
fn fallback_provider_profiles() -> Vec<ProviderProfile> {
    Vec::new()
}

/// Where a recogniser may be found, ranked. Highest first.
///
/// **The rank decides which file *runs*; it does not decide which files are
/// *offered*** (ADR 0159). Those are two questions and B5 answered them with
/// one mechanism, which was a defect: `discover_local_provider_profiles`
/// returned on the first source that yielded, so a user with
/// `WORDSCRIPT_LOCAL_MODEL_DIR` set could install a model in the app and never
/// see it — the installed file was on the disk, resolvable, and invisible.
/// ADR 0122's guarantee was *an expert's checkout is never overridden*, and
/// overriding is a tie-break, not a reason to hide everything else.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum LocalModelSource {
    /// `WORDSCRIPT_LOCAL_MODEL_PATH` — one file, named exactly.
    ConfiguredFile(PathBuf),
    /// `WORDSCRIPT_LOCAL_MODEL_DIR` — the expert's own checkout.
    ConfiguredDir(PathBuf),
    /// A folder the user added on `AI Models` (ADR 0159). **Never written
    /// into**: a model on a home server or in somebody's own library is used
    /// where it lies, because the alternative is a second copy of a file that
    /// can be 1.6 GB.
    UserDir(PathBuf),
    /// What this build installed, under `core::paths::user_data_dir`.
    Managed(PathBuf),
}

impl LocalModelSource {
    /// The word the profile label carries, so a row says where its file is from.
    fn label(&self) -> &'static str {
        match self {
            Self::ConfiguredFile(_) => "configured file",
            Self::ConfiguredDir(_) => "discovered",
            Self::UserDir(_) => "your folder",
            Self::Managed(_) => "installed",
        }
    }

    /// The word the surface names this kind of source by. Separate from
    /// `label`, which goes into a profile label and reads as prose.
    pub(crate) fn kind_label(&self) -> &'static str {
        match self {
            Self::ConfiguredFile(_) => "environment file",
            Self::ConfiguredDir(_) => "environment folder",
            Self::UserDir(_) => "your folder",
            Self::Managed(_) => "managed by WordScript",
        }
    }

    /// Whether this surface may remove it. Only a folder added on this screen.
    pub(crate) fn is_user_dir(&self) -> bool {
        matches!(self, Self::UserDir(_))
    }

    pub(crate) fn dir(&self) -> Option<&Path> {
        match self {
            Self::ConfiguredFile(_) => None,
            Self::ConfiguredDir(path) | Self::UserDir(path) | Self::Managed(path) => Some(path),
        }
    }
}

/// Every place this build looks for a recogniser, highest rank first.
///
/// Built once per call rather than cached: a user adds a folder on a settings
/// screen and expects the next read to see it, and an env var can change under
/// a `tauri dev` restart. Reading four paths is not the cost worth a cache.
pub(crate) fn local_model_sources() -> Vec<LocalModelSource> {
    let mut sources = Vec::new();

    if let Ok(path) = std::env::var(LOCAL_MODEL_PATH_ENV) {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            let explicit = PathBuf::from(trimmed);
            if explicit.is_file() {
                sources.push(LocalModelSource::ConfiguredFile(explicit));
            }
        }
    }

    if let Ok(dir) = std::env::var(LOCAL_MODEL_DIR_ENV) {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            sources.push(LocalModelSource::ConfiguredDir(PathBuf::from(trimmed)));
        }
    }

    /* The user's own folders, in the order they added them. Read from the
       config rather than from an environment variable, because this is the one
       source a person sets from inside the application. */
    for dir in crate::core::config::AppConfig::load_from_disk().local_model_dirs {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            sources.push(LocalModelSource::UserDir(PathBuf::from(trimmed)));
        }
    }

    sources.push(LocalModelSource::Managed(
        crate::core::model_install::managed_speech_model_dir(),
    ));

    sources
}

/// Every model every source offers, unioned, with the highest-ranked source
/// winning a name that appears in two places.
///
/// **A duplicate is resolved, not listed twice.** Two folders holding
/// `ggml-small.bin` are one model on this machine as far as a picker is
/// concerned; which of the two files runs is the rank's answer, and the profile
/// label says which source won.
fn discover_local_provider_profiles() -> Option<Vec<ProviderProfile>> {
    let mut seen: Vec<(String, &'static str)> = Vec::new();

    for source in local_model_sources() {
        match &source {
            LocalModelSource::ConfiguredFile(path) => {
                if let Some(model) = local_model_name_from_path(path) {
                    if !seen.iter().any(|(name, _)| name == &model) {
                        seen.push((model, source.label()));
                    }
                }
            }
            _ => {
                let Some(dir) = source.dir() else { continue };
                for model in local_model_names_in_dir(dir) {
                    if !seen.iter().any(|(name, _)| name == &model) {
                        seen.push((model, source.label()));
                    }
                }
            }
        }
    }

    if seen.is_empty() {
        return None;
    }

    /* `base` is the default when it is present, and otherwise the first model
       the highest-ranked source offered — the rule that stood before the union
       and is unchanged by it. */
    let default_model = seen
        .iter()
        .find(|(name, _)| name == "base")
        .map(|(name, _)| name.clone())
        .unwrap_or_else(|| seen[0].0.clone());

    Some(
        seen.iter()
            .flat_map(|(model, label)| {
                build_local_provider_profiles(
                    model,
                    (model == &default_model).then_some(preferred_local_decode_preset(model)),
                    Some(label),
                )
            })
            .collect(),
    )
}

/// The `ggml-*.bin` stems one directory holds, sorted, or nothing.
pub(crate) fn local_model_names_in_dir(dir: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };

    let mut discovered = entries
        .filter_map(|entry| entry.ok().map(|value| value.path()))
        .filter_map(|path| local_model_name_from_path(&path))
        .collect::<Vec<_>>();

    discovered.sort();
    discovered.dedup();
    discovered
}

fn build_local_provider_profiles(
    model: &str,
    default_preset: Option<LocalDecodePreset>,
    source: Option<&str>,
) -> Vec<ProviderProfile> {
    [LocalDecodePreset::Fast, LocalDecodePreset::Quality]
        .into_iter()
        .map(|preset| {
            build_local_provider_profile(model, default_preset == Some(preset), source, preset)
        })
        .collect()
}

fn build_local_provider_profile(
    model: &str,
    default: bool,
    source: Option<&str>,
    preset: LocalDecodePreset,
) -> ProviderProfile {
    let normalized_model = normalize_local_model_name(model);
    let source_suffix = source
        .map(|value| format!(" ({})", value))
        .unwrap_or_else(|| " (external whisper-cli)".to_string());

    ProviderProfile {
        id: format!("local-{}-{}", normalized_model, preset.id_suffix()),
        provider: LOCAL_PROVIDER_ID.to_string(),
        mode: preset.mode(),
        model: normalized_model.clone(),
        label: format!(
            "Local runtime {} {} profile{}",
            normalized_model,
            preset.id_suffix(),
            source_suffix
        ),
        default,
        requires_api_key: false,
    }
}

fn preferred_local_decode_preset(model: &str) -> LocalDecodePreset {
    let normalized = normalize_local_model_name(model);

    if normalized.starts_with("tiny")
        || normalized.starts_with("base")
        || normalized.starts_with("small")
        || normalized.starts_with("distil-")
        || normalized.ends_with("-turbo")
    {
        LocalDecodePreset::Fast
    } else {
        LocalDecodePreset::Quality
    }
}

fn local_profile_selection_from_id(profile_id: &str) -> Option<LocalProfileSelection> {
    let normalized = profile_id.trim().to_ascii_lowercase();
    let rest = normalized.strip_prefix("local-")?;

    if let Some(model) = rest.strip_suffix("-fast") {
        return Some(LocalProfileSelection::new(model, LocalDecodePreset::Fast));
    }

    if let Some(model) = rest.strip_suffix("-quality") {
        return Some(LocalProfileSelection::new(
            model,
            LocalDecodePreset::Quality,
        ));
    }

    None
}

fn local_model_name_from_path(path: &Path) -> Option<String> {
    if !path.is_file() {
        return None;
    }

    let file_name = path.file_name()?.to_str()?.to_ascii_lowercase();
    if !file_name.ends_with(".bin") || !file_name.starts_with("ggml-") {
        return None;
    }

    let stem = file_name.strip_suffix(".bin")?;
    let model = stem.strip_prefix("ggml-")?;
    Some(model.to_string())
}

fn local_setup_message(model: &str) -> String {
    format!(
        "Local runtime requires whisper-cli plus a local STT model. Set {} to the binary or install whisper-cli in PATH, then point {} to a ggml model file or {} to a directory containing ggml-{}.bin.",
        LOCAL_WHISPER_BINARY_ENV,
        LOCAL_MODEL_PATH_ENV,
        LOCAL_MODEL_DIR_ENV,
        normalize_local_model_name(model),
    )
}

fn local_runtime_chat_setup_message(chat_model: &str) -> String {
    format!(
        "Local runtime AI cleanup requires a reachable Ollama endpoint and a pulled local model. Start Ollama at {} or set {} to another local endpoint, then pull '{}' or set {} to an installed local model.",
        DEFAULT_LOCAL_CHAT_BASE_URL,
        LOCAL_CHAT_BASE_URL_ENV,
        chat_model,
        LOCAL_CHAT_MODEL_ENV,
    )
}

fn inspect_local_setup(model: &str, correction_model: &str) -> LocalProviderSetupStatus {
    let runner = resolve_local_whisper_binary();
    let runner_probe = runner
        .as_ref()
        .ok()
        .and_then(|binary| probe_local_whisper_runner(binary).err());
    let model_path = resolve_local_model_path(model);
    let chat_runtime = inspect_local_chat_runtime(Some(correction_model));
    let runner_ready = runner.is_ok() && runner_probe.is_none();
    let model_ready = model_path.is_ok();
    let chat_ready = chat_runtime.is_ok();
    let issue_code = local_setup_issue_code(
        runner.as_ref().err(),
        runner_probe.as_ref(),
        model_path.as_ref().err(),
        chat_runtime.as_ref().err(),
    );
    let guidance = local_setup_guidance(
        model,
        correction_model,
        runner.as_ref().ok().map(String::as_str),
        runner.as_ref().err(),
        runner_probe.as_ref(),
        model_path.as_ref().err(),
        chat_runtime.as_ref().err(),
    );

    LocalProviderSetupStatus {
        readiness: if runner_ready && model_ready && chat_ready {
            LocalProviderReadiness::Ready
        } else {
            LocalProviderReadiness::SetupRequired
        },
        runner_ready,
        model_ready,
        chat_ready,
        issue_code,
        resolved_runner: runner.ok(),
        resolved_model: model_path.ok().map(|path| path.display().to_string()),
        resolved_chat_base_url: chat_runtime
            .as_ref()
            .ok()
            .map(|runtime| runtime.base_url.clone()),
        resolved_chat_model: chat_runtime
            .as_ref()
            .ok()
            .map(|runtime| runtime.model.clone()),
        available_chat_models: chat_runtime
            .as_ref()
            .ok()
            .map(|runtime| runtime.available_models.clone())
            .unwrap_or_default(),
        guidance,
    }
}

fn local_setup_issue_code(
    runner_issue: Option<&LocalRunnerResolutionError>,
    runner_probe_issue: Option<&LocalRunnerProbeError>,
    model_issue: Option<&LocalModelResolutionError>,
    chat_issue: Option<&LocalChatResolutionError>,
) -> Option<LocalProviderIssueCode> {
    match (runner_issue, runner_probe_issue, model_issue, chat_issue) {
        (
            Some(LocalRunnerResolutionError::MissingConfiguration),
            None,
            Some(LocalModelResolutionError::MissingConfiguration { .. }),
            _,
        ) => Some(LocalProviderIssueCode::MissingRunnerAndModel),
        (Some(issue), _, _, _) => Some(issue.issue_code()),
        (None, Some(issue), _, _) => Some(issue.issue_code()),
        (None, None, Some(issue), _) => Some(issue.issue_code()),
        (None, None, None, Some(issue)) => Some(issue.issue_code()),
        (None, None, None, None) => None,
    }
}

fn local_setup_guidance(
    model: &str,
    correction_model: &str,
    runner: Option<&str>,
    runner_issue: Option<&LocalRunnerResolutionError>,
    runner_probe_issue: Option<&LocalRunnerProbeError>,
    model_issue: Option<&LocalModelResolutionError>,
    chat_issue: Option<&LocalChatResolutionError>,
) -> String {
    match (runner_issue, runner_probe_issue, model_issue, chat_issue) {
        (
            Some(LocalRunnerResolutionError::MissingConfiguration),
            None,
            Some(LocalModelResolutionError::MissingConfiguration { .. }),
            Some(LocalChatResolutionError::MissingModel { .. }),
        ) => {
            format!(
                "{} {}",
                local_setup_message(model),
                local_runtime_chat_setup_message(correction_model),
            )
        }
        (
            Some(LocalRunnerResolutionError::MissingConfiguration),
            None,
            Some(LocalModelResolutionError::MissingConfiguration { .. }),
            _,
        ) => local_setup_message(model),
        (None, None, None, None) => {
            "Local runtime helper, STT model and AI cleanup model are ready.".to_string()
        }
        _ => [
            runner_issue.map(|issue| issue.guidance(model)),
            runner_probe_issue.map(|issue| issue.guidance(runner.unwrap_or("whisper-cli"))),
            model_issue.map(LocalModelResolutionError::guidance),
            chat_issue.map(LocalChatResolutionError::guidance),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(" "),
    }
}

fn normalize_transcription_stdout(stdout: &[u8]) -> String {
    String::from_utf8_lossy(stdout)
        .lines()
        .map(str::trim)
        .map(strip_whisper_segment_prefix)
        .filter(|line| !is_non_transcript_output(line))
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn strip_whisper_segment_prefix(line: &str) -> &str {
    if line.starts_with('[') && line.contains("-->") {
        if let Some(index) = line.find(']') {
            return line[index + 1..].trim();
        }
    }

    line
}

fn is_non_transcript_output(line: &str) -> bool {
    let lower = line.trim().to_ascii_lowercase();

    lower.starts_with("main:")
        || lower.starts_with("whisper_")
        || lower.starts_with("system_info:")
        || lower.starts_with("output_")
        || lower.starts_with("sampling parameters:")
        || lower.starts_with("n_threads =")
        || lower.starts_with("n_processors =")
}

fn resolve_local_whisper_binary() -> Result<String, LocalRunnerResolutionError> {
    if let Ok(value) = std::env::var(LOCAL_WHISPER_BINARY_ENV) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            if local_binary_exists(trimmed) {
                return Ok(trimmed.to_string());
            }

            return Err(LocalRunnerResolutionError::InvalidPath {
                path: trimmed.to_string(),
            });
        }
    }

    if command_in_path("whisper-cli") {
        return Ok("whisper-cli".to_string());
    }

    Err(LocalRunnerResolutionError::MissingConfiguration)
}

/// Which hallucination controls the installed whisper-cli understands.
///
/// whisper.cpp gained these flags at different times and distributions ship
/// different builds, so every one of them is optional. A missing flag is
/// logged and skipped, never an error: a slightly less defended local lane
/// beats a local lane that refuses to run.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct WhisperCliCapabilities {
    pub supports_max_context: bool,
    pub supports_logprob_thold: bool,
    pub supports_no_speech_thold: bool,
    pub supports_vad: bool,
}

fn parse_whisper_cli_capabilities(help_text: &str) -> WhisperCliCapabilities {
    let lower = help_text.to_ascii_lowercase();
    WhisperCliCapabilities {
        supports_max_context: lower.contains("--max-context"),
        supports_logprob_thold: lower.contains("--logprob-thold"),
        supports_no_speech_thold: lower.contains("--no-speech-thold"),
        supports_vad: lower.contains("--vad"),
    }
}

fn probe_local_whisper_runner(
    binary: &str,
) -> Result<WhisperCliCapabilities, LocalRunnerProbeError> {
    let mut child = BlockingCommand::new(binary)
        .arg("--help")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| LocalRunnerProbeError::LaunchFailed {
            message: error.to_string(),
        })?;

    let started_at = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                let output = child.wait_with_output().map_err(|error| {
                    LocalRunnerProbeError::LaunchFailed {
                        message: error.to_string(),
                    }
                })?;
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let combined = format!("{}\n{}", stdout, stderr);
                let lower = combined.to_ascii_lowercase();
                let looks_like_whisper = lower.contains("whisper");

                if looks_like_whisper {
                    return Ok(parse_whisper_cli_capabilities(&combined));
                }

                return Err(LocalRunnerProbeError::Failed {
                    status: output.status.code(),
                    output: truncate_probe_output(&combined),
                });
            }
            Ok(None) => {
                if started_at.elapsed() >= Duration::from_millis(LOCAL_RUNNER_PROBE_TIMEOUT_MS) {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(LocalRunnerProbeError::TimedOut {
                        timeout_ms: LOCAL_RUNNER_PROBE_TIMEOUT_MS,
                    });
                }

                std::thread::sleep(Duration::from_millis(20));
            }
            Err(error) => {
                return Err(LocalRunnerProbeError::LaunchFailed {
                    message: error.to_string(),
                });
            }
        }
    }
}

fn truncate_probe_output(output: &str) -> String {
    let trimmed = output.trim();
    if trimmed.is_empty() {
        return "The runner returned no help output.".to_string();
    }

    const MAX_LEN: usize = 160;
    if trimmed.len() <= MAX_LEN {
        return trimmed.to_string();
    }

    format!("{}...", &trimmed[..MAX_LEN])
}

fn resolve_local_model_path(model: &str) -> Result<PathBuf, LocalModelResolutionError> {
    let requested = model.trim();
    if requested.is_empty() {
        return resolve_local_model_path("base");
    }

    if requested.contains('/') || requested.contains('\\') || requested.ends_with(".bin") {
        let explicit_path = PathBuf::from(requested);
        if explicit_path.is_dir() {
            return find_local_model_path_in_dir(&explicit_path, requested);
        }

        return validate_local_model_path(explicit_path);
    }

    /* THE RANK, AND IT IS WHERE PRECEDENCE LIVES (ADR 0159).
       The library above unions every source so a person sees what they have;
       this walks them in order so exactly one file runs, and the first source
       that can answer is the answer. ADR 0122's guarantee is here rather than
       in the listing: an expert's checkout still wins, it just no longer hides
       everything else.

       **The env file keeps its old oddity on purpose**: `WORDSCRIPT_LOCAL_MODEL_PATH`
       pointing at a directory is treated as a directory, which is what it did
       before this step and what somebody's setup may rely on. */
    /* **The first source that can answer wins; the first source that FAILED
       owns the error.** Both halves matter. Falling through means an installed
       model is reachable even when an environment variable is set, which is the
       defect this step exists to remove. Keeping the highest-ranked failure as
       the message means somebody who pointed WordScript at a checkout and
       mistyped the model name still gets told about their checkout, rather than
       a generic *nothing is configured* from the bottom of the list. */
    let mut first_failure: Option<LocalModelResolutionError> = None;

    for source in local_model_sources() {
        let attempt = match &source {
            LocalModelSource::ConfiguredFile(explicit) => {
                if explicit.is_dir() {
                    find_local_model_path_in_dir(explicit, requested)
                } else {
                    validate_local_model_path(explicit.clone())
                }
            }
            LocalModelSource::ConfiguredDir(dir)
            | LocalModelSource::UserDir(dir)
            | LocalModelSource::Managed(dir) => find_local_model_path_in_dir(dir, requested),
        };

        match attempt {
            Ok(path) => return Ok(path),
            Err(error) => {
                if first_failure.is_none() {
                    /* The managed directory is not an ERROR anyone should hear
                       about: a machine that has installed nothing has an absent
                       folder, and *nothing is configured* is the truer sentence
                       than *not found in a directory you have never seen*. */
                    if !matches!(source, LocalModelSource::Managed(_)) {
                        first_failure = Some(error);
                    }
                }
            }
        }
    }

    if let Some(error) = first_failure {
        return Err(error);
    }

    Err(LocalModelResolutionError::MissingConfiguration {
        requested: requested.to_string(),
    })
}

fn find_local_model_path_in_dir(
    dir: &Path,
    requested: &str,
) -> Result<PathBuf, LocalModelResolutionError> {
    let normalized = normalize_local_model_name(requested);
    let preferred_files = [
        format!("ggml-{}.bin", normalized),
        format!("ggml-{}.en.bin", normalized),
    ];

    for file_name in preferred_files {
        let candidate = dir.join(file_name);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    let mut matches = std::fs::read_dir(dir)
        .map_err(|error| LocalModelResolutionError::UnreadableDirectory {
            dir: dir.to_path_buf(),
            error: error.to_string(),
        })?
        .filter_map(|entry| entry.ok().map(|value| value.path()))
        .filter(|path| path.is_file())
        .filter(|path| {
            path.extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("bin"))
        })
        .filter(|path| local_model_filename_matches(path, &normalized))
        .collect::<Vec<_>>();

    matches.sort();
    if let Some(path) = matches.into_iter().next() {
        return Ok(path);
    }

    Err(LocalModelResolutionError::ModelNotFound {
        dir: dir.to_path_buf(),
        requested: normalized,
    })
}

fn local_model_filename_matches(path: &Path, normalized_model: &str) -> bool {
    let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };

    let lower = file_name.to_ascii_lowercase();
    let exact = format!("ggml-{}.bin", normalized_model);
    let english = format!("ggml-{}.en.bin", normalized_model);
    let dashed_prefix = format!("ggml-{}-", normalized_model);
    let dotted_prefix = format!("ggml-{}.", normalized_model);

    lower == exact
        || lower == english
        || (lower.starts_with(&dashed_prefix) && lower.ends_with(".bin"))
        || (lower.starts_with(&dotted_prefix) && lower.ends_with(".bin"))
}

fn validate_local_model_path(path: PathBuf) -> Result<PathBuf, LocalModelResolutionError> {
    if path.is_file() {
        return Ok(path);
    }

    Err(LocalModelResolutionError::InvalidPath { path })
}

/// The process-wide lock every test that moves this module's environment
/// variables takes.
///
/// **At module level rather than inside `mod tests`, because a second module's
/// tests need it too.** `core::model_install`'s acceptance test clears both
/// variables to prove an installed model is found without them, and a test
/// running beside it that sets one would make that proof read as a pass on
/// somebody else's directory.
#[cfg(test)]
pub(crate) fn test_env_lock() -> std::sync::MutexGuard<'static, ()> {
    use std::sync::{Mutex, OnceLock};

    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poison| poison.into_inner())
}

/// What the surface would be offered, for a test in another module. The
/// discovery is private and stays private; this is the one reader.
#[cfg(test)]
pub(crate) fn provider_profiles_for_test() -> Vec<ProviderProfile> {
    provider_profiles()
}

/// Where the decode path would look, for the same reason. Discovery finding a
/// model this cannot resolve is the half that makes an install worthless, so a
/// test proving the install has to be able to ask both.
#[cfg(test)]
pub(crate) fn resolve_local_model_path_for_test(model: &str) -> Option<PathBuf> {
    resolve_local_model_path(model).ok()
}

/// The stem a config value names, normalized — `core::model_install`'s way of
/// asking whether a profile runs the model it is about to remove.
///
/// A thin re-export rather than a second normalizer, because `large`,
/// `large_v3` and `large-v3` are one model and the rule that says so lives
/// below. Two spellings of that rule is how a removal refusal would start
/// disagreeing with the decode path about what is in use.
pub(crate) fn normalized_local_model_name(model: &str) -> String {
    normalize_local_model_name(model)
}

/// Which endpoint the language half talks to, or why it cannot be resolved.
///
/// `core::model_install` needs the same answer this module's own chat path
/// resolves, and resolving it twice is how the installer would start pulling
/// into a server the pipeline does not use.
pub(crate) fn local_chat_base_url() -> Result<String, String> {
    resolve_local_chat_base_url().map_err(|error| error.guidance())
}

/// The same endpoint, for a surface that only states it. An unresolvable value
/// answers the configured default rather than an error, because a card printing
/// *where the server would be* is not the place a URL parse failure belongs —
/// `local_chat_base_url` is, and that is what the install path calls.
pub(crate) fn local_chat_base_url_for_display() -> String {
    resolve_local_chat_base_url().unwrap_or_else(|_| DEFAULT_LOCAL_CHAT_BASE_URL.to_string())
}

/// Which tags the local model server currently has, or why it could not be
/// asked.
///
/// **Already in the tree, which is the overlap B4 and B5 meet on.**
/// `fetch_local_chat_models_blocking` is the Ollama listing B4 would have added
/// for this lane; what the language half of B5 adds on top of it is the pull,
/// not the list.
pub(crate) fn installed_local_chat_tags() -> Result<Vec<String>, String> {
    let base_url = resolve_local_chat_base_url().map_err(|error| error.guidance())?;
    fetch_local_chat_models_blocking(&base_url).map_err(|error| error.guidance())
}

fn normalize_local_model_name(model: &str) -> String {
    let normalized = model.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "" => "base".to_string(),
        "large" => "large-v3".to_string(),
        "large_v3" => "large-v3".to_string(),
        other => other.to_string(),
    }
}

fn command_in_path(program: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|path| {
                let candidate = path.join(program);
                candidate.is_file() && is_executable(&candidate)
            })
        })
        .unwrap_or(false)
}

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        return std::fs::metadata(path)
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false);
    }

    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

fn local_binary_exists(program: &str) -> bool {
    let candidate = PathBuf::from(program);
    if candidate.components().count() > 1 || candidate.is_absolute() {
        return candidate.is_file() && is_executable(&candidate);
    }

    command_in_path(program)
}

fn resolve_local_chat_model_name(model: Option<&str>) -> String {
    model
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            std::env::var(LOCAL_CHAT_MODEL_ENV)
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| model_catalogue::model_id(LOCAL_CHAT_DEFAULT_ROW).to_string())
}

fn resolve_local_chat_base_url() -> Result<String, LocalChatResolutionError> {
    let raw = std::env::var(LOCAL_CHAT_BASE_URL_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_LOCAL_CHAT_BASE_URL.to_string());
    let normalized = raw.trim_end_matches('/').to_string();

    Url::parse(&normalized)
        .map(|_| normalized)
        .map_err(|_| LocalChatResolutionError::InvalidBaseUrl { url: raw })
}

fn inspect_local_chat_runtime(
    requested_model: Option<&str>,
) -> Result<LocalChatRuntime, LocalChatResolutionError> {
    let base_url = resolve_local_chat_base_url()?;
    let requested_model = resolve_local_chat_model_name(requested_model);
    let available_models = fetch_local_chat_models_blocking(&base_url)?;
    let model = resolve_local_chat_model(&requested_model, &available_models, &base_url)?;

    Ok(LocalChatRuntime {
        base_url,
        model,
        available_models,
    })
}

async fn inspect_local_chat_runtime_async(
    requested_model: Option<&str>,
    timeout_ms: u64,
) -> Result<LocalChatRuntime, LocalChatResolutionError> {
    let base_url = resolve_local_chat_base_url()?;
    let requested_model = resolve_local_chat_model_name(requested_model);
    let available_models = fetch_local_chat_models_async(&base_url, timeout_ms).await?;
    let model = resolve_local_chat_model(&requested_model, &available_models, &base_url)?;

    Ok(LocalChatRuntime {
        base_url,
        model,
        available_models,
    })
}

fn resolve_local_chat_model(
    requested_model: &str,
    available_models: &[String],
    base_url: &str,
) -> Result<String, LocalChatResolutionError> {
    if available_models.is_empty() {
        return Err(LocalChatResolutionError::MissingModel {
            base_url: base_url.to_string(),
            requested: requested_model.to_string(),
        });
    }

    if available_models
        .iter()
        .any(|model| model == requested_model)
    {
        return Ok(requested_model.to_string());
    }

    Err(LocalChatResolutionError::ModelNotFound {
        base_url: base_url.to_string(),
        requested: requested_model.to_string(),
        available: available_models.to_vec(),
    })
}

fn fetch_local_chat_models_blocking(
    base_url: &str,
) -> Result<Vec<String>, LocalChatResolutionError> {
    let http = BlockingClient::builder()
        .timeout(Duration::from_millis(LOCAL_CHAT_PROBE_TIMEOUT_MS))
        .connect_timeout(Duration::from_millis(750))
        .build()
        .map_err(|error| LocalChatResolutionError::BackendUnavailable {
            base_url: base_url.to_string(),
            message: error.to_string(),
        })?;
    let response = http
        .get(format!("{}/api/tags", base_url))
        .send()
        .map_err(|error| LocalChatResolutionError::BackendUnavailable {
            base_url: base_url.to_string(),
            message: error.to_string(),
        })?;

    if !response.status().is_success() {
        return Err(LocalChatResolutionError::BackendUnavailable {
            base_url: base_url.to_string(),
            message: format!("GET /api/tags returned HTTP {}", response.status()),
        });
    }

    let payload = response.json::<OllamaTagsResponse>().map_err(|error| {
        LocalChatResolutionError::BackendUnavailable {
            base_url: base_url.to_string(),
            message: format!("Could not parse /api/tags response: {error}"),
        }
    })?;

    Ok(normalize_available_local_chat_models(payload.models))
}

async fn fetch_local_chat_models_async(
    base_url: &str,
    timeout_ms: u64,
) -> Result<Vec<String>, LocalChatResolutionError> {
    let http = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms.max(5_000)))
        .connect_timeout(Duration::from_millis(1_500))
        .build()
        .map_err(|error| LocalChatResolutionError::BackendUnavailable {
            base_url: base_url.to_string(),
            message: error.to_string(),
        })?;
    let response = http
        .get(format!("{}/api/tags", base_url))
        .send()
        .await
        .map_err(|error| LocalChatResolutionError::BackendUnavailable {
            base_url: base_url.to_string(),
            message: error.to_string(),
        })?;

    if !response.status().is_success() {
        return Err(LocalChatResolutionError::BackendUnavailable {
            base_url: base_url.to_string(),
            message: format!("GET /api/tags returned HTTP {}", response.status()),
        });
    }

    let payload = response
        .json::<OllamaTagsResponse>()
        .await
        .map_err(|error| LocalChatResolutionError::BackendUnavailable {
            base_url: base_url.to_string(),
            message: format!("Could not parse /api/tags response: {error}"),
        })?;

    Ok(normalize_available_local_chat_models(payload.models))
}

fn normalize_available_local_chat_models(models: Vec<OllamaModelDescriptor>) -> Vec<String> {
    let mut available = models
        .into_iter()
        .flat_map(|descriptor| [descriptor.name, descriptor.model])
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    available.sort();
    available.dedup();
    available
}

#[derive(Debug, Clone)]
enum LocalRunnerResolutionError {
    MissingConfiguration,
    InvalidPath { path: String },
}

impl LocalRunnerResolutionError {
    fn issue_code(&self) -> LocalProviderIssueCode {
        match self {
            Self::MissingConfiguration => LocalProviderIssueCode::MissingRunner,
            Self::InvalidPath { .. } => LocalProviderIssueCode::InvalidRunnerPath,
        }
    }

    fn guidance(&self, model: &str) -> String {
        match self {
            Self::MissingConfiguration => local_setup_message(model),
            Self::InvalidPath { path } => format!(
                "Local runtime runner was not found at '{}'. Set {} to a valid whisper-cli binary or install whisper-cli in PATH.",
                path, LOCAL_WHISPER_BINARY_ENV,
            ),
        }
    }
}

#[derive(Debug, Clone)]
enum LocalRunnerProbeError {
    LaunchFailed { message: String },
    Failed { status: Option<i32>, output: String },
    TimedOut { timeout_ms: u64 },
}

impl LocalRunnerProbeError {
    fn issue_code(&self) -> LocalProviderIssueCode {
        match self {
            Self::LaunchFailed { .. } | Self::Failed { .. } => {
                LocalProviderIssueCode::RunnerProbeFailed
            }
            Self::TimedOut { .. } => LocalProviderIssueCode::RunnerProbeTimedOut,
        }
    }

    fn guidance(&self, binary: &str) -> String {
        match self {
            Self::LaunchFailed { message } => format!(
                "Local runtime runner '{}' could not complete the health probe. WordScript tried '{} --help' and failed to launch it cleanly: {}",
                binary, binary, message,
            ),
            Self::Failed { status, output } => format!(
                "Local runtime runner '{}' did not answer the health probe cleanly. WordScript tried '{} --help' and got status {}. {}",
                binary,
                binary,
                status
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "unknown".to_string()),
                output,
            ),
            Self::TimedOut { timeout_ms } => format!(
                "Local runtime runner '{}' did not answer the health probe within {} ms. WordScript tried '{} --help' and stopped waiting.",
                binary, timeout_ms, binary,
            ),
        }
    }
}

#[derive(Debug, Clone)]
enum LocalModelResolutionError {
    MissingConfiguration { requested: String },
    InvalidPath { path: PathBuf },
    UnreadableDirectory { dir: PathBuf, error: String },
    ModelNotFound { dir: PathBuf, requested: String },
}

impl LocalModelResolutionError {
    fn issue_code(&self) -> LocalProviderIssueCode {
        match self {
            Self::MissingConfiguration { .. } => LocalProviderIssueCode::MissingModel,
            Self::InvalidPath { .. } => LocalProviderIssueCode::InvalidModelPath,
            Self::UnreadableDirectory { .. } => LocalProviderIssueCode::UnreadableModelDirectory,
            Self::ModelNotFound { .. } => LocalProviderIssueCode::ModelNotFound,
        }
    }

    fn guidance(&self) -> String {
        match self {
            Self::MissingConfiguration { requested } => local_setup_message(requested),
            Self::InvalidPath { path } => format!(
                "Local runtime model file was not found at {}. Set {} to a valid ggml model file or {} to a directory containing the requested model.",
                path.display(),
                LOCAL_MODEL_PATH_ENV,
                LOCAL_MODEL_DIR_ENV,
            ),
            Self::UnreadableDirectory { dir, error } => format!(
                "Could not read local runtime model directory {}: {}",
                dir.display(),
                error,
            ),
            Self::ModelNotFound { dir, requested } => format!(
                "Local runtime model file was not found in {} for '{}'. Set {} to a valid ggml model file or {} to a directory containing the requested model.",
                dir.display(),
                requested,
                LOCAL_MODEL_PATH_ENV,
                LOCAL_MODEL_DIR_ENV,
            ),
        }
    }
}

#[derive(Debug, Clone)]
enum LocalChatResolutionError {
    InvalidBaseUrl {
        url: String,
    },
    BackendUnavailable {
        base_url: String,
        message: String,
    },
    MissingModel {
        base_url: String,
        requested: String,
    },
    ModelNotFound {
        base_url: String,
        requested: String,
        available: Vec<String>,
    },
}

impl LocalChatResolutionError {
    fn issue_code(&self) -> LocalProviderIssueCode {
        match self {
            Self::InvalidBaseUrl { .. } => LocalProviderIssueCode::InvalidChatEndpoint,
            Self::BackendUnavailable { .. } => LocalProviderIssueCode::ChatBackendUnavailable,
            Self::MissingModel { .. } => LocalProviderIssueCode::MissingChatModel,
            Self::ModelNotFound { .. } => LocalProviderIssueCode::ChatModelNotFound,
        }
    }

    fn guidance(&self) -> String {
        match self {
            Self::InvalidBaseUrl { url } => format!(
                "Local runtime chat endpoint '{}' is invalid. Set {} to a valid Ollama URL such as {}.",
                url, LOCAL_CHAT_BASE_URL_ENV, DEFAULT_LOCAL_CHAT_BASE_URL,
            ),
            Self::BackendUnavailable { base_url, message } => format!(
                "Local runtime AI cleanup backend at '{}' is unavailable. WordScript could not read {}/api/tags: {} Start Ollama or point {} to a reachable local endpoint.",
                base_url, base_url, message, LOCAL_CHAT_BASE_URL_ENV,
            ),
            Self::MissingModel { base_url, requested } => format!(
                "Local runtime AI cleanup backend at '{}' is reachable, but no local chat models are installed. Pull '{}' with 'ollama pull {}' or set {} to an installed model.",
                base_url, requested, requested, LOCAL_CHAT_MODEL_ENV,
            ),
            Self::ModelNotFound {
                base_url,
                requested,
                available,
            } => format!(
                "Local runtime chat model '{}' is not installed at '{}'. Available models: {}. Pull '{}' with 'ollama pull {}' or choose one of the installed models.",
                requested,
                base_url,
                available.join(", "),
                requested,
                requested,
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;

    /// One lock for the whole process, shared with `core::model_install`'s
    /// acceptance test — see `super::test_env_lock`.
    fn lock_env() -> std::sync::MutexGuard<'static, ()> {
        super::test_env_lock()
    }

    struct EnvGuard {
        saved: Vec<(&'static str, Option<OsString>)>,
    }

    impl EnvGuard {
        fn capture(keys: &[&'static str]) -> Self {
            Self {
                saved: keys
                    .iter()
                    .map(|key| (*key, std::env::var_os(key)))
                    .collect(),
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            for (key, value) in &self.saved {
                match value {
                    Some(value) => std::env::set_var(key, value),
                    None => std::env::remove_var(key),
                }
            }
        }
    }

    #[test]
    fn normalizes_local_model_aliases() {
        assert_eq!(normalize_local_model_name("base"), "base");
        assert_eq!(normalize_local_model_name("large"), "large-v3");
        assert_eq!(normalize_local_model_name("large_v3"), "large-v3");
        assert_eq!(normalize_local_model_name("large-v3-q5_0"), "large-v3-q5_0");
    }

    #[test]
    fn classifies_local_profiles_into_fast_vs_quality_modes() {
        assert_eq!(
            preferred_local_decode_preset("base"),
            LocalDecodePreset::Fast
        );
        assert_eq!(
            preferred_local_decode_preset("small"),
            LocalDecodePreset::Fast
        );
        assert_eq!(
            preferred_local_decode_preset("distil-whisper-large-v3-en"),
            LocalDecodePreset::Fast
        );
        assert_eq!(
            preferred_local_decode_preset("large-v3-turbo"),
            LocalDecodePreset::Fast
        );
        assert_eq!(
            preferred_local_decode_preset("medium"),
            LocalDecodePreset::Quality
        );
        assert_eq!(
            preferred_local_decode_preset("large-v3-q5_0"),
            LocalDecodePreset::Quality
        );
    }

    #[test]
    fn parses_local_profile_ids_into_model_and_preset() {
        assert_eq!(
            local_profile_selection_from_id("local-medium-quality"),
            Some(LocalProfileSelection::new(
                "medium",
                LocalDecodePreset::Quality,
            ))
        );
        assert_eq!(
            local_profile_selection_from_id("local-base-fast"),
            Some(LocalProfileSelection::new("base", LocalDecodePreset::Fast))
        );
    }

    const HELP_WITH_EVERY_CONTROL: &str = "usage: whisper-cli [options]\n  --max-context N\n  --logprob-thold N\n  --no-speech-thold N\n  --vad\n  --vad-model FNAME\n";
    const HELP_WITHOUT_CONTROLS: &str = "usage: whisper-cli [options]\n  -m FNAME\n  -f FNAME\n";

    #[test]
    fn builds_whisper_cli_args_with_language_and_prompt_bias() {
        let args = whisper_cli_args(
            "/tmp/test.wav",
            Path::new("/models/ggml-medium.bin"),
            Some("de"),
            Some("Customer success standup and roadmap items"),
            true,
            5,
            5,
            &WhisperCliCapabilities::default(),
            None,
        );

        assert_eq!(
            args,
            vec![
                "-m".to_string(),
                "/models/ggml-medium.bin".to_string(),
                "-f".to_string(),
                "/tmp/test.wav".to_string(),
                "-nt".to_string(),
                "-np".to_string(),
                "-bs".to_string(),
                "5".to_string(),
                "-bo".to_string(),
                "5".to_string(),
                "-l".to_string(),
                "de".to_string(),
                "--prompt".to_string(),
                "Customer success standup and roadmap items".to_string(),
                "--carry-initial-prompt".to_string(),
            ]
        );
    }

    #[test]
    fn keeps_explicit_decode_controls_when_request_overrides_profile_defaults() {
        let args = whisper_cli_args(
            "/tmp/test.wav",
            Path::new("/models/ggml-base.bin"),
            None,
            None,
            false,
            3,
            6,
            &WhisperCliCapabilities::default(),
            None,
        );

        assert_eq!(args[6], "-bs");
        assert_eq!(args[7], "3");
        assert_eq!(args[8], "-bo");
        assert_eq!(args[9], "6");
    }

    #[test]
    fn capabilities_are_read_from_the_existing_help_probe() {
        let full = parse_whisper_cli_capabilities(HELP_WITH_EVERY_CONTROL);
        assert!(full.supports_max_context);
        assert!(full.supports_logprob_thold);
        assert!(full.supports_no_speech_thold);
        assert!(full.supports_vad);

        let bare = parse_whisper_cli_capabilities(HELP_WITHOUT_CONTROLS);
        assert_eq!(bare, WhisperCliCapabilities::default());
    }

    #[test]
    fn supported_hallucination_controls_are_passed_through() {
        let args = whisper_cli_args(
            "/tmp/test.wav",
            Path::new("/models/ggml-base.bin"),
            None,
            None,
            false,
            1,
            1,
            &parse_whisper_cli_capabilities(HELP_WITH_EVERY_CONTROL),
            Some(Path::new("/models/silero-vad.bin")),
        );

        let joined = args.join(" ");
        assert!(joined.contains("--max-context 0"));
        assert!(joined.contains("--logprob-thold -1"));
        assert!(joined.contains("--no-speech-thold 0.6"));
        assert!(joined.contains("--vad-model /models/silero-vad.bin"));
        assert!(joined.contains("--vad-min-speech-duration-ms 250"));
    }

    #[test]
    fn an_older_whisper_cli_degrades_instead_of_failing() {
        let args = whisper_cli_args(
            "/tmp/test.wav",
            Path::new("/models/ggml-base.bin"),
            None,
            None,
            false,
            1,
            1,
            &parse_whisper_cli_capabilities(HELP_WITHOUT_CONTROLS),
            Some(Path::new("/models/silero-vad.bin")),
        );

        let joined = args.join(" ");
        assert!(!joined.contains("--max-context"));
        assert!(!joined.contains("--logprob-thold"));
        assert!(!joined.contains("--no-speech-thold"));
        assert!(!joined.contains("--vad"));
        // The base invocation must still be complete and runnable.
        assert!(joined.contains("-m /models/ggml-base.bin"));
        assert!(joined.contains("-f /tmp/test.wav"));
    }

    #[test]
    fn vad_stays_off_without_a_model_even_when_supported() {
        let args = whisper_cli_args(
            "/tmp/test.wav",
            Path::new("/models/ggml-base.bin"),
            None,
            None,
            false,
            1,
            1,
            &parse_whisper_cli_capabilities(HELP_WITH_EVERY_CONTROL),
            None,
        );

        assert!(!args.join(" ").contains("--vad"));
    }

    #[test]
    fn normalizes_whisper_cli_segment_output() {
        let stdout = br#"
main: processing '/tmp/test.wav' (16000 samples)
[00:00:00.000 --> 00:00:01.200]  hello world
[00:00:01.200 --> 00:00:02.000]  from wordscript
whisper_print_timings: total time = 1337.00 ms
        "#;

        assert_eq!(
            normalize_transcription_stdout(stdout),
            "hello world from wordscript"
        );
    }

    #[test]
    fn finds_quantized_model_variants_in_directory() {
        let dir = std::env::temp_dir().join("wordscript-local-models");
        let _ = std::fs::create_dir_all(&dir);
        let quantized = dir.join("ggml-large-v3-q5_0.bin");
        std::fs::write(&quantized, "model").expect("write model file");

        let resolved = find_local_model_path_in_dir(&dir, "large-v3")
            .expect("resolve quantized model variant");

        assert_eq!(resolved, quantized);
    }

    #[test]
    fn local_status_is_not_configured_without_runner_or_model() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[
            LOCAL_WHISPER_BINARY_ENV,
            LOCAL_MODEL_PATH_ENV,
            LOCAL_MODEL_DIR_ENV,
            "PATH",
        ]);
        std::env::remove_var(LOCAL_WHISPER_BINARY_ENV);
        std::env::remove_var(LOCAL_MODEL_PATH_ENV);
        std::env::remove_var(LOCAL_MODEL_DIR_ENV);
        std::env::set_var("PATH", "");

        let status = provider_status(None, None).expect("local runtime status");

        assert_eq!(status.provider, LOCAL_PROVIDER_ID);
        assert!(!status.credential.configured);
        assert_eq!(
            status
                .local_setup
                .as_ref()
                .and_then(|setup| setup.issue_code.clone()),
            Some(LocalProviderIssueCode::MissingRunnerAndModel)
        );
        assert!(status
            .local_setup
            .as_ref()
            .is_some_and(|setup| !setup.runner_ready && !setup.model_ready));
    }

    #[test]
    fn local_status_flags_invalid_runner_path_even_when_model_exists() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[
            LOCAL_WHISPER_BINARY_ENV,
            LOCAL_MODEL_PATH_ENV,
            LOCAL_MODEL_DIR_ENV,
            "PATH",
        ]);
        let model_path = std::env::temp_dir().join("wordscript-local-base.bin");
        std::fs::write(&model_path, "model").expect("write model file");
        std::env::set_var(
            LOCAL_WHISPER_BINARY_ENV,
            "/tmp/wordscript-missing-whisper-cli",
        );
        std::env::set_var(LOCAL_MODEL_PATH_ENV, &model_path);
        std::env::remove_var(LOCAL_MODEL_DIR_ENV);
        std::env::set_var("PATH", "");

        let status = provider_status(None, None).expect("local runtime status");

        assert!(!status.credential.configured);
        assert_eq!(
            status
                .local_setup
                .as_ref()
                .and_then(|setup| setup.issue_code.clone()),
            Some(LocalProviderIssueCode::InvalidRunnerPath)
        );
        assert!(status
            .local_setup
            .as_ref()
            .is_some_and(|setup| !setup.runner_ready && setup.model_ready));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn local_status_flags_runner_probe_failure_for_non_whisper_executable() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[
            LOCAL_WHISPER_BINARY_ENV,
            LOCAL_MODEL_PATH_ENV,
            LOCAL_MODEL_DIR_ENV,
        ]);
        let model_path = std::env::temp_dir().join("wordscript-local-health-model.bin");
        std::fs::write(&model_path, "model").expect("write model file");
        std::env::set_var(LOCAL_WHISPER_BINARY_ENV, "/bin/true");
        std::env::set_var(LOCAL_MODEL_PATH_ENV, &model_path);
        std::env::remove_var(LOCAL_MODEL_DIR_ENV);

        let status = provider_status(None, None).expect("local runtime status");

        assert!(!status.credential.configured);
        assert_eq!(
            status
                .local_setup
                .as_ref()
                .and_then(|setup| setup.issue_code.clone()),
            Some(LocalProviderIssueCode::RunnerProbeFailed)
        );
        assert_eq!(
            status
                .local_setup
                .as_ref()
                .and_then(|setup| setup.resolved_runner.as_deref()),
            Some("/bin/true")
        );
    }

    #[cfg(unix)]
    #[test]
    fn local_status_flags_runner_probe_timeout() {
        use std::os::unix::fs::PermissionsExt;

        let _lock = lock_env();
        let _env = EnvGuard::capture(&[
            LOCAL_WHISPER_BINARY_ENV,
            LOCAL_MODEL_PATH_ENV,
            LOCAL_MODEL_DIR_ENV,
        ]);
        let script_path = std::env::temp_dir().join("wordscript-local-timeout.sh");
        let model_path = std::env::temp_dir().join("wordscript-local-timeout-model.bin");
        std::fs::write(&script_path, "#!/bin/sh\nsleep 2\n").expect("write script");
        let mut perms = std::fs::metadata(&script_path)
            .expect("script metadata")
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&script_path, perms).expect("chmod script");
        std::fs::write(&model_path, "model").expect("write model file");
        std::env::set_var(LOCAL_WHISPER_BINARY_ENV, &script_path);
        std::env::set_var(LOCAL_MODEL_PATH_ENV, &model_path);
        std::env::remove_var(LOCAL_MODEL_DIR_ENV);

        let status = provider_status(None, None).expect("local runtime status");

        assert_eq!(
            status
                .local_setup
                .as_ref()
                .and_then(|setup| setup.issue_code.clone()),
            Some(LocalProviderIssueCode::RunnerProbeTimedOut)
        );
    }

    /// **This lane has no credential, and that is not the same as missing
    /// one.** `kind: None` says there is nothing to authenticate against; what
    /// stands in its place is the runtime being installed, so a role that
    /// cannot run names the setup guidance where a missing key would be named.
    #[test]
    fn the_local_lane_answers_no_credential_kind_and_names_its_setup_instead() {
        let entry = crate::core::providers::registry::resolve_entry(LOCAL_PROVIDER_ID)
            .expect("local entry");
        assert_eq!(entry.roles(), LOCAL_CREDENTIAL_ROLES.to_vec());
        assert!(
            entry.provider.credential_kinds().is_empty(),
            "a lane that authenticates against nothing accepts no kind",
        );

        let missing = role_credential_status(
            ProviderRole::Speech,
            &LocalProviderSetupStatus {
                readiness: LocalProviderReadiness::SetupRequired,
                runner_ready: false,
                model_ready: false,
                chat_ready: false,
                issue_code: Some(LocalProviderIssueCode::MissingRunner),
                resolved_runner: None,
                resolved_model: None,
                resolved_chat_base_url: None,
                resolved_chat_model: None,
                available_chat_models: Vec::new(),
                guidance: "Install whisper-cli and a local model.".to_string(),
            },
        );

        assert_eq!(missing.kind, None);
        assert!(!missing.configured);
        assert_eq!(
            missing.missing.as_deref(),
            Some("Install whisper-cli and a local model."),
        );
    }

    #[test]
    fn local_capabilities_match_external_stt_lane() {
        let capabilities = provider_capabilities();

        assert!(capabilities.transcription);
        assert!(capabilities.local);
        assert!(capabilities.supports_language);
        assert!(capabilities.chat_completion);
        assert!(!capabilities.requires_api_key);
        assert!(capabilities.supports_prompt_bias);
        assert!(!capabilities.supports_segments);
        assert!(capabilities.model_management);
        assert!(
            !capabilities.speech_synthesis,
            "nothing in this build synthesises; Kokoro is surveyed, not hosted",
        );
    }

    /// The model axis on the path this lane actually drives.
    ///
    /// whisper.cpp streams in its `stream` example and sherpa-onnx ships online
    /// Parakeet models that report a detected language; **this runtime shells
    /// out to `whisper-cli` and echoes the requested language back**, so both
    /// answers are no. The test names the reason so that F3 has to change it
    /// deliberately rather than discover it.
    #[test]
    fn the_local_lane_denies_both_recognition_shapes_on_todays_path() {
        for model in ["base", "large-v3", "ggml-medium.en"] {
            let capabilities = model_capabilities(model);

            assert_eq!(capabilities.model, model);
            assert_eq!(
                capabilities.transcription_streaming,
                ModelSupport::Unsupported,
                "{model} runs through whisper-cli, one file in and one transcript out",
            );
            assert_eq!(
                capabilities.reports_detected_language,
                ModelSupport::Unsupported,
                "{model} echoes the language it was told, and never names one",
            );
        }
    }

    #[test]
    fn an_unnamed_local_model_answers_for_the_one_that_would_run() {
        assert_eq!(model_capabilities("").model, "base");
        assert_eq!(model_capabilities("large").model, "large-v3");
    }

    /// **A machine with nothing installed offers nothing** (B5, ADR 0122).
    ///
    /// This test used to assert the opposite — that `local-base-fast`,
    /// `local-base-quality` and `local-medium-quality` are always there — and
    /// it passed for months on a machine where not one of those four files
    /// existed. Four rows naming four files that may not exist is the
    /// fake-readiness defect the runtime rules forbid, and it sat under the one
    /// lane whose whole difficulty is that its dependencies are the user's
    /// problem. What replaced the rows is a sentence: the catalogue's models are
    /// *installable*, which `core::model_install` answers and which is not the
    /// same claim.
    #[test]
    fn nothing_installed_offers_no_profiles_rather_than_four_invented_ones() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[LOCAL_MODEL_PATH_ENV, LOCAL_MODEL_DIR_ENV]);
        std::env::remove_var(LOCAL_MODEL_PATH_ENV);
        std::env::remove_var(LOCAL_MODEL_DIR_ENV);
        let managed = crate::core::model_install::managed_speech_model_dir();
        let _ = std::fs::remove_dir_all(&managed);

        assert!(
            provider_profiles().is_empty(),
            "a machine with no model file and no environment variable offers nothing",
        );
    }

    /// The property the test above was really about, measured where a model
    /// actually is: every model gets both presets, and the preset decides the
    /// mode.
    #[test]
    fn local_profiles_expose_quality_vs_latency_modes() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[LOCAL_MODEL_PATH_ENV, LOCAL_MODEL_DIR_ENV]);
        let dir = std::env::temp_dir().join("wordscript-local-preset-pairs");
        let _ = std::fs::create_dir_all(&dir);
        std::fs::write(dir.join("ggml-base.bin"), "model").expect("write base");
        std::fs::write(dir.join("ggml-medium.bin"), "model").expect("write medium");
        std::env::remove_var(LOCAL_MODEL_PATH_ENV);
        std::env::set_var(LOCAL_MODEL_DIR_ENV, &dir);

        let profiles = provider_profiles();

        assert!(profiles.iter().any(|profile| {
            profile.id == "local-base-fast" && profile.mode == ProviderMode::Fast
        }));
        assert!(profiles.iter().any(|profile| {
            profile.id == "local-base-quality" && profile.mode == ProviderMode::Quality
        }));
        assert!(profiles.iter().any(|profile| {
            profile.id == "local-medium-quality" && profile.mode == ProviderMode::Quality
        }));
    }

    /// **An installed model is found with no environment variable set.**
    /// ADR 0122's own *done when*, and the half that makes an install worth
    /// anything: discovery has to see the file AND the decode path has to
    /// resolve it, or the result is a profile that is offered, chosen and dead
    /// at first capture.
    #[test]
    fn an_installed_model_is_found_with_no_environment_variable() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[LOCAL_MODEL_PATH_ENV, LOCAL_MODEL_DIR_ENV]);
        std::env::remove_var(LOCAL_MODEL_PATH_ENV);
        std::env::remove_var(LOCAL_MODEL_DIR_ENV);

        let managed = crate::core::model_install::managed_speech_model_dir();
        let _ = std::fs::remove_dir_all(&managed);
        std::fs::create_dir_all(&managed).expect("create the managed directory");
        std::fs::write(managed.join("ggml-small.bin"), "model").expect("write small");

        let profiles = provider_profiles();
        assert!(
            profiles.iter().any(|profile| profile.id == "local-small-fast"),
            "the managed directory is discovered as a third source",
        );
        assert_eq!(
            resolve_local_model_path("small").expect("the installed model resolves"),
            managed.join("ggml-small.bin"),
            "and the decode path resolves the same file",
        );

        let _ = std::fs::remove_dir_all(&managed);
    }

    /// **The listing unions and the resolution ranks** (ADR 0159), and this
    /// test used to assert the opposite.
    ///
    /// B5 read ADR 0122's *an expert's checkout is never overridden* as *and
    /// nothing else is shown*, so `discover_local_provider_profiles` returned
    /// on the first source that answered. The consequence was a defect nobody
    /// would report as one: with `WORDSCRIPT_LOCAL_MODEL_DIR` set, a model
    /// installed through the app was on the disk, resolvable, and **not
    /// offered** — the in-app installation quietly did nothing for exactly the
    /// users most likely to have that variable set. Overriding is a tie-break.
    #[test]
    fn every_source_is_offered_and_the_environment_wins_the_tie() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[LOCAL_MODEL_PATH_ENV, LOCAL_MODEL_DIR_ENV]);
        std::env::remove_var(LOCAL_MODEL_PATH_ENV);

        let managed = crate::core::model_install::managed_speech_model_dir();
        let _ = std::fs::remove_dir_all(&managed);
        std::fs::create_dir_all(&managed).expect("create the managed directory");
        std::fs::write(managed.join("ggml-small.bin"), "installed").expect("write small");
        // The same model in both places, so the tie-break is observable.
        std::fs::write(managed.join("ggml-medium.bin"), "installed-medium")
            .expect("write medium into the managed dir");

        let checkout = std::env::temp_dir().join("wordscript-local-expert-checkout");
        let _ = std::fs::remove_dir_all(&checkout);
        std::fs::create_dir_all(&checkout).expect("create the checkout");
        std::fs::write(checkout.join("ggml-medium.bin"), "the expert's own")
            .expect("write medium into the checkout");
        std::env::set_var(LOCAL_MODEL_DIR_ENV, &checkout);

        let profiles = provider_profiles();
        assert!(
            profiles.iter().any(|profile| profile.id == "local-medium-fast"),
            "the expert's directory is offered",
        );
        assert!(
            profiles.iter().any(|profile| profile.id == "local-small-fast"),
            "AND what the installer put there is offered beside it",
        );

        /* The tie-break, which is where ADR 0122's guarantee actually lives:
           two folders hold `ggml-medium.bin` and the environment's file runs. */
        assert_eq!(
            resolve_local_model_path("medium").expect("medium resolves"),
            checkout.join("ggml-medium.bin"),
        );
        /* And a model only the managed directory has still resolves, which is
           the half that used to be unreachable. */
        assert_eq!(
            resolve_local_model_path("small").expect("small resolves"),
            managed.join("ggml-small.bin"),
        );

        let _ = std::fs::remove_dir_all(&managed);
        let _ = std::fs::remove_dir_all(&checkout);
    }

    /// A folder the user added on `AI Models` is read, ranks below both
    /// environment variables and above the managed directory, and is never
    /// written into (ADR 0159).
    #[test]
    fn a_folder_the_user_added_is_read_and_outranks_the_managed_one() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[LOCAL_MODEL_PATH_ENV, LOCAL_MODEL_DIR_ENV]);
        std::env::remove_var(LOCAL_MODEL_PATH_ENV);
        std::env::remove_var(LOCAL_MODEL_DIR_ENV);

        let managed = crate::core::model_install::managed_speech_model_dir();
        let _ = std::fs::remove_dir_all(&managed);
        std::fs::create_dir_all(&managed).expect("create the managed directory");
        std::fs::write(managed.join("ggml-base.bin"), "installed").expect("write base");

        let library = std::env::temp_dir().join("wordscript-local-user-library");
        let _ = std::fs::remove_dir_all(&library);
        std::fs::create_dir_all(&library).expect("create the library");
        std::fs::write(library.join("ggml-base.bin"), "the user's own").expect("write base");
        std::fs::write(library.join("ggml-tiny.bin"), "the user's own").expect("write tiny");

        let mut config = crate::core::config::AppConfig::load_from_disk();
        config.local_model_dirs = vec![library.display().to_string()];
        config.save_to_disk().expect("save the folder list");

        /* **Everything is read BEFORE anything is asserted, and the config is
           restored in between.** `local_model_sources` reads the config from
           disk, and this suite shares one diverted data directory — a failing
           assertion here would leave a folder list behind that makes an
           unrelated test resolve a model it should not have found. That is not
           a hypothetical: it is what the first run of this test did, and it
           surfaced three tests away as a wrong `LocalProviderIssueCode`. */
        let profiles = provider_profiles();
        let resolved = resolve_local_model_path("base");

        config.local_model_dirs.clear();
        config.save_to_disk().expect("restore the folder list");
        let _ = std::fs::remove_dir_all(&managed);
        let _ = std::fs::remove_dir_all(&library);

        assert!(
            profiles.iter().any(|profile| profile.id == "local-tiny-fast"),
            "a model only the user's folder has is offered",
        );
        assert_eq!(
            resolved.expect("base resolves"),
            library.join("ggml-base.bin"),
            "and the user's folder outranks the managed one on a shared name",
        );
    }

    #[test]
    fn provider_profiles_discover_models_from_local_model_dir() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[LOCAL_MODEL_PATH_ENV, LOCAL_MODEL_DIR_ENV]);
        let dir = std::env::temp_dir().join("wordscript-local-discovered-profiles");
        let _ = std::fs::create_dir_all(&dir);
        std::fs::write(dir.join("ggml-medium.bin"), "model").expect("write medium");
        std::fs::write(dir.join("ggml-large-v3-q5_0.bin"), "model").expect("write large");
        std::env::remove_var(LOCAL_MODEL_PATH_ENV);
        std::env::set_var(LOCAL_MODEL_DIR_ENV, &dir);

        let profiles = provider_profiles();

        assert!(profiles
            .iter()
            .any(|profile| profile.id == "local-medium-fast"));
        assert!(profiles
            .iter()
            .any(|profile| profile.id == "local-large-v3-q5_0-quality"));
        assert!(profiles.iter().any(|profile| profile.default));
    }

    #[test]
    fn provider_status_uses_requested_model_in_local_setup() {
        let _lock = lock_env();
        let _env = EnvGuard::capture(&[
            LOCAL_WHISPER_BINARY_ENV,
            LOCAL_MODEL_PATH_ENV,
            LOCAL_MODEL_DIR_ENV,
            "PATH",
        ]);
        let dir = std::env::temp_dir().join("wordscript-local-requested-models");
        let _ = std::fs::create_dir_all(&dir);
        let medium_model = dir.join("ggml-medium.bin");
        std::fs::write(&medium_model, "model").expect("write model file");
        std::env::set_var(LOCAL_MODEL_DIR_ENV, &dir);
        std::env::set_var("PATH", "");
        std::env::set_var(
            LOCAL_WHISPER_BINARY_ENV,
            "/tmp/wordscript-missing-whisper-cli",
        );

        let status = provider_status(Some("medium"), None).expect("local runtime status");

        assert_eq!(status.default_profile, "local-medium-quality");
        assert_eq!(
            status
                .local_setup
                .as_ref()
                .and_then(|setup| setup.resolved_model.as_deref()),
            Some(medium_model.to_string_lossy().as_ref())
        );
    }
}
