# Bug: the transcript stops before the audio does

Status: **Open — instrumented 2026-08-12 (`69f8c75`), cause not located, and
nothing in the product reacts to it.** Two events measured the same night, both
on audio the capture read as `Intact`. The verdict exists only as a log line:
it is not persisted, and a `Truncated` transcript still goes through transform
and insert and is delivered as a success.

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

## Hypotheses

Untested, ordered by what the evidence supports.

1. **The temperature fallback is disabled.** The request pins
   `temperature=0` (`core/providers/groq.rs`). Whisper's reference decoding
   escalates temperature when `compression_ratio` and `avg_logprob` cross their
   thresholds, which is the guard against exactly this failure; pinning the
   value removes it. Fits the poor `avg_logprob` on the truncated segment.
   **A consequence worth stating before anyone proposes one: a plain retry
   cannot help.** At temperature 0 the decode is deterministic, so the same file
   with the same parameters returns the same truncated text. Only a retry with
   changed parameters is a retry.
2. **The initial prompt provokes an early end-of-text.** `prompt_chars=30` on
   both events. The same prompt is already documented as being echoed into the
   output in
   [stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md),
   which is the same mechanism seen from the other end: the decoder treats the
   prefix as text to continue rather than as a hint.
3. **The speech really was that sparse.** The honest alternative for the density
   table. It does not explain a transcript that stops mid-sentence, nor 11.7 s
   of audio with no segment over it.

## What would settle it

Re-transcribe one affected file twice — once with `temperature` unset, once
without the prompt — and compare `uncovered_ratio`. This is a provider
experiment and needs no dictation.

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
