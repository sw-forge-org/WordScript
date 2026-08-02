# 0033: A Term Has No Left-Hand Side

Date: 2026-08-01
Status: Accepted

## Context

ADR 0032 established that the profile context holds topics and that
`vocabulary_hints` is the field for individual terms. Wiring that up exposed two
further problems, one in the vocabulary field and one in Replacements.

**A vocabulary entry with its switch off reached nothing.** `capture.rs` filled
`stt_hints` from `prompt_hint_phrases()` — the opted-in subset — and that value
was the only thing carried into the transform config. From there exactly one
consumer read it: the Agent prompt's `Terms:` block. Cleanup, Rewrite and Prompt
Enhance never saw a term at all.

| entry | recognizer | cleanup | rewrite | agent | prompt enhance |
| --- | --- | --- | --- | --- | --- |
| switch off | no | no | no | **no** | no |
| switch on | yes | **no** | **no** | yes | no |

So a switch labelled "hint the recognizer" was in practice the on/off switch for
whether the entry existed, and even switched on it missed the two most-used
modes. Words & names was not granular profile context; it was a recognizer-hint
list that leaked into one LLM mode by sharing a field name.

**Replacements cannot express a misrecognition.** It maps a spoken form to a
written one, which is exact and reliable when the left-hand side is a *choice* —
"KA" for "Kundenanfrage" is something the user says on purpose. It fails when
the left-hand side is a *guess*. A recognizer does not mangle a name the same
way twice: "Kubernetes" comes back as "cuber netties", "Kuber Netes" or "Cooper
Nettis" depending on the utterance. There is no stable string to write down, and
enumerating attempts is endless.

Both halves lived in one table, and the broken half discredited the concept.

## Decision

**A term has no left-hand side.** The two things Replacements conflated are
separated by what the user knows:

- **Words & names** carries the term alone. It is granular profile context: the
  same vocabulary as the context field, one level finer. It reaches *every* LLM
  stage unconditionally, and the recognizer switch governs one thing only —
  whether the term additionally biases speech recognition.
- **Replacements** keeps its explicit left column and is scoped to deliberate
  shorthand. Its fields are renamed from "Heard as / Replace with" to "What you
  say / What gets written", because that is the only case where the left side is
  knowable.

**Repair is layered, and the deterministic layer is the floor.** Three
mechanisms hold different information, so they are not alternatives:

1. *Learned exact pairs* — the only mechanism that gets the real left side.
   Blocked: `apply_edited_preview_text` overwrites the text in place, and
   history keeps `raw_transcript` and the final `transformed_transcript` but not
   the transform output *before* the user's edit. Without that, there is no
   delta to learn. Recording it is a prerequisite, not a feature, and is not
   done here.
2. *Deterministic repair* — `core::vocabulary_repair`, new in this ADR. No
   context, but it runs in **every** mode including Verbatim and with cleanup
   off. That is why it is the floor: a vocabulary feature that silently does
   nothing in some modes is the defect class this codebase keeps rediscovering.
3. *The correction LLM* — has the sentence, so it can tell "der Tori Cluster"
   from "meine Kollegin Tori". It only exists where an LLM runs, so it is the
   contextual addition, not the base. Terms now reach it as `Names and terms:`
   alongside the topic line.

The deterministic layer therefore fires **only where it is decisive** and leaves
everything ambiguous to the layer that can read the sentence.

**Normalized edit distance, not phonetic codes.** Kölner Phonetik and Metaphone
were the obvious reach and are wrong twice. They are language-bound, and this
product deliberately keeps whatever language mix was dictated, so no single
encoder covers the input. Worse, they are lossy in the wrong direction: `Tauri`
and `Tori` collapse to the same code, destroying the distinction that matters
most. A normalized relative Levenshtein distance keeps a *graded* score, and a
threshold on a graded score is what lets the risky cases be declined.

Guards, all deliberately blunt:

- `MIN_TERM_CHARS = 7`. Below it, no threshold that still catches a real
  misrecognition also excludes ordinary words. `Tauri` is five characters and is
  never repaired here; it still reaches every LLM stage.
- `MAX_DISTANCE_RATIO = 0.25`, relative to term length.
- `MAX_WINDOW_TOKENS = 3`, since a mangled name arrives split but rarely across
  more than three tokens.
- Spans already spelling a term correctly are protected. Without this, a window
  covering a correct occurrence plus the next word stays inside the budget while
  deleting that word, and a shorter term overwrites a longer one already
  written.
- Every repair is reported through `applied_rules`, which the UI renders. A
  fuzzy rewrite has more reason to be visible than an exact one (ADR 0020).

Repair runs **before** the explicit rules, so a replacement or snippet written
against the term's real spelling matches afterwards.

The asymmetry is deliberate: a missed repair leaves readable text that the LLM
stages still see the term list for; a wrong repair puts a word in the user's
mouth. The design declines when in doubt.

**Nothing the user switched on disappears unreported.** `filter_hint_lines`
stopped at `MAX_TRANSCRIPTION_STT_HINTS`, so a term past the fourth reached
neither `accepted` nor `ignored` and no surface could name it — a silent drop of
a control the user had operated, which is the defect
`profile_context_budget` already exists to prevent on the context field. The
filter now keeps going and collects those terms in a third list, `over_limit`,
reported separately from `ignored` because the two ask for different fixes: one
needs a shorter term, the other needs a switch turned off elsewhere. A repeat of
an already accepted term is not counted as a loss.

**Measured, not asserted.** The regression corpus gains
`expected_vocabulary_repair`, and the test requires cases in both directions —
at least two that fire and two that must not. The negative entries are the point.

## Consequences

Terms now reach four prompts that never saw them, so correction quality should
change. That is the intended effect and it is unmeasured; the harness re-aimed
in ADR 0032 is the instrument, and it needs a profile with real terms, which is
Phase 7's.

Prompts grow by one line where a profile has vocabulary. The block is bounded by
the same `profile_context` budget as the topic line, so it cannot run away.

Short terms get no deterministic repair. This is a real gap and the honest
answer to it is the LLM layer, not a lower threshold.

The learning layer stays blocked until the pre-edit text is recorded. That is a
small change to `commit_pending_transcription_preview` and history, with a
privacy question attached — it means storing one more copy of dictated text —
and it should be decided on its own terms rather than slipped in here.

## Related

- ADR 0032 — the context field is topics and the recognizer never reads it.
  This ADR is the other half: what the *terms* field is for.
- ADR 0017 — created `vocabulary_hints` and the opt-in whose meaning this ADR
  narrows to "additionally bias the recognizer".
- ADR 0020 — a control whose effect is invisible. Every repair is reported for
  this reason.
- ADR 0023 — context is a reading aid, never material. Terms are the same: they
  tell the model which word was meant, never what to say.
