# 0036: Correctness Holds Without a Configured Profile

Date: 2026-08-02
Status: Accepted

## Context

While measuring profile-context width for ADR 0021, cleanup was seen turning a
damaged transcript into a plausible-looking one:

```
spoken: Claude Code
raw:    Bei c a u d e code oder codex Passt ja alles
out:    Bei CAUDE-Code oder Codex passt ja alles
```

The wrong letters are not the defect. The transcript was already broken when the
correction received it. The defect is that **visible damage became invisible
damage**: `c a u d e code` gets repaired by hand on sight, while `CAUDE-Code` is
capitalized and hyphenated — the shape of a real product name — and ships.

The obvious repair is a dictionary entry or a vocabulary term for `Claude Code`.
It does not work, and the reason it does not work is the decision here: **it
presupposes a maintained profile.** Whoever enters `Claude Code` has already been
bitten. ADR 0035 established the same thing from the other side — the vocabulary
stays empty because filling it requires predicting which words the recognizer
will get wrong, and nobody knows that in advance.

The same assumption had quietly reached the recognizer. `build_transcription_prompt`
returned `None` when a profile carried no opted-in terms, which is the state
almost every user is in. The provider then received **no initial prompt at all**.
That is not a neutral request. With no prefix the decoder falls back on its
training distribution, and on quiet or damaged audio the nearest attractor in
that distribution is the subtitle corpus — the documented "Thank you for
watching!" and "Untertitel im Auftrag des ZDF" outputs, of which
`docs/known-issues/transcription-hallucination.md` already carries the
recognizer-side half.

So the product had two mechanisms aimed at correctness — the dictionary and the
vocabulary — and both are opt-in personalization. Between them there was no
floor.

## Decision

**Dictionary entries and vocabulary terms are personalization. Correctness must
hold at zero configuration.** Any measure whose effect depends on a maintained
profile belongs in the profile catalog, not in the correctness path.

Three things follow.

**1. The recognizer gets a blank-state floor.** With no hints,
`build_transcription_prompt` returns `BLANK_STATE_RECOGNIZER_PROMPT`, a constant
carrying register and nothing else — no topic, no vocabulary, nothing a profile
could have contributed. It applies to both lanes, passes through the same budget
and truncation as any other prompt, and is shown in the recognizer preview so the
UI cannot claim the provider gets nothing.

ADR 0032 is untouched by this. That decision keeps the profile's *context field*
away from the recognizer because it holds topics and an initial prompt can only
be conditioned on literal tokens. The floor is not profile context taking the
recognizer path; it is a constant with no profile to read.

The floor is bilingual on purpose. The attractor it steers away from exists in
both languages, an initial prompt biases the decoder toward the language it is
written in, and this product's real register is German dictation carrying English
technical terms. It names the register positively rather than naming the subtitle
corpus in order to reject it: the prompt is a continuation prefix, not an
instruction, so a negation would put the very tokens it argues against into the
decoder's context.

**2. A floor never overrules a switch.** `bias_mode=off` and
`local_prompt_strength=off` are settings the user made. Those callers return
before the floor is reached, so the channel a user turned off stays off.

**3. Where a deterministic rule can hold the line, it does — and it repairs
rather than discards.** `spelled_letter_merge_reverted` is the fifth guardrail in
`normalize_correction`: where the original holds a run of at least three isolated
single letters, the correction may not fuse them into a token the original does
not contain. The letters go back in, spaced as the recognizer left them.

The other four guardrails discard the entire correction. That trade is right for
what they catch — an answered question or an assistant reply is wrong end to end.
Here exactly one token is wrong, and throwing away the cleanup of a long
dictation to undo it is a worse outcome than the defect.

## Why not a prompt rule

The global system prompt already says, verbatim:

> If a token looks rare, technical, mixed-language or uncertain, prefer the
> original over guessing.

`c a u d e` is all four of those at once. The model guessed anyway. Putting a
more specific rule next to a general one that is already ignored buys prompt
length, not reliability.

Prompt rules are also not verifiable. The existing test
`correction_system_prompt_includes_question_guardrail_instruction` asserts that a
*sentence is in the prompt*, not that the model followed it. The record of this
area notes that guessing between the available options is precisely how the last
two prompt rules acquired their wrong justification, which is why this decision
was gated on a measurement rather than taken directly.

## The measurement that gated it

The decision rule was fixed before the number existed: below 2 % do nothing,
2–10 % build the guardrail, above 10 % treat the recognizer as the root cause.

`classify_invented_tokens` (in `transform_context_measurement.rs`) flagged 14 of
197 shipped raw/output pairs. Read by hand, 12 are real — **6.1 %**, inside the
middle band. Full write-up, category distribution and the two false positives:
`docs/known-issues/cleanup-invents-tokens-on-broken-input.md`.

Two findings from that run bound what the guardrail claims. The letter-run merge
did not occur once in 197 records, so it is real but rare — which is what makes
surgical repair the right trade over a full discard. And it is the *only* one of
the three observed categories a deterministic rule can reach: nothing in the text
distinguishes `welt` → `wählt` (a correct repair) from `zun` → `Sinn` (an
invention) without knowing what was said.

## Consequences

- A profile that configures nothing still gets a recognizer prompt and one
  deterministic correction guardrail. Neither improves by editing a profile.
- The classifier is measurement scaffolding, not product code. It never compiles
  into a release build, and it deliberately under-counts: every derivation rule
  leans toward calling a token legitimate, so its number is a lower bound.
- The guardrail's detection and the classifier's `LetterRunMerge` category share
  one implementation (`spelled_letter_runs`, `fold_word`, `word_tokens` in
  `transform.rs`), so the metric that justified the rule and the rule itself
  cannot drift apart.
- Whether the floor actually reduces recognizer hallucination is **not measured**.
  It is the documented mitigation for a documented failure mode, adopted on that
  basis. A run that measures it needs raw transcripts from before and after,
  which the history will carry from now on.
- The remaining two categories, 10 of 14 observed tokens, stay open in the record.
  No deterministic rule reaches them.

## Related

- ADR 0017 — vocabulary moved out of the Whisper prompt; why the prompt stays small.
- ADR 0032 — the profile context is topics, and the recognizer never reads it.
- ADR 0033 — a term has no left-hand side.
- ADR 0035 — a vocabulary is filled by observation, not by a form.
- `docs/known-issues/cleanup-invents-tokens-on-broken-input.md`
- `docs/known-issues/stt-hints-bypass-the-vocabulary-opt-in.md` — why the preview
  has to show the floor.
