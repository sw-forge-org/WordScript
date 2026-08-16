//! WHAT LANGUAGE THE TEXT CAME BACK IN — measured on the text, not read off the
//! setting and not asked of the provider (ADR 0180).
//!
//! THE SETTING IS NOT AN ANSWER. `entry.language` is
//! `optional_non_empty(&app_config.language)`, which is the language somebody
//! CONFIGURED. A tile counting that would count how often a dropdown was
//! changed, and it would be exactly wrong in the one case anybody cares about:
//! the known defect where a German dictation comes back in English still has
//! `de` in the config while the text on screen is English.
//!
//! THE PROVIDER IS NOT AN ANSWER EITHER, AND THAT IS WHY THIS EXISTS. The plan
//! this replaces was to pass `response.language` through. Measured against the
//! lanes this product actually runs: Groq reports
//! `reports_detected_language: Unsupported` — language is a request hint there
//! and the response never names one — the local runtime returns `json` and has
//! no field for it, and OpenRouter answers per model. On the two lanes most
//! dictations go through, nothing would ever arrive. A measurement that only
//! works on the lane nobody uses is not a measurement.
//!
//! SO IT IS MEASURED HERE, ON THE DELIVERED TEXT, WHERE IT ALWAYS WORKS. Offline,
//! lane-independent, and the same answer whether the words came from a cloud
//! recogniser or a local one.
//!
//! ## What it can and cannot answer
//!
//! **Seventy languages, and no allow-list.** The first draft of this ran against
//! the eight in `TRANSLATE_LANGUAGES`, which is more accurate on short text and
//! is the wrong trade: Whisper transcribes some ninety-odd languages, so a
//! Swedish dictation is a thing that really happens here — and against an
//! allow-list it would have been counted as Dutch rather than as Swedish. A tile
//! that answers confidently for a language the reader does not speak is worse
//! than one that says nothing. The recogniser's reach is wider than this
//! detector's either way, so the honest position is: report what can be
//! established, refuse the rest, and never fold an unknown into a known.
//!
//! **Two refusals, both deliberate.** Under `MIN_WORDS` (or `MIN_CHARS`, which
//! is what carries scripts that do not space their words) trigram statistics are
//! a coin flip with a decimal point; and where whatlang reports the reading as
//! unreliable — its own judgement about the margin between its top two
//! candidates — the answer is thrown away. A refused run is counted in no
//! language at all, so the counts sum to less than the dictations behind them.
//! That is the point rather than a gap. Measured on real dictations from this
//! machine, ordinary ones clear it easily: eleven words of German and fifteen of
//! Swedish both came back at full confidence, while a sentence about German
//! written in English did not clear it and is therefore counted in neither.
//!
//! **The close pairs stay hard.** Bokmål against Danish, Serbian against
//! Croatian: trigram statistics separate those badly and no threshold fixes it.
//! The reliability gate turns most of them into refusals rather than into wrong
//! answers, which is the direction to fail in.
//!
//! **And it is narrower than the recogniser, which the tile has to survive.**
//! Whisper transcribes languages this table has no row for; a dictation in one
//! of them is stored under its three-letter code rather than dropped, and the
//! surface shows that code. Nothing here silently maps an unknown language onto
//! a known one.

use whatlang::Detector;

/// Fewer words than this and the answer is a guess dressed as a reading.
///
/// Eight is about one spoken sentence — the shortest thing that has a language
/// at all rather than a handful of tokens that could be anything.
const MIN_WORDS: usize = 8;

/// …and the same floor for scripts that do not put spaces between words.
///
/// Japanese, Chinese, Thai and Khmer would otherwise be one "word" however long
/// they run, and every dictation in them would be refused for being too short.
/// Twenty characters is roughly the same amount of language as eight words of a
/// spaced script.
const MIN_CHARS: usize = 20;

/// ISO 639-3, as whatlang answers, against the ISO 639-1 the rest of this
/// product stores.
///
/// Data rather than a match on the crate's enum, so a language added upstream
/// costs a row here instead of a compile error — and one this table does not
/// know is stored under its 639-3 code rather than dropped. The three that are
/// not a simple truncation are the ones worth checking: `cmn` is Mandarin and
/// stores as `zh`, `pes` is Western Persian and stores as `fa`, `nob` is
/// Norwegian Bokmål and stores as `nb`.
const ISO_639_1: [(&str, &str); 70] = [
    ("afr", "af"), ("aka", "ak"), ("amh", "am"), ("ara", "ar"), ("aze", "az"),
    ("bel", "be"), ("ben", "bn"), ("bul", "bg"), ("cat", "ca"), ("ces", "cs"),
    ("cmn", "zh"), ("cym", "cy"), ("dan", "da"), ("deu", "de"), ("ell", "el"),
    ("eng", "en"), ("epo", "eo"), ("est", "et"), ("fin", "fi"), ("fra", "fr"),
    ("guj", "gu"), ("heb", "he"), ("hin", "hi"), ("hrv", "hr"), ("hun", "hu"),
    ("hye", "hy"), ("ind", "id"), ("ita", "it"), ("jav", "jv"), ("jpn", "ja"),
    ("kan", "kn"), ("kat", "ka"), ("khm", "km"), ("kor", "ko"), ("lat", "la"),
    ("lav", "lv"), ("lit", "lt"), ("mal", "ml"), ("mar", "mr"), ("mkd", "mk"),
    ("mya", "my"), ("nep", "ne"), ("nld", "nl"), ("nob", "nb"), ("ori", "or"),
    ("pan", "pa"), ("pes", "fa"), ("pol", "pl"), ("por", "pt"), ("ron", "ro"),
    ("rus", "ru"), ("sin", "si"), ("slk", "sk"), ("slv", "sl"), ("sna", "sn"),
    ("spa", "es"), ("srp", "sr"), ("swe", "sv"), ("tam", "ta"), ("tel", "te"),
    ("tgl", "tl"), ("tha", "th"), ("tuk", "tk"), ("tur", "tr"), ("ukr", "uk"),
    ("urd", "ur"), ("uzb", "uz"), ("vie", "vi"), ("yid", "yi"), ("zul", "zu"),
];

/// The language of a piece of delivered text, as an ISO 639-1 code where one
/// exists, or `None` where the text cannot answer.
pub fn detect(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if !long_enough(trimmed) {
        return None;
    }

    let info = Detector::new().detect(trimmed)?;
    /* WHATLANG'S OWN JUDGEMENT AND NOT A THRESHOLD OF OURS. `confidence` is a
       margin against the runner-up rather than a probability, so a floor picked
       by hand would be a number nobody could defend — and the crate already
       calibrates this. Measured here: ordinary dictations come back at 1.0, and
       the readings that fail it are the ones that deserve to. */
    if !info.is_reliable() {
        return None;
    }
    Some(iso_639_1(info.lang().code()))
}

/// Whether there is enough text to read a language off at all.
fn long_enough(text: &str) -> bool {
    text.split_whitespace().count() >= MIN_WORDS || text.chars().count() >= MIN_CHARS
}

/// The two-letter code for a three-letter one, or the three-letter code itself
/// where this product knows no shorter name for it.
fn iso_639_1(code: &str) -> String {
    ISO_639_1
        .iter()
        .find(|(long, _)| *long == code)
        .map(|(_, short)| (*short).to_string())
        .unwrap_or_else(|| code.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use whatlang::Lang;

    /// The table is data, so nothing in the compiler checks it. This does: every
    /// language the detector can answer with has a row, and no row is a
    /// duplicate — a duplicated code would split one language across two tallies
    /// on the tile.
    #[test]
    fn every_language_the_detector_can_answer_with_has_a_short_code() {
        for lang in Lang::all() {
            let code = lang.code();
            assert!(
                ISO_639_1.iter().any(|(long, _)| *long == code),
                "{code} ({}) has no ISO 639-1 row",
                lang.eng_name(),
            );
        }
        assert_eq!(ISO_639_1.len(), Lang::all().len());

        let mut shorts: Vec<&str> = ISO_639_1.iter().map(|(_, short)| *short).collect();
        shorts.sort_unstable();
        let before = shorts.len();
        shorts.dedup();
        assert_eq!(before, shorts.len(), "two languages share a short code");
    }

    #[test]
    fn it_reads_the_language_of_the_text_it_is_given() {
        let german = "Ich habe heute den ganzen Vormittag an der neuen Auswertung gearbeitet und bin damit endlich fertig geworden.";
        let english = "I spent the whole morning working on the new report and I finally finished it just before lunch.";
        let french = "J'ai passé toute la matinée à travailler sur le nouveau rapport et je l'ai enfin terminé.";

        assert_eq!(detect(german).as_deref(), Some("de"));
        assert_eq!(detect(english).as_deref(), Some("en"));
        assert_eq!(detect(french).as_deref(), Some("fr"));
    }

    /// The reason the allow-list went. Whisper transcribes some ninety
    /// languages, so a dictation outside the eight this product translates
    /// between is an ordinary thing — and folding it into the nearest of the
    /// eight would have been a confident wrong answer.
    #[test]
    fn a_language_the_product_does_not_translate_between_is_still_named() {
        let swedish = "Jag har arbetat med den nya rapporten hela förmiddagen och blev äntligen klar med den.";
        assert_eq!(detect(swedish).as_deref(), Some("sv"));
    }

    /// The known defect this measurement exists to make visible: the setting
    /// still says German and the text on screen is English.
    #[test]
    fn it_answers_for_the_text_and_not_for_whatever_was_configured() {
        let text = "This came back in English even though the recording was dictated in another language entirely.";
        assert_eq!(detect(text).as_deref(), Some("en"));
    }

    /// The refusal is a feature and this is what it looks like: a sentence whose
    /// vocabulary sits between two languages is counted in NEITHER rather than
    /// assigned to whichever won by a hair.
    #[test]
    fn a_reading_the_detector_is_not_sure_of_is_counted_in_no_language_at_all() {
        assert!(detect("The recording was in German but this is what came back from the recogniser instead of it.").is_none());
    }

    #[test]
    fn a_handful_of_words_is_refused_rather_than_guessed() {
        assert!(detect("Ja, genau das").is_none());
        assert!(detect("").is_none());
        assert!(detect("   ").is_none());
    }

    /// A script that does not space its words would otherwise be one "word"
    /// however long it runs, and every dictation in it would be refused.
    #[test]
    fn a_script_without_spaces_is_measured_in_characters_instead() {
        assert!(long_enough("今日は一日中新しいレポートの作業をしていました。"));
        assert!(!long_enough("今日は。"));
    }
}
