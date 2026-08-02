# 0032: The Profile Context Is Topics, and the Recognizer Never Reads It

Date: 2026-08-01
Status: Accepted

## Context

`TextProfile.prompt` had two consumers with opposite needs, and the product
never said which one it was for.

The recognizer conditions Whisper's decoder on literal tokens. `platform
constraints` raises the odds of those two words and of nothing else — there is
no step that expands a topic into the service names it stands for. The LLM
stages do exactly that expansion: a reader told the speaker works on platform
constraints picks `SLO` over `slow` and `ingress` over `in press`.

So a topic label is worthless to the recognizer and valuable to the transform.
A literal term is the reverse. One field cannot be good at both.

The product already had both channels. ADR 0017 created `vocabulary_hints` with
a per-entry `use_as_prompt_hint` opt-in as the lexical channel, and the context
field's own UI description has said *"topics, not spellings"* since it shipped.
But ADR 0017 built the new channel without cutting the old one:
`analyze_transcription_bias` still pushed `prompt` through
`filter_profile_hint_lines`, and `build_transcription_prompt` still emitted the
survivors as a `Vocabulary:` section.

That leftover routing caused two visible defects.

**The settings panel reported a rejection that never happened.** Lines the
filter dropped were shown as "Not sent to the recognizer", and two analysis
warnings — `BroadProfileContextIgnored` and `NoConcreteProfileHints` — told the
user their topics were too broad and asked for "short lexical terms like product
names, acronyms or ticket prefixes instead of broad categories". Correctly
written topics were reported as a misconfiguration.

Worse, the report was false even on its own terms. `include_profile_terms` is
true only under `BiasMode::Manual` with an explicit cloud flag, and ADR 0017
removed the bias-policy panel, so the UI hardcodes `"conservative"`. No
reachable configuration routed the context field to Whisper. The panel was
warning about a path that no longer ran.

**The curated seeds were rewritten to satisfy the filter.** On 2026-05-23
(`0579099`) the five curated profiles shipped with topics. Two days later
`3a7f5f9` replaced all five with spellings — `WordScript / API / SDK / SQL /
CI-CD / SLO / PR / Tauri` for Product and engineering. Those pass
`is_profile_hint_candidate`; the topics did not. The filter's rejection was read
as a verdict on the line's quality rather than as routing, and the fix was
applied to the content instead of to the routing.

`docs/known-issues/profile-context-is-written-as-categories.md` then filed the
*original, correct* content as a defect. It was describing the developer's live
`~/.config/WordScript/config.json`, which still held the 2026-05-23 seed:
`refresh_curated_text_profile_presentation` refreshes only `curation`, never
`prompt`, and `should_reseed_curated_text_profiles` returns false once any
curated profile exists. Nothing was wrong with that content — but nothing had
updated it either, and the same stale profile was what ADR 0021's 96-entry
replay measured, because `measure_profile_context_width` reads that file.

## Decision

**One consumer per field.**

`TextProfile.prompt` holds topics and reaches the LLM stages only — Cleanup,
Rewrite, Agent, Prompt Enhance — through `core::profile_context`, unchanged from
ADR 0021 and bounded the same way in every mode. `vocabulary_hints` is the only
path from a profile to the recognizer, per entry and opt-in, as ADR 0017
specified.

Concretely:

- `analyze_transcription_bias` no longer takes the profile prompt.
  `build_transcription_prompt` loses its `Vocabulary:` section. What reaches
  Whisper is `Likely phrases:` from the opted-in vocabulary, and nothing else.
- `filter_profile_hint_lines`, `is_profile_hint_candidate` and
  `MAX_TRANSCRIPTION_PROFILE_HINTS` are gone, together with `profile_hints` and
  `ignored_profile_lines` on `TranscriptionBiasPreview` and their TypeScript
  mirrors. `filter_stt_hint_lines` stays: it gates a channel that does travel
  this path.
- The `BroadProfileContextIgnored` and `NoConcreteProfileHints` analysis codes
  are removed. A profile whose context field holds nothing but topics is
  correct, not under-configured, and no surface may say otherwise.
- The curated seeds return to topics. Every acronym they carried is already a
  `dictionary_entry`, which is where a dictated form maps to a written one;
  copying it into the recognizer channel would recreate the redundancy ADR 0017
  removed. Only `Statuspage` and `Tauri` had no home and became
  `vocabulary_hints`.
- `use_as_prompt_hint` stays `false` on those two. Today no curated profile
  sends anything to Whisper; switching them on would be a new behaviour smuggled
  in under a routing cleanup. Whether a curated profile should ship with
  recognizer hints on is a content question, and content is Phase 7's.
- `TEXT_PROFILE_SCHEMA_VERSION` 2 -> 3 with `migrate_lexical_context_seed`,
  matching the `3a7f5f9` seed **byte for byte** per profile id and restoring the
  topics. An edited field never matches and is never touched — the restraint
  `refresh_curated_text_profile_presentation` documents after the `work_mode`
  reset. Each migration step now guards on its own version rather than on the
  constant, so bumping the constant cannot re-run an earlier step.

**A measurement names the data it ran against.** ADR 0021's report said it
measured "the curated Product-and-engineering profile". It measured a local copy
two months out of date, and the conclusion outlived the profile it described.
`measure_profile_context_width` now writes the profile *content* into its report,
not just the id, and its header states that it reads live local state.

Its arms change with it. The old narrow arm reconstructed the pre-ADR-0021
filtered subset; with the filter gone there is no subset left to reconstruct.
The harness now compares context against no context — the question
`profile-context-is-written-as-categories.md` actually poses.

## Consequences

ADR 0021 stands. It asked whether widening the context could make cleanup invent
content, found it could not, and that holds regardless of which profile it ran
against — a weaker context field makes the safety result conservative, not
wrong. What does not survive is reading it as evidence *about profile context in
general*: it compared eight topic labels against two of them.

The open question is unchanged and still Phase 7's: does profile context earn
its place at all? Answering it needs a profile holding the terms a person
actually dictates, which the catalogue rework has to produce first.

Users on a pre-2026-05-25 install see nothing change; their profiles already
held topics. Users on a later install get the topics back unless they edited the
field. Nobody's recognizer output changes, because nothing was reaching the
recognizer from this field in the first place.

The legacy `bias_mode`, `manual_bias` and `stt_hints` fields stay in the config
as migration remnants. Nothing reads them for the recognizer any more; removing
them is cleanup, scheduled with the rest of the ADR 0017 remnants.

## Related

- ADR 0017 — created the vocabulary channel and the opt-in, but left the old
  routing in place.
- ADR 0021 — one shape for profile context in every mode, and the measurement
  this ADR re-scopes.
- ADR 0023 — the context is a reading aid, never material. A reading aid does
  not have to be lexical, which is why topics are the right content.
- `docs/known-issues/profile-context-is-written-as-categories.md` — the record
  this ADR closes and re-aims.
