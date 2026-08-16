# 0138: A retention rule names the collection it governs, and the copilot does not read your dictations

Date: 2026-08-16

Status: Accepted

## Context

The owner read `Settings → Privacy & Data → How long things are kept` and could
not answer two questions from it:

> Which transcripts is this about — all of them, or only the ones a processing
> mode ran on? And these stored transcripts are also used as context for the
> copilot during a meeting, so which ones is the copilot given?

Both questions are the surface's fault, and the second one is not answerable
from any record at all.

### What the section drew

Four rows under one heading: `Stored transcripts` (a cap), `Retention` (an age),
`Context objects` (kept until you delete) and `Meeting audio` (its own budget).
Two pickers governing an unnamed collection, then two rows naming collections
the pickers do not govern.

A meeting produces a transcript. `Stored transcripts` sits two rows above
`Context objects`. The natural reading — that the cap covers meetings too — is
the wrong one, and nothing on the surface corrects it.

### What the runtime actually does

`history_limit` and `history_retention_days` govern **the dictation history and
nothing else**: `history.json` as the index, plus one Markdown file per
dictation under `~/WordScript/transcripts/<YYYY>/<MM>/`
([ADR 0074](0074-a-transcript-is-a-markdown-file-and-the-history-record-is-its-index.md)).

**It is not mode-scoped, and it structurally cannot be.** Every path that ends a
session commits through the one funnel `record_entry_with_work_mode`
(`core::history`) — the native pipeline, an empty result, an insert failure, a
transcription failure and a retry. All seven processing modes land in the same
store; the mode is a *field* on the record (`effective_mode`), and ADR 0074
refused per-mode directories outright. So the answer to the first question is:
**every dictation, whatever mode ran on it, including the ones that produced
nothing** — and the surface never said the word *dictation*.

**Both rules bind, and the drawn hint described half of the mechanism.**
`prune_entries` sweeps by age first and then by count, so a reader who chose
`Keep all` still loses the record past the cap. `Older entries are pruned
automatically` is true and incomplete in the direction that surprises.

**Context objects are the second collection and a different root.** Meetings,
uploads, links, calendar entries, notes — and, per
[ADR 0064](0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md),
a translation conversation the user chose to keep. ADR 0074 states the split in
one line: *the dictation root and the note root are different roots*. Nothing
prunes them ([ADR 0045](0045-everything-recorded-is-one-object.md)).

**There is a third retention rule and this screen did not carry it.**
[ADR 0039](0039-a-failed-recording-keeps-its-audio-until-the-retry-or-the-sweep.md)
keeps a capture when a second attempt could survive the failure and sweeps it at
seven days or twenty files. It is built — `core::capture::prune_retained_captures`,
`RETAINED_CAPTURE_MAX_AGE`, `RETAINED_CAPTURE_MAX_FILES` — and it covers a raw
recording of everything the microphone heard. Two rules drawn and this one
omitted is the wrong two.

### The question no record answers

[ADR 0047](0047-a-speakers-name-is-never-in-the-audio.md) lets the copilot
notice *a contradiction against an earlier object*.
[ADR 0135](0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md)
prices it: one embedding lookup per finished turn against *the index*, a
language model only on a hit. **Neither record says what is in the index.**

Two live readings, both defensible:

- ADR 0045 declares one object with five origins and `dictation` is one of them,
  so the dictation history is part of the object collection and therefore part
  of the index.
- ADR 0074 keeps two roots and two lifecycles, so the history is a separate
  store that the object collection does not contain.

The gap matters because of what it does to the picker above it. If the history
fed the index, then `Retention: Keep all` would silently be the strongest
AI-reach setting in the product — a control drawn as disk hygiene, deciding how
much of a year of dictation a model is shown in a meeting. A privacy screen may
not carry a control whose most important effect is unstated.

## Decision

### 1. A retention rule names the collection it governs, on the card it sits in

The section becomes **one card per collection**, each headed by what it governs:

- **`Dictation history`** — *Every dictation, whatever mode ran on it — the
  failed ones too.* Holds the cap, the age, and the failure's audio.
- **`Context objects`** — *Meetings, uploads, links, notes and kept
  conversations.* Holds the pruning statement and the meeting-audio budget.

The row label carries the unit rather than the format: `Stored transcripts`
becomes **`Stored dictations`**, because *transcript* is the one word both
collections produce and is therefore the one word that cannot disambiguate them.

**This is structural rather than editorial.** A sentence explaining the split
would sit in one row's hint and be read by whoever happened to read that row; a
card boundary is read by everybody who looks at either picker. The failure being
fixed is the one
[ADR 0024](0024-the-processing-mode-has-one-source-and-every-writer-announces-it.md)
exists against, one level up: a value edited from a place that does not name
what it owns.

### 2. Both rules bind, and the row says so

`Whichever binds first: this age, or the cap above.` The mechanism has two
gates; the row states two.

### 3. The audio rule is stated where the other durations are

A row for ADR 0039's sweep — seven days or twenty files — in the dictation card,
**stating rather than setting**: the numbers are ADR 0039's and are not a
preference. And `Where things live → Audio` stops saying *then discarded* without
qualification, because a retryable failure's capture is precisely not discarded.

The two are not one fact drawn twice: `How long things are kept` owns the
duration, `Where things live` owns whether it leaves the machine. Neither answers
the other's question.

### 4. The copilot's index is the context-object collection, and the dictation history is not in it

**ADR 0074's reading wins.** The two roots are already separate in the runtime,
in the retention lifecycle and in the export controls; making the index span them
would join two collections that every other rule keeps apart, and it would do so
at the point of maximum cost — a hint arriving mid-call, which ADR 0047 already
calls the most expensive place in the product to be confidently wrong.

A dictation reaches the index only by becoming a context object, which is a
thing a person does deliberately (ADR 0045's `dictation` origin, arrived at
through Context rather than through the history list). **Origin is a field on an
object that exists; it is not a claim that everything ever dictated is one.**

**Consequently the retention rules have no AI consequence, and the screen says
so.** `Keeping more shows a model nothing more` is now a promise the product
makes, which means it is now a constraint on whatever builds the index.

**The rule is decided and the mechanism is not**, so the rows carry a
`PreviewTag` rather than a `StatusBadge` alone
([ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md)): a
badge states what the runtime found, and nothing has looked.

## Consequences

- **A dead door came off the screen.** `Notes & Meetings` carried an arrow, named
  a surface and had no `onClick` — a control claiming an effect it does not have,
  which is
  [ADR 0020](0020-the-processing-mode-is-the-only-transform-axis.md)'s defect,
  surviving inside the file whose own docblock claims *every door on this screen
  acts*. It now opens `{ section: "notesettings" }`, where `Keep the audio`
  actually stands.
- **`has no door left that cannot act` could never have caught it.** The case
  asserts `toBeEnabled()`, and a `Button` with no handler is enabled. Every door
  that names a surface is now *pressed* in `opens the three surfaces its rows
  name`; enabled is not wired, and the suite said otherwise for eleven legs.
- **The context-object track gains a step it did not have.** Stage E5 builds the
  copilot; nothing in the track said what the index may contain. D5 is the
  bound, and it is owed before E5 rather than during it.
- **The claim binds whoever builds the index.** *Keeping more shows a model
  nothing more* is printed on a privacy screen. A later step that wants the
  history in the index does not quietly add it — it repeals this record and
  changes the sentence in the same commit (ADR 0057).
- **`Stored transcripts` is gone as a name and the aria-label moved with it.**
  Deep links target rows by id and none pointed here, but a caller that queried
  the label by name is a caller this rename breaks; the suite is the only one.
- **The prototype now disagrees with the product on this section.**
  `docs/prototypes/settings-rework/demo.js` still draws four rows under one
  heading. That edit is its own step, as ADR 0135's badge removal was, and the
  product is the newer of the two.

## Related

- [ADR 0039](0039-a-failed-recording-keeps-its-audio-until-the-retry-or-the-sweep.md)
  — the third retention rule, the one this screen omitted.
- [ADR 0045](0045-everything-recorded-is-one-object.md) — one object, five
  origins. `dictation` is an origin of an object, not a claim on the history.
- [ADR 0047](0047-a-speakers-name-is-never-in-the-audio.md) — the copilot's five
  rules. This record bounds what it may read and changes none of them.
- [ADR 0064](0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md)
  — a kept conversation is a context object, which is why it is named on that
  card and not on the dictation one.
- [ADR 0074](0074-a-transcript-is-a-markdown-file-and-the-history-record-is-its-index.md)
  — two roots, one funnel, no per-mode directories. The reading this record
  follows.
- [ADR 0135](0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md)
  — priced the index lookup without saying what the index holds. This is that
  half.
- [ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md) — why a
  decided-but-unbuilt rule is a `PreviewTag` and not a badge.
