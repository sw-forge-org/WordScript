import { useEffect, useRef } from "react";

/**
 * A speech-shaped amplitude envelope.
 *
 * WHY THIS EXISTS. A voice indicator driven by a sine wave is unmistakably not
 * a voice, and the eye reads the difference long before it can name it: speech
 * has no period. It has syllables — roughly four to seven a second, each with a
 * sharp onset and a softer tail, separated by gaps too short to see, and
 * interrupted by phrase pauses long enough to notice. Amplitude between
 * syllables varies more than most people expect; a stressed syllable runs about
 * twice an unstressed one in the same word.
 *
 * The smoothing is a real meter's: fast attack, slow release. That asymmetry is
 * most of the effect. Anything that rises and falls at the same rate reads as a
 * pulse no matter what shape is fed into it, because the eye reads symmetry as
 * rhythm.
 *
 * WHAT IT IS FOR. Two things, and they are different. In the component lab it
 * generates a demonstration signal so the motion model can be judged, which a
 * still frame cannot show. In the product it is the SMOOTHER only: feed
 * `external` from the native `audio_level` event and the syllable generator
 * switches off, leaving the attack/release curve that makes a raw level stream
 * readable. A meter wired straight to raw samples flickers.
 */

export type EnvelopeKind = "speaking" | "listening";

interface Profile {
  syl: [number, number];
  gap: [number, number];
  amp: [number, number];
  phrase: [number, number];
  phraseEvery: [number, number];
  attack: number;
  release: number;
}

const PROFILES: Record<EnvelopeKind, Profile> = {
  speaking: {
    syl: [0.1, 0.2],
    gap: [0.03, 0.07],
    amp: [0.42, 1.0],
    phrase: [0.34, 0.7],
    phraseEvery: [5, 11],
    attack: 0.04,
    release: 0.16,
  },
  /* Dictation has longer thinking gaps than synthesis ever does, and it peaks
     lower, because a person talking to their own machine does not project. */
  listening: {
    syl: [0.12, 0.26],
    gap: [0.04, 0.11],
    amp: [0.28, 0.86],
    phrase: [0.45, 1.3],
    phraseEvery: [3, 8],
    attack: 0.055,
    release: 0.21,
  },
};

const rand = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);

class Envelope {
  private profile: Profile;
  private target = 0;
  private until = 0;
  private clock = 0;
  private left: number;
  level = 0;

  constructor(kind: EnvelopeKind) {
    this.profile = PROFILES[kind];
    this.left = Math.round(rand(this.profile.phraseEvery));
  }

  step(dt: number, external?: number): number {
    const p = this.profile;

    if (external == null) {
      this.clock += dt;
      if (this.clock >= this.until) {
        if (this.target > 0) {
          this.target = 0;
          this.left -= 1;
          if (this.left <= 0) {
            this.until = this.clock + rand(p.phrase);
            this.left = Math.round(rand(p.phraseEvery));
          } else {
            this.until = this.clock + rand(p.gap);
          }
        } else {
          this.target = rand(p.amp);
          this.until = this.clock + rand(p.syl);
        }
      }
    } else {
      this.target = Math.max(0, Math.min(1, external));
    }

    /* Exponential approach with a different constant each direction, and
       dt-correct so a dropped frame produces a slower step rather than a
       jump. */
    const tau = this.target > this.level ? p.attack : p.release;
    this.level += (this.target - this.level) * (1 - Math.exp(-dt / tau));
    if (this.level < 0.001) this.level = 0;
    return this.level;
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs an envelope on rAF and hands each frame's level to `onFrame`.
 *
 * `onFrame` is held in a ref rather than listed as an effect dependency: a
 * caller that passes an inline arrow — which is every caller — would otherwise
 * tear down and restart the animation on every render, and an envelope that
 * restarts loses the phrase it was in the middle of.
 */
export function useVoiceEnvelope(
  kind: EnvelopeKind,
  active: boolean,
  onFrame: (level: number) => void,
  external?: number,
): void {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const externalRef = useRef(external);
  externalRef.current = external;

  useEffect(() => {
    if (!active) return;

    if (prefersReducedMotion()) {
      /* Hold a representative level rather than zero. Reduced motion means do
         not animate; it does not mean render an instrument that looks broken. */
      onFrameRef.current(0.55);
      return;
    }

    const env = new Envelope(kind);
    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      onFrameRef.current(env.step(dt, externalRef.current));
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [kind, active]);
}
