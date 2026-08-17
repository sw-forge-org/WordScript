import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActivityCalendar,
  CELL_SIZE,
  CELL_SPACE,
  COLUMN_PITCH,
  GRID_HEIGHT,
  MARKER_LEGEND,
  VIEWPORT_WIDTH,
  WEEK_LABEL_PAD,
  activeDaysNote,
  clockOf,
  readableDay,
  windowNote,
} from "./ActivityCalendar";
import {
  ACTIVITY_WEEKS,
  activityMarkers,
  dayKey,
  type ActivityDay,
  type ActivityLedger,
} from "@/lib/activity";

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
  it("SHOWS A HALF-YEAR OF WHOLE COLUMNS, so no edge can cut a circle", () => {
    const { container } = draw();
    const box = container.querySelector<HTMLElement>(".ws-cal-scroll")!;

    /* Twenty-six columns of 15 + 3, less the trailing gap — and NOT upstream's
       5 px of left pad, which is content and scrolls with the drawing. The
       arithmetic matters rather than the number: cell `k` starts at
       `5 + k × 18`, so a box of whole columns and a scroll position congruent to
       5 put a cell's own left edge against the box's, with the last cell ending
       flush at the other side (ADR 0183). Including the pad here made those two
       conditions unsatisfiable and shaved a circle at both edges. */
    expect(VIEWPORT_WIDTH).toBe(465);
    expect((VIEWPORT_WIDTH + CELL_SPACE) % COLUMN_PITCH).toBe(0);
    expect(box.style.getPropertyValue("--cal-view")).toBe(`${VIEWPORT_WIDTH}px`);
  });

  it("scales rather than clipping, and states its own box", () => {
    const { container } = draw();
    const svg = container.querySelector(".ws-cal svg")!;
    expect(svg.getAttribute("viewBox")).toBe(
      `0 0 ${svg.getAttribute("width")} ${svg.getAttribute("height")}`,
    );
  });

  it("CLIPS NO CELL — the pads are applied once, not twice", () => {
    /* `Day` already wraps every cell in `translate(5, 20)`, so adding the pads
       again in the render override pushed the last column and the bottom row
       past the viewBox edge. The eye reads that not as "shifted" but as "why is
       that circle only three quarters of a circle", which is how it was
       reported — so the assertion is geometric rather than visual. */
    const { container } = draw();
    const svg = container.querySelector(".ws-cal svg")!;
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

  it("KEEPS ITS FULL SPAN WHATEVER THE RECORD HOLDS", () => {
    /* The first build narrowed the grid to what history could vouch for and drew
       the rest blank. It read as a rendering failure rather than as honesty, and
       the drawing is now the whole year up to today whether or not anything was
       dictated in it. */
    const { container } = draw();

    /* 2026 opens on Sunday 28 December 2025 and reaches the week of Wednesday
       12 August: thirty-three columns, wider than the box that shows it. */
    expect(container.querySelectorAll("g[data-column]")).toHaveLength(33);
    expect(Number(container.querySelector(".ws-cal svg")!.getAttribute("width"))).toBeGreaterThan(
      VIEWPORT_WIDTH,
    );
  });

  it("draws every day in the span, so a quiet stretch is grey rather than absent", () => {
    const { container } = draw();
    /* Four days of the current week are still ahead, and the heat map does not
       draw the future. Everything else in the year has a circle. */
    expect(container.querySelectorAll("circle.ws-cal-cell").length).toBe(
      33 * 7 - (6 - NOW.getDay()),
    );
    expect(container.querySelectorAll("[data-outside]")).toHaveLength(0);
  });
});

/**
 * ADR 0183. The box stays a half-year and the drawing may reach further back —
 * which is what gives scrolling something to do, and what the year picker jumps
 * around in. Every case here is about the one rule underneath: a period is only
 * offered where the record can speak for it.
 */
describe("the year picker and the arrows", () => {
  it("offers every year the ledger holds, plus the one the grid is standing in", () => {
    draw({ years: [2025, 2024] });
    const picker = screen.getByLabelText("Year") as HTMLSelectElement;

    /* 2026 has no rows in this record and is still in the list: it is the year
       on screen, and a picker may not fail to name what it is showing. */
    expect([...picker.options].map((option) => option.textContent)).toEqual([
      "2026",
      "2025",
      "2024",
    ]);
    expect(picker).toHaveValue("2026");
  });

  it("opens on the current year even where the record has no year at all", () => {
    const { container } = draw();
    expect(screen.getByLabelText("Year")).toHaveValue("2026");
    expect(container.querySelector(".ws-cal-note")!.textContent).toContain("2026, up to today.");
  });

  it("draws a chosen year whole, and says which year it is drawing", () => {
    const { container } = draw({ years: [2026, 2025] });
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2025" } });

    /* 2025 opens on Sunday 29 December 2024 and runs to 31 December: fifty-three
       columns, against the thirty-three the part-year has. */
    expect(container.querySelectorAll("g[data-column]")).toHaveLength(53);
    expect(container.querySelector(".ws-cal-note")!.textContent).toContain("All of 2025.");
    expect(container.querySelector(`[data-date="2025/1/1"]`)).not.toBeNull();
    expect(container.querySelector(`[data-date="2025/12/31"]`)).not.toBeNull();
    /* And nothing of the next year: the span ends on 31 December. */
    expect(container.querySelector(`[data-date="2026/1/1"]`)).toBeNull();
  });

  it("cuts the current year at today rather than drawing the rest of it", () => {
    const { container } = draw({ years: [2026] });

    expect(container.querySelector(`[data-date="${dayKey(NOW)}"]`)).not.toBeNull();
    expect(container.querySelector(`[data-date="2026/12/31"]`)).toBeNull();
  });

  /* An arrow that does nothing is worse than an arrow that says it cannot: the
     end of the span is a reading, and the disabled state is where it shows.
     The year opens at its newest end, so there is never anything to the right of
     it on arrival. jsdom lays nothing out, so only that half is checkable here
     and the other is measured in the host. */
  it("disables the later arrow, because a year opens at its newest end", () => {
    draw();
    expect(screen.getByLabelText("Later weeks")).toBeDisabled();
  });

  /**
   * C1 — THE LEFT ARROW LIED ABOUT THE END OF THE RECORD (ADR 0189).
   *
   * The reach test was `scrollLeft > 1` and this scroller does not rest at zero:
   * `snapped()` is congruent to `GRID_LEFT_PAD` on purpose, because a position
   * congruent to 0 shaves a circle at both edges. So the box parks at 5, `5 > 1`
   * stayed true, and the arrow was lit at the very first column of the year — a
   * press set a negative position, the browser clamped it to 0, and the settle
   * put it straight back to 5.
   *
   * THE ASSERTION IS AFTER THE SETTLE, AND THAT IS THE WHOLE CASE. Straight
   * after the click the position IS 0, `0 > 1` is false, and the arrow reads
   * disabled — so a case that asserted there would have passed on the broken
   * build too. jsdom lays nothing out, so the box's geometry is stubbed to a
   * browser's: a drawing wider than the viewport, and a `scrollLeft` that clamps
   * the way a real one does.
   */
  it("disables the earlier arrow at the first column, once the box has settled", async () => {
    vi.useFakeTimers();
    const { container } = draw();
    const box = container.querySelector<HTMLElement>(".ws-cal-scroll")!;

    const max = 235;
    let left = 0;
    Object.defineProperty(box, "clientWidth", { value: VIEWPORT_WIDTH, configurable: true });
    Object.defineProperty(box, "scrollWidth", {
      value: VIEWPORT_WIDTH + max,
      configurable: true,
    });
    Object.defineProperty(box, "scrollLeft", {
      configurable: true,
      get: () => left,
      set: (next: number) => {
        left = Math.min(max, Math.max(0, next));
      },
    });

    /* The opening jump runs again on the next frame, by design: the first pass
       measures a box that has not been laid out yet. Let it land before pressing
       anything, or it re-pins to the far end mid-walk. */
    act(() => void vi.advanceTimersByTime(50));

    const earlier = screen.getByLabelText("Earlier weeks");
    /* Walk to the far end. Each press is four columns, and the last one asks for
       a negative position that the box clamps to zero. */
    for (let press = 0; press < 5; press += 1) fireEvent.click(earlier);
    expect(box.scrollLeft).toBe(0);

    /* AND NOW THE PART THE BUG LIVED IN. A real browser fires a scroll for the
       press, the settle rounds the position onto a column, and a column's own
       left edge is at 5 rather than at 0. Asserting before this point passes on
       the broken build. */
    fireEvent.scroll(box);
    act(() => void vi.advanceTimersByTime(200));
    expect(box.scrollLeft).toBe(5);
    expect(earlier).toBeDisabled();
    vi.useRealTimers();
  });

  it("names the day the record starts, under the grid", () => {
    const { container } = draw({ startedOn: "2026-08-16" });
    expect(container.querySelector(".ws-cal-note")!.textContent).toContain(
      "Recorded since 16 August 2026.",
    );
  });
});

/* ADR 0184. GitHub puts one number over the grid, and the owner picked the one
   this grid can honestly carry: a day, not a dictation. */
describe("the headline over the grid", () => {
  it("counts the days of the drawn year that have a record", async () => {
    const { container } = draw({
      buckets: buckets(
        day(new Date(2026, 7, 10)),
        day(new Date(2026, 7, 11), { dictations: 9 }),
        /* Last year, and therefore not in this year's figure. */
        day(new Date(2025, 7, 11)),
      ),
      years: [2026, 2025],
    });

    expect(container.querySelector(".ws-cal-count")!.textContent).toBe("2 active days in 2026");

    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2025" } });
    expect(container.querySelector(".ws-cal-count")!.textContent).toBe("1 active day in 2025");
  });

  it("says a year with nothing in it in words, and never as a nought", () => {
    const { container } = draw();
    /* ADR 0161's rule, held at the one place on this display that is a figure
       rather than a drawing. */
    expect(container.querySelector(".ws-cal-count")!.textContent).toBe("No dictation yet in 2026");
  });

  it("counts DAYS rather than dictations, so a busy day is one day", () => {
    expect(activeDaysNote(1, 2026)).toBe("1 active day in 2026");
    expect(activeDaysNote(31, 2026)).toBe("31 active days in 2026");
  });
});

/* The ramp was explained only by the tooltip, on the argument that a legend
   would be a second explanation of one thing. True of one cell and false of the
   grid: the scale is a question about all of them at once (ADR 0183). */
describe("the legend", () => {
  it("draws the five steps in order, from the unlit ground to the accent", () => {
    const { container } = draw();
    const steps = [...container.querySelectorAll<HTMLElement>(".ws-cal-legend i")];

    expect(steps).toHaveLength(5);
    expect(steps[0].style.background).toBe("var(--fg-muted)");
    expect(steps.slice(1).every((step) => step.style.background === "var(--accent)")).toBe(true);
    const opacity = steps.map((step) => Number(step.style.opacity));
    expect([...opacity].sort((a, b) => a - b)).toEqual(opacity);
    expect(opacity[opacity.length - 1]).toBe(1);
  });

  /**
   * THE HIDDEN REGION IS THE RAMP ALONE NOW (ADR 0189), and the change is not
   * cosmetic. `aria-hidden` on the whole legend was right while every entry in
   * it was an unlabelled swatch whose numbers are on the hover — five colours
   * announced as five nothings. It is wrong the moment an entry carries a NAME:
   * a green circle means something no other cell means, and a reader who cannot
   * see colour has to be able to find out what.
   */
  it("hides the unlabelled ramp and announces the entry that has a name", () => {
    const { container } = draw();
    const ramp = container.querySelector(".ws-cal-legend > span[aria-hidden='true']");
    expect(ramp).toHaveTextContent("Less");
    expect(ramp).toHaveTextContent("More");
    /* Nothing to name on a calendar with no markers, so nothing is announced. */
    expect(container.querySelector(".ws-cal-legend")).not.toHaveAttribute("aria-hidden");
    expect(screen.queryByText(MARKER_LEGEND)).toBeNull();
  });
});

describe("the ramp on the cells", () => {
  it("lights a day at the step its dictation count earns", () => {
    /* The top of the ramp is an exceptional day since ADR 0187, not the eleven
       dictations that used to reach it — the first day this product measured in
       full held 104 and its owner called it a light one. */
    const today = day(NOW, { dictations: 150 });
    const { container } = draw({ buckets: buckets(today) });

    const cell = container.querySelector<SVGCircleElement>(`[data-date="${dayKey(NOW)}"]`)!;
    expect(cell.getAttribute("data-step")).toBe("4");
    expect(cell.getAttribute("fill")).toBe("var(--accent)");
  });

  /* And a real working day is somewhere in the middle of the ramp rather than at
     the end of it, which is the whole point of raising the scale. */
  it("keeps a heavy day below the brightest step", () => {
    const today = day(NOW, { dictations: 104 });
    const { container } = draw({ buckets: buckets(today) });

    const cell = container.querySelector<SVGCircleElement>(`[data-date="${dayKey(NOW)}"]`)!;
    expect(cell.getAttribute("data-step")).toBe("3");
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

    fireEvent.mouseLeave(container.querySelector(".ws-cal svg")!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("the line under the grid", () => {
  it("names the span the grid is actually drawing", () => {
    expect(windowNote(2026, 2026)).toBe("2026, up to today.");
    expect(windowNote(2025, 2026)).toBe("All of 2025.");
  });

  it("prints under the grid", () => {
    const { container } = draw();
    expect(container.querySelector(".ws-cal-note")!.textContent).toBe("2026, up to today.");
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
    const labels = Array.from(container.querySelectorAll(".ws-cal-weekdays text")).map(
      (node) => node.textContent,
    );
    /* Seven labels at a fifteen-pixel pitch collide; three are enough to count
       the rest from, which is why GitHub draws three. */
    expect(labels).toEqual(["Mon", "Wed", "Fri"]);
  });

  /* ADR 0183. They were the heat map's own gutter, inside the drawing — so the
     first thing a scroll to the right took away was the labels that say which
     row is which. */
  it("stands OUTSIDE the scrolling box, at the grid's own row pitch", () => {
    const { container } = draw();
    const column = container.querySelector(".ws-cal-weekdays")!;

    expect(container.querySelector(".ws-cal-scroll")!.contains(column)).toBe(false);
    expect(container.querySelectorAll("text.w-heatmap-week")).toHaveLength(0);
    expect(column.getAttribute("width")).toBe(String(WEEK_LABEL_PAD));
    expect(column.getAttribute("height")).toBe(String(GRID_HEIGHT));

    /* Monday is the second row, and the label sits on that row's CENTRE line:
       20 px of month labels, one pitch down, half a cell, and three and a half
       pixels for the baseline of a 10 px label. Measured in the browser at
       upstream's own offset, the labels stood two pixels low — invisible in a
       gutter inside the drawing and obvious once they are pinned beside it. */
    const monday = [...column.querySelectorAll("text")].find((node) => node.textContent === "Mon")!;
    expect(monday.getAttribute("y")).toBe(String(20 + COLUMN_PITCH + CELL_SIZE / 2 + 3.5));
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   MARKERS — A DAY WITH A NAME RATHER THAN A COUNT (ADR 0189).
   ═══════════════════════════════════════════════════════════════════════════ */

function ledger(overrides: Partial<ActivityLedger> = {}): ActivityLedger {
  return { started_on: null, days: {}, ...overrides };
}

/** The publication is inside the drawn span of `NOW`'s year, so it is on the
 *  grid without any picking. */
const PUBLICATION_KEY = "2026/2/23";

describe("a marked day", () => {
  it("is drawn in the milestone colour where nothing was dictated", () => {
    const { container } = draw({ markers: activityMarkers(ledger()) });
    const cell = container.querySelector(`[data-date="${PUBLICATION_KEY}"]`)!;

    expect(cell).toHaveAttribute("data-marker");
    expect(cell.getAttribute("fill")).toBe("var(--success)");
    /* AND IT IS NOT DIMMED. Step 0's opacity says *nothing happened here*, which
       is the one claim a named day may not carry. */
    expect(cell.getAttribute("opacity")).toBe("1");
  });

  /**
   * C5 — A MARKER NEVER OVERWRITES ACTIVITY. The day's ramp step is decided by
   * the day's dictations and by nothing else; the marker arrives as a second
   * shape rather than as a colour that has to mean both things.
   */
  it("keeps the day's own ramp step and takes a ring where it was dictated on", () => {
    const worked = day(new Date(2026, 1, 23), { dictations: 20 });
    const { container } = draw({
      buckets: buckets(worked),
      markers: activityMarkers(ledger()),
    });

    const cell = container.querySelector(`circle.ws-cal-cell[data-date="${PUBLICATION_KEY}"]`)!;
    expect(cell.getAttribute("fill")).toBe("var(--accent)");
    /* Twenty dictations is step 2 on `ACTIVITY_STEPS` — unchanged by the name
       on the day, which is the whole assertion. */
    expect(cell.getAttribute("data-step")).toBe("2");

    const ring = container.querySelector(`circle.ws-cal-ring[data-date="${PUBLICATION_KEY}"]`)!;
    expect(ring.getAttribute("stroke")).toBe("var(--success)");
    /* INSIDE THE RADIUS THE FILL ALREADY OCCUPIES. A stroke sits half in and
       half out of the circle it is on, so a ring drawn AT the radius would reach
       past it and two markers on adjacent days would nearly touch. */
    const outer = Number(ring.getAttribute("r")) + Number(ring.getAttribute("stroke-width")) / 2;
    expect(outer).toBeCloseTo(Number(cell.getAttribute("r")), 6);
  });

  /** C4. The ramp stays hidden and the entry that carries a NAME does not — a
   *  reader who cannot see colour has to be able to find out what green means
   *  without hovering a cell to discover it. */
  it("puts its key in the legend, outside the hidden region", () => {
    const { container } = draw({ markers: activityMarkers(ledger()) });

    const key = screen.getByText(MARKER_LEGEND);
    expect(key).toBeInTheDocument();
    expect(key.closest("[aria-hidden='true']")).toBeNull();
    expect(container.querySelector(".ws-cal-key-marker")).toBeInTheDocument();
  });

  /** C4's other half: the name is why the reader stopped on this cell, so it is
   *  the first thing the panel says. */
  it("names itself on the hover, above the day's own readings", () => {
    const worked = day(new Date(2026, 1, 23), { dictations: 3 });
    const { container } = draw({
      buckets: buckets(worked),
      markers: activityMarkers(ledger()),
    });

    fireEvent.mouseEnter(container.querySelector(`[data-date="${PUBLICATION_KEY}"]`)!);
    const tip = document.querySelector(".ws-cal-tip")!;
    expect(tip).toHaveTextContent("WordScript Initiation");
    expect(tip).toHaveTextContent("3 dictations");
    const lines = [...tip.children].map((node) => node.textContent);
    expect(lines.indexOf("WordScript Initiation")).toBeLessThan(
      lines.findIndex((line) => line?.includes("3 dictations")),
    );
  });

  /**
   * C6 — A YEAR THAT CARRIES A MARKER IS OFFERED. The picker otherwise offers
   * only years the ledger holds DAY ROWS for, which is right for a ramp and
   * wrong for a name: without this the 2026 publication date is unreachable on
   * any machine installed in 2027, and nothing can ever point the calendar at
   * it.
   */
  it("offers the marker's year even when the ledger has no rows in it", () => {
    draw({
      now: new Date(2027, 5, 1, 12, 0),
      years: [2027],
      markers: activityMarkers(ledger()),
    });

    const picker = screen.getByLabelText("Year") as HTMLSelectElement;
    expect([...picker.options].map((option) => option.value)).toEqual(["2027", "2026"]);
  });

  /** Two markers on one day are one anniversary, not two circles fighting for a
   *  cell. */
  it("folds two names that fall on the same day into one entry", () => {
    const markers = activityMarkers(ledger({ installed_on: "2026-02-23" }));
    expect(markers.size).toBe(1);
    expect(markers.get(PUBLICATION_KEY)?.label).toBe(
      "WordScript Initiation · WordScript installed",
    );
  });

  /** A missing install date draws one marker rather than inventing a second —
   *  see `installed_on`'s own note on why a wrong date is worse than none. */
  it("draws one marker where the ledger cannot say when it was installed", () => {
    expect(activityMarkers(ledger()).size).toBe(1);
    expect(activityMarkers(ledger({ installed_on: null })).size).toBe(1);
    expect(activityMarkers(ledger({ installed_on: "2026-05-04" })).size).toBe(2);
  });
});
