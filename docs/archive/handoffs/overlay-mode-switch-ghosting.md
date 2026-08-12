# Hand-Off: Overlay Mode-Switch Ghosting Investigation

Status: **Superseded by later residual and accepted-state hand-offs**

This record captured the initial 2026-07-19 investigation of overlay state
bleeding during rapid processing-mode changes while recording. It is historical
context only; see `overlay-mode-cycling-accepted.md` for the accepted
operational state.

## Original Symptom

Rapid mode changes could show two pill geometries for one frame. Some trial
fixes also caused a one-frame black remount flash.

## Investigation Findings

- Multiple frontend visibility and size-sync sources could issue competing
  native reveals in the same frame.
- WebKitGTK retained compositor layers unpredictably during size and content
  transitions.
- Component remounts, transforms, and asynchronous host sizing affected the
  symptom but were not standalone correctness fixes.

## Historical Outcome

The initial plan did not fully remove the issue. Subsequent work moved reveal
scheduling, tested shell scaling, reverted intrusive width/remount workarounds,
and retained permanent development diagnostics. The accepted state records the
final user decision.
