# 0105: A credential is resolved per role, and a job never inherits one its role cannot use

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Closes a gap between
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md)
and
[ADR 0102](0102-a-subscription-is-a-second-way-to-pay-for-openai-text-and-openai-is-the-only-vendor-left-where-it-is-allowed.md).

## Context

Two records written the same day set rules that do not meet.

**ADR 0094 fixed the stored shape**: a resolved default plus a sparse override
per job, and one security rule -- *a job that overrides the provider takes its
own credential, it never inherits the default's*. That rule is stated for the
**overriding** job, which means its converse is the operating case: a job that
does not override **does** inherit the default's credential. That was correct
while a provider held exactly one credential.

**ADR 0102 broke that premise the same day.** A credential kind is per role, not
per provider: an account may hold an API key for recognition and a ChatGPT
subscription for chat, *"and that combination is ordinary rather than
exceptional."* The subscription is admissible for the five chat jobs and
inadmissible for `dictation`, `meetings`, `upload` and `voice`, because the
backend it reaches serves no recognition and no synthesis.

**So the case neither record covers is the ordinary one.** Set the Cloud
connection to OpenAI and pay by subscription. `dictation` follows the
connection -- it has no override, so ADR 0094's rule never fires -- and inherits
a credential that cannot serve its role. ADR 0094 says the resolver returns
*"both the provider and which credential answers for it -- never one without the
other."* Here nothing answers for it, and no record says what comes back.

**The drawing has nowhere to put the answer either.** `Models.tsx` shows the
`API key` row *only* on an overriding job (`Follows`, the `override && ...`
branch), and the Cloud connection card carries a single `API key` row. One
credential per connection is drawn, and ADR 0102 needs the connection to carry
a kind per role plus a sentence about what that kind can pay for.

## Decision

**"Follow the connection" follows the provider. It does not follow the
credential.**

The credential is resolved from the pair `(provider, role)`, always, for
overriding and following jobs alike. A provider holds a credential set rather
than a credential, and the resolver's answer is:

```
resolve(job) -> { provider, role, credential_kind, admissible }
```

- `provider` comes from the job's override, or from the connection when there is
  none. Unchanged from ADR 0094.
- `role` comes from the job. `dictation`, `meetings` and `upload` are
  `SpeechProvider`; the five chat jobs are `ChatProvider`; `voice` is
  `VoiceProvider` (ADR 0109).
- `credential_kind` is what that provider holds **for that role**, not what it
  holds for the connection's most-used role.
- `admissible` is a property of the kind against the role, decided in the type
  (ADR 0102), and never a runtime "unsupported" reply.

**A missing role credential makes the job inert, and the job says which
credential it is missing.** It does not fall back to the other kind the same
provider holds. That is the role-shaped version of the mistake ADR 0094's
security rule exists to prevent: there the wrong thing was a key reaching a host
it was never entered for, here it is a credential paying for a call the user
never agreed it would pay for. **Both are a credential used outside the scope it
was given in**, and the second is not softer for happening inside one vendor.

**Holding both kinds is not a conflict and needs no precedence rule invented for
it.** For the three speech jobs and `voice`, only a key is ever admissible, so
there is nothing to choose. For the five chat jobs both kinds are admissible,
and **the choice is the user's, drawn once on the connection rather than nine
times per job** -- which is the same argument ADR 0094 makes for the resolved
default. The API key remains the default when nothing has been chosen
(ADR 0102).

**A job that follows the connection can therefore become inert without the user
touching that job.** That is a real state and the surface has to carry it:
choosing a subscription on the connection is what makes `dictation` inert, so
**the sentence belongs on the connection, at the moment of choosing**, and the
job row states the consequence rather than announcing a surprise. A control that
silently stops working because of a choice made two cards up is the fake-state
defect with a longer fuse.

**The drawing this needs is a drawing, and it goes through the gallery first.**
This is where ADR 0096's first carried-over term needs reading precisely. That
rule forbids reshaping the UI *to accommodate an adapter* -- moving a field so a
vendor fits, rewording a hint so a mismatch stops showing. It does not freeze
the drawing against a capability the product decided to gain. A second
credential kind is new drawn vocabulary: it grows in the gallery, `npm run
port:diff` moves with it, and only then does the product surface change
(ADR 0057, ADR 0088). **ADR 0102's sentence about what the surface states is a
requirement on that drawing, not a licence to edit the product screen
directly.**

## What the donor's token store already solved

`donors/app/desktop-shells/openwhispr`'s `src/helpers/tokenStore.js` is 125
lines and carries three rules this record would otherwise have discovered inside
a refresh handler.

**A credential has a generation, and a write that does not know the current one
is refused.** `setIfGeneration(token, expectedGeneration)` returns
`AUTH_CONTEXT_CHANGED` rather than writing. That is the credential-shaped
version of `sessions::is_processing_session_current`: a refresh that started
before the user signed out, or before they replaced the key, **must not win the
race against the newer state**. ADR 0102's *"a 401 refreshes once and
re-persists"* is exactly the path that needs it -- the refresh completing after
a `clear()` would restore a credential the user revoked.

**Clearing bumps the generation even when nothing was cached**, with the reason
written at the site: an in-flight request from the previous credential era is
still a credential boundary. And when unlinking the file fails, they persist a
valid encrypted **empty** value instead, *"so the old bearer does not resurface
on restart"* -- a failed delete that leaves the old secret readable is worse
than a failed delete that leaves nothing readable.

**A credential change is published to listeners.** `subscribe()` exists for the
same reason ADR 0108 needs a config echo: more than one place holds a view of a
value with one holder. Credentials and settings are the same problem twice, and
whichever channel is built first should be shaped so the second can use it.

**And their secret storage degrades where ours will.** `secretCrypto.isAvailable()`
false means the token is written as plaintext at mode `0600` -- their
documentation states it plainly for Linux without a keyring. WordScript's
`SecretStore` faces the same platform, and **ten providers times a credential
per role is where a silent plaintext fallback stops being one file**. What that
degradation says on the surface is not decided here, but it stops being
theoretical at this scale.

## Consequences

- **`SaveProviderApiKeyRequest { provider, api_key }` is short by two fields.**
  It needs the role the credential is being stored for and the kind it is. The
  `SecretStore` entry stops being one string per provider and becomes one entry
  per `(provider, role, kind)`, which is also what self-hosted's base URL plus
  model id and the enterprise three's three shapes need (ADR 0102 already named
  that force; this record names the key it is stored under).
- **`clear_provider_api_key` inherits the same widening**, and clearing the
  chat credential must not clear the speech one on the same provider. A single
  provider-keyed delete is the bug this consequence exists to prevent.
- **The config migration ADR 0094 requires now has a second dimension.** One
  string per provider becomes a set keyed by role. `core::backup` is still the
  pattern and the snapshot path is still not optional.
- **`provider_status` answers per role or it answers nothing useful.** Today it
  returns one `credential` block. A surface that draws a key row for chat and a
  missing-key row for speech on the same provider cannot be fed by one block.
- **This record does not add a credential kind to any vendor but OpenAI.**
  ADR 0102's refusal stands exactly as written, and the per-role shape here is
  what the other nine providers need anyway for base URLs, regions and
  service-account JSON.
- **The token set needs a generation and the API key does not not need one.** A
  static string is replaced by a user action and nothing else; a refreshing
  token set is written by the runtime, concurrently with the user's ability to
  revoke it. The guard belongs on the credential that moves by itself.
- **Stale settings are a real resolver input, not a corrupt state.** The donor's
  `resolveChatRoute` has to rank an explicit self-hosted URL above *"a stale
  enterprise provider id left in settings"*, and it comments that it must never
  consult another scope's endpoint -- the same rule this record states, reached
  independently. A resolver over ten providers and nine jobs will read leftovers
  from every earlier configuration the user ever had, so **precedence between
  contradictory stored values is part of the resolver, not an error path.**
- **A self-hosted endpoint is checked before a credential is sent to it.** Their
  `isSecureEndpoint` admits `https:` **or** a private host, which is what lets a
  LAN server on plain HTTP work without licensing a token over the open
  internet. That is this record's own rule at the transport layer: a credential
  goes where it was entered for, and *where* includes the scheme.
