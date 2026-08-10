# 0074 -- A transcript is a Markdown file, and the history record is its index

Date: 2026-08-10
Status: Accepted

Keeps the promise
[SETTINGS_REWORK_PLAN.md §11.23](../SETTINGS_REWORK_PLAN.md) made on 2026-08-03
and Leg 4c suspended. Decided by the owner on 2026-08-10 after the case for
retiring it was put and lost.

## Context

The drawn History screen states, on its foot and on every row:

> Every transcript is a Markdown file in `~/WordScript/transcripts`.

The runtime keeps one `history.json` under the user data directory and no
per-transcript file. Leg 4c made the product state the runtime instead --
`transcription_history_storage_status` answers with the one file that exists --
and left the promise standing as a contract, because a product may not send
somebody to a folder that is not there. `Show in file manager` has been drawn
and disabled on three surfaces ever since, for the same reason: there is nothing
per transcript to reveal.

So the question was never "should the button work". It was whether the thing the
button reveals should exist.

### The case for retiring it, and why it lost

It was put as three costs. Two of them were not real.

**The backfill.** 174 records on the owner's machine with no file. Void: the
product is `0.2.2-alpha`, has no users, and the owner's answer was that
development-mode data is expendable (the same ground ADR 0054 stands on).

**Two truths that drift.** A record in `history.json` and a file on disk can
disagree. Contained rather than accepted -- see the decision below. The file's
whole lifecycle belongs to the functions that own the entry, so there is no path
that creates one without the other.

**The record is a receipt, not a document.** This one is real and it is the
argument the drawing has to beat. A dictation's text has already been delivered
to a cursor in another application; it lives in the Slack message, the commit
body, the mail. What History keeps is evidence -- did it land, what was heard
against what was written, can it be restored, can it be re-run. §11.23's own
slug rule is the tell: named from the first words of the written text, a
one-line dictation becomes `03-0942-ja-genau-mach-das-mal-so.md`. A thing with
no title is being given a filename.

It loses on the distribution. Dictations are not one length. The briefings that
drive this relay are dictated in WordScript, several paragraphs each, and exist
nowhere else as a whole; those are documents by any test. The only line between
them and the one-liner is a length threshold, and a threshold is worse than
either extreme -- the reveal control would be live on some rows and dead on
others by a rule nobody can hold in their head, which is the defect ADR 0065
exists to prevent one level down. And the clutter is honest: 174 fragments
dictated is 174 fragments, and the product does not owe anybody a tidier version
of their own history.

### The variant that was designed and rejected

**One file per day, one section per dictation.** It answers the clutter -- five
files instead of 174, a readable dictation journal, one delete per day for
retention.

It costs the invariant, and the invariant is worth more. With one file per
transcript the runtime **creates a file once and later deletes it, and never
edits one**. With a day file every session commit mutates an existing file and
every delete mutates it again, so a file the reader has open in an editor, or
has added a line to, is rewritten underneath them. Clutter is a browsing
annoyance; editing a user's visible files is a data-loss surface.

## Decision

**Every transcript that produced text is written to
`~/WordScript/transcripts/<YYYY>/<MM>/<DD-HHMM>-<slug>.md` at the moment its
session commits**, with the frontmatter §11.23 specifies. `core::transcript_store`
owns the directory, the slug, the collision suffix and the write.

**It is written from the one funnel every record already passes through.**
`record_entry_with_work_mode` is where a history entry comes into existence on
every path -- the native pipeline, an empty result, a failure, a retry -- so the
file is written there and no caller can forget it. §11.23 asks for "one file per
session on every path including the timeout fallback"; putting the write at the
funnel is what makes that structural instead of a rule somebody has to obey.

**A record with no text gets no file.** An `Empty` record produced no transcript
and a `Failed` one may have produced none; an empty document is clutter with
nothing in it. The entry records the absence, `Show in file manager` disables
itself with that reason, and this is the same shape Retry already has on a
record whose audio was swept. It is not the rejected threshold: the rule is
"there is a text or there is not", which is a fact about the record rather than
a number somebody chose.

**`history.json` stays the index, and the file is the record's readable form.**
The entry carries `transcript_path`. History reads the index -- it is already
there, it is fast, and it carries what the frontmatter cannot: the applied
rules, the insert result, the recovery action, the clipboard restore, the audio
path. Whether History ever reads the files instead is §11.23's own open question
and stays open; nothing here forecloses it.

**Deleting a record deletes its file, and so does retention.**
`delete_transcription_history_entry`, `clear_transcription_history_entries` and
the retention prune all remove the file the entry names, in the same call that
drops the entry. This is what contains the second truth: there is no code path
that removes one without the other.

**The runtime deletes only paths it wrote.** A file is removed because an entry
named it, never because it was found in the directory. A file the reader moved,
renamed or added themselves is not the runtime's, and a retention sweep that
walked the folder would eventually eat one.

**The root is not configurable yet, and that is stated rather than hidden.**
§11.23 puts the root beside the notes root on `Settings -> Notes & Meetings`,
which is a V2 screen carrying a banner. Until that screen exists the root is
`~/WordScript/transcripts` and History's foot states the resolved path.

**The dictation root and the note root are different roots.** What you said into
other applications and material you brought in are two different collections;
the Context hub's objects (ADR 0045) keep their own tree.

**No per-mode directories.** The processing mode is a property of the record and
is already in the frontmatter. A path is for what a reader navigates by, and
nobody looks for a dictation by whether it was a cleanup or an agent run. Two
further reasons: a retry that routes by mode (ADR 0075) would land in a
different directory from the record it retried, splitting one capture across the
tree; and the mode vocabulary is not stable -- Translate arrived as the seventh
two days before this record -- so a mode directory is a schema that changes
whenever the product does. Date directories do not.

## Consequences

- **History's drawn foot becomes true and comes back.** The sentence Leg 4c
  replaced with the runtime's own is the drawn one again, with the resolved root
  and the two retention numbers read from the config. The banner it belongs to
  loses that clause in the commit that makes it false (ADR 0057).
- **`Show in file manager` acts on three surfaces** -- History's row, Home's
  row, and the palette -- and the three disabled reasons are deleted in the same
  commit (rule 7, in the direction Leg 5 established).
- **A plaintext copy of every dictation now sits in the home directory.**
  That is the point -- "your transcripts are yours" as a path rather than a
  sentence -- and it is also a disclosure surface. It is covered by the same
  retention the index has and by nothing else; whole-disk encryption is the
  user's, as it already is for `history.json`.
- **Retention now deletes files.** Bounded by the rule above: only paths an
  entry names.
- **The export button keeps its job.** `export_transcription_history` writes the
  index as JSON for machines. The directory is for people. Neither replaces the
  other.
