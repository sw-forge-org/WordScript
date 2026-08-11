# 0094: The provider contract is a trait with a registry, and the axis splits per role

Date: 2026-08-11
Status: Accepted (planning direction; not implemented)

## Context

`core/providers/mod.rs` dispatches on a closed enum:

```rust
enum ProviderId { Groq, LocalPreview }
fn resolve_provider_id(provider: &str) -> Result<ProviderId, ProviderCommandError>
```

Every capability -- `provider_status`, `save_provider_api_key`,
`clear_provider_api_key`, `validate_provider_api_key`, `transcribe_audio_file`,
`create_chat_completion`, `provider_tiers`, `capture_limits` -- is a top-level
function that matches on it. Two providers is two arms in eight functions and
costs nothing. **The drawn target is ten providers across four lanes plus a
local and a self-hosted one**, and that is eighty match arms nobody can read,
in eight places that must not drift apart.

The owner decided on 2026-08-11 to build the provider set out completely rather
than one at a time, which turns a tolerable shape into the thing that blocks
the work. `docs/PROVIDERS.md` is the capability survey that decision produced.

**The second half of this is older and has never been acted on.** Phase 4 has
carried the finding since it was written: a profile holds **one `provider`
field** and several models, one per role. Anthropic performs no speech
recognition at all; xAI's drawn entry carries speech and no chat; a self-hosted
OpenAI-compatible endpoint transcribes nothing. A single provider per profile
cannot express *recognize with Groq or locally, transform with something
stronger*. `ProviderCapabilities` already models the distinction --
`transcription` versus `chat_completion` -- and only the config conflates them.

## Decision

**Three traits and one registry, replacing the enum dispatch.**

- `SpeechProvider` -- recognition, and whatever shape it comes in.
- `ChatProvider` -- completions.
- `VoiceProvider` -- synthesis. It has no implementation today and exists in
  this record so the third role is not bolted on later as an exception.

A provider implements the traits it can serve and none of the ones it cannot.
The registry resolves an id to the implementations it registered. **Dispatch
stays static** -- no dynamic loading, no plugin surface, no configuration file
that names a Rust type. What changes is that adding a provider is a module plus
a registry entry rather than an edit in eight functions.

**A provider that does not serve a role does not stub it.** `Anthropic` does
not implement `SpeechProvider` and returns no "unsupported" error from a
speech call, because there is no speech call to make. The absence is in the
type, which is where the compiler can see it.

**`ProviderCapabilities` grows the axes the survey found**, and the UI reads
them rather than inferring:

- `transcription_streaming` -- partial results while the speaker is talking.
- `reports_detected_language` -- the recognition response names the language it
  heard, rather than echoing the one it was told.
- `speech_synthesis`, `synthesis_streaming`.

The struct is already mirrored into TypeScript (`src/types/providers.ts:54`) and
already travels: `provider_status` returns it and `AI Models` calls that command.
**It is not read.** No field of `status.capabilities` is consumed anywhere in
`src/`, `Models.test.tsx:26` mocks it as `{}` and the suite passes, and the
screen draws its capability answers from the hand-maintained `PROVIDERS` table
in `src/screens/data.ts` instead. **So the mirror is a precondition for a seam
and not a seam**, and building the one that makes a drawn row inert when the
runtime denies the role is a step of its own, before the first adapter --
[ADR 0106](0106-the-drawn-matrix-states-an-intent-the-runtime-answers-a-capability-and-the-seam-between-them-is-not-built.md).
This paragraph originally claimed the guard existed; the correction is recorded
rather than edited away, because a document asserting a capability the runtime
does not have is the failure this repo already has a scar from.

**The provider axis splits per role in the config.** A profile stops holding
one provider and starts holding a **resolved default plus a sparse override per
job**. Not a full provider/model pair per job: storing nine pairs and
reconstructing what "default" meant is how a settings surface loses the ability
to say *this follows the connection*. The shape ADR 0042 draws -- one lane,
provider and key that every job follows unless it says otherwise -- has to be
the shape the config stores.

**`OpenRouter` is the exception that proves the axes are per provider and not
per lane.** Its format and modality support varies by the model behind it, so
its capability answer is per model. A capability that is a constant everywhere
else is a lookup there, and the contract has to allow that rather than forcing
a lie in either direction.

**That paragraph is wrong and
[ADR 0110](0110-streaming-is-a-property-of-a-model-not-of-a-provider-and-openrouter-was-never-the-exception.md)
corrects it.** It is a constant nowhere. OpenAI serves `gpt-4o-transcribe`
(streams) and `whisper-1` (documented as not streaming) on one key and one
endpoint, and the donor's registry puts `streaming` on the **model** for exactly
that reason; the local lane repeats it with `runtime: "online"` on two of four
Parakeet models. **The role is the provider's and the shape is the model's** --
the trait split below is unaffected, but `transcription_streaming`,
`reports_detected_language` and `synthesis_streaming` belong on the model entry,
and only `speech_synthesis` stays a provider-level role question. `docs/PROVIDERS.md`
had the evidence for this before the axis was chosen, in its OpenAI section and
its sixth open disagreement.

**A job that overrides the provider takes its own credential. It never inherits
the default's.** An override changes the host a request goes to; a key
inherited across that change is a credential sent to a host it was never
entered for. This is the one rule in this record that is a security property
rather than an ergonomic one, and **both the drawing and the donor arrived at it
independently** -- `Models.tsx` shows an `API key` row *only* on an overriding
job, with the reason on the row (*"Its own, because this job is not on the
connection above"*), and `openwhispr`'s `reasoningRouting.js` has to compute the
same thing as `inheritsFallbackEndpoint`, whose comment reads: *"A scope
pointing somewhere of its own, or in another mode, would send that key to a host
it was never entered for."*

**The stored shape follows from that.** "Follow the connection" is a **value**,
not an absence: the drawn select carries `Follow the connection · Groq` as its
first option and an overriding row carries a `Use the default` button back. So
the config stores an explicit *unset* that resolves at read time, and the
resolver returns both the provider and which credential answers for it -- never
one without the other.

**The rule above is stated for the overriding job, and its converse is the case
that needed a second record.** A job that does *not* override inherits the
default's credential, which was correct while a provider held exactly one. ADR
0102 ended that the same day by making the credential kind per role, so a speech
job following an OpenAI connection paid by subscription would inherit a
credential its role cannot use.
[ADR 0105](0105-a-credential-is-resolved-per-role-and-a-job-never-inherits-one-its-role-cannot-use.md)
closes it: **"follow the connection" follows the provider and never the
credential**, the credential resolves from `(provider, role)` for overriding and
following jobs alike, and a missing role credential makes the job inert and says
which one is missing rather than borrowing the other kind.

## What the donor already built, and what it costs

`donors/app/desktop-shells/openwhispr` ships this shape in production, which
makes three things checkable rather than assumed.

**The registry is a frozen id→implementation map, and it is many-to-one.**
`PROVIDER_REGISTRY` has fourteen ids over ten implementations: `openai`,
`custom` and `openrouter` share one, and `bedrock`, `azure` and `vertex` share
another. **This is the single largest cost reduction available to the
build-out** -- an OpenAI-compatible Chat Completions shape absorbs a whole
column of the drawn matrix, and ADR 0096's adapter list should be read as ten
ids and rather fewer adapters.

**A registry entry receives a context rather than importing the world.** Their
`InferenceProvider` is one method, `call(params)`, and `ProviderContext` hands
it `getApiKey`, the prompt, the dictionary, the language and a shared
chat-completions caller. A provider module reaches nothing global. That is what
keeps ten adapters from becoming ten sets of assumptions about the app.

**But the compatible shape is not uniform, and the seams show.** They call
`.chat(model)` explicitly for `custom`, `openrouter`, `local` and `corti`
because those implement Chat Completions and not OpenAI's Responses API, and
OpenRouter's reasoning control is a top-level field their SDK cannot emit, so
they patch it in at the `fetch` boundary. **A trait that cannot carry a
per-provider quirk will be worked around rather than extended**, and these are
the two quirks already known.

**Their per-job shape is a named scope, and it is the part not to copy.**
`INFERENCE_SCOPES` names five jobs and maps each to **eight flat store keys** --
mode, provider, model, cloudMode, cloudBaseUrl, remoteUrl, customApiKey,
disableThinking -- so `dictationCleanup` reads `cleanupProvider`,
`cleanupModel`, `cleanupCloudMode` and five more. Five jobs times eight fields
is forty settings keys, and `buildReasoningScopePatches` exists to fan one
change back out across four of them. A `fallbackScope` softens it
(`noteFormatting` falls back to `dictationCleanup`), which is the same instinct
as *follow the connection* -- expressed as scope-to-scope inheritance rather
than as a resolved default.

**Nine jobs on that shape would be seventy-two keys.** The default-plus-sparse-
override in this record exists precisely to avoid that, and the donor is the
evidence for why: a flat key per job per field is writable but not readable, and
the fan-out helper is the smell.

**The enterprise lane is heavy, and they moved it.** Their comment prices it:
the AWS/Azure/Google SDKs are lazily required so startup does not eager-load
*~100 MB* for users who never pick an enterprise provider, and they live in the
main process because those SDKs need Node-only APIs. In Rust the weight is
compile-time rather than startup, which makes it a Cargo feature question rather
than a lazy-require one -- but the seam is the same one this product already
draws, and it lands on the side Rust already owns.

## Consequences

- **Adding a provider becomes one module and one registry line.** The eight
  top-level functions become thin resolvers over the registry, and no future
  provider touches them.
- **The compiler starts enforcing the role split.** A job routed to a provider
  that cannot serve it stops being a runtime error message and becomes a type
  error, which is the earliest place it can be caught.
- **The config change needs a migration and therefore a backup.** `core::backup`
  is the pattern; a config migration without a snapshot path is not written
  here.
- **`ProviderCapabilities` gaining fields is a contract change**, so
  `docs/spec/SPEC.md`'s provider section moves with it, and the TypeScript
  mirror is not optional. **The mirror is also not sufficient** -- ADR 0106 is
  the step that makes a surface read it.
- **`VoiceProvider` names a role whose job does not exist in the type.** `voice`
  is not in the eight-entry `JobKey` union, and ADR 0109 adds it as the ninth --
  which is what makes this trait, ADR 0102's inadmissibility rule and ADR 0105's
  per-role resolution all refer to something real.
- **This record does not decide which providers ship or in what order.** It
  decides the shape they land in. What ships is ADR 0096.
- **It also does not decide model names on surfaces.** `docs/PROVIDERS.md`
  records that the drawn `LANES` table is a model generation behind, and that
  the interesting question is where model names should live rather than which
  strings are current. That question is open and belongs to whoever reworks
  `AI Models`.
