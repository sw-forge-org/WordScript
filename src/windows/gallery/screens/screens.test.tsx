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
import { ProfilesScreen } from "./Profiles";
import { CommitScreen } from "./Commit";
import { IntegrationsScreen } from "./Integrations";
import { NoteSettingsScreen } from "./NoteSettings";
import { ModelsScreen } from "./Models";
import { OnboardingScreen } from "./Onboarding";
import { AgentsScreen } from "./Agents";
import { ContextActionsScreen, ContextIntakeScreen, ContextScreen } from "./Context";
import { MeetingScreen } from "./Meeting";
import { HandoffScreen } from "./Handoff";
import { SubtitlesScreen } from "./Subtitles";
import { TranslateScreen } from "./Translate";
import { ConversationScreen } from "./Conversation";
import { AgentOverlayScreen } from "./AgentOverlay";
import { ALL_SCREENS, SCREEN_GROUPS } from "./registry";
import { HISTORY, LANES, PROVIDERS, RECENT } from "./data";
import { ACTIONS, CTX } from "./contextData";

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

describe("Profiles", () => {
  it("is a pane — one surface, not two cards side by side", () => {
    const { container } = render(<ProfilesScreen />);
    expect(container.querySelector(".ws-pane")).not.toBeNull();
    expect(container.querySelector(".ws-pane-list")).not.toBeNull();
    expect(container.querySelector(".ws-pane-detail")).not.toBeNull();
    /* The list column is not a card. Two cards side by side read as two
       unrelated boxes, which is how the first build of this screen failed. */
    expect(container.querySelector(".ws-pane-list .ws-card")).toBeNull();
  });

  it("carries the health flag in the detail header, visible from all five tabs", () => {
    const { container } = render(<ProfilesScreen />);
    const head = container.querySelector(".ws-pane-detail-head")!;
    expect(head.querySelector(".ws-flag")).not.toBeNull();
    /* It was a card on Defaults, which made a property of the profile look like
       a property of one tab. */
    expect(container.querySelector(".ws-card .ws-flag")).toBeNull();
  });

  it("splits Defaults into two decisions rather than six equal rows", () => {
    render(<ProfilesScreen />);
    expect(screen.getByRole("heading", { name: "How this profile writes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "When a recording stops" })).toBeInTheDocument();
    /* The ceiling is the runtime's number — stated, not offered. */
    expect(screen.getByText("13:39")).toBeInTheDocument();
  });

  it("draws the four lists as a legend, which sets nothing", () => {
    const { container } = render(<ProfilesScreen />);
    const legend = container.querySelector(".ws-legend")!;
    expect(legend.querySelectorAll(".ws-legend-row")).toHaveLength(4);
    expect(legend.querySelector("input, select, button")).toBeNull();
  });

  it("keeps a word list as chips rather than as rows with hover actions", () => {
    const { container } = render(<ProfilesScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Words" }));
    /* Rows with hover actions imply a record with fields; a term has none. */
    expect(container.querySelectorAll(".ws-chip-x")).toHaveLength(8);
    expect(container.querySelector(".ws-list-item")).toBeNull();
  });
});

describe("Live preview & commit — the withdrawn screen", () => {
  it("carries the withdrawn banner, not the preview one", () => {
    const { container } = render(<CommitScreen />);
    const banner = container.querySelector(".ws-banner")!;
    expect(banner.getAttribute("data-tone")).toBe("withdrawn");
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.getByText(/do not build Phase 3 from this screen/)).toBeInTheDocument();
  });

  it("argues in rows, not in a check list", () => {
    const { container } = render(<CommitScreen />);
    /* A check reports a probe the runtime ran. A checkmark next to a paragraph
       of argument claims something was measured that was not — so the three
       reasons are rows. The one check list on the screen is inside the
       withdrawn exhibit, where it names runtime rules. */
    const reasons = container.querySelector(".ws-card")!;
    expect(reasons.querySelector(".ws-check-list")).toBeNull();
    expect(screen.getByRole("heading", { name: "Why it is withdrawn" })).toBeInTheDocument();
  });

  it("holds the proposed layout below a rule, as an exhibit", () => {
    const { container } = render(<CommitScreen />);
    const exhibit = container.querySelector(".ws-withdrawn-body")!;
    expect(exhibit).not.toBeNull();
    /* The proposed action row is inside the exhibit; the only Commit above it
       is the one drawn INSIDE the 440 × 60 overlay, which is what ships today
       rather than what was proposed. */
    expect(exhibit.querySelector(".ws-rowflex")).not.toBeNull();
    const commits = screen.getAllByRole("button", { name: "Commit" });
    expect(commits).toHaveLength(2);
    const outside = commits.filter((b) => !exhibit.contains(b));
    expect(outside).toHaveLength(1);
    expect(outside[0].closest(".ws-scale-box")).not.toBeNull();
  });

  it("draws the real window size rather than asserting it", () => {
    const { container } = render(<CommitScreen />);
    expect(container.querySelector(".ws-scale-box")).not.toBeNull();
    expect(screen.getByText("440 × 60")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
  });
});

describe("Integrations", () => {
  it("sorts every entry with one question: does it write anywhere?", () => {
    const { container } = render(<IntegrationsScreen />);
    const rows = [...container.querySelectorAll(".ws-klass-row")];
    expect(rows.map((r) => r.getAttribute("data-k"))).toEqual(["intake", "bridge", "reach"]);
    /* Only `reach` writes, and only `reach` takes the accent. */
    expect(screen.getByText("Writes something, somewhere, for you.")).toBeInTheDocument();
  });

  it("draws a connection as a block that grows its accounts, not as rows", () => {
    const { container } = render(<IntegrationsScreen />);
    const connected = container.querySelector(".ws-conn[data-on]")!;
    expect(connected.querySelectorAll(".ws-conn-account")).toHaveLength(2);
    /* Unconnected providers carry one sentence and one button, and no account
       list at all. */
    expect(container.querySelectorAll(".ws-conn")).toHaveLength(3);
    expect(container.querySelectorAll(".ws-conn-accounts")).toHaveLength(1);
  });

  it("puts the two bridge surfaces side by side, with the difference in one place", () => {
    const { container } = render(<IntegrationsScreen />);
    const panels = container.querySelectorAll(".ws-srv-row");
    expect(panels).toHaveLength(2);
    expect(screen.getByText("can speak to you")).toBeInTheDocument();
    expect(screen.getByText("cannot speak to you")).toBeInTheDocument();
  });

  it("offers no way to add a connector the desk owns", () => {
    render(<IntegrationsScreen />);
    /* A connector configured in two places is a connector that disagrees with
       itself. */
    expect(screen.getByText(/No way to add one here/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Agents" })).toBeInTheDocument();
  });
});

describe("Notes & Meetings", () => {
  it("keeps what a meeting RECORDS and sends the model elsewhere", () => {
    render(<NoteSettingsScreen />);
    /* The meeting speech engine stood on this screen until 2026-08-03 and
       repeated Speech-to-Text's rows. It is a model setting, so it is a row in
       AI Models; what stays is the capture question. */
    expect(screen.getByText("Record system audio")).toBeInTheDocument();
    expect(screen.getByText("Echo cancellation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI Models/ })).toBeInTheDocument();
  });

  it("disables the three capture switches the runtime cannot yet honour", () => {
    render(<NoteSettingsScreen />);
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(3);
    for (const s of switches) expect(s).toBeDisabled();
  });

  it("marks the undecided retention as an open decision rather than picking one", () => {
    render(<NoteSettingsScreen />);
    expect(screen.getByText("Open decision")).toBeInTheDocument();
    expect(screen.getByLabelText("Keep the audio")).toHaveValue("Until the note is saved");
  });
});

describe("AI Models", () => {
  it("states the modes that run no model instead of leaving them out", () => {
    render(<ModelsScreen />);
    /* An absence answers nothing: "why can I not set a model for Verbatim" is
       answered by seeing it stated. */
    expect(screen.getByText("Verbatim")).toBeInTheDocument();
    expect(screen.getByText("No model")).toBeInTheDocument();
    expect(screen.getByText("Routes with Cleanup's model")).toBeInTheDocument();
    expect(screen.getByText("delivery axis")).toBeInTheDocument();
  });

  it("marks an overridden job and names where it went, and leaves the rest default", () => {
    const { container } = render(<ModelsScreen />);
    const overridden = container.querySelectorAll(".ws-jobmodel[data-override]");
    /* Cloud overrides exactly three of eight: upload, translate and the
       assistant. Every other job says `default`, which is the one fact the list
       exists for. */
    expect(overridden).toHaveLength(3);
    /* Eight jobs carry the suffix. The desk's voice is `mark: null` — off the
       connection's axis entirely — so it gets neither a mark nor `default`,
       which would be claiming it follows something. */
    expect(container.querySelectorAll(".ws-job-prov")).toHaveLength(8);
  });

  it("changes what a job runs when the lane changes — the one segment that governs", () => {
    const { container } = render(<ModelsScreen />);
    /* Read the badge, not the page: the same string is also an <option> in the
       job's own Model select. */
    const badge = () => container.querySelector(".ws-jobmodel .ws-jobmodel-name")!.textContent;
    expect(badge()).toBe(LANES.Cloud.jobs.dictation.model);
    fireEvent.click(screen.getByRole("button", { name: "Local" }));
    expect(badge()).toBe(LANES.Local.jobs.dictation.model);
  });

  it("says a job is not on this lane rather than offering an empty picker", () => {
    render(<ModelsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Self-hosted" }));
    expect(screen.getAllByText("Not on this lane")).toHaveLength(3);
    expect(screen.getByText(LANES["Self-hosted"].jobs.dictation.none!)).toBeInTheDocument();
  });

  it("installs a local model in the app rather than naming a command", () => {
    render(<ModelsScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "On this machine" }));
    expect(screen.getAllByRole("button", { name: "Download" }).length).toBeGreaterThan(0);
    /* The size is stated BEFORE the download, because the size is the fact that
       decides whether you want it. */
    expect(screen.getByText(/1.6 GB · multilingual/)).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
  });
});

describe("Onboarding", () => {
  it("is walkable, and the rail only reaches backwards", () => {
    const { container } = render(<OnboardingScreen />);
    expect(screen.getByText("Step 1 of 7")).toBeInTheDocument();
    /* A step you cannot reach is a span, not a button: claiming you can jump to
       a step whose prerequisites are unmet is a lie in the other direction. */
    expect(container.querySelectorAll("button.ws-obrail-step")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Step 2 of 7")).toBeInTheDocument();
    expect(container.querySelectorAll("button.ws-obrail-step")).toHaveLength(2);
  });

  it("renders the settings screen's own provider picker, not a simplified twin", () => {
    const { container } = render(<OnboardingScreen />);
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const chips = container.querySelectorAll(".ws-provchip");
    /* Seven cloud providers plus the Custom door — the same row AI Models
       draws, from the same list. */
    expect(chips).toHaveLength(PROVIDERS.filter((p) => p.lane === "Cloud").length + 1);
  });

  it("gives the local lane real download controls rather than a select", () => {
    render(<OnboardingScreen />);
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Local" }));
    expect(screen.getByRole("heading", { name: "Pick one speech model" })).toBeInTheDocument();
    expect(screen.getByText("46%")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Download" }).length).toBeGreaterThan(0);
  });

  it("states what it deliberately left out, on the last step and not the first", () => {
    render(<OnboardingScreen />);
    expect(screen.queryByText("Deliberately not in this flow")).not.toBeInTheDocument();
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Continue|It worked/ }));
    }
    expect(screen.getByRole("heading", { name: "Deliberately not in this flow" })).toBeInTheDocument();
  });
});

describe("Agents", () => {
  it("reads the desk's connectors and offers no way to write them", () => {
    const { container } = render(<AgentsScreen />);
    expect(container.querySelectorAll(".ws-mcp-row")).toHaveLength(5);
    /* ADR 0046: a second writer would put WordScript in the business of
       maintaining connectors. */
    expect(screen.queryByRole("button", { name: /add server/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open terminal" })).toHaveLength(2);
  });

  it("marks the one server WordScript issued, and only that one", () => {
    const { container } = render(<AgentsScreen />);
    expect(container.querySelectorAll('.ws-mcp-row[data-owner="ours"]')).toHaveLength(1);
    expect(screen.getByText("loopback")).toBeInTheDocument();
  });

  it("reports the desk's own model as read-only rather than offering to set it", () => {
    render(<AgentsScreen />);
    expect(screen.getByText("claude-opus-5")).toBeInTheDocument();
    expect(screen.getByText("read-only")).toBeInTheDocument();
    expect(screen.getByText("Needs a restart")).toBeInTheDocument();
    expect(screen.queryByLabelText(/desk model/i)).not.toBeInTheDocument();
  });

  it("draws all four orb states at rest — no generator, no device", () => {
    const { container } = render(<AgentsScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Voice" }));
    const orbs = container.querySelectorAll(".ws-orb");
    expect(orbs).toHaveLength(4);
    /* ADR 0058. The prototype drives two of these from a synthetic envelope
       because it has no voice to follow; here `drive` removes the transition
       and nothing else, and every orb sits at level 0. */
    for (const orb of orbs) {
      expect((orb as HTMLElement).style.getPropertyValue("--orb-level")).toBe("0.00");
    }
  });
});

describe("Context", () => {
  it("lists one object type with its state on the row, and no second queue", () => {
    const { container } = render(<ContextScreen />);
    expect(container.querySelectorAll(".ws-pane-row")).toHaveLength(CTX.length);
    /* A file being transcribed IS a context object without a transcript, so it
       is a row in this list rather than an entry in a queue of its own. */
    expect(screen.getByText("Transcribing")).toBeInTheDocument();
    expect(screen.getByText("Recording")).toBeInTheDocument();
    expect(screen.getByText("Fetching")).toBeInTheDocument();
  });

  it("opens on Summary and carries four tabs, not the seven-tab draft", () => {
    const { container } = render(<ContextScreen />);
    const tabs = container.querySelectorAll(".ws-note-tabs button");
    expect([...tabs].map((t) => t.textContent)).toEqual([
      "Transcript",
      "Notes",
      "Summary",
      "Linked",
    ]);
    /* Decisions and Tasks are SECTIONS of the summary, not tabs: a tab is a
       view of the whole object, not a heading inside one of them. */
    expect(screen.getByRole("heading", { level: 4, name: "Decisions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Open questions" })).toBeInTheDocument();
  });

  it("puts the speakers on the transcript with how sure it is of each name", () => {
    const { container } = render(<ContextScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
    const chips = container.querySelectorAll(".ws-who-chip");
    expect(chips).toHaveLength(3);
    /* ADR 0047: "Sarah" that was guessed and "Sarah" that you confirmed behave
       differently, so the chip has to say which it is. `locked` is the one the
       end-of-meeting re-clustering may not overwrite. */
    expect([...chips].map((c) => c.getAttribute("data-status"))).toEqual([
      "locked",
      "suggested",
      "provisional",
    ]);
    expect(screen.getByText("from your microphone")).toBeInTheDocument();
    expect(screen.getByText("voice cluster, unnamed")).toBeInTheDocument();
  });

  it("draws Linked as a list of groups and never as a graph", () => {
    const { container } = render(<ContextScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Linked" }));
    expect(container.querySelectorAll(".ws-linkgrp")).toHaveLength(4);
    expect(screen.getByText("Computed on this machine. Nothing was fetched to build this.")).toBeInTheDocument();
    /* Mail is the obvious fifth group and is on the other side of the effect
       line (ADR 0046) — the desk reaches a mailbox, WordScript does not. */
    expect(screen.queryByText("Mail")).not.toBeInTheDocument();
  });

  it("opens the Ask window with an answer that names the rows it read", () => {
    const { container } = render(<ContextScreen />);
    expect(container.querySelector(".ws-chatwin")).not.toBeNull();
    const sources = container.querySelector(".ws-sources")!;
    /* An answer about your own record names the rows it was read from. Scoped
       to the source list, because "Product Sync" is also the object's own name
       in the rail and in the detail head. */
    expect(within(sources as HTMLElement).getByText("Product Sync")).toBeInTheDocument();
    expect(within(sources as HTMLElement).getByText("Weekly standup")).toBeInTheDocument();
  });

  it("draws the floating bar's mic at rest — a gallery screen opens no device", () => {
    const { container } = render(<ContextScreen />);
    const mic = container.querySelector(".ws-floatbar .ws-mic-btn");
    expect(mic).not.toBeNull();
    expect(mic).not.toHaveAttribute("data-live");
  });

  it("draws the menu closed here, because two overlays at once is a state nobody is in", () => {
    const { container } = render(<ContextScreen />);
    expect(container.querySelector(".ws-menu")).toBeNull();
  });
});

describe("Context · actions", () => {
  it("keeps both kinds in one list with a rule between them", () => {
    const { container } = render(<ContextActionsScreen />);
    expect(container.querySelectorAll(".ws-action-row")).toHaveLength(ACTIONS.length);
    /* §11.43: the user's intent is one intent, so splitting the list would ask
       them to classify their own idea before they can act on it. What is not
       shared is the button. */
    expect(container.querySelectorAll(".ws-actions-rule")).toHaveLength(1);
    expect(screen.getByText("Runs on the desk")).toBeInTheDocument();
  });

  it("shows a desk action's extra decisions and its keyed confirmation", () => {
    render(<ContextActionsScreen />);
    expect(screen.getByLabelText("Target")).toHaveValue("WordScript");
    expect(screen.getByLabelText("Role")).toHaveValue("work");
    /* ADR 0030 puts a visible keyed confirmation before anything a process does
       in a real repository, so the button says it is not the last step. */
    expect(screen.getByRole("button", { name: /Hand over…/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run on this object" })).not.toBeInTheDocument();
  });

  it("states the file, because an action IS a file", () => {
    render(<ContextActionsScreen />);
    expect(
      screen.getByText(/_actions\/turn-this-into-a-pr\.md/),
    ).toBeInTheDocument();
  });
});

describe("Context · intake", () => {
  it("defaults to Write, which is the cheapest and most frequent way in", () => {
    render(<ContextIntakeScreen />);
    expect(screen.getByRole("button", { name: "Write", pressed: true })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Start typing, or hold Ctrl+Space and talk."),
    ).toBeInTheDocument();
  });

  it("gives each of the three ways controls that have nothing in common", () => {
    const { container } = render(<ContextIntakeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(container.querySelector(".ws-rec-start")).not.toBeNull();
    expect(container.querySelector(".ws-dropzone")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(container.querySelector(".ws-dropzone")).not.toBeNull();
    expect(container.querySelector(".ws-rec-start")).toBeNull();
  });

  it("says the fourth import decision is gone rather than leaving a gap", () => {
    render(<ContextIntakeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(
      screen.getByText(/“Write a note” is gone/),
    ).toBeInTheDocument();
  });
});

describe("Meeting capture", () => {
  it("draws one window in three states, not three windows", () => {
    const { container } = render(<MeetingScreen />);
    expect(container.querySelectorAll(".ws-hud")).toHaveLength(3);
    expect(container.querySelectorAll(".ws-hud-cap")).toHaveLength(3);
  });

  it("holds the level readout at rest — the gallery measures nothing (ADR 0058)", () => {
    const { container } = render(<MeetingScreen />);
    const meters = container.querySelectorAll('[aria-label="Input level"]');
    expect(meters).toHaveLength(3);
    /* The prototype drives this from a synthetic envelope at 12 fps because it
       has no microphone. A gallery screen is not recording, so no pixel is lit
       and none of them moves. */
    for (const meter of meters) {
      expect(meter.querySelectorAll(".matrix-pixel-active")).toHaveLength(0);
    }
  });

  it("opens the action menu on exactly one of the three, with the desk entry ruled off", () => {
    const { container } = render(<MeetingScreen />);
    expect(container.querySelectorAll(".ws-menu")).toHaveLength(1);
    expect(container.querySelectorAll(".ws-menu-rule")).toHaveLength(1);
    expect(screen.getByText("Draft one per attendee, then send")).toBeInTheDocument();
  });

  it("carries the copilot hint with its citation, on one window only", () => {
    const { container } = render(<MeetingScreen />);
    const hints = container.querySelectorAll(".ws-cop");
    expect(hints).toHaveLength(1);
    /* ADR 0047: every hint carries the place it came from, and the link is part
       of the hint rather than an affordance beside it. */
    expect(hints[0].querySelector(".ws-cop-src")).not.toBeNull();
    expect(screen.getByText("Product Sync · 27 Jul · 14:02")).toBeInTheDocument();
  });

  it("names the three stages of a speaker name and says the third is not audio", () => {
    const { container } = render(<MeetingScreen />);
    expect(container.querySelectorAll(".ws-stage-row")).toHaveLength(3);
    expect(screen.getByText("not audio at all")).toBeInTheDocument();
  });
});

describe("Handoff", () => {
  it("shows the dictation verbatim before anything can be started", () => {
    render(<HandoffScreen />);
    /* ADR 0030: the input arrived over an unreliable channel, so the last thing
       the user sees has to be the thing that will actually be sent. */
    expect(screen.getByText(/Take the decisions from Tuesday's Acme review/)).toBeInTheDocument();
    expect(screen.getByText("What you said")).toBeInTheDocument();
  });

  it("names both keys, and Escape keeps the words", () => {
    const { container } = render(<HandoffScreen />);
    const keys = container.querySelector(".ws-hoff-keys")!;
    expect(within(keys as HTMLElement).getByText("Enter")).toBeInTheDocument();
    expect(within(keys as HTMLElement).getByText("Esc")).toBeInTheDocument();
    /* Refusing costs one keystroke and no words, which is what makes the offer
       cheap enough to be offered. Doing nothing is the safe answer. */
    expect(screen.getAllByText("Inserts the text")).toHaveLength(2);
  });

  it("draws what stayed here beside what crossed, and does not tint the held column red", () => {
    const { container } = render(<HandoffScreen />);
    const sides = container.querySelectorAll(".ws-cross-side");
    expect(sides).toHaveLength(2);
    expect(sides[1]).toHaveAttribute("data-held");
    expect(screen.getByText("Your API keys")).toBeInTheDocument();
    expect(screen.getByText("The audio")).toBeInTheDocument();
  });

  it("draws the shipped pill rather than inventing one, with its own left tab", () => {
    const { container } = render(<HandoffScreen />);
    /* Rule 5: reading the overlay in order to draw it is allowed; changing it
       is not. Eleven bars, the shipped composition, at the shipped geometry. */
    expect(container.querySelectorAll(".ws-ovp-bars i")).toHaveLength(11);
    expect(container.querySelector(".ws-ovp-tab")).not.toBeNull();
    expect(screen.getByText("handed over")).toBeInTheDocument();
  });
});

describe("Live subtitles", () => {
  it("keeps the two features apart rather than reconciling them", () => {
    render(<SubtitlesScreen />);
    expect(screen.getByText("system audio · its own window · you are the audience")).toBeInTheDocument();
    expect(screen.getByText("the open microphone · on the overlay · you are the speaker")).toBeInTheDocument();
  });

  it("draws the strip on a dark frame, a bright one, and translated", () => {
    const { container } = render(<SubtitlesScreen />);
    expect(container.querySelectorAll(".ws-cap-scene")).toHaveLength(3);
    expect(container.querySelectorAll(".ws-cap-scene[data-light]")).toHaveLength(1);
    /* The bright-frame case is the same component with the pair inverted — the
       strip flips as a unit so the text never has to win against its ground. */
    expect(container.querySelectorAll('.ws-cap-bar[data-tone="light"]')).toHaveLength(1);
    expect(screen.getByText("German")).toBeInTheDocument();
  });

  it("splits the echo into settled text and a live tail, with no box around it", () => {
    const { container } = render(<SubtitlesScreen />);
    expect(container.querySelector(".ws-echo-done")).not.toBeNull();
    expect(container.querySelector(".ws-echo-live")).not.toBeNull();
    /* No card and no panel: anything with a border becomes a window that has to
       be positioned and dismissed. */
    expect(container.querySelector(".ws-echo-text")?.closest(".ws-card")).toBeNull();
  });
});

describe("Translation", () => {
  it("puts the pair in the chrome, above the tabs", () => {
    const { container } = render(<TranslateScreen />);
    const pair = container.querySelector(".ws-trw-pair");
    expect(pair).not.toBeNull();
    expect(screen.getByLabelText("From")).toHaveValue("German");
    expect(screen.getByLabelText("To")).toHaveValue("English");
    expect(screen.getByRole("button", { name: "Swap the two languages" })).toBeInTheDocument();
  });

  it("marks the alternative on the word rather than listing whole sentences", () => {
    const { container } = render(<TranslateScreen />);
    expect(container.querySelector(".ws-trw-alt")?.textContent).toBe("move");
    expect(container.querySelectorAll(".ws-trw-altopt")).toHaveLength(3);
  });

  it("gives each speaker a side, and states the two languages separately", () => {
    const { container } = render(<TranslateScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Conversation" }));
    const turns = container.querySelectorAll(".ws-trw-turn");
    expect(turns).toHaveLength(3);
    expect([...turns].map((t) => t.getAttribute("data-side"))).toEqual(["them", "you", "them"]);
    /* The strip is a readout: nobody presses a language button mid-sentence. */
    expect(screen.getByText("heard, switching by itself")).toBeInTheDocument();
  });

  it("routes per language and not per device, with Silent as a real setting", () => {
    const { container } = render(<TranslateScreen />);
    expect(container.querySelectorAll(".ws-trw-route-row")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Silent" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Out loud", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In your ear", pressed: true })).toBeInTheDocument();
  });
});

describe("Client conversations", () => {
  it("reuses the meeting window rather than building a second one", () => {
    render(<ConversationScreen />);
    expect(screen.getByText("Reused, unchanged")).toBeInTheDocument();
    expect(screen.getByText("New, and all of it in the object")).toBeInTheDocument();
    expect(screen.getByText("origin: conversation")).toBeInTheDocument();
  });

  it("hangs the conversations on the person", () => {
    const { container } = render(<ConversationScreen />);
    expect(screen.getByText("Acme GmbH · M. Bergmann")).toBeInTheDocument();
    expect(container.querySelectorAll(".ws-clnt-row")).toHaveLength(4);
    /* It is not a CRM and does not grow into one. */
    expect(screen.getByText("Stays small")).toBeInTheDocument();
  });

  it("records what the consent answer was, and never gives legal advice", () => {
    render(<ConversationScreen />);
    expect(screen.getByRole("button", { name: "Given", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refused" })).toBeInTheDocument();
    expect(screen.getByText("States, never rules")).toBeInTheDocument();
    /* Refusing must not cost the notes, or the honest answer stops being given. */
    expect(screen.getByText("Notes only")).toBeInTheDocument();
  });

  it("says where every field of the document came from", () => {
    const { container } = render(<ConversationScreen />);
    const fields = container.querySelectorAll(".ws-doct-field");
    expect(fields).toHaveLength(5);
    for (const field of fields) expect(field.querySelector(".ws-doct-why")).not.toBeNull();
    expect(screen.getByText("Never invents")).toBeInTheDocument();
  });
});

describe("Agent overlay", () => {
  it("draws three states of ONE overlay, with Agent where a mode would stand", () => {
    const { container } = render(<AgentOverlayScreen />);
    expect(container.querySelectorAll(".ws-ovp")).toHaveLength(2);
    expect(container.querySelectorAll(".ws-ovp-mode-label")).toHaveLength(2);
    for (const label of container.querySelectorAll(".ws-ovp-mode-label")) {
      expect(label.textContent).toBe("Agent");
    }
    /* Only the second pill has grown the tab. */
    expect(container.querySelectorAll(".ws-ovp-tab")).toHaveLength(1);
  });

  it("draws the rail as one process with targets under it, not as three agents", () => {
    const { container } = render(<AgentOverlayScreen />);
    /* ADR 0043. The orb at the head is the identity the rail belongs to; the
       targets are what the one voice is working on. */
    expect(container.querySelector(".ws-agw-rail-head .ws-orb")).not.toBeNull();
    expect(screen.getByText("one process · speaks for all three")).toBeInTheDocument();
    expect(container.querySelectorAll(".ws-agw-target")).toHaveLength(3);
    expect(container.querySelectorAll(".ws-agw-unread")).toHaveLength(1);
  });

  it("holds the answer window's level at rest and the orbs without a generator", () => {
    const { container } = render(<AgentOverlayScreen />);
    const meter = container.querySelector('[aria-label="Input level"]')!;
    expect(meter.querySelectorAll(".matrix-pixel-active")).toHaveLength(0);
    /* The orbs keep the prototype's own levels — `drive` is absent, so nothing
       generates a frame (ADR 0058, and Leg 2c's finding 5). */
    for (const orb of container.querySelectorAll(".ws-orb")) {
      expect(orb).not.toHaveAttribute("data-drive");
    }
  });

  it("puts Agent after the rule in the cycle, because it is not a mode", () => {
    const { container } = render(<AgentOverlayScreen />);
    expect(container.querySelector(".ws-cycle-rule")).not.toBeNull();
    const on = container.querySelectorAll(".ws-cycle-item[data-on]");
    expect(on).toHaveLength(1);
    expect(on[0].textContent).toBe("Agent");
    expect(screen.getByText("delivery axis")).toBeInTheDocument();
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
