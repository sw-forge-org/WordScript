use std::sync::OnceLock;

use regex::Regex;

/// A cluster this short repeated this often is a stuck decoder, not emphasis.
const MAX_CHAR_RUN: usize = 8;
const CHAR_RUN_KEPT: usize = 3;
/// "sehr sehr sehr gut" is real speech; four in a row is not.
const MAX_WORD_REPEAT: usize = 4;
/// The classic Whisper loop signature: a whole phrase echoed back to back.
const MAX_PHRASE_REPEAT: usize = 3;
const MIN_PHRASE_WORDS: usize = 2;
const MAX_PHRASE_WORDS: usize = 6;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct HallucinationSignals {
    pub char_repetition_collapsed: bool,
    pub word_repetition_collapsed: bool,
    pub phrase_repetition_collapsed: bool,
    pub artifact_pattern_filtered: bool,
    /// Observed only. A language switch is never on its own a reason to drop
    /// text: an anglicism inside a German sentence and a quoted Spanish phrase
    /// inside an English one are both legitimate transcription, and they must
    /// survive untranslated and unaltered.
    pub language_switch_flagged: bool,
    pub language_drift_stripped: bool,
}

impl HallucinationSignals {
    pub fn applied_rules(&self) -> Vec<String> {
        let mut rules = Vec::new();
        if self.char_repetition_collapsed {
            rules.push("char_repetition_collapsed".to_string());
        }
        if self.word_repetition_collapsed {
            rules.push("word_repetition_collapsed".to_string());
        }
        if self.phrase_repetition_collapsed {
            rules.push("phrase_repetition_collapsed".to_string());
        }
        if self.artifact_pattern_filtered {
            rules.push("artifact_pattern_filtered".to_string());
        }
        if self.language_switch_flagged {
            rules.push("language_switch_flagged".to_string());
        }
        if self.language_drift_stripped {
            rules.push("language_drift_stripped".to_string());
        }
        rules
    }

    pub fn changed_text(&self) -> bool {
        self.char_repetition_collapsed
            || self.word_repetition_collapsed
            || self.phrase_repetition_collapsed
            || self.artifact_pattern_filtered
            || self.language_drift_stripped
    }
}

/// What the confidence gate, the trim boundary and the artifact gate already
/// know about a transcript. A language mismatch is only ever acted on when one
/// of these independently corroborates it.
#[derive(Debug, Clone, Copy, Default)]
pub struct DriftCorroboration {
    /// The provider's own metrics rejected at least one segment.
    pub low_confidence_segments: bool,
    /// A whole-line artifact pattern matched somewhere in the transcript.
    pub artifact_matched: bool,
    /// A repetition collapse fired.
    pub repetition_collapsed: bool,
    /// The profile pins a language, which lowers the bar from two independent
    /// signals to one. It never lowers it to zero.
    pub language_locked: bool,
}

impl DriftCorroboration {
    fn corroborating_signals(&self) -> usize {
        usize::from(self.low_confidence_segments)
            + usize::from(self.artifact_matched)
            + usize::from(self.repetition_collapsed)
    }

    fn permits_strip(&self) -> bool {
        let required = if self.language_locked { 1 } else { 2 };
        self.corroborating_signals() >= required
    }
}

/// Broadcaster and platform boilerplate Whisper emits over silence. Matched
/// whole-line only and deliberately narrow: this is the one place where
/// rejecting on suspicion is right, because the precision is near perfect.
fn artifact_patterns() -> &'static [Regex] {
    static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
    PATTERNS
        .get_or_init(|| {
            [
                r"^untertitel(ung)?\s+(des|von|im\s+auftrag\s+von|erstellt\s+von)\s+.*$",
                r"^untertitel(ung)?\s+(im\s+auftrag\s+des\s+)?(zdf|ard|swr|wdr|ndr|br|orf|srf|arte)\b.*$",
                r"^untertitel\s+der\s+amara\.org.*$",
                r"^(copyright|©)\s*\d{4}.*$",
                r"^subtitles?\s+(by|created\s+by|provided\s+by)\s+.*$",
                r"^sous-titr(es|age)\s+(par|de)\s+.*$",
                r"^subt[ií]tulos?\s+(por|realizados\s+por)\s+.*$",
                r"^(transcription|transcript)\s+by\s+.*$",
                r"^\s*\[?\s*(musik|music|applause|applaus|laughter|gelächter|silence|stille)\s*\]?\s*$",
            ]
            .iter()
            .filter_map(|pattern| Regex::new(pattern).ok())
            .collect()
        })
        .as_slice()
}

fn is_artifact_line(line: &str) -> bool {
    let normalized = line.trim().trim_matches(|ch: char| ch == '"' || ch == '\'');
    let lowered = normalized.to_lowercase();
    if lowered.is_empty() {
        return false;
    }
    artifact_patterns()
        .iter()
        .any(|pattern| pattern.is_match(&lowered))
}

/// Collapses a short character cluster repeated far past any plausible
/// emphasis: "haaaaaaaaaallo" or "ja-ja-ja-ja-ja-ja-ja-ja-ja".
fn collapse_char_runs(text: &str) -> (String, bool) {
    let chars: Vec<char> = text.chars().collect();
    let mut output: Vec<char> = Vec::with_capacity(chars.len());
    let mut index = 0;
    let mut collapsed = false;

    while index < chars.len() {
        let mut handled = false;

        for cluster_len in 1..=3usize {
            if index + cluster_len > chars.len() {
                break;
            }
            let cluster = &chars[index..index + cluster_len];
            if cluster.iter().all(|ch| ch.is_whitespace()) {
                continue;
            }

            let mut repeats = 1;
            while index + cluster_len * (repeats + 1) <= chars.len()
                && &chars[index + cluster_len * repeats..index + cluster_len * (repeats + 1)]
                    == cluster
            {
                repeats += 1;
            }

            if repeats >= MAX_CHAR_RUN {
                for _ in 0..CHAR_RUN_KEPT {
                    output.extend_from_slice(cluster);
                }
                index += cluster_len * repeats;
                collapsed = true;
                handled = true;
                break;
            }
        }

        if !handled {
            output.push(chars[index]);
            index += 1;
        }
    }

    (output.into_iter().collect(), collapsed)
}

fn normalized_token(token: &str) -> String {
    token
        .trim_matches(|ch: char| !ch.is_alphanumeric())
        .to_lowercase()
}

fn collapse_word_repeats(text: &str) -> (String, bool) {
    let tokens: Vec<&str> = text.split_whitespace().collect();
    let mut output: Vec<&str> = Vec::with_capacity(tokens.len());
    let mut collapsed = false;
    let mut index = 0;

    while index < tokens.len() {
        let current = normalized_token(tokens[index]);
        let mut repeats = 1;
        while index + repeats < tokens.len()
            && !current.is_empty()
            && normalized_token(tokens[index + repeats]) == current
        {
            repeats += 1;
        }

        if repeats >= MAX_WORD_REPEAT {
            output.push(tokens[index]);
            collapsed = true;
        } else {
            output.extend_from_slice(&tokens[index..index + repeats]);
        }
        index += repeats;
    }

    (output.join(" "), collapsed)
}

fn collapse_phrase_repeats(text: &str) -> (String, bool) {
    let tokens: Vec<&str> = text.split_whitespace().collect();
    let normalized: Vec<String> = tokens.iter().map(|token| normalized_token(token)).collect();
    let mut output: Vec<&str> = Vec::with_capacity(tokens.len());
    let mut collapsed = false;
    let mut index = 0;

    while index < tokens.len() {
        let mut handled = false;

        // Longest phrase first, so an echoed sentence collapses as a whole
        // rather than leaving a shorter fragment behind.
        for phrase_len in (MIN_PHRASE_WORDS..=MAX_PHRASE_WORDS).rev() {
            if index + phrase_len * MAX_PHRASE_REPEAT > tokens.len() {
                continue;
            }
            let phrase = &normalized[index..index + phrase_len];
            if phrase.iter().all(|word| word.is_empty()) {
                continue;
            }

            let mut repeats = 1;
            while index + phrase_len * (repeats + 1) <= tokens.len()
                && &normalized[index + phrase_len * repeats..index + phrase_len * (repeats + 1)]
                    == phrase
            {
                repeats += 1;
            }

            if repeats >= MAX_PHRASE_REPEAT {
                output.extend_from_slice(&tokens[index..index + phrase_len]);
                index += phrase_len * repeats;
                collapsed = true;
                handled = true;
                break;
            }
        }

        if !handled {
            output.push(tokens[index]);
            index += 1;
        }
    }

    (output.join(" "), collapsed)
}

/// Script families that cannot be confused for one another. Latin-script
/// languages are deliberately absent: German with English terms, or English
/// quoting Spanish, share a script and must never be separable this way.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ScriptFamily {
    Latin,
    Cyrillic,
    Greek,
    Han,
    Kana,
    Hangul,
    Arabic,
    Hebrew,
    Devanagari,
}

fn script_family(ch: char) -> Option<ScriptFamily> {
    let code = ch as u32;
    match code {
        0x0041..=0x024F => Some(ScriptFamily::Latin),
        0x0370..=0x03FF | 0x1F00..=0x1FFF => Some(ScriptFamily::Greek),
        0x0400..=0x04FF => Some(ScriptFamily::Cyrillic),
        0x0590..=0x05FF => Some(ScriptFamily::Hebrew),
        0x0600..=0x06FF | 0x0750..=0x077F => Some(ScriptFamily::Arabic),
        0x0900..=0x097F => Some(ScriptFamily::Devanagari),
        0x3040..=0x30FF => Some(ScriptFamily::Kana),
        0x4E00..=0x9FFF => Some(ScriptFamily::Han),
        0xAC00..=0xD7AF => Some(ScriptFamily::Hangul),
        _ => None,
    }
}

fn dominant_script(text: &str) -> Option<ScriptFamily> {
    let mut counts: Vec<(ScriptFamily, usize)> = Vec::new();
    for family in text.chars().filter_map(script_family) {
        match counts.iter_mut().find(|(known, _)| *known == family) {
            Some((_, count)) => *count += 1,
            None => counts.push((family, 1)),
        }
    }
    counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(family, _)| family)
}

fn expected_script(language: &str) -> Option<ScriptFamily> {
    match language.trim().to_lowercase().split('-').next()? {
        "en" | "de" | "fr" | "es" | "it" | "pt" | "nl" | "sv" | "da" | "no" | "fi" | "pl" | "cs"
        | "tr" | "id" | "ro" | "hu" | "vi" => Some(ScriptFamily::Latin),
        "ru" | "uk" | "bg" | "sr" => Some(ScriptFamily::Cyrillic),
        "el" => Some(ScriptFamily::Greek),
        "zh" => Some(ScriptFamily::Han),
        "ja" => Some(ScriptFamily::Kana),
        "ko" => Some(ScriptFamily::Hangul),
        "ar" => Some(ScriptFamily::Arabic),
        "he" => Some(ScriptFamily::Hebrew),
        "hi" | "mr" => Some(ScriptFamily::Devanagari),
        _ => None,
    }
}

fn split_sentences(text: &str) -> Vec<&str> {
    let mut sentences = Vec::new();
    let mut start = 0;
    let bytes = text.as_bytes();

    for (index, ch) in text.char_indices() {
        if matches!(ch, '.' | '!' | '?' | '\n') {
            let end = index + ch.len_utf8();
            let next_is_boundary = bytes
                .get(end)
                .map(|byte| byte.is_ascii_whitespace())
                .unwrap_or(true);
            if next_is_boundary {
                sentences.push(&text[start..end]);
                start = end;
            }
        }
    }

    if start < text.len() {
        sentences.push(&text[start..]);
    }

    sentences
        .into_iter()
        .filter(|sentence| !sentence.trim().is_empty())
        .collect()
}

/// The full post-transcription detection stage.
///
/// Order matters: repetition is collapsed first so an echoed boilerplate line
/// becomes a single line the artifact gate can match, and the language check
/// runs last so it can see what the earlier stages found.
pub fn detect_advanced_hallucination(
    text: &str,
    expected_language: Option<&str>,
    corroboration: DriftCorroboration,
) -> (String, HallucinationSignals) {
    let mut signals = HallucinationSignals::default();

    let (text, char_collapsed) = collapse_char_runs(text);
    signals.char_repetition_collapsed = char_collapsed;

    let (text, word_collapsed) = collapse_word_repeats(&text);
    signals.word_repetition_collapsed = word_collapsed;

    let (text, phrase_collapsed) = collapse_phrase_repeats(&text);
    signals.phrase_repetition_collapsed = phrase_collapsed;

    let sentences = split_sentences(&text);
    let artifact_matched = sentences.iter().any(|sentence| is_artifact_line(sentence));

    let expected = expected_language.and_then(expected_script);
    let corroboration = DriftCorroboration {
        artifact_matched: corroboration.artifact_matched || artifact_matched,
        repetition_collapsed: corroboration.repetition_collapsed
            || char_collapsed
            || word_collapsed
            || phrase_collapsed,
        ..corroboration
    };

    let mut kept: Vec<&str> = Vec::with_capacity(sentences.len());
    for sentence in sentences {
        if is_artifact_line(sentence) {
            signals.artifact_pattern_filtered = true;
            continue;
        }

        // A foreign-language span shorter than its sentence is never a
        // candidate here, so inline code-switching cannot be reached by this
        // check at all.
        let mismatch = match (expected, dominant_script(sentence)) {
            (Some(expected), Some(actual)) => expected != actual,
            _ => false,
        };

        if mismatch {
            signals.language_switch_flagged = true;
            if corroboration.permits_strip() {
                signals.language_drift_stripped = true;
                continue;
            }
        }

        kept.push(sentence.trim());
    }

    let cleaned = kept.join(" ").split_whitespace().collect::<Vec<_>>().join(" ");

    (cleaned, signals)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detect(text: &str) -> (String, HallucinationSignals) {
        detect_advanced_hallucination(text, None, DriftCorroboration::default())
    }

    #[test]
    fn collapses_a_stuck_character_run() {
        let (text, signals) = detect("Das war jaaaaaaaaaaaaaa gut.");

        assert!(signals.char_repetition_collapsed);
        assert!(text.contains("jaaa"));
        assert!(!text.contains("jaaaaaaa"));
    }

    #[test]
    fn collapses_a_word_repeated_past_emphasis() {
        let (text, signals) = detect("Das ist ist ist ist ist ein Test.");

        assert!(signals.word_repetition_collapsed);
        assert_eq!(text, "Das ist ein Test.");
    }

    #[test]
    fn keeps_a_doubled_word_that_is_real_emphasis() {
        let (text, signals) = detect("Das ist sehr sehr gut.");

        assert!(!signals.word_repetition_collapsed);
        assert_eq!(text, "Das ist sehr sehr gut.");
    }

    #[test]
    fn collapses_an_echoed_phrase() {
        let (text, signals) = detect(
            "Ich melde mich gleich Ich melde mich gleich Ich melde mich gleich Ich melde mich gleich",
        );

        assert!(signals.phrase_repetition_collapsed);
        assert_eq!(text, "Ich melde mich gleich");
    }

    #[test]
    fn filters_broadcaster_boilerplate() {
        let (text, signals) = detect("Das Meeting ist um drei. Untertitelung des ZDF, 2020");

        assert!(signals.artifact_pattern_filtered);
        assert_eq!(text, "Das Meeting ist um drei.");
    }

    #[test]
    fn filters_bracketed_non_speech_markers() {
        let (text, signals) = detect("Wir starten jetzt. [Musik]");

        assert!(signals.artifact_pattern_filtered);
        assert_eq!(text, "Wir starten jetzt.");
    }

    // The two guarantees the user asked for by name.

    #[test]
    fn german_with_english_terms_survives_byte_identical() {
        let original =
            "Wir deployen das Feature heute und machen danach ein kurzes Review im Standup.";
        let (text, signals) = detect_advanced_hallucination(
            original,
            Some("de"),
            DriftCorroboration {
                low_confidence_segments: true,
                artifact_matched: true,
                repetition_collapsed: true,
                language_locked: true,
            },
        );

        assert_eq!(text, original);
        assert!(!signals.changed_text());
        assert!(!signals.language_switch_flagged);
    }

    #[test]
    fn an_english_sentence_quoting_spanish_survives_byte_identical() {
        let original = "She looked at me and said mi casa es su casa before walking off.";
        let (text, signals) = detect_advanced_hallucination(
            original,
            Some("en"),
            DriftCorroboration {
                low_confidence_segments: true,
                artifact_matched: true,
                repetition_collapsed: true,
                language_locked: true,
            },
        );

        assert_eq!(text, original);
        assert!(!signals.changed_text());
    }

    #[test]
    fn a_script_switch_alone_is_only_flagged_never_stripped() {
        let original = "Das Meeting ist um drei. 会議は三時です。";
        let (text, signals) =
            detect_advanced_hallucination(original, Some("de"), DriftCorroboration::default());

        assert!(signals.language_switch_flagged);
        assert!(!signals.language_drift_stripped);
        assert!(text.contains("会議は三時です"));
    }

    #[test]
    fn a_script_switch_is_stripped_once_confidence_corroborates_it() {
        let (text, signals) = detect_advanced_hallucination(
            "Das Meeting ist um drei. 会議は三時です。",
            Some("de"),
            DriftCorroboration {
                low_confidence_segments: true,
                language_locked: true,
                ..DriftCorroboration::default()
            },
        );

        assert!(signals.language_drift_stripped);
        assert_eq!(text, "Das Meeting ist um drei.");
    }

    #[test]
    fn a_language_lock_alone_never_strips_without_corroboration() {
        let (_, signals) = detect_advanced_hallucination(
            "Das Meeting ist um drei. 会議は三時です。",
            Some("de"),
            DriftCorroboration {
                language_locked: true,
                ..DriftCorroboration::default()
            },
        );

        assert!(signals.language_switch_flagged);
        assert!(!signals.language_drift_stripped);
    }

    #[test]
    fn clean_speech_is_left_alone() {
        let original = "Bitte schick mir die Zusammenfassung bis morgen frueh.";
        let (text, signals) = detect(original);

        assert_eq!(text, original);
        assert!(signals.applied_rules().is_empty());
    }
}
