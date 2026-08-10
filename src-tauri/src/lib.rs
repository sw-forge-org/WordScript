use std::{
    fs::OpenOptions,
    io::{Read, Seek, SeekFrom, Write},
    sync::{
        atomic::{AtomicBool, AtomicU8, Ordering},
        Mutex, Once,
    },
    time::Duration,
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::utils::config::Color;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime};


// Public so design-time tooling can drive the runtime directly — see
// `examples/audition_cues.rs`, which renders the sound cues to WAV.
pub mod core;
mod v1_slice;

use crate::core::capture::{NativeCaptureConfig, NativeCaptureState};
use crate::core::config::{AppConfig, OverlayAnchor, OverlayPositionMode};
use crate::core::insertion::{NativeInsertionConfig, NativeInsertionState};
use crate::core::sessions::NativeSessionState;
use crate::core::trigger::{NativeTriggerConfig, NativeTriggerState, TriggerEffect};
use crate::v1_slice::V1SliceState;

const OVERLAY_EDIT_MODE_WINDOW_HEIGHT_MIN: f64 = 140.0;
const OVERLAY_EDIT_MODE_WINDOW_HEIGHT_MAX: f64 = 280.0;
const OVERLAY_EDIT_MODE_WINDOW_WIDTH_MIN: f64 = 380.0;
const OVERLAY_EDIT_MODE_WINDOW_WIDTH_MAX: f64 = 560.0;
const OVERLAY_EDIT_MODE_RESIZE_HEIGHT_MAX: f64 = 380.0;
const OVERLAY_TOP_INSET: f64 = 34.0;
const OVERLAY_SIDE_INSET: f64 = 28.0;
const OVERLAY_BOTTOM_INSET: f64 = 94.0;
const OVERLAY_PARK_MARGIN: f64 = 72.0;
/// Ticks of the 200 ms capture monitor loop between two stranded-overlay
/// checks, i.e. one check every two seconds.
const OVERLAY_STRANDED_CHECK_INTERVAL_TICKS: u32 = 10;
// The transcription wait and the pipeline watchdog live in
// `core::capture_budget`, beside the recording ceiling they have to agree with.
// They were three loose constants here, and the capture path never consulted
// them: a profile could record 30 minutes into a pipeline that waited 35
// seconds.

// Flat overlay surfaces all share one window size (480×60). On WebKitGTK/XWayland
// with GPU compositing, a `set_size` to the SAME size the window already has is a
// no-op: the backing store is not reallocated, so retained compositor layers of
// the previous surface (animated bars/spinner + the scaled `.ov-pill-shell`
// wrapper) are NOT torn down — the old pill ghosts behind the new one until
// WebKitGTK eventually drops them ("alte States verschwinden verzögert"). The
// 2026-06-24 `set_background_color`-every-reveal fix (handoff §5) was also a
// no-op because it always set the identical RGBA. Alternating the flat window
// height by 1px on every reveal forces a genuine backing-store reallocation → a
// full repaint that deterministically clears every retained layer before the new
// surface paints. The 1px oscillation is invisible: the window is transparent,
// decorationless, and the 40px pill is centred. (plan 1782750354086, §5 follow-up)
static OVERLAY_FLAT_REVEAL_TICK: AtomicU8 = AtomicU8::new(0);

// Authoritative visibility tracker for the overlay window. `window.is_visible()`
// is UNRELIABLE on XWayland (it can return false while the window is shown, just
// like `outer_size()` reports 0×0). reveal_overlay_window repositions ONLY on the
// hidden→visible transition (`if !was_visible`); if is_visible() lies, every
// reveal repositions → different overlay states land on different monitors within
// ONE session (recording on monitor A, result-actions on monitor B). Tracking
// visibility ourselves — true when reveal calls show(), false when park calls
// hide() — makes the hidden→visible gate deterministic: within a session the
// window stays shown, so states keep their (single, shared) position; only a
// genuine park→reveal (between sessions) repositions. (plan 1782750354086)
static OVERLAY_WINDOW_SHOWN: AtomicBool = AtomicBool::new(false);

// D3 (plan 1784412908352) — Rust-side reveal coalescing as defense-in-depth.
// Even with the frontend `scheduleReveal` serializer (D1), a frontend reveal
// and a Rust-triggered reveal (`apply_trigger_effect::StartCapture`) can race
// in the same frame. `reveal_overlay_window` is split into two entry points:
//
//   * `reveal_overlay_window` (direct) — synchronous, used by the StartCapture
//     trigger (the frontend's reveal for `recording_started` only fires in the
//     REACTION render, so there is no same-frame competition here).
//
//   * `reveal_overlay_window_coalesced` — used by `sync_overlay_window_visibility`.
//     Writes the request into `OVERLAY_PENDING_REVEAL` (last-write-wins) and
//     schedules a single flush on the tokio runtime via a 0-ms sleep (yields to
//     the event loop so any other same-frame sync calls overwrite the pending
//     request before the flush runs). `OVERLAY_REVEAL_SCHEDULED` guards against
//     spawning more than one flush task at a time.
//
// The 1px-height oscillation (`OVERLAY_FLAT_REVEAL_TICK`) is incremented on
// EVERY flat reveal — NOT just the hidden→visible transition. A mode-cycle
// within "recording" keeps `pillState.kind === "recording"`, so the React
// `key={pillState.kind}` does NOT remount → no compositor-layer orphaning.
// The oscillation is the only native repaint trigger for these same-kind
// visual changes. The multi-`set_size` cascade (RC1/RC3) is prevented by the
// D1 frontend serializer + the D3 Rust coalescing wrapper, which ensure only
// ONE `set_size` per frame with ONE height instead of 2–3 competing heights.
static OVERLAY_PENDING_REVEAL: Mutex<Option<(OverlaySurface, Option<f64>, Option<f64>)>> = Mutex::new(None);
static OVERLAY_REVEAL_SCHEDULED: AtomicBool = AtomicBool::new(false);

// ── Diagnose-Infrastruktur (plan 1784433288646, Phase 1.2) ──────────────────
// Permanent debug-only log sink for the overlay window. The frontend writes
// [ov-tap]/[ov-render]/[ov-sched]/[ov-repaint]/[ov-dom]/[ov-reveal] lines via
// the `append_diag_log` command (only called under `import.meta.env.DEV`). The
// Settings-Window Diagnose-Panel polls `read_diag_log` to display them live.
// The `Once` truncates the file on the first call per process run so each
// `npm run tauri dev` session starts with a fresh log.
const OVERLAY_DIAG_LOG_PATH: &str = "/tmp/kilo/overlay-diag.log";
static OVERLAY_DIAG_LOG_TRUNCATED: Once = Once::new();

// The panel only ever displays the tail, so `read_diag_log` returns at most this
// many bytes. Reading the whole file put an unbounded, session-length-dependent
// payload on every 500 ms poll — several MB per poll after an hour — which is
// exactly the kind of main-thread load this log exists to diagnose.
const OVERLAY_DIAG_LOG_READ_TAIL_BYTES: u64 = 64 * 1024;
// Hard ceiling for the file itself. Without it a long session grows it without
// bound; the log is a live diagnostic, not an archive.
const OVERLAY_DIAG_LOG_MAX_BYTES: u64 = 8 * 1024 * 1024;
// Per-call batch cap. The ceiling above is checked once per `append_diag_log`
// call, which bounded a one-line-per-call command to a one-line overshoot. The
// batch signature would otherwise make a single call unbounded, and the command
// is registered in release builds too even though only DEV code calls it. A
// commit's worth of trace lines is well under this.
const OVERLAY_DIAG_LOG_MAX_BATCH_LINES: usize = 512;
// One process-wide append handle. Re-opening per line cost three syscalls per
// write at the overlay's ~24 Hz render rate.
static OVERLAY_DIAG_LOG_FILE: Mutex<Option<std::fs::File>> = Mutex::new(None);

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
struct OverlayMonitorOption {
    id: String,
    label: String,
    is_primary: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
enum OverlaySurface {
    Compact,
    ProcessingPreview,
    ResultActions,
    EditMode,
    ModePicker,
}

impl Default for OverlaySurface {
    fn default() -> Self {
        Self::Compact
    }
}

impl OverlaySurface {
    fn dimensions(self) -> (f64, f64) {
        // ALL flat surfaces share ONE uniform width (480px). A per-surface
        // width caused clipping on longer transcripts: the processing-preview
        // (05) with MicButton + PreviewText + Actions + Timer + Working is
        // wider than compact (recording), and the result-actions (06b) with 4
        // buttons (Copy/Edit/Insert/Dismiss) is wider than 06 with 3. When the
        // window was 440px and the pill (even at zoom 0.87) exceeded it, the
        // pill's rounded ends were clipped outside the window → "eckige Kanten".
        // A uniform width also means surface swaps within a session never
        // trigger set_size (no async resize churn on GTK).
        // CRITICAL: this default is used by BOTH the base surface sync and the
        // frontend useLayoutEffect — they MUST agree.
        match self {
            Self::Compact => (480.0, 60.0),
            Self::ProcessingPreview => (480.0, 60.0),
            Self::ResultActions => (480.0, 60.0),
            Self::EditMode => (460.0, 164.0),
            Self::ModePicker => (480.0, 60.0),
        }
    }

}

// Remember the exact top-left window position, regardless of which overlay surface was dragged.
fn manual_overlay_reference_position(x: f64, y: f64, _surface: OverlaySurface) -> (f64, f64) {
    (x, y)
}

fn manual_overlay_surface_position(
    reference_x: f64,
    reference_y: f64,
    _surface: OverlaySurface,
) -> (f64, f64) {
    (reference_x, reference_y)
}

fn overlay_monitor_work_area(monitor: &tauri::Monitor) -> (f64, f64, f64, f64) {
    let scale = monitor.scale_factor().max(1.0);
    let work_area = monitor.work_area();

    (
        work_area.position.x as f64 / scale,
        work_area.position.y as f64 / scale,
        work_area.size.width as f64 / scale,
        work_area.size.height as f64 / scale,
    )
}

fn logical_point_in_work_area(
    point_x: f64,
    point_y: f64,
    work_x: f64,
    work_y: f64,
    work_width: f64,
    work_height: f64,
) -> bool {
    point_x >= work_x
        && point_x <= work_x + work_width
        && point_y >= work_y
        && point_y <= work_y + work_height
}

fn logical_rect_intersects_work_area(
    rect: (f64, f64, f64, f64),
    work_x: f64,
    work_y: f64,
    work_width: f64,
    work_height: f64,
) -> bool {
    let (x, y, width, height) = rect;

    x < work_x + work_width && x + width > work_x && y < work_y + work_height && y + height > work_y
}

/// Whether the overlay rectangle lies on no monitor at all.
///
/// The union bounding box of a staggered multi-monitor layout contains regions
/// that no monitor covers (measured on the reporting machine: two monitors
/// offset vertically leave 18.3% of the box dark). A window parked at stale
/// coordinates inside such a region is not occluded — it is painted nowhere,
/// which is what "the overlay disappears mid-recording" turned out to be.
///
/// Intersection rather than a corner test, so a pill hanging slightly over an
/// edge still counts as on-screen and is left alone.
fn overlay_rect_is_off_all_work_areas<I>(rect: (f64, f64, f64, f64), work_areas: I) -> bool
where
    I: IntoIterator<Item = (f64, f64, f64, f64)>,
{
    let mut saw_work_area = false;

    for (work_x, work_y, work_width, work_height) in work_areas {
        saw_work_area = true;
        if logical_rect_intersects_work_area(rect, work_x, work_y, work_width, work_height) {
            return false;
        }
    }

    // With nothing enumerated there is no evidence either way. Reporting
    // "stranded" would make the overlay fight a topology it cannot see.
    saw_work_area
}

fn logical_point_distance_to_work_area(
    point_x: f64,
    point_y: f64,
    work_x: f64,
    work_y: f64,
    work_width: f64,
    work_height: f64,
) -> f64 {
    let max_x = work_x + work_width;
    let max_y = work_y + work_height;
    let distance_x = if point_x < work_x {
        work_x - point_x
    } else if point_x > max_x {
        point_x - max_x
    } else {
        0.0
    };
    let distance_y = if point_y < work_y {
        work_y - point_y
    } else if point_y > max_y {
        point_y - max_y
    } else {
        0.0
    };

    distance_x.powi(2) + distance_y.powi(2)
}

fn overlay_monitor_id_for_logical_point<I>(
    monitors: I,
    point_x: f64,
    point_y: f64,
) -> Option<String>
where
    I: IntoIterator<Item = (String, (f64, f64, f64, f64))>,
{
    let mut selected: Option<(String, bool, f64)> = None;

    for (id, (work_x, work_y, work_width, work_height)) in monitors {
        let contains =
            logical_point_in_work_area(point_x, point_y, work_x, work_y, work_width, work_height);
        let distance = logical_point_distance_to_work_area(
            point_x,
            point_y,
            work_x,
            work_y,
            work_width,
            work_height,
        );

        let replace = match &selected {
            None => true,
            Some((_, current_contains, current_distance)) => {
                (contains && !current_contains)
                    || (contains == *current_contains && distance < *current_distance)
            }
        };

        if replace {
            selected = Some((id, contains, distance));
        }
    }

    selected.map(|(id, _, _)| id)
}

fn overlay_monitor_id_for_manual_reference<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    reference_x: f64,
    reference_y: f64,
) -> Option<String> {
    let monitors = window.available_monitors().ok()?;
    overlay_monitor_id_for_logical_point(
        monitors.into_iter().map(|monitor| {
            (
                overlay_monitor_id(&monitor),
                overlay_monitor_work_area(&monitor),
            )
        }),
        reference_x,
        reference_y,
    )
}

fn overlay_monitor_id(monitor: &tauri::Monitor) -> String {
    let name = monitor.name().cloned().unwrap_or_default();
    let trimmed = name.trim();
    if !trimmed.is_empty() {
        return format!("name:{trimmed}");
    }

    let work_area = monitor.work_area();
    format!(
        "workarea:{}:{}:{}:{}",
        work_area.position.x, work_area.position.y, work_area.size.width, work_area.size.height,
    )
}

fn overlay_monitor_label(monitor: &tauri::Monitor, index: usize, is_primary: bool) -> String {
    let name = monitor.name().cloned().unwrap_or_default();
    let trimmed = name.trim();
    let base = if trimmed.is_empty() {
        format!("Display {}", index + 1)
    } else {
        trimmed.to_string()
    };

    if is_primary {
        format!("{base} (Primary)")
    } else {
        base
    }
}

fn resolve_overlay_monitor<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    monitor_id: &str,
    config: &AppConfig,
) -> Option<tauri::Monitor> {
    let primary = window.primary_monitor().ok().flatten();
    if monitor_id == "primary" {
        return primary;
    }

    let monitors = window.available_monitors().ok()?;
    let monitors_with_ids: Vec<(String, tauri::Monitor)> = monitors
        .into_iter()
        .map(|monitor| (overlay_monitor_id(&monitor), monitor))
        .collect();

    let chosen_id = resolve_overlay_monitor_id(
        monitors_with_ids
            .iter()
            .map(|(id, monitor)| (id.clone(), overlay_monitor_work_area(monitor))),
        monitor_id,
        config.overlay_position_mode.clone(),
        config.overlay_manual_x as f64,
        config.overlay_manual_y as f64,
    );

    chosen_id
        .and_then(|id| {
            monitors_with_ids
                .into_iter()
                .find(|(candidate, _)| candidate == &id)
        })
        .map(|(_, monitor)| monitor)
        .or(primary)
}

// Pure decision core of [`resolve_overlay_monitor`]: given the available
// monitors (as (id, work-area) pairs), the saved monitor identity, and the
// persisted Manual drag reference, returns the chosen monitor id — or `None`
// to let the caller fall back to primary.
//
// Order: (1) exact identity match (name/work-area fingerprint); (2) on
// identity-miss, rederive by coordinate containment in Manual mode (the saved
// logical drag reference survives a monitor reconnect/sleep/driver re-
// enumeration that invalidated the name); (3) `None` (Preset mode without an
// identity match has no persisted reference point). When the reference lies
// outside every monitor, step (2) picks the nearest one (reusing the already
// tested [`overlay_monitor_id_for_logical_point`]) so the overlay stays close
// to its last position instead of snapping to primary. (plan 1782308448580)
fn resolve_overlay_monitor_id<I>(
    monitors: I,
    saved_monitor_id: &str,
    position_mode: OverlayPositionMode,
    manual_x: f64,
    manual_y: f64,
) -> Option<String>
where
    I: IntoIterator<Item = (String, (f64, f64, f64, f64))>,
{
    let monitors: Vec<(String, (f64, f64, f64, f64))> = monitors.into_iter().collect();

    if let Some((id, _)) = monitors.iter().find(|(id, _)| id == saved_monitor_id) {
        return Some(id.clone());
    }

    if position_mode == OverlayPositionMode::Manual {
        if let Some(redrived) =
            overlay_monitor_id_for_logical_point(monitors.iter().cloned(), manual_x, manual_y)
        {
            return Some(redrived);
        }
    }

    None
}

fn overlay_work_area_for_config<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    config: &AppConfig,
) -> Option<(f64, f64, f64, f64)> {
    let monitor = resolve_overlay_monitor(window, &config.overlay_monitor, config)?;
    Some(overlay_monitor_work_area(&monitor))
}

fn overlay_workspace_bounds<I>(work_areas: I) -> Option<(f64, f64, f64, f64)>
where
    I: IntoIterator<Item = (f64, f64, f64, f64)>,
{
    let mut bounds: Option<(f64, f64, f64, f64)> = None;

    for (work_x, work_y, work_width, work_height) in work_areas {
        let right = work_x + work_width;
        let bottom = work_y + work_height;

        bounds = Some(match bounds {
            Some((min_x, min_y, max_x, max_y)) => (
                min_x.min(work_x),
                min_y.min(work_y),
                max_x.max(right),
                max_y.max(bottom),
            ),
            None => (work_x, work_y, right, bottom),
        });
    }

    bounds
}

fn overlay_current_logical_rect<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Option<(f64, f64, f64, f64)> {
    let scale = window.scale_factor().unwrap_or(1.0).max(1.0);
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;

    Some((
        position.x as f64 / scale,
        position.y as f64 / scale,
        size.width as f64 / scale,
        size.height as f64 / scale,
    ))
}

/// The overlay's rectangle when it currently sits on no monitor, `None` when it
/// is placed normally or cannot be judged.
///
/// This is the recovery trigger for a monitor topology that changed while the
/// overlay was already shown — the one case `reveal_overlay_window_impl` used to
/// have no answer for, because it only ever positioned on hidden→visible.
fn overlay_stranded_rect<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Option<(f64, f64, f64, f64)> {
    let rect = overlay_current_logical_rect(window)?;

    // A zero-area rectangle intersects nothing and would therefore read as
    // stranded, but it carries no information: GTK reports 0x0 for a window
    // that is not realized yet, which happens once at startup. Treating that as
    // evidence produced a spurious reposition before the window even existed.
    let (_, _, width, height) = rect;
    if width <= 0.0 || height <= 0.0 {
        return None;
    }

    let monitors = window.available_monitors().ok()?;

    overlay_rect_is_off_all_work_areas(rect, monitors.iter().map(overlay_monitor_work_area))
        .then_some(rect)
}

fn clamp_overlay_position(
    x: f64,
    y: f64,
    work_x: f64,
    work_y: f64,
    work_width: f64,
    work_height: f64,
    window_width: f64,
    window_height: f64,
) -> LogicalPosition<f64> {
    let clamped_x = x.clamp(work_x, (work_x + work_width - window_width).max(work_x));
    let clamped_y = y.clamp(work_y, (work_y + work_height - window_height).max(work_y));

    LogicalPosition::new(clamped_x.round(), clamped_y.round())
}

fn overlay_target_position<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    config: &AppConfig,
    surface: OverlaySurface,
    height_override: Option<f64>,
    width_override: Option<f64>,
) -> Option<LogicalPosition<f64>> {
    let (work_x, work_y, work_width, work_height) = overlay_work_area_for_config(window, config)?;
    let (default_width, default_height) = surface.dimensions();
    let window_width = width_override.unwrap_or(default_width);
    let window_height = height_override.unwrap_or(default_height);

    match config.overlay_position_mode {
        OverlayPositionMode::Manual => {
            let (surface_x, surface_y) = manual_overlay_surface_position(
                config.overlay_manual_x as f64,
                config.overlay_manual_y as f64,
                surface,
            );

            Some(clamp_overlay_position(
                surface_x,
                surface_y,
                work_x,
                work_y,
                work_width,
                work_height,
                window_width,
                window_height,
            ))
        }
        OverlayPositionMode::Preset => {
            let left = work_x + OVERLAY_SIDE_INSET;
            let centered_x = work_x + ((work_width - window_width) / 2.0).max(0.0);
            let right = work_x + (work_width - window_width - OVERLAY_SIDE_INSET).max(0.0);
            let top = work_y + OVERLAY_TOP_INSET;
            let centered_y = work_y + ((work_height - window_height) / 2.0).max(0.0);
            let bottom = work_y + (work_height - window_height - OVERLAY_BOTTOM_INSET).max(0.0);

            let (x, y) = match config.overlay_anchor {
                OverlayAnchor::TopLeft => (left, top),
                OverlayAnchor::TopCenter => (centered_x, top),
                OverlayAnchor::TopRight => (right, top),
                OverlayAnchor::CenterLeft => (left, centered_y),
                OverlayAnchor::CenterRight => (right, centered_y),
                OverlayAnchor::BottomLeft => (left, bottom),
                OverlayAnchor::BottomCenter => (centered_x, bottom),
                OverlayAnchor::BottomRight => (right, bottom),
            };

            Some(clamp_overlay_position(
                x,
                y,
                work_x,
                work_y,
                work_width,
                work_height,
                window_width,
                window_height,
            ))
        }
    }
}

// D3 (plan 1784412908352): the 1px-height oscillation decision, extracted for
// unit testing. The tick is incremented on EVERY flat reveal (compact /
// processing-preview / result-actions / mode-picker) — NOT just on the
// hidden→visible transition. This is required because a mode-cycle within
// "recording" keeps `pillState.kind === "recording"`, so the React
// `key={pillState.kind}` does NOT remount → no compositor-layer orphaning.
// The oscillation is the only native repaint trigger for these same-kind
// visual changes. The multi-`set_size` cascade is prevented by the D1
// frontend serializer + the D3 Rust coalescing wrapper, which ensure only
// ONE `set_size` per frame. Edit-mode keeps free sizing and never oscillates.
fn should_oscillate_flat_reveal(surface: OverlaySurface, _was_visible: bool) -> bool {
    !matches!(surface, OverlaySurface::EditMode)
}

// Reveals/resizes the overlay window. Two WebKitGTK/Linux constraints shape this:
//   1. After a set_size, WebKitGTK does NOT re-paint the newly exposed area of a
//      transparent window as transparent — it stays black. So the transparent
//      background color must be re-asserted right after every set_size, not just
//      on the first show, otherwise a resize leaves a black bar/block.
//   2. set_position is only applied on the hidden→visible transition. While the
//      window is already visible we never reposition it: a resize (surface
//      change) must keep the window where it is, so a user-dragged overlay does
//      not snap back to its config anchor — which read as a frozen drag.
// set_size itself stays guarded so an unchanged resize stays a no-op.
//
// D3 (plan 1784412908352): the function is split into two entry points that
// share the same `reveal_overlay_window_impl` core:
//   * `reveal_overlay_window` (direct) — synchronous, for the Rust StartCapture
//     trigger. The frontend's reaction-render reveal fires on a later frame
//     (after `recording_started` is processed), so there is no same-frame
//     competition here.
//   * `reveal_overlay_window_coalesced` — for `sync_overlay_window_visibility`
//     (the frontend command). Writes the request into `OVERLAY_PENDING_REVEAL`
//     (last-write-wins) and schedules a single flush on the tokio runtime via
//     a 0-ms sleep. Any other same-frame sync calls overwrite the pending
//     request before the flush runs → exactly one `set_size` per frame.
//
// Tick oscillation: the 1px oscillation (OVERLAY_FLAT_REVEAL_TICK) is
// incremented on EVERY flat reveal, NOT just on the hidden→visible transition.
// This is required because a mode-cycle within "recording" keeps
// `pillState.kind === "recording"`, so the React `key={pillState.kind}` does
// NOT remount → no compositor-layer orphaning → the previous mode's cached
// raster ghosts through. The oscillation forces a genuine `set_size` change →
// backing-store reallocation → full repaint that clears the cached raster.
//
// The multi-`set_size` cascade that caused the ghosting (RC1/RC3) is prevented
// by the D1 frontend `scheduleReveal` serializer + the D3 Rust coalescing
// wrapper: both ensure only ONE `set_size` per frame, so the oscillation
// produces exactly one height per frame instead of 2–3 competing heights that
// WebKitGTK applies out of order.
fn reveal_overlay_window_impl<R: Runtime>(
    app: &AppHandle<R>,
    surface: OverlaySurface,
    height_override: Option<f64>,
    width_override: Option<f64>,
) {
    if let Some(window) = app.get_webview_window("overlay") {
        let config = AppConfig::load_from_disk();
        let (default_width, default_height) = surface.dimensions();
        let window_width = width_override.unwrap_or(default_width);
        let mut window_height = height_override.unwrap_or(default_height);
        let scale = window.scale_factor().unwrap_or(1.0);
        // Authoritative visibility (see OVERLAY_WINDOW_SHOWN) instead of
        // window.is_visible(), which is unreliable on XWayland and caused every
        // reveal to reposition → overlay states jumping between monitors within
        // a session.
        let was_visible = OVERLAY_WINDOW_SHOWN.load(Ordering::Relaxed);

        // Flat-surface backing-store reallocation (see OVERLAY_FLAT_REVEAL_TICK).
        // The tick is incremented on EVERY flat reveal so the 1px oscillation
        // (60↔61) forces a genuine `set_size` change → backing-store
        // reallocation → full repaint that clears retained compositor layers.
        //
        // This is REQUIRED for same-kind visual changes (e.g. mode-cycle within
        // "recording"): `pillState.kind` stays "recording" so the React
        // `key={pillState.kind}` does NOT remount → no compositor-layer
        // orphaning → the previous mode's cached raster ghosts through. The
        // oscillation is the only native repaint trigger for these changes.
        //
        // The multi-`set_size` cascade that caused the ghosting (RC1/RC3) is
        // prevented by the D1 frontend `scheduleReveal` serializer + the D3
        // Rust `reveal_overlay_window_coalesced` wrapper: both ensure only ONE
        // `set_size` per frame, so the oscillation produces exactly one height
        // per frame instead of 2–3 competing heights.
        let is_flat = !matches!(surface, OverlaySurface::EditMode);
        if is_flat {
            let tick = OVERLAY_FLAT_REVEAL_TICK.fetch_add(1, Ordering::Relaxed);
            window_height = default_height + f64::from(tick & 1);
        }

        // force_set_size on flat surfaces: the oscillation alternates 0/1, so
        // the height differs from the PREVIOUS reveal's height even if it
        // matches the current outer_size. Without this, `size_changed` could
        // report false (oscillated height == outer_size) → set_size skipped →
        // no reallocation → ghosting. Edit-mode keeps the outer_size check.
        let force_set_size = is_flat;
        let size_changed = if force_set_size {
            true
        } else {
            window
                .outer_size()
                .map(|current| {
                    let current_width = current.width as f64 / scale;
                    let current_height = current.height as f64 / scale;
                    (current_width - window_width).abs() > 0.5
                        || (current_height - window_height).abs() > 0.5
                })
                .unwrap_or(true)
        };
        // Always re-assert transparency + force a repaint on every reveal. On
        // flat→flat surface transitions WebKitGTK keeps the previous pill's
        // composited layer and renders the new pill on top → stale overlap that
        // only clears after a repaint. Re-asserting the background invalidates
        // the layer; the 1px height oscillation on the first reveal of a
        // session guarantees a real size change (and thus a full backing-store
        // reallocation) on flat surfaces.
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
        if size_changed {
            let _ = window.set_size(LogicalSize::new(window_width, window_height));
            // Pin min=max so the geometry is authoritative. GTK/WebKitGTK can
            // ignore a bare set_size and leave the window stuck at a stale size
            // (observed: req=(388,52) but window stays 256x200). Edit-mode keeps
            // free sizing (user/programmatic resize via resize_edit_overlay).
            if matches!(surface, OverlaySurface::EditMode) {
                let _ = window.set_min_size(None::<LogicalSize<f64>>);
                let _ = window.set_max_size(None::<LogicalSize<f64>>);
            } else {
                let _ = window.set_min_size(Some(LogicalSize::new(window_width, window_height)));
                let _ = window.set_max_size(Some(LogicalSize::new(window_width, window_height)));
            }
            // Re-assert transparency: WebKitGTK leaves the resized backing opaque/black.
            let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
            #[cfg(debug_assertions)]
            {
                let outer = window
                    .outer_size()
                    .map(|s| (s.width as f64 / scale, s.height as f64 / scale));
                let inner = window
                    .inner_size()
                    .map(|s| (s.width as f64 / scale, s.height as f64 / scale));
                eprintln!(
                    "[ov-reveal] req=({window_width:.0},{window_height:.0}) scale={scale:.2} outer={outer:?} inner={inner:?}"
                );
                let _ = app.emit(
                    "ov-reveal-debug",
                    serde_json::json!({
                        "req": [window_width as i32, window_height as i32],
                        "outer": outer.ok().map(|(w, h)| [w as i32, h as i32]),
                        "inner": inner.ok().map(|(w, h)| [w as i32, h as i32]),
                    }),
                );
            }
        } else if !was_visible {
            let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
        }

        // Position on the hidden→visible transition, and additionally whenever
        // the window is shown but currently lies on no monitor at all.
        //
        // The bare `!was_visible` gate exists to protect a dragged position from
        // being snapped back by an in-place resize. It also meant that a
        // monitor topology change during an active session was never answered:
        // the window kept stale coordinates for the rest of the session, and in
        // a staggered layout those coordinates can fall into the dark part of
        // the union bounding box. The overlay was then painted nowhere while
        // the capture kept running, and only the park→reveal cycle at session
        // end recomputed a valid position — which is why pressing stop appeared
        // to "bring it back".
        //
        // Rescuing a stranded window cannot conflict with the drag protection:
        // a position that intersects no work area is not a position the user
        // chose. See ADR 0022.
        let stranded_rect = if was_visible {
            overlay_stranded_rect(&window)
        } else {
            None
        };
        if let Some((x, y, width, height)) = stranded_rect {
            core::runtime_log::record(format!(
                "[WordScript] Overlay stranded off every work area surface={surface:?} rect=({x:.0},{y:.0},{width:.0}x{height:.0}) — repositioning"
            ));
        }

        if !was_visible || stranded_rect.is_some() {
            // Claim the hidden→visible transition IMMEDIATELY so a concurrent
            // `reveal_overlay_window` call (the Rust trigger via
            // `apply_trigger_effect` and the frontend
            // `sync_overlay_window_visibility` arriving in the same instant)
            // does not both read `was_visible=false` and both call
            // set_position + show. This closes the race that caused two
            // overlapping set_position calls and inconsistent final placement.
            OVERLAY_WINDOW_SHOWN.store(true, Ordering::Relaxed);

            let target = overlay_target_position(&window, &config, surface, height_override, width_override);
            // One line per placement decision, not per reveal: the size and
            // repaint reveals that dominate a session carry no placement and
            // would drown the signal. Without this the runtime log had no
            // notion of the overlay layer at all — 755 captures, zero lines —
            // so a misplacement could not be seen after the fact.
            core::runtime_log::record(format!(
                "[WordScript] Overlay placement surface={surface:?} was_visible={was_visible} reason={} monitor={} work_area={:?} target={}",
                if stranded_rect.is_some() { "stranded" } else { "reveal" },
                resolve_overlay_monitor(&window, &config.overlay_monitor, &config)
                    .map(|monitor| overlay_monitor_id(&monitor))
                    .unwrap_or_else(|| "none".to_string()),
                overlay_work_area_for_config(&window, &config),
                target
                    .map(|position| format!("({:.0},{:.0})", position.x, position.y))
                    .unwrap_or_else(|| "none".to_string()),
            ));

            if let Some(position) = target {
                let _ = window.set_position(position);
                let _ = window.show();
                // Re-apply position AFTER show() on ALL platforms. On Windows,
                // ShowWindow can discard a position set on a hidden window.
                // On XWayland/GTK, `gtk_widget_show` can similarly restore the
                // window to its pre-hide position (the offscreen park spot),
                // discarding the `set_position` made while hidden. Re-applying
                // after show() ensures the overlay lands at the saved drag
                // position everywhere.
                let _ = window.set_position(position);
            } else {
                let _ = window.show();
            }
        }
    }
}

// Direct (synchronous) reveal entry point. Used by the Rust StartCapture
// trigger, where the frontend's reaction-render reveal fires on a later frame
// and there is no same-frame competition to coalesce.
fn reveal_overlay_window<R: Runtime>(
    app: &AppHandle<R>,
    surface: OverlaySurface,
    height_override: Option<f64>,
    width_override: Option<f64>,
) {
    reveal_overlay_window_impl(app, surface, height_override, width_override);
}

// Coalesced reveal entry point for `sync_overlay_window_visibility`. Writes
// the request into `OVERLAY_PENDING_REVEAL` (last-write-wins) and schedules a
// single flush on the tokio runtime. Any other same-frame sync calls
// overwrite the pending request before the flush runs → exactly one
// `set_size` per frame. The flush resets `OVERLAY_REVEAL_SCHEDULED` so the
// next frame can schedule a fresh flush.
fn reveal_overlay_window_coalesced<R: Runtime + 'static>(
    app: &AppHandle<R>,
    surface: OverlaySurface,
    height_override: Option<f64>,
    width_override: Option<f64>,
) {
    {
        let mut pending = OVERLAY_PENDING_REVEAL
            .lock()
            .expect("OVERLAY_PENDING_REVEAL poisoned");
        *pending = Some((surface, height_override, width_override));
    }
    if OVERLAY_REVEAL_SCHEDULED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        // A flush is already scheduled; the updated pending request above will
        // be picked up by that flush (last-write-wins).
        return;
    }
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        // Yield to the event loop so any other same-frame sync calls land in
        // OVERLAY_PENDING_REVEAL before we read it. A 0-ms sleep is the
        // coalescing window — at typical mode-change load (<5 reveals/s) the
        // added latency is <16ms (R3).
        tokio::time::sleep(Duration::from_millis(0)).await;
        OVERLAY_REVEAL_SCHEDULED.store(false, Ordering::SeqCst);
        let pending = OVERLAY_PENDING_REVEAL
            .lock()
            .expect("OVERLAY_PENDING_REVEAL poisoned")
            .take();
        if let Some((surface, height_override, width_override)) = pending {
            reveal_overlay_window_impl(&app_clone, surface, height_override, width_override);
        }
    });
}

fn park_overlay_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("overlay") {
        let (window_width, window_height) = OverlaySurface::Compact.dimensions();
        let _ = window.set_size(LogicalSize::new(window_width, window_height));
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
        // The park position is a request, not a guarantee. X11/KWin refuses to
        // place a window fully outside the screen and clamps it back to the
        // edge of the union bounding box: measured on the reporting machine,
        // (4392,1640) was requested and (3840,1508) applied. Parking is
        // therefore carried by `hide()` below, not by the move — the move only
        // helps on compositors that honour it. Both are kept because `hide()`
        // alone has been unreliable enough on XWayland to warrant the belt.
        //
        // The consequence is recorded so it stays visible rather than being
        // rediscovered: on a layout whose bottom-right corner lies on a
        // monitor, a parked-but-not-hidden pill is visible there.
        let requested = overlay_offscreen_position(&window);
        if let Some(position) = requested {
            let _ = window.set_position(position);
        }
        // Read back before hiding: GTK does not move a hidden window, so a
        // position sampled after `hide()` reports the pre-park coordinates and
        // would make the log claim something it did not measure.
        let applied = overlay_current_logical_rect(&window).map(|(x, y, _, _)| (x, y));

        // Hide so the next reveal() runs the hidden→visible branch (which sets
        // the position). Without this the window stays visible-but-offscreen
        // after parking, and reveal's "only set_position on hidden→visible"
        // guard (drag-snap protection) skips re-positioning — the overlay then
        // vanishes from the 2nd transcription onward.
        let _ = window.hide();

        core::runtime_log::record(format!(
            "[WordScript] Overlay parked requested={} applied={}",
            requested
                .map(|position| format!("({:.0},{:.0})", position.x, position.y))
                .unwrap_or_else(|| "none".to_string()),
            applied
                .map(|(x, y)| format!("({x:.0},{y:.0})"))
                .unwrap_or_else(|| "unknown".to_string()),
        ));

        // Clear authoritative visibility so the next reveal repositions + shows.
        OVERLAY_WINDOW_SHOWN.store(false, Ordering::Relaxed);
    }
}

fn overlay_offscreen_position<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Option<LogicalPosition<f64>> {
    let monitors = window.available_monitors().ok().unwrap_or_default();
    let bounds = overlay_workspace_bounds(
        monitors
            .into_iter()
            .map(|monitor| overlay_monitor_work_area(&monitor)),
    )
    .or_else(|| {
        window.current_monitor().ok().flatten().map(|monitor| {
            let (work_x, work_y, work_width, work_height) = overlay_monitor_work_area(&monitor);
            (work_x, work_y, work_x + work_width, work_y + work_height)
        })
    })
    .or_else(|| {
        window.primary_monitor().ok().flatten().map(|monitor| {
            let (work_x, work_y, work_width, work_height) = overlay_monitor_work_area(&monitor);
            (work_x, work_y, work_x + work_width, work_y + work_height)
        })
    })?;

    let (_, _, max_x, max_y) = bounds;
    Some(LogicalPosition::new(
        (max_x + OVERLAY_PARK_MARGIN).round(),
        (max_y + OVERLAY_PARK_MARGIN).round(),
    ))
}

/// Put the overlay back on a monitor if it is currently on none.
///
/// A reveal answers this for every surface change, but a long recording has no
/// surface changes at all — the pill just sits there for a minute. That is
/// exactly the window in which a monitor reconfiguration strands it, and
/// nothing would notice until the session ended. Driven from the existing
/// capture monitor loop rather than a new timer.
///
/// Deliberately cheap in the common case: the monitor query runs on a slow
/// cadence (see `OVERLAY_STRANDED_CHECK_INTERVAL_TICKS`) and the config is only
/// read from disk once a rescue is actually needed.
fn ensure_overlay_on_screen<R: Runtime>(app: &AppHandle<R>) {
    if !OVERLAY_WINDOW_SHOWN.load(Ordering::Relaxed) {
        return;
    }

    let Some(window) = app.get_webview_window("overlay") else {
        return;
    };
    let Some((x, y, width, height)) = overlay_stranded_rect(&window) else {
        return;
    };

    core::runtime_log::record(format!(
        "[WordScript] Overlay stranded mid-session rect=({x:.0},{y:.0},{width:.0}x{height:.0}) — repositioning"
    ));

    // Compact is the surface a capture is showing, and it is the right one to
    // ask for regardless: `manual_overlay_surface_position` ignores the surface,
    // and every flat surface shares one size.
    let config = AppConfig::load_from_disk();
    if let Some(position) =
        overlay_target_position(&window, &config, OverlaySurface::Compact, None, None)
    {
        let _ = window.set_position(position);
    }
}

#[tauri::command]
async fn overlay_monitor_options(app: AppHandle) -> Result<Vec<OverlayMonitorOption>, String> {
    let window = app
        .get_webview_window("overlay")
        .or_else(|| app.get_webview_window("settings"))
        .ok_or_else(|| "Overlay window is not configured.".to_string())?;

    let primary_id = window
        .primary_monitor()
        .map_err(|error| format!("Could not read the primary monitor: {error}"))?
        .map(|monitor| overlay_monitor_id(&monitor));

    let monitors = window
        .available_monitors()
        .map_err(|error| format!("Could not list monitors: {error}"))?;

    Ok(monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let id = overlay_monitor_id(monitor);
            let is_primary = primary_id.as_ref().is_some_and(|current| current == &id);
            OverlayMonitorOption {
                id,
                label: overlay_monitor_label(monitor, index, is_primary),
                is_primary,
            }
        })
        .collect())
}

fn reveal_settings_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn reveal_rebuild_lab_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("rebuild-lab") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn install_hide_on_close<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_clone.hide();
            restore_shortcuts_after_recording(&window_clone.app_handle().clone());
        }
    });
}

/// Guaranteed restore of the OS grabs a shortcut recorder released (T4).
///
/// The recorder resumes them itself on confirm, cancel and blur, but a window
/// that is closed or hidden mid-recording would otherwise leave the whole lane
/// ungrabbed — dictation would silently stop working until the next restart.
fn restore_shortcuts_after_recording<R: Runtime>(app: &AppHandle<R>) {
    let Some(state) = app.try_state::<Mutex<NativeTriggerState>>() else {
        return;
    };

    if let Err(error) = core::trigger::resume_native_shortcuts(app, state.inner()) {
        core::runtime_log::record(format!(
            "[WordScript] Could not restore shortcuts after the settings window closed: {error}"
        ));
    }
}

pub(crate) fn apply_trigger_effect<R: Runtime>(app: &AppHandle<R>, effect: TriggerEffect) {
    match effect {
        TriggerEffect::StartCapture => match core::capture::start_native_capture(app) {
            Ok(status) => {
                reveal_overlay_window(app, OverlaySurface::Compact, None, None);
                core::sound::play_if_enabled(core::sound::SoundCue::Listen);
                if let Some(capture_id) = status.active_capture_id {
                    spawn_native_capture_monitor(app.clone(), capture_id);
                }
            }
            Err(error) => {
                core::sound::play_if_enabled(core::sound::SoundCue::Error);
                core::sessions::fail_from_native_error(app, &error);
                let _ = app.emit(
                    "wordscript-event",
                    serde_json::json!({
                        "event": "error",
                        "message": error
                    }),
                );
            }
        },
        TriggerEffect::StopCapture { session_id } => finalize_native_capture_stop(app, session_id),
        TriggerEffect::TogglePause => {
            if let Err(error) = core::capture::toggle_native_capture_pause_for_app(app) {
                if error != "No native capture is active." {
                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                    core::sessions::fail_from_native_error(app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
            }
        }
        TriggerEffect::AbortCapture => {
            // The abort cue only reports an abort that actually happened. A
            // failed abort is an error, and firing both cues told the user two
            // contradictory things about one action.
            match core::capture::abort_native_capture(app) {
                Ok(()) => core::sound::play_if_enabled(core::sound::SoundCue::Abort),
                Err(error) => {
                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                    core::sessions::fail_from_native_error(app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
            }
        }
        TriggerEffect::StartCaptureProvisional { hold_session } => {
            // Open the microphone, announce nothing. No session event, no
            // overlay, no cue — until the hold clears the threshold this press
            // has no user-visible consequence, so a stray brush of the key
            // leaves nothing to explain or undo (ADR 0013). The audio is
            // already being kept, which is why committing later loses no word.
            match core::capture::start_native_capture(app) {
                Ok(status) => {
                    // The monitor watches the stream, not the session, so it
                    // starts with the stream. A provisional capture that is
                    // somehow never resolved would otherwise hold the
                    // microphone open with nothing supervising it.
                    if let Some(capture_id) = status.active_capture_id {
                        spawn_native_capture_monitor(app.clone(), capture_id);
                    }
                    let delay_ms = core::trigger::hold_arm_ms(app);
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                        if let Some(effect) = core::trigger::resolve_hold_arm(&app, hold_session) {
                            apply_trigger_effect(&app, effect);
                        }
                    });
                }
                Err(error) => {
                    // The hold is over before it began — without this the arm
                    // timer would commit a session with no audio behind it.
                    core::trigger::cancel_hold_in_flight(app);

                    // A capture that is still active belongs to the previous
                    // hold and is on its way out. That is a race between two
                    // presses, not something the user did or can fix, so it is
                    // logged rather than raised as a failed session. A
                    // microphone that will not open for any other reason is
                    // reported immediately, below the threshold as well —
                    // staying silent there would turn a broken device into a
                    // shortcut that looks dead.
                    if error == "A native audio capture is already active." {
                        core::runtime_log::record(format!(
                            "[WordScript] Provisional hold start raced a capture still shutting down: {error}"
                        ));
                        return;
                    }

                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                    core::sessions::fail_from_native_error(app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
            }
        }
        TriggerEffect::CommitHold { .. } => {
            // The hold earned its session. This is the single point where it
            // becomes real to the user, so the listen cue is anchored here and
            // nowhere else (ADR 0012).
            match core::sessions::start_from_native(app, "native_hold_hotkey") {
                Ok(_) => {
                    // The monitor is already running from the provisional
                    // start; this step only makes the hold visible.
                    reveal_overlay_window(app, OverlaySurface::Compact, None, None);
                    core::sound::play_if_enabled(core::sound::SoundCue::Listen);
                }
                Err(error) => {
                    // The session refused the commit — the previous one is
                    // still running or processing. Give the microphone back and
                    // drop the hold instead of leaving a stream open that
                    // belongs to nothing.
                    let _ = core::capture::abort_native_capture(app);
                    core::trigger::cancel_hold_in_flight(app);
                    core::runtime_log::record(format!(
                        "[WordScript] Hold commit refused by the session state: {error}"
                    ));
                }
            }
        }
        TriggerEffect::DiscardProvisional => {
            // No abort cue and no error: nothing was ever announced, so there
            // is nothing to retract. A failure to release the device is still
            // a real failure and stays in the log.
            if let Err(error) = core::capture::abort_native_capture(app) {
                if error != "No native capture is active." {
                    core::runtime_log::record(format!(
                        "[WordScript] Discarding a provisional hold failed: {error}"
                    ));
                }
            }
        }
        TriggerEffect::DeferredHoldAction {
            hold_action,
            arm_generation,
        } => {
            let delay_ms = core::trigger::hold_arm_ms(app);
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                if let Some(effect) =
                    core::trigger::resolve_hold_action(&app, hold_action, arm_generation)
                {
                    apply_trigger_effect(&app, effect);
                }
            });
        }
        TriggerEffect::ModeSelect => {
            // Emit a toggle signal. The frontend owns the overlay visibility +
            // positioning — it decides: if the mode-select surface is closed
            // → open it (via its own isActive/sync_overlay_window_visibility
            // path, which respects the saved manual position); if open →
            // cycle to the next mode (persistently). Rust does NOT reveal the
            // window directly here to avoid racing the frontend's own
            // visibility state machine (which would park the overlay again
            // before the React listener processes the event).
            let _ = app.emit(
                "wordscript-mode-select",
                serde_json::json!({ "event": "toggle" }),
            );
        }
        TriggerEffect::SetModeDirect(mode) => {
            if let Err(error) = core::mode_router::set_mode_and_emit(app, mode) {
                core::runtime_log::record(format!(
                    "[WordScript] Per-mode hotkey failed: {error}"
                ));
                return;
            }

            // A direct jump changed the mode but showed nothing, so the
            // shortcut looked dead even though the runtime had done its work.
            // Reveal the mode-select surface so the new mode is confirmed on
            // screen, exactly like the select shortcut does — `show` opens it
            // without cycling, so the mode stays the one the user asked for.
            // Visibility stays frontend-owned (same rationale as ModeSelect).
            let _ = app.emit(
                "wordscript-mode-select",
                serde_json::json!({ "event": "show" }),
            );
        }
    }
}

fn finalize_native_capture_stop<R: Runtime + 'static>(app: &AppHandle<R>, session_id: String) {
    // Handoff is played AFTER the capture teardown and only on the branch that
    // actually hands work to the pipeline. Playing it first meant an empty
    // capture or a failed stop announced work in progress and then immediately
    // contradicted itself with Error, and it put the cue into the same instant
    // in which the cpal input stream is torn down.
    match core::capture::stop_native_capture(app) {
        Ok(core::capture::CaptureOutcome::Ready(value)) => {
            core::sound::play_if_enabled(core::sound::SoundCue::Handoff);
            handle_audio_ready(app.clone(), value, session_id)
        }
        Ok(core::capture::CaptureOutcome::Empty(level)) => {
            // An empty capture used to end here with a fixed sentence, so a
            // microphone whose input level never cleared the speech threshold
            // was indistinguishable from a user who said nothing.
            let message = level.message();
            match core::sessions::empty_processing_session_from_native(
                app,
                &session_id,
                &message,
            ) {
                Ok(true) => {
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "empty",
                            "message": message,
                            "input_level": level
                        }),
                    );
                }
                Ok(false) => log_stale_pipeline_result(app, &session_id, "empty_capture"),
                Err(error) => {
                    core::sessions::fail_from_native_error(app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
            }
        }
        Err(error) => {
            core::sound::play_if_enabled(core::sound::SoundCue::Error);
            match core::sessions::fail_processing_session_from_native_error(
                app,
                &session_id,
                &error,
            ) {
                Ok(true) => {
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
                Ok(false) => log_stale_pipeline_result(app, &session_id, "capture_stop_error"),
                Err(gate_error) => {
                    core::sessions::fail_from_native_error(app, &gate_error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": gate_error
                        }),
                    );
                }
            }
        }
    }
}

fn stop_native_capture_after_stream_error<R: Runtime + 'static>(
    app: &AppHandle<R>,
    capture_id: &str,
) {
    let reason = core::capture::NativeCaptureStopReason::StreamError;
    let status = match core::sessions::processing_from_native(app) {
        Ok(status) => status,
        Err(error) => {
            core::runtime_log::record(format!(
                "[WordScript] Could not move native capture to processing after rebuild failure (capture_id={capture_id}): {error}"
            ));
            return;
        }
    };
    let Some(session_id) = status.active_session_id else {
        core::runtime_log::record(format!(
            "[WordScript] Autostop after rebuild failure entered processing without an active session id (capture_id={capture_id})"
        ));
        return;
    };
    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({
            "event": "recording_stopped",
            "reason": reason.message(),
        }),
    );
    finalize_native_capture_stop(app, session_id);
}

fn spawn_native_capture_monitor<R: Runtime + 'static>(app: AppHandle<R>, capture_id: String) {
    tauri::async_runtime::spawn(async move {
        let mut tick: u32 = 0;
        loop {
            tokio::time::sleep(Duration::from_millis(200)).await;

            // Monitor enumeration is an X11/compositor round trip, and this
            // loop is the hot path of an active recording — the one place where
            // added main-thread work is least welcome. A stranded overlay is
            // rare and a two-second detection latency for it is unnoticeable,
            // so the check runs on its own slow cadence.
            tick = tick.wrapping_add(1);
            if tick % OVERLAY_STRANDED_CHECK_INTERVAL_TICKS == 0 {
                ensure_overlay_on_screen(&app);
            }

            match core::capture::monitor_native_capture(&app, &capture_id) {
                Ok(core::capture::NativeCaptureMonitorState::Continue) => continue,
                Ok(core::capture::NativeCaptureMonitorState::Finished) => return,
                Ok(core::capture::NativeCaptureMonitorState::RebuildEligible) => {
                    match core::capture::rebuild_stream_after_error(&app, &capture_id) {
                        Ok(core::capture::RebuildOutcome::Rebuilt) => continue,
                        Ok(_) => {
                            stop_native_capture_after_stream_error(&app, &capture_id);
                            return;
                        }
                        Err(error) => {
                            core::runtime_log::record(format!(
                                "[WordScript] rebuild_stream_after_error returned error: {error}"
                            ));
                            stop_native_capture_after_stream_error(&app, &capture_id);
                            return;
                        }
                    }
                }
                Ok(core::capture::NativeCaptureMonitorState::Stop(reason)) => {
                    let status = match core::sessions::processing_from_native(&app) {
                        Ok(status) => status,
                        Err(error) => {
                            core::runtime_log::record(format!(
                                "[WordScript] Could not move native capture to processing during autostop: {error}"
                            ));
                            // There is no session to carry this capture, so
                            // returning here would leave the microphone open
                            // with nothing left to close it.
                            let _ = core::capture::abort_native_capture(&app);
                            core::trigger::cancel_hold_in_flight(&app);
                            return;
                        }
                    };
                    let Some(session_id) = status.active_session_id else {
                        core::runtime_log::record(
                            "[WordScript] Autostop entered processing without an active session id"
                                .to_string(),
                        );
                        return;
                    };
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "recording_stopped",
                            "reason": reason.message(),
                        }),
                    );
                    finalize_native_capture_stop(&app, session_id);
                    return;
                }
                Err(error) => {
                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                    core::sessions::fail_from_native_error(&app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                    return;
                }
            }
        }
    });
}

fn handle_audio_ready<R: Runtime + 'static>(
    app: AppHandle<R>,
    value: serde_json::Value,
    session_id: String,
) {
    let pipeline_started_at = std::time::Instant::now();
    let payload = match serde_json::from_value::<core::capture::AudioReadyEvent>(value) {
        Ok(payload) if !payload.audio_path.trim().is_empty() => payload,
        outcome => {
            let message = match outcome {
                Err(error) => {
                    format!("Capture pipeline produced an unreadable result: {error}")
                }
                _ => "Capture pipeline did not provide an audio path.".to_string(),
            };
            match core::sessions::fail_processing_session_from_native_error(
                &app,
                &session_id,
                &message,
            ) {
                Ok(true) => {
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": message
                        }),
                    );
                }
                Ok(false) => log_stale_pipeline_result(&app, &session_id, "missing_audio_path"),
                Err(error) => {
                    core::sessions::fail_from_native_error(&app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
            }
            return;
        }
    };

    let audio_path = payload.audio_path.trim().to_string();
    let audio_duration_seconds = Some(payload.audio_duration_seconds);
    let transcription_timeout_ms = runtime_transcription_timeout_ms(audio_duration_seconds);
    let request = payload
        .config
        .resolve_transcription_request(&audio_path, transcription_timeout_ms);
    let provider = request.provider.clone();
    let requested_model = request.model.clone();
    let requested_language = request.language.clone();
    // Seeded from the profile's stored mode. The effective mode is not known
    // until the transcript exists (an override or Auto resolution can differ),
    // so the pipeline re-applies the preset before transforming — see
    // `apply_preset` below.
    let transform_config = core::transform::NativeTransformConfig::from_capture_config(
        &payload.config,
        payload.config.work_mode.processing_mode.transform_preset(),
    );

    core::runtime_log::record(format!(
        "[WordScript] Native pipeline start session_id={} audio_path={} audio_duration_seconds={:?} transcription_timeout_ms={} stored_mode={}",
        session_id,
        audio_path,
        audio_duration_seconds,
        transcription_timeout_ms,
        payload.config.work_mode.processing_mode.as_str(),
    ));

    tauri::async_runtime::spawn(async move {
        let cleanup_path = audio_path.clone();
        // Set only where a failure leaves something worth retrying from. Every
        // other path — success, empty result, stale session, abort — still
        // deletes, so the kept files are exactly the recoverable ones.
        let mut keep_audio = false;
        if !processing_session_still_current(&app, &session_id, "pipeline_start") {
            let _ = tokio::fs::remove_file(cleanup_path).await;
            return;
        }

        let watchdog_app = app.clone();
        let watchdog_session_id = session_id.to_string();
        // Derived from the same audio the provider call is derived from, so the
        // watchdog always outlasts every attempt it supervises. It was a fixed
        // 120 s: on a long capture it fired while the request was still
        // legitimately running and reported a hang that was really progress.
        let watchdog_deadline = core::capture_budget::pipeline_deadline(audio_duration_seconds);
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(watchdog_deadline).await;
            if core::sessions::is_processing_session_current(&watchdog_app, &watchdog_session_id) {
                let deadline_secs = watchdog_deadline.as_secs();
                let message = format!(
                    "The transcription pipeline did not complete within {}s and was cancelled. Restart the session or try again.",
                    deadline_secs
                );
                core::runtime_log::record(format!(
                    "[WordScript] Native pipeline watchdog timeout session_id={} deadline_secs={}",
                    watchdog_session_id, deadline_secs
                ));
                core::sound::play_if_enabled(core::sound::SoundCue::Error);
                if matches!(
                    core::sessions::fail_processing_session_from_native_error(
                        &watchdog_app,
                        &watchdog_session_id,
                        &message,
                    ),
                    Ok(true)
                ) {
                    let _ = watchdog_app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": message
                        }),
                    );
                }
            }
        });

        let pipeline_app_config = core::config::AppConfig::load_from_disk();
        let transcription = core::providers::transcribe_audio_file(request).await;

        match transcription {
            Ok(response) => {
                if !processing_session_still_current(&app, &session_id, "transcription_ready") {
                    let _ = tokio::fs::remove_file(cleanup_path).await;
                    return;
                }

                let (response, low_confidence_segments) = apply_confidence_gate(response);

                core::runtime_log::record(format!(
                    "[WordScript] Native pipeline transcription ready elapsed_ms={} text_len={} provider_duration={:?}",
                    pipeline_started_at.elapsed().as_millis(),
                    response.text.len(),
                    response.duration,
                ));
                // The mode leaves this block with the text: the history record
                // states what ran rather than what the profile was set to, and
                // the transcript file states the same (ADR 0074, ADR 0075).
                let (transformed, effective_mode) = {
                    let app_config = pipeline_app_config.clone();
                    let active_profile = app_config
                        .text_profiles
                        .iter()
                        .find(|p| p.id == app_config.active_text_profile_id);

                    // Resolve the effective processing mode. The active
                    // profile's work_mode is the only source (the Modes tab and
                    // every hotkey write into it). The global
                    // config.processing_mode is a serde fallback for
                    // pre-migration configs. `pipeline_app_config` is loaded
                    // after the recording ends, so a mode changed mid-recording
                    // is already on disk here.
                    let profile_mode = active_profile
                        .map(|p| p.work_mode.effective_processing_mode())
                        .unwrap_or_else(|| app_config.processing_mode.clone());
                    let resolved = core::mode_router::resolve_processing_mode(profile_mode);
                    // From the capture snapshot, not from disk. Both are
                    // per-profile controls the user can edit mid-recording, and
                    // the session belongs to the profile as it was when the
                    // recording started — the same rule the profile text,
                    // dictionary and snippets already followed (ADR 0025).
                    let agent_name = transform_config.agent_name.clone();
                    let communication_style = transform_config.style.clone();

                    // Workspace context is detected at most once per session and
                    // then reused by every branch. It used to be detected twice on
                    // two different paths, and gated on the global toggle while
                    // the UI wrote a per-profile one.
                    let workspace_context =
                        if app_config.active_text_profile_collect_workspace_context() {
                            tauri::async_runtime::spawn_blocking(
                                core::workspace_context::detect_active_app,
                            )
                            .await
                            .ok()
                        } else {
                            None
                        };

                    // Auto resolves to exactly one concrete mode, here and nowhere
                    // else. The classifier is consulted only when the deterministic
                    // pass cannot decide, and only once — a concrete mode is never
                    // re-decided further down. See ADR 0020.
                    let mut auto_signal = "concrete";
                    let mut effective_mode = resolved.mode;
                    if effective_mode.is_auto() {
                        let workspace_category = workspace_context
                            .as_ref()
                            .map(|context| context.category.as_str())
                            .filter(|category| !category.is_empty());

                        match core::mode_router::resolve_auto_mode(
                            &response.text,
                            workspace_category,
                            &agent_name,
                        ) {
                            core::mode_router::AutoRoute::Decided { mode, signal } => {
                                effective_mode = mode;
                                auto_signal = signal;
                            }
                            core::mode_router::AutoRoute::NeedsClassifier => {
                                let classifier_config = core::agent::AgentConfig {
                                    provider: transform_config.provider.clone(),
                                    agent_name: agent_name.clone(),
                                    agent_model: if transform_config.provider
                                        == core::providers::LOCAL_PREVIEW_PROVIDER_ID
                                    {
                                        app_config.local_agent_model.clone()
                                    } else {
                                        app_config.agent_model.clone()
                                    },
                                    ..Default::default()
                                };
                                let is_instruction = core::agent::detect_agent_intent(
                                    &response.text,
                                    &classifier_config,
                                )
                                .await;
                                effective_mode = if is_instruction {
                                    core::config::ProcessingMode::Agent
                                } else {
                                    core::config::ProcessingMode::Cleanup
                                };
                                auto_signal = if is_instruction {
                                    "classifier_agent"
                                } else {
                                    "classifier_dictation"
                                };
                            }
                        }
                    }

                    core::runtime_log::record(format!(
                        "[WordScript] Processing mode resolved effective={} auto_detected={} signal={} workspace_context={}",
                        effective_mode.as_str(),
                        resolved.auto_detected,
                        auto_signal,
                        workspace_context
                            .as_ref()
                            .map(|context| context.category.as_str())
                            .unwrap_or("off"),
                    ));

                    // One assignment, derived from the effective mode. Every mode
                    // gets a defined preset instead of inheriting whatever the
                    // capture config was loaded with.
                    let mut mode_transform_config = transform_config.clone();
                    mode_transform_config.low_confidence_segments = low_confidence_segments;
                    mode_transform_config.apply_preset(effective_mode.transform_preset());
                    mode_transform_config.workspace_hint = workspace_context.clone();
                    mode_transform_config.style = communication_style.clone();

                    // One dispatch, shared with the history retry (ADR 0075).
                    // It used to stand here inline, which is why a retry could
                    // not route by mode: the only implementation of "which
                    // transform does this mode run" was inside this closure.
                    let raw_transform = core::mode_router::apply_mode_transform(
                        &response.text,
                        &effective_mode,
                        &mode_transform_config,
                        &app_config,
                        active_profile,
                    )
                    .await;

                    // The single exit. Every mode's result passes through the
                    // profile's dictionary and snippets here, so no branch can
                    // bypass them — Agent and Prompt Enhance did exactly that
                    // while this call lived inside `apply_native_transform`.
                    (
                        core::transform::finalize_with_text_rules(
                            raw_transform,
                            &mode_transform_config,
                        ),
                        effective_mode,
                    )
                };
                let app_config = pipeline_app_config.clone();
                if let Some(warning) = &transformed.warning {
                    core::runtime_log::record(format!(
                        "[WordScript] Native transform warning: {warning}"
                    ));
                }

                core::runtime_log::record(format!(
                    "[WordScript] Native pipeline transform done elapsed_ms={} corrected={} output_len={} rules={}",
                    pipeline_started_at.elapsed().as_millis(),
                    transformed.corrected,
                    transformed.text.len(),
                    transformed.applied_rules.join(","),
                ));

                if !processing_session_still_current(&app, &session_id, "transform_done") {
                    let _ = tokio::fs::remove_file(cleanup_path).await;
                    return;
                }

                let text = transformed.text.trim().to_string();
                if text.is_empty() {
                    let _ = core::history::record_empty_result(
                        &app_config,
                        response.text.clone(),
                        transformed,
                        Some(effective_mode.clone()),
                    );
                    core::runtime_log::record(format!(
                        "[WordScript] Native pipeline empty result elapsed_ms={}",
                        pipeline_started_at.elapsed().as_millis(),
                    ));
                    match core::sessions::empty_processing_session_from_native(
                        &app,
                        &session_id,
                        "No speech detected in recording.",
                    ) {
                        Ok(true) => {
                            let _ = app
                                .emit("wordscript-event", serde_json::json!({ "event": "empty" }));
                        }
                        Ok(false) => {
                            log_stale_pipeline_result(&app, &session_id, "empty_transform")
                        }
                        Err(error) => {
                            core::sessions::fail_from_native_error(&app, &error);
                            let _ = app.emit(
                                "wordscript-event",
                                serde_json::json!({
                                    "event": "error",
                                    "message": error
                                }),
                            );
                        }
                    }
                } else {
                    if !app_config.active_text_profile_auto_paste() {
                        match core::sessions::stage_pending_transcription_preview(
                            &app,
                            app_config.clone(),
                            provider.clone(),
                            response.text.clone(),
                            transformed.clone(),
                            Some(effective_mode.clone()),
                        ) {
                            Ok(preview) => {
                                core::runtime_log::record(format!(
                                    "[WordScript] Native pipeline preview ready session_id={} elapsed_ms={} delivery=clipboard_only",
                                    session_id,
                                    pipeline_started_at.elapsed().as_millis(),
                                ));
                                let _ = app.emit(
                                    "wordscript-event",
                                    serde_json::json!({
                                        "event": "preview_ready",
                                        "text": preview.text,
                                        "corrected": preview.corrected,
                                        "provider": preview.provider,
                                        "active_profile": preview.active_profile,
                                        "work_mode": preview.work_mode,
                                        "raw_text": preview.raw_text,
                                        "transform": {
                                            "applied_rules": preview.transform.applied_rules,
                                            "warning": preview.transform.warning,
                                        }
                                    }),
                                );
                            }
                            Err(error) => {
                                core::sessions::fail_from_native_error(&app, &error);
                                let _ = app.emit(
                                    "wordscript-event",
                                    serde_json::json!({
                                        "event": "error",
                                        "message": error
                                    }),
                                );
                            }
                        }

                        let _ = tokio::fs::remove_file(cleanup_path).await;
                        return;
                    }

                    if !processing_session_still_current(&app, &session_id, "before_insertion") {
                        let _ = tokio::fs::remove_file(cleanup_path).await;
                        return;
                    }

                    match core::insertion::insert_transcription_from_legacy(
                        &app,
                        &text,
                        transformed.corrected,
                        Some(app_config.active_text_profile_auto_paste()),
                    ) {
                        Ok(result) if result.ok => {
                            if !processing_session_still_current(&app, &session_id, "insertion_ok")
                            {
                                let _ = tokio::fs::remove_file(cleanup_path).await;
                                return;
                            }

                            let history_entry = core::history::history_entry_from_insert_result(
                                &app_config,
                                None,
                                Some(response.text.clone()),
                                transformed.clone(),
                                &result,
                                Some(effective_mode.clone()),
                            )
                            .ok();

                            // After the insert, deliberately. The text is
                            // already with the user, so nothing here is in a
                            // latency-critical path and nothing here may fail a
                            // delivery that already succeeded (ADR 0035).
                            if let Some(entry) = history_entry.as_ref() {
                                core::vocabulary_learning::learn_from_session(
                                    &app,
                                    core::vocabulary_learning::LearnFromSessionRequest {
                                        profile_id: app_config.active_text_profile_id.clone(),
                                        observation_id: entry.id.clone(),
                                        raw_transcript: response.text.clone(),
                                        final_text: text.clone(),
                                        known_terms: core::vocabulary_learning::known_terms(
                                            &transform_config.vocabulary,
                                            &transform_config.dictionary_entries,
                                        ),
                                        applied_rules: transformed.applied_rules.clone(),
                                        source: core::vocabulary_learning::LearningSource::Correction,
                                    },
                                );
                            }

                            let completion_applied =
                                core::sessions::complete_processing_session_from_transcription(
                                    &app,
                                    &session_id,
                                    &text,
                                    transformed.corrected,
                                );
                            match completion_applied {
                                Ok(true) => {
                                    core::runtime_log::record(format!(
                                        "[WordScript] Native pipeline insertion done session_id={} elapsed_ms={} insert_mode={:?} pasted={} fallback_available={}",
                                        session_id,
                                        pipeline_started_at.elapsed().as_millis(),
                                        result.insert_mode,
                                        result.pasted,
                                        result.fallback_available,
                                    ));
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "transcription",
                                            "text": text,
                                            "corrected": transformed.corrected,
                                            "provider": provider,
                                            "active_profile": app_config.active_text_profile_label(),
                                            "work_mode": app_config.resolved_active_text_profile_work_mode(),
                                            "raw_text": response.text,
                                            "transform": {
                                                "applied_rules": transformed.applied_rules,
                                                "warning": transformed.warning,
                                            },
                                            "history": history_entry.as_ref().map(|entry| serde_json::json!({
                                                "entry_id": entry.id,
                                                "retry_of": entry.retry_of,
                                            })),
                                            "delivery": result.insert_mode.delivery_label(),
                                            "insertion": result
                                        }),
                                    );
                                    // The delivery point: the session is
                                    // completed and the UI is being told about
                                    // it in the same breath, so the cue and the
                                    // result surface arrive together.
                                    core::sound::play_if_enabled(core::sound::SoundCue::Done);
                                }
                                Ok(false) => {
                                    log_stale_pipeline_result(&app, &session_id, "completion")
                                }
                                Err(error) => {
                                    core::sessions::fail_from_native_error(&app, &error);
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": error
                                        }),
                                    );
                                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                                }
                            }
                        }
                        Ok(result) => {
                            if !processing_session_still_current(
                                &app,
                                &session_id,
                                "insertion_failed",
                            ) {
                                let _ = tokio::fs::remove_file(cleanup_path).await;
                                return;
                            }

                            let _ = core::history::history_entry_from_insert_result(
                                &app_config,
                                None,
                                Some(response.text.clone()),
                                transformed.clone(),
                                &result,
                                Some(effective_mode.clone()),
                            );
                            let error = result
                                .error
                                .clone()
                                .unwrap_or_else(|| "Native insertion failed.".to_string());
                            core::runtime_log::record(format!(
                                "[WordScript] Native pipeline insertion reported failure session_id={} elapsed_ms={} insert_mode={:?} pasted={} fallback_available={} error={}",
                                session_id,
                                pipeline_started_at.elapsed().as_millis(),
                                result.insert_mode,
                                result.pasted,
                                result.fallback_available,
                                error,
                            ));
                            match core::sessions::fail_processing_session_from_native_error(
                                &app,
                                &session_id,
                                &error,
                            ) {
                                Ok(true) => {
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": format!("Native insertion failed: {error}"),
                                            "provider": provider,
                                            "transform": {
                                                "applied_rules": transformed.applied_rules,
                                                "warning": transformed.warning,
                                            },
                                            "insertion": result
                                        }),
                                    );
                                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                                }
                                Ok(false) => log_stale_pipeline_result(
                                    &app,
                                    &session_id,
                                    "insertion_failure",
                                ),
                                Err(gate_error) => {
                                    core::sessions::fail_from_native_error(&app, &gate_error);
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": gate_error
                                        }),
                                    );
                                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                                }
                            }
                        }
                        Err(error) => {
                            if !processing_session_still_current(
                                &app,
                                &session_id,
                                "insertion_error",
                            ) {
                                let _ = tokio::fs::remove_file(cleanup_path).await;
                                return;
                            }

                            let _ = core::history::record_insert_failure(
                                &app_config,
                                response.text.clone(),
                                text.clone(),
                                transformed.clone(),
                                error.clone(),
                                Some(effective_mode.clone()),
                            );
                            core::runtime_log::record(format!(
                                "[WordScript] Native pipeline insertion failed session_id={} elapsed_ms={} error={}",
                                session_id,
                                pipeline_started_at.elapsed().as_millis(),
                                error,
                            ));
                            match core::sessions::fail_processing_session_from_native_error(
                                &app,
                                &session_id,
                                &error,
                            ) {
                                Ok(true) => {
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": format!("Native insertion failed: {error}")
                                        }),
                                    );
                                    // This arm used to be the only failure path
                                    // in the pipeline with no cue at all: the
                                    // insert helper never returned, so the cue
                                    // it used to own never ran.
                                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                                }
                                Ok(false) => {
                                    log_stale_pipeline_result(&app, &session_id, "insert_error")
                                }
                                Err(gate_error) => {
                                    core::sessions::fail_from_native_error(&app, &gate_error);
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": gate_error
                                        }),
                                    );
                                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                                }
                            }
                        }
                    }
                }
            }
            Err(error) => {
                if !processing_session_still_current(&app, &session_id, "transcription_error") {
                    let _ = tokio::fs::remove_file(cleanup_path).await;
                    return;
                }

                // A failure that could succeed on a second attempt keeps its
                // audio. Deleting it here is what made a timeout permanent: the
                // history entry has no transcript to retry from, so the
                // recording — minutes of speech that cost nothing to keep — was
                // gone before the error finished rendering.
                keep_audio = error.retryable
                    || matches!(error.kind, core::providers::ProviderErrorKind::Timeout);

                let _ = core::history::record_transcription_failure(
                    &pipeline_app_config,
                    &provider,
                    requested_model.clone(),
                    requested_language.clone(),
                    error.message.clone(),
                    keep_audio.then(|| cleanup_path.clone()),
                );
                core::runtime_log::record(format!(
                    "[WordScript] Native pipeline transcription failed session_id={} elapsed_ms={} kind={:?} message={}",
                    session_id,
                    pipeline_started_at.elapsed().as_millis(),
                    error.kind,
                    error.message,
                ));
                core::sound::play_if_enabled(core::sound::SoundCue::Error);
                match core::sessions::fail_processing_session_from_native_error(
                    &app,
                    &session_id,
                    &error.message,
                ) {
                    Ok(true) => {
                        let _ = app.emit(
                            "wordscript-event",
                            serde_json::json!({
                                "event": "error",
                                "message": error.message,
                                "kind": error.kind,
                                "status": error.status,
                                "retry_after_seconds": error.retry_after_seconds,
                                "retryable": error.retryable,
                                "user_action": error.user_action,
                                // The overlay's error surface offers Retry only
                                // when there is something to retry from.
                                "audio_retained": keep_audio
                            }),
                        );
                    }
                    Ok(false) => {
                        log_stale_pipeline_result(&app, &session_id, "transcription_failure")
                    }
                    Err(gate_error) => {
                        core::sessions::fail_from_native_error(&app, &gate_error);
                        let _ = app.emit(
                            "wordscript-event",
                            serde_json::json!({
                                "event": "error",
                                "message": gate_error
                            }),
                        );
                    }
                }
            }
        }

        if keep_audio {
            core::runtime_log::record(format!(
                "[WordScript] Native pipeline retained audio session_id={} path={}",
                session_id, cleanup_path,
            ));
            // Sweep here rather than only at startup: a run that keeps failing
            // would otherwise fill the directory for a whole session.
            core::capture::prune_retained_captures();
        } else {
            let _ = tokio::fs::remove_file(cleanup_path).await;
        }
    });
}

fn processing_session_still_current<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    checkpoint: &str,
) -> bool {
    if core::sessions::is_processing_session_current(app, session_id) {
        return true;
    }

    log_stale_pipeline_result(app, session_id, checkpoint);
    false
}

fn log_stale_pipeline_result<R: Runtime>(app: &AppHandle<R>, session_id: &str, checkpoint: &str) {
    let current_session =
        core::sessions::current_processing_session_id(app).unwrap_or_else(|| "none".to_string());
    core::runtime_log::record(format!(
        "[WordScript] Ignored stale native pipeline result session_id={} current_processing_session={} checkpoint={}",
        session_id, current_session, checkpoint,
    ));
}

/// Drops segments the model's own confidence metrics mark as invented before
/// anything downstream sees the transcript. Only the cloud lane returns these
/// metrics; a provider without them passes through untouched.
fn apply_confidence_gate(
    mut response: core::providers::TranscriptionResponse,
) -> (core::providers::TranscriptionResponse, bool) {
    let outcome = core::confidence_gate::evaluate_segments(response.segments.as_deref());

    if outcome.rejected.is_empty() {
        return (response, false);
    }

    for rejected in &outcome.rejected {
        core::runtime_log::record(format!(
            "[WordScript] Confidence gate rejected segment start={:.2} end={:.2} reason={} text={:?}",
            rejected.start, rejected.end, rejected.reason, rejected.text,
        ));
    }

    if let Some(text) = outcome.text {
        response.text = text;
    }

    (response, true)
}

fn runtime_transcription_timeout_ms(audio_duration_seconds: Option<f64>) -> u64 {
    core::capture_budget::transcription_timeout_ms(audio_duration_seconds)
}

// ── Tauri Commands (callable from React via invoke()) ─────────────────────────

/// What a recording may cost under the current provider and settings.
///
/// The overlay states the auto-stop and the settings surface states the
/// ceiling; both read it from here rather than deriving it. A threshold
/// restated in TypeScript is a threshold that drifts, and the drift is
/// invisible because both sides still look right in isolation (ADR 0034).
#[tauri::command]
fn resolve_capture_budget() -> core::capture_budget::CaptureBudget {
    core::capture_budget::resolve(&core::config::AppConfig::load_from_disk())
}

/// The account plans the given provider offers, for the settings surface to
/// render. Empty when the provider has none to choose between.
#[tauri::command]
fn resolve_provider_tiers(provider: String) -> Vec<core::providers::ProviderTier> {
    core::providers::provider_tiers(&provider)
}

/// Show (and focus) the settings window, optionally at a specific control.
///
/// `target` is a semantic anchor for a control (`capture.auto_stop`), not an
/// area id. The settings surface is being reworked and controls move between
/// areas with it; a link that named the area would keep resolving to a screen
/// that no longer has the control, and it would do so silently. The frontend
/// owns the anchor→area mapping (`src/lib/settingsAnchors.ts`), so this only
/// carries the name across.
#[tauri::command]
async fn open_settings_window(app: AppHandle, target: Option<String>) -> Result<(), String> {
    reveal_settings_window(&app);

    if let Some(target) = target.filter(|value| !value.trim().is_empty()) {
        // After the reveal: the window may have been hidden, and a listener in
        // a hidden window is still mounted, so ordering only matters for focus.
        let _ = app.emit("wordscript-settings-target", serde_json::json!({ "target": target }));
    }
    Ok(())
}

#[tauri::command]
async fn open_rebuild_lab_window(app: AppHandle) -> Result<(), String> {
    if app.get_webview_window("rebuild-lab").is_none() {
        return Err("Diagnostics window is not configured.".to_string());
    }

    reveal_rebuild_lab_window(&app);
    Ok(())
}

#[tauri::command]
async fn app_config_file_path() -> Result<String, String> {
    Ok(core::paths::config_file_path()
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
async fn sync_overlay_window_visibility(
    app: AppHandle,
    visible: bool,
    surface: Option<OverlaySurface>,
    height: Option<f64>,
    width: Option<f64>,
) -> Result<(), String> {
    if visible {
        // D3: route through the coalesced entry point so multiple sync calls
        // arriving in the same frame (e.g. the frontend's three reveal sources
        // on a mode change during recording) collapse into a single
        // `set_size`. The `visible: false` (park) path stays synchronous
        // because it fires deterministically at the end of the leave timer and
        // does not race with reveal sources.
        reveal_overlay_window_coalesced(&app, surface.unwrap_or_default(), height, width);
    } else {
        park_overlay_window(&app);
    }

    Ok(())
}

#[tauri::command]
async fn resize_overlay_to_height(app: AppHandle, height: f64) -> Result<(), String> {
    let clamped = height.clamp(OVERLAY_EDIT_MODE_WINDOW_HEIGHT_MIN, OVERLAY_EDIT_MODE_WINDOW_HEIGHT_MAX);
    if let Some(window) = app.get_webview_window("overlay") {
        let current_size = window.outer_size().map_err(|e| e.to_string())?;
        let scale = window.scale_factor().unwrap_or(1.0);
        let current_width = current_size.width as f64 / scale;
        let _ = window.set_size(LogicalSize::new(current_width, clamped));
        // WebKitGTK leaves the resized backing opaque/black — re-assert transparency.
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
    }
    Ok(())
}

#[tauri::command]
async fn resize_edit_overlay(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    let clamped_w = width.clamp(OVERLAY_EDIT_MODE_WINDOW_WIDTH_MIN, OVERLAY_EDIT_MODE_WINDOW_WIDTH_MAX);
    let clamped_h = height.clamp(OVERLAY_EDIT_MODE_WINDOW_HEIGHT_MIN, OVERLAY_EDIT_MODE_RESIZE_HEIGHT_MAX);
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.set_size(LogicalSize::new(clamped_w, clamped_h));
        // WebKitGTK leaves the resized backing opaque/black — re-assert transparency.
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
    }
    Ok(())
}

// ── Diagnose-Infrastruktur commands (plan 1784433288646, Phase 1.2) ──────────
// Permanent, debug-only. The frontend only invokes these under
// `import.meta.env.DEV`; they are safe to register unconditionally but
// `overlay_open_devtools` is cfg-gated because `open_devtools()` is only
// available in debug builds (or with the `devtools` Cargo feature).

/// Open the WebKit devtools for the overlay window. The `open_devtools()`
/// call is gated to debug builds because Tauri v2 only exposes it when
/// `debug_assertions` is set or the `devtools` Cargo feature is enabled. The
/// command itself is always registered so the invoke_handler macro stays
/// uniform; in release builds it returns an error (the frontend only calls it
/// under `import.meta.env.DEV` anyway).
#[tauri::command]
async fn overlay_open_devtools(app: AppHandle) -> Result<(), String> {
    #[cfg(any(debug_assertions, feature = "devtools"))]
    {
        let window = app
            .get_webview_window("overlay")
            .ok_or_else(|| "overlay window not found".to_string())?;
        window.open_devtools();
        Ok(())
    }
    #[cfg(not(any(debug_assertions, feature = "devtools")))]
    {
        let _ = app;
        Err("overlay_open_devtools is only available in debug builds".to_string())
    }
}

/// Append a batch of diagnostic lines to /tmp/kilo/overlay-diag.log, each
/// prefixed with the same epoch-millisecond stamp the runtime log uses so the
/// two can be lined up against each other and against `journalctl`. The first
/// call per process run truncates the file (via `Once`) so each dev session
/// starts fresh. Called from the frontend under `import.meta.env.DEV` only.
///
/// A BATCH rather than a single line, because the frontend used to fire one
/// `invoke` per line without awaiting it. Concurrent commands are not ordered
/// against each other, so the log could reorder lines or lose one entirely —
/// and a missing line is indistinguishable from an effect that never ran, which
/// is precisely the distinction this log exists to make. One command per flush
/// writes the batch in order under a single lock.
#[tauri::command]
async fn append_diag_log(lines: Vec<String>) -> Result<(), String> {
    if lines.is_empty() {
        return Ok(());
    }

    let epoch_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0);

    let mut handle = OVERLAY_DIAG_LOG_FILE
        .lock()
        .map_err(|error| error.to_string())?;

    OVERLAY_DIAG_LOG_TRUNCATED.call_once(|| {
        // Ensure /tmp/kilo exists (it should, but be defensive on fresh
        // machines), then best-effort truncate. Ignore errors — the open below
        // creates the file if it doesn't exist.
        if let Some(parent) = std::path::Path::new(OVERLAY_DIAG_LOG_PATH).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::File::create(OVERLAY_DIAG_LOG_PATH);
    });

    // Drop the cached handle once the file outgrows the ceiling so the next
    // append starts a fresh file rather than growing without bound.
    if handle.is_some()
        && std::fs::metadata(OVERLAY_DIAG_LOG_PATH)
            .map(|metadata| metadata.len() >= OVERLAY_DIAG_LOG_MAX_BYTES)
            .unwrap_or(false)
    {
        *handle = None;
        let _ = std::fs::File::create(OVERLAY_DIAG_LOG_PATH);
    }

    if handle.is_none() {
        *handle = Some(
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(OVERLAY_DIAG_LOG_PATH)
                .map_err(|error| error.to_string())?,
        );
    }

    let file = handle.as_mut().expect("diag log handle was just opened");
    for line in lines.iter().take(OVERLAY_DIAG_LOG_MAX_BATCH_LINES) {
        writeln!(file, "[{epoch_ms}] {line}").map_err(|error| error.to_string())?;
    }
    if lines.len() > OVERLAY_DIAG_LOG_MAX_BATCH_LINES {
        writeln!(
            file,
            "[{epoch_ms}] [ov-diag] dropped {} lines over the {OVERLAY_DIAG_LOG_MAX_BATCH_LINES}-line batch cap",
            lines.len() - OVERLAY_DIAG_LOG_MAX_BATCH_LINES,
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Read the tail of the diagnostic log. Used by the Settings-Window Diagnose-
/// Panel for live polling, which only ever renders the tail anyway. Returning
/// the whole file here made the poll payload grow with session length.
#[tauri::command]
async fn read_diag_log() -> Result<String, String> {
    let Ok(mut file) = std::fs::File::open(OVERLAY_DIAG_LOG_PATH) else {
        return Ok(String::new());
    };

    let len = file.metadata().map(|metadata| metadata.len()).unwrap_or(0);
    if len > OVERLAY_DIAG_LOG_READ_TAIL_BYTES {
        let _ = file.seek(SeekFrom::End(-(OVERLAY_DIAG_LOG_READ_TAIL_BYTES as i64)));
    }

    let mut buffer = Vec::new();
    if file.read_to_end(&mut buffer).is_err() {
        return Ok(String::new());
    }

    let mut text = String::from_utf8_lossy(&buffer).into_owned();
    // A tail seek can land mid-line; drop the partial head so the panel never
    // shows a truncated first entry.
    if len > OVERLAY_DIAG_LOG_READ_TAIL_BYTES {
        if let Some(newline) = text.find('\n') {
            text = text[newline + 1..].to_string();
        }
    }
    Ok(text)
}

/// Clear the diagnostic log (truncates to empty).
#[tauri::command]
async fn clear_diag_log() -> Result<(), String> {
    let mut handle = OVERLAY_DIAG_LOG_FILE
        .lock()
        .map_err(|error| error.to_string())?;
    // Drop the append handle first — it holds a file offset that a truncate
    // would otherwise leave stranded past the new end of file.
    *handle = None;
    std::fs::write(OVERLAY_DIAG_LOG_PATH, "").map_err(|error| error.to_string())?;
    Ok(())
}

// ── Overlay input routing (Linux/WebKitGTK) ─────────────────────────────────
// REVERTED 2026-06-19. A cursor-position poller toggling set_ignore_cursor_events
// does NOT work on this Wayland setup — confirmed by STATUS.md ("setIgnoreCursorEvents
// ist auf dem getesteten Setup nicht wirksam") and live test. Click-through on
// Wayland requires layer-shell, not set_ignore_cursor_events. Kept as a marker;
// the real path forward is layer-shell (see docs/STATUS.md:108 + handoff Abschnitt 11).

#[tauri::command]
async fn remember_overlay_manual_position<R: Runtime>(
    app: AppHandle<R>,
    webview_window: tauri::WebviewWindow<R>,
    x: i32,
    y: i32,
    surface: Option<OverlaySurface>,
) -> Result<AppConfig, String> {
    let mut config = AppConfig::load_from_disk();
    let (reference_x, reference_y) =
        manual_overlay_reference_position(x as f64, y as f64, surface.unwrap_or_default());

    config.overlay_position_mode = OverlayPositionMode::Manual;
    config.overlay_monitor =
        overlay_monitor_id_for_manual_reference(&webview_window, reference_x, reference_y)
            .or_else(|| {
                webview_window
                    .primary_monitor()
                    .ok()
                    .flatten()
                    .map(|monitor| overlay_monitor_id(&monitor))
            })
            .unwrap_or_else(|| "primary".to_string());
    config.overlay_manual_x = reference_x.round() as i32;
    config.overlay_manual_y = reference_y.round() as i32;

    core::config::save_config(app, config)
}

// ── App entry ─────────────────────────────────────────────────────────────────

pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        reveal_settings_window(app);
    }));
    #[cfg(debug_assertions)]
    let builder = builder;

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if let Some(effect) =
                        core::trigger::handle_global_shortcut_event(app, shortcut, event)
                    {
                        apply_trigger_effect(app, effect);
                    }
                })
                .build(),
        )
        .manage(Mutex::new(V1SliceState::default()))
        .manage(Mutex::new(NativeSessionState::default()))
        .manage(Mutex::new(NativeTriggerState::new(
            NativeTriggerConfig::load_from_disk(),
        )))
        .manage(Mutex::new(NativeCaptureState::load(
            NativeCaptureConfig::load_from_disk(),
        )))
        .manage(Mutex::new(NativeInsertionState::load(
            NativeInsertionConfig::load_from_disk(),
        )))
        .setup(|app| {
            // Captures kept for a retry that never came. Swept at startup so a
            // machine that failed a run weeks ago is not still holding the
            // audio for it.
            core::capture::prune_retained_captures();

            // ── System tray ───────────────────────────────────────────────
            let title = MenuItem::with_id(app, "title", "WordScript", false, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let diagnostics =
                MenuItem::with_id(app, "diagnostics", "Diagnostics", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu =
                Menu::with_items(app, &[&title, &sep1, &settings, &diagnostics, &sep2, &quit])?;

            let tray_icon = app.default_window_icon().cloned().expect(
                "No default window icon configured — add an icon to tauri.conf.json bundle.icon",
            );
            TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "settings" => {
                        reveal_settings_window(app);
                    }
                    "diagnostics" => {
                        reveal_rebuild_lab_window(app);
                    }
                    _ => {}
                })
                .build(app)?;

            // ── Settings window: minimize on close instead of destroy ────
            if let Some(settings) = app.get_webview_window("settings") {
                install_hide_on_close(&settings);
            }

            if let Some(rebuild_lab) = app.get_webview_window("rebuild-lab") {
                install_hide_on_close(&rebuild_lab);
            }

            let initial_config = AppConfig::load_from_disk();
            core::config::emit_ready_event(app.handle(), &initial_config);
            core::sound::apply_config(&initial_config);
            core::sound::init();
            core::sound::play_startup(&initial_config);

            let trigger_state = app.state::<Mutex<NativeTriggerState>>();
            if let Err(error) = core::trigger::register_native_shortcuts(
                app.handle(),
                trigger_state.inner(),
                NativeTriggerConfig::load_from_disk(),
            ) {
                core::runtime_log::record(format!(
                    "[WordScript] Failed to register native shortcut: {error}"
                ));
                let _ = app.emit(
                    "wordscript-native-event",
                    serde_json::json!({
                        "event": "error",
                        "message": format!("Native shortcut registration failed: {error}")
                    }),
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core::config::load_app_config,
            core::config::save_config,
            core::sound::preview_sound_cue,
            core::config::switch_active_text_profile,
            resolve_capture_budget,
            resolve_provider_tiers,
            open_settings_window,
            open_rebuild_lab_window,
            app_config_file_path,
            overlay_monitor_options,
            sync_overlay_window_visibility,
            resize_overlay_to_height,
            resize_edit_overlay,
            overlay_open_devtools,
            append_diag_log,
            read_diag_log,
            clear_diag_log,
            remember_overlay_manual_position,
            core::providers::provider_status,
            core::providers::save_provider_api_key,
            core::providers::clear_provider_api_key,
            core::providers::validate_provider_api_key,
            core::providers::transcribe_audio_file,
            core::communication_style::analyze_communication_style,
            core::text_rules::analyze_text_rules,
            core::text_rules::export_text_rules,
            core::text_rules::import_text_rules,
            core::text_rules::get_profile_health,
            core::config::acknowledge_profile_health_flag,
            core::config::unacknowledge_profile_health_flag,
            core::sessions::native_session_status,
            core::sessions::start_native_session,
            core::sessions::stop_native_session,
            core::sessions::abort_native_session,
            core::sessions::complete_native_session,
            core::sessions::commit_pending_transcription_preview,
            core::trigger::native_trigger_status,
            core::trigger::configure_native_trigger,
            core::trigger::pause_native_trigger,
            core::trigger::resume_native_trigger,
            core::capture::native_capture_status,
            core::capture::configure_native_capture,
            core::capture::list_native_input_devices,
            core::capture::toggle_native_capture_mute,
            core::capture::toggle_native_capture_pause,
            core::insertion::native_insertion_status,
            core::insertion::insert_text_native,
            core::insertion::restore_last_transcript,
            core::insertion::clear_native_scratchpad,
            core::history::transcription_history_entries,
            core::history::transcription_history_storage_status,
            core::transcript_store::transcript_store_status,
            core::backup::export_full_backup,
            core::backup::import_full_backup,
            core::backup::reset_all_settings,
            core::theme::system_color_scheme,
            core::theme::set_window_color_scheme,
            core::transcript_store::reveal_transcript_in_file_manager,
            core::history::export_transcription_history,
            core::history::clear_transcription_history_entries,
            core::history::delete_transcription_history_entry,
            core::history::acknowledge_transcription_fallback,
            core::history::retry_transcription_history_entry,
            core::updates::check_app_update,
            core::runtime_log::runtime_log_entries,
            core::runtime_log::clear_runtime_log_entries,
            core::shortcut::validate_shortcut,
            core::shortcut::shortcut_vocabulary,
            core::shortcut::shortcut_platform,
            core::trigger::shortcut_capabilities,
            core::workspace_context::get_workspace_context,
            core::mode_router::resolve_current_processing_mode,
            core::mode_router::set_active_profile_processing_mode,
            core::mode_router::cycle_active_profile_translate_language,
            core::prompt_enhance::preview_prompt_enhance,
            v1_slice::v1_slice_status,
            v1_slice::start_v1_slice_capture,
            v1_slice::complete_v1_slice_capture,
            v1_slice::reset_v1_slice,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WordScript");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_transcription_timeout_stays_interactive() {
        assert_eq!(
            runtime_transcription_timeout_ms(None),
            core::capture_budget::MIN_TRANSCRIPTION_TIMEOUT_MS
        );
        assert_eq!(runtime_transcription_timeout_ms(Some(3.0)), 20_400);
    }

    /// The defect this fixed: the wait was capped at 60 s of audio before
    /// scaling, so a 679 s capture was granted the same 35 s as a one-minute
    /// one and could not finish. The pipeline must grant a long capture a
    /// proportionally long wait, and the watchdog must outlast it.
    #[test]
    fn a_long_capture_is_not_budgeted_like_a_short_one() {
        let one_minute = runtime_transcription_timeout_ms(Some(60.0));
        let eleven_minutes = runtime_transcription_timeout_ms(Some(679.58));

        assert!(
            eleven_minutes > one_minute * 5,
            "an 11-minute capture must not share a one-minute budget: {eleven_minutes} vs {one_minute}"
        );
        assert!(
            core::capture_budget::pipeline_deadline(Some(679.58)).as_millis() as u64
                > eleven_minutes,
            "the watchdog must outlast the request it supervises"
        );
    }

    fn capture_config_for_prompt_tests(provider: &str) -> NativeCaptureConfig {
        NativeCaptureConfig {
            provider: provider.to_string(),
            ..Default::default()
        }
    }

    fn resolved_prompt(config: &NativeCaptureConfig) -> Option<String> {
        config
            .resolve_transcription_request("/tmp/capture.wav", 20_000)
            .prompt
    }

    #[test]
    fn local_preview_prompt_strength_can_disable_bias() {
        let config = NativeCaptureConfig {
            prompt: "Customer success terminology".to_string(),
            local_prompt_strength: "off".to_string(),
            ..capture_config_for_prompt_tests(core::providers::LOCAL_PREVIEW_PROVIDER_ID)
        };

        assert_eq!(resolved_prompt(&config), None);
    }

    #[test]
    fn local_preview_prompt_strength_profile_and_terms_uses_stt_hints_and_dictionary() {
        // profile.prompt is LLM cleanup context — must NOT reach Whisper initial_prompt.
        // Only explicit stt_hints and dictionary preferred spellings are STT signals.
        let config = NativeCaptureConfig {
            prompt: "WordScript\ncustomer escalation\nSEV-1".to_string(),
            stt_hints: "status update\nhandoff summary".to_string(),
            local_prompt_strength: "profile_and_terms".to_string(),
            dictionary_entries: vec![core::config::DictionaryEntry {
                id: "brand".to_string(),
                phrase: "word script".to_string(),
                replace_with: "WordScript".to_string(),
            }],
            ..capture_config_for_prompt_tests(core::providers::LOCAL_PREVIEW_PROVIDER_ID)
        };

        let prompt = resolved_prompt(&config).expect("local preview prompt");

        assert!(
            !prompt.contains("Vocabulary:"),
            "the profile context field must not reach Whisper (ADR 0032)"
        );
        assert!(prompt.contains("Likely phrases: status update; handoff summary"));
        assert!(
            !prompt.contains("WordScript"),
            "dictionary terms are applied after transcription, not whispered into the prompt"
        );
    }

    #[test]
    fn cloud_transcription_prompt_excludes_the_profile_context_field() {
        // profile.prompt is context for the LLM stages, in whatever language the
        // profile is written. Sending it as Whisper's initial_prompt biases
        // language detection toward that language even when the user speaks
        // another one. Only the opted-in vocabulary is a legitimate STT signal
        // (ADR 0032).
        let config = NativeCaptureConfig {
            prompt: "customer names\nWordScript\nticket IDs\nrefund policy\nSEV-1".to_string(),
            stt_hints: "status update\ntriage summary".to_string(),
            dictionary_entries: vec![
                core::config::DictionaryEntry {
                    id: "brand".to_string(),
                    phrase: "word script".to_string(),
                    replace_with: "WordScript".to_string(),
                },
                core::config::DictionaryEntry {
                    id: "sev".to_string(),
                    phrase: "sev one".to_string(),
                    replace_with: "SEV-1".to_string(),
                },
            ],
            ..capture_config_for_prompt_tests("groq")
        };

        let prompt = resolved_prompt(&config).expect("cloud prompt");

        assert!(
            !prompt.contains("Vocabulary:"),
            "the profile context field must not reach Whisper (ADR 0032)"
        );
        assert!(prompt.contains("Likely phrases: status update; triage summary"));
        assert!(
            !prompt.contains("SEV-1"),
            "dictionary terms are applied after transcription, not whispered into the prompt"
        );
    }

    #[test]
    fn snippet_triggers_no_longer_feed_automatic_transcription_bias() {
        let config = NativeCaptureConfig {
            prompt: "Support language".to_string(),
            stt_hints: "status update".to_string(),
            dictionary_entries: vec![core::config::DictionaryEntry {
                id: "brand".to_string(),
                phrase: "word script".to_string(),
                replace_with: "WordScript".to_string(),
            }],
            snippet_entries: vec![core::config::SnippetEntry {
                id: "leak".to_string(),
                label: "leak".to_string(),
                trigger: "should not leak".to_string(),
                expansion: "should not leak".to_string(),
            }],
            ..capture_config_for_prompt_tests("groq")
        };

        let prompt = resolved_prompt(&config).expect("cloud prompt");

        assert!(prompt.contains("Likely phrases: status update"));
        assert!(!prompt.contains("should not leak"));
    }

    #[test]
    fn cloud_transcription_prompt_respects_conservative_size_limit() {
        use crate::core::transcription_hints::CLOUD_PROMPT_PREVIEW_MAX_CHARS;
        // Many short accepted hint lines, so the prompt is long enough to have
        // to be truncated at all.
        let hints = (0..80)
            .map(|index| format!("Term-{index}"))
            .collect::<Vec<_>>()
            .join("\n");
        let config = NativeCaptureConfig {
            stt_hints: hints,
            ..capture_config_for_prompt_tests("groq")
        };

        let prompt = resolved_prompt(&config).expect("cloud prompt");

        assert!(prompt.chars().count() <= CLOUD_PROMPT_PREVIEW_MAX_CHARS);
    }

    #[test]
    fn manual_overlay_reference_roundtrips_surface_positions() {
        let compact = manual_overlay_reference_position(320.0, 180.0, OverlaySurface::Compact);
        assert_eq!(compact, (320.0, 180.0));

        let processing =
            manual_overlay_reference_position(210.0, 140.0, OverlaySurface::ProcessingPreview);
        assert_eq!(processing, (210.0, 140.0));
        assert_eq!(
            manual_overlay_surface_position(
                processing.0,
                processing.1,
                OverlaySurface::ProcessingPreview
            ),
            (210.0, 140.0)
        );

        let result = manual_overlay_reference_position(412.0, 96.0, OverlaySurface::ResultActions);
        assert_eq!(result, (412.0, 96.0));
        assert_eq!(
            manual_overlay_surface_position(result.0, result.1, OverlaySurface::ResultActions),
            (412.0, 96.0)
        );
    }

    #[test]
    fn manual_overlay_surface_positions_keep_the_same_top_left_across_states() {
        let (result_x, result_y) =
            manual_overlay_surface_position(480.0, 220.0, OverlaySurface::ResultActions);
        let (preview_x, preview_y) =
            manual_overlay_surface_position(480.0, 220.0, OverlaySurface::ProcessingPreview);

        assert_eq!((result_x, result_y), (480.0, 220.0));
        assert_eq!((preview_x, preview_y), (480.0, 220.0));
    }

    #[test]
    fn overlay_monitor_selection_prefers_the_work_area_containing_the_manual_reference() {
        let selected = overlay_monitor_id_for_logical_point(
            [
                ("name:Primary".to_string(), (0.0, 0.0, 1920.0, 1040.0)),
                (
                    "workarea:-1080:0:1080:1880".to_string(),
                    (-1080.0, 0.0, 1080.0, 1880.0),
                ),
            ],
            -320.0,
            240.0,
        );

        assert_eq!(selected.as_deref(), Some("workarea:-1080:0:1080:1880"));
    }

    #[test]
    fn overlay_monitor_selection_falls_back_to_the_nearest_work_area_when_point_is_outside_all_monitors(
    ) {
        let selected = overlay_monitor_id_for_logical_point(
            [
                ("name:Primary".to_string(), (0.0, 0.0, 1920.0, 1040.0)),
                (
                    "workarea:-1080:0:1080:1880".to_string(),
                    (-1080.0, 0.0, 1080.0, 1880.0),
                ),
            ],
            -1124.0,
            260.0,
        );

        assert_eq!(selected.as_deref(), Some("workarea:-1080:0:1080:1880"));
    }

    #[test]
    fn resolve_overlay_monitor_id_returns_the_identity_match_when_present() {
        let selected = resolve_overlay_monitor_id(
            [
                ("name:Primary".to_string(), (0.0, 0.0, 1920.0, 1040.0)),
                ("name:HDMI-2".to_string(), (-1080.0, 0.0, 1080.0, 1880.0)),
            ],
            "name:HDMI-2",
            OverlayPositionMode::Manual,
            -320.0,
            240.0,
        );

        assert_eq!(selected.as_deref(), Some("name:HDMI-2"));
    }

    #[test]
    fn resolve_overlay_monitor_id_redrives_by_containment_on_identity_miss_in_manual_mode() {
        // Saved identity ("name:HDMI-2") is gone after a reconnect, but the
        // saved Manual reference point (-320, 240) still lies on the secondary's
        // work-area → secondary is rederived instead of snapping to primary.
        let selected = resolve_overlay_monitor_id(
            [
                ("name:Primary".to_string(), (0.0, 0.0, 1920.0, 1040.0)),
                (
                    "workarea:-1080:0:1080:1880".to_string(),
                    (-1080.0, 0.0, 1080.0, 1880.0),
                ),
            ],
            "name:HDMI-2",
            OverlayPositionMode::Manual,
            -320.0,
            240.0,
        );

        assert_eq!(selected.as_deref(), Some("workarea:-1080:0:1080:1880"));
    }

    #[test]
    fn resolve_overlay_monitor_id_skips_rederivation_in_preset_mode() {
        // Preset mode has no persisted Manual reference; identity-miss must not
        // rederive → caller falls back to primary.
        let selected = resolve_overlay_monitor_id(
            [
                ("name:Primary".to_string(), (0.0, 0.0, 1920.0, 1040.0)),
                (
                    "workarea:-1080:0:1080:1880".to_string(),
                    (-1080.0, 0.0, 1080.0, 1880.0),
                ),
            ],
            "name:HDMI-2",
            OverlayPositionMode::Preset,
            -320.0,
            240.0,
        );

        assert_eq!(selected, None);
    }

    #[test]
    fn resolve_overlay_monitor_id_redrives_to_nearest_when_manual_reference_is_outside_all_monitors(
    ) {
        // Reference beyond every work-area → nearest monitor wins (keeps the
        // overlay near its last position rather than falling to primary).
        let selected = resolve_overlay_monitor_id(
            [
                ("name:Primary".to_string(), (0.0, 0.0, 1920.0, 1040.0)),
                (
                    "workarea:-1080:0:1080:1880".to_string(),
                    (-1080.0, 0.0, 1080.0, 1880.0),
                ),
            ],
            "name:HDMI-2",
            OverlayPositionMode::Manual,
            -1124.0,
            260.0,
        );

        assert_eq!(selected.as_deref(), Some("workarea:-1080:0:1080:1880"));
    }

    #[test]
    fn overlay_workspace_bounds_cover_the_full_multi_monitor_union() {
        let bounds = overlay_workspace_bounds([
            (0.0, 0.0, 1080.0, 1920.0),
            (1080.0, 411.0, 1920.0, 1080.0),
            (3000.0, 223.0, 1536.0, 960.0),
        ]);

        assert_eq!(bounds, Some((0.0, 0.0, 4536.0, 1920.0)));
    }

    #[test]
    fn overlay_workspace_bounds_keep_negative_monitor_origins() {
        let bounds =
            overlay_workspace_bounds([(-1080.0, 0.0, 1080.0, 1880.0), (0.0, 0.0, 1920.0, 1040.0)]);

        assert_eq!(bounds, Some((-1080.0, 0.0, 1920.0, 1880.0)));
    }

    // The reporting machine's layout: two monitors offset vertically, so the
    // union bounding box (4320x1568) has corners that no monitor covers. The
    // overlay was measured parked at (3840,1508) — inside the box, on nothing.
    const STAGGERED_LAYOUT: [(f64, f64, f64, f64); 2] =
        [(0.0, 218.0, 2400.0, 1350.0), (2400.0, 0.0, 1920.0, 1200.0)];

    #[test]
    fn an_overlay_in_the_dark_part_of_the_union_box_counts_as_stranded() {
        assert!(overlay_rect_is_off_all_work_areas(
            (3840.0, 1508.0, 480.0, 60.0),
            STAGGERED_LAYOUT,
        ));
    }

    #[test]
    fn an_overlay_on_a_monitor_is_never_stranded() {
        // Inside the manual reference the config actually carries.
        assert!(!overlay_rect_is_off_all_work_areas(
            (1326.0, 921.0, 480.0, 60.0),
            STAGGERED_LAYOUT,
        ));
        // And on the second monitor.
        assert!(!overlay_rect_is_off_all_work_areas(
            (2600.0, 400.0, 480.0, 60.0),
            STAGGERED_LAYOUT,
        ));
    }

    #[test]
    fn an_overlay_hanging_over_an_edge_stays_on_screen() {
        // Partly outside is still visible, so the drag position is left alone
        // rather than snapped back.
        assert!(!overlay_rect_is_off_all_work_areas(
            (-100.0, 300.0, 480.0, 60.0),
            STAGGERED_LAYOUT,
        ));
        assert!(!overlay_rect_is_off_all_work_areas(
            (2380.0, 1150.0, 480.0, 60.0),
            STAGGERED_LAYOUT,
        ));
    }

    #[test]
    fn an_overlay_touching_an_edge_only_does_not_count_as_on_screen() {
        // Exactly abutting the right edge of the second monitor shares no
        // pixel with it.
        assert!(overlay_rect_is_off_all_work_areas(
            (4320.0, 400.0, 480.0, 60.0),
            STAGGERED_LAYOUT,
        ));
    }

    #[test]
    fn a_zero_area_rect_intersects_nothing_but_is_not_evidence() {
        // GTK reports 0x0 for a window that is not realized yet. The predicate
        // itself has to say "off screen" — it shares no pixel with anything —
        // so the caller is what must refuse to act on it.
        assert!(overlay_rect_is_off_all_work_areas(
            (0.0, 0.0, 0.0, 0.0),
            STAGGERED_LAYOUT,
        ));
    }

    #[test]
    fn without_enumerable_monitors_nothing_is_reported_as_stranded() {
        // No evidence must never trigger a reposition against a topology the
        // runtime cannot see.
        assert!(!overlay_rect_is_off_all_work_areas(
            (3840.0, 1508.0, 480.0, 60.0),
            [],
        ));
    }

    // D5 (plan 1784412908352): verify that the coalescing state machine
    // collapses two same-frame sync calls into a single set_size. The tick
    // oscillates on EVERY flat reveal (needed for same-kind visual changes
    // like mode-cycle within "recording" where key={pillState.kind} does NOT
    // remount). The coalescing (OVERLAY_PENDING_REVEAL last-write-wins +
    // OVERLAY_REVEAL_SCHEDULED single-flush gate) ensures only ONE
    // reveal_overlay_window_impl call runs per frame → only ONE fetch_add →
    // only ONE set_size with ONE height, instead of 2–3 competing heights
    // that WebKitGTK applies out of order (RC1 + RC3).
    #[test]
    fn reveal_overlay_window_coalesces_same_frame_sync_calls_into_one_set_size() {
        // Reset the shared statics to a known state. These statics are only
        // touched by reveal_overlay_window_impl/park_overlay_window (which
        // require an AppHandle and are not exercised by other unit tests), so
        // resetting them here is safe for parallel test execution.
        OVERLAY_WINDOW_SHOWN.store(false, Ordering::Relaxed);
        OVERLAY_FLAT_REVEAL_TICK.store(0, Ordering::Relaxed);
        OVERLAY_REVEAL_SCHEDULED.store(false, Ordering::SeqCst);
        {
            let mut pending = OVERLAY_PENDING_REVEAL.lock().expect("OVERLAY_PENDING_REVEAL poisoned");
            *pending = None;
        }

        // The tick oscillates on every flat reveal — this is required for
        // same-kind visual changes (mode-cycle within "recording") where the
        // React key does NOT remount. Both the hidden→visible and the
        // visible→visible transitions oscillate.
        assert!(
            should_oscillate_flat_reveal(OverlaySurface::Compact, false),
            "hidden→visible reveal must oscillate"
        );
        assert!(
            should_oscillate_flat_reveal(OverlaySurface::Compact, true),
            "visible→visible reveal (mode change within session) must oscillate — \
             this is the only repaint trigger when key=kind does not remount"
        );
        assert!(
            should_oscillate_flat_reveal(OverlaySurface::ProcessingPreview, true),
            "processing_preview within session must oscillate"
        );

        // Edit-mode never oscillates (free sizing).
        assert!(!should_oscillate_flat_reveal(OverlaySurface::EditMode, false));
        assert!(!should_oscillate_flat_reveal(OverlaySurface::EditMode, true));

        // The coalescing state machine is what prevents the multi-set_size
        // cascade: two pending writes collapse to the last one
        // (last-write-wins), and OVERLAY_REVEAL_SCHEDULED gates against
        // scheduling more than one flush. This means even though the tick
        // oscillates on every flat reveal, only ONE fetch_add + ONE set_size
        // happens per frame.
        {
            let mut pending = OVERLAY_PENDING_REVEAL.lock().expect("OVERLAY_PENDING_REVEAL poisoned");
            *pending = Some((OverlaySurface::Compact, Some(61.0), Some(480.0)));
        }
        {
            let mut pending = OVERLAY_PENDING_REVEAL.lock().expect("OVERLAY_PENDING_REVEAL poisoned");
            *pending = Some((OverlaySurface::Compact, Some(60.0), Some(480.0)));
        }
        let final_pending = OVERLAY_PENDING_REVEAL
            .lock()
            .expect("OVERLAY_PENDING_REVEAL poisoned")
            .take();
        assert_eq!(
            final_pending,
            Some((OverlaySurface::Compact, Some(60.0), Some(480.0))),
            "last write to OVERLAY_PENDING_REVEAL must win — only one set_size per frame"
        );

        // OVERLAY_REVEAL_SCHEDULED compare_exchange: the first scheduler wins,
        // the second is rejected → only one flush task is spawned.
        let first_schedule = OVERLAY_REVEAL_SCHEDULED.compare_exchange(
            false,
            true,
            Ordering::SeqCst,
            Ordering::SeqCst,
        );
        assert!(first_schedule.is_ok(), "first schedule request must succeed");
        let second_schedule = OVERLAY_REVEAL_SCHEDULED.compare_exchange(
            false,
            true,
            Ordering::SeqCst,
            Ordering::SeqCst,
        );
        assert!(
            second_schedule.is_err(),
            "second schedule request must be rejected (only one flush per frame)"
        );

        // Cleanup: leave the statics in a neutral state for any subsequent test.
        OVERLAY_WINDOW_SHOWN.store(false, Ordering::Relaxed);
        OVERLAY_FLAT_REVEAL_TICK.store(0, Ordering::Relaxed);
        OVERLAY_REVEAL_SCHEDULED.store(false, Ordering::SeqCst);
        {
            let mut pending = OVERLAY_PENDING_REVEAL.lock().expect("OVERLAY_PENDING_REVEAL poisoned");
            *pending = None;
        }
    }
}
