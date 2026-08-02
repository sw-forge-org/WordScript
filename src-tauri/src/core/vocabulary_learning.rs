//! Reads the correction stage's own output as evidence about what the
//! recognizer cannot spell.
//!
//! The profile's word list was a form nobody could fill. To fill it you have to
//! predict which words the recognizer will get wrong, and that knowledge does
//! not exist until the moment the text comes out wrong — a moment the user
//! spends inside a task, not inside Settings. So the list stayed empty and
//! everything built on it was worth nothing (ADR 0035).
//!
//! The evidence was already there. Every AI-mode dictation produces two texts:
//! what the recognizer heard and what the correction returned. When the cleanup
//! LLM turns "cuber netties" into "Kubernetes" it has proved three things at
//! once — the recognizer cannot spell the word, the word belongs to this
//! person's vocabulary, and the surrounding sentence was enough to identify it.
//!
//! ## Why this is not circular
//!
//! The LLM already fixed the text, so learning the term looks redundant. It is
//! not:
//!
//! - Verbatim runs no LLM at all. A learned term is repaired there, where
//!   nothing happens today.
//! - The LLM is not reliable about it. Sometimes it recognizes the term,
//!   sometimes it does not. A learned term makes the repair deterministic.
//! - Only a populated list can fill the recognizer's few slots sensibly, which
//!   *prevents* the error instead of repairing it.
//! - Deterministic repair is free and instant; every LLM correction costs
//!   tokens and latency.
//!
//! ## Why it declines more than it could
//!
//! The mirror image of `vocabulary_repair`'s restraint, with the weights the
//! other way round. There a wrong decision puts a word in the user's mouth, so
//! the guards are blunt. Here a wrong candidate is a row in a side store that
//! never reaches the promotion threshold, so the distance budget is allowed to
//! be looser than the repair layer's — see `MAX_CANDIDATE_DISTANCE_RATIO`.
//!
//! What is *not* loosened is shape. A candidate has to be a word the recognizer
//! channel could carry, long enough that a close match is evidence at all, and
//! it has to sit in a replacement that looks like a mangled name rather than a
//! rewording. Everything the correction does that is not a name repair —
//! dropping fillers, restructuring a sentence, swapping a word for a better one
//! — has to come back empty, and the corpus asserts exactly that.

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::config::{DictionaryEntry, VocabularyHintEntry, VocabularyHintOrigin};
use super::runtime_log;
use super::sessions::now_ms;
use super::transcription_hints::is_stt_hint_candidate;
use super::vocabulary_repair::{levenshtein, max_window_tokens, normalize, tokenize};

/// Below this a candidate has too many neighbours for a near match to mean
/// anything.
///
/// Five, not `vocabulary_repair::min_repairable_chars()`. The short terms are
/// the ones this whole feature exists for: `Tauri` is five characters, sits
/// below the repair floor, and is unrecoverable once the transcript exists — so
/// the recognizer slot is its only chance and it has to be learnable. Setting
/// the floor at the repair floor would drop precisely the terms that need it
/// most (ADR 0035).
const MIN_CANDIDATE_CHARS: usize = 5;

/// Allowed edit distance as a fraction of the normalized candidate length.
///
/// Deliberately looser than `vocabulary_repair::max_distance_ratio()`, because
/// the consequence differs. There, accepting too much rewrites a word the user
/// said. Here, accepting too much writes a row into a candidate store that
/// needs a second, independent sighting before it becomes anything — and a
/// candidate seen once and never again is discarded, not applied.
const MAX_CANDIDATE_DISTANCE_RATIO: f64 = 0.4;

/// Above this the pair is not a dictation any more and the alignment is not
/// worth computing. A transcript this long has been restructured far past what
/// a token diff can read as a term repair.
const MAX_DIFF_TOKENS: usize = 600;

/// Where the correction that produced a candidate came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LearningSource {
    /// The correction LLM rewrote the recognizer's output. The ordinary case,
    /// and the one that needs a second sighting: the LLM rephrases too.
    Correction,
    /// The user retyped the text in the overlay before delivery. Unambiguous,
    /// and rare — most people paste into their target document and correct
    /// there.
    HandEdit,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VocabularyCandidate {
    /// The spelling the correction settled on. This is what would be learned.
    pub term: String,
    /// What the recognizer produced in its place. Carried for the runtime log
    /// only — it is never stored as a left-hand side, because a term has none
    /// (ADR 0033).
    pub heard_as: String,
    pub source: LearningSource,
}

/// Every term the correction appears to have repaired, in order of appearance.
///
/// Empty is the normal answer. A dictation where nothing was mangled, a
/// reworded sentence, a stripped filler and a shortened phrase all produce
/// nothing, and that is the behaviour the corpus pins.
pub fn detect_candidates(
    raw_transcript: &str,
    final_text: &str,
    known_terms: &[String],
    source: LearningSource,
) -> Vec<VocabularyCandidate> {
    let raw_tokens = tokenize(raw_transcript);
    let final_tokens = tokenize(final_text);

    if raw_tokens.is_empty()
        || final_tokens.is_empty()
        || raw_tokens.len() > MAX_DIFF_TOKENS
        || final_tokens.len() > MAX_DIFF_TOKENS
    {
        return Vec::new();
    }

    let raw_normalized: Vec<String> = raw_tokens
        .iter()
        .map(|token| normalize(&raw_transcript[token.start..token.end]))
        .collect();
    let final_normalized: Vec<String> = final_tokens
        .iter()
        .map(|token| normalize(&final_text[token.start..token.end]))
        .collect();

    let mut candidates: Vec<VocabularyCandidate> = Vec::new();

    for (raw_range, final_range) in replacements(&raw_normalized, &final_normalized) {
        // Exactly one token on the final side. A replacement that produced
        // several words is a rewording, and one that produced none is a
        // deletion — neither is a term the recognizer failed to spell.
        if final_range.len() != 1 {
            continue;
        }
        // Nothing on the raw side means the correction added a word out of
        // nowhere. There is no misrecognition to learn from.
        if raw_range.is_empty() || raw_range.len() > max_window_tokens() {
            continue;
        }

        let candidate = &final_text[final_tokens[final_range.start].start
            ..final_tokens[final_range.end - 1].end];
        let heard_as = &raw_transcript
            [raw_tokens[raw_range.start].start..raw_tokens[raw_range.end - 1].end];

        if !is_acceptable_candidate(candidate, heard_as, raw_range.len()) {
            continue;
        }
        if contains_term(known_terms, candidate) {
            continue;
        }
        if candidates
            .iter()
            .any(|existing| existing.term.eq_ignore_ascii_case(candidate))
        {
            continue;
        }

        candidates.push(VocabularyCandidate {
            term: candidate.to_string(),
            heard_as: heard_as.to_string(),
            source,
        });
    }

    candidates
}

/// Everything the profile can already spell, as one list.
///
/// The dictionary's right-hand sides belong here even though they are not
/// vocabulary. `apply_text_rules` runs them over the same text this function's
/// caller diffs, so their output shows up as a replacement — and a spelling the
/// user already declared is not something to learn a second time, in a second
/// place, with different semantics.
pub fn known_terms(vocabulary: &[String], dictionary: &[DictionaryEntry]) -> Vec<String> {
    let mut terms = vocabulary.to_vec();
    terms.extend(
        dictionary
            .iter()
            .map(|entry| entry.replace_with.trim().to_string())
            .filter(|replacement| !replacement.is_empty()),
    );
    terms
}

/// Whether a term is already in a list, by the same case-insensitive comparison
/// the rest of the vocabulary path uses.
pub fn contains_term(terms: &[String], candidate: &str) -> bool {
    terms
        .iter()
        .any(|term| term.trim().eq_ignore_ascii_case(candidate.trim()))
}

fn is_acceptable_candidate(candidate: &str, heard_as: &str, raw_token_count: usize) -> bool {
    if candidate.chars().count() < MIN_CANDIDATE_CHARS {
        return false;
    }
    // A number is never a term. Without this a corrected figure reads as a
    // near-miss on a short token.
    if !candidate.chars().any(char::is_alphabetic) {
        return false;
    }
    // The recognizer channel is where a learned term earns most of its value,
    // so a candidate it could never carry is not worth storing.
    if !is_stt_hint_candidate(candidate) {
        return false;
    }

    let normalized_candidate = normalize(candidate);
    if normalized_candidate.chars().count() < MIN_CANDIDATE_CHARS {
        return false;
    }

    let normalized_heard = normalize(heard_as);
    if normalized_heard.is_empty() {
        return false;
    }

    // One token in, one token out, identical once folded: the correction only
    // changed case or punctuation. Sentence-initial capitalization does that on
    // ordinary words all day, so it is no evidence at all.
    //
    // The same equality across *several* raw tokens is the opposite — the
    // recognizer split a name it did not know and the correction joined it
    // back. "status page" to "Statuspage" is the cheapest and most common find
    // there is, and it must not be filtered out with the case-only case.
    if raw_token_count == 1 && normalized_heard == normalized_candidate {
        return false;
    }

    let budget =
        (normalized_candidate.chars().count() as f64 * MAX_CANDIDATE_DISTANCE_RATIO).floor()
            as usize;
    levenshtein(&normalized_heard, &normalized_candidate) <= budget
}

/// The spans where the two token sequences differ, as index ranges into each.
///
/// A longest-common-subsequence alignment rather than a prefix/suffix trim: a
/// single dictation can carry several independent repairs, and a trim finds
/// only the outermost one.
fn replacements(
    left: &[String],
    right: &[String],
) -> Vec<(std::ops::Range<usize>, std::ops::Range<usize>)> {
    let rows = left.len();
    let cols = right.len();
    let width = cols + 1;
    let mut table = vec![0u32; (rows + 1) * width];

    for row in (0..rows).rev() {
        for col in (0..cols).rev() {
            table[row * width + col] = if left[row] == right[col] {
                table[(row + 1) * width + col + 1] + 1
            } else {
                table[(row + 1) * width + col].max(table[row * width + col + 1])
            };
        }
    }

    let mut matched: Vec<(usize, usize)> = Vec::new();
    let (mut row, mut col) = (0usize, 0usize);
    while row < rows && col < cols {
        if left[row] == right[col] {
            matched.push((row, col));
            row += 1;
            col += 1;
        } else if table[(row + 1) * width + col] >= table[row * width + col + 1] {
            row += 1;
        } else {
            col += 1;
        }
    }

    let mut spans = Vec::new();
    let (mut left_cursor, mut right_cursor) = (0usize, 0usize);

    for (left_index, right_index) in matched.into_iter().chain(std::iter::once((rows, cols))) {
        if left_index > left_cursor || right_index > right_cursor {
            spans.push((left_cursor..left_index, right_cursor..right_index));
        }
        left_cursor = left_index + 1;
        right_cursor = right_index + 1;
    }

    spans
}

// ── The candidate store ───────────────────────────────────────────────────────

/// Observations needed before a term is written into the profile.
///
/// One is not evidence. The correction stage rephrases, and a single near-miss
/// on a word it happened to change is exactly the shape of a coincidence. Two,
/// in two separate dictations, is a pattern — and the cost of waiting for the
/// second is one dictation, paid once per term, forever.
const OBSERVATIONS_TO_PROMOTE: u32 = 2;

/// What a hand correction is worth.
///
/// Two, so it promotes on sight. When the user retypes the word themselves
/// there is no ambiguity left to resolve: they saw the wrong text and wrote the
/// right one. Nothing a second sighting could add.
const HAND_EDIT_WEIGHT: u32 = OBSERVATIONS_TO_PROMOTE;

/// A term seen once, waiting to be seen again. Scoped to the profile that was
/// active — sharing terms between profiles is a separate question about what a
/// profile means (ADR 0035).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VocabularyCandidateRecord {
    pub term: String,
    pub profile_id: String,
    pub observation_count: u32,
    pub first_seen_ms: u64,
    pub last_seen_ms: u64,
    /// Whether any observation came from the user retyping the text.
    #[serde(default)]
    pub hand_corrected: bool,
    /// The delivery this term was last counted in. A second observation from
    /// the same delivery is the same evidence twice, so it does not count —
    /// "two sightings" has to mean two occasions, not two code paths.
    #[serde(default)]
    pub last_observation_id: Option<String>,
}

/// Everything one delivery taught the profile.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LearningOutcome {
    /// Terms written into the profile by this delivery.
    pub promoted: Vec<String>,
    /// Terms recorded but still one sighting short.
    pub pending: Vec<String>,
    /// Known terms deterministic repair acted on. Drives `hit_count`.
    pub repaired: Vec<String>,
}

impl LearningOutcome {
    fn is_empty(&self) -> bool {
        self.promoted.is_empty() && self.pending.is_empty() && self.repaired.is_empty()
    }
}

pub struct LearnFromSessionRequest {
    pub profile_id: String,
    /// Identifies the delivery. The history entry id, which is unique per
    /// delivered session.
    pub observation_id: String,
    pub raw_transcript: String,
    pub final_text: String,
    /// The profile's vocabulary as the session was started with (ADR 0025).
    pub known_terms: Vec<String>,
    /// The transform's `applied_rules`, read for `vocabulary:` entries.
    pub applied_rules: Vec<String>,
    pub source: LearningSource,
}

/// The one entry point the pipeline calls, after the insert has completed.
///
/// Never fails outward. Learning is a side effect of a delivery that already
/// happened; a store that cannot be written, a config that cannot be saved and
/// a profile that vanished mid-session are all reasons to log and move on, not
/// to fail a dictation the user already has in their clipboard.
pub fn learn_from_session<R: Runtime>(app: &AppHandle<R>, request: LearnFromSessionRequest) {
    if request.profile_id.trim().is_empty() {
        return;
    }

    let candidates = detect_candidates(
        &request.raw_transcript,
        &request.final_text,
        &request.known_terms,
        request.source,
    );

    let mut outcome = match record_observations(&request.profile_id, &request.observation_id, &candidates) {
        Ok(outcome) => outcome,
        Err(error) => {
            runtime_log::record(format!(
                "[Vocabulary] Candidate store write failed profile={} error={error}",
                request.profile_id,
            ));
            LearningOutcome::default()
        }
    };
    outcome.repaired = repaired_terms(&request.applied_rules);

    if outcome.is_empty() {
        return;
    }

    for candidate in &candidates {
        runtime_log::record(format!(
            "[Vocabulary] Candidate observed profile={} term={:?} heard_as={:?} source={:?}",
            request.profile_id, candidate.term, candidate.heard_as, candidate.source,
        ));
    }

    if !outcome.promoted.is_empty() || !outcome.repaired.is_empty() {
        match apply_to_profile(&request.profile_id, &outcome) {
            Ok(config) => {
                // Only on a promotion, deliberately — not on a hit-count bump.
                //
                // An open Settings window is showing this exact list, so a new
                // row owes it the same signal every other config writer sends
                // (`set_active_profile_processing_mode`). But the frontend
                // answers `ready` by re-running `configure_native_trigger`,
                // which re-registers the shortcuts. A hit count moves on every
                // dictation that repaired something, and re-registering the
                // trigger lane that often is a far larger change than the
                // counter is worth. The count is persisted either way and the
                // panel reads it on its next load.
                if !outcome.promoted.is_empty() {
                    super::config::emit_ready_event(app, &config);
                }
            }
            Err(error) => {
                runtime_log::record(format!(
                    "[Vocabulary] Profile write failed profile={} error={error}",
                    request.profile_id,
                ));
                outcome.promoted.clear();
            }
        }
    }

    if !outcome.promoted.is_empty() {
        runtime_log::record(format!(
            "[Vocabulary] Learned profile={} terms={:?}",
            request.profile_id, outcome.promoted,
        ));
        emit_learned_event(app, &outcome.promoted);
    }
}

/// Presentation only, on its own channel.
///
/// Deliberately not `wordscript-native-event` and deliberately not
/// `wordscript-event`: per ADR 0018 and ADR 0019 a session ends in exactly one
/// reducer commit, and nothing here may set `status`, `pendingResult`,
/// `previewStaged` or `resultSurfaceOpen`. This says one thing and touches
/// nothing.
fn emit_learned_event<R: Runtime>(app: &AppHandle<R>, terms: &[String]) {
    let _ = app.emit(
        "wordscript-learning-event",
        serde_json::json!({
            "event": "vocabulary_learned",
            "terms": terms,
        }),
    );
}

/// The terms deterministic repair reported acting on, from the transform's
/// `applied_rules`. Same `vocabulary:<term>` shape `repair_vocabulary` writes.
fn repaired_terms(applied_rules: &[String]) -> Vec<String> {
    applied_rules
        .iter()
        .filter_map(|rule| rule.strip_prefix("vocabulary:"))
        .map(|term| term.to_string())
        .collect()
}

fn candidate_store_path() -> PathBuf {
    #[cfg(test)]
    if let Ok(guard) = candidate_path_override().lock() {
        if let Some(path) = guard.clone() {
            return path;
        }
    }

    super::paths::vocabulary_candidates_file_path()
}

#[cfg(test)]
fn candidate_path_override() -> &'static Mutex<Option<PathBuf>> {
    static OVERRIDE: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    OVERRIDE.get_or_init(|| Mutex::new(None))
}

/// Serializes the read-modify-write of the store within this process. The file
/// itself is small and rewritten whole, the way `history.json` is.
fn candidate_store_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn load_candidates() -> Vec<VocabularyCandidateRecord> {
    let Ok(raw) = std::fs::read_to_string(candidate_store_path()) else {
        return Vec::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn save_candidates(records: &[VocabularyCandidateRecord]) -> Result<(), String> {
    let path = candidate_store_path();
    let raw = serde_json::to_string_pretty(records).map_err(|error| error.to_string())?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(path, raw).map_err(|error| error.to_string())
}

/// Counts each candidate and reports which ones crossed the threshold.
///
/// A promoted term's record is retired here rather than left behind at its
/// count: once the term is in the profile it is a term, and a stale candidate
/// row would make it promotable a second time.
fn record_observations(
    profile_id: &str,
    observation_id: &str,
    candidates: &[VocabularyCandidate],
) -> Result<LearningOutcome, String> {
    let mut outcome = LearningOutcome::default();
    if candidates.is_empty() {
        return Ok(outcome);
    }

    let _guard = candidate_store_lock()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut records = load_candidates();
    let now = now_ms();

    for candidate in candidates {
        let weight = match candidate.source {
            LearningSource::HandEdit => HAND_EDIT_WEIGHT,
            LearningSource::Correction => 1,
        };

        let existing = records.iter_mut().find(|record| {
            record.profile_id == profile_id && record.term.eq_ignore_ascii_case(&candidate.term)
        });

        let total = match existing {
            Some(record) => {
                if record.last_observation_id.as_deref() == Some(observation_id) {
                    continue;
                }
                record.observation_count = record.observation_count.saturating_add(weight);
                record.last_seen_ms = now;
                record.last_observation_id = Some(observation_id.to_string());
                record.hand_corrected |= candidate.source == LearningSource::HandEdit;
                record.observation_count
            }
            None => {
                records.push(VocabularyCandidateRecord {
                    term: candidate.term.clone(),
                    profile_id: profile_id.to_string(),
                    observation_count: weight,
                    first_seen_ms: now,
                    last_seen_ms: now,
                    hand_corrected: candidate.source == LearningSource::HandEdit,
                    last_observation_id: Some(observation_id.to_string()),
                });
                weight
            }
        };

        if total >= OBSERVATIONS_TO_PROMOTE {
            outcome.promoted.push(candidate.term.clone());
        } else {
            outcome.pending.push(candidate.term.clone());
        }
    }

    records.retain(|record| {
        record.profile_id != profile_id
            || !outcome
                .promoted
                .iter()
                .any(|term| term.eq_ignore_ascii_case(&record.term))
    });

    save_candidates(&records)?;
    Ok(outcome)
}

/// Writes promoted terms and repair hits into the profile.
///
/// Read-modify-write inside the config file lock, the way
/// `set_active_profile_processing_mode` does it. A plain load / modify / save
/// races a concurrent settings save and silently reverts whatever the user was
/// editing — that bug already happened once, and this path runs at the end of
/// every dictation, which is exactly when someone is likely to be in Settings.
fn apply_to_profile(
    profile_id: &str,
    outcome: &LearningOutcome,
) -> Result<super::config::AppConfig, String> {
    super::config::with_config_file_lock(|| {
        let mut config = super::config::AppConfig::load_from_disk_within_lock();
        let now = now_ms();

        let Some(profile) = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == profile_id)
        else {
            return Err(format!("Profile {profile_id} no longer exists."));
        };

        apply_to_vocabulary(&mut profile.vocabulary_hints, profile_id, outcome, now);

        config.save_to_disk()?;
        Ok::<super::config::AppConfig, String>(config)
    })?
}

/// The edit itself, without the lock or the disk.
///
/// Split out because this is the part with rules in it — where a learned row
/// differs from a typed one, and what a repair hit does — while the wrapper is
/// only the read-modify-write shape every config writer shares.
fn apply_to_vocabulary(
    entries: &mut Vec<VocabularyHintEntry>,
    profile_id: &str,
    outcome: &LearningOutcome,
    now: u64,
) {
    for term in &outcome.repaired {
        if let Some(entry) = entries
            .iter_mut()
            .find(|entry| entry.phrase.trim().eq_ignore_ascii_case(term.trim()))
        {
            entry.hit_count = entry.hit_count.saturating_add(1);
        }
    }

    for (index, term) in outcome.promoted.iter().enumerate() {
        if entries
            .iter()
            .any(|entry| entry.phrase.trim().eq_ignore_ascii_case(term.trim()))
        {
            continue;
        }

        entries.push(VocabularyHintEntry {
            id: format!("{profile_id}-learned-{now}-{index}"),
            phrase: term.clone(),
            use_as_prompt_hint: false,
            origin: VocabularyHintOrigin::Learned,
            learned_at_ms: Some(now),
            hit_count: 0,
            observation_count: OBSERVATIONS_TO_PROMOTE,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn terms(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn found(raw: &str, corrected: &str) -> Vec<String> {
        detect_candidates(raw, corrected, &[], LearningSource::Correction)
            .into_iter()
            .map(|candidate| candidate.term)
            .collect()
    }

    /// The case the whole feature exists for. Nobody could have written
    /// "Kubernetes" into a form in advance; the correction wrote it for them.
    #[test]
    fn learns_a_term_the_correction_reassembled_from_two_tokens() {
        assert_eq!(
            found(
                "wir muessen das auf cuber netties umstellen",
                "wir muessen das auf Kubernetes umstellen",
            ),
            vec!["Kubernetes"]
        );
    }

    #[test]
    fn learns_a_term_the_correction_only_joined_and_capitalized() {
        assert_eq!(
            found(
                "das steht schon auf der status page",
                "das steht schon auf der Statuspage",
            ),
            vec!["Statuspage"]
        );
    }

    /// Short terms are the ones the recognizer slot exists for, so the floor
    /// has to sit below the repair floor rather than on it.
    #[test]
    fn learns_a_term_shorter_than_the_repair_floor() {
        let learned = found(
            "wir bauen das mit Tori und React",
            "wir bauen das mit Tauri und React",
        );

        assert_eq!(learned, vec!["Tauri"]);
        assert!(
            "Tauri".chars().count() < super::super::vocabulary_repair::min_repairable_chars(),
            "the case is only interesting while Tauri is below the repair floor"
        );
    }

    // --- the negatives, which are the point ---

    #[test]
    fn a_reworded_verb_is_not_a_term() {
        assert!(found(
            "ich denke wir shippen das morgen",
            "ich glaube wir shippen das morgen",
        )
        .is_empty());
    }

    #[test]
    fn a_stripped_filler_is_not_a_term() {
        assert!(found(
            "also ähm wir shippen das morgen",
            "wir shippen das morgen",
        )
        .is_empty());
    }

    #[test]
    fn a_shortened_sentence_is_not_a_term() {
        assert!(found(
            "wir shippen das morgen und zwar ganz sicher auf jeden Fall",
            "wir shippen das morgen ganz sicher",
        )
        .is_empty());
    }

    #[test]
    fn a_sentence_initial_capital_is_not_a_term() {
        assert!(found("wir shippen das morgen", "Wir shippen das morgen").is_empty());
    }

    #[test]
    fn added_punctuation_alone_is_not_a_term() {
        assert!(found(
            "laeuft das schon oder nicht",
            "Laeuft das schon, oder nicht?",
        )
        .is_empty());
    }

    #[test]
    fn a_word_below_the_length_floor_is_not_a_term() {
        // "Tori" is four characters; at that length a near match is noise.
        assert!(found("meine Kollegin Tori kommt", "meine Kollegin Tor kommt").is_empty());
    }

    #[test]
    fn a_corrected_number_is_not_a_term() {
        assert!(found("das war im Jahr 20240", "das war im Jahr 20250").is_empty());
    }

    #[test]
    fn an_unchanged_transcript_yields_nothing() {
        assert!(found("wir shippen das morgen", "wir shippen das morgen").is_empty());
    }

    #[test]
    fn empty_input_yields_nothing() {
        assert!(found("", "Kubernetes").is_empty());
        assert!(found("cuber netties", "").is_empty());
    }

    // --- bookkeeping ---

    #[test]
    fn a_term_the_profile_already_carries_is_not_a_candidate_again() {
        let learned = detect_candidates(
            "wir muessen das auf cuber netties umstellen",
            "wir muessen das auf Kubernetes umstellen",
            &terms(&["kubernetes"]),
            LearningSource::Correction,
        );

        assert!(learned.is_empty(), "a hit is not a find");
    }

    #[test]
    fn two_repairs_in_one_dictation_are_both_found() {
        let learned = found(
            "cuber netties laeuft und die status page auch",
            "Kubernetes laeuft und die Statuspage auch",
        );

        assert_eq!(learned, vec!["Kubernetes", "Statuspage"]);
    }

    #[test]
    fn the_same_term_twice_is_reported_once() {
        assert_eq!(
            found(
                "cuber netties hier und cuber netties da",
                "Kubernetes hier und Kubernetes da",
            ),
            vec!["Kubernetes"]
        );
    }

    #[test]
    fn the_recognizers_own_wording_is_carried_for_the_log() {
        let learned = detect_candidates(
            "wir muessen das auf cuber netties umstellen",
            "wir muessen das auf Kubernetes umstellen",
            &[],
            LearningSource::Correction,
        );

        assert_eq!(learned[0].heard_as, "cuber netties");
        assert_eq!(learned[0].source, LearningSource::Correction);
    }

    #[test]
    fn the_hand_edit_source_is_carried_through() {
        let learned = detect_candidates(
            "wir muessen das auf cuber netties umstellen",
            "wir muessen das auf Kubernetes umstellen",
            &[],
            LearningSource::HandEdit,
        );

        assert_eq!(learned[0].source, LearningSource::HandEdit);
    }

    /// The two thresholds have to stay comparable, and this one has to stay the
    /// looser of the pair. If repair ever loosens past learning, a candidate
    /// could be accepted for a rewrite the proposing layer would have declined.
    #[test]
    fn the_candidate_threshold_stays_looser_than_the_repair_threshold() {
        let repair = super::super::vocabulary_repair::max_distance_ratio();
        assert!(
            MAX_CANDIDATE_DISTANCE_RATIO > repair,
            "learning {MAX_CANDIDATE_DISTANCE_RATIO} must stay looser than repair {repair}",
        );
    }

    #[test]
    fn a_transcript_past_the_diff_ceiling_is_declined_rather_than_aligned() {
        let long = (0..MAX_DIFF_TOKENS + 10)
            .map(|index| format!("wort{index}"))
            .collect::<Vec<_>>()
            .join(" ");

        assert!(found(&long, &long).is_empty());
    }

    // ── the store ─────────────────────────────────────────────────────────────

    /// The store is a single process-wide file, so its tests take turns.
    fn store_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn prepare_store(name: &str) {
        let path = super::super::paths::user_data_dir().join(format!("candidates-{name}.json"));
        let _ = std::fs::remove_file(&path);
        *candidate_path_override()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(path);
    }

    fn candidate(term: &str, source: LearningSource) -> VocabularyCandidate {
        VocabularyCandidate {
            term: term.to_string(),
            heard_as: "cuber netties".to_string(),
            source,
        }
    }

    /// The threshold, stated as behaviour: one sighting changes nothing about
    /// the profile, and the second one is what makes the term real.
    #[test]
    fn a_term_is_promoted_on_the_second_sighting_and_not_the_first() {
        let _guard = store_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_store("second-sighting");

        let first = record_observations(
            "support",
            "history-1",
            &[candidate("Kubernetes", LearningSource::Correction)],
        )
        .unwrap();
        assert!(first.promoted.is_empty());
        assert_eq!(first.pending, vec!["Kubernetes"]);

        let second = record_observations(
            "support",
            "history-2",
            &[candidate("Kubernetes", LearningSource::Correction)],
        )
        .unwrap();
        assert_eq!(second.promoted, vec!["Kubernetes"]);
        assert!(second.pending.is_empty());
    }

    /// "Two sightings" has to mean two occasions. The same delivery reaching
    /// this twice — a retry, a second code path — is the same evidence, not a
    /// pattern.
    #[test]
    fn the_same_delivery_cannot_supply_both_sightings() {
        let _guard = store_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_store("same-delivery");

        let terms = [candidate("Kubernetes", LearningSource::Correction)];
        record_observations("support", "history-1", &terms).unwrap();
        let repeat = record_observations("support", "history-1", &terms).unwrap();

        assert!(repeat.promoted.is_empty());
        assert!(repeat.pending.is_empty());
    }

    #[test]
    fn a_hand_correction_promotes_immediately() {
        let _guard = store_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_store("hand-edit");

        let outcome = record_observations(
            "support",
            "history-1",
            &[candidate("Kubernetes", LearningSource::HandEdit)],
        )
        .unwrap();

        assert_eq!(outcome.promoted, vec!["Kubernetes"]);
    }

    /// A candidate belongs to the profile that was active. Sharing terms
    /// between profiles is a separate question about what a profile means.
    #[test]
    fn a_sighting_in_another_profile_does_not_count() {
        let _guard = store_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_store("per-profile");

        let terms = [candidate("Kubernetes", LearningSource::Correction)];
        record_observations("support", "history-1", &terms).unwrap();
        let other = record_observations("sales", "history-2", &terms).unwrap();

        assert!(other.promoted.is_empty(), "each profile counts for itself");
    }

    /// Once the term is in the profile the candidate row has to go, or the same
    /// term promotes again on its next sighting.
    #[test]
    fn a_promoted_term_stops_being_a_candidate() {
        let _guard = store_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_store("retire");

        let terms = [candidate("Kubernetes", LearningSource::Correction)];
        record_observations("support", "history-1", &terms).unwrap();
        record_observations("support", "history-2", &terms).unwrap();

        let remaining = load_candidates();
        assert!(
            !remaining
                .iter()
                .any(|record| record.term == "Kubernetes" && record.profile_id == "support"),
            "the candidate row outlived its promotion: {remaining:?}"
        );
    }

    #[test]
    fn nothing_is_written_when_there_is_nothing_to_record() {
        let _guard = store_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_store("no-op");

        let outcome = record_observations("support", "history-1", &[]).unwrap();

        assert_eq!(outcome, LearningOutcome::default());
        assert!(!candidate_store_path().exists());
    }

    // ── writing into the profile ──────────────────────────────────────────────

    #[test]
    fn a_promoted_term_lands_as_a_learned_row() {
        let mut entries = Vec::new();
        apply_to_vocabulary(
            &mut entries,
            "support",
            &LearningOutcome {
                promoted: vec!["Kubernetes".to_string()],
                ..LearningOutcome::default()
            },
            1_700_000_000_000,
        );

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].phrase, "Kubernetes");
        assert_eq!(entries[0].origin, VocabularyHintOrigin::Learned);
        assert_eq!(entries[0].learned_at_ms, Some(1_700_000_000_000));
        assert_eq!(entries[0].observation_count, OBSERVATIONS_TO_PROMOTE);
        assert_eq!(entries[0].hit_count, 0);
    }

    #[test]
    fn a_term_the_user_typed_is_never_duplicated_or_relabelled() {
        let mut entries = vec![VocabularyHintEntry {
            id: "support-vocab-0".to_string(),
            phrase: "kubernetes".to_string(),
            origin: VocabularyHintOrigin::User,
            ..VocabularyHintEntry::default()
        }];

        apply_to_vocabulary(
            &mut entries,
            "support",
            &LearningOutcome {
                promoted: vec!["Kubernetes".to_string()],
                ..LearningOutcome::default()
            },
            1,
        );

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].origin, VocabularyHintOrigin::User);
    }

    /// A term list nobody can judge is a term list nobody prunes. The hit count
    /// is what lets a row say whether it earns its place.
    #[test]
    fn a_repair_bumps_the_terms_hit_count() {
        let mut entries = vec![VocabularyHintEntry {
            id: "support-vocab-0".to_string(),
            phrase: "Kubernetes".to_string(),
            ..VocabularyHintEntry::default()
        }];

        apply_to_vocabulary(
            &mut entries,
            "support",
            &LearningOutcome {
                repaired: vec!["Kubernetes".to_string()],
                ..LearningOutcome::default()
            },
            1,
        );

        assert_eq!(entries[0].hit_count, 1);
    }

    #[test]
    fn repair_hits_are_read_from_the_transforms_own_rules() {
        assert_eq!(
            repaired_terms(&[
                "post_corrected".to_string(),
                "vocabulary:Kubernetes".to_string(),
                "dictionary:KA".to_string(),
                "vocabulary:Statuspage".to_string(),
            ]),
            vec!["Kubernetes", "Statuspage"]
        );
    }

    /// The dictionary rewrites the same text this module diffs, so its output
    /// looks exactly like a repair. A spelling the user already declared must
    /// not be learned a second time in a second place.
    #[test]
    fn a_dictionary_replacement_counts_as_already_known() {
        let known = known_terms(
            &terms(&["Statuspage"]),
            &[DictionaryEntry {
                id: "d1".to_string(),
                phrase: "cuber netties".to_string(),
                replace_with: "Kubernetes".to_string(),
                ..DictionaryEntry::default()
            }],
        );

        assert!(contains_term(&known, "Kubernetes"));
        assert!(contains_term(&known, "statuspage"));
    }
}
