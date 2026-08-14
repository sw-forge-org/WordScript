# 0150 -- The cue stream closes when it is idle, and closing it does not answer where it plays

Date: 2026-08-14
Status: Accepted

## Context

[ADR 0010](0010-audio-cues-are-a-synthesised-motif-on-one-persistent-stream.md)
decided one persistent output stream, owned by one thread, opened at startup
and kept alive for the process. It also wrote down, in advance, the condition
under which that would be wrong and what to do about it:

> If this proves unstable on real hardware, the fallback is closing the stream
> after ~60 s idle -- that costs the OS-mixer volume but keeps the timbre,
> pre-emption and warm-up.

The evidence it asked for exists.
[`sound-output-underruns-and-reopens.md`](../known-issues/sound-output-underruns-and-reopens.md)
counts **283 stream errors against 256 reopens** between 2026-08-10 and
2026-08-13, many of them at a fixed `:35` past the minute across unrelated
hours -- the shape of an idle timeout rather than of load. On 2026-08-14 the
record gained its first user-visible symptom: the cues were playing at full
volume into an HDMI monitor while the owner listened on a Bluetooth default,
with WordScript the only stream on that sink and the sink `RUNNING` because of
it.

That state was still present, unprompted, when this decision was written:
WordScript was the **only sink input in the entire system**, and the monitor's
audio path was awake for an application that was making no sound.

## What was measured

**The open costs less than the silence already being pushed ahead of it.**
`WARMUP_MS` prepends 40 ms of silence at every open so the first cue does not
land in the device warm-up. Against that budget, six cold opens in six fresh
processes and their warm followers:

| | ms |
|---|---|
| cold open, six processes | 20.1, 44.5, 15.9, 18.7, 14.2, 14.9 |
| warm opens, same processes | 9.6 - 15.7 (mean 11.8 - 14.9) |
| warm-up silence already prepended | 40 |

So the typical open disappears inside a budget the engine already pays. **The
44.5 ms outlier exceeds it**, and it is written here rather than averaged away:
what it costs is a marginally late cue, not a missing one, because the open
either returns a device or reports `Audio output unavailable`.

**Stated limitation, because it is the case that could overturn this.** The
default sink at measurement time was `alsa_output.platform-snd_aloop`, a
virtual loopback, which is the cheapest open available on this machine. **A
suspended Bluetooth sink is unmeasured**, and it is exactly where an open can
cost orders of magnitude more, because the link has to be re-established. The
instrument is `sound::engine::tests::measures_what_an_output_open_costs`,
`#[ignore]`d; the speech track's **F2** owes `PLATFORMS.md` its measured
section and this is one of the measurements it owes.

## The correction, and it is why this decision has two halves

The record's 2026-08-14 addendum reasoned that closing the stream would fix the
routing:

> A stream that is opened for a cue and closed after it would be routed at the
> moment it plays, i.e. to whatever the default is then -- the symptom could
> not exist.

**That is false on this machine, and the probe that shows it is three lines.**
WirePlumber persists, keyed by application name:

```
Output/Audio:application.name:WordScript={"target":"alsa_output.pci-0000_01_00.1.hdmi-stereo", ...}
```

A fresh stream carrying `application.name = WordScript` lands on **HDMI**. The
same stream carrying `WsProbeControl` lands on **the default**. The control was
run because without it the first result proves nothing.

And the rule is written by the operation the record recommended as relief:
moving a stream with `pactl move-sink-input` made a `target` appear for the
control name where there had been none. **The record's own remedy is what makes
the pin permanent.**

The product then confirmed it without being asked. After the change landed, the
stream closed after its idle window and the next cue **reopened it on HDMI**,
while the default sink was something else.

## Decision

**1. The log line names its stream.** `Audio output stream error: …`. The old
wording read as a capture failure and cost the 2026-08-13 investigation a
detour; capture reports itself through `Capture integrity` and
`Capture callback cadence` and never through this callback.

**2. The output stream is opened on demand and closed after `IDLE_CLOSE` = 60
s.** ADR 0010's own fallback, taken on the evidence it named. A cue chain within
one dictation (`Listen` → `Handoff` → `Done`) runs on one open stream; an app
that is not making sound holds no device. A cue still sounding defers the close
to the next idle window rather than truncating it.

**3. The reopen budget counts failures, not opens.** `MAX_REOPENS` exists for a
device that keeps dying. If an idle close spent it, four dictations inside a
minute would leave the app silent -- the regression this rule exists to
prevent. A cold open, or the first after an idle close, is always allowed; only
an open following a stream error or a failed open is rate-limited.

**4. Where a cue plays is not decided here, and decision 2 does not fix it.**
Naming it as unfixed is the point of writing the probe down. It needs the app to
select its output device rather than inherit a remembered one, which is
`list_native_output_devices` and belongs to the speech track's **F2**.

## Consequences

- **ADR 0010's OS-mixer consequence is narrowed rather than reversed.** The
  per-application entry now exists while cues play and for 60 s after, instead
  of permanently. A volume set on it still survives, because stream-restore
  remembers it by application name; what is lost is the ability to adjust it
  while the app is silent.
- **The underrun and reopen class goes with the idle stream**, by construction:
  the errors land on a stream sitting idle, and there is no longer one to sit.
  Observed in the owner's own session, which is the cycle rather than a single
  event:

  ```
  +60.058   closed after idle      (startup warm-up, no cue followed)
  +265.355  opened                 (a dictation's Listen cue)
  +332.091  closed after idle      (66.7 s open, i.e. 60 s past the last cue)
  +445.646  opened                 (the next dictation)
  ```

  The sink was `SUSPENDED` and WordScript had no stream at all in each gap.
  **The error count in that window is zero and that is not evidence**: the base
  rate is 5.2 per hour, so under half an error was expected in it. The
  construction is the argument; the count is only consistent with it.
- **A headset can idle-suspend again.** The reverse cost the record named --
  a moved stream keeping a Bluetooth device permanently awake, codec engaged,
  battery paying for it -- does not exist under this shape. The new cost is that
  the next cue pays that device's wake-up, and it is unmeasured.
- **`pactl move-sink-input` is not relief, it is a pin.** It fixes the session
  and stops the stream following the default from then on. If the pin is what
  the user wants, that is how to set it; if following the default is what they
  want, the stored `target` has to go rather than be rewritten.
- **F2 inherits this shape rather than the held-open one**, and inherits the
  routing question as an open one rather than as a solved one.
- The engine's idle close is exercised by
  `a_cue_after_an_idle_close_opens_the_device_again`, `#[ignore]`d because the
  open is the part that touches hardware and is therefore the part no synthetic
  test can see. It was made to fail before it was trusted (ADR 0124).

## References

- [ADR 0010](0010-audio-cues-are-a-synthesised-motif-on-one-persistent-stream.md)
  -- the persistent stream, and the fallback this decision takes
- [ADR 0097](0097-speech-gets-a-second-output-stream-on-a-device-the-user-picks.md)
  -- the second output stream, whose lifecycle question this answers once
- [ADR 0124](0124-the-registry-answers-for-the-whole-table-at-once-and-a-vendors-absence-from-it-is-the-answer.md)
  -- the rule that a test is verified by being made to fail before it is
  trusted, which is why the lifecycle test was falsified first
- [`sound-output-underruns-and-reopens.md`](../known-issues/sound-output-underruns-and-reopens.md)
  -- the record, its measurements and the sentence corrected above
- [`../tracks/runtime-ownership.md`](../tracks/runtime-ownership.md) -- step 7
