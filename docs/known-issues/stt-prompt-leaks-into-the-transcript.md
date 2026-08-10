# WordScript's Own Initial Prompt Is Transcribed Into the Output

Status: **Open, measured, not fixed.** Found 2026-08-10 from the owner's report
that a recurring sentence *"überschreibt oft entweder den Anfang oder das Ende
oder irgendeinen ganzen Absatz in der Transkription und verschluckt oft viel."*

**The recurring sentence is ours.** It is the initial prompt WordScript sends to
Whisper, echoed back by the decoder as if it had been spoken.

## What is sent

`core::transcription_hints::build_transcription_prompt` puts one of two things
in front of every request:

- with no opted-in profile terms, the constant floor
  `BLANK_STATE_RECOGNIZER_PROMPT` (ADR 0036):
  `"Dictated notes. Normal sentences with punctuation and capitalization.
  Diktierte Notizen. Normale Sätze mit Satzzeichen und Groß- und
  Kleinschreibung."`
- with terms, `"Likely phrases: <term>; <term>; …"`

Both are echoed. This is not a mishearing and not a classical hallucination: it
is **prompt leakage**, a documented Whisper behaviour in which the decoder
continues its prefix instead of transcribing the audio.

## Measured, on the owner's `history.json`, 2026-08-10

141 records.

| | Count | Share |
| --- | --- | --- |
| Raw transcript contains prompt text | **21** | **15 %** |
| Delivered text still contains it | **13** | **9 %** |
| The AI stage removed it | 8 | — |

- **Both forms leak.** 9 records echo the constant floor, 12 echo
  `Likely phrases: …`. The floor is not the only offender, so removing it alone
  would not close this.
- **Position: anywhere.** Of the floor echoes: 2 at the start, 5 at the end,
  3 mid-text. The owner's report of "beginning, end, or a whole paragraph"
  matches exactly.
- **It costs content.** Affected raw transcripts have a median length of 384
  characters against 175 for clean ones, and the echo appears where speech
  should be. One sample is the owner's own message to the assistant, cut off
  mid-sentence: the raw ends `"…ohne irgendeine AI-Stage. Normale Sä"` where the
  spoken sentence continued. **The words that were displaced are gone** — the
  decoder emitted prompt tokens instead of transcribing them, and no downstream
  stage can recover what was never written down.
- **The AI stage is not a safety net — it is an accomplice.** 9 of 9 floor
  echoes survived cleanup into the delivered text, because a leaked prompt is a
  well-formed German sentence and cleanup's job is to keep well-formed German
  sentences. Nearly one dictation in ten is delivered to the user carrying
  WordScript's own prompt.
- **All observed on the Groq lane, `General writing` profile, status
  `completed`.** The local lane is unmeasured, not exonerated.

## Why this is its own record

`transcription-hallucination.md` is about the decoder falling into the
**subtitle corpus** — "Thank you for watching", ZDF credits — on quiet or
damaged audio. This record is about the decoder falling into **the text we
handed it**. They are the same mechanism pointed at a different attractor, and
they need separate records because the mitigation for the first one *is* the
cause of the second.

`transcription-accuracy.md` is the general complaint that accuracy is poor. This
is the first identified, measured cause under it.

## The uncomfortable part: the mitigation became the defect

ADR 0036 added the floor prompt deliberately and for a good reason — an empty
prompt is not a neutral one, and the nearest attractor on quiet audio is the
subtitle corpus. Its own opening argument is:

> The defect is that **visible damage became invisible damage**: `c a u d e
> code` gets repaired by hand on sight, while `CAUDE-Code` is capitalized and
> hyphenated — the shape of a real product name — and ships.

A leaked prompt is exactly that failure, produced by the fix for it. *"Normale
Sätze mit Satzzeichen und Groß- und Kleinschreibung"* is grammatical, correctly
punctuated German in the register of the surrounding text. It ships.

**So the direction of the fix follows from ADR 0036's own reasoning**, and this
record does not simply propose reverting it.

## Options, and a recommendation

1. **Strip our own prompt from the STT output, deterministically. Do this
   first.** It is the one hallucination class that can be removed with
   certainty rather than heuristically: **we know the exact string we sent.** A
   post-STT pass that removes an echo of the current request's own prompt —
   whole or as a leading/trailing fragment — is a string operation on known
   input, not a guess about meaning. `core::hallucination_detect` is where it
   goes.
   **It does not recover the swallowed words**, and it must not pretend to: the
   result should be visibly short rather than plausibly complete. That is
   ADR 0036's principle applied to its own side effect.
2. **Measure per-form leak rates and shorten what leaks most.** ADR 0017 already
   records that a longer initial prompt causes repetition loops and language
   drift. `Likely phrases: …` leaked more often than the floor here (12 vs 9)
   and is the unbounded one. Worth a per-send rate before any redesign.
3. **Re-open whether the floor should be sent at all** — but only with the
   measurement ADR 0036 never had. It was adopted against a documented attractor
   without a rate for either failure, so "prompt vs no prompt" is currently a
   trade between one measured defect (this one, 15 %) and one argued defect. Do
   not revert it on the strength of this record alone; a new ADR with both rates
   is what that decision needs.
4. **Check whether the provider can suppress prompt echo.** Unmeasured; the
   Groq/OpenAI transcription API surface is the place to look before building
   anything.

## Consequence right now, before any fix

**The owner dictates briefs into WordScript.** Roughly one in ten of his
dictations is delivered carrying this text, so it reaches agent briefs, issues
and commit messages.

The working rule this replaces was "a sentence that matches nothing may be a
mishearing — ask". It is now sharper: **a sentence matching the prompt text
above is WordScript's own, is never something the speaker said, and can be
deleted on sight without asking.** Grep the two strings; they are constants.

## Related

- [transcription-accuracy.md](transcription-accuracy.md) — the general
  complaint this is the first measured cause of.
- [transcription-hallucination.md](transcription-hallucination.md) — the same
  mechanism aimed at the subtitle corpus; its mitigation is this record's cause.
- [cleanup-invents-tokens-on-broken-input.md](cleanup-invents-tokens-on-broken-input.md)
  — the stage that failed to catch it, 9 times out of 9.
- ADR 0036 (the floor prompt), ADR 0017 (prompt length causes drift),
  ADR 0032 (why profile topics never reach the recognizer).
