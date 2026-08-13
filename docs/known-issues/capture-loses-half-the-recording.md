# Bug: A capture silently keeps half the recording

Status: **Open — cause not located, and the suspicion has moved. Step 3 is
done: the soak night ran 2026-08-11 23:38 to 2026-08-12 07:38 and produced
NOTHING. 96 segments, 8.00 h of open stream, every one `Intact` with
`signature=no_gaps`; worst segment 0.01 %, longest callback gap 25 ms, zero
gaps over 200 ms, zero stream errors. At the rate this record estimates — one
event per hour of open stream — roughly eight were expected.** Per
[ADR 0084](../decisions/0084-the-defect-that-needed-no-dictation-gets-a-binary-that-needs-no-app.md),
which registered this outcome in advance so it could not be reinterpreted
afterwards: **a negative night does not exonerate PipeWire, it moves the
suspicion into the app.** Route B is next.

**Superseded in part, 2026-08-13.** Route B was answered by ordinary use
instead of by a silent run: the defect occurred live at 00:36 and the runtime
log holds it whole, with per-gap detail. See *The first event after the soak
night* below. It **refutes the app-side hypothesis ADR 0084 pointed at**, and
it exposes a blind spot in the instrument: the callback gap is measured on the
far side of the app's own mutex, so "the callback was not called" and "the
callback was blocked on our lock" are the same reading.

Re-measured 2026-08-10 and 2026-08-11: 11 affected captures rather than 8,
unchanged between the two runs, and the worst one is still the most recent. The
capture REPORTS the gap (ADR 0079) and the CADENCE of its own input stream
(ADR 0083), which is step 2 below. Three real gaps have now been recorded with
full per-callback detail (2026-08-11 02:18, 2026-08-11 06:01, 2026-08-13 00:36);
the soak night did not produce one.

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

**A report of a swallowed dictation is not automatically this record.** Since
2026-08-12 a second loss channel is documented in
[transcript-stops-before-the-audio-does.md](transcript-stops-before-the-audio-does.md):
the audio arrives whole and the recogniser stops early. The user's sentence is
the same either way, so the two are told apart by the verdicts, not by the
report — `Capture integrity` answers whether the audio reached the file,
`Transcription coverage` whether the file reached the transcript. Both events
measured on 2026-08-12 read `Intact` here and belong to that record.

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

## How to reproduce it, and why nobody has to speak

Worked out 2026-08-11. Every plan before this one assumed the defect had to be
waited for, because a capture needs a dictation. **It does not.**

**1. The diagnostics do not depend on speech.** All three lines — capture
integrity, callback cadence, input level — are written in `stop_native_capture`
*before* the `if samples.is_empty() || !has_voice_activity` branch. A recording
with no words in it is discarded as empty and still leaves the complete
measurement in the runtime log. The defect is a loss of samples from the input
stream, and silence produces samples like anything else.

**2. The rate makes it a short experiment, not a vigil.** Eleven events across
roughly **9 hours of total stream runtime** (643 captures, 7.9 h of it in
captures of at least 20 s):

> **About one event per hour of open input stream.**

That is the number that was missing. The defect looks rare per *capture* — 11 in
643 — only because the average capture is under a minute. Per hour of stream it
is common, and an unattended run overnight should produce roughly eight events.

### Route A — a soak, unattended, no app and no words

A standalone binary that opens the same stream (ALSA `default`, 44100 Hz,
2 channels, `f32` — identical across all 497 capture starts in the log), carries
the same `CallbackCadence`, and runs for hours writing its own log. It touches
no session, no dev host and no microphone etiquette.

**What it settles:** hypothesis 1 directly. A parked or rerouted ALSA client
shows as `signature=stream_suspended` with a timestamped window, which is then
correlated against `journalctl --user -u pipewire` — **step 3 of the plan below,
done in the same night.** Run PipeWire at `PIPEWIRE_DEBUG=3` for that, because
the retrospective check at default level found nothing.

**What it cannot settle:** if the cause is contention with WordScript's own
per-callback work — the `app.emit` every 42 ms, the webview beside it — a bare
stream may never reproduce it. The soak should therefore do the same work per
callback (buffer copy, peak and RMS, the 42 ms bookkeeping); only the emit
itself has no app to go to. **A soak that finds nothing does not exonerate
PipeWire — it moves the suspicion to the app**, and that is a result worth
having either way.

### Route A shipped 2026-08-11: the tool exists, the night does not

[ADR 0084](../decisions/0084-the-defect-that-needed-no-dictation-gets-a-binary-that-needs-no-app.md).
`capture-soak` (`src-tauri/src/bin/capture_soak.rs`) opens the device the app
opens and holds it open, rotating its bookkeeping into 300 s segments that each
carry a cadence and an integrity verdict:

```text
cargo run --release --bin capture-soak -- --hours 8
PIPEWIRE_DEBUG=3 journalctl --user -u pipewire -f      # step 4, same night
```

It carries `CallbackCadence`, `CaptureIntegrity` and `InputLevelSummary`
themselves rather than copies, so a disagreement between the soak and a capture
cannot be an artifact of two implementations. Rotation happens inside a
callback, so segments tile the run exactly and a stalled stream keeps its
segment open and growing instead of producing a run of tidy ones.

Verified against real hardware for 20 s and 12 s on 2026-08-11:
`host=Alsa device=default sample_rate=44100 channels=2 sample_format=f32`, which
is the configuration all 497 capture starts in the log share. Healthy segments
read `missing_ratio` between 0.0000 and 0.0055 with `signature=no_gaps`.

### The night, 2026-08-12: eight hours, ninety-six segments, nothing

Run on the machine and the configuration this record describes, through an
ordinary working night rather than an idle one — the dev host was rebuilding
and the owner was dictating for the first four hours, which is what the
withdrawn "under load" note above asks for.

```text
segments        96          open stream     8.00 h (28800 s)
verdicts        Intact 96   signatures      no_gaps 96
worst segment   0.0001 (0.01 %)
longest gap     25 ms       gaps > 200 ms   0
watchdog silent 0           stream errors   0
```

`PIPEWIRE_DEBUG` level 3 ran beside it, set through the settings metadata rather
than by restarting the service, because a restart resets the stream state the
soak exists to hold. Its journal carries the ordinary client churn and one
Bluetooth node teardown at 03:34, and no window needed correlating because
there was nothing to correlate.

**What this settles and what it does not.** Eight hours of an open stream doing
the same per-callback work a capture does — buffer copy, peak, RMS, clipping
count, waveform bucketing, the 42 ms bookkeeping — produced not one gap.
Hypothesis 1 (a silent PipeWire suspend of an ordinary client) is not supported
by a night that had every opportunity to show it. The difference between this
stream and a capture is what the app adds around it, which is where ADR 0084
said in advance the suspicion would move. **Route B is now the next step, not
an alternative to this one.**

Two limits of the run, stated so the result is not read as stronger than it is:
the soak carries no `app.emit` and no webview, so it cannot reproduce a cause
that lives there — that is the point, not a flaw — and one night is one sample
of a phenomenon whose rate was estimated from 11 events, not measured.

**The instrument fabricated a total loss on its first run.** The 20 s run ended
with a segment reading `missing_ratio=1.0000` — a 3 ms remainder of the rotation
reported as if all its audio had been lost. That is this record's own failure
class produced by the tool built to find it, and it was visible only in the log
of a real run; the synthetic tests passed throughout. A remainder too short for
`CaptureIntegrity` to judge is now dropped, while a judged segment is reported
even with no samples in it, because a stream that stopped for minutes is the
finding rather than an artifact. Both directions are asserted
(`the_rotation_remainder_is_not_reported_as_a_total_loss`,
`a_stream_that_stopped_entirely_is_still_reported_at_the_end`).

### Route B — the real app, silent

If the suspicion lands on the app: set `silence_timeout_seconds` to `0`, which
disables the auto-stop (`should_auto_stop` gates on `> 0`), raise
`max_recording_seconds`, start a capture and leave it. It is discarded as empty
at the end and writes the full diagnostic anyway, per point 1 above. One
setting, no words.

### What was withdrawn

An earlier version of this plan said "under load". **That was a guess and the
data does not carry it.** The one short capture inside the journal's reach ran
at 18.3 % available memory, inside the healthy band of 11.8--51.6 %, with six
healthy long captures tighter than it. Scripting artificial load would test a
hypothesis nothing supports. Letting the soak run through an ordinary working
day puts it in the conditions the defect actually occurred in.

## The first event after the soak night (2026-08-13)

Route B did not have to be run. The owner hit the defect in ordinary use at
00:36 and reported it from the history row; the runtime log still held the
session. This is the first event recorded **after** the negative soak night, and
the first one whose per-gap detail was read against the whole population.

Record `history-1786574199766-200`, transcript
`~/WordScript/transcripts/2026/08/13-0036-crider-und-window-auswahl.md`,
session `native-18`:

```
Capture level emits   wall_seconds=16.523 expected=393 attempted=309 failed=0
                      shortfall_ratio=0.2137 slowest_emit_ms=5
Capture integrity     wall_seconds=16.523 recorded_seconds=13.967
                      missing_ratio=0.1547 verdict=Short
Capture callback cadence callbacks=1203 nominal_samples=1024 nominal_interval_ms=11.6
                      longest_gap_ms=366 gaps_over_200ms=7 oversized_resumes=0
                      lost_in_gaps_seconds=1.681 share_of_missing=0.658
                      signature=stream_suspended
Capture callback gap  at_ms=4312(202) 4678(366) 4963(284) 8452(204)
                      9104(205) 9369(265) 9695(232)  -- all resumed_with_samples=1024
Capture input level   peak_dbfs=-11.0 rms_dbfs=-28.0 verdict=Ok
```

Seven gaps inside a 5.4 s window on a 16.5 s capture. The neighbouring captures
(90 s at 00:32, 31.7 s at 00:37, 174 s at 00:42) are all `Intact`.

### The population it stands in

One runtime log, 2026-08-10 18:23 to 2026-08-13 00:55. **195 captures over the
2 s measurement floor: 3 `Short` (1.5 %), 192 `Intact`.** 189 carry a cadence
line — 185 `no_gaps`, 4 `stream_suspended`, and **`oversized_resumes=0` in all
189**. The stream has never once delivered late-with-data; audio in a gap is
always gone, never merely delayed.

| when | wall | missing | gaps>200ms | longest | share_of_missing | slowest_emit_ms | verdict |
|---|---|---|---|---|---|---|---|
| 08-11 02:02:34 | 96.7 s | 1.4 % | 2 | 216 ms | 0.303 | 10 | **Intact** |
| 08-11 02:18:36 | 3.2 s | 11.4 % | 1 | 282 ms | 0.730 | 0 | Short |
| 08-11 06:01:18 | 13.1 s | 19.0 % | 8 | 359 ms | 0.861 | 199 | Short |
| 08-13 00:36:37 | 16.5 s | 15.5 % | 7 | 366 ms | 0.658 | 5 | Short |

### 1. `app.emit` is not the cause

ADR 0084 redirected suspicion to whatever the soak omits, and named `app.emit`
as that delta. The data does not carry it. `slowest_emit_ms` is **0 and 5 ms**
in two of the three failures — across 309 attempted emits during the 00:36
event, no emit ever exceeded 5 ms while the audio was disappearing. Only the
06:01 event has a slow emit (199 ms), and there it is as likely a victim of the
same stall as its cause.

### 2. The gap is measured on the far side of our own lock

`process_samples` takes a blocking `std::sync::Mutex` at `capture.rs:1794` and
only *then* calls `cadence.observe(started_at, Instant::now(), …)` at
`capture.rs:1818-1820`. So the interval the cadence reports starts and ends
**after lock acquisition**. "The callback was never called" and "the callback
was called and blocked on our mutex" produce the identical number.

That mutex is contended by the app's command threads: `pause_capture` (1106),
`resume_capture` (1146), the level read (1484), the rebuild path (1524, 1629,
1657) and the stop path (1298). A consumer-side stall also produces
`resumed_with_samples = nominal` and `oversized_resumes = 0`, because ALSA drops
the periods it could not hand over rather than growing the next one.

**`signature()` (capture.rs:706-721) therefore overclaims.** It returns
`stream_suspended` for any gap over threshold with a nominal-size resume, which
asserts a producer-side cause the measurement cannot establish.

### 3. The soak-versus-app delta was understated

`capture_soak.rs` reproduces the mutex, the `collect::<Vec<_>>()` and the
unpreallocated sample buffer (207, 237, 245, 558) — its own header says it does
everything "minus the `app.emit`". But **nothing else in that binary ever takes
the lock**, and no dev server is rebuilding webviews around it. The real delta
is `app.emit` **plus** lock contention **plus** the reload storm documented in
[dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md)
— about 1,389 vite full reloads in the same 2.5 days, 33 of them inside a live
capture. Eight clean soak hours are consistent with all three, not with the
first alone.

(The reloads are **not** the cause here: all 33 captures that had one are
`Intact`, and none of the three `Short` captures had a reload in its window.
That join is recorded so nobody re-runs it.)

### 4. Load and memory are dead again, with a better counter-example

The 2026-08-03 "under load" guess was withdrawn once already. Re-tested against
the new event via `journalctl -t earlyoom`: at 00:36 the machine sat at **40.3 %
available memory with swap being freed**, and **90 `Intact` captures ran at
equal or worse memory pressure** (median 27.6 % available, p05 11.1 %, swap-out
up to 2780 MiB/min during healthy captures). Nothing outside the app logged
anything in the 5.4 s gap window. The withdrawal stands and is now better
supported than when it was made.

### 5. The verdict is length-biased, and a third of the loss is invisible

Hypothesis 2 below rests on "the affected captures are the long ones (7 of 8
exceed 100 s)". In the cadence-era population the opposite holds: the three
`Short` captures are 3.2 / 13.1 / 16.5 s, while the four longest (264, 217, 197,
174 s) are all `Intact` — and the one long capture that *did* have gaps stayed
`Intact` only because the same absolute loss over a longer clock falls under the
10 % ratio. **Length hides this defect, it does not cause it.**

Separately, `share_of_missing = 0.658` means **0.875 s of the 2.556 s missing at
00:36 is in no gap over `CALLBACK_GAP_THRESHOLD_MS = 200`**. The gap list
describes two thirds of the damage and is silent about the rest.

### What the next instrument has to do

Stated in advance, as ADR 0084 did, so the reading cannot be chosen afterwards:

1. Feed `cadence.observe` the timestamp of **callback arrival**, taken before
   `shared.lock()`.
2. Measure the lock wait as its own quantity. It is the entire difference
   between the two live hypotheses.
3. Report the loss **below** the 200 ms threshold, so the three figures account
   for the whole `missing_ratio`.
4. Land the same change in `capture_soak.rs`; ADR 0084's premise is that the
   soak is the app minus a *known* delta.

Then, on the next event:

- `slowest_lock_wait_ms` close to `longest_gap_ms` -> **the app blocked its own
  audio thread.** The fix is ours: preallocate the sample buffer
  (`Vec::new()` at 1239, capped but never reserved at 1826), stop allocating
  per callback (1789, 1806), move `app.emit` off the realtime thread (1862),
  and shrink the lock.
- lock wait near zero while the gap persists -> **the callback genuinely was not
  called**, and hypothesis 1 gets real support for the first time.

Those three realtime violations are named here deliberately and are **not** to
be fixed before the measurement lands. Fixing them now removes the ability to
tell which one mattered.

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
2. **Callback starvation under load.** ~~The affected captures are the long ones
   (7 of the 8 exceed 100 s; 1 of 711 short captures is affected)~~ — **that
   support inverted in the cadence-era population (2026-08-13): all three
   `Short` captures are under 17 s and the four longest are `Intact`.** The
   hypothesis survives, the observation behind it does not; see §5 of *The first
   event after the soak night*. The memory/load half was re-tested against the
   00:36 event and stays refuted.
3. **A clock disagreement rather than a real loss.** If `wall_seconds` measured
   something other than the stream's active time, the audio might be complete
   and the metric wrong. Cheapest to disprove and worth doing first, but it
   would not explain a transcript at a third of its expected density.
4. **Contention on the capture mutex, from the app's own command threads.**
   Added 2026-08-13, and the one the evidence now points at. The callback takes
   a blocking `std::sync::Mutex` and the cadence timestamps itself *after*
   acquiring it, so this is indistinguishable from hypothesis 1 with the current
   instrument — and it is a difference between the app and the soak that ADR
   0084 did not account for. Allocation inside the callback (an unpreallocated
   sample buffer, two heap allocations per callback at ~86/s) is the same
   hypothesis's supply of stall.

## Next steps

1. ~~**Report the gap.**~~ **Done 2026-08-10, ADR 0079.** See above.
2. ~~Log the cpal callback cadence.~~ **Done 2026-08-11, ADR 0083.** See above.
3. ~~Build the soak.~~ **Built 2026-08-11, ADR 0084 — and not yet run.** The
   binary exists and is verified against real hardware for seconds, not hours.
   **Run it overnight**: at one event per hour of open stream a night produces
   roughly eight, each carrying a signature naming which hypothesis it supports.
   Step 4 is folded into the same night. A night that produces nothing is a
   result and moves the suspicion from PipeWire to the app's own per-callback
   work; it is not an exoneration of either.
4. Watch PipeWire from the other side, **at `PIPEWIRE_DEBUG=3`**, and correlate
   a suspend against a soak window. The retrospective half was taken on
   2026-08-11 at default level and found nothing, which is weak evidence and not
   a refutation. Live and at debug level this is the one thing that would
   confirm hypothesis 1 outright rather than inferring it from the resume size.
5. ~~Fix the pause interaction in `shortfall_ratio`.~~ **Done 2026-08-10,
   ADR 0079** — `LevelEmitSummary` measures against `effective_elapsed`.
6. **Put the first real gap in the corpus.** ~~Nothing in
   `regression_transcripts.json` describes an observed dropout, because none has
   been recorded.~~ **Unblocked 2026-08-13** — three events now carry full
   per-callback detail (02:18, 06:01, 00:36). The cadence assertions still run
   over a synthetic timeline, which pins the arithmetic and not the phenomenon;
   `native-18` is the one to encode.
7. **Measure the lock wait and the sub-threshold loss** (2026-08-13, ADR 0133).
   The current cadence cannot separate hypothesis 1 from hypothesis 4, and
   leaves a third of the missing audio unattributed. This is now the first item:
   Route B was answered by ordinary use, and the instrument is what is blocking,
   not the sample size. Pre-registered reading in *What the next instrument has
   to do*, above.
8. **Fix the dev-server watcher before trusting any further measurement**
   ([dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md)).
   It is one edit and it removes an unmeasured confound from every capture in
   the record so far. It is not the cause of this defect — that join came back
   negative — but it is a difference between the app and the soak.

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
