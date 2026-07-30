# 0022 -- A window on no monitor is never a position the user chose

Date: 2026-07-30
Status: accepted

## Context

`reveal_overlay_window_impl` positioned the overlay only on the hidden->visible
transition:

```rust
if !was_visible {
    OVERLAY_WINDOW_SHOWN.store(true, Ordering::Relaxed);
    if let Some(position) = overlay_target_position(...) { ... }
}
```

That gate exists for a real reason. An in-place resize -- a mode change during
recording, the 1px repaint oscillation, a surface swap -- must not snap a
dragged pill back to its configured anchor. Recomputing the position on every
reveal is what made overlay states jump between monitors within one session,
which is why the authoritative `OVERLAY_WINDOW_SHOWN` flag replaced
`window.is_visible()` in the first place.

The gate also had a consequence nobody chose: while the overlay is shown,
*nothing* recomputes its position. A monitor topology change during an active
session -- hotplug, resolution or DPI switch, dock, wake, a KDE "Applying output
configuration failed!" retry -- leaves the window at coordinates that were valid
for the previous topology.

Stale coordinates are not merely off-centre. The union bounding box of a
staggered multi-monitor layout contains regions no monitor covers. Measured on
the reporting machine: HDMI-A-3 at x 0..2400 / y 218..1568 and eDP-1 at
x 2400..4320 / y 0..1200 give a 4320x1568 box of which **18.3% is covered by no
monitor at all**. The overlay was observed at (3840,1508) -- inside the box, on
nothing.

The user-visible result was reported as a freeze: "the overlay becomes
completely invisible mid-recording although the recording keeps running, and
pressing the stop hotkey brings it back." It was never a freeze. The heartbeat
(`[ov-beat]`) recorded no main-thread stall in any of those sessions and the
capture level-emit shortfall stayed at its 4% baseline. The pill was painted
nowhere. Stop "fixed" it because ending the session parks the window
(`hide()` + `OVERLAY_WINDOW_SHOWN = false`), and the next reveal then re-entered
the positioning branch with fresh monitor geometry.

## Decision

**A position that intersects no monitor work area is not a position the user
chose, and the drag protection does not extend to it.**

The overlay is repositioned when it is hidden->visible (unchanged), and
additionally whenever it is shown but its rectangle intersects no work area.

Three properties make this safe against the reason the gate exists:

- **Intersection, not containment.** A pill hanging over an edge is visible and
  is left alone. Only a rectangle sharing no pixel with any monitor qualifies.
- **No evidence means no action.** If monitors cannot be enumerated,
  `overlay_rect_is_off_all_work_areas` reports `false`. The runtime never fights
  a topology it cannot see.
- **The check is a predicate over geometry**, not over intent. It cannot fire
  for a window the user can point at.

Detection runs in two places, both existing paths rather than new machinery:

- Every reveal, which covers all surface changes including the end of a session.
- The 200 ms capture monitor loop, on a 2 s cadence
  (`OVERLAY_STRANDED_CHECK_INTERVAL_TICKS`). A long recording produces no
  reveals at all, so without this a mid-capture strand would go uncorrected
  until the session ended. The slow cadence is deliberate: monitor enumeration
  is a compositor round trip, and the recording path is the one place where
  added main-thread work is least welcome.

**The park move is best-effort and is documented as such.**
`overlay_offscreen_position` requests a position past the bottom-right of the
union box. X11/KWin refuses to place a window fully outside the screen and
clamps it back: (4392,1640) requested, (3840,1508) applied. Parking is therefore
carried by `hide()`; the move only helps on compositors that honour it. Both are
kept because `hide()` alone has been unreliable enough on XWayland to warrant
the belt, and the clamping is now logged rather than assumed away.

## Consequences

- The overlay recovers from a monitor change within 2 s during a recording, and
  immediately on any surface change.
- The drag-snap protection is unchanged for every position the user can see.
- The runtime log gains an overlay layer it did not have. Across 755 captures it
  previously carried **zero** lines about placement, park, monitor choice or
  work area, so a misplacement left no trace to read afterwards. It now records
  one line per placement decision and one per park -- not one per reveal, since
  the size and repaint reveals that dominate a session carry no placement and
  would drown the signal.
- The KWin script re-applies its OverlayLayer pin on output changes as well as
  on `windowAdded`. It never hid anything, but it also never restored
  always-on-top after a screen change, which compounds the same trigger.
- Not addressed here: whether a distinct mid-recording freeze exists in which
  the pill is visible but input is dead. Today's data does not reproduce it; see
  `docs/known-issues/overlay-recording-freeze.md`.

## References

- [known-issues/overlay-stranded-off-screen.md](../known-issues/overlay-stranded-off-screen.md):
  the measurement and the failure record
- [known-issues/overlay-recording-freeze.md](../known-issues/overlay-recording-freeze.md):
  the report this was mistaken for, and why the telemetry now separates them
- [known-issues/overlay-placement-persist.md](../known-issues/overlay-placement-persist.md):
  K1/K2, why the drag position must survive a resize
