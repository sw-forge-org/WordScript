# 0177: A rate that counts a model's words over an open microphone is not a speaking rate

Date: 2026-08-16
Status: Accepted. Seventh record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Corrects the
`Words per minute` tile settled by
[ADR 0175](0175-a-tile-may-only-report-what-the-runtime-can-see-so-apps-goes-turnaround-arrives-and-the-rate-is-a-median.md),
which fixed how the runs are averaged and left both sides of the division alone.

## Context

The owner asked whether the words-per-minute formula makes sense at all, and
whether the thinking pauses could be taken out of it. Reading the derivation
against fifty real records on the reporting machine found that the tile got the
AVERAGING right and both TERMS wrong.

**The numerator was the delivered text.** `history.rs` counted
`transformed_transcript`, falling back to `raw_transcript`. Under Cleanup — the
mode every one of those fifty records ran — the transform removes filler, so the
median read **86.8** where the words actually spoken give **90.3**. Four percent,
and not the problem. The problem is the modes where the transform GENERATES:
Agent and Prompt Enhance turn a sentence of instruction into a paragraph of
prose, so fifteen spoken words become two hundred delivered ones and the run
enters the histogram at several hundred words a minute. Once there it is
permanent — the histogram is the ledger's memory. The tile would have been
reporting how verbose the model is.

**The denominator was the open microphone.** `capture_integrity.recorded_seconds`
runs from starting the capture to ending it, so the pause while the speaker works
out their next sentence is inside every run's rate. ADR 0175 said so honestly —
*"it is still throughput and not articulation"* — and put the caveat in the
tooltip. A tile whose label says *Words per minute* and whose tooltip says *but
not the words per minute you are thinking of* is a tile that has been explained
rather than fixed.

**What could not be reused.** Provider segments are not a pause measurement:
Whisper's segments are contiguous from zero, so the pause is INSIDE a segment,
and the two lanes most dictations take here (Groq, local) do not return usable
segment structure anyway. Nothing else in the record knows.

## Decision

### The rate is spoken words over speech seconds

**Spoken words.** `raw_transcript` — the recogniser's own output, before any mode
transform ran. It is what the speaker actually said, whatever the model did with
it afterwards. The delivered count is still recorded per day, because time saved
needs it ([ADR 0178](0178-time-saved-may-only-credit-what-somebody-would-have-typed-and-the-baseline-is-the-readers-to-set.md));
the two live in separate fields and may not be crossed.

**Speech seconds — measured in the audio callback, not asked of anybody.** The
callback already decides `peak > DEFAULT_VOICE_THRESHOLD` for the silence
timeout. Two counters more in the same pass turn that decision into an
accounting: a quiet stretch accumulates, and when speech resumes the stretch is
banked as a PAUSE if it reached `PAUSE_MIN_MS`. `speech_seconds` is the recorded
window less the banked pauses.

**Five hundred milliseconds, and the threshold is the whole design.** Ordinary
speech is full of short gaps — between words, at a comma, around a breath — and
they run well under 300 ms. Subtracting those would not remove the pauses, it
would remove the spaces between words and report a rate nobody speaks at. A gap
of half a second is somebody thinking; anything shorter is somebody talking. The
whole run is subtracted rather than its excess over the threshold, because the
speaker was not talking for any of it.

**It is counted over the samples the capture KEPT.** Not the samples that
arrived: a paused stretch pushes nothing, and a capture that has hit its length
cap pushes nothing. That is what guarantees the speech clock is a part of the
recorded window rather than a second, slightly different measurement of it, and
the ledger clamps it into that window as well. A muted stretch pushes zeroed
samples and therefore counts as pause, which is correct rather than incidental.

### The old histogram is discarded and not converted

The bucket width is unchanged, so the guard that catches a histogram read off the
wrong axis cannot see this: the axis is identical and every count is plausible.
`LEDGER_SCHEMA` is bumped to 2 and the rate histogram is emptied on the upgrade.

It is **not re-seeded from history**, because history holds no speech clock — an
old record can only answer the question the old tile asked. The conversion factor
between the two readings is the pause share, and nothing recorded it. So the tile
is dark until the next dictation, which is ADR 0161's rule and the honest state.

### The display gate stops being one tile

Home chose between the instruction and the counters on `wordsPerMinute !== null`.
With the rate dark after the upgrade, an installation with months of dictation
behind it was shown *"Press in any app to dictate"* again, as if it had never
started — observed immediately on the reporting machine. The gate is now whether
the RECORD has anything to say (`totals().dictations > 0`); a tile with no
reading of its own draws a dark display, which is what ADR 0161 asks for.

## Consequences

- The tile answers *how fast do I speak*, which is the only reading of it a
  reader can act on. On this machine it is expected to move from the high
  eighties into the range a person recognises as their own speaking rate.
- Every capture logs `Capture speech clock … pause_share=`, so the size of the
  correction is measurable after the fact rather than asserted here.
- The tooltip states the pause share in one sentence instead of explaining a
  caveat. It no longer has a caveat to explain.
- Generative modes contribute their spoken words and their speech seconds like
  any other run. Nothing about a model's verbosity reaches this figure.
