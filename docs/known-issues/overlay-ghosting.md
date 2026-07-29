# Bug: Overlay Ghosting and State Bleeding

Status: **Compositor cause resolved (2026-07-08); the `auto_paste` unmount gap
reopened and was closed again (2026-07-29). One axis still open: the same
failure is reported as absent in `Auto` and present in the other five
processing modes -- see the 2026-07-29 addendum.**

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

## Addendum 2026-07-27: the auto_paste bridge render

A second, independent trigger of the same failure class was found in the
`auto_paste` ("Copy and insert at cursor") path and removed structurally.

The result surface's visibility was set in a React effect, one render after the
reducer flipped `status` to `idle`. In that render the session had ended but no
surface had claimed the pill, so a six-condition predicate
(`bridgeResultFromStop`) carried it across. Only the `auto_paste` path reached
that predicate. When any of its conditions did not hold, `pillState` became
`null` and the pill unmounted for a frame — orphaning the processing pill's
animated children's compositor layers. The result surface then mounted on top of
that stale raster: the final overlay appeared to stack on a processing overlay
that never went away.

The same render also held two disagreeing surface values: the raw one drove the
native reveal, the rendered one drove the window size, so Rust was told
`compact` while `result_actions` was painted. That was only harmless because
every flat surface is 480x60.

Fix: `RuntimeState.resultSurfaceOpen` is now set in the same reducer commit that
flips `status` to `idle`, so the gap render does not exist and the bridge
predicate is gone; and `renderOverlaySurface` is the single surface value that
leaves the overlay component. See ADR 0011a.

This does not change the opacity finding above — it removes a cause of unmount
gaps, it does not make WebKitGTK's layer retention safe to ignore.

## Addendum 2026-07-29: the same gap, one axis further out

The addendum above closed the `auto_paste` unmount gap on the *effect* axis. It
stayed open on the *event* axis, and the failure kept being reported live: the
result surface stacking on a processing surface that never went away, only with
"Copy and insert at cursor", and only outside `Auto` mode.

A completed dictation is announced twice, as two IPC messages and therefore two
React commits: first `wordscript-native-event` `transcription` /
`transcription_corrected` (the session-state mirror, carrying only
`last_transcript`), then the authoritative `wordscript-event` `transcription`
with the full payload. `NATIVE_TRANSCRIPTION_SYNC` set `status: "idle"` on the
first one, a commit before `lastResult` and `resultSurfaceOpen` existed. In that
commit nothing owned the pill — `holdPreviewDuringClose` refuses to hold a
`"compact"` surface — so `pillState` fell to `null` and `<OverlayPill>`
unmounted for a frame. Exactly the mechanism described above, reached by a
different route.

Structurally exclusive to `auto_paste`, which is why "Copy to clipboard only"
never showed it: a `clipboard_only` run leaves `"processing_preview"` as the
last live surface, and both the leave hold and the content snapshot cover that.

The test suite had pinned the defect rather than the contract: the
clipboard_only ordering test asserted `status === "idle"` right after the native
sync, and no test covered the `auto_paste` ordering at all.

Fix: the native channel no longer ends a session. See
[ADR 0018](../decisions/0018-the-end-of-a-session-belongs-to-exactly-one-event.md).

### Still open: the mode axis

The same report says the failure is absent in `Auto` and present in the other
five processing modes (Verbatim, Cleanup, Rewrite, Agent, Prompt Enhance). No
code path connects `ProcessingMode` to surface selection, session lifecycle or
delivery — the session state machine is mode-independent end to end. The
remaining candidate is visibility, not causation: the ModeChip label is the only
mode-dependent geometry in the overlay, worth roughly 27px of compact-pill width
between `Auto` (the shortest label) and the longest ones. That is the same 27px
that `796ad59` removed with a fixed ModeChip width and `37768b3` deliberately
restored on cosmetic grounds.

Measure before acting, with the diagnostics that already exist
(`/tmp/kilo/overlay-diag.log`, Settings → "Overlay Diag", DEV only):

```
VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1 npm run tauri dev
```

One dictation in `Auto` and one in `Cleanup`, same profile
(`insert_behavior: auto_paste`), same text length; then diff the `[ov-render]` /
`[ov-sched]` / `[ov-repaint]` / `[ov-reveal]` lines. `[ov-repaint]` already logs
`pillW` and `modeW`. Identical sequences with a ~27px `pillW` difference means
the gap fix above was the only cause and the mode was a visibility modifier;
diverging sequences mean a separate cause.

A geometry change is out of scope by product decision. If a residual remains
after the gap fix, it is measured and recorded here, not bought back
cosmetically.

## Regression Checks

- Recording -> processing -> result actions -> edit/error -> idle has no visual
  overlap.
- Starting a new recording during the leave transition does not expose the
  prior state.
- Pill size and visual hierarchy remain stable.
- The native completion sync does not end the session on its own: the compact
  processing surface keeps the pill until the authoritative transcription
  arrives, then hands it to result-actions in one commit.
- Validate in the native Linux host as well as with `npm run build` and tests.

## References

- [ADR 0018](../decisions/0018-the-end-of-a-session-belongs-to-exactly-one-event.md): the event-ordering fix
- [ADR 0011a](../decisions/0011a-one-decision-surface-per-delivery-mode.md): the effect-ordering fix
- [AGENTS.md](../../AGENTS.md): Linux overlay constraints
- [PLATFORMS.md](../PLATFORMS.md): Linux runtime behavior
- [OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md](../handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md): related compositor history
