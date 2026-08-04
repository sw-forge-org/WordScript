import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeScreen } from "./Home";
import { HistoryScreen } from "./History";
import { GeneralScreen } from "./General";
import { HotkeysScreen } from "./Hotkeys";
import { DeliveryScreen } from "./Delivery";
import { PrivacyScreen } from "./Privacy";
import { DiagnosticsScreen } from "./Diagnostics";
import { AboutScreen } from "./About";
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

describe("General", () => {
  it("draws the input meter at rest — a display surface does not take a device", () => {
    const { container } = render(<GeneralScreen />);
    const wave = container.querySelector(".ws-wave-live")!;
    /* ADR 0058. `active` reaches for getUserMedia, so a gallery never passes
       it — and the instrument draws its idle rule instead of bars, which is
       the observable difference rather than a prop nobody can see. */
    expect(wave.querySelector(".border-dotted")).not.toBeNull();
    expect(container.querySelector(".ws-level")).not.toBeNull();
  });

  it("shows no Display or Anchor control it cannot act on", () => {
    render(<GeneralScreen />);
    /* The shipped tab shows both whether or not they do anything; in "remember
       last drag" they are inert and still look settable. */
    expect(screen.getByLabelText("Placement")).toHaveValue("Use preset display anchor");
    expect(screen.getByLabelText("Anchor")).toBeInTheDocument();
  });

  it("sends the profile-owned settings to the profile rather than duplicating them", () => {
    render(<GeneralScreen />);
    expect(screen.getByText(/belong to the profile, not to this machine/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/auto-stop/i)).not.toBeInTheDocument();
  });
});

describe("Hotkeys", () => {
  it("reports a refused shortcut rather than swallowing it", () => {
    render(<HotkeysScreen />);
    expect(screen.getByText("Taken by the desktop")).toBeInTheDocument();
    expect(screen.getAllByText("Registered")).toHaveLength(2);
  });

  it("gives Translate the seventh slot with no default binding", () => {
    render(<HotkeysScreen />);
    /* ADR 0041. A seventh mode is the first that arrives without a default, and
       it says so rather than being papered over with Alt+7. */
    const unset = screen.getAllByRole("button", { name: /not set/i });
    expect(unset).toHaveLength(1);
    expect(screen.getByText("Translate")).toBeInTheDocument();
  });
});

describe("Delivery & Insert", () => {
  it("draws two stages and a fallback, not one chain", () => {
    const { container } = render(<DeliveryScreen />);
    const groups = container.querySelectorAll(".ws-grp");
    expect(groups).toHaveLength(3);
    expect(screen.getByText("1 · Put it on the clipboard")).toBeInTheDocument();
    expect(screen.getByText("2 · Make the target take it")).toBeInTheDocument();
    expect(screen.getByText("When none of it works")).toBeInTheDocument();
  });

  it("names all eight drivers, and says wtype/ydotool are excluded by design", () => {
    render(<DeliveryScreen />);
    for (const driver of ["wl-copy", "arboard clipboard", "xdotool type", "xdotool", "enigo", "wtype · ydotool"]) {
      expect(screen.getByText(driver)).toBeInTheDocument();
    }
    expect(screen.getByText(/Excluded by design, not missing/)).toBeInTheDocument();
  });

  it("does not tell the clipboard incident a third time", () => {
    render(<DeliveryScreen />);
    /* §11.51: the event is a row on Home and a record in History. A settings
       screen offering the button that clears it is the same fault one screen
       over. */
    expect(screen.queryByText(/Kundenanfrage/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Home" })).toBeInTheDocument();
  });
});

describe("Privacy & Data", () => {
  it("answers whether anything leaves with a fact, not with a door", () => {
    render(<PrivacyScreen />);
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText(/There is no WordScript account/)).toBeInTheDocument();
  });

  it("heads the destructive pair with its consequence rather than a neighbourhood", () => {
    const { container } = render(<PrivacyScreen />);
    expect(
      screen.getByRole("heading", { name: "Delete and reset" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll(".ws-row[data-danger]")).toHaveLength(2);
  });
});

describe("Diagnostics", () => {
  it("opens on Checks, with the sub-tab row inside the masthead", () => {
    const { container } = render(<DiagnosticsScreen />);
    const top = container.querySelector(".ws-view-top")!;
    expect(top.querySelector(".ws-subtabs")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Runtime snapshot" })).toBeInTheDocument();
  });

  it("shows raw beside transformed, and offers no commit action for it", () => {
    render(<DiagnosticsScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByText("Raw")).toBeInTheDocument();
    expect(screen.getByText("Cleanup")).toBeInTheDocument();
    /* §11.15: a commit control here would commit a session nobody dictated.
       That is half the reason `Live preview & commit` is withdrawn. */
    expect(screen.queryByRole("button", { name: /commit/i })).not.toBeInTheDocument();
  });

  it("colours the log by level and nothing else", () => {
    const { container } = render(<DiagnosticsScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Logs" }));
    const levels = [...container.querySelectorAll(".ws-lv")].map((el) => el.getAttribute("data-l"));
    expect(new Set(levels)).toEqual(new Set(["INFO", "WARN", "ERROR"]));
  });
});

describe("About & Updates", () => {
  it("does not read as though installers or in-app updates already work", () => {
    render(<AboutScreen />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText(/There is no installer yet/)).toBeInTheDocument();
    expect(screen.getByText(/the cross-platform release path is still being assembled/)).toBeInTheDocument();
  });

  it("separates not-yet from never", () => {
    render(<AboutScreen />);
    /* "not built yet" and "not going to be built" are not the same answer, and
       only the second belongs in a list read to decide whether to keep
       waiting. */
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("carries no stat tile — a version string is not a metric", () => {
    const { container } = render(<AboutScreen />);
    expect(container.querySelector(".ws-stats")).toBeNull();
    expect(screen.getByText("0.2.2-alpha")).toBeInTheDocument();
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
