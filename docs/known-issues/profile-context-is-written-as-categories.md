# Profile context is written as categories, not as terms

Status: closed 2026-08-01 — the premise was wrong. See ADR 0032. The question
underneath it survives and stays with Phase 7; it is restated at the bottom.

**Correction:** the first version of this record claimed the curated profiles
fill `TextProfile.prompt` with category labels instead of terms, and filed that
as a defect. Two things were wrong with it.

## It described a profile that had not shipped for two months

The category labels shipped on 2026-05-23 (`0579099`). On 2026-05-25 `3a7f5f9`
replaced all five curated prompts with spellings — `WordScript / API / SDK /
SQL / CI-CD / SLO / PR / Tauri` for Product and engineering. This record, and
ADR 0021 before it, both dated 2026-07-30, quote the pre-05-25 content as
current.

Neither was reading the shipped seed. Both were reading the developer's live
`~/.config/WordScript/config.json`, which still held the 2026-05-23 version:
`refresh_curated_text_profile_presentation` refreshes only `curation`, never
`prompt`, and `should_reseed_curated_text_profiles` returns false once any
curated profile exists. `measure_profile_context_width` reads that same file,
which is how a stale local profile became "the real
`curated-product-engineering` profile" in an ADR.

## And the content it complained about was correct

A category label is the right content for this field. The claim that "the
recognizer cannot bias toward `feature names`" is true and was the wrong
conclusion to draw: the recognizer was never supposed to read this field. It
holds topics for the LLM stages, where a domain label genuinely shifts priors —
`SLO` over `slow`, `ingress` over `in press`. The lexical channel is
`vocabulary_hints`, created by ADR 0017 for exactly this, with a per-entry
opt-in. (That opt-in was later removed: the runtime allocates the recognizer's
slots itself, because the intuitive allocation is systematically backwards. See
ADR 0035. Nothing about the diagnosis below changes.)

What was actually broken was the routing. ADR 0017 built the new channel without
cutting the old one, so `prompt` still travelled to the recognizer and got
filtered there — and the settings panel reported the filtered lines as "not sent
to the recognizer", which reads as a defect in the line. It was not even true:
`include_profile_terms` requires `BiasMode::Manual`, which no UI can set since
ADR 0017 removed the bias-policy panel. The panel warned about a path that no
longer ran.

That misread is the likely cause of `3a7f5f9` itself: the filter rejected the
topics, the profile looked inert, and the content was rewritten to satisfy the
filter instead of the routing being fixed.

## What ADR 0021 does and does not say

Its safety finding stands. It asked whether widening the context could make
cleanup invent content, found it could not, and that holds whichever profile it
ran against — a weaker context field makes the result conservative, not wrong.

What does not survive is treating it as evidence about profile context in
general. It compared eight topic labels against two of them, on one stale local
profile. The original version of this record made that point correctly; it just
attributed the weakness to the wrong cause.

## The question that survives

Does profile context earn its place at all?

That still needs the replay run against a profile holding the terms — or, now,
the *topics* — a person actually dictates, versus an empty profile.
`measure_profile_context_width` has been re-aimed at exactly that comparison
(context against no context) and now records the measured profile content, not
just its id. It cannot be answered before Phase 7 produces a profile catalogue
built from real daily use.

Until then: do not read ADR 0021 as "profile context does not matter". It says
"these eight labels do not differ measurably from two of them".

## Related

- ADR 0032 — topics for the transform, vocabulary for the recognizer, and why a
  measurement has to name its data.
- ADR 0023 — the context is a reading aid, never material. A reading aid does
  not have to be lexical.
- ADR 0021 — one shape for profile context in every mode, and the measurement.
- ADR 0017 — created the vocabulary channel; left the old routing in place.
- `docs/ROADMAP.md` Phase 7 — profile catalogue rework, which owns profile
  *content*.
