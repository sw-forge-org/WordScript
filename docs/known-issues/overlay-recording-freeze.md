# Bug: Recording Overlay Freezes Mid-Capture

Status: **Open — not yet proven to exist in the product path**

First reported: 2026-07-27, extended real-world dictation use
Affected area: Linux WebKitGTK overlay window during an active capture

## Symptom

At irregular intervals, roughly ten seconds into a capture, the recording pill
stops updating entirely. The waveform bars freeze, and so does the seconds
timer. The overlay accepts no input at all: no hover feedback, no button click,
no window drag.

Everything behind it keeps working. Audio capture runs to completion, the stop
hotkey ends the session normally, and the transcription is transcribed,
transformed and stored without loss. The overlay recovers on its own once the
session ends.

The combination — the timer stopping *and* input dying, while capture and
pipeline continue — points at a blocked main thread rather than the retained
compositor layers behind [overlay-ghosting.md](overlay-ghosting.md). A pure
paint suspension would normally leave input handling intact.

## Reproduction Status

Observed **only under `npm run tauri dev`**. It has not been tested against a
release build. This distinction is not cosmetic: the overlay carries render
instrumentation that compiles to a no-op in production (see *Contributing load*
below), so it is currently unknown whether the defect exists in the product
path at all.

## Measurements (2026-07-27)

From `/tmp/kilo/overlay-diag.log` (2371 lines, four captures), correlated to
the capture sessions in `~/.config/WordScript/logs/wordscript-runtime.log` by
duration. Each burst is a run of consecutive, identical `[ov-render]` lines.

| Burst | Renders | Wall clock | Rate | Runtime log |
|---|---|---|---|---|
| 1 | 717 | 35.81 s | 20.0 /s | native-1, 35.87 s audio |
| 2 | 605 | 30.44 s | 19.9 /s | native-2, 30.35 s audio |
| 3 | 713 | **52.48 s** | **13.6 /s** | native-3, 52.37 s audio |
| 4 | 212 | 10.77 s | 19.7 /s | native-4, 10.63 s audio |

Audio is complete in all four sessions; no samples were lost. Burst 3 drops to
13.6 renders per second. At the nominal rate the session should have produced
roughly 1050 renders; it produced 713. About **17 seconds of UI activity are
missing** from a capture that ran cleanly on the audio side.

### Why this is a suspicion and not a proof

`audioPayloadToLevel` (`src/windows/OverlayWindow.tsx:120-130`) returns exactly
`0` below its silence threshold. Calling `setAudioLevel(0)` when the state is
already `0` makes React skip the re-render via `Object.is`. A 52-second
dictation containing ~24 seconds of thinking pauses produces the same
statistics as a 17-second freeze.

The current telemetry cannot separate the two. Neither the runtime log nor the
diagnostic log carries timestamps, and the runtime log has no notion of the
overlay layer at all, so the outage cannot be located inside a burst or
correlated across layers. Closing that gap is the prerequisite for any fix.

## Environment Where Observed

- KDE Plasma 6 on a Wayland session; the app itself runs on XWayland, so the
  documented `GDK_BACKEND=x11` default is in effect.
- Hybrid GPU: Intel Raptor Lake UHD plus NVIDIA RTX 4060 Mobile.
- `/etc/environment` sets `__NV_PRIME_RENDER_OFFLOAD=1` and
  `__GLX_VENDOR_LIBRARY_NAME=nvidia` globally, so *every* GL client — including
  the WebKitGTK compositor — renders through PRIME offload on the discrete GPU
  while the display hangs off the integrated one.
- webkit2gtk-4.1 2.52.4-1, kernel 7.0.12-1-cachyos.

Correlating system journal entries:

- `nv_drm_semsurf_fence_wait_ioctl ... *ERROR* ... Failed to register
  auto-value-update on pre-wait value for sync FD semaphore surface` — three
  occurrences over two days. Fence-level trouble in the NVIDIA stack is real on
  this machine.
- `kwin_wayland: The main thread was hanging temporarily!`
- `Applying output configuration failed!` ten times over two days, alongside
  powerdevil screen-change bursts, i.e. repeated monitor re-enumeration.

## Render Driver

- `core::capture` emits `audio_level` every **42 ms (~24 Hz)** through
  `app.emit`, **directly from the cpal realtime audio callback**
  (`src-tauri/src/core/capture.rs:30`, `:1109-1125`). The result is discarded
  (`let _ = app.emit(...)`), so failed emits are invisible.
- `src/windows/OverlayWindow.tsx:812-820` keeps a dedicated listener for
  `audio_level` that calls `setAudioLevel`, re-rendering per event.
  `src/hooks/useRuntime.ts:184-186` deliberately filters `audio_level` out of
  the global reducer so the whole app does not re-render.
- The seconds timer is client-side only (`setInterval` at 1000 ms,
  `OverlayWindow.tsx:904-937`); the runtime emits no tick for it.

## Contributing load (development builds only)

All of the following are no-ops in a production build, which is why the
release-versus-dev comparison is the decisive first measurement:

- `diagLog(...)` sits **in the render body** (`OverlayWindow.tsx:745`) and fires
  `console.warn` plus `invoke("append_diag_log")` on every render, roughly
  doubling the overlay window's IPC traffic at ~24 Hz.
- `append_diag_log` (`src-tauri/src/lib.rs:2068-2086`) opens, writes and closes
  the file per line.
- `read_diag_log` (`lib.rs:2089-2092`) reads the **entire** file. The diagnostic
  panel polls it every 500 ms
  (`src/components/settings/OverlayDiagPanel.tsx:12`, `:32-36`) and truncates to
  50 000 characters only **in the frontend**, so the IPC payload stays the full,
  unbounded file — 195 KB every 500 ms after four minutes, several MB after an
  hour, marshalled to the settings webview across the GTK main thread. This is
  active only while the `overlay_diag` tab is open
  (`src/windows/SettingsWindow.tsx:361`), making it a conditional but sharp
  amplifier.

## Hypotheses

Ordered by expected value, to be resolved by measurement rather than argument.

1. **Development instrumentation saturates the IPC and GTK main loop.**
   Explains the full freeze, the dead input, the irregularity, and why it
   worsens with session length. Also explains missing renders, since
   `let _ = app.emit(...)` drops failures silently.
2. **`app.emit` from the realtime audio callback.** JSON serialization
   including the waveform array happens inside the cpal callback, behind a
   `std::sync::Mutex` that mute, pause and the monitor task also take. This is
   the least sound part of the recording path regardless of whether it is
   today's trigger.
3. **GPU stack: PRIME offload to the discrete GPU.** Set globally and therefore
   applied to the WebKitGTK compositor unintentionally; the journal fence errors
   show the stack is genuinely unhappy. This is the "it is the system's fault"
   branch, and it is cheap to test.
4. **Monitor re-enumeration.** Screen-change bursts occur at a matching order of
   magnitude and are documented to touch overlay placement.

## Instrumentation (in place since 2026-07-27)

The measurements above could not decide the question, so the following landed
first. None of it changes product behavior.

- **Timestamps in both logs.** `core::runtime_log` prefixes every line with
  `[<epoch_ms> +<seconds_since_process_start>]`, and `append_diag_log` prefixes
  overlay lines with the matching `[<epoch_ms>]`. The runtime log, the overlay
  diagnostic log and `journalctl` can now be lined up against each other.
  Convert an epoch value with `date -d @<seconds>`.
- **Level-emit accounting.** Every capture logs on stop, including discarded
  ones:
  `[WordScript] Capture level emits wall_seconds=… expected=… attempted=…
  failed=… shortfall_ratio=… slowest_emit_ms=…`.
  `expected` is the wall duration divided by the 42 ms interval;
  `shortfall_ratio` is the fraction of intervals that never reached the
  overlay. `slowest_emit_ms` times `app.emit` from inside the realtime audio
  callback, so a high value indicts the emit path directly.
- **Main-thread heartbeat.** A dev-only 250 ms interval in the overlay logs
  `[ov-beat] stalled_ms=… expected_ms=250 status=…` whenever an interval lands
  later than 400 ms. It logs nothing while the main thread is healthy.

### Reading the result

| Heartbeat gap | Emit shortfall | Reading |
|---|---|---|
| yes | yes | Real freeze; the main thread stalled and emits were dropped |
| no | yes | Runtime-side emit loss without a webview stall |
| no | no | Silence, not a freeze — the overlay correctly skipped re-renders |

The third row closes this entry as not reproducible.

## Resolution

Open, pending measurement. Remaining order:

1. Compare a release build against the dev build before changing anything else.
   The instrumentation above except the heartbeat and the render trace is
   active in both.
2. Only if it reproduces in a release build, move `audio_level` emission out of
   the realtime audio callback — into the existing 200 ms monitor task or a
   dedicated emit task fed by a channel.
3. Verify the GPU branch by starting with PRIME offload neutralized
   (`env -u __NV_PRIME_RENDER_OFFLOAD -u __GLX_VENDOR_LIBRARY_NAME`) and with
   `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1`.

The dev-only load described above has already been reduced: the per-render
trace is opt-in behind `VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1` and now runs in
an effect rather than the render body, `read_diag_log` returns only the tail
instead of the whole file, and `append_diag_log` reuses one file handle and
rotates at 8 MB.

## References

- [AGENTS.md](../../AGENTS.md): Linux overlay constraints
- [PLATFORMS.md](../PLATFORMS.md): Linux runtime behavior
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md): `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING`
  hardware opt-out
- [diag-log-write-surface.md](diag-log-write-surface.md): the hardening finding
  against the diagnostic log this investigation relies on
- [overlay-ghosting.md](overlay-ghosting.md): the related but distinct retained
  compositor layer failure class
- [OVERLAY_MODE_CYCLING_GHOSTING_ACCEPTED.md](../handoffs/OVERLAY_MODE_CYCLING_GHOSTING_ACCEPTED.md):
  why compositor iterations are not restarted without new reproducible impact
