# 0084 -- The defect that needed no dictation gets a binary that needs no app

Date: 2026-08-11
Status: Accepted

## Context

[capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
has been open since 2026-08-03 with eleven events and no cause. Two passes made
it visible --
[ADR 0079](0079-a-capture-states-how-much-of-its-own-clock-it-kept.md) makes a
short capture say so,
[ADR 0083](0083-a-capture-reports-the-cadence-of-its-own-input-stream-and-the-level-it-was-given.md)
makes it say whether the callback was called -- and neither could make it
**happen**. Every plan assumed the next event had to be waited for, because a
capture needs a dictation and a dictation needs a person.

The third pass established two facts that turn the wait into an experiment:

1. **The diagnostics do not depend on speech.** All three lines are written in
   `stop_native_capture` *before* the `if samples.is_empty() ||
   !has_voice_activity` branch. A silent recording is discarded as empty and
   leaves the complete measurement behind. The defect is a loss of samples, and
   silence produces samples like anything else.
2. **The rate is one event per hour of OPEN STREAM**, not per capture. Eleven
   events across roughly 9 h of stream runtime. It looks rare per capture -- 11
   in 643 -- only because the average capture is under a minute.

At one event per hour, a night of open stream should produce roughly eight.
Nothing about that requires the app, a session, a microphone etiquette, or a
person in the room.

## Decision

### A second binary, not a mode of the first

`capture-soak` (`src-tauri/src/bin/capture_soak.rs`) opens the device the app
opens, holds it open for hours, and reports what it delivers. It is not shipped
and not reachable from the UI; it is a diagnostic run by hand.

It is a separate binary rather than a hidden flag on the app because the point
is to remove the app from the measurement. A soak mode inside WordScript would
carry the webview, the tray, the shortcut listener and the session machinery
into the very experiment meant to determine whether the app's own work is the
cause.

### It carries the real instrument, not a copy of it

The soak uses `CallbackCadence`, `CaptureIntegrity`, `InputLevelSummary`,
`waveform_buckets`, `f32_to_i16` and `select_input_device` from `core::capture`
directly. Their visibility widened to `pub(crate)`; **no logic moved and no
public API grew.**

This is the whole design constraint. An instrument that reimplements the thing
it measures can only ever confirm itself: if the cadence arithmetic is wrong,
the soak has to be wrong in the same way for the result to mean anything. A
duplicated `CallbackCadence` would drift from the shipped one and the first
disagreement would be unresolvable -- which of the two is the product?

### The stream stays open; the books rotate

A soak that stopped and restarted the stream every few minutes would measure
stream setup, not stream life, and the defect is a property of a stream that has
been open for a while. So one stream runs for the whole soak and the
**bookkeeping** rotates into segments of 300 s, each with its own cadence and
its own integrity verdict -- the same units a capture produces.

Rotation happens **inside a callback**, not on a timer. Two consequences, both
wanted:

- Segments tile the run exactly. No wall-clock time falls between two of them,
  so a dropout cannot hide in a seam or be split into two halves each below the
  10 % threshold that names it.
- While the stream delivers nothing the segment stays open and grows. That is
  precisely the defect's shape -- `wall_seconds` far ahead of `recorded_seconds`
  in one segment, rather than a run of tidy ones.

A watchdog in the reporting thread names a stream that has gone quiet for more
than 2 s without waiting for the segment to close, because a segment is closed
by a callback and a stream that stops entirely would otherwise end the log with
an ordinary line and go silent -- the one outcome that must not look like a
clean shutdown.

### The same per-callback work, minus the emit

The soak does the buffer copy, the peak, the RMS, the clipping count, the
waveform bucketing and the 42 ms bookkeeping. Only `app.emit` has no app to go
to. The results go to `std::hint::black_box` rather than being dropped, because
an optimizer that deletes the unused work would delete exactly the load under
test.

This is what lets a negative result mean something. **A soak that finds nothing
does not exonerate PipeWire -- it moves the suspicion to the app**, and that is
a result worth reporting as one.

### Its own log, in the runtime log's format

`logs/wordscript-capture-soak.log`, not the runtime log: a night of soaking
writes thousands of lines and the runtime log rotates at 4 MB, so folding them
together would push out the capture history the soak exists to be compared
against.

The cadence, integrity and level lines are byte-for-byte the ones a real capture
writes, so every tool already pointed at the runtime log reads this file
unchanged. The one addition is `Soak segment ... epoch_ms_at_start=`, which
locates a segment in wall clock -- the value a
`PIPEWIRE_DEBUG=3 journalctl --user -u pipewire` window is correlated against.
That correlation is step 4 of the record, folded into the same night.

## Consequences

**The record's step 3 has a tool, and is not yet done.** Building the soak is
not running it. The record stays open, and it stays open with the same eleven
events until a night has actually been recorded.

**A negative night is reportable.** If eight hours of open stream produce no
gap, that is evidence about where the cause is not, and the record says so in
advance so the result cannot be quietly reinterpreted afterwards.

**The first real gap belongs in the corpus.** Nothing in
`regression_transcripts.json` describes an observed dropout; the cadence
assertions run over a synthetic timeline, which pins the arithmetic and not the
phenomenon.

**A widened visibility is a maintenance obligation.** Six items in
`core::capture` are now `pub(crate)` for one caller. If that caller is ever
deleted, they go back.

**A second binary needs `default-run`, and nothing but the native host says so.**
`tauri dev` shells out to a bare `cargo run`, which refuses to choose between
targets: adding this binary broke the dev host outright with *"could not
determine which binary to run"*. `cargo test`, `cargo check --all-targets` and
`cargo build --bin capture-soak` were all green while it was broken, because
none of them runs anything. `default-run = "wordscript"` in `[package]` fixes
it, and the episode is the reason `CLAUDE.md` requires shell-, window- and
Tauri-bound changes to be checked in the host rather than in a preview.

**Correction, same day: the log-volume figure above is wrong.** The Decision
section justifies a separate log partly with "a night of soaking writes
thousands of lines". Measured over a full 300 s segment it writes **four lines
per segment — about 390 lines and 65 kB for an eight-hour night**, which would
displace nothing at a 4 MB rotation. The separation is still right, for the
reason that survives measurement: a soak segment is not a capture, and its lines
are deliberately identical to a capture's, so interleaving them would put
hundreds of entries no session produced into the history the soak is compared
against. Left standing rather than rewritten, because these records are
append-only and a number that was guessed should be visible as one.

**Measured cost of a night** (2026-08-11, release build, default 300 s
segments): peak RSS 30.3 MB by `VmHWM` across a full rotation, 3.73 s of CPU per
330 s — **1.13 % of one core**, roughly 5–6 minutes of CPU for eight hours. The
sample buffer is hard-capped per segment at `segment_seconds × rate × channels`,
so a stalled stream cannot grow it: 300 s caps at 50.5 MB of samples.

**The instrument caught itself once already.** The first 20 s run against real
hardware ended with a segment reading `missing_ratio=1.0000` -- a 3 ms remainder
of the rotation, reported as a total loss. It was fabricated damage produced by
the damage detector, which is this cluster's own failure committed by the tool
built to find it. The rule now is the app's own threshold: a remainder too short
for `CaptureIntegrity` to judge is dropped, while a segment long enough to be
judged is reported even with no samples in it, because a stream that stopped for
minutes is the finding. Both directions are asserted.

## References

- [capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
  -- the defect, its rate, and Route A
- [ADR 0079](0079-a-capture-states-how-much-of-its-own-clock-it-kept.md) --
  `CaptureIntegrity`, which the soak reuses per segment
- [ADR 0083](0083-a-capture-reports-the-cadence-of-its-own-input-stream-and-the-level-it-was-given.md)
  -- `CallbackCadence`, which the soak carries rather than copies
