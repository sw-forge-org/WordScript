import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeScreen } from "./Home";
import { HistoryScreen } from "./History";
import { ALL_SCREENS, SCREEN_GROUPS } from "./registry";
import { HISTORY, RECENT } from "./data";

/**
 * WHAT A GALLERY SCREEN'S TEST IS FOR, and it is not visual fidelity.
 *
 * Fidelity is settled by measuring: the computed-style diff against the running
 * prototype, property by property, which is the check Leg 2a describes and the
 * only one that can catch a 2 px inset. A unit test cannot see a pixel — jsdom
 * applies no stylesheet — so asserting layout here would assert nothing.
 *
 * What it CAN hold is everything the diff would silently accept because both
 * sides changed together: that the sample data is the prototype's, that the
 * copy is the prototype's, that a control the design decided to disable is
 * still disabled, and that the ledger cannot claim a screen it does not mount.
 * Under ADR 0054 there is no old surface to fall back on, which makes that
 * obligation stricter than usual rather than looser.
 */

afterEach(cleanup);

describe("Home", () => {
  it("opens on the shortcut rather than on a button that cannot record", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("Super")).toBeInTheDocument();
    expect(screen.getByText("Hold in any app to dictate")).toBeInTheDocument();
    /* A Capture button on this screen would be the lie §the hero's note
       records: dictation starts with the global hotkey, in whatever app has
       focus, and this window is usually not that app. */
    expect(screen.queryByRole("button", { name: /^capture$/i })).not.toBeInTheDocument();
  });

  it("draws the decision inbox with the cost column, and tints only the urgent row", () => {
    const { container } = render(<HomeScreen />);
    const owed = container.querySelectorAll(".ws-owed");
    expect(owed).toHaveLength(3);
    expect(container.querySelectorAll(".ws-owed[data-urgent]")).toHaveLength(1);
    /* The third column is the entire difference between a decision inbox and a
       to-do list: what happens if you do nothing. */
    for (const row of owed) expect(row.querySelector(".ws-owed-cost")).not.toBeNull();
    expect(
      screen.getByText("The run stays blocked and stops in 24 min without an answer."),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing. It stays an open question on both notes.")).toBeInTheDocument();
  });

  it("lists the five recent records, and no coloured edge rule anywhere", () => {
    const { container } = render(<HomeScreen />);
    expect(container.querySelectorAll(".ws-list-item")).toHaveLength(RECENT.length);
    expect(screen.getByText(RECENT[0].text)).toBeInTheDocument();
    for (const el of container.querySelectorAll("[class*='edge-bar'], [class*='accent-bar']")) {
      expect(el).toBeUndefined();
    }
  });
});

describe("History", () => {
  it("filters on a toolbar, with two controls rather than the shipped three", () => {
    const { container } = render(<HistoryScreen />);
    const toolbar = container.querySelector(".ws-toolbar")!;
    expect(within(toolbar as HTMLElement).getByPlaceholderText("Search transcripts…")).toBeInTheDocument();
    expect(within(toolbar as HTMLElement).getByLabelText("Status")).toBeInTheDocument();
    /* The "Errors only" toggle is gone: the select already has Failed, so two
       controls narrowed the list to the same set and could contradict. */
    expect(within(toolbar as HTMLElement).queryByRole("switch")).not.toBeInTheDocument();
    /* A count is the result of a list, not a label on it. */
    expect(screen.getByRole("heading", { name: "7 transcriptions" })).toBeInTheDocument();
  });

  it("cannot retry a record whose audio was swept, and says so rather than hiding it", () => {
    render(<HistoryScreen />);
    const swept = screen.getByRole("button", { name: "Retry — audio no longer kept" });
    expect(swept).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(HISTORY.length - 1);
  });

  it("carries the pairing with Privacy & Data as a note, not as a second rule", () => {
    render(<HistoryScreen />);
    expect(screen.getByText(/Kept 90 days, capped at 500 entries/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change the rule in Privacy & Data" })).toBeInTheDocument();
  });
});

describe("the registry", () => {
  it("carries the prototype's 25 screens in the prototype's four groups", () => {
    expect(SCREEN_GROUPS.map((g) => g.group)).toEqual([
      "System",
      "Workspace",
      "Settings",
      "Previews",
    ]);
    expect(ALL_SCREENS).toHaveLength(25);
  });

  it("has no duplicate id, so the picker cannot mount the wrong screen", () => {
    const ids = ALL_SCREENS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks the withdrawn screen as withdrawn rather than as a target", () => {
    const withdrawn = ALL_SCREENS.filter((s) => s.withdrawn);
    expect(withdrawn.map((s) => s.id)).toEqual(["commit"]);
  });
});
