# 0081 -- The recogniser's output is repaired before any mode sees it, and a rule that encodes one language says so

Date: 2026-08-10
Status: Accepted

## Context

Two defects damage the transcript before any mode runs: WordScript's own prompt
echoed back into it
([ADR 0080](0080-wordscript-removes-its-own-prompt-from-the-transcript-and-never-restores-what-it-displaced.md)),
and a singular form of address arriving as a plural one
([singular-address-becomes-plural.md](../known-issues/singular-address-becomes-plural.md)).

Both are the recogniser's, both are decidable without asking a model, and both
had nowhere to live. The obvious home -- `apply_native_transform` -- is the
**cleanup family's** path. Agent, Translate and Prompt Enhance each branch away
from it in the pipeline, and the case that made this urgent is precisely one of
those: on 2026-08-10 a leaked prompt sentence reached an agent as an instruction
and was followed. A repair inside the cleanup path would have missed it.

### The address defect, and why the cheap fix is not available

`fix das bitte` ships as `fixt das bitte`. Measured on 2026-08-03: three cases
in 167 records, the plural already present in `raw_transcript` in all three, and
cleanup passing it through unchanged. It cannot be otherwise -- `Schreibt mir
bitte dafür einen Prompt` is correct German and nothing in the text marks it
wrong.

The rule that suggests itself is a suffix rule: the singular imperative of a
weak German verb is the bare stem, the plural is the stem plus `-t`, so rewrite
`stem+t` at the start of a sentence. **It is unusable, and the owner's own
history is the counter-evidence.** `-t` on a weak stem is also the third person
singular indicative, and the same 136-record corpus carries `Macht das Sinn?`,
`Macht es überhaupt Sinn, dass…`, `Macht das wirklich Sinn?`, `Macht absolut
Sinn.` and `Wahrscheinlich macht dieses Markdown-Ding davor mehr Sinn` -- six
and more legitimate uses against three real defects. A suffix rule rewrites
every one of them. A scan for the naive form flags 45 tokens in 31 of 136
records, of which 3 are the defect.

The record already said the distinction needed is grammatical mood in context,
and that a dictionary entry cannot express it. What it did not say is that the
product dictates in **more than one language**, and a rule that encodes German
morphology has no business running over Dutch, Danish or English.

## Decision

**`core::recognizer_repair` is a stage between the confidence gate and the mode
branch.** Both repairs run there, in one place, and their outcomes are prepended
to `applied_rules` so the record reads in pipeline order: what the recogniser
stage did, then what the mode did. A repair that acted on every delivery and was
reported on none would be the invisible damage this cluster is about.

**The retry runs it too.** A retry is a fresh transcription and leaks exactly
like any other.

**The raw transcript is cloned before the stage.** Same argument as ADR 0080's:
the record keeps what the recogniser produced, or the defect stops being
measurable.

### The address repair reads mood, and every gate is pinned by real German

It fires only when **all** of the following hold, and each one is a corpus
entry:

- the verb opens the sentence, and is in a **closed table** of plural
  imperatives rather than derived by suffix;
- the sentence is not a question;
- the word after the verb is not a second-person-plural or formal pronoun
  (`ihr`, `euch`, `Sie`) -- which is what keeps `Denkt ihr was passendes aus?`
  out of reach, correctly: that sentence is internally consistent and nothing in
  the text says the speaker meant one person;
- the clause carries positive evidence of the imperative mood -- a particle
  (`bitte`, `mal`, `nochmal`, `einfach`, `ruhig`) or a singular addressee
  (`dir`, `dich`).

`doch` and `denn` are excluded from the particle list because both are at home
in a question. Verbs that appear in the source history **only** as indicatives
-- `geht`, `kommt`, `nimmt`, `setzt` -- are excluded from the table even though
the gates would decline them anyway, so that a gate would have to fail twice
before ordinary German is rewritten.

### The language gate, and the asymmetry behind it

**The two repairs do not have the same relationship to language, and the code
says which is which.**

- **The echo strip is language-agnostic by construction.** It compares the
  transcript against the prompt *this request sent*, whatever language that
  prompt is written in. The floor happens to be bilingual and `Likely phrases:`
  happens to be English; neither fact is load-bearing.
- **The address repair is German morphology and runs only over German.** No
  other language in reach has the bare-stem/stem-plus-`-t` imperative pair that
  IS the defect, so outside German the rule would be rewriting words on the
  strength of a coincidence.

**Language means detected first, configured second.** The Groq lane requests
`verbose_json` and gets a detected language on every response, which is what
makes this work in practice: the owner's own records carry no configured
language at all, so gating on the profile alone would have disabled the repair
for the person who reported the defect.

**An unestablished language declines the repair.** That is the deliberate trade,
and it is the same one the whole leg is built on: a missed repair leaves a
readable sentence addressed to the wrong number of people, while a wrong repair
rewrites a word nobody said into fluent German that no downstream stage can
question. The local lane returns `json` and carries no detected language, so
there the profile's language setting is what enables this -- an honest
limitation, recorded rather than papered over.

## Consequences

Two classes of recogniser damage are removed before any mode, any model and any
insert sees them, on every branch including the retry.

**The address defect is narrowed rather than closed.** The repair reaches the
two of three measured shapes that carry evidence; `Denkt ihr …?` stays out of
reach by design, and that is the record's own reading. The rate is a floor, not
a rate: the scan only catches forms in a fixed verb list.

**A German-only rule is now a stated fact rather than an accident.** The next
rule of this kind -- and there will be one, because mood, case and agreement are
all German-shaped problems -- has a gate to hang itself on and a corpus row
showing what "not German" has to mean.

Corpus: `recognizer_pluralized_address` and its three false-positive /
out-of-reach / language-gate variants in
`src-tauri/tests/fixtures/regression_transcripts.json`, driven by
`corpus_drives_singular_address_assertions` -- which runs the whole stage rather
than the rule, so the language gate is under test alongside the grammar, and
which carries the same transcript under `de` and under `en` with only one of
them rewritten.

## References

- [singular-address-becomes-plural.md](../known-issues/singular-address-becomes-plural.md)
  -- the measurement, and the argument against a dictionary entry this extends
- [cleanup-invents-tokens-on-broken-input.md](../known-issues/cleanup-invents-tokens-on-broken-input.md)
  -- what the stage after this one does with damage that reaches it
- [ADR 0080](0080-wordscript-removes-its-own-prompt-from-the-transcript-and-never-restores-what-it-displaced.md)
  -- the other repair in this stage
- [ADR 0036](0036-correctness-holds-without-a-configured-profile.md) -- the
  blank-state principle for recogniser-side repairs
