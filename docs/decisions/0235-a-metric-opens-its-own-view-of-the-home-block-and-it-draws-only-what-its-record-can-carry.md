# 0235 - A metric opens its own view of the home block, and it draws only what its record can carry

Date: 2026-08-18
Status: Accepted. Third view of the block whose first two are
[ADR 0182](0182-a-counters-basis-belongs-under-the-figure-and-the-preview-path-is-not-the-park.md)
and
[ADR 0183](0183-the-calendar-is-a-year-you-scroll-through-and-a-period-it-can-speak-for.md);
extends the record rules of
[ADR 0172](0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md)
to a chart.

## Context

The home block held two views — four counters, and the calendar — swapped by
pressing the background or one of the two dots. Between them they answer *how
much* and *when*, and neither answers *is this moving*. The owner asked for the
third:

> Ich will natürlich auch irgendwo historische Werte. Vielleicht bauen wir das
> so ein, dass man auf bestimmte Metriken nochmal draufdrücken kann. […] Bei
> allen Metriken drückt man dann einfach auf die Metrik. Wenn man auf den
> Hintergrund drückt, kommt man weiterhin zu dieser Kalenderansicht. […] Und wir
> brauchen dafür die größeren Zeiteinheiten wie Wochen, nach den Tagen Monate,
> Jahre.

Two things make this more than a chart component.

**The block already spends every press it has.** The background swaps the view
and so do the dots; a tile that also does something has to take its press out of
a gesture that already means something else.

**And the four metrics do not have the same record behind them.** The ledger
keeps one row per day with counts only. Those rows carry `saved_*` and
`spoken_words`/`speech_seconds`, so time saved and speaking rate can be folded
over any span. They carry **no turnaround and no language** — those exist only
as all-time histograms (`turnaround_buckets`, 25 ms per bucket) and an all-time
map (`languages`). There is no per-period history of either, anywhere, and a
`Months` tab over turnaround would have to invent one.

## Decision

### 1. The tile is the control, and the background keeps its own

A tile with a detail renders as a `<button>` whose click **stops propagating**,
so pressing a metric opens that metric and pressing anything around it still
swaps counters and calendar. The dots are unchanged.

**While a detail is open the hit layer is not rendered at all** — not disabled,
not covered. `HomeSwitch` takes a `detail` flag and omits the `.ws-home-switch-hit`
button and the body's `onClick` with it, because a background that silently
swallows presses is the same defect as one that swaps behind a view the reader
is reading. Leaving the detail is the one labelled way back at the head of the
view.

The button carries no `aria-label` of its own: the counter inside it already
spells the reading and its unit, and a label on the button would replace that
with a shorter sentence.

### 2. Each metric draws what its own record can carry, and says so when that is not a history

| Metric | What the record holds | What the view draws |
| --- | --- | --- |
| Time saved | `saved_words`, `saved_seconds`, `saved_runs` per day row | bars per period, all-time total, best period, the baseline |
| Words per minute | `spoken_words`, `speech_seconds` per day row | a line per period, median all time, pause share, runs timed |
| Turnaround | `turnaround_buckets`, all time only | the spread itself, median column marked, and one line saying it is a spread rather than a history |
| Languages | `languages`, all time only | a bar per language, and the count that is too short to name |

**The two without a history say so in one line rather than growing one.**
Deriving a monthly turnaround from an all-time histogram is not possible, and
faking the shape of one is exactly the assertion ADR 0172 forbids one cell at a
time. What the turnaround note says instead is the useful thing: what moves that
figure is the model and the lane, so a change there shows up as a second hump
before it shows up in the median.

### 3. A grain is offered only once the record reaches three of it

`PERIOD_SPAN` caps what a chart draws — 28 days, 26 weeks, 12 months, 10 years —
and the first two are numbers the reader has already met: the day span is the
time-saved window, the week span is the calendar's half-year.

`PERIOD_FLOOR = 3` decides which tabs exist at all. A `Years` tab holding one
bar teaches nothing and costs a press to find out; the tabs appear as the record
grows into them, the same way the calendar's year picker fills (ADR 0183). Below
two offered grains the control is not drawn.

**The view opens on weeks when weeks are offered, otherwise on the finest grain
there is.** The first build opened on the coarsest offered and put ninety days of
record onto four monthly columns — technically the widest view, and the one that
showed the least.

### 4. A sum is a bar, a rate is a line, and a flat series is drawn flat

A bar states *this much of something*, so its baseline has to be nought. A
speaking rate has no meaningful nought, and drawn from one, four months of a
stable rate is four identical blocks that hide the only thing the reader came to
see — so the line scales to its own values and the read-out says which range it
is showing.

**The scaling has a floor, and the running page is what showed why.** Fourteen
weeks at an identical rate came out of the fold as `156.00000000000003` against
`155.99999999999997`. A line that pads a range of `1e-14` turns the last bit of
a double into a mountain range: the reader sees a rate swinging week to week and
is looking at floating-point noise. A range under half a percent of the reading
is therefore no range — the band opens to five percent either side and every
point sits in the middle of it, which is what *this did not move* looks like.

### 5. The week starts on Monday, in both places at once

The calendar's grid and the week buckets share one week start, and it is Monday.
The vendored heat map normalises any `startDate` to its own week start, so the
patch is in the vendored file as well as in the two callers; a chart whose weeks
began on Sunday under a grid whose rows began on Monday would put the same
dictation in two different weeks on one screen.

## Consequences

- **No Rust, no ledger field, no migration.** Every series is a fold over rows
  that already exist, and every all-time figure was already being read for a
  tile.
- A series is clipped to `ledgerSpeaksFrom` — the later of the first day row and
  the day after `retired_through` — so a bucket can never be half a real week
  and half a retired one (ADR 0176). A month whose rows were pruned is not drawn
  short; it is not drawn.
- `empty` is a distinct state per column and not a zero: a week with no
  dictation saved no time, and it has **no** speaking rate at all. The bars draw
  unlit ground for the first and the line breaks for the second.
- The detail spells its durations through `durationFigure`
  ([ADR 0233](0233-a-window-that-has-not-filled-says-how-full-it-is-and-a-figure-that-outgrows-its-unit-changes-unit.md)),
  so a view opened from a tile can never disagree with the tile about the unit.
- The block now has three views and two of the three gestures; a fourth view
  would need its own way in rather than a third dot.
