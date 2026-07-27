# 0010 -- Audio cues are a synthesised motif on one persistent stream

Date: 2026-07-27
Status: accepted

## Context

The audio feedback was a placeholder that was never replaced. Every cue was a
bare sine wave shaped by a linear fade of 8-10 % at each edge, with
fundamentals up to 988 Hz and gains hard-coded between 0.28 and 0.36. A bare
sine with a linear ramp is acoustically a hearing-test tone: thin, piercing and
without any recognisable character.

The playback path had three defects that showed up as "the sound sometimes does
not play, starts chopped, or fires wrongly":

- A fresh output stream was opened for every cue and dropped ~150 ms after it
  finished. When the open failed the cue was lost with nothing but an
  `eprintln!`. The Listen cue fires while `capture` is opening the cpal input
  device, which is exactly when device contention is likely.
- The device was opened cold and played immediately, so the first buffers ran
  into a warm-up underrun. Cues were also rendered at a fixed 44_100 Hz and
  resampled at playback time.
- Cues overlapped by design, and several runtime paths reported the same user
  action twice. `TriggerEffect::AbortCapture` played `Abort` and then `Error`
  for a single failed abort.

A stream that only exists for ~300 ms also cannot carry a remembered
per-application volume in the OS mixer.

The cue set was semantically wrong on top of that. `Stop` fired at capture
teardown, not at completion, while no cue existed for a successful insert. A
conclusive-sounding tone at teardown asserts a completion that has not
happened, which contradicts the overlay principle in `DESIGN_SYSTEM.md` that
the app must never estimate completion itself.

## Decision

**One theme, stated once and then quoted.** `Startup` is the signature: an
ascending G-major triad, G3 -> D4 -> G4 with a quiet B4 shimmer on the arrival.
Every operational cue is a fragment of that theme — `Listen` (D4 -> G4) is its
rising fifth, `Handoff` holds on an unresolved D4, and `Done` resolves down to
the G tonic. Only `Done` reports a finished round trip. `Abort` collapses the
phrase instead of resolving it; `Error` separates itself by interval and
damping rather than by volume. The shared derivation is what makes the set read
as one product instead of as unrelated beeps.

`Startup` carries its own flag (`play_startup_sound`, default on) because it is
the one cue the user did not trigger, and it is the only cue allowed to run
past 900 ms — it plays once per launch rather than during work.

**Cues are synthesised, not shipped as assets.** `core/sound/synth.rs` renders
partial stacks with per-partial decay rates, a mallet transient and an air
layer, under a raised-cosine attack and an exponential decay. Fundamentals stay
below 500 Hz. Rendering takes the sample rate as an argument so cues are built
at the real device rate. Four packs (`timber`, `glass`, `air`, `tap`) vary only
the timbre; every pack plays the same motif.

This keeps binary blobs out of the repo and adds no runtime dependency, and the
peak normalisation to -12 dBFS plus per-cue trim means switching packs changes
the character without changing the loudness. `examples/audition_cues.rs`
renders every pack and cue to WAV so the sound can be judged by ear without
building the app.

**One persistent output stream, owned by one thread.** The stream is opened
once at startup, primed with 40 ms of silence so the device is already running
when the first cue arrives, and kept alive for the process. A new cue replaces
the running one instead of stacking on it.

## Consequences

- The app appears as a stable per-application stream in the OS mixer on Linux
  (PipeWire/PulseAudio) and Windows, with a remembered volume. **macOS offers
  no per-application volume at all**, so the in-app slider is the only control
  there. This is a platform limit, not a gap in the implementation.
- `sound_volume` and the OS per-application volume stay **independent gains and
  are not synchronised**. They answer different questions — how loud the cues
  are inside WordScript versus how loud WordScript is against other apps — and
  the second belongs to the user. No cross-platform API exists for writing it,
  and no dictation app in `donors/` does it: Handy keeps an internal
  `Sink::set_volume` gain, VoiceInk hard-codes `player.volume`, vocalinux shells
  out to `paplay`; the only OS-volume API usage in the whole donor set targets
  the microphone input. See `PLATFORMS.md`.
- The original reason for the per-cue stream was real: long-lived ALSA/cpal
  streams can freeze or crash when the audio server or device changes. That is
  now handled by exclusive thread ownership, a cpal error callback that marks
  the stream dead, and discard-and-reopen (at most 3 reopens per minute)
  instead of paying a device open on every cue. If this proves unstable on real
  hardware, the fallback is closing the stream after ~60 s idle — that costs
  the OS-mixer volume but keeps the timbre, pre-emption and warm-up.
- Pre-emption cuts the outgoing cue rather than cross-fading it. The cut lands
  in the decay tail and is masked by the incoming cue's attack.
- `lib.rs` exposes `pub mod core` so `examples/audition_cues.rs` can drive the
  renderer directly.
- New config: `sound_volume` (clamped to 0.0..=1.0, NaN falls back to the
  default), `sound_pack` (unknown names resolve to `timber`, never to silence)
  and `play_startup_sound`. Old config files pick all three up through serde
  defaults, so no schema migration is needed.
