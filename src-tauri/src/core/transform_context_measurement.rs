//! Measurement scaffolding for one open question: does widening the profile
//! context in the correction prompt from the filtered subset to the full
//! profile make cleanup introduce content the user never dictated?
//!
//! This is not product code and never compiles into a release build. It exists
//! because the alternative is asserting an answer, which is the failure mode
//! ADR 0020 was written about.
//!
//! Run explicitly — it spends real Groq calls and needs the key in the OS
//! secret store:
//!
//! ```text
//! cargo test measure_profile_context_width -- --ignored --nocapture
//! ```
//!
//! Both arms share one system prompt except for the single `Kontextbegriffe:`
//! line, so the diff between them is exactly the variable under test. The
//! prompt itself comes from the production builder rather than a copy.
//!
//! Since ADR 0021 the *widened* arm is what production builds. The narrow arm
//! is reconstructed here from the transcription hint filter, which is where it
//! came from — so the comparison stays runnable if the question is reopened.

use super::*;
use super::super::config::ProcessingMode;
use super::super::transcription_hints::filter_profile_hint_lines;

use std::path::PathBuf;
use std::time::Duration;

const PROFILE_ID: &str = "curated-product-engineering";
const CONTEXT_LINE_PREFIX: &str = "Kontextbegriffe: ";
const PACING: Duration = Duration::from_millis(700);

fn wordscript_config_dir() -> PathBuf {
    PathBuf::from(std::env::var("HOME").expect("HOME"))
        .join(".config")
        .join("WordScript")
}

fn read_json(path: PathBuf) -> serde_json::Value {
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("read {}: {error}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("parse {}: {error}", path.display()))
}

fn measurement_profile(config: &serde_json::Value) -> &serde_json::Value {
    config["text_profiles"]
        .as_array()
        .expect("text_profiles")
        .iter()
        .find(|profile| profile["id"] == PROFILE_ID)
        .unwrap_or_else(|| panic!("profile {PROFILE_ID} not in config.json"))
}

fn dictionary_entries(profile: &serde_json::Value) -> Vec<DictionaryEntry> {
    profile["dictionary_entries"]
        .as_array()
        .map(|entries| {
            entries
                .iter()
                .map(|entry| DictionaryEntry {
                    id: entry["id"].as_str().unwrap_or_default().to_string(),
                    phrase: entry["phrase"].as_str().unwrap_or_default().to_string(),
                    replace_with: entry["replace_with"].as_str().unwrap_or_default().to_string(),
                })
                .collect()
        })
        .unwrap_or_default()
}

/// The narrow arm: the pre-ADR-0021 behaviour, where the correction prompt
/// borrowed the transcription hint filter and kept only lines that look like
/// tokens Whisper could mis-hear.
fn narrow_context_line(profile_prompt: &str) -> String {
    let hints: Vec<String> = filter_profile_hint_lines(profile_prompt)
        .accepted
        .iter()
        .map(|hint| truncate_line(hint))
        .collect();

    format!("{CONTEXT_LINE_PREFIX}{}", hints.join(" | "))
}

/// Swaps the one context line, asserting it was there and unique. A silent
/// no-op swap would make both arms identical and the measurement meaningless.
fn swap_context_line(system_prompt: &str, replacement: &str) -> String {
    let matches = system_prompt
        .lines()
        .filter(|line| line.starts_with(CONTEXT_LINE_PREFIX))
        .count();
    assert_eq!(
        matches, 1,
        "expected exactly one context line to swap, found {matches}"
    );

    system_prompt
        .lines()
        .map(|line| {
            if line.starts_with(CONTEXT_LINE_PREFIX) {
                replacement
            } else {
                line
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Mirrors the request `apply_native_transform` builds, including the
/// word-count-dependent model and timeout, so both arms are measured under the
/// settings the product actually uses.
fn correction_request(
    system_prompt: String,
    text: &str,
    config: &NativeTransformConfig,
) -> ChatCompletionRequest {
    let word_count = text.split_whitespace().count();
    let model = if word_count > 300 {
        DEFAULT_CORRECTION_MODEL.to_string()
    } else {
        config.correction_model.clone()
    };
    let timeout_ms = if word_count > 300 { 30_000 } else { 8_000 };

    ChatCompletionRequest {
        provider: config.provider.clone(),
        model,
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: text.to_string(),
            },
        ],
        temperature: 0.0,
        max_tokens: (text.len().saturating_mul(2).max(40)).min(4_096) as u32,
        timeout_ms: Some(timeout_ms),
        max_retries: Some(1),
    }
}

#[tokio::test]
#[ignore = "spends real Groq calls; run explicitly with --ignored"]
async fn measure_profile_context_width() {
    let config_dir = wordscript_config_dir();
    let app_config = read_json(config_dir.join("config.json"));
    let history = read_json(config_dir.join("history.json"));
    let profile = measurement_profile(&app_config);

    let profile_prompt = profile["prompt"].as_str().unwrap_or_default().to_string();
    let preset = ProcessingMode::Cleanup.transform_preset();

    let transform_config = NativeTransformConfig {
        provider: "groq".to_string(),
        profile_prompt: profile_prompt.clone(),
        dictionary_entries: dictionary_entries(profile),
        snippet_entries: Vec::new(),
        post_process: preset.post_process,
        correction_model: app_config["correction_model"]
            .as_str()
            .unwrap_or(DEFAULT_CORRECTION_MODEL)
            .to_string(),
        filter_fillers: preset.filter_fillers,
        professionalize: preset.professionalize,
        language: String::new(),
        language_locked: false,
        low_confidence_segments: false,
        workspace_hint: None,
    };

    // Production builds the widened arm since ADR 0021; the narrow arm is the
    // reconstructed predecessor.
    let widened_system = correction_system_prompt(&transform_config);
    let narrow_system = swap_context_line(&widened_system, &narrow_context_line(&profile_prompt));
    assert_ne!(narrow_system, widened_system, "arms must differ");

    let narrow_hints: Vec<String> = filter_profile_hint_lines(&profile_prompt)
        .accepted
        .iter()
        .map(|hint| truncate_line(hint))
        .collect();
    let widened_hints = super::super::profile_context::profile_context_lines(&profile_prompt);

    eprintln!("profile      = {PROFILE_ID}");
    eprintln!("model        = {}", transform_config.correction_model);
    eprintln!(
        "narrow arm   = {} hints: {:?}",
        narrow_hints.len(),
        narrow_hints
    );
    eprintln!(
        "widened arm  = {} hints: {:?}",
        widened_hints.len(),
        widened_hints
    );

    let entries: Vec<&serde_json::Value> = history
        .as_array()
        .expect("history array")
        .iter()
        .filter(|entry| {
            entry["raw_transcript"]
                .as_str()
                .map(|text| !text.trim().is_empty())
                .unwrap_or(false)
        })
        .collect();

    eprintln!("entries      = {}\n", entries.len());

    let mut records: Vec<serde_json::Value> = Vec::new();

    for (index, entry) in entries.iter().enumerate() {
        let raw = entry["raw_transcript"].as_str().unwrap().trim().to_string();

        let narrow = call_arm(&narrow_system, &raw, &transform_config).await;
        tokio::time::sleep(PACING).await;
        let widened = call_arm(&widened_system, &raw, &transform_config).await;
        tokio::time::sleep(PACING).await;

        let differs = match (&narrow, &widened) {
            (Ok(a), Ok(b)) => Some(a.guarded_text != b.guarded_text),
            _ => None,
        };

        eprintln!(
            "[{:>3}/{}] {} {}",
            index + 1,
            entries.len(),
            match differs {
                Some(true) => "DIFF",
                Some(false) => "same",
                None => "ERR ",
            },
            raw.chars().take(60).collect::<String>().replace('\n', " "),
        );

        records.push(serde_json::json!({
            "id": entry["id"],
            "raw": raw,
            "shipped": entry["transformed_transcript"],
            "narrow": arm_json(&narrow),
            "widened": arm_json(&widened),
        }));
    }

    // Defaults next to the data it derives from, not to a shared temp dir: the
    // records carry the full raw dictation history in clear text.
    let out = std::env::var("WORDSCRIPT_MEASUREMENT_OUT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| config_dir.join("context-width-measurement.json"));
    std::fs::write(
        &out,
        serde_json::to_string_pretty(&serde_json::json!({
            "profile": PROFILE_ID,
            "model": transform_config.correction_model,
            "narrow_hints": narrow_hints,
            "widened_hints": widened_hints,
            "narrow_system_prompt": narrow_system,
            "widened_system_prompt": widened_system,
            "records": records,
        }))
        .unwrap(),
    )
    .unwrap_or_else(|error| panic!("write {}: {error}", out.display()));

    eprintln!("\nwrote {}", out.display());
}

struct ArmOutcome {
    raw_reply: String,
    guarded_text: String,
    applied_rules: Vec<String>,
}

fn arm_json(outcome: &Result<ArmOutcome, String>) -> serde_json::Value {
    match outcome {
        Ok(value) => serde_json::json!({
            "raw_reply": value.raw_reply,
            "guarded_text": value.guarded_text,
            "applied_rules": value.applied_rules,
        }),
        Err(error) => serde_json::json!({ "error": error }),
    }
}

/// Runs one arm through the provider and then through the production
/// guardrails, so the record carries both what the model said and what the
/// user would have seen.
async fn call_arm(
    system_prompt: &str,
    raw: &str,
    config: &NativeTransformConfig,
) -> Result<ArmOutcome, String> {
    let request = correction_request(system_prompt.to_string(), raw, config);

    match create_chat_completion(request).await {
        Ok(reply) => {
            let normalized = normalize_correction(raw, reply.trim(), config);
            Ok(ArmOutcome {
                raw_reply: reply.trim().to_string(),
                guarded_text: normalized.text,
                applied_rules: normalized.applied_rules,
            })
        }
        Err(error) => Err(error.message),
    }
}
