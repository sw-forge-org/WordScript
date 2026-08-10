import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverlayPill, type OverlayPillState } from "./OverlayPill";

/**
 * The target-language chip, which is the one thing in the pill that appears for
 * a single mode.
 *
 * Translate is the one mode whose name does not say what will happen: `Cleanup`
 * is the whole instruction and `Translate` is half of it. What is held here is
 * that the other half appears only where it is true, that it is its own press
 * rather than a second meaning on the mode chip, and that it is a statement
 * rather than a control on the one surface where changing it would be a lie.
 *
 * The pill's width budget is not testable in jsdom and is not tested here — the
 * 480px window and the clipped rounded ends are a native-host measurement, and
 * `overlay-pill.css` says so at length.
 */

afterEach(cleanup);

function recording(overrides: Partial<Extract<OverlayPillState, { kind: "recording" }>> = {}) {
  return {
    kind: "recording" as const,
    mode: "translate" as const,
    muted: false,
    paused: false,
    level: 0.2,
    elapsedSec: 3,
    ...overrides,
  };
}

describe("the overlay's target-language chip", () => {
  it("states the language beside the mode, in two letters", () => {
    render(<OverlayPill state={recording({ targetLanguage: "de" })} />);

    expect(screen.getByRole("button", { name: /Translating into DE/ })).toHaveTextContent("DE");
    expect(screen.getByRole("button", { name: /Mode Translate/ })).toBeInTheDocument();
  });

  it("appears for no other mode", () => {
    render(<OverlayPill state={recording({ mode: "cleanup", targetLanguage: "de" })} />);

    expect(screen.queryByRole("button", { name: /Translating into/ })).not.toBeInTheDocument();
  });

  /* Without one there is nothing true to say, so nothing is said. A chip
     defaulting to EN would state a target the runtime never answered with. */
  it("says nothing when the runtime has not answered with a language", () => {
    render(<OverlayPill state={recording()} />);

    expect(screen.queryByRole("button", { name: /Translating into/ })).not.toBeInTheDocument();
  });

  /* Two chips, two cycles, one each. One control with two meanings depending on
     where in it you pressed is the ambiguity this split exists against. */
  it("cycles the language on its own press and leaves the mode alone", async () => {
    const onCycleMode = vi.fn();
    const onCycleLanguage = vi.fn();
    render(
      <OverlayPill state={recording({ targetLanguage: "en", onCycleMode, onCycleLanguage })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Translating into EN/ }));
    expect(onCycleLanguage).toHaveBeenCalledTimes(1);
    expect(onCycleMode).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Mode Translate/ }));
    expect(onCycleMode).toHaveBeenCalledTimes(1);
    expect(onCycleLanguage).toHaveBeenCalledTimes(1);
  });

  /* While the transform runs, the language is already spent. A press would
     change the next session while the chip states this one, so the chip is
     drawn and does nothing — the `onCycleLanguage` the window withholds. */
  it("is a statement rather than a control while the transform runs", async () => {
    const onCycleLanguage = vi.fn();
    render(
      <OverlayPill
        state={{ kind: "processing", mode: "translate", elapsedSec: 2, targetLanguage: "fr" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Translating into FR/ }));
    expect(onCycleLanguage).not.toHaveBeenCalled();
  });
});
