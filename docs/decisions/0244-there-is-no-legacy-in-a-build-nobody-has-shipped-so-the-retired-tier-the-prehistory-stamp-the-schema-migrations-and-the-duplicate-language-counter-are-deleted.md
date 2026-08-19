# 0244 - There is no legacy in a build nobody has shipped, so the retired tier, the prehistory stamp, the schema migrations and the duplicate language counter are deleted

Date: 2026-08-19
Status: **Accepted.** Closes the two defects Stage I's own surface exposed
([`../tracks/home-activity.md`](../tracks/home-activity.md)).

Reverses the `retired` tier of
[ADR 0176](0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md),
whose reason
[ADR 0243](0243-a-reading-that-lasts-forever-is-a-mergeable-accumulator-per-period-so-the-ledger-grows-a-month-tier-and-every-field-says-when-it-started.md)
removed the day before; reverses `prehistory_through` and the schema 2-to-3
migration from ADR 0243 itself; and deletes the lifetime `languages` term that
has stood since
[ADR 0180](0180-the-language-is-measured-on-the-text-that-came-back-not-on-the-setting-that-asked-for-it.md).

## Context

### Two defects on one screen, and they were one defect

The owner opened the Languages metric and said `Never asked` makes sense only
for him, as the one developer with accumulated local data. Measuring proved him
right, for a reason neither of us had stated in ADR 0243.

**`Never asked` does not measure what its own label and its own ADR say.** Both
called it *the runs from before the record kept an answer*. It is actually **the
reach of the seed**: `ledger.languages` has counted live since ADR 0180, while
the per-day split was seeded from the records the index still held on the day
ADR 0243 shipped. Sixty runs on the reporting machine sat in the first and not
the second, because the index had lost their records to edits and retention in
between. On the live path every counted dictation increments exactly one of
`languages` or `language_refused`, so on any installation from here on the
figure is structurally zero, forever.

**And the same split had put an arithmetic on the screen that does not add up.**
The facts list read `Named 479 of 586`, `Too short to name 114`, `Never asked
60`. 479 comes from the lifetime map; 114 and 60 come from the tiers. They sum
to 653 against 586 dictations. Two generations of one counter, drifted by 67
runs, presented as one list — which is precisely the plausible wrong number this
whole track exists against, produced by the record that was written to prevent
it.

### The rule the owner set, and it is wider than this screen

> *Wir löschen alle lokalen Daten, die akkumuliert haben von mir, weil wir sind
> im Developer-Modus. Wir wollen keine Migrationen bauen, wir wollen keine zwei
> Systeme bauen, die irgendwie an lokalen Legacy-Daten festhalten, bei einem
> Developer-Build, also nicht mal einer Release-Build-Version. Das ist nicht
> meine Arbeitsumgebung.*

**There has never been a release build, so there is no installed base, so there
is no legacy.** Every construct that exists to carry data forward from a build
nobody ran is cost with no beneficiary — and, as the two defects above show, it
is not merely idle cost: a compatibility path that is never exercised by a real
user is still exercised by the one developer, and its output reaches the screen.

## Decision

### 1. The test a compatibility construct has to pass

A migration, a legacy field or a conversion fallback earns its place only if
**some machine outside this repository could hold the data it converts.** Today
none can. The question is not *could this ever be needed* — everything could —
but *does any installation hold it*.

**What this does not license.** Guards that defend against THIS build's own
constants changing stay: the histogram axis guards and the bucket-width guards
drop a histogram counted on a scale this build does not use. That is not
compatibility with a past build, it is a defence against a plausible wrong
number in the present one, and it fires on a developer who edits a constant.

### 2. `retired` and `retired_through` are deleted

ADR 0176 introduced them because a day row past the horizon lost its shape: the
figures had to go somewhere or a lifetime total would run backwards. **ADR 0243
removed the reason.** A departing day is folded into its month and months are
never pruned, so nothing in the ledger is ever opaque. `totals()` is `months +
days`, and the day tier's floor is simply its oldest row.

### 3. `prehistory_through` is deleted

It was written one day ago, by ADR 0243, to mark the month split between the
opaque blob and the month rows — *the one column a month series starts after
rather than on*. With no blob there is no edge, and the month series starts at
the oldest row of either tier with no exception to state. **A field introduced
to describe a construct is deleted with that construct**, rather than kept
because it is new.

### 4. The schema migrations go; the stamp stays

The `schema < 2` branch (ADR 0177's rate-histogram change of meaning) and the
`schema < 3` branch (ADR 0243's prehistory stamp) are deleted. `LEDGER_SCHEMA`
keeps the value **3** rather than being renumbered to 1: **a version stamp that
counts backwards is worse than one with gaps**, and it would collide with the
historical schema 1 in every ADR and commit that names it. The gaps are in the
git history and in ADR 0177 and ADR 0243, which is where a reader looks.

The stamp itself is kept because it is what the first release build will need on
the day it exists. **This record is not a licence to skip migrations after that
release** — from it forward every user holds data and every schema change owes
them a path. It is a statement that before it there is nobody to migrate.

### 5. One language counter, and it is the tiered one

The lifetime `languages` map is deleted from the ledger. `ledgerLanguages()`
keeps its name and its signature and reads `ledgerTotals().languages`, so the
Home tile, the bar chart and the facts list all come off one source.

ADR 0123 says one list per fact, and the drift above is what a second copy
costs. The tiered counter is the survivor rather than the older one because it
is the one with a per-period split and a `measured_from` stamp — it can answer
every question the lifetime map could and one it could not.

### 6. `language_unasked` is deleted, and the denominator says what it counts

`Named: n of m` states **`m = named + refused`**: the runs a language was asked
of. By construction the two rows sum to it at every age, on every machine.

This is the same shape the speaking rate already uses — `Measured over: 4 of 6`
counts the runs that carried a speech clock, not every dictation. A metric
states the population it was measured over; the lifetime dictation count belongs
to the tiles, where it is the answer to a different question.

### 7. Two cuts of one total say so where the reader is looking

`Which model heard it` and `What the mode cost` are two one-dimensional cuts of
the same timed runs, and three stacked headings each ending in a total invited
exactly the reading that they are components of one. The second heading now
reads **`the same 474 runs`**, and where a run carries no named mode it reads
`470 of the same 474 runs` rather than leaving the shortfall to a source
comment that claimed the surface stated it.

## Consequences

**The reporting machine's accumulated data is deleted, not migrated** —
`activity.json`, `history.jsonl` and the transcript archive. That is the
decision above applied to its own author: keeping them would have meant keeping
every construct this record removes.

**A ledger from before this change is not read.** There is no conversion and no
detection. This is safe exactly once, and the window closes at the first release
build.

**What is kept, and why it is not legacy.** The seed from the index rebuilds a
lost or corrupt ledger from records that still exist — a recovery path, not a
compatibility one. `raise_to` merges a restored backup field by field
(ADR 0179) — a product feature. Both survive.

**What this does not touch.** The index and the archive keep their journal,
their retention and their byte budgets (ADR 0241, ADR 0242); the accumulator
rule, the day-to-month ladder and `measured_from` are ADR 0243's and are
unchanged. What is removed from ADR 0243 is only the part that existed to carry
one developer's file forward.
