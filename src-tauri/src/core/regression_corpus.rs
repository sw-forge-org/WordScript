use std::fs;
use std::path::PathBuf;

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
use super::capture::{CaptureIntegrity, CaptureIntegrityVerdict};
use super::hallucination_detect::{detect_advanced_hallucination, DriftCorroboration};
use super::recognizer_repair::{repair_singular_address, strip_prompt_echo};
use super::transcription_hints::{analyze_transcription_bias_with_mode, BiasRequestContext};

const CORPUS_VERSION: u32 = 3;
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
