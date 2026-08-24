use serde::{Deserialize, Serialize};

use super::providers::TranscriptionSegment;

/// Whisper's own reference decoder thresholds. They are constants rather than
/// settings on purpose: they are model internals, and exposing them would
/// repeat the mistake the bias-policy controls already made in the profile UI.
/// Diagnostics shows what they rejected instead.
pub const MAX_NO_SPEECH_PROB: f64 = 0.6;
pub const MIN_AVG_LOGPROB: f64 = -1.0;
pub const MAX_COMPRESSION_RATIO: f64 = 2.4;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RejectedSegment {
    pub text: String,
    pub start: f64,
    pub end: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ConfidenceGateOutcome {
    /// The kept text, rebuilt from the surviving segments. `None` when the
    /// provider gave no usable segment data and the raw text must stand.
    pub text: Option<String>,
    pub rejected: Vec<RejectedSegment>,
}

impl ConfidenceGateOutcome {
    pub fn rejected_everything(&self) -> bool {
        !self.rejected.is_empty() && self.text.as_deref().map(str::trim).unwrap_or("").is_empty()
    }
}

/// WHAT THIS STAGE TOOK OUT OF A HEARING, KEPT ON THE RECORD (ADR 0249).
///
/// The gate used to write its rejections to the runtime log and nothing else,
/// while the record kept only the text that came out the far side. That made a
/// dropped segment and a segment the recogniser never returned identical on
/// every surface — and the one case that most needs to be visible is audio that
/// was captured, transcribed and then removed by WordScript's own filter.
///
/// `kept_text` IS HERE BECAUSE A RETRY NEEDS IT. Since ADR 0249 the record's
/// `raw_transcript` is the recogniser's own output, taken before this stage, so
/// re-running a transform from it would re-admit exactly the segments the gate
/// threw out. The transform ran on this text, and a retry runs on this text.
/// `None` on every record where the gate did not fire, which on the reporting
/// machine is all of them.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConfidenceGateRecord {
    /// The surviving segments, rejoined — the text every stage after the gate
    /// actually saw.
    pub kept_text: String,
    /// What went, each with the reason its own metrics gave.
    pub dropped: Vec<RejectedSegment>,
}

impl ConfidenceGateRecord {
    /// The record this outcome leaves behind, or `None` where the gate changed
    /// nothing and there is nothing to state.
    ///
    /// `heard` is the pre-gate text, which is what stands as `kept_text`
    /// wherever the outcome rebuilt no text of its own — a provider that
    /// returned no usable segment data cannot have had anything removed.
    pub fn of(outcome: &ConfidenceGateOutcome, heard: &str) -> Option<Self> {
        if outcome.rejected.is_empty() {
            return None;
        }

        Some(Self {
            kept_text: outcome.text.clone().unwrap_or_else(|| heard.to_string()),
            dropped: outcome.rejected.clone(),
        })
    }
}

/// Why a segment failed, or `None` when it is trustworthy.
///
/// `no_speech_prob` and `avg_logprob` are required together: a hallucination
/// on silence is confidently wrong, so either signal alone rejects real speech
/// the model merely found difficult. `compression_ratio` stands alone because
/// a highly repetitive segment is a stuck decoder regardless of confidence.
fn rejection_reason(segment: &TranscriptionSegment) -> Option<String> {
    if let Some(ratio) = segment.compression_ratio {
        if ratio > MAX_COMPRESSION_RATIO {
            return Some(format!("compression_ratio={ratio:.2}"));
        }
    }

    match (segment.no_speech_prob, segment.avg_logprob) {
        (Some(no_speech), Some(logprob))
            if no_speech > MAX_NO_SPEECH_PROB && logprob < MIN_AVG_LOGPROB =>
        {
            Some(format!(
                "no_speech_prob={no_speech:.2} avg_logprob={logprob:.2}"
            ))
        }
        _ => None,
    }
}

pub fn evaluate_segments(segments: Option<&[TranscriptionSegment]>) -> ConfidenceGateOutcome {
    let Some(segments) = segments.filter(|segments| !segments.is_empty()) else {
        return ConfidenceGateOutcome::default();
    };

    let mut kept: Vec<&str> = Vec::new();
    let mut rejected = Vec::new();

    for segment in segments {
        match rejection_reason(segment) {
            Some(reason) => rejected.push(RejectedSegment {
                text: segment.text.trim().to_string(),
                start: segment.start,
                end: segment.end,
                reason,
            }),
            None => kept.push(segment.text.trim()),
        }
    }

    ConfidenceGateOutcome {
        text: Some(
            kept.into_iter()
                .filter(|text| !text.is_empty())
                .collect::<Vec<_>>()
                .join(" "),
        ),
        rejected,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(text: &str, no_speech: f64, logprob: f64, compression: f64) -> TranscriptionSegment {
        TranscriptionSegment {
            id: 0,
            start: 0.0,
            end: 1.0,
            text: text.to_string(),
            avg_logprob: Some(logprob),
            no_speech_prob: Some(no_speech),
            compression_ratio: Some(compression),
        }
    }

    /// ADR 0249. The record exists so a stored transcript can be asked whether
    /// this stage edited it. It has to answer `None` when the gate changed
    /// nothing, or every record would claim a removal.
    #[test]
    fn a_gate_that_rejected_nothing_leaves_no_record() {
        let segments = vec![segment("Das ist ein Test.", 0.02, -0.2, 1.3)];

        let outcome = evaluate_segments(Some(&segments));

        assert!(ConfidenceGateRecord::of(&outcome, "Das ist ein Test.").is_none());
    }

    #[test]
    fn a_rejection_records_the_kept_text_and_everything_it_took() {
        let segments = vec![
            segment("Das ist ein Test.", 0.02, -0.2, 1.3),
            segment("Thank you for watching!", 0.91, -1.4, 1.1),
        ];

        let outcome = evaluate_segments(Some(&segments));
        let record = ConfidenceGateRecord::of(&outcome, "Das ist ein Test. Thank you for watching!")
            .expect("a rejection leaves a record");

        assert_eq!(record.kept_text, "Das ist ein Test.");
        assert_eq!(record.dropped.len(), 1);
        assert_eq!(record.dropped[0].text, "Thank you for watching!");
    }

    #[test]
    fn confident_speech_survives() {
        let segments = vec![segment("Das ist ein Test.", 0.02, -0.2, 1.3)];

        let outcome = evaluate_segments(Some(&segments));

        assert_eq!(outcome.text.as_deref(), Some("Das ist ein Test."));
        assert!(outcome.rejected.is_empty());
    }

    #[test]
    fn silence_boilerplate_is_rejected_on_the_combined_signal() {
        let segments = vec![
            segment("Das ist ein Test.", 0.02, -0.2, 1.3),
            segment("Thank you for watching!", 0.91, -1.4, 1.1),
        ];

        let outcome = evaluate_segments(Some(&segments));

        assert_eq!(outcome.text.as_deref(), Some("Das ist ein Test."));
        assert_eq!(outcome.rejected.len(), 1);
        assert!(outcome.rejected[0].reason.contains("no_speech_prob"));
    }

    #[test]
    fn a_single_weak_signal_never_rejects_on_its_own() {
        // Quiet but real speech: high no_speech_prob, still confidently decoded.
        let high_no_speech = vec![segment("Ja, genau.", 0.88, -0.3, 1.2)];
        // Hard audio: poor logprob, but the model does not think it is silence.
        let low_logprob = vec![segment("Unverstaendlich genuschelt.", 0.05, -1.7, 1.4)];

        assert!(evaluate_segments(Some(&high_no_speech)).rejected.is_empty());
        assert!(evaluate_segments(Some(&low_logprob)).rejected.is_empty());
    }

    #[test]
    fn a_stuck_decoder_is_rejected_on_compression_ratio_alone() {
        let segments = vec![segment("ja ja ja ja ja ja ja ja", 0.01, -0.1, 3.8)];

        let outcome = evaluate_segments(Some(&segments));

        assert!(outcome.rejected_everything());
        assert!(outcome.rejected[0].reason.contains("compression_ratio"));
    }

    #[test]
    fn missing_metrics_are_never_treated_as_failure() {
        // The local lane returns no metrics at all; it must pass through.
        let segments = vec![TranscriptionSegment {
            id: 0,
            start: 0.0,
            end: 1.0,
            text: "Lokale Transkription.".to_string(),
            avg_logprob: None,
            no_speech_prob: None,
            compression_ratio: None,
        }];

        let outcome = evaluate_segments(Some(&segments));

        assert_eq!(outcome.text.as_deref(), Some("Lokale Transkription."));
        assert!(outcome.rejected.is_empty());
    }

    #[test]
    fn absent_segments_leave_the_raw_text_in_charge() {
        assert_eq!(evaluate_segments(None), ConfidenceGateOutcome::default());
        assert_eq!(evaluate_segments(Some(&[])), ConfidenceGateOutcome::default());
        assert!(!ConfidenceGateOutcome::default().rejected_everything());
    }
}
