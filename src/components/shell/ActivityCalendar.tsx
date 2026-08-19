import * as React from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HeatMap, type HeatMapValue } from "@/components/ui/heat-map";
import {
  ACTIVITY_WEEKS,
  activityStep,
  markerYears,
  type ActivityDay,
  type ActivityMarker,
} from "@/lib/activity";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { PreviewTag } from "./PreviewTag";
import { Select } from "./Select";

/**
 * THE ACTIVITY CALENDAR — decision 2 of the home activity track.
 *
 * A GitHub contribution graph and the dot-matrix readout already in this tree
 * are the same visual object: a grid of discrete lit points on an on/off ramp.
 * So this draws CIRCLES ON THE MATRIX PALETTE rather than squares on GitHub's
 * green, and the counter beside it stops being a second widget — the two become
 * two states of one display, which is what makes this a mark for the product
 * rather than a borrowed graphic.
 *
 * IT IS THE SAME CIRCLE THE MATRIX DRAWS, deliberately and to the number:
 * `r = (size / 2) * 0.9`, the accent as fill, intensity as `opacity`. Copying
 * the geometry is the whole point; a calendar of dots that were nearly the
 * matrix's dots would read as a near-miss.
 *
 * THE CELLS ARE A RENDER OVERRIDE AND NOT A FORK. `rectRender` replaces the
 * emitted element wholesale, which is why this library was chosen over the more
 * popular one. The vendored file carries one structural change and it is the
 * column count — see its own note.
 *
 * THE GRID IS ALWAYS THE FULL HALF-YEAR, AND EVERY DAY IN IT GETS A CIRCLE.
 *
 * The first build narrowed the display to the window the history file could
 * vouch for and drew the rest as blank space, on the argument that an unlit
 * circle asserts *you did not dictate that day* while a blank asserts nothing.
 * **The owner overruled that on sight, and was right on both counts.**
 *
 * It looked broken. A calendar of two columns floating in an empty box reads as
 * a rendering failure, not as an epistemic nicety — and the reader who sees it
 * learns nothing except that something is wrong with the software. The premise
 * underneath it was also weaker than it sounded: a run of unlit days is not an
 * accusation the display has to shield anybody from. It is the shape of a
 * half-year filling up, and watching it fill is most of the reason to look.
 *
 * So the grid is constant, the ramp carries the information, and how far back
 * the record actually reaches is one plain line underneath. That line is a fact
 * about the history file, not a caveat about the drawing.
 */

/** The cell, and the pitch between two of them. Home has 696 px of usable width
 *  and this display is decided at 470: `5 + 26 x (15 + 3) - 3`. Twenty-six weeks
 *  at roughly double a GitHub cell, which is the size at which a grid of points
 *  reads as a matrix instead of as a spreadsheet. */
export const CELL_SIZE = 15;
export const CELL_SPACE = 3;

/** Monday, Wednesday and Friday, which is GitHub's three and for GitHub's
 *  reason: seven labels on a fifteen-pixel pitch collide into a grey smear, and
 *  three are enough to count the other rows from. Upstream's `LabelsWeek` skips
 *  a falsy entry, so the four blanks are the gaps.
 *
 *  THE ROW ORDER IS THE WEEK'S ORDER AND THE WEEK STARTS ON MONDAY (ADR 0235).
 *  This list was `["", "Mon", ...]` while row 0 was Sunday; it is the labels'
 *  job to name the rows the grid actually draws, so moving the grid moves
 *  these. Getting only one of the two is a calendar that names every row
 *  wrongly by one, which reads as correct until somebody counts. */
export const WEEK_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

/** The gutter upstream reserves once `weekLabels` is truthy. It is upstream's own
 *  number and the labels are laid out against it, so it is quoted rather than
 *  chosen: 28 px, which takes the display from 470 to 493. Home has 696 px of
 *  usable width, so the labels are affordable — they were left out of the first
 *  build to hit 470 exactly, and a row you cannot name is a row you cannot
 *  read. */
export const WEEK_LABEL_PAD = 28;

/* The grid is always `ACTIVITY_WEEKS` wide — see the component's own note on why
   the first, narrowing version of this was wrong. */

/** Unlit, then four lit steps from `--fg-muted` to `--accent`.
 *
 *  OPACITY RATHER THAN A BLENDED COLOUR, and not because `color-mix()` is
 *  unavailable — this stylesheet already uses it. Because the matrix carries
 *  intensity in `opacity` and this is the matrix at calendar scale. A ramp mixed
 *  towards the same accent by a different mechanism would land on slightly
 *  different pixels than the counter beside it, which is the one thing decision
 *  2 exists to prevent. */
const STEP_OPACITY = [0.28, 0.34, 0.55, 0.78, 1];

/** The radius every cell is drawn at — the matrix's own, to the number. */
const CELL_RADIUS = (CELL_SIZE / 2) * 0.9;

/** How thick a marker's ring is, and how far inside `CELL_RADIUS` it is drawn
 *  (ADR 0189).
 *
 *  THE RING IS INSIDE THE RADIUS RATHER THAN AROUND IT. A stroke sits half in
 *  and half out of the circle it is on, so a ring drawn AT `CELL_RADIUS` would
 *  reach 0.75 px past it on every side — and with a 3 px gutter between cells,
 *  two markers on adjacent days would come within 1.5 px of touching and read as
 *  one smeared shape. Pulled in by half the stroke, the outer edge lands exactly
 *  on the radius the fill already occupies and nothing on the grid grows. */
const MARKER_RING = 2;
const MARKER_RING_RADIUS = CELL_RADIUS - MARKER_RING / 2;

/** What the green means, in the one place a reader who has never hovered a cell
 *  will look for it (ADR 0189). One word, because it is a key and not a
 *  sentence — WHICH day is named is on the hover, where the name is. */
export const MARKER_LEGEND = "Milestone";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `Tuesday, 12 August` — the heading decision 3 writes, from the heat map's own
 *  `YYYY/M/D` key rather than from a second date source. */
export function readableDay(key: string): string {
  const [year, month, day] = key.split("/").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return key;
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** `4:05`. Minutes and seconds, because every dictation this product has ever
 *  recorded is minutes long and `245 s` makes a reader do the division. */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole - minutes * 60).padStart(2, "0")}`;
}

/** How far one press of an arrow moves the grid: four weeks, which is the unit
 *  the counters beside it already use and enough that a press is visibly a move
 *  rather than a nudge. */
const SCROLL_WEEKS = 4;

/** One column, edge to edge. The scroll position is always a multiple of this,
 *  which is what keeps a half circle from ever standing at either edge of the
 *  box (ADR 0183). */
export const COLUMN_PITCH = CELL_SIZE + CELL_SPACE;

/** The gutter upstream leaves at the left when it is drawing no weekday labels
 *  of its own. It is 5 rather than 0 and cannot be passed in — the vendored file
 *  derives it — so the box's width carries it rather than pretending it away. */
const GRID_LEFT_PAD = 5;

/** The visible width of the scrolling box: exactly twenty-six columns, from the
 *  left edge of the first to the right edge of the last.
 *
 *  IT DOES NOT INCLUDE THE GRID'S LEFT PAD, AND THE FIRST VERSION DID — which is
 *  the whole bug the owner reported as *there are still cut days at the left*.
 *  Cell `k` starts at `5 + k × 18` inside the drawing, so a clean left edge means
 *  a scroll position CONGRUENT TO 5, not a multiple of 18; a box 5 px wider than
 *  the cells it shows made the two impossible to satisfy at once, and at the far
 *  right end the leftmost column stood 13 px into itself. The pad is content, not
 *  viewport: it scrolls, and the box is sized to the cells. */
export const VIEWPORT_WIDTH = ACTIVITY_WEEKS * COLUMN_PITCH - CELL_SPACE;

/** The height of the drawing, and of the weekday column pinned beside it. Both
 *  come from the vendored file's own arithmetic: 20 px of month labels above
 *  seven rows of cells. */
const GRID_TOP_PAD = 20;
export const GRID_HEIGHT = GRID_TOP_PAD + 7 * COLUMN_PITCH - CELL_SPACE;

/** What stands between the weekday column and the grid — the same five pixels
 *  upstream leaves between a month label's baseline and the first row of cells,
 *  so the two label runs stand off the drawing by the same amount. */
const WEEK_LABEL_GAP = 5;

/** The width of the whole drawing: the pinned weekday column, that gap, and the
 *  box. The head and the foot are laid out against it rather than against the
 *  block, so the headline sits over the first column and the legend under the
 *  last one instead of floating out at the block's own edges. */
const FRAME_WIDTH = WEEK_LABEL_PAD + WEEK_LABEL_GAP + VIEWPORT_WIDTH;

/** `2026-08-16` as `16 August 2026`, for the line that says how far back the
 *  record goes. The heat map's own key format is `YYYY/M/D`, the ledger's is
 *  ISO; this reads the ledger's, which is the one `started_on` is written in. */
export function readableStart(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Monday, and it has to agree with the vendored heat map's own
 *  `getStartOfWeek` (ADR 0235): this decides how many columns are drawn and that
 *  decides where each day lands. Two different week starts on one grid is a
 *  column count that disagrees with the cells it is counting. */
function startOfWeek(at: Date): Date {
  const start = new Date(at.getTime());
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** How many week columns it takes to reach `end` from the week `start` is in.
 *
 *  Over local midnights rather than over exact milliseconds: a span that crosses
 *  a daylight-saving boundary is 7 × 24 h ± 1 h long, and a floor over raw
 *  milliseconds drops the last column twice a year. */
function weekColumns(start: Date, end: Date): number {
  const from = startOfWeek(start).getTime();
  const to = startOfWeek(end).getTime();
  return Math.max(1, Math.round((to - from) / WEEK_MS) + 1);
}

interface HoverState {
  key: string;
  left: number;
  top: number;
}

interface ActivityCalendarProps {
  /** Day buckets from `activityDays`. A day that is absent here is drawn unlit
   *  and says so in words on hover; it is never drawn as a zero. */
  buckets: Map<string, ActivityDay>;
  /** The years the ledger holds day rows for, newest first (ADR 0183). Only
   *  these are offered: a year whose rows have been pruned into the totals would
   *  draw as a blank grid, and a blank grid asserts *nothing was dictated* about
   *  days the record can no longer speak for. The current year is always in the
   *  list, because it is the year the calendar is standing in. */
  years?: number[];
  /** The days this calendar NAMES rather than counts (ADR 0189), keyed as the
   *  cells are. A marker never joins the ramp — see the render override. */
  markers?: Map<string, ActivityMarker>;
  /** `YYYY-MM-DD` of the first row ever written, for the line under the grid. */
  startedOn?: string | null;
  /** `new Date()` in the product, fixed in a test. Nothing after it is drawn. */
  now?: Date;
  className?: string;
}

/** What the line under the grid says the grid is showing. */
export function windowNote(year: number, thisYear: number): string {
  return year === thisYear ? `${year}, up to today.` : `All of ${year}.`;
}

/**
 * THE HEADLINE OVER THE GRID — how many DAYS of the drawn year you dictated on.
 *
 * DAYS AND NOT DICTATIONS, and the owner picked it. GitHub counts contributions
 * and can, because a commit is a unit somebody chose to make; a dictation is not
 * — one long thought and eight false starts are the same afternoon, and a
 * headline that counted them would reward the worse of the two. The grid under
 * this line is a grid of DAYS, so the figure over it counts the same thing the
 * drawing does, and the per-day counts stay where they already are: in the
 * colour of a cell and in its hover.
 */
export function activeDaysNote(days: number, year: number): string {
  if (days <= 0) return `No dictation yet in ${year}`;
  return `${days} active ${days === 1 ? "day" : "days"} in ${year}`;
}

const NO_MARKERS: Map<string, ActivityMarker> = new Map();

export function ActivityCalendar({
  buckets,
  years = [],
  markers = NO_MARKERS,
  startedOn,
  now,
  className,
}: ActivityCalendarProps) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const settle = useRef<number | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [reach, setReach] = useState({ left: false, right: false });
  const today = now ?? new Date();
  /* A YEAR IS THE ONLY PERIOD, AND THE CURRENT ONE IS WHERE IT OPENS. A rolling
     "last 26 weeks" entry stood beside the years for one build and was the same
     thing twice: the box shows about that many weeks whatever year is chosen, so
     the rolling window was a second name for where a year already opens. What
     the reader wanted from it — *the recent part* — is the scroll position, not
     a period of its own. */
  const [year, setYear] = useState(today.getFullYear());

  /* The current year belongs in the list even before it has a record, because it
     is the year the grid is standing in and the picker may not fail to name what
     is on screen.

     AND SO DOES A YEAR THAT ONLY CARRIES A MARKER (ADR 0189). The list is
     otherwise years the LEDGER holds day rows for, which is exactly right for a
     ramp — a year with no rows would draw as unlit circles asserting that
     nothing was dictated on days the record cannot speak for. A marker is not a
     row and makes no such claim: it is a day with a name. Without this, the 2026
     publication date is unreachable on any machine installed in 2027 — the
     marker exists, its year is not offered, and nothing can ever point the
     calendar at it. */
  const offered = useMemo(() => {
    const all = new Set<number>(years);
    all.add(today.getFullYear());
    for (const year of markerYears(markers)) all.add(year);
    return [...all].sort((left, right) => right - left);
  }, [years, markers, today.getFullYear()]);

  /* ONLY THE DAYS THAT HAPPENED. A day with no record is deliberately not in
     this array: the heat map paints anything it does not know about with the
     unlit colour, and putting a zero in here would be writing down a count the
     runtime never made. */
  const value: HeatMapValue[] = useMemo(
    () =>
      Array.from(buckets.values())
        .filter((day) => day.dictations > 0)
        .map((day) => ({ date: day.date, count: day.dictations })),
    [buckets],
  );

  /* THE GRID IS A WHOLE YEAR AND THE BOX IS A HALF-YEAR OF IT (ADR 0183).
     Every day in the span gets a circle, unlit where nothing happened — see
     `ACTIVITY_WEEKS`' note on why the narrowing version was wrong — and the part
     that does not fit is scrolled to rather than dropped.

     THE CURRENT YEAR STOPS AT TODAY. Drawing the rest of it would be four months
     of unlit circles asserting that nothing was dictated on days that have not
     happened, which is the plainest version of the false claim this display
     keeps having to avoid. */
  const { gridStart, endDate, columns } = useMemo(() => {
    const january = new Date(year, 0, 1);
    const december = new Date(year, 11, 31);
    const last = december > today ? today : december;
    return {
      gridStart: startOfWeek(january),
      endDate: last,
      columns: weekColumns(january, last),
    };
    /* `today` is a fresh object on every render where the caller passes none,
       which is the shape this component has always had: the work is a
       subtraction, and the alternative is a second source of "now". */
  }, [year, today.getTime()]);

  /* THE DAYS OF THE DRAWN YEAR THAT HAVE A RECORD. Counted off the same buckets
     the cells are painted from, so the headline and the grid can never disagree
     — a second count from a second source is the way a figure ends up saying
     something the drawing under it contradicts. */
  const activeDays = useMemo(() => {
    let days = 0;
    for (const [key, day] of buckets) {
      if (Number(key.split("/")[0]) === year && day.dictations > 0) days += 1;
    }
    return days;
  }, [buckets, year]);

  /* The drawing's own width. The box is `ACTIVITY_WEEKS` of whole columns and
     clips the rest, which is what there is to scroll. */
  const width = GRID_LEFT_PAD + columns * COLUMN_PITCH - CELL_SPACE;
  const hovered = hover ? buckets.get(hover.key) : undefined;

  /* WHERE THE BOX RESTS AT THE FIRST COLUMN, AND IT IS NOT ZERO (ADR 0189).
     `snapped()` is congruent to `GRID_LEFT_PAD` on purpose — a position
     congruent to 0 shaves a circle at both edges, which ADR 0183 took two passes
     to remove — so the leftmost resting position of this scroller is 5 and never
     0. The reach test was taken against a raw `> 1`, which is true at 5: the
     left arrow stayed lit at the very start of the record, a press set a
     negative position, the browser clamped it to 0, and the settle put it
     straight back to 5. The right arrow was correct all along because the far
     end lands on `max` exactly.

     THE THRESHOLD MOVES AND THE SNAP DOES NOT. Clamping `snapped()` to zero
     would disable the arrow and bring the shaved circle back with it. */
  const measure = () => {
    const node = scroller.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setReach({
      left: node.scrollLeft > GRID_LEFT_PAD + 1,
      right: node.scrollLeft < max - 1,
    });
  };

  /* WHERE A YEAR OPENS: AT ITS NEWEST END. For the current year that is today,
     which is what a reader opening the calendar came for; for a past year it is
     December, which is the same rule rather than a second one — the calendar
     always opens on the most recent thing the chosen year has.

     `useLayoutEffect` rather than `useEffect` so the jump happens before the
     frame is painted; otherwise the grid stands visibly at the wrong end for one
     frame every time the picker moves. */
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const pin = () => {
      /* WITHOUT ANIMATING. `scroll-behavior: smooth` belongs to the arrows and
         the wheel; on the opening jump it slides the whole year past the reader
         for no reason, and the position it is sliding to is where the display
         should simply have started. */
      const easing = node.style.scrollBehavior;
      node.style.scrollBehavior = "auto";
      node.scrollLeft = snapped(node.scrollWidth);
      node.style.scrollBehavior = easing;
      measure();
    };
    pin();
    /* AND AGAIN AFTER THE FRAME IS LAID OUT. Measured in the browser: the first
       pin ran while the box still reported a narrower drawing, so it clamped to
       five columns short of the end and the year opened in June. The second pass
       costs one frame and lands on the real width. */
    const again = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(again);
    /* `columns` is in here because the same year can change width — the current
       one grows by a column every Monday. */
  }, [year, columns]);

  useLayoutEffect(
    () => () => {
      if (settle.current !== null) window.clearTimeout(settle.current);
    },
    [],
  );

  /** The nearest scroll position that puts a column's own left edge against the
   *  box's left edge.
   *
   *  CONGRUENT TO THE PAD, NOT TO ZERO. Cell `k` begins at
   *  `GRID_LEFT_PAD + k × pitch`, so rounding to a bare multiple of the pitch
   *  leaves every column five pixels out — which is a visibly shaved circle at
   *  both edges, and was. Clamped by the browser afterwards, which is why the far
   *  end may be passed in raw. */
  function snapped(left: number): number {
    return GRID_LEFT_PAD + Math.round((left - GRID_LEFT_PAD) / COLUMN_PITCH) * COLUMN_PITCH;
  }

  const step = (direction: -1 | 1) => {
    const node = scroller.current;
    if (!node) return;
    /* `scrollLeft` rather than `scrollBy`, because the smoothness is the
       stylesheet's (`scroll-behavior`) and this way the same code path runs in a
       test, where `scrollBy` is not implemented. */
    node.scrollLeft = snapped(node.scrollLeft) + direction * SCROLL_WEEKS * COLUMN_PITCH;
    measure();
  };

  /* A FREE SCROLL LANDS ON A COLUMN TOO. A trackpad stops wherever the finger
     did, and a box that shows a two-pixel sliver of the next week is exactly the
     clipped circle the viewport arithmetic exists to prevent. So the position is
     rounded to a column once the scrolling stops — after it stops, not during,
     because correcting mid-gesture fights the finger. */
  const onScroll = () => {
    measure();
    if (settle.current !== null) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const node = scroller.current;
      if (!node) return;
      const target = snapped(node.scrollLeft);
      if (Math.abs(target - node.scrollLeft) > 0.5) node.scrollLeft = target;
      /* AND THE ARROWS ARE RE-READ AT THE POSITION THAT WAS SETTLED ON, not at
         the one the finger left. The settle is the last thing that moves this
         box, so it is the only moment at which "is there anything that way" can
         be answered about where the box actually is. */
      measure();
    }, 140);
  };

  return (
    /* THE BLOCK OWNS ITS OWN SHRINKING. Without a class here the wrapper is a
       grid or flex item at `min-width: auto`, whose automatic minimum is the
       470 px display inside it — so the display refuses to go below its natural
       width and hangs out of any box narrower than that, whatever the host's own
       rules say. Measured at a 398 px stage. It is the component's job because
       every future host would otherwise have to know it. */
    <div
      className={cn("ws-cal-block", className)}
      style={
        {
          "--cal-frame": `${FRAME_WIDTH}px`,
          "--cal-gap": `${WEEK_LABEL_GAP}px`,
        } as React.CSSProperties
      }
    >
      {/* THE YEAR PICKER, TOP RIGHT AND COLLAPSED (ADR 0183). GitHub stands a
          column of years beside the grid, which works at its width and not at
          this one — 696 px of column, 493 px of drawing. A pop-up holds the same
          list in one line of it, and grows into a scrollable list of its own as
          the years accumulate rather than pushing the grid narrower every
          January. */}
      <div className="ws-cal-head">
        {/* THE HEADLINE, TOP LEFT, OPPOSITE THE PICKER IT ANSWERS TO. GitHub's
            arrangement and its reason: the reader wants one number for the year
            before they read the shape of it, and the year they are reading it
            for is named at the other end of the same line. */}
        <span className="ws-cal-count">{activeDaysNote(activeDays, year)}</span>
        <Select
          wrapClassName="ws-cal-period"
          aria-label="Year"
          value={String(year)}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {offered.map((each) => (
            <option key={each} value={String(each)}>
              {each}
            </option>
          ))}
        </Select>
      </div>

      <div className="ws-cal-frame">
        {/* THE WEEKDAYS DO NOT SCROLL. They were the heat map's own gutter, which
            is inside the drawing — so the first thing to leave the box on a
            scroll to the right was the labels that say which row is which, and
            the reader lost them exactly when the grid stopped being obvious.
            Pinned here instead, at the vendored file's own geometry: 20 px of
            month labels above, one row every 18 px, the baseline 5 px up from
            the row's foot. Right-aligned, so the longest name still clears the
            grid. */}
        <svg
          className="ws-cal-weekdays"
          width={WEEK_LABEL_PAD}
          height={GRID_HEIGHT}
          viewBox={`0 0 ${WEEK_LABEL_PAD} ${GRID_HEIGHT}`}
          /* THE SIZE IS INLINE BECAUSE `.ws-win svg` IS NOT. That rule sets
             every SVG in the window to 16 × 16 for the icon set, and it beat the
             width and height attributes here: measured in the browser, this
             column rendered as a 16 px square with three labels squeezed into it
             by the viewBox — which is what the owner saw as a dashed line beside
             the grid. An inline style is the one declaration that outranks a
             layered rule without inventing a selector war. */
          style={{ width: WEEK_LABEL_PAD, height: GRID_HEIGHT }}
          aria-hidden="true"
        >
          {WEEK_LABELS.map((label, index) =>
            label ? (
              <text
                key={label}
                x={WEEK_LABEL_PAD}
                /* ON THE ROW'S CENTRE LINE, NOT UPSTREAM'S BASELINE. The
                   vendored file puts its labels five pixels up from the foot of
                   the row, which is two pixels below the circles' centres —
                   invisible in a gutter of its own and obvious once the labels
                   are a pinned column beside the grid, which is where the owner
                   saw it. Measured rather than nudged: a row's centre is
                   `topPad + index × pitch + half a cell`, and a 10 px label sits
                   on it with its baseline three and a half pixels lower. */
                y={GRID_TOP_PAD + index * COLUMN_PITCH + CELL_SIZE / 2 + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
              >
                {label}
              </text>
            ) : null,
          )}
        </svg>

        {/* The box is a half-year of WHOLE columns whatever the drawing inside it
            is, so the cell pitch never changes with the span and no circle is
            ever cut by an edge. */}
        <div
          className="ws-cal-scroll"
          ref={scroller}
          onScroll={onScroll}
          style={{ "--cal-view": `${VIEWPORT_WIDTH}px` } as React.CSSProperties}
        >
      <div className="ws-cal" ref={frame} style={{ "--cal-w": `${width}px` } as React.CSSProperties}>
        <HeatMap
          columns={columns}
          startDate={gridStart}
          endDate={endDate}
          rectSize={CELL_SIZE}
          space={CELL_SPACE}
          /* NO WEEKDAY GUTTER INSIDE THE DRAWING. It is drawn beside the box
             instead, where a scroll cannot take it away — see the pinned column
             above. Upstream still keeps 5 px of left pad with the labels off,
             which is `GRID_LEFT_PAD` and is in the box's width rather than
             pretended away.
             No legend from upstream either: ours is in the foot, at a smaller
             size than the cells it explains. */
          weekLabels={false}
          legendCellSize={0}
          value={value}
          onMouseLeave={() => setHover(null)}
          rectRender={(cellProps, item) => {
            const x = Number(cellProps.x ?? 0);
            const y = Number(cellProps.y ?? 0);
            const day = buckets.get(item.date);
            const step = activityStep(day?.dictations ?? 0);
            /* THE PADS ARE ALREADY APPLIED AND ADDING THEM AGAIN CLIPPED THE
               GRID. `Day` wraps every cell in `<g transform="translate(5, 20)">`,
               so `cellProps.x`/`y` are ALREADY relative to the padded origin.
               Adding the pads here shifted all 182 circles right and down by
               (5, 20), pushing the last column and the bottom row past the
               viewBox edge — which the eye reads not as "shifted" but as
               "why is that circle only three quarters of a circle". */
            const cx = x + CELL_SIZE / 2;
            const cy = y + CELL_SIZE / 2;
            /* A MARKER NEVER OVERWRITES ACTIVITY AND NEVER JOINS THE RAMP
               (ADR 0189). `step` is computed above from the day's dictations
               alone and is not touched here — a marked day that was also
               dictated on keeps its own colour, because the ramp is a reading
               and a marker is a name.

               So the two facts are drawn as two shapes rather than as one
               colour that has to mean both: an unworked marked day is a green
               fill, and a worked one keeps the accent fill at its own step and
               takes a green RING inside the same radius. Both are legible at
               once, and the day's step is unchanged by the marker either way. */
            const marker = markers.get(item.date);
            const named = marker ? `${readableDay(item.date)}, ${marker.label}` : null;
            const hoverAt = (event: React.MouseEvent<SVGElement>) => {
              const box = event.currentTarget.getBoundingClientRect();
              setHover({
                key: item.date,
                left: box.left + box.width / 2,
                top: box.top,
              });
            };
            return (
              <g key={item.index}>
                <circle
                  className="ws-cal-cell"
                  data-date={item.date}
                  data-step={step}
                  data-marker={marker ? "" : undefined}
                  cx={cx}
                  cy={cy}
                  r={CELL_RADIUS}
                  fill={
                    marker && step === 0
                      ? "var(--success)"
                      : step === 0
                        ? "var(--fg-muted)"
                        : "var(--accent)"
                  }
                  /* A MARKER IS NOT DIMMED. Step 0's opacity says *nothing
                     happened here*, and a named day is the one unlit cell on
                     this grid about which that is the wrong claim. */
                  opacity={marker && step === 0 ? 1 : STEP_OPACITY[step]}
                  aria-label={
                    named
                      ? day
                        ? `${named}, ${day.dictations} dictations`
                        : named
                      : day
                        ? `${readableDay(item.date)}, ${day.dictations} dictations`
                        : `${readableDay(item.date)}, nothing`
                  }
                  /* VIEWPORT COORDINATES, because the tooltip is portalled to
                     `body` and positioned `fixed` — see `ActivityTooltip`. */
                  onMouseEnter={hoverAt}
                />
                {marker && step > 0 && (
                  <circle
                    className="ws-cal-ring"
                    data-date={item.date}
                    cx={cx}
                    cy={cy}
                    r={MARKER_RING_RADIUS}
                    fill="none"
                    stroke="var(--success)"
                    strokeWidth={MARKER_RING}
                    /* The ring sits on top of the cell it marks, so it is the
                       thing under the cursor — it has to answer a hover with the
                       same day the fill would have. */
                    onMouseEnter={hoverAt}
                  />
                )}
              </g>
            );
          }}
        />

        </div>
        </div>
      </div>

      {hover && (
        <ActivityTooltip
          date={hover.key}
          day={hovered}
          marker={markers.get(hover.key)}
          left={hover.left}
          top={hover.top}
        />
      )}

      <div className="ws-cal-foot">
        {/* THE ARROWS EXIST FOR A MOUSE WITHOUT A SECOND AXIS. A trackpad and a
            shifted wheel already scroll the box; a plain wheel does not, and a
            display whose other half is only reachable with a modifier held down
            is a display with a hidden half. Disabled at each end, so the end of
            the record is visible rather than a press that does nothing. */}
        <span className="ws-cal-steps">
          <button
            type="button"
            className="ws-cal-step"
            aria-label="Earlier weeks"
            title="Earlier weeks"
            disabled={!reach.left}
            onClick={() => step(-1)}
          >
            <Icon name="chevron" />
          </button>
          <button
            type="button"
            className="ws-cal-step"
            aria-label="Later weeks"
            title="Later weeks"
            disabled={!reach.right}
            onClick={() => step(1)}
          >
            <Icon name="chevron" />
          </button>
        </span>

        <p className="ws-cal-note">
          {windowNote(year, today.getFullYear())}
          {startedOn && ` Recorded since ${readableStart(startedOn)}.`}
        </p>


        {/* THE RAMP, STATED. It was left out on the argument that the tooltip
            already explains every cell and a legend would be a second
            explanation of one thing — which is true of one cell and false of the
            grid: the reader who wants to know whether a colour is two dictations
            or twenty is asking about the SCALE, and hovering thirty cells to
            infer it is not an answer (ADR 0183). Unlabelled steps, like
            GitHub's: the numbers are on the hover, and five numbers here would
            be a table.

            THE HIDDEN REGION IS NOW THE RAMP ALONE (ADR 0189). `aria-hidden` was
            right for the whole legend while every entry in it was an unlabelled
            swatch whose numbers are on the hover: five colours read out as five
            nothings. It is wrong the moment an entry carries a NAME. A green
            circle on this grid means something no other cell means, and a reader
            who cannot see colour has to be able to find out what — so the marker
            key comes out of the hidden region and the ramp stays inside it. */}
        <span className="ws-cal-legend">
          {markers.size > 0 && (
            <>
              <i className="ws-cal-key-marker" />
              {/* ONE WORD WHILE ONE WORD IS TRUE (ADR 0243). Every marker on
                  this grid is a milestone, so naming the sort is the whole
                  legend — and the moment the grid draws more than one named day,
                  the word carries the count as well, because a reader looking at
                  two green circles is asking how many kinds there are before
                  they hover either. The names stay on the hover, which is where
                  a name is readable. */}
              <span>
                {MARKER_LEGEND}
                {markers.size > 1 ? ` · ${markers.size}` : ""}
              </span>
              <span className="ws-sep" aria-hidden="true">
                ·
              </span>
            </>
          )}
          <span aria-hidden="true">
            <span>Less</span>
            {STEP_OPACITY.map((opacity, index) => (
              <i
                key={index}
                style={{
                  opacity,
                  background: index === 0 ? "var(--fg-muted)" : "var(--accent)",
                }}
              />
            ))}
            <span>More</span>
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * THE DAY, ON HOVER — decision 3.
 *
 * GitHub says *5 contributions on March 3*, and that is poor. This is where the
 * "which four metrics" problem dissolves: EVERYTHING DAY-SCOPED LIVES HERE.
 * Sessions that day, the longest one, words — none of them needs a tile, because
 * each is a property of a day rather than of a person. A tooltip is allowed to be
 * rich, because only a reader who went looking ever sees it.
 *
 * A DAY WITH NOTHING IN IT SAYS SO IN WORDS. A row of noughts claims five counts
 * were taken and all came back nought; the truth is that nothing happened, and
 * those are different sentences.
 *
 * MEETINGS AND UPLOADS ARE HERE WITH NO READING AT ALL. They are origins that do
 * not exist yet — `context-objects.md` owns them — and a `0 meetings` would be
 * the invented figure ADR 0161 exists to forbid. They hold their line so the
 * shape of the answer is right the day an origin can fill it.
 */
function ActivityTooltip({
  date,
  day,
  marker,
  left,
  top,
}: {
  date: string;
  day?: ActivityDay;
  /** The name this day carries, where it carries one (ADR 0189). */
  marker?: ActivityMarker;
  left: number;
  top: number;
}) {
  /* PORTALLED TO `body` AND POSITIONED `fixed`, which is the only arrangement
     that survives this shell. Inside the content column the tooltip is trapped
     in whatever stacking context its ancestors happen to build, and the sidebar
     painted over it — a `z-index` on the tooltip cannot win that, because the
     contest is between two ancestors and not between the two boxes. Out of the
     tree entirely, there is nothing left to lose to. It also stops the panel
     being clipped by any scroller between here and the window.

     Clamped to the viewport, because a day in the first column would otherwise
     hang the panel off the left edge, where it is unreadable rather than merely
     misplaced. */
  const HALF = 150;
  const x = Math.min(Math.max(left, HALF + 8), window.innerWidth - HALF - 8);

  return createPortal(
    <div
      className="ws-cal-tip"
      role="tooltip"
      style={{ left: `${x}px`, top: `${top}px` }}
    >
      <b>{readableDay(date)}</b>
      {/* THE NAME COMES FIRST, ABOVE THE DAY'S OWN READINGS (ADR 0189). It is
          why the reader stopped on this cell — the green is what caught them,
          and an answer that made them read past two counts to find it would be
          answering a question they did not ask. */}
      {marker && <span className="ws-cal-tip-marker">{marker.label}</span>}
      {day ? (
        <>
          <span>
            {day.dictations === 1 ? "1 dictation" : `${day.dictations} dictations`}
            {day.words > 0 && ` · ${day.words.toLocaleString("en-US")} words`}
          </span>
          {day.timed > 0 && (
            <span>
              {`Longest ${clockOf(day.longestSeconds)}`}
              {` · ${clockOf(day.seconds)} recorded`}
              {day.timed < day.dictations && ` over ${day.timed} of ${day.dictations}`}
            </span>
          )}
        </>
      ) : (
        <span>Nothing on this day.</span>
      )}
      <span className="ws-cal-tip-owed">
        Meetings and uploads
        <PreviewTag title="Neither origin exists yet. A meeting and an upload are recorded objects the context-objects track owns; until one can produce a day, this line states that rather than counting nought of them." />
      </span>
    </div>,
    document.body,
  );
}
