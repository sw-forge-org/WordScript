import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceWindow from "./WorkspaceWindow";
import { createAppConfig } from "../test/factories";
import { LANE_LABEL } from "@/screens/data";

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
     be written — the two disagreed for two adapters and every test passed.

     **AND IT RECORDED ONLY THE VENDOR, WHICH IS ONE ARGUMENT SHORT OF THE
     QUESTION** (ADR 0208). The credential's scope is the ACCOUNT, and a mock
     that drops that argument cannot fail when the caller drops it either —
     which is what happened: the strip omitted it, the runtime read a scope
     nothing writes, and 866 green cases had no way to notice. `scopes` is the
     same repair `asked` was, one axis over. */
  provider: {
    asked: [] as (string | null)[],
    scopes: [] as string[],
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
  /* THE MOCK ANSWERS PER ACCOUNT, THE WAY THE RUNTIME DOES. It answered per
     vendor and ignored the scope, so a caller that named no account got the
     vendor's answer here and an empty keyring entry in the product — the mock
     was kinder than the runtime, which is the one thing a seam double must
     never be. A status is keyed `provider@connection` now, and an unnamed
     account answers `null` because that is what an unreadable scope is. */
  useProvider: (providerId: string | null, _model?: unknown, _correction?: unknown, connectionId = "") => {
    provider.asked.push(providerId);
    provider.scopes.push(connectionId);
    return {
      status: providerId
        ? provider.answers.get(`${providerId}@${connectionId}`) ??
          provider.answers.get(providerId) ??
          null
        : null,
      lastError: provider.failure,
    };
  },
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

/** A config whose active profile dictates through one named vendor (ADR 0094). */
/** A machine whose active profile runs on one vendor's account (ADR 0208).
 *
 *  The profile names an ACCOUNT and the account names the vendor, so a fixture
 *  that wants *this profile is on its own server* has to give the machine that
 *  server to point at — `model` is the id the account carries, which is where
 *  the self-hosted lane's model id lives now. */
function configOn(
  providerId: string,
  account: Partial<{ model: string; base_url: string }> = {},
  overrides: Parameters<typeof createAppConfig>[0] = {},
) {
  const connection = {
    id: `connection-${providerId}`,
    label: providerId,
    provider: providerId,
    base_url: "",
    model: "",
    plan: "",
    ...account,
  };
  const config = createAppConfig({ connections: [connection], ...overrides });
  const active = config.text_profiles.find(
    (profile) => profile.id === config.active_text_profile_id,
  )!;
  active.providers = { default: connection.id, overrides: {}, models: {} };
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
  provider.scopes.length = 0;
  provider.answers.clear();
  provider.failure = null;
  document.documentElement.removeAttribute("data-theme");
});

/**
 * ONE WINDOW, FOUR VIEWS, AND SETTINGS AS A SHEET OVER IT. What a unit test can
 * hold about that is the shape and the seams — the pixels are `port:diff`'s.
 */
describe("WorkspaceWindow", () => {
  /**
   * THREE VIEWS BY DEFAULT AND FOUR IN DEVELOPER MODE, and the missing one is
   * the point rather than a regression. Context is drawn all the way down — the
   * context object does not exist in the runtime — so a nav row for it is a
   * door onto a sketch, which is the fake affordance rule 7 forbids. The
   * architecture is still §4.2's four; what a reader gets is what this build
   * can stand behind.
   */
  it("is a workspace of the views this build can stand behind", () => {
    render(<WorkspaceWindow />);
    const nav = screen.getByRole("navigation", { name: "Workspace" });

    for (const label of ["Home", "History", "Profiles"]) {
      expect(within(nav).getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(within(nav).queryByRole("button", { name: /Context/ })).not.toBeInTheDocument();
    // The fourteen flat areas are gone, not aliased (ADR 0054).
    for (const gone of ["Speech & AI", "Modes", "Capture", "Overlay", "Chat", "Upload", "Account"]) {
      expect(within(nav).queryByRole("button", { name: gone })).not.toBeInTheDocument();
    }
  });

  it("adds the drawn view, and its chip, in Developer Mode", async () => {
    runtimeConfig = createAppConfig({ developer_mode: true });
    render(<WorkspaceWindow />);
    const nav = screen.getByRole("navigation", { name: "Workspace" });

    const context = await within(nav).findByRole("button", { name: /Context/ });
    expect(context).toBeInTheDocument();
    /* The chip rides with the row. Home is drawn in part and never wears one:
       marking a screen the reader is looking at working is the caveat they
       learn to skip. */
    expect(within(context).getByText("preview")).toBeInTheDocument();
    expect(
      within(within(nav).getByRole("button", { name: /Home/ })).queryByText("preview"),
    ).toBeNull();
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

  it("carries the sheet's seven built sections in three groups", async () => {
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    await user.click(screen.getByRole("button", { name: /Settings/ }));

    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    /* The rows, not every button in the nav: the sheet's sidebar carries the
       search field too, which the prototype draws in all three of its
       sidebars.

       SEVEN OF THE TEN. Notes & Meetings, Agents and Integrations are drawn all
       the way down, so by default they are not rows — a reader who opens Agents
       and sets something would have set nothing. The three groups survive the
       cut, which is the other half: AI keeps AI Models. */
    expect(nav.querySelectorAll(".ws-nav-row")).toHaveLength(7);
    for (const group of ["App", "AI", "System"]) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
  });

  it("carries all ten in Developer Mode", async () => {
    runtimeConfig = createAppConfig({ developer_mode: true });
    const user = userEvent.setup();
    render(<WorkspaceWindow />);
    await user.click(await screen.findByRole("button", { name: /Settings/ }));

    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    await waitFor(() => expect(nav.querySelectorAll(".ws-nav-row")).toHaveLength(10));
    for (const label of ["Notes & Meetings", "Agents", "Integrations"]) {
      expect(within(nav).getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
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
    /* THE LANE IS ITS OWN FACT AND THE VENDOR IS ANOTHER (ADR 0196). It read
       `Groq cloud · llama…`, which welds where the work runs to who does it —
       two answers that move independently, in one token a reader has to parse a
       vendor name out of to find the lane. */
    /* The strip writes its own `·` between facts and the caller writes none, so
       the lane and the vendor are two entries here rather than one string with a
       separator in it — which is the whole change. */
    expect(strip).toHaveTextContent(`Cloud·Groq · ${CONFIG.model}`);
    expect(strip).toHaveTextContent("Insert at cursor");
  });

  /** The lane's name comes from `LANE_LABEL` (ADR 0160) rather than from a
   *  fourth spelling of it along this edge — one list per fact (ADR 0123). */
  it("spells the lane the way every other surface spells it", async () => {
    runtimeConfig = configOn("self_hosted", { model: "faster-whisper-medium" });

    const { container } = render(<WorkspaceWindow />);
    await waitFor(() =>
      expect(container.querySelector(".ws-win-foot")).toHaveTextContent(
        LANE_LABEL["Self-hosted"],
      ),
    );
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
    runtimeConfig = configOn("self_hosted", { model: "faster-whisper-medium" });

    const { container } = render(<WorkspaceWindow />);
    await waitFor(() =>
      expect(container.querySelector(".ws-win-foot")).toHaveTextContent(
        "Your server·faster-whisper-medium",
      ),
    );
    /* The lane and the vendor are one thing on this lane, so the strip says it
       once (ADR 0196) — and never says the cloud vendor it is not on. */
    expect(container.querySelector(".ws-win-foot")).not.toHaveTextContent("Groq");
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
    expect(container.querySelector(".ws-win-foot")).toHaveTextContent("Cloud·OpenAI");
  });

  /**
   * **AND IT ASKS ABOUT THE ACCOUNT, NOT ONLY ABOUT THE VENDOR** — ADR 0209's
   * defect one surface over, and the longest-lived one this screen has had.
   *
   * ADR 0208 made the credential's scope the ACCOUNT id and moved every stored
   * key onto it. This call kept omitting the argument, so `useProvider` sent its
   * `""` default and the runtime read the entry named `.speech.api_key` — a
   * scope no writer can produce and therefore one no machine has. From the
   * commit that landed the migration the strip has read `Needs key` on every
   * machine, always, while the connection card six rows away showed the key
   * present. The owner reported exactly that on 2026-08-17.
   *
   * **The suite could not have caught it**, and that is the second half of the
   * finding: the `useProvider` double took one argument and ignored the rest, so
   * a caller that dropped the scope got the vendor's answer from the mock and an
   * empty keyring entry from the runtime. A seam double that is kinder than the
   * seam turns 866 green cases into no evidence at all.
   */
  it("asks the runtime about the account the profile names, not about the vendor alone", async () => {
    runtimeConfig = configOn("openai");
    /* ONLY UNDER THE ACCOUNT. The `beforeEach` default is cleared on purpose:
       with a vendor-keyed answer still in the map this case would pass against
       the defect it exists to hold, which is how the defect survived. */
    provider.answers.clear();
    provider.answers.set("openai@connection-openai", providerStatus("openai"));

    const { container } = render(<WorkspaceWindow />);
    const strip = container.querySelector(".ws-win-foot");

    await waitFor(() => expect(strip).toHaveTextContent("Ready"));
    expect(strip).not.toHaveTextContent("Needs key");
    /* And the scope is stated rather than inferred from the badge: an empty one
       is the value that produced the report, so it is what the case names. */
    expect(provider.scopes).toContain("connection-openai");
    expect(provider.scopes.filter(Boolean)).not.toContain("");
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
    /* Developer Mode on, so the rail is measured across all four rows rather
       than across the three this build offers — the rule under test is that a
       railed row keeps its name in a tooltip, and it should be checked on as
       many rows as exist. */
    runtimeConfig = createAppConfig({ workspace_nav_rail: true, developer_mode: true });
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
