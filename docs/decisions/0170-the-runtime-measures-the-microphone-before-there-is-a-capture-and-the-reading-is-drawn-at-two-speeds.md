# 0170: The runtime measures the microphone before there is a capture, and the reading is drawn at two speeds

Date: 2026-08-16
Status: Accepted

## Context

General's input-level row asks one question — *is this microphone set right* —
and it asks it before there is anything to answer it with. Both instruments in
the row were unable to answer:

- **The waveform never moved.** `LiveWaveform` has exactly one source of audio:
  `active` opens a microphone with `getUserMedia` and an `AnalyserNode`. Driving
  it that way would have WordScript hold a second capture device for as long as
  a settings page is open, which is the thing ADR 0063's call detection watches
  for, so the row drew it at rest. The prototype animates the same drawing from
  a synthetic envelope because it has no microphone at all — a fake state the
  runtime rules forbid in the product, and ADR 0053 already deleted the last
  cheap fake level from the tree.
- **The meter under it could only move during a dictation.** It reads
  `audio_level`, which `core::capture` emits from inside a capture. Sitting in
  Settings, no capture is running, so nothing arrives and the verdict line says
  "Speak to measure the level." forever.

The header of `General.tsx` recorded the waveform as the one fact on the screen
with no source, on the grounds that `audio_level` carries a scalar rather than
the sample history a waveform needs. That reasoning was wrong in an instructive
way: a scrolling bar chart needs ONE value per bar, not a buffer. What was
actually missing was not a shape — it was a measurement taken when nothing is
being recorded.

Wiring it produced a second problem the owner found immediately, and it is the
more interesting half of this decision. With the reading connected, the verdict
line flipped between "Good — peak −11 dBFS." and "Too quiet — peak −47 dBFS is
below the −34 dBFS needed to register as speech." several times a sentence.
Every frame of that was technically correct: a speaking voice crosses the speech
threshold on each syllable and drops under it in each gap between words, and the
verdict was being decided per 42 ms reading. Because the two sentences are
different lengths, the card resized underneath the flicker. The frame rate was
visibly wrong as well — driving the drawing through React state re-rendered the
whole settings screen twenty-four times a second, and the animation lost.

## Decision

**The runtime measures the microphone whenever the row that shows it is on
screen, and the frontend never opens a device.** `core::input_monitor` opens the
configured input read-only, stores no audio at all, and emits `level` and `rms`
every 42 ms — the same cadence a capture reports at — on
`input_monitor_level`.

**It is a channel of its own, not `audio_level`.** `audio_level` means "a
capture is producing this". The overlay draws its bars from it, so a settings
screen emitting one would have the overlay report a recording that is not
happening.

**A capture always wins.** `start_native_capture` stops the monitor
unconditionally before opening its own stream, and the monitor refuses to start
while a capture is running. A dictation may never lose its device to a settings
screen.

**The microphone is open only while somebody is looking at the meter.** The
condition is the screen being on top AND the window being focused — visibility
alone would leave a device open behind whatever the user switched to. Focus is
read from the window (`isFocused` / `onFocusChanged`), not from `document`,
because a window can be the one you are looking at while the focus sits in
another view inside it.

**A monitor cannot outlive the window that asked for it.** A webview that
vanishes runs no cleanup, so the monitor holds a 45 s lease that the screen
renews every 15 s; a lease that runs out stops the stream and says so on
`input_monitor_stopped`. The microphone is bounded by a clock the frontend
cannot fail to wind.

**The reading is drawn at two speeds, and the split is what is WATCHED versus
what is READ.**

- *Watched* — the waveform and the level bar. Both animate at the display's rate
  off a ref, with meter ballistics between the runtime's reports: fast attack so
  a syllable is not softened away, slower release so a fall reads as a level
  falling. Neither costs a React render. This is not an optimisation detail: the
  bar and the waveform are on a settings screen with a large tree above them,
  and re-rendering it per reading is exactly what dropped the frames.
- *Read* — the verdict sentence, its colour and the dBFS figure. The verdict is
  decided over a 2.5 s window (1.5 s for clipping, which outranks it and decays
  slower because it is the failure you cannot repair afterwards), and the figure
  quoted is that window's peak. State is committed only when the printed
  sentence would actually differ.

**The verdict line reserves two lines of height.** The verdicts are different
lengths, and a line as tall as its current sentence resizes the card every time
the answer changes.

`LiveWaveform` gains one marked deviation from upstream, `externalLevel`, taking
a ref rather than a value for the reason above. Every upstream path is untouched
when it is absent, which is its default.

## Consequences

- General's input-level row measures for real, and the header's §2.5 entry —
  the waveform as the screen's one fact with no source — is spent.
- WordScript holds an open input device while General is focused. That is a real
  cost and it is bounded three ways: focus, the lease, and a capture taking
  precedence. Nothing is stored; there is no sample buffer in the module and no
  path to one.
- `useInputLevel` now returns two things at two rates. A surface that draws a
  moving level takes the refs; a surface that prints one takes the state. Taking
  the state for a moving drawing is the defect this ADR exists to end, and it
  will not announce itself — it looks like a slightly stuttery meter.
- The verdict is deliberately slower than the measurement. A reading that is
  right for 42 ms and unreadable is worth less than one that is right for the
  phrase, and the bar above it still moves at full rate, so nothing about the
  measurement got slower — the SENTENCE did.
- `input_monitor_level` and `input_monitor_stopped` join the runtime event
  contract. Anything reading `audio_level` to mean "a capture is running" keeps
  that meaning.
