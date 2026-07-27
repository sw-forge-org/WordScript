//! Timbre definitions for the curated sound packs.
//!
//! A pack describes *how* a note sounds, never *which* notes are played. The
//! cue score in `cue.rs` owns pitch and timing, so every pack plays the same
//! motif and stays recognisable as WordScript.

/// A single sine partial of a struck-body tone.
///
/// Real mallet and bell bodies are not harmonic stacks: the upper partials sit
/// at non-integer ratios and die away faster than the fundamental. Rendering
/// that decay spread is what separates a struck body from the plain sine the
/// previous implementation used.
#[derive(Debug, Clone, Copy)]
pub struct Partial {
    /// Frequency as a multiple of the note fundamental.
    pub ratio: f32,
    /// Linear amplitude relative to the fundamental.
    pub gain: f32,
    /// Decay rate multiplier. Above 1.0 the partial dies faster than the
    /// fundamental, which darkens the tone as it rings out.
    pub decay_scale: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct PackVoice {
    pub partials: &'static [Partial],
    /// Raised-cosine attack. Never zero: an instant start is a click.
    pub attack_ms: f32,
    /// Level of the mallet-strike noise burst.
    pub transient_gain: f32,
    pub transient_ms: f32,
    /// Level of the band-passed air layer that sits under the tone.
    pub air_gain: f32,
    pub air_swell_ms: f32,
    /// One-pole low-pass over the summed voice.
    pub lowpass_hz: f32,
    /// Scales every note decay in the score.
    pub decay_scale: f32,
    /// Downward pitch bend over the attack, in semitones.
    pub pitch_drop_semitones: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SoundPack {
    /// Warm mallet with air. The default WordScript voice.
    Timber,
    /// Inharmonic glass bell with a longer shimmer.
    Glass,
    /// Breath-like swell, tonal core kept far back.
    Air,
    /// Short tuned tap, transient dominant.
    Tap,
}

pub const DEFAULT_PACK: SoundPack = SoundPack::Timber;

pub const ALL_PACKS: [SoundPack; 4] = [
    SoundPack::Timber,
    SoundPack::Glass,
    SoundPack::Air,
    SoundPack::Tap,
];

impl SoundPack {
    pub fn as_str(self) -> &'static str {
        match self {
            SoundPack::Timber => "timber",
            SoundPack::Glass => "glass",
            SoundPack::Air => "air",
            SoundPack::Tap => "tap",
        }
    }

    /// Unknown identifiers fall back to the default pack rather than failing.
    /// A config written by a newer build must never leave the user silent.
    pub fn from_str_or_default(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "timber" => SoundPack::Timber,
            "glass" => SoundPack::Glass,
            "air" => SoundPack::Air,
            "tap" => SoundPack::Tap,
            _ => DEFAULT_PACK,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            SoundPack::Timber => "Timber",
            SoundPack::Glass => "Glass",
            SoundPack::Air => "Air",
            SoundPack::Tap => "Tap",
        }
    }

    pub fn voice(self) -> PackVoice {
        match self {
            SoundPack::Timber => TIMBER,
            SoundPack::Glass => GLASS,
            SoundPack::Air => AIR,
            SoundPack::Tap => TAP,
        }
    }
}

/// Marimba-like partial spread (roughly 1 : 3.9 : 9.2), a soft mallet strike
/// and a quiet air bed. Dark enough to never read as a test tone.
const TIMBER: PackVoice = PackVoice {
    partials: &[
        Partial { ratio: 1.0, gain: 1.0, decay_scale: 1.0 },
        Partial { ratio: 3.9, gain: 0.16, decay_scale: 2.2 },
        Partial { ratio: 9.2, gain: 0.05, decay_scale: 3.5 },
    ],
    attack_ms: 3.0,
    transient_gain: 0.18,
    transient_ms: 10.0,
    air_gain: 0.05,
    air_swell_ms: 120.0,
    lowpass_hz: 3200.0,
    decay_scale: 1.0,
    pitch_drop_semitones: 0.0,
};

/// Inharmonic bell ratios with a longer ring. Cleaner and more present than
/// Timber, at the cost of sitting further forward in the room.
const GLASS: PackVoice = PackVoice {
    partials: &[
        Partial { ratio: 1.0, gain: 1.0, decay_scale: 1.0 },
        Partial { ratio: 2.76, gain: 0.42, decay_scale: 1.4 },
        Partial { ratio: 5.40, gain: 0.18, decay_scale: 2.0 },
        Partial { ratio: 8.93, gain: 0.07, decay_scale: 2.8 },
    ],
    attack_ms: 2.0,
    transient_gain: 0.10,
    transient_ms: 6.0,
    air_gain: 0.03,
    air_swell_ms: 90.0,
    lowpass_hz: 5200.0,
    decay_scale: 1.6,
    pitch_drop_semitones: 0.0,
};

/// Noise-dominant swell with the tonal core pushed back to roughly -18 dB.
/// No strike at all, so the cue reads as breath rather than as an event.
const AIR: PackVoice = PackVoice {
    partials: &[
        Partial { ratio: 1.0, gain: 0.13, decay_scale: 1.0 },
        Partial { ratio: 2.0, gain: 0.05, decay_scale: 1.4 },
    ],
    attack_ms: 40.0,
    transient_gain: 0.0,
    transient_ms: 0.0,
    air_gain: 1.0,
    air_swell_ms: 220.0,
    lowpass_hz: 2000.0,
    decay_scale: 1.2,
    pitch_drop_semitones: 0.0,
};

/// Transient dominant, very short, with a downward bend on the attack.
const TAP: PackVoice = PackVoice {
    partials: &[
        Partial { ratio: 1.0, gain: 1.0, decay_scale: 1.0 },
        Partial { ratio: 2.1, gain: 0.25, decay_scale: 2.5 },
    ],
    attack_ms: 1.0,
    transient_gain: 0.55,
    transient_ms: 8.0,
    air_gain: 0.0,
    air_swell_ms: 0.0,
    lowpass_hz: 2600.0,
    decay_scale: 0.28,
    pitch_drop_semitones: 7.0,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_pack_names_fall_back_to_default() {
        assert_eq!(SoundPack::from_str_or_default("timber"), SoundPack::Timber);
        assert_eq!(SoundPack::from_str_or_default("  GLASS "), SoundPack::Glass);
        assert_eq!(SoundPack::from_str_or_default(""), DEFAULT_PACK);
        assert_eq!(SoundPack::from_str_or_default("from-the-future"), DEFAULT_PACK);
    }

    #[test]
    fn pack_names_round_trip() {
        for pack in ALL_PACKS {
            assert_eq!(SoundPack::from_str_or_default(pack.as_str()), pack);
        }
    }

    #[test]
    fn every_pack_has_a_fundamental_and_a_non_zero_attack() {
        for pack in ALL_PACKS {
            let voice = pack.voice();
            assert!(!voice.partials.is_empty(), "{} has no partials", pack.as_str());
            assert_eq!(voice.partials[0].ratio, 1.0);
            // A zero-length attack is an instant edge, which is an audible click.
            assert!(voice.attack_ms > 0.0, "{} attacks instantly", pack.as_str());
            assert!(voice.lowpass_hz > 0.0);
            assert!(voice.decay_scale > 0.0);
        }
    }
}
