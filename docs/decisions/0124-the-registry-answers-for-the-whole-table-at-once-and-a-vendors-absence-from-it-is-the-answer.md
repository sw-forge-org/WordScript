# 0124: The registry answers for the whole table at once, and a vendor's absence from it is the answer

Date: 2026-08-12
Status: Accepted. Implements the seam
[ADR 0106](0106-the-drawn-matrix-states-an-intent-the-runtime-answers-a-capability-and-the-seam-between-them-is-not-built.md)
required, and takes the command-surface decision that record left open.

## Context

ADR 0106 recorded that the capability mirror carried no load: no field of
`status.capabilities` was read anywhere in `src/`, `Models.test.tsx` mocked the
whole block as `{}` and the suite passed. It required the seam to be built
before the first adapter, and left one question explicitly open:

> **`provider_status` becomes a per-provider question and is asked ten times.**
> It takes a provider today because there are two. A screen drawing ten rows
> either asks ten times or gains a plural command, and that is a
> command-surface decision to take with the registry rather than after it.

Three facts decide it, and all three were in the tree already.

**`capabilities()` is deliberately not `status()`.** A1 split them and A2's
account says why: `status()` reads the OS secret store and probes the local
runtime, and a capability question must be answerable without either — including
by a registry-wide test that must not touch a developer's keyring. Ten
`provider_status` calls on a screen that merely opened would be ten keyring
reads and a local-runtime probe, and would spend exactly the cost the split
exists to avoid.

**Eight of the ten answers would be errors.** `resolve_entry` refuses an id it
does not carry — *"Provider 'gemini' is not supported yet."* — so the drawn
majority would be served by an error path, and *no adapter exists* would be a
string parsed out of a failure rather than a fact stated.

**The drawing and the registry speak different vocabularies, and neither may
learn the other's.** `data.ts` draws `OpenAI`; the registry answers `openai`.
ADR 0106 forbids writing a runtime answer back into `data.ts`, ADR 0057 keeps
that file a copy of the gallery, and `shared/model_catalogue.json` cannot hold
the correspondence either: its own test requires every declared vendor to carry
model rows, and four drawn vendors carry none.

## Decision

**The registry answers for its whole table in one command, and absence from that
answer is how *no adapter* is stated.**

`registered_providers()` returns one row per entry — the canonical id, the roles
the entry registered, and the provider's capability block. It takes no argument:
a filtered list would be the caller's drawing deciding what the runtime may
admit to registering. It reads no credential, so it cannot fail, and its
serialized shape is asserted to carry no credential field — the easy way to add
a *ready* column later is to fold `credential.configured` in, and that is the
door this closes before it is opened.

**`provider_status` keeps the credential question and is asked only for vendors
the registry admitted to.** Which is at most as many as the registry carries,
never as many as the drawing names — one, today.

**The correspondence between the two vocabularies lives in the seam**, with a
test as its keeper. That is the arrangement ADR 0106 endorses in its own
consequences, citing the donor: `secretKeys.js` is a single source `preload.js`
cannot import, so the tuples are restated with a comment and a test file named
as the guard. The guard here holds three directions — every drawn name has an
id, every id the catalogue also declares agrees with it on label and lane, and
**every id the registry answers with is reachable from a drawn name**. The third
is the one that bites when an adapter lands: `openai` registered under a
spelling nothing points at would read as a vendor with no adapter forever, on a
screen that draws it.

**Five states, not three.** ADR 0106 named three reasons a row may be inert. Two
more are not capability answers at all and must not be dressed as one:

- `pending` — the read is outstanding. **Nothing has been claimed**, so the
  surface keeps whatever reason it already had. The runtime can refine a
  sentence; it may not make the surface flicker through a second one on the way.
- `not_answered` — the runtime answered and the block was incomplete. This is
  loud. ADR 0106 requires it: *a capability defaulting to absent is a row
  silently inert*, and JavaScript reads a missing field as falsy, so without an
  explicit completeness check an empty block makes every lane read as denied and
  no test notices. That is precisely the state ADR 0106 found.

Keeping those two apart is what stops a screen still loading from looking like a
screen whose runtime is broken.

## Consequences

- **`AI Models` reads the runtime for *can this be operated*.** The literal
  `selectable={wired ? ["Groq"] : undefined}` is gone, and so is `chosen.stt &&
  chosen.llm` as the answer to what a connection does. The drawn table stays and
  is still what `port:diff` measures; it has stopped being a runtime claim.
- **A chip is not a job.** Picking a vendor asks whether the registry carries it
  at all — a vendor that listens and does not write is still a connection worth
  having. Which of its jobs can run is the job rows' question, answered one row
  at a time on the role that row needs.
- **The reason stops at the vendor and model rows.** A job row's other rows
  belong to its caller — on Translate they are the mode's own settings, with a
  config home since ADR 0041 — and a job whose model provider has no adapter has
  not stopped having a target language. Governing them from the provider answer
  would be this same conflation one axis over, and it was a real defect in the
  first implementation of this record: two settings that must write stopped
  writing.
- **The chip row is inert until the runtime answers.** It used to be live at
  first paint because the answer was a literal. A chip enabled before the
  runtime has said anything is the fake readiness the screen's own comment
  warns about, so the wait is correct and two existing cases now await it.
- **`Models.test.tsx` can no longer mock `capabilities: {}` and pass**, which is
  what ADR 0106 asked for. The empty block is still exercised, as its own case,
  where it must produce *the runtime answered without saying what it can do*.
- **The mirror may now be called a guard.** ADR 0106 forbade that until two
  tests existed. Both do: `providerSeam.test.ts` holds that a denied capability
  makes a row inert, and `types/providers.test.ts` reads `mod.rs` and
  `providers.ts` and compares the fields of `ProviderCapabilities`,
  `ModelCapabilities`, `RegisteredProvider` and `RoleCredentialStatus`. It was
  verified by being made to fail before it was trusted.
- **The ids for the eight unregistered vendors are predictions**, and are marked
  as such where they are written. `Azure OpenAI` is `azure_openai` rather than
  the `azure` used in prose, because ADR 0117 exists to keep Azure Speech and
  Azure OpenAI apart and an unqualified id is the ambiguity it prevents. A
  prediction that turns out wrong fails the third guard direction rather than
  going quiet.
- **This record does not move `data.ts`**, and the open disagreements in
  `docs/PROVIDERS.md` stay open. What changed is that the answer to *can this be
  operated* stopped being read off a table that was never a runtime claim.
