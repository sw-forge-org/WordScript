# 0168: A plan row with nothing to choose is a statement, and the two reasons it can be empty are not one

Date: 2026-08-16
Status: Accepted. The surface half of
[ADR 0167](0167-a-plan-belongs-to-a-credential-so-it-is-keyed-by-the-vendor-that-sold-it.md).
Enforces what
[ADR 0038](0038-a-recording-the-app-permits-is-one-the-pipeline-can-finish.md)
decided when it declared the plans and the surface did not do. Applies
[ADR 0106](0106-the-drawn-matrix-states-an-intent-the-runtime-answers-a-capability-and-the-seam-between-them-is-not-built.md)'s
missing-field rule to one more command.

## Context

ADR 0038 declared account plans per provider and said what the surface owes
them: *the local lane offers none, and the settings surface renders the control
only where there is something to choose*. `Models.tsx` did not do that. It drew
a `Select` in every case, and the case decided only what went inside it:

| Vendor | Rendered | Wrong how |
| --- | --- | --- |
| Groq | two options | correct |
| OpenAI, OpenRouter | one option | a control that decides nothing |
| a vendor with no plans | `Reading the provider plans…`, disabled | **claims a read is in flight that already came back** |

The third is the serious one, and it is a fake state on a screen whose own
comment calls the chip row above it *the single worst place on the surface to
imply a provider works*.

**It was latent rather than live, and one adapter from being live.** Local and
Self-hosted draw their own rows and never reach this component, and a vendor the
registry does not carry cannot be the connection. But `selectableProviderNames`
asks only whether the registry *carries* a vendor, not whether it hears — so a
chat-only Anthropic adapter, which is the next vendor on the track, makes the
connection selectable and the plan row reads *Reading the provider plans…*
forever.

**And the command cannot tell the two apart.** `provider_tiers` answers `[]` for
a lane with nothing to sell and for a vendor with no adapter alike. That is the
conflation `capture_limits_if_known` was split for one axis over, in the same
module, with the reasoning already written down: *this lane is not bound by
request size* and *this build cannot answer for that vendor* are different
sentences to put under a greyed control.

## Decision

**The row has five states, and only one of them is a control.**

| State | Established by | Rendered |
| --- | --- | --- |
| not read yet | `registered === null` or tiers unanswered | `Reading the provider plans…`, disabled — as a transient |
| no speech here | `resolveProviderAnswer(…, "speech")` is inert | badge `No speech`, and why it matters here |
| no plans | tiers answered, empty | badge `No plans` |
| one ceiling | exactly one tier | the ceiling, stated |
| a choice | two or more | the `Select` |

**The third sentence comes from the registry, not from the command.** Absence
from `registered_providers` is how *no adapter* is stated (ADR 0124), so the
surface asks the question it can answer rather than reading a length that
answers two questions at once. `null` versus `[]` in the row's own state keeps
*not read yet* out of it, which claims nothing and must not replace a reason the
row already had.

**The three inert sentences share one badge and one branch.** The seam separates
*this vendor has no adapter at all*, *the vendor serves speech and this build
does not* and *the vendor does not do speech* — correctly, for the chip row and
the job rows. All three are the same answer to *which plan am I on*: there is no
speech here to bound. Collapsing them in the badge is not the conflation
ADR 0106 is about; a fourth spelling of them in this file would be.

**The reason is stated once, on the connection card.** Reprinting the seam's
sentence here put one fact on the screen twice a few pixels apart — the
furniture rule this file states about the credential badge, arriving through a
row that had every right to know the answer. This row says why the answer
matters here, which nothing else says.

**A single published ceiling is stated, not offered.** The number is not lost:
*Longest recording this lane accepts* states it one card down, resolved, which
is where it is spent.

## Consequences

**The statement is not a new element.** The Enterprise branch of the same file
already replaces an empty picker with a badge and the reason — *Speech · Azure
only*, *so the listening jobs say so instead of offering an empty picker*. The
badge text is deliberately **not** that branch's `No adapter`: that one is about
a lane nothing stands behind, this is about one vendor on a lane that works, and
both are visible on this screen at once.

**`port:diff` does not move, and that was measured rather than assumed.**
`models` and `contextintake` were measured with these changes reverted and with
them applied and read identically — `26 | 248 | 20` and `0 | 12 | 0`. The
mechanism is that the gallery renders screens with no runtime, so the drawn
branch of `CloudCredentialRows` is what the diff sees and this record does not
touch it.

**The `Context` intake stopped naming a plan.** Its drop zone read *up to 25 MiB
per file on your Free plan*, copied from the prototype: a plan and a ceiling both
named as constants, wrong on a dev-tier machine and wrong on every vendor that
is not Groq. The runtime answers it directly above with the file in hand
(ADR 0129), so the clause is a second copy of a fact rather than a helpful
repeat (ADR 0123). The formats stay — those are the intake's own and nothing
else states them.

**A stale plan id can now only arrive by hand.** The `value` fallback that reads
an unrecognised id as the vendor's default stays anyway, because a config file
is a thing people edit, and because it is what the runtime does.
