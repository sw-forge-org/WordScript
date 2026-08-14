# Bug: Recording Overlay Freezes Mid-Capture

Status: **Reopened 2026-08-13 — the sighting this entry asked for arrived, with
a live capture behind it, and it carries a worse symptom than the one on
record: the session cannot be ended. A candidate cause now exists that the
instrumentation here structurally cannot see, and it is dev-only:
[dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md).**

Previous status (2026-08-03): largely resolved by attribution — the pill stops
moving because the capture stream stops delivering samples; see
[capture-loses-half-the-recording.md](capture-loses-half-the-recording.md).
What was left was the residual signature — dead input while the pill is
visible — which that finding does not explain. That residual is what reopened.

## Addendum 2026-08-13: the sighting with a live capture behind it

The 2026-08-03 addendum ends with a routing rule: *"If a future sighting has a
live capture stream behind it, that is this entry; if the audio is short, it is
the other one."*

The owner reported, 2026-08-13: **the overlay often freezes but the
transcription does not.** It keeps recording, and the text arrives. By the rule
above, that is this entry.

**The *Symptom* section below holds where it matters.** Confirmed by the owner
on 2026-08-13: the stop hotkey ends the session normally, **every shortcut works
every time**, and the overlay does recover. Nothing about the trigger or the
session path is in question, and an earlier draft of this addendum claiming the
recording could not be stopped was wrong.

What does not always happen is the recovery:

> It recovers, definitely, and all the shortcuts work every time — only it
> becomes invisible, and in Copy-to-clipboard-only I can no longer copy the
> text.

So there are **two failures, and they occur both together and separately**:

1. **The freeze alone.** The pill stops and input dies; the hotkey still ends
   the session and the overlay comes back. Recoverable.
2. **The freeze followed by no recovery.** By the time the session ends the
   overlay is invisible, and in `clipboard_only` **the transcript can no longer
   be copied.** This is the damaging one.

The second is the same damage
[overlay-leave-hold-dead-actions.md](overlay-leave-hold-dead-actions.md) was
opened on: *"in `clipboard_only` this is the worst case the product has — that
surface is the only route the mode ever offers to the transcript."* That record
is correctly **Fixed** for its own mechanism (live-looking buttons on dead
handlers, inside a 240 ms leave hold) and scoped itself to the transient half,
handing the persistent half to
[overlay-stranded-off-screen.md](overlay-stranded-off-screen.md).

**A third route to that damage now exists**, and it is neither: a surface that
is not dead and not mis-placed, but *destroyed and remounted empty*. All three
end at the same place — the only route to the transcript is gone — which is why
the reported sentence has now been filed under three records in six weeks.

### A candidate cause, and why nothing here could have found it

`npm run tauri dev` issues **about 1,389 vite full reloads in 2.5 days**,
because the dev server watches 32,576 files under `donors/` and 4,078 under
`vendor/`. A full reload destroys and rebuilds the webview of every window.
**33 captures in the runtime log had at least one reload while they were
recording** — the longest a 197.6 s capture with 22 of them, whose audio is
untouched (`missing_ratio=0.0002`). Cause, counts and log signature are in
[dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md).

That matches the report exactly: the overlay's React app is destroyed, so the
pill stops and input dies; it remounts with no session state, so it renders
nothing and the window reads as invisible; Rust owns the capture, so recording
and transcription continue, stoppable by hotkey throughout; and the only
`clipboard_only` route to the finished text goes with the frontend.

**Why the instrumentation here is blind to it.** The main-thread heartbeat logs
`[ov-beat] stalled_ms=…` when a 250 ms interval lands late. A full reload does
not make an interval land late — it **destroys the JS context the interval
lives in**. The new page starts a new heartbeat with a clean clock. A reload is
therefore *indistinguishable from silence* to this instrument, and the
"Reading the result" table below has no row for it.

This does not resurrect hypothesis 1. That hypothesis named a specific
mechanism — dev instrumentation saturating the IPC and GTK main loop — and the
heartbeat did refute *that*. What it shows is that the inference "the heartbeat
is clean, therefore dev-only causes are dead" was too broad: a dev-only cause
that removes the heartbeat rather than delaying it was never on the list.

### What to do about it here

1. Fix the watcher first (one edit, in the other record). It is free and it
   removes the confound from every subsequent overlay measurement.
2. Add the missing row to the decision table: **webview replaced** — no
   heartbeat gap, no emit shortfall, but a `[trigger] event=register
   outcome=skipped_idempotent` triple inside the capture window. That triple is
   the only in-log evidence a reload happened; see the other record for why.
3. Have the overlay survive a remount, or fail loudly. The frontend remounts
   with no session state while Rust is still recording or holding a staged
   preview, and shows nothing. Rust knows what is active — the overlay should
   ask on mount and restore the surface it was showing.
4. **Take the session's completion away from this window** — [ADR
   0134](../decisions/0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md),
   and it outranks everything else here. Every insert call site is an `invoke`
   from `OverlayWindow.tsx`, and the clipboard write, the history record and the
   transcript file are all created inside that insert. So a freeze that ends in
   no recovery does not merely hide the text — **it prevents the text from ever
   being written**. Measured: 1.12 s median preview→insert, but 11–115 s in the
   13 sessions whose webview was destroyed mid-preview, and one transcript lost
   outright to an app restart. Once the runtime commits on its own deadline,
   this record's failure costs a surface instead of a dictation.
5. Re-measure after 1. If the freeze still occurs with no reload triple in the
   window, the residual signature is real and independent, and the
   release-versus-dev comparison below is finally worth running. The owner
   reports the two failures occur **separately as well as together**, so
   expect the freeze to survive the watcher fix in some form.

## Addendum 2026-08-03: the freeze is a capture stall, not a render stall

Reported again as "the overlay still freezes". This time it reproduced in the
measurement, and the answer came from the instrumentation this document asked
for in 2026-07-27 — specifically from the emit accounting, read against a
counter nobody had compared it to.

Eight captures out of 782 show `shortfall_ratio` between 0.155 and 0.540 against
a baseline whose maximum is 0.0909. In every one of them the recorded audio is
short by the same fraction that the emits are short: over 353 captures of at
least 20 s, **Pearson r = 0.9999** between `shortfall_ratio` and the missing
fraction of wall-clock audio. The worst case lost 52 % of a 405 s dictation.

That is the **second row** of the decision table below — *runtime-side emit loss
without a webview stall* — observed for the first time, and it settles the
question this entry was opened on:

- `[ov-beat]` is still absent from `/tmp/kilo/overlay-diag.log` while the other
  four `[ov-*]` kinds log normally, so the main thread is healthy.
- `failed=0` and `slowest_emit_ms` of 0–1 in every affected capture, so the emit
  path is healthy.
- The overlay stops updating because there is nothing to update it with. **That
  is correct behavior for a stream that has stopped.**

Hypotheses 1 (development instrumentation) and 3 (PRIME offload) are effectively
dead: both predict a stalled webview, and the heartbeat says there is none.
Hypothesis 2 — the emit sitting inside the realtime cpal callback — is not the
cause either, but it is now the reason the failure is *invisible*: a callback
that is not being called cannot report that it is not being called.

The measurement, the eight captures and the next steps live in
[capture-loses-half-the-recording.md](capture-loses-half-the-recording.md). The
damage is not cosmetic and it is not an overlay problem, so it was filed on its
own.

**What stays open here.** The 2026-07-27 report also describes hover, click and
drag dying — input death, not just a stopped animation. A stalled audio stream
does not explain that, and no measurement has reproduced it. If a future
sighting has a live capture stream behind it, that is this entry; if the audio
is short, it is the other one.

## Addendum 2026-07-30: measured, not reproduced

A fresh report of "the overlay freezes mid-recording" was measured with the
instrumentation this document asked for. It was not a freeze.

- `/tmp/kilo/overlay-diag.log` contains **no `[ov-beat]` line at all** across
  every capture that day. The heartbeat was running: `ps` confirmed
  `target/debug/wordscript` under `npm run tauri dev`, and `[ov-dom]`,
  `[ov-sched]`, `[ov-repaint]` and `[ov-reveal]` reach the same log through the
  same `import.meta.env.DEV` gate. So the main thread never stalled >=400 ms.
- Level-emit accounting over the last 20 captures: `shortfall_ratio` 0.037-0.049
  — the baseline, not a shortfall — with `failed=0` and `slowest_emit_ms=0..1`.

By the decision table below that is the third row: **silence, not a freeze**.

The actual cause of those sightings was placement: the overlay was measured at
(3840,1508) on a two-monitor layout whose union bounding box is 18.3% dead zone,
i.e. painted nowhere. See
[overlay-stranded-off-screen.md](overlay-stranded-off-screen.md) and ADR 0022.

This does **not** close the entry. The 2026-07-27 report describes a different
signature — the pill *visible* while hover, click and drag all die — which
placement cannot explain and which today's data neither reproduces nor refutes.
The remaining order below stands, starting with the release-versus-dev
comparison. Re-measure after the placement fix has been in use for a while: if
`[ov-beat]` stays empty across a long dictation session, this entry closes as
not reproducible.

Historical status when filed: **Open — not yet proven to exist in the product
path**

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

| Heartbeat gap | Emit shortfall | Register triple in window | Reading |
|---|---|---|---|
| yes | yes | — | Real freeze; the main thread stalled and emits were dropped |
| no | yes | — | Runtime-side emit loss without a webview stall |
| no | no | **yes** | **Webview replaced by a dev-server full reload** (added 2026-08-13) |
| no | no | no | Silence, not a freeze — the overlay correctly skipped re-renders |

The last row closes this entry as not reproducible — but only once the third
row has been excluded. Before 2026-08-13 the two were read as one, because a
reload leaves exactly the signature of silence: it destroys the heartbeat
rather than delaying it, so `[ov-beat]` cannot report it. The third column is
`[trigger] event=register outcome=skipped_idempotent`, three at a time, inside
the capture window; see
[dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md).

### 2026-08-14 — one of the shapes is no longer this record's

**A blank pill during a live capture, after a reload, is now a restored pill**
(ADR 0151). The overlay asks the runtime what is running when it mounts, so the
third row of the table above stops *looking* like a freeze from the user's side:
the capture keeps running and the pill comes back with the elapsed time the
session actually has.

**This closes nothing here.** It removes a confusion, not a cause: a reload was
already distinguishable from a stall by the register triple, and the freeze this
record is about — the one with a heartbeat gap in it — is untouched. What
changes is that "the overlay went blank mid-recording" is no longer a report
that could mean either, because the reload case now repaints itself.

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

- [REFERENCE.md](../REFERENCE.md): Linux overlay constants and CSS invariants
- [PLATFORMS.md](../PLATFORMS.md): Linux runtime behavior
- [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md): `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING`
  hardware opt-out
- [diag-log-write-surface.md](diag-log-write-surface.md): the hardening finding
  against the diagnostic log this investigation relies on
- [overlay-ghosting.md](overlay-ghosting.md): the related but distinct retained
  compositor layer failure class
- [../archive/handoffs/overlay-mode-cycling-accepted.md](../archive/handoffs/overlay-mode-cycling-accepted.md):
  why compositor iterations are not restarted without new reproducible impact
