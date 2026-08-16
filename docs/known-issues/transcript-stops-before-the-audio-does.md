# Bug: the transcript stops before the audio does

Status: **Open — instrumented 2026-08-12 (`69f8c75`), cause not located, and
nothing in the product reacts to it.** Three events measured the same night, all
on audio the capture read as `Intact`. The verdict exists only as a log line:
it is not persisted, and a `Truncated` transcript still goes through transform
and insert and is delivered as a success.

**Revised the same day: there are two shapes, and the instrument only sees
one.** The recogniser either stops early, leaving a measurable uncovered tail,
or it keeps emitting to the end of the audio and puts WordScript's own prompt
words where the speech was. The second shape reads `uncovered_ratio=0.0000
verdict=Complete` while half the dictation is gone. **The recurring word at the
break — `Agenten` — is ours**, and the evidence chain to it is below.

**2026-08-16: a fourth event, four days later, with every instrument green and
the confidence signal inside the healthy band.** The prompt's slot-1 term stands
at the break again, on a new term list. Section
[2026-08-16 22:08 below](#2026-08-16-2208--a-fourth-event-and-every-instrument-passed-it).

First reported: 2026-08-12 00:16, by the owner — *"Jetzt gerade eben wurde ein
Teil meines vorherigen Diktats verschluckt, der letzte Teil."*
Affected area: `core::providers` — the speech lane, not `core::capture`.

## Symptom

A dictation comes back shorter than it was spoken. The text that arrives is
fluent, grammatical and correctly punctuated; it simply ends early, sometimes
mid-sentence. Every stage before it reports success, because every stage before
it *was* successful.

**This is the far side of
[capture-loses-half-the-recording.md](capture-loses-half-the-recording.md), and
the two are easy to confuse.** There, the audio never reached the file. Here the
audio is complete and the transcript is not. The user's report is identical in
both cases — half the dictation is missing — which is why the two need separate
verdicts on separate counters.

## The two measured events, 2026-08-12

### 00:15:32 — 72.1 s, found by reading the text

```text
Capture integrity  wall_seconds=72.170 recorded_seconds=72.144 missing_ratio=0.0004 verdict=Intact
Capture cadence    callbacks=6214 longest_gap_ms=21 gaps_over_200ms=0 signature=no_gaps
Groq transcription complete text_len=424 duration=Some(72.144437248)
```

The provider reports back the same 72.144 s the capture recorded, so the file it
received was whole. The delivered text ends mid-sentence:

> …Weil Hardcoden macht bei so vielen Providern nicht so wirklich Agenten

The correction stage is not the cause: the guardrail rejected the model's
rewrite (`correction_guardrail_fallback`, `suspicious_start=true`) and the raw
recogniser output went to the clipboard at 423 characters. There is no coverage
line for this event — the instrument landed nineteen minutes later.

### 00:36:30 — 74.4 s, found by the instrument

```text
Capture integrity       wall_seconds=74.374 recorded_seconds=74.362 missing_ratio=0.0002 verdict=Intact
Capture cadence         callbacks=6405 gaps_over_200ms=0 signature=no_gaps
Transcription coverage  duration_seconds=74.362 covered_seconds=62.640 uncovered_ratio=0.1576 last_segment_avg_logprob=-0.378 verdict=Truncated
```

**11.7 seconds of recorded audio produced no segment at all.** The two ordinary
dictations either side of it in the same session read `Complete` with
`uncovered_ratio=0.0000`, so the instrument is not simply firing on length:

| Audio | Covered | Verdict | `last_segment_avg_logprob` |
| --- | --- | --- | --- |
| 74.362 s | 62.640 s | **Truncated** | **-0.378** |
| 7.070 s | 7.080 s | Complete | -0.205 |
| 15.999 s | 16.000 s | Complete | -0.206 |

The truncated segment's own confidence is markedly worse than its healthy
neighbours. That is the shape a decoder leaves when it stops early rather than
when it finishes — one observation, not a rate.

### 03:03:18 — 55.2 s, and the instrument says `Complete`

```text
Capture integrity       wall_seconds=55.258 recorded_seconds=55.240 missing_ratio=0.0003 verdict=Intact
Transcription coverage  duration_seconds=55.240 covered_seconds=55.240 uncovered_ratio=0.0000 last_segment_avg_logprob=-0.366 verdict=Complete
Groq transcription complete text_len=189 duration=Some(55.240249344)
```

The segments span the audio exactly, so nothing stopped early — and 189
characters for 55 seconds is 3.4 chars/s against 11.7 in the short band. The
text ends:

> …weil ich die gekauft habe von einem, der sie **Agenten schlagen**.

Reported by the owner as *"wieder ganz viel abgeschnitten von dem letzten Satz
und wieder mit dem Wort Agenten ersetzt"* — the same word that ended the 00:15
event. **This shape is invisible to the coverage check**, which measures how far
the segments reach and not what is in them.

## The word is ours

The request logs `prompt_chars=30` on every one of these events. The active
profile carries three vocabulary terms, all with `origin: "learned"` — the
runtime promoted them, nobody typed them:

`Agenten`, `etwas`, `keinen`

The prompt `build_transcription_prompt` produces from the first two is
`"Likely phrases: Agenten; etwas"` — **exactly 30 characters**, matching the
logged value to the character.

So the recogniser is being handed the word it then writes over the speech. That
mechanism is not new: it is
[stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md),
open, whose status line already states that ADR 0080 removed the echo from the
*delivery* while *"the recogniser still produces it and the displaced words are
still gone"*. What that record does not yet say is how much can be displaced —
here, the remainder of a 55-second dictation.

**How ordinary German words ended up in a recogniser slot.**
`use_as_prompt_hint` is `false` on all three, and that is irrelevant: it is a
migration remnant that nothing reads since ADR 0035. Slots are allocated by
`select_recognizer_slots` (`config.rs`), which deliberately ranks terms *below*
the deterministic-repair floor first — short terms, because long product names
are recoverable afterwards and short ones are not. Ordinary short words are
exactly what that rule selects, and `is_stt_hint_candidate` passes them.

The rule is behaving as ADR 0035 specified. What is missing is a filter before
it, and the earlier question of why `vocabulary_learning` promoted `etwas` and
`keinen` at all.

**Unverified, and worth checking before it is repeated as fact:** learned terms
are promoted from observed transcripts, and `Agenten` carries
`observation_count: 2`. If leaked prompt words appear in transcripts and the
learner promotes them, the leak feeds itself. That is a loop hypothesis, not a
finding.

## The instrument (ADR pending)

`TranscriptionCoverage` in `core::providers` compares the `duration` the
provider reports against where the last segment ends. Both fields were already
returned by `verbose_json` and already deserialized; only `text` was ever read.

It is the same instrument as `CaptureIntegrity` one stage later, and deliberately
carries the same 10 % threshold: a user reporting "half of it is gone" does not
know which side of the seam lost it, and two thresholds would put one sentence
on two numbers. A ratio alone would call an ordinary closing pause a loss, so a
verdict also requires two absolute seconds; the upload is silence-trimmed, so a
healthy transcript ends within a breath of the audio.

It sits on the shared `TranscriptionResponse` rather than in `groq.rs`, so the
adapters stage D adds inherit it instead of reimplementing it.

## What the instrument does not do

- **Nothing reacts.** `is_truncated` occurs exactly twice in `src-tauri/src`:
  its definition and one test. A truncated transcript is transformed, inserted
  and reported as a completed session.
- **It sees one of the two shapes.** Coverage measures how far the segments
  reach, not what is in them, so the 03:03 event reads `Complete` while half its
  dictation is missing. A second measure — text density against duration, or the
  prompt's own terms found in the output — would be needed for that one, and the
  prompt-leak record already computes the second on `raw_transcript`.
- **Nothing is persisted.** A history record carries `capture_integrity` and
  `input_level`; there is no coverage field. There is therefore no rate, only
  individual log lines — the same gap [ADR 0083](../decisions/0083-a-capture-reports-the-cadence-of-its-own-input-stream-and-the-level-it-was-given.md)
  closed for the input level.

Both are deliberate: what the product should do on `Truncated` — retry, warn on
the result surface, or refuse to insert — is a decision with ADR character and
is not made here.

## The signal across the history

140 captures paired across both runtime logs (`Capture integrity` against the
`Groq transcription complete` that follows it), by audio duration:

| Audio duration | n | mean chars/s | of which `Intact` |
| --- | --- | --- | --- |
| < 20 s | 92 | 11.7 | 81/92 |
| 20–50 s | 27 | 7.7 | 27/27 |
| 50–100 s | 15 | 6.9 | 15/15 |
| > 100 s | 6 | 5.0 | 6/6 |

**All 21 captures over 50 s are `Intact`** — every long dictation in the log
kept its audio. One of them carries `signature=stream_suspended` at
`missing_ratio=0.0139`, an order of magnitude below the threshold that names a
capture loss.

**This table is supporting evidence and not proof.** Text density falls with
duration for an innocent reason too: a long dictation contains more thinking and
more pauses. What it establishes is that the two events above are not isolated
enough to be dismissed; what proves the loss in those two cases is the
mid-sentence stop and the 11.7 s uncovered tail.

## 2026-08-16 22:08 — a fourth event, and every instrument passed it

Reported by the owner from the History panel with the missing tail marked by
hand: *~2 Sätze fehlen*. Record `history-1786910918745-50`, 54 s, profile
`Founder ops notes`, mode `cleanup`, Groq.

```text
Capture integrity       wall_seconds=54.007 recorded_seconds=53.975 missing_ratio=0.0006 verdict=Intact
Capture callback cadence callbacks=4649 longest_gap_ms=21 gaps_over_200ms=0 signature=no_gaps
Capture input level     peak_dbfs=-3.1 rms_dbfs=-23.0 clipped_ratio=0.0000 verdict=Ok
Groq transcription start model=whisper-large-v3-turbo prompt_chars=53
Transcription coverage  duration_seconds=53.615 covered_seconds=53.620 uncovered_ratio=0.0000 last_segment_avg_logprob=-0.192 verdict=Complete
```

**Four instruments, four green verdicts, and the dictation is about a third
short.** This is the second shape again — the recogniser reaches the end of the
audio and puts our own prompt where the speech was — and the transcript ends:

> …dass das 3D-Modell sich in die Neuronen verwendet wird. Likely phrases:" Commit.

`Commit` is slot 1 of `"Likely phrases: Commit; heißt; Agenten; decision log"`,
resolved to the byte in
[stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md).
`Agenten` — the break word of two of the three 2026-08-12 events — is still in
the list, one slot further down.

### How much is missing, measured against the same speaker minutes earlier

`speech_seconds` (voice-activity seconds, new on the record) makes the density
argument sharper than the duration bands below, because it removes the pauses
that made those bands only suggestive:

| Record | Time | Speech | Recogniser chars | chars/s |
| --- | --- | --- | --- | --- |
| `…910617343-50` | 22:03:37 | 41.10 s | 485 | 11.80 |
| `…910719305-50` | 22:05:19 | 64.71 s | 721 | 11.14 |
| **`…910918745-50`** | **22:08:38** | **41.52 s** | **313** (338 less the 25-char echo) | **7.54** |

Same speaker, same profile, same mode, same lane, inside six minutes, and a
neighbour of almost identical speech length. At the neighbour's density this
recording should have produced roughly 490 characters; it produced 313. **The
deficit is about 175 characters — two sentences, which is what the owner
estimated by eye.**

Eight of the fifty records in history carry `speech_seconds` at all, so this is
a comparison and not a rate. It is a much better-controlled comparison than the
duration table further down.

### What this event costs the two candidate instruments

- **Coverage is confirmed blind to this shape**, as the record already said —
  `uncovered_ratio=0.0000`, `verdict=Complete`.
- **`last_segment_avg_logprob` does not separate it.** The three earlier events
  read `-0.378` and `-0.366` against a healthy band of `-0.171` to `-0.231`, and
  hypothesis 2 rests partly on that gap. This one reads **`-0.192`** — inside
  the healthy band, on a transcript missing a third of its content. One
  observation does not refute the temperature hypothesis, but it does remove
  confidence as a *detector*: a density-based measure is now the only proposed
  instrument that would have caught this event.

### The ten-second test was never run, and this is what that cost

*What would settle it* below asks for the learned terms to be deleted from the
active profile. They were not, four days on. The profile now carries three
learned terms instead of three others, the newest of them promoted at 17:07 on
the day of this event, and the failure recurred with the new slot-1 term
standing at the break. **The test is now cheaper to justify and no harder to
run.**

## Hypotheses

Ordered by what the evidence supports. Reordered on 2026-08-12 when the prompt
content was resolved.

1. **The initial prompt displaces the speech.** The strongest, and no longer
   untested at the level of the prompt's content: the request sends
   `"Likely phrases: Agenten; etwas"`, and `Agenten` is the word standing at the
   break in two of the three events. The mechanism is documented in
   [stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md)
   — the decoder treats the prefix as text to continue rather than as a hint.
   What is untested is whether removing the prompt removes the failure.
2. **The temperature fallback is disabled.** The request pins `temperature=0`
   (`core/providers/groq.rs`). Whisper's reference decoding escalates
   temperature when `compression_ratio` and `avg_logprob` cross their
   thresholds, which is the guard against exactly this failure; pinning the
   value removes it. Fits the `avg_logprob` on the affected segments — `-0.378`
   and `-0.366` against `-0.171`, `-0.193`, `-0.205`, `-0.206` and `-0.231` on
   healthy ones in the same sessions. **A consequence worth stating before
   anyone proposes one: a plain retry cannot help.** At temperature 0 the decode
   is deterministic, so the same file with the same parameters returns the same
   text. Only a retry with changed parameters is a retry.

   The two are not exclusive. A prompt that pulls the decoder off the audio and
   a missing guard that would have caught it produce exactly this pair of
   shapes.
3. **The speech really was that sparse.** The honest alternative for the density
   table. It does not explain a transcript that stops mid-sentence, nor 11.7 s
   of audio with no segment over it, nor the same word ending two of them.

## What would settle it

**The cheapest test costs ten seconds and no code.** Delete the three learned
terms from the active profile. The prompt then falls back to
`BLANK_STATE_RECOGNIZER_PROMPT`, which contains no `Agenten`. If the word stops
appearing at the breaks, hypothesis 1 is established for it, and the question
becomes why `vocabulary_learning` promoted ordinary German words at all. If it
keeps appearing, hypothesis 1 is wrong and the prompt is a bystander. Either
answer is worth having and neither needs a build.

Then, for the mechanism rather than the trigger: re-transcribe one affected file
twice — once with `temperature` unset, once without the prompt — and compare
`uncovered_ratio`. This is a provider experiment and needs no dictation.

**It is blocked today for a mundane reason:** `~/.config/WordScript/tmp/` is
emptied after processing, so no affected audio survives. Retaining the upload of
a `Truncated` verdict is the precondition for the experiment, and is a smaller
decision than the reaction question above.

## Environment

- Groq `whisper-large-v3`, `response_format=verbose_json`, `temperature=0`,
  `prompt_chars=30`, `retries=1`.
- Capture unchanged from the environment of the capture record:
  `host=Alsa device=default sample_rate=44100 channels=2 sample_format=f32`.
- Both events occurred while the C3 capture soak held a second stream open on
  the same device; the soak segment covering them reads `missing_ratio=0.0000
  verdict=Intact`, which is independent confirmation that the input stream was
  healthy in that window.
