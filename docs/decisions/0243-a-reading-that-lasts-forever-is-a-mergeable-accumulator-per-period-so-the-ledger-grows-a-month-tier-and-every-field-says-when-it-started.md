# 0243 - A reading that lasts forever is a mergeable accumulator per period, so the ledger grows a month tier and every field says when it started

Date: 2026-08-19
Status: **Accepted.** Opens Stage I of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)).

Supersedes the day-row bound in
[ADR 0176](0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md)
and the two places it is read from; qualifies
[ADR 0179](0179-the-ledger-is-the-only-thing-in-an-archive-that-cannot-be-rebuilt-so-a-restore-raises-it-and-never-replaces-it.md)
by giving the merge a second tier to raise; extends
[ADR 0240](0240-the-index-is-read-when-it-changes-carries-what-a-row-needs-and-the-turnaround-causes-move-into-the-ledger.md)'s
cause map with a second, independent cut and a cap that no longer loses runs;
and closes the open half of
[ADR 0236](0236-a-turnaround-is-read-by-band-and-by-cause-the-language-is-stored-on-the-record-and-a-control-that-will-not-act-is-not-shown.md)
by splitting *Not named* into the two populations it has always been.

## Context

The owner's instruction was one sentence: **every metric on Home must be able to
exist indefinitely.** That is not a feature request, it is a constraint on the
shape of a stored reading, and measuring the current ledger against it found that
almost nothing on Home satisfies it today.

### What actually happens after two years and two months

`LEDGER_RETENTION_DAYS` is 800. A day row past the horizon is absorbed into
`retired`, which is one `LedgerDay` and one `retired_through` stamp — the figures
survive and **the shape does not**. Everything downstream is built on that shape:

- `series.ts` starts every series at `ledgerSpeaksFrom`, which is the day after
  `retired_through`. So the *Months* tab can never hold more than 26 buckets and
  **the *Years* tab can never hold more than three**, on any installation, at any
  age. `PERIOD_FLOOR` is 3, so *Years* appears at two years of use and then never
  grows again. A tab that stops learning is worse than one that never appeared.
- The calendar's year picker offers the years the day rows reach. After 800 days
  the third year back stops being offerable, and nothing on the screen says the
  record used to hold it.

So the honest description of today's product is: **Home is all-time in its
totals and 2.2 years in every shape.** The totals were the part ADR 0176 was
written to protect, and it protected them exactly.

### Two defects found by measuring rather than by reading

**The irreplaceable file is written whole, pretty-printed and non-atomically, on
every dictation.** `write_to_disk` is `serde_json::to_string_pretty` followed by
`std::fs::write` — truncate in place, no temporary, no rename. On the reporting
machine `activity.json` is **21,326 bytes on disk against 5,634 bytes of
minified content: 73% of the file is indentation**, and `recorded_seconds` is
stored as `4647.276553287982`, twelve digits of which three are meaningful.

This is the defect Stage G found on `history.json` — *the write is whole-file,
non-atomic and pretty-printed* — and Stage H fixed for the index and not for the
ledger. It is worse here than it was there: ADR 0179 says in its own title that
this is the one file in an archive that cannot be rebuilt from anything else. A
crash between truncate and the last byte destroys it, and there is no second
copy to replay from.

**`MAX_CAUSE_KEYS` drops runs silently.** `add_turnaround_cause` returns without
counting when the map holds 64 keys and the key is new. The rows then stop
summing to `turnaround_buckets`, and the display's own note — that they do —
becomes false with no signal. Sixty-four is generous for a week and small for a
decade: the model catalogue turns over, and every retired model holds its slot
forever while the current one is refused.

### What the nine raised points have in common

Seven of the nine open items on the track page are the same question wearing
different clothes:

| Raised as | Actually |
| --- | --- |
| Turnaround and languages have no history (4) | Neither is stored per period |
| A per-mode turnaround cut (5) | The cause map has one dimension |
| *Not named* holds 91 forever (6) | Two populations sharing one counter |
| A third marker needs a list (2) | Two constants where a list belongs |
| The ledger reloads on a count that can stall (8) | A derived key standing in for an event |
| Home fetches every summary to draw five rows (9) | The reader asks for more than it draws |
| Words per minute before ADR 0177 (1) | A field with no *measured from* stamp |

They are not seven repairs. They are one missing rule, applied seven times.

## Decision

### 1. The rule: a reading that lasts forever is a mergeable accumulator

**Every reading on Home is stored as a fixed-size accumulator per period, and
every derived figure is computed at read time.** Sums, counts, maxima and
histograms are mergeable — two periods combine into one by adding them, with no
loss. Medians, means, rates and shares are not stored at all; they are derived
from the accumulators whenever a surface asks.

This single rule is what makes a metric infinite. Coarsening a period is merging
accumulators, so a day can become a month and a month a year without the reading
losing its meaning, and the file's size stops being a function of the product's
age past the point where the coarsest tier is reached.

**The rule is also a gate.** A reading that cannot be expressed as a mergeable
accumulator does not go on Home. If a future tile needs one that cannot — a
distinct-count, a most-recent-value, a percentile that must be exact rather than
binned — it belongs on a surface that speaks for a window rather than for a
lifetime, and it says so.

### 2. The ladder: days roll, months never do

Three tiers, all made of the same row type, and a reading is the sum of the
tiers that speak for the period asked about:

| Tier | Holds | Bound |
| --- | --- | --- |
| `days` | one row per day | rolling, `LEDGER_DAY_ROWS` |
| `months` | one row per month | **never pruned** |
| `retired` | everything before the ladder existed | one row, kept for the migration |

**The tiers are disjoint, and that is the whole of the arithmetic.** A lifetime
total is `retired` plus `months` plus `days`, each row counted exactly once. A
day lives in `days` until it is pruned and in `months` afterwards, never in
both.

**Why disjoint and not overlapping.** A `months` tier that also held the live
days would let the *Months* tab answer for today, at the price of two tiers that
have to be written in the same breath forever. A write path that updated one and
forgot the other would diverge **silently**: every figure would still be a
plausible number and nothing on any screen could say which one had gone wrong.
The disjoint ladder fails loudly instead — a tier that was not written reads as
absent, and the surface above it draws nothing rather than a number that is
quietly short. The current month is answered from the day tier, which holds it.

A day past the horizon is folded into its month on the way out, exactly as it is
folded into `retired` today — the row leaves and the figures do not, one tier up
instead of all the way. `years` is not a stored tier: twelve month rows are a
year, and storing the sum as well would be a second copy of one fact
(ADR 0123).

**Why months are the floor and not weeks.** A week is not a subdivision of a
year, so a *Years* tab built on weeks has to attribute a boundary week to one of
two years and be wrong about half of it. Months nest; weeks do not. The *Weeks*
grain is therefore day-derived and reaches exactly as far back as the day rows,
which is what it already does and what its own tab will now say.

**The cost, measured rather than assumed.** A day row minifies to 253 bytes
today and to about 330 with the accumulators below. Twelve month rows a year is
under 4 kB a year: **fifty years of month rows is under 200 kB**, against 4.9 MB
if every day row were kept instead. The day tier stays bounded because it is the
calendar's source and the calendar draws a year at a time.

**What a surface may say, per tier.** `ledgerSpeaksFrom` becomes one answer per
grain rather than one answer: days speak from the oldest day row, months from
the oldest month row, and a chart drawn at a grain the record cannot reach is
not drawn at all. ADR 0172's rule is unchanged — an unlit cell is an assertion —
and it now has two horizons instead of one.

**Two stamps, and they answer different questions.** `retired_through` is the
last day that is no longer in `days`. It moves every time `prune` runs, and the
calendar reads it to know which years it may still offer at day resolution.
`prehistory_through` is the last day the opaque `retired` row speaks for: it is
written once, by the migration, and never moves again. **The month series starts
after it**, because the month `prehistory_through` falls in is split between a
blob that cannot be broken up and month rows that can — drawing it would draw a
part month as a whole one. On a ledger that never pruned before schema 3,
`retired` is empty, the stamp is absent, and the day rows are the whole record.

**Merging two ledgers takes the LATER `prehistory_through`**, deliberately the
opposite of every other date in `raise_to`. The other stamps answer *how far
back does this record reach*, and the earlier one wins. This one answers *how
far forward is this record opaque*, and a merge is opaque wherever either side
is.

### 3. Every accumulator carries the day it started being measured

`measured_from` is a map of field name to `YYYY-MM-DD`: the first day the
runtime wrote that accumulator. A series may not draw a period that begins
before its field's stamp, because a zero there is a claim about the product's
past that the record cannot make.

This is the general form of a special case the track has hit three times. The
speech clock exists from ADR 0177 forward (point 1). The spoken-language verdict
exists from 2026-08-18 forward (point 6). Both were handled with prose. Every
field added after this ADR handles itself, and a field added by a later session
that forgets to stamp it draws nothing rather than drawing zeroes.

**Merging two ledgers takes the EARLIER stamp**, for the same reason `raise_to`
takes the earlier `started_on`: an archive that measured a field sooner is
evidence the reader has been measuring it for longer.

### 4. What a row accumulates

The eleven existing fields are unchanged. Added, all mergeable by addition:

| Field | Why |
| --- | --- |
| `turnaround_runs`, `turnaround_ms_sum` | An exact mean per period, at two numbers |
| `turnaround_log[41]` | The shape per period: forty quarter-octave buckets from 25 ms, reaching 25.6 s, plus one overflow bucket |
| `languages: {code → count}` | Point 4's language history, bounded by ISO 639-1 |
| `language_refused` | The verdict was asked for and came back empty |

**`language_unasked` is derived and never stored.** It is the row's own
`dictations`, less the named runs, less the refused ones. A third stored counter
would give one row two ways to disagree with itself: `raise_to` merges field by
field, so a stored remainder could survive a merge that moved the two figures it
is the remainder of. Derived, it cannot be wrong unless the row it is derived
from already is.

**Why a log histogram and not the fine one.** `turnaround_buckets` is 400
buckets at 25 ms; per period that is 12 kB a year of mostly zeroes. The display
draws five bands whose edges are chosen per lane from three sets, so storing
fixed bands would freeze a choice the display makes at read time. Quarter-octave
buckets are band-set agnostic: any edge is a sum of buckets plus at most one
interpolated bucket, and the interpolation error is bounded by the bucket's own
width, 19%. **The fine histogram stays, all-time only**, because the tile states
a median to one decimal and a quarter-octave median moves that digit.

**Why `Not named` splits into two populations and not one flag.** They have
different futures. `language_unasked` is frozen — it counts records written
before the verdict existed and nothing will ever move it. `language_refused`
grows every day, at 13% of dictations on the reporting machine's first full day
with the field. One counter holding both says a true number that answers no
question; two say *this many were too short, and this many are from
before we asked*, and only the first is worth acting on.

### 5. Two independent cuts of the turnaround, and a cap that keeps the sum

`turnaround_causes` keeps its `provider/model` key. A second map, `mode_causes`,
keys the same runs by `effective_mode`. **They are two one-dimensional cuts of
one total and never a cross-tab**: a cross-tab is the product of two bounded
sets and is bounded only in the sense that a large number is finite.

The 64-key cap gains an `other` row. A run whose key is new when the map is full
is counted there rather than dropped, so **the rows sum to the histogram at
every age of the installation**, which is what the display already claims.
`mode_causes` needs no cap: `ProcessingMode` is an enum.

### 6. The write becomes atomic, compact and unchanged in frequency

Three changes to `write_to_disk` and none to when it is called:

- **Atomic.** Write `activity.json.tmp`, rename over `activity.json`. The rename
  is what makes it atomic; a failed rename leaves a stray sibling, which is
  swept, rather than a torn ledger, which is unrecoverable.
- **Compact.** `to_string` rather than `to_string_pretty`: 73% of the file
  measured. Seconds are rounded to milliseconds on the way in — three decimals —
  because `4647.276553287982` is a float artefact and not a measurement.
- **Every dictation, still.** The ledger is an accumulator over a bounded file,
  not a log over an unbounded one, so the argument that made the index a journal
  does not reach it: there is no second copy to replay a lost write from, and
  the write is a fraction of a millisecond at the sizes this ladder permits.
  **The two files got different answers because they have different shapes**,
  and this paragraph exists so that a later session reading ADR 0241 does not
  conclude the ledger was simply missed.

### 7. The consequences on the reading side

- **The ledger is re-read on the event, not on a key.** `useActivityLedger`
  loses its `reloadKey` parameter and listens to the same record-writing events
  and `visibilitychange` that the history hook listens to (ADR 0240). A derived
  key is a guess about when something changed; the event is the runtime saying
  so. This deletes point 8 rather than repairing it — there is no key left to
  stall.
- **Home asks for what it draws.** The five recent rows are a query with a
  limit, and the owed-fallback list is its own filter rather than a scan of
  every summary the store holds. Home drew five rows out of 519 records and
  paid 519 summaries for it, on every dictation.
- **A marker is a row in a list.** The two constants become a table of
  `{date, label, kind}` fed by the constants and the ledger's own dates. A third
  marker is a row; the legend names the kinds present rather than one word; the
  hover keeps carrying the label, which is where a name is readable.
- **The rate states its coverage.** `timed` against `voiced` is on every row
  already: the tile says over how many of the counted runs it was measured,
  which is the honest close of point 1 and needs no new field.

### 8. What is decided and not built

**An undo window is one row deep.** If multi-selection ever lands on History, a
multi-row delete confirms rather than offering an undo — ADR 0195's reasoning
holds for one row and inverts for thirty, and the reader clearing a list is
exactly who a thirty-row undo fails. This is a decision rather than an open
question so that the next session finds an answer instead of a discussion.

## Consequences

**The migration is schema 2 to 3, and the month tier starts empty on purpose.**
Because the tiers are disjoint, a migration that folded the existing day rows
into their months would count every one of them twice. Days arrive in `months`
the way they will always arrive: through `prune`, one at a time, as they pass
the day horizon. What the migration does write is `prehistory_through`, copied
from `retired_through` where the ledger had already retired something — the one
fact the new tier needs and cannot derive later, because `retired_through` will
have moved by then.

The new per-period accumulators are backfilled from whatever the index still
holds — the same seed path ADR 0176 built — and every one of them gets a
`measured_from` stamp of the earliest day it could be filled for, so no chart
draws a zero for a period that predates its field.

**Measured on the reporting machine, after the migration ran.** Schema 3, no
stray temporary, **21,326 bytes to 8,421**, 580 dictations before and 580 after,
`months` empty and `prehistory_through` absent — both correct on a record whose
oldest day row has not yet reached the horizon. The per-period backfill filled
four day rows: 468 timed runs and their log buckets, the language split, and
`mode_causes` at 465 `cleanup` against 3 `agent` — the first cut of the
turnaround by mode that has ever existed. `measured_from` stamps both new fields
at 2026-08-16, the earliest day the index could still speak for.

**The file gets smaller before it gets bigger.** On the reporting machine the
minification and the rounding took 21,326 bytes to 8,421 with the new
accumulators already in it; the accumulators
and the month tier add back roughly 80 bytes a day row and 4 kB a year. The
crossover is around a year of use, and the fifty-year figure is under 300 kB.

**Two claims on the track page are corrected by this record.** *Not named will
hold 91 runs forever* was measured at 104 the following day and grows daily — it
was the sum of a frozen population and a live one. *A per-mode cut is the free
version of this* was not free: the cause map has no mode dimension, and giving
it one is the same schema change as everything else here, which is why it is in
this ADR rather than ahead of it.

**What this does not do.** It does not touch the index, the archive or their
byte budgets (ADR 0241, ADR 0242); it does not make anything from before a
field's `measured_from` recoverable, because nothing can; and it does not give
the calendar day-resolution beyond the day tier — a year older than the day
horizon is answered by the month grain, and the year picker offers what each
tier can speak for rather than a year it would have to draw empty.
