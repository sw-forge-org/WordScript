//! Playback engine.
//!
//! One dedicated thread owns the output stream for the whole process. The
//! previous implementation opened a fresh stream for every cue, which cost an
//! device-open on the hot path (the Listen cue fires exactly while `capture`
//! is opening the input device), swallowed cues whenever that open failed, and
//! let rapid cue chains overlap acoustically.
//!
//! Keeping one stream alive is also what makes the app show up as a stable
//! entry in the OS volume mixer: a stream that exists for 300 ms cannot carry
//! a remembered per-application volume.
//!
//! The original reason for the per-cue design was real — long-lived
//! ALSA/cpal streams can freeze or crash when the audio server or the device
//! changes underneath them. That is handled here by exclusive thread
//! ownership (no cross-thread drop races) plus discard-and-reopen after any
//! failure, rather than by paying an open on every cue.

use std::{
    collections::{HashMap, VecDeque},
    num::NonZero,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{channel, Sender},
        Arc, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

use rodio::{buffer::SamplesBuffer, DeviceSinkBuilder, MixerDeviceSink, Player};

use super::{active_pack, cue::SoundCue, pack::SoundPack, synth};
use crate::core::runtime_log;

/// Silence pushed right after opening, so the device is already running when
/// the first real cue arrives. Without it the first cue lands in the device
/// warm-up and comes out chopped.
const WARMUP_MS: u32 = 40;

/// The same cue twice inside this window is a duplicate trigger, not intent.
const DEDUPE_WINDOW: Duration = Duration::from_millis(250);

/// An `Error` this soon after an `Abort` is the same user action reported
/// twice by two different runtime paths.
const ABORT_ERROR_WINDOW: Duration = Duration::from_millis(400);

const MAX_REOPENS: usize = 3;
const REOPEN_WINDOW: Duration = Duration::from_secs(60);

enum AudioCommand {
    Play { cue: SoundCue, volume: f32 },
    InvalidateCache,
    Warmup,
}

/// Opens the output device and pre-renders the active pack ahead of the first
/// cue. Safe to call more than once.
pub fn init() {
    let _ = sender().send(AudioCommand::Warmup);
}

pub fn submit(cue: SoundCue, volume: f32) {
    let _ = sender().send(AudioCommand::Play { cue, volume });
}

pub fn invalidate_cache() {
    let _ = sender().send(AudioCommand::InvalidateCache);
}

fn sender() -> &'static Sender<AudioCommand> {
    static SENDER: OnceLock<Sender<AudioCommand>> = OnceLock::new();
    SENDER.get_or_init(|| {
        let (tx, rx) = channel::<AudioCommand>();
        thread::Builder::new()
            .name("wordscript-audio".into())
            .spawn(move || {
                let mut state = EngineState::default();
                while let Ok(command) = rx.recv() {
                    match command {
                        AudioCommand::Warmup => state.ensure_device(),
                        AudioCommand::InvalidateCache => state.cache.clear(),
                        AudioCommand::Play { cue, volume } => state.play(cue, volume),
                    }
                }
            })
            .expect("spawn wordscript-audio thread");
        tx
    })
}

struct Device {
    sink: MixerDeviceSink,
    player: Player,
    sample_rate: u32,
    /// Set from cpal's stream error callback. A stream whose device went away
    /// keeps accepting samples silently, so failure has to be observed rather
    /// than inferred from a return value.
    failed: Arc<AtomicBool>,
}

#[derive(Default)]
struct EngineState {
    device: Option<Device>,
    cache: HashMap<SoundCue, Vec<f32>>,
    cached_pack: Option<SoundPack>,
    cached_rate: Option<u32>,
    guard: CueGuard,
    reopens: VecDeque<Instant>,
}

impl EngineState {
    fn play(&mut self, cue: SoundCue, volume: f32) {
        if !self.guard.admit(cue, Instant::now()) {
            return;
        }
        if volume <= 0.0 {
            return;
        }

        self.ensure_device();
        let Some(device) = self.device.as_ref() else {
            return;
        };

        let pack = active_pack();
        let rate = device.sample_rate;
        if self.cached_pack != Some(pack) || self.cached_rate != Some(rate) {
            self.cache.clear();
            self.cached_pack = Some(pack);
            self.cached_rate = Some(rate);
        }
        let samples = self
            .cache
            .entry(cue)
            .or_insert_with(|| synth::render(cue, pack, rate))
            .clone();

        let device = self.device.as_ref().expect("device checked above");
        // A new cue replaces the running one instead of stacking on top of it.
        // The cut lands in the outgoing decay tail and is masked by the
        // incoming cue's raised-cosine attack.
        if !device.player.empty() {
            device.player.skip_one();
        }
        device.player.set_volume(volume);
        device.player.append(SamplesBuffer::new(
            NonZero::new(1u16).expect("mono"),
            NonZero::new(rate).expect("device reported a zero sample rate"),
            samples,
        ));
        device.player.play();
    }

    fn ensure_device(&mut self) {
        if let Some(device) = self.device.as_ref() {
            if !device.failed.load(Ordering::Relaxed) {
                return;
            }
            runtime_log::record(
                "[WordScript] Audio output reported a stream error, reopening".to_string(),
            );
            self.device = None;
            self.cache.clear();
        }
        if !self.may_reopen() {
            return;
        }

        match open_device() {
            Ok(device) => {
                runtime_log::record(format!(
                    "[WordScript] Audio output opened rate={} channels={}",
                    device.sample_rate,
                    device.sink.config().channel_count()
                ));
                self.device = Some(device);
                self.cache.clear();
                self.cached_rate = None;
            }
            Err(error) => {
                runtime_log::record(format!("[WordScript] Audio output unavailable: {error}"));
            }
        }
    }

    fn may_reopen(&mut self) -> bool {
        let now = Instant::now();
        while let Some(front) = self.reopens.front() {
            if now.duration_since(*front) > REOPEN_WINDOW {
                self.reopens.pop_front();
            } else {
                break;
            }
        }
        if self.reopens.len() >= MAX_REOPENS {
            return false;
        }
        self.reopens.push_back(now);
        true
    }
}

fn open_device() -> Result<Device, rodio::DeviceSinkError> {
    let failed = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&failed);

    // `open_default_sink()` would be shorter but gives no way to install an
    // error callback, and it falls back to arbitrary non-default devices —
    // playing cues out of some other card is worse than staying silent.
    let mut sink = DeviceSinkBuilder::from_default_device()?
        .with_error_callback(move |error: rodio::cpal::StreamError| {
            flag.store(true, Ordering::Relaxed);
            runtime_log::record(format!("[WordScript] Audio stream error: {error}"));
        })
        .open_sink_or_fallback()?;
    sink.log_on_drop(false);
    let sample_rate = sink.config().sample_rate().get();

    let player = Player::connect_new(sink.mixer());
    let warmup = (sample_rate as usize * WARMUP_MS as usize) / 1000;
    player.append(SamplesBuffer::new(
        NonZero::new(1u16).expect("mono"),
        NonZero::new(sample_rate).expect("device reported a zero sample rate"),
        vec![0.0_f32; warmup.max(1)],
    ));
    player.play();

    Ok(Device {
        sink,
        player,
        sample_rate,
        failed,
    })
}

/// Suppresses cue duplicates that come from several runtime paths reporting
/// the same user action.
#[derive(Default)]
struct CueGuard {
    last: Option<(SoundCue, Instant)>,
}

impl CueGuard {
    fn admit(&mut self, cue: SoundCue, now: Instant) -> bool {
        if let Some((previous, at)) = self.last {
            let elapsed = now.duration_since(at);
            if previous == cue && elapsed < DEDUPE_WINDOW {
                return false;
            }
            if previous == SoundCue::Abort
                && cue == SoundCue::Error
                && elapsed < ABORT_ERROR_WINDOW
            {
                return false;
            }
        }
        self.last = Some((cue, now));
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repeated_cue_within_the_window_is_dropped() {
        let mut guard = CueGuard::default();
        let start = Instant::now();
        assert!(guard.admit(SoundCue::Error, start));
        assert!(!guard.admit(SoundCue::Error, start + Duration::from_millis(100)));
        assert!(guard.admit(SoundCue::Error, start + Duration::from_millis(400)));
    }

    #[test]
    fn error_right_after_abort_is_suppressed() {
        let mut guard = CueGuard::default();
        let start = Instant::now();
        assert!(guard.admit(SoundCue::Abort, start));
        assert!(!guard.admit(SoundCue::Error, start + Duration::from_millis(50)));
    }

    #[test]
    fn error_well_after_abort_still_plays() {
        let mut guard = CueGuard::default();
        let start = Instant::now();
        assert!(guard.admit(SoundCue::Abort, start));
        assert!(guard.admit(SoundCue::Error, start + Duration::from_millis(600)));
    }

    #[test]
    fn a_normal_dictation_sequence_is_never_suppressed() {
        let mut guard = CueGuard::default();
        let start = Instant::now();
        assert!(guard.admit(SoundCue::Listen, start));
        assert!(guard.admit(SoundCue::Handoff, start + Duration::from_millis(1_500)));
        assert!(guard.admit(SoundCue::Done, start + Duration::from_millis(2_400)));
    }

    #[test]
    fn different_cues_back_to_back_both_play() {
        let mut guard = CueGuard::default();
        let start = Instant::now();
        assert!(guard.admit(SoundCue::Listen, start));
        assert!(guard.admit(SoundCue::Abort, start + Duration::from_millis(30)));
    }

    #[test]
    fn reopen_attempts_are_rate_limited() {
        let mut state = EngineState::default();
        for _ in 0..MAX_REOPENS {
            assert!(state.may_reopen());
        }
        assert!(
            !state.may_reopen(),
            "a dead audio device must not be reopened without limit"
        );
    }
}
