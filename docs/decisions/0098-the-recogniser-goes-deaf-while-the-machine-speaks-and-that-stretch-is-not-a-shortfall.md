# 0098: The recogniser goes deaf while the machine speaks, and that stretch is not a shortfall

Date: 2026-08-11
Status: Accepted (planning direction; not implemented)

## Context

Out loud plus an open microphone is the machine transcribing itself. ADR 0064
states the rule and derives an arithmetic consequence from it -- exactly one
live conversation may run, because there is one microphone and the recogniser is
muted for the length of each spoken utterance, so two conversations would
contend for both.

The roadmap notes that Phase 8 already scopes a better answer -- cascaded
barge-in in Rust, Silero VAD plus Smart Turn v3, cancelling playback on detected
speech with pre-roll -- and that the translation window is asking for a cruder
version of planned work rather than for a requirement of its own.

**The obvious primitive turns out to be the wrong one.** `capture.rs` has a
`muted` flag with a user-facing toggle (`toggle_native_capture_mute`), and it
reads like the thing this needs. It is not. In `process_samples`:

```rust
if !paused && shared.samples.len() < shared.max_samples {
    shared.samples.push(f32_to_i16(*sample));      // only `paused` gates this
}
...
if !muted && !paused { /* level statistics */ }
if !muted && !paused && peak > DEFAULT_VOICE_THRESHOLD { /* voice activity */ }
```

**`muted` is a level mute.** It zeroes the emitted meter, stops the
voice-activity timestamp being refreshed, and excludes the stretch from the
input-level statistics. **It does not stop the audio being recorded.** The flag
that stops recording is `paused` -- and `paused` is also the one subtracted from
the clock `CaptureIntegrity` measures against, in `effective_elapsed`:

```rust
shared.started_at.elapsed()
    .saturating_sub(shared.accumulated_paused + current_pause)
```

That subtraction is ADR 0079's rule: paused stretches come off the effective
wall clock, a stream rebuild deliberately does not. A capture that keeps less
audio than its own clock says it ran for gets a `short` verdict past 10 %
missing.

So the semantics a duplex mute needs -- **stop recording, and do not count the
gap as loss** -- exist, and they belong to a gesture the user makes.

## Decision

**A runtime mute is a third state, beside the user's mute and the user's
pause.**

It takes `paused`'s two behaviours: samples are not pushed while it is held, and
the stretch is subtracted from the effective wall clock before `CaptureIntegrity`
judges the capture. It takes neither its name nor its surface.

**It is a separate field, and `is_recording()` is a derivation over both.** Two
writers on one boolean is how a machine-held mute survives a user's release, or
a user's mute is cleared by a machine that finished speaking. The rule is one
field per writer and one function that answers the question everything else
asks.

**A gap the runtime created is not a defect the runtime should report.**
`CaptureIntegrity` exists to make a real audio loss visible; a stretch where the
product deliberately stopped listening because it was talking is not that. Left
unsubtracted, every spoken reply would push a conversation toward a `short`
verdict, and the one instrument this repo has for the open capture defect would
start crying wolf on its own behaviour.

**It is held for the length of an utterance, not for a session.** The
translation window's `Silent` routing produces no utterances, so it holds
nothing -- a silent conversation records continuously.

**It holds the turn segmenter too, not only the recording.** A segmenter left
running across the deaf stretch would mark the machine's own playback as the
start of a turn -- the level meter is a separate field and ADR 0098 leaves the
user's `muted` untouched, so nothing else stops it. The gap the mute creates is
therefore **not a turn boundary**: the turn in progress before the machine spoke
is the same turn afterwards unless real input says otherwise
([ADR 0107](0107-an-utterance-is-a-recording-and-the-stream-that-carries-a-conversation-outlives-every-one-of-them.md)).

**Barge-in replaces the implementation, not the interface.** Phase 8's cascaded
answer -- Silero VAD plus Smart Turn v3, cancelling playback and generation on
detected speech, recording with pre-roll, under 200 ms to stop -- is strictly
better and sits behind the same seam. **A hard mute is what ships first because
it needs no model on disk**; the record exists so the second implementation does
not arrive as a rewrite.

## Consequences

- **The user-facing mute is not touched.** It stays a level mute with the
  behaviour it has, and this record is the first place that behaviour is written
  down as deliberate rather than assumed.
- **Whoever builds this must not reuse `paused`.** A machine-driven pause that
  shares the user's flag makes the overlay show a paused state the user did not
  ask for, and makes the resume hotkey a control over the machine's speech.
- **The mute stretch needs its own accumulator**, parallel to
  `accumulated_paused`, so the two are separable in the log. A conversation that
  spent a third of its wall clock speaking is a fact worth being able to read
  after the fact.
- **This does not solve echo.** The microphone still hears the room, and a
  reply the far speaker plays back is still in the air. Echo cancellation is a
  real component that does not exist in this runtime (ADR 0063), and a mute is
  not it -- it prevents the machine hearing *itself*, not the room hearing it
  and returning it.
- **It does not solve system-audio capture either**, and must not be read as a
  step toward it.
- **A conversation is the longest capture this product would ever run**, on the
  input stream that carries
  [known-issues/capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
  -- between 12 % and 52 % of audio never captured across 11 recordings, cause
  not located. `capture-soak` (ADR 0084) exists and has not been run for longer
  than seconds. **Shipping a conversation surface on that stream before the soak
  night is the fake-readiness defect one layer down**, and this record is where
  the next reader finds that out.
