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
/** Decision 5 of the home activity track: every counter holds four. */
export const RESERVED_POSITIONS = 4;

/**
 * The digits a value is spelled with, or `null` when it has none to spell.
 *
 * Rounded, because the matrix has no decimal point and a rate is read as a whole
 * number anyway. Floored at zero, because none of the four admitted shapes —
 * rate, ratio, small set, window — can be negative, and there is no minus glyph
 * to say so if one were.
 */
export function counterDigits(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return String(Math.max(0, Math.round(value)));
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
): Frame {
  const shown = counterDigits(value);
  const slots = Math.max(positions, shown?.length ?? 0);
  const cols = slots * DIGIT_COLS + (slots - 1) * DIGIT_SPACING_COLS;
  const frame: Frame = Array.from({ length: DIGIT_ROWS }, () =>
    Array<number>(cols).fill(0),
  );

  if (!shown) return frame;

  const offset = slots - shown.length;
  for (let index = 0; index < shown.length; index += 1) {
    const glyph = MATRIX_FRAMES.digits[Number(shown[index])];
    const start = (offset + index) * (DIGIT_COLS + DIGIT_SPACING_COLS);
    for (let row = 0; row < DIGIT_ROWS; row += 1) {
      for (let col = 0; col < DIGIT_COLS; col += 1) {
        frame[row][start + col] = glyph[row][col];
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
  size = 4,
  gap = 2,
  ariaLabel,
  className,
}: DigitCounterProps) {
  const frame = counterFrame(value, positions);
  const cols = frame[0].length;
  const width = cols * (size + gap) - gap;
  const unlit = counterDigits(value) === null;

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
