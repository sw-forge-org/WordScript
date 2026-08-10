# 0078 -- A history row opens with what the record is called

Date: 2026-08-10
Status: Accepted

Extends [ADR 0070](0070-history-switches-which-of-a-records-two-texts-its-rows-carry.md)
from two readings to three. Raised by the owner on 2026-08-10, immediately after
[ADR 0077](0077-a-transcripts-filename-is-a-title-the-model-writes.md) landed.

## Context

ADR 0077 has the chat model name every transcript, and the name becomes the
Markdown file's. The owner's observation was that the name is useful in exactly
the same way one row further in: History draws 174 rows each opening with the
first sentence of a dictation, every one starting mid-thought, and the eye has
nothing to land on. The folder became scannable and the list did not.

ADR 0070 already put a segment above those rows -- `Written` / `Heard` -- for a
different job: judging transcription accuracy means comparing the two texts
across many records, and before it the pair was one fold deep per record.

## Decision

**The segment gains a third value, `Title`, and it is the default.** Not a
replacement: `Heard` is the reading ADR 0070 exists for and the reason it was
added has not gone away, so the control keeps all three and the reader picks.
One control rather than two, because all three answer the same question --
*which reading do these rows carry*.

**The title is stored on the history record, not read from the file.** It is
already produced at record time (ADR 0077) and it costs one nullable field. A
row that had to open a Markdown file to draw its heading would make the index
depend on the store it indexes, and would put a disk read in a list render.

**`Title` falls back to the written text; `Heard` still does not.** The
asymmetry is deliberate and is the same rule stated twice. A record from before
ADR 0077, or one no model could name, has no title -- and its own opening words
are the honest stand-in, because that is what a title would have been made from;
nothing is claimed by showing them under a segment that says `Title`. Showing
the AI's sentence under a segment that says `Heard` would claim something false
about where the words came from, which is rule 7 applied to a word instead of a
state.

## Consequences

- **A list of 174 dictations can be scanned.** That was the whole of what
  ADR 0074's folder bought and the list had not been given.
- **The file and the row agree about what a record is called**, because they are
  the same string. A reader who finds a transcript in the folder and looks for
  it in History searches for the same words.
- **History's toolbar is one segment wider.** It is no longer measured by
  `port:diff` -- the screen left the gallery when it was fully wired -- so the
  drawing is provenance here rather than a constraint (ADR 0057).
- **Old records read as they always did.** No migration (ADR 0054): the field is
  null on all 174 and the fallback covers every one of them.
