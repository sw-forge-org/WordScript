# Raw Transcription Accuracy — Frequent Mishearings

Status: **Open, unmeasured.** Reported by the owner on 2026-08-10 against daily
use: *"Aktuell ist die Transkription sehr ungenau und es kommen sehr viele
solche Artefakte vor."* No measurement exists yet, which is the first thing this
record owes.

## Symptom

Dictated speech comes back with words the speaker did not say. The output is
fluent, grammatical and plausible — it is simply wrong, and it is wrong in a way
that survives every downstream stage, because nothing after the recognizer has
any evidence that a substitution happened.

Frequency is the new part of the report. Individual mishearings were already
known; what is reported now is that they are **common enough to change how the
product is used**, because a dictated brief has to be re-read before it can be
trusted.

## Why this is not `transcription-hallucination.md`

The two are neighbours and they are not the same failure, so they get separate
records:

| | Hallucination | Mishearing |
| --- | --- | --- |
| What happens | Content appears that was **not spoken at all** — subtitle labels, closing phrases, music markers, a language shift | Content that **was spoken** comes back as different words |
| Where it is visible | Often at the edges: trailing silence, after a pause, very short utterances | Anywhere, mid-sentence, at normal speaking volume |
| Detectable downstream | Partly — `is_hallucination` catches known whole-output and prefix phrases | **Not at all.** A mishearing is well-formed text; no string filter can see it |
| Mitigation that exists | The approved slice of 2026-07-29 | None |

`cleanup-invents-tokens-on-broken-input.md` is the stage after this one: it
records what the AI stage does when it is handed a damaged transcript. A
mishearing is the damage.

## Evidence in hand, and it is unusually direct

The owner dictates requirements into WordScript and pastes them into agent
briefs, so **the relay itself carries dated samples of this defect**:

- **2026-08-10, traced to its source the same day, and it turned out to be
  ours.** A brief contained the sentence *"Normale Sätze mit Satzzeichen und
  Kleinschreibung."* It could not be placed against any surface, feature or
  file, had to be queried, and the owner confirmed it as an artifact.

  It appears verbatim in that entry's `raw_transcript`, so the recognizer
  produced it — and it is **WordScript's own initial prompt**, echoed back by
  the decoder. That has its own record now, with the measurement:
  [stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md).
  **15 % of raw transcripts carry prompt text and 9 % are delivered still
  carrying it.** It is the first identified, measured cause under this record —
  and it is not the whole of it, because it does not explain a substitution that
  looks nothing like the prompt.
- Earlier legs of the same relay record the general shape: a feature name in a
  brief that matches nothing in the repository is worth suspecting as a
  mishearing before it is worth searching for.

That is the failure at full strength: the artifact was **grammatical German in
the register of the surrounding text**, which is exactly why no filter can catch
it and why the reader spent effort on it before rejecting it.

## What is not known

Everything that would make this actionable:

- **No error rate.** There is no WER, no per-session count, and no way to say
  whether accuracy is worse than last month or worse for one profile than
  another. "Very inaccurate" is the whole of the measurement today.
- **Which lane.** Groq `whisper-large-v3` and the local `whisper-cli` path are
  both in use and the report does not separate them.
- **Whether the input is the cause.** Microphone, level, room, and the
  ~-26 dBFS speech threshold the level meter draws are all upstream of the
  recognizer and none of them is recorded per transcription.
- **Whether the profile's vocabulary is reaching the recognizer.** Terms exist
  per profile (`vocabulary_hints`) and the runtime decides how many reach the
  bias; `stt-hints-bypass-the-vocabulary-opt-in.md` is an open record in that
  same area. A term that never arrives cannot repair the word it was added for.
- **Whether language mix is a factor.** The samples are German dictated by a
  speaker who also writes English, which is the condition
  `transcription-hallucination.md` already identifies as adverse.

## The surface you would check it on shows the wrong text first

History's row title is the **written** text — what the AI produced — and the
recogniser's own words are one click away behind *View raw*. That is right for
a record of what you got and wrong for judging what was heard, which is the job
this record needs the screen to do. The data is correct and complete
(`raw_transcript` is the provider's response before any transform, and 92 of 142
records differ from their transformed text); it is the default view that is
unhelpful. Recorded in the relay's §2.5 as a decision for Leg 4d rather than
changed unilaterally, because the title is drawn and the gallery is the source
(ADR 0057).

One defect found while checking this and already fixed: the raw panel's foot
claimed *"Identical — no AI stage ran on this one"* whenever the two texts
matched, which was false on all 50 such records on this machine — an AI stage
had run on every one of them. Equal outputs are not evidence that nothing ran.

## Next steps, cheapest first

1. **Capture instances instead of describing them.** Every mishearing that
   costs a round trip goes into
   `src-tauri/tests/fixtures/regression_transcripts.json` (loader:
   `core::regression_corpus`, 26 entries today) with a `failure_mode` of its
   own, plus a matching synthetic test. That turns a complaint into a corpus,
   and the corpus is the only thing that can show a change is an improvement.
   The 2026-08-10 sample above is the first candidate.
2. **Record what the audio looked like.** The history entry already carries the
   provider, the model and the profile; the input level summary is emitted on
   the `empty` event and kept nowhere. Persisting a peak/mean per transcription
   would separate "the recognizer is wrong" from "the microphone is quiet"
   without any new capability.
3. **Separate the lanes in the report.** A per-lane count is a filter over data
   the history already holds, once instances are being marked at all.
4. **Then, and only then, the model question.** Whether
   `whisper-large-v3-turbo` versus `whisper-large-v3` versus a local
   faster-whisper path changes the rate is a real question and it is unanswerable
   without step 1 — every one of them will feel better on the day it is
   installed.

## Consequence for anyone reading a brief

Two rules, and the first is now sharper than "ask":

1. **A sentence matching WordScript's own initial prompt is WordScript's own.**
   It is never something the speaker said and can be deleted on sight without
   asking. The two constants are in
   [stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md);
   roughly one dictation in ten is delivered carrying one of them.
2. **Anything else that matches nothing in the repository, the plan or the
   drawing is a candidate mishearing** and is worth one direct question rather
   than an hour of searching. That has happened often enough to be a working
   rule rather than an anecdote.
