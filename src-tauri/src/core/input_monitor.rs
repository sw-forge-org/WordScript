//! THE MICROPHONE MEASURED WHILE NOTHING IS BEING RECORDED.
//!
//! `core::capture` emits `audio_level` from inside a capture, which is the only
//! moment it exists. The input-level row in General has to answer a question
//! asked BEFORE a capture — is this microphone set right — and a meter that
//! only moves during a dictation cannot answer it. So this opens the same
//! device, keeps nothing, and reports the level.
//!
//! **It stores no audio.** There is no sample buffer here and no path to one:
//! the callback reduces a block to a peak and a mean and drops it. What leaves
//! this module is two numbers every 42 ms.
//!
//! **It is Rust-owned for the same reason capture is.** The frontend's vendored
//! waveform can open a microphone itself through `getUserMedia`, which would
//! have a settings page hold a second capture device for as long as it is on
//! screen — the very thing ADR 0063's call detection watches for. One process,
//! one microphone owner.
//!
//! **A capture always wins.** `capture::start_native_capture` stops the monitor
//! before it opens its own stream, and the monitor refuses to start while a
//! capture is running. A dictation may never lose its device to a settings
//! screen.
//!
//! **It cannot outlive the window that asked for it.** A webview that vanishes
//! runs no cleanup, so a monitor started by a window that is then closed would
//! hold the microphone with nobody left to stop it. The lease below is the
//! answer: the caller renews it while it is watching, and a monitor whose lease
//! runs out stops itself.

use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use cpal::{
    traits::{DeviceTrait, StreamTrait},
    Device, SampleFormat, Stream, StreamConfig,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use super::{
    capture::{select_input_device, NativeCaptureConfig, AUDIO_LEVEL_INTERVAL_MS},
    runtime_log,
};

/// How long a monitor runs before it stops itself. The caller renews well
/// inside this, so the value only ever matters when the caller is gone.
pub const MONITOR_LEASE_MS: u64 = 45_000;
/// How often the lease is checked. The microphone stays open at most this much
/// longer than the lease itself.
const LEASE_TICK_MS: u64 = 500;

#[derive(Default)]
pub struct InputMonitorState {
    active: Option<ActiveMonitor>,
}

struct ActiveMonitor {
    device_name: String,
    /// Dropping this stops the stream, which is why nothing else in here needs
    /// to reach the audio thread to end it.
    stream: Stream,
    shared: Arc<Mutex<MonitorShared>>,
    /// Ends the lease thread, so a stopped monitor does not leave one spinning.
    cancelled: Arc<AtomicBool>,
}

/// What the audio callback and the lease thread share.
///
/// The pending fields accumulate ACROSS callbacks rather than per callback: a
/// device delivering 10 ms blocks is called four times between two emits, and
/// reporting only the last block's peak would drop three quarters of the
/// loudest moments — precisely the ones a level readout exists to show.
struct MonitorShared {
    last_emit_at: Instant,
    expires_at: Instant,
    pending_peak: f32,
    pending_sum_squares: f64,
    pending_samples: usize,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct InputMonitorStatus {
    pub monitoring: bool,
    /// The device actually opened, which is not always the one configured — a
    /// saved microphone that is unplugged falls back to the default.
    pub device_name: Option<String>,
}

impl InputMonitorStatus {
    fn idle() -> Self {
        Self {
            monitoring: false,
            device_name: None,
        }
    }
}

impl InputMonitorState {
    fn status(&self) -> InputMonitorStatus {
        match &self.active {
            Some(active) => InputMonitorStatus {
                monitoring: true,
                device_name: Some(active.device_name.clone()),
            },
            None => InputMonitorStatus::idle(),
        }
    }
}

/// Open the configured microphone and report its level until told otherwise.
///
/// Starting an already running monitor renews its lease and returns the device
/// it is on, rather than reopening it: a screen that remounts must not close
/// and reopen the microphone, which on some hosts is an audible click.
#[tauri::command]
pub fn start_input_monitor(app: AppHandle) -> Result<InputMonitorStatus, String> {
    start_for_app(&app)
}

/// Extend the lease. Called by whoever is watching the meter, on a period well
/// inside `MONITOR_LEASE_MS`.
#[tauri::command]
pub fn renew_input_monitor(app: AppHandle) -> Result<InputMonitorStatus, String> {
    let state = app
        .try_state::<Mutex<InputMonitorState>>()
        .ok_or_else(|| "Input monitor state is not available.".to_string())?;
    let state = state.lock().map_err(|error| error.to_string())?;

    if let Some(active) = &state.active {
        if let Ok(mut shared) = active.shared.lock() {
            shared.expires_at = Instant::now() + Duration::from_millis(MONITOR_LEASE_MS);
        }
    }

    Ok(state.status())
}

#[tauri::command]
pub fn stop_input_monitor(app: AppHandle) -> Result<InputMonitorStatus, String> {
    stop_for_app(&app);
    Ok(InputMonitorStatus::idle())
}

#[tauri::command]
pub fn input_monitor_status(app: AppHandle) -> Result<InputMonitorStatus, String> {
    let state = app
        .try_state::<Mutex<InputMonitorState>>()
        .ok_or_else(|| "Input monitor state is not available.".to_string())?;
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

pub fn start_for_app<R: Runtime + 'static>(
    app: &AppHandle<R>,
) -> Result<InputMonitorStatus, String> {
    if super::capture::current_status_for_app(app)
        .map(|status| status.is_recording)
        .unwrap_or(false)
    {
        return Err("A capture is running; it owns the microphone.".to_string());
    }

    let state = app
        .try_state::<Mutex<InputMonitorState>>()
        .ok_or_else(|| "Input monitor state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;

    if let Some(active) = &state.active {
        if let Ok(mut shared) = active.shared.lock() {
            shared.expires_at = Instant::now() + Duration::from_millis(MONITOR_LEASE_MS);
        }
        return Ok(state.status());
    }

    let config = NativeCaptureConfig::load_from_disk();
    let host = cpal::default_host();
    let device = select_input_device(&host, &config.audio_device)?;
    let device_name = device
        .name()
        .unwrap_or_else(|_| "Default microphone".to_string());
    let supported_config = device
        .default_input_config()
        .map_err(|error| format!("Could not read input stream config: {error}"))?;
    let sample_format = supported_config.sample_format();
    let stream_config = supported_config.config();

    let now = Instant::now();
    let shared = Arc::new(Mutex::new(MonitorShared {
        last_emit_at: now - Duration::from_millis(AUDIO_LEVEL_INTERVAL_MS),
        expires_at: now + Duration::from_millis(MONITOR_LEASE_MS),
        pending_peak: 0.0,
        pending_sum_squares: 0.0,
        pending_samples: 0,
    }));

    let stream = build_monitor_stream(
        app.clone(),
        &device,
        &stream_config,
        sample_format,
        shared.clone(),
    )?;
    stream
        .play()
        .map_err(|error| format!("Could not start input monitor stream: {error}"))?;

    runtime_log::record(format!(
        "[WordScript] Input monitor start device={device_name} sample_rate={} channels={}",
        stream_config.sample_rate, stream_config.channels,
    ));

    let cancelled = Arc::new(AtomicBool::new(false));
    spawn_lease_watch(app.clone(), shared.clone(), cancelled.clone());

    state.active = Some(ActiveMonitor {
        device_name,
        stream,
        shared,
        cancelled,
    });

    Ok(state.status())
}

/// Stop a running monitor, if there is one. Safe to call when there is not,
/// which is what lets a capture start with one unconditional line.
pub fn stop_for_app<R: Runtime>(app: &AppHandle<R>) {
    let Some(state) = app.try_state::<Mutex<InputMonitorState>>() else {
        return;
    };
    let Ok(mut state) = state.lock() else {
        return;
    };

    if let Some(active) = state.active.take() {
        active.cancelled.store(true, Ordering::Relaxed);
        let _ = active.stream.pause();
        drop(active.stream);
        runtime_log::record("[WordScript] Input monitor stop".to_string());
    }
}

/// The lease thread. It holds no lock while it sleeps and takes the state's
/// lock only when the lease has actually run out.
fn spawn_lease_watch<R: Runtime + 'static>(
    app: AppHandle<R>,
    shared: Arc<Mutex<MonitorShared>>,
    cancelled: Arc<AtomicBool>,
) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(LEASE_TICK_MS));

        if cancelled.load(Ordering::Relaxed) {
            return;
        }

        let expired = shared
            .lock()
            .map(|shared| Instant::now() >= shared.expires_at)
            .unwrap_or(true);
        if !expired {
            continue;
        }

        // Nobody is watching the meter any more — a closed window runs no
        // cleanup, and this is the path that catches it.
        stop_for_app(&app);
        let _ = app.emit(
            "wordscript-event",
            serde_json::json!({
                "event": "input_monitor_stopped",
                "reason": "lease_expired"
            }),
        );
        return;
    });
}

fn build_monitor_stream<R: Runtime + 'static>(
    app: AppHandle<R>,
    device: &Device,
    config: &StreamConfig,
    sample_format: SampleFormat,
    shared: Arc<Mutex<MonitorShared>>,
) -> Result<Stream, String> {
    let error_app = app.clone();
    // A monitor's stream error is not a session error. It must not reach the
    // `error` channel, where a window would draw it as a failed dictation.
    let error_callback = move |error| {
        let message = format!("Input monitor stream error: {error}");
        runtime_log::record(format!("[WordScript] {message}"));
        stop_for_app(&error_app);
        let _ = error_app.emit(
            "wordscript-event",
            serde_json::json!({
                "event": "input_monitor_stopped",
                "reason": "stream_error",
                "message": message
            }),
        );
    };

    match sample_format {
        SampleFormat::F32 => device
            .build_input_stream(
                config,
                move |data: &[f32], _| {
                    measure(&app, &shared, data.iter().copied().map(|s| s.clamp(-1.0, 1.0)))
                },
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build input monitor stream: {error}")),
        SampleFormat::I16 => device
            .build_input_stream(
                config,
                move |data: &[i16], _| {
                    measure(
                        &app,
                        &shared,
                        data.iter()
                            .copied()
                            .map(|sample| f32::from(sample) / f32::from(i16::MAX)),
                    )
                },
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build input monitor stream: {error}")),
        SampleFormat::U16 => device
            .build_input_stream(
                config,
                move |data: &[u16], _| {
                    measure(
                        &app,
                        &shared,
                        data.iter()
                            .copied()
                            .map(|sample| (f32::from(sample) / f32::from(u16::MAX)) * 2.0 - 1.0),
                    )
                },
                error_callback,
                None,
            )
            .map_err(|error| format!("Could not build input monitor stream: {error}")),
        other => Err(format!(
            "Unsupported native audio sample format '{other:?}'."
        )),
    }
}

/// The whole audio path of this module: reduce the block, and emit at most
/// every `AUDIO_LEVEL_INTERVAL_MS`. Nothing allocates and nothing is written to
/// the log from here — this runs on the realtime audio thread.
fn measure<R: Runtime>(
    app: &AppHandle<R>,
    shared: &Arc<Mutex<MonitorShared>>,
    samples: impl Iterator<Item = f32>,
) {
    let mut peak = 0.0_f32;
    let mut sum_squares = 0.0_f64;
    let mut count = 0_usize;
    for sample in samples {
        let magnitude = sample.abs();
        if magnitude > peak {
            peak = magnitude;
        }
        sum_squares += f64::from(sample) * f64::from(sample);
        count += 1;
    }
    if count == 0 {
        return;
    }

    let Ok(mut state) = shared.lock() else {
        return;
    };
    state.pending_peak = state.pending_peak.max(peak);
    state.pending_sum_squares += sum_squares;
    state.pending_samples += count;

    if state.last_emit_at.elapsed() < Duration::from_millis(AUDIO_LEVEL_INTERVAL_MS) {
        return;
    }

    let level = state.pending_peak;
    let rms = if state.pending_samples > 0 {
        (state.pending_sum_squares / state.pending_samples as f64).sqrt() as f32
    } else {
        0.0
    };
    state.last_emit_at = Instant::now();
    state.pending_peak = 0.0;
    state.pending_sum_squares = 0.0;
    state.pending_samples = 0;
    drop(state);

    // A CHANNEL OF ITS OWN, and the reason is the overlay. `audio_level` means
    // "a capture is producing this"; the overlay draws its bars from it and
    // would report a recording that is not happening if a settings screen could
    // emit one.
    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({
            "event": "input_monitor_level",
            "level": level,
            "rms": rms
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_idle_state_reports_no_device() {
        let state = InputMonitorState::default();
        assert_eq!(
            state.status(),
            InputMonitorStatus {
                monitoring: false,
                device_name: None
            }
        );
    }

    #[test]
    fn the_lease_outlasts_several_renew_periods() {
        // The caller renews on a period; a lease shorter than a few of them
        // would stop a monitor somebody is still watching.
        assert!(MONITOR_LEASE_MS >= 3 * 15_000);
    }

    #[test]
    fn the_lease_is_checked_often_enough_to_bound_the_microphone() {
        assert!(LEASE_TICK_MS <= 1_000);
        assert!(LEASE_TICK_MS < MONITOR_LEASE_MS);
    }

    /// The emit period is what the drawing interpolates between. A monitor
    /// reporting less often than a capture would scroll visibly slower than the
    /// overlay does for the same voice.
    #[test]
    fn the_monitor_reports_at_the_capture_cadence() {
        assert_eq!(AUDIO_LEVEL_INTERVAL_MS, 42);
    }
}
