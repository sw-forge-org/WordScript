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

### Why it is one door, and it is worse than "one door"

An earlier version of this addendum said the text survives regardless, because
the runtime writes the clipboard unconditionally and History carries a `copy`
action. **That was wrong**, and it was wrong in the direction that matters.

Every insert call site is an `invoke` from `OverlayWindow.tsx` (`:1508`,
`:1548`, `:1621`, `:1648`). The runtime does nothing on its own after
`preview ready`. And **the clipboard write, the `history.json` record and the
Markdown transcript are all created inside that insert** — the record id
`history-1786574199766-200` and its file's `created:` stamp are the same
millisecond as `Native insert event emit done`.

So there is no fallback behind the pill. No insert means no clipboard, no
history row, no file; the text exists only in memory. History's `copy` /
`restore` / `reveal` are real, but they act on a record that the lost surface
prevented from ever being written.

The runtime log shows the dependency without any code reading. Across 277
`clipboard_only` previews: median preview→insert **1.12 s**, p90 2.27 s — but
**11.45 s to 115.11 s in the 13 sessions whose webview was destroyed
mid-preview**. The commit was waiting for a window to come back. Three previews
never reached an insert at all: two deliberate aborts, and one that died with an
application restart and **was never written anywhere**.

**The lesson this record earns.** Three mechanisms in six weeks produced one
user sentence, and each was fixed as a placement or a wiring bug. The recurring
part is none of them — it is that the session's completion belongs to a window.
That is [ADR 0134](../decisions/0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
and step 1 of the [runtime ownership track](../tracks/runtime-ownership.md): the
runtime finishes the session on a 10 s deadline, and the second door then exists
without designing one.

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
