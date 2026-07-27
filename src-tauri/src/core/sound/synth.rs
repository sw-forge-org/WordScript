//! Offline renderer: cue score + pack timbre -> mono `f32` samples.
//!
//! Rendering takes the target sample rate as an argument so cues can be built
//! at the real device rate. The previous implementation hard-coded 44_100 Hz
//! and let rodio resample at playback time, which put a resampler start-up
//! transient in front of every cue.

use std::f32::consts::PI;

use super::{
    cue::SoundCue,
    pack::{PackVoice, SoundPack},
};

/// -12 dBFS. Every cue is normalised to this peak before its own trim, so
/// switching packs changes the timbre and not the loudness.
const REFERENCE_PEAK: f32 = 0.251_188_6;

/// exp(-t * LN_1000 / decay) reaches -60 dB exactly at `decay`.
const LN_1000: f32 = 6.907_755;

/// Raised-cosine fade at the very end, so the buffer lands on a true zero.
const RELEASE_MS: f32 = 12.0;

pub fn render(cue: SoundCue, pack: SoundPack, sample_rate: u32) -> Vec<f32> {
    let score = cue.score();
    let voice = pack.voice();
    let sr = sample_rate as f32;

    let total_ms = score
        .notes
        .iter()
        .map(|note| note.onset_ms + note.decay_ms * voice.decay_scale)
        .fold(0.0_f32, f32::max)
        + RELEASE_MS;
    let total_samples = ms_to_samples(total_ms, sample_rate).max(1);

    let mut buffer = vec![0.0_f32; total_samples];
    let mut rng = Rng::new(seed_for(cue, pack));

    for (index, note) in score.notes.iter().enumerate() {
        let onset = ms_to_samples(note.onset_ms, sample_rate);
        let decay_s = note.decay_ms * voice.decay_scale / 1000.0;
        render_note(
            &mut buffer[onset.min(total_samples)..],
            note.freq_hz,
            note.gain,
            decay_s,
            &voice,
            sr,
            &mut rng,
            index,
        );
    }

    let cutoff = (voice.lowpass_hz * (1.0 - score.damping)).max(200.0);
    lowpass_in_place(&mut buffer, cutoff, sr);
    apply_release(&mut buffer, sample_rate);
    normalise(&mut buffer, score.trim_db);

    if let Some(first) = buffer.first_mut() {
        *first = 0.0;
    }
    if let Some(last) = buffer.last_mut() {
        *last = 0.0;
    }
    buffer
}

#[allow(clippy::too_many_arguments)]
fn render_note(
    target: &mut [f32],
    freq_hz: f32,
    gain: f32,
    decay_s: f32,
    voice: &PackVoice,
    sr: f32,
    rng: &mut Rng,
    note_index: usize,
) {
    let attack_s = (voice.attack_ms / 1000.0).max(1.0 / sr);
    let bend_tau = ((voice.transient_ms.max(4.0)) / 1000.0) * 2.0;

    for partial in voice.partials {
        let partial_decay = (decay_s / partial.decay_scale).max(1.0 / sr);
        let base_freq = freq_hz * partial.ratio;
        let mut phase = 0.0_f32;

        for (index, sample) in target.iter_mut().enumerate() {
            let t = index as f32 / sr;
            let env = attack_curve(t, attack_s) * (-t * LN_1000 / partial_decay).exp();
            if env < 1.0e-5 && t > attack_s {
                break;
            }

            let bend = if voice.pitch_drop_semitones > 0.0 {
                let cents = voice.pitch_drop_semitones * (-t / bend_tau).exp();
                (cents / 12.0).exp2()
            } else {
                1.0
            };

            *sample += phase.sin() * env * partial.gain * gain;
            phase += 2.0 * PI * base_freq * bend / sr;
        }
    }

    if voice.transient_gain > 0.0 && voice.transient_ms > 0.0 {
        let transient_s = voice.transient_ms / 1000.0;
        let span = ms_to_samples(voice.transient_ms * 4.0, sr as u32).min(target.len());
        let mut lp = OnePole::new(voice.lowpass_hz * 1.5, sr);
        for (index, sample) in target.iter_mut().take(span).enumerate() {
            let t = index as f32 / sr;
            let env = (-t * LN_1000 / transient_s).exp();
            *sample += lp.process(rng.next_bipolar()) * env * voice.transient_gain * gain;
        }
    }

    if voice.air_gain > 0.0 && voice.air_swell_ms > 0.0 {
        let swell_s = voice.air_swell_ms / 1000.0;
        // A second strike should not restack a full air bed on top of the first.
        let layer_gain = voice.air_gain * gain * if note_index == 0 { 1.0 } else { 0.6 };
        let mut hp = OnePole::new(250.0, sr);
        let mut lp = OnePole::new(2200.0, sr);
        for (index, sample) in target.iter_mut().enumerate() {
            let t = index as f32 / sr;
            let env = attack_curve(t, swell_s) * (-t * LN_1000 / (decay_s * 1.3)).exp();
            if env < 1.0e-5 && t > swell_s {
                break;
            }
            let noise = rng.next_bipolar();
            let band = lp.process(noise - hp.process(noise));
            *sample += band * env * layer_gain;
        }
    }
}

fn attack_curve(t: f32, attack_s: f32) -> f32 {
    if t >= attack_s {
        1.0
    } else {
        0.5 - 0.5 * (PI * t / attack_s).cos()
    }
}

fn apply_release(buffer: &mut [f32], sample_rate: u32) {
    let len = buffer.len();
    let release = ms_to_samples(RELEASE_MS, sample_rate).min(len);
    if release < 2 {
        return;
    }
    let denom = (release - 1) as f32;
    for index in 0..release {
        let progress = index as f32 / denom;
        buffer[len - release + index] *= 0.5 + 0.5 * (PI * progress).cos();
    }
}

fn normalise(buffer: &mut [f32], trim_db: f32) {
    let peak = buffer.iter().fold(0.0_f32, |acc, s| acc.max(s.abs()));
    if peak < 1.0e-9 {
        return;
    }
    let scale = (REFERENCE_PEAK / peak) * db_to_linear(trim_db);
    for sample in buffer.iter_mut() {
        *sample *= scale;
    }
}

fn db_to_linear(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}

fn lowpass_in_place(buffer: &mut [f32], cutoff_hz: f32, sr: f32) {
    let mut filter = OnePole::new(cutoff_hz, sr);
    for sample in buffer.iter_mut() {
        *sample = filter.process(*sample);
    }
}

fn ms_to_samples(ms: f32, sample_rate: u32) -> usize {
    ((ms / 1000.0) * sample_rate as f32).round().max(0.0) as usize
}

struct OnePole {
    coefficient: f32,
    state: f32,
}

impl OnePole {
    fn new(cutoff_hz: f32, sr: f32) -> Self {
        let cutoff = cutoff_hz.clamp(20.0, sr / 2.0 - 1.0);
        Self {
            coefficient: 1.0 - (-2.0 * PI * cutoff / sr).exp(),
            state: 0.0,
        }
    }

    fn process(&mut self, input: f32) -> f32 {
        self.state += self.coefficient * (input - self.state);
        self.state
    }
}

/// Deterministic noise. A system RNG would make every render — and therefore
/// every peak assertion in the tests — slightly different.
struct Rng(u32);

impl Rng {
    fn new(seed: u32) -> Self {
        Self(seed | 1)
    }

    fn next_bipolar(&mut self) -> f32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        (self.0 as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
}

fn seed_for(cue: SoundCue, pack: SoundPack) -> u32 {
    let cue_seed = match cue {
        SoundCue::Startup => 0x0666,
        SoundCue::Listen => 0x1111,
        SoundCue::Handoff => 0x2222,
        SoundCue::Done => 0x3333,
        SoundCue::Abort => 0x4444,
        SoundCue::Error => 0x5555,
    };
    let pack_seed = match pack {
        SoundPack::Timber => 0x00A0_0000,
        SoundPack::Glass => 0x00B0_0000,
        SoundPack::Air => 0x00C0_0000,
        SoundPack::Tap => 0x00D0_0000,
    };
    cue_seed | pack_seed
}

pub fn duration_ms(cue: SoundCue, pack: SoundPack) -> f32 {
    let voice = pack.voice();
    cue.score()
        .notes
        .iter()
        .map(|note| note.onset_ms + note.decay_ms * voice.decay_scale)
        .fold(0.0_f32, f32::max)
        + RELEASE_MS
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::sound::{cue::ALL_CUES, pack::ALL_PACKS};

    fn peak(samples: &[f32]) -> f32 {
        samples.iter().fold(0.0_f32, |acc, s| acc.max(s.abs()))
    }

    #[test]
    fn every_cue_and_pack_renders_audible_audio() {
        for pack in ALL_PACKS {
            for cue in ALL_CUES {
                let samples = render(cue, pack, 48_000);
                assert!(
                    !samples.is_empty(),
                    "{}/{} rendered nothing",
                    pack.as_str(),
                    cue.as_str()
                );
                assert!(
                    peak(&samples) > 0.01,
                    "{}/{} is silent",
                    pack.as_str(),
                    cue.as_str()
                );
            }
        }
    }

    #[test]
    fn nothing_clips_and_nothing_exceeds_the_reference_peak() {
        for pack in ALL_PACKS {
            for cue in ALL_CUES {
                let samples = render(cue, pack, 48_000);
                let measured = peak(&samples);
                assert!(
                    measured <= REFERENCE_PEAK + 1.0e-4,
                    "{}/{} peaks at {measured}",
                    pack.as_str(),
                    cue.as_str()
                );
                assert!(samples.iter().all(|s| s.is_finite()));
            }
        }
    }

    #[test]
    fn buffers_start_and_end_on_true_zero() {
        for pack in ALL_PACKS {
            for cue in ALL_CUES {
                let samples = render(cue, pack, 48_000);
                assert_eq!(samples.first().copied(), Some(0.0));
                assert_eq!(samples.last().copied(), Some(0.0));
            }
        }
    }

    #[test]
    fn sample_rate_changes_length_but_not_duration() {
        for cue in ALL_CUES {
            let at_44 = render(cue, SoundPack::Timber, 44_100);
            let at_48 = render(cue, SoundPack::Timber, 48_000);
            let ms_44 = at_44.len() as f32 / 44.1;
            let ms_48 = at_48.len() as f32 / 48.0;
            assert!(
                (ms_44 - ms_48).abs() < 1.0,
                "{} drifts: {ms_44} ms vs {ms_48} ms",
                cue.as_str()
            );
        }
    }

    #[test]
    fn cue_trim_hierarchy_survives_rendering() {
        // Done must stay quieter than Listen in the actual samples, not just
        // in the score constants.
        for pack in ALL_PACKS {
            let listen = peak(&render(SoundCue::Listen, pack, 48_000));
            let done = peak(&render(SoundCue::Done, pack, 48_000));
            assert!(done < listen, "{}: done is not quieter", pack.as_str());
        }
    }

    #[test]
    fn rendering_is_deterministic() {
        let first = render(SoundCue::Listen, SoundPack::Timber, 48_000);
        let second = render(SoundCue::Listen, SoundPack::Timber, 48_000);
        assert_eq!(first, second);
    }

    #[test]
    fn cues_stay_short_enough_to_stay_out_of_the_way() {
        // Startup is the signature and plays once per launch, so it is allowed
        // to be a phrase. Everything else interrupts real work and must not be.
        for pack in ALL_PACKS {
            for cue in ALL_CUES {
                let ms = duration_ms(cue, pack);
                let budget = if cue == SoundCue::Startup { 2_200.0 } else { 900.0 };
                assert!(
                    ms < budget,
                    "{}/{} runs {ms} ms",
                    pack.as_str(),
                    cue.as_str()
                );
            }
        }
    }
}
