# 0186: A tile explains itself everywhere, and `only German` was a claim the record never made

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Corrects the hover
placement [ADR 0182](0182-a-counters-basis-belongs-under-the-figure-and-the-preview-path-is-not-the-park.md)
settled and the pointer arrangement
[ADR 0183](0183-the-calendar-is-a-year-you-scroll-through-and-a-period-it-can-speak-for.md)
left behind it.

## Context

The owner used the finished counter row and reported two faults and a
duplication.

**The languages tile said `only German` to somebody who dictates in two.** It
was read as the measurement being broken. It was not: this machine's ledger held
`languages: {de: 67}` against 107 dictations, and the two English runs in the
record were `Whats up my fellow American` — five words — and `Removing`, which is
one. Run through the shipped detector, the first comes back **Hungarian at 0.05
confidence** and the second Danish at 0.005; both fail `is_reliable()` and are
counted in no language at all, which is exactly what ADR 0180 asks for. A text
under about a sentence has no language a trigram model can read.

So the measurement was right and **the sentence was wrong**. `only German` is a
claim about every dictation, and the tile had read 67 of 107. Forty runs were
refused and the surface said nothing about them, which left the reader with one
available conclusion: the counter cannot see English.

**The tooltips did not work.** Every tile carries a `title` explaining what its
figure is — including the one sentence that would have answered the paragraph
above — and ADR 0183 had made the view layer `pointer-events: none` so a click
anywhere on the block would reach the swap button behind it. The pointer was
given back to `.ws-tile-label` alone, on the argument that the label is where a
reader looks first. In a 150 px column the label is one line of small caps at the
top, and a reader pointing at the **figure** — the thing they are asking
about — got nothing. Four tiles, four explanations, and the hover answered on
roughly a sixth of each one.

**The fact line said the mode twice.** `Next dictation runs as Cleanup ·
Founder ops notes on Cleanup`. In the prototype these two spans read `Cleanup`
and `General writing on Auto` and were two different facts; in the running app
the active profile mostly *is* the effective mode, so the row spent its last
third repeating the word before it — and was long enough to wrap under a display
that is centred.

## Decision

**The hover belongs to the tile.** `StatTile` puts `title` on `.ws-tile`, and the
stylesheet gives the pointer back to `.ws-tile` rather than to `.ws-tile-label`.
Anywhere on the tile — label, figure, foot — answers.

**So the counter view swaps from the body layer.** A tile that takes the pointer
is a tile a click no longer falls through, and the tiles are most of that view.
`.ws-home-switch-body` carries the `onClick` instead, **only when the counters
are showing**: in the calendar view the cells, the picker and the arrows all
bubble through the same element, and a handler there would swap the view on every
arrow press, which is the defect ADR 0183 took the wrapping `<button>` apart to
prevent. The hit area behind stays: it is what a keyboard reaches and what a
screen reader announces.

**A language foot states what it read.** Where any dictation went unmeasured the
foot gains a second line, `measured on 67 of 107`, and the exclusive word is
spent only where nothing was refused:

- one language, nothing refused → `only German`
- one language, runs refused → `German`, over `measured on 67 of 107`
- two or more → `mostly German · 86 %`, over the same second line

The share keeps ADR 0182's denominator — the runs that *were* measured — because
that question and this one are different: the percentage says which language you
work in, the second line says how much of the record could be read at all.

**The tile's hover names both refusals.** `A dictation under about eight words —
or one the detector cannot be sure of — is counted in no language at all.` The
reader wondering why a language is missing is asking about exactly those two
gates, and naming only the length one would have sent the next question straight
back: measured here, `I spent the whole morning working on the new report` is ten
words, is English, and is refused at 0.595 for being too close to call.

**The profile names its mode only where that is a second fact.** Where the
profile's mode and the router's resolved mode agree, the second mention goes and
the span is the profile name alone; where they differ — a profile on `Auto` that
resolved to `Cleanup` — the mode stays, because that is the case worth reading.

**And the fact line is centred**, like the display above it. The `margin-left:
auto` that pinned the action right is gone: an auto margin eats the free space
before `justify-content` ever sees it, so the row could not be centred while it
was there.

## Consequences

- No runtime change and no ledger change. The detector, its floors and its
  refusals are exactly what ADR 0180 shipped; what moved is what the surface says
  about them.
- The English aside stays uncounted, and that is the correct answer rather than a
  residue: counted, it would have been Hungarian.
- `measured on 67 of 107` is absent on a record where the two counts agree, so a
  reader who dictates in paragraphs never sees a line about refusals that never
  happened.
- The denominator is all-time dictations, which on an installation that seeded
  its languages from a pruned history is wider than the runs the seed could read.
  It understates the coverage there rather than overstating it — the direction to
  fail in for a line whose job is to stop a tile from overclaiming.
- A click on a counter tile now swaps the view where it used to do nothing. The
  block was already the control (decision 9); the tiles were the part of it that
  had quietly stopped answering.
