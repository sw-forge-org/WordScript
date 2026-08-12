# Bug: A drag session never ended, disabling both overlay layout effects

Status: **Resolved (2026-07-27)**

First reported: 2026-07-27, as "switching modes in the idle mode picker stacks
the overlays on top of each other"
Affected area: overlay drag handling, all platforms

## Symptom

Cycling processing modes in the idle mode picker left the previous mode's pill
painted underneath the new one. It read as a compositor artifact and looked like
the residual described in
[../archive/handoffs/overlay-mode-cycling-accepted.md](../archive/handoffs/overlay-mode-cycling-accepted.md),
only much more visible.

It was not a compositor problem.

## Root Cause

`dragSessionActiveRef` stayed `true` for the rest of the process after the first
overlay drag. Both overlay layout effects — the per-surface size sync and the
visual-epoch repaint — start with `if (dragSessionActiveRef.current) return;`,
so from that first drag on, neither ever ran again.

The only code that ever cleared the ref was a grace timeout, armed by
`clearDragIntent` on pointerup/pointercancel/blur. The `onMoved` persist handler
**cancelled** that timeout after saving the position, and deliberately did not
clear the ref itself — that had been the fix for K1 (clearing it after the first
180 ms debounce dropped every later `onMoved` of a long drag, so only an
intermediate position was persisted). Cancelling the timeout removed the one
remaining path that ends a drag session.

This matters most for a mode change, because that is the case with the fewest
other defences: `pillState.kind` stays the same, so the `key={pillState.kind}`
remount does not fire, and the surface does not change, so the `isActive` effect
does not fire either. The visual-epoch layout effect is the **only** trigger for
a native repaint there — and it was dead.

## Evidence

From `/tmp/kilo/overlay-diag.log`, one session:

- `[ov-dom]` (size layout effect) and `[ov-repaint]` (visual-epoch layout
  effect) appear only up to `1785175681193`, then never again — although the
  surface changed dozens of times afterwards.
- Every `[ov-sched] schedule` after that point carries `w=- h=-`, i.e. it comes
  from the `isActive` effect, the only reveal source without a drag guard.
- Two `mode_picker` reveals 7.3 s apart (`…165679`, `…172989`) match open →
  6 s auto-close → reopen. A mode *cycle* inside the open picker produced no
  reveal at all.

## Resolution

The grace timeout is re-armed instead of cancelled (`armDragSessionEnd`, shared
by `clearDragIntent` and the persist handler). A long drag keeps pushing the
deadline out, so K1 stays fixed; once the moves stop, the session ends after
`DRAG_SESSION_END_GRACE_MS`.

Regression test: `OverlayWindow.test.tsx`, "ends the drag session after the
moves stop so a mode change still repaints (K3)". It drags, waits past the grace
window, then cycles the mode and asserts that a native reveal still happens.
Verified to fail against the pre-fix behaviour.

## Consequences for other documents

- The mode-cycling residual accepted on 2026-07-20 was measured on a build that
  carried this defect. Its conclusion — that the remaining artifact is a
  WebKitGTK compositor limit — is no longer supported by evidence and should be
  re-measured before anything is built on it.
- The per-surface `width`/`height` overrides that the size layout effect passes
  to `scheduleReveal` are almost always discarded anyway: the serializer is
  latest-wins within a tick, and the `isActive` effect and the visual-epoch
  effect both schedule afterwards without geometry. Rust then falls back to
  `OverlaySurface::dimensions()`, which happens to carry the same numbers. That
  is another correctness-by-coincidence and worth cleaning up separately; it is
  not what caused this bug.

## References

- [overlay-ghosting.md](overlay-ghosting.md): the genuine compositor failure
  class, distinct from this one.
- [overlay-placement-persist.md](overlay-placement-persist.md): K1/K2, the
  reason the persist handler must not clear the session itself.
- [../archive/handoffs/overlay-mode-cycling-accepted.md](../archive/handoffs/overlay-mode-cycling-accepted.md):
  the accepted-state record this finding calls into question.
