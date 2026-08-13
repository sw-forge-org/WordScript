# Bug: A singular form of address arrives as a plural one

Status: **Narrowed, not closed. Reported 2026-08-03 and located on the
recognizer lane by measurement the same day; a mood-gated, German-only repair
shipped 2026-08-10 (ADR 0081) and reaches two of the three observed shapes. The
third stays out of reach on purpose.**

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
  build and recorded the result. **The repair is asserted against the corpus,
  not against a live decode.**
- No local-lane comparison. All three cases are Groq `whisper-large-v3`; whether
  a local decode shows the same pull is unmeasured — and on that lane the repair
  needs the profile's language set, because `json` carries no detected one.
- No check of whether an initial prompt or vocabulary bias moves it. All three
  records ran `bias_mode: conservative`.
- ~~The `agent` and `enhance` modes are untested on this axis.~~ The repair now
  runs ahead of the mode branch, so all seven modes receive the repaired text.
  Whether those two modes *amplify* a pluralized address that slips past the
  gates is still untested.
- **The rate is still a floor, and it is now a floor on a narrower thing.** The
  scan catches forms in a fixed verb list, and the repair acts on a subset of
  those. What is not caught is not counted.

## What shipped 2026-08-10, and the measurement that shaped it

[ADR 0081](../decisions/0081-the-recogniser-output-is-repaired-before-any-mode-sees-it.md).
`core::recognizer_repair::repair_singular_address`, in a stage ahead of the mode
branch so it reaches Agent and Prompt Enhance too — the two modes this record
lists as untested and which rewrite by design.

**The obvious rule is unusable, and this record's own corpus is the
counter-evidence.** A suffix rule — "`stem`+`t` at the start of a sentence is a
pluralized imperative" — was scanned against the 136 records in history on
2026-08-10. It flags **45 tokens in 31 records, of which 3 are the defect.**
Everything else is the third person singular indicative wearing the same suffix:

```
Macht das Sinn?
Macht es überhaupt Sinn, dass Translate ein eigener Processing-Mode ist?
Macht das wirklich Sinn?
Ja, macht Sinn. Macht absolut Sinn.
Wahrscheinlich macht dieses Markdown-Ding davor mehr Sinn.
Weil für mich macht das aktuell keinen Sinn.
```

Six and more legitimate uses of `macht` alone, against three real defects across
the whole corpus. A suffix rule rewrites every one of them into `Mach das Sinn?`
— fluent, wrong, and undetectable downstream, which is this cluster's whole
failure mode reproduced by its own fix.

**So the rule reads mood, and every gate is a corpus row.** It fires only when
the verb opens the sentence and is in a *closed table* rather than derived by
suffix; the sentence is not a question; the next word is not `ihr` / `euch` /
`Sie`; and the clause carries positive evidence of the imperative — a particle
(`bitte`, `mal`, `nochmal`, `einfach`, `ruhig`) or a singular addressee (`dir`,
`dich`). `doch` and `denn` are excluded because both are at home in a question.
`geht`, `kommt`, `nimmt` and `setzt` are excluded from the table entirely: they
appear in this history only as indicatives, so a gate would have to fail twice
before they could be touched.

Against the three records above: `Schreibt mir bitte…` and `Macht dir wirklich
mal…` are repaired. **`Denkt ihr was passendes aus?` is not, and must not be** —
the verb went plural and the pronoun went with it, so the sentence is internally
consistent German and nothing in the text says the speaker meant one person.
That is this record's own reading, kept.

### It is German-only, and it says so

The product dictates in more than one language. The singular imperative of a
weak German verb being the bare stem, and the plural being the stem plus `-t`,
**is** the defect — no other language in reach has that pair, so outside German
the rule would be rewriting words on the strength of a coincidence. The repair
runs only over text known to be German: detected language first (Groq's
`verbose_json` reports one on every response, which matters because the records
in this corpus carry no *configured* language at all), the profile's setting
second, and an unestablished language declines.

The local lane returns `json` and carries no detected language, so there the
profile's language setting is what enables this. Recorded rather than papered
over.

## Why a dictionary entry is not the fix

The vocabulary dictionary maps a heard form to a written one unconditionally.
`fixt → fix` would corrupt every legitimate use of the plural and every
third-person `er fixt`. The distinction this defect needs is grammatical mood in
context, which is not what a term list expresses. ADR 0036 makes the same
argument for a different failure.

## Related

- [cleanup-flips-the-grammatical-person.md](cleanup-flips-the-grammatical-person.md)
  — **the same damage on the other lane and the other grammatical axis**, found
  2026-08-13. There the raw transcript is correct and cleanup changes the person;
  here the recogniser changes the number and cleanup passes it through. Read
  together they say that an address can be corrupted at either end of the
  pipeline, and that neither stage's guardrails look at the other's axis. That
  record is also the counter-example to this one's language gate: person is not
  German-shaped, so ADR 0081's *"a rule that encodes one language says so"* gives
  a fix there nothing to hang on.
- [transcription-hallucination.md](transcription-hallucination.md) — the
  recognizer lane this sits on, and the bias and gate machinery that already
  exists there.
- [cleanup-invents-tokens-on-broken-input.md](cleanup-invents-tokens-on-broken-input.md)
  — the corrector-side counterpart, and the `switcht` classification this record
  qualifies.
- ADR 0036 — the blank-state principle for recognizer-side repairs.
