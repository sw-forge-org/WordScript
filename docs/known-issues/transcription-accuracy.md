# Raw Transcription Accuracy — Frequent Mishearings

Status: **Open. Partly measured 2026-08-10: two identified causes now have rates
and deterministic fixes, and the one question that would tie this record to the
capture defect is still NOT ANSWERABLE — re-run 2026-08-11 and unchanged, for
the same reason. What 2026-08-11 added: the input level is persisted per
transcription (ADR 0083), and the first genuine mishearing is in the corpus.**
Reported by the owner on 2026-08-10 against daily use: *"Aktuell ist die
Transkription sehr ungenau und es kommen sehr viele solche Artefakte vor."*

There is still no WER and no general accuracy rate, so the headline complaint
stays open.

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

## The measurement that would join this cluster together — attempted, and it cannot be taken yet

This record's neighbours describe the same failure class at different stages:
a capture loses half its audio, the recogniser echoes our own prompt, the
recogniser pluralizes an address, and cleanup invents tokens where the input is
already broken. The question that would turn four suspicions into one located
cause is: **does a capture that lost audio produce a transcript with more
mishearings in it?**

It was attempted on 2026-08-10. The harness is
`cargo test measure_capture_integrity_against_transcripts -- --ignored --nocapture`,
and it spends nothing: it joins `wordscript-runtime.log` to `history.json` by
timestamp.

**The join works and the data does not overlap.**

- 634 captures paired across both runtime logs; **136 of 136 history records
  joined to a capture**, gaps of 1.3–12.1 s, which is the pipeline itself.
- 11 captures are short past the 10 % threshold.
- **Only 2 of those 11 still have a transcript.** The other 9 outlived them:
  the runtime log and `history.json` have different retentions, and history's
  is the shorter one.

So the correlation is not weak — it is untestable, and that is a **retention
artifact rather than a result**. Reporting it as "no correlation found" would
have been the worst available outcome, because it would have closed the
question with an answer nobody measured.

**The reason is fixed rather than the correlation.**
[ADR 0079](../decisions/0079-a-capture-states-how-much-of-its-own-clock-it-kept.md)
puts the verdict on the history record itself, so the next run needs no join at
all: a record carries what its own capture measured, and the harness counts how
many records answer for themselves. Five did on the evening it shipped.

### What the same run did measure

- **The prompt leak**, on 136 records: **12.5 % of raw transcripts carry prompt
  text, 6.6 % are delivered still carrying it.** `Likely phrases` is the bigger
  half at 10 of 17 leaking records. Fixed in the delivery by
  [ADR 0080](../decisions/0080-wordscript-removes-its-own-prompt-from-the-transcript-and-never-restores-what-it-displaced.md);
  the raw transcript deliberately keeps it so this rate stays readable.
- **The pluralized address**: a naive suffix scan flags 45 tokens in 31 of 136
  records, of which **3 are the defect** — a 15:1 false-positive ratio that is
  why [ADR 0081](../decisions/0081-the-recogniser-output-is-repaired-before-any-mode-sees-it.md)
  reads mood rather than suffix.
- **Transcript density**: a median of 8.4 characters per recorded second across
  116 records. The one short capture with a surviving transcript ran at 3.1
  characters per *wall-clock* second — the signature the capture record
  describes, seen again.

## Re-run 2026-08-11: the join is still empty, and a real substitution is finally on record

Same harness, two days later. 636 captures paired, 138 history records, **138 of
138 joined**, and **7 records now carry their own verdict against 5**. Every one
of the 7 is `intact`.

**The correlation remains unanswerable, and the reason has changed.** On
2026-08-10 it was a retention artifact — the short captures had outlived their
transcripts. Today the join is not needed at all, and the blocker is simply that
**no short capture has been recorded since ADR 0079 shipped**. Both are
population facts and neither is a result. An empty group is not evidence that
short captures are clean.

### The first genuine mishearing, and it came with its own ground truth

`recognizer_mishears_a_technical_term` in
`src-tauri/tests/fixtures/regression_transcripts.json`. Record
`history-1786387983612-133`, `whisper-large-v3` on the Groq lane:

```
spoken:  Installiere tmux auf dieser Maschine …
raw:     Installiere D-Max auf dieser Maschine …
```

This is the entry step 1 below has been asking for: **neither identified cause**
— not the prompt leak, not the pluralized address — and therefore the first
measurement the headline complaint has of its own.

**The truth is not inferred.** `applied_rules` carries `overlay_edit`, so the
owner retyped the word in the overlay before delivery: `tmux` is his own
wording, not a guess about what he meant. That makes the whole class of
`overlay_edit` records worth mining — **each one is a human-labelled correction
of the recogniser**, and this history holds exactly one so far.

It is also ADR 0036's argument at full strength. `D-Max` is capitalized and
hyphenated, the shape of a real product name — it is an Isuzu pickup — so the
damage is invisible and ships.

**Three stages decline it, and the corpus asserts all three.** The echo strip
has no prompt text to match; the address repair finds no plural imperative; and
`vocabulary_learning::detect_candidates` returns nothing.

**The third decline is the finding.** Promoting `tmux` into the profile
vocabulary is the one mechanism the product has that would stop this recurring —
the recogniser bias would then carry the term. It cannot reach this case:
`tmux` is four characters and `MIN_CANDIDATE_CHARS` is five. That floor is
deliberate, because a close match on a four-letter word is not evidence of
anything. **Recorded as a measured limit with a named cost rather than lowered
on the strength of one case** — the population that would justify moving it is
more `overlay_edit` records, and there is one.

## What is not known

Everything that would make this actionable:

- **No error rate.** There is no WER, no per-session count, and no way to say
  whether accuracy is worse than last month or worse for one profile than
  another. "Very inaccurate" is the whole of the measurement today.
- **Which lane.** Groq `whisper-large-v3` and the local `whisper-cli` path are
  both in use and the report does not separate them.
- ~~**Whether the input is the cause.**~~ **Half answered 2026-08-11, ADR 0083.**
  Peak, mean and the speech threshold they are read against are now on every
  record as `input_level`, and in the runtime log on every capture. Room and
  microphone model are still unrecorded, and the *rate* — how often a fluent
  transcript came off a too-quiet microphone — needs a population that only
  exists from today onward.
- **Whether the profile's vocabulary is reaching the recognizer.** Terms exist
  per profile (`vocabulary_hints`) and the runtime decides how many reach the
  bias; `stt-hints-bypass-the-vocabulary-opt-in.md` is an open record in that
  same area. A term that never arrives cannot repair the word it was added for.
- **Whether language mix is a factor.** The samples are German dictated by a
  speaker who also writes English, which is the condition
  `transcription-hallucination.md` already identifies as adverse.

## The surface you check it on can now show the heard text — fixed 2026-08-10

History's row title was the **written** text — what the AI produced — with the
recogniser's own words one click away behind *View raw*. That is right for a
record of what you got and wrong for judging what was heard, which is the job
this record needs the screen to do. The data was correct and complete the whole
time (`raw_transcript` is the provider's response before any transform, and 92
of 174 records differ from their transformed text); it was the default view that
was unhelpful.

**Leg 4d added a `Written` / `Heard` segment to History's toolbar
([ADR 0070](../decisions/0070-history-switches-which-of-a-records-two-texts-its-rows-carry.md)).**
It switches which text every row title carries, so the list can be scanned for
recogniser errors instead of opened fold by fold. `Written` stays the default,
so the screen at rest is unchanged; *View raw* is untouched and is still where
one record's two texts are compared side by side. This matters most for the
prompt leak, which lives in `raw_transcript` and is *cleaned away* by the
transform — under `Written` the recogniser fault is invisible by construction.

It makes the defect visible. It does not make it smaller, and this record stays
open until the rate below is measured.

One defect found while checking this and already fixed: the raw panel's foot
claimed *"Identical — no AI stage ran on this one"* whenever the two texts
matched, which was false on all 50 such records on this machine — an AI stage
had run on every one of them. Equal outputs are not evidence that nothing ran.

## Next steps, cheapest first

1. ~~**Capture instances instead of describing them.**~~ **Started 2026-08-10,
   and the gap it named is closed 2026-08-11.** The corpus went from 26 entries
   to 45: eighteen under `stt_prompt_leak`, `recognizer_pluralized_address` and
   `capture_lost_audio` on 2026-08-10, and the first `recognizer_mishearing`
   today. Every one is drawn from a dated record on this machine, and each has
   its negative counterpart. **The negatives are the point** — a rule that
   removes a leak must not remove the sentence in which the owner *complains
   about* the leak, and the corpus carries both.
   Still open: **one instance is not a rate.** A second and third substitution
   would say whether `D-Max` is representative or a one-off, and the cheapest
   source is more `overlay_edit` records.
2. ~~**Record what the audio looked like.**~~ **Done 2026-08-11, ADR 0083.**
   The capture's integrity (ADR 0079) separates "the recogniser is wrong" from
   "half the audio never arrived"; `input_level` now separates it from "the
   microphone is quiet". The mean is the part that was missing — a peak is set
   by one sample, so a cough sets it as well as speech does, and a dictation too
   quiet to transcribe could report a healthy peak.
   The mean is **reported and not acted on**: `too_quiet` still reads the peak,
   because the thresholds were derived against the peak and re-deriving them
   needs its own measurement.
3. **Re-run the correlation once records carry their own verdicts.** Nothing
   has to be built and nothing has to be re-run by hand: the harness reports how
   many records answer for themselves (7 of 138 on 2026-08-11, all `intact`),
   and the question becomes answerable the first time a short capture is
   recorded under ADR 0079. That capture will also carry a cadence line
   (ADR 0083), so it answers two questions at once.
4. **Separate the lanes in the report.** A per-lane count is a filter over data
   the history already holds, once instances are being marked at all.
5. **Then, and only then, the model question.** Whether
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
