//! An unattended soak of the input stream, with no app and no words.
//!
//! `capture-loses-half-the-recording.md` spent three passes describing a defect
//! nobody could summon: a capture that silently keeps half its audio, eleven
//! times in 643 captures. The third pass worked out why waiting was never
//! necessary, and this module is Route A of that plan:
//!
//! - **Nobody has to speak.** The diagnostics are computed from the sample
//!   stream, not from speech. Silence produces samples like anything else.
//! - **The rate is one event per hour of OPEN STREAM**, not per capture. It
//!   looks rare per capture only because the average capture is under a minute.
//!   A night of open stream should produce roughly eight events.
//!
//! So this holds one stream open for hours and keeps the app's own books on it.
//!
//! **It carries the real `CallbackCadence` rather than a copy.** An instrument
//! that reimplements the thing it measures can only ever confirm itself; if the
//! cadence arithmetic is wrong, the soak has to be wrong the same way for the
//! result to mean anything. The same reasoning applies to `CaptureIntegrity`,
//! `waveform_buckets` and `f32_to_i16`.
//!
//! **What it cannot settle**, stated here because the record states it: if the
//! cause is contention with WordScript's own per-callback work, a bare stream
//! may never reproduce it. So the soak does the same work per callback — the
//! buffer copy, peak and RMS, the 42 ms bookkeeping — and only the `app.emit`
//! has no app to go to. A soak that finds nothing does not exonerate PipeWire;
//! it moves the suspicion to the app, and that is a result worth reporting as
//! one.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::SampleFormat;

use crate::core::capture::{
    cadence_log_lines, f32_to_i16, sample_format_label, select_input_device, waveform_buckets,
    CallbackCadence, CaptureIntegrity, CaptureIntegrityVerdict, InputLevelSummary,
    NativeCaptureConfig, AUDIO_LEVEL_INTERVAL_MS, CLIPPING_SAMPLE_THRESHOLD,
    DEFAULT_VOICE_THRESHOLD,
};
use crate::core::runtime_log;

/// How long a segment runs before it is closed and reported.
///
/// Five minutes because the affected captures are the long ones — seven of the
/// eight originally measured exceed 100 s — and because a segment is the unit
/// the integrity verdict is computed over. Too short and an ordinary startup
/// transient dominates the ratio; too long and a dropout is diluted below the
/// 10 % threshold that names it.
const DEFAULT_SEGMENT_SECONDS: u64 = 300;

/// How long the stream may deliver nothing before the reporter says so without
/// waiting for the segment to close.
///
/// A segment is closed BY A CALLBACK, so a stream that stops entirely would
/// otherwise end the log with an ordinary line and go quiet — the one outcome
/// that must not look like a clean shutdown. This is the only reason the soak
/// has a clock of its own.
const WATCHDOG_SILENCE_MS: u128 = 2_000;

/// How often the reporter wakes to drain finished segments and check the
/// watchdog. It writes the file; the audio callback never does.
const REPORTER_TICK_MS: u64 = 500;

pub struct SoakOptions {
    pub segment_seconds: u64,
    pub run_seconds: Option<u64>,
    pub log_path: Option<PathBuf>,
    pub device_override: Option<String>,
}

impl Default for SoakOptions {
    fn default() -> Self {
        Self {
            segment_seconds: DEFAULT_SEGMENT_SECONDS,
            run_seconds: None,
            log_path: None,
            device_override: None,
        }
    }
}

/// One closed segment, frozen inside the callback and handed to the reporter.
///
/// It carries no borrowed state so the audio thread can drop it into a queue
/// and return. Nothing here is formatted or written on the audio thread.
#[derive(Debug, Clone)]
pub(crate) struct FinishedSegment {
    pub(crate) index: u64,
    pub(crate) epoch_ms_at_start: u128,
    pub(crate) wall: Duration,
    pub(crate) cadence: CallbackCadence,
    pub(crate) sample_count: usize,
    pub(crate) peak: f32,
    pub(crate) clipped_samples: u64,
    pub(crate) measured_samples: u64,
    pub(crate) sum_squares: f64,
    pub(crate) level_ticks: u64,
}

impl FinishedSegment {
    pub(crate) fn integrity(&self, sample_rate: u32, channels: u16) -> CaptureIntegrity {
        CaptureIntegrity::new(self.wall, self.sample_count, sample_rate, channels)
    }

    /// The lines this segment contributes to the soak log.
    ///
    /// The cadence and integrity lines are byte-for-byte the ones a real
    /// capture writes, so every tool already pointed at the runtime log reads
    /// this file unchanged. The `Soak segment` line is the addition: it carries
    /// the wall-clock epoch of the segment's START, which is what a
    /// `journalctl --user -u pipewire` window is correlated against. Without it
    /// a gap is located only inside a capture that no longer exists.
    pub(crate) fn log_lines(&self, sample_rate: u32, channels: u16) -> Vec<String> {
        let integrity = self.integrity(sample_rate, channels);
        let level = InputLevelSummary::new(
            self.peak,
            self.clipped_samples,
            self.measured_samples,
            self.sum_squares,
        );

        let expected_ticks = (self.wall.as_millis() as u64) / AUDIO_LEVEL_INTERVAL_MS;
        let mut lines = vec![format!(
            "[WordScript] Soak segment index={} epoch_ms_at_start={} wall_seconds={:.3} level_ticks={} expected_ticks={}",
            self.index,
            self.epoch_ms_at_start,
            self.wall.as_secs_f64(),
            self.level_ticks,
            expected_ticks,
        )];

        lines.push(format!(
            "[WordScript] Capture integrity wall_seconds={:.3} recorded_seconds={:.3} missing_ratio={:.4} verdict={:?}",
            integrity.wall_seconds,
            integrity.recorded_seconds,
            integrity.missing_ratio,
            integrity.verdict,
        ));

        lines.extend(cadence_log_lines(&self.cadence, &integrity));

        lines.push(format!(
            "[WordScript] Capture input level peak_dbfs={:.1} rms_dbfs={:.1} clipped_ratio={:.4} verdict={:?}",
            level.peak_dbfs, level.rms_dbfs, level.clipped_ratio, level.verdict,
        ));

        lines
    }
}

/// The per-callback bookkeeping, with the audio device removed.
///
/// Split out from the stream so the rotation can be driven over a synthetic
/// timeline in a test. A soak asserted with `thread::sleep` would be measuring
/// the test runner's scheduler — the same reason `CallbackCadence::observe`
/// takes `now` as an argument instead of reading it.
pub(crate) struct SoakRecorder {
    sample_rate: u32,
    channels: u16,
    segment_duration: Duration,
    max_samples_per_segment: usize,

    index: u64,
    segment_started_at: Instant,
    epoch_ms_at_segment_start: u128,
    cadence: CallbackCadence,
    buffer: Vec<i16>,
    sample_count: usize,
    peak: f32,
    clipped_samples: u64,
    measured_samples: u64,
    sum_squares: f64,
    level_ticks: u64,
    last_level_tick_at: Instant,

    pub(crate) finished: Vec<FinishedSegment>,
    pub(crate) last_callback_at: Option<Instant>,
    pub(crate) total_callbacks: u64,
}

impl SoakRecorder {
    pub(crate) fn new(
        sample_rate: u32,
        channels: u16,
        segment_duration: Duration,
        started_at: Instant,
        epoch_ms: u128,
    ) -> Self {
        let max_samples_per_segment = (segment_duration.as_secs().max(1) as usize)
            .saturating_mul(sample_rate as usize)
            .saturating_mul(channels.max(1) as usize);

        Self {
            sample_rate,
            channels,
            segment_duration,
            max_samples_per_segment,
            index: 0,
            segment_started_at: started_at,
            epoch_ms_at_segment_start: epoch_ms,
            cadence: CallbackCadence::new(sample_rate, channels),
            buffer: Vec::new(),
            sample_count: 0,
            peak: 0.0,
            clipped_samples: 0,
            measured_samples: 0,
            sum_squares: 0.0,
            level_ticks: 0,
            last_level_tick_at: started_at - Duration::from_millis(AUDIO_LEVEL_INTERVAL_MS),
            finished: Vec::new(),
            last_callback_at: None,
            total_callbacks: 0,
        }
    }

    /// The whole per-callback path, in the order `process_samples` runs it.
    ///
    /// `now` is the callback's arrival time. The cadence is observed FIRST and
    /// unconditionally, for the reason the production comment gives: the
    /// question it answers is whether the callback ran at all, and skipping it
    /// under any condition would put a hole in the measurement that exists to
    /// find holes.
    pub(crate) fn observe(&mut self, now: Instant, samples: &[f32]) {
        self.total_callbacks += 1;
        self.last_callback_at = Some(now);
        self.cadence
            .observe(self.segment_started_at, now, samples.len());

        let normalized = samples
            .iter()
            .map(|sample| sample.clamp(-1.0, 1.0))
            .collect::<Vec<_>>();

        let mut peak = 0.0_f32;
        let mut rms = 0.0_f32;
        for sample in &normalized {
            peak = peak.max(sample.abs());
            rms += sample.powi(2);
            if self.buffer.len() < self.max_samples_per_segment {
                self.buffer.push(f32_to_i16(*sample));
            }
            if sample.abs() >= CLIPPING_SAMPLE_THRESHOLD {
                self.clipped_samples += 1;
            }
            self.sum_squares += f64::from(*sample) * f64::from(*sample);
        }

        self.sample_count += normalized.len();
        self.measured_samples += normalized.len() as u64;
        self.peak = self.peak.max(peak);

        if !normalized.is_empty() {
            rms = (rms / normalized.len() as f32).sqrt();
            // The app emits these three; the soak has nowhere to send them. The
            // work still has to happen, because Route A exists partly to find
            // out whether the app's own per-callback cost is the cause — so the
            // results go to `black_box` rather than being dropped, which would
            // let the optimizer delete exactly the load under test.
            std::hint::black_box((
                rms,
                waveform_buckets(&normalized),
                peak > DEFAULT_VOICE_THRESHOLD,
            ));
        }

        if now.saturating_duration_since(self.last_level_tick_at)
            >= Duration::from_millis(AUDIO_LEVEL_INTERVAL_MS)
        {
            self.last_level_tick_at = now;
            self.level_ticks += 1;
        }

        if now.saturating_duration_since(self.segment_started_at) >= self.segment_duration {
            self.rotate(now);
        }
    }

    /// Close the running segment and start the next one AT THE SAME INSTANT.
    ///
    /// No wall-clock time falls between two segments, so the segments tile the
    /// soak exactly and a dropout cannot hide in a seam. The rotation is driven
    /// by a callback rather than a clock, which is deliberate: while the stream
    /// delivers nothing the segment stays open and grows, and that is precisely
    /// the shape the defect has — `wall_seconds` far ahead of
    /// `recorded_seconds` in one segment, rather than a run of tidy ones.
    fn rotate(&mut self, now: Instant) {
        let wall = now.saturating_duration_since(self.segment_started_at);
        self.finished.push(FinishedSegment {
            index: self.index,
            epoch_ms_at_start: self.epoch_ms_at_segment_start,
            wall,
            cadence: self.cadence.clone(),
            sample_count: self.sample_count,
            peak: self.peak,
            clipped_samples: self.clipped_samples,
            measured_samples: self.measured_samples,
            sum_squares: self.sum_squares,
            level_ticks: self.level_ticks,
        });

        self.index += 1;
        self.segment_started_at = now;
        self.epoch_ms_at_segment_start = epoch_ms_now();
        self.cadence = CallbackCadence::new(self.sample_rate, self.channels);
        self.buffer.clear();
        self.sample_count = 0;
        self.peak = 0.0;
        self.clipped_samples = 0;
        self.measured_samples = 0;
        self.sum_squares = 0.0;
        self.level_ticks = 0;
        self.last_level_tick_at = now;
    }

    /// Close the running segment because the soak is ending rather than because
    /// a callback crossed the boundary. A partial final segment is still a
    /// measurement, and discarding it would silently drop the tail of the run.
    ///
    /// **The millisecond-sized remainder is not written.** Rotation happens
    /// inside a callback, so the run almost always ends a few milliseconds into
    /// a fresh segment; reporting that stub produced a line reading
    /// `missing_ratio=1.0000` on a perfectly healthy soak — a fabricated total
    /// loss, which is the exact failure this whole cluster is about, committed
    /// by the instrument.
    ///
    /// The stub is told apart from a real one by the app's own threshold rather
    /// than a second one invented here: a segment long enough for
    /// `CaptureIntegrity` to judge is reported even with no samples in it,
    /// because a stream that stopped delivering for minutes is the finding.
    pub(crate) fn finish(&mut self, now: Instant) {
        let wall = now.saturating_duration_since(self.segment_started_at);
        let judged =
            CaptureIntegrity::new(wall, self.sample_count, self.sample_rate, self.channels).verdict
                != CaptureIntegrityVerdict::NotMeasured;

        if self.sample_count > 0 || judged {
            self.rotate(now);
        }
    }

    pub(crate) fn take_finished(&mut self) -> Vec<FinishedSegment> {
        std::mem::take(&mut self.finished)
    }
}

fn epoch_ms_now() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0)
}

struct SoakLog {
    path: PathBuf,
}

impl SoakLog {
    /// Deliberately NOT the runtime log. The soak writes thousands of lines
    /// over a night and the runtime log rotates at 4 MB — folding them together
    /// would push out the very capture history the soak is meant to be compared
    /// against.
    fn new(path: Option<PathBuf>) -> Self {
        let path = path.unwrap_or_else(|| {
            crate::core::paths::user_data_dir()
                .join("logs")
                .join("wordscript-capture-soak.log")
        });
        Self { path }
    }

    fn record(&self, message: &str) {
        let line = format!("{} {message}", runtime_log::log_timestamp());
        println!("{line}");
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
        {
            let _ = writeln!(file, "{line}");
        }
    }
}

/// Open the stream the app opens, keep it open, and report what it delivers.
///
/// Returns when `run_seconds` elapses. It never stops the stream early on its
/// own: a soak that closes the stream when it sees something interesting
/// destroys the evidence for what came next.
///
/// Closed segments are written as they close, so an interrupted run loses at
/// most the segment still open — every completed one is already on disk.
pub fn run(options: SoakOptions) -> Result<(), String> {
    let log = SoakLog::new(options.log_path.clone());

    let config = NativeCaptureConfig::load_from_disk();
    let preferred = options
        .device_override
        .clone()
        .unwrap_or_else(|| config.audio_device.clone());

    let host = cpal::default_host();
    let device = select_input_device(&host, &preferred)?;
    let device_name = device
        .name()
        .unwrap_or_else(|_| "Default microphone".to_string());
    let supported_config = device
        .default_input_config()
        .map_err(|error| format!("Could not read input stream config: {error}"))?;
    let sample_format = supported_config.sample_format();
    let stream_config = supported_config.config();
    let sample_rate = stream_config.sample_rate;
    let channels = stream_config.channels;

    log.record(&format!(
        "[WordScript] Soak start host={} device={} sample_rate={} channels={} sample_format={} segment_seconds={} run_seconds={}",
        host.id().name(),
        device_name,
        sample_rate,
        channels,
        sample_format_label(sample_format),
        options.segment_seconds,
        options
            .run_seconds
            .map(|seconds| seconds.to_string())
            .unwrap_or_else(|| "unbounded".to_string()),
    ));

    let started_at = Instant::now();
    let recorder = Arc::new(Mutex::new(SoakRecorder::new(
        sample_rate,
        channels,
        Duration::from_secs(options.segment_seconds.max(1)),
        started_at,
        epoch_ms_now(),
    )));

    let stream_errors = Arc::new(Mutex::new(Vec::<String>::new()));
    let stream = build_soak_stream(
        &device,
        &stream_config,
        sample_format,
        recorder.clone(),
        stream_errors.clone(),
    )?;
    stream
        .play()
        .map_err(|error| format!("Could not start the soak stream: {error}"))?;

    let mut watchdog_open = false;
    loop {
        std::thread::sleep(Duration::from_millis(REPORTER_TICK_MS));

        let (finished, last_callback_at, total_callbacks) = {
            let Ok(mut recorder) = recorder.lock() else {
                break;
            };
            (
                recorder.take_finished(),
                recorder.last_callback_at,
                recorder.total_callbacks,
            )
        };

        for segment in &finished {
            for line in segment.log_lines(sample_rate, channels) {
                log.record(&line);
            }
        }

        if let Ok(mut errors) = stream_errors.lock() {
            for error in errors.drain(..) {
                log.record(&format!("[WordScript] Soak stream error {error}"));
            }
        }

        let silent_for = last_callback_at
            .map(|at| at.elapsed().as_millis())
            .unwrap_or_else(|| started_at.elapsed().as_millis());
        if silent_for >= WATCHDOG_SILENCE_MS {
            if !watchdog_open {
                watchdog_open = true;
                log.record(&format!(
                    "[WordScript] Soak stream silent for_ms={} total_callbacks={}",
                    silent_for, total_callbacks,
                ));
            }
        } else if watchdog_open {
            watchdog_open = false;
            log.record(&format!(
                "[WordScript] Soak stream resumed total_callbacks={total_callbacks}"
            ));
        }

        let elapsed = started_at.elapsed().as_secs();
        let expired = options
            .run_seconds
            .map(|limit| elapsed >= limit)
            .unwrap_or(false);
        if expired {
            break;
        }
    }

    let tail = {
        let Ok(mut recorder) = recorder.lock() else {
            return Err("The soak recorder lock was poisoned.".to_string());
        };
        recorder.finish(Instant::now());
        recorder.take_finished()
    };
    for segment in &tail {
        for line in segment.log_lines(sample_rate, channels) {
            log.record(&line);
        }
    }

    drop(stream);
    log.record(&format!(
        "[WordScript] Soak done ran_seconds={:.1} log={}",
        started_at.elapsed().as_secs_f64(),
        log.path.display(),
    ));

    Ok(())
}

fn build_soak_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    sample_format: SampleFormat,
    recorder: Arc<Mutex<SoakRecorder>>,
    errors: Arc<Mutex<Vec<String>>>,
) -> Result<cpal::Stream, String> {
    let error_callback = move |error| {
        if let Ok(mut errors) = errors.lock() {
            errors.push(format!("{error}"));
        }
    };

    match sample_format {
        SampleFormat::F32 => device
            .build_input_stream(
                config,
                move |data: &[f32], _| {
                    let now = Instant::now();
                    if let Ok(mut recorder) = recorder.lock() {
                        recorder.observe(now, data);
                    }
                },
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build the soak input stream: {error}")),
        SampleFormat::I16 => device
            .build_input_stream(
                config,
                move |data: &[i16], _| {
                    let now = Instant::now();
                    let converted = data
                        .iter()
                        .copied()
                        .map(|sample| f32::from(sample) / f32::from(i16::MAX))
                        .collect::<Vec<_>>();
                    if let Ok(mut recorder) = recorder.lock() {
                        recorder.observe(now, &converted);
                    }
                },
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build the soak input stream: {error}")),
        SampleFormat::U16 => device
            .build_input_stream(
                config,
                move |data: &[u16], _| {
                    let now = Instant::now();
                    let converted = data
                        .iter()
                        .copied()
                        .map(|sample| (f32::from(sample) / f32::from(u16::MAX)) * 2.0 - 1.0)
                        .collect::<Vec<_>>();
                    if let Ok(mut recorder) = recorder.lock() {
                        recorder.observe(now, &converted);
                    }
                },
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build the soak input stream: {error}")),
        other => Err(format!(
            "Unsupported soak sample format '{}'.",
            sample_format_label(other)
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 44_100;
    const CHANNELS: u16 = 2;
    /// One ordinary ALSA period at 44.1 kHz stereo, as the log shows it.
    const PERIOD_SAMPLES: usize = 2_048;

    fn period_ms() -> f64 {
        PERIOD_SAMPLES as f64 / (f64::from(RATE) * f64::from(CHANNELS)) * 1000.0
    }

    fn recorder(segment_seconds: u64, started_at: Instant) -> SoakRecorder {
        SoakRecorder::new(
            RATE,
            CHANNELS,
            Duration::from_secs(segment_seconds),
            started_at,
            0,
        )
    }

    fn silence() -> Vec<f32> {
        vec![0.0; PERIOD_SAMPLES]
    }

    /// Drive an unbroken stream for `duration`, one nominal period at a time.
    fn feed_steady(
        recorder: &mut SoakRecorder,
        started_at: Instant,
        duration: Duration,
    ) -> Instant {
        let step = Duration::from_secs_f64(period_ms() / 1000.0);
        let mut now = started_at;
        let end = started_at + duration;
        let samples = silence();
        while now < end {
            now += step;
            recorder.observe(now, &samples);
        }
        now
    }

    #[test]
    fn a_steady_stream_reports_intact_segments_and_no_gaps() {
        let started_at = Instant::now();
        let mut recorder = recorder(1, started_at);
        feed_steady(&mut recorder, started_at, Duration::from_millis(2_500));

        let finished = recorder.take_finished();
        assert!(
            finished.len() >= 2,
            "expected at least two closed segments, got {}",
            finished.len()
        );

        for segment in &finished {
            let integrity = segment.integrity(RATE, CHANNELS);
            assert!(
                !integrity.is_short(),
                "a steady stream must not be read as short: {:?}",
                integrity
            );
            let lines = segment.log_lines(RATE, CHANNELS);
            assert!(
                lines.iter().any(|line| line.contains("signature=no_gaps")),
                "{lines:?}"
            );
        }
    }

    /// The defect's own shape: the callback stops arriving, then resumes with an
    /// ordinary period. The audio in the gap was never delivered.
    #[test]
    fn a_suspended_stream_is_reported_as_short_with_a_named_gap() {
        let started_at = Instant::now();
        let mut recorder = recorder(10, started_at);

        let mut now = feed_steady(&mut recorder, started_at, Duration::from_secs(2));
        now += Duration::from_secs(5);
        recorder.observe(now, &silence());
        now = feed_steady(&mut recorder, now, Duration::from_secs(2));

        recorder.finish(now);
        let finished = recorder.take_finished();
        assert_eq!(finished.len(), 1, "{finished:?}");

        let segment = &finished[0];
        let integrity = segment.integrity(RATE, CHANNELS);
        assert!(
            integrity.is_short(),
            "five seconds of silence in nine must read as short: {integrity:?}"
        );

        let lines = segment.log_lines(RATE, CHANNELS);
        assert!(
            lines
                .iter()
                .any(|line| line.contains("signature=stream_suspended")),
            "{lines:?}"
        );
        assert!(
            lines
                .iter()
                .any(|line| line.contains("Capture callback gap at_ms=")
                    && line.contains(&format!("resumed_with_samples={PERIOD_SAMPLES}"))),
            "the gap must name the size of the callback that ended it: {lines:?}"
        );
    }

    /// Hypothesis 3: the samples arrived, late and in one block. The soak must
    /// not report that as lost audio.
    #[test]
    fn a_late_delivery_is_not_reported_as_a_suspend() {
        let started_at = Instant::now();
        let mut recorder = recorder(10, started_at);

        let mut now = feed_steady(&mut recorder, started_at, Duration::from_secs(2));
        now += Duration::from_secs(1);
        let catch_up = vec![0.0_f32; PERIOD_SAMPLES * 24];
        recorder.observe(now, &catch_up);
        now = feed_steady(&mut recorder, now, Duration::from_secs(2));

        recorder.finish(now);
        let finished = recorder.take_finished();
        let lines = finished[0].log_lines(RATE, CHANNELS);
        assert!(
            lines
                .iter()
                .any(|line| line.contains("signature=late_delivery")),
            "{lines:?}"
        );
    }

    /// The seam test. Segments must tile the run exactly, or a dropout that
    /// straddles a boundary would be split into two halves, each below the
    /// threshold that names it.
    #[test]
    fn segments_tile_the_run_without_losing_wall_time() {
        let started_at = Instant::now();
        let mut recorder = recorder(1, started_at);
        let end = feed_steady(&mut recorder, started_at, Duration::from_millis(3_400));
        recorder.finish(end);

        let finished = recorder.take_finished();
        let total: Duration = finished.iter().map(|segment| segment.wall).sum();
        let run = end.saturating_duration_since(started_at);
        let drift = run.as_secs_f64() - total.as_secs_f64();
        assert!(
            drift.abs() < 0.001,
            "segments lost {drift:.6} s of wall clock across {} segments",
            finished.len()
        );
    }

    /// A silent recording still leaves the complete measurement behind — the
    /// fact the whole route rests on.
    #[test]
    fn silence_produces_a_full_measurement() {
        let started_at = Instant::now();
        let mut recorder = recorder(1, started_at);
        let end = feed_steady(&mut recorder, started_at, Duration::from_millis(1_200));
        recorder.finish(end);

        let finished = recorder.take_finished();
        let segment = &finished[0];
        assert!(segment.sample_count > 0);
        assert!(segment.measured_samples > 0);

        let lines = segment.log_lines(RATE, CHANNELS);
        assert!(lines.iter().any(|line| line.contains("Capture integrity")));
        assert!(lines
            .iter()
            .any(|line| line.contains("Capture callback cadence")));
        assert!(lines
            .iter()
            .any(|line| line.contains("Capture input level") && line.contains("verdict=Silent")));
    }

    /// Both directions of the stub rule. The first case is what a real 20 s
    /// smoke run produced before it was fixed: a 3 ms remainder reported as
    /// `missing_ratio=1.0000`, a total loss that never happened.
    #[test]
    fn the_rotation_remainder_is_not_reported_as_a_total_loss() {
        let started_at = Instant::now();
        let mut recorder = recorder(1, started_at);

        // Stop the instant a callback has rotated, so the open segment is a few
        // milliseconds old and holds nothing — the state a real run ends in.
        let step = Duration::from_secs_f64(period_ms() / 1000.0);
        let mut now = started_at;
        let samples = silence();
        while recorder.finished.is_empty() {
            now += step;
            recorder.observe(now, &samples);
        }
        let closed_by_callbacks = recorder.finished.len();

        recorder.finish(now + Duration::from_millis(3));
        let finished = recorder.take_finished();

        assert_eq!(
            finished.len(),
            closed_by_callbacks,
            "a millisecond-sized remainder must not become a segment: {:?}",
            finished.last()
        );
        for segment in &finished {
            assert!(
                !segment.integrity(RATE, CHANNELS).is_short(),
                "no healthy segment may read as short: {segment:?}"
            );
        }
    }

    /// The other direction: a stream that stops delivering entirely IS the
    /// finding, and closing the soak must not swallow it just because the final
    /// segment holds no samples.
    #[test]
    fn a_stream_that_stopped_entirely_is_still_reported_at_the_end() {
        let started_at = Instant::now();
        let mut recorder = recorder(600, started_at);
        let last_callback = feed_steady(&mut recorder, started_at, Duration::from_secs(2));

        recorder.finish(last_callback + Duration::from_secs(180));
        let finished = recorder.take_finished();

        assert_eq!(finished.len(), 1, "{finished:?}");
        let integrity = finished[0].integrity(RATE, CHANNELS);
        assert!(
            integrity.is_short(),
            "three minutes of nothing must survive to the log: {integrity:?}"
        );
    }

    /// A segment carries the wall-clock epoch of its own start, which is what a
    /// PipeWire journal window is correlated against.
    #[test]
    fn a_segment_locates_itself_in_wall_clock() {
        let started_at = Instant::now();
        let mut recorder = SoakRecorder::new(
            RATE,
            CHANNELS,
            Duration::from_secs(1),
            started_at,
            1_754_900_000_000,
        );
        let end = feed_steady(&mut recorder, started_at, Duration::from_millis(1_200));
        recorder.finish(end);

        let finished = recorder.take_finished();
        let lines = finished[0].log_lines(RATE, CHANNELS);
        assert!(
            lines
                .iter()
                .any(|line| line.contains("epoch_ms_at_start=1754900000000")),
            "{lines:?}"
        );
    }
}
