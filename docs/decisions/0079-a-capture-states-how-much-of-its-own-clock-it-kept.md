# 0079 -- A capture states how much of its own clock it kept

Date: 2026-08-10
Status: Accepted

## Context

Between 12 % and 55 % of the audio of some recordings is never captured, and
nothing in the product says so.

[capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
measured it on 2026-08-03 from two lines the runtime already wrote at the end of
every capture: `Capture level emits … wall_seconds=… shortfall_ratio=…`, and
`Native capture export done … input_samples=…`, from which the recorded duration
follows. Nobody had compared them. Across 353 captures of at least 20 s their
correlation was **r = 0.9999** -- they are one measurement read off two
counters.

Re-run on 2026-08-10 over both runtime logs: **634 paired captures, r = 0.9986
over 338 long ones, and 11 captures past 12 % missing rather than the 8 the
record names.** Three are new since it was written, and the worst of them is
also the most recent:

| Stop | Wall clock | Audio recorded | Missing |
|---|---|---|---|
| 2026-08-10 22:57 | 214.3 s | 97.3 s | **54.6 %** |
| 2026-08-03 18:02 | 644.6 s | 433.3 s | 32.8 % |
| 2026-08-04 02:35 | 3.6 s | 2.4 s | 34.4 % |

The 2026-08-10 transcript is the whole argument for this decision. It is 669
characters of fluent, correctly punctuated German, ending in a question, and it
reads as a finished dictation. Against the recorded audio its density is 6.9
characters per second, which is normal; against the clock it is **3.1 against a
median of 8.4**. Half the dictation is missing and the only way to know is to
compare two numbers nothing was comparing.

**The cause is still not located, and this decision does not need it.** A
capture that recorded half of what its clock says has to say so whether or not
anyone knows why yet.

## Decision

**`CaptureIntegrity` is computed at `stop_native_capture`, where both numbers
already exist, and travels with the capture.** Effective wall clock, recorded
seconds, the missing fraction, and a verdict of `intact`, `short` or
`not_measured`.

**Recorded seconds come from the UNTRIMMED buffer.** `trim_leading_trailing_silence`
removes a quiet head and tail deliberately and can account for several seconds
of a healthy capture; measuring the trimmed export would report every ordinary
dictation as damaged.

**Paused time is subtracted; a stream rebuild is not.** Pausing calls
`Stream::pause`, which stops the cpal callback outright, so a paused capture
records nothing while its clock runs -- measured against the raw clock every
paused capture reported a shortfall by construction, and the metric was
unreadable on exactly the long dictations it exists for. The same subtraction is
now applied to `LevelEmitSummary`, which fixes the artifact the record's fourth
next-step names. A rebuild also sets `paused`, and that one is deliberately not
excused: those samples are genuinely lost, and a metric that hides real loss is
worse than no metric.

**The threshold is 10 % missing, and it is stated as a number because the data
has no continuum in it.** Healthy captures lose a median of 0.23 % and a p95 of
1.92 %; the worst healthy capture in 634 loses 7.0 %, the smallest real failure
12.0 %. 10 % sits in that gap. The margin below is three points and the margin
above is two, which is narrow enough to say out loud rather than round away --
if a capture ever lands between 7 % and 12 %, this number is what needs
re-deriving, not the finding.

**Under two seconds nothing is judged.** The startup transient between
`started_at` and the first callback is a measurable fraction of a short capture
-- the 1--2 s band loses a median of 1.9 % against 0.1 % for long ones -- and a
ratio over that little wall clock carries no information.

**`not_measured` is not `intact`.** "We did not look" and "we looked and it was
fine" are different facts. An `AudioReadyEvent` from before this decision, or a
replayed capture, deserializes to `not_measured` rather than being handed a
clean verdict.

### It is reported in three places, and none of them is new

- **The runtime log**, on every capture including the discarded ones, and before
  the discard branches: the comparison is what says whether a capture about to
  be thrown away as empty was empty or merely unrecorded.
- **The history record**, as `capture_integrity`, plus an `Audio missing` badge
  and a sentence in the raw panel's existing note slot. The badge passes the
  same test §11.20 sets for the others -- a healthy capture is the expectation
  and draws nothing -- and it leads, because every other badge there says the
  DELIVERY went sideways while this one says the text itself is short.
- **The overlay, at delivery time**, as a tab on the right strip of the result
  surface. It is a third instance of a pattern that already exists twice
  (`ov-learned-tab` left, `ov-limit-tab` right), sharing their measure-then-open
  shutter, so no pill width and no surface size constant changes. The limit tab
  is recording-only and this one result-only, so the strip is never contested.

**The tab is a statement, not a control.** The audio was never captured, so
nothing can recover it, and a button there would be an offer the runtime cannot
keep.

**A retry carries no verdict.** The number belongs to a capture, not to a
transcription, and copying an earlier entry's verdict onto a rerun would
attribute a measurement to a session that never made one.

## Consequences

The damage becomes visible at the moment it stops being recoverable, in the
place the user already is, and it stays visible on the record afterwards.

**It puts the correlation this cluster needs within reach for the first time.**
Whether a short capture also produces more mishearings could not be answered on
2026-08-10: the join between the runtime log and `history.json` works -- 136 of
136 records paired -- but 9 of the 11 short captures had outlived their
transcripts, because the two stores have different retentions. That is a
retention artifact, not a result. With the verdict on the record the join is no
longer needed, and
`cargo test measure_capture_integrity_against_transcripts -- --ignored --nocapture`
counts how many records now answer for themselves.

**It does not fix the capture.** The cause is still unlocated and the three next
steps in the record -- callback cadence logging, watching PipeWire from the
other side -- are untouched. What changes is that the next occurrence announces
itself instead of shipping as a finished transcript.

Corpus: `a_short_capture_is_reported_and_never_repaired`,
`a_capture_that_kept_its_audio_says_nothing` and
`a_capture_too_short_to_judge_is_not_judged` in
`src-tauri/tests/fixtures/regression_transcripts.json`, driven by
`corpus_drives_capture_integrity_assertions` -- which also asserts that the
verdict changes no text on any path.

## References

- [capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
  -- the measurement, and the next steps this does not take
- [overlay-recording-freeze.md](../known-issues/overlay-recording-freeze.md) --
  the same defect seen from outside, attributed 2026-08-03
- [ADR 0034](0034-a-limit-belongs-to-the-control-that-spends-it.md),
  [ADR 0038](0038-a-recording-the-app-permits-is-one-the-pipeline-can-finish.md)
  -- the auto-stop tab this borrows its shutter from, and the argument for when
  a tab beside the pill earns its space
