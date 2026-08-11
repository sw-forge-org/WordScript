# 0107: An utterance is a recording, and the stream that carries a conversation outlives every one of them

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Supplies the capture
half of
[ADR 0095](0095-a-streaming-recogniser-stands-beside-the-batch-one-and-its-first-implementation-is-a-turn.md).

## Context

ADR 0095 decided that the streaming contract's first implementation emits no
partials: *"a voice-activity segmenter marks the start and end of an utterance
and the adapter transcribes that utterance as a file."* It priced the segmenter
-- `capture.rs` has a peak threshold and a silence timeout, which is enough to
stop a recording and not enough to mark a turn -- and it priced the websocket
transport for the true-streaming lanes.

**It did not price where the file comes from, and the runtime has no shape that
produces one.**

`core::capture` couples two things that a conversation needs separated:

- `start_native_capture` opens the cpal device *and* begins the recording, in
  one call, refusing a second with *"A native audio capture is already
  active."*
- Samples accumulate in a single `shared.samples: Vec<i16>`, bounded by
  `max_samples`, computed once from `config.max_recording_seconds` times the
  device rate times the channel count.
- `stop_native_capture` pauses the stream, takes `active` out of the state,
  clones the whole buffer and produces one outcome with one
  `CaptureIntegrity` verdict measured against `effective_elapsed`.

So the recording *is* the stream's lifetime, and the buffer is one contiguous
run with a ceiling. **There is no way to take a segment out of a running
capture, and a conversation is nothing but segments.** Left as it is, the first
turn of a table conversation either ends the stream -- losing the device between
turns, which is the failure ADR 0010 measured on the output side and the reason
the cue stream is persistent -- or accumulates one unbounded buffer that hits
`max_samples` and stops recording mid-conversation with no event saying why.

## Decision

**A turn is a recording. The stream is not.**

The two are separated, and each keeps the instrument it already has:

| | Today | In a conversation |
| --- | --- | --- |
| cpal stream | opened per recording | **opened once, held for the session** |
| Recording window | the stream's lifetime | **one per turn** |
| Who ends it | the user, or the silence timeout | **the segmenter** |
| `CaptureIntegrity` | one verdict per capture | **one verdict per turn** |
| `capture_budget` | one ceiling per capture | **one ceiling per turn** |

**Every instrument this repo has keeps applying, unchanged, per turn.** That is
the whole reason to cut it here rather than invent a second capture path: a
turn that is a recording is measured by `CaptureIntegrity`, bounded by
`capture_budget`, transcribed by `transcribe_audio_file`, and guarded by
`sessions::is_processing_session_current` -- with no new semantics for any of
them. **ADR 0095's sentence about the adapter transcribing an utterance as a
file becomes literally true instead of aspirational.**

**`max_samples` stops being a session ceiling and becomes a turn ceiling.** It
is derived from `max_recording_seconds`, which answers *how long may one
dictation be* -- a question about one turn, not about how long two people may
talk. A conversation has no total-length ceiling from this constant, and if it
needs one it is a different setting with a different name.

**The stream being persistent is the same decision ADR 0010 already took, on the
other side of the device.** A stream opened per turn is contended exactly when
it is needed, loses the opening of the sentence, and cannot carry a remembered
per-application volume. The cold-start buffer ADR 0095 recorded from the donor
-- three seconds of PCM held while a socket comes up, *because speech begins
before the connection does* -- is the same finding once more: **the expensive
thing must already be open when the speech starts.**

**The runtime mute holds the segmenter, not only the recording.** ADR 0098's
third capture state stops samples being pushed while the machine speaks. If the
segmenter kept running across that stretch it would mark the machine's own
playback as the start of a turn -- on a level meter that ADR 0098 leaves
running, since `muted` and the runtime mute are different fields. So the mute
holds both, and the gap it creates is not a turn boundary: **the turn that was
in progress before the machine spoke is the same turn afterwards**, unless the
segmenter says otherwise on real input.

**One live conversation stays arithmetic about the microphone** (ADR 0064). A
held-open stream makes that concrete rather than changing it: there is one input
stream, and `start_native_capture`'s refusal of a second concurrent capture
becomes a refusal of a second concurrent session.

## Consequences

- **`start_native_capture` and `stop_native_capture` are the dictation pair and
  stay exactly as they are.** A conversation needs a third and fourth entry
  point -- open a session, close a session -- with the turn boundaries between
  them driven by the segmenter rather than by a command. Reusing the existing
  pair by calling it per turn is the shape this record exists to forbid.
- **`CaptureIntegrity` gets its best available instrument for the open defect,
  by accident.** A per-turn verdict on a session that runs for an hour produces
  dozens of measurements on the stream that carries
  [known-issues/capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
  -- against 11 recordings collected so far. **That is not a reason to ship the
  surface before the soak night** (ADR 0098); it is a reason the soak night and
  this work inform each other.
- **A turn's start time is not the session's.** `shared.started_at`,
  `accumulated_paused` and the runtime-mute accumulator ADR 0098 adds are
  per-turn quantities in a session-length structure. Which of them reset per
  turn and which accumulate for the session is the first implementation
  question, and getting it wrong makes every verdict after the first one wrong
  in the same direction.
- **`capture_budget`'s two shapes still come from the provider**
  (ADR 0038, ADR 0095). A turn is a small request against a request-size
  ceiling and a short decode against a decode-time one; nothing about the
  ceilings changes, only how often they are evaluated.
- **A sample rate the adapter needs and the one the device gives are the
  adapter's problem.** `TRANSCRIPTION_SAMPLE_RATE` is 16 kHz and OpenAI's
  Realtime endpoint wants 24 kHz (ADR 0095). Capture keeps producing what the
  device and the constant say; **a provider that needs another rate converts in
  its own adapter**, which is `capture_budget`'s rule restated -- the module
  knows the shapes, the provider declares its values.
- **Many turns are many uploads, and nothing bounds them.** A dictation is one
  request; an hour at a table is hundreds, on the same uplink as whatever else
  the product is doing. The donor priced this in `cloudChunkPolicy.js`: they
  moved from five concurrent bodies **per job** to a global ceiling across
  jobs, with the reason written down -- *"a user retry ran ~6 concurrent ~4MB
  bodies; dictation can no longer be starved by a batch upload."* A conversation
  is the batch upload in that sentence, and the dictation it would starve is the
  one the user is typing with. **A global in-flight ceiling is a conversation
  requirement, not a tuning detail.**
- **Their retry policy also separates two failures this runtime conflates.**
  Codes that doom the whole job (`AUTH_EXPIRED`, `LIMIT_REACHED`) versus codes
  that doom one chunk, and a network-level failure -- *no status code and no
  business code* -- that indicts the connection pool rather than the server and
  triggers one rate-limited teardown instead of each failure sacrificing its
  peers. Per turn, `ProviderCommandError`'s `retryable` flag is the field that
  has to carry this distinction, and a turn failing for an account-level reason
  must end the session rather than retry 200 times.
- **This record does not decide the segmenter.** Silero on the local lane, an
  end-of-turn model, or a threshold plus a silence window are three different
  answers with three different costs, and ADR 0095 already separates turn
  boundaries from partial results. What is decided here is what the segmenter
  hands over: a recording, not a slice of a buffer somebody else owns.
