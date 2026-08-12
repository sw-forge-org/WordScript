# 0109: `voice` is the ninth job, and no adapter lands before the row that operates it

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Constrains the order in
[ADR 0096](0096-every-drawn-lane-gets-an-adapter-and-groq-stops-being-the-only-one.md).

## Context

Four records already treat speech synthesis as a job of this product. ADR 0042
makes `AI Models` the owner of every model choice; ADR 0064 says the translation
window's voice is a model row there like any other; ADR 0094 declares
`VoiceProvider` as the third role *"so the third role is not bolted on later as
an exception"*; ADR 0102 states that a subscription credential is inadmissible
for `voice` **because** it is a job with a role that credential cannot serve.
`docs/PROVIDERS.md` surveys seven voice candidates and `docs/spec/SPEC.md`
carries the same nine-job vocabulary.

**`JobKey` has eight entries** (`src/screens/data.ts:230`), and `voice` is not
among them. The drawing has a `Speaking` group with one job -- *"The desk's
voice"* -- deliberately outside the lane axis, with `mark={null}` because no
synthesis vendor is in the brand set, a `Preset` select offering
`Cartesia Sonic-3` and `Kokoro-82M (local)`, and a `Measured TTFB` row reading
`Not measured`.

**ADR 0096 schedules Groq voice as the second adapter** -- on the connection the
product already holds, no new credential, *"the cheapest path to a first audible
sentence"* -- while carrying over ADR 0065's first term unchanged: **the UI does
not change**. Both cannot hold. Groq Orpheus is not among the two presets drawn,
the row has no credential control and no provider mark, and it sits off the lane
axis that would otherwise resolve a provider for it. An adapter written under
that order is code with no control that reaches it.

## Decision

**`voice` becomes the ninth `JobKey`. That part is bookkeeping, not a
question.**

Four records already depend on it being a job; the union is the one place that
has not been told. Adding it does not decide what the drawing looks like, does
not add a row, and does not attach a provider to the `Speaking` group. It makes
the type agree with the contracts written against it -- and it is the
precondition for ADR 0094's `VoiceProvider`, ADR 0102's inadmissibility rule and
ADR 0105's per-role credential resolution all naming something that exists.

**Where the translation voice sits on `AI Models` stays the owner's question**,
exactly as `../tracks/speech-track.md` records it: one row for the desk and the
table both, or a second row in the same group. This record does not answer it
and an implementation must not settle it quietly.

**And the rule that keeps the two apart: no adapter lands before the row that
operates it.**

A lane that is drawn and inert says so and is honest (ADR 0096, term 2). A
capability that is built and has **no drawn control at all** is different in
kind -- it is not visible as missing, it is not visible at all, and the only way
to find it is to read the registry. Every term ADR 0096 carried over from
ADR 0065 exists to keep the surface's claims true; this one keeps the surface's
*silences* true.

**So the order in ADR 0096 gains a precondition rather than a new sequence.**
Each adapter is preceded by a drawn, operable row for the job it serves:

- **OpenAI first** is unaffected. Every job it serves already has a row on the
  lane axis, and the credential work it needs is ADR 0102's and ADR 0105's.
- **Groq voice second is gated on the drawing**, and the gate is the owner
  question above plus the gallery growing the row (ADR 0057, `npm run
  port:diff`). It is a small drawing and a short answer, not a redesign.
- **If the answer is not there when OpenAI lands, Local moves up.** The order
  is *"a sequence rather than a promise"* in ADR 0096's own words, and a step
  waiting on somebody else's decision is exactly what a sequence reorders
  around. Nothing about Local depends on the voice row.

## Consequences

- **`JobKey` gaining an entry is a typed change with drawn consequences**, and
  `LANES` is `Record<LaneName, { provider, jobs: Record<JobKey, LaneJob> }>` --
  a ninth key makes four lanes each need a ninth entry, or the type has to say
  the job is off the lane axis. **The `Speaking` group is already drawn outside
  that axis**, which is the shape the type should follow rather than fight:
  `voice` is a job whose lane is not chosen the way the other eight choose one.
  Getting that wrong forces four invented rows.
- **`npm run port:diff` must still read `models` at 6 | 6** (ADR 0088). The
  gallery and the product change together or the measurement is meaningless.
- **The `Preset` select is a drawing of two voices, and the survey found
  seven.** `docs/PROVIDERS.md` lists Groq Orpheus, OpenAI, xAI, Mistral,
  Cartesia, ElevenLabs and Kokoro-82M. What that control becomes when the job
  gains a provider axis -- a preset list, or the provider/model pair every other
  job draws -- is part of the same drawing question and is not answered here.
- **`Not measured` stays until somebody measures.** ADR 0096's last consequence
  already says `Measured TTFB` closes by code and not by record, and
  `docs/PROVIDERS.md` records that Cartesia publishes no figure in its API
  reference at all.
- **This does not schedule a voice.** It says which job a voice adapter serves
  and what has to be true before one is written. What ships and in what order is
  still ADR 0096.
