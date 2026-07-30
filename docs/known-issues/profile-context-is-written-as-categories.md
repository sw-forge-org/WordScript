# Profile context is written as categories, not as terms

Status: open (recorded 2026-07-30). Belongs to Phase 7 in `docs/ROADMAP.md`.

The curated profiles fill `TextProfile.prompt` with category labels rather than
with the terms those categories would contain. `curated-product-engineering`
reads in full:

```
feature names
bug IDs
release scope
API names
platform constraints
service names
migration steps
infra constraints
```

Every other curated profile follows the same pattern -- `account names`,
`pipeline stage`, `decision makers` for Sales; `candidate names`, `role titles`,
`interview stages` for Hiring.

## Why it matters

A category label is a poor input to both consumers of this field:

- **The recognizer** cannot bias toward `feature names`. It can bias toward
  *actual* feature names. This is why the transcription hint filter rejects six
  of these eight lines (ADR 0017): they are not lexical material.
- **The correction and generation prompts** get slightly more from a label than
  the recognizer does -- it names the domain -- but far less than a list of the
  user's real terms would give.

ADR 0021 measured the correction side directly: widening Cleanup's context from
two of these lines to all eight changed 26% of outputs, but the changes were
noise in both directions and introduced no content. That is what a field of
category labels predicts. Eight labels carry little more signal than two.

**So the null result in ADR 0021 is at least as much a statement about this
field's content as about the filter that gated it.** The measurement establishes
that widening is safe; it does not establish that profile context is useful,
because the profiles measured had little to say.

## What would settle it

The same 96-entry replay, run against a profile whose context holds the terms a
person actually dictates -- real service names, real feature names, the actual
acronyms in use -- versus an empty profile. That measures whether profile
context earns its place at all, which the category-label version cannot answer.

Until then, do not read ADR 0021 as "profile context does not matter". It says
"these eight labels do not differ measurably from two of them".

## Still open after ADR 0023

ADR 0023 changed what the context block is *allowed to do* in Agent mode -- it
is a reading aid for the instruction and may not contribute content -- and moved
it into the system prompt behind an explicit prohibition. That fixes a leak; it
does not make a category label a better reading aid. `feature names` still tells
the agent nothing it can use to spell a real feature name correctly. The question
this file records is unchanged.

## Related

- ADR 0023 -- the context is a reading aid, never material.
- ADR 0021 -- one shape for profile context in every mode, and the measurement.
- ADR 0017 -- why the recognizer path filters this field at all.
- `docs/ROADMAP.md` Phase 7 -- profile catalogue and settings surface rework,
  which owns profile *content*.
