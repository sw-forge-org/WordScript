//! Measurement scaffolding for questions the product cannot answer by
//! assertion. Two live here:
//!
//! 1. `measure_profile_context_width` — does the profile context earn its place
//!    in the correction prompt at all?
//! 2. `measure_invented_tokens_in_shipped_corrections` — how often does cleanup
//!    put a token in the output that has no source in the input?
//!
//! This is not product code and never compiles into a release build. It exists
//! because the alternative is asserting an answer, which is the failure mode
//! ADR 0020 was written about.
//!
//! Run explicitly. The first spends real Groq calls and needs the key in the OS
//! secret store; the second spends nothing, because the pairs it needs are
//! already in the history:
//!
//! ```text
//! cargo test measure_profile_context_width -- --ignored --nocapture
//! cargo test measure_invented_tokens_in_shipped_corrections -- --ignored --nocapture
//! ```
//!
//! For the context measurement, both arms share one system prompt except for
//! the single `Context terms:` line, so the diff between them is exactly the
//! variable under test. The prompt itself comes from the production builder
//! rather than a copy.
//!
//! **Both read the developer's live `~/.config/WordScript/`, not the shipped
//! seed.** That distinction is not cosmetic: ADR 0021's run was reported as
//! measuring "the curated Product-and-engineering profile" when it measured a
//! local copy two months out of date, and the conclusion drawn from it outlived
//! the profile it described (ADR 0032). Whatever this harness produces, name the
//! profile content in the write-up.
//!
//! The context arms are *context* against *no context*. The earlier narrow arm —
//! the filtered subset from the transcription hint filter — is gone with the
//! filter itself: nothing routes the context field to the recognizer any more,
//! so there is no filtered subset left to reconstruct.

use super::*;
use super::super::communication_style::CommunicationStyle;
use super::super::config::{ProcessingMode, TranslateSettings};

use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

const PROFILE_ID: &str = "curated-product-engineering";
const CONTEXT_LINE_PREFIX: &str = "Context terms: ";
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

/// A model id off the profile's speech block, falling back to the
/// connection-wide field and then to the catalogue — the order the runtime
/// resolves them in (ADR 0203, ADR 0206). Read out of the JSON rather than
/// through `AppConfig` because this harness measures the file on this machine
/// as it stands, deliberately, and a typed load would normalize it.
fn profile_or_connection(
    profile: &serde_json::Value,
    config: &serde_json::Value,
    key: &str,
    fallback: &str,
) -> String {
    let named = |value: &serde_json::Value| {
        value[key]
            .as_str()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    };

    named(&profile["speech"])
        .or_else(|| named(config))
        .unwrap_or_else(|| fallback.to_string())
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

/// Drops the one context line, asserting it was there and unique. A silent
/// no-op would make both arms identical and the measurement meaningless.
fn drop_context_line(system_prompt: &str) -> String {
    let matches = system_prompt
        .lines()
        .filter(|line| line.starts_with(CONTEXT_LINE_PREFIX))
        .count();
    assert_eq!(
        matches, 1,
        "expected exactly one context line to drop, found {matches}"
    );

    system_prompt
        .lines()
        .filter(|line| !line.starts_with(CONTEXT_LINE_PREFIX))
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
    // It mirrors the correction call it measures, so it resolves the same job
    // rather than a connection-wide field (ADR 0094) — and the model off that
    // job's lane rather than off the cloud one (ADR 0206).
    let job = config.correction_provider();
    let model = if word_count > 300 {
        config.lane_default_correction_model(&job)
    } else {
        config.correction_model_for(&job)
    };
    let timeout_ms = if word_count > 300 { 30_000 } else { 8_000 };

    ChatCompletionRequest {
        provider: job.provider,
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
        providers: super::super::config::ProfileProviderSettings::default(),
        profile_prompt: profile_prompt.clone(),
        dictionary_entries: dictionary_entries(profile),
        snippet_entries: Vec::new(),
        post_process: preset.post_process,
        // The PROFILE's two, with the connection-wide fields as the fallback,
        // because that is the order the product resolves them in (ADR 0206).
        // Reading the connection value here measured a model the live session
        // would not have used on any profile that sets one of its own.
        correction_model: profile_or_connection(
            profile,
            &app_config,
            "correction_model",
            default_correction_model(),
        ),
        local_correction_model: profile_or_connection(
            profile,
            &app_config,
            "local_correction_model",
            default_local_correction_model(),
        ),
        filter_fillers: preset.filter_fillers,
        professionalize: preset.professionalize,
        language: String::new(),
        language_locked: false,
        low_confidence_segments: false,
        workspace_hint: None,
        profile_label: String::new(),
        stt_hints: String::new(),
        vocabulary: Vec::new(),
        agent_name: String::new(),
        style: CommunicationStyle::default(),
        translate: TranslateSettings::default(),
    };

    // Production carries the context; the control arm is the same prompt with
    // that one line removed.
    let with_context_system = correction_system_prompt(&transform_config);
    let without_context_system = drop_context_line(&with_context_system);
    assert_ne!(
        without_context_system, with_context_system,
        "arms must differ"
    );

    let context_lines = super::super::profile_context::profile_context_lines(&profile_prompt);

    eprintln!("profile      = {PROFILE_ID}");
    eprintln!("model        = {}", transform_config.correction_model);
    eprintln!(
        "context arm  = {} lines: {:?}",
        context_lines.len(),
        context_lines
    );
    eprintln!("control arm  = no context line");

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

        let without_context = call_arm(&without_context_system, &raw, &transform_config).await;
        tokio::time::sleep(PACING).await;
        let with_context = call_arm(&with_context_system, &raw, &transform_config).await;
        tokio::time::sleep(PACING).await;

        let differs = match (&without_context, &with_context) {
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
            "without_context": arm_json(&without_context),
            "with_context": arm_json(&with_context),
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
            // The measured content, not just its id: a profile id says nothing
            // about what was in the field when the run happened (ADR 0032).
            "profile_prompt": profile_prompt,
            "model": transform_config.correction_model,
            "context_lines": context_lines,
            "with_context_system_prompt": with_context_system,
            "without_context_system_prompt": without_context_system,
            "records": records,
        }))
        .unwrap(),
    )
    .unwrap_or_else(|error| panic!("write {}: {error}", out.display()));

    eprintln!("\nwrote {}", out.display());
}

// ---------------------------------------------------------------------------
// Classifier: an output token with no source in the input
// ---------------------------------------------------------------------------
//
// The question it answers is a count, not a judgement: how often does cleanup
// invent a token where the transcript was already damaged
// (`docs/known-issues/cleanup-invents-tokens-on-broken-input.md`)? Without the
// count there is no way to tell a 1-in-96 curiosity from a systematic failure,
// and the answer decides whether a guardrail gets built at all.
//
// The hard part is precision, not recall. A naive "word not in the raw
// transcript" count flags `Lieds` → `Lieder` and `switch` → `switcht`, which
// are correct German morphology; a metric that counts those measures nothing.
// So every rule below leans toward calling a token *derived*, and the number
// this produces is a lower bound. Erring the other way would produce a rate
// that argues for building something, which is exactly the kind of evidence
// that must not be manufactured.

/// What kind of unsourced token was seen.
///
/// The three shapes come from the record and stay apart because they need
/// different answers: a merge is deterministically detectable from the input
/// alone, a completion needs the abort marker to be visible, and a token with
/// no source at all is the residual that no narrow rule can catch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(super) enum InventedTokenKind {
    /// A run of spelled-out single letters fused into one word.
    /// `c a u d e code` → `CAUDE-Code`.
    LetterRunMerge,
    /// A fragment the speaker broke off, finished into a different word.
    /// `politi... äh...` → `politisch`.
    AbortedCompletion,
    /// Neither of the above, and nothing in the input it could have come from.
    NoSource,
}

impl InventedTokenKind {
    fn label(self) -> &'static str {
        match self {
            Self::LetterRunMerge => "letter_run_merge",
            Self::AbortedCompletion => "aborted_completion",
            Self::NoSource => "no_source",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct InventedToken {
    pub kind: InventedTokenKind,
    /// The output token, folded — comparison form, not display form.
    pub token: String,
    /// What in the input it was traced back to, empty for `NoSource`.
    pub source_fragment: String,
}

/// The shortest output token worth looking at. Below this, near-collisions are
/// so common that every rule below turns into noise.
const MIN_CLASSIFIED_TOKEN_CHARS: usize = 3;
/// A `NoSource` finding needs more length than a merge or a completion, which
/// both carry their own evidence from the input side.
const MIN_NO_SOURCE_TOKEN_CHARS: usize = 4;

/// Hesitation sounds, folded. Only the unambiguous ones: `um` and `er` are also
/// a German preposition and an English pronoun, and the correction prompt
/// already carries that same caveat for its own filler rule.
const HESITATION_SOUNDS: [&str; 6] = ["ah", "ahm", "ehm", "ohm", "hm", "hmm"];

/// Closed-class words, folded, German and English.
///
/// A determiner or auxiliary appearing in the output without a source is not
/// the defect under measurement. `braucht man Hint der Recognizer` →
/// `braucht man einen Hint für den Recognizer` inserts `einen` out of nothing,
/// and that is precisely the "fix obvious grammar errors" the cleanup mode is
/// instructed to perform. The failure being counted is a *plausible-looking
/// content word standing in for damaged input* — `zun` → `Sinn` — and a closed
/// class can never be that, because it carries no content to be wrong about.
///
/// The list stays closed on purpose: adding a content word here would be a way
/// to lower the measured rate after seeing it.
const FUNCTION_WORDS: &[&str] = &[
    // German determiners, pronouns, particles
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines",
    "kein", "keine", "keinen", "keinem", "keiner", "mein", "dein", "sein", "ihr", "ihre", "ihren",
    "unser", "euer", "ich", "du", "er", "sie", "es", "wir", "mich", "dich", "sich", "uns", "euch",
    "mir", "dir", "ihm", "ihnen", "man", "wer", "wen", "wem", "was", "wo", "wie", "warum", "weil",
    "ob", "dass", "und", "oder", "aber", "wenn", "dann", "denn", "also", "doch", "noch", "schon",
    "auch", "nur", "nicht", "nein", "ja", "mal", "halt", "eben", "etwas", "viel", "mehr", "sehr",
    "immer", "nie", "hier", "dort", "jetzt", "heute", "sonst", "vielleicht", "bereits", "wieder",
    "in", "an", "auf", "aus", "bei", "mit", "nach", "von", "vor", "zu", "zum", "zur", "uber",
    "unter", "durch", "fur", "gegen", "ohne", "um", "am", "im", "beim", "vom", "als", "so",
    "dafur", "damit", "daran", "darauf", "darum", "dabei", "ausserdem", "gibt",
    // German auxiliaries and modals. Whole paradigms, not the forms that
    // happened to come up: a half-listed paradigm is a gap that shows up as a
    // finding the first time the speaker uses the second person.
    "ist", "sind", "war", "waren", "bin", "bist", "seid", "hat", "haben", "hast", "habt",
    "hatte", "hatten", "hattest", "hattet", "wird", "werden", "wirst", "werdet", "wurde",
    "wurden", "wurdest", "wurdet", "kann", "kannst", "konnen", "konnt", "konnte", "konnten",
    "konntest", "muss", "musst", "mussen", "musste", "mussten", "musstest", "soll", "sollst",
    "sollen", "sollt", "sollte", "sollten", "solltest", "will", "willst", "wollen", "wollt",
    "wollte", "wollten", "wolltest", "mag", "magst", "mogen", "mochte", "mochten", "mochtest",
    "darf", "darfst", "durfen", "durft", "durfte", "durften",
    // English
    "the", "a", "an", "and", "or", "but", "if", "then", "that", "this", "these", "those", "is",
    "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "can",
    "could", "will", "would", "shall", "should", "may", "might", "must", "i", "you", "he", "she",
    "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "its", "our",
    "their", "on", "at", "by", "for", "with", "from", "to", "of", "as", "not", "no", "yes",
    "very", "much", "more", "here", "there", "now", "what", "who", "where", "why", "how",
];

/// Everything the deterministic stages are allowed to introduce.
///
/// Vocabulary repair, the replacement dictionary and snippet expansion all put
/// words into the output that the raw transcript never contained — that is their
/// job. Counting them would measure the feature, not the defect.
///
/// **Snippet expansions were missing from this list**, which cost the metric one
/// record on 2026-08-11: a `QA handoff` trigger expanded into twelve English
/// words and every one of them was flagged as an invention. An expansion is a
/// whole sentence, so it outvotes the real findings in the token count.
pub(super) fn deterministic_rewrite_allowlist(
    dictionary: &[DictionaryEntry],
    vocabulary: &[String],
    snippets: &[String],
) -> Vec<String> {
    dictionary
        .iter()
        .map(|entry| entry.replace_with.clone())
        .chain(vocabulary.iter().cloned())
        .chain(snippets.iter().cloned())
        .collect()
}

pub(super) fn classify_invented_tokens(
    raw: &str,
    output: &str,
    allowlist: &[String],
) -> Vec<InventedToken> {
    let raw_words = word_tokens(raw);
    let raw_word_set: HashSet<&str> = raw_words.iter().map(String::as_str).collect();
    let allowed: HashSet<String> = allowlist
        .iter()
        .flat_map(|term| word_tokens(term))
        .collect();
    // The same run detection the guardrail acts on, so the metric cannot claim
    // a category the product then defines differently.
    let letter_runs = spelled_letter_runs(raw);
    let aborted_fragments = aborted_fragments(raw);

    let mut found = Vec::new();
    let mut reported: HashSet<String> = HashSet::new();

    for token in word_tokens(output) {
        if token.chars().count() < MIN_CLASSIFIED_TOKEN_CHARS
            || token.chars().any(|ch| ch.is_numeric())
            || raw_word_set.contains(token.as_str())
            || allowed.contains(&token)
            || !reported.insert(token.clone())
        {
            continue;
        }

        if let Some(run) = letter_runs.iter().find(|run| run.folded.contains(&token)) {
            found.push(InventedToken {
                kind: InventedTokenKind::LetterRunMerge,
                token,
                source_fragment: run.spelled.clone(),
            });
            continue;
        }

        if let Some(fragment) = aborted_fragments
            .iter()
            .find(|fragment| token.starts_with(fragment.as_str()) && token != **fragment)
        {
            found.push(InventedToken {
                kind: InventedTokenKind::AbortedCompletion,
                token,
                source_fragment: fragment.clone(),
            });
            continue;
        }

        if token.chars().count() >= MIN_NO_SOURCE_TOKEN_CHARS
            && !FUNCTION_WORDS.contains(&token.as_str())
            && !is_derived(&token, &raw_words)
        {
            found.push(InventedToken {
                kind: InventedTokenKind::NoSource,
                token,
                source_fragment: String::new(),
            });
        }
    }

    found
}

/// Word fragments the speaker abandoned: marked by a trailing ellipsis or dash,
/// or followed by a hesitation sound. Both markers have to survive into the raw
/// transcript for this to see them, which is why the completion category can
/// only ever be a lower bound of itself.
fn aborted_fragments(raw: &str) -> Vec<String> {
    let chunks: Vec<&str> = raw.split_whitespace().collect();
    let mut fragments = Vec::new();

    for (index, chunk) in chunks.iter().enumerate() {
        let broken_off = chunk.ends_with("..")
            || chunk.ends_with('…')
            || chunk.ends_with('-')
            || chunk.ends_with('–');
        let followed_by_hesitation = chunks
            .get(index + 1)
            .map(|next| HESITATION_SOUNDS.contains(&word_tokens(next).concat().as_str()))
            .unwrap_or(false);

        if !broken_off && !followed_by_hesitation {
            continue;
        }

        let folded = word_tokens(chunk).concat();
        if folded.chars().count() >= 2 && !HESITATION_SOUNDS.contains(&folded.as_str()) {
            fragments.push(folded);
        }
    }

    fragments
}

/// Whether the input holds material the token could legitimately have come
/// from. Every branch is a way for a correct edit to look like an invention.
fn is_derived(token: &str, raw_words: &[String]) -> bool {
    let token_len = token.chars().count();

    for source in raw_words {
        let source_len = source.chars().count();

        // Compound split and join: `drauflaufen` → `drauf laufen`. The shorter
        // side has to be long enough that the containment is not a coincidence.
        if source_len >= 4
            && (token.starts_with(source.as_str())
                || token.ends_with(source.as_str())
                || source.starts_with(token)
                || source.ends_with(token))
        {
            return true;
        }

        // Inflection: `Lieds` → `Lieder`, `switch` → `switcht`. A shared stem
        // plus a length that did not run away from it.
        if common_prefix_chars(token, source) >= 4
            && (token_len as i64 - source_len as i64).abs() <= 4
        {
            return true;
        }

        // Respelling: one character moved. Below five characters this stops
        // being a respelling and starts being a different word.
        if token_len >= 5 && edit_distance_at_most_one(token, source) {
            return true;
        }
    }

    // Two or three input words written as one compound.
    for width in 2..=3usize {
        if raw_words.len() < width {
            break;
        }
        if raw_words
            .windows(width)
            .any(|window| window.concat() == token)
        {
            return true;
        }
    }

    false
}

fn common_prefix_chars(left: &str, right: &str) -> usize {
    left.chars()
        .zip(right.chars())
        .take_while(|(a, b)| a == b)
        .count()
}

/// One substitution, insertion or deletion apart. Written directly rather than
/// as a full Levenshtein matrix because the only question asked is `<= 1`.
fn edit_distance_at_most_one(left: &str, right: &str) -> bool {
    let left: Vec<char> = left.chars().collect();
    let right: Vec<char> = right.chars().collect();

    if left.len().abs_diff(right.len()) > 1 {
        return false;
    }

    let (shorter, longer) = if left.len() <= right.len() {
        (&left, &right)
    } else {
        (&right, &left)
    };

    let mut short_index = 0usize;
    let mut long_index = 0usize;
    let mut edited = false;

    while short_index < shorter.len() && long_index < longer.len() {
        if shorter[short_index] == longer[long_index] {
            short_index += 1;
            long_index += 1;
            continue;
        }

        if edited {
            return false;
        }
        edited = true;

        if shorter.len() == longer.len() {
            short_index += 1;
        }
        long_index += 1;
    }

    true
}

/// The modes that are not the cleanup family, and whose output therefore holds
/// words the input never did **by construction** rather than by invention.
///
/// Agent writes an artifact from an instruction (ADR 0026, ADR 0029). Translate
/// replaces every word — `ProcessingMode::Translate` says so in its own doc
/// comment: "the opposite of a correction that has to stay near its input".
/// Prompt Enhance rewrites a dictation into a structured prompt, and the live
/// history carries one whose output opens `Role: … Task: … Constraints: …`,
/// none of which was spoken.
///
/// Only `agent` was excluded before, so the other two were being counted as
/// inventions. Running the classifier over them measures the feature working.
const REWRITING_MODES: [&str; 3] = ["agent", "translate", "prompt_enhance"];

/// Names why a record cannot answer the question, or `None` if it is a
/// cleanup-lane record the metric is about. The applied rule is checked beside
/// the work mode because the rule is what the run actually did.
///
/// `overlay_edit` is the second reason and it is not a mode: it means the user
/// typed over the preview before delivery, and `apply_edited_preview_text` says
/// why that ends the measurement — "the text is now the user's, not the
/// transform's", and reporting it as machine-corrected "would make history and
/// the diagnostics claim a rewrite that never ran over this wording". Counting
/// the diff as an invention makes the metric claim it too. The live history
/// carries one: the user replaced the misheard `D-Max` with `tmux`, and the
/// harness credited cleanup with inventing `tmux`.
fn not_a_cleanup_measurement(entry: &serde_json::Value) -> Option<&'static str> {
    let rules = entry["applied_rules"].as_array();
    let has_rule = |name: &str| {
        rules
            .map(|rules| rules.iter().any(|rule| rule == name))
            .unwrap_or(false)
    };

    if let Some(mode) = REWRITING_MODES.into_iter().find(|mode| {
        entry["work_mode"]["processing_mode"] == *mode
            || has_rule(mode)
            || has_rule(&format!("{mode}_mode"))
    }) {
        return Some(mode);
    }
    has_rule("overlay_edit").then_some("overlay_edit")
}

/// The invention rate split by whether the capture behind the transcript kept
/// its audio (ADR 0079).
///
/// `cleanup-invents-tokens-on-broken-input.md` names the question this answers:
/// broken input is what a short capture produces, so if the inventions
/// concentrate on short captures their cause is upstream of the corrector and no
/// cleanup-side guardrail was ever going to reach them.
///
/// **It reports the population before it reports a rate, and it declines to
/// compare when a group is empty.** A verdict only exists on records written
/// after ADR 0079 shipped, so for a while the short group is empty because the
/// product has not recorded one yet — which is a population fact, not a finding
/// that short captures are clean.
#[derive(Default)]
struct CaptureIntegritySplit {
    intact: (usize, usize),
    short: (usize, usize),
    not_measured: (usize, usize),
    absent: (usize, usize),
}

impl CaptureIntegritySplit {
    fn count(&mut self, capture_integrity: &serde_json::Value, flagged: bool) {
        let slot = match capture_integrity["verdict"].as_str() {
            Some("intact") => &mut self.intact,
            Some("short") => &mut self.short,
            Some("not_measured") => &mut self.not_measured,
            Some(_) | None => &mut self.absent,
        };
        slot.0 += 1;
        if flagged {
            slot.1 += 1;
        }
    }

    fn line(label: &str, (total, flagged): (usize, usize)) -> String {
        if total == 0 {
            return format!("  {label:<24} 0 records");
        }
        format!(
            "  {label:<24} {flagged} of {total} flagged ({:.1} %)",
            flagged as f64 * 100.0 / total as f64
        )
    }

    fn report(&self) {
        eprintln!("\n--- split by capture integrity (ADR 0079) ---");
        eprintln!("{}", Self::line("intact", self.intact));
        eprintln!("{}", Self::line("short", self.short));
        eprintln!("{}", Self::line("not_measured", self.not_measured));
        eprintln!(
            "{}",
            Self::line("no verdict (pre-0079)", self.absent)
        );

        if self.short.0 == 0 || self.intact.0 == 0 {
            eprintln!(
                "\n*** The split is NOT ANSWERABLE yet: {} records carry a verdict and {} of\n\
                 *** them are short. That is the population, not a result — do not read an\n\
                 *** empty group as evidence that short captures invent no tokens.",
                self.intact.0 + self.short.0 + self.not_measured.0,
                self.short.0
            );
        }
    }

    fn json(&self) -> serde_json::Value {
        let group = |(total, flagged): (usize, usize)| {
            serde_json::json!({ "records": total, "flagged": flagged })
        };
        serde_json::json!({
            "intact": group(self.intact),
            "short": group(self.short),
            "not_measured": group(self.not_measured),
            "no_verdict": group(self.absent),
            "answerable": self.short.0 > 0 && self.intact.0 > 0,
        })
    }
}

/// Both directions: the three rewriting modes and a user's own overlay edit are
/// excluded whether the record names them as a work mode or as an applied rule,
/// and the cleanup lane the metric is about is not.
#[test]
fn only_a_record_the_cleanup_lane_did_not_write_is_excluded_from_the_invention_rate() {
    for (entry, reason) in [
        (serde_json::json!({ "work_mode": { "processing_mode": "agent" } }), "agent"),
        (serde_json::json!({ "applied_rules": ["agent_mode"] }), "agent"),
        (serde_json::json!({ "work_mode": { "processing_mode": "translate" } }), "translate"),
        (
            serde_json::json!({ "work_mode": { "processing_mode": "prompt_enhance" } }),
            "prompt_enhance",
        ),
        (serde_json::json!({ "applied_rules": ["prompt_enhance"] }), "prompt_enhance"),
        (
            serde_json::json!({
                "work_mode": { "processing_mode": "auto" },
                "applied_rules": ["post_corrected", "overlay_edit"]
            }),
            "overlay_edit",
        ),
    ] {
        assert_eq!(
            not_a_cleanup_measurement(&entry),
            Some(reason),
            "not excluded, or excluded for the wrong reason: {entry}"
        );
    }

    for entry in [
        serde_json::json!({ "work_mode": { "processing_mode": "auto" }, "applied_rules": ["post_corrected"] }),
        serde_json::json!({ "work_mode": { "processing_mode": "cleanup" } }),
        serde_json::json!({ "work_mode": { "processing_mode": "rewrite" } }),
        serde_json::json!({ "work_mode": { "processing_mode": "verbatim" } }),
        serde_json::json!({ "applied_rules": ["post_corrected", "prompt_echo_stripped"] }),
    ] {
        assert_eq!(
            not_a_cleanup_measurement(&entry),
            None,
            "excluded from its own metric: {entry}"
        );
    }
}

/// A record from before ADR 0079 carries no verdict, and counting it as
/// `intact` would answer the question with records that never measured
/// themselves.
#[test]
fn a_record_without_a_verdict_is_not_counted_as_intact() {
    let mut split = CaptureIntegritySplit::default();
    split.count(&serde_json::json!(null), true);
    split.count(&serde_json::json!({ "verdict": "intact" }), false);

    assert_eq!(split.absent, (1, 1));
    assert_eq!(split.intact, (1, 0));
    assert_eq!(split.json()["answerable"], serde_json::json!(false));
}

/// The split becomes a comparison only when both sides exist.
#[test]
fn the_split_is_answerable_only_with_a_short_capture_on_the_record() {
    let mut split = CaptureIntegritySplit::default();
    split.count(&serde_json::json!({ "verdict": "intact" }), false);
    assert_eq!(split.json()["answerable"], serde_json::json!(false));

    split.count(&serde_json::json!({ "verdict": "short" }), true);
    assert_eq!(split.json()["answerable"], serde_json::json!(true));
    assert_eq!(split.json()["short"]["flagged"], serde_json::json!(1));
}

/// The count the record has been waiting for, over what actually shipped.
///
/// No provider call: `history.json` already holds the raw transcript beside the
/// text the user received, which is the pair a replay would spend Groq calls to
/// reconstruct — and it has the advantage of being the model, the profile and
/// the mode that really ran, rather than today's approximation of them.
///
/// The cost is that the output has been through vocabulary repair, the
/// replacement dictionary and the snippets as well as the correction, so
/// `deterministic_rewrite_allowlist` has to neutralize what those introduce.
#[test]
#[ignore = "reads the developer's live history; run explicitly with --ignored"]
fn measure_invented_tokens_in_shipped_corrections() {
    let config_dir = wordscript_config_dir();
    let app_config = read_json(config_dir.join("config.json"));
    let history = read_json(config_dir.join("history.json"));
    let profile = measurement_profile(&app_config);

    let profile_prompt = profile["prompt"].as_str().unwrap_or_default().to_string();
    let dictionary = dictionary_entries(profile);
    let vocabulary: Vec<String> = profile["vocabulary_hints"]
        .as_array()
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| entry["phrase"].as_str())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    let snippets: Vec<String> = profile["snippet_entries"]
        .as_array()
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| entry["expansion"].as_str())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    let allowlist = deterministic_rewrite_allowlist(&dictionary, &vocabulary, &snippets);

    eprintln!("profile      = {PROFILE_ID}");
    eprintln!("profile ctx  = {profile_prompt:?}");
    eprintln!("vocabulary   = {vocabulary:?}");
    eprintln!("snippets     = {} expansions", snippets.len());
    eprintln!(
        "dictionary   = {:?}",
        dictionary
            .iter()
            .map(|entry| format!("{} -> {}", entry.phrase, entry.replace_with))
            .collect::<Vec<_>>()
    );
    eprintln!(
        "model        = {}",
        app_config["correction_model"].as_str().unwrap_or("?")
    );

    let all: Vec<&serde_json::Value> = history
        .as_array()
        .expect("history array")
        .iter()
        .filter(|entry| {
            let has_raw = entry["raw_transcript"]
                .as_str()
                .map(|text| !text.trim().is_empty())
                .unwrap_or(false);
            let has_output = entry["transformed_transcript"]
                .as_str()
                .map(|text| !text.trim().is_empty())
                .unwrap_or(false);
            has_raw && has_output
        })
        .collect();

    let mut excluded: Vec<(&str, usize)> = Vec::new();
    for reason in REWRITING_MODES.into_iter().chain(["overlay_edit"]) {
        let count = all
            .iter()
            .filter(|entry| not_a_cleanup_measurement(entry) == Some(reason))
            .count();
        if count > 0 {
            excluded.push((reason, count));
        }
    }
    let entries: Vec<&serde_json::Value> = all
        .iter()
        .copied()
        .filter(|entry| not_a_cleanup_measurement(entry).is_none())
        .collect();

    if !excluded.is_empty() {
        eprintln!(
            "excluded     = {} of {} records the cleanup lane did not write: {}",
            all.len() - entries.len(),
            all.len(),
            excluded
                .iter()
                .map(|(reason, count)| format!("{reason} {count}"))
                .collect::<Vec<_>>()
                .join(", ")
        );
    }

    let mut flagged = 0usize;
    let mut by_kind: Vec<(InventedTokenKind, usize)> = vec![
        (InventedTokenKind::LetterRunMerge, 0),
        (InventedTokenKind::AbortedCompletion, 0),
        (InventedTokenKind::NoSource, 0),
    ];
    let mut records: Vec<serde_json::Value> = Vec::new();
    let mut split = CaptureIntegritySplit::default();

    for entry in &entries {
        let raw = entry["raw_transcript"].as_str().unwrap().trim();
        let output = entry["transformed_transcript"].as_str().unwrap().trim();
        let found = classify_invented_tokens(raw, output, &allowlist);
        split.count(&entry["capture_integrity"], !found.is_empty());
        if found.is_empty() {
            continue;
        }

        flagged += 1;
        for token in &found {
            if let Some(slot) = by_kind.iter_mut().find(|(kind, _)| *kind == token.kind) {
                slot.1 += 1;
            }
        }

        eprintln!("\n--- {} ---", entry["id"].as_str().unwrap_or("?"));
        for token in &found {
            eprintln!(
                "  [{}] {:?} from {:?}",
                token.kind.label(),
                token.token,
                token.source_fragment
            );
        }
        eprintln!("  raw: {raw}");
        eprintln!("  out: {output}");

        records.push(serde_json::json!({
            "id": entry["id"],
            "raw": raw,
            "output": output,
            "applied_rules": entry["applied_rules"],
            "findings": found
                .iter()
                .map(|token| serde_json::json!({
                    "kind": token.kind.label(),
                    "token": token.token,
                    "source_fragment": token.source_fragment,
                }))
                .collect::<Vec<_>>(),
        }));
    }

    let rate = if entries.is_empty() {
        0.0
    } else {
        flagged as f64 * 100.0 / entries.len() as f64
    };

    eprintln!("\n=== result ===");
    eprintln!("entries      = {}", entries.len());
    eprintln!("flagged      = {flagged} ({rate:.1} %)");
    for (kind, count) in &by_kind {
        eprintln!("  {:<20} {count}", kind.label());
    }
    split.report();

    let out = std::env::var("WORDSCRIPT_INVENTED_TOKEN_OUT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| config_dir.join("invented-token-measurement.json"));
    std::fs::write(
        &out,
        serde_json::to_string_pretty(&serde_json::json!({
            "profile": PROFILE_ID,
            "profile_prompt": profile_prompt,
            "vocabulary": vocabulary,
            "model": app_config["correction_model"],
            "entries": entries.len(),
            "excluded_rewriting_modes": excluded
                .iter()
                .map(|(mode, count)| serde_json::json!({ "mode": mode, "records": count }))
                .collect::<Vec<_>>(),
            "flagged": flagged,
            "rate_percent": rate,
            "capture_integrity_split": split.json(),
            "records": records,
        }))
        .unwrap(),
    )
    .unwrap_or_else(|error| panic!("write {}: {error}", out.display()));

    eprintln!("\nwrote {}", out.display());
}

// --- classifier precision ---
//
// These are the reason the classifier exists in this shape. The two correct
// German corrections below are not edge cases to tolerate; they are the test
// the metric has to pass before its number means anything.

#[test]
fn correct_german_morphology_is_not_an_invented_token() {
    for (raw, output) in [
        ("das ist der Text des Lieds", "das ist der Text des Lieder"),
        ("wenn man da switch", "wenn man da switcht"),
    ] {
        assert_eq!(
            classify_invented_tokens(raw, output, &[]),
            Vec::new(),
            "morphology flagged as invention: {raw:?} -> {output:?}"
        );
    }
}

#[test]
fn a_compound_written_as_one_word_is_not_an_invented_token() {
    let found = classify_invented_tokens(
        "die Programme drauf laufen und das Status Update",
        "die Programme drauflaufen und das Statusupdate",
        &[],
    );

    assert_eq!(found, Vec::new(), "{found:?}");
}

#[test]
fn a_spelled_out_name_fused_into_one_token_is_flagged_as_a_merge() {
    let found = classify_invented_tokens(
        "Bei c a u d e code oder codex Passt ja alles",
        "Bei CAUDE-Code oder Codex passt ja alles",
        &[],
    );

    assert_eq!(found.len(), 1, "{found:?}");
    assert_eq!(found[0].kind, InventedTokenKind::LetterRunMerge);
    assert_eq!(found[0].token, "caude");
    assert_eq!(found[0].source_fragment, "c a u d e");
}

#[test]
fn an_aborted_word_finished_into_a_different_one_is_flagged_as_a_completion() {
    let found = classify_invented_tokens(
        "Ich würde mich gerne politi... äh... ...teleportieren. Meine ich.",
        "Ich würde mich gerne politisch teleportieren. Meine ich.",
        &[],
    );

    assert_eq!(found.len(), 1, "{found:?}");
    assert_eq!(found[0].kind, InventedTokenKind::AbortedCompletion);
    assert_eq!(found[0].token, "politisch");
    assert_eq!(found[0].source_fragment, "politi");
}

#[test]
fn a_word_with_nothing_behind_it_in_the_input_is_flagged_as_unsourced() {
    let found = classify_invented_tokens(
        "und dann haben wir das halt so gemacht wie besprochen",
        "und dann haben wir das halt so gemacht wie besprochen mit den Rentnern",
        &[],
    );

    assert_eq!(found.len(), 1, "{found:?}");
    assert_eq!(found[0].kind, InventedTokenKind::NoSource);
    assert_eq!(found[0].token, "rentnern");
}

/// Vocabulary repair and the replacement dictionary introduce words the raw
/// transcript never held — that is the feature. Counting it would measure the
/// wrong thing entirely.
#[test]
fn a_deterministic_rewrite_is_not_counted_as_an_invention() {
    let dictionary = vec![DictionaryEntry {
        id: "d1".to_string(),
        phrase: "KA".to_string(),
        replace_with: "Kundenanfrage".to_string(),
    }];
    let allowlist =
        deterministic_rewrite_allowlist(&dictionary, &["WordScript".to_string()], &[]);

    let found = classify_invented_tokens(
        "die KA von gestern in wordscribt eintragen",
        "die Kundenanfrage von gestern in WordScript eintragen",
        &allowlist,
    );

    assert_eq!(found, Vec::new(), "{found:?}");
}

/// A snippet expansion is a whole sentence the trigger phrase stands for, and
/// every word of it is the feature working. This is the case that was being
/// counted: a `QA handoff` trigger in the owner's live history expanded into
/// twelve English words, all of them flagged.
#[test]
fn a_snippet_expansion_is_not_counted_as_an_invention() {
    let expansion =
        "please verify the main happy path, the known edge case and the regression check \
         noted here before sign-off.";
    let allowlist = deterministic_rewrite_allowlist(
        &[],
        &["qa handoff".to_string()],
        &[expansion.to_string()],
    );

    let found = classify_invented_tokens(
        "und dann machen wir den qa handoff",
        &format!("und dann machen wir den {expansion}"),
        &allowlist,
    );

    assert_eq!(found, Vec::new(), "{found:?}");
}

/// An inserted determiner is the grammar repair the mode is instructed to
/// perform, not an invention. The metric has to survive it, or every record
/// with a fixed article counts as a hallucination.
#[test]
fn an_inserted_function_word_is_not_an_invented_token() {
    let found = classify_invented_tokens(
        "wofur braucht man Hint der Recognizer dann",
        "wofur braucht man einen Hint fur den Recognizer dann",
        &[],
    );

    assert_eq!(found, Vec::new(), "{found:?}");
}

/// A repeated invention is one finding, not one per occurrence: the unit the
/// decision rule counts is the case, and a token repeated in a long dictation
/// would otherwise outvote every other record in the run.
#[test]
fn the_same_invented_token_is_reported_once_per_record() {
    let found = classify_invented_tokens(
        "wir gehen das durch",
        "wir gehen das Rentnern durch Rentnern",
        &[],
    );

    assert_eq!(found.len(), 1, "{found:?}");
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
