use serde::{Deserialize, Serialize};

use super::config::{BiasMode, DictionaryEntry, ManualBias, TextProfileWorkMode};

const MAX_TRANSCRIPTION_PROFILE_HINTS: usize = 6;
const MAX_TRANSCRIPTION_DICTIONARY_TERMS: usize = 8;
const MAX_TRANSCRIPTION_STT_HINTS: usize = 4;
const MAX_TRANSCRIPTION_HINT_CHARS: usize = 48;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct FilteredTranscriptionHints {
    pub accepted: Vec<String>,
    pub ignored: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct TranscriptionBiasPreview {
    pub profile_hints: Vec<String>,
    pub dictionary_terms: Vec<String>,
    pub stt_hints: Vec<String>,
    pub ignored_profile_lines: Vec<String>,
    pub ignored_stt_hint_lines: Vec<String>,
    pub cloud_prompt_preview: Option<String>,
    pub local_prompt_preview: Option<String>,
    pub manual_overrides_applied: Vec<String>,
    pub effective_stt_hints_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct BiasRequestContext {
    pub bias_mode: BiasMode,
    pub manual_bias: ManualBias,
    pub local_prompt_strength: String,
    pub local_prompt_carry: bool,
}

impl BiasRequestContext {
    /// The runtime entry point: a saved profile always has a concrete
    /// `TextProfileWorkMode`, so the bias policy is read from it directly
    /// rather than rebuilt from loose keys. `text_rules` keeps its own
    /// request-shaped builder because the preview analyses unsaved UI state,
    /// where every field is still optional.
    pub fn from_work_mode(
        work_mode: &TextProfileWorkMode,
        local_prompt_strength: &str,
        local_prompt_carry: bool,
    ) -> Self {
        Self {
            bias_mode: work_mode.bias_mode.clone(),
            manual_bias: work_mode.manual_bias.clone(),
            local_prompt_strength: if local_prompt_strength.trim().is_empty() {
                "profile".to_string()
            } else {
                local_prompt_strength.trim().to_string()
            },
            local_prompt_carry,
        }
    }
}

pub fn analyze_transcription_bias(
    prompt: &str,
    stt_hints: &str,
    dictionary_entries: &[DictionaryEntry],
) -> TranscriptionBiasPreview {
    let profile_hints = filter_profile_hint_lines(prompt);
    let stt_hints = filter_stt_hint_lines(stt_hints);

    TranscriptionBiasPreview {
        profile_hints: profile_hints.accepted,
        dictionary_terms: preferred_dictionary_terms(dictionary_entries),
        stt_hints: stt_hints.accepted,
        ignored_profile_lines: profile_hints.ignored,
        ignored_stt_hint_lines: stt_hints.ignored,
        cloud_prompt_preview: None,
        local_prompt_preview: None,
        manual_overrides_applied: Vec::new(),
        effective_stt_hints_source: "profile".to_string(),
    }
}

pub fn analyze_transcription_bias_with_mode(
    prompt: &str,
    stt_hints: &str,
    dictionary_entries: &[DictionaryEntry],
    context: &BiasRequestContext,
) -> TranscriptionBiasPreview {
    let mut preview = analyze_transcription_bias(prompt, stt_hints, dictionary_entries);
    let effective_stt_hints = effective_stt_hints(stt_hints, context);
    preview.effective_stt_hints_source = effective_stt_hints.source_label.clone();
    let filtered_effective =
        filter_stt_hint_lines(&effective_stt_hints.value);
    let final_stt_hints = filtered_effective.accepted;
    let final_stt_ignored = filtered_effective.ignored;

    let cloud = build_cloud_prompt(&preview, context, &final_stt_hints);
    let local = build_local_prompt(&preview, context, &final_stt_hints);

    preview.cloud_prompt_preview = cloud;
    preview.local_prompt_preview = local;
    preview.stt_hints = final_stt_hints;
    preview.ignored_stt_hint_lines = final_stt_ignored;
    preview.manual_overrides_applied = effective_stt_hints.applied_labels;
    preview
}

pub fn filter_profile_hint_lines(prompt: &str) -> FilteredTranscriptionHints {
    filter_hint_lines(
        prompt,
        MAX_TRANSCRIPTION_PROFILE_HINTS,
        is_profile_hint_candidate,
    )
}

pub fn filter_stt_hint_lines(stt_hints: &str) -> FilteredTranscriptionHints {
    filter_hint_lines(
        stt_hints,
        MAX_TRANSCRIPTION_STT_HINTS,
        is_stt_hint_candidate,
    )
}

pub fn preferred_dictionary_terms(entries: &[DictionaryEntry]) -> Vec<String> {
    let mut terms = Vec::new();

    for entry in entries {
        let replace_with = normalize_hint(&entry.replace_with);
        if replace_with.is_empty() {
            continue;
        }

        push_unique_case_insensitive(&mut terms, replace_with);
        if terms.len() >= MAX_TRANSCRIPTION_DICTIONARY_TERMS {
            break;
        }
    }

    terms
}

/// Assembles the initial prompt Whisper receives.
///
/// Dictionary terms are deliberately absent. `apply_dictionary_entries` already
/// replaced them deterministically after transcription, so the prompt copy was
/// always redundant — and a longer initial prompt is itself a documented cause
/// of repetition loops and language drift (ADR 0017). What remains is small and
/// bounded by design.
pub fn build_transcription_prompt(
    profile_hints: &[String],
    _dictionary_terms: &[String],
    stt_hints: &[String],
    max_chars: usize,
) -> Option<String> {
    let mut sections = Vec::new();

    if !profile_hints.is_empty() {
        sections.push(format!("Vocabulary: {}", profile_hints.join("; ")));
    }

    if !stt_hints.is_empty() {
        sections.push(format!("Likely phrases: {}", stt_hints.join("; ")));
    }

    truncate_transcription_prompt(sections.join("\n"), max_chars)
}

fn filter_hint_lines(
    raw_lines: &str,
    limit: usize,
    include: fn(&str) -> bool,
) -> FilteredTranscriptionHints {
    let mut accepted = Vec::new();
    let mut ignored = Vec::new();

    for line in raw_lines.lines() {
        let candidate = normalize_hint(line);
        if candidate.is_empty() {
            continue;
        }

        if include(&candidate) {
            push_unique_case_insensitive(&mut accepted, candidate);
            if accepted.len() >= limit {
                break;
            }
        } else {
            push_unique_case_insensitive(&mut ignored, candidate);
        }
    }

    FilteredTranscriptionHints { accepted, ignored }
}

fn normalize_hint(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_profile_hint_candidate(value: &str) -> bool {
    if value.is_empty() || value.chars().count() > MAX_TRANSCRIPTION_HINT_CHARS {
        return false;
    }

    let word_count = value.split_whitespace().count();
    if word_count == 0 || word_count > 4 {
        return false;
    }

    if word_count == 1 {
        return true;
    }

    value.chars().any(|character| character.is_ascii_uppercase() || character.is_ascii_digit())
        || value.contains('/')
        || value.contains('&')
        || value.contains('+')
        || value.contains('-')
        || value.contains('_')
        || value.contains('.')
        || value.contains(':')
}

fn is_stt_hint_candidate(value: &str) -> bool {
    !value.is_empty()
        && value.chars().count() <= MAX_TRANSCRIPTION_HINT_CHARS
        && value.split_whitespace().count() <= 4
}

fn push_unique_case_insensitive(target: &mut Vec<String>, candidate: String) {
    if target
        .iter()
        .any(|existing| existing.eq_ignore_ascii_case(&candidate))
    {
        return;
    }

    target.push(candidate);
}

fn truncate_transcription_prompt(prompt: String, max_chars: usize) -> Option<String> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return None;
    }

    let truncated = trimmed.chars().take(max_chars).collect::<String>();

    Some(truncated.trim().to_string())
}

/// Build a `BiasRequestContext` from the JSON payload that the runtime request
/// path already speaks. Missing fields fall back to Conservative / profile / no carry.
pub fn bias_context_from_payload(value: &serde_json::Value) -> BiasRequestContext {
    let bias_mode = value
        .get("bias_mode")
        .and_then(|mode| mode.as_str())
        .map(bias_mode_from_str)
        .unwrap_or_default();
    let manual_bias = value
        .get("manual_bias")
        .map(manual_bias_from_payload)
        .unwrap_or_default();
    let local_prompt_strength = value
        .get("local_prompt_strength")
        .and_then(|raw| raw.as_str())
        .unwrap_or("profile")
        .to_string();
    let local_prompt_carry = value
        .get("local_prompt_carry")
        .and_then(|carry| carry.as_bool())
        .unwrap_or(false);

    BiasRequestContext {
        bias_mode,
        manual_bias,
        local_prompt_strength,
        local_prompt_carry,
    }
}

fn bias_mode_from_str(value: &str) -> BiasMode {
    match value.trim().to_ascii_lowercase().as_str() {
        "off" => BiasMode::Off,
        "manual" => BiasMode::Manual,
        _ => BiasMode::Conservative,
    }
}

fn manual_bias_from_payload(value: &serde_json::Value) -> ManualBias {
    ManualBias {
        cloud_include_profile_terms: value
            .get("cloud_include_profile_terms")
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        local_include_profile_terms: value
            .get("local_include_profile_terms")
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        stt_hints_override: value
            .get("stt_hints_override")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string(),
    }
}

struct EffectiveSttHints {
    value: String,
    source_label: String,
    applied_labels: Vec<String>,
}

fn effective_stt_hints(profile_stt_hints: &str, context: &BiasRequestContext) -> EffectiveSttHints {
    match context.bias_mode {
        BiasMode::Off => EffectiveSttHints {
            value: String::new(),
            source_label: "off".to_string(),
            applied_labels: vec!["bias_mode=off".to_string()],
        },
        BiasMode::Conservative => EffectiveSttHints {
            value: profile_stt_hints.to_string(),
            source_label: "profile".to_string(),
            applied_labels: Vec::new(),
        },
        BiasMode::Manual => {
            let override_value = context.manual_bias.stt_hints_override.trim();
            if !override_value.is_empty() {
                EffectiveSttHints {
                    value: override_value.to_string(),
                    source_label: "manual_override".to_string(),
                    applied_labels: vec!["stt_hints_override".to_string()],
                }
            } else {
                EffectiveSttHints {
                    value: profile_stt_hints.to_string(),
                    source_label: "profile".to_string(),
                    applied_labels: Vec::new(),
                }
            }
        }
    }
}

fn build_cloud_prompt(
    preview: &TranscriptionBiasPreview,
    context: &BiasRequestContext,
    effective_stt_hints: &[String],
) -> Option<String> {
    if matches!(context.bias_mode, BiasMode::Off) {
        return None;
    }

    let include_profile_terms = match context.bias_mode {
        BiasMode::Manual => context.manual_bias.cloud_include_profile_terms,
        _ => false,
    };

    let profile_hints = if include_profile_terms {
        preview.profile_hints.as_slice()
    } else {
        &[]
    };

    build_transcription_prompt(
        profile_hints,
        &preview.dictionary_terms,
        effective_stt_hints,
        CLOUD_PROMPT_PREVIEW_MAX_CHARS,
    )
}

fn build_local_prompt(
    preview: &TranscriptionBiasPreview,
    context: &BiasRequestContext,
    effective_stt_hints: &[String],
) -> Option<String> {
    if matches!(context.bias_mode, BiasMode::Off) {
        return None;
    }
    if context.local_prompt_strength == "off" {
        return None;
    }

    let include_profile_terms = match context.bias_mode {
        BiasMode::Manual => context.manual_bias.local_include_profile_terms,
        _ => false,
    };

    let profile_hints = if include_profile_terms {
        preview.profile_hints.as_slice()
    } else {
        &[]
    };

    let dictionary_terms: &[String] = if context.local_prompt_strength == "profile_and_terms" {
        &preview.dictionary_terms
    } else {
        &[]
    };

    build_transcription_prompt(
        profile_hints,
        dictionary_terms,
        effective_stt_hints,
        LOCAL_PROMPT_PREVIEW_MAX_CHARS,
    )
}

/// Deliberately small. The initial prompt is a hallucination amplifier, not a
/// vocabulary channel — dictionary work moved to deterministic post-processing
/// (ADR 0017), so what is left here has no reason to be long.
pub const CLOUD_PROMPT_PREVIEW_MAX_CHARS: usize = 320;
pub const LOCAL_PROMPT_PREVIEW_MAX_CHARS: usize = 200;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_broad_profile_categories_but_keeps_concrete_terms() {
        let result = filter_profile_hint_lines(
            "customer names\nWordScript\nticket IDs\nrefund policy\nSEV-1",
        );

        assert_eq!(result.accepted, vec!["WordScript", "ticket IDs", "SEV-1"]);
        assert_eq!(result.ignored, vec!["customer names", "refund policy"]);
    }

    // --- Regression corpus: Customer Success Replies profile failure mode ---

    #[test]
    fn regression_cs_profile_all_generic_phrases_produce_no_accepted_hints() {
        // Known failure mode: profiles built from generic lowercase category phrases
        // contribute zero usable STT bias. Every line here would previously pass through
        // to the STT prompt and cause vocabulary drift / topic contamination.
        let result = filter_profile_hint_lines(
            "customer success\nfollow up with client\nescalation handling\nsatisfaction score\nsupport ticket resolution\nrefund request processing",
        );

        assert!(
            result.accepted.is_empty(),
            "expected no accepted hints from generic CS phrases, got: {:?}",
            result.accepted
        );
        assert_eq!(result.ignored.len(), 6);
    }

    #[test]
    fn cs_profile_with_concrete_acronyms_accepted_alongside_generic_lines() {
        // If a CS profile contains real product names or acronyms, those should still pass.
        let result = filter_profile_hint_lines(
            "customer success\nCRM\nSalesforce\nfollow up with client\nCSAT score\nNPS",
        );

        assert_eq!(result.accepted, vec!["CRM", "Salesforce", "CSAT score", "NPS"]);
        assert_eq!(result.ignored, vec!["customer success", "follow up with client"]);
    }

    // --- build_transcription_prompt ---

    #[test]
    fn build_transcription_prompt_returns_none_when_all_sections_empty() {
        assert!(build_transcription_prompt(&[], &[], &[], 512).is_none());
    }

    #[test]
    fn build_transcription_prompt_keeps_only_the_two_prompt_sections() {
        let prompt = build_transcription_prompt(
            &["WordScript".to_string(), "SEV-1".to_string()],
            &["Preferred".to_string()],
            &["status update".to_string()],
            512,
        )
        .unwrap();

        assert!(prompt.contains("Vocabulary: WordScript; SEV-1"));
        assert!(prompt.contains("Likely phrases: status update"));
        // Dictionary terms are applied deterministically after transcription;
        // copying them into the initial prompt was redundant and is itself a
        // hallucination amplifier (ADR 0017).
        assert!(!prompt.contains("Preferred spellings"));
        assert!(!prompt.contains("Preferred"));
    }

    #[test]
    fn build_transcription_prompt_omits_empty_sections() {
        let prompt = build_transcription_prompt(
            &["WordScript".to_string()],
            &[],
            &[],
            512,
        )
        .unwrap();

        assert!(prompt.contains("Vocabulary: WordScript"));
        assert!(!prompt.contains("Preferred spellings"));
        assert!(!prompt.contains("Likely phrases"));
    }

    #[test]
    fn build_transcription_prompt_truncates_at_max_chars() {
        let long_hints: Vec<String> = (0..20).map(|i| format!("Term{i}")).collect();
        let result = build_transcription_prompt(&long_hints, &[], &[], 30);

        let prompt = result.unwrap();
        assert!(prompt.chars().count() <= 30);
    }

    // --- analyze_transcription_bias composite ---

    #[test]
    fn analyze_transcription_bias_cs_style_profile_yields_empty_profile_hints() {
        let bias = analyze_transcription_bias(
            "customer success\nfollow up with client\nescalation handling",
            "",
            &[],
        );

        assert!(bias.profile_hints.is_empty());
        assert_eq!(bias.ignored_profile_lines.len(), 3);
        assert!(bias.dictionary_terms.is_empty());
        assert!(bias.stt_hints.is_empty());
    }

    // --- Bias-Mode aware preview ---

    fn make_manual(cloud: bool, local: bool, override_value: &str) -> ManualBias {
        ManualBias {
            cloud_include_profile_terms: cloud,
            local_include_profile_terms: local,
            stt_hints_override: override_value.to_string(),
        }
    }

    fn default_local_context(mode: BiasMode, manual: ManualBias) -> BiasRequestContext {
        BiasRequestContext {
            bias_mode: mode,
            manual_bias: manual,
            local_prompt_strength: "profile".to_string(),
            local_prompt_carry: false,
        }
    }

    #[test]
    fn bias_mode_off_yields_no_cloud_or_local_prompt() {
        let manual = ManualBias::default();
        let context = default_local_context(BiasMode::Off, manual);

        let preview = analyze_transcription_bias_with_mode(
            "WordScript\nSEV-1",
            "status update",
            &[],
            &context,
        );

        assert!(preview.cloud_prompt_preview.is_none());
        assert!(preview.local_prompt_preview.is_none());
        assert_eq!(preview.manual_overrides_applied, vec!["bias_mode=off".to_string()]);
        assert_eq!(preview.effective_stt_hints_source, "off");
    }

    #[test]
    fn bias_mode_conservative_excludes_profile_hints_in_cloud() {
        let manual = ManualBias::default();
        let context = default_local_context(BiasMode::Conservative, manual);

        let preview = analyze_transcription_bias_with_mode(
            "WordScript\nSEV-1",
            "status update",
            &[],
            &context,
        );

        let cloud = preview.cloud_prompt_preview.expect("cloud prompt present");
        assert!(!cloud.contains("Vocabulary:"), "profile_hints must not reach Whisper");
        assert!(cloud.contains("Likely phrases: status update"));
    }

    #[test]
    fn bias_mode_manual_with_cloud_flag_includes_profile_terms_in_cloud() {
        let manual = make_manual(true, false, "");
        let context = default_local_context(BiasMode::Manual, manual);

        let preview = analyze_transcription_bias_with_mode(
            "WordScript\nSEV-1",
            "status update",
            &[],
            &context,
        );

        let cloud = preview.cloud_prompt_preview.expect("cloud prompt");
        assert!(cloud.contains("Vocabulary: WordScript; SEV-1"));
        assert!(cloud.contains("Likely phrases: status update"));
    }

    #[test]
    fn bias_mode_manual_stt_hints_override_takes_precedence() {
        let manual = make_manual(false, false, "alpha\nbeta");
        let context = default_local_context(BiasMode::Manual, manual);

        let preview = analyze_transcription_bias_with_mode(
            "WordScript",
            "ignored profile hint",
            &[],
            &context,
        );

        assert_eq!(preview.stt_hints, vec!["alpha", "beta"]);
        assert_eq!(preview.effective_stt_hints_source, "manual_override");
        assert!(preview.manual_overrides_applied.contains(&"stt_hints_override".to_string()));
    }

    #[test]
    fn bias_mode_manual_default_does_not_send_profile_hints_to_whisper() {
        let manual = ManualBias::default();
        let context = default_local_context(BiasMode::Manual, manual);

        let preview = analyze_transcription_bias_with_mode(
            "WordScript\nSEV-1",
            "status update",
            &[],
            &context,
        );

        let cloud = preview.cloud_prompt_preview.expect("cloud prompt");
        assert!(!cloud.contains("Vocabulary:"));
        assert!(cloud.contains("Likely phrases: status update"));
    }

    #[test]
    fn bias_mode_off_with_local_strength_off_yields_no_prompts() {
        let manual = ManualBias::default();
        let context = BiasRequestContext {
            bias_mode: BiasMode::Off,
            manual_bias: manual,
            local_prompt_strength: "off".to_string(),
            local_prompt_carry: false,
        };

        let preview = analyze_transcription_bias_with_mode(
            "WordScript",
            "status update",
            &[],
            &context,
        );

        assert!(preview.cloud_prompt_preview.is_none());
        assert!(preview.local_prompt_preview.is_none());
    }
}