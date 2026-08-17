# 0187: A ramp whose every real value is the maximum is not a ramp

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Rescales the steps
[ADR 0172](0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md)
set and
[ADR 0183](0183-the-calendar-is-a-year-you-scroll-through-and-a-period-it-can-speak-for.md)
gave a legend to.

## Context

The calendar's legend runs *Less → More* over five steps, and the steps were
`ACTIVITY_STEPS = [1, 3, 6, 11]` dictations a day. Those numbers were chosen
before this product had measured a single day.

Then it measured one. Sunday 16 August, the first full day in the ledger: **104
dictations, 6,065 words** — and the owner's description of it was *that was still
a light day*, with a normal one nearer ten thousand words. Every threshold on the
ramp was therefore cleared inside the first hour of any real day. The whole grid
paints the brightest step, the legend explains a gradient nobody can be on, and
the display answers *how was my half-year* with the same colour every time.

This is not a defect of the fixed-threshold rule — that rule is right, and ADR
0172's argument for it stands: a ramp scaled to the busiest day changes what a
colour means whenever an unrelated day gets busier. It is a defect of the
numbers. They were a guess at a user who takes a handful of notes a week, and
this product is built for the opposite of that.

## Decision

**The steps are `[1, 15, 60, 150]` dictations a day**, and each one names
something:

| Step | From | What it says |
|---|---|---|
| 1 | 1 | you dictated |
| 2 | 15 | a working session |
| 3 | 60 | a heavy day |
| 4 | 150 | an exceptional one |

The measured Sunday lands on step 3 and the owner's ordinary ten-thousand-word
day — about 170 dictations at that day's 58 words per dictation — on step 4,
which is the shape a ramp is supposed to have: the top reserved for the top.

**The first threshold stays at one and may never rise.** Below it the cell is
unlit, and an unlit cell is this grid's one absolute claim: *nothing was dictated
that day*. Raising the floor would spend that claim on days somebody worked, and
a display that reports a morning of dictation as an empty day is worse than one
whose scale is too small.

**The basis stays the day's dictation count**, not its words. Words are the
tempting unit — the owner thinks in them, and they measure volume rather than
frequency — but `LedgerDay.words` is the DELIVERED text, and Agent and Prompt
Enhance write hundreds of words from a sentence of instruction (ADR 0178). A
words ramp would paint a day of ten agent runs as the heaviest day of the year.
The count is the honest unit until a day carries a figure for what was actually
spoken on it.

## Consequences

- Every existing calendar redraws paler, and nothing in the record changed. The
  ledger is untouched: the ramp is a rendering rule, not a stored one.
- A light user now sits on step 1 for longer. That is the cost of a fixed ramp
  and it is the same cost in the other direction the old numbers had; the product
  is for people who dictate all day, and the scale says so.
- The legend stays unlabelled (ADR 0183). The numbers are on the day hover, where
  a reader who wants the scale rather than the shape can read them off any cell.
- The gallery's ramp sample and its `1 · 15 · 60 · 150 dictations` caption are
  driven by the constant, so both moved with it.
