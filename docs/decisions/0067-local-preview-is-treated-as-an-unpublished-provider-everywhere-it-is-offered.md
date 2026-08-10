# 0067: `local_preview` is treated as an unpublished provider everywhere it is offered

Date: 2026-08-10
Status: Accepted

## Context

[ADR 0065](0065-groq-is-the-only-integrated-lane-and-every-other-one-stays-drawn-and-disabled.md)
decided that Groq is the only integrated lane and left exactly one point open,
deliberately and in writing:

> `local_preview` exists in the runtime and the shell already reads it.
> `AppConfig.provider` takes it, `useProvider` resolves its `local_setup`
> readiness, `WorkspaceWindow`'s status strip states `Local runtime · <model>`
> as one of its two lanes, and General's and Diagnostics' rows read it. So
> "only Groq" is a statement about what the PRODUCT offers, and the runtime is
> one step ahead of it.

Two readings were possible: disable the Local lane on `AI Models` only, or
disable `local_preview` everywhere including the status strip. The ADR forbade
guessing between them and required whoever wired `AI Models` to ask.

Asked on 2026-08-10, at the start of Leg 4c, before anything was greyed out.

## Decision

**Owner, in his own words:** *treat it just like the other unpublished AI model
providers everywhere they come up: preview badge, etc. — because it's not fully
implemented yet.*

So the governing property is **consistency, not location**. `local_preview` is
not a special case that survives on some surfaces because the runtime happens to
carry it; it is one of the unpublished providers and it is presented as one
wherever it appears. What that means depends on what the surface is doing with
it, and the distinction is the whole content of this ADR:

1. **A surface that OFFERS a lane or a provider makes it inoperable.** The lane
   segment on `AI Models` disables Local exactly as it disables Self-hosted and
   Enterprise, and the Cloud provider chip row offers only Groq. A control that
   accepts a click and then asks for a credential is the worst possible place
   for a false affordance.
2. **A surface that REPORTS what the runtime is running states it, and marks
   it.** The workspace status strip reads `local_preview` if that is what the
   config says, because hiding the lane that is actually running would be the
   lie rather than the fix — it now reads `Local runtime · <model> · preview`.
3. **A diagnostic prints the runtime identifier unchanged.** Diagnostics states
   `provider / model` as the runtime holds it. A diagnostic that prettifies a
   value is a diagnostic that cannot be used to diagnose anything, and nobody
   reading it is being offered a purchase.

**This does not remove `local_preview` from the runtime.** No Rust changes, no
config migration, no refusal to load a config that names it. A user who sets it
another way still gets the local lane, and every surface still tells them the
truth about what is running. What goes away is the product offering it as
though it were finished.

## Consequences

- **`AI Models` can be wired without a second question.** Three of four lanes
  are inert for one stated reason instead of two lanes for one reason and one
  lane for an unresolved one.
- **Onboarding inherits it.** ADR 0065 already noted that Onboarding renders the
  same `LANES` table and the same provider picker; whatever disables a lane has
  to reach that screen when it is built. `ProviderChips` grew a `selectable`
  list rather than a per-screen rule, so it does.
- **The status strip gains a word and loses nothing.** Its three facts are still
  read rather than asserted.
- **The §2.5 entries about the local lane are unchanged.** Local model
  installation, the "On this machine" tab and `Measured TTFB` are still deferred
  contracts, not answered ones. This ADR is about presentation.
- **It expires by being reversed, not by drifting.** When the local lane is
  finished, `selectable` grows a name and the strip drops a word, in the commit
  that finishes it.
