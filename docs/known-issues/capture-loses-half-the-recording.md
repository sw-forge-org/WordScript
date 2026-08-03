# Bug: A capture silently keeps half the recording

Status: **Open — measured 2026-08-03, cause not located. This is the defect the
overlay freeze reports have been describing; the frozen pill is the symptom, the
lost audio is the damage.**

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

1. **Report the gap.** Whatever the cause, a capture that recorded half of what
   the clock says has to say so — in the runtime log at minimum, and to the user
   before a transcript that is missing half its content is delivered as if
   complete. `wall_seconds` versus recorded duration is already available at
   export time; the comparison costs nothing. This is independent of the fix and
   should not wait for it.
2. Log the cpal callback cadence: the gap between callbacks and their sample
   counts, with a line whenever a gap exceeds a threshold. That separates
   hypothesis 1 from 2 directly.
3. Watch PipeWire from the other side during a long capture
   (`pw-cli` / `pw-top`, and `journalctl --user -u pipewire`) and correlate a
   suspend against a capture window.
4. Fix the pause interaction in `shortfall_ratio` so the metric stays readable —
   subtract `accumulated_paused` from the expected count.

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
