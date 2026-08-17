# 0194: What stays an icon is what you repeat, and on a transcript row that is Copy

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), Stage C row C10.
**Qualifies [ADR 0082](0082-a-rows-actions-belong-at-the-row-and-deleting-always-asks.md)'s
icon rule rather than quoting it.**

## Context

Six icon buttons hung off every transcript row — View raw, Show in file manager,
Retry, Restore, Copy, Delete — and `Restore` is conditional. So a list had rows
of two different widths, and the eye had to re-find the same verb at a different
x from one row to the next.

ADR 0082 already answers a right-click on a list row with a `RowMenu`, and the
component exists, with labelled entries, icons, hints and a disabled state. What
did not exist was a reason to prefer one arrangement over the other here.

## Decision

**Two controls stay on the row: `View raw transcript` and `Copy`. The other four
go into a menu, opened by a `…` button or by a right-click — one verb list, two
ways in.**

**ADR 0082's icon rule has to be qualified rather than applied.** It says *what
stays an icon is only what you repeat positionally*, and it was written for a
list you REORDER: there the repeated gesture is up/down against a neighbour, and
everything else is occasional configuration. Reading that as "only reorder
controls may be icons" would send all six verbs into the menu on a list that has
no reorder at all — the letter of the rule against its own point.

**A transcript row is the other kind of list.** Nothing is reordered and nothing
is configured. It is a record you take text out of, repeatedly, down a whole
list. So the rule's own reasoning selects `Copy`.

`View raw` stays because it is not a command: it is this row's own disclosure, it
toggles this row open, and the row is already `[data-open]` when it is on. A
disclosure that lived in a menu would be a fold you have to open a menu to close.

**A disabled reason survives the move (ADR 0065).** `Retry` and *Show in file
manager* were drawn-and-inert with the reason as their tooltip; in the menu the
entry is disabled and the reason is its **hint**, which is the same promise on a
surface with room to state it in full rather than hiding it behind a hover.

**The menu's state lives in `TranscriptRow`.** Two screens copying three lines of
dismissal logic is how the two grow apart, which is the redundancy that row
exists to prevent.

**The right-click ignores the two buttons.** `onContextMenu` sits on the row, so
it fires over them too — where the platform's own menu is the more useful one and
where the reader was aiming at a control rather than at the record.

**One new glyph: `more`.** It is the only drawing in this set that is not a
picture of anything, because an overflow control has no subject — which is why
every platform draws the same three dots for it. It carries its own `fill`, which
no other glyph here does: `Icon` sets `fill="none"` and strokes at 1.75, so three
bare circles would come out as three rings and read as a smudge.

## Consequences

Both screens draw the same two controls and the same menu, and no verb was lost
in the move. Every row is the same width whatever the record is, including the
one that offers `Restore to cursor`.

Six cases moved from querying a button to opening the menu first. One new case
grades the thing the move was FOR — that every row's action run is the same three
controls — because a change that put a seventh control back would otherwise pass.
