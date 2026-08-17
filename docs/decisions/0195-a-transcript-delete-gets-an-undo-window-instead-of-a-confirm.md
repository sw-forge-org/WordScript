# 0195: A transcript delete gets an undo window instead of a confirm

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), Stage C row C11.
**Departs from
[ADR 0082](0082-a-rows-actions-belong-at-the-row-and-deleting-always-asks.md)'s
*deleting always asks*, for this one object.**

## Context

Deleting a transcript row was one press with no ask, while the profile row one
screen over asked twice. ADR 0082's rule — *deleting always asks* — would close
that gap by adding a confirm.

The owner decided against it, on 2026-08-17, and the argument is about how this
particular object is deleted rather than about how dangerous deleting is.

**A transcript row is deleted often and in runs.** Clearing a week of test
dictations is thirty presses. A dialog on every row of a list somebody is
clearing stops being read by the third one — **a confirm that is clicked through
is not a safety net, it is a delay with a safety net's reputation.** A profile is
the opposite: you delete one every few months, and the ask is read precisely
because it is unusual.

The complication is that **the runtime's delete is hard and takes the file with
it.** `delete_transcription_history_entry` removes the entry AND calls
`remove_transcript_files`, and there is no restore. So the window cannot be
"delete, then put it back".

There is also **no toast surface in the shipped shell**:
`src/components/ui/toast.tsx` is mounted nowhere, History has a one-line notice
under its toolbar, and Home has nothing.

## Decision

**A soft delete with a `Deleted · Undo` notice, held for six seconds, and the
`invoke` fires when the window closes.** The frontend holds the row back;
nothing is destroyed until the reader has stopped being able to change their
mind.

**Six seconds is the time to NOTICE, not the time to decide.** The mistake this
exists for — the wrong row — is seen the instant the row leaves, because what the
eye checks is the row now standing where the old one was. Long enough to read the
notice and reach it; short enough that a reader clearing a list is not dragging a
tail of undecided deletes behind them.

**Three cases needed an answer rather than a default:**

1. **Leaving the screen with one pending** — it is flushed. A row hidden on one
   screen and present on another is one record with two answers; the reader asked
   for it gone and stopped looking. This shell keeps every visited view mounted,
   so *leaving the screen* is the component unmounting.
2. **Closing the window with one pending** — flushed on the way out, from
   `pagehide` and `beforeunload` both. The promise is deliberately not awaited
   and does not need to be: `invoke` posts the message to the IPC channel
   synchronously and the runtime outlives the webview. What must not happen is
   the row coming back on the next launch as though the delete had never been
   asked for.
3. **A second delete inside the first one's window** — the first is committed
   immediately and the second starts its own full window. **One pending row,
   never a queue**: the notice can only name one, and a stack of undos is a stack
   of decisions the reader has to hold. Deleting three rows in a row is then
   exactly what it looks like — three deletes, the last of which can still be
   taken back.

**The notice is not a toast and mounting the toast component was rejected.** It
would bring a stacking, timing and placement system into the product for one
sentence — and a toast floats OVER the surface it is about, which is exactly
wrong here: the reader is looking at the list, and the fact worth telling them is
about a row that has just left it. **So the notice stands where the row was**, in
the flow at the head of the list, pushing it down by one line. No tone and no
coloured edge: a delete somebody asked for is not a warning, and a strip in
`--accent` would be the loudest thing on screen for six seconds — the same defect
[ADR 0193](0193-a-delivery-mode-is-a-fact-and-not-a-warning.md) took off the
delivery badges.

**The held-back row is filtered out of the SET and not out of the rows.** The
count, the pager and the empty state all read the same list, or a record hidden
from the rows would still be counted by the foot — `1–25 of 60` over
twenty-four, which reads as a broken screen rather than as a pending delete.

## Consequences

ADR 0082's rule still holds everywhere else, including for a profile, a
replacement and a snippet, all of which still open a question under the row.

**A multi-selection would not be covered by this and none is being built.** The
same brief asked for a confirm on bulk delete and the owner then decided
multi-selection is not wanted. If it ever lands, the confirm is not optional: an
undo window is right for one row and wrong for thirty.

The timing rule is graded in the hook's own test file and deliberately not on
either screen. Both screens poll the runtime every five seconds and debounce a
search box, so a case that drove one of them on fake timers would be making a
statement about those two as well — the first version of the History case did
exactly that and hung.
