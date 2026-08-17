# 0190: The install date is a ledger field, because a config field would be somebody else's install

Date: 2026-08-17
Status: Accepted. Home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)), Stage C row C3.
Adds a field to `core::activity_ledger`
([ADR 0174](0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md))
and answers two questions
[ADR 0189](0189-a-marker-is-a-day-with-a-name-and-it-never-joins-the-ramp.md)
left open.

## Context

One of the two markers ADR 0189 draws is the day the reader installed
WordScript. Nothing in this product recorded that.

`started_on` looks like it does and its own doc comment said so — *the closest
thing to an install date this product has*. It is not one. It is the first day
the ledger wrote a ROW, which is the first day somebody DICTATED: on a machine
installed in March and first used in August it is five months late. Close enough
to reason from, not close enough to draw on a calendar under the word
*installed*.

Two things had to be decided rather than defaulted.

**Where it lives.** `AppConfig` is the obvious place and the wrong one. A config
is replaced wholesale on an import; the ledger travels in `BackupArchive` and is
the one part of an archive that is MERGED rather than replaced
([ADR 0179](0179-the-ledger-is-the-only-thing-in-an-archive-that-cannot-be-rebuilt-so-a-restore-raises-it-and-never-replaces-it.md)).
A field in the config would be overwritten by the exporting machine's on every
restore and would then be a claim about somebody else's install.

**What an existing install stamps.** Writing *today* into a field named
*installed on*, on a machine that has run for months, fabricates a date the
reader can check against their own memory and find false — on the one display
whose whole argument is that every circle asserts something true.

## Decision

**`ActivityLedger::installed_on`, merged earliest-wins, backfilled from evidence
or left empty.**

**It means *when you first installed WordScript*, not *when this machine got
it*, and the merge rule is why.** `raise_to` takes the earlier of two, exactly as
it already does for `started_on`, so importing an archive from an older machine
moves this date back. That is correct under the first reading and wrong under
the second. The first reading is what the merge already implements, so it is the
one taken — and the surface says `WordScript installed` rather than naming a
machine. **A field whose label and whose merge rule disagree is a field that lies
on exactly the machines where it matters.**

**The backfill takes evidence where there is evidence and refuses where there is
none**, in this order:

1. **The config file's creation time.** It is written on the first launch and
   therefore predates any dictation. `created()` is `Err` on filesystems that
   keep no birth time, which is a refusal and not a zero — falling back to
   `modified()` would read the last config WRITE, and a config is written every
   time a toggle moves.
2. **`started_on`.** Late rather than wrong: nobody installs a dictation product
   and then waits.
3. **Nothing.** The calendar draws one marker instead of two.

**A missing marker costs nothing; a wrong one costs the display its
credibility.** A fresh install never reaches any of this — it has no ledger and
no config yet, so its first launch writes today, and today is the truth.

**The stamp runs on the READ and not only on a dictation**, because the marker it
feeds is on a display somebody can open before they have dictated anything, and
because on a machine that has run for months the evidence is on disk now and is
not getting any better.

**The reset in Privacy & Data does not clear it.** That button is about what was
RECORDED — how much you dictated, how fast, how long it took — and when the
product arrived is not one of those. It is also unrecoverable in a way none of
the figures are: a count can be rebuilt by living another day, and a date that
has passed cannot be measured again.

## Consequences

`started_on`'s doc comment now says what it is rather than what it was mistaken
for. Nothing else read it as an install date, so nothing else moved.

The ledger's schema is unchanged. `installed_on` is `#[serde(default)]` like
every other field there, so an older file reads as `None` and gets its backfill
on the next read — which is the migration, and it needs no schema bump because
nothing about the existing counts is reinterpreted.
