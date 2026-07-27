//! The cue score: which notes play, when, and how loud.
//!
//! Everything is built on one G-major theme. `Startup` states it in full —
//! G3 -> D4 -> G4 with a B4 shimmer on the arrival, an ascending G triad that
//! opens out and settles. It is the signature; every other cue is a fragment
//! of it, which is what makes the set read as one product rather than as five
//! unrelated beeps.
//!
//! Listen (D4 -> G4) opens on the theme's rising fifth, Handoff holds on an
//! unresolved D, and Done resolves down to the G tonic. Handoff fires when
//! capture stops, which is *not* when the work is done, so it must never sound
//! conclusive. Abort collapses the phrase instead of resolving it, and Error
//! separates itself by interval and damping rather than by volume.

const D4: f32 = 293.665;
const G4: f32 = 391.995;
const B4: f32 = 493.883;
const G3: f32 = 195.998;
const C4: f32 = 261.626;
const AF3: f32 = 207.652;

#[derive(Debug, Clone, Copy)]
pub struct Note {
    pub onset_ms: f32,
    pub freq_hz: f32,
    /// Time to -60 dB, before the pack decay scale is applied.
    pub decay_ms: f32,
    pub gain: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct CueScore {
    pub notes: &'static [Note],
    /// Extra low-pass on top of the pack, 0.0 = none. Darkens the cues that
    /// should not draw attention to themselves.
    pub damping: f32,
    /// Final trim in dB, applied after peak normalisation so the loudness
    /// hierarchy between cues survives a pack switch.
    pub trim_db: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SoundCue {
    /// The full theme, played once when the app comes up.
    Startup,
    /// Capture is live, speak now.
    Listen,
    /// Capture ended, the pipeline took over. Intentionally unresolved.
    Handoff,
    /// Text was inserted successfully. The most frequent cue, so the quietest.
    Done,
    /// The user cancelled; nothing landed.
    Abort,
    /// A runtime step failed.
    Error,
}

pub const ALL_CUES: [SoundCue; 6] = [
    SoundCue::Startup,
    SoundCue::Listen,
    SoundCue::Handoff,
    SoundCue::Done,
    SoundCue::Abort,
    SoundCue::Error,
];

impl SoundCue {
    pub fn as_str(self) -> &'static str {
        match self {
            SoundCue::Startup => "startup",
            SoundCue::Listen => "listen",
            SoundCue::Handoff => "handoff",
            SoundCue::Done => "done",
            SoundCue::Abort => "abort",
            SoundCue::Error => "error",
        }
    }

    pub fn from_str_opt(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "startup" => Some(SoundCue::Startup),
            "listen" => Some(SoundCue::Listen),
            "handoff" => Some(SoundCue::Handoff),
            "done" => Some(SoundCue::Done),
            "abort" => Some(SoundCue::Abort),
            "error" => Some(SoundCue::Error),
            _ => None,
        }
    }

    pub fn score(self) -> CueScore {
        match self {
            SoundCue::Startup => STARTUP,
            SoundCue::Listen => LISTEN,
            SoundCue::Handoff => HANDOFF,
            SoundCue::Done => DONE,
            SoundCue::Abort => ABORT,
            SoundCue::Error => ERROR,
        }
    }
}

const STARTUP: CueScore = CueScore {
    notes: &[
        Note { onset_ms: 0.0, freq_hz: G3, decay_ms: 600.0, gain: 0.55 },
        Note { onset_ms: 130.0, freq_hz: D4, decay_ms: 620.0, gain: 0.7 },
        Note { onset_ms: 260.0, freq_hz: G4, decay_ms: 900.0, gain: 1.0 },
        Note { onset_ms: 260.0, freq_hz: B4, decay_ms: 780.0, gain: 0.3 },
    ],
    damping: 0.0,
    trim_db: -2.0,
};

const LISTEN: CueScore = CueScore {
    notes: &[
        Note { onset_ms: 0.0, freq_hz: D4, decay_ms: 170.0, gain: 0.7 },
        Note { onset_ms: 85.0, freq_hz: G4, decay_ms: 340.0, gain: 1.0 },
    ],
    damping: 0.0,
    trim_db: 0.0,
};

const HANDOFF: CueScore = CueScore {
    notes: &[Note { onset_ms: 0.0, freq_hz: D4, decay_ms: 300.0, gain: 1.0 }],
    damping: 0.15,
    trim_db: -6.0,
};

const DONE: CueScore = CueScore {
    notes: &[Note { onset_ms: 0.0, freq_hz: G3, decay_ms: 430.0, gain: 1.0 }],
    damping: 0.1,
    trim_db: -8.0,
};

const ABORT: CueScore = CueScore {
    notes: &[
        Note { onset_ms: 0.0, freq_hz: G4, decay_ms: 150.0, gain: 0.9 },
        Note { onset_ms: 70.0, freq_hz: C4, decay_ms: 230.0, gain: 1.0 },
    ],
    damping: 0.55,
    trim_db: -4.0,
};

const ERROR: CueScore = CueScore {
    notes: &[
        Note { onset_ms: 0.0, freq_hz: AF3, decay_ms: 240.0, gain: 1.0 },
        Note { onset_ms: 0.0, freq_hz: D4, decay_ms: 240.0, gain: 0.8 },
    ],
    damping: 0.4,
    trim_db: -4.0,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cue_names_round_trip() {
        for cue in ALL_CUES {
            assert_eq!(SoundCue::from_str_opt(cue.as_str()), Some(cue));
        }
        assert_eq!(SoundCue::from_str_opt("stop"), None);
    }

    #[test]
    fn every_cue_has_notes_with_sane_bounds() {
        for cue in ALL_CUES {
            let score = cue.score();
            assert!(!score.notes.is_empty(), "{} has no notes", cue.as_str());
            assert!((0.0..=1.0).contains(&score.damping));
            assert!(score.trim_db <= 0.0, "{} boosts above reference", cue.as_str());
            for note in score.notes {
                assert!(note.freq_hz > 0.0);
                assert!(note.decay_ms > 0.0);
                assert!(note.gain > 0.0 && note.gain <= 1.0);
                assert!(note.onset_ms >= 0.0);
            }
        }
    }

    #[test]
    fn done_is_the_quietest_cue() {
        // Done fires on every successful dictation. If it ever becomes the
        // loudest cue the app turns into a nuisance.
        let done = SoundCue::Done.score().trim_db;
        for cue in ALL_CUES {
            if cue != SoundCue::Done {
                assert!(
                    cue.score().trim_db > done,
                    "{} is not louder than done",
                    cue.as_str()
                );
            }
        }
    }

    #[test]
    fn no_cue_sits_in_the_piercing_register() {
        // The previous implementation ran up to 988 Hz on bare sines, which is
        // what made it read as a hearing test. Fundamentals stay below 500 Hz.
        for cue in ALL_CUES {
            for note in cue.score().notes {
                assert!(
                    note.freq_hz < 500.0,
                    "{} has a {} Hz fundamental",
                    cue.as_str(),
                    note.freq_hz
                );
            }
        }
    }
}
