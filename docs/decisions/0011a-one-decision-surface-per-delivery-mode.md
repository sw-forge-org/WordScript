# 0011a -- One decision surface per delivery mode

Date: 2026-07-27
Status: accepted

## Context

The overlay has two delivery modes, set per text profile as
`work_mode.insert_behavior`:

- `auto_paste` ("Copy and insert at cursor") -- the pipeline inserts the text
  itself and then shows the result surface (Copy / Edit / Dismiss).
- `clipboard_only` ("Copy to clipboard only") -- the pipeline stops on a
  processing preview and waits for the user to commit or abort.

Which surface the overlay shows was derived entirely in `OverlayWindow.tsx`
from six local flags plus four helper predicates (`holdPreviewDuringClose`,
`bridgeResultFromStop`, a processing-content snapshot ref and
`pillVisualEpoch`). Each delivery mode had grown its own path through them.

The `bridgeResultFromStop` predicate existed for one reason: the flag that made
the result surface visible was set in an effect, one render *after* the reducer
flipped `status` to `"idle"`. In that single render the session had ended but no
surface had claimed the pill, so a six-condition predicate carried it across.
Only the `auto_paste` path reached that predicate at all (it required
`lastVisibleSurfaceRef.current === "compact"`), and if any of its conditions did
not hold, `pillState` fell to `null` and the pill unmounted for a frame.
Unmounting the processing pill orphans its animated children's WebKitGTK
compositor layers -- the mechanism in `known-issues/overlay-ghosting.md` --
which showed up as the result surface stacking on top of a processing surface
that never went away.

In that same bridge render the component also held two disagreeing surface
values: the raw one (`"compact"`) drove the native reveal and
`lastVisibleSurfaceRef`, the rendered one (`"result_actions"`) drove the window
size. Rust was told a different surface than the one being painted. That was
harmless only because `OverlaySurface::dimensions()` returns 480x60 for every
flat surface -- a layout decision was silently carrying a correctness
requirement.

Separately, the Edit action was unreachable in `clipboard_only`. The button is
not mode-gated (`ResultActions` renders it unconditionally; only Insert is
gated), but the commit flow suppressed the result surface entirely, so the
surface carrying the button was never shown. That suppression existed to
prevent a ghost flash, not as a product decision.

## Decision

**Every delivery mode has exactly one surface on which the user decides, and it
sits where the decision still matters.**

- `clipboard_only` decides on the processing preview, *before* delivery:
  Copy / Edit / Abort. Editing there changes what actually gets delivered. After
  the commit the overlay closes; there is no second surface.
- `auto_paste` decides on the result surface, *after* delivery:
  Copy / Edit / Dismiss. The text is already at the cursor and cannot be
  retracted, so Edit there can only offer the correction on the clipboard. The
  confirm button says so (`confirmLabel`) instead of implying a replacement.

**The visibility of the result surface is runtime state, not a local effect.**
`RuntimeState.resultSurfaceOpen` is set in the same reducer commit that flips
`status` to `"idle"` -- the same atomic-swap guarantee `RECORDING_STARTED`
already gives on the way in. It is derived from `previewStaged`: a session that
staged a processing preview already had its decision surface.

`previewStaged` rather than the live `pendingResult`, because the native-channel
status sync clears `pendingResult` and can arrive *before* the authoritative
`wordscript-event` transcription. And deliberately not keyed on `delivery`: an
`auto_paste` run whose paste fell back to the clipboard also reports
`delivery: "clipboard"`, and that is exactly the case where the user needs the
result surface to retry the insert.

**One surface value leaves the component.** `renderOverlaySurface` drives the
pill, `lastVisibleSurfaceRef`, drag-position persistence and every native
reveal. The only permitted divergence from the live surface is the leave hold,
which replays the outgoing surface while the pill fades.

**An edited preview is delivered through the commit**, not through a separate
`insert_text_native` call. `commit_pending_transcription_preview` takes an
optional `text`; the edit marks the transform as no longer machine-corrected and
appends an `overlay_edit` rule. A separate insert would deliver one text while
the session, history and insert result recorded another.

## Consequences

- `bridgeResultFromStop`, `suppressNextResultActionsRef` and `suppressedResultMs`
  are gone. A `clipboard_only` commit no longer shows a result surface because
  the state says so, not because a flag suppresses it.
- The uniform 480x60 flat-surface geometry stays, but as a layout decision only.
  Per-surface sizes would no longer break the transition.
- Edit is reachable in both modes, and means something different in each. The
  label carries that difference; the two paths are genuinely different actions,
  not one action with a branch.
- The leave hold (`holdPreviewDuringClose`) remains the one place where the
  rendered surface may differ from the live one. It exists for the fade-out, and
  removing it would reintroduce the unmount gap it was built to close. It now
  replays the surface that is actually leaving: a closing edit surface keeps
  painting the edit surface, where it previously shared the result-actions hold
  and flashed a surface the session never showed for the full 240 ms.
- The compositor-layer defences from the earlier ghosting work stay in place:
  opaque pill surfaces, the keyed `<OverlayPill>` remount, the native 1px
  height oscillation and the coalesced reveal. This decision removes a *cause*
  of unmount gaps; it does not make WebKitGTK's layer retention safe to ignore.
- Still open, unchanged: a controlled-commit preview for `auto_paste` as well.
  It is a deliberate non-goal here -- it would add a click to every dictation.
