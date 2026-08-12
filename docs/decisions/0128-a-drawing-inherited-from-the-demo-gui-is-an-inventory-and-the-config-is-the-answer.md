# 0128: A drawing inherited from the demo GUI is an inventory, and the config is the answer

Date: 2026-08-12

Status: Accepted

## Context

`AI Models` was taken whole from the demo GUI in Leg 6 and has been coming alive
one control at a time since. Three steps in a row hit the same wall and each one
stepped around it rather than through:

- **B1** built the capability seam and recorded that it deliberately did not
  give a job row a config target.
- **D1** wired the connection, made a second lane operable, and left the per-job
  override select dead — because `data.ts` draws three jobs with an `override`
  literal that decides the row's **shape**, while A4 decided a fresh profile
  overrides nothing. ADR 0127 filed it as `docs/PROVIDERS.md` open disagreement
  13, the first entry on that list whose resolution blocks a control.
- Two further entries on the same list, 10 and 11, are drawn sentences that are
  simply **false**: the Self-hosted lane says *"Speech has no OpenAI-compatible
  shape to talk to"* on three rows, and `OpenRouter` is drawn `stt: false`. That
  document corrected its own half of both and the surface kept the wrong half.

Each of the three was recorded as *a drawing question, and the gallery owns it*
(ADR 0057). That reading was too strong, and it had begun to function as a rule
that nothing inherited from the prototype may ever be corrected. ADR 0057 says
the opposite in its own decision: **after Leg 2 the product wins over the
prototype, and a difference is either an ADR or a bug.** Leg 13 is open. The gate
was never *do not touch*; it was *write it down and account for the movement*.

The owner named what the drawing actually is, on 2026-08-12: the demo GUI was
drawn before anyone knew how these things would be implemented, so it could not
know how they should be represented. It is a picture of what the product intends
to offer, kept deliberately visible so that what is still missing stays visible
with it — *visual development*. It was never a claim about what works today.

## Decision

**A drawing inherited from the demo GUI is an inventory of intent. The config is
the answer about what is true.** Wiring a screen means four things, and the
fourth is the one that keeps the other three from being read as licence:

1. **What works is stated truthfully, and the source of truth is the config** —
   never a drawn literal. A literal that survives into a wired control is a
   surface claiming a state nothing stored.

2. **What does not work yet but will, stays visible and inert, carrying its
   reason.** It is not a transitional mess to be tidied away. Removing an
   unbuilt vendor from a list hides what the product still owes; that list is
   the instrument the build is steered by.

3. **What is a false statement is corrected.** *Self-hosted cannot hear* is not
   a missing feature described accurately — it is wrong, and it stays wrong
   until someone edits it.

4. **What is missing is added or consolidated.** The drawing could not
   anticipate the implementation, so it has no authority over a representation
   question that only became answerable once the runtime existed.

**The line between rule 2 and the fake-readiness rule is what is being claimed.**
Greyed with a sentence shows a *possibility* and is required. A green `Set`
badge asserts a *stored state* and is forbidden. `AI Models` was doing both.

**Where a drawn literal and the config disagree, the config answers in the
product and the literal answers in the gallery.** That is ADR 0127's own
arrangement for `ProviderPick` applied one axis over, and it is what makes rules
1 and 2 hold at the same time rather than trading against each other: the
gallery keeps the whole inventory, the product states only what is stored, and
`port:diff` — which compares the prototype against the **gallery** — does not
move for it.

## Consequences

**Open disagreement 13 is closed by the config.** `data.ts`'s `override`
literals stop deciding the row's shape in the product. A job renders the
override shape when `providers.overrides[job]` holds one and *Follow the
connection · X* when it does not, which at a fresh profile is every job. The
select writes through `buildProfileProvidersPatch`, and **the drawn literals
stay in `data.ts` untouched** — they are the gallery's, and under rule 2 they
are also the record of a product default nobody has committed to yet.

**Clearing an override deletes the key rather than storing the connection's id**
(ADR 0094 — the absence is the value). Storing it would freeze the job onto
today's connection, so the row would stop following one the user changes later.
Choosing the connection's own vendor in the select is treated the same way, for
the same reason.

**The provider select escapes its own row's inert reason, and nothing else
does.** A row inert because its vendor has no adapter or no key is a row whose
fix is *pick a different vendor* — and that control was disabled by the very
sentence explaining what to do. The reason still governs the model row and the
key row, which are choices *on* a vendor rather than choices *of* one. Without
this a stored override onto an unbuilt vendor would be unrecoverable from the
surface.

**A vendor with no adapter is offered in the select, disabled, carrying its
reason; a vendor merely missing a credential is not disabled.** That vendor is
integrated, correct about what it does and one action away from working —
ADR 0106's distinction, now load-bearing in a control rather than only in a
tooltip.

**The literal `Set` badge is gone** and `credentialStateFor` answers in three
values, because **`unknown` is not `missing`**. `registered_providers` reads no
keyring (ADR 0124), so an entry in that list says nothing about a key, and a
badge that resolved absence to either *set* or *not set* would be inventing one
of them. `unknown` reads *Not read*, the word this screen already uses where a
runtime did not answer.

**Open disagreements 10 and 11 are closed, and 11 moves `port:diff`.** The
Self-hosted refusal now names what is actually missing — the adapter, not the
endpoint shape — and `OpenRouter` is drawn `stt: true`. That boolean adds one
option to each of the three `stt` rows' provider list, and the screen moves from
`structural 6 | style 213 | text 12` to `structural 9 | style 217 | text 12`:
three nodes and the four widths the wider select produces. **The movement is the
correction itself**, measured by reverting the one boolean and watching the
count return exactly to the old figure. Under ADR 0057 this is the *ADR* half of
*either an ADR or a bug*.

**The Self-hosted sentences are corrected but the lane still cannot hear**, and
that is the point of rule 3 rather than an exception to it: the rows stay inert
and now give the true reason. D1a is unchanged in scope minus its drawing half,
which this record spends — and that ordering is ADR 0109's, which puts the row
before the adapter.

**What this does not touch:** the model axis, which still writes nowhere
(ADR 0042); `provider_tier`, still machine-wide (A4); and the three drawn lanes
that are not integrated, which keep ADR 0065's blanket sentence. It also does
not settle whether `upload` *should* default to OpenAI — it removes the surface's
claim that it already does. That remains a product question, and under rule 2 the
drawn literal is where it stays recorded until someone answers it.
