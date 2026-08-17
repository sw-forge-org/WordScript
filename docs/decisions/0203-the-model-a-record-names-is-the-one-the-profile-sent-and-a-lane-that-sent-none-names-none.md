# 0203: The model a record names is the one the profile sent, and a lane that sent none names none

Date: 2026-08-17
Status: Accepted. The model half of the axis
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md)
opened, and the fix for
[`known-issues/the-record-names-the-connection-model-not-the-one-that-listened.md`](../known-issues/the-record-names-the-connection-model-not-the-one-that-listened.md).

## Context

Two paths answered *which model listened* and they read different objects.

```text
history record   "provider": "groq", "model": "whisper-large-v3"
runtime log      Groq transcription start … model=whisper-large-v3-turbo … prompt_chars=53
```

Both describe `history-1786910918745-50`. The request went to the turbo model.
The record said otherwise, and so did **all 50 records in the file at the time**
— 105 by the time this was fixed, every one of them naming a model no request
carried.

`active_model_for_provider` (`history.rs`) read the connection-wide
`config.model` / `config.local_model`. `NativeCaptureConfig::load_from_disk`
read the **profile's** `speech.model` / `speech.local_model`, with a third arm
for the self-hosted lane's own field (ADR 0165). The provider half of the same
question has gone through `job_provider(JobKey::Dictation)` since ADR 0094; the
model half never followed it, so any profile that sets a speech model at all —
the axis ADR 0094 introduced and the `AI Models` matrix draws — produced a
record filed under the connection's default.

A third caller had a fourth answer: `capture_budget::resolve` took
`speech.local_model` whenever that was non-empty, which is every profile, and
handed a local model name to cloud lanes.

## Decision

**One resolver, on the config, asked by everything that needs the answer.**

```rust
pub(crate) fn speech_model(&self) -> Option<String>
```

It asks the active profile, then the lane: local takes `speech.local_model` and
falls back to `base`; self-hosted takes `self_hosted_model` (ADR 0165 — a
catalogued cloud id names nothing on somebody's own server); every other lane
takes `speech.model`. `NativeCaptureConfig::from_app_config`,
`capture_budget::resolve` and the four history record sites call it and nothing
computes a second answer.

**`None` is a real answer, and it is why this is an `Option`.** The cloud and
self-hosted lanes let the adapter pick when no id is configured — Groq resolves
an empty model to its turbo row, the self-hosted lane checks an environment
variable and then refuses. A record naming the id the adapter *would* have
picked is a fluent, plausible sentence about a request nobody made, which is
precisely the failure class this cluster exists to catch, committed by the
instrument that is supposed to catch it. The local lane has no such door —
whisper loads a file — so `base` there is a resolution and not a guess.

`load_from_disk` became `Self::from_app_config(AppConfig::load_from_disk())`.
Two documents and a comment in `text_rules.rs` already named `from_app_config`
while only the disk-reading version existed; the split is what gives the seam a
test, which is the third thing the record asked for.

## Consequences

**The record, the request and the capture ceiling now name one string**, held by
three cases in `capture.rs`: a profile-level override wins over the connection
value, the local lane names the profile's own weights, and a lane with nothing
configured records nothing rather than a default.

**The 105 records already on this machine keep a value no request used, and
nothing migrates them.** The owner's call, 2026-08-17: local state on this
machine is disposable and not worth a migration. What follows from it is a
measurement rule, not a code rule — **no per-model rate may be computed across
the boundary**, and every rate this track has published so far (the prompt-leak
rate, the invention rate, the English-drift rate, the truncation events) is a
rate *on this machine* rather than a statement about `whisper-large-v3`. The
transcript files ADR 0074 wrote carry the same wrong `model:` line in their
front matter and are also left alone: rewriting a user's dated artifacts after
the fact is the worse of the two options, and this cluster's standing rule is
that a wrong record is reported rather than repaired.

**What a retry names is left open and visible.** The two retry sites call the
same resolver, and a retry re-runs the transform over a transcript that already
exists — nothing listens. So a retried record names this machine's *current*
recogniser for a request that never happened, beside a `provider` that
deliberately names the transform job's vendor (`history.rs`, the comment at the
retry start). Carrying the original record's model forward is the other
defensible reading. Neither is measured, so the question is written into the
code rather than answered by this ADR.

**The correction model has the same shape and was not touched.**
`transform_config_from_app_config` reads `config.correction_model` where the
live capture reads the profile's `speech.correction_model`, so a retry can run
its cleanup on a different model than the session did. That is a behaviour
difference rather than an attribution one, and changing it without a measurement
is how a retry starts producing text the original never would have.
