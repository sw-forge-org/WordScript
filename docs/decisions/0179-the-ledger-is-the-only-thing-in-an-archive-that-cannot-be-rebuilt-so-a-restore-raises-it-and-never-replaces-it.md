# 0179: The ledger is the only thing in an archive that cannot be rebuilt, so a restore raises it and never replaces it

Date: 2026-08-16
Status: Accepted. Ninth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Extends
`core::backup`'s archive, first drawn in Privacy & Data's three doors.

## Context

The owner asked which import and export functions already exist and whether the
activity figures could be integrated into one of them or needed a card of their
own.

They do exist and they needed nothing new. `core::backup` already answers Privacy
& Data's *Export everything local* and *Restore from an archive* with
`export_full_backup` and `import_full_backup`, carrying the config, the history
index and the transcript files. A second card would have put a second archive
format in front of a reader who already has one.

What the archive did **not** carry was `activity.json` — and that is the one
thing in it that cannot be rebuilt. History is pruned and the transcripts are
files on disk; the lifetime figures are an accumulation, and an accumulation
missing from the backup is an accumulation that a restore silently sets to zero.
On a new machine the reader would have had every transcript back and a counter
starting at nothing.

## Decision

### `activity` joins the archive, as an `Option`

`BackupArchive.activity: Option<ActivityLedger>`, `#[serde(default)]`, and
`ARCHIVE_VERSION` stays at 1. A version bump would make this build refuse
archives written by the last one for no reason: serde ignores unknown fields
going forward and defaults the missing one going back, so both directions read.
`None` means *this archive knows nothing about your totals* and the import leaves
them alone, which is the correct reading and the reason it is an `Option` rather
than a defaulted empty ledger.

### The import MERGES, and the merge is a field-wise maximum

Everything else in an archive is a state to restore, so the import overwrites it.
The ledger is an accumulation, and a restore that lowered a lifetime total would
break the only promise the ledger makes
([ADR 0176](0176-a-lifetime-figure-that-can-fall-is-not-a-lifetime-figure-so-a-pruned-day-is-retired-and-only-a-button-clears-it.md)).
So `merge_from_archive` takes the larger of the two figures, field by field, day
by day, bucket by bucket.

**Maximum rather than sum, and the reason is the ordinary case.** The ordinary
reason to import is a RESTORE, and the ordinary archive came off this same
machine. A merge that summed would double every day the two share — silently,
permanently, and in the direction that flatters. Maximum is:

- **idempotent** — importing the same archive twice changes nothing;
- **monotone** — a restore can only ever raise a figure, never lower one.

What it cannot do is combine two machines' disjoint work into one total. That is
the deliberate trade: under-reporting a case nobody has is better than doubling a
lifetime figure for everybody who restores a backup.

`started_on` takes the EARLIER of the two — an archive that reaches further back
is evidence the installation is older than the local file knows.

### A merge failure does not fail the import

It is logged. By the time the ledger is reached the config, the history and the
transcripts are already restored, and failing the command there would report a
restore that mostly happened as an error. The figures are derived; the transcripts
are not.

## Consequences

- Moving to a new machine carries the lifetime figures with it.
- Restoring the same archive repeatedly is safe, which matters because that is
  what somebody does when they are not sure the first one worked.
- A reader who imports an old archive after a reset gets those figures back.
  That is intended: the import is as deliberate an act as the reset was.
- Privacy & Data gains no card. The three doors it already had now carry one more
  thing each, and the export row's count of records and transcripts is unchanged.
