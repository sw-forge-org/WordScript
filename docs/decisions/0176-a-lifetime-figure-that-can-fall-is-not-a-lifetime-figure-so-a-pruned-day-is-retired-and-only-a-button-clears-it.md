# 0176: A lifetime figure that can fall is not a lifetime figure, so a pruned day is retired and only a button clears it

Date: 2026-08-16
Status: Accepted. Sixth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Hardens the ledger
[ADR 0174](0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md)
introduced, and is the reason the reset in Privacy & Data exists.

## Context

The owner asked where the figures behind Home's counters are stored, what
happens when the history is deleted, and stated the requirement plainly:

> They should simply accumulate after installing the app and never become less
> again. You should be able to reset them, but in the settings, under privacy,
> somewhere as a red button.

Three quarters of that was already true and one quarter was quietly false.

**What was already right.** `core::activity_ledger` writes
`~/.config/WordScript/activity.json`, separate from `history.json`, and is
written in exactly one place — `history::record_entry_with_work_mode`, the funnel
every path arrives at. There is no delete path. Clearing the transcription
history does not touch it. Deleting one transcript does not touch it. A retry is
not counted. That is ADR 0174 working as designed.

**What was false.** `prune()` dropped day rows past `LEDGER_RETENTION_DAYS`
(800) so the file cannot grow without bound on a machine somebody keeps for a
decade — and it dropped them, full stop. `totals()` summed the rows still
present. So every lifetime figure this product will ever draw begins **falling**
after two years and two months of daily use: the exact failure ADR 0174 was
written to prevent, reintroduced by the code that keeps the file small. Nothing
showed it yet because no surface drew an all-time total, which makes it the kind
of defect that ships.

**And there was no reset at all**, so the only way to clear the figures was to
delete a file by hand.

## Decision

### A pruned day is retired into the totals, not dropped

`ActivityLedger` gains `retired: LedgerDay` and `retired_through: Option<String>`.
`prune()` folds each doomed row into `retired` on its way out;
`totals()` is `retired` plus the days still held.

**Monotonicity is now structural rather than careful.** There is no sequence of
writes, prunes or restarts that can lower a total, because nothing subtracts —
the only operations are `+=` and `max`. The retention horizon bounds the FILE and
never the FIGURES, which is what the owner asked for and what a counter has to be
able to promise to be believed at all.

`started_on` now survives the prune too. It answered "how far back does this go"
and used to follow the pruning, because a date whose row had been dropped claimed
a depth the file did not have. With `retired` speaking for those days it no
longer claims anything false: the totals really do reach that far. What may not
reach that far is the CALENDAR, which draws day rows and therefore draws only
what `days` still holds — ADR 0172's rule, unchanged.

### The reset is a door of its own, in Privacy & Data

`reset_activity_ledger` replaces the file with an empty ledger, and Privacy &
Data's *Delete and reset* card gains a third destructive row for it.

**It is not a side effect of clearing the history**, and the row says so.
Deleting transcripts is housekeeping; wanting the record of a year's dictation
gone is a separate intention, and collapsing the two would mean somebody tidying
their transcripts loses a figure they cannot get back.

**The empty ledger carries `reset_at_ms`, and without it the button would not
work.** `seed_from_history` folds whatever history still holds into an EMPTY
ledger, and an empty ledger is exactly what a reset produces — so the next time
Home opened, every retained record would come straight back and the reset would
read as broken. A ledger that has been reset never seeds again; it counts from
the next dictation.

### The day rows carry more, and every new field is additive

`LedgerDay` grows `spoken_words`, `speech_seconds`, `voiced` and the three
`saved_*` fields ([ADR 0177](0177-a-rate-that-counts-a-models-words-over-an-open-microphone-is-not-a-speaking-rate.md),
[ADR 0178](0178-time-saved-may-only-credit-what-somebody-would-have-typed-and-the-baseline-is-the-readers-to-set.md)),
and the ledger grows a `languages` tally
([ADR 0180](0180-the-lane-that-most-dictations-take-never-names-a-language-so-the-language-is-measured-on-the-text.md)).
All are `#[serde(default)]`, so a file written by an older build reads back with
zeroes rather than failing — and the counts a zero produces are honest, because
that build really did not measure them.

## Consequences

- A lifetime total can be drawn without the promise expiring in 2028.
- The one control that lowers these numbers is a button somebody presses on
  purpose, and it is where the other destructive doors already are.
- `activity.json` is in the full backup, merged rather than replaced — see
  [ADR 0179](0179-the-ledger-is-the-only-thing-in-an-archive-that-cannot-be-rebuilt-so-a-restore-raises-it-and-never-replaces-it.md).
- The ledger is still counts per day and never text. The one thing added that is
  not a duration or a tally is a language tag, which is two letters.
