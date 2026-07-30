# Bug: Overlay Ghosting and State Bleeding

Status: **Compositor cause resolved (2026-07-08); the `auto_paste` unmount gap
reopened and was closed again (2026-07-29, ADR 0018). Reported again on a build
that already contained that fix. Three further re-entry points into the same gap
class have been closed (ADR 0019), the third one — the edit surface leaving its
own hold mid-fade — found by measurement on 2026-07-30. The instrumented run also
DISPROVED a stalled-leave hypothesis and showed the trace itself had been the
unreliable part. The screenshot's exact stacking is still not reproduced, and the
mode axis is still open.**

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

## Addendum 2026-07-29 (second): reproduced on a build that already had the fix

The failure was reported again from a running dev instance started at 21:12:05,
after the ADR 0018 commit at 21:04:20, on a clean tree. The fix is in the build.
There is a further cause.

What that instance actually did, from its own records:

- One dictation, 21:13:04 to 21:13:06. Processing mode `cleanup`, delivery
  `clipboard_only`. It is the only session in the process, so the screenshot
  belongs to it.
- `/tmp/kilo/overlay-diag.log` shows one transition: `compact`
  (`pillW=281`, `modeW=77`) to `processing_preview` (`pillW=444`). A 163px width
  jump inside the fixed 480x60 window. No `result_actions` surface ever existed.

So the overlap sits on `compact -> processing_preview`, on the `clipboard_only`
path -- not on the `compact -> result_actions` transition that ADR 0011a and
ADR 0018 addressed, and not on `auto_paste`, which both addenda above called
structurally exclusive.

Two re-entry points into the same gap class were found by reading and closed
(ADR 0019). Neither is proven to be *this* report's cause; both were reachable:

1. **`NATIVE_SYNC_TIMEOUT` ended a session without a surface.** The fallback
   ADR 0018 added set `status: "idle"` and cleared `pendingResult`, but not
   `resultSurfaceOpen`. A late authoritative event then flipped that false to
   true one commit later -- the ADR 0018 two-commit gap, re-entered through the
   ADR 0018 fallback. It now ends the session with its surface, and a session
   that has already ended never has its surface re-decided.
2. **`pillVisualEpoch` did not cover the preview surface's clipboard chrome.**
   `previewClipboardOnly` entered the epoch only as
   `previewClipboardOnly && renderResultPreview`. On the processing preview the
   same flag swaps Copy for Insert and toggles `pill--clipboard`, so that
   surface could change its visual identity with no native repaint behind it --
   which on WebKitGTK is the condition under which the previous raster stays.

### The measurement, and what it overturned

Ran on 2026-07-30 with `VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1`: 2085 trace
lines, nine sessions, `#1`..`#2085` contiguous (no lost writes).

**A stalled leave was hypothesized and disproved.** A first instrumented run
appeared to show the `leaving -> idle` transition never running on its own
240 ms timer, arriving instead with the next activation — 1.2 s, 61.6 s and
258.0 s in three consecutive closes. That reading was an artifact of the
instrumentation: the trace flushed its buffer on `requestAnimationFrame`, and
WebKitGTK pauses rAF for the not-visible overlay, so lines emitted during the
leave sat in the buffer until the next wake. The `[epoch-ms]` prefix is the
FLUSH time, so the backlog read as a stall. With a microtask flush the same
transition measures 241-246 ms in 9 of 9 closes, and the heartbeat — extended to
cover `overlayMotion !== "idle"` for exactly this question — reports zero stalls
across the whole run. There is no throttled timer and no un-parked window.

Two lessons worth keeping: a diagnostic that batches on the frame clock cannot
be trusted in a window where the frame clock is the suspect, and a flush-time
prefix must never be read as an emit time.

**The defect the run did find: the edit surface leaves its own hold mid-fade.**
In 4 of 5 edit closes the rendered surface was `edit_mode` at the commit where
`isActive` went false and `compact` at the very next commit — the one where
`motion` becomes `leaving`, i.e. the instant the fade starts:

```
#1379 live=edit_mode surface=edit_mode motion=open    active=true
#1380 live=compact   surface=edit_mode motion=open    active=false   hold engaged
#1381 live=compact   surface=compact   motion=leaving active=false   hold gone
```

`renderEditHold` required `editText.trim().length > 0`. A confirmed edit ends the
session, the new `lastResult` fires the interaction-reset effect, that clears
`editText`, and the hold's own condition went false while the overlay was still
visibly fading. Unmounting a surface mid-fade is the orphaned-layer mechanism at
the top of this document, reached from a fourth direction.

Fixed by giving the edit hold a frozen frame (`lastEditTextSnapshotRef`), the
same pattern the processing hold already used. Pinned by
`OverlayWindow.test.tsx` "keeps painting the edit surface through the fade after
the text is cleared" — without the fix the pill shell is `null`.

**Also measured, and by existing design:** a result surface closed by an
abort/empty has no hold at all (`renderResultPreview` needs `previewResult`,
which `EMPTY` nulls), so its fade runs with no surface. ADR 0018 calls that
exclusion correct — an abort has nothing worth replaying — so it stands, but it
is the remaining place where a visible fade has no painted surface.

**Still not reproduced:** the exact stacking in the 2026-07-29 screenshot. Nine
sessions produced no frame with two surfaces. The edit-hold defect is in the same
failure class and on a surface the user does use, but it is not proof of that
screenshot.

### The diagnostics were not trustworthy enough to measure with

The `[ov-*]` trace is read to decide whether an effect ran. `diagLog` fired one
fire-and-forget `invoke` per line, and concurrent Tauri commands are not ordered
against each other, so a line could be reordered or lost. The 21:13 log has an
`[ov-sched]` from the epoch effect on the `processing_preview` commit with no
`[ov-repaint]` in front of it -- which could mean the effect was skipped by one
of its three guards, or that the write was lost. The log could not tell those
apart.

Lines now carry a monotonic `#n` and are flushed on a **microtask**, so a gap in
the numbering is visible and the flush does not depend on the frame clock. The
first attempt batched on `requestAnimationFrame` and produced the false stall
described above — see that section before changing this again. Also note that the
21:13 run had no `[ov-render]` lines at all: `RENDER_TRACE_ENABLED` needs
`VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1`, and the instance was started without
it. It was not an instrumented run.

The `[ov-beat]` heartbeat now also covers `overlayMotion !== "idle"`, not just an
active session, so a suspended main thread in the leave window is observable
instead of inferred.

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

Since the second addendum the delivery mode has to be varied as well -- the live
report is now on `clipboard_only`, which the earlier analysis had treated as the
safe path. Four dictations, same profile, same text length, log cleared between
runs:

| # | Processing mode | Delivery |
| --- | --- | --- |
| 1 | `auto` | `clipboard_only` |
| 2 | `cleanup` | `clipboard_only` |
| 3 | `auto` | `auto_paste` |
| 4 | `cleanup` | `auto_paste` |

Then diff the `[ov-render]` / `[ov-sched]` / `[ov-repaint]` / `[ov-reveal]`
lines. `[ov-repaint]` already logs `pillW` and `modeW`; `[ov-render]` shows
whether any commit rendered without a surface. Three questions the diff answers:
does a `[ov-repaint]` accompany the `compact -> processing_preview` commit at
all; do the sequences differ between modes beyond the ~27px `pillW`; and is the
`#n` numbering contiguous (a gap means a lost line, not a skipped effect).

Identical sequences with a ~27px `pillW` difference means the mode was a
visibility modifier; diverging sequences mean a separate cause.

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
- The 1500 ms fallback ends the session WITH its surface, and an authoritative
  event arriving after it updates that surface in place instead of mounting a
  second one.
- A delivery-mode change on the processing preview forces a native repaint.
- Validate in the native Linux host as well as with `npm run build` and tests.

## References

- [ADR 0019](../decisions/0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md): the fallback and epoch re-entry points
- [ADR 0018](../decisions/0018-the-end-of-a-session-belongs-to-exactly-one-event.md): the event-ordering fix
- [ADR 0011a](../decisions/0011a-one-decision-surface-per-delivery-mode.md): the effect-ordering fix
- [REFERENCE.md](../REFERENCE.md): Linux overlay constants and CSS invariants
- [PLATFORMS.md](../PLATFORMS.md): Linux runtime behavior
- [OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md](../handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md): related compositor history
