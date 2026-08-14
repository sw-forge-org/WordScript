# Providers

Status: 2026-08-11. Every capability row was read against the vendor's own
documentation on that date and carries its source. Nothing here is measured on
this machine.

**Second pass, same day.** Seven vendors joined the survey (*Cloud, off the
drawn set*), a section on **what a vendor actually costs to adapt** was added
(*Adapter shapes*), and **two claims in the first pass were corrected**: that
OpenRouter has no audio endpoint, and that speech has no OpenAI-compatible shape
for the Self-hosted lane. Both were wrong in the same way and both made the
build-out look more expensive than it is. The corrections stand where the claims
did, with the reasoning, rather than being edited away -- and each grew a
disagreement (10 and 11) because the drawing repeats them.

**If you read one section, read *Adapter shapes*.** It is the one that answers
*can this vendor be implemented*, and the answer is per protocol shape rather
than per vendor or per model.

> This is the reference for **what a provider offers**. It is not a statement of
> what WordScript integrates. Today the runtime integrates exactly two
> providers -- `groq` and `local` -- and `AI Models` says so on itself.
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

**So a credential is held per role, not per provider** (ADR 0105, built
2026-08-11). One account may hold a key for recognition and a subscription for
chat at once, which is why *follow the connection* follows the provider and
never the credential: a speech job on a subscription-paid OpenAI connection
resolves to no credential at all and names the one it needs, rather than
borrowing one that cannot pay for it. The runtime now stores one entry per
`(provider, role, kind)` and refuses a kind a lane cannot authenticate with,
with the vendor named. **The shapes in the table above are still not carried** —
a base URL, three enterprise ladders and a token set are storage this build has
no room for yet.

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

Source: `openrouter.ai/docs/guides/overview/multimodal/audio`, `/tts` and
`/stt`, plus `openrouter.ai/blog/announcements/announcing-audio-apis`, read
2026-08-11.

One key, many models -- it reaches vendors that have no adapter of their own.

**This entry was written from one of three pages and understated the lane.**
The multimodal page is correct about what it describes and was read correctly;
the sentence built on it -- *"Audio rides the chat endpoint, **not** an audio
endpoint"* -- was the wrong half. **There are two ways in, not one**, and the
second is the one that matters to this product. Corrected 2026-08-11, same day,
against the vendor's own audio-API pages.

**The way in that this entry missed: dedicated audio endpoints.**

- `POST /api/v1/audio/speech` (since 2026-04-18) and
  `POST /api/v1/audio/transcriptions` (since 2026-07-22).
- **They are OpenAI-SDK compatible against base URL
  `https://openrouter.ai/api/v1`** -- the vendor documents pointing an OpenAI
  client at that base URL as the supported path. **That is the same shape
  `groq.rs` already builds** (`GROQ_API_BASE` is
  `https://api.groq.com/openai/v1`, and the call at `groq.rs:407` posts to
  `{GROQ_API_BASE}/audio/transcriptions`), which is why this lane costs a base
  URL rather than an adapter.
- Speech out returns a raw byte stream rather than JSON, MP3 or PCM, and
  **streams** via the SDK's streaming response. Provider-specific options pass
  through, including OpenAI's `instructions` field.
- Transcription in takes base64 JSON on `input_audio` **or** an OpenAI-style
  multipart file upload. Optional `language` hint.
- **Operational ceilings, and they are tighter than the chat lane's:** a
  60-second upstream timeout, no audio URLs, 25 MB on the multipart path, and
  no SRT/VTT output. A meeting does not fit through this door.
- Models are discovered with `?output_modalities=transcription` rather than
  from the default catalogue. Named on the vendor's pages:
  `openai/gpt-4o-mini-tts-2025-12-15`, `google/gemini-3.1-flash-tts-preview`,
  `mistralai/voxtral-mini-tts-2603`, `microsoft/mai-voice-2`,
  `fish-audio/s2.1-pro` for speech out; `openai/whisper-large-v3`,
  `openai/gpt-4o-transcribe`, `openai/gpt-4o-mini-transcribe`,
  `mistralai/voxtral-mini-transcribe`, `google/chirp-3` for transcription.
- **Streaming transcription is still not documented**, and that half of the
  original entry stands.

**The way in that this entry described, and which is still true:** audio also
rides `/api/v1/chat/completions` with an `input_audio` content type going in and
`modalities: ["text", "audio"]` coming out, where **audio output requires
`stream: true`** and arrives as SSE chunks on `delta.audio`, base64 with
transcripts. That path reaches audio-native chat models
(`google/gemini-2.5-flash`, `openai/gpt-4o-audio-preview`); the dedicated
endpoints reach dedicated speech models. **They are two different product
surfaces behind one key, and a reader who knows only the first concludes this
lane cannot do the listening jobs.**

- **The consequence for the drawing: `OpenRouter` is drawn `stt: false`**
  (`src/screens/data.ts`), and that is now provably wrong on both paths. It is
  recorded as open disagreement 10 rather than edited here.
- Single bearer token. **Format support varies by the model behind it**, which
  means a capability answer on this lane is per-model and not per-provider.
  *This section originally called that "the one lane where `ProviderCapabilities`
  cannot be a constant". It is a constant nowhere* (ADR 0110): OpenAI's own key
  serves `gpt-4o-transcribe` and `whisper-1` with opposite answers, and the
  contract built on 2026-08-11 puts the shape on `ModelCapabilities` for every
  lane. What is particular here is only that the values cannot be enumerated
  ahead of time, which is why the third answer -- `unknown` -- exists.

---

## Cloud, off the drawn set

**Seven vendors that are not in `PROVIDERS` and belong in this survey.** The
drawn ten were chosen when the question was *which language model cleans up a
transcript*. Four of the seven below answer a different question -- *which
recogniser hears correctly* -- and it is the one this product's most acute open
defect turns on. Added 2026-08-11; the decision to survey them is ADR 0116, and
surveying is not integrating.

**Why they are here and not a footnote.** The two entries under the shape table
already named ElevenLabs and Deepgram *"for completeness"*. That framing was
wrong: `docs/known-issues/stt-prompt-leaks-into-the-transcript.md` is open,
its cause is that **Whisper's only bias channel is free prompt text in the
decoder context**, and every vendor in the first group below biases through a
dedicated parameter that never enters the decoder's text. That is not a nicer
feature. It is the absence of the defect class.

### Deepgram

Source: `developers.deepgram.com/docs/models-languages-overview` and
`/docs/keyterm`, read 2026-08-11.

| Job | Model | Notes |
| --- | --- | --- |
| speech, batch + stream | `nova-3`, `nova-3-general`, `nova-3-medical` | 60+ languages, interim results |
| speech, stream | `flux-general-en`, `flux-general-multi` | 10 languages; **end-of-turn detection inside the model** |
| speech, batch + stream | `nova-2`, `nova-2-general` plus nine domain variants | 40+ languages |

- **Keyterm prompting is a query parameter, not a prompt.** `keyterm=` repeated
  per term, up to 100 terms bounded by 500 tokens per request, on Nova-3 and
  Flux. It takes **plain terms only** -- the legacy `keywords` weight and
  intensifier syntax is gone. **It never enters the decoder's text**, which is
  the whole reason this vendor is in this document.
- Flux's end-of-turn detection is the capability *What this means for a language
  pair* calls a segmenter, served by the recogniser rather than bolted in front
  of it.
- **Self-hosted exists and is not this product's self-hosted lane.** Deepgram
  ships containers, but they speak Deepgram's protocol, need a GPU and an
  enterprise licence, and **Flux must run in its own deployment, separate from
  every other Deepgram model including Nova-3**. That is S3 against a different
  base URL and an enterprise procurement, not the user-run OpenAI-compatible
  server the Self-hosted lane describes. **Drawing it as a cell on that lane
  would be a fiction.**
- **The credential shape for a self-hosted deployment was not read.** Licence
  key, per-request key or mTLS -- unverified, and not claimed.

### ElevenLabs

Source: `elevenlabs.io/docs/overview/models`, read 2026-08-11. The one vendor
here that serves both listening and speaking well.

| Job | Model | Notes |
| --- | --- | --- |
| speech, batch | `scribe_v2` | 90+ languages, **no streaming**, diarization to 32 speakers, keyterm prompting to 1000 terms |
| speech, stream | `scribe_v2_realtime` | 90+ languages, **~150 ms published**, automatic language detection, VAD segmentation on silence |
| voice | `eleven_v3`, `eleven_ttv_v3` | 70+ languages |
| voice | `eleven_flash_v2_5` | 32 languages, **~75 ms published**, excluding application and network latency |
| voice | `eleven_multilingual_v2` | 29 languages |
| voice | `eleven_flash_v2` | English only, ~75 ms published |

- **A thousand keyterms is an order of magnitude more than Deepgram's hundred**,
  and this product's vocabulary is a list of names it already keeps.
- Automatic language detection on the realtime model is the second lane after
  OpenAI and xAI that can answer ADR 0099's question without a separate
  detector.
- **On-premise and on-device are early access, not general availability**
  (announced for the first half of 2026), alongside VPC deployment on AWS
  SageMaker and GCP Vertex. **Nothing should be scheduled against it as if it
  had shipped.**

### AssemblyAI and Speechmatics

**Read from secondary sources only, and recorded as such.** Both belong in this
survey on capability; neither has been read against its own documentation, which
is this file's standard. **The rows below are therefore leads, not entries**,
and each is a source-and-date line short of the bar every other row here meets.

- **AssemblyAI** -- Universal-3.5 Pro, published 7.0 % aggregate WER;
  `keyterms_prompt` documented up to 1500 words on the Pro tier, 200 to 1000 on
  the older Universal-2 depending on tier; async and realtime tiers priced
  separately, realtime the more expensive.
- **Speechmatics** -- Melia-1, published 6.4 % aggregate WER, the best figure
  in the comparison read; on-premises deployment offered; priced above the
  others.

**Before either is drawn or adapted, it gets a real read.** Two of this
document's findings -- that Groq's speech path does not stream, and that
Cartesia publishes no TTFB -- exist precisely because a search result said
otherwise.

**Groq's batch-only speech path has an independent second source since
2026-08-14**, and it is an implementation rather than a page. The meeting donor
`donors/app/meeting-notetakers/anarlog` carries its own per-`(provider, model)`
capability table
(`apps/desktop/src/stt/capabilities.ts`, `getSttModelTranscriptionMode`) and
classes `groq` as `batch` with no exception, alongside `openrouter`,
`siliconflow`, `together`, `zai`, `speechmatics`, `azure_speech`,
`google_cloud`, `aws_transcribe` and `revai`. Read 2026-08-14. Two sources, one
conclusion, from a vendor page and from a shipped product.

**The donor's own shape is what this document exists to avoid, and that is the
second half of the finding.** Its table is a ninety-line `if` cascade inline in
the frontend, with no source and no read-date on any row -- the drift
[ADR 0115](decisions/0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md)
and `shared/model_catalogue.json` exist to prevent. **The finding is adopted;
the shape is not.**

### Microsoft Azure Speech -- the MAI-Voice family

Source: `learn.microsoft.com/azure/ai-services/speech-service/mai-voices`, read
2026-08-11. **Public preview**, without an SLA, and Microsoft says not to run
production on it yet.

| Model | What it is |
| --- | --- |
| `MAI-Voice-2` | highest fidelity, long-form with speaker consistency, 15 languages across 18 locales |
| `MAI-Voice-2-Flash` | low latency, built for interactive agents, same language coverage |

- **This is not Azure OpenAI, and the difference is the whole entry.** The host
  is `https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`, the
  header is `Ocp-Apim-Subscription-Key`, the body is **SSML**, and the
  credential is a Speech resource key plus a region. No deployment name, no
  tenant. **It is a different service that shares a corporate name** -- the
  same trap this document already flagged for Amazon Transcribe and Google
  Cloud Speech-to-Text, and the reason ADR 0117 puts it on Cloud rather than
  Enterprise.
- **The voice id carries the model**: `de-DE-Klaus:MAI-Voice-2`,
  `en-US-Harper:MAI-Voice-2-Flash`. A model picker on this lane picks a voice
  and a model in one string, which is a shape the catalogue (ADR 0115) and the
  voice contract (ADR 0114) both have to accommodate.
- **German is served by two voices with eighteen emotion styles each**
  (`de-DE-Klaus`, `de-DE-Mia`), addressed through `mstts:express-as` with a
  `styledegree`. **No other vendor on this page carries German expressive
  synthesis at that granularity**, and this product's owner works in German.
- Instant voice cloning from a 5-60 second clip exists and is **gated** behind
  Microsoft's Limited Access review with consent safeguards.
- **`microsoft/mai-voice-2` is also on OpenRouter**, on S2, with no SSML and
  therefore no emotion styles. That is the cheap door; this section is the
  expensive one, and the difference between them is exactly the style control.

### MiniMax

Source: `platform.minimax.io/docs`, release notes and the T2A WebSocket guide,
read 2026-08-11.

| Job | Model | Notes |
| --- | --- | --- |
| voice | `speech-2.8-hd` | high fidelity |
| voice | `speech-2.8-turbo` | the low-latency half of the pair |

- **`speech-02-hd` is legacy.** The vendor's own model page files the Speech-02
  series under legacy models; a request naming it is naming last generation.
- `POST /v1/t2a_v2` on a **region-specific host** -- `api-uw.minimax.io` for the
  western United States, `api.minimaxi.chat` for mainland China. A single base
  URL does not serve both, which is a constant per deployment rather than per
  vendor.
- A T2A **WebSocket** path exists for real-time playback. 40 languages, voice
  cloning from ~10 seconds, MP3/WAV/FLAC/PCM at selectable sample rates,
  10 000 characters per request.

### Bland

Source: `bland.ai/speech` and `docs.bland.ai`, read 2026-08-11.

| Job | Model | Notes |
| --- | --- | --- |
| voice | Bland Speech v3 | trained on conversational rather than studio audio |

- **`POST /v1/speak`, bearer token, HTTP chunked *and* WebSocket streaming**,
  PCM16 WAV at 44,1 kHz, $0,015 per 1000 characters pay-as-you-go. **It is a
  standalone TTS API**, not only a component of the phone-agent platform it is
  sold beside -- worth stating, because the vendor's own front page reads as a
  call-centre product.
- Stock voices are `Karen`, `Valentine`, `David`, `Allie`. Instant cloning from
  about ten seconds; professional cloning wants thirty minutes or more.
- **Neither a language list nor a latency figure is published on the pages
  read.** For a product whose voice job is a short spoken reply, an unpublished
  time-to-first-byte is the number that decides it, and this vendor does not
  state one. Recorded as absent, not as slow.
- **Not on OpenRouter.** So unlike the four vendors above, reaching it means S6
  and a module of its own.

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
own `core/providers/local.rs`.

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

An OpenAI-compatible server the user operates, on another machine. Base URL, a
typed model id, an optional token.

**This section said speech has nothing to talk to here, and that contradicted
this same file eleven paragraphs earlier.** The drawn sentence it endorsed --
*"Speech has no OpenAI-compatible shape to talk to. Use Cloud or Local for the
listening jobs."* -- reads as a fact about the world and is one about a
2026-08-11 reading. The Local section above already records that whisper.cpp
ships `whisper-server`, *"an HTTP server with an OpenAI-compatible API"*.
Both cannot be true. Corrected 2026-08-11, same day.

**`/v1/audio/transcriptions` is a de-facto standard, and a user-run server can
speak it.**

| Server | How it answers on that path | Source, read 2026-08-11 |
| --- | --- | --- |
| whisper.cpp `whisper-server` | serves `/inference` by default; `--inference-path /v1/audio/transcriptions` remaps it, and any client speaking the OpenAI audio API then works unmodified | `github.com/ggml-org/whisper.cpp` |
| faster-whisper-server / speaches | OpenAI-compatible transcription and translation, word-level timestamps, SSE | project docs |
| LocalAI | OpenAI-compatible `/v1/audio/transcriptions` | project docs |

- **So the listening jobs get this lane, and the refusal has to go.** The drawn
  `none:` sentences on `dictation`, `meetings` and `upload`
  (`src/screens/data.ts`) are the correction's other half; a drawing changes in
  the gallery first (ADR 0057), so this file records the disagreement --
  number 10 below -- rather than pretending the screen already says it.
- **The credential shape does not change.** Base URL, typed model id, optional
  token is what the lane already carries, and it is what a transcription call on
  this path needs. This is the cheapest capability this document found.
- **A free base URL is a security question, and the donor already answered it.**
  `src/utils/urlUtils.ts`'s `isSecureEndpoint` accepts HTTPS **or** a private
  host, so a LAN server on plain HTTP works without licensing a bearer token
  over the open internet.

**What is not verified, and is therefore not claimed.** Only the transcription
path was read. Whether a user-run server answers `/v1/audio/speech` for the
`voice` job with the same reliability is **not established here** -- some do,
the coverage was not surveyed, and the empty cell would otherwise read as a no.
Recorded as unverified.

**Chat is unchanged.** A self-hosted chat endpoint is a chat endpoint, and the
five writing jobs already reach it.

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

**The drawing question was answered on 2026-08-11 (ADR 0119), and the count was
wrong.** It is the ninth job **and the tenth**: `voice` for the desk,
`translation_voice` for the conversation. A job is the unit at which a provider,
a model and a credential resolve, and two rows that pick different models are
two jobs by that definition. The reasons are in the record -- a persona is not a
channel, the target language is by definition not the user's, and a shared row
would force one model to satisfy an 8-language local option and a 70-language
conversation at once. **So F1 is no longer gated on an owner answer**; what
remains is drawing two rows, which is the gallery's step.

**And the palette behind those rows is now whole** (ADR 0118). Cartesia, Bland
and MiniMax get modules because OpenRouter does not carry them; Azure Speech
gets one because OpenRouter carries it without SSML, and SSML is the whole of
what it is worth. **The order follows a measurement**, not this table: no vendor
below publishes a figure this document will repeat as fact, so the output stream
lands first (ADR 0097), then a time-to-first-byte on this machine, then the
modules in the order that measurement justifies.

The candidates, all read 2026-08-11:

| Voice | Shape | Streaming | Languages | Published latency | Source |
| --- | --- | --- | --- | --- | --- |
| Groq Orpheus | S1/S2 | on the existing connection | English, Saudi Arabic | none published | Groq docs |
| OpenAI `gpt-4o-mini-tts` | S2 | chunked transfer | 99+, voices English-optimized | none published | OpenAI docs |
| xAI TTS | S4 | bidirectional websocket | 20, with `auto` | none published | xAI docs |
| Mistral `voxtral-mini-tts-2603` | S2 via OpenRouter, else S3 | not stated | 9, cross-lingual | none published | Mistral docs |
| Cartesia Sonic | S4 | websocket | 34 | **none in the API reference** | Cartesia docs |
| ElevenLabs `eleven_flash_v2_5` | S4 | websocket | 32 | ~75 ms, vendor-published, excluding application and network latency | ElevenLabs docs |
| ElevenLabs `eleven_v3` | S4 | websocket | 70+ | none published | ElevenLabs docs |
| **`microsoft/mai-voice-2`, via OpenRouter** | **S2** | per the endpoint | 15 languages, 18 locales | none published | OpenRouter docs |
| **Azure Speech `MAI-Voice-2-Flash`** | **S5** | via the Speech SDK | 15 languages, 18 locales | none published; the vendor calls it low-latency | Microsoft Learn |
| **Azure Speech `MAI-Voice-2`** | **S5** | via the Speech SDK | 15 languages, 18 locales | none published; **the vendor states it prioritises naturalness over latency** | Microsoft Learn |
| **`google/gemini-3.1-flash-tts-preview`, via OpenRouter** | **S2** | per the endpoint | multilingual, not enumerated on the page read | none published | OpenRouter docs |
| **MiniMax `speech-2.8-turbo`** | **S4/S6** | T2A websocket | 40 | none published | MiniMax docs |
| **MiniMax `speech-2.8-hd`** | **S4/S6** | T2A websocket | 40 | none published | MiniMax docs |
| **Bland Speech v3** | **S6** | chunked and websocket | **not published** | **not published** | bland.ai/speech |
| Kokoro-82M | S7 | local | 8 | n/a | model card |

**Fourteen candidates and not one published time-to-first-byte that this
document will repeat as fact.** Two vendors now say something adjacent --
Microsoft calls Flash low-latency and says plainly that MAI-Voice-2 trades
latency for naturalness -- which is a vendor's ranking of its own pair, not a
number. **The row that decides this job is still a measurement nobody has
taken**, and that has not changed since the seven-row version of this table.

**The shape column is the new information here.** Four of the seven additions
cost no adapter at all, because OpenRouter serves them on S2. That is the
difference between *fourteen candidates* reading as fourteen build decisions and
reading as what it is: **one adapter, plus four modules** — Cartesia, Bland and
MiniMax because OpenRouter does not carry them, Azure Speech because it carries
it without the SSML that is the point of it (ADR 0118).

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
| **Deepgram** | yes | yes, interim results | not documented on the page read | not documented on the page read |
| **ElevenLabs** | yes, `scribe_v2` | yes, `scribe_v2_realtime` | **yes, on the realtime model** | to 32 speakers, batch |
| **AssemblyAI** | yes | yes | not read | not read |
| **Speechmatics** | yes | yes | not read | not read |

**The four new rows were an aside under this table and are now sections of their
own** (*Cloud, off the drawn set*), because *"for completeness"* was the wrong
frame for the vendors that answer this product's most acute open defect. The
two right-hand columns carry *not documented on the page read* and *not read* as
different statements: the first means a page was read and did not say, the
second means no vendor page was read at all.

**And one column this table does not have: how the recogniser is biased.** It is
the column that matters most to a dictation product and it does not fit an
axis-per-capability table, so it is stated here instead. Whisper -- on Groq,
on OpenAI, and locally -- takes bias as **free prompt text in the decoder
context**, which is why `docs/known-issues/stt-prompt-leaks-into-the-transcript.md`
exists and why ADR 0017, ADR 0080 and ADR 0081 all exist to contain one defect
class. Deepgram (`keyterm=`, to 100 terms), ElevenLabs (to 1000 terms) and
AssemblyAI (`keyterms_prompt`) take it as **a parameter that never becomes
decoder text**. The defect cannot occur on those lanes. That is a capability
difference this table would otherwise hide.

---

## Adapter shapes, and what a vendor actually costs

**The question this table answers is the one a vendor list cannot.** *Can these
models be implemented* has no answer per model and no useful answer per vendor.
It has an answer per **protocol shape**, because a shape is what an adapter
implements and a vendor is only a set of constants on top of one. The eighteen
vendors on this page collapse into seven shapes, and two of those already exist
in the tree.

Read this before pricing any vendor request. Added 2026-08-11.

| Shape | What it is | Who is behind it | Roles | Cost |
| --- | --- | --- | --- | --- |
| **S1** | OpenAI-compatible batch speech -- `POST {base}/audio/transcriptions`, multipart or base64, JSON back | Groq (**built**), OpenAI, OpenRouter, Self-hosted (`whisper-server`, speaches, LocalAI) | `dictation`, `meetings`, `upload` | **the shape is already written.** `groq.rs:407` posts to `{GROQ_API_BASE}/audio/transcriptions`. Parameterize the base URL and each further vendor is a registry line |
| **S2** | OpenAI-compatible synthesis -- `POST {base}/audio/speech`, JSON in, audio bytes out | OpenAI, OpenRouter | `voice` | one module, and it is S1's twin. Through OpenRouter it reaches **five TTS vendors on one key** |
| **S3** | Vendor-proprietary REST speech, bearer token, own JSON | Deepgram, ElevenLabs, AssemblyAI, Speechmatics, xAI, Mistral | `dictation`, `meetings`, `upload` | one module per vendor, reusing S1's HTTP client. No new credential shape |
| **S4** | Duplex websocket, own framing | xAI, Deepgram, ElevenLabs, AssemblyAI, Mistral Voxtral Realtime, Cartesia, MiniMax, Bland, OpenAI Realtime | streaming `dictation`, streaming `voice` | **one transport, built once** -- `reqwest` carries no websocket, so it is a dependency decision (plan step D2) -- then one module per vendor for handshake and framing |
| **S5** | SSML over a region-scoped host, non-bearer header | Azure Speech (MAI-Voice-2, MAI-Voice-2-Flash) | `voice` | one module **plus a new credential ladder**. The only shape here that costs more than a module -- and avoidable, see below |
| **S6** | Vendor-proprietary REST synthesis, bearer token | Bland, MiniMax | `voice` | one module per vendor, reusing S1's client |
| **S7** | Local process, no network, no credential | whisper.cpp (**built**), sherpa-onnx/Parakeet, Kokoro-82M | speech, `voice` | module plus a managed runtime and its dependency chain -- the cost Phase 5 already prices |

### The three sentences this table exists to make

**1. S1 is already in this codebase, and nobody noticed.** Groq's speech call
is not a Groq shape; it is the OpenAI shape against a Groq host, and the
constant says so. The distance between *one integrated cloud lane* and *four*
is a base URL, a credential and a registry line -- **not four adapters.** This
is the single cheapest capability on this page and it was hidden behind the two
corrected sentences above.

**2. Several vendors need no adapter at all.** Every model OpenRouter serves is
reachable through S1 and S2 once one registry entry exists. That includes
`microsoft/mai-voice-2`, `google/gemini-3.1-flash-tts-preview`,
`mistralai/voxtral-mini-tts-2603` and `openai/gpt-4o-mini-tts-2025-12-15` --
four vendors' synthesis, on one key, for zero further modules.

**And four do need one, which the owner scoped on 2026-08-11: the palette is
offered whole** (ADR 0118). **Cartesia, Bland and MiniMax are not on OpenRouter
at all**, so there is no substitute door. **Azure Speech is on it and arrives
flattened** -- OpenRouter carries `microsoft/mai-voice-2` without SSML, and SSML
is where `mstts:express-as` lives, so the eighteen emotion styles on
`de-DE-Klaus` and `de-DE-Mia` are reachable only through the ladder. That is
what its module buys, stated so a later reader does not have to re-derive it.
**The test in ADR 0116 still governs the next vendor**: a complete palette today
is not a licence to add a module per name later.

**3. The expensive-looking category is one cost, not nine.** S4 reads as nine
vendors of websocket work. It is one transport decision plus nine thin framing
modules, and the transport is already owed to plan step D2 for OpenAI Realtime
alone. A streaming vendor added after that one is a module, not an
infrastructure project.

### What this does not say

- **It does not rank vendors**, and it does not say which to build. That is
  ADR 0116's job and the roadmap's.
- **It does not claim a shape is easy because it is shared.** S1 covers four
  lanes and still owes each of them a credential, a capability answer and a
  model list.
- **It prices modules, not correctness.** A vendor whose adapter is one module
  can still be the wrong vendor for a job, and every latency figure on this page
  is still published rather than measured.

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

**The list grew to eleven later the same day**, when this document's two
corrected sentences turned out to have counterparts in the drawing. A wrong
sentence in a survey is an edit; the same sentence on a surface is a
disagreement, because the gallery owns it (ADR 0057).

**And to twelve on 2026-08-12, while one closed.** Stage B3 built the catalogue
ADR 0115 specified, which closed number 5 the way the preamble demands -- by the
drawing and the runtime agreeing, in code. The same step opened number 12,
which nothing on this page could have found: a drawn model list is three strings
until a catalogue makes each of them name its vendor.

**And three closed on 2026-08-12, all by ADR 0128 and all in code.** Numbers
10, 11 and 13 — two false sentences and the override branch — went together
because one rule answers all three: a drawing inherited from the demo GUI is an
inventory of intent, the config is the answer about what is true, and what is
unbuilt stays visible and inert rather than being tidied away. **Four of
thirteen are now closed** (5, 10, 11, 13), and the nine that remain are still
closed only by the drawing and the runtime agreeing.

**Thirteen the same day, and this one was reached rather than read.** D1 landed
the OpenAI adapter and made the connection writable (ADR 0126, ADR 0127), which
put a step inside the per-job override for the first time -- and found the
drawing and the runtime holding two different answers about what a fresh
profile overrides. Number 13 is that. **It is also the first entry whose
resolution is scheduled**: the row cannot be operated until somebody decides,
and ADR 0109's rule points the same way.

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
   **Answered 2026-08-11 (ADR 0119), and it was worse than undecided.**
   `Translate.tsx` already tells the user the voice is *"chosen on AI Models
   like the rest"* and draws a button there -- pointing at a group whose only
   row is explicitly about coding agents. **Two rows**: a persona and a channel
   are different jobs, they need different languages, different latencies and
   different budgets. So `JobKey` gains `voice` **and** `translation_voice`,
   both on the `Voice` role and therefore on one credential. The route stays per
   language; the model does not. **What remains is the drawing**, which is the
   gallery's, and the disagreement stays open until the two rows stand.
5. **The drawn `LANES` model names are a generation behind.** ~~Closed
   2026-08-12 by the catalogue landing (stage B3).~~
   `Cloud.translate` and `Cloud.assistant` both defaulted to `claude-sonnet-4-6`
   and offered `claude-opus-4-7`; the whole Enterprise lane carried the same two
   ids under an `anthropic.` prefix. The current ids are `claude-sonnet-5` and
   `claude-opus-5`. A model name on a surface goes stale on the vendor's
   schedule, not this repo's, which is an argument about **where model names
   should live** rather than about these particular strings. *That argument now
   has an answer: ADR 0115 makes a model a dated row in one catalogue that Rust
   and the drawing both read. The particular strings are deliberately still
   wrong here -- correcting them by hand is the same work twice, at the place
   the catalogue replaces.*
   **Both halves are done.** `shared/model_catalogue.json` carries the current
   ids as dated rows against this document's Anthropic table, and neither
   runtime spells a model name any more: the drawing reads
   `lanes.Cloud.translate`, `core/config.rs` reads `runtime_defaults`, and a
   test walks `src/` to prove no file outside the catalogue spells a catalogued
   id. **This is the one disagreement on this list closed by code**, which is
   the bar the preamble sets for all of them.
6. **Scheduled 2026-08-13 as B7's** (ADR 0129), together with 12 — both live on
   the `upload` row and the override is what carries them. Removing it dissolves
   12 and reduces this one to *which model does upload take on the connection*,
   which the catalogue answers. **Not closed until the code lands.** The
   original entry follows.

   **`Cloud.upload` already draws a per-job provider override to OpenAI**, and
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
10. ~~**The Self-hosted lane's drawn refusal of the listening jobs is wrong.**~~
    **Closed 2026-08-12 by ADR 0128**, in code, which is the bar this
    preamble sets. The three rows now name what is actually missing — the
    adapter, not the endpoint shape — and stay inert until D1a lands. The
    original entry follows.

    **The Self-hosted lane's drawn refusal of the listening jobs is wrong.**
    `src/screens/data.ts` carries *"Speech has no OpenAI-compatible shape to
    talk to. Use Cloud or Local for the listening jobs."* on `dictation`,
    `meetings` and `upload`. `/v1/audio/transcriptions` is a de-facto standard
    and a user-run `whisper-server` answers on it -- see *Self-hosted* above,
    where this document corrected its own half of the same sentence. **The
    surface's half is a drawing and grows in the gallery** (ADR 0057). Until
    then a lane that can hear says it cannot. ADR 0113 carries the decision.
11. ~~**`OpenRouter` is drawn `stt: false`.**~~ **Closed 2026-08-12 by
    ADR 0128.** The boolean is `true`, and it is the one correction on this list
    that moved `npm run port:diff`: one extra option on each of the three `stt`
    rows takes `models` from `structural 6 | style 213 | text 12` to
    `structural 9 | style 217 | text 12`, verified by reverting the single
    boolean and watching the count return exactly. The original entry follows.

    **`OpenRouter` is drawn `stt: false`.** It serves transcription on a
    dedicated endpoint *and* through the chat surface -- see *OpenRouter*
    above. The boolean is wrong on both paths, and it is the one that keeps the
    cheapest additional speech lane on this page invisible on the screen that
    picks between lanes. Same shape as disagreement 1 (xAI's `llm: false`), and
    it resolves the same way: the drawing decides, not an implementation.
12. **Scheduled 2026-08-13 as B7's** (ADR 0129), with 6. It dissolves rather
    than being corrected: there is no override to be inconsistent with once the
    picker moves to the point of upload. The original entry follows.

    **`Cloud.upload` offers a Groq model id under its OpenAI override.** Added
    2026-08-12; **found by the catalogue rather than by a reading**, which is
    the first thing that step did that this survey could not have done for
    itself. The drawn list is `whisper-1`, `gpt-4o-transcribe`,
    `whisper-large-v3` — and the third is Groq's id, on a row whose provider
    override says OpenAI. It was invisible while the list was three strings in
    an array; a catalogue row names its vendor, so the mismatch is now on the
    page. **Not corrected**, for the reason every entry on this list is not:
    dropping the row is a drawing change and the gallery owns it (ADR 0057), and
    the alternative — catalogueing `whisper-large-v3` a second time under
    `openai` — would state that a vendor serves an id it does not. Neighbour of
    disagreement 6, which is about the same row's default.
13. ~~**A drawn per-job override is a product default the runtime does not
    carry.**~~ **Closed 2026-08-12 by ADR 0128**, the same day it was opened,
    and by neither of the two answers it posed. **The config answers in the
    product and the literal answers in the gallery** — so the drawn override
    stays exactly where it is as the record of an uncommitted product default,
    the product states only what is stored, and `port:diff` does not move for
    it. What the entry got wrong was treating *the gallery owns it* as a
    prohibition; ADR 0057 says the product wins after Leg 2 and a difference is
    an ADR or a bug. The original entry follows.

    **A drawn per-job override is a product default the runtime does not
    carry.** Added 2026-08-12 by D1 (ADR 0127), and it is the one entry on this
    list that a step reached, looked at and stepped around. `data.ts` gives
    three of the eight jobs an `override` — `upload` to OpenAI, `translate` and
    `assistant` to Anthropic — and that literal decides the row's SHAPE: an
    overriding row draws a provider mark, a *Use the default* button and an
    API-key row of its own, and the other five draw a *Follow the connection*
    select. A4 decided the opposite for the runtime: a fresh profile holds
    `overrides: {}` and every job follows the connection. **Both are defensible
    and they cannot both drive the same branch.** Driving it from the config
    changes three rows structurally at the default state and `port:diff` says
    so; leaving the literal in charge means a row displaying an override that is
    not stored. D1 wired the CONNECTION and left the override unwritable rather
    than pick one silently — an adapter may not settle a drawing question
    (ADR 0057), and this is the shape of the one it found.

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
candidates -- fourteen after the second pass, seven when this paragraph was
written -- are the whole of what this repo has to go on. **That absence is why
ADR 0114 writes the voice contract from vendor documentation rather than from a
working example**, and why it commits to one method instead of guessing four.

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
- **One page is not one API, and a negation is the sentence to distrust.** Both
  corrections made on 2026-08-11 were the same mistake in two places: a page was
  read correctly and a *"not"* was written from it. OpenRouter's multimodal page
  is true and simply does not mention the two dedicated audio endpoints; the
  Self-hosted claim was contradicted eleven paragraphs earlier **in this same
  file**. So: before writing that a vendor cannot do something, look for the
  second page -- and before writing it about a lane, grep this file for the
  opposite claim.
- **A model id belongs in the catalogue; a reason belongs here** (ADR 0115).
  The catalogue landed 2026-08-12 as `shared/model_catalogue.json`, and the
  model tables above are now its source rows rather than a second copy of them:
  a row there carries this document's source string and read-date, and a row
  whose provenance is this repo's own drawing or runtime says so instead of
  borrowing a vendor URL. **Adding a model is a row there, not an edit here** --
  what this document keeps is what a data row cannot carry: why a lane behaves
  as it does, what a vendor does not serve, and what was read but not verified.
  The catalogue's scope is narrower than this page's on purpose (ADR 0120): what
  this build routes to, defaults to or makes a statement about, and the long
  tail arrives live in B4.
- When a lane becomes integrated, this file does not record that. STATUS.md
  does, and `AI Models` stops greying the control out.
