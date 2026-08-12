# 0126: The second adapter shares a transport and a store, and shares no policy at all

Date: 2026-08-12

Status: Accepted

## Context

D1 is the first adapter the provider registry was built for (ADR 0096 step 1).
Everything it needed already existed: ADR 0094 gave it three traits and a
registry line, ADR 0110 the model axis, ADR 0105 a credential per role, ADR 0106
the seam a surface reads to say why a row is inert, and ADR 0115 the catalogue
its model ids are rows in. The plan's own test of whether Stage A was complete
was whether this step had to change any of them. It did not.

What it did have to decide is where the line between the two cloud adapters
falls, and the tree pushed in two directions at once.

**In one direction, they are the same adapter.** ADR 0113 recorded the finding
in `groq.rs:25`: `GROQ_API_BASE` is `https://api.groq.com/openai/v1`, so the one
cloud lane WordScript shipped before this step was already the OpenAI shape with
a Groq host. Three paths (`/audio/transcriptions`, `/chat/completions`,
`/models`), a bearer token, a retry policy with a `Retry-After` cap and an
exponential fallback — none of it vendor-specific. The credential half was the
same story one file over: a keyring entry named `groq.{role}.{kind}`, a process
cache, a mask for the settings row, all of it identical except the id in front.

**In the other direction, they disagree in the one place that decides whether a
request succeeds.** OpenAI documents `response_format=verbose_json` and
`timestamp_granularities[]` for `whisper-1` alone; the `gpt-*-transcribe` family
refuses them
(`developers.openai.com/api/docs/guides/speech-to-text`, read 2026-08-12). Groq
answers `verbose_json` for everything it serves. A shared transport that carried
Groq's unconditional default would have made every request on OpenAI's newer
models a 400, and no test on the Groq side could have caught it.

The upload ceilings disagree too, and not only in the number: Groq's moves with
the account plan and declares two tiers, OpenAI publishes one 25 MB figure for
every account. The key prefixes disagree (`gsk_` against `sk-`). And OpenAI's
model list is the vendor's, changing on their schedule, where Groq's endpoint
decides the streaming answer for every id including ids it does not ship.

## Decision

**The transport and the credential store are shared. Every policy is per
vendor.**

`core::providers::openai_compatible` carries the client, `send_with_retries`,
the multipart transcription, the JSON chat completion, the `/models`
validation, the HTTP-status-to-error-kind mapping and the retry timing. It is
parameterized by base URL, credential and **vendor display name** — the last of
those because every error it produces is a sentence a user reads, and the first
question about a refused key is which vendor refused it.

`core::providers::credential_store` carries the `SecretStore` trait, the OS
implementation, the `(provider, role, kind)` entry name, the read/write/clear
trio, the process cache, the mask and the empty/prefix check. The entry names
did not move: `entry_user("groq", ...)` produces the string A3 stored under,
byte for byte, and a test asserts that literal rather than deriving it — because
changing one of these strings orphans every credential already in the developer's
keyring, and a refactor that claims to change nothing is exactly where that
happens unnoticed.

**What each adapter keeps:** which `response_format` a model answers, which
upload ceiling applies and whether it moves with a plan, which prefix a key
carries, which catalogue rows it operates, what its profiles are, and what its
models can do.

**And one policy the second adapter needed that the first did not: a model id
belonging to another lane is substituted, and one nobody catalogued is not.**
A profile that recognised on Groq holds `whisper-large-v3-turbo`; switching the
connection to OpenAI leaves that string in place, and sending it spends a
request to be told the model does not exist. So `openai.rs` asks the catalogue
*whose id is this* — not *do I know this id* — and substitutes its own default
only when the answer is another vendor. An id the catalogue has never seen is a
user's own typed override and passes through untouched, which ADR 0115 requires.
The two cases look alike and need opposite treatment, and asking the wrong
question would have broken one of them.

## Consequences

**D1a costs a base URL and a registry line**, which is what ADR 0113 predicted
and this step now makes true rather than argued: OpenRouter and the Self-hosted
lane call the same client with a different host.

**`ModelCapabilities` is non-vacuous for the first time.** Both registered lanes
answered identically for every model until now — Groq because its endpoint
decides, the local lane because it echoes the language it was told. OpenAI
answers `Supported` for `gpt-4o-transcribe` and `Unsupported` for `whisper-1` on
one key at one URL, which is the pair ADR 0110 was written from. The fixture in
`registry.rs` that stood in for this stays, and its comment now says why: it
asserts the registry carries the pair through at all, on an entry that owes
nothing to a real vendor's current model list.

**`whisper-1` is this lane's default profile, and not because it is the best
recogniser.** It is the only OpenAI model that returns `duration` and
`segments`, which are what `TranscriptionCoverage` reads to say *the recogniser
stopped before the audio did* — the instrument
[known-issues/transcript-stops-before-the-audio-does.md](../known-issues/transcript-stops-before-the-audio-does.md)
exists for. Choosing a newer model on this lane costs that check, and the
adapter records that in the runtime log rather than letting the verdict quietly
become `unknown`.

**A subscription is refused here with a different sentence than on Groq.**
ADR 0102 permits one for this vendor and one only, and D3 builds the flow that
acquires it. Groq's refusal says *it sells none*; this one says *the sign-in is
not built*. Two lanes, two true sentences, and neither is the other's.

**Six tests failed on the day this landed and every one was right to.** They
spelled `openai` as their example of a vendor the registry does not carry — in
`normalize_provider_value`, in `resolve_entry`, in `registered_providers`, in
`model_capabilities` and twice in `config.rs`. That made them assertions about
which vendors happened to be registered rather than about the fallback they were
testing, and a registry reaching ten entries would have retired the stand-in ten
times. They now name a synthetic id no adapter will ever claim. **A test whose
fixture is a real vendor's name has a half-life**, and the fix is not to move
the name to the next unregistered vendor.

**No dependency moved.** `reqwest`, `keyring`, `serde` and `tokio` were all
already carrying this lane; the second vendor is a module and a registry line,
which is what ADR 0094 promised and this is the first step that spent it.
