# 0166: A surface asks about the connection it is on, for the role it needs, and about nothing at all until it knows which

Date: 2026-08-16
Status: Accepted. Closes the leftover
[ADR 0165](0165-may-and-must-are-two-questions-and-the-lane-that-answers-them-differently-is-the-one-you-type-a-url-into.md)
named and did not fix, and finishes on the frontend what
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md)
decided for the runtime. Speech-track step D1c.

## Context

**D1b made the status strip name the connection and left the chip beside it
naming a different one.** That record said so in its own consequences: *the
credential chip beside that strip is still two-valued and is not fixed here:
`ProviderId` is `"groq" | "local"` and `useProvider` takes it, which is D1's
leftover and the GUI port's surface.*

The union is the frontend half of the closed dispatch `core::providers::registry`
replaced. `registry.rs` opens by saying so — *replaces the closed `ProviderId`
dispatch described in ADR 0094* — and the runtime has had five entries and an
open table since. This side kept two arms and one caller, and the caller had to
narrow:

```tsx
const selectedProvider =
  resolveJobProvider(profile, "dictation").provider === "local" ? "local" : "groq";
```

**A caller cannot narrow to a union with no arm for the value it holds**, so
this is what narrowing looks like when the type is wrong: every cloud vendor
folds onto `groq`. The chip then read the Groq key over an OpenAI connection —
since D1 made that connection selectable — and over a `Your server` connection,
which needs no key at all and reads *Needs key* about one.

**It also made the window derive one fact twice.** D1b added
`connectionProvider`, reading the stored id properly, for the strip's own
sentence; `selectedProvider` stayed above it for the chip. Two derivations of
*which vendor is this*, ten lines apart, rendering side by side on one line and
disagreeing — the shape ADR 0123 is about, with both copies visible at once.

Two more defects came out with it, and neither is a consequence of the union:

- **The fold answered a question about one role.** `ProviderStatus.credential`
  is conservative across every role the vendor serves (ADR 0105), and the strip
  asks *can I dictate*. On a vendor holding a speech key and no chat key, the
  fold says no to a machine that dictates perfectly well.
- **An outstanding read rendered as a warning.** `providerStatus?.credential
  .configured` is `undefined` before the answer arrives, so a window that had
  asked nobody anything yet printed *Needs key* out of its own latency.
  `providerSeam.ts` had already named this — `pending` refines, it does not
  retract — at a seam this file never used.

## Decision

**`ProviderId` is deleted rather than widened.** A `string` alias would be a
second name for `string`; every other id on this side is already one
(`ProviderStatus.provider`, `RegisteredProvider.provider`,
`resolveJobProvider().provider`, `laneForProviderId()`). `useProvider` takes a
`string`, and `DEFAULT_PROVIDER_ID` in `providerSeam.ts` mirrors the runtime's
constant so a caller with no config still has a name.

**What the union bought is bought better by the runtime.** A compile-time check
that an id exists is worth less than `registry::resolve_entry`'s answer, because
that answer is a sentence: *Provider 'anthropic' is not supported yet.* names
the connection the reader has to change. A `never` from `tsc` names nothing, and
the narrowing it forced was itself the defect.

**The window derives the connection once**, at the top, and both the strip's
fact and the chip's question read it. The model asked about follows the same
derivation: `local_model`, `self_hosted_model` or `model`, because asking about
the cloud model field over a lane that is sent a different id is the wrong id
one field away from the wrong vendor.

**The speech role answers, not the fold** (ADR 0105), and **what is missing is
the runtime's own sentence where the runtime has one.** `Your server` is why
this is a rule and not a preference: nothing there is missing that a key would
fix, and `LaneConfiguration::missing` already says whether it is a URL or a
model id, in a sentence written for a reader. A second copy of that reasoning
on the surface would be the fourth place deriving this lane's state — which is
exactly what D1b's `self_hosted_endpoint` block exists to prevent.

**Five answers, in this order:** a runtime refusal, then a read that has not
returned, then `local` off its disk probe, then a role the runtime answered
without, then the credential. The order is the argument — every earlier answer
is one the later ones would misreport.

**`null` means do not ask yet.** A caller that does not know who the connection
is passes `null` and gets the pending state, instead of spending a keyring read
on the default. The three credential doors take the same guard, because
`resolve_entry` reads an empty provider as the default and an unguarded save
would write somebody's key to `groq` because the config had not loaded.

## Consequences

- **`useProvider`'s parameter is the whole API change**, and no runtime file
  moves. `provider_status` already took a string; this side stops pretending it
  did not.
- **The strip is now correct for five connections and honest about a sixth.** A
  config naming an unregistered id reads *Needs attention* with the runtime's
  refusal as its tooltip, over a lane fact that still names what the config
  holds — the connection is real, and what cannot be done with it is the chip's
  sentence, not the fact's.
- **A keyring read per window launch is gone.** Every workspace opened with a
  `provider_status` for `groq` whose answer was discarded when the config
  arrived. One read, not ten, but it is the cost ADR 0124 refused at ten and it
  bought nothing.
- **THE LAST TWO WERE FOUND BY RENDERING THE WINDOW WITH A GREEN SUITE**, which
  is the seventh and eighth time on this surface (ADR 0160, 0161, 0162, 0164,
  and D1b's two). The suite could not see the keyring read at all until the
  mock stopped being a constant: `useProvider` was mocked as
  `() => ({ status: { credential: { configured: true } } })`, so *who was asked*
  was not a question any case could put. **A mock that ignores its arguments
  cannot hold a claim about arguments.**
- **`Onboarding.tsx` is reached for the first time, and only where it was
  false.** Its Self-hosted step said *A chat endpoint does not transcribe.
  Recognition needs the Cloud or Local lane; the writing jobs use your server* —
  inverted the moment D1a registered the lane `speech: Some, chat: None`, and
  sat behind a lane segment no test clicks while three records named the file as
  unreached. Its lane row now carries ADR 0161's tag, and the two rows ADR 0163
  named — `Bundled` and `CPU only · 32 GB RAM` — declare themselves, as their
  copies on AI Models have since ADR 0161.
- **The flow's fields still store nowhere, and that is still not this record's
  to fix.** ADR 0060 decided the lifecycle and left it to Phase 6; it also says
  what holds until then — *until a step reads the runtime it keeps the
  `PreviewBanner` the screen already carries*. When it is wired, the
  Self-hosted rows to render are `Models.tsx`'s, through the `useWired` split
  that file already has, exactly as this flow's Local branch already renders the
  settings screen's real `ModelList`. A second store for a URL that has one
  would be the defect D1b spent a step removing.
- **`port:diff` cannot see any of this either.** `onboarding` is `0 | 0 | 0` and
  `onboarding#2` is `0 | 0 | 0`, unmoved — **and unmoved because the harness
  measures the AI Models step on lane `Cloud`**, while every row this record
  touches is behind a lane segment it never clicks. `models` `26 | 248 | 20` and
  `models#1` `262 | 30 | 16`, both unmoved from D1b.
