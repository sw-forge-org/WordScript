# 0086: The field that was waiting for a measurement got one three legs ago

Date: 2026-08-11
Status: Accepted

## Context

§11.23 specifies eight frontmatter keys for a transcript file. Seven have been
written since ADR 0074. The eighth, `duration_ms`, has not, and
`transcript_store::render` said why in its own docstring:

> `duration_ms` is in §11.23's frontmatter and is NOT written, because the
> history record does not carry one. An invented number in a field somebody may
> later read as measurement is worse than an absent field, and this is the same
> rule the surface follows (rule 7). **It goes in when the record grows a
> duration.**

A test asserted the absence, so that a later leg adding the field would have to
do it deliberately rather than find an invented one already there.

**The record grew one three legs later and nobody connected the two.** ADR 0079
put `capture_integrity` on every entry the native pipeline writes, and it
carries `recorded_seconds` — the length of audio the capture actually produced —
beside `wall_seconds` and the verdict derived from their disagreement. The
precondition the docstring named was met on 2026-08-10 and the note went on
saying the field had no source.

## Decision

**`duration_ms` is `capture_integrity.recorded_seconds`, in milliseconds.**

- **The audio, not the session.** `recorded_seconds` is what arrived from the
  microphone; it is the length of the file the `audio:` key beside it points at,
  and the only one of the two numbers a reader can check. `wall_seconds` is the
  clock, and where the two disagree that disagreement is the defect ADR 0079
  exists to measure rather than a duration to publish.
- **Absent where nothing measured one**, which is a retry (the number belongs to
  a capture, not to a transcription), an upload, and every record written before
  the measurement existed. The key is left out rather than written as zero — the
  rule `profile`, `model` and `audio` already follow, and the reason the original
  note gave for writing nothing at all.
- **§11.23's position**, between `model` and `delivery`. The order of a
  frontmatter block is the order somebody reads it in, and the spec draws one.

## Consequences

- **The absence test turns over rather than being deleted.** It becomes two: a
  measured capture states its length in the right position, and an unmeasured
  one leaves the key out instead of writing zero. The second is the half that
  keeps the original intent alive now that a source exists.
- **`TranscriptDocument` grows one `Option<u64>`** and `record_entry_with_work_mode`
  fills it from the request it already receives. The funnel stays the single
  writer (ADR 0074) and no caller changes.
- **§11.23 is fully written for the first time.** All eight keys land on a
  dictation that measured its capture.
- **Files already on disk keep no duration** and there is no migration. A
  transcript is a record of what was known when it was written; back-filling one
  from a history entry would be inventing a measurement for a file whose
  capture may no longer exist to check it against.
