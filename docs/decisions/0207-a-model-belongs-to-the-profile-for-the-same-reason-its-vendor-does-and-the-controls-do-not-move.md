# 0207: A model belongs to the profile for the same reason its vendor does, and the controls do not move

Date: 2026-08-17
Status: Accepted. Answers the open question in
[`known-issues/the-agent-model-is-a-default-no-control-can-change.md`](../known-issues/the-agent-model-is-a-default-no-control-can-change.md),
and completes what
[ADR 0203](0203-the-model-a-record-names-is-the-one-the-profile-sent-and-a-lane-that-sent-none-names-none.md)
and
[ADR 0206](0206-the-corrections-model-belongs-to-the-corrections-lane-and-the-choice-is-made-where-the-job-is-resolved.md)
did for the other two model questions.

## Context

The record above found the last of the three: the chat model behind every
transcript title, the Auto classifier, Agent, Translate and Prompt Enhance was
the catalogue default, no surface wrote it, and the per-profile
`speech.agent_model` beside it was written when a profile is created and read by
nothing. It left one question open, because the answer is the owner's and not a
derivation — **does the chat model follow ADR 0094's per-profile axis, or stay
machine-wide?**

Answered 2026-08-17:

> Ich kann sagen, dass das pro Profil gespeichert wird, aber GUI-technisch die
> Einstellungen da bleiben, wo sie jetzt sind. Es ist nämlich sehr wichtig, wenn
> ich zum Beispiel ein Unternehmensprofil habe und ein privates Profil, dass ich
> zwischen Enterprise und Cloud switchen kann.

**The profile is where two working lives are kept apart.** That is the same
argument ADR 0094 made for the vendor, and a vendor without its model is half an
answer: switching a profile from an employer's connection to a private one has
to move what runs on it, not just where it runs.

## Decision

**Storage per profile, controls where they already are.**

- `AppConfig::chat_model_for_job` resolves the job's lane and then reads the
  **profile's** `speech.agent_model` / `speech.local_agent_model`, falling back
  to the connection-wide field and then to the catalogue. One helper,
  `first_named`, states that order once.
- The capture snapshot carries both chat models the way it now carries both
  correction models (ADR 0206), and `NativeTransformConfig::chat_model_for`
  answers beside `correction_model_for`. **`mode_router` and the Auto classifier
  read the snapshot instead of the live config** — they resolved the lane off
  the snapshot and the model off `AppConfig`, so a profile switched during a
  recording moved one of the two.
- **No control moves and none is added.** `Models.tsx`'s `Use` button already
  writes into the active profile's speech block, which is what makes the storage
  per profile without a new surface. Its language-model arm now writes
  `local_agent_model` alongside `local_correction_model`: one lane's chat work,
  one button. The two fields stay separate for the day a surface offers them
  apart.

**The connection-wide fields stay as the fallback** rather than being deleted. A
profile written before this carries nothing for them, and one save replaces the
value with the profile's own.

## Consequences

**The silent local failure is gone.** A machine that pulled a model other than
`llama3.2:latest` and pressed `Use` had its correction moved and its agent left
behind, so the title call asked for a model that was not installed — and that
fallback is the same first-words filename a model declining to name one
produces. Held by a case in `Models.test.tsx` asserting both fields carry the
pull tag.

**Three model questions now resolve the same way**: recogniser (0203),
correction (0206), chat (this). Each asks the job's vendor first and the
profile's field second, in one place both the live path and the retry call.

**What is still machine-wide, and it is the owner's wider point** — *Cloud,
Local, Your Server and Enterprise, and everything that hangs off them*:

- `self_hosted_base_url` and `self_hosted_model` are `AppConfig` fields, so two
  profiles cannot point at two different servers. The speech-model resolver
  reads the machine-wide value on that lane for exactly this reason.
- Credentials are keyed `{provider}.{role}.{kind}` in the OS store, so one
  vendor holds one account. An employer's Groq key and a private one cannot both
  exist, which is the case the answer above describes.
- `provider_plans` is per vendor and follows the credential (ADR 0167), so it
  moves with whatever the credential does.

None of that is decided here. It is queued as **B14** on the speech track, which
owns the lanes, because it is a config-shape and a secret-store change rather
than a model resolution.
