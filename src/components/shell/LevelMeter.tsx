import * as React from "react";
import { cn } from "@/lib/utils";

export type LevelState = "ok" | "quiet" | "hot";

/** What a live meter reads each frame. Amplitude, 0..1, unscaled. */
export interface LevelMeterSource {
  peak: number;
  hold: number;
}

interface LevelMeterProps {
  /** 0–100. The live peak. Ignored when `live` is given. */
  peak?: number;
  /** 0–100. The held maximum, drawn as a 2 px mark. Ignored when `live` is
   *  given. */
  hold?: number;
  /**
   * A ref carrying 0..1 amplitude, read once per animation frame.
   *
   * WHY A REF AND NOT A NUMBER. The runtime reports every 42 ms. Passed as a
   * prop that is 24 renders a second of whatever screen owns this meter, and on
   * a settings screen that is enough work to lose frames — which is what made
   * the bar look stuttery even though every value in it was correct. Passed as
   * a ref, the bar animates itself and React renders it only when its SENTENCE
   * changes.
   */
  live?: { current: LevelMeterSource };
  /** 0–100. The speech threshold, cut into the bar. */
  threshold: number;
  state: LevelState;
  /** The sentence under the bar. It says what the number means. */
  verdict: React.ReactNode;
  className?: string;
}

/** Ballistics, in milliseconds. Fast enough up that a syllable is not softened
 *  away, slow enough down that the bar reads as a level falling rather than as
 *  a value being replaced. The same asymmetry every hardware meter has. */
const ATTACK_MS = 30;
const RELEASE_MS = 220;
/** The hold mark already decays in the runtime reading over ~900 ms; this only
 *  smooths the steps between two reports. */
const HOLD_FOLLOW_MS = 90;

/**
 * NOT A WAVEFORM. THE THRESHOLD MARK IS THE COMPONENT.
 *
 * A capture whose peak never crosses the threshold is discarded as empty, which
 * is what a microphone set too quietly looks like — so the bar to clear has to
 * be on screen. A decorative waveform states a level and hides it.
 *
 * THE FILL IS NEUTRAL, NOT GREEN. A measurement in its normal range is the
 * state this meter is in almost all of the time, and a permanently green moving
 * surface in the corner of the eye is a status light that never turns off,
 * which is a status light that stops being read. Colour is spent on the two
 * states worth interrupting for, and the verdict line still says "Good" in
 * `--success` so the confirmation survives without the track carrying it.
 *
 * `quiet` AND `hot` ARE NOT THE SAME SEVERITY. Both were `--danger` once: one
 * wastes a take, the other is a recording you cannot fix afterwards, and a
 * scale that spends its top level on the milder problem has none left for the
 * worse one.
 *
 * IT MOVES ITSELF WHEN IT IS LIVE. With `live` the bar runs off an animation
 * frame and writes two widths; with numbers it is a static drawing, which is
 * what the gallery renders. One component, because the drawing is the same and
 * only the clock differs.
 */
export function LevelMeter({
  peak = 0,
  hold = 0,
  threshold,
  state,
  verdict,
  live,
  className,
}: LevelMeterProps) {
  const fillRef = React.useRef<HTMLSpanElement>(null);
  const holdRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!live) return;

    let frame = 0;
    let last = 0;
    let envelope = 0;
    let holdShown = 0;

    const step = (now: number) => {
      const dt = Math.min(Math.max(now - (last || now), 0), 100);
      last = now;

      const source = live.current;
      const target = clamp01(source.peak);
      const tau = target > envelope ? ATTACK_MS : RELEASE_MS;
      envelope += (target - envelope) * (1 - Math.exp(-dt / tau));
      if (envelope < 0.0005) envelope = 0;

      const heldTarget = clamp01(source.hold);
      holdShown += (heldTarget - holdShown) * (1 - Math.exp(-dt / HOLD_FOLLOW_MS));

      if (fillRef.current) fillRef.current.style.width = `${envelope * 100}%`;
      if (holdRef.current) holdRef.current.style.left = `${holdShown * 100}%`;

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [live]);

  const pin = (n: number) => `${Math.min(Math.max(n, 0), 100)}%`;

  return (
    <div className={cn("ws-level", className)} data-state={state}>
      <div className="ws-level-track">
        <span
          ref={fillRef}
          className="ws-level-fill"
          style={live ? { width: 0 } : { width: pin(peak) }}
        />
        <span className="ws-level-thr" style={{ left: pin(threshold) }} />
        <span
          ref={holdRef}
          className="ws-level-hold"
          style={live ? { left: 0 } : { left: pin(hold) }}
        />
      </div>
      <span className="ws-level-verdict">
        {verdict}
        <span className="ws-level-thr-key">threshold</span>
      </span>
    </div>
  );
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
