# Hand-Off: Overlay Mode-Cycling Ghosting Accepted State

Status: **Accepted 2026-07-20 — conclusion invalidated 2026-07-27**

Mode-cycling state bleeding is no longer observed in live use. A small black
flash and a barely visible horizontal line can remain during rapid mode changes;
they were explicitly accepted as non-blocking. Do not restart compositor-fix
iterations without a new reproducible user impact.

## 2026-07-27: the accepted residual was not a compositor limit

A reproducible user impact did arrive — mode switching in the idle picker
stacked the pills visibly — and the cause turned out not to be the compositor
at all. `dragSessionActiveRef` stayed `true` for the rest of the process after
the first overlay drag, and both overlay layout effects bail on it. The
visual-epoch repaint is the only native repaint trigger for a same-kind visual
change such as a mode cycle, so after any drag a mode change forced no repaint
whatsoever. See
[overlay-drag-session-never-ends.md](../../known-issues/overlay-drag-session-never-ends.md)
for the diagnostic-log evidence and the fix.

Consequence for this document: the measurements behind the accepted state were
taken on a build carrying that defect, so "what remains is a WebKitGTK
compositor limit" is no longer supported. The retained work listed below still
stands as implemented behaviour; the *conclusion* does not. Re-measure before
building anything on it.

## Retained Work

- Development-only overlay diagnostics remain permanent: native DevTools access,
  append/read/clear log commands, a settings diagnostic panel, and `[ov-*]`
  frontend traces.
- The former fixed-width ModeChip and forced component-key workaround was
  reverted. The pill uses natural width again.
- Retain `queueMicrotask` reveal scheduling and the neutral `zoom: 0.87`
  treatment that were live-tested during the investigation.

## Historical Context

The predecessor residual plan reduced a large artifact to a near-invisible one.
This accepted state reverted the intrusive workaround after live verification
that normal mode switching no longer overlays states. The diagnostic tooling is
kept for any future reproducible regression.
