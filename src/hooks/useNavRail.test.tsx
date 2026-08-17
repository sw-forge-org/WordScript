import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNavRail } from "./useNavRail";

/**
 * THE HALF OF THE RAIL jsdom CANNOT HAVE AN OPINION ABOUT — ADR 0198.
 *
 * `WorkspaceWindow.test.tsx` holds the seam: which state the sidebar opens in,
 * that the toggle changes it, that the change reaches the config. Every one of
 * those cases runs in a WIDE window, because jsdom's `matchMedia` answers
 * `matches: false` to everything — and the defect this file is about lived
 * entirely on the narrow side, where the window rails on its own. It shipped
 * with a green suite for exactly that reason, so the media query is stubbed
 * here rather than left to the environment.
 *
 * THE HARNESS IS THE WINDOW'S OWN WIRING, not a hook called in isolation: the
 * preference is a config field the toggle writes and reads back one render
 * later. That round trip IS the defect — a hook exercised with a frozen
 * `preference` cannot reproduce it at all.
 */

function stubMedia(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function Harness({ stored }: { stored: boolean }) {
  const [preference, setPreference] = useState<boolean | undefined>(stored);
  const persist = useCallback((next: boolean) => setPreference(next), []);
  const { railed, toggle } = useNavRail(preference, persist);
  return (
    <button type="button" onClick={toggle} data-rail={railed ? "" : undefined}>
      toggle
    </button>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useNavRail · the toggle is the authority between crossings", () => {
  it("expands on one press in a wide window", async () => {
    stubMedia(false);
    const user = userEvent.setup();
    render(<Harness stored={true} />);
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("data-rail");

    await user.click(toggle);

    expect(toggle).not.toHaveAttribute("data-rail");
  });

  /* THE CASE THAT WAS TWO PRESSES. The preference came back as a change, the
     adoption effect re-derived from it, and `windowIsNarrow()` railed the
     column again inside the same press. */
  it("expands on one press in a narrow window too", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    render(<Harness stored={true} />);
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("data-rail");

    await user.click(toggle);

    expect(toggle).not.toHaveAttribute("data-rail");
  });

  /* And the direction that happened to agree with the derivation still agrees:
     the guard is about whose statement wins, not about which way it points. */
  it("rails on one press in a narrow window", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    render(<Harness stored={false} />);
    const toggle = screen.getByRole("button");
    /* Narrow already rails a window whose stored choice is the wide column —
       that is the breakpoint doing its job, and it is what the user is pressing
       against. */
    expect(toggle).toHaveAttribute("data-rail");

    await user.click(toggle);
    expect(toggle).not.toHaveAttribute("data-rail");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("data-rail");
  });
});

/**
 * THE WRITE DOES NOT RIDE THE SAME FRAME AS THE COLUMN — ADR 0202.
 *
 * Measured in the shipped engine on the Profiles view: the state change alone
 * ran every frame, the config write alone ran every frame, and a press that did
 * both dropped to fourteen frames in half a second with two gaps of ~145 ms.
 * Separating them put the press back at thirty frames with a worst gap of
 * 28 ms — the same figure the view with nothing in it gets.
 *
 * A test cannot hold frame timings. What it can hold is the seam that produced
 * them: the surface answers now, the config is told afterwards, and nothing is
 * lost if the window closes in between.
 */
describe("useNavRail · the preference is written after the column has moved", () => {
  it("shows the new state at once and writes it later", () => {
    vi.useFakeTimers();
    try {
      stubMedia(false);
      const persisted: boolean[] = [];
      function Wired() {
        const { railed, toggle } = useNavRail(false, (next) => persisted.push(next));
        return (
          <button type="button" onClick={toggle} data-rail={railed ? "" : undefined}>
            toggle
          </button>
        );
      }
      render(<Wired />);
      const toggle = screen.getByRole("button");

      act(() => toggle.click());

      // The column is already there …
      expect(toggle).toHaveAttribute("data-rail");
      // … and the runtime has not been touched yet.
      expect(persisted).toEqual([]);

      act(() => void vi.advanceTimersByTime(300));
      expect(persisted).toEqual([true]);
    } finally {
      vi.useRealTimers();
    }
  });

  /* A press and a close inside the same 240 ms is still a choice. */
  it("flushes a pending write when the window goes", () => {
    vi.useFakeTimers();
    try {
      stubMedia(false);
      const persisted: boolean[] = [];
      function Wired() {
        const { railed, toggle } = useNavRail(false, (next) => persisted.push(next));
        return (
          <button type="button" onClick={toggle} data-rail={railed ? "" : undefined}>
            toggle
          </button>
        );
      }
      const view = render(<Wired />);
      act(() => screen.getByRole("button").click());
      expect(persisted).toEqual([]);

      view.unmount();

      expect(persisted).toEqual([true]);
    } finally {
      vi.useRealTimers();
    }
  });
});
