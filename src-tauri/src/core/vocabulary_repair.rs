//! Repairs a known term the recognizer mangled, without being told how it was
//! mangled.
//!
//! `Replacements` cannot do this. It maps a known spoken form to a written one,
//! which works when the left-hand side is a *choice* — "KA" for
//! "Kundenanfrage" — and fails when it is a *guess*. Whisper does not mangle a
//! name the same way twice: "Kubernetes" comes back as "cuber netties", "Kuber
//! Netes" or "Cooper Nettis" depending on the utterance, so there is no stable
//! left-hand side to write down. Enumerating them is endless, which is why
//! `vocabulary_hints` carries the term alone and this module supplies the
//! matching (ADR 0033).
//!
//! ## Why not phonetic codes
//!
//! Kölner Phonetik and Metaphone were the obvious reach and are the wrong tool
//! twice over. They are language-bound, and this product keeps whatever
//! language mix was dictated, so no single encoder covers the input. Worse,
//! they are lossy in exactly the wrong direction: `Tauri` and `Tori` collapse to
//! the same code, so the matcher loses the distinction it most needs to make.
//!
//! A normalized edit distance keeps a *graded* score instead of a yes/no
//! bucket, and a threshold on a graded score is what makes the risky cases
//! declinable.
//!
//! ## Why it declines more than it could
//!
//! The failure that matters is not a missed repair, it is a destroyed word: the
//! user dictated "Tori" and got "Tauri" because a matcher was confident. A
//! missed repair leaves text the LLM stages still see the term list for, and
//! that a person can read. So the guards are deliberately blunt:
//!
//! - `MIN_TERM_CHARS` — short terms have too many neighbours at any threshold
//!   that would still catch a real misrecognition. `Tauri` (5) is below the
//!   floor and is never repaired here.
//! - `MAX_DISTANCE_RATIO` — relative to term length, so a long term may absorb
//!   more absolute error than a short one.
//! - Only the single best candidate per window, and never a span that already
//!   reads exactly like the term.
//!
//! Every repair is reported through `applied_rules`, which the UI renders. A
//! silent text change is the defect class ADR 0020 exists about, and a fuzzy
//! one has more reason to be visible than an exact one.

/// Below this, a term has too many plausible neighbours to repair safely.
///
/// Deliberately excludes short product names. They still reach the LLM stages
/// as context and may still bias the recognizer; they just do not get a
/// deterministic rewrite, because at four or five characters "close enough"
/// stops being evidence.
const MIN_TERM_CHARS: usize = 7;

/// Allowed edit distance as a fraction of the normalized term length.
const MAX_DISTANCE_RATIO: f64 = 0.25;

/// How many transcribed tokens may be joined to match one term. A mangled name
/// usually arrives split ("cuber netties"), rarely across more than three.
const MAX_WINDOW_TOKENS: usize = 3;

pub struct RepairOutcome {
    pub text: String,
    pub applied_rules: Vec<String>,
}

/// The shortest term this layer will touch, for surfaces that have to say so.
///
/// Exported because the settings panel marks which terms get a deterministic
/// rewrite, and a threshold restated in TypeScript is a threshold that drifts.
pub const fn min_repairable_chars() -> usize {
    MIN_TERM_CHARS
}

/// The distance this layer accepts.
///
/// Exists so `vocabulary_learning` can assert its own threshold against this
/// number rather than restate it. Learning proposes where this layer rewrites,
/// so it is allowed to be looser — but only measurably so, and the assertion
/// is what keeps the two comparable.
#[cfg(test)]
pub(crate) const fn max_distance_ratio() -> f64 {
    MAX_DISTANCE_RATIO
}

/// How many transcribed tokens may stand for one term.
pub(crate) const fn max_window_tokens() -> usize {
    MAX_WINDOW_TOKENS
}

/// Whether `repair_vocabulary` can ever act on this term.
///
/// Answers the question the UI asks per row: does this word get the
/// deterministic rewrite, or does it only reach the LLM stages as context?
pub fn is_repairable_term(term: &str) -> bool {
    let term = term.trim();
    term.chars().count() >= MIN_TERM_CHARS && !normalize(term).is_empty()
}

/// Rewrites spans that are unambiguously a mangled spelling of one of `terms`.
///
/// Terms are tried longest first, so a specific term wins over a shorter one
/// that would also match part of the same span.
pub fn repair_vocabulary(text: &str, terms: &[String]) -> RepairOutcome {
    let mut current = text.to_string();
    let mut applied_rules: Vec<String> = Vec::new();

    let mut candidates: Vec<&String> = terms
        .iter()
        .filter(|term| term.trim().chars().count() >= MIN_TERM_CHARS)
        .collect();
    candidates.sort_by_key(|term| std::cmp::Reverse(term.trim().chars().count()));

    for term in candidates {
        let term = term.trim();
        let normalized_term = normalize(term);
        if normalized_term.is_empty() {
            continue;
        }

        while let Some(span) = best_span(&current, terms, &normalized_term) {
            current.replace_range(span.byte_range.clone(), term);
            let rule = format!("vocabulary:{term}");
            if !applied_rules.contains(&rule) {
                applied_rules.push(rule);
            }
        }
    }

    RepairOutcome {
        text: current,
        applied_rules,
    }
}

struct Span {
    byte_range: std::ops::Range<usize>,
}

/// The single closest repairable span, or `None` when nothing clears the bar.
fn best_span(text: &str, terms: &[String], normalized_term: &str) -> Option<Span> {
    let tokens = tokenize(text);
    if tokens.is_empty() {
        return None;
    }

    let protected = protected_ranges(text, terms);
    let budget = (normalized_term.chars().count() as f64 * MAX_DISTANCE_RATIO).floor() as usize;
    let mut best: Option<(usize, std::ops::Range<usize>)> = None;

    for start in 0..tokens.len() {
        for window in 1..=MAX_WINDOW_TOKENS {
            let Some(end_token) = tokens.get(start + window - 1) else {
                break;
            };

            let range = tokens[start].start..end_token.end;

            // A window overlapping text that already spells a term correctly is
            // never a repair. Widening past a correct occurrence stays inside
            // the distance budget while deleting whatever follows it, and a
            // shorter term would otherwise overwrite a longer one already
            // written. Both are silent damage, so the window is declined.
            if protected
                .iter()
                .any(|reserved| reserved.start < range.end && range.start < reserved.end)
            {
                continue;
            }

            let raw = &text[range.clone()];
            let normalized_span = normalize(raw);
            if normalized_span.is_empty() {
                continue;
            }

            // A window far off in length cannot be this term, and skipping it
            // keeps the distance work bounded.
            let length_gap = normalized_span
                .chars()
                .count()
                .abs_diff(normalized_term.chars().count());
            if length_gap > budget {
                continue;
            }

            let distance = levenshtein(&normalized_span, normalized_term);
            if distance > budget {
                continue;
            }

            match &best {
                Some((best_distance, _)) if *best_distance <= distance => {}
                _ => best = Some((distance, range)),
            }
        }
    }

    best.map(|(_, byte_range)| Span { byte_range })
}

/// Byte ranges where a term is already spelled correctly. Computed fresh on
/// every pass, so a repair written by an earlier term protects itself against a
/// later, shorter one.
fn protected_ranges(text: &str, terms: &[String]) -> Vec<std::ops::Range<usize>> {
    let mut ranges = Vec::new();

    for term in terms {
        let term = term.trim();
        if term.is_empty() {
            continue;
        }

        let mut offset = 0;
        while let Some(found) = text[offset..].find(term) {
            let start = offset + found;
            ranges.push(start..start + term.len());
            offset = start + term.len();
        }
    }

    ranges
}

pub(crate) struct Token {
    pub(crate) start: usize,
    pub(crate) end: usize,
}

/// Word spans by byte offset. Punctuation and whitespace are boundaries, so a
/// repair never eats the comma after a name.
///
/// Shared with `vocabulary_learning`, which runs the same window shape over a
/// raw/final pair. A second tokenizer there would be a second thing to keep in
/// step with this one.
pub(crate) fn tokenize(text: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut current: Option<usize> = None;

    for (index, character) in text.char_indices() {
        if character.is_alphanumeric() {
            current.get_or_insert(index);
        } else if let Some(start) = current.take() {
            tokens.push(Token { start, end: index });
        }
    }

    if let Some(start) = current {
        tokens.push(Token {
            start,
            end: text.len(),
        });
    }

    tokens
}

/// Folds away the differences that carry no information about *which word* this
/// is: case, diacritics, separators, and the grapheme choices that differ
/// between languages for the same sound.
///
/// Deliberately moderate. Every additional fold buys recall and pays in
/// collisions, and a collision here rewrites a word the user meant.
///
/// `vocabulary_learning` measures the same distance on the same folding, so the
/// candidate it proposes is one this layer can later act on. A second normalizer
/// would be a second thing that drifts.
pub(crate) fn normalize(value: &str) -> String {
    let mut folded = String::with_capacity(value.len());

    for character in value.chars() {
        let lowered = character.to_lowercase().next().unwrap_or(character);
        match lowered {
            'ä' | 'à' | 'á' | 'â' | 'ã' | 'å' => folded.push('a'),
            'ö' | 'ò' | 'ó' | 'ô' | 'õ' | 'ø' => folded.push('o'),
            'ü' | 'ù' | 'ú' | 'û' => folded.push('u'),
            'è' | 'é' | 'ê' | 'ë' => folded.push('e'),
            'ì' | 'í' | 'î' | 'ï' => folded.push('i'),
            'ñ' => folded.push('n'),
            'ç' => folded.push('c'),
            'ß' => folded.push_str("ss"),
            other if other.is_alphanumeric() => folded.push(other),
            _ => {}
        }
    }

    // `ph` and `f` are the same sound; `c`, `k` and `y`, `i` differ by language
    // and by transcription, not by word.
    let folded = folded.replace("ph", "f");
    let mut result = String::with_capacity(folded.len());
    let mut previous: Option<char> = None;

    for character in folded.chars() {
        let mapped = match character {
            'c' => 'k',
            'y' => 'i',
            other => other,
        };

        // A doubled letter is a spelling convention, not a distinguishing
        // sound, and recognizers are inconsistent about it.
        if previous != Some(mapped) {
            result.push(mapped);
        }
        previous = Some(mapped);
    }

    result
}

/// Standard two-row Levenshtein. Operates on chars, so multi-byte input is
/// counted the way a reader would count it.
pub(crate) fn levenshtein(left: &str, right: &str) -> usize {
    let left: Vec<char> = left.chars().collect();
    let right: Vec<char> = right.chars().collect();

    if left.is_empty() {
        return right.len();
    }
    if right.is_empty() {
        return left.len();
    }

    let mut previous: Vec<usize> = (0..=right.len()).collect();
    let mut current = vec![0usize; right.len() + 1];

    for (i, left_char) in left.iter().enumerate() {
        current[0] = i + 1;
        for (j, right_char) in right.iter().enumerate() {
            let cost = usize::from(left_char != right_char);
            current[j + 1] = (previous[j] + cost)
                .min(previous[j + 1] + 1)
                .min(current[j] + 1);
        }
        std::mem::swap(&mut previous, &mut current);
    }

    previous[right.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn terms(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn repairs_a_term_split_across_tokens() {
        let outcome = repair_vocabulary(
            "wir muessen das auf cuber netties umstellen",
            &terms(&["Kubernetes"]),
        );

        assert_eq!(outcome.text, "wir muessen das auf Kubernetes umstellen");
        assert_eq!(outcome.applied_rules, vec!["vocabulary:Kubernetes"]);
    }

    #[test]
    fn repairs_spacing_and_casing_without_any_edit_distance() {
        let outcome = repair_vocabulary(
            "steht schon auf der status page",
            &terms(&["Statuspage"]),
        );

        assert_eq!(outcome.text, "steht schon auf der Statuspage");
    }

    #[test]
    fn leaves_a_correct_occurrence_alone_and_reports_nothing() {
        let outcome = repair_vocabulary(
            "Kubernetes laeuft schon",
            &terms(&["Kubernetes"]),
        );

        assert_eq!(outcome.text, "Kubernetes laeuft schon");
        assert!(outcome.applied_rules.is_empty());
    }

    /// The case the whole design bends around: a short term has neighbours that
    /// are ordinary words, and no threshold separates them. It must decline.
    #[test]
    fn never_repairs_a_term_below_the_length_floor() {
        let outcome = repair_vocabulary(
            "meine Kollegin Tori kommt spaeter",
            &terms(&["Tauri"]),
        );

        assert_eq!(outcome.text, "meine Kollegin Tori kommt spaeter");
        assert!(outcome.applied_rules.is_empty());
    }

    #[test]
    fn does_not_touch_an_unrelated_word_of_similar_length() {
        let outcome = repair_vocabulary(
            "die Umstellung war vollstaendig",
            &terms(&["Kubernetes"]),
        );

        assert_eq!(outcome.text, "die Umstellung war vollstaendig");
        assert!(outcome.applied_rules.is_empty());
    }

    #[test]
    fn repairs_every_occurrence_and_reports_the_term_once() {
        let outcome = repair_vocabulary(
            "cuber netties hier und cuber netties da",
            &terms(&["Kubernetes"]),
        );

        assert_eq!(outcome.text, "Kubernetes hier und Kubernetes da");
        assert_eq!(outcome.applied_rules, vec!["vocabulary:Kubernetes"]);
    }

    #[test]
    fn keeps_punctuation_outside_the_repaired_span() {
        let outcome = repair_vocabulary(
            "laeuft das auf cuber netties, oder nicht?",
            &terms(&["Kubernetes"]),
        );

        assert_eq!(outcome.text, "laeuft das auf Kubernetes, oder nicht?");
    }

    #[test]
    fn a_longer_term_wins_over_a_shorter_one_on_the_same_span() {
        let outcome = repair_vocabulary(
            "das laeuft ueber postgres ql",
            &terms(&["PostgreSQL", "Postgres"]),
        );

        assert_eq!(outcome.text, "das laeuft ueber PostgreSQL");
    }

    #[test]
    fn empty_input_and_empty_terms_are_no_ops() {
        assert_eq!(repair_vocabulary("", &terms(&["Kubernetes"])).text, "");
        assert_eq!(repair_vocabulary("etwas Text", &[]).text, "etwas Text");
    }

    #[test]
    fn normalization_folds_case_diacritics_and_grapheme_variants() {
        assert_eq!(normalize("Müller"), "muler");
        assert_eq!(normalize("Photo"), "foto");
        assert_eq!(normalize("Cyan"), "kian");
        assert_eq!(normalize("Straße"), "strase");
        assert_eq!(normalize("Status-Page"), "statuspage");
    }

    #[test]
    fn levenshtein_counts_characters_not_bytes() {
        assert_eq!(levenshtein("müller", "muller"), 1);
        assert_eq!(levenshtein("", "abc"), 3);
        assert_eq!(levenshtein("abc", "abc"), 0);
    }
}
