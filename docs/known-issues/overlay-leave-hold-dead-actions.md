# Bug: The leave hold painted live-looking buttons on dead handlers

Status: **Fixed (2026-07-30) — and this record's mechanism stays fixed. The
damage it was reported as arrived again on 2026-08-13 by a third route; see the
addendum.**

First reported: 2026-07-30, as "at the end of a recording it freezes, and in
Copy-to-clipboard-only mode I cannot get at my transcript at all"
Affected area: overlay preview actions at the end of a `clipboard_only` session,
all platforms

## Addendum 2026-08-13: the same damage, a third mechanism

The owner reported, in almost the founding words: *"it becomes invisible, and in
Copy-to-clipboard-only I can no longer copy the text."*

**Nothing here regressed.** This record's mechanism is dead handlers behind
live-looking buttons, inside a 240 ms window, and its regression test still
pins it. The *Scope* section below was right to say the hold explains a dead
click and "not a persistently unusable overlay", and right to hand the
persistent half to
[overlay-stranded-off-screen.md](overlay-stranded-off-screen.md).

What has changed is that the persistent half now has **two** mechanisms, not
one:

| # | Mechanism | Surface state | Record |
|---|---|---|---|
| 1 | handlers dead under the leave hold | painted, enabled, inert | this one — fixed |
| 2 | window placed where no monitor is | alive, unpaintable | [overlay-stranded-off-screen.md](overlay-stranded-off-screen.md) |
| 3 | webview destroyed by a dev-server reload, remounted empty | gone | [dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md) |

All three end where this record's *Symptom* section already put it: in
`clipboard_only` the preview pill is the only route the mode offers to the
transcript, so losing that surface by **any** means loses the transcript.

**The lesson this record earns.** Three mechanisms in six weeks have produced
one user sentence, and each was fixed as a placement or a wiring bug. The
recurring part is not any of them — it is that a finished transcript has
exactly one door. That belongs to the
[measurement integrity track](../tracks/measurement-integrity.md), step 3, as a
product question rather than a fourth mechanism hunt.

One observation for whoever takes it: the runtime writes the clipboard
unconditionally at insert time on every session in the log
(`insert_mode=ClipboardOnly clipboard_written=true`, `wl-copy clipboard verified
via wl-paste`), so the text does reach the clipboard without the pill. What the
lost surface removes is the route *back* to it once the clipboard has moved on.
Confirm that before designing the second door.

## Symptom

At the end of a dictation the preview pill is still on screen with its normal
Copy / Edit / Abort row. The buttons look completely normal -- not busy, not
greyed -- and clicking them does nothing at all. No error, no toast, no visual
change.

In `clipboard_only` this is the worst case the product has: that surface is the
only route the mode ever offers to the transcript.

## Root Cause

Not a compositor problem and not an input problem. The buttons were wired to
handlers that had already gone dead.

`clipboard_only` never opens a result surface -- `resultSurfaceOpen` stays
`false` (`useRuntime.ts`, "one decision surface per delivery mode"), so
`processing_preview` is the only surface it ever has. That surface's data source
is `state.pendingResult`, and the authoritative `TRANSCRIPTION` commit nulls
exactly that field while keeping `lastResult`.

After the session ends, `OVERLAY_LEAVE_MS` (240 ms) of leave hold keeps the
surface painted from `lastProcessingPreviewSnapshotRef`. The snapshot fixes the
*text*. The `pillState` branch for `kind: "processing"` wired the callbacks
unconditionally:

```tsx
onCommit: () => void handleCommitPreview(),
onEdit: handleEditOpen,
onAbort: () => void handleAbortPreview(),
```

while the handlers all bail on the now-null source:

- `handleCommitPreview`: `if (!pendingPreviewResult || actionPending) return;`
- `handleAbortPreview`: the same guard
- `handleEditOpen`: **no guard at all** -- it opened an edit surface against a
  preview the runtime had already consumed, so confirming ran
  `commit_pending_transcription_preview` against an empty `take_pending_preview()`
  and failed in the runtime instead of in the UI

`PreviewActions` only ever passed `disabled={Boolean(pending)}` -- disabled while
an action is in flight, never because the data behind it is gone. So the Copy
button rendered enabled and correctly labelled, and did nothing.

The asymmetry is the whole bug: the `edit-mode` branch immediately above already
does this correctly and even documents the rule -- *"The leave hold is a frozen
frame, not an interactive surface"* -- passing `undefined` for
`onTextChange`/`onConfirm`/`onCancel` when the surface is only being replayed.
The `processing` branch never got the same treatment.

## Scope

The hold is 240 ms wide. This explains a dead click at the end of a session --
a fast second click, a click racing the IPC round trip, a click during the
`NATIVE_SYNC_TIMEOUT` recovery -- not a persistently unusable overlay. The
persistent half of the same report is
[overlay-stranded-off-screen.md](overlay-stranded-off-screen.md).

`auto_paste` was never exposed: it opens a real `result_actions` surface backed
by `lastResult`, which is not nulled, so its hold stays genuinely interactive.

## Resolution

- The `processing` branch gates `onCommit` / `onEdit` / `onAbort` / `onCycleMode`
  on the live `showProcessingPreview` flag and passes `undefined` otherwise --
  the same rule the `edit-mode` branch follows.
- `PreviewActions` treats an absent handler as "not interactive" and renders the
  button disabled. No new prop: a missing handler already means exactly that.
- `handleEditOpen` got the guard it never had, checking the source that matches
  where the edit is being opened from (`pendingResult` from the preview,
  `lastResult` from the result surface) -- the same value it then stores in
  `editFromPreviewRef`.

The hold still paints. It now looks like what it is: a frozen frame.

## Regression Checks

`OverlayWindow.test.tsx`, "disables the preview actions during the leave hold
instead of leaving them dead": renders the live `clipboard_only` preview,
asserts Copy is enabled, then applies the authoritative end-of-session commit
(`status: "idle"`, `pendingResult: null`, `previewStaged: true`) and asserts
Copy, Edit and Abort are all disabled. Verified to fail against the pre-fix
wiring.

## References

- [overlay-stranded-off-screen.md](overlay-stranded-off-screen.md): the other,
  persistent half of the same report
- [ADR 0018](../decisions/0018-the-end-of-a-session-belongs-to-exactly-one-event.md):
  the commit that nulls `pendingResult`; it fixed the one-frame unmount gap for
  `auto_paste` and explicitly did not touch this
- [overlay-ghosting.md](overlay-ghosting.md): why the leave hold exists at all
