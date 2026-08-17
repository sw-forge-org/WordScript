//! The OpenAI-compatible request shape, once, for every lane that speaks it.
//!
//! **ADR 0113 is the record and `groq.rs:25` was the evidence.** `GROQ_API_BASE`
//! is `https://api.groq.com/openai/v1`, so the one cloud adapter this product
//! shipped before D1 was already the OpenAI shape with a Groq host — three
//! paths (`/audio/transcriptions`, `/chat/completions`, `/models`), a bearer
//! token, and a retry policy that has nothing vendor-specific in it. Extracting
//! it with the second caller costs a parameter; extracting it with the fourth
//! costs a refactor of three call sites that have drifted in the meantime.
//!
//! **What is shared is the transport, never the policy.** Which model a request
//! runs, which `response_format` that model accepts, how large an upload may be
//! and what a plan buys are answers a vendor owns and this module takes as
//! arguments. OpenAI is the proof that the split is at the right place:
//! `verbose_json` is `whisper-1` only there and unconditional on Groq, and a
//! shared default would have made every `gpt-4o-transcribe` request a 400.

use std::{path::Path, time::Duration, time::Instant};

use reqwest::{header, multipart, StatusCode, Url};
use serde::Deserialize;

use crate::core::model_catalogue;
use crate::core::runtime_log;

use super::{
    ChatCompletionRequest, ProviderCommandError, ProviderErrorKind, ProviderRole,
    TranscriptionResponse,
};

/// Whether a base URL may carry a bearer token — **HTTPS, or a private host**
/// (ADR 0113, D1a).
///
/// **Every base URL above this line is a constant and this is the one that is
/// not.** Groq's, OpenAI's and OpenRouter's are compiled in and are `https:` by
/// construction; the Self-hosted lane's is typed by whoever runs the server, so
/// it is the first place in this file where a credential could be handed to an
/// address nobody vetted. Plain `http:` to a public host would license the
/// user's token to anyone on the path between here and there.
///
/// **The rule is the donor's and it is taken whole rather than approximated**
/// (`donors/app/desktop-shells/openwhispr/src/utils/urlUtils.ts`). A LAN server
/// on plain HTTP is the ordinary case for this lane — `whisper-server` on the
/// machine under the desk — so refusing everything but HTTPS would refuse the
/// lane's own reason for existing.
///
/// **The dotted-quad check is the part worth copying carefully.** Matching
/// `10.` or `127.` as a string prefix admits `10.example.com` and
/// `127.example.com`, which are public DNS names that would then skip the HTTPS
/// requirement entirely. The donor's comment says so and its parser is what
/// closes it: four decimal octets, no leading zeros, nothing above 255.
pub fn is_secure_endpoint(url: &str) -> bool {
    let Ok(parsed) = Url::parse(url.trim()) else {
        return false;
    };

    if parsed.scheme() == "https" {
        return true;
    }

    parsed.host_str().is_some_and(is_private_host)
}

/// Whether a hostname names something that cannot leave this network.
fn is_private_host(hostname: &str) -> bool {
    let host = hostname.trim_matches(|c| c == '[' || c == ']').to_ascii_lowercase();

    if host == "localhost" || host == "0.0.0.0" || host == "::1" {
        return true;
    }

    if let Some(octets) = parse_ipv4_literal(&host) {
        let (a, b) = (octets[0], octets[1]);
        return a == 127
            || a == 10
            || (a == 192 && b == 168)
            || (a == 172 && (16..=31).contains(&b))
            // RFC 6598 carrier-grade NAT, which is the range Tailscale hands
            // out. A machine reached over a tailnet is on a private network in
            // every sense this check is about.
            || (a == 100 && (64..=127).contains(&b))
            || (a == 169 && b == 254);
    }

    if host.contains(':') && (host.starts_with("fe80") || host.starts_with("fc") || host.starts_with("fd")) {
        return true;
    }

    host.ends_with(".local")
}

/// Four decimal octets, or nothing.
///
/// **Deliberately stricter than a parser that merely succeeds.** Leading zeros
/// are rejected because `010.0.0.1` is octal to some resolvers and decimal to
/// others, and a check that disagrees with the resolver about which host it is
/// looking at is not a check.
fn parse_ipv4_literal(hostname: &str) -> Option<[u8; 4]> {
    let mut octets = [0u8; 4];
    let mut parts = hostname.split('.');

    for slot in octets.iter_mut() {
        let part = parts.next()?;
        if part.is_empty() || (part.len() > 1 && part.starts_with('0')) {
            return None;
        }
        if !part.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
        *slot = part.parse::<u8>().ok()?;
    }

    parts.next().is_none().then_some(octets)
}

/// What went wrong on an OpenAI-compatible call.
///
/// Carries the vendor's own name in `message` rather than a field, because
/// every consumer of this type puts it straight into a sentence a user reads
/// and a second field would be a second thing to forget to render.
#[derive(Debug)]
pub struct CompatibleError {
    pub kind: ProviderErrorKind,
    pub message: String,
    pub status: Option<u16>,
    pub retry_after_seconds: Option<u64>,
}

impl From<CompatibleError> for ProviderCommandError {
    fn from(error: CompatibleError) -> Self {
        Self::new(
            error.kind,
            error.message,
            error.status,
            error.retry_after_seconds,
        )
    }
}

#[derive(Debug, Deserialize)]
struct ChatCompletionPayload {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: String,
}

/// One transcription request, with every vendor decision already taken.
///
/// **`model` and `response_format` arrive resolved.** They are the two fields
/// where lanes disagree — Groq runs `verbose_json` on everything, OpenAI runs
/// it on `whisper-1` alone — so resolving them here would be this module
/// holding an opinion it cannot have.
pub struct TranscriptionPlan {
    pub file_name: String,
    pub audio_bytes: Vec<u8>,
    pub model: String,
    pub response_format: String,
    pub language: Option<String>,
    pub prompt: Option<String>,
}

/// A client for one vendor's OpenAI-compatible endpoint.
///
/// `base_url` is a `String` rather than a `&'static str` because the
/// Self-hosted lane's is typed by the user (ADR 0113, D1a) — a lane that would
/// otherwise need a second copy of this whole file for the sake of one field.
pub struct CompatibleClient {
    http: reqwest::Client,
    /// The vendor's name as a sentence uses it: `Groq`, `OpenAI`. It reaches
    /// users through every error below, so it is the display name and not the
    /// registry id.
    vendor: &'static str,
    base_url: String,
    api_key: String,
    timeout: Duration,
    max_retries: u8,
}

impl CompatibleClient {
    pub fn new(
        vendor: &'static str,
        base_url: impl Into<String>,
        api_key: String,
        timeout_ms: u64,
        max_retries: u8,
    ) -> Result<Self, CompatibleError> {
        let timeout = Duration::from_millis(timeout_ms.max(5_000));
        let http = reqwest::Client::builder()
            .timeout(timeout)
            .connect_timeout(Duration::from_secs(8))
            .build()
            .map_err(|error| CompatibleError {
                kind: ProviderErrorKind::InvalidRequest,
                message: format!("Could not build {vendor} HTTP client: {error}"),
                status: None,
                retry_after_seconds: None,
            })?;

        Ok(Self {
            http,
            vendor,
            base_url: base_url.into(),
            api_key,
            timeout,
            max_retries,
        })
    }

    /// Whether a key authenticates at all.
    ///
    /// `/models` is neither recognition nor completion, which is exactly why it
    /// is the validation path: it asks the vendor about the credential without
    /// spending one of the roles the credential pays for.
    pub async fn validate_models_endpoint(&self) -> Result<(), CompatibleError> {
        let base = &self.base_url;
        let response = self
            .send_with_retries("models.validate", || {
                self.http
                    .get(format!("{base}/models"))
                    .bearer_auth(&self.api_key)
            })
            .await?;

        drop(response);
        Ok(())
    }

    /// Reads an audio file off the disk, or says which one it could not read.
    ///
    /// Here rather than in each adapter because the failure is about a path and
    /// a filesystem, and neither is a vendor question.
    pub async fn read_audio(
        &self,
        audio_path: &str,
    ) -> Result<(String, Vec<u8>), CompatibleError> {
        let path = Path::new(audio_path);
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("wordscript-audio.wav")
            .to_string();

        let audio_bytes = tokio::fs::read(path).await.map_err(|error| CompatibleError {
            kind: ProviderErrorKind::Io,
            message: format!("Could not read audio file: {error}"),
            status: None,
            retry_after_seconds: None,
        })?;

        Ok((file_name, audio_bytes))
    }

    pub async fn transcribe(
        &self,
        plan: TranscriptionPlan,
    ) -> Result<TranscriptionResponse, CompatibleError> {
        let started_at = Instant::now();
        let base = &self.base_url;
        let TranscriptionPlan {
            file_name,
            audio_bytes,
            model,
            response_format,
            language,
            prompt,
        } = plan;

        // `prompt_chars` is here so the blank-state floor can be verified where
        // it matters. A floor that only shows up in the settings preview is the
        // defect `stt-hints-bypass-the-vocabulary-opt-in.md` records, and until
        // this line carried the number there was no way to tell from a real
        // dictation whether the provider got a prompt at all (ADR 0036). The
        // count, not the text: the prompt can carry the user's own terms.
        runtime_log::record(format!(
            "[WordScript] {} transcription start file={} bytes={} model={} format={} timeout_ms={} retries={} prompt_chars={}",
            self.vendor,
            file_name,
            audio_bytes.len(),
            model,
            response_format,
            self.timeout.as_millis(),
            self.max_retries,
            prompt.as_deref().map(str::len).unwrap_or(0),
        ));

        let response = self
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
                    .post(format!("{base}/audio/transcriptions"))
                    .bearer_auth(&self.api_key)
                    .multipart(form)
            })
            .await?;

        let payload = response
            .json::<TranscriptionResponse>()
            .await
            .map_err(|error| CompatibleError {
                kind: ProviderErrorKind::Parse,
                message: format!(
                    "Could not parse {} transcription response: {error}",
                    self.vendor
                ),
                status: None,
                retry_after_seconds: None,
            })?;

        runtime_log::record(format!(
            "[WordScript] {} transcription complete elapsed_ms={} text_len={} duration={:?}",
            self.vendor,
            started_at.elapsed().as_millis(),
            payload.text.len(),
            payload.duration,
        ));
        runtime_log::record(payload.coverage().log_line());

        Ok(payload)
    }

    pub async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<String, CompatibleError> {
        let started_at = Instant::now();
        let base = &self.base_url;
        let prompt_chars = request
            .messages
            .iter()
            .map(|message| message.content.len())
            .sum::<usize>();
        runtime_log::record(format!(
            "[WordScript] {} correction start model={} timeout_ms={} retries={} prompt_chars={} max_tokens={}",
            self.vendor,
            request.model,
            self.timeout.as_millis(),
            self.max_retries,
            prompt_chars,
            request.max_tokens,
        ));

        let mut body = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        });

        /* HOW MUCH THIS MODEL MAY THINK BEFORE IT ANSWERS (ADR 0214).
           **Sent only where the catalogue names an effort for this id**, which is
           the rule that keeps this one line correct for four adapters: a model
           that does not reason gets no parameter, and a self-hosted server —
           whose ids are its operator's and are in no catalogue by construction —
           gets none either.

           It is not a tuning knob. Groq retired its Llama chat models on
           2026-08-17 and every replacement it serves reasons; an unconstrained
           reasoning model spends the whole `max_tokens` budget thinking and
           returns an empty `content`, which reaches this product as a dictation
           whose cleanup silently did nothing. Measured at 46 reasoning tokens
           against the 48-token budget `transcript_store::describe` sends. */
        if let Some(effort) =
            model_catalogue::reasoning_effort_for(&request.model, ProviderRole::Chat)
        {
            body["reasoning_effort"] = serde_json::Value::String(effort.to_string());
        }

        let response = self
            .send_with_retries("chat.completions", || {
                self.http
                    .post(format!("{base}/chat/completions"))
                    .bearer_auth(&self.api_key)
                    .json(&body)
            })
            .await?;

        let payload = response
            .json::<ChatCompletionPayload>()
            .await
            .map_err(|error| CompatibleError {
                kind: ProviderErrorKind::Parse,
                message: format!(
                    "Could not parse {} chat completion response: {error}",
                    self.vendor
                ),
                status: None,
                retry_after_seconds: None,
            })?;

        payload
            .choices
            .first()
            .map(|choice| choice.message.content.trim().to_string())
            .filter(|content| !content.is_empty())
            .ok_or(CompatibleError {
                kind: ProviderErrorKind::Parse,
                message: format!("{} chat completion returned no text choices.", self.vendor),
                status: None,
                retry_after_seconds: None,
            })
            .inspect(|content| {
                runtime_log::record(format!(
                    "[WordScript] {} correction complete elapsed_ms={} text_len={}",
                    self.vendor,
                    started_at.elapsed().as_millis(),
                    content.len(),
                ));
            })
    }

    async fn send_with_retries<F>(
        &self,
        label: &str,
        request_factory: F,
    ) -> Result<reqwest::Response, CompatibleError>
    where
        F: Fn() -> reqwest::RequestBuilder,
    {
        let vendor = self.vendor;
        let mut attempt = 0;
        loop {
            let attempt_number = attempt + 1;
            let started_at = Instant::now();
            let response = request_factory().send().await;
            match response {
                Ok(response) if response.status().is_success() => {
                    runtime_log::record(format!(
                        "[WordScript] {} {} success attempt={} status={} elapsed_ms={}",
                        vendor,
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
                    let error = status_error(vendor, status, body, retry_after_seconds);

                    runtime_log::record(format!(
                        "[WordScript] {} {} failure attempt={} status={} elapsed_ms={} retry_after={:?}",
                        vendor,
                        label,
                        attempt_number,
                        status.as_u16(),
                        started_at.elapsed().as_millis(),
                        retry_after_seconds,
                    ));

                    if should_retry_status(status) && attempt < self.max_retries {
                        attempt += 1;
                        runtime_log::record(format!(
                            "[WordScript] {} {} retrying after status failure attempt={} next_attempt={} delay_ms={}",
                            vendor,
                            label,
                            attempt_number,
                            attempt + 1,
                            retry_delay(attempt, retry_after_seconds).as_millis(),
                        ));
                        tokio::time::sleep(retry_delay(attempt, retry_after_seconds)).await;
                        continue;
                    }

                    return Err(error);
                }
                Err(error) if error.is_timeout() => {
                    runtime_log::record(format!(
                        "[WordScript] {} {} timeout attempt={} elapsed_ms={} timeout_ms={}",
                        vendor,
                        label,
                        attempt_number,
                        started_at.elapsed().as_millis(),
                        self.timeout.as_millis(),
                    ));
                    if attempt < self.max_retries {
                        attempt += 1;
                        runtime_log::record(format!(
                            "[WordScript] {} {} retrying after timeout attempt={} next_attempt={} delay_ms={}",
                            vendor,
                            label,
                            attempt_number,
                            attempt + 1,
                            retry_delay(attempt, None).as_millis(),
                        ));
                        tokio::time::sleep(retry_delay(attempt, None)).await;
                        continue;
                    }

                    return Err(CompatibleError {
                        kind: ProviderErrorKind::Timeout,
                        message: format!(
                            "{vendor} request timed out after {}ms",
                            self.timeout.as_millis()
                        ),
                        status: None,
                        retry_after_seconds: None,
                    });
                }
                Err(error) => {
                    runtime_log::record(format!(
                        "[WordScript] {} {} network error attempt={} elapsed_ms={} error={}",
                        vendor,
                        label,
                        attempt_number,
                        started_at.elapsed().as_millis(),
                        error,
                    ));
                    if attempt < self.max_retries {
                        attempt += 1;
                        runtime_log::record(format!(
                            "[WordScript] {} {} retrying after network error attempt={} next_attempt={} delay_ms={}",
                            vendor,
                            label,
                            attempt_number,
                            attempt + 1,
                            retry_delay(attempt, None).as_millis(),
                        ));
                        tokio::time::sleep(retry_delay(attempt, None)).await;
                        continue;
                    }

                    return Err(CompatibleError {
                        kind: ProviderErrorKind::Network,
                        message: format!("{vendor} network request failed: {error}"),
                        status: None,
                        retry_after_seconds: None,
                    });
                }
            }
        }
    }
}

pub fn status_error(
    vendor: &str,
    status: StatusCode,
    body: String,
    retry_after_seconds: Option<u64>,
) -> CompatibleError {
    let kind = match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => ProviderErrorKind::Unauthorized,
        StatusCode::TOO_MANY_REQUESTS => ProviderErrorKind::RateLimited,
        StatusCode::BAD_REQUEST
        | StatusCode::PAYLOAD_TOO_LARGE
        | StatusCode::UNPROCESSABLE_ENTITY => ProviderErrorKind::InvalidRequest,
        _ => ProviderErrorKind::ProviderStatus,
    };

    CompatibleError {
        kind,
        message: if body.is_empty() {
            format!("{vendor} returned HTTP {status}")
        } else {
            format!("{vendor} returned HTTP {status}: {body}")
        },
        status: Some(status.as_u16()),
        retry_after_seconds,
    }
}

/// A size phrased for a diagnostic: both the human number and the exact one,
/// because a bug report carries the second and a settings row the first.
pub fn format_audio_size(audio_bytes_len: usize) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_vendor_name_reaches_the_sentence_a_user_reads() {
        // The whole reason `vendor` is a field: an extracted transport that
        // said "the provider returned HTTP 401" would have made every lane's
        // failure read the same, and the first question about a failed key is
        // which vendor refused it.
        let groq = status_error("Groq", StatusCode::UNAUTHORIZED, String::new(), None);
        let openai = status_error("OpenAI", StatusCode::UNAUTHORIZED, String::new(), None);

        assert_eq!(groq.message, "Groq returned HTTP 401 Unauthorized");
        assert_eq!(openai.message, "OpenAI returned HTTP 401 Unauthorized");
        assert!(matches!(groq.kind, ProviderErrorKind::Unauthorized));
    }

    #[test]
    fn a_rate_limit_is_retried_and_a_bad_request_is_not() {
        assert!(should_retry_status(StatusCode::TOO_MANY_REQUESTS));
        assert!(should_retry_status(StatusCode::BAD_GATEWAY));
        assert!(!should_retry_status(StatusCode::BAD_REQUEST));
        assert!(!should_retry_status(StatusCode::UNAUTHORIZED));
    }

    #[test]
    fn a_retry_after_header_outranks_the_backoff_and_is_capped() {
        assert_eq!(retry_delay(1, Some(3)), Duration::from_secs(3));
        assert_eq!(retry_delay(1, Some(600)), Duration::from_secs(10));
        assert_eq!(retry_delay(2, None), Duration::from_millis(500));
    }

    /// The lane's own reason for existing: `whisper-server` on the machine
    /// under the desk, over plain HTTP, on a network a token cannot leave.
    #[test]
    fn a_lan_server_on_plain_http_is_accepted_and_so_is_anything_over_tls() {
        for url in [
            "http://127.0.0.1:8080/v1",
            "http://localhost:8080/v1",
            "http://10.0.0.2:8080/v1",
            "http://192.168.1.40:8080/v1",
            "http://172.16.4.9/v1",
            "http://172.31.255.1/v1",
            "http://100.101.102.103/v1",
            "http://[::1]:8080/v1",
            "http://whisper.local:8080/v1",
            "https://speech.example.com/v1",
            "https://openrouter.ai/api/v1",
        ] {
            assert!(is_secure_endpoint(url), "{url} should be accepted");
        }
    }

    /// **The case the donor wrote its parser for, and the reason this is not a
    /// string prefix.** `10.example.com` and `127.example.com` are public DNS
    /// names that a `starts_with("10.")` check reads as private — and a bearer
    /// token then goes over plain HTTP to whoever registered them.
    #[test]
    fn a_public_name_wearing_a_private_prefix_is_refused() {
        assert!(!is_secure_endpoint("http://10.example.com/v1"));
        assert!(!is_secure_endpoint("http://127.example.com/v1"));
        assert!(!is_secure_endpoint("http://192.168.example.com/v1"));
        assert!(!is_secure_endpoint("http://localhost.example.com/v1"));
    }

    #[test]
    fn a_public_host_on_plain_http_is_refused_and_so_is_a_string_that_is_not_a_url() {
        assert!(!is_secure_endpoint("http://api.example.com/v1"));
        assert!(!is_secure_endpoint("http://172.32.0.1/v1"));
        assert!(!is_secure_endpoint("http://100.128.0.1/v1"));
        assert!(!is_secure_endpoint("not a url at all"));
        assert!(!is_secure_endpoint(""));
        assert!(!is_secure_endpoint("/v1/audio/transcriptions"));
    }

    /// A leading zero is octal to some resolvers and decimal to others, so an
    /// octet that admits one is a check that can disagree with the resolver
    /// about which machine it just approved.
    #[test]
    fn an_octet_that_two_resolvers_would_read_differently_is_not_an_octet() {
        assert_eq!(parse_ipv4_literal("10.0.0.1"), Some([10, 0, 0, 1]));
        assert_eq!(parse_ipv4_literal("010.0.0.1"), None);
        assert_eq!(parse_ipv4_literal("10.0.0"), None);
        assert_eq!(parse_ipv4_literal("10.0.0.1.5"), None);
        assert_eq!(parse_ipv4_literal("10.0.0.256"), None);
        assert_eq!(parse_ipv4_literal("10.0.0.0x1"), None);
        assert_eq!(parse_ipv4_literal(""), None);
    }
}
