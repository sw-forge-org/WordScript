# Every history record names the connection's model, not the model that listened

Status: **Fixed 2026-08-17 by
[ADR 0203](../decisions/0203-the-model-a-record-names-is-the-one-the-profile-sent-and-a-lane-that-sent-none-names-none.md)
for every record written from now on.** Found 2026-08-16, when **all 50 records
in the owner's history named a model no request used** — 105 by the time the fix
landed. **The records written before it keep the wrong value and nothing
migrates them** (the owner's call: this machine's local state is disposable), so
the measurement rule below outlives the code fix. The report is kept as written.

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

## What was written, 2026-08-17

ADR 0203 carries the reasoning. The three questions above, answered:

- **One resolver.** `AppConfig::speech_model()` asks the active profile and then
  the lane — local takes `speech.local_model` (falling back to `base`),
  self-hosted takes `self_hosted_model`, every other lane takes `speech.model`.
  `NativeCaptureConfig::from_app_config`, `capture_budget::resolve` and the four
  history sites call it; nothing computes a second answer. The local lane's
  half, named above as unchecked, was the same defect and is fixed with it.
- **A lane that sent no id gets a record that names none.** The answer is an
  `Option`, because Groq resolves an empty model to its turbo row and a record
  naming that row would be a plausible sentence about a request nobody made.
- **The seam has a test.** Three cases in `capture.rs`: a profile override beats
  the connection value, the local lane names the profile's own weights, and
  nothing configured records nothing.

**The old records are not corrected and not cleared.** Two consequences a later
reader has to carry:

- **No per-model rate may be computed across the boundary.** Records before
  2026-08-17 say `whisper-large-v3` regardless of what ran; records after it say
  what was sent. A rate over the whole file is a rate over two different
  attributions.
- **The transcript files keep their wrong `model:` line.** ADR 0074's front
  matter was written at record time and is not rewritten — a dated artifact is
  reported wrong rather than repaired, which is this cluster's standing rule
  applied to itself.

### The retry, settled the same day

The first version of this fix left one path open and said so in the code: **a
retry record named this machine's current recogniser** although a retry re-runs
the transform over an existing transcript and nothing listens. Closed by
[ADR 0205](../decisions/0205-a-retry-names-the-recogniser-that-produced-its-text-and-only-the-retry-that-listened-again-names-this-machines.md),
and reading the path turned the question into a sharper one:

- **There are two kinds of retry.** With a transcript, only the transform
  re-runs and nothing is sent anywhere; without one, `transcribe_retained_capture`
  sends the kept audio again — deliberately through the *current* config,
  because the retry usually follows a settings change. So the first inherits the
  retried record's recogniser and the second names this machine's.
- **It was four fields, not one.** `provider_profile` and the three local decode
  settings describe the same request and were being re-read the same way.
- **The two retry branches had disagreed with each other**: the empty-text
  branch wrote the *transform* job's vendor into `provider` while the successful
  branch wrote the recogniser's. They now write the same answer, which is what
  the comment above that resolution had asked for.

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
