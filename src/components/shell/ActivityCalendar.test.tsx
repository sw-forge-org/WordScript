import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ActivityCalendar,
  CELL_SIZE,
  CELL_SPACE,
  WEEK_LABEL_PAD,
  WINDOW_NOTE,
  clockOf,
  readableDay,
} from "./ActivityCalendar";
import { ACTIVITY_WEEKS, dayKey, type ActivityDay } from "@/lib/activity";

/**
 * THE MEASUREMENT IS THE POINT OF THE FIRST BLOCK.
 *
 * A3's own brief says the rendered SVG width is measured against its box rather
 * than assumed from the CSS, because an SVG `width` attribute is a presentation
 * hint — unlayered, and therefore beating every rule in `shell.css`, which lives
 * inside `@layer components`. jsdom applies no stylesheet, but the attribute is
 * exactly what the component writes, so the arithmetic decision 8 decided is
 * checkable here and the cap that keeps it inside a narrow column is checked in
 * the browser instead.
 */

afterEach(cleanup);

/** Wednesday. Fixed, because the column count depends on the weekday `now`
 *  falls on and a test that drifts with the calendar is not a test. */
const NOW = new Date(2026, 7, 12, 12, 0);

function day(date: Date, overrides: Partial<ActivityDay> = {}): ActivityDay {
  const key = dayKey(date);
  return {
    date: key,
    dictations: 1,
    words: 100,
    seconds: 60,
    timed: 1,
    longestSeconds: 60,
    ...overrides,
  };
}

function buckets(...days: ActivityDay[]): Map<string, ActivityDay> {
  return new Map(days.map((entry) => [entry.date, entry]));
}

function draw(props: Partial<Parameters<typeof ActivityCalendar>[0]> = {}) {
  return render(<ActivityCalendar buckets={new Map()} now={NOW} {...props} />);
}

describe("the calendar's box", () => {
  it("draws twenty-six columns at 493 px — 470 plus the weekday gutter", () => {
    const { container } = draw();
    const svg = container.querySelector("svg")!;

    /* The 28 px weekday gutter, twenty-six columns of 15 + 3, less the trailing
       gap. The first build had no weekday labels and came to 470; naming the
       rows costs 23 px of the 696 Home has, which it can afford. */
    const expected = WEEK_LABEL_PAD + ACTIVITY_WEEKS * (CELL_SIZE + CELL_SPACE) - CELL_SPACE;
    expect(expected).toBe(493);
    expect(svg.getAttribute("width")).toBe(String(expected));
    /* And it scales rather than clipping when the column is narrower. */
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${expected} ${svg.getAttribute("height")}`);
  });

  it("CLIPS NO CELL — the pads are applied once, not twice", () => {
    /* `Day` already wraps every cell in `translate(5, 20)`, so adding the pads
       again in the render override pushed the last column and the bottom row
       past the viewBox edge. The eye reads that not as "shifted" but as "why is
       that circle only three quarters of a circle", which is how it was
       reported — so the assertion is geometric rather than visual. */
    const { container } = draw();
    const svg = container.querySelector("svg")!;
    const width = Number(svg.getAttribute("width"));
    const height = Number(svg.getAttribute("height"));
    const radius = (CELL_SIZE / 2) * 0.9;

    const clipped = Array.from(container.querySelectorAll("circle.ws-cal-cell")).filter((cell) => {
      const cx = Number(cell.getAttribute("cx"));
      const cy = Number(cell.getAttribute("cy"));
      return cx - radius < 0 || cy - radius < 0 || cx + radius > width || cy + radius > height;
    });
    expect(clipped).toHaveLength(0);
  });

  it("draws one circle per day and no rectangles at all", () => {
    const { container } = draw();
    expect(container.querySelectorAll("rect")).toHaveLength(0);
    expect(container.querySelectorAll("circle.ws-cal-cell").length).toBeGreaterThan(0);
  });

  it("KEEPS ITS FULL WIDTH WHATEVER THE RECORD HOLDS", () => {
    /* The first build narrowed the grid to what history could vouch for and drew
       the rest blank. It read as a rendering failure rather than as honesty. */
    const { container } = draw();
    const svg = container.querySelector("svg")!;

    expect(Number(svg.getAttribute("width"))).toBe(493);
    expect(container.querySelectorAll("g[data-column]")).toHaveLength(ACTIVITY_WEEKS);
  });

  it("draws every day in the grid, so a quiet stretch is grey rather than absent", () => {
    const { container } = draw();
    /* Six days of the current week are still ahead, and the heat map does not
       draw the future. Everything else in the half-year has a circle. */
    expect(container.querySelectorAll("circle.ws-cal-cell").length).toBe(
      ACTIVITY_WEEKS * 7 - (6 - NOW.getDay()),
    );
    expect(container.querySelectorAll("[data-outside]")).toHaveLength(0);
  });
});

describe("the ramp on the cells", () => {
  it("lights a day at the step its dictation count earns", () => {
    const today = day(NOW, { dictations: 11 });
    const { container } = draw({ buckets: buckets(today) });

    const cell = container.querySelector<SVGCircleElement>(`[data-date="${dayKey(NOW)}"]`)!;
    expect(cell.getAttribute("data-step")).toBe("4");
    expect(cell.getAttribute("fill")).toBe("var(--accent)");
  });

  it("draws a day with nothing on it unlit, on the muted colour rather than the accent", () => {
    const { container } = draw();
    const cell = container.querySelector<SVGCircleElement>(`[data-date="${dayKey(NOW)}"]`)!;
    expect(cell.getAttribute("data-step")).toBe("0");
    expect(cell.getAttribute("fill")).toBe("var(--fg-muted)");
  });
});

describe("the day tooltip", () => {
  it("names the day's composition when it has one", () => {
    const today = day(NOW, { dictations: 14, words: 3200, longestSeconds: 245, seconds: 1810, timed: 14 });
    const { container } = draw({ buckets: buckets(today) });

    fireEvent.mouseEnter(container.querySelector(`[data-date="${dayKey(NOW)}"]`)!);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Wednesday, 12 August");
    expect(tip).toHaveTextContent("14 dictations");
    expect(tip).toHaveTextContent("3,200 words");
    expect(tip).toHaveTextContent("Longest 4:05");
  });

  it("SAYS AN EMPTY DAY IN WORDS AND NEVER AS A ROW OF NOUGHTS", () => {
    const { container } = draw();
    fireEvent.mouseEnter(container.querySelector(`[data-date="${dayKey(NOW)}"]`)!);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Nothing on this day.");
    expect(tip.textContent).not.toMatch(/\b0 (dictations|words|meetings|uploads)\b/);
  });

  it("holds the meeting and upload lines with no reading at all", () => {
    /* Origins that do not exist yet. A `0 meetings` would be the invented
       figure ADR 0161 exists to forbid, so the line carries a Preview tag and
       no figure. */
    const { container } = draw({ buckets: buckets(day(NOW)) });
    fireEvent.mouseEnter(container.querySelector(`[data-date="${dayKey(NOW)}"]`)!);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Meetings and uploads");
    expect(tip.querySelector(".ws-ptag")).not.toBeNull();
  });

  it("says how many of a day's records carried a clock when some did not", () => {
    const today = day(NOW, { dictations: 5, timed: 2 });
    const { container } = draw({ buckets: buckets(today) });
    fireEvent.mouseEnter(container.querySelector(`[data-date="${dayKey(NOW)}"]`)!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("over 2 of 5");
  });

  it("is not there until a day is hovered, and goes when the grid is left", () => {
    const { container } = draw({ buckets: buckets(day(NOW)) });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(container.querySelector(`[data-date="${dayKey(NOW)}"]`)!);
    expect(screen.queryByRole("tooltip")).not.toBeNull();

    fireEvent.mouseLeave(container.querySelector("svg")!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("the line under the grid", () => {
  it("names the span and nothing else", () => {
    /* It used to explain how far the record reached, which is a fact about a
       settings value that nobody asked a calendar for. */
    expect(WINDOW_NOTE).toBe("The last 26 weeks.");
    expect(WINDOW_NOTE).not.toMatch(/records|go back|days/);
  });

  it("prints under the grid", () => {
    const { container } = draw();
    expect(container.querySelector(".ws-cal-note")!.textContent).toBe(WINDOW_NOTE);
  });
});

describe("the two small readings", () => {
  it("writes a day as a person says it", () => {
    expect(readableDay("2026/8/12")).toBe("Wednesday, 12 August");
  });

  it("writes a duration as minutes and seconds, because every dictation is minutes", () => {
    expect(clockOf(245)).toBe("4:05");
    expect(clockOf(60)).toBe("1:00");
    expect(clockOf(9)).toBe("0:09");
  });
});

describe("the weekday gutter", () => {
  it("names Monday, Wednesday and Friday and leaves the other four blank", () => {
    const { container } = draw();
    const labels = Array.from(container.querySelectorAll("text.w-heatmap-week")).map(
      (node) => node.textContent,
    );
    /* Seven labels at a fifteen-pixel pitch collide; three are enough to count
       the rest from, which is why GitHub draws three. */
    expect(labels).toEqual(["Mon", "Wed", "Fri"]);
  });
});
