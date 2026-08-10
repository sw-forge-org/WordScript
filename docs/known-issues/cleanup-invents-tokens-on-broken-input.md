# Cleanup invents plausible tokens where the transcript is already broken

Status: measured 2026-08-02, partially addressed. One of three observed
categories has a deterministic guardrail; the other two still do not. Two of
the damage sources that feed it were removed upstream on 2026-08-10, and the
invention rate is now **splittable by whether the capture behind the transcript
was intact** — neither has been re-measured.

Found as a side observation while measuring profile-context width for ADR 0021.
It is **unrelated to that decision**: every case below occurred identically in
both arms of the measurement, so context width is not the cause.

## What was seen

96 real transcripts from `Product and engineering`, cleanup mode,
`llama-3.3-70b-versatile`. Three of the cases where the correction produced a
word the raw transcript did not contain:

**Spelled-out letters collapse into a nonword.** Whisper transcribed a spoken
product name letter by letter; cleanup fused the letters into a token that looks
real.

```
spoken: Claude Code
raw:    Bei c a u d e code oder codex Passt ja alles
out:    Bei CAUDE-Code oder Codex passt ja alles
```

**An aborted word gets completed.** The speaker broke off mid-word and
self-corrected; cleanup finished the fragment into a word that changes the
sentence.

```
raw:  Ich würde mich gerne politi... äh... ...teleportieren. Meine ich.
out:  Ich würde mich gerne politisch teleportieren. Meine ich.
```

**A compound is invented in a long rambling passage.** `Kann-Männer` appears in
the output with no corresponding source in the transcript.

The common shape: where the input is already damaged — spelled-out letters, an
abandoned word, a long unstructured passage — the correction prefers a
plausible-looking token over leaving the damage visible. That is the opposite of
what the prompt asks for ("If a token looks rare, technical, mixed-language or
uncertain, prefer the original over guessing").

The first case is the one that matters most, and not because of the wrong
letter. `c a u d e code` gets repaired by hand on sight; `CAUDE-Code` has the
shape of a real product name — capitalized, hyphenated — and ships unnoticed.
**Visible damage became invisible damage.**

## What is *not* the issue

Two words that looked wrong at first are correct German corrections, and any
metric has to exclude them: `Lieds` → `Lieder` and `switch` → `switcht`. A naive
"word not present in the raw transcript" count flags both. It is a proxy for
hallucination, not a measure of it.

## The measurement

Classifier: `classify_invented_tokens` in
`src-tauri/src/core/transform_context_measurement.rs`. Run it with

```text
cargo test measure_invented_tokens_in_shipped_corrections -- --ignored --nocapture
```

It spends no provider calls. `history.json` already holds the raw transcript
beside the text the user received, which is the pair a replay would have spent
Groq calls to reconstruct — with the advantage that it is the model, profile and
mode that really ran rather than today's approximation of them.

**What was measured (2026-08-02).** 197 records from the developer's live
`~/.config/WordScript/history.json`, all under profile
`curated-product-engineering`, correction model `llama-3.3-70b-versatile`,
processing mode `auto`. Two agent-mode records were excluded: that mode writes
an artifact from an instruction (ADR 0026), so every word in its output is new by
construction. The measured profile content at the time of the run:

- context: `feature names`, `bug IDs`, `release scope`, `API names`,
  `platform constraints`, `service names`, `migration steps`, `infra constraints`
- vocabulary: `triage summary`, `release note`, `qa handoff`, `incident update`
- dictionary: `api → API`, `sdk → SDK`, `s q l → SQL`, `ci cd → CI/CD`,
  `s l o → SLO`, `pull request → PR`, `word script → WordScript`

**Result.** The classifier flagged 14 of 197 records (7.1 %). Read by hand, 12
of those are real and 2 are false positives, both short inflections the
derivation rules do not reach: `making` → `make` and `leg` → `lege`.

**Verified rate: 12 / 197 = 6.1 %**, inside the 2–10 % band the plan fixed in
advance, which reads: build the guardrail.

The 14 tokens in those 12 records fall into three groups:

| Group | Count | Example |
|---|---|---|
| A damaged word became a plausible word | 7 | `das macht zun` → `das macht Sinn` |
| A foreign-language token was translated | 4 | `für jede brand` → `für jede Marke` |
| A gap was filled where the passage was garbage | 3 | `Deswegen war meine ___` → `Deswegen war meine Idee` |

Two facts about this distribution decided what got built:

1. **Zero letter-run merges and zero aborted completions in 197 records.** The
   category that started this record does not appear in the corpus at all. It is
   real — the `Claude Code` case is ground truth — but it is rare.
2. **Only the letter-run merge is deterministically detectable.** Nothing in the
   text distinguishes `welt` → `wählt` (a correct repair) from `zun` → `Sinn`
   (an invention) without knowing what was said. Groups A and C are out of reach
   of any rule that only sees the transcript.

## What was done

`spelled_letter_merge_reverted`, the fifth guardrail in `normalize_correction`
(`src-tauri/src/core/transform.rs`). Where the original holds a run of at least
three isolated single letters, a correction may not fuse them into a token the
original does not contain; the letters go back in, spaced as the recognizer left
them.

It **repairs the token instead of discarding the correction**, which is what the
other four guardrails do. Their trade is right for what they catch — an answered
question or an assistant reply is wrong end to end. Here one token is wrong, and
throwing away the cleanup of a five-minute dictation to undo it is a worse
outcome than the defect. The measurement is what settles that: this shape is
precise enough to act on surgically and too rare to justify a full discard.

Corpus: `cleanup_fuses_spelled_out_letters_into_a_product_name` and
`cleanup_keeps_a_correct_german_inflection` in
`src-tauri/tests/fixtures/regression_transcripts.json`, driven by
`corpus_drives_correction_guardrail_assertions`.

## What is still open

Groups A and C, 10 of the 14 observed tokens. No deterministic rule reaches
them, and a prompt rule is not an answer: the global system prompt already says
"If a token looks rare, technical, mixed-language or uncertain, prefer the
original over guessing", `c a u d e` is all four of those things at once, and the
model guessed anyway. A more specific rule beside a general one that is already
ignored buys prompt length, not reliability — and prompt rules are not
verifiable, since a test can only assert the sentence is in the prompt.

**That is still true on 2026-08-10, and this record did not gain a guardrail
this leg.** What it gained is upstream work and a way to measure the thing it
could not.

The upstream answer is the recognizer. `c a u d e` reaching the corrector at all
is a transcription failure, and ADR 0036 was the first move on that axis: the
blank-state prompt floor. **Whether it helps is still not measured — and it
turned out to have a cost of its own**, measured on 2026-08-10 at 12.5 % of raw
transcripts
([stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md)),
which is this record's own "visible damage became invisible damage" argument
landing on the fix that borrowed it.

### Two things upstream changed, and neither is a guardrail here

- **The recogniser's output is repaired before cleanup sees it**
  ([ADR 0081](../decisions/0081-the-recogniser-output-is-repaired-before-any-mode-sees-it.md)):
  the prompt echo is removed and a pluralized address is restored. Both are
  damage that would otherwise arrive at the corrector, and group A is *by
  definition* what the corrector does with damage. Whether removing two damage
  sources lowers the 6.1 % invention rate is **an open question with a way to
  answer it** — `measure_invented_tokens_in_shipped_corrections` re-run over a
  post-fix population — and not a claim.
- **A short capture is now marked on the record**
  ([ADR 0079](../decisions/0079-a-capture-states-how-much-of-its-own-clock-it-kept.md)).
  This is the link that put this record in the cluster: *broken input is what a
  short capture produces*. Until now the invention rate could only be measured
  across all records at once; `capture_integrity` makes it splittable by whether
  the audio behind the transcript was intact. If group A concentrates on short
  captures, its cause is upstream of the corrector and no cleanup-side guardrail
  was ever going to reach it. **That split is not measured yet** — on 2026-08-10
  only 2 of 11 short captures still had transcripts, and only 5 records carried
  a verdict at all.

The honest summary is unchanged: **one of three observed categories has a
guardrail, and the plan that produced it worked because the measurement came
first.** Groups A and C do not have one, and this leg did not build them a
speculative one — which is the same discipline, applied to the temptation to
declare progress.

Group B (translation) is a separate defect with its own existing rule — "keep the
language and any existing language mix exactly as dictated" — and it is being
violated. It has not been scoped.

## Related

- ADR 0021 — the measurement this was found in.
- ADR 0036 — the blank-state principle, and why a dictionary entry is not the fix.
- `docs/known-issues/transcription-hallucination.md` — the recognizer-side
  failures that produce the damaged input.
