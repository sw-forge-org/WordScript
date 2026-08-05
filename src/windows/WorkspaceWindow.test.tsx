import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkspaceWindow from "./WorkspaceWindow";
import { createAppConfig } from "../test/factories";

const CONFIG = createAppConfig();

const { invoke, saveConfig, listeners } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  saveConfig: vi.fn(async (next: unknown) => next),
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
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
    state: { status: "idle", config: CONFIG, paused: false, error: null },
    saveConfig,
  }),
}));
vi.mock("../hooks/useProvider", () => ({
  useProvider: () => ({ status: { credential: { configured: true } } }),
}));

afterEach(() => {
  cleanup();
  listeners.clear();
  vi.clearAllMocks();
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

  // A row that opens nothing is the fake affordance rule 7 forbids. The search
  // field opens the command palette and there is no palette; Help has nothing
  // behind it. Both are ported and neither is mounted.
  it("mounts neither the search field nor Help, because neither leads anywhere", () => {
    const { container } = render(<WorkspaceWindow />);
    expect(container.querySelector(".ws-nav-search")).toBeNull();
    expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument();
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
    expect(within(nav).getAllByRole("button")).toHaveLength(10);
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
