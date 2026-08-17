# 0191: A counter with ten glyphs gets a decimal point by widening a gap it already has

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), Stage C row C7.
Extends `DigitCounter`
([ADR 0171](0171-an-instruction-is-read-once-so-home-has-two-lives-and-a-counter-with-no-reading-is-dark-rather-than-zero.md)).

## Context

The Turnaround tile read `2400` and its foot said `ms`. That is a true figure in
a unit nobody waits in: a reader knows what two and a half seconds feels like
and has to divide to find it.

Seconds are the unit, and whole seconds throw the measurement away — a 2,400 ms
median drawn as `2` discards every bit of a 25 ms histogram
([ADR 0181](0181-the-wait-starts-when-you-stop-speaking-not-when-the-file-is-already-written.md)).
So the counter needs a decimal point, and `MATRIX_FRAMES.digits` is ten 7 × 5
frames with no separator, no sign and no period. It is a font with ten glyphs and
it is not getting an eleventh.

## Decision

**The point is drawn in the blank column the frame already keeps between two
glyphs, and that gap is widened for it.**

`DIGIT_SPACING_COLS` puts one empty column between glyphs so that `11` does not
read as one ten-wide shape. That column is unused and it is in exactly the right
place. The first build lit its bottom cell and stopped there.

**That build was unreadable and the owner reported it from the running app:
`1.0` read as `10`.** Both halves of that are the same mistake. A single dot at
the foot of a 6 px gap is four pixels of ink on a display made of four-pixel dots
— it does not announce itself — and more importantly the gap it sat in was
IDENTICAL to the gap between every other pair of digits, so the eye had nothing
to group by and read one number.

**The separation is the signal and the dot only confirms it.** So:

- the gap at the point is **three columns** rather than one, which makes the
  split visible before the point is even looked at;
- the mark is **2 × 2 at the baseline**, solid enough to be a mark rather than a
  stray lit cell;
- it takes the first two columns of the gap, leaving **one clear column between
  the point and the digit it qualifies**. Reported second, from the same running
  app: at two columns the mark and the first decimal digit merged into one shape,
  which is the same failure one step smaller. It stays hard against the digit on
  its LEFT, which is where a decimal point belongs — it says *this number
  continues*, and it says it about the integer part.

**`counterDigits` moves the rounding rather than adding a character.** The digits
string stays a run of digits — `2.4` is `"24"` — and it pads to at least
`decimals + 1`, because without that a value of 0.8 spells `"8"` and draws as
`.8`, which reads as dirt on the display rather than as a number.

**The four reserved positions stay four.** The frame is two columns wider than
its three neighbours' and the dot pitch is unchanged, so the tile is twelve
pixels wider inside a grid track that has the room. **A counter nobody can read
correctly is not worth twelve pixels.**

## Consequences

Rule 6 of the track is untouched: Turnaround is still a figure that settles
inside four positions, and the point does not change what may be a counter.

The `ariaLabel` and the foot say seconds. The foot's `ms · median · all time`
became `seconds · median · all time`, which is the same claim in the unit the
figure is now drawn in — a foot that named a unit the display no longer used
would be the plausible-wrong-number failure in its quietest form.
