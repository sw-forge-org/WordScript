import * as React from "react";
import { MATRIX_FRAMES, Matrix, type Frame } from "./Matrix";
import { cn } from "@/lib/utils";

/**
 * A NUMBER ON THE MATRIX, IN A BOX THAT DOES NOT MOVE WHEN THE NUMBER GROWS.
 *
 * `MATRIX_FRAMES.digits` is ten 7 x 5 frames and nothing else — one glyph per
 * call, no alphabet, no separator, no sign. A multi-digit number therefore needs
 * a frame that does not exist upstream: N glyphs merged side by side with ONE
 * BLANK COLUMN between them, because two 5-wide glyphs butted together read as
 * one 10-wide shape.
 *
 * FOUR POSITIONS ARE RESERVED AND THE NUMBER IS RIGHT-ALIGNED INSIDE THEM. The
 * number grows leftwards into space the display already holds, so nothing on the
 * row moves when 99 becomes 100 — a counter whose neighbours shuffle every time
 * it ticks is a counter nobody can read at a glance. Four is not a layout
 * preference: it is the selection rule for what may be a counter at all. Rates,
 * ratios, small sets and windows all settle inside four digits; a cumulative
 * total runs away, ends up abbreviated, and stops being a counter.
 *
 * THE UNLIT POSITIONS ARE DRAWN. That is upstream's rule for the whole
 * component — the dark grid is what makes a mostly-off display read as a display
 * — and here it does the second job as well: the reserved space is visible, so
 * the box is seen to be held rather than merely computed to be.
 *
 * `null` IS NO READING, AND IT IS NOT ZERO. A dark display asserts nothing; a
 * lit `0` asserts that the runtime counted none. The two are different facts and
 * this component refuses to spell one as the other, which is why a value it
 * cannot represent — `null`, `NaN`, an infinity — lights nothing at all rather
 * than falling back to a number.
 *
 * THE SVG SCALES, THE GEOMETRY DOES NOT. `--counter-w` carries the natural width
 * so the stylesheet can cap it there and let a narrow column shrink it; the
 * frame is the same frame at every width.
 */

export const DIGIT_ROWS = 7;
export const DIGIT_COLS = 5;
/** One blank column between two glyphs. Without it a `11` is a single shape. */
export const DIGIT_SPACING_COLS = 1;

/**
 * HOW WIDE THE GAP AT A DECIMAL POINT IS, AND IT IS NOT THE ORDINARY ONE
 * (ADR 0191).
 *
 * THE FIRST BUILD LIT ONE CELL IN THE ORDINARY ONE-COLUMN GAP AND THE OWNER
 * COULD NOT READ IT: `1.0` was reported as reading `10`. Both halves of that are
 * the same mistake. A single dot at the foot of a 6 px gap is four pixels of ink
 * against a display made of four-pixel dots — it does not announce itself — and
 * more importantly the gap it sits in is IDENTICAL to the gap between every
 * other pair of digits, so the eye has nothing to group by and reads one number.
 *
 * THE SEPARATION IS THE SIGNAL AND THE DOT ONLY CONFIRMS IT. Two blank columns
 * make the split visible before the point is even looked at: whatever is left of
 * that gap is one number and whatever is right of it is another. So the gap
 * doubles and the point is drawn 2 x 2 in it — solid enough to be a mark rather
 * than a stray lit cell, and centred in a gap wide enough to hold it.
 *
 * AND THE MARK DOES NOT TOUCH THE DIGIT AFTER IT. Reported on the running app
 * with the two-column version: the point and the first decimal digit merged into
 * one shape, which is the same failure one step smaller — a mark that runs into
 * its neighbour is a mark the eye reads as part of the neighbour.
 *
 * NOR THE DIGIT BEFORE IT, AND THAT HALF WAS DECIDED WRONG TWICE (ADR 0236). The
 * three-column build left the point hard against the digit on its LEFT and
 * argued that this is where a decimal point belongs: it says *this number
 * continues*, and it says it about the integer part. Typography, and the wrong
 * subject — a printed point sits beside a glyph whose bounding box has side
 * bearings, and these have none. **The glyphs decide, and seven of the ten reach
 * their last column in the rows the point occupies.** `0`, `2`, `3`, `5`, `6`,
 * `8` and `9` all light column four in one of the bottom two rows; `1`, `4` and
 * `7` do not. So `1.3` was clean and `3.4` was one shape, on the same display,
 * with the same code — which is exactly what the owner reported: the turnaround
 * tile right, the time-saved tile wrong.
 *
 * A GAP THE GLYPHS CANNOT REACH INTO, ON BOTH SIDES. Four columns: one clear,
 * the two-column mark, one clear. It is the only arrangement that does not
 * depend on which digits happen to stand either side of the point, and *it does
 * not depend on the data* is the whole property a counter needs.
 *
 * IT COSTS THREE COLUMNS OF WIDTH AND NOTHING ELSE. The four reserved positions
 * stay four, the dot pitch is unchanged, and the tile is three columns wider
 * than its three neighbours inside a grid track that has the room. A counter
 * nobody can read correctly is not worth eighteen pixels.
 */
export const DECIMAL_GAP_COLS = 4;

/** How much of that gap the mark itself takes. The column before it and the
 *  column after it stay clear, because a glyph's ink runs to its own last column
 *  and the mark may not be adjacent to either neighbour — see
 *  `DECIMAL_GAP_COLS`. */
export const DECIMAL_POINT_COLS = 2;

/** How far into the gap the mark starts: one clear column after the integer
 *  digit's last column. */
export const DECIMAL_POINT_INSET = 1;
/** Decision 5 of the home activity track: every counter holds four. */
export const RESERVED_POSITIONS = 4;

/**
 * The digits a value is spelled with, or `null` when it has none to spell.
 *
 * Rounded, because a rate is read as a whole number. Floored at zero, because
 * none of the four admitted shapes — rate, ratio, small set, window — can be
 * negative, and there is no minus glyph to say so if one were.
 *
 * `decimals` MOVES THE ROUNDING RATHER THAN ADDING A CHARACTER (ADR 0191). The
 * digits string stays a run of digits and nothing else — `2.4` is `"24"` — and
 * where the point falls is `decimalColumn`'s business, not this function's.
 * There is no `.` glyph in `MATRIX_FRAMES.digits` and there is not going to be
 * one; the point is a single lit cell in a column that already exists.
 */
export function counterDigits(
  value: number | null | undefined,
  decimals = 0,
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const places = Math.max(0, Math.trunc(decimals));
  const scale = 10 ** places;
  const shown = String(Math.max(0, Math.round(value * scale)));
  /* A LEADING ZERO IS PART OF THE NUMBER WHEN THERE IS A POINT. Without it a
     value of 0.8 spells `"8"` and would draw as `.8` — a shape that reads as
     dirt on the display rather than as a number. */
  return places > 0 ? shown.padStart(places + 1, "0") : shown;
}

/**
 * The composite frame: `positions` glyph slots, one blank column between each,
 * with the value's digits set into the rightmost slots.
 *
 * A value too long for the reserved positions WIDENS THE FRAME rather than
 * losing its leading digits. A counter that silently dropped a digit would state
 * a wrong number, which is worse than a box that grew — and by rule 6 of the
 * track it cannot happen to any figure admitted as a counter in the first place.
 */
export function counterFrame(
  value: number | null | undefined,
  positions = RESERVED_POSITIONS,
  decimals = 0,
): Frame {
  const shown = counterDigits(value, decimals);
  const slots = Math.max(positions, shown?.length ?? 0);
  const places = Math.max(0, Math.trunc(decimals));
  /* WHICH SLOT THE POINT FOLLOWS. `-1` is no point at all, which is every tile
     but one — and also the degenerate case where the point would fall before the
     first slot and have no integer part to separate. */
  const pointAfter = places > 0 && places < slots ? slots - places - 1 : -1;
  const gapAfter = (slot: number) =>
    slot === pointAfter ? DECIMAL_GAP_COLS : DIGIT_SPACING_COLS;

  /* The start column of every slot, walked once rather than derived by a
     formula: the gaps are no longer all the same width, and a closed form for
     "where does slot k begin" would have to encode that twice. */
  const starts: number[] = [];
  let cursor = 0;
  for (let slot = 0; slot < slots; slot += 1) {
    starts.push(cursor);
    cursor += DIGIT_COLS + (slot < slots - 1 ? gapAfter(slot) : 0);
  }
  const cols = cursor;
  const frame: Frame = Array.from({ length: DIGIT_ROWS }, () =>
    Array<number>(cols).fill(0),
  );

  if (!shown) return frame;

  const offset = slots - shown.length;
  for (let index = 0; index < shown.length; index += 1) {
    const glyph = MATRIX_FRAMES.digits[Number(shown[index])];
    const start = starts[offset + index];
    for (let row = 0; row < DIGIT_ROWS; row += 1) {
      for (let col = 0; col < DIGIT_COLS; col += 1) {
        frame[row][start + col] = glyph[row][col];
      }
    }
  }

  /* THE POINT: A 2 x 2 MARK AT THE BASELINE, IN THE WIDENED GAP. There is no
     `.` in `MATRIX_FRAMES.digits` and there is not going to be one — it is ten
     digit frames and nothing else — so the point is drawn rather than set, in
     space the frame already holds. See `DECIMAL_GAP_COLS` for why one cell in an
     ordinary gap was unreadable. */
  if (pointAfter >= 0) {
    const column = starts[pointAfter] + DIGIT_COLS + DECIMAL_POINT_INSET;
    for (let row = DIGIT_ROWS - 2; row < DIGIT_ROWS; row += 1) {
      for (let col = column; col < column + DECIMAL_POINT_COLS; col += 1) {
        if (col < cols) frame[row][col] = 1;
      }
    }
  }

  return frame;
}

interface DigitCounterProps {
  /** `null` lights nothing. It is the reading the runtime did not produce, and
   *  it is deliberately not spelled as `0`. */
  value: number | null | undefined;
  positions?: number;
  /** How many digits stand to the right of the point, drawn as one lit cell in
   *  the blank column that already separates two glyphs (ADR 0191). `0` is the
   *  whole-number display every other tile uses. */
  decimals?: number;
  /** Pixel size and spacing of one dot, in the matrix's own units. */
  size?: number;
  gap?: number;
  /** What a screen reader is told. Required: the SVG is a picture of a number,
   *  so the number has to be said somewhere, and only the caller knows its unit. */
  ariaLabel: string;
  className?: string;
}

export function DigitCounter({
  value,
  positions = RESERVED_POSITIONS,
  decimals = 0,
  size = 4,
  gap = 2,
  ariaLabel,
  className,
}: DigitCounterProps) {
  const frame = counterFrame(value, positions, decimals);
  const cols = frame[0].length;
  const width = cols * (size + gap) - gap;
  const unlit = counterDigits(value, decimals) === null;

  return (
    <span
      className={cn("ws-counter", className)}
      data-unlit={unlit ? "" : undefined}
      style={{ "--counter-w": `${width}px` } as React.CSSProperties}
    >
      {/* `block w-full` BEATS the wrapper's own `inline-flex`, it does not
          restate it — same tailwind-merge group, so passing it drops upstream's
          display and the utilities layer stops overriding the stylesheet. The
          shell `Matrix` documents the same manoeuvre for the same reason. */}
      <Matrix
        className="block w-full"
        pattern={frame}
        rows={DIGIT_ROWS}
        cols={cols}
        size={size}
        gap={gap}
        ariaLabel={ariaLabel}
      />
    </span>
  );
}
