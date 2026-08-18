import { useState, type ReactNode } from "react";

/**
 * A ROW OF COLUMNS, AND ONE LINE THAT SAYS WHAT THE ONE UNDER THE CURSOR IS.
 *
 * NOT AN SVG FOR THE BARS, AND THAT IS THE DELIBERATE PART. The matrix and the
 * heat map are SVG because they are pixel grids whose geometry is the point; a
 * bar is a rectangle whose height is a percentage, and CSS draws those without a
 * viewBox to keep in step with a container whose width changes with the window.
 * The line variant DOES take an SVG, because a stroke between two columns is the
 * one thing CSS has no honest way to draw.
 *
 * A SUM IS A BAR AND A RATE IS A LINE, and that is a correctness rule rather
 * than a taste. A bar states *this much of something*, so its area is the
 * reading and its baseline has to be nought. A speaking rate has no meaningful
 * nought — nobody has ever spoken at nought words a minute — and four months of
 * a stable rate drawn as bars from zero is four identical blocks that hide the
 * only thing the reader came to see. So the line scales to the values it holds
 * and says which range it is showing.
 *
 * THE READ-OUT IS ONE LINE AND IT IS ALWAYS THERE. A chart whose values live
 * only in a tooltip says nothing when nobody is pointing at it, and the
 * alternative — a number over every column — is a wall of digits at twenty-eight
 * of them.
 *
 * AN EMPTY COLUMN IS NOT A SHORT ONE. `empty` draws the unlit ground and breaks
 * the line, because the two claims differ: a week with no dictation saved no
 * time, and it has no speaking rate at all.
 */

export interface ChartBar {
  key: string;
  /** Under the axis, and only some of them are drawn — see `labelStep`. */
  label: string;
  value: number;
  /** The whole reading, spelled out, for the read-out line and the tooltip. */
  hint: string;
  /** The record holds nothing for this column. */
  empty?: boolean;
  /** Drawn in the accent rather than the muted ramp — the median column of a
   *  distribution, and nothing else so far. */
  marked?: boolean;
}

/** How many columns apart the ticks stand: seven of them across an axis, because
 *  a label under every column of twenty-eight is a grey smear at this width —
 *  the same reason the calendar labels three weekdays of seven. `labelled` can
 *  add the final column to those seven when it stands clear of them. */
export function labelStep(count: number): number {
  return Math.max(1, Math.ceil(count / 7));
}

/**
 * Whether this column gets its tick written under it.
 *
 * Every `step`-th one, AND THE LAST ONE — the right edge is where a reader looks
 * to ask *up to when*, and fourteen weeks ending on an unlabelled column leaves
 * that unanswered.
 *
 * EXCEPT WHEN THE LAST ONE WOULD LAND ON ITS NEIGHBOUR. Fourteen columns at a
 * step of two put the final tick one column after the one before it, and the
 * running page printed `10 Aug17 Aug` as a single run of characters. A label
 * that collides with the label beside it is worse than no label: the neighbour
 * was legible before it arrived, and now neither is.
 */
export function labelled(index: number, count: number, step: number): boolean {
  if (index % step === 0) return true;
  if (index !== count - 1) return false;
  /* How far past the last stepped tick this one falls. Two columns is the floor
     below which two dates touch at every width the pane has. */
  const gap = index - Math.floor(index / step) * step;
  return gap >= Math.max(2, Math.ceil(step / 2));
}

/**
 * Where each column's value sits between the floor and the ceiling, 0 to 1.
 *
 * BARS ALWAYS MEASURE FROM NOUGHT and a line measures from its own floor. A bar
 * states *this much of something*, so its area is the reading; a rate has no
 * meaningful nought, and drawn from one it is a row of identical blocks.
 *
 * A FLAT SERIES IS DRAWN FLAT, AND IT TOOK THE RUNNING PAGE TO SEE WHY THIS
 * NEEDS SAYING. Fourteen weeks at an identical rate came out of the fold as
 * 156.00000000000003 against 155.99999999999997 — a range of 1e-14 — and a floor
 * set a fraction of THAT below the minimum turned floating-point noise into a
 * mountain range with three distinct levels. The reader would have seen a rate
 * swinging week to week and been looking at the last bit of a double.
 *
 * So a range under half a percent of the reading is no range: the band opens to
 * five percent either side and every point sits in the middle of it, which is
 * what *this did not move* looks like.
 */
export function scaleOf(bars: ChartBar[], line: boolean): { floor: number; ceiling: number } {
  const values = bars.filter((bar) => !bar.empty).map((bar) => bar.value);
  if (values.length === 0) return { floor: 0, ceiling: 1 };
  const high = Math.max(...values);
  const low = Math.min(...values);
  if (!line) return { floor: 0, ceiling: high > 0 ? high : 1 };
  const range = high - low;
  const flat = range <= Math.max(1e-9, Math.abs(high) * 0.005);
  const pad = flat ? Math.max(1, Math.abs(high) * 0.05) : range * 0.15;
  return { floor: Math.max(0, low - pad), ceiling: high + pad };
}

export function MetricChart({
  bars,
  fallback,
  ariaLabel,
  variant = "bars",
}: {
  bars: ChartBar[];
  /** What the read-out says when nothing is under the cursor. */
  fallback: ReactNode;
  ariaLabel: string;
  variant?: "bars" | "line";
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const line = variant === "line";
  const { floor, ceiling } = scaleOf(bars, line);
  const span = ceiling - floor || 1;
  const height = (bar: ChartBar) => Math.min(1, Math.max(0, (bar.value - floor) / span));
  const step = labelStep(bars.length);
  const reading = bars.find((bar) => bar.key === hovered);

  /* THE STROKE BREAKS WHERE THE RECORD DOES. One polyline over a gap would draw
     a straight run through a week that has no reading, which is a claim about
     that week rather than a line between two others. */
  const segments: { x: number; y: number }[][] = [];
  if (line) {
    let run: { x: number; y: number }[] = [];
    bars.forEach((bar, index) => {
      if (bar.empty) {
        if (run.length > 0) segments.push(run);
        run = [];
        return;
      }
      run.push({
        x: ((index + 0.5) / Math.max(1, bars.length)) * 100,
        y: 100 - height(bar) * 100,
      });
    });
    if (run.length > 0) segments.push(run);
  }

  return (
    <div className="ws-chart">
      <div
        className="ws-chart-plot"
        data-line={line ? "" : undefined}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHovered(null)}
      >
        {line && (
          /* `preserveAspectRatio="none"` stretches the 100 x 100 box to whatever
             the plot is, which would stretch the stroke with it — hence
             `vector-effect`, which keeps the pen the same width in both axes.
             The dots are ordinary elements in the columns below, for the same
             reason: a circle in a stretched viewBox is an ellipse. */
          <svg
            className="ws-chart-line"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            /* THE SIZE IS INLINE BECAUSE `.ws-win svg` IS NOT. That rule sets
               every SVG in the window to 16 x 16 for the icon set, and being
               unlayered it beats the stylesheet rules here — measured on the
               running page, this line rendered as a 16 px squiggle in the top
               left corner. Exactly the trap the calendar's weekday column hit,
               and the same answer: an inline style is the one declaration that
               outranks a layered rule without inventing a selector war. */
            style={{ width: "100%", height: "100%" }}
            aria-hidden="true"
          >
            {segments.map((run) => (
              <polyline
                key={run[0].x}
                points={run.map((point) => `${point.x},${point.y}`).join(" ")}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}
        {bars.map((bar, index) => (
          <div
            key={bar.key}
            className="ws-chart-col"
            onMouseEnter={() => setHovered(bar.key)}
            title={bar.hint}
          >
            {line ? (
              !bar.empty && (
                <i
                  className="ws-chart-dot"
                  data-on={bar.key === hovered ? "" : undefined}
                  style={{ bottom: `${height(bar) * 100}%` }}
                />
              )
            ) : (
              <i
                className="ws-chart-bar"
                data-empty={bar.empty ? "" : undefined}
                data-marked={bar.marked ? "" : undefined}
                data-on={bar.key === hovered ? "" : undefined}
                style={{
                  /* A FLOOR OF TWO PERCENT ON ANYTHING THAT IS NOT EMPTY. A real
                     reading that rounds to nothing still happened, and a column
                     that draws as nought pixels is indistinguishable from the one
                     claim this chart may not make. */
                  height: bar.empty ? undefined : `${Math.max(2, height(bar) * 100)}%`,
                }}
              />
            )}
            <span className="ws-chart-tick">
              {labelled(index, bars.length, step) ? bar.label : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="ws-chart-read">{reading ? reading.hint : fallback}</p>
    </div>
  );
}
