# 0247 - A wait is two stages, so the runtime measures both, and every metric detail states its reading before it draws the evidence

Date: 2026-08-22
Status: **Accepted.** Closes the defect the owner found on the turnaround
detail, and applies its correction to the other three metrics on the same block.

Extends [ADR 0181](0181-the-wait-starts-when-you-stop-speaking-not-when-the-file-is-already-written.md)
by splitting the interval it defined; corrects the reading of
[ADR 0240](0240-the-index-is-read-when-it-changes-carries-what-a-row-needs-and-the-turnaround-causes-move-into-the-ledger.md)
and [ADR 0243](0243-a-reading-that-lasts-forever-is-a-mergeable-accumulator-per-period-so-the-ledger-grows-a-month-tier-and-every-field-says-when-it-started.md),
whose two cause maps were both true and both mislabelled; and replaces the
`Facts` grid and closing note that [ADR 0235](0235-a-metric-opens-its-own-view-of-the-home-block-and-it-draws-only-what-its-record-can-carry.md)
gave every detail view.

## Context

### Two tables held one number under two headings that promised different things

The turnaround detail drew a list headed **Which model heard it** and, directly
under it, a list headed **What the mode cost**. Each row carried a name, a run
count and a bare figure in seconds. The owner read them and asked, in this
order: are those the total seconds or extracted ones; how long did the model
take; for what exactly; what does *what the mode cost* mean; which time; is the
first model in it or out of it. Then: the explanation underneath does not make
it better.

Every one of those questions was unanswerable from the surface, and five of the
six were unanswerable from the record.

`ActivityLedger::add_turnaround_cause` and `add_mode_cause` were called from one
statement with one argument — the same `turnaround_ms`, the whole interval from
the capture stopping to the text being final. Filed under the recogniser it
became *which model heard it*; filed under the mode it became *what the mode
cost*. It was neither. It was what the dictation took, counted twice.

On the reporting machine that produced a table nobody could have read correctly:
one model row at `0.9 s` over 138 runs, and a Cleanup row at `0.9 s` over 129 of
those same runs. The two figures agreed because they were the same measurement,
and a reader comparing them was comparing a number with itself. The heading over
the second promised the additional cost of running Cleanup; had that been the
figure, it could not have equalled the whole wait.

The owner also read `What the mode cost` as `what the model cost`. The two
headings differ in one letter of one word, and there was nothing else on either
block to tell them apart.

### The record could not have answered it

A history entry kept `turnaround_ms` and nothing else about time. The
pipeline measured one instant — after the mode transform returned — and
subtracted the start. No stage boundary was ever written down, so the split
could not be recovered from the records on disk on any machine in the world.

### And the surface put its meaning where nobody reads it

The same view, and the three beside it, each ended in a centred paragraph at
`--t-micro` explaining what the numbers meant, above which sat a three-column
`<dl>` of terse headings — `Nine in ten under`, `Measured over`, `Named`,
`Mostly`, `Thinking pauses`. The reading a person came for had to be assembled
by combining a three-word label with a paragraph that arrives after every use of
it. Four charts carried their subject only in an `aria-label`, which states it
to a screen reader and to nobody looking at the screen.

## Decision

### The runtime takes two readings, and the pair travels as one

The native pipeline marks the instant the transcription response returns. The
audio export and the provider round trip are the **hearing**; everything after
is the **rewriting**. `TurnaroundFacts { total_ms, heard_ms }` replaces the
lone `Option<u64>` on every signature the wait travels through, for the reason
`CaptureFacts` is one parameter rather than three: two adjacent `Option<u64>` in
a nine-argument signature are distinguished only by their order, and swapping
them is a silent failure whose only symptom is a plausible figure.

`LedgerCause` gains `heard_buckets` and the ledger gains
`mode_transform_causes`, each on the same 25 ms axis as everything else in that
file. Each stage is read off its own histogram and never as a difference of two
medians: medians do not subtract, and `median(total) − median(transform)` is a
number with no referent that would nonetheless have looked entirely plausible.

**Absent is not zero.** A run whose split was never measured counts in the
totals and in no stage histogram. Nought is a real reading — Verbatim runs no
model and genuinely rewrites in no time at all — so a run that was never
measured may not be filed as an instant one.

### One table, two cuts, and named columns

The two lists become one block with a heading, a `by model` / `by mode` toggle
and an actual header row: **runs**, **heard in** or **rewrote in**, and **in
total**. The heading states the population — *The same 138 waits*, or *134 of
the same 138 waits* where a cut is short — so *are these the same runs* is
answered before it is asked, and *are these the total seconds* is answered by
having both columns on screen at once rather than by a paragraph.

No record on disk can fill the stage column, so on every existing installation
it starts empty and fills from the next dictation. Where nothing has filled it,
**the column is not drawn at all** and one sentence says when it will arrive. A
column of dashes reads as a broken table.

### Every metric states its reading first

The `Facts` grid and the closing paragraph are deleted from all four views and
replaced by a lead: one figure, one clause saying what it is a figure of, and
one line of qualifying clauses. `1.0 s from you stopping to the text being
ready` / `middle of 138 dictations · 9 in 10 came back under 3.1 s`.

Every chart carries a visible title. The read-out under a plot is replaced the
moment a pointer crosses it, so it can say what a *column* is and never what the
drawing is.

**Prose is the last resort.** Anything that can be a label on the thing it
describes becomes one — a column header, a chart title, a clause in the lead.
What survives as a sentence is what has no object to attach to: on this whole
block that is now one sentence, on the split table, and it deletes itself once
the stage column has anything in it.

## Consequences

- The turnaround detail goes from eight blocks and about fourteen separate
  micro-texts to six blocks, and every figure on it has a label attached to it.
- `heard_ms` is written to every history record from now on and is `None` on
  every record already written. The stage columns are therefore empty on this
  machine at first launch and fill with use. This is stated on the surface
  rather than hidden.
- A mode's own cost is measurable for the first time. A reader who wants to know
  what Cleanup costs them can read it and act on it, which is the one thing on
  this block they can change without changing lanes.
- The two cause maps keep their end-to-end histograms. `in total` is still the
  whole wait, and the rows still sum to `turnaround_buckets` exactly as ADR 0240
  requires.
- The split is measured to the millisecond the provider returns, so the
  recogniser-output repair — string work on text already in memory, well under a
  millisecond — is counted with the mode rather than with the hearing. Naming
  that is cheaper than a third stage nobody would read.
