# 0110: Streaming is a property of a model, not of a provider, and OpenRouter was never the exception

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Corrects the capability
axes in
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md).

## Context

ADR 0094 grew `ProviderCapabilities` by four fields --
`transcription_streaming`, `reports_detected_language`, `speech_synthesis`,
`synthesis_streaming` -- and named exactly one case where a capability could not
be a constant:

> **`OpenRouter` is the exception that proves the axes are per provider and not
> per lane.** Its format and modality support varies by the model behind it, so
> its capability answer is per model. A capability that is a constant everywhere
> else is a lookup there.

**It is a constant nowhere.** `donors/app/desktop-shells/openwhispr` carries a
model registry that answers this question in data, and it puts `streaming` on
the **model**:

```
transcriptionProviders.openai.models:
  gpt-4o-mini-transcribe   streaming: true
  gpt-4o-transcribe        streaming: true
  whisper-1                (no flag)
```

One provider, one credential, one endpoint, **two answers**. And it is the same
provider ADR 0096 schedules first.

The local lane says it twice over. Their `parakeetModels` carry
`runtime: "online"` on two of four entries -- `nemotron-speech-streaming-en-0.6b`
and `nemotron-3.5-asr-streaming-0.6b` stream; `parakeet-tdt-0.6b-v3` and
`parakeet-unified-en-0.6b` do not. **Same lane, same runtime, same binary
family, opposite answers**, decided by which file the user downloaded.

**This repo already documented the fact and drew the wrong conclusion from it.**
`docs/PROVIDERS.md` records that OpenAI serves `gpt-transcribe`,
`gpt-4o-transcribe` and `gpt-4o-mini-transcribe` with `stream=true` **and**
`whisper-1` which *"explicitly does not stream"*. Its sixth open disagreement is
precisely this collision: `Cloud.upload` overrides to OpenAI and defaults to
`whisper-1`. The survey had the evidence; the contract took the wrong axis.

## Decision

**A capability that varies by model is declared on the model. A capability that
varies by provider stays on the provider.**

The split, per field ADR 0094 proposed:

| Field | Axis | Why |
| --- | --- | --- |
| `transcription_streaming` | **model** | `whisper-1` versus `gpt-4o-transcribe`, one key |
| `reports_detected_language` | **model** | same pair differs; Groq's Whisper never reports |
| `synthesis_streaming` | **model** | the survey's voice table is per model already |
| `speech_synthesis` | **provider** | *can this vendor speak at all* -- a role question, ADR 0094's `VoiceProvider` |
| `transcription`, `chat_completion` | **provider** | role questions, unchanged |

**The role is the provider's and the shape is the model's.** ADR 0094's trait
split answers *which of the three things can this vendor do*; that stays exactly
as written and is what the registry dispatches on. What a model can do inside a
role it already serves is a second question, and answering it on the provider is
what produced the OpenRouter "exception".

**`ProviderCapabilities` stops being the only capability type.** A model
capability travels with the model entry the surface already draws -- the drawn
`LaneJob` carries `model` and `models[]` today, so this is the axis the user is
already standing on when the question matters. **The user picks a model per job;
they never pick a "streaming provider".**

**A job asks its resolved model, not its lane.** ADR 0095 says a surface asks
`ProviderCapabilities` rather than the lane's name to know whether it will see
partials. That sentence stays true in intent and moves one level down: it asks
the **resolved (provider, model)** pair. On Groq every model answers no; on
OpenAI two answer yes and one answers no; the caller does not special-case
either.

**OpenRouter stops being an exception and becomes the ordinary case with an
unknown value.** Its per-model answer is not a different shape from OpenAI's --
it is the same shape whose values cannot be enumerated ahead of time, because
the model list is somebody else's. That is a *lookup at resolve time* versus *a
table shipped in the binary*, which is a data-freshness question, not a contract
question. **A model whose capability is unknown is not a model that streams**,
and the surface says unknown rather than assuming either way.

## Consequences

- **The four fields do not all land on the same struct**, so ADR 0094's
  consequence that `ProviderCapabilities` gaining fields is a contract change
  splits: part of it lands on the provider struct, part on whatever type carries
  a model entry, and `src/types/providers.ts` mirrors both.
- **The drawn model lists are where this becomes visible**, and they are a
  drawing (ADR 0057). `LANES[lane].jobs[job].models` is a `string[]` today --
  bare ids with no attributes. A streaming flag per model is a shape change to
  the drawing, not just a value, and it grows in the gallery first.
- **ADR 0106's seam widens with it.** *Can this row be operated* is a provider
  question; *will this row stream* is a model question. A single lookup that
  answers both from one struct is the mistake this record corrects, and the test
  ADR 0106 requires has to cover both axes or it proves the wrong one.
- **`docs/PROVIDERS.md`'s "Speech recognition, by shape" table is per provider
  and is now known to be per model in at least three rows** -- OpenAI, local
  whisper/Parakeet, and OpenRouter. The table stays as an orientation and gains
  the caveat; the per-model truth lives in the vendor sections, which already
  carry it.
- **Open disagreement 6 gets sharper rather than resolved.** `Cloud.upload`
  overriding to OpenAI and defaulting to `whisper-1` is not a stale model name;
  it is a model chosen for a job on a lane whose *other* models stream. Whether
  upload wants streaming at all is a product question and still the owner's.
- **This does not add a fifth capability field or a new lane.** It moves two
  existing ones onto the axis the evidence puts them on, before an adapter
  hard-codes the wrong one.
