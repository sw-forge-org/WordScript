//! Deterministic repairs to what the recogniser returned, before any mode sees
//! it.
//!
//! # Why this is a stage of its own, and where it sits
//!
//! Both repairs here fix damage the recogniser did, and both are *decidable*:
//! one removes an echo of a string we ourselves sent, the other repairs a
//! grammatical form against a closed list of evidence. Neither is a guess about
//! meaning, which is what separates them from everything in `transform` — that
//! module asks a model to improve text, and a model handed damaged input
//! invents plausible replacements for it
//! (`docs/known-issues/cleanup-invents-tokens-on-broken-input.md`).
//!
//! **It runs before the mode branch, not inside `apply_native_transform`.**
//! Agent, Translate and Prompt Enhance each have their own branch in the
//! pipeline, and on 2026-08-10 a leaked prompt sentence reached an agent *as an
//! instruction and was followed*. A repair living in the cleanup path would
//! have missed exactly the case that made this urgent.
//!
//! **The raw transcript keeps the damage.** `raw_transcript` on the history
//! record is cloned before this stage runs, so History's `Heard` view and every
//! future measurement still see what the recogniser actually produced. Repairing
//! the record as well as the delivery would erase the only evidence the defect
//! leaves behind, which is how the leak went unnoticed for as long as it did.
//!
//! See ADR 0080 (the prompt echo) and ADR 0081 (the stage and the address
//! repair).

use std::collections::HashSet;
use std::sync::OnceLock;

use regex::Regex;

/// What the stage did, in the order it did it. These strings land in the
/// history record's `applied_rules` and are what a later measurement counts.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RecognizerRepairSignals {
    pub prompt_echo_stripped: bool,
    pub singular_address_restored: bool,
}

impl RecognizerRepairSignals {
    pub fn applied_rules(&self) -> Vec<String> {
        let mut rules = Vec::new();
        if self.prompt_echo_stripped {
            rules.push("prompt_echo_stripped".to_string());
        }
        if self.singular_address_restored {
            rules.push("singular_address_restored".to_string());
        }
        rules
    }

    pub fn changed_text(&self) -> bool {
        self.prompt_echo_stripped || self.singular_address_restored
    }
}

/// The whole stage.
///
/// `prompt` is the initial prompt this request actually sent — not a rebuilt
/// one, because a rebuild can drift from what went out and the entire
/// justification for stripping deterministically is that we know the exact
/// string.
///
/// # The two repairs do not have the same relationship to language
///
/// WordScript dictates in more than one, and the difference matters:
///
/// - **The echo strip is language-agnostic by construction.** It compares the
///   transcript against the prompt *this request sent*, whatever language that
///   prompt is written in. The blank-state floor happens to be bilingual and
///   `Likely phrases: …` happens to be English; neither fact is load-bearing.
/// - **The address repair is German morphology and nothing else.** The singular
///   imperative of a weak German verb is the bare stem and the plural is the
///   stem plus `-t`, which is the whole defect; no other language in reach has
///   that shape. So it runs only when the text is known to be German, and
///   "known" means the recogniser detected it or the profile pinned it.
///
/// **Unknown language declines the repair.** Applying one language's grammar to
/// text that might be in another is precisely the invisible-damage failure this
/// module exists against, and a missed repair leaves a readable sentence
/// addressed to the wrong number of people while a wrong one rewrites a word
/// nobody said. The Groq lane requests `verbose_json` and gets a detected
/// language on every response; the local lane returns `json` and has none, so
/// there the profile's language is what enables this (see ADR 0081).
pub fn repair_recognizer_output(
    text: &str,
    prompt: Option<&str>,
    language: Option<&str>,
) -> (String, RecognizerRepairSignals) {
    let mut signals = RecognizerRepairSignals::default();

    let (text, stripped) = strip_prompt_echo(text, prompt);
    signals.prompt_echo_stripped = stripped;

    if !is_german(language) {
        return (text, signals);
    }

    let (text, restored) = repair_singular_address(&text);
    signals.singular_address_restored = restored;

    (text, signals)
}

/// Whether a language tag names German. Tolerant of the forms the two lanes
/// produce — Whisper returns the English name (`german`), a profile stores an
/// ISO code (`de`, `de-DE`) — and deliberately closed: anything it does not
/// recognise is not German, including nothing at all.
pub fn is_german(language: Option<&str>) -> bool {
    let Some(language) = language else {
        return false;
    };
    let normalized = language.trim().to_lowercase();
    let primary = normalized.split(['-', '_']).next().unwrap_or_default();
    matches!(primary, "de" | "deu" | "ger" | "german" | "deutsch")
}

// ── The prompt echo ──────────────────────────────────────────────────────────

/// How much of a sentence has to be accounted for by the prompt before the
/// sentence counts as an echo of it.
///
/// Not 1.0, because the decoder paraphrases what it echoes: every floor echo
/// measured on the owner's machine on 2026-08-10 reads "Normale Sätze mit
/// Satzzeichen und Kleinschreibung" where the constant says "…und Groß- und
/// Kleinschreibung". An exact-string strip would have caught none of them.
const ECHO_COVERAGE: f64 = 0.9;

/// A sentence needs this many DISTINCTIVE prompt words before it can be
/// removed. Function words are excluded from the count, so a real two-word
/// sentence like "Und Kleinschreibung." cannot clear the bar on the strength of
/// "und" alone.
const MIN_DISTINCTIVE_MATCHES: usize = 2;

/// Words too common to be evidence of anything. Deliberately tiny: this is not
/// a stopword list for German, it is the set of words in WordScript's own
/// prompts that also occur in ordinary speech.
fn function_words() -> &'static HashSet<&'static str> {
    static WORDS: OnceLock<HashSet<&'static str>> = OnceLock::new();
    WORDS.get_or_init(|| {
        [
            "und", "mit", "die", "der", "das", "in", "the", "and", "with", "a", "an",
        ]
        .into_iter()
        .collect()
    })
}

/// The `Likely phrases: …` form, echoed back without its colon and usually
/// without its terms. Sometimes it continues as "Likely phrases in the text".
///
/// Matched anywhere rather than only at the edges, and removed without asking
/// what follows it: this is an English fragment of a constant we sent, in the
/// middle of German dictation, and it was measured up to four times in a single
/// transcript. It is never something the speaker said.
fn likely_phrases_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(r"(?i)\blikely\s+phrases\b(\s+in\s+the\s+text)?\s*:?")
            .expect("the likely-phrases pattern compiles")
    })
}

fn normalized_words(text: &str) -> Vec<String> {
    text.split(|ch: char| !ch.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(|word| word.to_lowercase())
        .collect()
}

/// Whether every word of `sentence` can be walked off in order against
/// `prompt_words`.
///
/// In-order rather than contiguous, because the echo drops words out of the
/// middle of what we sent. Coverage is the fraction of the sentence accounted
/// for; a sentence carrying its own content will not clear it.
fn echo_coverage(sentence: &[String], prompt_words: &[String]) -> (f64, usize) {
    if sentence.is_empty() {
        return (0.0, 0);
    }

    let mut cursor = 0;
    let mut matched = 0;
    let mut distinctive = 0;
    for word in sentence {
        if let Some(offset) = prompt_words[cursor..].iter().position(|candidate| candidate == word) {
            cursor += offset + 1;
            matched += 1;
            if !function_words().contains(word.as_str()) {
                distinctive += 1;
            }
        }
    }

    (matched as f64 / sentence.len() as f64, distinctive)
}

/// Sentences, with their terminators, and the byte range each occupies.
///
/// Sentence granularity is the whole discrimination. A leaked prompt arrives as
/// a complete sentence of its own; the one case on record where the SPEAKER said
/// the prompt text out loud — "Sorry, diktierte Notizen, normale Sätze mit
/// Kleinschreibung, das war ein Transkriptionsartefakt…" — is a clause spliced
/// into a longer sentence, and survives because the sentence around it is full
/// of content the prompt never carried.
fn sentence_spans(text: &str) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();
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
                spans.push((start, end));
                start = end;
            }
        }
    }

    if start < text.len() {
        spans.push((start, text.len()));
    }

    spans
        .into_iter()
        .filter(|(from, to)| !text[*from..*to].trim().is_empty())
        .collect()
}

/// Removes an echo of the prompt this request sent, and nothing else.
///
/// **It does not recover the words the echo displaced, and must not pretend
/// to.** The decoder emitted prompt tokens *instead of* transcribing speech, so
/// those words were never written down by anything. The result is visibly short
/// rather than plausibly complete — ADR 0036's own principle applied to the side
/// effect ADR 0036 caused.
pub fn strip_prompt_echo(text: &str, prompt: Option<&str>) -> (String, bool) {
    let Some(prompt) = prompt.map(str::trim).filter(|value| !value.is_empty()) else {
        return (text.to_string(), false);
    };

    let mut changed = false;
    let mut current = text.to_string();

    // The `Likely phrases` marker first: it is not a sentence and would leave a
    // fragment behind for the sentence pass to puzzle over.
    if likely_phrases_pattern().is_match(prompt) {
        let cleaned = likely_phrases_pattern().replace_all(&current, " ").to_string();
        if cleaned != current {
            changed = true;
            current = cleaned;
        }
    }

    let prompt_words = normalized_words(prompt);
    if !prompt_words.is_empty() {
        let spans = sentence_spans(&current);
        let mut kept = String::with_capacity(current.len());
        for (from, to) in &spans {
            let sentence = &current[*from..*to];
            let words = normalized_words(sentence);
            let (coverage, distinctive) = echo_coverage(&words, &prompt_words);

            if !words.is_empty()
                && coverage >= ECHO_COVERAGE
                && distinctive >= MIN_DISTINCTIVE_MATCHES
            {
                changed = true;
                continue;
            }

            kept.push_str(sentence);
        }

        if changed {
            current = kept;
        }
    }

    // Whitespace is only collapsed where something was actually removed —
    // removing a sentence from the middle leaves a double space behind. A strip
    // that declined must return the transcript BYTE-IDENTICAL, newlines and all;
    // normalising it anyway would be a silent edit reported as no edit, which is
    // this module's own failure mode turned on itself.
    if !changed {
        return (text.to_string(), false);
    }

    (collapse_whitespace(&current), true)
}

fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

// ── The pluralized address ───────────────────────────────────────────────────

/// Plural imperative to singular, as a closed table rather than a suffix rule.
///
/// A suffix rule is what makes this defect look easy and is exactly what must
/// not be built: `-t` on a weak stem is *also* the third person singular
/// indicative, and the owner's own history carries "Macht das Sinn?", "Macht es
/// überhaupt Sinn" and "macht dieses Markdown-Ding mehr Sinn" — six-plus
/// legitimate uses against three real defects.
///
/// Verbs that appeared in that history ONLY as indicatives are deliberately
/// absent — `geht`, `kommt`, `nimmt`, `setzt`. The gates below would decline
/// them anyway; leaving them out means a gate would have to fail twice before
/// ordinary German is rewritten.
fn plural_imperatives() -> &'static [(&'static str, &'static str)] {
    &[
        ("fixt", "fix"),
        ("macht", "mach"),
        ("schreibt", "schreib"),
        ("denkt", "denk"),
        ("schaut", "schau"),
        ("guckt", "guck"),
        ("prüft", "prüf"),
        ("checkt", "check"),
        ("zeigt", "zeig"),
        ("holt", "hol"),
        ("sucht", "such"),
        ("fragt", "frag"),
        ("sagt", "sag"),
        ("packt", "pack"),
        ("baut", "bau"),
        ("stellt", "stell"),
        ("legt", "leg"),
        ("klärt", "klär"),
        ("schickt", "schick"),
    ]
}

/// Words that only appear in an instruction, never in a question about a third
/// party. `doch` and `denn` are excluded on purpose — both are at home in a
/// question ("Macht das denn Sinn?").
const IMPERATIVE_PARTICLES: &[&str] = &["bitte", "mal", "nochmal", "einfach", "ruhig"];

/// The pronoun that makes the address singular, and therefore agrees with the
/// singular imperative rather than the plural one.
const SINGULAR_ADDRESSEE: &[&str] = &["dir", "dich"];

/// A pronoun right after the verb that makes the plural CORRECT — the sentence
/// really is addressed to several people, or is a formal address.
///
/// This is the gate that keeps `Denkt ihr was passendes aus?` out of reach, and
/// keeping it out of reach is right: it is internally consistent German and
/// nothing in the text says otherwise.
const PLURAL_ADDRESSEE: &[&str] = &["ihr", "euch", "sie"];

fn word_at(sentence: &str, index: usize) -> Option<String> {
    sentence
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .nth(index)
        .map(|word| word.to_lowercase())
}

/// Restores a singular address the recogniser pluralized.
///
/// Every gate below is pinned by a case from the owner's live history, and the
/// gates are deliberately AND-ed: clause-initial, not a question, not addressed
/// to a group, and carrying positive evidence of the imperative mood. A defect
/// that clears none of them stays out of reach rather than being guessed at.
pub fn repair_singular_address(text: &str) -> (String, bool) {
    let spans = sentence_spans(text);
    if spans.is_empty() {
        return (text.to_string(), false);
    }

    let mut out = String::with_capacity(text.len());
    let mut cursor = 0;
    let mut changed = false;

    for (from, to) in spans {
        out.push_str(&text[cursor..from]);
        cursor = to;

        let sentence = &text[from..to];
        match repair_sentence(sentence) {
            Some(repaired) => {
                changed = true;
                out.push_str(&repaired);
            }
            None => out.push_str(sentence),
        }
    }

    out.push_str(&text[cursor..]);
    (out, changed)
}

fn repair_sentence(sentence: &str) -> Option<String> {
    // A question is asking about someone, not instructing anyone.
    if sentence.trim_end().ends_with('?') {
        return None;
    }

    let first = word_at(sentence, 0)?;
    let (plural, singular) = plural_imperatives()
        .iter()
        .find(|(plural, _)| *plural == first)?;

    // Addressed to a group, or formally. The plural is then correct German and
    // there is nothing here to repair.
    if let Some(next) = word_at(sentence, 1) {
        if PLURAL_ADDRESSEE.contains(&next.as_str()) {
            return None;
        }
    }

    // Positive evidence, required rather than merely helpful. Without it a
    // clause-initial verb is just as likely to be an indicative with its
    // subject further along.
    let words: Vec<String> = sentence
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(|word| word.to_lowercase())
        .collect();
    let has_evidence = words
        .iter()
        .any(|word| IMPERATIVE_PARTICLES.contains(&word.as_str()))
        || words
            .iter()
            .any(|word| SINGULAR_ADDRESSEE.contains(&word.as_str()));
    if !has_evidence {
        return None;
    }

    // Replace the first occurrence only, keeping the capitalisation the
    // recogniser chose: the verb opens the sentence and its case is the
    // sentence's, not the word's.
    let start = sentence.to_lowercase().find(*plural)?;
    let original = &sentence[start..start + plural.len()];
    let replacement = if original
        .chars()
        .next()
        .map(char::is_uppercase)
        .unwrap_or(false)
    {
        let mut chars = singular.chars();
        match chars.next() {
            Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            None => singular.to_string(),
        }
    } else {
        singular.to_string()
    };

    Some(format!(
        "{}{}{}",
        &sentence[..start],
        replacement,
        &sentence[start + plural.len()..]
    ))
}

/// Measurement scaffolding, not product code. A child module here rather than
/// beside `transform_context_measurement` because what it measures is this
/// stage's subject: whether a capture that lost audio produced a worse
/// transcript.
#[cfg(test)]
#[path = "capture_integrity_measurement.rs"]
mod capture_integrity_measurement;

#[cfg(test)]
mod tests {
    use super::*;

    const FLOOR: &str = "Dictated notes. Normal sentences with punctuation and capitalization. \
Diktierte Notizen. Normale Sätze mit Satzzeichen und Groß- und Kleinschreibung.";

    // ── The prompt echo ──────────────────────────────────────────────────────

    /// The measured form, and the reason an exact-string strip was never going
    /// to work: the decoder dropped "Groß- und" out of the middle.
    #[test]
    fn strips_a_paraphrased_floor_echo_from_the_start() {
        let (text, stripped) = strip_prompt_echo(
            "Diktierte Notizen. Normale Sätze mit Satzzeichen und Kleinschreibung. Die Task für danach fertig planen.",
            Some(FLOOR),
        );

        assert!(stripped);
        assert_eq!(text, "Die Task für danach fertig planen.");
    }

    #[test]
    fn strips_a_floor_echo_from_the_end() {
        let (text, stripped) = strip_prompt_echo(
            "Der Chip sagt Translate, so wie davor. Normale Sätze mit Satzzeichen und Kleinschreibung.",
            Some(FLOOR),
        );

        assert!(stripped);
        assert_eq!(text, "Der Chip sagt Translate, so wie davor.");
    }

    /// Position is anywhere — the record measured 2 at the start, 5 at the end
    /// and 3 mid-text — so the rule is about SENTENCE SHAPE, not about edges.
    #[test]
    fn strips_a_floor_echo_from_the_middle() {
        let (text, stripped) = strip_prompt_echo(
            "Wir fangen gleich an. Normale Sätze mit Satzzeichen und Kleinschreibung. Danach kommt der Rest.",
            Some(FLOOR),
        );

        assert!(stripped);
        assert_eq!(text, "Wir fangen gleich an. Danach kommt der Rest.");
    }

    /// A transcript that is nothing but the echo comes back EMPTY. It must not
    /// be padded back into something that looks like a dictation.
    #[test]
    fn a_transcript_that_is_only_an_echo_comes_back_empty() {
        let (text, stripped) =
            strip_prompt_echo("Normale Sätze mit Satzzeichen und Kleinschreibung.", Some(FLOOR));

        assert!(stripped);
        assert!(text.is_empty(), "got {text:?}");
    }

    /// 2026-08-10 21:02, from the owner's own history: he is talking ABOUT the
    /// artifact. The words are the prompt's, the sentence is his, and the
    /// sentence is what this rule reads.
    #[test]
    fn leaves_the_speaker_alone_when_he_quotes_the_artifact() {
        let original = "Sorry, diktierte Notizen, normale Sätze mit Kleinschreibung, das war ein Transkriptionsartefakt, genau das, was wir bekämpfen müssen.";
        let (text, stripped) = strip_prompt_echo(original, Some(FLOOR));

        assert!(!stripped);
        assert_eq!(text, original);
    }

    /// Measured leaking more often than the floor (12 against 9), and it
    /// arrives without its colon, without its terms, and repeatedly.
    #[test]
    fn strips_every_likely_phrases_marker_wherever_it_landed() {
        let (text, stripped) = strip_prompt_echo(
            "Also... Likely phrases Hmm Likely phrases Hmm Also, ich hab 35 Euro. Likely phrases",
            Some("Likely phrases: triage summary; release note"),
        );

        assert!(stripped);
        assert!(!text.to_lowercase().contains("likely phrases"), "got {text:?}");
        assert!(text.contains("ich hab 35 Euro."));
    }

    #[test]
    fn strips_the_marker_in_its_longer_observed_form() {
        let (text, stripped) = strip_prompt_echo(
            "Statt eben das Dropdown zu haben. Likely phrases in the text",
            Some("Likely phrases: provider list"),
        );

        assert!(stripped);
        assert_eq!(text, "Statt eben das Dropdown zu haben.");
    }

    /// The strip only ever removes an echo of what THIS request sent. A profile
    /// sending terms did not send the floor, so a floor-shaped sentence in its
    /// output is not ours to remove.
    #[test]
    fn removes_only_an_echo_of_the_prompt_that_was_actually_sent() {
        let original = "Likely phrases sind hier kein Thema.";
        let (text, stripped) = strip_prompt_echo(original, Some(FLOOR));

        assert!(!stripped);
        assert_eq!(text, original);
    }

    #[test]
    fn does_nothing_when_no_prompt_was_sent() {
        let original = "Normale Sätze mit Satzzeichen und Kleinschreibung.";
        let (text, stripped) = strip_prompt_echo(original, None);

        assert!(!stripped);
        assert_eq!(text, original);
    }

    /// Ordinary dictation is not touched, and the guard that protects it is the
    /// distinctive-word count rather than the coverage alone.
    #[test]
    fn ordinary_dictation_survives_the_strip() {
        let original =
            "Wir deployen das Feature heute und machen danach ein kurzes Review im Standup.";
        let (text, stripped) = strip_prompt_echo(original, Some(FLOOR));

        assert!(!stripped);
        assert_eq!(text, original);
    }

    /// A declined strip returns the transcript byte for byte, whitespace and
    /// newlines included. The first build collapsed whitespace unconditionally,
    /// which edited every multi-line dictation while reporting no change —
    /// a silent edit reported as none is this module's own failure mode aimed at
    /// itself.
    #[test]
    fn a_declined_strip_does_not_touch_whitespace() {
        let original = "Erste Zeile.\n\nZweite  Zeile mit  doppelten Abständen.";
        let (text, stripped) = strip_prompt_echo(original, Some(FLOOR));

        assert!(!stripped);
        assert_eq!(text, original);
    }

    #[test]
    fn a_short_sentence_of_function_words_is_not_evidence_enough() {
        let original = "Und Kleinschreibung.";
        let (text, stripped) = strip_prompt_echo(original, Some(FLOOR));

        assert!(!stripped, "one distinctive word must not be enough");
        assert_eq!(text, original);
    }

    // ── The pluralized address ───────────────────────────────────────────────

    /// The headline case from the record: `fix das bitte` shipped as
    /// `fixt das bitte`.
    #[test]
    fn restores_the_singular_in_the_reported_case() {
        let (text, changed) = repair_singular_address("Fixt das bitte.");

        assert!(changed);
        assert_eq!(text, "Fix das bitte.");
    }

    /// Record `…9749-8`, where cleanup did not run at all and the raw transcript
    /// shipped verbatim.
    #[test]
    fn restores_the_singular_in_a_measured_history_case() {
        let (text, changed) = repair_singular_address("Schreibt mir bitte dafür einen Prompt");

        assert!(changed);
        assert_eq!(text, "Schreib mir bitte dafür einen Prompt");
    }

    /// Record `…51-121`. The particle and the singular pronoun both vouch for
    /// the mood here.
    #[test]
    fn restores_the_singular_when_the_pronoun_disagrees_with_the_verb() {
        let (text, changed) = repair_singular_address("Macht dir wirklich mal Gedanken");

        assert!(changed);
        assert_eq!(text, "Mach dir wirklich mal Gedanken");
    }

    #[test]
    fn restores_the_singular_after_a_particle_alone() {
        let (text, changed) =
            repair_singular_address("Denkt nochmal nach, brauchen wir wirklich Library und Gallery.");

        assert!(changed);
        assert!(text.starts_with("Denk nochmal nach"), "got {text:?}");
    }

    /// THE CASE THAT DECIDES THE SHAPE OF THE RULE. `macht` is the third person
    /// singular indicative here and appears this way six-plus times in the
    /// owner's history. A suffix rule rewrites every one of them.
    #[test]
    fn never_touches_a_third_person_macht() {
        for original in [
            "Macht das Sinn?",
            "Macht es überhaupt Sinn, dass Translate ein eigener Processing-Mode ist?",
            "Macht das wirklich Sinn?",
            "Macht absolut Sinn.",
            "Wahrscheinlich macht dieses Markdown-Ding davor mehr Sinn.",
            "Weil für mich macht das aktuell keinen Sinn.",
        ] {
            let (text, changed) = repair_singular_address(original);
            assert!(!changed, "rewrote legitimate German: {original:?}");
            assert_eq!(text, original);
        }
    }

    /// Record `…73-161`, and it stays out of reach on purpose: `Denkt ihr` is
    /// internally consistent, and nothing in the text says the speaker meant
    /// one person. The record says as much.
    #[test]
    fn leaves_a_genuine_plural_address_alone() {
        let original = "Denkt ihr was passendes aus?";
        let (text, changed) = repair_singular_address(original);

        assert!(!changed);
        assert_eq!(text, original);
    }

    #[test]
    fn leaves_a_formal_address_alone() {
        let original = "Schickt Sie das bitte weiter.";
        let (text, changed) = repair_singular_address(original);

        assert!(!changed);
        assert_eq!(text, original);
    }

    /// Without positive evidence the verb is left alone, whatever else the
    /// sentence looks like.
    #[test]
    fn declines_without_evidence_of_the_imperative_mood() {
        let original = "Schreibt der Agent das jetzt selbst.";
        let (text, changed) = repair_singular_address(original);

        assert!(!changed);
        assert_eq!(text, original);
    }

    /// The verb has to open the sentence. Mid-sentence it has a subject
    /// somewhere and is an indicative.
    #[test]
    fn declines_when_the_verb_does_not_open_the_sentence() {
        let original = "Ja, dann macht das bitte irgendwer anders.";
        let (text, changed) = repair_singular_address(original);

        assert!(!changed);
        assert_eq!(text, original);
    }

    #[test]
    fn repairs_one_sentence_without_disturbing_its_neighbours() {
        let (text, changed) = repair_singular_address(
            "Das Overlay sagt Translate. Fixt das bitte. Macht das Sinn?",
        );

        assert!(changed);
        assert_eq!(text, "Das Overlay sagt Translate. Fix das bitte. Macht das Sinn?");
    }

    // ── The stage, and the languages ─────────────────────────────────────────

    #[test]
    fn the_stage_reports_both_repairs_in_pipeline_order() {
        let (text, signals) = repair_recognizer_output(
            "Diktierte Notizen. Normale Sätze mit Satzzeichen und Kleinschreibung. Schreibt mir bitte einen Prompt.",
            Some(FLOOR),
            Some("german"),
        );

        assert_eq!(text, "Schreib mir bitte einen Prompt.");
        assert_eq!(
            signals.applied_rules(),
            vec!["prompt_echo_stripped", "singular_address_restored"]
        );
        assert!(signals.changed_text());
    }

    #[test]
    fn the_stage_leaves_clean_dictation_byte_identical() {
        let original = "Bitte schick mir die Zusammenfassung bis morgen früh.";
        let (text, signals) = repair_recognizer_output(original, Some(FLOOR), Some("de"));

        assert_eq!(text, original);
        assert!(!signals.changed_text());
        assert!(signals.applied_rules().is_empty());
    }

    #[test]
    fn german_is_recognised_in_every_form_the_two_lanes_produce() {
        // Whisper answers with the English name, a profile stores an ISO code.
        for tag in ["de", "DE", "de-DE", "de_AT", "deu", "German", " german "] {
            assert!(is_german(Some(tag)), "{tag:?} names German");
        }
        for tag in ["en", "en-GB", "nl", "da", "sv", "fr", "es", ""] {
            assert!(!is_german(Some(tag)), "{tag:?} does not name German");
        }
        assert!(!is_german(None), "no language is not German");
    }

    /// The echo strip does not care what language anything is in. It removes an
    /// echo of the prompt THIS request sent, and that is true of an English
    /// dictation under an English profile exactly as it is of a German one.
    #[test]
    fn the_echo_strip_works_in_a_language_the_address_repair_never_touches() {
        let (text, signals) = repair_recognizer_output(
            "Dictated notes. Normal sentences with punctuation and capitalization. Ship the release notes today.",
            Some(FLOOR),
            Some("en"),
        );

        assert_eq!(text, "Ship the release notes today.");
        assert_eq!(signals.applied_rules(), vec!["prompt_echo_stripped"]);
    }

    /// THE MULTILINGUAL GUARD. German morphology is not applied to text in
    /// another language, and it is not applied to text whose language nobody
    /// established either — those are the same risk.
    #[test]
    fn the_address_repair_never_runs_outside_german() {
        let german = "Schreibt mir bitte dafür einen Prompt";

        for language in [Some("en"), Some("nl"), Some("fr"), Some("es"), None] {
            let (text, signals) = repair_recognizer_output(german, None, language);
            assert_eq!(
                text, german,
                "German morphology must not run under language={language:?}"
            );
            assert!(!signals.singular_address_restored);
        }

        // …and the same input under German is repaired, so the gate is what is
        // being tested rather than the rule having quietly stopped working.
        let (text, signals) = repair_recognizer_output(german, None, Some("de"));
        assert_eq!(text, "Schreib mir bitte dafür einen Prompt");
        assert!(signals.singular_address_restored);
    }

    /// Dutch and the Scandinavian languages are the near neighbours: they share
    /// the verb stems' shape closely enough that a rule without a language gate
    /// could plausibly fire on them.
    #[test]
    fn a_near_neighbour_language_is_left_alone() {
        for (language, sentence) in [
            ("nl", "Maakt het uit, stuur het maar."),
            ("da", "Sagt om det, tak."),
            ("sv", "Packt ihop det bitte."),
        ] {
            let (text, signals) = repair_recognizer_output(sentence, None, Some(language));
            assert_eq!(text, sentence, "{language} was rewritten");
            assert!(!signals.changed_text());
        }
    }
}
