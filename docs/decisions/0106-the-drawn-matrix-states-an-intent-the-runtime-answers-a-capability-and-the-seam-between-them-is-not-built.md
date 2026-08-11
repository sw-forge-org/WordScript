# 0106: The drawn matrix states an intent, the runtime answers a capability, and the seam between them is not built

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Corrects a claim made by
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md)
and repeated in `docs/spec/SPEC.md`.

## Context

ADR 0094 wrote, of `ProviderCapabilities`:

> The struct is already mirrored into TypeScript (`src/types/providers.ts`) and
> already read by `AI Models`. That mirror is the seam that stops a surface from
> claiming a capability the lane behind it does not have.

**Half of that is true and the load-bearing half is not.** The mirror exists:
`src/types/providers.ts:54` carries the eight fields
`src-tauri/src/core/providers/mod.rs:198` declares, and `provider_status`
returns the struct inside `ProviderStatus`. `AI Models` calls that command
(`Models.tsx:386`).

**It reads `status.credential` and nothing else.** No field of
`status.capabilities` is read anywhere in `src/` -- and `Models.test.tsx:26`
mocks `capabilities: {}`, an object with none of the eight fields, and the suite
passes. A mock that can be empty is the proof that nothing consumes it.

**What the screen actually draws from is a hand-maintained table.** `PROVIDERS`
in `src/screens/data.ts:203` gives each of ten providers a `stt` and an `llm`
boolean, and `providerNames(cap, lane)` filters the model pickers on them. Those
booleans are a drawing. `docs/PROVIDERS.md` runs three of its nine open
disagreements against exactly them -- xAI drawn `llm: false` while serving chat
models, Gemini drawn `stt: false` while processing audio, Mistral drawn with no
axis for the voice it serves.

So the sentence ADR 0094 used to justify not worrying about a surface
over-claiming describes a seam that has never carried load. **This is the
failure mode this repo has a scar from**: a document asserting a capability the
runtime did not have. The record correcting it is worth more than the sentence
was.

## Decision

**The drawn matrix and the runtime capability stay two different things, and
neither is edited into the other.**

- **`data.ts` is the drawing and remains it.** It states what the product
  intends to offer, it is copied from the gallery, and `npm run port:diff`
  measures against it (ADR 0057, ADR 0088). A capability answer read off the
  runtime must never be written back into this table.
- **`ProviderCapabilities` is the truth about what can be operated**, per
  provider, from the adapter that implements it.
- **The seam is the third thing, and it does not exist yet.** It is the code
  that makes a drawn row inert when the runtime says its lane cannot serve that
  role.

**Building the seam is a step of its own, and it comes before the first
adapter.** Not with it and not after it. Today two providers agree with their
drawing by accident, and ten will not: the moment `AI Models` can be operated
for a second lane, a row drawn from `data.ts` and a lane answering from a
registry are two sources for one question.

**A test is what makes the seam exist.** The rule is asserted the way this repo
asserts absences elsewhere: a provider whose `ProviderCapabilities` denies a
role produces a row that cannot be operated and states why. **Until that test
exists, no document may describe the mirror as a guard** -- it is a type that
travels, which is a precondition for a guard and not one.

**`ProviderCapabilities` gains the four axes ADR 0094 named, plus the role
axes ADR 0102 and ADR 0105 need**, and the drawn `Provider` type gains a voice
axis **through the gallery**, because a `Speaking` job with no representable
provider capability is `docs/PROVIDERS.md`'s third open disagreement and adding
the axis is a drawing. Growing the two together is deliberate: the drawing says
what a row offers, the runtime says whether it can be operated, and they answer
different questions about the same provider.

## Consequences

- **`AI Models` gains a state it does not draw today**: a row that is drawn,
  named, and not operable because the lane behind it says so -- distinct from a
  row that is inert because no adapter exists (ADR 0096) and from one inert
  because a credential is missing for its role (ADR 0105). Three reasons, three
  sentences; a single greyed control with one hint conflates them.
- **`provider_status` becomes a per-provider question and is asked ten times.**
  It takes a provider today because there are two. A screen drawing ten rows
  either asks ten times or gains a plural command, and that is a command-surface
  decision to take with the registry rather than after it.
- **The eight existing capability fields were never validated against a
  surface.** `supports_prompt_bias`, `supports_segments` and `model_management`
  have been returned by both providers and read by nobody. Wiring the seam is
  the first time they are load-bearing, and the first time a wrong value in one
  of them is visible.
- **`Models.test.tsx`'s empty `capabilities: {}` mock stops being valid** the
  moment a field is read, and it should fail loudly rather than default to
  false -- a capability defaulting to absent is a row silently inert, which is
  the same defect one layer down.
- **A mirrored contract is kept honest by a test, not by discipline**, and the
  donor demonstrates both halves. Their `src/config/secretKeys.js` is the single
  source for per-provider key plumbing, and `preload.js` **cannot import it**
  under sandbox -- so it restates the tuples inline, with the comment *"keep
  BYOK_KEY_BRIDGES there in sync"* and a test file named as the guard. This
  repo's Rust struct and its TypeScript mirror are the same arrangement across a
  wider gap. The seam this record requires is therefore two tests: one that a
  denied capability makes a row inert, and one that the mirror still matches the
  struct it mirrors.
- **The seam answers on two axes, not one** (ADR 0110). *Can this row be
  operated* is a provider question; *will this row stream* is a model question,
  because one OpenAI key serves a model that streams and one that does not. A
  test covering only the provider axis proves the easier half.
- **This record does not move `data.ts`.** No drawn row is corrected here, and
  the nine open disagreements in `docs/PROVIDERS.md` stay open. What changes is
  that the answer to *can this be operated* stops being read off a table that
  was never a runtime claim.
