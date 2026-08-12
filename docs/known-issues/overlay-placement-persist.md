# Bug: Remembered Overlay Drag Position Did Not Persist

Status: **Resolved (2026-07-08)**

First reported: 2026-07-08 on CachyOS KDE Plasma Wayland/X11
Affected area: cross-platform overlay placement persistence

## Symptom

After dragging the overlay, a later dictation could reopen it at an earlier
position, a default bottom-right anchor, or an offscreen location instead of
the final dragged position.

## Root Causes

Three independent causes combined:

1. **Drag debounce ended the session early.** The 180 ms persist debounce in
   `OverlayWindow.tsx` cleared `dragSessionActiveRef` after its first write.
   Later `onMoved` events from the same drag were discarded, preserving an
   intermediate position.
2. **Reveal grace suppressed real drags.** The 420 ms reveal guard discarded
   move events even after a real drag intent had begun.
3. **GTK/XWayland discarded pre-show placement.** Setting the window position
   while hidden could be overwritten by `show()`. A concurrent Rust trigger
   reveal and frontend visibility sync could both issue the same reveal path.

## Resolution

- Persistence no longer ends an active drag. Only pointer completion, cancel,
  blur, or the 2-second grace timeout ends the session.
- Reveal suppression only applies when no drag intent exists.
- The native host reapplies position after `show()` on every platform.
- The native shown flag is set before positioning and showing the window, so a
  concurrent reveal observes it and skips duplicate work.

## Tests and Verification

Frontend tests cover preservation of the final position across multiple move
events and a drag that begins inside the reveal grace window. The native reveal
path was verified on KDE Plasma XWayland. Recheck manual drag placement in the
native host after changes to overlay visibility or placement behavior.

## Guardrails

- Persist only positions produced by real user drags, never programmatic moves.
- Compact, processing, preview, and result surfaces share one remembered
  top-left position.
- Resolve a missing monitor identity from the saved logical drag reference and
  available work areas via `resolve_overlay_monitor`; do not default a manual
  position to the primary display. Only preset mode without an identity match
  falls back to primary.
- Suppress button activation until the actual drag ends.

## References

- [REFERENCE.md](../REFERENCE.md): overlay constants the placement must respect
- [overlay-ghosting.md](overlay-ghosting.md): independent visual compositor issue
- [../archive/handoffs/overlay-linux-black-block.md](../archive/handoffs/overlay-linux-black-block.md): related native host behavior
