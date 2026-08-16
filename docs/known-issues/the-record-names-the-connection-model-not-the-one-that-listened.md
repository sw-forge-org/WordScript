# Every history record names the connection's model, not the model that listened

Status: **open, found 2026-08-16.** Nothing is fixed. **All 50 records in the
owner's history name a model no request used**, and every rate this repo has
measured per model is therefore attributed to the wrong row.

Found while resolving an unrelated report: the log line and the history record
for the same session name different models.

## The two values

```text
history record   "provider": "groq", "model": "whisper-large-v3"
runtime log      Groq transcription start … model=whisper-large-v3-turbo … prompt_chars=53
```

Both describe `history-1786910918745-50`, 2026-08-16 22:08:38. The request went
to `whisper-large-v3-turbo`. The record says `whisper-large-v3`.

Across the whole file: **50 of 50 records read `whisper-large-v3`**, and every
`Groq transcription start` line in the current runtime log reads
`whisper-large-v3-turbo`.

It leaves the app, too. The transcript files ADR 0074 writes carry the value in
their front matter, so
`~/WordScript/transcripts/2026/08/16-2208-gehirnstruktur-und-bewusstsein.md`
opens with `model: whisper-large-v3` — a durable artifact outside the config
directory, stating something no request did.

## Where they diverge

Two paths answer "which model", and they read different fields.

**The capture path (correct).** `NativeCaptureConfig::from_app_config`
(`capture.rs`) takes `speech.model` — the **profile's** speech block, ADR 0094's
provider axis — and that is what reaches the adapter and the wire.

**The history path (wrong).** `active_model_for_provider` (`history.rs:1259`)
reads `config.model`, the **connection-wide** value, for every cloud lane.

On this machine those are two different strings:

| Where | Value |
| --- | --- |
| `config.model` | `whisper-large-v3` |
| `curated-founder-ops` → `speech.model` | `whisper-large-v3-turbo` |

The profile override is not exotic — it is the axis ADR 0094 introduced and the
`AI Models` matrix draws. Any profile that sets a speech model at all produces
this mismatch, and the connection-wide value is then a default nothing uses.

**The function's own doc comment states the contract it breaks:**

> The speech job and nothing else: this names the model a record was
> transcribed with, and a profile that transforms on a different vendor does not
> change what listened.

It is right about the intent and about which job to ask. It asks the wrong
object. `speech_provider(config)` one line above already resolves the *provider*
through `job_provider(JobKey::Dictation)`; the model is not resolved the same
way.

## Why it matters more here than it looks

This repo's open defects are measured, and several of the measurements are
per-model or would become per-model on the next pass:

- the prompt-leak rate (15 % / 12.5 % of raw transcripts),
- the invention rate (4.4 %),
- the English-drift rate (7 of 50),
- the truncation events, whose second hypothesis is a **decoder** parameter.

Every one of those was computed over `history.json` and every one is filed under
a model name that no request carried. They remain valid as *rates on this
machine*; they are not valid as statements about `whisper-large-v3`, and the
turbo model is a distinct decoder with its own behaviour. **A comparison between
two models cannot be run from this file at all**, because the field does not
vary with what was sent.

The local lane has the same shape and is unchecked: `config.local_model` is read
where the profile's `speech.local_model` is what runs.

## What a fix has to answer

- **Resolve the model the way the provider is resolved**, from the active
  profile's speech block with the connection value as the fallback — the same
  order `from_app_config` uses, in one place both paths call.
- **Decide what the existing 50 records are.** They cannot be corrected: nothing
  stored what actually ran. Either they keep a value now known to be unreliable,
  or the field is cleared for records written before the fix. Leaving them
  silently wrong is the option this cluster exists to refuse.
- **A test that the two paths agree.** The provider half has one; the model half
  is the same seam and does not.

No fix is written here.

## Related

- [heard-and-written-do-not-say-which-stage-changed-what.md](heard-and-written-do-not-say-which-stage-changed-what.md)
  — the other field on the same record that reports something the runtime did
  not do.
- [stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md),
  [dictation-comes-back-in-english.md](dictation-comes-back-in-english.md) —
  two of the measurements whose model attribution this invalidates.
- ADR 0094 — the provider axis that made a per-profile model possible.
- ADR 0115 — a model id belongs in `shared/model_catalogue.json` and is named by
  slug; both ids here are catalogue rows, so this is a resolution defect and not
  a spelling one.
