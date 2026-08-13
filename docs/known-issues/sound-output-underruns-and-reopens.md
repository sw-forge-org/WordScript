# Bug: The cue output stream underruns constantly and reopens itself

Status: **Open — found 2026-08-13 while researching the capture loss. Measured,
not diagnosed. Nothing user-visible has been reported against it; it was found
in the log.**

First reported: 2026-08-13, from a terminal frame the owner sent showing
`[WordScript] Audio stream error: Buffer underrun/overrun occurred.`
Affected area: `core::sound::engine` — the cue playback device, not capture

## Symptom

There is no reported symptom. The runtime log carries **283
`[WordScript] Audio stream error: Buffer underrun/overrun occurred.` lines**
between 2026-08-10 18:23 and 2026-08-13 00:55, and **256
`Audio output opened rate=44100 channels=2`** lines against them.

The cues themselves still play, so this has stayed invisible.

## It is the output stream, not the capture

The line comes from the error callback installed on the **cue playback sink**,
`src-tauri/src/core/sound/engine.rs:212-215`:

```rust
.with_error_callback(move |error: rodio::cpal::StreamError| {
    flag.store(true, Ordering::Relaxed);
    runtime_log::record(format!("[WordScript] Audio stream error: {error}"));
})
```

This matters because the wording invites the opposite reading. A capture
failure is reported by `Capture integrity` / `Capture callback cadence`, never
by this line. The message needs the word `output` in it.

## Mechanism

`open_device()` (engine.rs:204-226) opens a `DeviceSinkBuilder` sink and the
engine **holds it open for the process lifetime** rather than opening it per
cue. An idle output stream on this machine's PipeWire graph underruns, the
error callback sets `failed`, and the next cue takes the recovery path in
`ensure_device()` (engine.rs:155-185):

- log `Audio output reported a stream error, reopening` (53 times in the log),
- drop the device and **clear the synthesized-cue cache** (`:164`), so every cue
  is re-synthesized after every failure,
- reopen, and clear the cache again (`:178`).

`may_reopen()` (engine.rs:187-201) caps this at `MAX_REOPENS = 3` per
`REOPEN_WINDOW = 60 s`. Past that the engine stays silent until the window
rolls, which is the correct guard but means a burst ends in no cues at all.

Many of the errors land at exactly `:35` past the minute across unrelated hours
(00:10:35, 00:26:35, 01:02:35, 01:17:35, 02:30:35, 03:30:35, 04:02:35 …), which
looks like a fixed-period idle timeout rather than load. That is an observation,
not a diagnosis.

## The one reason it touches the capture record

Reopening an output stream renegotiates the PipeWire graph, and a capture node
on the same graph can be suspended by that. So it is a candidate path into
[capture-loses-half-the-recording.md](capture-loses-half-the-recording.md).

The evidence is suggestive and **underpowered**:

| | captures | of which `Short` |
|---|---|---|
| output stream error during the recording | 6 | **1** (16.7 %) |
| no output error during the recording | 208 | 2 (1.0 %) |

The one hit is 2026-08-11 02:18:36, where the error fired at `+2.19 s` into the
capture and the callback gap was logged at `at_ms=2299` — **110 ms later** — with
`Audio output reported a stream error, reopening` immediately after the capture
stopped. That ordering is the right shape for the mechanism.

Against it: the other two `Short` captures (2026-08-11 06:01, 2026-08-13 00:36)
have **no output stream error anywhere near them**. So this is at most one path
of several, and at n=6 the enrichment does not reach significance. It is
recorded so the next event can be checked against it, not as a finding.

## Next steps

1. Rename the log line to name the stream (`Audio output stream error: …`).
   Cheap, and it stops the next investigation from starting in the wrong place.
2. Decide whether the sink should be held open at all. A cue engine that opens
   on demand and closes after a short idle would remove the underrun class
   entirely, at the cost of open latency on the first cue — measure that against
   `WARMUP_MS = 40`.
3. Only if 2 keeps the sink open: check whether the error is genuinely an
   underrun on an idle stream or a suspend, with `PIPEWIRE_DEBUG=3` on the
   output node.
4. Carry the output-error timestamps into the capture record's next event
   review, so the 6-capture table grows instead of being re-derived.

## References

- [capture-loses-half-the-recording.md](capture-loses-half-the-recording.md) —
  the record this is a candidate path into
- [dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md)
  — the other environment-level finding from the same 2026-08-13 session
