use std::time::Instant;

use super::config::{DictionaryEntry, SnippetEntry};
use super::profile_context::{profile_context_line, truncate_line};
use super::providers::{create_chat_completion, ChatCompletionRequest, ChatMessage};
use super::runtime_log;
use super::workspace_context::WorkspaceContext;

/// Same bound the correction prompt puts on its dictionary block. A prompt that
/// grows with the profile is a prompt nobody has measured.
const MAX_DICTIONARY_ENTRIES: usize = 12;
const MAX_SNIPPET_ENTRIES: usize = 12;

// Common imperative verb stems in English and German that signal an agent instruction.
const IMPERATIVE_VERB_STEMS: &[&str] = &[
    "write", "schreib",
    "draft", "verfass",
    "compose", "erstell",
    "create", "mach",
    "summarize", "fass", "zusammenfass",
    "translate", "übersetz", "uebersetz",
    "rewrite", "umschreib",
    "revise", "überarbeit",
    "explain", "erklär",
    "format", "formatier",
    "correct", "korrigier",
    "generate", "generier",
    "list", "liste", "auflist",
    "answer", "beantworte",
    "respond", "antworte",
    "help", "hilf",
    "send", "schick",
    "search", "such",
    "find", "find",
    "convert", "konvertier",
    "check", "prüf",
];

// Score threshold above which we skip the LLM classifier and route directly to agent.
pub const HEURISTIC_CERTAIN_THRESHOLD: f32 = 0.75;

// Lower bound of the uncertain zone. Below it the text is dictation and no
// classifier call is worth making; between the two the LLM decides.
pub const HEURISTIC_UNCERTAIN_THRESHOLD: f32 = 0.20;

// Maximum characters sent to the intent-classifier LLM.
const CLASSIFIER_INPUT_MAX_CHARS: usize = 400;

// Timeout for the lightweight intent-classification LLM call.
const CLASSIFIER_TIMEOUT_MS: u64 = 3_000;

// Max tokens the classifier may return — we only need "yes" or "no".
const CLASSIFIER_MAX_TOKENS: u32 = 10;

#[derive(Debug, Clone, Default)]
pub struct AgentConfig {
    pub provider: String,
    pub agent_name: String,
    pub agent_model: String,
    pub profile_label: String,
    pub profile_prompt: String,
    pub stt_hints: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
    /// The foreground app, when the active profile allows collecting it. A weak
    /// situational signal in the profile-context block, never an instruction.
    pub workspace_context: Option<WorkspaceContext>,
}

#[derive(Debug, Clone)]
pub struct AgentResult {
    pub text: String,
    pub was_agent: bool,
    pub warning: Option<String>,
}

/// Heuristic intent detection — O(n) word scan, no LLM call.
///
/// Scores 0.0 (definitely dictation) → 1.0 (definitely agent instruction).
///
/// Agent-name signal is tiered by position:
///   words 1–4  = +0.55  (user opens with the agent name → strong address)
///   words 5–10 = +0.35  (name after a short intro phrase like "also ich dachte…")
///   anywhere   = +0.15  (incidental mention, weak signal)
///
/// Imperative-verb signal is tiered similarly:
///   first word = +0.45  (sentence starts with a command)
///   words 2–10 = +0.25  (verb appears later, e.g. "Kannst du … schreiben?")
pub fn detect_agent_intent_heuristic(text: &str, agent_name: &str) -> f32 {
    let lower = text.trim().to_lowercase();
    if lower.is_empty() {
        return 0.0;
    }

    let words: Vec<&str> = lower.split_whitespace().collect();
    let first_word = words.first().copied().unwrap_or("");
    let mut score: f32 = 0.0;

    // ── Agent-name signal ────────────────────────────────────────────────────
    let agent_lower = agent_name.trim().to_lowercase();
    if !agent_lower.is_empty() {
        let first_4: String = words.iter().take(4).cloned().collect::<Vec<_>>().join(" ");
        let first_10: String = words.iter().take(10).cloned().collect::<Vec<_>>().join(" ");

        if first_4.contains(&agent_lower) {
            score += 0.55;
        } else if first_10.contains(&agent_lower) {
            // e.g. "Also ich dachte mir, WordScript, schreib..."
            score += 0.35;
        } else if lower.contains(&agent_lower) {
            // Name appears late — weak signal; probably incidental mention.
            score += 0.15;
        }
    }

    // ── Imperative-verb signal ────────────────────────────────────────────────
    let first_is_imperative = IMPERATIVE_VERB_STEMS
        .iter()
        .any(|stem| first_word.starts_with(stem));

    if first_is_imperative {
        score += 0.45;
    } else {
        // Check within the first 10 words — covers "Kannst du mir bitte … schreiben?"
        let first_10_words: String = words.iter().take(10).cloned().collect::<Vec<_>>().join(" ");
        let has_early_imperative = IMPERATIVE_VERB_STEMS
            .iter()
            .any(|stem| first_10_words.contains(stem));
        if has_early_imperative {
            score += 0.25;
        }
    }

    // Slight penalty for very long texts — agent instructions are usually concise.
    if words.len() > 60 {
        score -= 0.15;
    } else if words.len() > 30 {
        score -= 0.05;
    }

    score.clamp(0.0, 1.0)
}

/// Returns true when the transcript opens with (or contains within the first
/// few words) an imperative verb stem. Used by the auto-mode router as a
/// lightweight signal that the user might be issuing an instruction rather
/// than dictating prose.
pub fn text_starts_with_imperative(text: &str) -> bool {
    let lower = text.trim().to_lowercase();
    if lower.is_empty() {
        return false;
    }
    let words: Vec<&str> = lower.split_whitespace().collect();
    let first_word = words.first().copied().unwrap_or("");
    if IMPERATIVE_VERB_STEMS
        .iter()
        .any(|stem| first_word.starts_with(stem))
    {
        return true;
    }
    let first_10_words: String = words.iter().take(10).cloned().collect::<Vec<_>>().join(" ");
    IMPERATIVE_VERB_STEMS
        .iter()
        .any(|stem| first_10_words.contains(stem))
}

/// Hybrid intent detection: heuristic first, LLM classifier only in uncertain zone.
///
/// Returns `true` if the text should be routed to agent execution.
pub async fn detect_agent_intent(text: &str, config: &AgentConfig) -> bool {
    let heuristic_score = detect_agent_intent_heuristic(text, &config.agent_name);

    if heuristic_score >= HEURISTIC_CERTAIN_THRESHOLD {
        runtime_log::record(format!(
            "[Agent] Heuristic AGENT path score={:.2} text_len={}",
            heuristic_score,
            text.len()
        ));
        return true;
    }
    if heuristic_score < HEURISTIC_UNCERTAIN_THRESHOLD {
        return false;
    }

    // Uncertain zone (0.20 – 0.74) — let the LLM decide.
    let snippet: String = text.chars().take(CLASSIFIER_INPUT_MAX_CHARS).collect();
    let agent_name = &config.agent_name;
    let system_prompt = format!(
        "Du bist ein Intent-Klassifikator für eine Diktat-App.\n\
Der Nutzer diktiert entweder normalen Text (Diktat) oder richtet eine direkte Anweisung an den KI-Assistenten \"{agent_name}\".\n\
\n\
Entscheide nach diesen Regeln:\n\
- \"yes\" nur wenn der Nutzer {agent_name} direkt adressiert UND eine Aufgabe beauftragt (z.B. \"Hey {agent_name}, schreib…\" oder \"{agent_name}, erstell mir…\").\n\
- \"no\" wenn {agent_name} nur im Fließtext erwähnt wird, ohne direkten Auftrag.\n\
- \"no\" wenn es ein Imperativ ohne {agent_name}-Adressierung ist — das ist Diktat, kein Befehl an {agent_name}.\n\
- Bei Unsicherheit: \"no\".\n\
\n\
Antworte ausschließlich mit \"yes\" oder \"no\". Kein weiterer Text."
    );

    let request = ChatCompletionRequest {
        provider: config.provider.clone(),
        model: config.agent_model.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: snippet,
            },
        ],
        temperature: 0.0,
        max_tokens: CLASSIFIER_MAX_TOKENS,
        timeout_ms: Some(CLASSIFIER_TIMEOUT_MS),
        max_retries: Some(0),
    };

    let started = Instant::now();
    match create_chat_completion(request).await {
        Ok(reply) => {
            let decision = reply.trim().to_lowercase().starts_with("yes");
            runtime_log::record(format!(
                "[Agent] LLM classifier reply={:?} decision={} elapsed_ms={}",
                reply.trim(),
                decision,
                started.elapsed().as_millis(),
            ));
            decision
        }
        Err(err) => {
            // Safe fallback: classifier failure → do not route to agent.
            runtime_log::record(format!(
                "[Agent] Classifier LLM error — falling back to cleanup: {err:?}"
            ));
            false
        }
    }
}

/// Assembles the full profile context string from all profile fields.
///
/// Only non-empty sections are included. The resulting string is passed to the
/// agent LLM as "profile context" so it can tailor its output to the domain.
///
/// The profile's free-text fields run through `profile_context` like every other
/// mode's do — same bound, same shape. What differs here is the framing: an
/// agent *produces* text rather than correcting it, so the context is the
/// domain the output lives in, not a list of terms to leave alone (ADR 0021).
pub(crate) fn build_profile_context(config: &AgentConfig) -> String {
    let mut parts: Vec<String> = Vec::new();

    if !config.profile_label.trim().is_empty() {
        parts.push(format!("Profil: {}", config.profile_label.trim()));
    }
    if let Some(context) = profile_context_line(&config.profile_prompt) {
        parts.push(format!("Kontext: {context}"));
    }
    if let Some(terms) = profile_context_line(&config.stt_hints) {
        parts.push(format!("Fachbegriffe: {terms}"));
    }
    if !config.dictionary_entries.is_empty() {
        let lines: Vec<String> = config
            .dictionary_entries
            .iter()
            .filter(|e| !e.phrase.trim().is_empty())
            .map(|e| {
                format!(
                    "  {} → {}",
                    truncate_line(e.phrase.trim()),
                    truncate_line(e.replace_with.trim())
                )
            })
            .take(MAX_DICTIONARY_ENTRIES)
            .collect();
        if !lines.is_empty() {
            parts.push(format!("Bekannte Entitäten:\n{}", lines.join("\n")));
        }
    }
    if !config.snippet_entries.is_empty() {
        let lines: Vec<String> = config
            .snippet_entries
            .iter()
            .filter(|e| !e.expansion.trim().is_empty())
            .map(|e| format!("  {} (\"{}\"): {}", e.label.trim(), e.trigger.trim(), e.expansion.trim()))
            .take(MAX_SNIPPET_ENTRIES)
            .collect();
        if !lines.is_empty() {
            parts.push(format!("Inhalts-Bausteine:\n{}", lines.join("\n")));
        }
    }
    // Last and weakest: where the user is writing, not what they want written.
    if let Some(context) = config
        .workspace_context
        .as_ref()
        .filter(|context| !context.app_name.trim().is_empty())
    {
        let app = context.app_name.trim();
        let category = context.category.trim();
        let target = if category.is_empty() {
            app.to_string()
        } else {
            format!("{app} ({category})")
        };
        parts.push(format!(
            "Zielanwendung: {target}. Nur ein schwaches Situationssignal — niemals Inhalt daraus ableiten."
        ));
    }

    parts.join("\n\n")
}

/// Execute the agent instruction and return the composed result text.
pub async fn apply_agent_transform(text: &str, config: &AgentConfig) -> AgentResult {
    let agent_name = &config.agent_name;
    let system_prompt = format!(
        "Du bist \"{agent_name}\", ein KI-Assistent, der direkt in eine Sprache-zu-Text-Diktat-App integriert ist. \
Der Nutzer hat dich mit einer Sprachanweisung angesprochen. \
Führe die Anweisung präzise und vollständig aus.\n\
- Antworte nur mit dem fertigen Ergebnis-Text (keine Einleitung, keine Erklärung, kein \"Hier ist...\").\n\
- Falls ein Kontext angegeben ist (Zielpublikum, Profil), berücksichtige ihn.\n\
- Sprachstil: Passe Sprache und Ton an die Anweisung an."
    );

    let profile_context = build_profile_context(config);
    let user_content = if profile_context.is_empty() {
        text.to_string()
    } else {
        format!("{}\n\nAnweisung: {}", profile_context, text)
    };

    let request = ChatCompletionRequest {
        provider: config.provider.clone(),
        model: config.agent_model.clone(),
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
        temperature: 0.3,
        max_tokens: 2048,
        timeout_ms: Some(30_000),
        max_retries: Some(1),
    };

    let started = Instant::now();
    match create_chat_completion(request).await {
        Ok(reply) => {
            let result = reply.trim().to_string();
            runtime_log::record(format!(
                "[Agent] Execution done elapsed_ms={} output_len={}",
                started.elapsed().as_millis(),
                result.len(),
            ));
            AgentResult {
                text: result,
                was_agent: true,
                warning: None,
            }
        }
        Err(err) => {
            runtime_log::record(format!("[Agent] Execution error: {err:?}"));
            AgentResult {
                text: text.to_string(),
                was_agent: false,
                warning: Some(format!("Agent execution failed: {err:?}")),
            }
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Certain AGENT path ────────────────────────────────────────────────────

    #[test]
    fn agent_name_early_and_imperative_is_certain() {
        // Agent name in first 4 words + imperative in first 10 → certain (≥0.75).
        let score = detect_agent_intent_heuristic("Hey WordScript, schreib eine E-Mail an Felix", "WordScript");
        assert!(score >= HEURISTIC_CERTAIN_THRESHOLD, "score={score}");
    }

    #[test]
    fn agent_name_first_word_is_certain() {
        // Name as opener + verb later → certain.
        let score = detect_agent_intent_heuristic("WordScript, write me an email to Felix about the project", "WordScript");
        assert!(score >= HEURISTIC_CERTAIN_THRESHOLD, "score={score}");
    }

    #[test]
    fn custom_agent_name_and_imperative_is_certain() {
        let score = detect_agent_intent_heuristic("Hey Jarvis, write a summary", "Jarvis");
        assert!(score >= HEURISTIC_CERTAIN_THRESHOLD, "score={score}");
    }

    // ── Uncertain zone — LLM classifier is called ────────────────────────────

    #[test]
    fn imperative_start_without_name_is_uncertain() {
        // Imperative verb alone (no agent name) → uncertain zone (0.20–0.74) → LLM decides.
        let score = detect_agent_intent_heuristic("Write an email to Felix about the meeting", "WordScript");
        assert!(score >= 0.20 && score < HEURISTIC_CERTAIN_THRESHOLD, "score={score}");
    }

    #[test]
    fn german_imperative_without_name_is_uncertain() {
        let score = detect_agent_intent_heuristic("Schreib eine E-Mail an Felix bezüglich der Deadline", "WordScript");
        assert!(score >= 0.20 && score < HEURISTIC_CERTAIN_THRESHOLD, "score={score}");
    }

    #[test]
    fn agent_name_after_intro_phrase_with_verb_is_uncertain() {
        // "Also ich dachte mir, WordScript, schreib…" — name at word 5, imperative in first 10.
        let score = detect_agent_intent_heuristic(
            "Also ich dachte mir, WordScript, schreib eine E-Mail an Felix",
            "WordScript",
        );
        // Name in words 5–10 (+0.35) + imperative in first 10 (+0.25) = 0.60 → uncertain.
        assert!(score >= 0.20 && score < HEURISTIC_CERTAIN_THRESHOLD, "score={score}");
    }

    #[test]
    fn german_polite_question_form_with_name_and_verb_is_uncertain() {
        // "Kannst du mir bitte WordScript eine E-Mail schreiben?" — name at word 5, "schreiben" in first 10.
        let score = detect_agent_intent_heuristic(
            "Kannst du mir bitte WordScript eine E-Mail an Felix schreiben?",
            "WordScript",
        );
        assert!(score >= 0.20 && score < HEURISTIC_CERTAIN_THRESHOLD, "score={score}");
    }

    #[test]
    fn agent_name_without_imperative_is_uncertain() {
        // Agent name present but no imperative → uncertain, not certain.
        let score = detect_agent_intent_heuristic("WordScript das klingt gut", "WordScript");
        assert!(score >= 0.20 && score < HEURISTIC_CERTAIN_THRESHOLD, "score={score}");
    }

    // ── Certain DICTATION path — score < 0.20 ────────────────────────────────

    #[test]
    fn plain_dictation_scores_low() {
        let score = detect_agent_intent_heuristic(
            "The meeting went well yesterday and we discussed the quarterly results",
            "WordScript",
        );
        assert!(score < 0.20, "score={score}");
    }

    #[test]
    fn empty_text_scores_zero() {
        assert_eq!(detect_agent_intent_heuristic("", "WordScript"), 0.0);
    }

    #[test]
    fn unrelated_text_with_agent_name_only_late_scores_low() {
        // Agent name appears very late and there is no imperative verb — weak signal.
        let score = detect_agent_intent_heuristic(
            "Das war ein super schönes Treffen und danach haben wir über WordScript gesprochen",
            "WordScript",
        );
        // Name late (+0.15) only → uncertain at best, but no imperative → stays below 0.20.
        assert!(score < 0.20, "score={score}");
    }

    // ── Relative scoring ─────────────────────────────────────────────────────

    #[test]
    fn early_name_scores_higher_than_no_name() {
        let with_name = detect_agent_intent_heuristic("WordScript write an email", "WordScript");
        let without_name = detect_agent_intent_heuristic("write an email", "WordScript");
        assert!(with_name > without_name, "with={with_name} without={without_name}");
    }

    #[test]
    fn name_in_first_4_scores_higher_than_name_in_words_5_to_10() {
        let early = detect_agent_intent_heuristic("Hey WordScript schreib eine E-Mail", "WordScript");
        let later = detect_agent_intent_heuristic("Also ich dachte WordScript schreib eine E-Mail", "WordScript");
        // Both have imperative and name; early name window scores higher.
        // "Also ich dachte WordScript" → "wordscript" IS in first 4 (index 3) → same bucket.
        // Use a longer intro to push past word 4:
        let later_definite = detect_agent_intent_heuristic(
            "Also ich wollte kurz fragen, WordScript, schreib eine E-Mail",
            "WordScript",
        );
        assert!(early > later_definite, "early={early} later={later_definite}");
    }
}
