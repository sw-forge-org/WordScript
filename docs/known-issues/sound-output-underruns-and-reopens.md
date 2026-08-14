# Bug: The cue output stream underruns constantly and reopens itself

Status: **Half fixed 2026-08-14 (ADR 0150), half open and now correctly
attributed.** The underrun class is gone with the held-open stream: the engine
opens on demand and closes after 60 s idle. **The routing half is open and was
never this stream's lifecycle to fix** — the 2026-08-14 addendum reasoned that
a per-cue stream would follow the user's default, and the second addendum below
shows that it does not. Found 2026-08-13 while researching the capture loss.

First reported: 2026-08-13, from a terminal frame the owner sent showing
`[WordScript] Audio stream error: Buffer underrun/overrun occurred.` — **the
line reads `Audio output stream error:` since 2026-08-14**; every quotation of
the old wording in this record is left as it was logged.
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

## Addendum 2026-08-14 — it has a user-visible symptom now, and it is the routing

Reported as *"der Ton ist weg"* right after a dev-host restart. **The cues were
playing the whole time — into the wrong device.** Measured while it was
happening:

```
Sink Input #31343   application.name = "WordScript"
  Sink: 28079 → alsa_output.pci-0000_01_00.1.hdmi-stereo   (RUNNING)
  Mute: no   Volume: 100%   Corked: no
  module-stream-restore.id = "sink-input-by-application-name:WordScript"

Default Sink: bluez_output.A8_E6_E8_5A_BC_8D.1              (SUSPENDED)
```

The owner was listening on the Bluetooth default; WordScript was on the HDMI
monitor. Nothing was muted, nothing was corked, the volume was full.

**Two things in that dump are this record's, not PipeWire's.**

**One: the HDMI sink is `RUNNING` and WordScript is the only stream on it.** The
monitor's audio path is awake solely because this app holds a sink open with
nothing to play. That is the same permanently-open stream the sections above
measure underruns on, seen from the outside.

**Two: a held-open stream acquires a route once and keeps it.** PipeWire's
`module-stream-restore` remembers the device per application name and re-applies
it when the process starts, which is why a restart is when this surfaces. A
stream that is opened for a cue and closed after it would be routed at the
moment it plays, i.e. to whatever the default is then — the symptom could not
exist. So *next step 2* below is no longer only about the underrun class: **it
is also the difference between cues that follow the user's output device and
cues that stick to whichever device was current when the app started.**

**And the cost runs the other way too.** Moving the stream to the Bluetooth sink
fixes the sound and then keeps that device permanently awake, because the app
never closes the stream — the headphones cannot idle-suspend, the codec stays
engaged, the battery pays for it. Holding the sink open is not neutral in either
direction.

Immediate relief for a user in this state, which fixes the session and not the
cause:

```
pactl move-sink-input <id> @DEFAULT_SINK@
```

**Not measured:** whether the routing was already on HDMI before the restart.
Nobody looked, so the addendum claims only where the stream was when it was
observed, and why a process start is the moment the remembered route is applied.

**This is the first user-visible symptom against this record**, which until now
said there was none. It does not change the underrun measurements above and it
does not turn *next step 2* into a decided question — it adds a second reason to
answer it, and a second consumer: the speech track's **F2** builds a *second*
output stream (`list_native_output_devices`, a named speech stream with its own
lifecycle, `Silent` opening no stream rather than muting one). If the cue stream
keeps its current shape, F2 inherits this symptom on the voice path.

## Addendum 2026-08-14, second — the stream now closes, and the addendum above was wrong about why that matters

Runtime-ownership step 7, [ADR 0150](../decisions/0150-the-cue-stream-closes-when-it-is-idle-and-closing-it-does-not-answer-where-it-plays.md).
Two things landed and a third was refuted.

**Next step 1 is done.** The callback logs `Audio output stream error: …`.

**Next step 2 is decided: the sink is not held open.** ADR 0010 had already
named this fallback in advance — *"closing the stream after ~60 s idle"* — so
this is that decision's own condition being met rather than a new preference.
The engine opens on demand and closes after 60 s with an empty player.

**Measured, because next step 2 asked for the open latency against
`WARMUP_MS = 40`:**

| | ms |
|---|---|
| cold open, six fresh processes | 20.1, 44.5, 15.9, 18.7, 14.2, 14.9 |
| warm opens in those processes | 9.6 – 15.7 |
| silence already prepended at every open | 40 |

The open usually disappears inside a budget the engine already pays. The 44.5 ms
outlier is kept rather than averaged away; it costs a marginally late cue, not a
missing one. **The default sink during the measurement was a virtual loopback,
which is the cheapest open on this machine — a suspended Bluetooth sink is
unmeasured and is where this could still be wrong.**

**Verified in the running app rather than argued**, and then in the owner's
ordinary use rather than in a contrived one:

```
[+60.043]  Audio output closed after idle
           alsa_output.pci-0000_01_00.1.hdmi-stereo   RUNNING → SUSPENDED
           WordScript sink-input                       gone
```

```
+60.058   closed after idle      (startup warm-up, no cue followed)
+265.355  opened                 (a dictation's Listen cue)
+332.091  closed after idle      (66.7 s open — 60 s past the last cue)
+445.646  opened                 (the next dictation)
```

Before it, the same check as the first addendum's: WordScript was the **only
sink input in the entire system** and the monitor's audio path was awake for it
alone.

**The error count since the change is zero and that is not a result.** At the
measured base rate of 5.2 per hour, under half an error was expected in the
window observed. The argument is that an idle stream is what underran and there
is no longer an idle stream; the count is consistent with it and nothing more.
A day of ordinary use is what would make it evidence.

### The refutation — a per-cue stream does not follow the default here

The first addendum reasoned: *"a stream that is opened for a cue and closed
after it would be routed at the moment it plays … the symptom could not
exist."* **It can, and it does.** WirePlumber persists a target keyed by
application name, in `~/.local/state/wireplumber/stream-properties`:

```
Output/Audio:application.name:WordScript={"target":"alsa_output.pci-0000_01_00.1.hdmi-stereo", …}
```

Probe, with a control, while the default sink was something else entirely:

| new stream named | landed on |
|---|---|
| `WordScript` | `hdmi-stereo` — the remembered target |
| `WsProbeControl` | the current default |

**And the rule is written by the relief this record recommends.** Moving the
control stream with `pactl move-sink-input` made a `target` appear for a name
that had none. So the immediate-relief line above fixes the session **and pins
the application to that sink for every future stream**. It is a pin, not a
reset.

**The product confirmed it unprompted after the change**: the stream closed
after idle and the next cue reopened it on HDMI, with the default sink
elsewhere.

**What this leaves open, correctly attributed:** cues follow a remembered
device, not the user's. Fixing that needs the app to choose its output device
rather than inherit one — `list_native_output_devices`, which is the speech
track's **F2**. It was never the cue stream's lifecycle question and this record
said it was for one day.

**One probe artifact was left behind**, stated so it is not mistaken for a real
rule later: `Output/Audio:application.name:WsProbeControl={"target":…}` now
exists in the machine's WirePlumber state. It names a stream that will never
exist again and is inert.

## References

- [ADR 0150](../decisions/0150-the-cue-stream-closes-when-it-is-idle-and-closing-it-does-not-answer-where-it-plays.md)
  — the lifecycle decision, the open-latency measurement and the routing
  refutation
- [ADR 0010](../decisions/0010-audio-cues-are-a-synthesised-motif-on-one-persistent-stream.md)
  — the persistent stream, and the idle-close fallback it registered in advance
- [capture-loses-half-the-recording.md](capture-loses-half-the-recording.md) —
  the record this is a candidate path into. **The candidate is narrower now**:
  with no idle stream there is no idle reopen, so the graph renegotiation this
  record offered as a path can no longer happen between captures — only during
  one whose cues fire
- [`../tracks/speech-track-plan.md`](../tracks/speech-track-plan.md) — **F2**,
  the second output stream. Its lifecycle question is answered by ADR 0150; the
  **routing** question is now F2's alone
- [dev-server-reloads-the-app-mid-session.md](dev-server-reloads-the-app-mid-session.md)
  — the other environment-level finding from the same 2026-08-13 session
