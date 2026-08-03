# 0053: A level readout belongs next to what it measures

Date: 2026-08-04
Status: Accepted

## Context

The dot-matrix readout was first placed on Home's hero state line, as a piece
of the hero panel. The owner's verdict was that the card it lived on was odd,
its content was odd, and the card could go.

The objection is not decoration. Home is the surface you look at when nothing
is happening. A level meter there reports the room when nobody is recording it
— a measurement of a signal that does not exist, presented in the place the
product is calmest.

Behind it sat a second and worse problem. `wave(n, seed)` was the surface's
stand-in for a level wherever a canvas felt like too much: a row of `<i>`
elements with heights taken from a sine, drawn once and never again. It stood
in three places, and in two of them — the meeting HUD's state line and the
agent window's answer strip — it was decorating a window whose entire claim is
that it is listening *right now*. A frozen meter on a recording surface is a
fake state, which the runtime rules forbid in as many words, and those were the
two most conspicuous places in the prototype to commit it.

## Decision

**A level readout appears where the thing it measures is happening, and
nowhere else.** It is removed from Home, and the surface it stood on is
removed with it.

Its three call sites are answered by the instrument that fits the space:

- **The meeting HUD state line** — the matrix, 16 columns at a 2 px pixel
  (47 × 20, the height of the line it sits in). The state line is roughly 70 px
  of spare run inside a 330 px window. A waveform trace at 70 px is a texture;
  a 7-row quantized meter is still a meter, which is the shape hardware level
  indicators have taken for fifty years precisely because it survives being
  small.
- **The agent window's answer strip** — the same instrument, 12 columns. This
  is the moment the user is speaking an answer into a window that is counting
  down, so a level that never moves is the one thing it must not show.
- **The input-level row in General, and the gallery's own swatch** —
  `waveform()`, which there has 600 px and a threshold mark to sit against.
  The waveform sits above the threshold bar, in that order: the shape is what
  you look at while you talk, the threshold is what you check afterwards.

**The component is ported whole, not as the subset the product uses.** A
subset of a component is a different component: the twelfth pass shipped `vu()`
and the circle geometry, called it the matrix, and left `digits`, `loader`,
`pulse`, `wave`, `snake`, the frame clock, `brightness` and the radial fills
behind. Everything upstream carries is now in `matrixField()`, exercised in the
component gallery at upstream's own 10 px pixel. `pulse` is ported and
deliberately unused: ADR 0049 settles that the orchestrator's voice has four
states and none of them pulses.

Three deviations from upstream are marked `WORDSCRIPT` at the point of change:

1. **The unlit-pixel gradient reads `--matrix-off`.** Upstream hardcodes
   `--muted-foreground` in both stops, so the `palette.off` prop it documents
   never reaches the unlit pixels. This is an upstream bug, fixed locally.
2. **`stdDeviation` scales with the pixel size**, at upstream's own ratio
   (2 at size 10, hence `size / 5`). The blur radius lives in the SVG
   coordinate system, so upstream's fixed 2 — tuned to its default 10 px pixel,
   where it is a soft halo — blurs each dot across more than the whole grid at
   the HUD's 2 px pixel and dissolves the readout into an orange smear.
   Performance is not the reason and was measured before the change: at 7 × 24
   in WebKitGTK 2.52.4 the filter, a static drop-shadow and no bloom at all all
   hold 62 fps.
3. **The SVG frame is built once and updated by attribute**, rather than
   reparsed per frame. At 16 fps with a per-frame string parse the 2 px grid is
   the first thing to go.

## Consequences

- `wave(n, seed)` is deleted. There is no cheap fake level left in the
  prototype, which is the point: the next surface that wants one has to pick
  between the two real instruments.
- Home loses a card. That is a reduction and not a gap — the hero panel's job
  is the next action, not a measurement.
- The matrix is now a component with five modes and one product use. The
  gallery is where the other four are judged, and it is the reason porting the
  whole thing is defensible rather than speculative.
- The light scheme keeps the matrix colors and drops the bloom; there is
  nothing to glow into on white (ADR 0048).
- Anyone re-syncing against upstream `matrix.tsx` must carry the three
  deviations forward. They are marked in both the React component and the
  vanilla port, and deviation 1 should be sent upstream.
