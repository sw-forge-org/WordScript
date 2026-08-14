use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde::Deserialize;

use super::config::{
    BiasMode, DictionaryEntry, ManualBias, ProcessingMode, TextProfile, TextProfileWorkMode,
};
use super::agent::{build_agent_system_prompt, AgentConfig};
use super::communication_style::CommunicationStyle;
use super::prompt_enhance::{build_enhance_system_prompt, PromptEnhanceConfig};
use super::transform::{correction_system_prompt, NativeTransformConfig};
use super::workspace_context::WorkspaceContext;
use super::text_rules::{
    analyze_document, get_profile_health, GetProfileHealthRequest, TextRulesDocument,
};
use super::capture::{cadence_log_lines, CallbackCadence, CaptureIntegrity, CaptureIntegrityVerdict};
use super::hallucination_detect::{detect_advanced_hallucination, DriftCorroboration};
use super::recognizer_repair::{repair_singular_address, strip_prompt_echo};
use super::transcription_hints::{analyze_transcription_bias_with_mode, BiasRequestContext};

const CORPUS_VERSION: u32 = 4;
const TEXT_RULES_SCHEMA_VERSION: u32 = 1;
const EMBEDDED_CORPUS: &str = include_str!("../../tests/fixtures/regression_transcripts.json");

#[derive(Debug, Clone, Deserialize)]
struct CorpusFile {
    version: u32,
    #[serde(default)]
    entries: Vec<CorpusEntry>,
}

#[derive(Debug, Clone, Deserialize)]
struct CorpusEntry {
    id: String,
    #[serde(default)]
    failure_mode: String,
    profile: CorpusProfile,
    raw_transcript: String,
    #[serde(default)]
    expected_transcription_bias: Option<ExpectedBias>,
    #[serde(default)]
    expected_detection: Option<ExpectedDetection>,
    /// The profile language the detection stage compares against, and whether
    /// it is pinned. Absent means auto-detect, which never allows a strip.
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    language_locked: bool,
    /// Whether the confidence gate upstream rejected a segment. This is the
    /// corroboration a language mismatch needs before anything is removed.
    #[serde(default)]
    low_confidence_segments: bool,
    /// Invariants the assembled correction system prompt must satisfy. Prompt
    /// shape is the only lever the product has over the cleanup LLM, so the
    /// guards against it belong in the corpus next to the transcripts they
    /// protect.
    #[serde(default)]
    expected_correction_prompt: Option<ExpectedCorrectionPrompt>,
    /// Invariants the profile context must satisfy in *every* listed mode's
    /// prompt. The correction prompt has its own block above; this one exists
    /// because the defect ADR 0021 fixed was a difference *between* modes, and
    /// a per-mode assertion cannot catch that class of drift.
    #[serde(default)]
    expected_profile_context: Option<ExpectedProfileContext>,
    /// What the prompt-echo strip must do to `raw_transcript`, given the prompt
    /// the request actually sent. Negative entries carry `stripped: false` and
    /// a `text` equal to the input, and they are the ones that matter: a missed
    /// echo is a visible artifact somebody deletes by hand, a wrong strip
    /// deletes something the speaker said (ADR 0080).
    #[serde(default)]
    expected_prompt_echo: Option<ExpectedPromptEcho>,
    /// What the singular-address repair must do to `raw_transcript`. Same
    /// asymmetry, sharper: this rule rewrites a word, and the corpus's negative
    /// entries are drawn from real German the owner dictated (ADR 0081).
    #[serde(default)]
    expected_address_repair: Option<ExpectedAddressRepair>,
    /// What the capture behind an entry measured about itself, and what the
    /// verdict has to be. The text is never touched on this axis — the entry
    /// asserts that too (ADR 0079).
    #[serde(default)]
    expected_capture_integrity: Option<ExpectedCaptureIntegrity>,
    /// What the callback cadence of an OBSERVED capture reported about itself.
    /// Present only on entries drawn from a real runtime log: every other
    /// cadence assertion in this repo drives a synthetic timeline, which pins
    /// the arithmetic and not the phenomenon (ADR 0083, ADR 0133).
    #[serde(default)]
    expected_callback_cadence: Option<ExpectedCallbackCadence>,
    /// What deterministic vocabulary repair must do to `raw_transcript`.
    /// Negative cases carry the same shape with `text` equal to the input, and
    /// they are the ones that matter: a missed repair is readable text, a wrong
    /// one is a word the user never said (ADR 0033).
    #[serde(default)]
    expected_vocabulary_repair: Option<ExpectedVocabularyRepair>,
    /// Which terms `vocabulary_learning` must read out of the `raw_transcript`
    /// / `expected_post_correction` pair. An empty list is an assertion, not an
    /// omission: everything the correction does that is not a term repair has
    /// to come back empty, and those entries are what stop the detector from
    /// turning ordinary rewording into vocabulary (ADR 0035).
    #[serde(default)]
    expected_vocabulary_candidates: Option<Vec<String>>,
    /// What the correction model returned. Present only on entries that pin a
    /// guardrail: without a model reply there is nothing for the guardrail to
    /// act on, and asserting the shipped text alone would test nothing.
    #[serde(default)]
    biased_correction: Option<String>,
    expected_post_correction: String,
    /// The `applied_rules` entry `normalize_correction` must produce for
    /// `biased_correction`. Null asserts the reply passes through untouched,
    /// which is the half of the corpus that keeps a guardrail from growing
    /// teeth it was never meant to have.
    #[serde(default)]
    expected_guardrail: Option<String>,
    #[allow(dead_code)]
    notes: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedDetection {
    text: String,
    /// Asserts the transcript comes back byte-identical. The guarantee that
    /// legitimate multilingual dictation is never altered lives here.
    #[serde(default)]
    unchanged: bool,
    #[serde(default)]
    char_repetition_collapsed: bool,
    #[serde(default)]
    word_repetition_collapsed: bool,
    #[serde(default)]
    phrase_repetition_collapsed: bool,
    #[serde(default)]
    artifact_pattern_filtered: bool,
    #[serde(default)]
    language_switch_flagged: bool,
    #[serde(default)]
    language_drift_stripped: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedCorrectionPrompt {
    /// The processing mode whose preset the prompt is built from.
    mode: String,
    /// Foreground app fed in as workspace context, when the case covers it.
    #[serde(default)]
    workspace_app: Option<String>,
    #[serde(default)]
    workspace_category: Option<String>,
    #[serde(default)]
    contains: Vec<String>,
    #[serde(default)]
    not_contains: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedProfileContext {
    /// Every mode whose prompt must satisfy the assertions below.
    modes: Vec<String>,
    #[serde(default)]
    contains: Vec<String>,
    #[serde(default)]
    not_contains: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedPromptEcho {
    /// The initial prompt the request sent. Stated per entry rather than
    /// rebuilt, because the strip's whole justification is that it removes an
    /// echo of a KNOWN string — a corpus that reconstructed the prompt would be
    /// testing the reconstruction.
    prompt: String,
    /// The transcript after the strip. Equal to `raw_transcript` for an entry
    /// that must not fire; empty where the whole transcript was the echo.
    text: String,
    #[serde(default)]
    stripped: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedAddressRepair {
    /// The transcript after the repair, equal to `raw_transcript` where the
    /// rule must decline.
    text: String,
    #[serde(default)]
    restored: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedCaptureIntegrity {
    wall_seconds: f64,
    recorded_seconds: f64,
    /// `intact`, `short` or `not_measured`.
    verdict: String,
}

/// The cadence line of one observed capture, field for field as the runtime
/// log wrote it.
///
/// The gap list is what makes this replayable rather than merely recorded: a
/// capture's cadence is fully determined by its callback count, its nominal
/// callback size and the stretches in which no callback arrived, so an entry
/// carrying those three can be driven back through `CallbackCadence` and
/// checked against the line the event actually produced.
#[derive(Debug, Clone, Deserialize)]
struct ExpectedCallbackCadence {
    /// The runtime log's session id, so the entry can be traced back to the
    /// lines it was read from rather than being taken on trust.
    #[allow(dead_code)]
    session: String,
    sample_rate: u32,
    channels: u16,
    nominal_samples: usize,
    callbacks: u64,
    gaps: Vec<RecordedCallbackGap>,
    longest_gap_ms: u128,
    gaps_over_threshold: u64,
    oversized_resumes: usize,
    lost_in_gaps_seconds: f64,
    share_of_missing: f64,
    signature: String,
    /// The missing audio that sits in no gap over the threshold, and which no
    /// field of today's cadence line reports (ADR 0133, decision 3). It is a
    /// derived figure, kept here so the entry states the deficiency rather than
    /// leaving a reader to subtract two numbers and notice.
    ///
    /// **This entry cannot validate the field that will attribute it.** The
    /// per-callback jitter it consists of was never written to the log — only
    /// its total — so a replay reconstructs none of it. That check belongs to a
    /// synthetic timeline, where the jitter is chosen and therefore known.
    unattributed_seconds: f64,
}

/// One `Capture callback gap` line: when the stream came back, how long it had
/// been away, and what the resuming callback carried.
#[derive(Debug, Clone, Copy, Deserialize)]
struct RecordedCallbackGap {
    at_ms: u64,
    gap_ms: u64,
    samples: usize,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedVocabularyRepair {
    /// The transcript after repair. Equal to `raw_transcript` for a case that
    /// must not fire.
    text: String,
    /// Terms whose repair must be reported. Empty asserts nothing was applied.
    #[serde(default)]
    applied: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct CorpusProfile {
    id: String,
    prompt: String,
    stt_hints: String,
    /// Every vocabulary term. Drives deterministic repair and reaches every LLM
    /// stage as granular context (ADR 0033).
    #[serde(default)]
    vocabulary: Vec<String>,
    #[serde(default)]
    dictionary_entries: Vec<DictionaryEntry>,
    #[serde(default)]
    #[allow(dead_code)]
    snippet_entries: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedBias {
    #[serde(default)]
    dictionary_terms: Vec<String>,
    #[serde(default)]
    stt_hints: Vec<String>,
}

/// Optional filesystem override for the corpus. The default load path is
/// `tests/fixtures/regression_transcripts.json`; in CI and release builds we
/// embed it with `include_str!` so the test never depends on cwd.
fn corpus_override_path() -> Option<PathBuf> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    Some(
        PathBuf::from(manifest_dir)
            .join("tests")
            .join("fixtures")
            .join("regression_transcripts.local.json"),
    )
}

pub fn load_corpus() -> CorpusFile {
    let raw = match corpus_override_path().and_then(|path| fs::read_to_string(path).ok()) {
        Some(local) => local,
        None => EMBEDDED_CORPUS.to_string(),
    };
    let corpus: CorpusFile = serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("parse regression corpus: {error}"));

    assert_eq!(
        corpus.version, CORPUS_VERSION,
        "corpus version mismatch: file={} expected={}",
        corpus.version, CORPUS_VERSION
    );

    corpus
}

fn text_profile_from_corpus(corpus: &CorpusProfile) -> TextProfile {
    TextProfile {
        id: corpus.id.clone(),
        label: corpus.id.clone(),
        prompt: corpus.prompt.clone(),
        stt_hints: corpus.stt_hints.clone(),
        work_mode: TextProfileWorkMode {
            bias_mode: BiasMode::Conservative,
            manual_bias: ManualBias::default(),
            ..TextProfileWorkMode::default()
        },
        dictionary_entries: corpus.dictionary_entries.clone(),
        snippet_entries: Vec::new(),
        ..TextProfile::default()
    }
}

fn conservative_context() -> BiasRequestContext {
    BiasRequestContext {
        bias_mode: BiasMode::Conservative,
        manual_bias: ManualBias::default(),
        local_prompt_strength: "profile".to_string(),
        local_prompt_carry: false,
    }
}

#[test]
fn corpus_schema_is_valid() {
    let corpus = load_corpus();
    assert!(
        !corpus.entries.is_empty(),
        "corpus must contain at least one entry"
    );
    let mut ids: Vec<&str> = corpus.entries.iter().map(|e| e.id.as_str()).collect();
    ids.sort();
    ids.dedup();
    assert_eq!(
        ids.len(),
        corpus.entries.len(),
        "corpus entries must have unique ids"
    );
}

#[test]
fn corpus_drives_transcription_bias_assertions() {
    let corpus = load_corpus();
    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_transcription_bias else {
            continue;
        };
        let bias = analyze_transcription_bias_with_mode(
            &entry.profile.stt_hints,
            &entry.profile.dictionary_entries,
            &conservative_context(),
        );

        assert_eq!(
            bias.dictionary_terms, expected.dictionary_terms,
            "[{}] dictionary_terms mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );
        assert_eq!(
            bias.stt_hints, expected.stt_hints,
            "[{}] stt_hints mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );
    }
}

/// Runs the model reply the corpus recorded through the real guardrails.
///
/// The prompt assertions below only prove a sentence is in the prompt, not that
/// the model obeyed it — that gap is exactly why the fifth guardrail is a
/// deterministic rule rather than a sixth prompt line (ADR 0036). This test
/// closes it for the cases where a reply was captured: the guardrail either
/// fires and produces the expected text, or the reply survives untouched.
#[test]
fn corpus_drives_correction_guardrail_assertions() {
    let corpus = load_corpus();
    let mut fired = 0;
    let mut passed_through = 0;

    for entry in &corpus.entries {
        let Some(biased) = &entry.biased_correction else {
            continue;
        };

        let preset = ProcessingMode::Cleanup.transform_preset();
        let result = super::transform::normalize_correction_for_tests(
            &entry.raw_transcript,
            biased,
            &NativeTransformConfig {
                profile_prompt: entry.profile.prompt.clone(),
                dictionary_entries: entry.profile.dictionary_entries.clone(),
                post_process: preset.post_process,
                filter_fillers: preset.filter_fillers,
                professionalize: preset.professionalize,
                ..NativeTransformConfig::default()
            },
        );

        assert_eq!(
            result.text, entry.expected_post_correction,
            "[{}] post-correction text mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );

        match &entry.expected_guardrail {
            Some(rule) => {
                assert!(
                    result.applied_rules.contains(rule),
                    "[{}] expected guardrail {rule:?}, got {:?} (failure_mode={})",
                    entry.id,
                    result.applied_rules,
                    entry.failure_mode
                );
                fired += 1;
            }
            None => {
                assert_eq!(
                    result.text, *biased,
                    "[{}] reply was altered although no guardrail was expected (failure_mode={})",
                    entry.id, entry.failure_mode
                );
                passed_through += 1;
            }
        }
    }

    assert!(
        fired >= 1 && passed_through >= 1,
        "the guardrail corpus needs both directions, fired={fired} passed_through={passed_through}"
    );
}

#[test]
fn corpus_drives_correction_prompt_assertions() {
    let corpus = load_corpus();
    let mut checked = 0;

    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_correction_prompt else {
            continue;
        };
        checked += 1;

        let preset = ProcessingMode::from_str(&expected.mode).transform_preset();
        let workspace_hint = expected.workspace_app.as_ref().map(|app| WorkspaceContext {
            app_name: app.clone(),
            category: expected.workspace_category.clone().unwrap_or_default(),
            ..WorkspaceContext::default()
        });

        let prompt = correction_system_prompt(&NativeTransformConfig {
            profile_prompt: entry.profile.prompt.clone(),
            dictionary_entries: entry.profile.dictionary_entries.clone(),
            post_process: preset.post_process,
            filter_fillers: preset.filter_fillers,
            professionalize: preset.professionalize,
            workspace_hint,
            ..NativeTransformConfig::default()
        });

        for needle in &expected.contains {
            assert!(
                prompt.contains(needle),
                "[{}] correction prompt missing {:?} (failure_mode={})",
                entry.id,
                needle,
                entry.failure_mode
            );
        }
        for needle in &expected.not_contains {
            assert!(
                !prompt.contains(needle),
                "[{}] correction prompt unexpectedly contains {:?} (failure_mode={})",
                entry.id,
                needle,
                entry.failure_mode
            );
        }
    }

    assert!(
        checked > 0,
        "corpus must cover at least one correction-prompt case"
    );
}

/// Builds the prompt each mode actually sends and asserts the profile context
/// arrives the same way in all of them.
///
/// The defect this guards was invisible to per-mode tests: every mode's prompt
/// was individually defensible, and only the comparison showed that the same
/// profile field reached them in three different widths (ADR 0021).
#[test]
fn corpus_drives_profile_context_parity_across_modes() {
    let corpus = load_corpus();
    let mut checked = 0;

    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_profile_context else {
            continue;
        };
        assert!(
            !expected.modes.is_empty(),
            "[{}] expected_profile_context needs at least one mode",
            entry.id
        );

        for mode in &expected.modes {
            checked += 1;
            let prompt = mode_prompt_for(mode, entry);

            for needle in &expected.contains {
                assert!(
                    prompt.contains(needle),
                    "[{}] {mode} prompt missing {:?}\n--- prompt ---\n{prompt}",
                    entry.id,
                    needle
                );
            }
            for needle in &expected.not_contains {
                assert!(
                    !prompt.contains(needle),
                    "[{}] {mode} prompt unexpectedly contains {:?}\n--- prompt ---\n{prompt}",
                    entry.id,
                    needle
                );
            }
        }
    }

    assert!(
        checked > 0,
        "corpus must cover at least one profile-context parity case"
    );
}

/// The prompt a mode assembles from a corpus profile. Each arm calls the
/// production builder for that mode — a copy here would assert a prompt the
/// product does not send.
fn mode_prompt_for(mode: &str, entry: &CorpusEntry) -> String {
    match mode {
        "cleanup" | "rewrite" | "verbatim" => {
            let preset = ProcessingMode::from_str(mode).transform_preset();
            correction_system_prompt(&NativeTransformConfig {
                profile_prompt: entry.profile.prompt.clone(),
                vocabulary: entry.profile.vocabulary.clone(),
                dictionary_entries: entry.profile.dictionary_entries.clone(),
                post_process: preset.post_process,
                filter_fillers: preset.filter_fillers,
                professionalize: preset.professionalize,
                ..NativeTransformConfig::default()
            })
        }
        // The full system prompt, not just the context block. Building only
        // `build_profile_context` here left every framing sentence around the
        // context outside the check — including the one that decides whether
        // the block is a reading aid or an offer of material (ADR 0023).
        "agent" => build_agent_system_prompt(&AgentConfig {
            provider: "groq".to_string(),
            agent_name: "WordScript".to_string(),
            agent_model: String::new(),
            profile_label: entry.profile.id.clone(),
            profile_prompt: entry.profile.prompt.clone(),
            vocabulary: entry.profile.vocabulary.clone(),
            dictionary_entries: entry.profile.dictionary_entries.clone(),
            snippet_entries: Vec::new(),
            workspace_context: None,
            style: CommunicationStyle::default(),
        }),
        "prompt_enhance" => build_enhance_system_prompt(&PromptEnhanceConfig {
            provider: "groq".to_string(),
            model: String::new(),
            sub_mode: "enhance".to_string(),
            target: "general".to_string(),
            profile_prompt: entry.profile.prompt.clone(),
            vocabulary: entry.profile.vocabulary.clone(),
            workspace_context: None,
        }),
        other => panic!("[{}] unknown mode in expected_profile_context: {other}", entry.id),
    }
}

#[test]
fn corpus_drives_hallucination_detection_assertions() {
    let corpus = load_corpus();
    let mut checked = 0;

    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_detection else {
            continue;
        };
        checked += 1;

        let (text, signals) = detect_advanced_hallucination(
            &entry.raw_transcript,
            entry.language.as_deref(),
            DriftCorroboration {
                low_confidence_segments: entry.low_confidence_segments,
                language_locked: entry.language_locked,
                ..DriftCorroboration::default()
            },
        );

        assert_eq!(
            text, expected.text,
            "[{}] detected text mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );

        if expected.unchanged {
            assert_eq!(
                text, entry.raw_transcript,
                "[{}] legitimate dictation must survive byte-identical (failure_mode={})",
                entry.id, entry.failure_mode
            );
            assert!(
                !signals.changed_text(),
                "[{}] no rule may alter legitimate dictation, got {:?}",
                entry.id,
                signals.applied_rules()
            );
        }

        assert_eq!(
            signals.char_repetition_collapsed, expected.char_repetition_collapsed,
            "[{}] char_repetition_collapsed mismatch",
            entry.id
        );
        assert_eq!(
            signals.word_repetition_collapsed, expected.word_repetition_collapsed,
            "[{}] word_repetition_collapsed mismatch",
            entry.id
        );
        assert_eq!(
            signals.phrase_repetition_collapsed, expected.phrase_repetition_collapsed,
            "[{}] phrase_repetition_collapsed mismatch",
            entry.id
        );
        assert_eq!(
            signals.artifact_pattern_filtered, expected.artifact_pattern_filtered,
            "[{}] artifact_pattern_filtered mismatch",
            entry.id
        );
        assert_eq!(
            signals.language_switch_flagged, expected.language_switch_flagged,
            "[{}] language_switch_flagged mismatch",
            entry.id
        );
        assert_eq!(
            signals.language_drift_stripped, expected.language_drift_stripped,
            "[{}] language_drift_stripped mismatch",
            entry.id
        );
    }

    assert!(
        checked >= 6,
        "the detection corpus must keep covering every mechanism, checked={checked}"
    );
}

/// The prompt-echo strip, against the prompt each entry says was sent.
///
/// Both directions are required, and the negative one is the reason this is a
/// corpus rather than a unit test: the entries that must NOT fire are real
/// transcripts from the owner's machine, including the one where he said the
/// prompt text out loud while complaining about it. A rule that cannot tell
/// that apart from a leak deletes what the speaker said, which is a worse
/// defect than the one it fixes (ADR 0080).
#[test]
fn corpus_drives_prompt_echo_assertions() {
    let corpus = load_corpus();
    let mut stripped = 0;
    let mut left_alone = 0;

    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_prompt_echo else {
            continue;
        };

        let (text, fired) = strip_prompt_echo(&entry.raw_transcript, Some(&expected.prompt));

        assert_eq!(
            text, expected.text,
            "[{}] stripped text mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );
        assert_eq!(
            fired, expected.stripped,
            "[{}] strip fired={} but the corpus expects {} (failure_mode={})",
            entry.id, fired, expected.stripped, entry.failure_mode
        );

        if expected.stripped {
            // It removes; it never restores. A strip that produced MORE text
            // than it was given would be inventing the displaced words.
            assert!(
                text.len() <= entry.raw_transcript.len(),
                "[{}] the strip may only ever shorten a transcript",
                entry.id
            );
            stripped += 1;
        } else {
            assert_eq!(
                text, entry.raw_transcript,
                "[{}] a declined strip must leave the transcript byte-identical",
                entry.id
            );
            left_alone += 1;
        }
    }

    assert!(
        stripped >= 4 && left_alone >= 2,
        "the echo corpus needs both directions, stripped={stripped} left_alone={left_alone}"
    );
}

/// The singular-address repair, the German it must not touch, and the languages
/// it must not run in at all.
///
/// The negative entries carry more weight than the positive ones here. A missed
/// pluralization is a sentence addressed to the wrong number of people; a wrong
/// repair rewrites correct German into something the speaker never said, and
/// `Macht das Sinn?` occurs six-plus times in the corpus's source history
/// against three real defects.
///
/// **Driven through the whole stage rather than the rule**, so the language gate
/// is under test alongside the grammar: the corpus carries the same transcript
/// under `de` and under `en`, and only one of them may be rewritten (ADR 0081).
#[test]
fn corpus_drives_singular_address_assertions() {
    let corpus = load_corpus();
    let mut restored = 0;
    let mut declined = 0;

    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_address_repair else {
            continue;
        };

        let (text, signals) = super::recognizer_repair::repair_recognizer_output(
            &entry.raw_transcript,
            None,
            entry.language.as_deref(),
        );
        let fired = signals.singular_address_restored;

        assert_eq!(
            text, expected.text,
            "[{}] repaired text mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );
        assert_eq!(
            fired, expected.restored,
            "[{}] repair fired={} but the corpus expects {} (failure_mode={})",
            entry.id, fired, expected.restored, entry.failure_mode
        );

        if expected.restored {
            restored += 1;
        } else {
            assert_eq!(
                text, entry.raw_transcript,
                "[{}] a declined repair must leave the transcript byte-identical",
                entry.id
            );
            declined += 1;
        }
    }

    assert!(
        restored >= 2 && declined >= 5,
        "the address corpus needs both directions, restored={restored} declined={declined}"
    );
}

/// The capture verdict, and the fact that it changes no text.
///
/// A short capture is REPORTED and never repaired: the audio was never
/// recorded, so there is nothing downstream that could reconstruct it, and a
/// stage that tried would be inventing exactly the content this cluster exists
/// to stop being invented (ADR 0079).
#[test]
fn corpus_drives_capture_integrity_assertions() {
    let corpus = load_corpus();
    let mut short = 0;
    let mut intact = 0;
    let mut unmeasured = 0;

    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_capture_integrity else {
            continue;
        };

        let integrity = CaptureIntegrity::from_seconds_for_tests(
            expected.wall_seconds,
            expected.recorded_seconds,
        );

        assert_eq!(
            verdict_label(&integrity),
            expected.verdict,
            "[{}] verdict mismatch: wall={} recorded={} missing={:.4} (failure_mode={})",
            entry.id,
            expected.wall_seconds,
            expected.recorded_seconds,
            integrity.missing_ratio,
            entry.failure_mode
        );

        // The transcript is untouched on this axis, whatever the verdict.
        let (text, _) = repair_singular_address(&entry.raw_transcript);
        let (text, _) = strip_prompt_echo(&text, None);
        assert_eq!(
            text, entry.raw_transcript,
            "[{}] a capture verdict must not change the transcript",
            entry.id
        );

        match expected.verdict.as_str() {
            "short" => short += 1,
            "intact" => intact += 1,
            _ => unmeasured += 1,
        }
    }

    assert!(
        short >= 1 && intact >= 1 && unmeasured >= 1,
        "the capture corpus needs all three verdicts, short={short} intact={intact} unmeasured={unmeasured}"
    );
}

/// Rebuild the arrival timeline of a recorded capture, callback by callback.
///
/// A cadence is fully determined by three things the runtime log preserves: how
/// many callbacks arrived, how large the device's callback is, and the
/// stretches in which none arrived. Between the recorded gaps the stream is
/// filled at the nominal interval, which is what the log's `nominal_interval_ms`
/// asserts it was doing; each recorded gap is then placed so that the callback
/// ending it arrives exactly at its recorded `at_ms`.
///
/// **The fill is exactly nominal, and the replay is therefore shorter than the
/// capture was.** The real stream jittered, and the jitter is precisely the
/// sub-threshold loss ADR 0133 found unattributed — a per-callback quantity the
/// log never carried, only its total. A replay that manufactured that jitter
/// would be inventing the number this entry exists to show is missing, so it
/// does not, and the reconstructed wall clock is not asserted against anything.
fn replay_recorded_cadence(recorded: &ExpectedCallbackCadence) -> CallbackCadence {
    let nominal_ms = recorded.nominal_samples as f64
        / (f64::from(recorded.sample_rate) * f64::from(recorded.channels))
        * 1000.0;

    // (offset from the capture's start in ms, samples the callback carried).
    let mut arrivals: Vec<(f64, usize)> = vec![(0.0, recorded.nominal_samples)];

    for gap in &recorded.gaps {
        let gap_began_at = gap.at_ms.saturating_sub(gap.gap_ms) as f64;

        while arrivals.last().expect("seeded above").0 + nominal_ms <= gap_began_at {
            let next = arrivals.last().expect("seeded above").0 + nominal_ms;
            arrivals.push((next, recorded.nominal_samples));
        }

        // The last callback before the gap lands on its start. Where the fill
        // has already passed it — two gaps back to back — there is nothing to
        // add, and the previous gap's resuming callback is that predecessor.
        if gap_began_at > arrivals.last().expect("seeded above").0 {
            arrivals.push((gap_began_at, recorded.nominal_samples));
        }
        arrivals.push((gap.at_ms as f64, gap.samples));
    }

    while (arrivals.len() as u64) < recorded.callbacks {
        let next = arrivals.last().expect("seeded above").0 + nominal_ms;
        arrivals.push((next, recorded.nominal_samples));
    }

    assert_eq!(
        arrivals.len() as u64,
        recorded.callbacks,
        "the recorded gaps need more callbacks than the capture reported — the entry is internally inconsistent"
    );

    let mut cadence = CallbackCadence::new(recorded.sample_rate, recorded.channels);
    let started_at = Instant::now();
    for (offset_ms, samples) in &arrivals {
        cadence.observe(
            started_at,
            started_at + Duration::from_secs_f64(offset_ms / 1000.0),
            *samples,
        );
    }

    cadence
}

/// Read one `key=value` field out of a runtime log line.
///
/// Asserting by key rather than against the whole line pins the field NAMES as
/// well as the values, which matters because `~/.cache/wordscript-soak-report.sh`
/// parses this line positionally and ADR 0133 requires new fields to be appended
/// rather than reordered.
fn log_field<'a>(line: &'a str, key: &str) -> &'a str {
    line.split_whitespace()
        .find_map(|token| {
            token
                .strip_prefix(key)
                .and_then(|rest| rest.strip_prefix('='))
        })
        .unwrap_or_else(|| panic!("no `{key}=` field in: {line}"))
}

/// The one cadence assertion in this repo driven by an observed capture rather
/// than by a timeline somebody wrote.
///
/// Every other one — `capture.rs`'s six synthetic cases — pins the arithmetic,
/// which is worth having and is not the same thing as pinning the phenomenon.
/// They do not even run at this device's cadence: they assume 2048 interleaved
/// samples every 23 ms, and the machine the defect occurs on delivers 1024
/// every 11.6 ms.
///
/// **What it protects is a past reading.** `native-18` is what ADR 0133 was
/// written from, and the instrument is about to change underneath it. A change
/// that makes this event report something else has not improved the instrument,
/// it has changed what an event in the record meant.
///
/// **Two of the assertions below check the log line and not the event, and
/// saying so is the point.** `callbacks` and each gap's `at_ms` are *inputs* to
/// the reconstruction — the fill is sized to the recorded callback count and
/// each gap is placed at its recorded `at_ms` — so mutating either in the
/// corpus mutates the replay with it and the assertion passes. Both were
/// checked that way and both passed, which is how they are known to be
/// tautologies of the reconstruction rather than statements about 2026-08-13.
/// They earn their place against the *code*: dropping `self.callbacks += 1`,
/// printing the gap list in reverse and renaming the `at_ms` field each fail
/// this test, and all three were run. The assertions that do carry the event
/// are `longest_gap_ms`, `gaps_over_200ms`, `oversized_resumes`, `signature`,
/// `lost_in_gaps_seconds`, `share_of_missing` and `unattributed_seconds` —
/// every one of them derived by `CallbackCadence` from the timeline rather than
/// handed to it, and every one falsified in the corpus before being trusted.
#[test]
fn corpus_replays_a_recorded_callback_dropout() {
    let corpus = load_corpus();
    let mut replayed = 0;

    for entry in &corpus.entries {
        let Some(recorded) = &entry.expected_callback_cadence else {
            continue;
        };
        let measured = entry
            .expected_capture_integrity
            .as_ref()
            .unwrap_or_else(|| {
                panic!(
                    "[{}] a recorded cadence is read against the capture it was measured on",
                    entry.id
                )
            });

        let cadence = replay_recorded_cadence(recorded);
        let integrity = CaptureIntegrity::from_seconds_for_tests(
            measured.wall_seconds,
            measured.recorded_seconds,
        );
        let lines = cadence_log_lines(&cadence, &integrity);
        let summary = &lines[0];

        for (key, expected) in [
            ("callbacks", recorded.callbacks.to_string()),
            ("nominal_samples", recorded.nominal_samples.to_string()),
            ("longest_gap_ms", recorded.longest_gap_ms.to_string()),
            ("gaps_over_200ms", recorded.gaps_over_threshold.to_string()),
            ("oversized_resumes", recorded.oversized_resumes.to_string()),
            ("signature", recorded.signature.clone()),
        ] {
            assert_eq!(
                log_field(summary, key),
                expected,
                "[{}] replayed {key} differs from the recorded line\n{summary}",
                entry.id
            );
        }

        // Each recorded `gap_ms` was written by `Duration::as_millis`, which
        // truncates, so the replay can under-count the loss by up to one
        // millisecond per gap. That is the whole tolerance — there is no other
        // source of slack, because nothing here reads a clock.
        let truncation_ms = recorded.gaps.len() as f64;
        let lost_in_gaps: f64 = log_field(summary, "lost_in_gaps_seconds")
            .parse()
            .expect("lost_in_gaps_seconds is a number");
        let shortfall = recorded.lost_in_gaps_seconds - lost_in_gaps;
        assert!(
            shortfall >= 0.0 && shortfall <= truncation_ms / 1000.0 + 0.001,
            "[{}] replayed lost_in_gaps_seconds={lost_in_gaps} against a recorded {} — outside the truncation the gap list can account for",
            entry.id,
            recorded.lost_in_gaps_seconds
        );

        let missing_seconds = measured.wall_seconds - measured.recorded_seconds;
        let share: f64 = log_field(summary, "share_of_missing")
            .parse()
            .expect("share_of_missing is a number");
        assert!(
            (recorded.share_of_missing - share).abs()
                <= (truncation_ms / 1000.0 + 0.001) / missing_seconds,
            "[{}] replayed share_of_missing={share} against a recorded {}",
            entry.id,
            recorded.share_of_missing
        );

        assert_eq!(
            lines.len(),
            recorded.gaps.len() + 1,
            "[{}] one summary line and one line per recorded gap\n{lines:#?}",
            entry.id
        );
        for (line, gap) in lines[1..].iter().zip(&recorded.gaps) {
            assert_eq!(log_field(line, "at_ms"), gap.at_ms.to_string(), "{line}");
            assert_eq!(log_field(line, "gap_ms"), gap.gap_ms.to_string(), "{line}");
            assert_eq!(
                log_field(line, "resumed_with_samples"),
                gap.samples.to_string(),
                "{line}"
            );
        }

        // The finding this entry carries into the next instrument (ADR 0133,
        // decision 3): a third of the missing audio sits in no gap over the
        // threshold, so the gap list describes two thirds of the damage and is
        // silent about the rest. Checked here as an arithmetic property of the
        // recorded numbers, which is the only place it can be checked.
        assert!(
            (recorded.unattributed_seconds - (missing_seconds - recorded.lost_in_gaps_seconds))
                .abs()
                < 0.001,
            "[{}] unattributed_seconds={} does not match the recorded loss the gaps do not account for ({:.3} s)",
            entry.id,
            recorded.unattributed_seconds,
            missing_seconds - recorded.lost_in_gaps_seconds
        );

        replayed += 1;
    }

    assert!(
        replayed >= 1,
        "the corpus carries no observed cadence — every dropout assertion is synthetic again"
    );
}

fn verdict_label(integrity: &CaptureIntegrity) -> &'static str {
    match integrity.verdict {
        CaptureIntegrityVerdict::Intact => "intact",
        CaptureIntegrityVerdict::Short => "short",
        CaptureIntegrityVerdict::NotMeasured => "not_measured",
    }
}

/// Repair is the one stage that rewrites words on similarity rather than on an
/// exact rule, so its false-positive rate has to be measured and not asserted.
/// Negative entries carry as much weight here as positive ones.
#[test]
fn corpus_drives_vocabulary_repair_assertions() {
    let corpus = load_corpus();
    let mut fired = 0;
    let mut declined = 0;

    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_vocabulary_repair else {
            continue;
        };

        let outcome = super::vocabulary_repair::repair_vocabulary(
            &entry.raw_transcript,
            &entry.profile.vocabulary,
        );

        assert_eq!(
            outcome.text, expected.text,
            "[{}] repaired text mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );

        let applied: Vec<String> = expected
            .applied
            .iter()
            .map(|term| format!("vocabulary:{term}"))
            .collect();
        assert_eq!(
            outcome.applied_rules, applied,
            "[{}] applied rules mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );

        if expected.applied.is_empty() {
            declined += 1;
        } else {
            fired += 1;
        }
    }

    assert!(
        fired >= 2 && declined >= 2,
        "repair needs cases in both directions, fired={fired} declined={declined}"
    );
}

/// Learning reads a raw/final pair the same way repair reads a transcript, and
/// it has the same failure shape: the interesting cases are the ones it must
/// walk away from. A detector that turns every reworded verb into vocabulary
/// fills the list with noise and then spends the recognizer's slots on it, so
/// the negative entries carry more weight here than the positive ones.
#[test]
fn corpus_drives_vocabulary_learning_assertions() {
    let corpus = load_corpus();
    let mut found = 0;
    let mut declined = 0;

    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_vocabulary_candidates else {
            continue;
        };

        let candidates: Vec<String> = super::vocabulary_learning::detect_candidates(
            &entry.raw_transcript,
            &entry.expected_post_correction,
            &entry.profile.vocabulary,
            super::vocabulary_learning::LearningSource::Correction,
        )
        .into_iter()
        .map(|candidate| candidate.term)
        .collect();

        assert_eq!(
            &candidates, expected,
            "[{}] vocabulary candidates mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );

        if expected.is_empty() {
            declined += 1;
        } else {
            found += 1;
        }
    }

    assert!(
        found >= 2 && declined >= 3,
        "learning needs cases in both directions, found={found} declined={declined}"
    );
}

#[test]
fn corpus_drives_text_rules_analysis_assertions() {
    let corpus = load_corpus();
    for entry in &corpus.entries {
        let document = TextRulesDocument {
            schema_version: TEXT_RULES_SCHEMA_VERSION,
            prompt: entry.profile.prompt.clone(),
            stt_hints: entry.profile.stt_hints.clone(),
            dictionary_entries: entry.profile.dictionary_entries.clone(),
            snippet_entries: Vec::new(),
        };
        let analysis = analyze_document(&document, None);

        // The context field never reaches the recognizer (ADR 0032), so no
        // analysis issue may be raised about how it would fare there. A
        // profile that carries topics and nothing else is correct, not
        // under-configured.
        assert!(
            analysis
                .transcription_bias
                .cloud_prompt_preview
                .as_deref()
                .map(|preview| !preview.contains("Vocabulary:"))
                .unwrap_or(true),
            "[{}] the recognizer prompt must not carry a profile-context section (failure_mode={})",
            entry.id,
            entry.failure_mode
        );
    }
}

#[test]
fn corpus_profile_health_initialization_does_not_panic() {
    let corpus = load_corpus();
    for entry in &corpus.entries {
        let profile = text_profile_from_corpus(&entry.profile);
        let _ = get_profile_health(GetProfileHealthRequest {
            prompt: profile.prompt,
            dictionary_entries: profile.dictionary_entries,
            acknowledged_flags: Vec::new(),
            bias_mode: None,
            processing_mode: None,
            profile_id: None,
        });
    }
}

#[test]
fn corpus_dictionary_entries_have_phrase_and_replacement() {
    let corpus = load_corpus();
    for entry in &corpus.entries {
        for dict in &entry.profile.dictionary_entries {
            assert!(
                !dict.phrase.trim().is_empty(),
                "[{}] dictionary entry {} has empty phrase",
                entry.id,
                dict.id
            );
            assert!(
                !dict.replace_with.trim().is_empty(),
                "[{}] dictionary entry {} has empty replacement",
                entry.id,
                dict.id
            );
        }
    }
}
