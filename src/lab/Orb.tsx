import { useRef } from "react";
import { useVoiceEnvelope } from "./useVoiceEnvelope";

/**
 * The orchestrator's voice, drawn as one object. ADR 0043.
 *
 * FOUR STATES, AND EACH MOVES THE WAY THAT STATE BEHAVES:
 *
 *   idle       nothing moves. The process exists.
 *   listening  follows the input level. Cool material — it is receiving, not
 *              producing, so it is lit from outside rather than from within.
 *   thinking   the size holds and the light drifts. There is no amplitude to
 *              show, and a pulse would be inventing one.
 *   speaking   follows the voice envelope: syllables and phrase pauses.
 *
 * The predecessor had two states and one fixed-period keyframe. A fixed period
 * is a heartbeat, and a heartbeat says ALIVE — true of every state including
 * the three where it is the wrong thing to say.
 *
 * THE GLOW IS A box-shadow, NOT A BLURRED ELEMENT. `filter: blur()` promotes
 * the element to its own compositor layer, and a compositor layer that outlives
 * a surface swap is the WebKitGTK ghosting mechanism documented at length in
 * overlay-pill.css. The orb is destined for an always-on-top transparent window
 * on that same engine, so it is built to the rule from the start rather than
 * discovering it later.
 */

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const LABEL: Record<OrbState, string> = {
  idle: "Orchestrator idle",
  listening: "Orchestrator listening",
  thinking: "Orchestrator working",
  speaking: "Orchestrator speaking",
};

interface OrbProps {
  state: OrbState;
  size?: number;
  /** 0..1. Supply from the native `audio_level` event to drive it for real. */
  level?: number;
  /** Generate a demonstration envelope. Never true against a live runtime. */
  demo?: boolean;
  label?: string;
}

export function Orb({ state, size = 72, level, demo = false, label }: OrbProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const moves = state === "speaking" || state === "listening";

  useVoiceEnvelope(
    state === "speaking" ? "speaking" : "listening",
    moves && (demo || level != null),
    (v) => ref.current?.style.setProperty("--orb-level", v.toFixed(3)),
    demo ? undefined : level,
  );

  return (
    <span
      ref={ref}
      className="ws-orb"
      data-state={state}
      data-driven={moves && (demo || level != null) ? "" : undefined}
      style={{ ["--orb-size" as string]: `${size}px`, ["--orb-level" as string]: level ?? 0 }}
      role="img"
      aria-label={label ?? LABEL[state]}
    >
      <i className="ws-orb-glow" />
      <i className="ws-orb-body" />
    </span>
  );
}
