# 0171: An instruction is read once, so Home has two lives, and a counter with no reading is dark rather than zero

Date: 2026-08-16
Status: Accepted. First record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), which owns
ADR 0171–0180. Applies
[ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md)'s
per-row marker to the first surface outside settings, and extends
[ADR 0076](0076-the-decision-inbox-receives-the-one-question-the-runtime-can-already-ask.md)'s
statement about what Home does and does not read.

## Context

**Home opened on a drawing of a keyboard.** `HeroInvoke` put two 42 px 3D
keycaps and one sentence — *Press in any app to dictate* — in the most prominent
position the product has, and `HomeHero.tsx` argued for it explicitly:

> WHAT IS NOT IN IT. No metric, no count, no ring, no "3 dictations today". The
> product does not have a number worth that position — the thing worth that
> position is the shortcut.

Both halves of that were true when they were written. Both have stopped being
true, and the owner named the first on 2026-08-16: **an instruction is read
exactly once.** After the first day the best surface in the product was spent on
a sentence nobody reads again, while the reader had no idea what the tool had
actually done for them.

The second half failed on inspection. `TranscriptionHistoryEntry` has carried
words, `capture_integrity.recorded_seconds`, insert outcomes and timestamps for
a long time. There are numbers. **Nothing read them.**

And Home's own banner said `Preview` over a screen whose inbox, whose record
list and whose mode line are all runtime truth — which is the caveat ADR 0161
describes as the one a reader learns to skip.

## Decision

**The opening block has two lives, and the switch is whether it has anything to
say.** Before the first measured dictation it carries the instruction; after it,
the counters. Never both, and never a third arrangement — the same surface, two
states.

**The gate is a reading, not a record count.** `wordsPerMinute` returning
non-null is what opens the display. That is deliberate in both directions: a
fresh profile sees the instruction rather than four zeroes, *and* so does a
profile whose two hundred records all predate the capture measurement. A display
with nothing to display is four dark boxes, which reads as broken for exactly
the reason four zeroes do. **The gallery falls out of the same rule rather than
being special-cased**: no runtime, no records, no readings, so the gallery draws
the instruction. One implementation, one rule, per ADR 0055.

**The 42 px caps go entirely** — the component, the class and the style block —
and the shortcut moves into the standing fact line as the 20 px `Keycaps` a
sentence can hold. A physical cap is the right object for a surface whose whole
job is *press this*, and the wrong one for a surface that has to give the
position up as soon as it has been read. **A step that removes the only copy of
something restores it in the same step**; the shortcut is still on Home, still
resolved by the runtime and never the raw token (T9).

**A number renders on the matrix, in four reserved positions, right-aligned.**
`MATRIX_FRAMES.digits` is ten 7 x 5 frames and no alphabet, so a multi-digit
number needs a composite frame the vendor does not ship: N glyphs with one blank
column between them. Four positions is not a layout preference, it is the
selection rule — rates, ratios, small sets and windows settle inside four
digits, and a cumulative total runs away, ends up abbreviated and stops being a
counter. **The unlit positions are drawn**, which is the vendored component's own
rule and here also makes the reserved space visible rather than merely computed.

**`null` IS NOT ZERO, AND THE COMPONENT REFUSES TO SPELL ONE AS THE OTHER.** A
dark display asserts nothing; a lit `0` asserts that the runtime counted none.
Those are different claims, and a counter that collapsed them would be inventing
the more specific one. **A value too long for its reserved positions widens the
frame** rather than losing a leading digit: a box that grew is a smaller failure
than a wrong number.

**A drawn tile carries `PreviewTag` at its label and shows no figure at all.**
Apps and Languages are drawn, because no history field stores the target
application and `entry.language` is the *setting* rather than what was
recognised. Under ADR 0161 the tag sits at the label, where it is read before the
value; here there is no value to correct afterwards, because an invented 3 is
worse than a visible gap.

**Every measured tile states what it was computed over.** `capture_integrity` is
null on a retry and on every record older than the measurement, so the rate is
over the records that timed themselves and the tile says `5 of 6 runs measured`
on itself. The rate is total words over total seconds rather than the mean of
per-record rates — a mean weights a four-second aside as heavily as a four-minute
dictation, and the question is about the speech, not about the records.

**A figure derived from an assumption is marked as one.** Time saved measures
against a 40 words-per-minute typing baseline that nothing in this product has
ever observed, so it is rendered with `≈` and the tooltip names the baseline. A
sketch may show a shape and may not assert a measurement it did not take
(ADR 0161); the same rule applied to arithmetic says a guess may be shown and
may not be dressed as a reading.

**Nothing here is lifetime-scoped.** History is pruned on every read, so a total
built from it grows, sticks at the limit and then runs backwards. Every figure is
either a rate — which does not care how many records it saw — or explicitly
windowed, and the window is on the tile.

**The banner chip grades the screen.** `PreviewBanner` already took a `lead`;
Home's is now `Wired in part`, and the sentence spends itself naming what is
drawn instead of repeating the grade.

## Consequences

- **`KeyCap`, `keyCaps()` and the 42 px cap style block are gone.**
  `grep -rn "ws-keycap" src/` returns nothing. `Keycaps` — the other, smaller
  component — is untouched and is what Home now renders.
- **Two tests moved rather than being deleted, and both were foreseen.**
  `Home.test.tsx` asserted the caps by class and now asserts them in the fact
  line, plus that no element with `keycap` in its class remains anywhere.
  `screens.test.tsx`'s "opens on the shortcut" became "names the shortcut",
  which is the claim that is still true.
- **A third test was pinned to a word and had to stop being.**
  `ia.test.tsx` read `/Preview/i` off every banner-bearing screen, which was the
  same thing as "a banner rendered" only while every chip said `Preview`. It now
  asserts the banner element and a non-empty chip, so an honest grade cannot be
  the failing one.
- **The suite goes 667 → 697 over 46 → 48 files.** Thirty new cases, no case
  deleted: 10 for the counter's frame and geometry, 11 for the derivations, 9 for
  the display's two lives and its two drawn tiles.
- **AN SVG PRESENTATION ATTRIBUTE BEATS EVERY RULE IN `shell.css`, AND ONLY
  LOOKING FOUND IT.** The counter is capped at its natural width so a narrow
  column can shrink it, and `.ws-counter svg { width: 100% }` — the obvious
  spelling — changed nothing at all: a presentational hint is *unlayered*, and
  unlayered author styles win over layered ones whatever the specificity, so a
  118 px tile held a 136 px display hanging out of it. `max-width` is a property
  the attribute does not set, so it lands. Same class of trap as the Matrix
  wrapper's `inline-flex`, one layer further out, and the unit suite could not
  have seen either — jsdom applies no stylesheet.
- **The tier that takes the counters 2 x 2 is derived, not chosen.** Four tracks
  of 136 px with three 16 px gaps need 592 px of content and the column spends 64
  on inset, so 656 px is the last column width at which four fit whole.
- **Home stops being a ported screen.** The prototype has no counter tiles, so
  `npm run port:diff home` will report a large diff and has no way to know it is
  intended. That is recorded here and on the track page; the port relay's measure
  is not this track's acceptance surface.
- **The empty state is lighter than what it replaced**, and that is the trade
  the decision makes rather than an oversight: the first-run instruction is now a
  16 px lead line with the caps below it in the fact row, where it used to be two
  42 px objects. It is stated here so that whoever finds it thin is arguing with
  a decision rather than with a bug.
- **Stage B inherits two named holes.** The language on a record and the target
  application both need a runtime change and, for the second, a retention rule
  that names a new collection (ADR 0138's shape). Until then the tiles carry the
  tag and no figure.
