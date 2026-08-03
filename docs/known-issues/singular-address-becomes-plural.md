# Bug: A singular form of address arrives as a plural one

Status: **Open — reported 2026-08-03, located on the recognizer lane by
measurement the same day. Not scoped.**

First reported: 2026-08-03, extended real-world dictation into an AI coding
assistant
Affected area: German transcription, `whisper-large-v3` on the Groq lane

## Symptom

The user dictates an instruction to one addressee and receives an instruction
addressed to several. The verb switches from the second person singular
imperative to the second person plural, and the pronoun can follow it.

```
spoken:  fix das bitte
shipped: fixt das bitte
```

The result is grammatically well-formed German, which is what makes it costly.
Nothing about the output looks damaged; it simply addresses a group. In an AI
coding assistant that is a change of meaning the reader cannot detect, because
the reader has no access to what was said.

## Where it happens

**On the recognizer, not in cleanup.** This was the first question, and it is
answerable without spending a provider call: `history.json` holds
`raw_transcript` beside `transformed_transcript`, so the two lanes can be
separated by reading them.

167 records from the developer's live `~/.config/WordScript/history.json`,
`whisper-large-v3` (165) and `whisper-large-v3-turbo` (2), profile
`Product and engineering`, processing mode `auto` (166) and `agent` (1).

**Three cases found. In all three the plural already stands in the raw
transcript, and cleanup passes it through unchanged.**

| Record | Raw transcript | What was meant |
|---|---|---|
| `…9749-8` | `Schreibt mir bitte dafür einen Prompt` | `Schreib mir…` |
| `…51-121` | `Macht dir wirklich mal Gedanken` | `Mach dir…` |
| `…73-161` | `Denkt ihr was passendes aus?` | `Denk dir was Passendes aus.` |

The third is the full shape of the defect: the verb went plural (`Denk` →
`Denkt`), the reflexive pronoun went with it (`dir` → `ihr`), and the sentence
type flipped from instruction to question. One dictated instruction became a
question put to a group.

The first is the cleanest evidence of the lane, because cleanup did not run on
it at all: `applied_rules` is `['assistant_like_correction_rejected']`, so a
guardrail discarded the correction and the raw transcript shipped verbatim. The
plural is the recognizer's.

**Zero cases in the other direction.** A scan for correction tokens that are a
raw token plus `-t`/`-et` returned four candidates across all 167 records, and
all four are legitimate: `mach` → `macht` and `kann` → `kannst` in third- and
second-person-singular contexts, none of them an imperative. Cleanup did not
pluralize a single address in this corpus.

Cleanup also cannot be expected to. `Schreibt mir bitte dafür einen Prompt` is
correct German; nothing in the text marks it as wrong. The guardrails in
`normalize_correction` compare a correction against the original, and here the
original is the defect.

### Why the recognizer prefers the plural

Hypothesis, not measurement. In German the singular imperative of a weak verb
is the bare stem (`fix`, `mach`, `schreib`, `denk`) and the plural imperative is
the stem plus `-t` (`fixt`, `macht`, `schreibt`, `denkt`). The difference is one
unstressed final consonant, frequently swallowed in fluent speech, and the
plural form is far more frequent in written German — it is also the second
person plural present indicative, which is what a language model biased toward
written text will reach for. A recognizer resolving an ambiguous coda against a
language model therefore has a systematic pull toward the plural.

`fix` sharpens this: it is an English loan inside a German sentence, so the
recognizer is also choosing a language for the token. `fixt` is the more
German-looking of the two options.

## Rate

3 of 167 records (1.8 %) contain a pluralized address. That is a floor, not a
rate: the scan only catches forms in a fixed verb list, and only where the
plural is detectable without knowing what was said. `Schreibt mir bitte` was
found because it is implausible in context, not because a rule marks it.

## Why the existing corpus does not cover it

The record that measures cleanup inventions
([cleanup-invents-tokens-on-broken-input.md](cleanup-invents-tokens-on-broken-input.md))
lists `switch` → `switcht` under *what is not the issue*, as legitimate German
morphology a naive "word not in the raw transcript" proxy would flag. That
classification is correct for the case it was drawn from — a third-person
indicative — but the same surface shape in an imperative is this defect. The two
are indistinguishable by token comparison alone; only the sentence type
separates them. Any future metric on this axis has to read the mood, not the
suffix.

## What has not been done

- No reproduction under controlled dictation. Every case here is an incidental
  find in production history; nobody has said `fix das bitte` into a running
  build and recorded the result.
- No local-lane comparison. All three cases are Groq `whisper-large-v3`; whether
  a local decode shows the same pull is unmeasured.
- No check of whether an initial prompt or vocabulary bias moves it. All three
  records ran `bias_mode: conservative`.
- The `agent` and `enhance` modes are untested on this axis. They rewrite by
  design (ADR 0026), so a pluralized address reaching them could survive or be
  amplified, and neither has been looked at.

## Why a dictionary entry is not the fix

The vocabulary dictionary maps a heard form to a written one unconditionally.
`fixt → fix` would corrupt every legitimate use of the plural and every
third-person `er fixt`. The distinction this defect needs is grammatical mood in
context, which is not what a term list expresses. ADR 0036 makes the same
argument for a different failure.

## Related

- [transcription-hallucination.md](transcription-hallucination.md) — the
  recognizer lane this sits on, and the bias and gate machinery that already
  exists there.
- [cleanup-invents-tokens-on-broken-input.md](cleanup-invents-tokens-on-broken-input.md)
  — the corrector-side counterpart, and the `switcht` classification this record
  qualifies.
- ADR 0036 — the blank-state principle for recognizer-side repairs.
