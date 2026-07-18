use std::{
    f32::consts::PI,
    num::NonZero,
    sync::{
        atomic::{AtomicBool, Ordering},
        OnceLock,
    },
    thread,
    time::Duration,
};

use rodio::{buffer::SamplesBuffer, DeviceSinkBuilder};

use super::config::AppConfig;

const SAMPLE_RATE: u32 = 44_100;
const STARTUP_DELAY_MS: u64 = 300;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SoundCue {
    Startup,
    Start,
    Stop,
    Abort,
    Error,
}

#[derive(Debug)]
struct SoundLibrary {
    startup: Vec<f32>,
    start: Vec<f32>,
    stop: Vec<f32>,
    abort: Vec<f32>,
    error: Vec<f32>,
}

impl SoundLibrary {
    fn new() -> Self {
        Self {
            startup: concat_segments(&[
                fade(tone(523.25, 150, 0.32), 0.08),
                gap(35),
                fade(tone(659.25, 180, 0.34), 0.08),
            ]),
            start: concat_segments(&[
                fade(tone(783.99, 95, 0.28), 0.1),
                gap(18),
                fade(tone(987.77, 120, 0.34), 0.1),
            ]),
            stop: concat_segments(&[
                fade(tone(659.25, 125, 0.3), 0.08),
                gap(28),
                fade(tone(493.88, 155, 0.32), 0.08),
            ]),
            abort: concat_segments(&[
                fade(tone(523.25, 120, 0.3), 0.08),
                gap(25),
                fade(tone(392.0, 155, 0.32), 0.08),
            ]),
            error: concat_segments(&[
                fade(tone(330.0, 135, 0.34), 0.08),
                gap(20),
                fade(tone(261.63, 165, 0.36), 0.08),
            ]),
        }
    }

    fn samples(&self, cue: SoundCue) -> &[f32] {
        match cue {
            SoundCue::Startup => &self.startup,
            SoundCue::Start => &self.start,
            SoundCue::Stop => &self.stop,
            SoundCue::Abort => &self.abort,
            SoundCue::Error => &self.error,
        }
    }
}

pub fn play_if_enabled(cue: SoundCue) {
    if sounds_enabled().load(Ordering::Relaxed) {
        play(cue);
    }
}

pub fn schedule_startup_if_enabled() {
    set_enabled(AppConfig::load_from_disk().play_sounds);
    if !sounds_enabled().load(Ordering::Relaxed) {
        return;
    }

    thread::spawn(|| {
        thread::sleep(Duration::from_millis(STARTUP_DELAY_MS));
        play(SoundCue::Startup);
    });
}

pub fn play(cue: SoundCue) {
    let samples = sound_library().samples(cue).to_vec();

    // Open a fresh output stream for every cue instead of keeping a persistent
    // stream alive for the whole application lifetime. Long-lived ALSA/cpal
    // streams can segfault or freeze when the audio server/device state changes
    // (PulseAudio/PipeWire suspend, JACK disconnect, Bluetooth headset sleep,
    // etc.). A short-lived stream per cue is slightly more work but far more
    // resilient.
    //
    // Side effect of the per-cue design: rapid back-to-back triggers (e.g.
    // Start → Stop → Abort within a few hundred ms) play on independent
    // threads/streams and therefore overlap acoustically. This is accepted by
    // design — interrupting a previous cue would add cross-thread cancellation
    // state for a cosmetic gain. See plan 1782750354086, Phase 5.1.
    thread::spawn(move || {
        let sample_count = samples.len();
        let mut stream = match DeviceSinkBuilder::open_default_sink() {
            Ok(stream) => stream,
            Err(error) => {
                eprintln!("WordScript sound output unavailable: {error}");
                return;
            }
        };
        stream.log_on_drop(false);
        stream.mixer().add(SamplesBuffer::new(
            NonZero::new(1).unwrap(),
            NonZero::new(SAMPLE_RATE).unwrap(),
            samples,
        ));

        // Keep the stream alive until the cue has finished playing.
        let duration = Duration::from_secs_f32(sample_count as f32 / SAMPLE_RATE as f32);
        thread::sleep(duration + Duration::from_millis(150));
    });
}

pub fn set_enabled(enabled: bool) {
    sounds_enabled().store(enabled, Ordering::Relaxed);
}

fn sounds_enabled() -> &'static AtomicBool {
    static ENABLED: OnceLock<AtomicBool> = OnceLock::new();
    ENABLED.get_or_init(|| AtomicBool::new(AppConfig::load_from_disk().play_sounds))
}

fn sound_library() -> &'static SoundLibrary {
    static LIBRARY: OnceLock<SoundLibrary> = OnceLock::new();
    LIBRARY.get_or_init(SoundLibrary::new)
}

fn tone(freq_hz: f32, duration_ms: u64, volume: f32) -> Vec<f32> {
    let sample_count = duration_samples(duration_ms);
    (0..sample_count)
        .map(|index| {
            let t = index as f32 / SAMPLE_RATE as f32;
            (2.0 * PI * freq_hz * t).sin() * volume
        })
        .collect()
}

fn gap(duration_ms: u64) -> Vec<f32> {
    vec![0.0; duration_samples(duration_ms)]
}

fn duration_samples(duration_ms: u64) -> usize {
    ((SAMPLE_RATE as f32 * duration_ms as f32) / 1_000.0).round() as usize
}

fn fade(mut samples: Vec<f32>, fade_pct: f32) -> Vec<f32> {
    let len = samples.len();
    if len == 0 {
        return samples;
    }

    let fade_len = ((len as f32) * fade_pct).floor() as usize;
    let fade_len = fade_len.max(1).min(len);
    if fade_len == 1 {
        samples[0] = 0.0;
        samples[len - 1] = 0.0;
        return samples;
    }

    let denom = (fade_len - 1) as f32;
    for index in 0..fade_len {
        let scale = index as f32 / denom;
        samples[index] *= scale;
        samples[len - fade_len + index] *= 1.0 - scale;
    }
    samples
}

fn concat_segments(segments: &[Vec<f32>]) -> Vec<f32> {
    let total = segments.iter().map(Vec::len).sum();
    let mut combined = Vec::with_capacity(total);
    for segment in segments {
        combined.extend_from_slice(segment);
    }
    combined
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tone_has_expected_duration() {
        assert_eq!(tone(880.0, 110, 0.12).len(), duration_samples(110));
        assert_eq!(gap(35).len(), duration_samples(35));
    }

    #[test]
    fn fade_zeroes_edges_without_destroying_middle() {
        let faded = fade(vec![1.0; 100], 0.1);
        assert_eq!(faded.first().copied(), Some(0.0));
        assert_eq!(faded.last().copied(), Some(0.0));
        assert!(faded[50] > 0.9);
    }

    #[test]
    fn legacy_sound_library_builds_all_cues() {
        let library = SoundLibrary::new();
        for cue in [
            SoundCue::Startup,
            SoundCue::Start,
            SoundCue::Stop,
            SoundCue::Abort,
            SoundCue::Error,
        ] {
            let samples = library.samples(cue);
            assert!(!samples.is_empty());
            assert!(samples.iter().any(|sample| sample.abs() > 0.01));
        }
    }
}
