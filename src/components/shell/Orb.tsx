import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * THE ORCHESTRATOR'S VOICE, GIVEN A BODY — ADR 0043, ported from `demo.css`
 * §"The orb" and `demo.js`'s `orb()`.
 *
 * The agent window drew a rail of three targets, each with its own status dot,
 * and read as three agents talking. It is one: ADR 0030 is built on exactly
 * that, the orchestrator is WordScript's only client and it speaks FOR the
 * agents it starts. A surface that suggests otherwise is arguing against the
 * decision it exists to implement.
 *
 * FOUR STATES, AND THE DIFFERENCE IS INFORMATION. `idle` is small, still and
 * white; `listening` is cool and follows YOUR level; `thinking` holds its size
 * and lets the light walk around it; `speaking` follows the voice envelope.
 *
 * `level` IS 0..1 AND IS SET, NEVER ANIMATED HERE. The runtime feeds it the
 * TTS output amplitude. A gallery holds one frame of it — ADR 0058: a moving
 * instrument is a claimed measurement, and this component measures nothing on
 * its own. `drive` exists for the runtime caller that writes `--orb-level`
 * per frame and needs the CSS transition out of the way; a display surface
 * never sets it.
 */

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "active";

const ORB_LABEL: Record<OrbState, string> = {
  idle: "Orchestrator idle",
  listening: "Orchestrator listening",
  thinking: "Orchestrator working",
  speaking: "Orchestrator speaking",
  active: "Orchestrator speaking",
};

export function Orb({
  state = "active",
  level = 0,
  size,
  still,
  drive,
  label,
  className,
}: {
  state?: OrbState;
  level?: number;
  size?: number;
  still?: boolean;
  drive?: "speaking" | "listening";
  label?: string;
  className?: string;
}) {
  const px = size ?? (state === "idle" ? 26 : 96);
  return (
    <span
      className={cn("ws-orb", className)}
      data-state={state}
      data-still={still ? "" : undefined}
      data-drive={drive}
      style={{ "--orb-size": `${px}px`, "--orb-level": level.toFixed(2) } as CSSProperties}
      role="img"
      aria-label={label ?? ORB_LABEL[state]}
    >
      <i className="ws-orb-glow" />
      <i className="ws-orb-body" />
    </span>
  );
}

/**
 * The state set, side by side. Four columns rather than two, because the point
 * of the set is the comparison and the pair that must be told apart fastest is
 * listening against speaking — two columns would put one under the other.
 *
 * The stage is a dark viewing box in both schemes. A glow is legible only
 * against something dark, which is physics rather than styling.
 */
export function OrbDemo({ four, children }: { four?: boolean; children: ReactNode }) {
  return (
    <div className="ws-orb-demo" data-four={four ? "" : undefined}>
      {children}
    </div>
  );
}

export function OrbFigure({
  name,
  description,
  children,
}: {
  name: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <figure>
      <div className="ws-orb-stage">{children}</div>
      <figcaption>
        <b>{name}</b>
        <span>{description}</span>
      </figcaption>
    </figure>
  );
}
