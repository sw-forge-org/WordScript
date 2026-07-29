use super::providers::TranscriptionSegment;

/// Whisper's own reference decoder thresholds. They are constants rather than
/// settings on purpose: they are model internals, and exposing them would
/// repeat the mistake the bias-policy controls already made in the profile UI.
/// Diagnostics shows what they rejected instead.
pub const MAX_NO_SPEECH_PROB: f64 = 0.6;
pub const MIN_AVG_LOGPROB: f64 = -1.0;
pub const MAX_COMPRESSION_RATIO: f64 = 2.4;

#[derive(Debug, Clone, PartialEq)]
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
