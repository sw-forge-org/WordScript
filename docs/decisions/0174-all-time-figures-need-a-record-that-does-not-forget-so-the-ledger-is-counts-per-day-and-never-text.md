# 0174: All-time figures need a record that does not forget, so the ledger is counts per day and never text

Date: 2026-08-16
Status: Accepted. Fourth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). **Closes Stage B
row B3**, which
[ADR 0172](0172-an-unlit-cell-is-an-assertion-so-the-calendar-spans-what-the-record-can-vouch-for-and-nothing-more.md)
identified and deferred; the owner pulled it into scope by asking for all-time
counters. Supersedes 0172's `activityWindow`, which inferred the record's depth
from pruning and is now answered directly.

## Context

Home's counters read `history.json`, and history is pruned on every read by age
(`history_retention_days`) and by count (`history_limit`). ADR 0172 recorded the
consequence and worked around it: **no figure built on history can be
lifetime-scoped**, because a total summed from a pruned list grows, sticks at the
limit, and then runs *backwards* as the oldest records fall off. A counter that
goes down is a counter nobody believes again.

So Stage A took window labels — *the last 7 days*, *N of M runs measured* — and
0172 named the durable fix as a Stage B row without building it.

The owner then asked for the counters to be all-time. That is not a labelling
change; it is the row 0172 deferred. There is no honest shortcut: the data to
answer *how many words have I ever dictated* does not exist anywhere on disk once
history has rotated.

## Decision

### A separate record, which is an aggregate and therefore keepable forever

`core::activity_ledger`, at `~/.config/WordScript/activity.json`. **One row per
day**, holding five numbers:

| Field | What it is |
|---|---|
| `dictations` | Runs that produced words |
| `words` | Their total |
| `recorded_seconds` | Summed capture clock, over the runs that carried one |
| `timed` | How many of them did |
| `longest_seconds` | The day's longest capture |

**Never text, never a transcript, never which application was in front, never a
language.** That is what makes it keepable: a year is 365 rows of five integers,
so retention costs nothing, and an aggregate of counts gives up nothing about
what was said. It is a materially smaller privacy surface than the history file
it sits beside, which is the opposite of what "a new persistent collection"
usually means — and it is why this needs no new retention rule of ADR 0138's
shape, unlike the target-application field that track still owes.

Pruned at 800 days on write, so the file cannot grow without bound on a machine
somebody keeps for a decade.

### It is written at the one funnel every path already arrives at

`history::record_entry_with_work_mode` — the same function ADR 0074 put the
transcript file on, for the same reason. The native pipeline, an empty result, an
insert failure, a transcription failure and a retry all land there, so "every
dictation is counted once" is structural rather than a rule five callers have to
remember.

**A retry is not a dictation and is not counted.** It re-runs a transform over
words that were already spoken and already counted; counting it again would
inflate every all-time figure by however often somebody pressed Retry, which is a
number with nothing to do with how much they dictate.

**A failed ledger write never fails the record.** It is logged and swallowed. A
dictation that reached the cursor has succeeded, and failing it because an
aggregate could not be written would be the tail wagging the dog. The same
reasoning makes an unparseable ledger a replaced ledger rather than a startup
error: every figure in it can be rebuilt by living another day, and refusing to
dictate because a statistics file is corrupt trades the product for its
bookkeeping.

### It seeds once from whatever history still holds

The ledger starts the day it is installed and **cannot invent a past**. What it
can do is not throw away the records still on disk the first time it runs — on a
fresh install that is nothing, and on an existing one it is however much history
was retained. On the machine this shipped against the seed recovered 52
dictations and 3,106 words.

It runs from the read command rather than at startup, so it costs nothing on a
launch nobody opens the workspace on, and it is idempotent: a ledger with rows is
already seeded, because re-folding history would double every day the two share.

### `started_on` is the install date, as closely as anything can say

Nothing in this product ever recorded when it was installed. The ledger's first
row is the honest answer, and it makes the track's decision 7 — *the display
grows with the installation* — literally implementable rather than approximated
from pruning. It follows the pruning too: a `started_on` whose row has been
dropped would claim a depth the file no longer has.

### Time saved stays windowed, and everything else goes all-time

**Four weeks**, at the owner's direction, and the reasoning is worth keeping: a
lifetime *time saved* stops being something a reader can hold. Twenty hours saved
since March is a trophy; four hours saved this month is a fact about your month.
Four weeks rather than a calendar month so the figure never jumps because
February is short, and because four weeks is the calendar's own unit.

Words per minute is all-time. It is a **rate**, so it was always the figure least
troubled by pruning — but "all time" and "over whatever survived" are different
claims, and only one of them is now true.

## Consequences

**`lib/activity.ts` lost seven functions and gained five.** `wordsIn`,
`countableRuns`, `timedRuns`, `wordsPerMinute`, `timeSavedMinutes`,
`activityDays` and `activityWindow` all read history and are superseded; they
were deleted rather than left as a second way to compute the same figures, which
is how two answers to one question get shipped. The word counting moved into
Rust, at the funnel, where it happens once per record instead of on every render.

**`activityWindow`'s inference is dropped rather than replaced.** It deduced how
far back the record could be believed from the two pruning arms in order to size
the calendar; the ledger keeps every day it has seen, so the deduction has no
job left. The line under the grid names the span it covers and nothing else —
how far the record reaches is a fact about a settings value, and a calendar is
not where anybody asks for one.

**The calendar is worth looking at on this machine for the first time.** It drew
one real column from a seven-day history; it now draws from a record that keeps
every day, and it deepens by a column a week from here.

**Two dates formats now exist, deliberately.** The ledger keys `YYYY-MM-DD`
because it is a file a person may open and a padded ISO date sorts; the vendored
heat map parses `YYYY/M/D`. The conversion lives in `ledgerKeyToDayKey`, once.

**Nothing is migrated and nothing is lost if the file is deleted.** It is derived
bookkeeping: remove it and the next read re-seeds from history and starts again,
poorer by whatever history no longer holds.
