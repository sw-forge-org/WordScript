import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkspaceWindow from "./WorkspaceWindow";
import { createAppConfig } from "../test/factories";

const CONFIG = createAppConfig();

/* What the mocked runtime answers with. A `let` rather than the constant above
   because one thing this window reads out of the config is the colour scheme,
   and asserting that it is adopted needs a config that does not already agree
   with the default. Reset in `afterEach`. */
let runtimeConfig = CONFIG;

const { invoke, saveConfig, listeners, openUrl } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  saveConfig: vi.fn(async (next: unknown) => next),
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: (name: string, handler: (event: { payload: unknown }) => void) => {
    listeners.set(name, handler);
    return Promise.resolve(() => listeners.delete(name));
  },
}));
vi.mock("../hooks/useRuntime", () => ({
  useRuntime: () => ({
    state: { status: "idle", config: runtimeConfig, paused: false, error: null },
    saveConfig,
  }),
}));
vi.mock("../hooks/useProvider", () => ({
  useProvider: () => ({ status: { credential: { configured: true } } }),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

afterEach(() => {
  cleanup();
  listeners.clear();
  vi.clearAllMocks();
  runtimeConfig = CONFIG;
  document.documentElement.removeAttribute("data-theme");
});

/**
 * ONE WINDOW, FOUR VIEWS, AND SETTINGS AS A SHEET OVER IT. What a unit test can
 * hold about that is the shape and the seams — the pixels are `port:diff`'s.
 */
describe("WorkspaceWindow", () => {
  it("is a workspace with four views, and settings is not one of them", () => {
    render(<WorkspaceWindow />);
    const nav = screen.getByRole("navigation", { name: "Workspace" });

    for (const label of ["Home", "History", "Profiles", "Context"]) {
      expect(within(nav).getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    // The fourteen flat areas are gone, not aliased (ADR 0054).
    for (const gone of ["Speech & AI", "Modes", "Capture", "Overlay", "Chat", "Upload", "Account"]) {
      expect(within(nav).queryByRole("button", { name: gone })).not.toBeInTheDocument();
    }
  });

  // FOR THREE LEGS THIS ASSERTED THE OPPOSITE, and that was right at the time:
  // a row that opens nothing is the fake affordance rule 7 forbids, so the
  // search field and Help were both ported and neither was mounted. Leg 4d
  // builds what each opens — the command palette and the Help modal (ADR 0066)
  // — and mounting them is the same commit as building them.
  it("mounts the search field and Help, now that each opens something", () => {
    const { container } = render(<WorkspaceWindow />);
    expect(container.querySelector(".ws-nav-search")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Help/ })).toBeInTheDocument();
  });

  it("opens the sheet from the sidebar and closes it on Escape", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);

    await user.click(screen.getByRole("button", { name: /Settings/ }));
    const sheet = screen.getByRole("dialog", { name: "WordScript Settings" });
    expect(within(sheet).getByRole("button", { name: "General" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the sheet on Cmd+, and does not reopen it on top of itself", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);

    await user.keyboard("{Control>},{/Control}");
    expect(screen.getByRole("dialog", { name: "WordScript Settings" })).toBeInTheDocument();

    // Pressing it again inside the sheet must not throw the user back to
    // General from whatever section they had opened.
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hotkeys" }));
    await user.keyboard("{Control>},{/Control}");
    expect(screen.getByRole("heading", { level: 1, name: "Hotkeys" })).toBeInTheDocument();
  });

  it("carries the sheet's ten sections in three groups", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    await user.click(screen.getByRole("button", { name: /Settings/ }));

    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    /* The rows, not every button in the nav: the sheet's sidebar carries the
       search field too, which the prototype draws in all three of its
       sidebars. */
    expect(nav.querySelectorAll(".ws-nav-row")).toHaveLength(10);
    for (const group of ["App", "AI", "System"]) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
  });

  // §11.22: the sheet is drawn at its own scale, and it is the sheet that
  // carries it rather than any component inside it. `.ws-modal-win` is where
  // the eight structure tokens are redeclared — if this class stops being on
  // the sheet, every screen inside it silently goes back to workspace size.
  it("draws the sheet at the sheet's scale", async () => {
    const user = userEvent.setup();
    const { container } = render(<WorkspaceWindow />);
    await user.click(screen.getByRole("button", { name: /Settings/ }));

    expect(container.querySelector(".ws-modal-scrim > .ws-modal-win")).not.toBeNull();
    // Frost is a pair: the scrim darkens and the layer behind recedes. The flag
    // that makes the second half happen is on the window (ADR 0051).
    expect(container.querySelector(".ws-win")).toHaveAttribute("data-frost-shell");
  });

  // The one runtime contract ADR 0054 exempts. §11.7 moved auto-stop into the
  // profile, so the anchor resolves to a VIEW and must close the sheet rather
  // than scroll a row behind a scrim.
  it("resolves the overlay's deep link to Profiles, with the sheet shut", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    await user.click(screen.getByRole("button", { name: /Settings/ }));

    await waitFor(() => expect(listeners.get("wordscript-settings-target")).toBeDefined());
    listeners.get("wordscript-settings-target")!({ payload: { target: "capture.auto_stop" } });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.getElementById("settings-anchor-capture-auto_stop")).not.toBeNull();
  });

  // The strip is the one thing on this surface that IS wired, and it has to be:
  // it is never scrolled away, so a readiness nobody measured would be the
  // fake-readiness defect at the most permanent place on screen.
  it("states the runtime's own facts along the bottom edge", () => {
    const { container } = render(<WorkspaceWindow />);
    const strip = container.querySelector(".ws-win-foot");
    expect(strip).toHaveTextContent("Ready");
    expect(strip).toHaveTextContent(`Groq cloud · ${CONFIG.model}`);
    expect(strip).toHaveTextContent("Insert at cursor");
  });
});

/**
 * THE PALETTE, AS THE WINDOW MOUNTS IT. The index and the scoring are
 * `workspace/palette.test.ts`; what is held here is that the field opens it,
 * that the chord opens it, that a row navigates, and that the two layers
 * receding are the two ADR 0051 names.
 */
describe("WorkspaceWindow · the command palette", () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /Search/ }));
    return screen.getByRole("dialog", { name: "Search WordScript" });
  };

  it("opens from the field and from Cmd/Ctrl+K, and the chord closes it again", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);

    await open(user);
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("dialog", { name: "Search WordScript" })).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Search WordScript" })).toBeInTheDocument();
  });

  it("narrows on the query and ranks a prefix above a substring", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    const panel = await open(user);

    await user.type(within(panel).getByRole("textbox"), "sound");
    const rows = within(panel).getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Sound pack");
    expect(rows.some((row) => row.textContent?.includes("Play sound cues"))).toBe(true);
    expect(rows.some((row) => row.textContent?.includes("Home"))).toBe(false);
  });

  it("says what it did not find rather than showing an empty list", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    const panel = await open(user);

    await user.type(within(panel).getByRole("textbox"), "zzz");
    expect(within(panel).getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("runs a Go to row through the same door a screen uses, and closes", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    const panel = await open(user);

    await user.click(within(panel).getByRole("button", { name: /^History/ }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Search WordScript" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { level: 1, name: "History" })).toBeInTheDocument();
  });

  // ADR 0065, and Leg 4c's sharper version of it: the reason has to be legible
  // without hovering, because a disabled control takes `pointer-events: none`.
  it("draws the row with no runtime behind it inert, with its reason in the path column", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    const panel = await open(user);

    const reveal = within(panel).getByRole("button", { name: /Show transcripts in file manager/ });
    expect(reveal).toBeDisabled();
    expect(reveal).toHaveTextContent("one history file, not one per transcript");
    /* Nothing has been transcribed in this session and the scratchpad is empty,
       so neither of the two rows that act on a transcript pretends otherwise. */
    expect(within(panel).getByRole("button", { name: /Copy last transcript/ })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: /Restore last clipboard insert/ })).toBeDisabled();
  });

  // The Escape stack the prototype states and never had to build: palette
  // first, then the sheet. Escape closing the sheet out from under an open
  // palette is the bug the ordering exists to prevent.
  it("takes Escape for itself while it stands over the settings sheet", async () => {
    const user = userEvent.setup();
    const { container } = render(<WorkspaceWindow />);
    await user.click(screen.getByRole("button", { name: /Settings/ }));
    await user.keyboard("{Control>}k{/Control}");

    // Both layers recede — the shell behind the sheet, the stack behind the
    // palette. That is ADR 0051's nesting, and it is why the flags are two.
    expect(container.querySelector(".ws-win")).toHaveAttribute("data-frost-shell");
    expect(container.querySelector(".ws-win")).toHaveAttribute("data-frost-stack");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Search WordScript" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "WordScript Settings" })).toBeInTheDocument();
  });
});

/** ADR 0069. Four links over the row that opens them, and the one with no
 *  address is drawn rather than left out — a missing entry would teach the
 *  reader there is no documentation. */
describe("WorkspaceWindow · Help", () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Help" }));
    return screen.getByRole("menu", { name: "Help" });
  };

  it("opens over the row and carries four entries", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    const menu = await open(user);

    expect(within(menu).getAllByRole("menuitem")).toHaveLength(4);
    for (const label of ["Website", "Discord", "GitHub", "Documentation"]) {
      expect(within(menu).getByText(label)).toBeInTheDocument();
    }
  });

  it("opens a real address and holds the unpublished one inert with its reason", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    const menu = await open(user);

    expect(within(menu).getByRole("menuitem", { name: /Documentation/ })).toBeDisabled();
    expect(within(menu).getByText("No address yet")).toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitem", { name: /Website/ }));
    expect(openUrl).toHaveBeenCalledWith("https://wordscript.dev");
    expect(screen.queryByRole("menu", { name: "Help" })).not.toBeInTheDocument();
  });

  it("closes on a press outside it and on Escape", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);

    await open(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Help" })).not.toBeInTheDocument();

    await open(user);
    /* Anywhere outside the anchor — the sidebar's own ground will do, and it
       is the nearest thing to a stray press this surface has. */
    await user.click(screen.getByRole("navigation", { name: "Workspace" }));
    expect(screen.queryByRole("menu", { name: "Help" })).not.toBeInTheDocument();
  });
});

/**
 * The colour scheme, which is the one thing about this window that has to
 * survive a restart.
 *
 * The palette shipped three theme rows for a leg that changed this window and
 * persisted nothing, because no config field carried the choice. There is one
 * now, so both directions are held here: the window adopts what the runtime
 * answered with, and a change made here is written back.
 *
 * It belongs to the window rather than to a screen because the scheme lands on
 * `<html data-theme>` and every surface reads it from there.
 */
describe("WorkspaceWindow \u00b7 the colour scheme", () => {
  it("takes the scheme the runtime answered with", async () => {
    runtimeConfig = createAppConfig({ color_scheme: "light" });
    render(<WorkspaceWindow />);

    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-theme")).toBe("light"),
    );
  });

  /* `system` is a deferral rather than a third palette (ADR 0048): what lands
     on the attribute is always the resolved value, never the word `system`. */
  it("resolves system rather than writing it to the attribute", async () => {
    runtimeConfig = createAppConfig({ color_scheme: "system" });
    render(<WorkspaceWindow />);

    await waitFor(() => {
      const applied = document.documentElement.getAttribute("data-theme");
      expect(applied === "light" || applied === "dark").toBe(true);
    });
  });

  /* The half that was missing for a leg. The palette's theme rows switched this
     window and the next launch lost the choice, because nothing wrote it down.
     A theme row is a discrete control, so it takes the instant-save path. */
  it("writes a scheme picked in the palette back to the config", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);

    await user.keyboard("{Control>}k{/Control}");
    await user.click(await screen.findByText("Switch to light theme"));

    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ color_scheme: "light" }),
      ),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
