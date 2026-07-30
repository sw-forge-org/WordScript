# 0021: Profile Context Has One Shape in Every Mode

Date: 2026-07-30
Status: Accepted

## Context

`TextProfile.prompt` is free text the user maintains. Every mode that talks to
an LLM puts it into its prompt, and each did so differently:

- **Cleanup / Rewrite** pushed it through `transcription_hints::filter_profile_hint_lines`,
  which accepts a line only at four words or fewer *and* (single word *or*
  containing an uppercase letter, digit, or punctuation), capped at six lines.
- **Agent** took `config.profile_prompt.trim()` raw — unfiltered, untruncated,
  uncapped — and `stt_hints` the same way.
- **Prompt Enhance** also took it raw, with neither dictionary nor snippets in
  its prompt.

On the real curated `curated-product-engineering` profile (eight context lines)
that meant Cleanup received two — `bug IDs` and `API names`, surviving only
because they carry capitals — while Agent and Prompt Enhance received all eight.
Discarded for Cleanup: `feature names`, `release scope`, `platform constraints`,
`service names`, `migration steps`, `infra constraints`.

**The split was never decided.** `git log -L` on `prompt_context_hints` shows
exactly two changes. It was introduced reading `prompt.lines()` directly. Commit
`3a7f5f9` (2026-05-25, *"feat: enhance transcription bias analysis and
reporting"*) swapped in `filter_profile_hint_lines`; that commit's message
describes STT hints, the bias preview and the PromptsTab, and never mentions the
correction prompt. The filter arrived in `transform.rs` because it was in scope.

ADR 0017 is not the justification, and is two months younger. It argues
exclusively about Whisper's `initial_prompt` as a hallucination amplifier
("repetition loops and language drift"), and its *"What deliberately did not
change"* section does not mention the correction prompt. The filter lives in
`transcription_hints.rs`; its constants are named `MAX_TRANSCRIPTION_*`. It was
built for a different mechanism.

The single documented trace was one clause in the *STT bias* section of
`docs/ARCHITECTURE.md` — "no longer forwarded to STT **and cleanup**" — added by
that same commit. The Agent and Prompt Enhance exemption was documented nowhere.

### Why "filter everywhere" was rejected

Applying the same filter to all three modes is consistency of *mechanism*, not
of principle. `is_profile_hint_candidate` asks *"could Whisper mis-hear this
token?"* — hence the uppercase/digit rule. For a correction prompt that is the
wrong question and points the wrong way: it keeps `SEV-1`, exactly the kind of
token a model can insert into text that never contained it, and discards
`release scope`, which cannot be inserted as anything but itself. For Agent the
question does not apply at all: the output is generated whole, so there is no
original to drift from, and the context is the only thing locating the output in
a domain.

The codebase had already solved this for a *stronger* risk. ADR 0020's workspace
context "reaches every mode as one bounded hint" with its own "never derive
content from this" instruction — framed per mode, not filtered per mode. The
weaker input was being handled by dropping lines in one mode and by nothing at
all in two others.

### The measurement

Removing the predicate from Cleanup widens its context from two lines to eight,
which is a real change to correction output. It was measured rather than
asserted — the failure that produced ADR 0020 was a control documented as
working that the runtime never read.

96 real history entries, all recorded under `Product and engineering` in
`cleanup` mode, replayed twice through the production correction path
(`llama-3.3-70b-versatile`, `temperature 0.0`, production model/timeout/token
selection). Both arms shared one system prompt from `correction_system_prompt`;
only the `Kontextbegriffe:` line differed. 192 calls, no errors.

| | narrow (2 lines) | widened (8 lines) |
| --- | --- | --- |
| Output identical | — | 71/96 (74%) |
| Entries with content words absent from the transcript | 12 | **11** |
| Entries with removed words | 21 | 20 |
| Output left unchanged | 41 | 43 |
| Terms from the six dropped lines in any output | — | **0** |

The risk the filter guards against does not occur. Not one occurrence of
`feature names`, `release scope`, `platform constraints`, `service names`,
`migration steps` or `infra constraints` across 96 outputs.

The "content words absent from the transcript" row is a proxy and reads high in
both arms: German morphology correction legitimately produces words the raw
transcript does not contain (`Lieds` → `Lieder`, `switch` → `switcht` are both
correct). It is not a hallucination count. It is applied identically to both
arms, which is what makes the *comparison* meaningful — the absolute number is
not a claim.

The widening also buys nothing measurable: 74% identical, and the remaining
differences run both ways (2 entries corrected only by the wide arm, 4 only by
the narrow). The three guardrail differences are all the question-mark guardrail
firing symmetrically, once in each arm's favour.

**So the change is safe and simplifying, not an improvement.** That is the
honest reading: the measurement licenses it, it does not demand it.

## Decision

**The profile context has one shape in every mode. The mode decides the
framing, never the width.**

`core::profile_context` is the single producer: normalize whitespace,
deduplicate case-insensitively, truncate each line at `MAX_CONTEXT_LINE_CHARS`
(80), and spend a budget of `MAX_CONTEXT_CHARS` (600). No word-shape predicate
anywhere.

**The bound is in characters, and what exceeds it is named rather than
dropped.** The first version of this decision capped at 8 lines "because 8 is
what was measured" — which confused the width of the evidence with the width of
what is safe, and landed the cap exactly on the length of every shipped curated
profile. Adding one line to a curated profile would have silently discarded it,
recreating the defect class of ADR 0020 while fixing a different one. It would
also have been a regression for Agent, which previously received every line.

600 characters is roughly five times what the curated profiles use (110–120) and
small next to the 1700–2400 character instruction block it sits in. The budget
exists to stop a pasted meeting transcript, not to ration normal use.
`profile_context_budget` returns the accepted lines, the ones that did not fit,
and the spend; `TextRulesAnalysis.profile_context` carries it to the UI, which
shows the boundary instead of leaving the user to discover it.

What differs per mode is the sentence wrapped around those lines, which is where
the corrective/generative distinction belongs:

- **Cleanup / Rewrite** keep `"Aktive Hinweise aus dem Profil. Nutze sie nur,
  wenn sie zum Input passen; nie halluzinieren"`. Unchanged — the framing was
  already right; only the width was decided by the wrong instrument.
- **Agent** frames the same lines as the domain its output lives in.
- **Prompt Enhance** keeps its weak "berücksichtige falls relevant", which sits
  next to its own sub-mode instruction ("Keine neuen Informationen hinzufügen"
  in `enhance`, explicit expansion in `expand`).

`filter_profile_hint_lines` stays exactly where ADR 0017 put it and keeps doing
what it was built for: gating what reaches Whisper's initial prompt. It is no
longer called from `transform.rs`.

Agent's dictionary and snippet blocks and its `stt_hints` field are bounded by
the same constants. A prompt that grows with the profile is a prompt nobody has
measured.

## Consequences

- Cleanup's effective context width goes from 6 lines (the filter's cap; the
  `MAX_PROFILE_HINT_LINES = 8` next to it was dead, since the filter returned at
  most 6) to whatever fits in 600 characters — every curated profile in full,
  with room to grow. Agent and Prompt Enhance go from unbounded to the same
  budget.
- The Profiles panel gained a budget meter and, when lines exceed it, names
  them. This is the part that makes a bound acceptable at all: a limit the user
  cannot see is indistinguishable from a bug.
- The context card is renamed from **"Transcription context"** to **"Profile
  context"**. The old name described the minority consumer — the field goes to
  every mode's transform prompt in full, and only a filtered subset reaches the
  recognizer.
- `correction_prompt_keeps_only_concrete_profile_terms` is superseded by
  `correction_prompt_carries_every_profile_line_bounded`. The old test pinned the
  transcription filter's rule on the correction prompt; keeping it would have
  pinned the accident.
- The corpus gains `expected_profile_context` and the
  `corpus_drives_profile_context_parity_across_modes` driver, which builds the
  real prompt for each listed mode and asserts the same context reaches all of
  them. A per-mode assertion cannot catch this defect class: every individual
  prompt was defensible, and only the comparison exposed three widths of one
  field. The invariant is **parity**, not a particular width.
- The Text Rules warning and the Profiles panel copy said broad lines "are not
  forwarded automatically". That is now only true of the recognizer, so both say
  so: the lines still reach the transform prompt. Before this change the copy was
  wrong in the other direction — it named STT while the filter also gated cleanup.
- The measurement harness stays as `#[cfg(test)]` scaffolding in
  `core::transform::context_measurement`, with the narrow arm reconstructed from
  `filter_profile_hint_lines`. It compiles out of every release build and is
  runnable if the question is reopened.
- Not addressed: where the transcript is already damaged — spelled-out letters,
  an aborted word — the correction invents a plausible token. It occurs
  identically in both arms, so it is unrelated to context width, and is filed in
  [known-issues/cleanup-invents-tokens-on-broken-input.md](../known-issues/cleanup-invents-tokens-on-broken-input.md).
- Not addressed: the curated profiles are written as category labels
  (`feature names`, `service names`) rather than as terms. A category label helps
  neither the recognizer nor the corrector much. That is profile *content*, which
  is Phase 7 in `docs/ROADMAP.md`, and it is the more likely reason profile
  context feels inert — see
  [known-issues/profile-context-is-written-as-categories.md](../known-issues/profile-context-is-written-as-categories.md).
