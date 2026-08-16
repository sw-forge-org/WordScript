# 0164: A vendor can be half-adapted, and the registry is not the place that says whether the vendor can

Date: 2026-08-16
Status: Accepted. Implements
[ADR 0113](0113-the-openai-compatible-audio-shape-is-already-in-the-tree-and-it-reaches-two-more-lanes-for-a-base-url.md)
as speech-track step D1a, on the helper
[ADR 0129](0129-the-provider-choice-belongs-where-the-file-is-and-it-is-the-same-stored-value.md)'s
step D1 extracted. Corrects one sentence
[ADR 0163](0163-a-withheld-lane-states-what-the-product-owes-and-separately-what-this-disk-already-has.md)
wrote the day before, and one derivation
[ADR 0106](0106-the-drawn-matrix-states-an-intent-the-runtime-answers-a-capability-and-the-seam-between-them-is-not-built.md)
wrote when it could not yet be wrong.

## Context

ADR 0113 priced two more speech lanes at a base URL each and named the four
things that do not travel with the shared shape: the ceiling, the timeout, the
model list and the credential. D1 extracted the helper. This step is the two
callers, and almost all of it went exactly as that record said it would.

**What the record did not predict is what the second caller does to the screen.**
Three facts came out of building it, and none of them is about a base URL.

### 1. `role_denied` was a sentence about the vendor, derived from a fact about this build

`src/lib/providerSeam.ts` has answered four questions since ADR 0106: *no
adapter*, *the lane denies the role*, *no credential*, *not answered*. The
second was derived from `ProviderCapabilities`, which the registry holds to
`entry.chat.is_some()` — so the sentence it printed,

> `OpenRouter does not do chat completion — this job stays on a provider that
> can.`

is a claim about the vendor built from a fact about WordScript.

**Until D1a the two could not come apart.** Groq, OpenAI and Local each register
every role their drawn row claims, so *this build cannot* and *the vendor
cannot* were the same list. OpenRouter separates them: `data.ts` draws it
`llm: true`, `docs/PROVIDERS.md` documents `/api/v1/chat/completions`, ADR 0113
leaves the chat role to G3, and the entry therefore registers `speech` alone.
The first person to pick OpenRouter as their Cloud connection would have read
five job rows telling them a falsehood about a vendor whose own documentation is
one click away.

**Both halves of the answer were already in the tree.** The drawn `stt` and
`llm` booleans are what the vendor does — ADR 0128 corrected OpenRouter's `stt`
on exactly that evidence — and the capability block is what this build can
operate. What was missing is that `no_adapter` could only be said about a whole
vendor, because absence from the registry was the only way the runtime had to
state it.

### 2. A test asked for both roles while its name said *every role it serves*

`core::model_catalogue`'s
`every_registered_vendor_carries_a_row_for_every_role_it_serves` looped over a
literal `[Speech, Chat]`. For as long as every registered vendor served both,
that loop and its name meant the same thing. Against an entry that registers one
role it demands a catalogue row for a role nothing can dispatch — and the way to
make it pass would have been to catalogue models to please a test.

### 3. One sentence on the connection card became false

ADR 0163 shipped the previous evening with `Your server` and `Enterprise` on one
row under *"Neither has an adapter yet"*. It was true when it was written. This
step builds the self-hosted speech adapter and makes exactly half of it false —
on the card that ADR 0160, 0161, 0162 and 0163 each corrected, three of those
found by looking at the rendered screen after the suite was green.

**And the honest successor is not *now selectable*.** The URL, the token and the
model id drawn on that lane are `DrawnField`s that store nowhere. The adapter
exists; nothing that could configure it does.

## Decision

**1. `no_adapter` is answerable per role, and the drawing is what decides which
answer applies.**

| The drawing says the vendor serves the role | The registry registers it | Answer |
| --- | --- | --- |
| yes | yes | operable, subject to the credential |
| yes | **no** | **`no_adapter`** — *WordScript has no {role} adapter for {vendor} yet* |
| no | no | `role_denied` — *{vendor} does not do {role}* |

`voice` keeps the denial unconditionally: the drawn matrix has two columns and
neither claims a vendor synthesises, so there is no drawn assertion to
contradict. F1 is the step that gives that role a row.

**And the runtime says its own half, because it has one.** `registry::role_unavailable`
read *"Provider 'x' does not perform y"* — the same false shape, one layer down,
and **not merely a log line**: `transform.rs` turns a failed correction into a
warning carrying that message and returns the uncorrected transcript, so it is
read by whoever picked the connection. It cannot apply the rule above, because
the drawn booleans are the frontend's and ADR 0106 keeps the drawing on one side
of the seam. So it states the half it can prove from where it stands:
**WordScript has no {role} adapter for '{provider}'.** True whichever the
vendor's own answer would have been, which is what makes it safe to say without
the drawing. *Found after this step's first commit, by asking what a user who
actually selects OpenRouter reads* — the surface had been fixed and the runtime
still carried the sentence.

**2. OpenRouter registers `speech` and not `chat`, and Self-hosted the same.**
ADR 0113 said the chat role stays in G3 and this record does not move it. The
absence is a `None` in the entry, which is the only way ADR 0094's registry
states a role that has no implementation.

**3. A credential is refused for a role the entry does not register**, with the
reason named. On every previous vendor the case was unreachable. It is reachable
now, and *store a chat key and hope the writing jobs follow* has to be answered
where the key would be written rather than at the first failed job.

**4. The Self-hosted lane is configured by environment and stays locked.**
`WORDSCRIPT_SELF_HOSTED_BASE_URL`, `_MODEL` and `_TOKEN` — the shape
`local.rs` has used since before B5 gave the local lane a surface. The lane
remains `disabled` under ADR 0067 rule 1, because a lane that is offered must be
operable and one whose endpoint cannot be typed on the screen offering it is
not. **Reversing that lock is the commit that wires the configuration**, and it
is not this one.

**5. `isSecureEndpoint` is ported whole rather than approximated.** HTTPS **or**
a private host, with the donor's dotted-quad parser — four decimal octets, no
leading zeros, nothing above 255. A `starts_with("10.")` check admits
`10.example.com`, which is a public DNS name that would then skip the HTTPS
requirement and carry a bearer token in clear. The check lives on one door
(`resolve_endpoint`), so there is exactly one place a typed URL becomes usable.

**6. The Self-hosted lane catalogues nothing, substitutes nothing, and bounds
nothing.**

- **No catalogue rows** — the model list belongs to whoever runs the server
  (ADR 0115 already says so in prose).
- **No default model** — every other adapter substitutes its own id when handed
  another lane's; here a request that names no model is *refused with the door
  named*, because a server serving one model under an operator's own name is the
  ordinary case and a guess would be wrong more often than right.
- **`ProviderCaptureLimits::unbounded()`** — lending it Groq's 25 MiB would put
  a ceiling on the surface that no server behind that URL agreed to.

**7. `credential_kinds` is empty for that lane.** The token is optional —
`whisper-server` issues none — and `requires_api_key` is a boolean the registry
holds to the kinds list. A lane demanding a credential the commonest server
behind it does not have is a lane refusing the case it was built for. So the
optional token rides the environment with the URL it belongs to, and the empty
list states what is true: **WordScript stores no credential for this lane.**

**8. `LockedLanes` splits into three rows, one per reason.**

| Row | Badge | The reason |
| --- | --- | --- |
| `Local` | `Ready` / `n of 3 ready` / `Not read` | built, installable, withheld by Phase 5 |
| `Your server` | `No configuration` | **adapter built, nowhere to type the endpoint** |
| `Enterprise` | `No adapter` | nothing behind it at all |

The row count follows the reasons, not the lanes. ADR 0163 joined two lanes
because one sentence covered both; this step un-joins them for the same reason.

**9. The drawn Self-hosted listening jobs take the typed field.** `dictation`,
`meetings` and `upload` carried a `none:` sentence naming D1a by name. They now
carry `typed on the endpoint`, which is the shape the five writing jobs on that
lane have had since Leg 6 — and the *not configurable* fact goes on the
connection card rather than onto eight job rows, because this screen has grown a
second copy of one fact four times and the second copy is always what drifts.

## Consequences

- **`docs/PROVIDERS.md` open disagreement 10 is closed by the commit that
  implements it**, as ADR 0113 required. Disagreement 11 was closed by B6 under
  ADR 0128 and is unaffected.
- **A third OpenAI-compatible vendor now costs a base URL and a registry
  block.** That was ADR 0113's claim and this is where it becomes checkable:
  `openrouter.rs` holds a base URL, a ceiling, a timeout, a model list and a
  credential, and no transport at all.
- **The `role_denied` rule generalises to every partial adapter that follows.**
  G3's list is nine more, several of them chat-only or speech-only, and each one
  registers fewer roles than some drawn row claims. They all get the corrected
  sentence without further work.
- **Two existing tests changed their example rather than their assertion**, and
  that is worth noticing: `providerSeam.test.ts` demonstrated *role denied* and
  *language only* on a hypothetical Groq whose runtime contradicted its own
  drawn row. Under this rule that hypothetical is `no_adapter`, correctly. The
  cases now use Anthropic, which is drawn `stt: false` and means it.
- **The coverage instrument cannot answer on either new lane, and both say so in
  the log on every request** rather than on an exceptional one.
  `TranscriptionCoverage` reads `duration` and `segments`, which only
  `verbose_json` carries; OpenRouter documents no id that answers it and a
  user's own server is unknown. A silent `unknown` verdict reads as a healthy
  transcript, which is the failure
  `known-issues/transcript-stops-before-the-audio-does.md` exists for.
- **OpenRouter's 60-second upstream timeout is in the ceiling's sentence and not
  in `realtime_factor`.** That field means seconds of decode per second of
  audio — a compute bound, which is the local lane's shape. This is a wall clock
  on the whole request that no file size predicts, and `docs/PROVIDERS.md` is
  right that a meeting does not fit through this door: it is the timeout that
  shuts it, not the 25 MB.
- **The 25 MB is read as decimal and the reasoning is recorded**, because the
  vendor does not disambiguate the unit and Groq and OpenAI both publish MiB.
  Decimal is the smaller of the two readings; being wrong towards smaller costs
  a sentence, being wrong the other way costs the upload.
- **No key prefix is checked for OpenRouter.** `gsk_` and `sk-` are recorded in
  this repo against vendor pages; nothing here has read one for this vendor, and
  a prefix invented from memory refuses valid keys. A wrong-vendor key fails on
  the first `/models` call with the vendor's own 401, which is a sentence a user
  can act on.
- **`/v1/audio/speech` on a user's own server is still not claimed**, exactly as
  ADR 0113 scoped it. Some of these servers answer it; the coverage was not
  surveyed, and an empty cell would otherwise read as a no.
- **`Onboarding.tsx` is again deliberately not reached.** Its Self-hosted step
  draws the same URL and token fields and is an entry-point hole wired to no
  runtime — the same disposition ADR 0163 recorded, for the same reason, and one
  unit of work for whoever wires that flow.
