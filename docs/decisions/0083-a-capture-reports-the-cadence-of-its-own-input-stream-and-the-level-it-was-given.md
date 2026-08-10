# 0083 -- A capture reports the cadence of its own input stream, and the level it was given

Date: 2026-08-11
Status: Accepted

## Context

[ADR 0079](0079-a-capture-states-how-much-of-its-own-clock-it-kept.md) made a
short capture say so. It did not say **why**, and it said so deliberately: the
cause was unlocated and a capture that recorded half of what its clock says has
to report that whether or not anyone knows why yet.

[capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
carries three hypotheses and the step that separates them, untouched since
2026-08-03: log the cadence of the cpal callback. Everything measured so far
observes the loss from outside — two counters compared after the fact — and
nothing observes the layer where the samples either arrive or do not.

Its neighbour
[transcription-accuracy.md](../known-issues/transcription-accuracy.md) names the
cheapest step it was still missing, and it is the same shape of omission: peak
and mean are computed on every capture and kept **only when the capture came
back empty**, which is the one case that already explains itself. A fluent
transcript produced from a microphone that never got near the speech threshold
explains nothing, and the text cannot be asked.

Both are measurements the runtime already had and threw away.

## Decision

### The cadence is accumulated in the callback and written at the stop

`CallbackCadence` counts every callback, its sample count, and every stretch
over **200 ms** in which the stream delivered nothing. An ALSA period at
44.1 kHz is 10--25 ms, so the threshold is roughly ten missed periods -- far
outside scheduling jitter and far below the multi-second stretches the record
implies.

**Nothing writes to the log from the audio callback.** The gaps are accumulated
under the lock the callback already takes and flushed at `stop_native_capture`.
Writing a file from a realtime audio thread to report a dropout is a good way to
cause the next one, and the observer would become the effect. The forensic value
is identical because the record is read after the capture ends. The cost is that
a capture which never stops reports nothing, and that is acceptable: this defect
always ends with a transcript.

The gap list is bounded at 64 entries, and **a truncated list says it was
truncated** rather than letting the log imply the capture had exactly 64 gaps.

### The resuming callback's size is the discriminator, and the line names a hypothesis

For every gap the log carries the window, the gap length, and **the number of
samples the callback that ended it carried**. That single number separates the
record's hypotheses:

- an ordinary period on resume means the audio for the gap was never delivered
  and is gone -- `signature=stream_suspended`, hypothesis 1;
- a callback carrying roughly the gap's worth of audio means the samples arrived
  late in one block and only the clock disagreed -- `signature=late_delivery`,
  hypothesis 3;
- **no gap at all while the audio is still short** -- `no_gaps_but_audio_missing`
  -- means the loss is spread across the whole capture rather than concentrated,
  which is callback starvation, hypothesis 2.

That last one is a positive finding and the line says so in its own name. An
instrumentation that reported "nothing unusual" on a capture that lost half its
audio would be the invisible damage this cluster is about, committed by the
diagnostic.

The line also carries what share of the capture's missing audio the named gaps
account for. Where nothing is missing it prints `n/a` rather than `0.000`: zero
would read as "the gaps explain none of the loss", which is a finding, and there
is no loss to have a finding about.

### The line is written on every capture, healthy ones included

The 2026-08-03 measurement only became readable because 345 healthy captures
stood next to the eight broken ones. A cadence line that appeared only on
failures would have no baseline, and the first question asked of the first gap
would be whether gaps are normal.

### A pause resets the cadence; the integrity verdict still does not excuse one

`Stream::pause` stops the callback outright, so the first callback after a
resume is a gap the length of the pause. Both resume paths -- the pause toggle
and the stream rebuild -- forget the last callback, which keeps a deliberate
pause out of the dropout accounting. This is the same construction artifact
ADR 0079 removed from `shortfall_ratio`, one layer down.

A rebuild is reset for a different reason: its outage is already named by the
`Native capture stream rebuilt` line, and carrying it into the gap list would
attribute an explained outage to the unexplained defect. **ADR 0079's refusal to
excuse a rebuild in the integrity ratio stands unchanged** -- those samples are
genuinely lost. The two accountings answer different questions and it is correct
that they treat a rebuild differently.

### The input level gains a mean, and the record keeps it

`InputLevelSummary` gains `rms` and `rms_dbfs` over every measured sample.
**A peak is set by one sample.** A cough, a keyboard or a chair sets it as well
as speech does, so a capture dictated too quietly to transcribe can still report
a healthy peak -- which is exactly the case that has to be separated from "the
recogniser is wrong".

It is persisted on the history record as `input_level`, and written to the
runtime log on every capture, kept or discarded. `None` on records written
before this existed and **on a retry**, for the reason ADR 0079 gives for the
verdict: the measurement belongs to a capture, and a retry never touched a
microphone.

The mean does not change any verdict. `too_quiet` still reads the peak, because
the thresholds were derived against the peak and re-deriving them is a separate
decision with its own measurement. The mean is reported, not acted on.

## Consequences

**The next occurrence of the capture defect arrives with the evidence to place
it.** A `verdict=short` line already named a window; the window now carries the
callback cadence inside it and a named signature for which hypothesis it
supports.

**It does not locate the cause, and no gap has been observed yet.** The
instrumentation is asserted against a synthetic timeline -- a suspend, a late
delivery, a starved stream and a pause, driven over injected `Instant`s rather
than `thread::sleep`, which would measure the test runner's scheduler. Nothing
in the corpus describes a real gap, because none has been recorded. **The first
real one is a corpus entry**, and until then this ADR has instrumented a
hypothesis rather than confirmed one.

**Two side checks came back negative and are recorded as negative.** The system
journal carries no PipeWire or WirePlumber line inside the 2026-08-10 22:54--22:57
window -- which is weak evidence, since a suspend-on-idle would appear at debug
level and the journal was at default. And the one short capture within the
journal's reach ran at 18.3 % available memory, inside the healthy band of
11.8--51.6 % with six healthy long captures tighter than it. On n = 1 that
distinguishes nothing; it is not a refutation of starvation, and it is not
support for it either.

**A fluent transcript can now be asked what the microphone was doing.** That was
the cheapest open step under `transcription-accuracy.md`, and it is the one that
separates the recogniser from the room.

Corpus: none for the cadence, deliberately -- see above. The level is asserted
by unit tests in `core::capture` covering a quiet capture with one loud instant,
a healthy one, a capture with no measured samples, and a payload written before
the mean existed.

## References

- [capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
  -- the three hypotheses this instruments, and the step it takes
- [transcription-accuracy.md](../known-issues/transcription-accuracy.md)
  -- the level's purpose, and the question it was the cheapest step toward
- [ADR 0079](0079-a-capture-states-how-much-of-its-own-clock-it-kept.md)
  -- the verdict this explains, the pause arithmetic it reuses, and the
  retry rule it follows
- [ADR 0015](0015-the-runtime-transcription-request-has-one-resolved-source.md)
  -- why a new field on the capture payload defaults rather than fails the
  whole capture
