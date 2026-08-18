import { describe, expect, it } from "vitest";
import { labelStep, labelled, scaleOf, type ChartBar } from "./MetricChart";

/** Both rules in here were written after the running page showed the failure,
 *  and both are invisible in a passing render — a flat line and a legible tick
 *  look exactly like a chart nobody has broken yet. */

function bars(values: number[]): ChartBar[] {
  return values.map((value, index) => ({
    key: String(index),
    label: String(index),
    value,
    hint: String(value),
  }));
}

describe("scaleOf", () => {
  it("measures bars from nought so their height is the reading", () => {
    expect(scaleOf(bars([40, 100]), false)).toEqual({ floor: 0, ceiling: 100 });
  });

  it("pads a line's range so the lowest point is on the chart, not on its edge", () => {
    const { floor, ceiling } = scaleOf(bars([100, 200]), true);
    expect(floor).toBeLessThan(100);
    expect(ceiling).toBeGreaterThan(200);
  });

  it("draws a series that did not move flat, whatever the last bit of the double says", () => {
    /* THE REAL VALUES, off a fold over fourteen identical weeks. A range of
       1e-14 scaled to the pane made a mountain range out of floating-point
       noise; every point belongs in the middle of the band instead. */
    const { floor, ceiling } = scaleOf(bars([156.00000000000003, 155.99999999999997]), true);
    const at = (value: number) => (value - floor) / (ceiling - floor);
    expect(at(156.00000000000003)).toBeCloseTo(0.5, 3);
    expect(at(155.99999999999997)).toBeCloseTo(0.5, 3);
  });

  it("holds a band open around a single reading rather than dividing by nothing", () => {
    const { floor, ceiling } = scaleOf(bars([12]), true);
    expect(ceiling).toBeGreaterThan(floor);
  });

  it("lights nothing when every column is empty", () => {
    const empty = bars([0, 0]).map((bar) => ({ ...bar, empty: true }));
    expect(scaleOf(empty, false)).toEqual({ floor: 0, ceiling: 1 });
  });
});

describe("labelled", () => {
  it("never sets two ticks closer together than the rhythm it chose", () => {
    /* The count is not the invariant — the spacing is. Seven stepped ticks plus
       a final one that stands clear is eight labels and legible; a final one a
       single column after its neighbour is a collision at any count. Under eight
       columns the step is one and every column is labelled, which is the case
       the floor must not fail. */
    for (const count of [4, 7, 8, 12, 14, 15, 24, 26, 28]) {
      const step = labelStep(count);
      const floor = Math.min(step, 2);
      const drawn = Array.from({ length: count }, (_, index) => index).filter((index) =>
        labelled(index, count, step),
      );
      const gaps = drawn.slice(1).map((index, at) => index - drawn[at]);
      expect({ count, tight: gaps.filter((gap) => gap < floor) }).toEqual({ count, tight: [] });
      expect(drawn.length).toBeLessThanOrEqual(Math.max(8, count));
    }
  });

  it("drops a final tick that would land on its neighbour", () => {
    /* Fourteen weeks: `10 Aug17 Aug` came out of the running page as one run of
       characters, and the neighbour had been legible until the last one arrived. */
    expect(labelled(13, 14, labelStep(14))).toBe(false);
    expect(labelled(12, 14, labelStep(14))).toBe(true);
  });

  it("keeps a final tick that stands clear of the one before it", () => {
    expect(labelled(14, 15, labelStep(15))).toBe(true);
  });
});
