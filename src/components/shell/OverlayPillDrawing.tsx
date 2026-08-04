import type { ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * THE SHIPPED PILL, DRAWN — `demo.js`'s `pill()`.
 *
 * RULE 5 OF THE RELAY: the overlay is out of scope and nothing in
 * `overlay*.css` or `OverlayPill.tsx` changes. Reading it in order to DRAW it
 * is allowed and is exactly what the prototype does — a preview screen about
 * the overlay that invents its own pill is a screen making claims about a
 * surface it never looked at. Geometry and tokens come from the shipped
 * stylesheet and from `tauri.conf.json`; `zoom: 0.87` is the shell's own, and
 * it is reproduced because at 1.0 the preview would be showing a pill 15%
 * larger than the one on the user's screen.
 *
 * THE BARS ARE A SHAPE, NOT A READING (ADR 0058). They come off the same sine
 * the prototype draws, held: at rest, eleven short bars; recording, eleven tall
 * ones. Nothing measures anything, and nothing animates.
 */

/** Eleven bars, at the two heights the prototype draws them. */
function bars(rec: boolean) {
  return Array.from({ length: 11 }, (_, i) =>
    rec
      ? 4 + Math.abs(Math.sin((i + 2) * 1.9)) * 16
      : 3 + Math.abs(Math.sin(i * 0.9)) * 3,
  );
}

export function OverlayStage({ children }: { children: ReactNode }) {
  return <div className="ws-ovp-stage">{children}</div>;
}

export function OverlayPillDrawing({
  rec,
  mode = "Draft",
  timer,
  tab,
}: {
  /** A capture that is actually running. Sample data on a preview surface, and
   *  never a claim: the drawing carries no level and no clock. */
  rec?: boolean;
  mode?: string;
  timer: string;
  /** The left slot. The same component the learned-word tab uses, and the two
   *  can never be present at once — a handed-over session runs no finalization,
   *  so it learns no words. */
  tab?: ReactNode;
}) {
  return (
    <div className="ws-ovp-shell">
      {tab}
      <div className="ws-ovp" data-rec={rec ? "" : undefined}>
        <span className="ws-ovp-mic">
          <Icon name="mic" />
        </span>
        <span className="ws-ovp-bars">
          {bars(Boolean(rec)).map((h, i) => (
            <i key={i} style={{ height: `${h.toFixed(1)}px` }} />
          ))}
        </span>
        <span className="ws-ovp-div" />
        <button type="button" className="ws-ovp-mode">
          <span className="ws-ovp-mode-dot" />
          <span className="ws-ovp-mode-label">{mode}</span>
        </button>
        <span className="ws-ovp-div" />
        <span className="ws-ovp-timer">{timer}</span>
      </div>
    </div>
  );
}

/**
 * The tab, in the pill's left slot. It differs from the learned-word tab in one
 * way and it is deliberate: this one stays out. A learned word is news and
 * retracts; "an agent is waiting for you" is a state, and a state that retracts
 * has to be remembered.
 */
export function OverlayTab({ children }: { children: ReactNode }) {
  return (
    <span className="ws-ovp-tab">
      <span className="ws-ovp-tab-inner">
        <span className="ws-ovp-tab-dot" />
        <span className="ws-ovp-tab-label">{children}</span>
      </span>
    </span>
  );
}
