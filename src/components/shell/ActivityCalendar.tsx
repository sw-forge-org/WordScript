import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HeatMap, type HeatMapValue } from "@/components/ui/heat-map";
import { ACTIVITY_WEEKS, activityStep, type ActivityDay } from "@/lib/activity";
import { cn } from "@/lib/utils";
import { PreviewTag } from "./PreviewTag";

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
 *  a falsy entry, so the four blanks are the gaps. */
export const WEEK_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

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

/** The span the grid covers. A plain caption, not a caveat: the first build
 *  spent this line explaining how far the record reached, which is a fact about
 *  a settings value that no reader asked a calendar for. */
export const WINDOW_NOTE = `The last ${ACTIVITY_WEEKS} weeks.`;

interface HoverState {
  key: string;
  left: number;
  top: number;
}

interface ActivityCalendarProps {
  /** Day buckets from `activityDays`. A day that is absent here is drawn unlit
   *  and says so in words on hover; it is never drawn as a zero. */
  buckets: Map<string, ActivityDay>;
  /** `new Date()` in the product, fixed in a test. Nothing after it is drawn. */
  now?: Date;
  className?: string;
}

export function ActivityCalendar({ buckets, now, className }: ActivityCalendarProps) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const endDate = now ?? new Date();

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

  /* THE GRID IS ALWAYS THE FULL HALF-YEAR. It draws every one of its days as a
     circle, unlit where nothing happened — see `ACTIVITY_WEEKS`' note on why the
     narrowing version was wrong. */
  const gridStart = useMemo(() => {
    const first = new Date(endDate.getTime());
    first.setHours(0, 0, 0, 0);
    first.setDate(first.getDate() - first.getDay() - (ACTIVITY_WEEKS - 1) * 7);
    return first;
  }, [endDate]);

  const width = WEEK_LABEL_PAD + ACTIVITY_WEEKS * (CELL_SIZE + CELL_SPACE) - CELL_SPACE;
  const hovered = hover ? buckets.get(hover.key) : undefined;

  return (
    /* THE BLOCK OWNS ITS OWN SHRINKING. Without a class here the wrapper is a
       grid or flex item at `min-width: auto`, whose automatic minimum is the
       470 px display inside it — so the display refuses to go below its natural
       width and hangs out of any box narrower than that, whatever the host's own
       rules say. Measured at a 398 px stage. It is the component's job because
       every future host would otherwise have to know it. */
    <div className={cn("ws-cal-block", className)}>
      <div className="ws-cal" ref={frame} style={{ "--cal-w": `${width}px` } as React.CSSProperties}>
        <HeatMap
          columns={ACTIVITY_WEEKS}
          startDate={gridStart}
          endDate={endDate}
          rectSize={CELL_SIZE}
          space={CELL_SPACE}
          /* Mondays, Wednesdays and Fridays down the left edge — the three
             GitHub labels, and for GitHub's reason: seven labels on a
             fifteen-pixel pitch collide, and three are enough to count rows
             from. Upstream skips a falsy entry, so the blanks are the gaps.
             No legend: the ramp is explained by the tooltip, and a legend would
             be a second explanation of one thing. */
          weekLabels={WEEK_LABELS}
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
            return (
              <circle
                key={item.index}
                className="ws-cal-cell"
                data-date={item.date}
                data-step={step}
                cx={cx}
                cy={cy}
                r={(CELL_SIZE / 2) * 0.9}
                fill={step === 0 ? "var(--fg-muted)" : "var(--accent)"}
                opacity={STEP_OPACITY[step]}
                aria-label={
                  day
                    ? `${readableDay(item.date)}, ${day.dictations} dictations`
                    : `${readableDay(item.date)}, nothing`
                }
                /* VIEWPORT COORDINATES, because the tooltip is portalled to
                   `body` and positioned `fixed` — see `ActivityTooltip`. */
                onMouseEnter={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  setHover({
                    key: item.date,
                    left: box.left + box.width / 2,
                    top: box.top,
                  });
                }}
              />
            );
          }}
        />

      </div>

      {hover && (
        <ActivityTooltip
          date={hover.key}
          day={hovered}
          left={hover.left}
          top={hover.top}
        />
      )}

      <p className="ws-cal-note">{WINDOW_NOTE}</p>
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
  left,
  top,
}: {
  date: string;
  day?: ActivityDay;
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
