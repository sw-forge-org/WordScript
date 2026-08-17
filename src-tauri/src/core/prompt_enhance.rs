use std::time::Instant;

use serde::{Deserialize, Serialize};

use super::profile_context::profile_context_line;
use super::providers::{create_chat_completion, ChatCompletionRequest, ChatMessage};
use super::runtime_log;
use super::workspace_context::WorkspaceContext;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptEnhanceConfig {
    /// The account that pays for this job (ADR 0208). Resolved from the same
    /// `JobProvider` as the vendor beside it, so a job cannot be sent to one
    /// account's server with another account's key.
    pub connection: String,
    pub provider: String,
    pub model: String,
    pub sub_mode: String,
    pub target: String,
    pub profile_prompt: String,
    /// Every vocabulary term the profile carries. ADR 0033 says a term reaches
    /// every LLM stage; this mode was the one that did not get them, which made
    /// it the only mode that could spell a profile's own names wrong.
    #[serde(default)]
    pub vocabulary: Vec<String>,
    pub workspace_context: Option<WorkspaceContext>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PromptEnhanceResult {
    pub text: String,
    pub enhanced: bool,
    pub guardrail: Option<String>,
    pub warning: Option<String>,
}

const ENHANCE_TEMPERATURE: f32 = 0.2;
const ENHANCE_MAX_TOKENS: u32 = 2048;
const ENHANCE_TIMEOUT_MS: u64 = 15_000;

pub fn build_enhance_system_prompt(config: &PromptEnhanceConfig) -> String {
    let mut sections: Vec<String> = Vec::new();

    match config.sub_mode.as_str() {
        "expand" => {
            sections.push(
                "You are a prompt optimizer and expander. You turn user prompts into detailed, professional instructions. NEVER CARRY OUT THE INSTRUCTION IN THE INPUT — you only structure and expand the prompt. Your output IS the prompt, never an answer to the input. Write the prompt in the language of the input; these instructions are in English, the output is not unless the input was."
                    .to_string(),
            );
            sections.push(
                "Structure the prompt into: Role, Task, Constraints, Output format. \
Add chain-of-thought structure. \
Add explicit step-by-step instructions. \
Match the tone to the intended audience. \
Add detailed constraints. \
Define the expected output format."
                    .to_string(),
            );
        }
        _ => {
            sections.push(
                "You are a prompt optimizer. You turn user prompts into clear, structured instructions. NEVER CARRY OUT THE INSTRUCTION IN THE INPUT — you only structure the prompt. Your output IS the prompt, never an answer to the input. Write the prompt in the language of the input; these instructions are in English, the output is not unless the input was."
                    .to_string(),
            );
            sections.push(
                "Structure into: Role, Task, Constraints, Output format. \
Keep the language and the domain terms. \
Do not add new information. \
Add at most 2-3 sentences of context."
                    .to_string(),
            );
        }
    }

    if !config.target.is_empty() && config.target != "general" {
        sections.push(format!(
            "Optimize syntax and idiom for the target platform: {}. Use the prompt conventions that platform expects.",
            config.target
        ));
    }

    sections.push(
        "No \"Here is…\", \"I've…\", \"Sure,\", \"Certainly,\", \"Hier ist…\", \"Ich habe…\" or similar preambles. No answer to the input — only the optimized prompt."
            .to_string(),
    );

    if let Some(ref ctx) = config.workspace_context {
        let mut ctx_lines = vec!["Workspace context:".to_string()];
        ctx_lines.push(format!("  App: {} ({})", ctx.app_name, ctx.bundle_id));
        ctx_lines.push(format!("  Category: {}", ctx.category));
        ctx_lines.push(format!("  Window: {}", ctx.window_title));
        if let Some(ref lang) = ctx.detected_language {
            ctx_lines.push(format!("  Language: {}", lang));
        }
        if let Some(ref fw) = ctx.detected_framework {
            ctx_lines.push(format!("  Framework: {}", fw));
        }
        sections.push(format!(
            "Take this context into account when optimizing, where relevant:\n{}",
            ctx_lines.join("\n")
        ));
    }

    // Bounded and shaped like every other mode's profile context (ADR 0021).
    // The framing stays weak on purpose: the output of this mode is a prompt
    // that travels to another tool, where WordScript has no guardrails left.
    if let Some(context) = profile_context_line(&config.profile_prompt) {
        sections.push(format!(
            "Profile context (take into account where relevant): {context}"
        ));
    }

    // The same source, one granularity finer, through the same budget helper so
    // both lines share one bound. Framed as weakly as the context line above and
    // for the same reason.
    if let Some(terms) = profile_context_line(&config.vocabulary.join("\n")) {
        sections.push(format!(
            "Names and terms from the profile (keep this spelling where they appear): {terms}"
        ));
    }

    sections.join("\n\n")
}

pub async fn apply_prompt_enhance(
    text: &str,
    config: &PromptEnhanceConfig,
) -> PromptEnhanceResult {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return PromptEnhanceResult {
            text: String::new(),
            enhanced: false,
            guardrail: Some("empty_input".to_string()),
            warning: None,
        };
    }

    let system_prompt = build_enhance_system_prompt(config);
    let user_content = if let Some(ref ctx) = config.workspace_context {
        format!(
            "Workspace context:\n  App: {} ({})\n  Category: {}\n  Window: {}\n  Language: {}\n  Framework: {}\n\nPrompt:\n{}",
            ctx.app_name,
            ctx.bundle_id,
            ctx.category,
            ctx.window_title,
            ctx.detected_language.as_deref().unwrap_or("unknown"),
            ctx.detected_framework.as_deref().unwrap_or("unknown"),
            trimmed
        )
    } else {
        trimmed.to_string()
    };

    let enhancement_started_at = Instant::now();

    runtime_log::record(format!(
        "[PromptEnhance] Start sub_mode={} target={} text_len={} has_workspace_context={}",
        config.sub_mode,
        config.target,
        trimmed.len(),
        config.workspace_context.is_some(),
    ));

    let request = ChatCompletionRequest {
        connection: config.connection.clone(),
        provider: config.provider.clone(),
        model: config.model.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_content,
            },
        ],
        temperature: ENHANCE_TEMPERATURE,
        max_tokens: ENHANCE_MAX_TOKENS,
        timeout_ms: Some(ENHANCE_TIMEOUT_MS),
        max_retries: Some(1),
    };

    match create_chat_completion(request).await {
        Ok(enhanced) => {
            runtime_log::record(format!(
                "[PromptEnhance] LLM call done elapsed_ms={} enhanced_len={}",
                enhancement_started_at.elapsed().as_millis(),
                enhanced.trim().len(),
            ));
            normalize_enhancement(trimmed, enhanced.trim(), &config.sub_mode)
        }
        Err(error) => {
            runtime_log::record(format!(
                "[PromptEnhance] LLM call failed: {}",
                error.message,
            ));
            PromptEnhanceResult {
                text: trimmed.to_string(),
                enhanced: false,
                guardrail: Some("llm_call_failed".to_string()),
                warning: Some(error.message),
            }
        }
    }
}

pub fn normalize_enhancement(
    original: &str,
    enhanced: &str,
    sub_mode: &str,
) -> PromptEnhanceResult {
    if enhanced.is_empty() {
        runtime_log::record(
            "[PromptEnhance] Guardrail: empty_enhancement original_len=0 enhanced_len=0"
                .to_string(),
        );
        return PromptEnhanceResult {
            text: original.to_string(),
            enhanced: false,
            guardrail: Some("empty_enhancement_fallback".to_string()),
            warning: None,
        };
    }

    let original_lower = original.to_lowercase();
    let enhanced_lower = enhanced.to_lowercase();

    let prompt_executes = is_prompt_executes_task(&enhanced_lower, &original_lower);
    if prompt_executes {
        runtime_log::record(format!(
            "[PromptEnhance] Guardrail: prompt_executes_task_fallback original_len={} enhanced_len={}",
            original.len(),
            enhanced.len(),
        ));
        return PromptEnhanceResult {
            text: original.to_string(),
            enhanced: false,
            guardrail: Some("prompt_executes_task_fallback".to_string()),
            warning: None,
        };
    }

    let original_lang = detect_primary_language(original);
    let enhanced_lang = detect_primary_language(enhanced);
    if let (Some(orig), Some(enh)) = (original_lang, enhanced_lang) {
        if orig != enh {
            runtime_log::record(format!(
                "[PromptEnhance] Guardrail: language_mismatch_fallback original_len={} enhanced_len={} original_lang={} enhanced_lang={}",
                original.len(),
                enhanced.len(),
                orig,
                enh,
            ));
            return PromptEnhanceResult {
                text: original.to_string(),
                enhanced: false,
                guardrail: Some("language_mismatch_fallback".to_string()),
                warning: None,
            };
        }
    }

    match sub_mode {
        "expand" => {
            let budget = original.len().saturating_mul(5).saturating_add(500);
            if enhanced.len() > budget {
                runtime_log::record(format!(
                    "[PromptEnhance] Guardrail: length_budget_expand_fallback original_len={} enhanced_len={} budget={}",
                    original.len(),
                    enhanced.len(),
                    budget,
                ));
                return PromptEnhanceResult {
                    text: original.to_string(),
                    enhanced: false,
                    guardrail: Some("length_budget_fallback".to_string()),
                    warning: None,
                };
            }
        }
        _ => {
            let budget = original.len().saturating_mul(2).saturating_add(200);
            if enhanced.len() > budget {
                runtime_log::record(format!(
                    "[PromptEnhance] Guardrail: length_budget_enhance_fallback original_len={} enhanced_len={} budget={}",
                    original.len(),
                    enhanced.len(),
                    budget,
                ));
                return PromptEnhanceResult {
                    text: original.to_string(),
                    enhanced: false,
                    guardrail: Some("length_budget_fallback".to_string()),
                    warning: None,
                };
            }
        }
    }

    if !word_overlap_ok(original, enhanced, 0.15) {
        runtime_log::record(format!(
            "[PromptEnhance] Guardrail: semantic_drift_fallback original_len={} enhanced_len={}",
            original.len(),
            enhanced.len(),
        ));
        return PromptEnhanceResult {
            text: original.to_string(),
            enhanced: false,
            guardrail: Some("semantic_drift_fallback".to_string()),
            warning: None,
        };
    }

    let mut warning: Option<String> = None;
    if sub_mode == "expand" {
        let has_role = enhanced_lower.contains("you are")
            || enhanced_lower.contains("du bist")
            || enhanced_lower.contains("act as")
            || enhanced_lower.contains("role:");
        if !has_role {
            runtime_log::record(format!(
                "[PromptEnhance] Warning: role_persisted original_len={} enhanced_len={}",
                original.len(),
                enhanced.len(),
            ));
            warning = Some("Role not detected in expanded prompt".to_string());
        }
    }

    let changed = enhanced != original;
    PromptEnhanceResult {
        text: if changed {
            enhanced.to_string()
        } else {
            original.to_string()
        },
        enhanced: changed,
        guardrail: None,
        warning,
    }
}

fn is_prompt_executes_task(enhanced: &str, original: &str) -> bool {
    const EXECUTION_STARTS: &[&str] = &[
        "hier ist",
        "ich habe",
        "here is",
        "i've",
        "i have",
        "sure,",
        "certainly",
    ];

    const EXECUTION_EMBEDDED: &[&str] = &[
        "hier ist der prompt",
        "hier ist der optimierte",
        "hier ist das ergebnis",
        "hier ist ihre",
        "ich erledige das",
        "ich führe das aus",
        "gerne erledige ich",
        "the result is",
        "i'll do that",
        "i have completed",
        "here is the result",
        "here's the optimized",
    ];

    let enhanced_trimmed = enhanced.trim();
    let original_trimmed = original.trim();

    let starts = EXECUTION_STARTS
        .iter()
        .any(|start| enhanced_trimmed.starts_with(start) && !original_trimmed.starts_with(start));

    if starts {
        return true;
    }

    EXECUTION_EMBEDDED
        .iter()
        .any(|phrase| enhanced.contains(phrase) && !original.contains(phrase))
}

pub fn detect_primary_language(text: &str) -> Option<&'static str> {
    let lower = text.to_lowercase();
    let words: Vec<&str> = lower.split_whitespace().collect();
    if words.is_empty() {
        return None;
    }

    const DE_WORDS: &[&str] = &[
        "der", "die", "das", "und", "ist", "ein", "eine", "für", "mit", "auf", "sich", "nicht",
        "auch", "werden", "können",
    ];

    const EN_WORDS: &[&str] = &[
        "the", "and", "is", "of", "to", "in", "that", "for", "it", "with", "on", "are", "be",
        "this", "have",
    ];

    let de_count = DE_WORDS
        .iter()
        .filter(|w| words.contains(w))
        .count();
    let en_count = EN_WORDS
        .iter()
        .filter(|w| words.contains(w))
        .count();

    if de_count == 0 && en_count == 0 {
        None
    } else if de_count >= en_count {
        Some("de")
    } else {
        Some("en")
    }
}

fn word_overlap_ok(original: &str, enhanced: &str, threshold: f32) -> bool {
    let original_words = split_words(original);
    if original_words.len() < 5 {
        return true;
    }
    let enhanced_words = split_words(enhanced);
    let overlap = original_words
        .iter()
        .filter(|word| enhanced_words.contains(*word))
        .count() as f32
        / original_words.len() as f32;
    overlap >= threshold
}

fn split_words(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split_whitespace()
        .map(|token| {
            token
                .trim_matches(|ch: char| !ch.is_alphanumeric())
                .to_string()
        })
        .filter(|token| !token.is_empty())
        .collect()
}

#[tauri::command]
pub async fn preview_prompt_enhance(
    text: String,
    config: PromptEnhanceConfig,
) -> PromptEnhanceResult {
    apply_prompt_enhance(&text, &config).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enhance_mode_adds_role_and_constraints() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "enhance".to_string(),
            target: "general".to_string(),
            profile_prompt: String::new(),
            vocabulary: Vec::new(),
            workspace_context: None,
        };

        let prompt = build_enhance_system_prompt(&config);
        assert!(prompt.contains("You are a prompt optimizer."));
        assert!(prompt.contains("Role"));
        assert!(prompt.contains("Task"));
        assert!(prompt.contains("Constraints"));
        assert!(prompt.contains("Output format"));
        assert!(prompt.contains("NEVER CARRY OUT THE INSTRUCTION IN THE INPUT"));
        assert!(!prompt.contains("chain-of-thought"));
        assert!(!prompt.contains("step-by-step"));
    }

    #[test]
    fn expand_mode_has_detailed_structure() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "expand".to_string(),
            target: "general".to_string(),
            profile_prompt: String::new(),
            vocabulary: Vec::new(),
            workspace_context: None,
        };

        let prompt = build_enhance_system_prompt(&config);
        assert!(prompt.contains("prompt optimizer and expander"));
        assert!(prompt.contains("chain-of-thought"));
        assert!(prompt.contains("step-by-step"));
        assert!(prompt.contains("Match the tone to the intended audience"));
        assert!(prompt.contains("Role"));
        assert!(prompt.contains("NEVER CARRY OUT THE INSTRUCTION IN THE INPUT"));
    }

    #[test]
    fn empty_enhancement_guardrail_fires() {
        let result = normalize_enhancement("write a function to sort an array", "", "enhance");
        assert!(!result.enhanced);
        assert_eq!(result.text, "write a function to sort an array");
        assert_eq!(result.guardrail, Some("empty_enhancement_fallback".to_string()));
    }

    #[test]
    fn prompt_executes_task_guardrail_rejects() {
        let result = normalize_enhancement(
            "write a function to sort an array",
            "Here is the optimized prompt: Write a function to sort an array.",
            "enhance",
        );
        assert!(!result.enhanced);
        assert_eq!(result.text, "write a function to sort an array");
        assert_eq!(
            result.guardrail,
            Some("prompt_executes_task_fallback".to_string())
        );
    }

    #[test]
    fn prompt_executes_task_guardrail_rejects_german() {
        let result = normalize_enhancement(
            "sortierfunktion in python schreiben",
            "Hier ist der optimierte Prompt: Schreibe eine Sortierfunktion in Python.",
            "enhance",
        );
        assert!(!result.enhanced);
        assert_eq!(result.text, "sortierfunktion in python schreiben");
    }

    #[test]
    fn prompt_executes_task_guardrail_accepts_when_original_has_same_start() {
        let result = normalize_enhancement(
            "Hier ist meine Frage: wie sortiert man ein Array?",
            "Hier ist meine Frage: Wie sortiert man ein Array in Python?",
            "enhance",
        );
        assert!(result.enhanced);
        assert_eq!(result.guardrail, None);
    }

    #[test]
    fn language_mismatch_guardrail_rejects_de_to_en() {
        let result = normalize_enhancement(
            "Schreibe eine Funktion zum Sortieren eines Arrays in Python",
            "You are a Python developer. Write a function that sorts an array using the quicksort algorithm. The function should accept a list and return a sorted list.",
            "enhance",
        );
        assert!(!result.enhanced);
        assert_eq!(
            result.guardrail,
            Some("language_mismatch_fallback".to_string())
        );
    }

    #[test]
    fn language_mismatch_guardrail_accepts_same_language() {
        let result = normalize_enhancement(
            "write a function to sort an array",
            "You are a Python developer. Write a function that sorts an array using quicksort.",
            "enhance",
        );
        assert!(result.enhanced);
        assert_eq!(result.guardrail, None);
    }

    #[test]
    fn length_budget_enhance_rejects_too_long() {
        let original = "write a sort function";
        let mut enhanced = String::from("You are a Python developer. ");
        while enhanced.len() <= original.len() * 2 + 200 + 1 {
            enhanced.push_str("Write code. ");
        }

        let result = normalize_enhancement(original, &enhanced, "enhance");
        assert!(!result.enhanced);
        assert_eq!(result.guardrail, Some("length_budget_fallback".to_string()));
        assert_eq!(result.text, original);
    }

    #[test]
    fn length_budget_enhance_allows_within_budget() {
        let original = "write a sort function in python";
        let enhanced = "You are a Python developer. Write a function that sorts a list. Use Python 3.";
        assert!(enhanced.len() <= original.len() * 2 + 200);

        let result = normalize_enhancement(original, enhanced, "enhance");
        assert!(result.enhanced);
        assert_eq!(result.guardrail, None);
    }

    #[test]
    fn length_budget_expand_allows_up_to_5x() {
        let original = "write a sort function";
        let mut enhanced = String::from("You are a Python developer. ");
        while enhanced.len() < original.len() * 4 {
            enhanced.push_str("Write a detailed sorting function. ");
        }

        assert!(enhanced.len() <= original.len() * 5 + 500);

        let result = normalize_enhancement(original, &enhanced, "expand");
        assert!(result.enhanced);
        assert_eq!(result.guardrail, None);
    }

    #[test]
    fn length_budget_expand_rejects_beyond_5x() {
        let original = "write a sort function";
        let mut enhanced = String::from("You are a Python developer.");
        while enhanced.len() <= original.len() * 5 + 500 + 1 {
            enhanced.push_str(" Write more code and add more instructions for the sorting function.");
        }

        let result = normalize_enhancement(original, &enhanced, "expand");
        assert!(!result.enhanced);
        assert_eq!(result.guardrail, Some("length_budget_fallback".to_string()));
    }

    #[test]
    fn semantic_drift_guardrail_rejects_completely_different_output() {
        let result = normalize_enhancement(
            "write a python module with classes for data export",
            "The sun rises in the east. Water boils at high temperatures. Birds fly south for winter.",
            "enhance",
        );
        assert!(!result.enhanced);
        assert_eq!(
            result.guardrail,
            Some("semantic_drift_fallback".to_string())
        );
    }

    #[test]
    fn semantic_drift_guardrail_accepts_similar_output() {
        let result = normalize_enhancement(
            "write a function to sort an array in python using quicksort",
            "You are a Python developer. Write a function that implements quicksort to sort an array in Python. The function should accept a list and return a sorted list.",
            "enhance",
        );
        assert!(result.enhanced);
        assert_eq!(result.guardrail, None);
    }

    #[test]
    fn role_persisted_warning_fires_when_no_role_in_expand() {
        let result = normalize_enhancement(
            "write a function to sort an array",
            "Task: Write a function to sort an array.\nConstraints: Use Python. Output: sorted list.",
            "expand",
        );
        assert!(result.enhanced);
        assert!(result.warning.is_some());
        assert!(result.warning.unwrap().contains("Role not detected"));
    }

    #[test]
    fn role_persisted_no_warning_when_role_present_in_expand() {
        let result = normalize_enhancement(
            "write a function to sort an array",
            "You are a Python developer.\nTask: Write a function to sort an array.\nConstraints: Use Python.",
            "expand",
        );
        assert!(result.enhanced);
        assert_eq!(result.warning, None);
    }

    #[test]
    fn role_persisted_no_warning_in_enhance_mode() {
        let result = normalize_enhancement(
            "write a function to sort an array",
            "Role: Developer. Task: Write a sorting function.",
            "enhance",
        );
        assert!(result.enhanced);
        assert_eq!(result.warning, None);
    }

    #[test]
    fn enhance_keeps_original_language_for_mixed_input() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "enhance".to_string(),
            target: "claude_code".to_string(),
            profile_prompt: String::new(),
            vocabulary: Vec::new(),
            workspace_context: None,
        };

        let prompt = build_enhance_system_prompt(&config);
        assert!(prompt.contains("Keep the language and the domain terms"));
        assert!(prompt.contains("claude_code"));
    }

    #[test]
    fn workspace_context_injected_into_system_prompt() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "enhance".to_string(),
            target: "general".to_string(),
            profile_prompt: String::new(),
            vocabulary: Vec::new(),
            workspace_context: Some(WorkspaceContext {
                app_name: "VS Code".to_string(),
                bundle_id: "com.microsoft.VSCode".to_string(),
                category: "ide".to_string(),
                detected_language: Some("TypeScript".to_string()),
                detected_framework: Some("React".to_string()),
                window_title: "src/App.tsx — my-project".to_string(),
                browser_domain: None,
            }),
        };

        let prompt = build_enhance_system_prompt(&config);
        assert!(prompt.contains("VS Code"));
        assert!(prompt.contains("com.microsoft.VSCode"));
        assert!(prompt.contains("ide"));
        assert!(prompt.contains("TypeScript"));
        assert!(prompt.contains("React"));
        assert!(prompt.contains("src/App.tsx"));
    }

    /// ADR 0033 makes a term profile context for *every* LLM stage. This mode
    /// silently had no channel for them at all, so it was the one place a
    /// profile's own names could come back respelled.
    #[test]
    fn vocabulary_terms_reach_the_enhance_prompt() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "enhance".to_string(),
            target: "general".to_string(),
            profile_prompt: "release scope".to_string(),
            vocabulary: vec!["Kubernetes".to_string(), "Statuspage".to_string()],
            workspace_context: None,
        };

        let prompt = build_enhance_system_prompt(&config);
        assert!(prompt.contains("Kubernetes"));
        assert!(prompt.contains("Statuspage"));
        // The context line stays its own line: terms are one granularity finer,
        // not a replacement for the topics.
        assert!(prompt.contains("release scope"));
    }

    /// The terms line goes through the same budget helper as the context line,
    /// so a pasted wall of terms cannot push the instruction block out of shape.
    #[test]
    fn the_vocabulary_line_is_bounded_like_the_context_line() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "enhance".to_string(),
            target: "general".to_string(),
            profile_prompt: String::new(),
            vocabulary: (0..200).map(|index| format!("Term{index:03}")).collect(),
            workspace_context: None,
        };

        let prompt = build_enhance_system_prompt(&config);
        let line = prompt
            .lines()
            .find(|line| line.starts_with("Names and terms from the profile"))
            .expect("the terms line is present");
        let rendered = line
            .split_once(": ")
            .expect("the terms line carries a value")
            .1;

        assert!(
            rendered.chars().count() <= super::super::profile_context::MAX_CONTEXT_CHARS,
            "terms line spent {} chars",
            rendered.chars().count()
        );
    }

    #[test]
    fn no_vocabulary_means_no_terms_line() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "enhance".to_string(),
            target: "general".to_string(),
            profile_prompt: "release scope".to_string(),
            vocabulary: Vec::new(),
            workspace_context: None,
        };

        assert!(!build_enhance_system_prompt(&config).contains("Names and terms"));
    }

    #[test]
    fn workspace_context_not_injected_when_none() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "enhance".to_string(),
            target: "general".to_string(),
            profile_prompt: "python expert".to_string(),
            vocabulary: Vec::new(),
            workspace_context: None,
        };

        let prompt = build_enhance_system_prompt(&config);
        assert!(!prompt.contains("Workspace-Kontext"));
        assert!(prompt.contains("python expert"));
    }

    #[test]
    fn detect_primary_language_returns_de_for_german_text() {
        assert_eq!(detect_primary_language("das ist ein Test und die Datei ist neu"), Some("de"));
    }

    #[test]
    fn detect_primary_language_returns_en_for_english_text() {
        assert_eq!(
            detect_primary_language("the quick brown fox and the lazy dog have to be with this"),
            Some("en")
        );
    }

    #[test]
    fn detect_primary_language_returns_none_for_ambiguous() {
        assert_eq!(detect_primary_language("foo bar baz qux"), None);
    }

    #[test]
    fn detect_primary_language_returns_none_for_empty() {
        assert_eq!(detect_primary_language(""), None);
    }

    #[tokio::test]
    async fn empty_input_returns_immediately() {
        let config = PromptEnhanceConfig {
            connection: "connection-default".to_string(),
            provider: "groq".to_string(),
            model: "test-model".to_string(),
            sub_mode: "enhance".to_string(),
            target: "general".to_string(),
            profile_prompt: String::new(),
            vocabulary: Vec::new(),
            workspace_context: None,
        };

        let result = apply_prompt_enhance("", &config).await;
        assert!(!result.enhanced);
        assert_eq!(result.guardrail, Some("empty_input".to_string()));
        assert!(result.text.is_empty());
    }
}
