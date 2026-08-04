import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Foundations } from "./Foundations";

/**
 * A STORED CONTRAST FIGURE IS A LIE WAITING TO HAPPEN (ADR 0056).
 *
 * The prototype hardcodes its figures and prints the DARK ladder's numbers on
 * both sides of its theme switch, which is how the light `--fg-muted` sat at
 * 4.48:1 — under AA — for a whole pass with nobody seeing it. Foundations
 * computes them from the live tokens instead, and this is the test that keeps
 * it computing them.
 *
 * jsdom applies no stylesheet, so the tokens are written inline onto
 * `<html>` here. That is the point of the arrangement rather than a workaround:
 * the figures below are a function of those five values and of nothing else, so
 * a page that started printing literals again would fail on the very first
 * assertion.
 */

const DARK = {
  "--bg-sidebar": "#141416",
  "--bg-inset": "#161617",
  "--bg-base": "#1c1c1e",
  "--bg-surface": "#2e2e31",
  "--bg-elevated": "#3a3a3e",
  "--fg": "#f2efe9",
  "--fg-dim": "#c2bfb8",
  "--fg-muted": "#9b9892",
  "--accent": "#ff9c2b",
  "--success": "#81d6ae",
  "--danger": "#ff7a6b",
  "--r-window": "10px",
  "--r-card": "8px",
  "--r-control": "6px",
  "--r-small": "4px",
};

/* ADR 0056: #7d766d measured 4.48:1 on the white card and missed AA by two
   hundredths; #7a736a is 4.68:1, which puts the light side at the dark side's
   4.71:1 rather than at an arbitrary darker value. */
const LIGHT = {
  ...DARK,
  "--bg-base": "#f5f3f0",
  "--bg-surface": "#ffffff",
  "--bg-elevated": "#f2efeb",
  "--fg-muted": "#7a736a",
};

function applyTokens(tokens: Record<string, string>) {
  for (const [name, value] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(name, value);
  }
}

beforeEach(() => {
  document.documentElement.removeAttribute("style");
});

afterEach(cleanup);

describe("Foundations", () => {
  /* The Design System screen's own sections, in the prototype's order, up to
     and including Radius — plus Frost, which §2.4 of the relay puts at the
     foot of this page. */
  it("carries the sections of SCREENS.ds, in order", () => {
    applyTokens(DARK);
    render(<Foundations resolved="dark" />);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);

    expect(headings).toEqual([
      "Surfaces",
      "Text contrast",
      "Type",
      "Spacing",
      "Elevation",
      "Rules this pass added",
      "Radius",
      "Frost",
    ]);
  });

  it("measures the dark ladder rather than printing it", () => {
    applyTokens(DARK);
    render(<Foundations resolved="dark" />);

    /* §5.1's ladder: 6.4 / 7.3 / 10.3 / 19.0 / 24.6. */
    for (const lstar of ["L* 6.4", "L* 7.3", "L* 10.3", "L* 19.0", "L* 24.6"]) {
      expect(screen.getByText(lstar)).toBeInTheDocument();
    }
    /* And the four contrasts on the card. */
    for (const ratio of ["11.80:1 ✓", "7.37:1 ✓", "4.71:1 ✓", "6.47:1 ✓"]) {
      expect(screen.getByText(ratio)).toBeInTheDocument();
    }
  });

  it("re-measures on the light ladder rather than re-labelling", () => {
    applyTokens(LIGHT);
    render(<Foundations resolved="light" />);

    /* The card is white and comes forward; the window recedes under it. */
    expect(screen.getByText("L* 100.0")).toBeInTheDocument();
    /* ADR 0056's value, measured on this page for the first time. */
    expect(screen.getByText("4.68:1 ✓")).toBeInTheDocument();
    /* And the dark ladder's numbers are NOT on screen — which is the whole
       failure the ADR records. */
    expect(screen.queryByText("4.71:1 ✓")).not.toBeInTheDocument();
    expect(screen.queryByText("11.80:1 ✓")).not.toBeInTheDocument();
  });

  /* A token below AA is marked as failing, not quietly printed. If the light
     `--fg-muted` were ever reverted to #7d766d this is what would say so. */
  it("marks a foreground under AA as a failure", () => {
    applyTokens({ ...LIGHT, "--fg-muted": "#7d766d" });
    render(<Foundations resolved="light" />);

    expect(screen.getByText("4.48:1 ✗")).toBeInTheDocument();
  });

  it("reads the radius ladder off the tokens too", () => {
    applyTokens(DARK);
    render(<Foundations resolved="dark" />);

    expect(screen.getByText("10px")).toBeInTheDocument();
    expect(screen.getByText("8px")).toBeInTheDocument();
    expect(screen.getByText("6px")).toBeInTheDocument();
    expect(screen.getByText("4px")).toBeInTheDocument();
    expect(screen.getByText("999px / 50%")).toBeInTheDocument();
    /* The overlay is exempt and stays exempt. */
    expect(screen.getByText("999px · 14px")).toBeInTheDocument();
  });

  /* The type scale is the prototype's six steps plus `--t-note`, which
     `demo.css` declares and reads 28 times while the prototype's own Design
     System screen leaves it out of the table. */
  it("shows every step of the scale the tokens declare", () => {
    applyTokens(DARK);
    render(<Foundations resolved="dark" />);

    for (const token of [
      "--t-hero",
      "--t-title",
      "--t-lead",
      "--t-body",
      "--t-note",
      "--t-label",
      "--t-micro",
    ]) {
      expect(screen.getByText(token)).toBeInTheDocument();
    }
  });
});
