# 0017: Vocabulary Moves Out of the Whisper Prompt

Date: 2026-07-29
Status: Accepted

## Context

The Profiles tab exposed four panels: *Context & Preview*, *Dictionary*,
*Snippets* and *Bias policy*. That is an engineering decomposition of the
implementation, not a description of anything a user wants to do.

"Bias policy" is the clearest case. It is a `BiasMode` enum (`conservative` /
`manual` / `off`) plus two `ManualBias` flags plus an `stt_hints_override`
string, and every one of those knobs answers the same question: *does profile
vocabulary get pushed into Whisper's initial prompt?* A user cannot answer that
question, because answering it requires knowing that Whisper has an initial
prompt, that it is a hint rather than a constraint, and that a longer one makes
hallucination more likely rather than less.

That last point is the substantive one. Copying vocabulary into `initial_prompt`
is a documented cause of repetition loops and language drift. The existing bias
path had already been forced into a "conservative" default precisely because
broad profile lines pulled language detection towards English — and that
conservative default is exactly why profiles felt like they did nothing. The
architecture pushed the product into a corner: the only safe setting was the one
that had no effect.

Meanwhile the mechanism that actually works was already there and already
deterministic. `DictionaryEntry` (`phrase` → `replace_with`) is applied by
`transform.rs::apply_dictionary_entries` *after* transcription, where a
replacement is exact, cheap and cannot induce a hallucination. Its target
spellings were *also* being copied into the prompt as "Preferred spellings",
which was redundant at best.

What was genuinely missing is Wispr Flow's separation between *teaching a word*
(pronunciation only) and *replacing X with Y*. Both were smashed together: the
first into a free-text `stt_hints` blob governed by a profile-wide policy, the
second into the dictionary.

## Decision

**Vocabulary is applied deterministically after transcription by default.** The
initial prompt keeps only what the user explicitly opts into, entry by entry.

- `TextProfile.vocabulary_hints: Vec<VocabularyHintEntry { id, phrase,
  use_as_prompt_hint }>` replaces the `stt_hints` free-text blob.
  `use_as_prompt_hint` is off by default and is the **entire** replacement for
  the `BiasMode` enum and both `ManualBias` flags. There is no profile-wide mode
  left to reason about — the only remaining question is per entry, and it is
  phrased as what it does ("Hint the recognizer") rather than as what it is.
- **Dictionary terms leave the transcription prompt entirely.**
  `build_transcription_prompt` no longer emits a "Preferred spellings" section.
  `apply_dictionary_entries` already handled them deterministically, so the
  prompt copy was pure redundant risk.
- Prompt caps drop accordingly: `CLOUD_PROMPT_PREVIEW_MAX_CHARS` 896 → 320,
  `LOCAL_PROMPT_PREVIEW_MAX_CHARS` 480 → 200. "Small and bounded" made literal.
- Four panels become three: **Vocabulary** (context plus words & names),
  **Replacements** (the dictionary, renamed to what it does), **Snippets**.
  The Bias policy panel is gone.

### What deliberately did not change

- The Modes tab and `mode_router.rs` are untouched. Auto-mode already treats
  workspace context as one probability signal among several rather than a hard
  app-to-profile map, which is the right design.
- Voice and language settings stay in the Speech & AI tab. Moving them into a
  Profiles sub-panel would have duplicated a surface that already reads
  coherently where it is; the complaint was about the four panels, not about
  where the model picker lives.
- Profiles keep the name "Profile" rather than adopting superwhisper's "Mode".
  Renaming a concept across SPEC, VISION and the whole codebase is a separate
  decision from fixing what the concept contains.
- `bias_mode` and `manual_bias` remain on `TextProfileWorkMode` as
  `#[serde(default)]` migration-only remnants for one release, then get removed
  under a follow-up ADR. Nothing reads them at runtime any more.

## Migration

`TextProfile` gains `schema_version` (`#[serde(default)]` → 1 for existing
configs). `migrate_vocabulary_hints` runs once on load at version < 2:

- `stt_hints` is parsed through the existing `filter_stt_hint_lines` accepted-
  line logic into one entry each. Lines that filter would have rejected are
  logged rather than dropped silently — they were never reaching Whisper, and
  carrying them forward would recreate the illusion that they were.
- `use_as_prompt_hint` defaults from the old policy: Conservative and Off → off,
  Manual with `cloud_include_profile_terms` → on. Conservative was the default,
  so almost every existing profile migrates to a fully deterministic vocabulary,
  which is the intended end state anyway.
- `migrateLegacyBiasPolicyToVocabularyHints` in `textProfiles.ts` mirrors this
  so unsaved client state matches what a disk load produces.

## Consequences

- A profile's vocabulary now affects output through a path that cannot induce a
  hallucination. The previous design could only choose between "no effect" and
  "effect plus drift risk".
- Users who had opted into Manual bias keep their opt-in, now per entry.
- The removed `stt_hints` textarea was the only place a user could add many
  phrases at once. That is a deliberate trade: the entry list makes the per-item
  toggle expressible at all, and the toggle is the point.
- The preview still shows dictionary terms so the user can see what will be
  replaced; it just no longer claims they are forwarded to the recognizer,
  because they are not.
