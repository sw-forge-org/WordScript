# WordScript's Own Initial Prompt Is Transcribed Into the Output

Status: **Open — the echo is removed from the delivery since 2026-08-10
(ADR 0080); the recogniser still produces it and the displaced words are still
gone.** Found 2026-08-10 from the owner's report that a recurring sentence
*"überschreibt oft entweder den Anfang oder das Ende oder irgendeinen ganzen
Absatz in der Transkription und verschluckt oft viel."*

**The recurring sentence is ours.** It is the initial prompt WordScript sends to
Whisper, echoed back by the decoder as if it had been spoken.

**2026-08-12: how much gets displaced.** This record measures the rate at which
prompt text appears; it does not say what it costs. Two events that night put a
single prompt term — `Agenten` — at the point where a dictation stopped making
sense, and everything after it was lost: in one case the remainder of a 55-second
recording whose audio the capture had kept in full. Recorded with the numbers in
[transcript-stops-before-the-audio-does.md](transcript-stops-before-the-audio-does.md).
The prompt in both was `"Likely phrases: Agenten; etwas"` — two ordinary German
words the runtime had learned by itself, not terms anybody opted in.

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

## Re-measured 2026-08-10, and two things the first pass did not see

136 records still in history, a rotated population rather than the 141 above.

| | Count | Share |
|---|---|---|
| Raw transcript contains prompt text | **17** | **12.5 %** |
| Delivered text still contains it | **9** | **6.6 %** |

Same order of magnitude, and `Likely phrases` is the bigger half again: 10 of
the 17 leaking records carry it, against 6 for *"Normale Sätze mit
Satzzeichen…"* and 3 for *"Diktierte Notizen"*.

**1. The echo is a paraphrase, not a copy.** Every floor echo on this machine
reads *"Normale Sätze mit Satzzeichen und Kleinschreibung"*. The constant says
*"…und **Groß- und** Kleinschreibung"* — the decoder dropped two words out of the
middle. `Likely phrases` arrives **without its colon and without its terms**,
sometimes as *"Likely phrases in the text"*, and up to four times in one
transcript:

```
…Also... Likely phrases Hmm Likely phrases Hmm Also, ich hab 35 Euro Bitcoin…
```

A strip matching the exact string we sent would have caught almost none of it.
This is the single most important correction to this record: it is what makes
the fix a normalised in-order match rather than a `contains`.

**2. The speaker sometimes says the prompt text out loud.** 2026-08-10 21:02:

```
Sorry, diktierte Notizen, normale Sätze mit Kleinschreibung, das war ein
Transkriptionsartefakt, genau das, was wir bekämpfen müssen.
```

He is complaining about the artifact, in the middle of a dictation. Every word
of the echo is there and **none of it is the recogniser's**. Any rule that
removes prompt words on sight removes what he said. What separates it is that
this is a *clause* spliced into a longer sentence surrounded by content the
prompt never carried, while a leak arrives as a complete sentence of its own —
so the fix reads sentences, and nothing coarser would have worked.

### What shipped

[ADR 0080](../decisions/0080-wordscript-removes-its-own-prompt-from-the-transcript-and-never-restores-what-it-displaced.md),
option 1 of the four below. `core::recognizer_repair::strip_prompt_echo` removes
an echo of the prompt **this request sent**, carried from the request rather
than rebuilt. It runs in a stage ahead of the mode branch
([ADR 0081](../decisions/0081-the-recogniser-output-is-repaired-before-any-mode-sees-it.md)),
because the fresh live case below reached an *agent*, not a cleanup.

It does not recover the swallowed words and does not pretend to: a transcript
that is nothing but the echo comes back **empty**, and the applied rule
`prompt_echo_stripped` says so on the record.

**`raw_transcript` deliberately keeps the leak**, so the rate above stays
measurable and History's `Heard` view still shows what the recogniser produced.
A rate that falls because the fix hid it is not a rate.

Options 2, 3 and 4 are untouched and still open.

## The fresh live case, 2026-08-10: a leaked sentence was followed as an instruction

It fired twice inside one agent session that day. One of the two is this,
delivered whole:

```
Normale Sätze mit Satzzeichen und Kleinschreibung. Eine eigene Task.
```

The second sentence is the owner's. The first is ours, and it reached an agent
**as an instruction and was acted on**. That is the failure at full strength:
the leak does not merely add noise to a brief, it adds a *directive* in the
register of the surrounding text, and the reader downstream has no way to tell
it from something the owner asked for.

It is also why the strip runs before the mode branch rather than inside the
cleanup path — Agent, Translate and Prompt Enhance each branch away from it, and
a fix in the cleanup path would have missed exactly this case.

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

1. ~~**Strip our own prompt from the STT output, deterministically.**~~
   **Done 2026-08-10, ADR 0080.** It landed in `core::recognizer_repair` rather
   than `core::hallucination_detect` as proposed here, and the reason is the
   agent case above: the strip has to run before the mode branch, and
   `hallucination_detect` is reached from `apply_native_transform`, which is the
   cleanup family's path. It also matches an in-order normalised subsequence
   rather than a fragment of the exact string, because the echo turned out to be
   a paraphrase.
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

## Consequence for anyone reading a brief, and it outlives the fix

**The owner dictates briefs into WordScript.** Roughly one in ten of his
dictations *was* delivered carrying this text, so it has already reached agent
briefs, issues and commit messages — and briefs are pasted from delivered text
that predates ADR 0080. The rule below therefore stays in force.

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
