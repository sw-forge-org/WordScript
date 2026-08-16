# 0185: Retention is a duration you set and a count you are told, and the audio a failure parks is its own collection

Date: 2026-08-17
Status: Accepted. Supersedes the two-picker layout
[ADR 0138](0138-a-retention-rule-names-the-collection-it-governs-and-the-copilot-does-not-read-your-dictations.md)
gave the retention section, and keeps everything else that ADR decided: one card
per collection, the copilot's bounded reach, and the audio rule being stated at
all. Extends
[ADR 0039](0039-a-failed-recording-keeps-its-audio-until-the-retry-or-the-sweep.md)
with a reading and a door.

## Context

Privacy & Data drew four rows about how long things are kept: `Stored
dictations` (a count, 25–1000, default 200), `Retention` (an age, default 90
days), `A failure's audio` (stated, 7 days · 20 files) and, in a second card,
two rows about context objects.

**Two pickers over one list, and neither could be read.** `prune_entries` sweeps
by age FIRST and by count SECOND, so both bind on every read. The consequences
were drawn honestly and were still unreadable:

- `Keep all` was the label on `history_retention_days: 0`, and the runtime has
  never kept all — the 1001st record is dropped whatever that picker says.
- The hint under `Retention` had to read *whichever binds first: this age, or
  the cap above*. That sentence is correct, and its existence is the defect: it
  only has to be written because one list is governed by two controls.
- A heavy writer at `90 days` loses a fortnight to a number they set once
  without being told what it did.

**The measurement was on the owner's own machine.** `config.json` stood at
`history_limit: 50`, `history_retention_days: 7`. The activity calendar could
draw a single column, and the home-activity track had to record that the
calendar's own correctness could not be judged until those two numbers were
raised ([`../tracks/home-activity.md`](../tracks/home-activity.md)). A setting
that quietly emptied an unrelated feature is not a preference anybody was in a
position to hold.

**Nobody reasons about their privacy in units of dictations.** Asked how long
the product should keep what they said, a person answers in months. Asked to
express the same wish as *the last two hundred*, they cannot — and the count
they pick then silently overrides the months they meant.

**The audio row sat in the wrong card.** ADR 0138's own rule is that a card
names the collection it governs. `A failure's audio` is a raw WAV of everything
the microphone heard, kept up to a week (ADR 0039) — not a dictation-history
entry, and the most sensitive thing this product holds. It sat as the fourth row
under `Dictation history`.

**And it recited a rule with no reading.** *7 days · 20 files* says what MAY be
parked. The question a privacy screen is opened with is whether anything IS, and
the screen could not answer it — nor offer any way to be rid of a recording
short of waiting a week.

**The context card claimed a runtime that does not exist.** There is no context
store in `src-tauri/src/core/`. Two rows stated pruning rules for a collection
nothing on this machine holds, unmarked; `Pruning` named a mechanism where the
reader asks about an outcome, and `Own budget` named the existence of a setting
rather than the rule it holds.

## Decision

**One rule the reader sets, and it is a duration.** `Kept for`: 7 days · 1 month
· 3 months · 1 year · No age limit. The config still stores days — the label is
the reader's unit and the number is the runtime's. `Keep all` is gone as a
label, because the sweep beside it has always taken that promise back.

**The count becomes the index's ceiling and is stated, not offered.**
`config::HISTORY_CEILING` is 1000, `normalize_for_runtime` pins `history_limit`
to it, and the screen prints `Newest 1000` in its own row with what it means: it
bounds the index, not your privacy. A thousand transcripts is a few hundred
kilobytes of text, so there was never a disk argument for making the reader
carry this.

**Pinning is the migration.** A stored value is a leftover from when this was a
setting, and a leftover that silently out-prunes the rule the reader DID set.
Every install comes back on the ceiling; nobody's retention rule is quietly
shortened by a number they cannot see any more.

**The parked audio is its own card, and it counts.**
`core::capture::retained_capture_status` answers the count, the bytes, the age
of the oldest and the two rule numbers, so the card states the rule AND the
reading. `Nothing kept` is the most reassuring sentence this screen can print
and it could not print it before.

**`discard_retained_captures` is the one door that shortens the seven days.** It
deletes only files matching the pattern this app writes, in the directory it
writes to — `temp_audio_dir` is user-configurable, and neither the sweep nor
this button may be destructive outside what the product created. The button is
drawn only when there is something to delete, and it names its cost: a failed
dictation can no longer be retried from its audio.

**Three collections answer the same question in the same words.** Each card
carries a `Kept for` row; the answers differ in the badge, which is where a
difference belongs. The context rows carry `PreviewTag`, because the rule is
decided and the collection is not built — and `Meeting audio` states the rule
drawn on Notes & Meetings (`Until the note is saved`) instead of pointing at the
existence of a budget.

## Consequences

- `history_limit` survives as a config field and stops being a product control.
  It is written by nothing in the UI, pinned on load, and clamped a second time
  in `configured_history_limit` — the sweep that drops a record must not be
  where a stale value gets one last say.
- The default history a new install keeps is larger, not smaller: 1000 records
  under a 90-day rule instead of 200 under it.
- The activity calendar's own honesty problem loses one of its two causes. What
  remains is the age rule, which is the reader's to set and says so.
- This departs from the prototype (`docs/prototypes/settings-rework/demo.js`),
  which draws both pickers. The prototype is the UI source of truth for a screen
  being built; it is not an argument against a defect measured in the product.
- A privacy screen now reads a folder on mount. It fails silently to `Not read`
  rather than to `Nothing kept`: a status the screen could not obtain is not a
  statement that the disk is empty.
