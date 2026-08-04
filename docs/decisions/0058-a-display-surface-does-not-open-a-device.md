# 0058: A display surface does not open a device

Date: 2026-08-04
Status: Accepted

## Context

The prototype's Design System screen draws two live instruments in its
Components section: the input waveform and the dot-matrix VU meter. Both move.
They move because `docs/prototypes/settings-rework/demo.js` has no microphone
and cannot get one — it is three files under `docs/`, outside any bundler — so
it drives them from `orbEnvelope()`, a synthetic amplitude generator, and says
so in its own comments. The thirteenth prototype pass replaced a *frozen* bar
row with these, on the grounds that "a picture of a waveform standing in a
gallery of working controls" is not the component.

The product's versions are not synthetic. `src/components/ui/live-waveform.tsx`
opens the microphone through `getUserMedia` and an `AnalyserNode` the moment its
`active` prop is true, and the matrix's `vu` mode reads a real level array. So
the 1:1 port of "the live component, not a still of it" would have the gallery
take the capture device on render — and on Linux under a portal, prompt for it.

That collides with two rules the relay already carries. Plan §4.3 rule 5 and the
repo's runtime rules forbid rendering fake readiness; ADR 0055 permits sample
data in the gallery precisely because a gallery *asserts nothing*. A meter that
is moving is asserting something — it is reporting a measurement — and there is
nothing on a design-time page for it to be measuring.

There is a third cost that is not about honesty. Every remaining preview screen
draws a live instrument: the meeting HUD has three matrices, the agent overlay
has the orb, Live subtitles and Client conversations both carry a level. A
gallery that opens a device per instrument opens it once per screen visit, for
screens whose only purpose is to be looked at.

## Decision

**A gallery screen draws a live instrument at rest.** The component is the real
one, imported from the library, with its real geometry and its real palette; it
is simply not given a running signal. Where a component needs a signal to have a
shape at all — the matrix's `vu` mode draws an empty grid without one — it is
given **one held frame of sample data**, never a generator.

No page under `src/windows/gallery/` may pass `active` to a capture component,
call `getUserMedia`, or start a timer that stands in for a measurement.

This is not a licence to draw a still where the component is animated by its own
definition and needs no device: the matrix's `loader`, `wave`, `snake` and
`pulse` are frame arrays played by a frame clock, they measure nothing, and they
run in the gallery exactly as they run in the product.

## Consequences

- The waveform on Components is `active={false}`, which is the component's own
  rest state — a base-height line rather than an empty box. `shell/Waveform.tsx`
  documents why at the call site nobody will otherwise think to look at.
- Motion's `vu` cell holds a sixteen-column sample array. It reads as a meter,
  it is labelled `vu`, and it does not claim to be measuring the room.
- The distinction the runtime rules draw is preserved exactly: sample data on a
  design-time surface is fine, a claimed measurement is not. What this record
  adds is that **a moving instrument IS a claimed measurement**, which the
  prototype could not discover because its instruments never had a device to
  take.
- Legs 2b and 4 inherit it. The meeting HUD, the agent overlay, Live subtitles
  and Client conversations all land in the gallery with their instruments at
  rest; when Leg 4 wires each screen onto a product surface, the same component
  is given the runtime's signal and the rest state disappears with the
  scaffolding entry (ADR 0057).
- It does not touch the overlay, which draws its own bars from a real capture on
  a real product surface and is out of scope for the whole plan.
