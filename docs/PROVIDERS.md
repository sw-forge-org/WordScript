# Providers

Status: 2026-08-11. Every capability row was read against the vendor's own
documentation on that date and carries its source. Nothing here is measured on
this machine.

> This is the reference for **what a provider offers**. It is not a statement of
> what WordScript integrates. Today the runtime integrates exactly two
> providers -- `groq` and `local_preview` -- and `AI Models` says so on itself.
> That state was decided by ADR 0065, which **ADR 0096 supersedes**: the
> build-out is now the plan and the surface keeps saying what is true until each
> adapter lands. When that changes, this document does not become the record of
> it; [STATUS.md](STATUS.md) does.

Read this before adding a provider adapter, before deciding which lane owns a
job, and before writing a model name onto a surface. The drawn provider matrix
lives in `src/screens/data.ts` (`PROVIDERS`, `LANES`) and is the *target shape*;
this document is what the vendors actually serve behind it. **Where the two
disagree, neither wins automatically** -- the gallery owns the drawing (ADR
0057) and the vendor owns the capability, so a disagreement is a decision, not
an edit. The open ones are listed at the foot of this file.

## What this document does not do

- **It does not recommend a model per job.** That surface exists and has an
  owner: one screen owns every model choice (ADR 0042).
- **It does not rank by price.** Real usage sits below a cent, and the argument
  for a stronger lane is instruction following, not cost
  ([ROADMAP.md](ROADMAP.md), Phase 4).
- **It does not quote latency as fact.** A time-to-first-byte figure is a
  measurement on this machine or it is nothing. Where a vendor publishes one it
  is marked as published, never as measured.

---

## The four lanes

The lane decides what a provider *is*, which is why it also decides the
credential shape. This is the vocabulary `AI Models` draws and the runtime does
not yet carry in full.

| Lane | What it is | Credential |
| --- | --- | --- |
| **Cloud** | A vendor's own hosted API, one account, one key | Bearer token; **OpenAI also takes a subscription token set** -- see below |
| **Local** | On-device, on this machine's disk and memory | None, by construction |
| **Self-hosted** | An OpenAI-compatible server the user operates, on another machine | Base URL, typed model id, optional token |
| **Enterprise** | A cloud account with a region and a tenant | Three different shapes -- see below |

**The enterprise three are not a variation on a bearer token.** Each
authenticates against an account and a region with its own credential shape, so
each is a separate native adapter:

- **AWS Bedrock** -- **three paths, not two**, and they are tried in order:
  a named profile through the Node credential chain, then an explicit access
  key plus secret plus optional session token, then the ambient chain with the
  region alone. Read off the donor's `enterpriseAiProviders.js`, which
  implements exactly that ladder. The drawn row says "access key, secret and
  region -- or the ambient AWS credential chain" and is missing the middle
  rung.
- **Azure OpenAI** -- endpoint, deployment name and key, or Entra ID. **The
  deployment name is the model id**, which means a model picker on this lane
  cannot offer a fixed list.
- **GCP Vertex AI** -- service-account JSON, project and location.

**`local` and `self_hosted` are not two names for the same thing.** `local` is
on-device; `self_hosted` is a user-operated remote or LAN service. The spec
already fixes this and the config must not blur it.

**A bearer token is one credential shape, not the only one on Cloud.** OpenAI
takes a second: an OAuth token set against the user's ChatGPT plan, which pays
by subscription rather than per request. It is a credential kind, not a lane --
the lane says what a provider *is*, and billing is not that. The shape reaches
chat models only and is admissible for five of the nine jobs; ADR 0102 records
the boundary and *OpenAI, by subscription* below records what the vendor
actually serves behind it. **No other vendor on this page has this shape**, and
for most of them it is not obtainable rather than merely absent -- see the same
section.

**So a credential is held per role, not per provider** (ADR 0105). One account
may hold a key for recognition and a subscription for chat at once, which is why
*follow the connection* follows the provider and never the credential: a speech
job on a subscription-paid OpenAI connection resolves to no credential at all
and names the one it needs, rather than borrowing one that cannot pay for it.

## The nine jobs

Eight are in the type today (`src/screens/data.ts:230`). The ninth is the one
this document found missing, because four records depend on it and the `JobKey`
union does not carry it. **ADR 0109 makes it the ninth entry** -- that part is
bookkeeping, since ADR 0042, ADR 0064, ADR 0094 and ADR 0102 all already write
contracts against it. *Where* the translation voice sits on `AI Models` is
separate and stays the owner's question.

| Job | What runs it |
| --- | --- |
| `dictation` | speech recognition, one utterance, latency-bound |
| `meetings` | speech recognition, an hour, nothing waiting on the result |
| `upload` | speech recognition on a file somebody hands over |
| `cleanup` | a chat model, inside the dictation |
| `rewrite` | a chat model, carries the communication style |
| `translate` | a chat model (ADR 0041) |
| `enhance` | a chat model, structures a dictated prompt |
| `assistant` | a chat model, four doors, one model (ADR 0040) |
| **`voice`** | **speech synthesis** -- see *The ninth job*, below |

---

## Cloud

### Groq

Source: `console.groq.com/docs/models`, `/speech-to-text`, `/text-to-speech`,
read 2026-08-11. The only cloud lane the runtime integrates.

| Job | Model | Notes |
| --- | --- | --- |
| speech | `whisper-large-v3` | $0.111/hr |
| speech | `whisper-large-v3-turbo` | $0.04/hr, the faster of the two |
| chat | `llama-3.1-8b-instant` | 131,072 context |
| chat | `llama-3.3-70b-versatile` | 131,072 context; today's cleanup/rewrite model |
| chat | `openai/gpt-oss-120b`, `openai/gpt-oss-20b` | 131,072 context |
| voice | `canopylabs/orpheus-v1-english` | preview, $22 / 1M characters |
| voice | `canopylabs/orpheus-arabic-saudi` | preview, $40 / 1M characters |

- **Speech is batch only.** `POST /openai/v1/audio/transcriptions` and
  `/audio/translations`, one file in, one result out. **No websocket, no
  `stream=true`, no partial results.** This is the finding that decides where a
  streaming recogniser can live at all.
- File size ceiling is **25 MB on the free tier, 100 MB on dev**. Minimum audio
  0.01 s; minimum billing 10 s. Accepted: FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG,
  WAV, WebM.
- **Language is a hint, not a detection.** Supplying ISO-639-1 improves accuracy
  and latency; automatic detection is not documented as a feature.
- **Voice covers English and Saudi Arabic and nothing else.** A German-English
  pair -- the pair the translation screen draws -- can be spoken on this lane in
  one direction only.

### OpenAI

Source: `developers.openai.com/api/docs/guides/speech-to-text` and
`/text-to-speech`, read 2026-08-11. The only cloud vendor on the drawn set that
serves all three roles alone.

| Job | Model | Notes |
| --- | --- | --- |
| speech, batch + stream | `gpt-transcribe`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` | `stream=true` emits `transcript.text.delta`, then `transcript.text.done` |
| speech, batch + stream | `gpt-4o-transcribe-diarize` | adds speaker attribution |
| speech, realtime | `gpt-live-transcribe` | Realtime endpoint, interim results on a live stream |
| speech, batch only | `whisper-1` | explicitly does not stream |
| voice | `gpt-4o-mini-tts` | newest, steerable delivery |
| voice | `tts-1`, `tts-1-hd` | lower latency / higher quality |

- **Two streaming shapes, and they are not the same thing.** `stream=true`
  streams the transcription of a *finished* recording; the Realtime endpoint
  transcribes a *live* one. A caption strip needs the second; a long upload
  wants the first.
- **The completion event names the detected languages** (plural). That is the
  language-switch signal arriving from the recogniser itself rather than from a
  separate identification model -- see *What this means for a language pair*.
- Language hints are optional via a `languages` parameter taking ISO 639-1
  codes.
- Voice: `POST /v1/audio/speech`, 13 built-in voices (`alloy`, `ash`, `ballad`,
  `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`, `marin`,
  `cedar`); `marin` and `cedar` are the vendor's quality recommendation.
  `tts-1`/`tts-1-hd` carry nine of them. Output MP3 (default), Opus, AAC, FLAC,
  WAV, PCM -- **`wav` or `pcm` for the fastest response**. Chunked transfer
  encoding means audio can play before the file finishes. Language coverage
  follows Whisper's 99+, but **the voices are optimized for English**.

### OpenAI, by subscription

Source: `github.com/EvanZhouDev/openai-oauth` (Apache-2.0) and OpenAI's Codex
authentication documentation, read 2026-08-11. This is the same vendor as the
section above, reached through a different credential and a **different
backend**, which is why it serves a different set.

Everything above is `api.openai.com`, on an API key, billed per request. A
ChatGPT subscription authenticates instead against
`https://chatgpt.com/backend-api/codex` -- the backend the official Codex CLI
talks to -- and that backend serves:

| Job | Served |
| --- | --- |
| chat (`cleanup`, `rewrite`, `translate`, `enhance`, `assistant`) | yes, `/v1/chat/completions` and `/v1/responses` |
| speech (`dictation`, `meetings`, `upload`) | **no. There is no `/v1/audio/transcriptions`** |
| `voice` | **no. There is no `/v1/audio/speech`** |

- **The absence of the audio endpoints is the whole scope of this credential.**
  The row above calls OpenAI the one cloud vendor serving all three roles alone;
  it serves them on the key. A subscription pays for what happens to a
  transcript, never for producing one.
- **Model availability is plan-dependent and not a fixed list.** The proxy
  documents only that the models are those Codex supports and that the set
  changes with the vendor's schedule and the user's plan. Pinning ids here would
  date this page for no gain -- the same argument open disagreement 5 makes
  about the drawn `LANES` names.
- Auth is OAuth 2.0 with PKCE against `https://auth.openai.com/oauth/token`;
  requests carry a bearer access token that refreshes. The credential is a token
  set with an expiry, not a static string.
- **It is tolerated, not granted.** The terms shipped with the flow license
  subscription auth for interactive Codex/ChatGPT use, **not for backend
  services**, and forbid pooling or redistributing tokens. Enforcement lands on
  the account of the person signed in.

**The other vendors: two forbade this and the rest cannot offer it.** Recorded
here because the absence is a finding, not a gap somebody should fill.

| Vendor | Subscription auth | Read 2026-08-11 |
| --- | --- | --- |
| **OpenAI** | available | the only one; tolerated rather than granted |
| **Anthropic** | **forbidden** | terms clause added 2026-02-19, enforced 2026-04-04; third-party integrations must use an API key |
| **Google Gemini** | **forbidden** | accounts suspended February 2026 for routing Gemini CLI / Antigravity OAuth into third-party products, paying Ultra subscribers included |
| Groq, Mistral, xAI, Deepgram | not applicable | no consumer subscription exists, so a bearer token is the only shape rather than the chosen one |

ADR 0102 carries the decision and the reasoning; this table is the capability
half of it.

### Anthropic

Source: the `claude-api` reference set, model table cached 2026-06-24.

**Language only. No speech recognition, no speech synthesis.** This is the
reason a single `provider` field per profile cannot express what a profile needs
-- the obvious second chat provider performs no recognition at all.

| Model | Context | Input / output per 1M |
| --- | --- | --- |
| `claude-opus-5` | 1M | $5 / $25 |
| `claude-sonnet-5` | 1M | $3 / $15 (introductory $2 / $10 through 2026-08-31) |
| `claude-haiku-4-5` | 200K | $1 / $5 |
| `claude-fable-5` | 1M | $10 / $50 |
| `claude-opus-4-8` | 1M | $5 / $25 |

Model ids are complete as written and take no date suffix.

### Google Gemini

Source: `ai.google.dev/gemini-api/docs/audio`, read 2026-08-11.

**It understands audio; it does not have a transcription endpoint.** Audio goes
into the Interactions API (`/v1beta/interactions`) as input and transcription
comes back because the prompt asked for it. Google's own documentation points
elsewhere for the dedicated case: *"For dedicated speech to text models with
support for real-time transcription, use the Google Cloud Speech-to-Text API."*

- Realtime voice and video is the **Live API**, a separate surface.
- Speech generation exists as a documented capability.
- **The drawn row says `stt: false`, and that is defensible read as "has no
  transcription endpoint" rather than "cannot process audio".** The distinction
  matters the moment somebody wires a `dictation` job to this lane, so it is
  recorded rather than smoothed over.

### Mistral

Source: `docs.mistral.ai/capabilities/audio/`, read 2026-08-11. Speech, language
and voice -- the second vendor after OpenAI to carry all three.

| Job | Model | Notes |
| --- | --- | --- |
| speech, batch | Voxtral Mini Transcribe 2 | diarization, word-level timestamps, context biasing up to 100 custom terms, **up to 3 hours per request**, 13 languages |
| speech, streaming | Voxtral Realtime | latency configurable **down to sub-200 ms**, 4B footprint, Apache-2.0, deployable at the edge |
| voice | Voxtral TTS (v26.03) | zero-shot voice cloning from a 2-3 second sample, 9 languages, cross-lingual with code-mixing |

- **Realtime does not accept the `diarize` parameter.** Streaming and speaker
  separation are not available in the same request.
- The three-hour batch ceiling is the only one on the drawn set that clears a
  meeting without chunking.

### xAI

Source: `docs.x.ai/developers/model-capabilities/audio/speech-to-text` and
`/text-to-speech`, read 2026-08-11. The most complete streaming speech surface
on the drawn set.

| Job | Endpoint | Notes |
| --- | --- | --- |
| speech, batch | `https://api.x.ai/v1/stt` | 500 MB ceiling, 12 formats, multichannel |
| speech, streaming | `wss://api.x.ai/v1/stt` | `interim_results=true` emits partials with `is_final=false` **about every 500 ms** |
| voice | `https://api.x.ai/v1/tts` and `wss://api.x.ai/v1/tts` | bidirectional; text in as deltas, audio out as base64 chunks |

- **Automatic language detection, returned as a `language` field.** The
  `language` *parameter* does something else: it formats numbers, currencies and
  units into written form. Setting it is not the same as detecting.
- Word-level timestamps (`words[]` with `text`, `start`, `end`) and
  `diarize=true` adding a `speaker` per word -- **and unlike Mistral, both are
  available on the streaming path**.
- Voice: `eve` (default), `ara`, `rex` and others, plus cloned custom voices. 20
  languages by BCP-47 code with an `auto` setting. MP3 (default, 32-192 kbps),
  WAV, PCM, mu-law/A-law, all 8-48 kHz. Up to 50 concurrent sessions per team,
  no text length limit per connection.
- **The drawn row says `llm: false`.** xAI does serve chat models; the drawing
  scoped this entry to speech. Recorded as an open disagreement below.

### OpenRouter

Source: `openrouter.ai/docs/features/multimodal/audio`, read 2026-08-11.

One key, many models -- it reaches vendors that have no adapter of their own.

- **Audio rides the chat endpoint**, not an audio endpoint: `/api/v1/chat/completions`
  with an `input_audio` content type going in, and `modalities: ["text", "audio"]`
  coming out.
- **Audio output requires `stream: true`**; it arrives as SSE chunks on
  `delta.audio`, base64 with transcripts.
- **No streaming transcription of audio input is documented.**
- Single bearer token. **Format support varies by the model behind it**, which
  means a capability answer on this lane is per-model and not per-provider --
  the one lane where `ProviderCapabilities` cannot be a constant.

---

## Enterprise

### Azure OpenAI

Source: Microsoft Learn, Azure OpenAI *What's new*, read 2026-08-11.

**The one enterprise provider that transcribes**, which is what the drawn
sentence on the other two means. It serves OpenAI's audio stack:

| Model | What it is |
| --- | --- |
| `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` | speech to text via `/audio` and `/realtime` |
| `gpt-4o-mini-transcribe-2025-12-15` | ~50% lower word error rate than its predecessor on English; **hallucinations on silence reduced up to 4x** |
| `gpt-4o-transcribe-diarize` | realtime ASR with speaker attribution, 100+ languages |
| `gpt-realtime-whisper` | low-latency streaming transcription for live captions |
| `gpt-realtime-translate` | **continuous stream-based audio translation** for live multilingual events |
| `gpt-4o-mini-tts`, `gpt-4o-mini-tts-2025-12-15` | speech generation |
| `gpt-realtime`, `gpt-realtime-mini`, `gpt-audio-1.5` | speech to speech |

The silence-hallucination line is worth reading twice against
[known-issues/transcription-hallucination.md](known-issues/transcription-hallucination.md):
it is the same defect class this product carries its own detection stage for.

`gpt-realtime-translate` is the closest thing on any lane to the capability the
translation window describes. It is noted, not adopted -- what a surface should
do with a single vendor-side translation stream is a design question and belongs
to whoever builds that surface.

### AWS Bedrock and GCP Vertex AI

**Both serve language models. Neither transcribes.**

Their clouds do have speech products -- Amazon Transcribe and Polly, Google
Cloud Speech-to-Text and Text-to-Speech -- but those are **separate services
with separate endpoints and separate credentials**, not a capability of the
model-serving API this lane authenticates against. Offering them as a lane
option would be a fourth and fifth adapter, not a checkbox.

On Bedrock, Anthropic model ids take an `anthropic.` prefix
(`anthropic.claude-opus-5`). On Vertex, current-generation ids are bare
(`claude-opus-5`) and dated snapshots use an `@` separator.

**That Bedrock line is too short, and a working implementation shows how much.**
The donor's registry ships `us.anthropic.claude-fable-5`,
`us.anthropic.claude-sonnet-5` and
`us.anthropic.claude-haiku-4-5-20251001-v1:0` -- a **region prefix** (`us.`, the
cross-region inference profile), then the vendor prefix, then optionally a date
and a `-v1:0` version. So an id on this lane is up to four parts, only one of
which is the model name, and **the drawn `LANES.Enterprise` rows carry
`anthropic.claude-sonnet-4-6` with no region prefix at all** -- wrong in the
prefix as well as a generation behind (open disagreement 5). A model picker here
cannot be built from a model name plus a string prefix.

**And all three enterprise lanes need a typed id, not only Azure.** The donor
marks `bedrock`, `azure` and `vertex` alike with `allowCustomModelId: true`, and
**ships Azure with no model list whatsoever** -- which is the direct answer to
the problem noted above, that a deployment name is the model id. The shape is an
optional curated list *plus* a typed field, on every enterprise row. Their
Vertex list carries only Gemini ids, which does not contradict Vertex serving
Anthropic models; it is a shipped subset, not a capability statement.

---

## Local

Source: `github.com/ggml-org/whisper.cpp`, read 2026-08-11, plus the runtime's
own `core/providers/local_preview.rs`.

**The lane where "no request leaves this machine" is true by construction rather
than by promise.** It is also the only lane whose speech path this product
already drives itself, which is why a streaming answer here is a different kind
of work than a streaming answer in the cloud.

### What whisper.cpp offers

| Path | What it is |
| --- | --- |
| `whisper-cli` | one file in, one transcript out. **This is what the runtime shells out to today.** |
| `stream` example | samples audio every ~0.5 s and transcribes continuously; `--step` and `--length` set the sliding window; needs SDL2 |
| `whisper-server` | an HTTP server with an OpenAI-compatible API |
| Silero VAD, integrated | detects speech segments and passes only those to the decoder, which speeds transcription up materially; thresholds and durations configurable |

- **A C-style API is exposed and documented in the header**, suitable for direct
  linking.
- **There is no official Rust binding.** Community crates exist. That is a
  dependency decision, not a given.

### The local lane has a fourth option this survey missed

whisper.cpp is not the only on-device recogniser a desktop product can ship, and
the donor ships a second one in production: **NVIDIA Parakeet models through
sherpa-onnx**, with bundled per-platform binaries and an ONNX runtime rather
than a C++ decoder.

What makes it relevant here is not the accuracy claim -- it is the streaming
shape. Their registry marks a model `runtime: "online"`, and the two online
entries (`nemotron-speech-streaming-en-0.6b`,
`nemotron-3.5-asr-streaming-0.6b`) are **cache-aware streaming FastConformers
served by a separate online websocket binary**, emitting partial and final
results that a small merger reconciles. The two offline entries use the offline
binary and do not stream at all.

Three consequences for this document's own findings:

- **Streaming locally does not require picking one of whisper.cpp's three
  shapes.** A fourth exists: a different model family whose streaming server is
  what upstream ships. That widens ADR 0096's *Local third, with streaming* step
  rather than answering it.
- **It is the counter-example to "local cannot report a detected language".**
  `nemotron-3.5-asr-streaming-0.6b` is documented as multilingual with automatic
  detection -- so a lane that ADR 0099 lists as needing something else can, on
  the right model, answer the question the recogniser is supposed to answer.
- **Streaming is a model attribute here too**, which is half the evidence for
  ADR 0110. Two of four models on one local provider, one binary family, one
  installation, opposite answers.

Whether WordScript wants a second local runtime is not decided by this document.
That it exists, ships, and streams is a fact the local streaming decision has to
be taken against.
- **The current path cannot stream.** `whisper-cli` takes a file. Streaming
  locally means a long-lived process (`stream` or `whisper-server`) or linking
  the C API -- three different shapes of work, and picking one is an ADR.
- The runtime already passes Silero VAD flags to `whisper-cli`
  (`--vad`, `--vad-model`, `--vad-threshold`, `--vad-min-speech-duration-ms`,
  `--vad-min-silence-duration-ms`, `--vad-speech-pad-ms`), gated on an env var
  and on a probe of `whisper-cli --help`. **The cloud lane has no VAD at all.**

### Local language models

Chat runs against an OpenAI-compatible endpoint, `http://127.0.0.1:11434` by
default, with `"stream": false`. Whether WordScript ships a server of its own or
talks to the Ollama or LM Studio a user already runs is open and belongs to
Phase 5.

### Local voice: Kokoro-82M

Source: `huggingface.co/hexgrad/Kokoro-82M`, read 2026-08-11.

82M parameters, **Apache-2.0**, v1.0 covers 8 languages with 54 voices, output
at 24 kHz. StyleTTS 2 architecture with an ISTFTNet vocoder -- decoder-only, no
diffusion.

**Its runtime is Python.** The model card documents the `kokoro` package
(>= 0.9.2), `soundfile` and `espeak-ng`, with `misaki` for grapheme-to-phoneme
conversion. No ONNX or Rust-friendly build is documented on the card. A local
voice therefore carries a process and a dependency chain, which is the same
shape of cost as the local speech runtime and should be priced with it, not
separately.

---

## Self-hosted

An OpenAI-compatible chat server the user operates, on another machine. Base
URL, a typed model id, an optional token.

**It does not transcribe, and the drawn screen already says the true thing:**
*"Speech has no OpenAI-compatible shape to talk to. Use Cloud or Local for the
listening jobs."* A self-hosted chat endpoint is a chat endpoint. The listening
jobs and the `voice` job say so and name the lane that can run them, rather than
offering a picker with nothing in it.

---

## The ninth job: `voice`

Two records put speech synthesis on `AI Models` -- ADR 0042 makes that screen
the owner of every model choice, and ADR 0064 says the translation window's
voice is a model row there like any other. `Models.tsx` draws it: a `Speaking`
group with one job, *"The desk's voice"*, carrying `mark={null}` because no
speech-synthesis vendor is in the brand set.

**But `voice` is not a `JobKey`.** The union in `src/screens/data.ts` has eight
entries and the `Speaking` job is drawn outside the lane axis. That is not an
oversight to correct quietly: adding a second row to that group is a *drawing*,
and the gallery grows a drawing before the product does (ADR 0057).

**ADR 0109 separates the two halves of that.** The union gains `voice` as its
ninth entry -- bookkeeping, because four records already write contracts against
it -- and the drawing question stays with the owner. It also fixes what the
build-out order needed and did not have: **no adapter lands before the row that
operates it.** ADR 0096 schedules Groq voice second, and the drawn `Speaking`
row offers `Cartesia Sonic-3` and `Kokoro-82M (local)` and nothing else, with no
provider mark and no credential control. So that step is gated on the drawing,
and if the answer is not there when OpenAI lands, Local moves up.

The candidates, all read 2026-08-11:

| Voice | Streaming | Languages | Published latency | Source |
| --- | --- | --- | --- | --- |
| Groq Orpheus | on the existing connection | English, Saudi Arabic | none published | Groq docs |
| OpenAI `gpt-4o-mini-tts` | chunked transfer | 99+, voices English-optimized | none published | OpenAI docs |
| xAI TTS | bidirectional websocket | 20, with `auto` | none published | xAI docs |
| Mistral Voxtral TTS | not stated | 9, cross-lingual | none published | Mistral docs |
| Cartesia Sonic | websocket | 34 | **none in the API reference** | Cartesia docs |
| ElevenLabs `eleven_flash_v2_5` | websocket | 32 | ~75 ms, vendor-published, excluding application and network latency | ElevenLabs docs |
| Kokoro-82M | local | 8 | n/a | model card |

- **Cartesia publishes no time-to-first-byte in its API reference.** ADR 0030
  and the drawn agent window both carry a figure for Sonic-3; whatever its
  origin, it is not in the reference read here. The surface already says the
  right thing -- *"Measured on this machine, not quoted from a datasheet"* -- and
  the row on `AI Models` states `Not measured`. It stays that way until somebody
  measures it.
- Cartesia serves `sonic-3.5`, `sonic-3`, `sonic-preview` and `sonic-latest`
  over `wss://api.cartesia.ai/tts/websocket` (a `cartesia_version` parameter is
  required). Raw container; PCM F32LE, S16LE, mu-law, A-law; 8k / 16k / 22.05k /
  24k / 44.1k / 48k. Buffering is configurable 0-5000 ms and **defaults to
  3000 ms** -- a default that would put three seconds in front of every spoken
  reply if nobody changed it.
- ElevenLabs also serves `eleven_v3` (70+ languages) and
  `eleven_multilingual_v2` (29), both streaming.

---

## Speech recognition, by shape

The table the streaming question actually turns on. **Batch** means one file in,
one result out. **Streaming** means partial results while the speaker is still
talking.

> **Read this table per provider and the vendor sections per model.** A `yes`
> here means *this provider serves a model that does it*, not *every model on it
> does*. OpenAI is the proof: `gpt-4o-transcribe` streams and `whisper-1` does
> not, on one key and one endpoint. The local lane repeats it and OpenRouter
> repeats it again. **The axis is the model** (ADR 0110), and this table is an
> orientation that predates that finding.

| Provider | Batch | Streaming | Reports detected language | Diarization |
| --- | --- | --- | --- | --- |
| Groq | yes | **no** | not documented | no |
| OpenAI | yes | yes, two shapes | **yes, on the completion event** | `gpt-4o-transcribe-diarize` |
| Anthropic | no | no | n/a | n/a |
| Gemini | via the chat surface | Live API, separate | not documented here | not documented here |
| Mistral | yes, to 3 hours | yes, sub-200 ms configurable | not documented | batch only |
| xAI | yes | yes, partials ~500 ms | **yes** | yes, **including on the stream** |
| OpenRouter | via the chat surface | **no** | per-model | per-model |
| Azure OpenAI | yes | yes | yes (OpenAI stack) | `gpt-4o-transcribe-diarize` |
| AWS Bedrock | no | no | n/a | n/a |
| GCP Vertex AI | no | no | n/a | n/a |
| Self-hosted | no | no | n/a | n/a |
| Local (whisper.cpp) | yes, today | possible, not on today's path | per-result | no |

For completeness, two vendors outside the drawn set that ADR 0030 named for the
spoken half and that turn out to serve recognition as well:

- **ElevenLabs** -- `scribe_v2` (90+ languages, batch, keyterm prompting up to
  1000 terms, entity detection across 65 types, diarization up to 32 speakers)
  and `scribe_v2_realtime` (90+ languages, streaming, ~150 ms published,
  automatic language detection, VAD-based segmentation on silence).
- **Deepgram** -- `flux-general-en` / `flux-general-multi` with
  **model-integrated end-of-turn detection**, built for voice-agent pipelines;
  `nova-3` / `nova-3-general` / `nova-3-medical` at 60+ languages with realtime
  multilingual transcription; `nova-2-*` variants at 40+. The models overview
  page did **not** document interim results, language detection, diarization or
  the Aura text-to-speech family -- those are absent from the page read, not
  known to be absent from the product. Recorded as unverified rather than as no.

---

## What this means for a language pair

Three findings that a surface reading this document should not have to derive
again.

**1. The recogniser can name the language; a separate detector is not required.**
OpenAI's completion event carries detected languages, xAI returns a `language`
field, ElevenLabs' realtime model detects automatically. On those lanes the
question *"which of the two languages was that"* is answered by the same call
that produced the text. Groq is the lane where it is not: language is a hint
there, and a pair would need something else to decide.

**2. Turn segmentation and streaming are separable.** A conversation is made of
turns. Deepgram's Flux puts end-of-turn detection **inside the model**;
ElevenLabs' realtime model segments on silence with VAD; whisper.cpp ships
Silero and the runtime already passes its flags locally. A surface that needs
turn boundaries needs a segmenter, and a surface that needs words appearing
mid-sentence needs a stream. They are not the same requirement and should not be
priced as one.

**3. Speaking and listening at once is a per-vendor answer.** Streaming
synthesis exists on OpenAI (chunked), xAI (bidirectional websocket), Cartesia
and ElevenLabs. What none of them solve is the microphone that is still open
while the speaker plays -- that is this runtime's problem, on this machine, and
no provider row answers it.

---

## Open disagreements between this document and the drawing

Recorded, not resolved. Each needs a decision by somebody, and an implementation
must not settle one quietly.

**Three of the nine gained a record on 2026-08-11 and are noted in place.** A
record narrows a disagreement; it does not close one. **All nine are still
open**, because each is closed by the drawing and the runtime agreeing, which is
code, and none of this is built.

1. **`xAI` is drawn `llm: false`.** It serves chat models. Either the drawing
   scopes the entry to speech deliberately, or it is short a capability.
2. **`Gemini` is drawn `stt: false`.** It processes audio through the
   Interactions API but has no transcription endpoint. The row is defensible and
   the reason belongs on the surface rather than in this file alone.
3. **`Mistral` is drawn `stt: true, llm: true` and also serves TTS.** The
   `Provider` type has no voice axis, so a provider's voice capability is
   currently unrepresentable in the drawn model. *ADR 0106 sends the axis
   through the gallery and keeps the answer to "can this be operated" in the
   runtime -- the drawn table stays a drawing either way.*
4. **`voice` is not a `JobKey`**, and `Models.tsx` draws exactly one voice row,
   for the desk. Whether the translation window's voice is that row or a second
   one in the same group is undecided -- and it is a drawing, so the gallery
   comes first (ADR 0057). *ADR 0109 adds the ninth `JobKey` and gates the voice
   adapter on the row; the drawing question is unchanged and still the
   owner's.*
5. **The drawn `LANES` model names are a generation behind.**
   `Cloud.translate` and `Cloud.assistant` both default to `claude-sonnet-4-6`
   and offer `claude-opus-4-7`; the whole Enterprise lane carries the same two
   ids under an `anthropic.` prefix. The current ids are `claude-sonnet-5` and
   `claude-opus-5`. A model name on a surface goes stale on the vendor's
   schedule, not this repo's, which is an argument about **where model names
   should live** rather than about these particular strings.
6. **`Cloud.upload` already draws a per-job provider override to OpenAI**, and
   the model it defaults to is `whisper-1` -- the one OpenAI documents as
   explicitly not supporting streaming. The override itself is the shape Phase 4
   wants (a resolved default plus a sparse per-job override); the model choice
   behind it is the part that dated.
7. **`Cartesia Sonic-3 - 240 ms` is drawn on the agent window** and no published
   figure backs it in the API reference. The row on `AI Models` already reads
   `Not measured`, which is the honest state.
8. **Nothing on any surface says whether a lane streams.** `AI Models` draws a
   provider, a model and a key per job, and no row anywhere reads a streaming
   capability. That is arguably right -- streaming is a property of the lane
   rather than a choice the user makes -- but it means the difference between
   Groq and OpenAI that decides whether a conversation can work **is currently
   invisible on the screen that picks between them**. Adding a row is a drawing,
   so the gallery grows it first (ADR 0057). *And it is worse than the entry
   said: the screen reads no runtime capability at all. `provider_status`
   returns `ProviderCapabilities` and nothing in `src/` consumes a field of it
   -- the capability answers come from the hand-maintained table this list
   argues with. ADR 0106 makes that seam a step of its own, before the first
   adapter.*
9. **The per-language device lists in `Translate.tsx` are placeholders, and one
   of them reads as a bug.** Each `Select` repeats its own selected value at the
   head of the list (`Desk speakers` twice in the German row, `AirPods Pro`
   twice in the English one) -- the prototype's way of making a `defaultValue`
   match, not a real enumeration. A wired implementation lists each device once
   and marks one selected. Worth stating because the duplicate is visible in the
   gallery and will otherwise be ported faithfully. *ADR 0108 adds what that
   list is also missing: somewhere to say the remembered device is gone and the
   default is playing instead, which `PLATFORMS.md` requires and no drawn row
   can currently carry -- and it fixes the scope confusion underneath, since
   this is a machine-wide setting drawn on a window that may stand three times.*

---

## The implementation reference

`donors/app/desktop-shells/openwhispr` ships a complete multi-provider stack --
fourteen provider ids, four streaming recognisers, three enterprise lanes, a
self-hosted lane and a local one. It is the closest thing to a worked answer for
the build-out, and it is **read for mechanism, not copied**: it is Electron with
a JavaScript main process, and this product's equivalent seam is Rust.

What to read, and for what:

| File | What it answers |
| --- | --- |
| `src/services/ai/inferenceProviders/index.ts` | the registry -- a frozen id→implementation map, **many-to-one** |
| `src/services/ai/inferenceProviders/types.ts` | the one-method provider interface and the injected `ProviderContext` |
| `src/services/ai/providers.ts` | how far one OpenAI-compatible shape stretches, and the two quirks that break out of it |
| `src/helpers/enterpriseAiProviders.js` | three credential ladders, and why they load lazily in the main process |
| `src/config/inferenceScopes.ts` | per-job routing as named scopes -- and the flat-key cost of doing it that way |
| `src/helpers/reasoningRouting.js` | `inheritsFallbackEndpoint`: **when a job may not borrow the default's key** |
| `src/helpers/transcriptionFallback.js` | a fallback target of `skip`, so a signed-out user's audio is not diverted |
| `src/helpers/openaiRealtimeStreaming.js` | session pre-emption at 55 minutes, cold-start buffering, a bounded dial |
| `src/helpers/deepgramStreaming.js`, `assemblyAiStreaming.js`, `cortiStreaming.js` | three more of the same contract with different constants |

**Read on a second pass, and each one changed a record:**

| File | What it answers |
| --- | --- |
| `src/models/modelRegistryData.json` | **the strongest single finding** -- `streaming` is a flag on a *model*, and `runtime: "online"` is the same axis on the local lane. ADR 0110 |
| `src/helpers/tokenStore.js` | a credential has a **generation**; a refresh that lost the race is refused with `AUTH_CONTEXT_CHANGED`, a failed delete persists an encrypted empty value, and changes are published to listeners. ADR 0105 |
| `src/helpers/cloudChunkPolicy.js` | a **global** in-flight ceiling across jobs, so a batch upload cannot starve a dictation; and which error codes doom a job rather than a chunk. ADR 0107 |
| `src/helpers/translationChain.js` | an empty translation **preserves the input**, cleanup soft-fails, and a source already equal to the target skips the step. ADR 0101 |
| `src/helpers/chatRouting.js` | a role resolves from its own settings only -- *"must never consult Dictation Cleanup's mode or endpoint"* -- and an explicit URL outranks a stale provider id. ADR 0105 |
| `src/config/secretKeys.js` | one key per provider, one entry to add one -- and `preload.js` mirrors the tuples inline **with a test guarding the copy**, which is the pattern for any mirrored contract. ADR 0106 |
| `src/utils/urlUtils.ts` | `isSecureEndpoint`: HTTPS **or** a private host, so a LAN server on plain HTTP works without licensing a token over the open internet |
| `CLAUDE.md`, *Streaming Commit* | where the runtime owns the decoder they commit the stream's flush and skip the second decode; the flush is truncation-aware and falls back to batch when it is not clean. ADR 0095 |

The findings that changed records in this repo are recorded where they apply:
the registry shape, the credential rule and the scope cost in ADR 0094, the
streaming operational facts in ADR 0095, Bedrock's third credential path in the
Enterprise section above, and the model-versus-provider axis in ADR 0110.

**One absence is also a finding: the donor has no speech synthesis at all.** No
TTS helper, and no voice family in a registry that otherwise enumerates
transcription, chat, enterprise, local and diarization models. So for `voice`
(ADR 0109) there is no worked implementation to read here, and the survey's
seven candidates are the whole of what this repo has to go on.

## Maintaining this document

- **Every row carries a date and a source.** A model id without a date is a
  false statement waiting to happen -- vendors rename, deprecate and re-tier on
  their own schedule.
- **Read the vendor's own documentation, not a summary of it.** Two of the
  findings above -- that Groq's speech path does not stream, and that Cartesia
  publishes no TTFB in its reference -- contradict what a search result will tell
  you.
- **State what does not work as a sentence.** An empty cell is indistinguishable
  from an unresearched one; `src/screens/data.ts:264` is the pattern to follow.
- When a lane becomes integrated, this file does not record that. STATUS.md
  does, and `AI Models` stops greying the control out.
