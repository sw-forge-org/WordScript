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
    /// Why the model stopped. `length` is the budget running out, which is the
    /// one value [`text_from`] refuses — see its docblock.
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: String,
}

/// **HOW MUCH SLACK A REASONING MODEL NEEDS ON TOP OF THE ANSWER BUDGET.**
///
/// `max_tokens` on the wire caps reasoning AND answer together; every caller in
/// this product means *how long may the answer be*. The two readings were the
/// same number until Groq retired its Llama chat line (ADR 0214) and every
/// replacement it serves reasons — and this adapter is the layer that knows the
/// wire's reading, so it is where the translation belongs.
///
/// **One number rather than a catalogue column, because the headroom is not a
/// per-model fact we have measured.** `reasoning_effort` is one: it is posted,
/// it is documented, and a row states it. What a given model then spends
/// thinking varies per prompt, so a column would claim a precision that would go
/// stale at every read-date. Measured on 2026-08-18 against the real title
/// prompt: `gpt-oss-120b` at `low` spends 38, `gpt-oss-20b` at `low` spends 5.
/// 256 clears both several times over.
///
/// **It costs nothing when it is not used.** A budget is a cap and not a
/// reservation — a model that finishes at 52 tokens is billed for 52.
const REASONING_HEADROOM_TOKENS: u32 = 256;

/// The effort to post and the budget to send with it (ADR 0221).
///
/// **This is the fix for a defect ADR 0214 half-closed**, and the half it missed
/// is the reason it is one function rather than a line at each call site. That
/// record measured `gpt-oss-20b` against `transcript_store::describe`'s 48-token
/// budget, set `reasoning_effort` and stopped — but the title rides the
/// ASSISTANT's job (ADR 0087), which runs `gpt-oss-120b`, and 120b at `low`
/// spends 38 of those 48 thinking. The reply came back cut after its first line
/// with `finish_reason: length`, so the parse found a language and no title and
/// History has named nothing since. Two more callers sit under the same edge:
/// `agent`'s intent classifier asks for 10 tokens and `transform`'s correction
/// floors at 40.
///
/// **`none` gets no headroom, and that is not a special case.** It is the one
/// value that switches reasoning OFF — `qwen3.6-27b`'s row — so there is nothing
/// to leave room for.
///
/// A model the catalogue does not carry answers `None` and keeps the caller's
/// budget untouched: a typed override reaches the wire as written (ADR 0115),
/// and inflating a budget for a model we cannot say reasons would be this
/// function guessing.
fn completion_budget(model: &str, answer_tokens: u32) -> (u32, Option<&'static str>) {
    let Some(effort) = model_catalogue::reasoning_effort_for(model, ProviderRole::Chat) else {
        return (answer_tokens, None);
    };

    let budget = if effort == "none" {
        answer_tokens
    } else {
        answer_tokens.saturating_add(REASONING_HEADROOM_TOKENS)
    };
    (budget, Some(effort))
}

/// The completion's text, or the reason there is not one.
///
/// **A REPLY THAT RAN OUT OF BUDGET IS A FAILURE AND NOT A SHORT ANSWER.**
/// `finish_reason: length` says the model was still writing, so what arrived is
/// the beginning of an answer and nothing marks where it stops. Returning it
/// would deliver a cleanup cut mid-sentence, a translation missing its end or a
/// title truncated to the language code — text that claims to be finished and is
/// not, which is the fake-readiness rule applied to a completion.
///
/// **Every caller is already built for this and none of them was reached.** A
/// correction falls back to the raw text with `post_correction_failed_fallback`,
/// a translation with `llm_call_failed`, a classifier to *not the assistant*, a
/// title to the first-words slug — each of them says so. A truncated string
/// reaching those callers as `Ok` is what let a 200 be indistinguishable from a
/// failure for a day.
fn text_from(vendor: &'static str, payload: &ChatCompletionPayload) -> Result<String, CompatibleError> {
    let refuse = |message: String| CompatibleError {
        kind: ProviderErrorKind::Parse,
        message,
        status: None,
        retry_after_seconds: None,
    };

    let Some(choice) = payload.choices.first() else {
        return Err(refuse(format!(
            "{vendor} chat completion returned no text choices."
        )));
    };

    if choice.finish_reason.as_deref() == Some("length") {
        return Err(refuse(format!(
            "{vendor} chat completion ran out of its token budget before it finished, so the answer is incomplete and was discarded."
        )));
    }

    let content = choice.message.content.trim().to_string();
    if content.is_empty() {
        return Err(refuse(format!(
            "{vendor} chat completion returned no text choices."
        )));
    }
    Ok(content)
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

        /* HOW MUCH THIS MODEL MAY THINK BEFORE IT ANSWERS, AND WHAT THAT COSTS
           THE BUDGET (ADR 0214). **Sent only where the catalogue names an effort
           for this id**, which is the rule that keeps this one line correct for
           four adapters: a model that does not reason gets no parameter, and a
           self-hosted server — whose ids are its operator's and are in no
           catalogue by construction — gets none either.

           It is not a tuning knob. Groq retired its Llama chat models on
           2026-08-17 and every replacement it serves reasons; an unconstrained
           reasoning model spends the whole `max_tokens` budget thinking and
           returns an empty `content`, which reaches this product as a dictation
           whose cleanup silently did nothing.

           The budget moves with it, and that half was missing — see
           [`completion_budget`], which carries the measurement and the three
           callers whose budgets sit under a reasoning model's own cost. */
        let (max_tokens, effort) = completion_budget(&request.model, request.max_tokens);

        runtime_log::record(format!(
            "[WordScript] {} correction start model={} timeout_ms={} retries={} prompt_chars={} max_tokens={} answer_tokens={} effort={}",
            self.vendor,
            request.model,
            self.timeout.as_millis(),
            self.max_retries,
            prompt_chars,
            max_tokens,
            request.max_tokens,
            effort.unwrap_or("-"),
        ));

        let mut body = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "max_tokens": max_tokens,
        });

        if let Some(effort) = effort {
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

        text_from(self.vendor, &payload)
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

    /// **THE 48-TOKEN TITLE BUDGET AGAINST THE MODEL THE TITLE ACTUALLY RUNS
    /// ON**, which is the case ADR 0214 did not measure.
    ///
    /// The title rides the assistant's job (ADR 0087) and that job runs
    /// `gpt-oss-120b`. Measured live on 2026-08-18: at `low` it spends 38
    /// reasoning tokens, so 48 leaves ten — enough for the language line and
    /// nothing else, and the reply comes back `finish_reason: length` with no
    /// title on it. The headroom is what makes the answer budget an answer
    /// budget.
    #[test]
    fn a_reasoning_model_gets_room_to_think_on_top_of_the_answer_budget() {
        let (budget, effort) = completion_budget("openai/gpt-oss-120b", 48);
        assert_eq!(effort, Some("low"));
        assert_eq!(budget, 48 + REASONING_HEADROOM_TOKENS);

        // The classifier asks for ten and `transform`'s correction floors at
        // forty; both sit under a reasoning model's own cost the same way.
        assert_eq!(completion_budget("openai/gpt-oss-20b", 10).0, 10 + REASONING_HEADROOM_TOKENS);
    }

    /// `none` is reasoning switched OFF, so there is nothing to leave room for —
    /// and a model the catalogue does not carry keeps the caller's budget
    /// untouched, because a typed override reaches the wire as written
    /// (ADR 0115) and inflating for a model we cannot say reasons is a guess.
    #[test]
    fn a_model_that_does_not_think_keeps_the_budget_it_was_given() {
        assert_eq!(completion_budget("qwen/qwen3.6-27b", 48), (48, Some("none")));
        assert_eq!(completion_budget("a-model-shipped-after-this-build", 48), (48, None));
    }

    /// **A REPLY THAT RAN OUT OF BUDGET IS REFUSED**, because what arrived is the
    /// beginning of an answer with nothing marking where it stops. This is the
    /// shape the title call got back for a day behind a `status=200`: one line,
    /// parseable, and not the answer.
    #[test]
    fn a_truncated_completion_is_a_failure_and_not_a_short_answer() {
        let cut: ChatCompletionPayload = serde_json::from_str(
            r#"{"choices":[{"message":{"content":"de\n"},"finish_reason":"length"}]}"#,
        )
        .expect("a payload");
        let error = text_from("Groq", &cut).expect_err("a refusal");
        assert!(matches!(error.kind, ProviderErrorKind::Parse));
        assert!(error.message.contains("token budget"), "{}", error.message);

        let finished: ChatCompletionPayload = serde_json::from_str(
            r#"{"choices":[{"message":{"content":"de\nCode Review Anfrage"},"finish_reason":"stop"}]}"#,
        )
        .expect("a payload");
        assert_eq!(
            text_from("Groq", &finished).expect("the text"),
            "de\nCode Review Anfrage"
        );

        // A vendor that reports no reason at all is not thereby truncated.
        let quiet: ChatCompletionPayload =
            serde_json::from_str(r#"{"choices":[{"message":{"content":"ja"}}]}"#).expect("a payload");
        assert_eq!(text_from("Your server", &quiet).expect("the text"), "ja");
    }

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
