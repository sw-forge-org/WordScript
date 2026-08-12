# Hand-Off: Overlay Mode-Cycling Ghosting Residual Investigation

Status: **Superseded by `overlay-mode-cycling-accepted.md`**

This historical investigation reduced rapid mode-cycle ghosting from roughly
27 px to a near-invisible edge artifact and removed the visible remount flash.
It is retained for diagnostics context only.

## Findings

- Scheduling overlay reveal through `queueMicrotask` rather than
  `requestAnimationFrame` aligned native sizing with the React commit and
  removed the main black flash.
- Applying `zoom: 0.87` to the stable shell changed layout scaling without
  creating the same visual transform-layer behavior.
- Width locking, forced ModeChip remounts, and other surface workarounds were
  evaluated but were not retained in the accepted final state.

## Follow-Up

Use the accepted-state hand-off and its permanent development diagnostics for
future investigation. Do not treat this intermediate plan as an active fix.
