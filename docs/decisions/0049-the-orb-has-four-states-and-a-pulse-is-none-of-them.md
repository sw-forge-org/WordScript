# 0049 -- The orb has four states, and a pulse is none of them

Date: 2026-08-03
Status: Accepted (prototype and component lab; Phase 8 implements)

## Context

[ADR 0043](0043-the-orchestrator-has-one-voice-and-that-voice-has-a-body.md)
established that the orchestrator has one voice and that voice has one body: a
sphere, not bars, because bars are plural and eleven of them beside three named
targets is what made the agent window read as three agents talking.

The drawing that followed had two states, `idle` and `active`, and `active`
moved on a CSS keyframe with a fixed period whose duration was scaled by level.
That is a breathing animation, and reviewing it in motion showed two problems
that no still frame had surfaced.

**A fixed period is a heartbeat, and a heartbeat says ALIVE.** That is true of
every state the orchestrator can be in, including the ones where it is the
wrong thing to say. The sphere pulsed identically whether it was speaking,
waiting for a model, or listening to a dictation, so the one object that is
supposed to carry what the process is doing carried only that it existed.

**Speech has no period.** A voice driven by a symmetrical oscillator is
unmistakably not a voice. Real speech is syllables — roughly four to seven a
second, sharp onset, softer tail, gaps too short to see, interrupted by phrase
pauses long enough to notice, and with stressed syllables running about twice
the amplitude of unstressed ones in the same word. The eye reads the difference
long before it can name it.

## Decision

**Four states, each moving the way that state actually behaves.**

| State | Material | Motion |
| --- | --- | --- |
| `idle` | unlit, neutral, no glow | none |
| `listening` | cool, lit from outside | follows input level |
| `thinking` | warm, lit but not glowing | size holds; the light drifts |
| `speaking` | warm, lit from inside | follows the voice envelope |

**`thinking` is the state the pulse was lying about.** There is no amplitude
during model work — nothing is being said and nothing is being heard — so there
is no honest signal to scale. Inventing one is what the old animation did. The
sphere holds its size and the light source drifts instead, achieved by rotating
the body, which rotates an off-centre highlight: a moving light for the cost of
one transform, with no gradient recomputed and no compositor layer promoted.
The swing is a pendulum, not a full turn, because a full turn is a spinner and
a spinner means "waiting for a network".

**The envelope is a syllable chain with meter physics**, not an oscillator:
fast attack, slow release. That asymmetry does most of the work — anything that
rises and falls at the same rate reads as a pulse regardless of the shape fed
into it, because the eye reads symmetry as rhythm.

**Smoothing happens at one end only.** When JS writes `--orb-level` every
frame, the CSS transition on the body is removed. Two smoothers in series lag
the signal by the transition duration and round off exactly the transients that
make speech look like speech.

**`listening` is not `speaking` at lower volume.** It is a different material —
cooler, less saturated, glow held close to the body — because the orchestrator
receiving and the orchestrator producing are opposite directions and a
brightness difference alone does not say which.

**Reduced motion keeps all four and drops all movement.** The states stay
distinguishable, because material and glow carry them and those are
information; only the motion is decoration-adjacent, and only it is dropped.

## Consequences

- The shared envelope lives in `src/lab/useVoiceEnvelope.ts` and has two jobs.
  In the lab it generates a demonstration signal, because a motion model cannot
  be judged from a still. In the product it is the SMOOTHER only: feed it the
  native `audio_level` stream and the syllable generator switches off, leaving
  the attack/release curve that makes a raw level readable. A meter wired
  straight to raw samples flickers.
- The glow stays a `box-shadow`. `filter: blur()` promotes the element to its
  own compositor layer, and a compositor layer outliving a surface swap is the
  WebKitGTK ghosting mechanism `overlay-pill.css` documents at length. The orb
  is destined for a transparent always-on-top window on that engine.
- The dictation overlay is untouched. Your voice is bars on the pill; the
  machine's voice is this sphere. Two directions, two drawings.
- `data-state="active"` is kept as an alias for `speaking` so existing markup
  renders as something rather than as nothing. It is an alias, not a fifth
  state, and new code should not use it.
