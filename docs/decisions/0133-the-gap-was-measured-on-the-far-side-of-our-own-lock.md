# 0133 -- The gap was measured on the far side of our own lock

Date: 2026-08-13
Status: Accepted

## Context

[ADR 0083](0083-a-capture-reports-the-cadence-of-its-own-input-stream-and-the-level-it-was-given.md)
shipped `CallbackCadence` so a capture could say whether its callback was
called, and named the reason: "this is the whole reason the instrumentation
exists, so it names a hypothesis rather than leaving three numbers for a reader
to combine". `signature()` returns `stream_suspended`, `late_delivery`,
`mixed`, `no_gaps` or `no_gaps_but_audio_missing`.

[ADR 0084](0084-the-defect-that-needed-no-dictation-gets-a-binary-that-needs-no-app.md)
built `capture-soak` and registered in advance what a negative night would
mean: **not an exoneration of PipeWire, a move of the suspicion into the app**,
because the soak does a capture's per-callback work *minus the `app.emit`*. The
night ran 2026-08-11/12 and produced nothing across 96 segments and 8 hours.

On 2026-08-13 the defect occurred in ordinary use and was captured whole
(`native-18`, `missing_ratio=0.1547`, seven gaps of 202-366 ms). Read against
the whole cadence-era population -- 195 captures, 3 `Short` -- it says three
things the instrument was not built to say.

**1. `app.emit` is not the cause.** `slowest_emit_ms` is 0 ms and 5 ms in two of
the three failures. The delta ADR 0084 pointed at is fast while the audio
disappears.

**2. The cadence cannot distinguish the two hypotheses it is choosing between.**
`process_samples` takes a blocking `std::sync::Mutex` at `capture.rs:1794` and
calls `cadence.observe(started_at, Instant::now(), …)` at `:1818-1820` --
*inside* the guard. The reported interval therefore begins and ends after lock
acquisition, so "the callback was never called" and "the callback was called and
waited on our mutex" are the same number. A consumer-side stall also yields
`resumed_with_samples = nominal` and `oversized_resumes = 0`, because ALSA drops
the periods it could not hand over rather than growing the next one. That mutex
is contended by `pause_capture` (1106), `resume_capture` (1146), the level read
(1484), the rebuild path (1524, 1629, 1657) and the stop path (1298).

`signature()` at `:706-721` returns `stream_suspended` for any over-threshold
gap with a nominal resume. It asserts a producer-side cause from an observation
that does not carry one.

**3. A third of the loss is below the threshold.** `share_of_missing = 0.658`
means 0.875 s of the 2.556 s missing at 00:36 sits in no gap over
`CALLBACK_GAP_THRESHOLD_MS = 200`. The gap list is silent about it, and
`no_gaps` on a short capture is already documented as "starvation, not a
suspend" -- the same phenomenon, unmeasured.

A fourth finding is not this ADR's subject but bounds it: the soak's real
delta from the app is larger than "the `app.emit`". It is `app.emit` **plus**
lock contention **plus** roughly 1,389 vite full reloads in the same period
([dev-server-reloads-the-app-mid-session.md](../known-issues/dev-server-reloads-the-app-mid-session.md)).

## Decision

The cadence measures the callback, not the callback's wait for us.

1. **`cadence.observe` is fed the timestamp of callback arrival**, taken as the
   first statement of `process_samples`, before `shared.lock()`. The gap becomes
   a property of the stream rather than of the guard.

2. **The lock wait becomes its own reported quantity.** `CallbackCadence` gains
   `slowest_lock_wait` and `lock_wait_total`, recorded as `arrived_at.elapsed()`
   immediately after acquisition. This is the entire difference between
   hypothesis 1 and hypothesis 4 of the record, and nothing else can separate
   them.

3. **The sub-threshold loss is attributed.** Intervals between nominal and
   `CALLBACK_GAP_THRESHOLD_MS` accumulate into `lost_below_threshold`, so
   `lost_in_gaps + lost_below_threshold` accounts for the whole
   `missing_ratio` instead of leaving a third unexplained.

4. **`signature()` stops overclaiming.** A gap dominated by lock wait is not a
   suspend and must not be named one.

5. **`capture_soak.rs` takes the same change.** ADR 0084's premise is that the
   soak is the app minus a *known* delta. A delta that is not known is not a
   control.

The three new fields join the existing cadence line, appended rather than
reordered -- `~/.cache/wordscript-soak-report.sh` and the record's own history
parse it positionally in places.

### The reading, registered in advance

As ADR 0084 did, so it cannot be chosen after the fact:

- `slowest_lock_wait_ms` close to `longest_gap_ms` -> **the app blocked its own
  audio thread.** The fix is ours.
- lock wait near zero while the gap persists -> **the callback genuinely was not
  called.** Hypothesis 1 gets real support for the first time.

## Consequences

**Nothing is fixed by this.** Three realtime violations are visible in the
callback and stay in place until the measurement attributes the loss, because
changing them now destroys the attribution:

- `samples: Vec::new()` (`:1239`) grown by `push` under the lock (`:1826`).
  `max_samples` is computed at `:1220` and used only as a cap, never to
  reserve -- so a capture reallocates and copies a multi-megabyte buffer on the
  audio thread at geometric intervals.
- `collect::<Vec<_>>()` (`:1806`) and `vec![0.0; WAVEFORM_BUCKET_COUNT]`
  (`:1789`): two heap allocations per callback, ~86 per second.
- `app.emit` (`:1862`) on the audio thread. Exonerated as *the* cause by
  `slowest_emit_ms`, still the wrong thread.

They are named here so the next session does not rediscover them, and so that
"we knew and chose to wait" is on the record rather than "we missed it".

**The cadence line grows by three fields on every capture, healthy ones
included.** ADR 0083 established why: a field that only appears on failures has
no baseline, and the first question asked of the first gap would be whether
gaps are normal.

**Route B is withdrawn as a plan.** It was to run the real app silently
overnight to provoke an event. Ordinary use produced one, and at 1.5 % of
captures the next arrives in a day or two. The instrument is the constraint,
not the sample size. Route B stays available if the rate drops.

**This does not close the record.** It makes the next event decidable. If the
next `Short` capture reports a large lock wait, the cause is located after ten
days; if it reports none, hypothesis 1 survives its first real test instead of
being inferred from a resume size.

## References

- [capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md)
  -- the record, and *The first event after the soak night* for the data above
- [ADR 0079](0079-a-capture-states-how-much-of-its-own-clock-it-kept.md) --
  `CaptureIntegrity`, the 10 % threshold and the sentence a short capture says
- [ADR 0083](0083-a-capture-reports-the-cadence-of-its-own-input-stream-and-the-level-it-was-given.md)
  -- `CallbackCadence`, which this corrects rather than replaces
- [ADR 0084](0084-the-defect-that-needed-no-dictation-gets-a-binary-that-needs-no-app.md)
  -- the soak, and the delta this ADR restates
- [dev-server-reloads-the-app-mid-session.md](../known-issues/dev-server-reloads-the-app-mid-session.md)
  -- the other half of that delta
