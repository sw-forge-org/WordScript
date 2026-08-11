# 0114: A voice provider synthesises through one method, and streaming grows beside it the way recognition's did

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Supplies the contract
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md)
declared empty and
[ADR 0109](0109-voice-is-the-ninth-job-and-no-adapter-lands-before-the-row-that-operates-it.md)
made the ninth job.

## Context

`VoiceProvider` is declared in `core/providers/registry.rs` with **no methods at
all**. Every other role carries signatures: `SpeechProvider` has
`transcribe_audio_file`, `tiers` and `capture_limits`; `ChatProvider` has
`create_chat_completion`. The voice role has a name and a slot in
`ProviderEntry` and nothing to implement.

That was correct when ADR 0094 was written. No vendor's synthesis API had been
read, and a signature invented from nothing is a guess the compiler cannot
check. The record said so.

**The reason it stops being correct is that the survey now exists.**
`docs/PROVIDERS.md` carries fourteen synthesis candidates across seven vendors
and four protocol shapes, each read against the vendor's own documentation:
OpenAI's `/v1/audio/speech`, OpenRouter's same path reaching four further
vendors, xAI's bidirectional websocket, Cartesia's websocket, ElevenLabs'
websocket, MiniMax's `t2a_v2`, Bland's `/v1/speak`, Azure Speech's SSML POST,
and Kokoro-82M locally.

**They agree on more than they disagree.** Every one of them takes text, a model
or voice identifier, and an output format, and returns audio bytes. The
disagreements are real but they are parameters, not shapes: the voice is part of
the model id on Azure (`de-DE-Klaus:MAI-Voice-2`) and a separate argument on
ElevenLabs; the format vocabulary differs; some stream and some do not.

**And the phasing question is already answered by precedent.**
[ADR 0095](0095-a-streaming-recogniser-stands-beside-the-batch-one-and-its-first-implementation-is-a-turn.md)
settled that a streaming recogniser *stands beside* the batch one rather than
replacing it, and that its first implementation emits no partials. Synthesis is
the same problem mirrored, and inventing the streaming contract now — before any
websocket transport exists, before ADR 0097's output stream exists — would be
the guess ADR 0094 declined to make, just later.

## Decision

**`VoiceProvider` gains exactly one method now: `synthesize_speech`.** It
mirrors `transcribe_audio_file` in reverse — a request carrying the model, the
voice, the text, the requested format and an optional language; a response
carrying audio bytes and the format actually produced. It returns a
`ProviderFuture` like every other role method, for the reason A1 already
recorded: an `async fn` in a trait is not dyn-compatible.

**The voice is its own field, and it is optional.** A lane where the voice is
part of the model id passes `None` and puts it in the model; a lane with a
separate voice argument passes it. **The field does not become a second model
id** — the catalogue (ADR 0115) records which lane is which, so an adapter never
has to guess.

**Streaming synthesis is not added here.** It grows beside this method when the
websocket transport exists and a streaming vendor is actually being implemented
— the same shape and the same order ADR 0095 set for recognition. A second
method added now would have no implementation, no transport and no caller, which
is the defect ADR 0089 and ADR 0103 each swept the tree for.

**The method produces audio. It does not play it.** What opens a device, what
routes to it and what happens to the microphone while it plays are ADR 0097 and
ADR 0098, and they are deliberately not in this signature.

## Consequences

- **The trait still has zero implementations.** A method is not an adapter, so
  ADR 0109's rule — no adapter before the row that operates it — is untouched,
  and F1 stays gated on the owner's drawing answer. What changes is that F1 no
  longer has to design the contract and implement it in the same step.
- **`speech_synthesis` on `ProviderCapabilities` keeps its meaning and its
  test.** The registry-wide assertion that a provider claiming synthesis is a
  provider registering `voice: Some(..)` holds unchanged; it is about the entry,
  not about the method count.
- **Every TTS vendor the owner named is now expressible.** Bland, MiniMax,
  MAI-Voice-2, Gemini TTS, `gpt-4o-mini-tts`, ElevenLabs and Cartesia all fit
  this signature. Four of them need no adapter at all, because OpenRouter serves
  them on the shape ADR 0113 extracts.
- **It does not decide the voice picker.** Whether a surface offers voices as a
  list, and where the translation window's voice sits, is a drawing and stays
  the owner's question (ADR 0109, ADR 0064).
- **It does not decide output format defaults.** PCM and WAV are the fastest
  first byte on the lanes that publish anything at all; which format this product
  asks for is a runtime choice that belongs with the output stream (ADR 0097),
  not with the contract.
