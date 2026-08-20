# 0233 - A window that has not filled says how full it is, and a figure that outgrows its unit changes unit

Date: 2026-08-18
Status: Accepted. Applies
[ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md) and
[ADR 0183](0183-the-calendar-is-a-year-you-scroll-through-and-a-period-it-can-speak-for.md) to the one
tile that had escaped both, and keeps the counter rule of
[ADR 0191](0191-a-counter-with-ten-glyphs-gets-a-decimal-point-by-widening-a-gap-it-already-has.md).

## Context

The owner read the Home screen three days after the activity ledger started
recording and reported the tile as it stood: **this feature has only existed
here for three days, so the *last four weeks* have saved 200 minutes.**

Two separate defects sit in that one report, and only the first is the one
being complained about.

**The foot named a window the record could not fill.** `ledgerTimeSaved` folds
the last `SAVED_WINDOW_DAYS` = 28 day rows, and the foot said `last 4 weeks`
under every reading it produced. On a ledger whose earliest row is 2026-08-16
the fold has three rows to work with, so the figure was a three-day figure
wearing a four-week label. Nothing about the arithmetic was wrong — the label
was an assertion about the record that the record did not support, which is the
same defect ADR 0161 names for figures and ADR 0183 names for periods, in the
one place neither had been applied.

**And the figure had no ceiling.** `DigitCounter` reserves four positions
(decision 5 of the home activity track), so the widest reading the tile holds
without pushing its neighbours is `9999`. At the baseline in Settings a heavy
month reaches four digits of minutes easily, and the owner asked the obvious
question before it happened: **what does the tile do when it reads 1000
minutes?** It has to convert to hours, and past some point to days.

A counter that runs out of positions widens rather than truncating, which is
correct and still wrong: the tile grows, the row it sits in shuffles, and the
reader is handed a number in a unit nobody thinks in. **1000 minutes is not a
duration a person has any feel for.**

## Decision

### The foot says the span the record can actually speak for

`savedWindowSpan(ledger, now)` counts the days from the ledger's first day to
today, clipped to `SAVED_WINDOW_DAYS`, and the foot spells it:

| Span | Foot |
| --- | --- |
| 1 day | `≈ minutes · today` |
| 2 to 27 days | `≈ minutes · last N days` |
| 28 days or more | `≈ minutes · last 4 weeks` |

**The window itself stays rolling.** The alternative the owner raised — restart
the counter every four weeks and let it grow from zero again — was considered
and rejected on the track's own decision 7: a rolling window is what makes two
readings comparable. A tumbling counter reads highest on day 27 and drops to
nothing on day 28 through no change in behaviour at all, and *how much did I
save* becomes a question whose answer depends on which day of the cycle it is
asked. The ramp gives the first weeks what the owner wanted from a restart —
a figure that means something on day three — without buying it with a cliff.

**The first day comes from `started_on`, or from the earliest day row, and never
from `installed_on`.** On the reporting machine `installed_on` says 2026-04-01
while the first day row says 2026-08-16: the install predates the ledger by four
months, so an `installed_on` ramp would have reported a full window on a record
three days old and reproduced the defect it was written to fix.
`ledgerFirstDay` reads `started_on` and falls back to the earliest row.

### The unit climbs before the counter runs out of room

`durationFigure(minutes)` returns the value, its decimals and its unit:

| Reading | Unit | Decimals |
| --- | --- | --- |
| under 180 minutes | `minutes` | 0 |
| 180 minutes to 72 hours | `hours` | 1 |
| 72 hours and above | `days` | 1 |

**The two thresholds are the owner's**, and both are about the unit a person
thinks in rather than about the width of the tile. Three hours is where minutes
stop being a duration and become a number; three days is where hours do. Neither
is where the four positions run out — the ladder is deliberately earlier than
the mechanical limit, because a tile that changes unit at `9999` changes it at a
moment that means nothing to the reader.

**One decimal above minutes, and it is drawn in the matrix** (ADR 0191). `4.6
hours` is a reading; `4 hours` throws away a third of an hour, and `276 minutes`
is what we are getting away from. The decimal keeps the figure inside the
reserved positions until `999.9` of the unit, which for days is two and a half
years of saved typing.

**The unit is under the figure, not in it** — the foot already carries the basis
([ADR 0182](0182-a-counters-basis-belongs-under-the-figure-and-the-preview-path-is-not-the-park.md)), so the unit joins it there: `≈ hours · last 4 weeks`. The matrix
draws digits and one point, and nothing about that changes here.

### The detail view reads the same ladder

`MetricDetail` spells its facts through the same `durationFigure`, so the tile
and the view opened from it cannot disagree about which unit a figure is in. A
second rounding rule would have been the more obvious way to write it and would
have produced `48.0 hours` in one place and `2880 minutes` in the other.

## Consequences

- The accessible name says the value and the unit and the span it covers, so a
  reader who never sees the foot is told the same three facts.
- The ramp is arithmetic on rows that already exist. No ledger field, no
  migration, nothing in Rust.
- A ledger with no rows at all still lights nothing: `savedWindowSpan` returns
  `null`, the counter stays dark, and the foot says nothing rather than saying
  `today`.
- The thresholds are constants (`HOURS_FROM_MINUTES`, `DAYS_FROM_HOURS`) with
  tests on both boundaries, because 179 and 180 minutes are one keystroke apart
  in the source and a whole unit apart on the screen.
