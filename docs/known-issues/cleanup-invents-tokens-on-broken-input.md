# Cleanup invents plausible tokens where the transcript is already broken

Status: open (recorded 2026-07-30). Observed, not yet scoped.

Found as a side observation while measuring profile-context width for ADR 0021.
It is **unrelated to that decision**: every case below occurred identically in
both arms of the measurement, so context width is not the cause. It is recorded
here so it is not lost.

## What was seen

96 real transcripts from `Product and engineering`, cleanup mode,
`llama-3.3-70b-versatile`. Three of the cases where the correction produced a
word the raw transcript did not contain:

**Spelled-out letters collapse into a nonword.** Whisper transcribed a spoken
product name letter by letter; cleanup fused the letters into a token that looks
real.

```
raw:  Bei c a u d e code oder codex Passt ja alles
out:  Bei CAUDE-Code oder Codex passt ja alles
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
what the prompt asks for ("Wenn ein Token selten, technisch, gemischtsprachig
oder unsicher wirkt, bevorzuge das Original statt zu raten").

## What is *not* the issue

Two words that looked wrong at first are correct German corrections, and any
future metric has to exclude them: `Lieds` → `Lieder` and `switch` → `switcht`.
A naive "word not present in the raw transcript" count flags both. It is a proxy
for hallucination, not a measure of it.

## Why it is not fixed here

The trigger is upstream: `c a u d e` reaching the corrector at all is a
transcription failure, and the profile's replacement dictionary is the designed
place to normalize a product name. Whether the answer is a prompt instruction
about spelled-out letters, a detection rule for aborted words, or better
recognizer vocabulary is not established, and guessing between them is how the
last two prompt rules got their wrong justification.

## What would settle it

Count how often it happens. The replay harness in
`core::transform::context_measurement` already produces the raw/output pairs;
what is missing is a classifier for "output token with no source in the input"
that does not fire on legitimate morphology.

## Related

- ADR 0021 -- the measurement this was found in.
- `docs/known-issues/transcription-hallucination.md` -- the recognizer-side
  failures that produce the damaged input.
