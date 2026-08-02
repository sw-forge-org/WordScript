use serde::{Deserialize, Serialize};

use super::config::{BiasMode, DictionaryEntry, ManualBias, TextProfileWorkMode};

const MAX_TRANSCRIPTION_DICTIONARY_TERMS: usize = 8;
const MAX_TRANSCRIPTION_STT_HINTS: usize = 4;
const MAX_TRANSCRIPTION_HINT_CHARS: usize = 48;

/// A hint list split by what happened to each line, with the two ways of not
/// making it kept apart.
///
/// `ignored` is a line the recognizer could never use — too long, too many
/// words. `over_limit` is a line that was perfectly usable and lost a race for
/// one of `MAX_TRANSCRIPTION_STT_HINTS` slots. Merging them would tell the user
/// to shorten a term that is not too long, and dropping the second silently is
/// the defect `profile_context_budget` already exists to prevent on the context
/// field (ADR 0020).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct FilteredTranscriptionHints {
    pub accepted: Vec<String>,
    pub ignored: Vec<String>,
    pub over_limit: Vec<String>,
}

/// What the recognizer receives, and from which channel.
///
/// `TextProfile.prompt` is deliberately absent. It holds topics, and an initial
/// prompt conditions the decoder on literal tokens: `platform constraints`
/// raises the odds of those two words, never of the service names the topic
/// stands for. The profile's lexical channel is `vocabulary_hints`, opted in per
/// entry (ADR 0017), and it arrives here through `stt_hints`. See ADR 0032.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct TranscriptionBiasPreview {
    pub dictionary_terms: Vec<String>,
    pub stt_hints: Vec<String>,
    pub ignored_stt_hint_lines: Vec<String>,
    /// Terms that would have been sent but did not fit in the slot budget.
    /// Named separately from `ignored_stt_hint_lines` because the fix differs:
    /// these need a switch turned off elsewhere, not a shorter term.
    pub over_limit_stt_hint_lines: Vec<String>,
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
    stt_hints: &str,
    dictionary_entries: &[DictionaryEntry],
) -> TranscriptionBiasPreview {
    let stt_hints = filter_stt_hint_lines(stt_hints);

    TranscriptionBiasPreview {
        dictionary_terms: preferred_dictionary_terms(dictionary_entries),
        stt_hints: stt_hints.accepted,
        ignored_stt_hint_lines: stt_hints.ignored,
        over_limit_stt_hint_lines: stt_hints.over_limit,
        cloud_prompt_preview: None,
        local_prompt_preview: None,
        manual_overrides_applied: Vec::new(),
        effective_stt_hints_source: "profile".to_string(),
    }
}

pub fn analyze_transcription_bias_with_mode(
    stt_hints: &str,
    dictionary_entries: &[DictionaryEntry],
    context: &BiasRequestContext,
) -> TranscriptionBiasPreview {
    let mut preview = analyze_transcription_bias(stt_hints, dictionary_entries);
    let effective_stt_hints = effective_stt_hints(stt_hints, context);
    preview.effective_stt_hints_source = effective_stt_hints.source_label.clone();
    let filtered_effective =
        filter_stt_hint_lines(&effective_stt_hints.value);
    let final_stt_hints = filtered_effective.accepted;
    let final_stt_ignored = filtered_effective.ignored;
    let final_stt_over_limit = filtered_effective.over_limit;

    let cloud = build_cloud_prompt(&preview, context, &final_stt_hints);
    let local = build_local_prompt(&preview, context, &final_stt_hints);

    preview.cloud_prompt_preview = cloud;
    preview.local_prompt_preview = local;
    preview.stt_hints = final_stt_hints;
    preview.ignored_stt_hint_lines = final_stt_ignored;
    preview.over_limit_stt_hint_lines = final_stt_over_limit;
    preview.manual_overrides_applied = effective_stt_hints.applied_labels;
    preview
}

/// How many terms the recognizer's initial prompt carries at most.
///
/// Exported because the runtime allocates the slots now (ADR 0035) and the
/// allocator has to spend the same budget the filter enforces. A second number
/// in `config` would be a second thing to keep in step.
pub(crate) const fn max_recognizer_slots() -> usize {
    MAX_TRANSCRIPTION_STT_HINTS
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

/// What the recognizer is conditioned on when the profile contributes nothing.
///
/// An empty initial prompt is not a neutral one. With no prefix the decoder
/// falls back to its training distribution, and on quiet or damaged audio that
/// distribution's nearest attractor is the subtitle corpus — the documented
/// "Thank you for watching!" and "Untertitel im Auftrag des ZDF" outputs. A
/// constant register line is the mitigation that works there, and the blank
/// profile is the state most users are in, so correctness cannot be allowed to
/// start at the first dictionary entry (ADR 0036).
///
/// It carries register only: no topic, no vocabulary, nothing a profile could
/// have contributed, so ADR 0032 is untouched — this is not profile context
/// taking the recognizer path, it is a constant with no profile to read.
///
/// Bilingual on purpose. The attractor it steers away from exists in both
/// languages, an initial prompt biases the decoder toward the language it is
/// written in, and this product's real register is German dictation carrying
/// English technical terms. Naming the register positively — rather than naming
/// the subtitle corpus in order to reject it — matters, because the prompt is a
/// continuation prefix and not an instruction: a negation would put the very
/// tokens it argues against into the decoder's context.
pub const BLANK_STATE_RECOGNIZER_PROMPT: &str =
    "Dictated notes. Normal sentences with punctuation and capitalization. \
Diktierte Notizen. Normale Sätze mit Satzzeichen und Groß- und Kleinschreibung.";

/// Assembles the initial prompt Whisper receives.
///
/// Dictionary terms are deliberately absent. `apply_dictionary_entries` already
/// replaced them deterministically after transcription, so the prompt copy was
/// always redundant — and a longer initial prompt is itself a documented cause
/// of repetition loops and language drift (ADR 0017). What remains is small and
/// bounded by design.
///
/// The profile's context field is absent for a different reason: it holds
/// topics, which an initial prompt cannot act on (ADR 0032).
///
/// With no hints at all the result is the blank-state floor rather than `None`.
/// Returning `None` is still possible and still meaningful: the callers that
/// decide the channel is off — `bias_mode=off`, `local_prompt_strength=off` —
/// never reach this function, so the floor cannot overrule a switch the user
/// turned off.
pub fn build_transcription_prompt(
    _dictionary_terms: &[String],
    stt_hints: &[String],
    max_chars: usize,
) -> Option<String> {
    let mut sections = Vec::new();

    if stt_hints.is_empty() {
        sections.push(BLANK_STATE_RECOGNIZER_PROMPT.to_string());
    } else {
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
    let mut over_limit = Vec::new();

    for line in raw_lines.lines() {
        let candidate = normalize_hint(line);
        if candidate.is_empty() {
            continue;
        }

        if !include(&candidate) {
            push_unique_case_insensitive(&mut ignored, candidate);
            continue;
        }

        // Past the budget the loop keeps going instead of breaking. Stopping
        // here is what made every term after the fourth disappear without
        // reaching `accepted` or `ignored`, so nothing could report it.
        if accepted.len() >= limit {
            // A repeat of something already accepted is not a loss, so it must
            // not be reported as one.
            if !accepted
                .iter()
                .any(|existing: &String| existing.eq_ignore_ascii_case(&candidate))
            {
                push_unique_case_insensitive(&mut over_limit, candidate);
            }
            continue;
        }

        push_unique_case_insensitive(&mut accepted, candidate);
    }

    FilteredTranscriptionHints {
        accepted,
        ignored,
        over_limit,
    }
}

fn normalize_hint(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Whether a phrase has the shape an initial prompt can carry at all.
///
/// Exported because `vocabulary_learning` must not propose a term the
/// recognizer channel would reject anyway, and because the slot allocation in
/// `config` filters on the same predicate. One definition, three callers.
pub(crate) fn is_stt_hint_candidate(value: &str) -> bool {
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

    build_transcription_prompt(
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

    let dictionary_terms: &[String] = if context.local_prompt_strength == "profile_and_terms" {
        &preview.dictionary_terms
    } else {
        &[]
    };

    build_transcription_prompt(
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

    // --- build_transcription_prompt ---

    /// The blank state is the state most users are in, and an absent initial
    /// prompt is what lets the decoder drift into the subtitle corpus. The
    /// floor is what the provider gets when the profile says nothing.
    #[test]
    fn build_transcription_prompt_falls_back_to_the_blank_state_floor() {
        let prompt = build_transcription_prompt(&[], &[], 512).expect("blank-state floor");

        assert_eq!(prompt, BLANK_STATE_RECOGNIZER_PROMPT);
    }

    /// The floor is a floor, not a header: with hints present the prompt is
    /// byte-identical to what shipped before it existed.
    #[test]
    fn the_blank_state_floor_disappears_as_soon_as_a_hint_exists() {
        let prompt = build_transcription_prompt(&[], &["Tauri".to_string()], 512).unwrap();

        assert_eq!(prompt, "Likely phrases: Tauri");
    }

    /// Truncation is shared with the hint path on purpose, so the floor has to
    /// survive it whole in both lanes. A half sentence is worse conditioning
    /// than none.
    #[test]
    fn the_blank_state_floor_fits_both_lane_budgets_untruncated() {
        for max_chars in [CLOUD_PROMPT_PREVIEW_MAX_CHARS, LOCAL_PROMPT_PREVIEW_MAX_CHARS] {
            assert_eq!(
                build_transcription_prompt(&[], &[], max_chars).as_deref(),
                Some(BLANK_STATE_RECOGNIZER_PROMPT),
                "floor was cut at {max_chars} chars"
            );
        }
    }

    /// The budget still owns the outcome; the floor does not get to bypass it.
    #[test]
    fn the_blank_state_floor_is_still_subject_to_the_budget() {
        let prompt = build_transcription_prompt(&[], &[], 20).expect("truncated floor");

        assert!(prompt.chars().count() <= 20);
    }

    #[test]
    fn build_transcription_prompt_keeps_only_the_likely_phrases_section() {
        let prompt = build_transcription_prompt(
            &["Preferred".to_string()],
            &["status update".to_string()],
            512,
        )
        .unwrap();

        assert!(prompt.contains("Likely phrases: status update"));
        // Dictionary terms are applied deterministically after transcription;
        // copying them into the initial prompt was redundant and is itself a
        // hallucination amplifier (ADR 0017).
        assert!(!prompt.contains("Preferred spellings"));
        assert!(!prompt.contains("Preferred"));
    }

    #[test]
    fn build_transcription_prompt_truncates_at_max_chars() {
        let long_hints: Vec<String> = (0..20).map(|i| format!("Term{i}")).collect();
        let result = build_transcription_prompt(&[], &long_hints, 30);

        let prompt = result.unwrap();
        assert!(prompt.chars().count() <= 30);
    }

    // --- analyze_transcription_bias composite ---

    #[test]
    fn analyze_transcription_bias_reads_only_the_vocabulary_channel() {
        let bias = analyze_transcription_bias("status update", &[]);

        assert_eq!(bias.stt_hints, vec!["status update"]);
        assert!(bias.dictionary_terms.is_empty());
    }

    /// The defect: the filter used to `break` at the limit, so a fifth opted-in
    /// term reached neither list and no surface could name it. A term the user
    /// switched on must never disappear without a reason attached.
    #[test]
    fn terms_past_the_slot_limit_are_reported_rather_than_dropped() {
        let result = filter_stt_hint_lines("one\ntwo\nthree\nfour\nfive\nsix");

        assert_eq!(result.accepted, vec!["one", "two", "three", "four"]);
        assert_eq!(result.over_limit, vec!["five", "six"]);
        assert!(result.ignored.is_empty());
    }

    /// The two reasons stay apart: one asks for a shorter term, the other for a
    /// switch turned off elsewhere.
    #[test]
    fn a_too_long_term_is_ignored_not_counted_against_the_slot_limit() {
        let result = filter_stt_hint_lines(
            "one\nthis phrase has more than four words in it\ntwo\nthree\nfour\nfive",
        );

        assert_eq!(result.accepted, vec!["one", "two", "three", "four"]);
        assert_eq!(result.ignored, vec!["this phrase has more than four words in it"]);
        assert_eq!(result.over_limit, vec!["five"]);
    }

    #[test]
    fn a_repeat_of_an_accepted_term_is_not_reported_as_a_loss() {
        let result = filter_stt_hint_lines("one\ntwo\nthree\nfour\nONE");

        assert_eq!(result.accepted.len(), 4);
        assert!(
            result.over_limit.is_empty(),
            "a duplicate already reaches the recognizer, got {:?}",
            result.over_limit
        );
    }

    #[test]
    fn the_preview_carries_the_over_limit_terms() {
        let context = default_local_context(BiasMode::Conservative, ManualBias::default());
        let preview =
            analyze_transcription_bias_with_mode("one\ntwo\nthree\nfour\nfive", &[], &context);

        assert_eq!(preview.over_limit_stt_hint_lines, vec!["five"]);
        let cloud = preview.cloud_prompt_preview.expect("cloud prompt");
        assert!(!cloud.contains("five"));
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

        let preview = analyze_transcription_bias_with_mode("status update", &[], &context);

        assert!(preview.cloud_prompt_preview.is_none());
        assert!(preview.local_prompt_preview.is_none());
        assert_eq!(preview.manual_overrides_applied, vec!["bias_mode=off".to_string()]);
        assert_eq!(preview.effective_stt_hints_source, "off");
    }

    #[test]
    fn bias_mode_conservative_sends_only_the_vocabulary_channel() {
        let manual = ManualBias::default();
        let context = default_local_context(BiasMode::Conservative, manual);

        let preview = analyze_transcription_bias_with_mode("status update", &[], &context);

        let cloud = preview.cloud_prompt_preview.expect("cloud prompt present");
        assert!(!cloud.contains("Vocabulary:"));
        assert!(cloud.contains("Likely phrases: status update"));
    }

    /// The manual bias flags survive in the config as migration remnants, but no
    /// mode can route the profile's context field to the recognizer any more —
    /// it holds topics, which an initial prompt cannot act on (ADR 0032).
    #[test]
    fn no_bias_mode_puts_a_profile_context_section_in_the_prompt() {
        for (mode, manual) in [
            (BiasMode::Conservative, ManualBias::default()),
            (BiasMode::Manual, ManualBias::default()),
            (BiasMode::Manual, make_manual(true, true, "")),
        ] {
            let context = default_local_context(mode, manual);
            let preview = analyze_transcription_bias_with_mode("status update", &[], &context);

            let cloud = preview.cloud_prompt_preview.expect("cloud prompt");
            assert!(!cloud.contains("Vocabulary:"));
            let local = preview.local_prompt_preview.expect("local prompt");
            assert!(!local.contains("Vocabulary:"));
        }
    }

    /// The unconfigured profile is the case the floor exists for, and both
    /// lanes have to show it — the preview is the only surface that answers
    /// "what does the provider actually get".
    #[test]
    fn an_unconfigured_profile_still_reaches_both_lanes_with_the_floor() {
        let context = default_local_context(BiasMode::Conservative, ManualBias::default());

        let preview = analyze_transcription_bias_with_mode("", &[], &context);

        assert!(preview.stt_hints.is_empty());
        assert_eq!(
            preview.cloud_prompt_preview.as_deref(),
            Some(BLANK_STATE_RECOGNIZER_PROMPT)
        );
        assert_eq!(
            preview.local_prompt_preview.as_deref(),
            Some(BLANK_STATE_RECOGNIZER_PROMPT)
        );
    }

    /// A floor is not a reason to overrule a switch. `bias_mode=off` and
    /// `local_prompt_strength=off` are settings the user made, and unseen
    /// state never outranks those.
    #[test]
    fn a_channel_the_user_turned_off_stays_off_under_the_floor() {
        let off = default_local_context(BiasMode::Off, ManualBias::default());
        let preview = analyze_transcription_bias_with_mode("", &[], &off);
        assert!(preview.cloud_prompt_preview.is_none());
        assert!(preview.local_prompt_preview.is_none());

        let local_off = BiasRequestContext {
            bias_mode: BiasMode::Conservative,
            manual_bias: ManualBias::default(),
            local_prompt_strength: "off".to_string(),
            local_prompt_carry: false,
        };
        let preview = analyze_transcription_bias_with_mode("", &[], &local_off);
        assert_eq!(
            preview.cloud_prompt_preview.as_deref(),
            Some(BLANK_STATE_RECOGNIZER_PROMPT)
        );
        assert!(preview.local_prompt_preview.is_none());
    }

    #[test]
    fn bias_mode_manual_stt_hints_override_takes_precedence() {
        let manual = make_manual(false, false, "alpha\nbeta");
        let context = default_local_context(BiasMode::Manual, manual);

        let preview =
            analyze_transcription_bias_with_mode("ignored profile hint", &[], &context);

        assert_eq!(preview.stt_hints, vec!["alpha", "beta"]);
        assert_eq!(preview.effective_stt_hints_source, "manual_override");
        assert!(preview.manual_overrides_applied.contains(&"stt_hints_override".to_string()));
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

        let preview = analyze_transcription_bias_with_mode("status update", &[], &context);

        assert!(preview.cloud_prompt_preview.is_none());
        assert!(preview.local_prompt_preview.is_none());
    }
}