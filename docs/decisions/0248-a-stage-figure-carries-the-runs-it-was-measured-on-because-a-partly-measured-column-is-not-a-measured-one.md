# 0248 - A stage figure carries the runs it was measured on, because a partly measured column is not a measured one

Date: 2026-08-23
Status: **Accepted.** Extends
[ADR 0247](0247-a-wait-is-two-stages-so-the-runtime-measures-both-and-the-metric-detail-states-its-reading-before-it-draws-the-evidence.md)
with the state it did not have a machine to look at: the split measured on
some of a row's runs rather than on all of them or none.

## Context

### ADR 0247 shipped with two states, and every installation lives in a third

That decision gave the split table two shapes. Where no run carried a stage the
column is **not drawn at all** and one self-deleting sentence says when it will
arrive. Where runs carried a stage the column is drawn. Both were tested, both
were correct, and between them sits the shape that is actually on screen: a
stage histogram over a handful of runs standing beside a total histogram over
all of them, in one row, on one line.

No record written before ADR 0247 holds a split, so **every installation enters
this state with its first dictation after the upgrade and stays in it for as
long as its old runs are in the ledger** — which, the ledger being all-time
since ADR 0240, is forever on the machines that matter most.

### What it drew, measured on the reporting machine

Rendered over this machine's own `activity.json` five dictations after the
runtime learned to split — 147 waits in the ledger, five of them measured in
two stages:

| Cut | Row | runs | stage | in total |
|---|---|---|---|---|
| by model | `whisper-large-v3-turbo` | 147 | heard in **0.5 s** | 0.9 s |
| by mode | `Cleanup` | 137 | rewrote in **0.4 s** | 0.9 s |
| by mode | `Draft` | 6 | rewrote in **0.7 s** | 1.0 s |
| by mode | `Rewrite` | 2 | — | 1.3 s |

The first row invites one subtraction, and it is wrong twice over: medians do
not subtract, and these two medians are not even over the same runs — 0.5 s is
the middle of five, 0.9 s the middle of a hundred and forty-seven. `Draft`'s
`0.7 s` is one dictation, printed in the same column, at the same weight, as a
figure over 137. The `—` under `Rewrite` states nothing at all: a reader cannot
tell *never measured* from *nothing to measure*, which is the exact distinction
ADR 0247 built the empty stage histogram to preserve.

**The only thing on the screen that said any of this was a `title` attribute**,
which speaks on hover and to nobody reading the table.

### The cases could not have caught it

Every case written for that table used a fixture whose split covered all of a
row's runs or none of them. The fixture builder even documents the empty case as
*the state every existing installation is in* — and the partly filled one, which
is the state every installation is in one dictation later, had no case at all.
It was found by rendering the real workspace over the real ledger at the
workspace's own 625 CSS px, which is the fourth defect on this block found that
way after a green suite.

## Decision

### A stage figure prints the run count it rests on, in the cell that already counts runs

While a row's split is short of its runs, the count cell holds both figures —
`4/137`, `1/6`, `0/2` — and collapses back to a plain count the moment the split
covers the row. The stage figure's own basis therefore sits in the row it
qualifies, at the reading distance of the figure it qualifies, and `0/2` beside
a `—` says what the dash is.

It costs no prose. The owner's standing objection to this block is the number of
small texts on it, and a count in a column of counts is not a new text.

### The heading names the column that is thin, and deletes itself when it is not

`The same 147 waits · heard in measured on 5 so far`. One clause, in the
middle-dot line the block already uses, naming the column rather than the rows —
the per-row counts are in the rows. It is stated for **the cut on screen**: the
two cuts fill together but are counted apart, and a reader looking at one of
them is owed that one's coverage.

The split table now carries two self-deleting statements that leave at different
times: the sentence from ADR 0247 goes when the first split lands, and this
clause goes when the last unsplit run leaves the ledger.

### Both figures a partial row prints are asserted, in both runtimes

The frontend case draws a row of four runs with one split and asserts `1/4`, the
clause, and the same pair under the other cut. The Rust case records three
dictations of which one carries a split and asserts that the total histogram
holds three, the stage histogram one, and the stage median is read off the run
that has one — the shape the surface's new claim rests on.

## Consequences

- The count track widens from `3rem` to `4rem` in both grid templates, including
  the collapsed one where the pair never appears, so run counts do not shift
  sideways on the day the first split lands.
- A reader can now tell a thin stage figure from a settled one without hovering,
  and the tooltip stays as the sentence form of the same fact.
- The whole apparatus is temporary by construction. An installation that has
  only ever known the split never sees a pair, a clause or a dash.
- While auditing the same file, `LedgerCause::buckets` was added to the axis
  guard in `migrate` beside the `heard_buckets` ADR 0247 put there — one field of
  a pair was defended against an edited bucket constant and its sibling in the
  same struct was not — and a cause row emptied by that guard is now dropped, as
  the mode cuts beside it have been since ADR 0243.
