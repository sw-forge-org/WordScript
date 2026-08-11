# 0120: A vendor serves its model ids, and the catalogue keeps the columns no endpoint answers

Date: 2026-08-12
Status: Accepted (planning direction; not implemented). Amends the scope of
[ADR 0115](0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md)
without replacing it.

## Context

ADR 0115 moved model identity into one versioned, checked-in catalogue, curated
by re-reading each vendor's documentation and stamping every row with a source
and a read-date. **The owner raised the maintenance objection the day after it
was accepted:** eighteen vendors rename and deprecate on their own calendar, and
hand-curating that is stress for no gain. The proposal was to fetch model lists
from the vendors on every lane except Local, refreshed when the settings surface
is opened.

**The objection is right about volume and wrong about substitution.** A fetch
cannot replace the catalogue, because the endpoint does not serve the columns
the catalogue exists for. This repo already found that and wrote it down:

> Validation asks the vendor whether a key works, which is not a question about
> a role: `/models` is neither recognition nor completion.
>
> — `src-tauri/src/core/providers/groq.rs:774`

A catalogue row carries `(provider, role, model_id, documented streaming,
languages, source, read_date)`. An OpenAI-compatible `/models` response carries
**one** of them. It does not carry:

- **role** — whether `gpt-4o-mini-tts` is voice and `scribe_v2` is speech. The
  registry cannot dispatch without it, and ADR 0119's two Speaking rows would
  have nothing to fill themselves from.
- **streaming** — ADR 0110 put this on the model axis deliberately, because
  OpenRouter answers it per model. No listing endpoint returns it.
- **languages** — Deepgram's 60+, ElevenLabs' 32 against 29 against
  English-only across `eleven_flash_v2_5`, `eleven_multilingual_v2` and
  `eleven_flash_v2`. In no payload.

**Coverage is uneven, and one lane cannot have it by construction.** Groq,
OpenAI, Mistral, xAI, OpenRouter and Self-hosted expose the OpenAI-compatible
shape; ElevenLabs exposes its own. **Azure OpenAI exposes no model list at
all** — the deployment name *is* the model id, which `docs/PROVIDERS.md` states
directly and which is why the donor ships Azure with no list and every
enterprise row marked `allowCustomModelId: true`. Bedrock and Vertex need cloud
SDK credentials rather than a bearer token.

**And a fetch needs a credential, which inverts the order the surface is used
in.** Today the drawn lists stand *before* a key exists — that is how a user
decides whether to go get one. Under a pure fetch every unconfigured lane shows
an empty picker, and ADR 0105 makes the credential per `(provider, role, kind)`,
so a lane can be half-credentialed and half-empty.

## Decision

**Three layers, of which two were already decided.**

1. **The catalogue (ADR 0115) keeps the typed columns** — role, documented
   streaming, languages, source, read-date — for every model this build
   **routes to, defaults to, or makes a statement about**.
2. **A live fetch merges vendor ids on top of it**, where an endpoint exists,
   refreshed when the settings surface is opened rather than by a background
   poller.
3. **The free-typed model id stays on every lane**, which ADR 0115 already
   required and which is the only thing Azure, Bedrock and Vertex can use.

**The catalogue's scope shrinks and its schema does not change.** It stops being
*every id a vendor serves* and becomes *every id this build has a position on*.
That is the answer to the maintenance objection: the long tail arrives live, and
the curated set is bounded by what the product actually operates.

**A fetched id with no catalogue row answers `ModelSupport::Unknown`.** This is
exactly the state ADR 0115 created it for — catalogued-but-unadapted answers
`unknown`, and fetched-but-uncatalogued is the same gap one step further out. It
is offered as a selectable id; it is never presented as a capability.

**A failed or empty fetch falls back to the catalogue, never to an empty
picker.** Offline, rate-limited, and no-credential-yet are the three normal
states of this call, not exceptions, and each of them must leave the surface
showing what it showed before.

**The local lane is the precedent, and the whole precedent is adopted.**
`local_preview.rs` already fetches (`fetch_local_chat_models_blocking`),
reconciles the request against what came back (`resolve_local_chat_model`), and
falls back. Generalising the lane's behaviour means adopting the reconcile step,
not only the fetch.

**The fetch result is guarded against the surface that asked for it.** A list
that arrives after the user has moved to another lane is discarded and logged,
which is the discipline the session pipeline already holds itself to for late
provider results.

**The trap this must not fall into** is the one ADR 0106 named and ADR 0115
repeated: a fetched id is a vendor's inventory, not an adapter's promise.
Letting a `/models` entry imply that this build can operate it would make a
listing into a capability claim, which is the same defect as describing a mirror
as a guard.

## Consequences

- **B3 gets smaller, not different.** Its file format, loader and source/date
  test are unchanged; the number of rows it must carry at landing drops to the
  set the product routes.
- **A new step owns the fetch**, and it depends on B3 rather than replacing it —
  there has to be something to merge into.
- **Lanes without an endpoint are not a gap.** Azure, Bedrock and Vertex show
  the catalogue plus the typed field, which is what ADR 0115 already specified
  for them. Nothing about those rows changes.
- **`docs/PROVIDERS.md` open disagreement 5 stays answered by the catalogue.**
  The live layer sits above the answer; it does not become one.
- **This record does not make the fetch a release gate.** A lane ships operable
  on its catalogue rows alone, and the fetch improves it.
