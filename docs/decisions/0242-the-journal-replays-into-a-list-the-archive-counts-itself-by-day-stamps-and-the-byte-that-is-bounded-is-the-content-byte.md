# 0242 - The journal replays into a list, the archive counts itself by day stamps, and the byte that is bounded is the content byte

Date: 2026-08-19
Status: **Accepted and built.** Stage H rows H1 to H5 are landed.

Implements
[ADR 0241](0241-a-bound-on-stored-dictations-is-a-bound-in-bytes-so-the-index-becomes-a-journal-and-both-collections-get-a-warning-and-a-ceiling.md),
which decided the units and left four things to whoever built it. This record is
those four answers and their evidence. It decides nothing 0241 decided; where the
two touch, 0241 is the policy and this is the mechanism.

## Context

ADR 0241 is a decision about units: months are the policy, gigabytes are the
backstop, records are neither. It names three caveats and hands them forward
rather than resolving them, and it leaves the index's file format described but
not specified. Building it required answering:

1. What the journal's file is called and what a line in it is.
2. How the archive is counted, given that ADR 0241 measured a 10 GB ceiling at
   roughly 15 million files and said explicitly that *the byte ceiling is the
   policy; day-level sharding and a sidecar count are the work required to reach
   it honestly.*
3. Which byte the check reads — content or disk occupancy — which 0241 says
   *whoever implements the check decides deliberately.*
4. Where the ceiling is enforced.

## Decision

### 1. `history.jsonl`, one line per operation, and the array is converted once

The extension is the contract. The file is no longer a JSON document and a tool
that opened it expecting an array should fail on the first line rather than on
the second.

A line is `{"put": <entry>}` or `{"tombstone": {"id": …}}`. A record is a put; a
delete is a tombstone; **an edit is the record put again**. The reading half owns
what it parses and the writing half borrows what the store already holds, which
is why there are two types for one shape — an owned `Put` on the write path would
copy every field of the record to serialise it, on the dictation path.

**Oldest first in the file, newest first in the store.** Append only ever adds at
the end and a list only ever reads from the top, so the two orders are opposites
and `replay_journal` is the single place they meet. Replay folds the log with one
pass and an id map rather than a scan per line; a put of an id already held
replaces it **in place** rather than moving it, because an edit is not a
re-arrival — acknowledging a fallback on last month's record must not shuffle it
to the top of the reader's list.

**A line that will not parse is skipped and costs that one record.** An append can
be interrupted by a kill or a full disk, and what that leaves is a torn last line.
Refusing the file over it would throw away every record on the machine to report
a half-written one. This is the property the old whole-file write did not have at
all until ADR 0240 gave it a rename.

The one migration ADR 0241 allows itself: an existing `history.json` is read once
— the parse was already written — converted, and **deleted**, so the branch runs
once per install and never again.

### 2. The archive counts itself by day stamps, and the tally cannot go quietly wrong

`YYYY/MM/` becomes `YYYY/MM/DD/`. The file keeps the day in its name even though
the directory now carries it: a transcript dragged out of the tree into a mail
client still says which day it is from, and `<HHMM>-<slug>.md` would not.

**The reader's existing files are not moved.** ADR 0237 is explicit that the
folder is theirs; relocating thousands of their files to tidy a layout is not a
migration this product gets to make. A month directory holding files is a shard
in its own right and stays one, so both layouts are on one code path forever.

The sidecar — `.wordscript-archive.json`, invisible to the name check and
therefore to the count, the purge and the eviction — **does not record a total.**
It records a tally per shard beside that shard's directory modification time.
Creating or deleting a file touches its directory, so a shard whose stamp has not
moved holds exactly the files it held when it was counted, **including files the
reader deleted by hand.** A reader who empties half of last March in their file
manager moves exactly one stamp and the next reading recounts exactly that shard.

This is the reason to prefer it to a cached total, and it is the whole
justification: a cache that can silently disagree with the truth has no business
behind a reader-facing number. Editing a file's contents does not move a
directory stamp and does not need to — a transcript is written once and never
rewritten.

Enumerating shards reads the root, each year and each month and **never descends
into a day**. Fifty years of dictation is about 18,000 day shards, enumerated
with roughly 600 `read_dir` calls and one stat each. What it replaces stat-ed
every file in the archive on workspace activation and again on every visit to
Privacy & Data.

### 3. The bounded byte is the content byte

ADR 0241 measured 320,933 bytes of content against 1.9 MB of `du`, and stated
that at a 392-byte median every transcript occupies one 4 KB block — 86% of the
archive's disk footprint is filesystem slack.

**Content.** Occupancy is not a property of this product; it is a property of the
reader's filesystem block size, and the same archive would be six times larger on
one machine than on another. A bound that moves when you change filesystems is a
bound that cannot be stated, and this one is stated on a screen. The index is
measured as the file's own length **including its dead weight**, because that is
what is actually on the disk.

The consequence is recorded rather than hidden: **on a 4 KB-block filesystem the
archive's real disk cost at the ceiling is several times the ceiling.** The
number the product states is the number it can defend across machines; the number
a file manager shows will be larger.

### 4. Enforcement is at startup, beside the capture sweep

Not on the dictation path. A check there would cost every sentence a measurement
to defend against a threshold about fifty years away. At startup it costs one
`metadata()` for the index and one pass over the archive's day stamps, and cannot
miss by more than a session.

**A compaction is tried first and often ends it.** The journal holds tombstones,
superseded puts and everything retention pruned out of memory; none of that is a
record the reader would lose, and a store over its ceiling on dead weight alone
must not answer by deleting live history. Only when the rewritten file is still
over does anything get evicted.

Eviction goes to **90% of the ceiling rather than to the ceiling**, or the store
would sit permanently at its limit doing a compaction per sentence. Order is
oldest first, read off the path and the filename rather than off `mtime`: a
modification time is changed by a backup restore, a sync client or a `cp -r`, and
the tree carries the day the dictation actually happened.

## Consequences

**The per-dictation index write no longer depends on the index.** Measured on a
release build, both writes in one pass, at the four sizes ADR 0240 used:

| records | append | the rewrite it replaced |
| --- | --- | --- |
| 1,000 | 0.012 ms | 3.5 ms |
| 2,000 | 0.012 ms | 7.5 ms |
| 5,000 | 0.006 ms | 19.3 ms |
| 10,000 | 0.006 ms | 38.3 ms |

Flat against a line, and about 6,000 times cheaper at 10,000 records.
`measure_the_index_write_against_index_size` runs both columns together so the
claim is read off two curves rather than against a number from another day and
another build.

**`history_limit` is gone from the contract, not just from the screen.** ADR 0241
deletes the ceiling; the field it was pinned to had nothing left to be pinned to.
It is out of `AppConfig`, out of `src/types/ipc.ts`, out of the export document
and out of `prune_entries`. A config or an export written by any earlier build
carries a field this one has no name for and loses it without losing the
retention rule beside it.

**Two ignored measurement harnesses were reading an array that no longer
exists.** `capture_integrity_measurement` and `transform_context_measurement`
both read the developer's live store directly and both print their record count
as a finding. Parsing `history.json` after this change answers zero records, and
somebody writes that zero down. They go through the replay now, and fall back to
the array on a machine that has not yet run a build with the journal in it.

**One test in the archive suite exists only to prove the cache is used.** Every
other test there would pass just as well if the tally were written and then
ignored, because a full recount gives the same answer. That one plants a tally
which disagrees with the tree under a stamp that matches it and asserts the wrong
number comes back — which nothing but a cache hit can produce. A performance
change with no test that can fail when the performance is gone is an untested
change.

**The retention test stopped using the cap to make something drop.** It pushed a
record out with `history_limit`, which was the easy way to make the prune visible
and was also the wrong rule to be testing: what sweeps this index is age. The
record is now aged in the journal, which is the only way to have one older than
the process that wrote it.

**The archive's rule on Privacy & Data stopped saying *nothing prunes them*.**
That was true and was the gap: ADR 0237 gave the files their own lifetime and
then left it infinite. The sentence now names the backstop, and both cards carry
a live figure and a warning tone.

## Alternatives considered

**Keep the file called `history.json`.** Rejected. Every path in every document
would have stayed the same, and the extension would have claimed JSON over
JSONL — the one lie a data file cannot afford, because the next tool to open it
is not this product.

**Cache one total for the archive instead of a tally per shard.** Rejected on the
failure mode rather than the cost. A total is invalidated by a write this module
performs and by nothing a reader does, so a reader deleting files by hand would
see a stale figure with nothing in the product able to notice. Day stamps make
the cache self-healing, and the sharding that ADR 0241 required for other reasons
is what makes them cheap.

**Recount the whole archive once per launch instead of caching.** Rejected at the
scale the ceiling implies: 15 million stats is not a launch cost, and a
correctness argument that only holds while the store is small is the argument ADR
0241 was written to stop accepting.

**Move the reader's existing `YYYY/MM/` transcripts into day directories.**
Rejected. ADR 0237 makes that folder the reader's, and two shapes on one code
path is a smaller cost than a product that rearranges a person's files to suit
its own `readdir`.

**Bound the archive by disk occupancy.** Rejected — see section 3. Retained as
the thing the documentation has to admit rather than the thing the check reads.

**Enforce the ceilings on the dictation path.** Rejected. It is a backstop
against a runaway, not a retention rule, and paying for it per sentence to catch
a threshold decades away is the same mistake as bounding a store in records.
