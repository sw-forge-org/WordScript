# Bug: Overlay Ghosting and State Bleeding

Status: **Resolved (2026-07-08)**

First reported: Phase 2 follow-up after extended real-world use
Affected area: Linux WebKitGTK overlay surface transitions

## Symptom

During a transition from recording to result actions, or when a new recording
began while the prior surface was leaving, pixels from the old pill could appear
through the new pill. The failure looked like rounded corners becoming square,
waveform bars bleeding into result actions, or a briefly overlaid prior state.

## Root Cause

The decisive cause was the semi-transparent pill background
`rgba(27,27,29,0.90)`. WebKitGTK does not deterministically invalidate retained
compositor layers; the remaining ten percent transparency exposed cached pixels
from the previous surface. Repaint attempts alone could not guarantee a clean
frame.

The investigation also confirmed that this was not a DOM leak or a session
state-machine race: one overlay pill remained in the DOM and the leaving-state
timer guards were correct. Transform placement, remount behavior, and native
repaint timing were contributing conditions explored during the diagnosis.

## Resolution

The pill surfaces are now opaque:

- `--ov-surface: #1b1b1d`
- `--ov-surface-strong: #141416`

Opaque paint blocks residual cached pixels even when WebKitGTK retains an old
layer. The visual difference is negligible because the transparent overlay
window cannot show desktop content through the pill. Existing defense-in-depth
behavior remains: native background repainting on reveal, compositor-safe
surface handling, and a direct leaving-to-entering transition.

## Historical Investigation

The following ideas were tested before the final root cause was confirmed:

- Remounting the pill by kind caused unreliable compositor cache churn and was
  not sufficient on its own.
- Adding the pill kind to a layout-effect dependency could request native sync,
  but IPC timing could not guarantee repaint before the next frame.
- Removing transforms or relying on a size jiggle addressed layer behavior but
  did not block cached pixels deterministically.
- A stable pill DOM remains a useful design principle, but opacity was the
  required correctness fix.

## Regression Checks

- Recording -> processing -> result actions -> edit/error -> idle has no visual
  overlap.
- Starting a new recording during the leave transition does not expose the
  prior state.
- Pill size and visual hierarchy remain stable.
- Validate in the native Linux host as well as with `npm run build` and tests.

## References

- [AGENTS.md](../../AGENTS.md): Linux overlay constraints
- [PLATFORMS.md](../PLATFORMS.md): Linux runtime behavior
- [OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md](../handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md): related compositor history
