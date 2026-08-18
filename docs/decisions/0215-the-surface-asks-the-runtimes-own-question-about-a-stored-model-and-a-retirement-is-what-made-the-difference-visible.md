# 0215 — The surface asks the runtime's own question about a stored model, and a retirement is what made the difference visible

Date: 2026-08-17
Status: accepted
Track: Speech (B15 follow-up)

## Context

ADR 0211 put a model on the same key as the account and gave the runtime one
door onto it: `JobProvider::named_model`. That method answers *may this id be
sent*, and its rule has two halves that ADR 0115 requires be kept apart:

- an id the catalogue attributes to **another vendor** is refused — it is a
  leftover from an account change, and sending it either spends a request to be
  told the model does not exist or gets silently swapped by the adapter;
- an id the catalogue **has never seen** passes — it is a typed override, a
  vendor's newest model, or the id somebody's own server answers to, and
  refusing it would make this build's read-date the limit of what the product
  can run.

The surface asked a third question instead, in two places and neither of them
this one. `JobBadge` in `Models.tsx` and the model select in
`jobProvider.tsx` each asked *is this id among the vendor's catalogue rows*:

```ts
const named = resolved.model && (!offered.length || offered.includes(resolved.model))
  ? resolved.model : "";                      // Models.tsx
const stale = Boolean(resolved.model) && offered.length > 0
  && !offered.includes(resolved.model);       // jobProvider.tsx
```

That is stricter than the runtime's rule on exactly the case ADR 0115 exists
for. A stored id the catalogue does not carry drew as *Follow the profile ·
{the profile's slot}* while the request carried the stored id — the surface
naming one model and the request carrying another, which is the defect ADR 0067
is about and the one ADR 0211 was written to end, arriving from the direction
nobody was watching.

**It was latent until a vendor retired a model.** ADR 0214 removed three Groq
ids from the catalogue on 2026-08-17. A retired id is, by construction, one the
catalogue no longer carries — so every config storing one moved from *catalogued
and correct* to *invisible to the surface and still on the wire* in a single
data change. The same commit's own record names this: *a config that already
stores a retired id keeps sending it*. What it did not name is that the surface
had also stopped being able to show it.

Two smaller things travel with the same rule. The two copies could disagree with
each other as well as with the runtime, which is ADR 0123's *one list per fact*
broken across two files. And a `<select>` whose `value` matches none of its
options renders as the first one, so a row carrying a typed override would
silently re-point itself the moment the reader touched anything else on it.

## Decision

**The surface asks the runtime's question, through one function, and that
function is a mirror rather than a re-derivation.**

`namedModel(resolved, role)` in `src/lib/textProfiles.ts` mirrors
`JobProvider::named_model` line for line: empty or vendorless answers
`undefined`, an id the catalogue attributes to another vendor answers
`undefined`, and everything else — including every id the catalogue has never
seen — answers the id. `providerForModelId` in `modelCatalogue.ts` is the
mirror of `core::model_catalogue::provider_for_model_id` it asks through.

**A second function names the half the surface has a sentence for.**
`foreignModel` is true only where the catalogue attributes the id to a different
vendor. The two states `namedModel` folds together are *nothing was named* and
*what was named belongs to somebody else*, and only the second is something a
row can report; a job whose account is gone answers `false`, because it has no
vendor to be foreign to and that row already states the missing account.

**A model the vendor serves that this build has not read about is selectable.**
The select prepends the stored id to the offered list when it is not already
there, so the control shows what the request carries.

## Consequences

The collapsed job row and the open model select now agree with each other and
with the request, on every id, including the ones this build's read-date does
not cover. The hint that used to say *not one this vendor serves* is now said
only where that is true.

**The stored value is not repaired, and that is deliberate.** A config carrying
a retired id keeps carrying it; ADR 0115 makes the catalogue a snapshot rather
than a whitelist, so the runtime sends what it was told to send. What changes is
that the surface stops hiding it. Migrating stored ids on load is a separate
decision with a separate cost — it would have to distinguish a retired id from
a typed one, which is exactly the distinction the catalogue cannot make about
an id it no longer carries — and the owner ruled on 2026-08-17 that local
configuration is disposable rather than worth a rescue path. This machine's
config was corrected by hand instead.

**The mirror is held by cases rather than by a compiler.** Six in
`textProfiles.test.ts`, three of which fail against the rule this replaces —
proven by restoring it. Nothing mechanically holds the TypeScript and the Rust
together; that is the same standing cost every mirror in this tree has
(ADR 0115's own header names it for the catalogue), and the reason the mirrored
function carries the Rust name in its comment.
