import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DigitCounter, RESERVED_POSITIONS, counterDigits, counterFrame } from "./DigitCounter";
import { MATRIX_FRAMES } from "./Matrix";

/**
 * The counter's whole reason to exist is that the box does not move, so that is
 * what is asserted first and by measurement rather than by eye. jsdom applies no
 * stylesheet, but the SVG carries its own `width` attribute — the component
 * computes it from the frame — so the geometry is checkable here.
 */

afterEach(cleanup);

function svgOf(container: HTMLElement): SVGSVGElement {
  return container.querySelector("svg")!;
}

describe("the digit counter's frame", () => {
  it("reserves four positions and right-aligns one digit inside them", () => {
    const frame = counterFrame(7);
    /* Four glyphs at five columns with one blank column between them. */
    expect(frame).toHaveLength(7);
    expect(frame[0]).toHaveLength(RESERVED_POSITIONS * 5 + (RESERVED_POSITIONS - 1));

    /* The 7 sits in the last slot, which starts at column 18. */
    const glyph = MATRIX_FRAMES.digits[7];
    for (let row = 0; row < 7; row += 1) {
      expect(frame[row].slice(18, 23)).toEqual(glyph[row]);
      /* And everything left of it is unlit — reserved, not filled. */
      expect(frame[row].slice(0, 18).some((cell) => cell > 0)).toBe(false);
    }
  });

  it("fills all four positions without changing the frame's width", () => {
    expect(counterFrame(1240)[0]).toHaveLength(counterFrame(7)[0].length);
    const frame = counterFrame(1240);
    for (const [slot, digit] of [1, 2, 4, 0].entries()) {
      const start = slot * 6;
      const glyph = MATRIX_FRAMES.digits[digit];
      for (let row = 0; row < 7; row += 1) {
        expect(frame[row].slice(start, start + 5)).toEqual(glyph[row]);
      }
    }
  });

  /* A blank column between glyphs is what keeps `11` from reading as one shape,
     so it is asserted rather than assumed. */
  it("keeps one blank column between two lit glyphs", () => {
    const frame = counterFrame(11);
    for (let row = 0; row < 7; row += 1) {
      expect(frame[row][17]).toBe(0);
    }
  });

  /* Rule 6 says no admitted counter runs past four digits. If one ever does, the
     box grows rather than the number losing its leading digit. */
  it("widens rather than dropping a digit it cannot hold", () => {
    const frame = counterFrame(12345);
    expect(frame[0]).toHaveLength(5 * 5 + 4);
    for (let row = 0; row < 7; row += 1) {
      expect(frame[row].slice(0, 5)).toEqual(MATRIX_FRAMES.digits[1][row]);
    }
  });

  it("lights nothing for a reading that does not exist, and is not zero", () => {
    expect(counterDigits(null)).toBeNull();
    expect(counterDigits(Number.NaN)).toBeNull();
    expect(counterDigits(Number.POSITIVE_INFINITY)).toBeNull();
    expect(counterDigits(0)).toBe("0");

    /* `null` lights no pixel at all; `0` lights the zero glyph. Two facts, two
       renderings — a dark display asserts nothing, a lit 0 asserts a count. */
    expect(counterFrame(null).every((row) => row.every((cell) => cell === 0))).toBe(true);
    expect(counterFrame(0).some((row) => row.some((cell) => cell > 0))).toBe(true);
  });

  it("rounds and never goes below zero, because there is no minus glyph", () => {
    expect(counterDigits(147.6)).toBe("148");
    expect(counterDigits(-3)).toBe("0");
  });
});

describe("the digit counter", () => {
  it("draws 7 and 1,240 in a box of exactly the same width", () => {
    const seven = render(<DigitCounter value={7} ariaLabel="7" />);
    const width = svgOf(seven.container).getAttribute("width");
    cleanup();

    const many = render(<DigitCounter value={1240} ariaLabel="1,240" />);
    expect(svgOf(many.container).getAttribute("width")).toBe(width);
    /* 23 columns at 4 px with a 2 px gap. Stated so a size change has to be
       deliberate rather than silent. */
    expect(width).toBe("136");
  });

  it("marks the no-reading state on the element, so the surface can dim it", () => {
    const { container } = render(<DigitCounter value={null} ariaLabel="No reading yet" />);
    expect(container.querySelector(".ws-counter")).toHaveAttribute("data-unlit");
    expect(container.querySelector(".matrix-pixel-active")).toBeNull();
  });

  it("says the number out loud, because the SVG is a picture of one", () => {
    const { container } = render(<DigitCounter value={148} ariaLabel="148 words per minute" />);
    expect(container.querySelector('[role="img"]')).toHaveAttribute(
      "aria-label",
      "148 words per minute",
    );
  });

  it("hands the natural width to the stylesheet so a narrow column can shrink it", () => {
    const { container } = render(<DigitCounter value={7} ariaLabel="7" />);
    const counter = container.querySelector(".ws-counter") as HTMLElement;
    expect(counter.style.getPropertyValue("--counter-w")).toBe("136px");
  });
});
