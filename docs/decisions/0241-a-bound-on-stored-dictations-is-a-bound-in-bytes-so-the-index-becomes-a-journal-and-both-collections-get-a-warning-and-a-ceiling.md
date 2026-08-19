# 0241 - A bound on stored dictations is a bound in bytes, so the index becomes a journal and both collections get a warning and a ceiling

Date: 2026-08-19
Status: **Accepted, and not built.** This record is the decision and the brief;
no code in the tree implements it yet. Supersedes the count ceiling of
[ADR 0185](0185-retention-is-a-duration-you-set-and-a-count-you-are-told-and-the-audio-a-failure-parks-is-its-own-collection.md)
and the ceiling arithmetic of
[ADR 0240](0240-the-index-is-read-when-it-changes-carries-what-a-row-needs-and-the-turnaround-causes-move-into-the-ledger.md)
section 5, both of which bound the index in records. Amends
[ADR 0237](0237-the-transcripts-are-their-own-collection-so-the-index-retention-stops-taking-them-and-the-archive-gets-a-reading-and-a-door.md):
the transcripts remain their own collection with their own lifetime, and that
lifetime stops being unbounded. Leaves
[ADR 0176](0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md)
untouched, because the finding below is that it already did the work.

## Context

ADR 0240 raised `HISTORY_CEILING` from 1,000 to 5,000 on a measurement of what
the per-dictation write costs. The review that followed was asked a plainer
question by the owner:

> Es würde doch viel mehr Sinn machen, für das Archiv ein Ceiling reinzumachen.
> [...] Aber der Index braucht doch wirklich kein Ceiling. [...] Und genau den
> Index brauchen wir ja für diese ganzen Statistiken, die wir ungefähr überall
> in der App darstellen.

The question contains a premise, and the premise is wrong. Establishing that is
most of this record, because it is the reason the answer is not "move the
ceiling to the other collection".

### What was measured, on the reporting machine, 2026-08-19

Read from the live stores, not estimated:

| | | |
| --- | --- | --- |
| `~/.config/WordScript/history.json` | 1,208,861 B | 497 records, **2,432 B/record**, one line |
| `~/WordScript/transcripts/**/*.md` | **320,933 B** | 469 files, mean **684 B**, median **392 B** |
| `~/.config/WordScript/activity.json` | **21,295 B** | the same 497 dictations |

Rate over the window (2026-08-16 20:43 to 2026-08-19 03:35, 2.3 days):
**217 dictations a day.** At that rate `HISTORY_CEILING` at 5,000 is reached in
**23 days**, and the reader's own `history_retention_days` is set to **365**.
The count bites first by a factor of sixteen, and nothing on any screen says so.

`du` reports the archive as 1.9 MB against 320,933 B of content. The difference
is not accounting error: at a 392 B median every transcript occupies one 4 KB
block, so **86% of the archive's disk footprint is filesystem slack.** A bound
written in bytes and checked against content therefore under-counts real disk by
roughly six times at today's median file. This is stated here so that whoever
implements the check decides deliberately which of the two numbers it reads.

### The index does not carry the statistics, and has not since ADR 0176

`activity.json` carries them. Its shape, read from the live file:

- `days` — **one row per calendar day**, eleven counters, not one row per
  dictation. Four rows for 497 dictations.
- `retired` plus `retired_through` — a day row that ages out past
  `LEDGER_RETENTION_DAYS` (800) is **absorbed into `retired`, not dropped**
  (`activity_ledger.rs`, `fn prune`). `totals()` is `retired` plus the days
  still held, so every lifetime figure is monotone for the life of the install.
- `rate_buckets` and `turnaround_buckets` — 400 elements each, fixed forever.
- `turnaround_causes` — capped at 64 keys by ADR 0240.
- `languages` — one entry per language seen.

Whole file: 21,295 B, growing by one fixed-size day row per day, with a hard
horizon of 800 rows and a roll-up bucket behind it. **This is already the
unbounded-statistics store the question was asking for.** It is O(1) per
dictation, bounded in size, and monotone in what it reports.

The only figure Home derives from index rows is `owed` — the unacknowledged
clipboard and scratchpad fallbacks of ADR 0044. That is a worklist, not a
statistic.

So what a ceiling on the index actually costs is **the History list and the
per-record detail behind it**: the transcript pair, the badges, the retry. Not
one tile, not the activity calendar, not the rate distribution, not the
turnaround histogram, not the language split. Those survive the index by design
and have since ADR 0176.

### Why the count existed, and why it stops making sense

`HISTORY_CEILING` never bounded disk. It bounded the **write**, because the
index is one JSON array rewritten whole on every dictation. ADR 0240's own
table: 5,000 records is 12.1 MB and 24.9 ms per dictation; 10,000 is 24.3 MB and
59.4 ms. Extrapolated to a year at 217 a day — 79,000 records — the same write
is roughly 192 MB and 400 ms **on the dictation path**, and about 42 GB of disk
writes a day.

That is a real cost and the ceiling was a correct answer to it. It is also an
answer to a cost that does not have to exist. ADR 0240 said as much in the
constant's own doc block: *"an append-only journal would make the write O(1) and
delete this constant. That is a change to how the file works, not to a number in
it."* Once the write is O(1), the record count stops being the thing worth
bounding, and the only cost left is disk — which is measured in bytes.

The owner's position, given after the measurements above were presented:

> Alles, was lokal gespeichert ist, ist egal. Das sind meine Daten, lokal, die
> können wir wegschmeißen. Wir brauchen keine Migrationen [...] Aber 5000
> Diktate macht keinen Sinn. Das überhaupt auf die Dateien zu fokussieren, statt
> auf den Speicher.

## Decision

**Months are the policy. Gigabytes are the backstop. Records are neither.**

That sentence is the whole decision, and it lands ADR 0185's own reasoning —
*nobody reasons about their own privacy in units of the last two hundred
dictations, they reason in months* — which the count ceiling had been quietly
overriding at a factor of sixteen.

### 1. The index becomes an append-only journal

`history.json` stops being one JSON array rewritten whole. One record is one
line appended; writing dictation number 80,000 costs what dictation number 1
cost, the same as writing its transcript file does today. Deletes and edits are
tombstones. Compaction rewrites the file, and it runs on activation or on a
tombstone fraction — never on the dictation path.

### 2. `HISTORY_CEILING` is deleted

Not raised. The constant, its measurement table and `query_limit`'s clamp go
with it. Nothing in the product states a number of dictations as a limit, and
Privacy & Data stops offering one to read.

### 3. Both collections are bounded in bytes, with the same two numbers

| | Warning | Ceiling |
| --- | --- | --- |
| The index (`history.json`) | **5 GB** | **10 GB** |
| The transcript archive (`~/WordScript/transcripts/`) | **5 GB** | **10 GB** |

Two collections, two independent budgets, same thresholds. At the ceiling the
oldest records are evicted first, in the collection that hit it, and only in
that collection — ADR 0237's separation of lifetimes stands; what changes is
that the archive's lifetime stops being infinite.

These numbers are backstops against a runaway, not a retention policy. At the
reporting machine's rate 10 GB of index is roughly 4.1 million records and about
fifty years. **A bound nobody reaches is the intended shape of this.** The bound
the reader is meant to feel is `history_retention_days`, which they set, in
months, and which after this record is the only thing that reaches them.

### 4. The reading is on the screen, and the threshold is not the surface

Because 5 GB will not arrive, a warning wired only to 5 GB is a warning that
never fires and therefore is not a feature. Privacy & Data keeps showing the
live figure for both collections — it already does for the archive, via
`transcript_store_status` — and gains the same reading for the index. The
threshold notice is the backstop's voice, not the reader's instrument.

### 5. Local data is disposable, so there is no migration

No reader-data migration is written for any of this. An existing
`history.json`, an existing archive, an existing `activity.json` may be read if
reading them is trivial and **discarded if it is not**. This is a developer
install and the owner has said so twice; the standing rule is
[*Local data on this machine is disposable*](../IMPLEMENTATION.md#local-data-on-this-machine-is-disposable),
added with this record. Do not spend a stage rescuing local state. Do not write
a schema migration for the journal.

The one exception is the exception ADR 0179 already names: the **ledger** is the
only file here that cannot be rebuilt from anything else, because its retired
totals speak for days whose records are gone. `activity.json` is carried
forward. Everything else may be dropped.

## Consequences

**The list stops being the shortest-lived thing in the product.** Today the
index reaches 23 days while the reader's setting says 365 and the ledger reaches
800. After this the three agree, and `history_retention_days` is the only number
that governs.

**The archive gains a bound it did not have, and this is a real amendment to ADR
0237.** That record decoupled the files from the index retention so that a
record aging out of the list never took its text. It stands. What it did not do
was give the files a lifetime of their own, and the answer to *"when do the
transcripts go?"* was *"never, unless you press the button"*. Now it is *"at
your retention, or at 10 GB, whichever comes first"*.

**File count bites roughly a hundred times earlier than the byte ceiling, and
the implementation has to answer that.** 10 GB at a 684 B mean is about 15
million files. The layout is `YYYY/MM/`, so that is on the order of 1.2 million
files in one directory, and `store_transcript_files` already walks the whole
archive and stats every file on workspace activation and on every Privacy visit
(the open item recorded in `docs/tracks/home-activity.md`). **The byte ceiling is
the policy; day-level sharding and a sidecar count are the work required to
reach it honestly.** Whoever implements this must not present a 10 GB ceiling
that the directory layout cannot survive.

**The journal makes the O(records) finding of ADR 0240 obsolete rather than
smaller.** That record cut the payload 54.6% and made the write atomic, and said
in the same breath that it had not stopped being linear. This is the change that
stops it.

**`transcription_history_summaries` keeps its shape.** ADR 0240's two-shape
contract — a summary for the list, a record fetched by id — is what makes an
unbounded index affordable to display at all, and nothing here disturbs it.

**Two thresholds in the product are now expressed in bytes, and nothing else
is.** Every other limit here is a duration or a count. Whoever writes the
setting surface should resist adding a third unit to the screen: the reader sets
months, and reads gigabytes.

## Alternatives considered

**Raise `HISTORY_CEILING` again.** Rejected as the wrong unit twice over. It was
raised from 1,000 to 5,000 four commits ago and still lands at 23 days; the next
raise buys weeks and doubles a per-dictation cost that should not exist.

**Move the ceiling to the archive and drop it from the index, leaving the write
as it is.** This is the question as originally asked, and it is rejected on the
measurement: the archive is O(1) to write and 92 years from 5 GB of content, so
a bound there buys nothing and only deletes the reader's transcripts; the index
is the one with a cost that grows, and removing its bound without changing its
format is the one combination that actually breaks.

**Bound the archive by file count rather than bytes.** Rejected as the
reader-facing policy — the owner's point stands, and a person reasons about
disk, not about inodes. Retained as an internal constraint on the archive
layout, which is where it belongs.

**No bound at all, on either.** Rejected. An application that can fill a disk
without ever saying so is not honest, and honesty about its own state is what
this product claims over generic voice tools.
