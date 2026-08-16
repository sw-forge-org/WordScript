import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceWindow from "./WorkspaceWindow";
import { createAppConfig } from "../test/factories";

const CONFIG = createAppConfig();

/* What the mocked runtime answers with. A `let` rather than the constant above
   because one thing this window reads out of the config is the colour scheme,
   and asserting that it is adopted needs a config that does not already agree
   with the default. Reset in `afterEach`. */
let runtimeConfig: typeof CONFIG | null = CONFIG;

const { invoke, saveConfig, listeners, openUrl, provider } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  saveConfig: vi.fn(async (next: unknown) => next),
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
  openUrl: vi.fn().mockResolvedValue(undefined),
  /* WHAT THE PROVIDER SEAM ANSWERED, AND WHO IT WAS ASKED ABOUT (D1c).
     `asked` is half the point: until this commit the mock was a constant, so
     the case that the chip asks about the connection the strip names could not
     be written — the two disagreed for two adapters and every test passed. */
  provider: {
    asked: [] as (string | null)[],
    answers: new Map<string, unknown>(),
    failure: null as unknown,
  },
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
  useProvider: (providerId: string | null) => {
    provider.asked.push(providerId);
    return {
      status: providerId ? provider.answers.get(providerId) ?? null : null,
      lastError: provider.failure,
    };
  },
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

/** A config whose active profile dictates through one named vendor (ADR 0094). */
function configOn(providerId: string, overrides: Parameters<typeof createAppConfig>[0] = {}) {
  const config = createAppConfig(overrides);
  const active = config.text_profiles.find(
    (profile) => profile.id === config.active_text_profile_id,
  )!;
  active.providers = { default: providerId, overrides: {} };
  return config;
}

/** A `provider_status` shaped like the runtime's, for one vendor and one role. */
function providerStatus(
  providerId: string,
  role: Partial<{ configured: boolean; missing: string | null; kind: string | null }> = {},
  extra: Record<string, unknown> = {},
) {
  return {
    provider: providerId,
    default_profile: "fast",
    credential: { provider: providerId, configured: true, storage: "os_secret_store", key_preview: null },
    profiles: [],
    capabilities: {},
    model_capabilities: {},
    role_credentials: [
      {
        provider: providerId,
        role: "speech",
        kind: "api_key",
        configured: true,
        storage: "os_secret_store",
        key_preview: null,
        missing: null,
        ...role,
      },
    ],
    local_setup: null,
    self_hosted_endpoint: null,
    ...extra,
  };
}

/* The default answer is set before each case rather than after, so the first
   one is not the only case running against an empty map. */
beforeEach(() => {
  provider.answers.set("groq", providerStatus("groq"));
});

afterEach(() => {
  cleanup();
  listeners.clear();
  vi.clearAllMocks();
  runtimeConfig = CONFIG;
  provider.asked.length = 0;
  provider.answers.clear();
  provider.failure = null;
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

  /**
   * **AND IT NAMES THE CONNECTION IT IS ON** (D1b, ADR 0165).
   *
   * The strip had two answers — `Local runtime` and `Groq cloud` — because
   * `selectedProvider` collapses every cloud vendor onto `groq`. A machine
   * connected to its own server therefore read **Groq cloud · whisper-large-v3**
   * along the one edge of the window that is never scrolled away: the wrong
   * vendor over a model field that lane is not even sent. Found by rendering
   * the workspace and looking at it, which is the fifth time on this surface.
   */
  it("names the self-hosted connection rather than calling it Groq", async () => {
    runtimeConfig = configOn("self_hosted", { self_hosted_model: "faster-whisper-medium" });

    const { container } = render(<WorkspaceWindow />);
    await waitFor(() =>
      expect(container.querySelector(".ws-win-foot")).toHaveTextContent(
        "Your server · faster-whisper-medium",
      ),
    );
    expect(container.querySelector(".ws-win-foot")).not.toHaveTextContent("Groq cloud");
  });

  /**
   * D1c — THE OTHER HALF OF THE SAME LINE, and D1b said so in its own record:
   * the strip was made to name the connection while the chip beside it went on
   * asking `groq` about every cloud vendor, because `ProviderId` had two arms
   * and a caller holding `openai` had to narrow to one of them.
   */
  it("asks the runtime about the connection the strip names", async () => {
    runtimeConfig = configOn("openai");
    provider.answers.set("openai", providerStatus("openai"));

    const { container } = render(<WorkspaceWindow />);
    await waitFor(() => expect(provider.asked).toContain("openai"));
    expect(provider.asked).not.toContain("groq");
    expect(container.querySelector(".ws-win-foot")).toHaveTextContent("OpenAI cloud");
  });

  it("names the vendor whose key is missing rather than always naming Groq", async () => {
    runtimeConfig = configOn("openai");
    provider.answers.set(
      "openai",
      providerStatus("openai", { configured: false, missing: "API key for speech recognition" }),
    );

    const { container } = render(<WorkspaceWindow />);
    const strip = container.querySelector(".ws-win-foot");
    await waitFor(() => expect(strip).toHaveTextContent("Needs key"));
    expect(strip).toHaveAttribute("title", "Add the OpenAI key before transcription can run.");
  });

  /**
   * **NOTHING IS MISSING HERE THAT A KEY WOULD FIX**, which is the case that
   * makes reading `RoleCredentialStatus.missing` a rule rather than a
   * preference: this lane needs a URL and a model id, `LaneConfiguration`
   * already says which in a sentence written for a reader, and `Needs key` sent
   * that reader to a credential row that would not have helped.
   */
  it("states what the self-hosted lane is missing, in the runtime's own words", async () => {
    runtimeConfig = configOn("self_hosted");
    provider.answers.set(
      "self_hosted",
      providerStatus(
        "self_hosted",
        { configured: false, kind: null, missing: "No server is configured yet. Type the base URL." },
        { self_hosted_endpoint: { base_url: null, base_url_source: "unset", base_url_problem: null, model: null, model_source: "unset" } },
      ),
    );

    const { container } = render(<WorkspaceWindow />);
    const strip = container.querySelector(".ws-win-foot");
    await waitFor(() => expect(strip).toHaveTextContent("Needs your server"));
    expect(strip).not.toHaveTextContent("Needs key");
    expect(strip).toHaveAttribute("title", "No server is configured yet. Type the base URL.");
  });

  /**
   * A config naming an id no adapter claims is refused by `resolve_entry` with
   * a sentence that names the connection. Read as *missing key*, it sent the
   * reader to a credential row for a vendor that has none.
   */
  it("shows the runtime's refusal for a connection it has no adapter for", async () => {
    runtimeConfig = configOn("anthropic");
    provider.failure = {
      kind: "invalid_request",
      message: "Provider 'anthropic' is not supported yet.",
      status: null,
      retry_after_seconds: null,
      retryable: false,
      user_action: "change_request",
    };

    const { container } = render(<WorkspaceWindow />);
    const strip = container.querySelector(".ws-win-foot");
    await waitFor(() => expect(strip).toHaveTextContent("Needs attention"));
    expect(strip).not.toHaveTextContent("Needs key");
    expect(strip).toHaveAttribute("title", "Provider 'anthropic' is not supported yet.");
  });

  /**
   * `providerSeam`'s `pending` rule, at the one place that had never heard of
   * it: an outstanding read is not a missing credential, and a warning printed
   * out of this window's own latency is a claim nobody measured.
   */
  it("claims nothing while the runtime has not answered", () => {
    provider.answers.clear();

    const { container } = render(<WorkspaceWindow />);
    const strip = container.querySelector(".ws-win-foot");
    expect(strip).toHaveTextContent("Checking");
    expect(strip).not.toHaveTextContent("Needs key");
    expect(strip).not.toHaveTextContent("Ready");
  });

  /**
   * **FOUND BY RENDERING THE WINDOW, WITH THIS FILE ALREADY GREEN.** The strip
   * read correctly for all six connections and the stub had still been asked
   * `groq` first every time: `connectionProvider` falls back to the default so
   * the sentences have a name, and handing that name to the hook spends a
   * keyring read on a vendor this machine may not use, whose answer is thrown
   * away the moment the config lands. Seventh defect on this surface found by
   * looking at it (ADR 0160-0165 hold the other six).
   */
  it("asks nobody until the config says who the connection is", () => {
    runtimeConfig = null;

    render(<WorkspaceWindow />);
    expect(provider.asked).toEqual([null]);
  });

  it("still reads the local lane off the disk rather than off a credential", async () => {
    runtimeConfig = configOn("local");
    provider.answers.set(
      "local",
      providerStatus(
        "local",
        { kind: null },
        {
          local_setup: {
            readiness: "setup_required",
            guidance: "whisper-cli was not found on this machine.",
          },
        },
      ),
    );

    const { container } = render(<WorkspaceWindow />);
    const strip = container.querySelector(".ws-win-foot");
    await waitFor(() => expect(strip).toHaveTextContent("Needs local setup"));
    expect(strip).toHaveAttribute("title", "whisper-cli was not found on this machine.");
  });
});

/**
 * THE SIDEBAR'S TWO WIDTHS — ADR 0111.
 *
 * What a unit test can hold is the SEAM, not the pixels: which state the
 * sidebar opens in, that the toggle changes it, and that the change reaches the
 * config rather than a store of its own. The rail's own drawing is CSS and is
 * judged in the running host, where `--nav-w-rail` is a width and jsdom has
 * none.
 *
 * jsdom's `matchMedia` reports `matches: false` for everything, so the window
 * these cases run in is a WIDE one — which is exactly the half that has to be
 * tested here, because the narrow half is a media query and jsdom cannot have
 * an opinion about it.
 */
describe("WorkspaceWindow · the sidebar's two widths", () => {
  it("opens expanded, and the toggle rails it and writes the choice down", async () => {
    const user = userEvent.setup();
    const { container } = render(<WorkspaceWindow />);
    const nav = container.querySelector(".ws-nav")!;
    expect(nav).not.toHaveAttribute("data-collapsed");

    await user.click(screen.getByRole("button", { name: "Collapse the sidebar" }));

    expect(nav).toHaveAttribute("data-collapsed");
    /* A preference, not window state: it goes through the same instant-save
       path every other discrete control uses. */
    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_nav_rail: true }),
      ),
    );
  });

  /* THE HALF THAT MADE THE TOGGLE JUDDER — ADR 0125.
     `save_config` resolves with the config the runtime wrote, and the `ready`
     event carrying that same config travels its own channel. The draft used to
     resync from the EVENT's config when the save settled, which is the one the
     write has not reached yet whenever the promise wins the race: the rail
     closed, sprang open on the settle, and closed again when the event landed.
     Two reversals inside one 180 ms transition is what "it does not collapse
     cleanly, it judders" was. */
  it("stays railed when the save settles before the runtime's own echo", async () => {
    const user = userEvent.setup();
    /* Spelled out rather than left off the factory: an ABSENT preference reads
       as "the runtime has not answered yet" and is deliberately ignored, so a
       config without the field cannot reproduce the reversal at all. */
    runtimeConfig = createAppConfig({ workspace_nav_rail: false });
    const { container } = render(<WorkspaceWindow />);
    const nav = container.querySelector(".ws-nav")!;

    await user.click(screen.getByRole("button", { name: "Collapse the sidebar" }));
    await waitFor(() => expect(saveConfig).toHaveBeenCalled());
    // Everything the settle schedules, drained. The mocked runtime emits no
    // `ready` at all, which is exactly the state the window is in for the
    // length of that race.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(nav).toHaveAttribute("data-collapsed");
  });

  it("opens railed when that is what the config remembers", async () => {
    runtimeConfig = createAppConfig({ workspace_nav_rail: true });
    const { container } = render(<WorkspaceWindow />);

    await waitFor(() =>
      expect(container.querySelector(".ws-nav")).toHaveAttribute("data-collapsed"),
    );
    // The toggle is the way back out and says so, in both states.
    expect(screen.getByRole("button", { name: "Expand the sidebar" })).toBeInTheDocument();
  });

  /* THE LABEL IS WITHHELD, NOT DELETED. It stays in the DOM so the row keeps
     its accessible name from its own content — a rail whose rows are unnamed
     to a screen reader is a rail nobody can use. */
  it("keeps every row named in the rail, and adds the tooltip a label would be", async () => {
    runtimeConfig = createAppConfig({ workspace_nav_rail: true });
    render(<WorkspaceWindow />);
    const nav = screen.getByRole("navigation", { name: "Workspace" });

    await waitFor(() => expect(nav).toHaveAttribute("data-collapsed"));
    for (const label of ["Home", "History", "Profiles", "Context"]) {
      const row = within(nav).getByRole("button", { name: new RegExp(label) });
      expect(row).toHaveAttribute("title", label);
    }
  });
});

/**
 * THE PROFILE CONTROL — ADR 0111.
 *
 * The sheet's header drew a popup button's double chevron and navigated
 * instead of opening one. Both surfaces carry the same component now, so what
 * is held here is that both of them actually switch.
 */
describe("WorkspaceWindow · switching the active profile", () => {
  it("carries a real picker in the sidebar and in the sheet's header", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);

    const inNav = screen.getByRole("combobox", { name: "Switch active profile" });
    expect(inNav).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Settings/ }));
    const pickers = screen.getAllByRole("combobox", { name: "Switch active profile" });
    expect(pickers).toHaveLength(2);
    // Every profile the config holds, on both of them.
    for (const picker of pickers) {
      expect(picker.querySelectorAll("option")).toHaveLength(CONFIG.text_profiles!.length);
    }
  });

  it("asks the runtime first and applies the patch only once it agrees", async () => {
    const user = userEvent.setup();
    invoke.mockResolvedValue(undefined);
    render(<WorkspaceWindow />);

    const picker = screen.getByRole("combobox", { name: "Switch active profile" });
    const other = CONFIG.text_profiles!.find((entry) => entry.id !== "general")!;
    await user.selectOptions(picker, other.id);

    expect(invoke).toHaveBeenCalledWith("switch_active_text_profile", { profileId: other.id });
    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ active_text_profile_id: other.id }),
      ),
    );
  });

  /* THE HALF THAT WAS SWALLOWED. `.catch(() => {})` stood where this assertion
     is: the runtime declined, the `<select>` sprang back to where it started,
     and nothing on the surface said why — reported as "sometimes it just does
     not switch". */
  it("states a refusal instead of springing back in silence", async () => {
    const user = userEvent.setup();
    invoke.mockImplementation((command: string) =>
      command === "switch_active_text_profile"
        ? Promise.reject("Another window is recording.")
        : Promise.resolve(undefined),
    );
    render(<WorkspaceWindow />);

    const other = CONFIG.text_profiles!.find((entry) => entry.id !== "general")!;
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Switch active profile" }),
      other.id,
    );

    expect(await screen.findByText("Another window is recording.")).toBeInTheDocument();
    expect(saveConfig).not.toHaveBeenCalled();
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

    /* The reveal row ACTS since ADR 0074 — it opens the folder the transcripts
       are in, which needs nothing of this session. */
    expect(
      within(panel).getByRole("button", { name: /Show transcripts in file manager/ }),
    ).toBeEnabled();
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
