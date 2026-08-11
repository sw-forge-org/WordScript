# 0113: The OpenAI-compatible audio shape is already in the tree, and it reaches two more lanes for a base URL

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Written after
[ADR 0096](0096-every-drawn-lane-gets-an-adapter-and-groq-stops-being-the-only-one.md)
priced the build-out at ten adapters and
`docs/PROVIDERS.md` was found to be wrong about two of them.

## Context

`docs/PROVIDERS.md` carried two sentences that priced the provider build-out,
and both were wrong in the same way. The document was re-read on the day it was
written and corrected in place; this record is the decision that follows from
the correction.

- **"Audio rides the chat endpoint, not an audio endpoint"** about OpenRouter.
  The multimodal page it was read from is correct and says nothing false. It
  simply is not the whole API: `POST /api/v1/audio/speech` has existed since
  2026-04-18 and `POST /api/v1/audio/transcriptions` since 2026-07-22, both
  documented as OpenAI-SDK compatible against base URL
  `https://openrouter.ai/api/v1`.
- **"Speech has no OpenAI-compatible shape to talk to"** about the Self-hosted
  lane. This one contradicted the same file eleven paragraphs earlier, which
  already recorded that whisper.cpp ships `whisper-server`, *"an HTTP server
  with an OpenAI-compatible API"*. `whisper-server` remaps that path with
  `--inference-path /v1/audio/transcriptions`; faster-whisper-server (speaches)
  and LocalAI answer on it directly.

**The finding underneath both is in this repo's own code.** `groq.rs:25` reads
`const GROQ_API_BASE: &str = "https://api.groq.com/openai/v1"`, and the speech
call at `groq.rs:407` posts to `{GROQ_API_BASE}/audio/transcriptions`. The chat
call at `groq.rs:472` posts to `{GROQ_API_BASE}/chat/completions`. **The one
integrated cloud adapter this product has is not a Groq-shaped adapter. It is
the OpenAI shape with a Groq host**, and the constant says so in the URL.

So the question ADR 0096 answered as *ten adapters* has a cheaper answer for
part of the set. What separates Groq's working speech lane from OpenAI's,
OpenRouter's and a user's own `whisper-server` is a base URL, a credential and a
model id -- not a protocol.

## Decision

**The OpenAI-compatible audio and chat shape is one internal implementation
parameterized by base URL and credential, not one implementation per vendor.**
Groq's inline request building becomes that shared shape; OpenAI, OpenRouter and
Self-hosted call it rather than each rebuilding it.

**The Self-hosted lane gains the three listening jobs.** `dictation`, `meetings`
and `upload` stop being refused on that lane. The lane's credential shape does
not change to accommodate this -- base URL, typed model id and optional token is
already what it carries, and it is already what a transcription call on this
path needs.

**A free base URL is a security boundary, and it takes the donor's rule.**
`isSecureEndpoint` in `src/utils/urlUtils.ts`: HTTPS **or** a private host. A
LAN server on plain HTTP works; a bearer token is never licensed over the open
internet to a public host on `http://`.

**What is not decided, because it was not read.** Only
`/v1/audio/transcriptions` was verified as a de-facto standard across user-run
servers. **Whether the same servers answer `/v1/audio/speech`** for the `voice`
job is unverified, and this record does not extend to it. A `voice` role on the
Self-hosted lane needs its own reading first.

**This is a decision and not a fact.** That the standard exists is a fact, and
it belongs in `docs/PROVIDERS.md`, where it now is. That WordScript extracts one
parameterized implementation rather than writing OpenRouter's and Self-hosted's
speech role as two more copies of Groq's request builder -- and that the
Self-hosted lane's product scope changes as a result -- is a choice with a real
alternative and a real cost.

## Consequences

- **Two drawn sentences are now wrong, and neither is edited by this record.**
  `src/screens/data.ts` carries the Self-hosted refusal on three jobs and
  `OpenRouter`'s `stt: false`. Both are drawings; a drawing grows in the gallery
  first (ADR 0057). They are recorded as open disagreements 10 and 11 in
  `docs/PROVIDERS.md` and are corrected in the commit that implements this, not
  before it.
- **It does not reorder ADR 0096.** That record pins OpenAI first, Groq voice
  second and Local third, and leaves the rest unordered. This record says what
  the OpenRouter and Self-hosted *speech* role costs once OpenAI has landed; it
  does not move them ahead of anything, and their *chat* role stays where
  ADR 0096 left it.
- **It does not make the shared shape a base trait.** ADR 0094's registry is a
  table of entries, deliberately not an inheritance hierarchy. This is a helper
  three adapters call, not a fourth role or a supertype.
- **A capability answer is still per model.** Reaching four lanes through one
  request builder does not make them answer alike: `whisper-1` and
  `gpt-4o-transcribe` disagree on one key (ADR 0110), and a self-hosted server's
  model list belongs to whoever runs it. `ModelCapabilities` still carries the
  answer, and `unknown` is still the honest one for a model nobody enumerated.
- **The operational ceilings do not travel with the shape.** OpenRouter
  documents a 60-second upstream timeout, 25 MB on the multipart path, no audio
  URLs and no SRT/VTT. Groq documents 25 MB free and 100 MB dev. One request
  builder, four different ceilings — `capture_limits` already takes provider and
  model for exactly this reason and must not be collapsed along with the
  request.
- **It is cheapest before the first adapter and more expensive after.** If D1
  writes OpenAI's speech call inline, this becomes a refactor of two call sites
  instead of a parameter on one.
