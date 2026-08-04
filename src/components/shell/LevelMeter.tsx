import * as React from "react";
import { cn } from "@/lib/utils";

export type LevelState = "ok" | "quiet" | "hot";

interface LevelMeterProps {
  /** 0–100. The live peak. */
  peak: number;
  /** 0–100. The held maximum, drawn as a 2 px mark. */
  hold: number;
  /** 0–100. The speech threshold, cut into the bar. */
  threshold: number;
  state: LevelState;
  /** The sentence under the bar. It says what the number means. */
  verdict: React.ReactNode;
  className?: string;
}

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
 */
export function LevelMeter({
  peak,
  hold,
  threshold,
  state,
  verdict,
  className,
}: LevelMeterProps) {
  const pin = (n: number) => `${Math.min(Math.max(n, 0), 100)}%`;

  return (
    <div className={cn("ws-level", className)} data-state={state}>
      <div className="ws-level-track">
        <span className="ws-level-fill" style={{ width: pin(peak) }} />
        <span className="ws-level-thr" style={{ left: pin(threshold) }} />
        <span className="ws-level-hold" style={{ left: pin(hold) }} />
      </div>
      <span className="ws-level-verdict">
        {verdict}
        <span className="ws-level-thr-key">threshold</span>
      </span>
    </div>
  );
}
