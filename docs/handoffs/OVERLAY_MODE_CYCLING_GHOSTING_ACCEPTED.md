# Hand-Off: Overlay Mode-Cycling Ghosting Accepted State

Status: **Accepted 2026-07-20**

Mode-cycling state bleeding is no longer observed in live use. A small black
flash and a barely visible horizontal line can remain during rapid mode changes;
they were explicitly accepted as non-blocking. Do not restart compositor-fix
iterations without a new reproducible user impact.

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
