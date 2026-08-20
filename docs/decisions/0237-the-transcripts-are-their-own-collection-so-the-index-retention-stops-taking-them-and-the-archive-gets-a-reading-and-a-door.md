# 0237 - The transcripts are their own collection, so the index retention stops taking them, and the archive gets a reading and a door

Date: 2026-08-19
Status: Accepted. Reverses one rule of
[ADR 0074](0074-a-transcript-is-a-markdown-file-and-the-history-record-is-its-index.md)
— *the transcript directory has the retention the index has and by nothing
else* — and keeps everything else that ADR decided. Applies the collection rule
of
[ADR 0138](0138-a-retention-rule-names-the-collection-it-governs-and-the-copilot-does-not-read-your-dictations.md)
and the reading-plus-door shape of
[ADR 0185](0185-retention-is-a-duration-you-set-and-a-count-you-are-told-and-the-audio-a-failure-parks-is-its-own-collection.md)
to a third collection those two left inside a second one.

## Context

Reading the turnaround cause list on 2026-08-18 turned into a question about
where its records come from, and the answer surfaced something nobody had
looked at since ADR 0074.

**The index is small, and the transcripts died with it.** `history.json` is
capped by `HISTORY_CEILING` at 1000 records and swept by
`history_retention_days`. The prune calls `remove_transcript_files` on
everything it drops, so a Markdown file the reader wrote is deleted when its
INDEX ENTRY ages out — not when the reader is done with it.

**On the reporting machine that is about five days.** 417 entries were written
in 51 hours, roughly **196 dictations a day**, so the thousand-record ceiling is
`1000 / 196 ≈ 5.1 days` of writing. The account's `history_retention_days` also
stood at 7 — a leftover from before ADR 0185, which recorded the same machine at
`history_limit: 50, history_retention_days: 7` and raised only the first of the
two. Either way the binding number is the ceiling, and neither number was chosen
with a file archive in mind.

**The owner's reaction is the decision.** Asked which of four repairs to make —
raise the ceiling, fix the local retention value, bound the index by bytes, or
decouple the files — the answer was the fourth, and it arrived as a question
about the other collection: **what happens to the Markdown entries, and why is
there a history retention of seven days with a limit of a thousand at all? Both
are far too short.**

**ADR 0074's reasoning was about drift, and it still holds for the other half.**
Its rule exists because *a retention rule that holds for one of the two stores
is worse than none: it reads as a guarantee and is not one.* That argument is
correct about a rule the screen prints, and it silently assumed the two stores
answer the same question. They do not. The index is a **surface** — what History
can list, what the cause list can group, what a filter can reach. The archive is
the reader's **writing**, in a plain folder in their home directory, in a format
made to outlive this product (ADR 0074's own framing). A cap chosen so a list
stays fast has no business deleting the second one.

**And an unread rule is not a promise either.** Nothing on any screen said the
files were on the index's clock. Privacy & Data's retention hint said *older
dictations are deleted with their transcript files*, which is the sentence this
record makes false — and it was the only place the coupling appeared at all.

## Decision

**1. The retention prune stops touching the files.**
`prune_entries_for_runtime` drops the index entry and leaves the Markdown where
it is. Every other path is unchanged: deleting a row, clearing the history and
the retry sweep all still remove the file the entry names, because those are
intentions and the prune is housekeeping. It is the same cut ADR 0176 made for
the activity ledger — *deleting a transcript is housekeeping and must not cost
the reader their lifetime record; wanting the record gone is a separate
intention and gets a separate control.*

**2. The archive becomes its own card on Privacy & Data**, with the rule stated
and the reading beside it: how many files are on the machine and how many bytes
they are. Three collections became four, and the screen's own rule is that a
card names what it governs.

**3. And a door, because a rule with no reading is half an answer** (ADR 0185's
words about the parked audio, and the same failure here). Once the index entry
is gone the runtime no longer knows the path, so no in-app control could reach
an orphaned file at all — the archive would be write-only from the product's
side. `purge_transcript_archive` walks the store root and deletes what the store
itself wrote.

**4. The purge deletes only the store's own layout.** `YYYY/MM/DD-HHMM-slug.md`
and nothing else: a file the reader dropped into that folder, renamed, or wrote
themselves is left alone, and so is any directory that is not a four-digit year
holding a two-digit month. This is ADR 0074's *the runtime deletes only paths it
wrote* held to, one level up — the walk is allowed because a person pressed a
button that names what it will remove, and the shape check is what keeps the
button honest.

## Consequences

- **The archive is kept forever by default.** There is no second age rule and
  deliberately not: a duration on the files would be the two-controls-over-one-
  list defect ADR 0185 removed, rebuilt against a different pair of stores. The
  folder is the reader's, and the door is explicit.
- **Orphaned files are now normal, and the card is how they are seen.** A file
  whose index entry has been pruned is unreachable from History — no row, no
  Reveal, no Retry. The count on Privacy & Data is the only place the product
  admits they exist, which is why the reading is not optional.
- **The backup still carries both.** `export_full_backup` takes the config, the
  index and the transcript files; nothing about that changes, and an archive
  larger than the index is now the expected shape rather than a sign of drift.
- **This does not lengthen the index.** The cause list on Home still reaches
  only as far as `history.json` does — about five days on the reporting machine
  — and so do History's rows and every filter on them. Raising
  `HISTORY_CEILING` is a separate decision that was offered and not taken.
- **Disk grows without a bound the product enforces.** A thousand transcripts is
  a few hundred kilobytes; a year of the reporting machine's rate is about
  seventy thousand of them. The card states the bytes so the number is visible
  before it is surprising.
