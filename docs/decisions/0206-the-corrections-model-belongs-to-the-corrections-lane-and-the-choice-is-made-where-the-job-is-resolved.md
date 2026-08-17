# 0206: The correction's model belongs to the correction's lane, and the choice is made where the job is resolved

Date: 2026-08-17
Status: Accepted. The correction half of
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md)'s
axis, and the sibling of
[ADR 0203](0203-the-model-a-record-names-is-the-one-the-profile-sent-and-a-lane-that-sent-none-names-none.md).

## Context

ADR 0203 found the recogniser's model resolved off the wrong object. The
correction's model had **three** answers, and two of them were wrong in
different ways.

**The capture chose by the wrong job.** `NativeCaptureConfig::load_from_disk`
carried one correction model, picked by whether the *recogniser* was local:

```rust
correction_model: if local_provider_selected {   // ← Dictation's lane
    speech.local_correction_model
} else {
    speech.correction_model
},
```

Since ADR 0094 the correction is its own job with its own vendor. A profile that
listens on Groq and corrects on the machine's own runtime therefore sent
`llama-3.3-70b-versatile` to a local server that serves no such name — and the
refusal arrives as *your runtime rejected this*, not as *WordScript sent the
wrong id*, which is the same misdirection ADR 0165 fixed for the self-hosted
speech lane.

**The retry chose the right job off the wrong object.**
`transform_config_from_app_config` resolved `preset.correction_job()` properly
and then read the **connection-wide** `correction_model` / `local_correction_model`,
where the live capture reads the *profile's*. So a profile with a correction
model of its own was retried on a different model than the session ran on —
invisibly on any machine where the two happen to agree, which is every machine
that never set one.

**And the one case that overrides the user's choice could also leave their
lane.** A text over 300 words escalates to a bigger model, and the escalation
named `default_correction_model()` — the cloud default — on every lane, so the
longest dictations on a local profile asked the local runtime for a Groq model.

## Decision

**Both models are carried and neither is chosen early.** `NativeCaptureConfig`
and `NativeTransformConfig` each hold `correction_model` and
`local_correction_model`, filled from the active profile's speech block by both
builders. This is the same shape `providers` already has, and for the same
reason: the correction's job is not known until the effective mode is resolved.

**The choice is made beside the provider it depends on**, on the struct that
knows the job:

```rust
pub fn correction_model_for(&self, job: &JobProvider) -> String
pub fn lane_default_correction_model(&self, job: &JobProvider) -> String
```

`correction_model_for` picks the lane's field and falls back to *that lane's*
catalogue default when it is empty. `lane_default_correction_model` is the
long-text escalation, per lane. `apply_native_transform` resolves the job first
and the model second, in that order, and the context-width harness mirrors it
because it exists to measure the real call.

## Consequences

**A split-lane profile finally sends a model its vendor serves.** Two cases hold
it: a profile whose axis routes `Cleanup` to Local while `Dictation` stays on
Groq resolves the local correction model, and the recogniser's lane is untouched
by that; and the escalation resolves each lane's own default.

**A retry corrects on what the session would have corrected on**, held by a
parity case asserting the two builders produce the same pair from the same
config — the check ADR 0203 introduced for the speech model, applied to the
correction.

**No behaviour changes on a single-lane machine**, which is every machine this
has run on: both fields already carry the same values as the connection-wide
ones there. The defect is structural, and it is the second time this repo has
found *which model* answered before *which vendor for this job*.

**What this does not touch.** `chat_model_for_job` still reads the
connection-wide `agent_model` / `local_agent_model` while the profile's speech
block carries `agent_model` and `local_agent_model` of its own. It is the same
shape as this defect and it is left alone here rather than folded in: Agent,
Translate, Prompt Enhance and the transcript title all resolve through it, so it
is a change with four surfaces and it earns its own record.

## Correction, 2026-08-17, same day

**The paragraph above is wrong about the chat model and the sentence is left
standing rather than edited, because that is what this directory does with a
claim it has to withdraw.** Asked whether it was really a defect, the code was
read instead of the note:

- **Nothing reads the profile's `agent_model`.** All three readers —
  `chat_model_for_job`, `mode_router`'s `chat_model` closure and the Auto
  classifier in `lib.rs` — resolve the job's lane and then take the
  connection-wide field. They agree with each other, so unlike the correction
  model there is no second path to diverge from. `model_install` reads
  `speech.local_agent_model` only to answer *is this file in use*.
- **Nothing writes it either, beyond the copy `textProfiles.ts` puts in every
  new profile**, and no surface writes the connection-wide field at all. Which
  model answers as the agent is therefore the catalogue default, everywhere,
  and is not settable in the product.

So it is **not** the shape this ADR fixes. It is a per-profile field that looks
like an override and is read by nothing — the `use_as_prompt_hint` hazard, which
has produced two documented wrong turns in `known-issues/` — plus a missing
control. A product gap on the Models surface, not a wrong attribution, and the
distinction matters because the fix is a different one: the correction model
needed a resolver, this needs either a control or the field's removal.

**What the check did confirm** is that this ADR's own fix is more than
structural. `Models.tsx`'s `Use` button writes `local_correction_model` **into
the active profile's speech block**, and the retry path was reading the
connection-wide one — so pressing *Use* on a language model changed what a live
cleanup ran on and not what a retry of it ran on.
