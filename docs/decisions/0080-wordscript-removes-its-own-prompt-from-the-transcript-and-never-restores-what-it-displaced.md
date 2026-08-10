# 0080 -- WordScript removes its own prompt from the transcript, and never restores what it displaced

Date: 2026-08-10
Status: Accepted

## Context

Whisper echoes the initial prompt it is given back into the transcript, as if it
had been spoken.
[stt-prompt-leaks-into-the-transcript.md](../known-issues/stt-prompt-leaks-into-the-transcript.md)
measured it on 2026-08-10: 15 % of raw transcripts carried prompt text and 9 %
were delivered still carrying it. Re-measured the same day over the 136 records
still in history: **12.5 % raw, 6.6 % delivered.**

It is not a hallucination in the usual sense. The decoder continues its prefix
instead of transcribing the audio, so **the words it displaces are gone** -- one
sample ends `"…ohne irgendeine AI-Stage. Normale Sä"` where the spoken sentence
went on.

The uncomfortable part is that
[ADR 0036](0036-correctness-holds-without-a-configured-profile.md) caused it.
The blank-state floor was added against a documented attractor -- an empty
prompt is not a neutral one, and on quiet audio the decoder falls into the
subtitle corpus -- and its own opening argument was that **visible damage became
invisible damage**: `c a u d e code` gets repaired by hand on sight while
`CAUDE-Code` ships. A leaked prompt is exactly that failure produced by the fix
for it. *"Normale Sätze mit Satzzeichen und Kleinschreibung"* is grammatical,
correctly punctuated German in the register of the surrounding text, and it
ships.

On 2026-08-10 it fired twice inside an agent session, and one of those leaked
sentences reached an agent **as an instruction and was followed**.

Two facts from the measurement decide the shape of the fix, and neither is in
the record as written:

1. **The echo is a paraphrase, not a copy.** Every floor echo on this machine
   reads *"Normale Sätze mit Satzzeichen und Kleinschreibung"*; the constant
   says *"…und Groß- und Kleinschreibung"*. The decoder dropped two words out of
   the middle. `Likely phrases` arrives without its colon and without its terms,
   up to four times in one transcript. **An exact-string strip would have caught
   almost none of it.**
2. **The speaker sometimes says the prompt text out loud.** 2026-08-10 21:02:
   *"Sorry, diktierte Notizen, normale Sätze mit Kleinschreibung, das war ein
   Transkriptionsartefakt, genau das, was wir bekämpfen müssen."* He is
   complaining about the artifact. A rule that removes those words removes what
   he said.

## Decision

**A post-transcription pass removes an echo of the prompt THIS request sent, and
nothing else.** It is the one hallucination class that can be removed with
certainty rather than heuristically, because we know the exact string we sent.
The prompt is carried from the request that sent it and never rebuilt: a
reconstruction can drift from what went out, and then the certainty is gone.

**Matching is normalised and in-order, not literal.** A sentence is an echo when
at least 90 % of its words can be walked off in order against the prompt's --
which is what accommodates the two dropped words -- and when at least two of the
matched words are distinctive rather than function words. `Likely phrases` is
matched as a marker wherever it lands, with or without its colon or its
continuation.

**The unit is the sentence, and that is the whole discrimination.** A leaked
prompt arrives as a complete sentence of its own, at the start, the end or the
middle -- the record measured 2, 5 and 3. The one case where the speaker said
the prompt text is a clause spliced into a longer sentence surrounded by content
the prompt never carried, and it survives on exactly that.

**It does not recover the displaced words, and must not pretend to.** A
transcript that is nothing but the echo comes back **empty**. The result is
visibly short rather than plausibly complete, which is ADR 0036's own principle
applied to the side effect ADR 0036 caused.

**The raw transcript keeps the leak.** `raw_transcript` is cloned before the
stage runs, so History's `Heard` view and every future measurement still see
what the recogniser produced. Repairing the record as well as the delivery would
erase the only evidence this defect leaves -- it is measurable today precisely
because the raw transcript has been carrying it, and a rate that drops because
the fix hid it is not a rate.

**Vocabulary learning reads the repaired text, deliberately unlike the record.**
Learning reads a raw/final pair as evidence that a correction repaired a term;
handed the unrepaired text it would see the stripped prompt words as something
the correction removed, and could propose WordScript's own prompt as profile
vocabulary.

### What this decision does not do

**It does not revert the floor.** The record's third option -- re-open whether
the floor should be sent at all -- needs a rate for the failure ADR 0036
prevents, and nobody has one. Reverting on the strength of this record alone
would trade one measured defect for one argued defect in the opposite direction.

**It does not shorten `Likely phrases: …`,** which leaked more often than the
floor (10 of 17 leaking records here). That is the record's second option and it
is still open.

## Consequences

Roughly one dictation in ten stops being delivered carrying WordScript's own
prompt. The words the echo displaced are still lost, and the result now says so
by being short.

**The working rule for anyone reading a dictated brief survives**, because the
raw transcript still carries the leak and briefs are pasted from delivered text
that may predate this: a sentence matching the prompt text is WordScript's own,
is never something the speaker said, and can be deleted on sight.

Corpus: seven entries under `stt_prompt_leak` and
`stt_prompt_leak_false_positive` in
`src-tauri/tests/fixtures/regression_transcripts.json`, driven by
`corpus_drives_prompt_echo_assertions`, which requires both directions and
asserts a declined strip leaves the transcript byte-identical.

## References

- [stt-prompt-leaks-into-the-transcript.md](../known-issues/stt-prompt-leaks-into-the-transcript.md)
  -- the measurement and the four options, of which this is the first
- [transcription-hallucination.md](../known-issues/transcription-hallucination.md)
  -- the same mechanism aimed at the subtitle corpus
- [ADR 0036](0036-correctness-holds-without-a-configured-profile.md) -- the floor
  prompt, and the argument this decision borrows against its own side effect
- [ADR 0017](0017-vocabulary-moves-out-of-the-whisper-prompt.md) -- why a longer
  initial prompt is itself a cause of drift
- [ADR 0081](0081-the-recogniser-output-is-repaired-before-any-mode-sees-it.md) --
  the stage this runs in
