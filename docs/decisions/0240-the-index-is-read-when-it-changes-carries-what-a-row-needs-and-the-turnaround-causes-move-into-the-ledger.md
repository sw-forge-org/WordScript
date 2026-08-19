# 0240 - The index is read when it changes, carries what a row needs, and the turnaround causes move into the ledger

Date: 2026-08-19
Status: Accepted. Completes
[ADR 0237](0237-the-transcripts-are-their-own-collection-so-the-index-retention-stops-taking-them-and-the-archive-gets-a-reading-and-a-door.md),
which decoupled the transcript files from the index and left one limitation
open: the turnaround cause list still read `history.json` and so still reached
about five days. Extends the ledger of
[ADR 0176](0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md)
with a fourth all-time structure and applies the field-wise merge of
[ADR 0179](0179-the-ledger-is-the-only-thing-in-an-archive-that-cannot-be-rebuilt-so-a-restore-raises-it-and-never-replaces-it.md)
one level down. Supersedes the ceiling arithmetic in
[ADR 0185](0185-retention-is-a-duration-you-set-and-a-count-you-are-told-and-the-audio-a-failure-parks-is-its-own-collection.md)
without disturbing what it decided.

## Context

ADR 0237 stopped the index retention from deleting the reader's Markdown files
and said so on Privacy & Data. It left the cause list under the turnaround view
reading `history.json` — a lifetime median with a five-day list under it, and a
sentence in the UI explaining why the two disagreed.

Asked how to remove that limitation rather than explain it, the owner asked a
different question first:

> Warum bitte wird denn history.json bei jedem Diktat komplett gepasst und
> wieder komplett zurückgeschrieben? Macht das überhaupt Sinn? […] jede Metrik
> in Home bekommt nur das, was sie wirklich braucht und generell jede Funktion
> in der App bekommt nur das, was sie wirklich braucht, damit wir nicht immer
> unnötigen Ballast mitschleppen und dann solche Ceilings wie 1000 Files
> zustande kommen.

**Half of that premise was wrong and the correction matters.** The index is
parsed ONCE — `ensure_loaded` returns early on a `loaded` flag and
`load_history_entries` runs only on first access. It is *written* whole on every
dictation, which is the half that is true.

### What was measured, on the reporting machine, before any change

`~/.config/WordScript/history.json`, 476 records, 1,167,199 bytes minified —
**2,452 bytes a row**.

| term | bytes/row | share |
| --- | --- | --- |
| the two transcripts | 667 | 27.2% |
| `work_mode` (the whole profile snapshot) | 362 | 14.8% |
| `input_level` | 161 | 6.6% |
| `capture_integrity` | 130 | 5.3% |
| `recovery_message` | 90 | 3.7% |
| `transcript_path` | 88 | 3.6% |
| everything else | 954 | 38.8% |

**Three findings, and the second is the worse one.**

1. **The cause list was the only reading on Home that was not all-time.** Four
   tile figures and the turnaround band chart all come from `activity.json`;
   only the cause list read the records, because the records were the only place
   `provider`, `model` and `turnaround_ms` ever sat together.

2. **`useTranscriptionHistory` polled `transcription_history_entries` every five
   seconds, with no limit.** The command cloned every entry out of the store,
   filtered the clone, serialised the result whole; the hook then compared it to
   the previous answer with `JSON.stringify(entry)` per entry. That is 1.2 MB
   over the bridge and two more full serialisations, **twelve times a minute**,
   for a file that changes when somebody dictates. Home hangs on the same hook
   and needs four figures and a three-row list.

3. **The list was sent every field of every record, and read about a thousand
   bytes of it.** An inventory of all nine frontend consumers found nothing
   reading `spoken_language`, `effective_mode`, `provider_profile`,
   `local_beam_size`, `local_best_of`, `local_prompt_strength`,
   `local_prompt_carry`, `fallback_available`, `recovery_action`,
   `recovery_message`, `clipboard_restore`, `input_level`, `active_driver`,
   `turnaround_ms` or `speech_seconds` off a history entry — 591 bytes a row.
   All fifteen ARE read by the runtime, so they are storage, not ballast; they
   were simply shipped because nobody had asked which half a screen wanted.

Two smaller ones fell out of reading the writer: `save_history_entries` used
`to_string_pretty`, and it wrote with a bare `std::fs::write`, which truncates
before it writes — a crash between those two leaves a half-written index, which
fails to parse, which loses every record on the machine.

The owner authorised all of it:

> Ja, der Punkt ist, bei 1000 Records macht das keinen Sinn mehr, deswegen
> müssen wir das optimieren. Und der schlimmere Fund, den du hast, den kann man
> auch optimieren. Und die anderen Sachen, ja, lass uns das komplett optimieren,
> dass es nachhaltig und professionell gebaut ist und nicht so komisch.

## Decision

### 1. The index is read when it changes, not on a clock

The five-second interval is gone. `useTranscriptionHistory` listens on
`wordscript-event` — the channel `useRuntime` has used since the beginning — and
refreshes on the three events that write a record: `transcription`, `error`,
`empty`. `visibilitychange` is the second trigger, so a dropped emit costs a
stale row until the window is next focused rather than stranding the list.

**No slow safety poll beside the listener.** That is the half-measure the
instruction above rules out: a clock that fires rarely is still a clock, and it
would make the event path untestable — a case could no longer tell whether the
list refreshed because a record landed or because a timer went off.

Every mutation the hook performs itself — delete, clear, retry, acknowledge —
already refreshes on its own answer and always did.

### 2. The turnaround causes move into the ledger

`ActivityLedger` gains `turnaround_causes: BTreeMap<String, LedgerCause>`, keyed
`provider/model`, each row a bucket array on the **same 25 ms axis** as
`turnaround_buckets`. Written from the same funnel and under the same condition
as `add_turnaround`, so no live run can land in one and not the other.

- **The pair is stored on the row, not parsed back out of the key.** A model id
  may contain a slash — several vendors namespace theirs that way — so a reader
  splitting `provider/model` would be right on this machine and wrong on
  somebody else's.
- **The map is bounded at 64 keys.** Every other structure in that file is
  fixed-width or keyed by something with a small closed range. This one is keyed
  by whatever a provider called its model, so a vendor that renames on every
  release, or a reader working through a local model library, would grow the
  file without limit. Past the bound, known pairs keep counting and a new one is
  dropped rather than evicting somebody's history.
- **A run with no model name is filed under its provider.** The frontend already
  did this with the same records: the vendor is the coarser true answer, and
  dropping the run instead would stop the rows summing to the histogram.
- **The seed has its own flag.** `seed_turnarounds` is false on every machine
  whose histogram is already full, which is exactly the population that needs
  the causes seeded. Sharing the flag would have skipped it there.

`turnaroundCauses` in `src/lib/series.ts` now reads the ledger and decides
nothing: the retry rule, the empty-model fallback and the no-clock rule all moved
into the runtime funnel. The UI note explaining the discrepancy is deleted rather
than reworded — a sentence apologising for a defect outlives the defect unless
somebody removes it.

**A ledger seeded after the fact starts a little short, and that is stated
rather than discovered.** The histogram was already full on any machine that
dictated before the map existed, so the map is filled from history, and history
is the shallower record. On the reporting machine the first launch after the
change filled three rows and **420 of 422 runs**: the seed skips a record that
delivered no words and the live funnel counts its wait. The gap is fixed at seed
time and never widens.

### 3. The list carries what a row needs, and the record is fetched by id

A new wire shape, `TranscriptionHistorySummary`, is what
`transcription_history_summaries` returns. It carries the twenty-one fields a
surface reads, `processing_mode` in place of the 362-byte `work_mode` snapshot,
and a **160-character preview** of each transcript.

`transcription_history_record(id)` returns one whole entry. The three places
that need the actual text — the raw panel, Copy, Restore — ask for the record
they are about, at most one at a time.

- **`PREVIEW_CHARS` is 160 because the median delivered text is 135**, so most
  rows carry their whole text and read exactly as before; the ones that do not
  were being cut by the heading's own width regardless.
- **The cut is on a character and never on a byte.** German is most of this
  machine's corpus and `str::truncate` on a byte index inside `ü` panics.
- **`transcripts_identical` is decided in the runtime on the FULL texts.** Two
  cuts can agree where the whole texts do not, and the raw panel's *the AI stage
  rewrote it* hangs off that comparison.
- **The panel opens on the preview and fills in.** A spinner over text that is
  already complete in half the cases is worse than a paragraph that grows once.
- **Copy and Restore fetch first.** Placing a truncated dictation is the one
  case where the cut would be a data loss rather than a display.

**The record still holds every field.** This is a wire shape, not a storage
decision: the export exports what it exported, and a screen that comes to need a
dropped field adds it back to the summary.

`summaries_snapshot` holds the lock, prunes, filters by reference and maps
straight into the wire shape — **no record is cloned at all**, where the old path
cloned the entire store and then discarded most of it.

`areHistoryEntriesEqual` compares `id`, `status`, `title` and
`fallback_acknowledged` instead of serialising twice. Everything else on a
summary is written once with the record; a field this misses shows as a stale
row until the next event, and the previous version paid 1.2 MB a read to catch a
case that has never happened.

### 4. The index write is compact and atomic

`to_string` rather than `to_string_pretty` — 229 kB of the reporting machine's
1.4 MB, 16%, for a file nobody opens by hand. `activity.json` keeps its
`BTreeMap` ordering precisely so a human can read it; this one is a machine index
and the export command exists for the case where somebody wants to look.

The write goes to a sibling `.tmp` and is renamed into place, so a reader sees
the old file or the new one and never a torn one. The temp file lives beside the
target because a rename across filesystems is a copy and is not atomic.

### 5. `HISTORY_CEILING` goes from 1,000 to 5,000

ADR 0185 set it against the wrong cost — *a thousand transcripts is a few
hundred kilobytes of text, so this bounds the index rather than the disk* — and
disk was never what bound it.

Nothing else depends on the number now: the all-time figures are in the ledger
(ADR 0176), the turnaround causes with them, and the transcripts stopped being
deleted with the index (ADR 0237). A record aging out of the index loses its
metadata and its retry, never its text.

So the number is what the per-dictation write costs. Measured on the reporting
machine, release build, serialise plus atomic write:

| records | index | per dictation |
| --- | --- | --- |
| 1,000 | 2.4 MB | 4.8 ms |
| 2,000 | 4.8 MB | 9.2 ms |
| 5,000 | 12.1 MB | 24.9 ms |
| 10,000 | 24.3 MB | 59.4 ms |

25 ms against a 1,210 ms median turnaround is 2% — under the noise of the
network call it follows — and it buys 25 days at 196 dictations a day, or eight
months at twenty. Ten thousand doubles the cost to buy a reach nobody asked for.

The same table in a **debug** build reads 81 ms at 1,000 and 442 ms at 5,000.
The owner runs a dev host all day; that is a development cost, not a shipped
one, and it is worth knowing before somebody measures a turnaround on it.

## Consequences

**The list payload fell 54.6%** — 2,453 bytes a row to 1,113, measured by
building the summary shape over the machine's real 478 records. Together with
the poll going away, the settings window went from ~14.1 MB a minute to ~532 kB
per dictation, and only while it is open.

**The cause list is all-time and the surface stopped apologising.** Its head
reads *N runs all time* and the note under the chart lost the sentence about
pruning. The one thing it still says — that a mode which rewrites text has a
second model inside the same wait, which the record does not name — is unchanged
and still true (ADR 0182).

**Two commands were renamed, and one of them is registered under a new name.**
`transcription_history_entries` is now `transcription_history_summaries`.
`acknowledge_transcription_fallback`, `clear_transcription_history_entries` and
`delete_transcription_history_entry` return summaries.

**Fifteen stored fields no longer reach a screen.** A future surface that needs
one adds it to the summary; nothing needs to be re-measured or re-derived,
because none of them left the record.

**What is NOT fixed: every term here is still O(records) per dictation.** The
index is one JSON array rewritten whole, so 5,000 is a trade and not a solution.
An append-only journal would make the write O(1) and delete the constant
entirely — that is a change to how the file works rather than to a number in it,
and it is the next thing to do if the ceiling is ever felt again.

## Alternatives considered

**Raise `HISTORY_CEILING` and stop.** The owner's first instinct and the wrong
one: it moves the wall without touching what built it, and at 12 reads a minute
of an unbounded payload it makes every dictation more expensive on the way.

**Keep the poll and add a limit to it.** A limit fixes the payload and not the
frequency, and it would have made History's own pager wrong — the screen reads
the whole filtered set and counts it.

**A slow poll beside the event listener, "for safety".** Rejected above.

**Send the whole record and let the frontend pick.** That is what it did.

**Compute the cause list's median from the raw waits instead of the buckets.**
It is one bucket coarser off the histogram (25 ms), and being on the same axis
as the bands drawn above it is worth more than the precision — ADR 0181 recorded
what happens when a figure and its chart disagree about their axis.

**Fetch the whole page's records instead of one on expand.** The page size goes
to 100, and the longest single transcript on this machine is 4,192 characters.
One record on a press is the true bound.
