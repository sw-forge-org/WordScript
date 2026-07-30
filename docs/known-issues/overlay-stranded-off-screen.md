# Bug: The overlay is placed where no monitor is

Status: **Fixed in code (2026-07-30, ADR 0022); not yet confirmed through a
monitor change in a live session**

First reported: 2026-07-30, as "the overlay becomes completely invisible
mid-recording despite always-on-top"
Affected area: overlay window placement on multi-monitor layouts, all platforms;
observed on Linux/XWayland

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

## References

- [ADR 0022](../decisions/0022-a-window-on-no-monitor-is-never-a-position-the-user-chose.md)
- [overlay-recording-freeze.md](overlay-recording-freeze.md): the report this was
  mistaken for
- [overlay-leave-hold-dead-actions.md](overlay-leave-hold-dead-actions.md): the
  other half of "I cannot copy at the end"
- [overlay-placement-persist.md](overlay-placement-persist.md): K1/K2, why the
  drag position must survive a resize
