import type { ReactNode } from "react";
import {
  ActivityCalendar,
  Card,
  CardRows,
  DigitCounter,
  MATRIX_FRAMES,
  Matrix,
  Note,
  Row,
  SectionHeader,
} from "@/components/shell";
import { ACTIVITY_STEPS, dayKey, type ActivityDay } from "@/lib/activity";

/**
 * MOTION — the *matrix* section of `SCREENS.ds`, ported out of `demo.js`.
 *
 * What stood here was the old `/component-lab`: a row of unlabelled swatches
 * plus an orb, a keycap and a set of provider marks, none of it read out of the
 * prototype. The owner put the two side by side and the difference was the
 * whole of Leg 2's first half.
 *
 * WHY THE READOUT IS SHOWN WHOLE. The Design System screen exists so a
 * component is judged as a component rather than inferred from the one screen
 * that happens to use it, and the matrix is the case that argument was written
 * for: the product uses one of its modes, in one place, at one size, and the
 * twelfth prototype pass shipped exactly that much of it and called it the
 * component. Everything it can do is here, drawn at upstream's own default
 * 10 px pixel so the bloom is the one upstream tuned.
 *
 * THE LEVELS ARE SAMPLE DATA. `vu` reads an array of levels, and the prototype
 * feeds it a synthetic envelope because it is a static mock. Here it holds one
 * frame: a gallery carries sample data and asserts nothing, and a meter that
 * moves on a page measuring nothing is the fake state the runtime rules forbid.
 */

/* One moment of speech, held. Sixteen columns, which is the meeting HUD's. */
const VU_SAMPLE = [
  0.18, 0.31, 0.52, 0.74, 0.61, 0.44, 0.69, 0.88, 0.72, 0.5, 0.36, 0.58, 0.41, 0.27, 0.16,
  0.09,
];

const CELLS: Array<{
  name: string;
  mode: "vu" | "frames" | "pattern";
  description: string;
  render: ReactNode;
}> = [
  {
    name: "VU",
    mode: "vu",
    description:
      "Levels in, column heights out. The one mode the product uses, in the meeting HUD.",
    render: (
      <Matrix
        mode="vu"
        levels={VU_SAMPLE}
        rows={7}
        cols={16}
        size={10}
        gap={2}
        ariaLabel="Level meter"
      />
    ),
  },
  {
    name: "Loader",
    mode: "frames",
    description: "Eight pixels around a circle, twelve frames to the turn.",
    render: (
      <Matrix
        frames={MATRIX_FRAMES.loader}
        rows={7}
        cols={7}
        size={10}
        gap={2}
        fps={12}
        ariaLabel="Loader"
      />
    ),
  },
  {
    name: "Wave",
    mode: "frames",
    description: "A travelling sine, anti-aliased vertically so seven rows do not step.",
    render: (
      <Matrix
        frames={MATRIX_FRAMES.wave}
        rows={7}
        cols={7}
        size={10}
        gap={2}
        fps={16}
        ariaLabel="Wave"
      />
    ),
  },
  {
    name: "Snake",
    mode: "frames",
    description: "A five-pixel tail over every cell in the field.",
    render: (
      <Matrix
        frames={MATRIX_FRAMES.snake}
        rows={7}
        cols={7}
        size={10}
        gap={2}
        fps={14}
        ariaLabel="Snake"
      />
    ),
  },
  {
    name: "Pulse",
    mode: "frames",
    description:
      "A ring out of a lit centre. Ported, and deliberately unused: ADR 0049 settles that the orchestrator's voice has four states and no pulse.",
    render: (
      <Matrix
        frames={MATRIX_FRAMES.pulse}
        rows={7}
        cols={7}
        size={10}
        gap={2}
        fps={16}
        ariaLabel="Pulse"
      />
    ),
  },
  {
    name: "Digit",
    mode: "pattern",
    description:
      "A static frame. Ten of them, 5 x 7 each, which is what makes a clock possible.",
    render: (
      <Matrix
        pattern={MATRIX_FRAMES.digits[0]}
        rows={7}
        cols={5}
        size={10}
        gap={2}
        ariaLabel="Digit zero"
      />
    ),
  },
];

/**
 * THE COUNTER — the composite frame the digit alphabet does not ship.
 *
 * Three cells, and the first two exist to be compared: one digit and four sit in
 * a box of exactly the same width, which is the whole claim the component makes.
 * The third is the reading that does not exist, which is a dark display rather
 * than a lit zero — those are two different facts and the component refuses to
 * spell one as the other.
 */
const COUNTERS: Array<{ name: string; reads: string; description: string; render: ReactNode }> = [
  {
    name: "One digit",
    reads: "7",
    description:
      "Right-aligned in four reserved positions. The three unlit slots are the space the number grows into.",
    render: <DigitCounter value={7} size={6} gap={2} ariaLabel="7" />,
  },
  {
    name: "Four digits",
    reads: "1,240",
    description:
      "The same box, filled. Nothing on the row moves when 99 becomes 100, which is what makes a counter readable at a glance.",
    render: <DigitCounter value={1240} size={6} gap={2} ariaLabel="1,240" />,
  },
  {
    name: "No reading",
    reads: "—",
    description:
      "A dark display asserts nothing. A lit 0 would assert that the runtime counted none, and that is a different claim.",
    render: <DigitCounter value={null} size={6} gap={2} ariaLabel="No reading yet" />,
  },
];

/**
 * THE CALENDAR'S SAMPLE HALF-YEAR.
 *
 * The gallery has no runtime and therefore no records, and this is the one
 * surface where that matters: a calendar drawn over an empty history is 182
 * unlit circles, which shows the grid and none of the ramp. So the days are
 * synthetic AND SAID TO BE — the section's own note carries it — for the same
 * reason the matrix's level meter is fed a synthetic envelope one section down.
 *
 * The counts walk the four thresholds on purpose, so every step of the ramp is
 * on screen and the gallery is judging the ramp rather than one colour.
 */
const SAMPLE_WEEKS = 26;

function sampleDays(now: Date): Map<string, ActivityDay> {
  const days = new Map<string, ActivityDay>();
  const counts = [0, 1, 0, ACTIVITY_STEPS[1], 0, ACTIVITY_STEPS[2], ACTIVITY_STEPS[3], 2, 0, 0];
  for (let back = 0; back < SAMPLE_WEEKS * 7; back += 1) {
    const dictations = counts[back % counts.length];
    if (dictations === 0) continue;
    const date = new Date(now.getTime());
    date.setDate(date.getDate() - back);
    const key = dayKey(date);
    days.set(key, {
      date: key,
      dictations,
      words: dictations * 210,
      seconds: dictations * 96,
      timed: dictations,
      longestSeconds: 60 + dictations * 13,
    });
  }
  return days;
}

export function Motion() {
  const now = new Date();

  return (
    <div className="flex flex-col gap-[var(--gap-block)]">
      <SectionHeader
        title="The activity calendar"
        description="Home's other opening block. The same circles the matrix draws, on the same accent ramp, one day per point — which is what makes the calendar and the counter two states of one display rather than two widgets."
      >
        <Card>
          <div className="ws-mx-lab">
            <figure className="ws-mx-cell">
              <div className="ws-mx-stage" data-tall>
                {/* The picker, the arrows and the legend need a record with more
                    than one year in it to be worth looking at, and the gallery
                    has no runtime — so the two years and the start date are
                    sample data like the counts, and are marked as such in the
                    caption below. */}
                <ActivityCalendar
                  buckets={sampleDays(now)}
                  years={[now.getFullYear(), now.getFullYear() - 1]}
                  startedOn={`${now.getFullYear() - 1}-03-04`}
                  now={now}
                />
              </div>
              <figcaption>
                <b>Twenty-six weeks</b>
                <span className="ws-mx-mode ws-mono">470 px</span>
                <span>
                  Hover a day for its composition. The counts here are sample data — the gallery has
                  no runtime and no records, and an empty history would show the grid with none of
                  the ramp.
                </span>
              </figcaption>
            </figure>
          </div>
          <CardRows>
            <Row
              label="How wide it opens"
              hint="Twenty-six weeks is the cap, not the opening width. What is drawn is the window the history file can still be believed for — pruning by age and by count both narrow it — and the line under the grid names which bound bit."
              control={<span className="ws-mono ws-muted">grows rightwards</span>}
            />
            <Row
              label="What an unlit cell claims"
              hint="That nothing was dictated that day. It is only true inside the window above, which is the whole reason the display refuses to draw a half-year it cannot vouch for."
              control={<span className="ws-mono ws-muted">no dictation</span>}
            />
            <Row
              label="The steps"
              hint="Fixed thresholds rather than quartiles of the busiest day. A ramp scaled to the maximum makes the same two dictations step 4 one week and step 1 the next, and the reader learns nothing they can carry."
              control={
                <span className="ws-mono ws-muted">{ACTIVITY_STEPS.join(" · ")} dictations</span>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>
      <SectionHeader
        title="The counter"
        description="A number built out of the matrix's ten digit frames — N glyphs with one blank column between them, right-aligned in four reserved positions. There is no alphabet and no separator, so a label beside a counter stays ordinary text."
      >
        <Card>
          <div className="ws-mx-lab">
            {COUNTERS.map((cell) => (
              <figure key={cell.name} className="ws-mx-cell">
                <div className="ws-mx-stage">{cell.render}</div>
                <figcaption>
                  <b>{cell.name}</b>
                  <span className="ws-mx-mode ws-mono">{cell.reads}</span>
                  <span>{cell.description}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <CardRows>
            <Row
              label="Reserved positions"
              hint="Four, and it is the selection rule rather than a layout preference: rates, ratios, small sets and windows all settle inside four digits. A cumulative total runs away, ends up abbreviated, and stops being a counter."
              control={<span className="ws-mono ws-muted">4</span>}
            />
            <Row
              label="Overflow"
              hint="A value too long for the reserved positions widens the frame. Dropping a leading digit would state a wrong number, which is worse than a box that grew."
              control={<span className="ws-mono ws-muted">widen, never truncate</span>}
            />
          </CardRows>
        </Card>
      </SectionHeader>
      <SectionHeader
        title="The matrix"
        description="A dot-matrix readout. One component, four frame sources and a level mode — ported whole from ElevenLabs UI (MIT), because a subset of a component is a different component."
      >
        <Card>
          <div className="ws-mx-lab">
            {CELLS.map((cell) => (
              <figure key={cell.name} className="ws-mx-cell">
                <div className="ws-mx-stage">{cell.render}</div>
                <figcaption>
                  <b>{cell.name}</b>
                  <span className="ws-mx-mode ws-mono">{cell.mode}</span>
                  <span>{cell.description}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <CardRows>
            <Row
              label="Lit pixel"
              hint="A radial fill, not a flat colour, plus a blur that scales with the pixel. Both are what make a dot read as emitting instead of as a filled circle."
              control={
                <span className="ws-mono ws-muted">radialGradient + feGaussianBlur</span>
              }
            />
            <Row
              label="Unlit pixel"
              hint="Drawn, never omitted. The dark grid is what makes a mostly-off display read as a display."
              control={<span className="ws-mono ws-muted">opacity 0.1</span>}
            />
            <Row
              label="Palette"
              hint="Two properties on the wrapper. The light scheme keeps the colours and drops the bloom — there is nothing to glow into on white."
              control={<span className="ws-mono ws-muted">--matrix-on / --matrix-off</span>}
            />
            <Row
              label="Frame clock"
              hint="An accumulator over real time, so playback holds its fps whatever the display is doing. Reduced motion draws one frame and stops."
              control={<span className="ws-mono ws-muted">fps · loop · autoplay</span>}
            />
          </CardRows>
        </Card>
        <Note tone="eye">
          Measured in WebKitGTK 2.52.4 at 7 x 24: upstream's SVG glow filter 62.1 fps, a
          static drop-shadow 62.1, no bloom 62.2. The filter costs nothing here and is what
          the component looks like, so it is the one that ships.
        </Note>
      </SectionHeader>
    </div>
  );
}
