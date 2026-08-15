# Bug: The overlay is placed where no monitor is

Status: **Reopened 2026-08-03 — reported again from a build that carries the
ADR 0022 fix. The fix works as a rescue and is measurably firing; what it does
not do is prevent the stranding, and the one path that was supposed to catch it
during a recording has never fired at all. Narrowed 2026-08-13: a second
mechanism produces this record's founding sentence, so the mid-session half of
this entry is no longer safely attributable here — see the addendum below.**

First reported: 2026-07-30, as "the overlay becomes completely invisible
mid-recording despite always-on-top"
Reported again: 2026-08-03, same wording, from a build containing `ffe57ee`
Affected area: overlay window placement on multi-monitor layouts, all platforms;
observed on Linux/XWayland

## Addendum 2026-08-13: a second cause owns part of this symptom

This record was opened on the wording *"the overlay becomes completely
invisible mid-recording"*. **A second, unrelated mechanism produces that exact
sentence**, and it is not placement:
[dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md).
A vite full reload destroys and rebuilds every window's webview, so the overlay
remounts with no session state and renders nothing while the window sits at a
perfectly valid position.

Recounted over `wordscript-runtime.log`, 2026-08-10 18:23 to 2026-08-13 00:55:

| Line | Count |
|---|---|
| `Overlay placement … reason=reveal` | 326 |
| `Overlay placement … reason=stranded` | 18 |
| `Overlay stranded off every work area … repositioning` | 18 |
| `Overlay stranded mid-session … repositioning` | **0** |
| placement lines whose `target` fell outside the reported `work_area` | **0 of 344** |
| register triples inside a capture window (= reloads mid-session) | **33 captures** |

Stranding at reveal is still real and still uncaught at the source — 18 in
326 reveals, about one in 18, improved from one in 8 but not gone.

**The mid-session half reads differently now.** The mid-session rescue has
still never fired, not once, across the whole log, and no placement target has
landed outside its work area. Meanwhile mid-session invisibility keeps being
reported, and 33 captures demonstrably had their webview replaced while they
were recording. Two readings survive and they are not exclusive:

1. The mid-session detector does not work, and stranding during a recording is
   real but unobserved. This is what the 2026-08-03 addendum assumed.
2. A share of the mid-session reports were never stranding at all — the window
   was where it should be and had nothing painted in it.

**How to tell them apart in the log**, for the next report:

| | stranded | reload |
|---|---|---|
| `Overlay placement … reason=stranded` near the sighting | yes | no |
| `target` outside `work_area` | yes | no |
| `event=register outcome=skipped_idempotent` triple in the window | no | **yes** |
| the window moves when it comes back | yes | no |

Fix the watcher before re-measuring anything here. Until it is fixed, every
mid-session sighting has two candidate causes and the log cannot be read
cleanly. That is one edit, in the other record.

## Addendum 2026-08-03: the rescue fires, the prevention does not exist

The observability added with the fix answers the reopened report without a new
instrumentation round. Counted over `~/.config/WordScript/logs/wordscript-runtime.log`,
which begins at the log rotation on 2026-07-30 19:54 -- i.e. **entirely after**
`ffe57ee` (2026-07-30 18:08) -- and ends 2026-08-03 06:50. 82.9 hours of real
use.

| Line | Count |
|---|---|
| `Overlay placement … reason=reveal` | 503 |
| `Overlay placement … reason=stranded` (`was_visible=true`) | **65** |
| `Overlay stranded off every work area … repositioning` | 64 |
| `Overlay stranded mid-session … repositioning` | **0** |
| `Overlay parked requested=… applied=…` | 482 |
| … of which `applied` differs from `requested` | **482 (100 %)** |

(The 64-versus-65 gap is one line lost to the rotation boundary, not a second
code path.)

Three findings, in order of what they cost:

**1. The stranding still happens, roughly once every 8 reveals.** 65 reveals in
82.9 hours found an already-visible window sitting on no work area. Each of
those is a window the user could not see until the next reveal happened to
rescue it. ADR 0022 made the reveal a repair; it did not remove the cause. The
report "the overlay disappears" is therefore accurate against this build, and
the entry's old status line -- "not yet confirmed through a monitor change in a
live session" -- was understated: it has now been confirmed 65 times, just never
attributed to a monitor change.

**2. The mid-session check has never fired in 82.9 hours.** `ensure_overlay_on_screen`
(`src-tauri/src/lib.rs`) is the path that was supposed to make a long recording
survivable, and it produced zero lines while the reveal path produced 65. It is
reached only from `spawn_native_capture_monitor`, so it runs **only during an
active native capture**, and only while `OVERLAY_WINDOW_SHOWN` is set. Every
observed stranding happened outside that window -- with the pill visible and
idle. The 2 s cadence is not the problem; the coverage is. Whether a stranding
can *also* occur inside a recording is still unmeasured, because in this corpus
none did.

**3. The park move never lands, on any layout.** All 482 parks report an
`applied` position different from the requested `(4392,1640)`, and the applied
values are scattered across on-screen coordinates -- the window simply stayed
where it was. Parking works exclusively through `hide()`. ADR 0022 already
called the move best-effort; the measurement upgrades that to *never effective
on this platform*, which makes it dead code that logs.

Of those 482 applied positions, **31 are `(3840,1507)` or `(3840,1508)`** -- the
exact dead-zone corner measured below. That is the park clamping the window into
the region no monitor covers. It is the strongest available candidate for what
produces the 65 strandings, and it is a candidate, not a proven cause: nothing
currently correlates a park to the next reveal's `reason`.

### What to do about it, in order

1. Correlate park-to-next-reveal in the existing log (no new code): if a
   `reason=stranded` reveal is reliably preceded by a park whose `applied` is
   the dead-zone corner, the cause is the park, and removing the move -- which
   never works anyway -- removes the defect outright.
2. Move the stranded check off the capture monitor. It has to cover the idle
   visible pill, which is where every observed case lives.
3. Only then revisit the monitor-change hypothesis. It is still unverified and,
   on this evidence, no longer the leading explanation.

## Symptom

During an active capture the overlay disappears entirely. Not occluded, not
behind other windows -- nowhere on the desktop, while the recording keeps
running and audio is captured normally. Pressing the stop hotkey makes it
reappear.

Reported together with, and initially filed as, two other things:

- "the overlay freezes mid-recording" -- see
  [overlay-recording-freeze.md](overlay-recording-freeze.md), a different
  signature (pill visible, input dead)
- "at the end of a recording I cannot copy any more" -- partly this bug (the
  result surface is placed off-screen too) and partly
  [overlay-leave-hold-dead-actions.md](overlay-leave-hold-dead-actions.md)

## Root Cause

`reveal_overlay_window_impl` (`src-tauri/src/lib.rs`) positioned the window only
on the hidden->visible transition. While the overlay was shown -- the entire
duration of a recording -- nothing recomputed its position. A monitor topology
change in that window left stale coordinates in place.

Stale coordinates strand the window because the union bounding box of a
staggered layout contains regions no monitor covers.

## Measurements (2026-07-30)

Taken live against the running process (`xdotool getwindowgeometry` against
`xrandr --listmonitors`):

| Measurement | Value |
|---|---|
| Monitor HDMI-A-3 | x 0..2400, y 218..1568 |
| Monitor eDP-1 | x 2400..4320, y 0..1200 |
| Union bounding box | 4320 x 1568 |
| Share of the box covered by **no** monitor | **18.3 %** |
| Park target from `overlay_offscreen_position` | (4392, 1640) |
| Actual window position | **(3840, 1508)** = box corner minus window size |
| Is (3840,1508) on a monitor? | **No** |

The monitors are offset (HDMI 218 px lower, eDP shorter). Supporting evidence
from the same machine: nine `Applying output configuration failed!` entries in
the journal over three days, plus the powerdevil screen-change bursts already
recorded in [overlay-recording-freeze.md](overlay-recording-freeze.md).

The park value is a second finding: X11/KWin refuses to place a window fully
outside the screen and clamps it back to the edge of the union box. Parking
therefore works because of `hide()`, not because of the move. On a layout whose
bottom-right corner *is* on a monitor, a parked-but-not-hidden pill would be
visible there.

### Why the freeze reading was wrong

For the same sessions:

- `/tmp/kilo/overlay-diag.log` contains **no `[ov-beat]` line at all**. The
  heartbeat was active (dev build confirmed via `ps`; `[ov-dom]`, `[ov-sched]`,
  `[ov-repaint]`, `[ov-reveal]` pass through the same dev gate), so the main
  thread never stalled >=400 ms.
- Capture level-emit accounting over the last 20 captures: `shortfall_ratio`
  0.037-0.049 (baseline), `failed=0`, `slowest_emit_ms=0..1`.

That is the "no gap / no shortfall" row of the decision table in
[overlay-recording-freeze.md](overlay-recording-freeze.md) -- not a freeze.

No data was ever lost: every session reached `history.json` and
`scratchpad.json`, and clipboard-only runs logged `wl-copy clipboard verified`.

## Resolution

ADR 0022. A rectangle intersecting no monitor work area is not a position the
user chose, so the drag-snap protection does not cover it:

- `overlay_rect_is_off_all_work_areas` decides by **intersection**, so a pill
  hanging over an edge is left alone, and reports `false` when no monitors can
  be enumerated so the runtime never fights an invisible topology.
- Reveals rescue a stranded window in addition to the hidden->visible case.
- The existing 200 ms capture monitor loop checks on a 2 s cadence, because a
  long recording produces no reveals at all. Deliberately slow: monitor
  enumeration is a compositor round trip on the path where added main-thread
  work is least welcome.
- The park move is kept, documented as best-effort, and its requested-vs-applied
  position is logged.
- The KWin script re-applies its OverlayLayer pin on output changes, not only on
  `windowAdded`.

## Observability added with the fix

Before, the runtime log carried **zero** overlay-layer lines across 755
captures; the dev-only diagnostic log recorded reveals but never a park, and no
layer recorded monitor topology at all. Now, in every build:

```
[WordScript] Overlay placement surface=… was_visible=… reason=reveal|stranded monitor=… work_area=… target=…
[WordScript] Overlay stranded mid-session rect=(x,y,wxh) — repositioning
[WordScript] Overlay parked requested=… applied=…
```

One line per placement decision rather than per reveal -- the size and repaint
reveals that dominate a session carry no placement and would drown the signal.

## Regression Checks

- Unit tests in `lib.rs` pin the predicate against the measured layout: the
  stranded rect is detected, an on-monitor rect is not, an edge-overlapping rect
  is not, an exactly-abutting rect is, and an empty monitor list reports nothing.
- Live: start a capture, change the monitor arrangement mid-recording
  (`kscreen-doctor` or System Settings), confirm the overlay stays visible and
  the runtime log shows the reposition.
- Counter-check without the fix: `xdotool getwindowgeometry <id>` against
  `xrandr --listmonitors` shows the dead zone directly.

## Addendum 2026-08-15 — the park move stopped being a no-op

Finding 3 above measured the park move as never effective: all 482 parks
reported an `applied` position different from the requested one, because GTK
does not move a hidden window. **That premise no longer holds.** ADR 0155
removed the unmap from the Linux park — the overlay is mapped once at setup and
parked through opacity 0 plus click-through instead, because every X11 map
presents one black frame and that was the flash on every recording start. A
mapped window actually moves, so the park move now lands, and where it lands is
whatever KWin clamps it to.

For this record that cuts both ways and neither has been measured since:

- The 31 parks that ended at the dead-zone corner `(3840,1507/1508)` — the
  strongest candidate here for what produces the strandings — came from a move
  that mostly did not apply. Now it always does.
- The exposure is nevertheless smaller than when those numbers were taken. The
  next reveal overwrites the parked position through the hidden→visible branch,
  and that branch is now reliably entered: `OVERLAY_WINDOW_SHOWN` replaced
  `window.is_visible()`, which lies on XWayland and is why the branch used to be
  skipped.

Step 1 of "What to do about it, in order" (correlate park to the next reveal's
`reason` in the existing log) is therefore worth re-running against a build that
carries ADR 0155, and its earlier conclusion — that the move is dead code that
logs — has to be re-derived rather than reused. Deleting the move outright is
now the cheaper branch than it was, since opacity carries the parking on Linux
and the move protects nothing there.

## References

- [ADR 0022](../decisions/0022-a-window-on-no-monitor-is-never-a-position-the-user-chose.md)
- [ADR 0155](../decisions/0155-the-overlay-stops-being-unmapped-because-every-map-costs-one-black-frame.md):
  why the park no longer unmaps, and what that does to the move measured here
- [overlay-recording-freeze.md](overlay-recording-freeze.md): the report this was
  mistaken for
- [overlay-leave-hold-dead-actions.md](overlay-leave-hold-dead-actions.md): the
  other half of "I cannot copy at the end"
- [overlay-placement-persist.md](overlay-placement-persist.md): K1/K2, why the
  drag position must survive a resize
