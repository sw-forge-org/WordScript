# Bug: A capture silently keeps half the recording

Status: **Open — cause not located, and now instrumented for the next
occurrence. Re-measured 2026-08-10 and 2026-08-11: 11 affected captures rather
than 8, unchanged between the two runs, and the worst one is still the most
recent. The capture REPORTS the gap (ADR 0079) and now also reports the CADENCE
of its own input stream (ADR 0083), which is step 2 below. No real gap has been
recorded yet.**

This is the defect the overlay freeze reports have been describing; the frozen
pill is the symptom, the lost audio is the damage.

First reported: 2026-08-03, as "the overlay still freezes"
Affected area: `core::capture`, the cpal input stream on Linux/ALSA
First occurrence in the logs: 2026-07-31 20:18

## Symptom

During a long recording the waveform stops moving. The seconds timer keeps
counting, the stop hotkey works, and a transcript arrives — so from the outside
the session looks like it completed.

It did not. **Between 12 % and 52 % of the audio was never captured.** The
transcript is of what was recorded, not of what was said, and nothing in the
product tells the user that a gap exists.

## The measurement (2026-08-03)

Two numbers the runtime already logs turn out to be the same measurement, and
neither had been compared to the other before:

- `Capture level emits … wall_seconds=… shortfall_ratio=…` — the fraction of
  42 ms intervals in which no `audio_level` event was even attempted.
- `Native capture export done … input_rate=… input_channels=… input_samples=…`
  — from which the recorded audio duration follows as
  `input_samples / (input_rate × input_channels)`.

782 captures paired across both runtime logs (2026-07-30 to 2026-08-03).
Restricted to the 353 captures of at least 20 s:

**Pearson r between `shortfall_ratio` and the missing fraction of wall-clock
audio: 0.9999.**

The emit shortfall is not a proxy for the audio loss. It *is* the audio loss,
read off a different counter.

### The eight affected captures

| Stop | Wall clock | Audio recorded | Missing | `shortfall_ratio` |
|---|---|---|---|---|
| 08-01 16:30 | 405.7 s | 194.3 s | **52.1 %** | 0.540 |
| 08-03 06:36 | 140.6 s | 69.0 s | **51.0 %** | 0.529 |
| 08-01 16:07 | 1365.3 s | 679.6 s | **50.2 %** | 0.522 |
| 08-03 06:33 | 293.7 s | 172.2 s | **41.4 %** | 0.437 |
| 08-01 15:25 | 596.8 s | 373.1 s | 37.5 % | 0.400 |
| 08-02 03:07 | 559.3 s | 426.0 s | 23.8 % | 0.269 |
| 08-02 00:28 | 107.9 s | 90.0 s | 16.6 % | 0.199 |
| 07-31 20:18 | 321.8 s | 283.3 s | 12.0 % | 0.155 |

Baseline for comparison: the other 345 captures of at least 20 s lose a median
of **0.1 %** and at most 4.0 %. There is no continuum — the affected captures
sit an order of magnitude away from every healthy one.

Two of the eight (08-03 06:33 and 06:36) are from **after** `1fda91d`
(2026-08-03 02:26), so nothing in the current tree addresses this.

Corroborating signal on the content side: those two records carry 2.10 and 2.64
characters of transcript per wall-clock second against a baseline median of
**6.65** across 76 long captures. Roughly a third of the expected text, from
roughly half the expected audio, in a dictation that never stopped.

### It is not a pause

`expected` is derived from the full wall clock (`wall.as_millis() / 42`), and
`toggle_native_capture_pause_inner` (`src-tauri/src/core/capture.rs`) stops the
stream without stopping that clock — so a paused capture produces a shortfall by
construction. That would have been a metric artifact rather than a defect.

It was checked and ruled out: the runtime log carries **zero** `pause` trigger
lines inside either 2026-08-03 capture window. The recordings ran uninterrupted.

The pause interaction is real and still worth fixing, because it makes
`shortfall_ratio` unreadable on any paused capture. It is not what these eight
are.

### It is not the webview

- `/tmp/kilo/overlay-diag.log` contains **no `[ov-beat]` line**, while
  `[ov-dom]` (148), `[ov-sched]` (688), `[ov-repaint]` (196) and `[ov-reveal]`
  (268) pass through the same dev gate. The main thread never stalled ≥400 ms.
- `failed=0` on all 782 captures, `slowest_emit_ms` never above 29 and 0–1 in
  every affected capture. Every emit that was attempted succeeded immediately.

This is the second row of the decision table in
[overlay-recording-freeze.md](overlay-recording-freeze.md) — *runtime-side emit
loss without a webview stall* — observed for the first time. The table's
reading was right; what it did not anticipate is that the loss is not of
events but of samples.

### What the runtime did not say

Nothing. Across both affected windows the log contains exactly the ordinary
lines: `Native capture start`, then `Capture level emits`, then
`Native capture export done`. No stream error, no rebuild, no device change. The
14 rebuild-related lines in the log all fall outside these windows.

The cpal callback simply stopped being called for long stretches, and the two
counters that could have revealed it were never compared.

## Re-measured 2026-08-10: it did not stop, and it got worse

The same pairing over both runtime logs, now covering 2026-07-30 to 2026-08-10.
**634 paired captures; r = 0.9986 between `shortfall_ratio` and the missing
wall-clock fraction across 338 captures of at least 20 s.** The correlation is
the same measurement it was; the population is larger.

**Eleven captures now exceed 12 % missing, not eight.** Three are new since this
record was written, and they are the reason its status changed rather than its
numbers:

| Stop | Wall clock | Audio recorded | Missing |
|---|---|---|---|
| 08-10 22:57 | 214.3 s | 97.3 s | **54.6 %** |
| 08-03 18:02 | 644.6 s | 433.3 s | 32.8 % |
| 08-04 02:35 | 3.6 s | 2.4 s | 34.4 % |

The 08-10 case is the worst ever measured **and it happened while this record
was being worked on**, forty minutes before the reporting shipped. Its transcript
is 669 characters of fluent, correctly punctuated German ending in a question,
and it reads as a finished dictation. Density against the recorded audio is 6.9
characters per second, which is ordinary; against the wall clock it is **3.1
against a median of 8.4**. That is the corroborating signal this record
described, observed again at full strength.

Baseline over all 634: median **0.23 %** missing, p95 **1.92 %**, worst healthy
capture **7.0 %**. There is still no continuum — the gap between the healthiest
worst case and the smallest real failure runs from 7.0 % to 12.0 %.

### What shipped: the capture says so now

[ADR 0079](../decisions/0079-a-capture-states-how-much-of-its-own-clock-it-kept.md).
`CaptureIntegrity` is computed at `stop_native_capture` from the untrimmed
buffer against the effective wall clock, and reported in three places: the
runtime log on every capture including discarded ones, the history record
(`capture_integrity`, an `Audio missing` badge, and a sentence in the raw
panel), and the overlay at delivery time as a tab beside the result pill.
Threshold 10 %, derived from the gap above; nothing under two seconds is judged.

**It also fixed the pause artifact** this record's fourth next-step names.
`LevelEmitSummary` now measures against `effective_elapsed`, so a paused capture
no longer reports a shortfall by construction and `shortfall_ratio` stays
readable on the long dictations it exists for. A stream rebuild is deliberately
*not* excused: those samples are genuinely lost.

**Verified in the native host the same evening.** Five records written by the
running dev build carry verdicts — `intact` at 0.1 %, 0.1 %, 0.2 %, 0.5 % and
3.0 % missing — which is the baseline band, correctly not flagged.

**None of this locates the cause.** Steps 2 and 3 below are untouched.

## Re-run 2026-08-11: nothing moved, and step 2 shipped

The same harness over both runtime logs: **636 paired captures, r = 0.9986 over
340 captures of at least 20 s, and still exactly 11 past the threshold.** No new
short capture since 08-10 22:57. The baseline is unchanged — median 0.23 %
missing, p95 1.96 % — and the gap the threshold sits in is still 7.0 % to
12.0 %.

Records that answer for themselves went from 5 to 7 of 138. All 7 are `intact`,
so **the correlation is still not answerable**, for the same reason and not a
new one: the population has not yet produced a short capture under ADR 0079.
That is a fact about how many captures have been recorded, not a finding that
short captures are rare now.

### What shipped: the callback says whether it was called

[ADR 0083](../decisions/0083-a-capture-reports-the-cadence-of-its-own-input-stream-and-the-level-it-was-given.md),
which is **step 2 of this plan**. `CallbackCadence` counts every cpal callback
and every stretch over 200 ms in which the stream delivered nothing, and
`stop_native_capture` writes it:

```text
[WordScript] Capture callback cadence callbacks=… nominal_samples=… nominal_interval_ms=…
  longest_gap_ms=… gaps_over_200ms=… oversized_resumes=… lost_in_gaps_seconds=…
  share_of_missing=… signature=…
[WordScript] Capture callback gap at_ms=… gap_ms=… resumed_with_samples=… nominal_samples=…
```

**`resumed_with_samples` is what separates the three hypotheses below**, and it
is the number this record has been missing:

| `signature` | Reading | Hypothesis |
|---|---|---|
| `stream_suspended` | gaps exist, every resume carries an ordinary period — the audio in the gap was never delivered | 1 |
| `no_gaps_but_audio_missing` | no stretch long enough to name, and the audio is still short — the loss is spread across the capture | 2 |
| `late_delivery` | the resuming callback carries the gap's worth of audio — the samples arrived, the clock disagreed | 3 |
| `no_gaps` | the baseline | — |

The line is written on **every** capture, healthy ones included, for the reason
this record's own measurement worked: 345 healthy captures are what made eight
broken ones legible. A pause resets the cadence so a deliberate pause is not
read as a dropout; a rebuild resets it too, because its outage is already named
by the rebuild line.

Nothing is logged from the audio callback itself — the gaps accumulate in memory
and are flushed at the stop. Writing a file from a realtime audio thread to
report a dropout is a good way to cause the next one.

**No real gap has been observed.** The instrumentation is asserted against a
synthetic timeline only. The first real one belongs in the corpus.

### Step 3, taken retrospectively, and both halves came back negative

The journal reaches back to 2026-08-06, which covers the 08-10 22:54–22:57
window — the worst capture ever measured.

- **No PipeWire or WirePlumber line inside the window at all.** Weak evidence
  rather than a refutation: a suspend-on-idle or a session-manager reroute would
  appear at debug level, and the journal was at default. Hypothesis 1 is neither
  supported nor excluded by this.
- **Memory pressure does not distinguish it.** `earlyoom` samples once a minute,
  and the window's tightest reading is **18.3 % memory available** — inside the
  healthy band of 11.8–51.6 % across 28 healthy long captures, **six of which
  ran tighter than it**. On n = 1 that distinguishes nothing. It is not a
  refutation of starvation and it is not support for it.

Only one of the 11 short captures falls inside the journal's reach, which is why
this is a coincidence check and not a measurement. Watching PipeWire live during
a long capture is still worth doing and is still step 3.

## Environment

- `host=Alsa device=default sample_rate=44100 channels=2 sample_format=f32` —
  identical across all 497 capture starts in the log, so no device or format
  change accompanies the failure.
- ALSA `default`, which on this machine routes through PipeWire.
- KDE Plasma 6 / Wayland session, app on XWayland; hybrid Intel + NVIDIA with
  global PRIME offload. Same machine as
  [overlay-recording-freeze.md](overlay-recording-freeze.md), where the system
  journal already showed `kwin_wayland: The main thread was hanging temporarily!`
  and repeated output-configuration failures.

## Hypotheses

Untested, ordered by what the evidence supports.

1. **The input stream is being suspended and resumed without an error.**
   PipeWire can park or reroute an ALSA client — on a device change, a
   suspend-on-idle timeout, or a session-manager decision — and cpal surfaces
   that as a callback that stops arriving rather than as a stream error. Fits
   every observation: no error, no rebuild, no format change, an exact
   proportional loss.
2. **Callback starvation under load.** The affected captures are the long ones
   (7 of the 8 exceed 100 s; 1 of 711 short captures is affected), which is also
   when the machine is doing the most. Would show up as a period-boundary miss
   rather than a clean suspend.
3. **A clock disagreement rather than a real loss.** If `wall_seconds` measured
   something other than the stream's active time, the audio might be complete
   and the metric wrong. Cheapest to disprove and worth doing first, but it
   would not explain a transcript at a third of its expected density.

## Next steps

1. ~~**Report the gap.**~~ **Done 2026-08-10, ADR 0079.** See above.
2. ~~Log the cpal callback cadence.~~ **Done 2026-08-11, ADR 0083.** See above.
   **The next step is to wait for it to fire**, which costs nothing and needs no
   code: the next `verdict=short` capture writes a cadence line beside it, and
   its `signature` names the hypothesis. Until then the three below remain
   untested rather than eliminated.
3. Watch PipeWire from the other side during a long capture
   (`pw-cli` / `pw-top`, and `journalctl --user -u pipewire`, ideally with
   `PIPEWIRE_DEBUG=3`) and correlate a suspend against a capture window. The
   retrospective half of this was taken on 2026-08-11 and found nothing at
   default log level — see above. **Live, at debug level, it is still open**,
   and it is the one thing that would confirm hypothesis 1 outright rather than
   inferring it from the resume size.
4. ~~Fix the pause interaction in `shortfall_ratio`.~~ **Done 2026-08-10,
   ADR 0079** — `LevelEmitSummary` measures against `effective_elapsed`.
5. **Put the first real gap in the corpus.** Nothing in
   `regression_transcripts.json` describes an observed dropout, because none has
   been recorded. The cadence assertions run over a synthetic timeline, which
   pins the arithmetic and not the phenomenon.

## Why this was filed separately

[overlay-recording-freeze.md](overlay-recording-freeze.md) has collected three
distinct failures under one reported symptom, and two of them have already been
split out ([overlay-stranded-off-screen.md](overlay-stranded-off-screen.md),
[overlay-leave-hold-dead-actions.md](overlay-leave-hold-dead-actions.md)). This
is the third, and it does not belong to the overlay at all: the pill freezing is
correct behavior for a stream that has stopped delivering samples. Filing it
under the overlay would keep pointing the investigation at the layer that is
working.

## References

- [overlay-recording-freeze.md](overlay-recording-freeze.md) — the reported
  symptom, and the decision table that classified this correctly before it was
  observed
- [transcription-hallucination.md](transcription-hallucination.md) — what a
  recognizer does with a transcript that has a hole in it
- [diag-log-write-surface.md](diag-log-write-surface.md) — the diagnostic log
  used above
