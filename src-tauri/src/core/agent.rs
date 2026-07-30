use std::time::Instant;

use super::communication_style::CommunicationStyle;
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
    /// How this profile's agent writes. Defaults to off, which reproduces the
    /// prompt the mode had before the style existed.
    pub style: CommunicationStyle,
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
        "You are an intent classifier for a dictation app.\n\
The user is either dictating ordinary text or addressing a direct instruction to the AI assistant \"{agent_name}\". \
The transcript may be in any language; classify it regardless of language.\n\
\n\
Decide by these rules:\n\
- \"yes\" only if the user addresses {agent_name} directly AND assigns a task (e.g. \"Hey {agent_name}, write…\" or \"{agent_name}, draft me…\").\n\
- \"no\" if {agent_name} is merely mentioned in running text, with no task.\n\
- \"no\" if it is an imperative that does not address {agent_name} — that is dictation, not a command to {agent_name}.\n\
- When in doubt: \"no\".\n\
\n\
Reply with \"yes\" or \"no\" only. No other text."
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

/// Assembles the profile context block from all profile fields.
///
/// Only non-empty sections are included. The profile's free-text fields run
/// through `profile_context` like every other mode's do — same bound, same
/// shape (ADR 0021).
///
/// **What this block is for changed in ADR 0023.** It used to be framed as
/// "the domain the output lives in", sit in the *user* turn immediately before
/// the instruction, and carry no restriction except on its weakest line. A
/// generative model read that as material: instructions like "write an email
/// about X" came back carrying profile lines the user never dictated.
///
/// It is now a reading aid for the *instruction* — spellings, proper nouns,
/// domain — and nothing else. The caller puts it in the system prompt, behind
/// the header below, and the user turn carries only the transcript.
pub(crate) fn build_profile_context(config: &AgentConfig) -> String {
    let mut parts: Vec<String> = Vec::new();

    if !config.profile_label.trim().is_empty() {
        parts.push(format!("Profile: {}", config.profile_label.trim()));
    }
    if let Some(context) = profile_context_line(&config.profile_prompt) {
        parts.push(format!("Domain: {context}"));
    }
    if let Some(terms) = profile_context_line(&config.stt_hints) {
        parts.push(format!("Terms: {terms}"));
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
            parts.push(format!("Known spellings:\n{}", lines.join("\n")));
        }
    }
    // Label and trigger only, never the expansion. The expansion is finished
    // text, and offering finished text to a generative model is the one thing
    // this block must not do. It is also redundant: `finalize_with_text_rules`
    // expands the trigger deterministically at the end of every mode's
    // pipeline (ADR 0020), so listing it here was a second, generative path for
    // the same data. What remains is the reading aid — this trigger in the
    // dictation refers to a snippet.
    if !config.snippet_entries.is_empty() {
        let lines: Vec<String> = config
            .snippet_entries
            .iter()
            .filter(|e| !e.expansion.trim().is_empty())
            .map(|e| {
                format!(
                    "  {} (\"{}\")",
                    truncate_line(e.label.trim()),
                    truncate_line(e.trigger.trim())
                )
            })
            .take(MAX_SNIPPET_ENTRIES)
            .collect();
        if !lines.is_empty() {
            parts.push(format!("Snippet triggers:\n{}", lines.join("\n")));
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
            "Target application: {target}. A weak situational signal only — never derive content from it."
        ));
    }

    parts.join("\n\n")
}

/// The sentence that turns the profile block from an offer into a reading aid.
///
/// Modelled on the one line that already carried a restriction — the target
/// application's "niemals Inhalt daraus ableiten" — and applied to the whole
/// block rather than to its weakest member.
pub(crate) const PROFILE_CONTEXT_HEADING: &str = "PROFILE CONTEXT. It exists solely to help you read the instruction correctly — spellings, proper nouns, technical terms, domain. Never derive content from it, never supplement the result with it, never carry any of it into the result. All content comes from the user's instruction alone:";

/// The agent's system prompt, without the transcript.
///
/// Split out from [`apply_agent_transform`] so the regression corpus can assert
/// the prompt the product actually sends. It previously built only
/// `build_profile_context`, which meant every framing sentence around the
/// context — the part ADR 0023 is about — sat outside the parity check.
pub(crate) fn build_agent_system_prompt(config: &AgentConfig) -> String {
    let agent_name = &config.agent_name;
    // The instruction is in English while the result is not. That split needs
    // to be stated: an English system prompt otherwise pulls the answer into
    // English, and this product's whole premise is that it hands back what the
    // user said, in the language they said it in.
    let mut sections = vec![format!(
        "You are \"{agent_name}\", an AI assistant built into a speech-to-text dictation app. \
The user has addressed you with a spoken instruction. Carry it out precisely and completely.\n\
- Reply with the finished result text only — no preamble, no explanation, no \"Here is...\".\n\
- Write the result in the language the user dictated in, and keep any mix of languages they used. Never translate, and never answer in the language of these instructions.\n\
- All content comes from the instruction. Do not invent facts, names, dates or numbers the user did not dictate; if something is missing, leave it out."
    )];

    // Deliberately before the style block: what may be said outranks how it is
    // said, and the style block ends with the user's own free text.
    let profile_context = build_profile_context(config);
    if !profile_context.is_empty() {
        sections.push(format!("{PROFILE_CONTEXT_HEADING}\n{profile_context}"));
    }

    match config.style.prompt_block() {
        Some(block) => sections.push(block),
        // Without a configured style the guidance is the one the mode always
        // had: take the tone from the instruction.
        None => sections.push("Tone: match it to the instruction.".to_string()),
    }

    sections.join("\n\n")
}

/// The request the agent sends, without sending it.
///
/// Extracted so the split between the two turns is assertable. "The user turn
/// carries only the transcript" is the whole of ADR 0023's structural fix, and
/// it cannot be checked from outside a function that immediately awaits a
/// provider call.
pub(crate) fn build_agent_request(text: &str, config: &AgentConfig) -> ChatCompletionRequest {
    ChatCompletionRequest {
        provider: config.provider.clone(),
        model: config.agent_model.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: build_agent_system_prompt(config),
            },
            // Nothing but the transcript. Profile material used to sit in this
            // turn one line above the instruction, where it was formally
            // indistinguishable from the instruction itself; every other mode
            // has always put it in the system prompt.
            ChatMessage {
                role: "user".to_string(),
                content: text.to_string(),
            },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        timeout_ms: Some(30_000),
        max_retries: Some(1),
    }
}

/// Execute the agent instruction and return the composed result text.
pub async fn apply_agent_transform(text: &str, config: &AgentConfig) -> AgentResult {
    let request = build_agent_request(text, config);

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
    use crate::core::communication_style::CommunicationRegister;

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

    // ── Prompt shape (ADR 0023) ──────────────────────────────────────────────

    fn leaky_profile() -> AgentConfig {
        AgentConfig {
            provider: "groq".to_string(),
            agent_name: "WordScript".to_string(),
            agent_model: "test".to_string(),
            profile_label: "Product and engineering".to_string(),
            profile_prompt: "feature names\nrelease scope".to_string(),
            stt_hints: "Kubernetes".to_string(),
            dictionary_entries: vec![DictionaryEntry {
                id: "d1".to_string(),
                phrase: "Peter Muell".to_string(),
                replace_with: "Peter Müller".to_string(),
                ..Default::default()
            }],
            snippet_entries: vec![SnippetEntry {
                id: "s1".to_string(),
                label: "Signature".to_string(),
                trigger: "sig".to_string(),
                expansion: "Best regards, Felix — SW labs, Hamburg".to_string(),
                ..Default::default()
            }],
            workspace_context: None,
            style: CommunicationStyle::default(),
        }
    }

    /// The user turn is the transcript, byte for byte. Everything the profile
    /// contributes belongs to the system turn, where it is formally separated
    /// from the thing the user asked for.
    #[test]
    fn user_turn_carries_only_the_transcript() {
        let request = build_agent_request(
            "Schreib eine Mail an Peter, Inhalt: Termin verschiebt sich auf Montag.",
            &leaky_profile(),
        );

        let user = request
            .messages
            .iter()
            .find(|message| message.role == "user")
            .expect("agent request needs a user turn");

        assert_eq!(
            user.content,
            "Schreib eine Mail an Peter, Inhalt: Termin verschiebt sich auf Montag."
        );
        assert!(!user.content.contains("PROFILE CONTEXT"));
        assert!(!user.content.contains("feature names"));
        assert!(!user.content.contains("Instruction:"));
    }

    #[test]
    fn profile_context_sits_in_the_system_turn_behind_the_reading_aid_clause() {
        let request = build_agent_request("Schreib eine Mail", &leaky_profile());
        let system = request
            .messages
            .iter()
            .find(|message| message.role == "system")
            .expect("agent request needs a system turn");

        assert!(system.content.contains(PROFILE_CONTEXT_HEADING));
        assert!(system.content.contains("feature names"));
        assert!(system
            .content
            .contains("never carry any of it into the result"));
        assert!(system
            .content
            .contains("All content comes from the user's instruction alone"));
    }

    /// The line that invited the leak. It told the model to "take the context
    /// into account" with nothing on the other side of the scale.
    #[test]
    fn system_prompt_no_longer_invites_the_model_to_use_the_context() {
        let prompt = build_agent_system_prompt(&leaky_profile());
        assert!(!prompt.contains("take it into account"));
        assert!(prompt.contains("Do not invent facts, names, dates or numbers"));
    }

    /// A snippet expansion is finished text. Offering it to a generative model
    /// is exactly the leak, and it is redundant besides: the trigger is expanded
    /// deterministically at the end of the pipeline either way.
    #[test]
    fn snippet_expansions_never_reach_the_agent_prompt() {
        let prompt = build_agent_system_prompt(&leaky_profile());

        assert!(!prompt.contains("Best regards, Felix"));
        assert!(!prompt.contains("Best regards"));
        assert!(prompt.contains("Snippet triggers"));
        assert!(prompt.contains("Signature (\"sig\")"));
    }

    /// The dictionary stays: knowing that "Peter Muell" is heard for
    /// "Peter Müller" is what makes the block a reading aid rather than dead
    /// weight. Removing it would trade one bug for a mode that cannot spell.
    #[test]
    fn dictionary_and_terms_stay_available_for_reading_the_instruction() {
        let prompt = build_agent_system_prompt(&leaky_profile());
        assert!(prompt.contains("Peter Müller"));
        assert!(prompt.contains("Kubernetes"));
    }

    #[test]
    fn an_empty_profile_produces_no_context_block() {
        let prompt = build_agent_system_prompt(&AgentConfig {
            agent_name: "WordScript".to_string(),
            ..Default::default()
        });

        assert!(!prompt.contains(PROFILE_CONTEXT_HEADING));
        assert!(prompt.contains("You are \"WordScript\""));
    }

    #[test]
    fn style_block_reaches_the_agent_and_replaces_the_default_language_line() {
        let styled = AgentConfig {
            style: CommunicationStyle {
                register: CommunicationRegister::Quick,
                ..CommunicationStyle::default()
            },
            ..leaky_profile()
        };

        let prompt = build_agent_system_prompt(&styled);
        assert!(prompt.contains("WRITING STYLE."));
        assert!(prompt.contains("Form: Short message."));
        assert!(!prompt.contains("Tone: match it to the instruction."));
    }

    /// With the style off the mode keeps the guidance it always had, so a
    /// profile that never touches the setting sees no change.
    #[test]
    fn style_off_keeps_the_original_language_line() {
        let prompt = build_agent_system_prompt(&leaky_profile());
        assert!(prompt.contains("Tone: match it to the instruction."));
        assert!(!prompt.contains("WRITING STYLE."));
    }

    /// Content first, style second. The style block ends in the user's own free
    /// text, and free text must not sit between the model and the rule about
    /// what it may say.
    #[test]
    fn profile_context_precedes_the_style_block() {
        let styled = AgentConfig {
            style: CommunicationStyle {
                register: CommunicationRegister::Friend,
                ..CommunicationStyle::default()
            },
            ..leaky_profile()
        };

        let prompt = build_agent_system_prompt(&styled);
        let context = prompt.find(PROFILE_CONTEXT_HEADING).unwrap();
        let style = prompt.find("WRITING STYLE.").unwrap();
        assert!(context < style);
    }
}
