# 0076 -- The decision inbox receives the one question the runtime can already ask

Date: 2026-08-10
Status: Accepted

Partly implements
[ADR 0044](0044-the-effect-line-and-the-handoff-across-it.md)'s decision inbox.
The other two sources stay unbuilt and stay stated.

## Context

ADR 0044 put a decision inbox on Home and named three sources: a question the
desk could not answer, an open question raised in a meeting, and a delivery that
did not reach the cursor. Leg 4c drew none of it on the product, correctly: the
desk is Phase 8, meeting notes are V2, and rendering three invented pending
decisions would have been the worst instance of rule 7 on the whole surface --
an invented QUESTION rather than an invented label.

**The third source was on that list by association rather than by inspection.**
A record whose `insert_mode` is `clipboard_fallback` or `scratchpad_fallback` is
a delivery that did not land, and the runtime has written every fact such a card
needs since long before the inbox was drawn: what was said, when, under which
profile, why the paste did not go through, and whether the text can still be
placed. History already offers *Restore to cursor* on exactly this set. What was
missing was not the data -- it was somewhere for the answer to be remembered.

## Decision

**Home draws the inbox for fallen-back deliveries and for nothing else.** Not a
third of a feature: it is the whole of the one source that can be answered
honestly, and the surface says which.

**Nothing is drawn when nothing is owed.** The drawing's own rule -- *"a
standing all-clear is furniture"* -- so on a machine with no failed insert the
section is not on the screen at all. That is the common case and it is the rule
working, not a screen half-built.

**Dismissing is recorded on the RECORD, as `fallback_acknowledged`.** Not in the
window, and not in the config. A question that came back every time the
workspace was reopened would be the standing nag ADR 0044 exists against, and
the fact being remembered -- *this fallback has been dealt with* -- is a fact
about that transcription rather than about a window or about the machine's
settings. It is an additive field with a serde default, so nothing is migrated
(ADR 0054).

**Restoring answers the question too.** Placing the text is the thing the card
exists to offer, so it acknowledges as well; a card that stayed after its own
action had run would be asking about something that is done.

**The two fallbacks state different costs, because they have different ones.**
Clipboard text survives until the next copy. Scratchpad text survives until the
runtime restarts. Printing the clipboard's sentence over a scratchpad record
would be wrong in the direction that makes somebody act too late.

**Home keeps its banner and its gallery entry**, and the banner now names what
is missing rather than saying the inbox has no receiver at all. The desk and the
meeting still have none, the gallery still draws all three rows as the prototype
does, and the product renders one kind.

## Consequences

- **The gallery and the product disagree about this card on purpose**, and that
  is what `PartlyWiredScreenProps` is for. The gallery draws ADR 0044's three
  sample rows and is measured against the prototype; the product draws the rows
  a record produces. One implementation, two sources of rows.
- **`Waiting for you · n` counts what is actually owed**, so the heading can be
  1 where the drawing shows 3. A count is the result of a list.
- **Phase 8 inherits a receiver rather than a blank.** When the desk exists, its
  questions join a list that is already drawn, already ordered by cost, and
  already has a way to be answered and remembered.
- **The relay's §2.5 entry shrinks rather than closes.** "ADR 0044's three
  sources have no receiver" becomes "two of the three", and it stays on the list
  until the surfaces that produce them exist.
