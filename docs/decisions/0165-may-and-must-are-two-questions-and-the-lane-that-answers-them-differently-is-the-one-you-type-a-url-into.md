# 0165: *May* and *must* are two questions, and the lane that answers them differently is the one you type a URL into

Date: 2026-08-16
Status: Accepted. Implements speech-track step D1b, finishing the lane
[ADR 0164](0164-a-vendor-can-be-half-adapted-and-the-registry-is-not-the-place-that-says-whether-the-vendor-can.md)
adapted and left unconfigurable. Reverses
[ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md)
rule 1 for exactly one lane, on that rule's own terms. Spends the open question
ADR 0164 left: *where a base URL and an optional token get stored.*

## Context

D1a built `core/providers/self_hosted.rs` — an OpenAI-compatible adapter for a
server somebody else operates — and left every way of configuring it a drawing.
`Models.tsx` drew a URL field, a reachability probe, a credential row and a
model-id badge, and all four were `DrawnField`s and `DrawnButton`s that store
nowhere. An endpoint reached the runtime through `WORDSCRIPT_SELF_HOSTED_BASE_URL`,
`_MODEL` and `_TOKEN` and through nothing else, so the lane stayed locked under
ADR 0067 rule 1 and `LockedLanes` said so in the product: **adapter built,
nowhere to type the endpoint**.

Two questions had to be answered before any of it could be built, and the second
one turned out to be about an invariant rather than about a lane.

### 1. Where the base URL and the model id live

They are settings, not secrets. A URL authenticates nothing and a model id
belongs to whoever runs the server, so neither goes near the OS secret store,
and neither is touched by `AppConfig::without_secrets`. What was genuinely open
is whether this lane gets a store of its own.

It does not. `AppConfig` already holds every other machine-wide setting this
installation has, including `local_model_dirs` — a folder list added by B8 on
exactly the argument that applies here: *the endpoint belongs to this
installation, not to the writing style that happens to use it.* A second store
would be a second lifetime, a second backup path and a second thing to remember
to scrub.

### 2. Where the optional token lives, and the invariant that made it hard

The token is a bearer credential, so `CLAUDE.md` puts it in the OS secret store
and nowhere else. The obstacle was a registry rule:

```rust
assert_eq!(
    entry.provider.capabilities().requires_api_key,
    kinds.contains(&CredentialKind::ApiKey),
);
```

`requires_api_key` and `credential_kinds` were held equal, on the reading that
they are *"the same claim from two directions"*. D1a hit that wall and chose the
honest side: `SELF_HOSTED_CREDENTIAL_KINDS` was left **empty**, because
declaring `ApiKey` would have made `requires_api_key` true for a lane whose
commonest server — `whisper-server` — issues no token at all.

**The equality was the thing that was wrong.** It held for as long as every
registered lane answered *may* and *must* the same way:

| Lane | May a credential be stored? | Must one be present to run? |
| --- | --- | --- |
| Groq, OpenAI, OpenRouter | yes | yes |
| Local | no | no |
| **Your server** | **yes** | **no** |

`whisper-server` takes no bearer token; speaches and LocalAI may. Under the
equality this lane has to pick a side, and **each side is a false statement
about the case it was built for**: declaring the kind makes the product demand a
credential that mostly does not exist, and leaving it empty makes the product
refuse to store one that sometimes does.

## Decision

**1. `AppConfig` gains `self_hosted_base_url` and `self_hosted_model`**, both
`#[serde(default)]`, both machine-wide, neither a secret. Additive: a config
written before this step reads them as empty and needs no migration.

**2. What is typed outranks the environment**, and this is deliberately the
reverse of `WORDSCRIPT_LOCAL_MODEL_DIR`, which outranks the folder list beside
it (ADR 0122). The reason is the field: a control that stores a value the
runtime then ignores is a control reporting a state the runtime never reached,
which is the defect ADR 0067 rule 1 exists to prevent. The three environment
variables stay as the door for a machine nobody has typed on — headless
installs, CI, an expert's shell, and every machine D1a left behind.

**3. The status says which door answered.** `ProviderStatus` gains
`self_hosted_endpoint`, a lane-specific block in the shape `local_setup` already
has: the effective URL, its source (`config` / `environment` / `unset`), why it
was refused if it was, and the same pair for the model id. It exists so the
surface never derives the precedence itself — *typed outranks environment* has
one implementation, in Rust, and a second one in TypeScript would print a URL
that is not the one in force the first time the order changed.

**4. `credential_kinds` and `requires_api_key` stop being one claim.** The
first answers *may*, the second answers *must*, and the registry holds them with
two assertions instead of one equality:

- a lane that **demands** an API key must **accept** one — the implication that
  was ever load-bearing, because a lane demanding a credential it accepts no
  kind for is a lane nobody can configure;
- a lane that accepts **no** kind must **store** nothing — asserted by calling
  its save door and requiring a refusal, which is a claim about behaviour rather
  than two booleans agreeing with each other. `local` is the lane it runs
  against.

`self_hosted` therefore declares `ApiKey` and keeps `requires_api_key: false`,
and its token goes to `self_hosted.speech.api_key` in the OS secret store —
the entry scheme, the masking and the cache A3 built, with no second door into
the keyring.

**5. `configured` still means *this lane can run a job*, and now that includes a
model id.** `resolve_model` refuses rather than guessing, so a reachable server
with no id cannot transcribe; reporting it ready would be readiness this build
cannot deliver. The optional token moves `configured` in neither direction.

**6. The lane never asks a server for segments.** `provider_capabilities` says
`supports_segments: false`, and `core::capture` asks every lane that is not
`local` for `verbose_json` — a whisper.cpp-and-OpenAI spelling that a server not
knowing it answers **400** to, which costs the whole dictation rather than the
segments. The adapter downgrades to `json` and logs that it did. The knowledge
is the lane's, so the enforcement is the lane's — and `core::capture` is under
another track's measurement, which is a second reason not to put it there.

**7. The model id reaches the request where every other lane's does.**
`NativeCaptureConfig::load_from_disk` already branches for `local`; it now
branches for `self_hosted` too. Without it the capture puts `speech.model` — a
catalogued **cloud** id — on a request to somebody's own server, and the 404
arrives as *your server rejected this* rather than as *WordScript sent the wrong
id*. The adapter keeps its own fallback for callers that are not the capture.

**8. The lane becomes a stored choice, and the screen follows what is stored.**
Picking `Your server` writes `providers.default = "self_hosted"` on the active
profile — the axis `ProviderPick` already writes — and the connection card
derives its lane from that value rather than holding lane state of its own. A
machine dictating through its own server that opened `AI Models` on the `Cloud`
card would be describing a connection the runtime is not using. The gallery has
no config, so there the segment keeps its own state and the drawings switch.

**9. ADR 0067 rule 1 is reversed for this lane and for no other.** The rule is
*a lane that is offered must be operable*; the lane is operable, so it is
offered. `LockedLanes` loses its `Your server` row — **a withheld row is only as
true as the reason it names**, and when the reason is spent the row does not get
a softer sentence. `Local` stays withheld behind ROADMAP Phase 5 and
`Enterprise` has no adapter, so the card carries two rows for two different
reasons.

## Consequences

- **A row that lasted one evening is the shape to remember.** B12 joined `Your
  server` and `Enterprise` because *neither has an adapter* covered both; D1a
  split them because half went false overnight; D1b deletes one because the
  other half is spent. Each edit was correct when written. What made them cheap
  is that the row count follows the **reasons** rather than the lanes.
- **Two sentences elsewhere in the product went false the moment the lane could
  be chosen, and both were found by rendering the workspace and reading it.**
  The `AI Models` banner said *the other three lanes … are drawn and inert*; the
  status strip along the bottom edge of every view said `Groq cloud · {model}`
  for **any** connection that is not `local` — so a machine on its own server
  read the wrong vendor over a model field that lane is not even sent. The strip
  had been wrong for OpenAI since D1 made that connection selectable, and this
  step is what made it visible. Both now read the stored connection.
- **The credential chip beside that strip is still two-valued and is not fixed
  here.** `ProviderId = "groq" | "local"` and `useProvider` take it, so the
  readiness chip probes Groq's key while connected to anything else. That is
  D1's leftover and the GUI port's surface; the strip's own sentence is what
  this step owed and what it paid.
- **`npm run port:diff` cannot see any of this, and the number it prints with no
  arguments is worse than that.** The gallery opens on lane `Cloud` and has no
  runtime to derive a lane from, so every wired row here is unreachable by the
  harness — B8's known cost (ADR 0159), held by tests instead. And **the harness
  measures the screens named on its command line**: run bare, it walks nothing
  and prints `ALL EXACT`, which is a green light for free. The measured numbers
  are `models` `26 | 248 | 20` and `models#1` `262 | 30 | 16`, unmoved from D1a.
- **The drawn per-job `Model id` field on this lane is replaced in the product
  by the id the connection holds.** Nothing stores a per-job model here and the
  capture sends one id; a field that accepts a value the runtime will not read
  is the same false affordance one row down. The drawing stays in the gallery.
- **`Onboarding.tsx` is still not reached**, exactly as ADR 0163 and ADR 0164
  each recorded. Its Self-hosted step draws the same URL and token fields over
  no runtime, and it is now the only place in the product where those fields
  store nowhere — one unit of work for whoever wires that flow.
- **A third OpenAI-compatible vendor still costs a base URL and a registry
  block**, and a *user-typed* endpoint now costs nothing further: the config
  fields, the precedence, the status block and the security check are the lane's
  and are reusable by whatever needs a typed host next.
