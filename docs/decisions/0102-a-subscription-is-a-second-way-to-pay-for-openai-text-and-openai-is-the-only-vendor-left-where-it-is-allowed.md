# 0102: A subscription is a second way to pay for OpenAI text, and OpenAI is the only vendor left where it is allowed

Date: 2026-08-11
Status: Accepted (planning direction; not implemented)

## Context

The provider build-out plans ten providers across four lanes (ADR 0096,
`docs/PROVIDERS.md`), and every one of them is documented with a single way to
pay. The lane table says it plainly: Cloud is *"a vendor's own hosted API, one
account, one key"*, and the credential is a bearer token billed per request.
ADR 0002 fixed that as the strategy -- cloud-first, bring your own key.

The owner asked on 2026-08-11 whether an existing ChatGPT subscription can pay
for OpenAI instead, pointing at
[`EvanZhouDev/openai-oauth`](https://github.com/EvanZhouDev/openai-oauth)
(Apache-2.0), and whether the other vendors have an equivalent. Both halves of
that question have an answer, and the answers are not symmetrical.

**The proxy serves chat and nothing this product needs beyond it.** It exposes
`/v1/chat/completions`, `/v1/responses`, `/v1/models`, `/v1/images/generations`
and `/v1/images/edits`, against `https://chatgpt.com/backend-api/codex` -- the
backend the official Codex CLI talks to. There is **no
`/v1/audio/transcriptions` and no `/v1/audio/speech`**. Read 2026-08-11.

That single absence decides the scope. `docs/PROVIDERS.md` names OpenAI as the
one cloud vendor serving all three roles alone, but it serves them on
`api.openai.com`, on the key. The subscription reaches the chat models and stops
there. Of the nine jobs, it can pay for five -- `cleanup`, `rewrite`,
`translate`, `enhance`, `assistant` -- and none of `dictation`, `meetings`,
`upload` or `voice`. **The subscription cannot pay for the thing WordScript does
on every keystroke.** It pays for what happens to the text afterwards.

**The equivalents exist for two other vendors and both were shut off this
year.**

- **Anthropic** added an explicit authentication-and-credential clause to its
  terms on 2026-02-19, stating that OAuth tokens from Free, Pro and Max plans
  may not be used with third-party tools or the Agent SDK, and enforced it on
  2026-04-04. Third-party integrations must use API-key authentication.
- **Google** suspended accounts in February 2026 for routing Antigravity /
  Gemini CLI OAuth into third-party products, **including paying AI Ultra
  subscribers**.
- **Groq, Mistral, xAI and Deepgram sell no consumer subscription at all.** For
  them a bearer token is not the chosen shape, it is the only shape, and no
  equivalent is possible rather than merely absent.

OpenAI is the outlier in the other direction: it has worked with third-party
clients on Codex sign-in rather than against them. That is tolerance, not a
written grant. The proxy's own terms say subscription auth is licensed for
interactive Codex/ChatGPT usage, **not backend services**, and add *"do not
pool, share, or redistribute access tokens."*

The consequence of a policy change does not land on WordScript. It lands on the
account of the person using it, which is what the February suspensions
demonstrated.

## Decision

**A subscription is a second credential kind on the Cloud lane. It is not a
fifth lane and not a second provider.**

OpenAI stays one Cloud row that accepts either credential:

- **API key** -- bearer token, billed per request. The default, and it stays
  available. Nothing about ADR 0002 stops applying to it.
- **Subscription** -- an OAuth token set against the user's ChatGPT plan.

The lane says what a provider *is*. Billing is not a lane, and drawing it as one
would make the matrix answer a question it does not ask. `docs/PROVIDERS.md`
carries the distinction in the credential column, where the other three lanes
already carry theirs.

**The subscription credential is admissible for the five chat jobs only.**
`cleanup`, `rewrite`, `translate`, `enhance`, `assistant`. It is inadmissible
for `dictation`, `meetings` and `upload`, because those are `SpeechProvider`
(ADR 0094) and the upstream serves no recognition; and for `voice`, because it
serves no synthesis. Image generation is out of scope because WordScript has no
image job.

**This is a restriction in the type, not a runtime refusal.** It follows the
rule ADR 0094 set for roles and applies it to credentials: a subscription
credential does not satisfy `SpeechProvider`, so an OpenAI speech model is not
selectable while it is the active credential. There is no "unsupported" error to
return, because there is no call to make. A provider therefore carries a
credential kind **per role**, not one per provider -- an account may hold a key
for recognition and a subscription for chat at the same time, and that
combination is ordinary rather than exceptional.

**That breaks a premise ADR 0094 was written on, and the break needs its own
rule.** ADR 0094 states its credential rule for the *overriding* job, so a job
that follows the connection inherits the default's credential -- which was
correct while a provider held one. Set this connection to OpenAI and pay by
subscription and `dictation` inherits, without overriding anything, a credential
its role cannot use.
[ADR 0105](0105-a-credential-is-resolved-per-role-and-a-job-never-inherits-one-its-role-cannot-use.md)
closes it: **"follow the connection" follows the provider, never the
credential.** The credential resolves from `(provider, role)`, and a role with
no credential makes the job inert and names what is missing rather than
borrowing the other kind. **Choosing a subscription can therefore make a speech
job inert without the user touching that job**, which is why the sentence
belongs at the moment of choosing.

**No other vendor gets this, and the refusal is part of the record.** Not
Anthropic, not Gemini, not any lane that later grows a consumer plan, until a
vendor permits it in writing. This is not a deferral and a later reader must not
implement it as an oversight: the dates above are the derivation, and the cost
of being wrong is the user's account, not a failed request.

**Auth acquisition is a native Rust OAuth 2.0 flow with PKCE.** WordScript
implements the flow itself. It does not shell out to the Codex CLI, does not
read `~/.codex/auth.json`, and does not bundle the Node proxy -- a bundled
sidecar process would reverse ADR 0001, which put every runtime concern in Rust,
and ADR 0091, which removed the last sidecar.

- The browser is opened through the installed `tauri-plugin-opener`, the
  mechanism `About.tsx` already uses for external links.
- A loopback listener receives the redirect on
  `http://localhost:1455/auth/callback`.
- `code_challenge_method=S256`. Exchange and refresh run against
  `https://auth.openai.com/oauth/token` with the public client id
  `app_EMoamEEZ73f0CkXaXp7hrann`.
- Requests carry `Authorization: Bearer <access_token>`. A 401 refreshes once
  and re-persists before it surfaces as an error.

`openai-oauth` is the reference implementation of that flow and is cited as one.
**Nothing from it is vendored**, so ADR 0004 (AGPL-3.0) is untouched by its
Apache-2.0 licence.

**The token set is a secret and follows the rule ADR 0096 restated.** The OS
secret store through the `SecretStore` pattern `groq.rs` establishes;
`AppConfig::without_secrets()` scrubs before every disk write; nothing is
hardcoded and nothing is committed. The client id above is public by
construction -- it is what a PKCE public client is for -- and is not a secret.

**The surface states which credential is paying and what that risks.** The
credential row names the billing, names that the subscription reaches text jobs
only, and names that OpenAI licenses this for interactive use and may enforce
otherwise. The runtime-truth rule already requires the first two; the third is
required because the consequence is the user's, and a product that hides it is
deciding on their behalf.

**That is a requirement on a drawing, and the drawing goes first.** The Cloud
connection card carries exactly one `API key` row today, and `Models.tsx` shows
a per-job key row only where a job overrides. A credential kind, three
sentences about what it pays for, and a job row that can state *inert because
this credential does not serve this role* are new drawn vocabulary. **They grow
in the gallery, `npm run port:diff` moves with them, and the product surface
follows** (ADR 0057, ADR 0088). ADR 0096's *the UI does not change* forbids
reshaping a surface to accommodate an adapter; it does not license editing this
one directly either.

## Consequences

**A credential is no longer one string.** `SaveProviderApiKeyRequest { provider,
api_key: String }` carries a single opaque value, and a token set is four fields
with an expiry that moves. The command surface grows a credential kind and the
`SecretStore` entry stops being one string per provider. This is the second
force pushing the same way: `docs/PROVIDERS.md` already records that
self-hosted needs a base URL plus a model id, and that the enterprise three each
need something different again. **ADR 0094's registry has to carry credential
shape, not only role**, and that is now decided before the first adapter rather
than after. ADR 0105 names the key it is stored under: one entry per
`(provider, role, kind)`, so clearing a chat credential cannot clear the speech
one on the same provider.

**The repo has none of the OAuth machinery.** No PKCE, no loopback listener, no
`tauri-plugin-oauth`, no `tauri-plugin-deep-link`; `tauri-plugin-shell` is not a
dependency and `capabilities/default.json` grants only `dialog:default` and
`opener:default` among plugin scopes. This work adds a local HTTP listener
dependency and a capability entry. Both are named here so they arrive as a
decision rather than as a surprise inside a provider task.

**A loopback listener is an open port on the user's machine.** It binds
`127.0.0.1`, runs only while a login is in flight, and closes on completion or
timeout. The `state` parameter is verified before the code is exchanged. None of
that is optional and none of it is novel; it is written down because a listener
added casually is the kind of thing that stays open.

**The port is fixed and can be occupied.** `1455` is not chosen by WordScript --
it is what the registered redirect URI allows, so falling back to another port
is not available. A busy port is a real failure mode that needs a real message.

**This dates faster than the rest of the provider set.** A model id goes stale
on the vendor's schedule; a tolerated authentication path can end on a vendor's
announcement, as it did twice this year. The subscription lane must degrade to
the API key rather than to a broken product, and the two credentials existing
side by side is what makes that possible.

**It is a departure from ADR 0002 for one vendor and one role.** Bring-your-own
key remains the strategy, the default, and the only path for every other
provider and every speech job. What changes is that OpenAI's text jobs accept a
second form of payment.

**Nothing here is built.** The runtime integrates `groq` and `local_preview`,
dispatches on a closed enum, and knows one credential shape. This record states
where the subscription goes when the adapter is written, and the boundary it
must not cross.
