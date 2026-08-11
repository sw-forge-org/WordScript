# 0095: A streaming recogniser stands beside the batch one, and its first implementation is a turn

Date: 2026-08-11
Status: Accepted (planning direction; not implemented)

## Context

The roadmap candidate *Streaming recognition and the spoken-output path* put
four questions in front of any code. Two of them are answered now.

**Gate 1 -- does any provider on the roadmap stream at all?** Read against the
vendors' own documentation on 2026-08-11 and recorded in
[PROVIDERS.md](../PROVIDERS.md):

- **Groq does not.** `POST /openai/v1/audio/transcriptions` takes a file and
  returns a result. No websocket, no `stream=true`, no partial results. Groq is
  the only cloud lane the runtime integrates, so *the lane this product runs on
  cannot stream*.
- **OpenAI does, in two shapes** -- `stream=true` streams the transcription of a
  finished recording; `gpt-live-transcribe` on the Realtime endpoint transcribes
  a live one. **xAI does**, with partials about every 500 ms. **Mistral does**,
  configurable below 200 ms. **Azure OpenAI does**, serving the same stack.
- **Locally it is possible and not on today's path.** whisper.cpp ships a
  `stream` example and a `whisper-server`, and exposes a C API; the runtime
  shells out to `whisper-cli`, which takes a file.

So the roadmap's conditional -- *if the cloud lane does not, this becomes a
Phase 5 question* -- resolves to something the entry did not anticipate: it is
neither purely a Phase 4 nor a Phase 5 question, because streaming exists on
several lanes the product intends to carry and on none it carries today.

**Gate 2 -- does a streaming path replace the batch path or sit beside it?**
That is this record. A dictation ends in exactly one authoritative result and
one reducer commit (ADR 0018, ADR 0019). Partial results that also have to
converge on that commit are a second contract at the same seam, which is the
one thing those two records exist to prevent.

## Decision

**Streaming sits beside batch. It does not replace it and it does not touch
it.**

`transcribe_audio_file` remains the dictation path, unchanged. A dictation is
still one recording, one result, one commit. **No surface that inserts text at
a cursor consumes a partial result**, and no partial result reaches the session
reducer.

**The streaming contract is `Partial` then exactly one `Final`.**

```
Partial { text, language, confidence }   zero or more
Final   { text, language, segments }     exactly one, and it ends the unit
```

The unit is an **utterance**, not a session and not a frame. A conversation is
made of turns; a caption strip is made of a running utterance. Both are one
`Final` per unit with a different number of `Partial`s in front of it.

**Its first implementation produces no partials at all.** Over Groq, a
voice-activity segmenter marks the start and end of an utterance and the
adapter transcribes that utterance as a file, emitting one `Final`. Over
OpenAI's Realtime endpoint or xAI's websocket, the same sequence arrives with
`Partial`s in between. **The surface above sees one contract and cannot tell
which lane it is on**, except by asking `ProviderCapabilities` -- which is a
question no surface can answer today, because nothing reads that struct
(ADR 0106).

**Where that file comes from is not a detail and this record did not price it.**
`core::capture` couples the cpal stream's lifetime to the recording: one
`shared.samples` buffer bounded by `max_samples`, filled in the callback, taken
whole at `stop_native_capture`. There is no way to lift a segment out of a
running capture.
[ADR 0107](0107-an-utterance-is-a-recording-and-the-stream-that-carries-a-conversation-outlives-every-one-of-them.md)
supplies the missing half: **the stream is held for the session and a turn is a
recording**, so `CaptureIntegrity`, `capture_budget` and
`transcribe_audio_file` all apply per turn, unchanged, and the sentence above
becomes literally true rather than aspirational.

This is the shape `core::capture_budget` already uses and the reason to copy it
rather than invent: that module knows the two *shapes* a limit can take --
request size and decode time -- and no individual lane, because providers
declare their own through `providers::capture_limits` (ADR 0038). The streaming
contract knows the two shapes a recogniser can take and no individual vendor.

**Turn segmentation and streaming are separate requirements and are priced
separately.** The survey found them decoupled in the market as well: Deepgram
puts end-of-turn detection inside the model, ElevenLabs' realtime model segments
on silence with a voice-activity detector, whisper.cpp ships Silero and this
runtime already passes its flags on the local lane. A surface that needs turn
boundaries needs a segmenter. A surface that needs words appearing mid-sentence
needs a stream. **The translation window's conversation needs the first; live
subtitles' echo needs the second.**

**Every streaming result is guarded by session id**, on the pattern
`sessions::is_processing_session_current` already establishes: a late result
after an abort or a new capture is discarded and noted in the runtime log only.
For a stream that check runs per utterance rather than once.

## What four working implementations already agree on

`donors/app/desktop-shells/openwhispr` ships **four** independent streaming
recognisers -- OpenAI Realtime, Deepgram, AssemblyAI and Corti -- written as
separate classes with no shared base. What they converged on anyway is the
strongest available evidence for the contract above, and where they diverge is
the warning.

**They all expose exactly two callbacks: `onPartialTranscript` and
`onFinalTranscript`.** Four vendors, four protocols, one shape. That is the
`Partial`/`Final` cut, arrived at four times independently.

**None of the constants is shared, and they should not be.** Keepalive is 15 s
for OpenAI Realtime, AssemblyAI and Corti, and **3 s for Deepgram**. The sample
rate is 16 kHz everywhere except OpenAI Realtime, which is **24 kHz** -- against
this runtime's `TRANSCRIPTION_SAMPLE_RATE` of 16 kHz. This is the
`capture_budget` rule restated by example: the module knows the *shapes*,
providers declare their own values.

**The rate mismatch lands on the first adapter, so it gets an answer here rather
than a discovery there.** Capture keeps producing what the device and the
constant say, and **a provider needing another rate converts inside its own
adapter**. Resampling in `capture` for one vendor would put a provider's value
in the module that is supposed to know only shapes, and OpenAI Realtime is
scheduled first (ADR 0096).

**And on their local lane the stream *is* the transcript, which is a fourth
shape this record did not consider.** For online-runtime models they stream PCM
during capture and **commit the flushed text at stop as the final result, with
no second decode of the recording** -- the stop flush extends its own deadline
while results keep arriving and flags `truncated`, and anything but a clean
flush falls back to record-then-transcribe. That does not weaken *beside*: the
batch path is still there and is still what a dirty flush lands on. It shows
that **where the runtime owns the decoder, a second decode is waste** rather
than safety, and that the interesting artifact is the **flush**, not the
stream -- a `Final` that has to be waited for, bounded, and marked when the wait
ran out.

**Three operational facts this record would otherwise have discovered the hard
way:**

- **A realtime session has a lifetime.** *"OpenAI Realtime sessions die at 60
  minutes; reconnect proactively before that"* -- they pre-empt at 55. A
  conversation at a table and an hour-long meeting both cross that line, so a
  streaming session is something that gets **rotated**, not merely opened and
  closed.
- **A cold-start buffer is not optional.** They hold three seconds of 16-bit PCM
  while the socket comes up, because speech begins before the connection does.
  Without it the first words of every session are lost.
- **The dial itself must be bounded.** *"A socket factory does network work
  before the socket exists, so the dial must be bounded; a socket resolving
  after the deadline is closed, not leaked."* That is the same discipline as the
  session-id guard, one layer down.

**And a fallback must not silently change who hears the audio.** Their
`resolveStreamingFallbackTarget` returns `skip` rather than `byok` for a
signed-out cloud user, with the reason on the function: it *"keeps a signed-out
cloud user's audio from being diverted to a leftover BYOK provider."* A
streaming path that falls back to batch is choosing a recipient for someone's
voice. Falling back to *nothing* is a legitimate answer and must stay
available.

## Consequences

- **ADR 0018 and ADR 0019 are untouched**, and a test has to say so rather than
  a comment. The rule that a session ends in exactly one reducer commit is not
  weakened by the existence of a second contract; it is protected by that
  contract having no path to the reducer.
- **The cloud lane WordScript runs on cannot serve a caption strip.** Anything
  that needs words mid-sentence needs a lane that is not integrated today. That
  is a scheduling fact for live subtitles, not a blocker for a conversation.
- **A voice-activity detector becomes runtime the cloud lane needs.** What
  `capture.rs` has is a peak threshold (`DEFAULT_VOICE_THRESHOLD`) plus a
  silence timeout, which is enough to stop a recording and not enough to mark a
  turn. Silero exists on the local lane as a `whisper-cli` flag and nowhere
  else.
- **And it needs somewhere to put what it marked**, which is ADR 0107: the
  segmenter hands over a recording rather than a slice of a buffer somebody else
  owns, and the stream it cuts from outlives every turn.
- **A websocket transport is a new dependency** for any true-streaming adapter.
  `reqwest` with `blocking` is what the crate has; it does not carry one.
- **`ProcessingMode::Translate` is unaffected.** It is batch, one utterance, one
  result (ADR 0041, ADR 0071), and nothing in this record reaches it.
- **Gate 3 is still open and is still a measurement.** Whether the language
  switch detects reliably enough to take no button per turn is decided by
  ADR 0099's rule plus numbers this repo does not have yet.
