# 0065: Groq is the only integrated lane, and every other one stays drawn and disabled

Date: 2026-08-10
Status: Accepted

## Context

`AI Models` draws four provider lanes — Cloud, Local, Self-hosted, Enterprise —
each with its own credential shape, its own eight jobs and its own model names.
Leg 2c recorded the gap in one line: **the lane vocabulary is four values and
the runtime has two.** Cloud (`groq`) and Local (`local_preview`) exist;
Self-hosted and Enterprise are drawn in full and are vocabulary the runtime does
not carry at all. The "On this machine" tab — download, progress with cancel,
remove, a disk total — is the largest single block of runtime the whole port has
drawn, and its donor hook has no equivalent here.

That leaves whoever wires this screen with three bad options and one good one.
Wiring all four lanes is inventing three providers. Wiring only Cloud and
leaving the rest looking settable is the fake-readiness defect rule 7 forbids,
at the place where getting it wrong costs a user their API key. Deleting the
three lanes would make the largest ported screen disagree with the gallery it
was measured against, and ADR 0057 puts the gallery, not the implementer, in
charge of what a screen looks like.

Decided by the owner on 2026-08-10, against Leg 4b's report that AI Models is
the largest remaining wiring job.

## Decision

**Groq is the only provider WordScript integrates. Every other lane keeps its
drawing and is disabled — greyed out, or carrying the `preview` badge the
surface already uses elsewhere.**

Three parts, and the third is the one that is easy to get wrong:

1. **The UI does not change.** No lane, row, job, tab or credential field is
   deleted, moved or reworded. The screen a reader compares against the gallery
   is the screen the gallery draws. What changes is only whether a control can
   be operated.
2. **The Cloud lane is wired for real** — `provider_status`,
   `save_provider_api_key`, `clear_provider_api_key`,
   `validate_provider_api_key`, `resolve_provider_tiers`,
   `resolve_capture_budget`.
3. **Everything else is inert and says so.** Not silently inert: a disabled
   control with no explanation is the same defect one step quieter. The existing
   vocabulary carries this already — `Button`'s `disabled`, `StatusBadge`'s
   `plan` tone, and the `preview` tag the nav rows use — so nothing new is drawn
   to express it.

**This is a scope decision, not a capability claim.** It does not say the other
lanes are impossible or unwanted; it says exactly one is integrated today and
the surface stops implying otherwise.

## The open point, and it is deliberately open

**`local_preview` exists in the runtime and the shell already reads it.**
`AppConfig.provider` takes it, `useProvider` resolves its `local_setup`
readiness, `WorkspaceWindow`'s status strip states `Local runtime · <model>` as
one of its two lanes, and General's and Diagnostics' rows read it. So "only
Groq" is a statement about what the PRODUCT offers, and the runtime is one step
ahead of it.

Which of the two that means is not settled here:

- the Local lane is disabled on `AI Models` while the runtime keeps supporting
  `local_preview` for anyone who sets it another way, or
- `local_preview` is disabled everywhere, including the status strip.

**Nothing may be greyed out on the strength of a guess between those two.**
Whoever wires `AI Models` asks first. Recording the question here rather than
answering it is the same discipline ADR 0064 applied to its own two open points:
an implementation must not settle them quietly.

## Consequences

- **`AI Models` can be wired without waiting for three providers.** It was the
  largest remaining screen and most of what made it large is now out of scope.
- **It does not lose its banner.** A screen with three disabled lanes and an
  unbuilt "On this machine" tab is a partial wiring, and a partial wiring keeps
  the statement that it is one (rule 7). Its gallery entry stays with it, which
  `registry.test.tsx` enforces either way.
- **Onboarding reads the same `LANES` table** and renders the same provider
  picker and the same model row (Leg 2c). Whatever disables a lane here has to
  reach that screen when it is built, or the two will disagree about what can be
  chosen.
- **The §2.5 list keeps every entry it already carries about this screen** —
  the four-value lane vocabulary, local model installation, `Measured TTFB`,
  the derived recording ceiling. They are deferred rather than answered.
- **`preview_prompt_enhance`, the agent model rows and the desk's own model**
  are Phase 8 and untouched by this: they are already stated as Phase 8 on the
  surface.
