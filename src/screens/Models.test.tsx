import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ModelsScreen } from "./Models";
import { LANE_LABEL } from "./data";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";
import { renderInDeveloperMode } from "@/test/developerMode";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * ADR 0065 AND ADR 0067, ASSERTED. AI Models is still in the gallery, so its
 * fidelity is still measured in `screens.test.tsx`; this file is the other
 * half — that the one integrated lane really reads and writes, and that the
 * three that are not are DRAWN AND INERT rather than deleted or left looking
 * settable.
 */

/**
 * THE CAPABILITY BLOCK IS NO LONGER `{}` — and that is B1's deliverable
 * (ADR 0106, ADR 0124).
 *
 * It was an object with none of the nine fields, and the suite passed: the
 * proof that nothing consumed it. `AI Models` reads it now, so the mock has to
 * carry what the runtime carries. The empty block is still exercised below, as
 * its own case, where it must produce *the runtime did not answer* rather than
 * nine quiet `false`s.
 */
const CAPABILITIES = {
  transcription: true,
  chat_completion: true,
  speech_synthesis: false,
  local: false,
  requires_api_key: true,
  supports_prompt_bias: true,
  supports_language: true,
  supports_segments: true,
  model_management: false,
};

const ROLE_CREDENTIALS = [
  {
    provider: "groq",
    role: "speech",
    kind: "api_key",
    configured: true,
    storage: "os_secret_store",
    key_preview: "gsk_…4f2a",
    missing: null,
  },
  {
    provider: "groq",
    role: "chat",
    kind: "api_key",
    configured: true,
    storage: "os_secret_store",
    key_preview: "gsk_…4f2a",
    missing: null,
  },
];

/** The account a fresh config holds, mirroring `default_connection` — the one
 *  every credential row on the Cloud lane is scoped to (ADR 0208). */
const CLOUD_ACCOUNT = {
  id: "connection-default",
  label: "Groq",
  provider: "groq",
  base_url: "",
  model: "",
  plan: "",
};

const STATUS = {
  provider: "groq",
  /* Overwritten per call by the mock below, which echoes the account it was
     asked about exactly as `provider_status` does (ADR 0209). A fixed value here
     would make every credential row read *not read* and hide the check. */
  connection: "",
  default_profile: "fast",
  credential: { provider: "groq", configured: true, storage: "the OS secret store", key_preview: "gsk_…4f2a" },
  profiles: [],
  capabilities: CAPABILITIES,
  model_capabilities: {
    model: "whisper-large-v3-turbo",
    transcription_streaming: "unsupported",
    reports_detected_language: "unsupported",
    synthesis_streaming: "unsupported",
  },
  role_credentials: ROLE_CREDENTIALS,
  local_setup: null,
};

/** What the registry answers: three adapters, and seven drawn vendors without.
 *
 *  **`openai` joined on D1 and the fixture followed the runtime, not the other
 *  way round.** It was two entries, and every case below that means *a drawn
 *  vendor with no adapter* had picked its example from whatever was absent that
 *  day. Those cases now name Anthropic, which is drawn, unregistered, and the
 *  chat vendor the Translate and Assistant rows already point at. */
const REGISTERED = [
  { provider: "groq", roles: ["speech", "chat"], capabilities: CAPABILITIES },
  { provider: "openai", roles: ["speech", "chat"], capabilities: CAPABILITIES },
  {
    provider: "local",
    roles: ["speech", "chat"],
    capabilities: { ...CAPABILITIES, local: true, requires_api_key: false },
  },
  /* **THE FIRST HALF-ADAPTED VENDOR, AND THE FIXTURE MIRRORS IT** (D1a,
     ADR 0164). OpenRouter registers `speech` and not `chat`: ADR 0113 buys the
     speech role for a base URL and leaves the chat role to G3. Every entry
     before this one served every role its drawn row claimed, which is why the
     seam could answer *the vendor does not do this* and be right every time. */
  {
    provider: "openrouter",
    roles: ["speech"],
    capabilities: { ...CAPABILITIES, chat_completion: false },
  },
  /* Registered and not a chip: the self-hosted lane is a place, not a vendor on
     the Cloud provider row, so it has no drawn name — the same shape `local`
     has had since it was registered. */
  {
    provider: "self_hosted",
    roles: ["speech"],
    capabilities: { ...CAPABILITIES, chat_completion: false, requires_api_key: false },
  },
];

/** The vendors this fixture leaves without an adapter, by drawn name. */
const NO_ADAPTER = /Anthropic|Gemini|Mistral|xAI/;

/** Which account a `provider_status` call asked about. */
function askedAbout(args: unknown): string {
  return (args as { request?: { connection?: string } } | undefined)?.request?.connection ?? "";
}

/**
 * A status that names the account it was asked about (ADR 0209).
 *
 * **Every fixture answering `provider_status` has to echo, because the product
 * refuses to render a credential from an answer about another account.** A mock
 * that answered about nothing would put every credential row into *not read* —
 * so a case asserting a badge would fail for a reason that has nothing to do
 * with what it is testing, and a case NOT asserting one would quietly stop
 * covering the badge at all.
 */
function statusFor(args: unknown, base: Record<string, unknown> = STATUS) {
  return { ...base, connection: askedAbout(args) };
}

const TIERS = [
  { id: "free", label: "Free — 25 MiB per request", max_audio_bytes: 26_214_400, default: true },
  { id: "dev", label: "Developer — 25 MiB per request, higher rate limits", max_audio_bytes: 26_214_400, default: false },
];

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string, args?: unknown) => {
    if (command === "registered_providers") return REGISTERED;
    if (command === "provider_status") return statusFor(args);
    if (command === "resolve_provider_tiers") return TIERS;
    if (command === "resolve_capture_budget") {
      return {
        provider: "groq",
        ceiling_seconds: 819,
        ceiling_reason: "upload_limit",
        ceiling_detail: "the 25 MiB upload size on your free plan",
        auto_stop_seconds: 600,
        configured_auto_stop_seconds: 600,
        auto_stop_clamped: false,
        safety_margin_seconds: 81,
        recommended_auto_stop_seconds: 738,
        auto_stop_in_margin: false,
      };
    }
    if (command === "validate_provider_api_key") return { ok: true, provider: "groq", checked_with: "models" };
    return undefined;
  });
});

afterEach(cleanup);

/**
 * The `Model` select of one job row.
 *
 * Scoped to the row, because every job draws one and the seam's answer is
 * per job: the point of several of these cases is that two rows on ONE
 * connection carry two different sentences.
 */
async function modelRowOf(job: string): Promise<HTMLElement> {
  const row = (await screen.findByText(job)).closest(".ws-job");
  expect(row, `no job row named ${job}`).not.toBeNull();
  return within(row as HTMLElement).getByLabelText("Model");
}

/** THE CARD ONE ACCOUNT OWNS. Every account carries its own key row, plan row
 *  and actions since ADR 0223, so a query that does not name an account answers
 *  about whichever card came first — the same ambiguity the reader had when the
 *  key sat outside the accounts entirely. */
const accountBlock = (id: string) =>
  document.querySelector(`[data-account="${id}"]`) as HTMLElement;

/** OPEN THE CARD, BECAUSE ONLY ONE OF THEM IS (ADR 0224). A machine with four
 *  accounts opened onto four expanded cards and stopped being an inventory; the
 *  one the profile bills to is open on arrival and the rest fold. A case about
 *  a key row, a plan or a Remove button is a case about a card that has to be
 *  opened first, which is what a reader does too. */
async function openAccount(id: string): Promise<HTMLElement> {
  await waitFor(() => expect(accountBlock(id)).toBeTruthy());
  const card = accountBlock(id);
  const fold = within(card).getByRole("button", { name: /^(Expand|Collapse) / });
  if (fold.getAttribute("aria-expanded") !== "true") await userEvent.click(fold);
  await waitFor(() => expect(accountBlock(id).hasAttribute("data-open")).toBe(true));
  return accountBlock(id);
}

describe("AI Models, wired", () => {
  /**
   * **THE SEGMENT IS GONE AND THE RULE IT CARRIED IS NOT** (ADR 0223).
   *
   * This asked whether four lanes were drawn and two of them disabled. The
   * Accounts card lists every account on every lane now, so there is nothing
   * left to group and the two disabled options were two dead controls out of
   * four — which is the report that produced ADR 0223: *die Klicks bewirken
   * nichts, denkt der User*.
   *
   * ADR 0065's rule survives it whole and is what this case now measures: a lane
   * that cannot hold an account is NAMED with its reason rather than deleted.
   * `LockedLanes` is where that is said, and it says it once per lane because
   * the two are withheld for different reasons (B12).
   */
  it("names each lane that cannot hold an account, with its own reason", async () => {
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* ADR 0067. `local` IS a runtime provider, and the owner's answer was that
       being real is not the same as being finished — so it is named here beside
       a lane that has no adapter at all, and for a different reason. */
    expect(await screen.findByText(/Phase 5/)).toBeInTheDocument();
    expect(screen.getByText(/no adapter yet/i)).toBeInTheDocument();

    /* AND NEITHER IS OFFERED AS A CONTROL ANY MORE. A lane that cannot hold an
       account has nothing for the reader to press, which is what the segment
       gave it twice. */
    expect(screen.queryByRole("group", { name: "Lane" })).toBeNull();
  });

  /* AWAITED SINCE ADR 0124, and the wait is the change: which chip can be
     picked used to be the literal `["Groq"]` and is now the registry's answer,
     so it arrives with the command rather than with the first paint. Until it
     does every chip is inert — a chip enabled before the runtime has said
     anything is the fake readiness this screen's own comment warns about. */
  /**
   * **THE CHIPS MOVED TO THE ONE PLACE A VENDOR IS CHOSEN** (ADR 0223), so this
   * asks the Add panel rather than a row at the top of the screen.
   *
   * ADR 0124's rule is the one being kept and it is unchanged: every vendor the
   * registry carries can be picked, and every drawn one without an adapter says
   * why it cannot. What changed is that pressing a chip now DOES something —
   * ADR 0220 had left this row stating a vendor and writing nothing, which the
   * owner read as a dead control.
   */
  it("offers a chip for every vendor with an adapter, where the vendor is chosen", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Add account" }));

    const chips = await screen.findByRole("radiogroup", { name: "Who is this account with" });
    await waitFor(() =>
      expect(within(chips).getByRole("radio", { name: "Groq" })).not.toBeDisabled(),
    );
    await waitFor(() =>
      expect(within(chips).getByRole("radio", { name: "OpenAI" })).not.toBeDisabled(),
    );
    /* AND THE PRESS LANDS. A chip that sets nothing is what this row was before
       and what the report was about. */
    await userEvent.click(within(chips).getByRole("radio", { name: "OpenAI" }));
    await waitFor(() =>
      expect(within(chips).getByRole("radio", { name: "OpenAI" })).toBeChecked(),
    );
  });

  it("reads the credential the runtime holds and shows its preview, never the key", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("provider_status", expect.anything()));
    expect(await screen.findByText("gsk_…4f2a")).toBeInTheDocument();
    expect(screen.getByText("In the OS secret store. Never written to the config file.")).toBeInTheDocument();
  });

  it("says Not set rather than Set when the runtime has no key", async () => {
    invoked.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        return statusFor(args, {
          ...STATUS,
          credential: { ...STATUS.credential, configured: false, key_preview: null },
        });
      }
      if (command === "resolve_provider_tiers") return TIERS;
      return undefined;
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("Not set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("saves a key into the secret store and validates it, opening the field empty", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* The connection card's own Replace, not a job override's — the override
       rows are drawn and inert. */
    await screen.findByText("gsk_…4f2a");
    const [replace] = screen.getAllByRole("button", { name: "Replace" });
    await userEvent.click(replace);
    const field = screen.getByLabelText("API key") as HTMLInputElement;
    /* A masked value that looks editable invites appending to a secret nobody
       can see. The field opens empty. */
    expect(field.value).toBe("");

    await userEvent.type(field, "gsk_newkey");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("save_provider_api_key", {
        request: {
          provider: "groq",
          connection: CLOUD_ACCOUNT.id,
          api_key: "gsk_newkey",
        },
      }),
    );
    expect(invoked).toHaveBeenCalledWith("validate_provider_api_key", expect.anything());
  });

  it("offers the plans the provider declares and writes the chosen one", async () => {
    const patch = vi.fn();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    const plan = (await screen.findByLabelText("Account plan")) as HTMLSelectElement;
    expect([...plan.options].map((option) => option.textContent)).toEqual([
      "Free — 25 MiB per request",
      "Developer — 25 MiB per request, higher rate limits",
    ]);
    await userEvent.selectOptions(plan, "dev");
    /* UNDER THE VENDOR, NOT BESIDE IT (ADR 0167). The whole map is written
       because `patch` is a shallow merge, which is what the helper is for. */
    expect(patch).toHaveBeenCalledWith({
      connections: [{ ...CLOUD_ACCOUNT, plan: "dev" }],
    });
  });

  /** A plan already held on another account is not disturbed by writing this
   *  one — the failure mode a row that rebuilt the list from its own account
   *  would have, arriving through the door that was supposed to fix it
   *  (ADR 0167's rule on ADR 0208's object). */
  it("writes one account's plan without dropping another's", async () => {
    const patch = vi.fn();
    const config = createAppConfig();
    const other = {
      id: "connection-openrouter",
      label: "OpenRouter",
      provider: "openrouter",
      base_url: "",
      model: "",
      plan: "standard",
    };
    config.connections = [CLOUD_ACCOUNT, other];
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    /* THE PLAN IS THE CARD'S, so the select is reached through the card (ADR
       0223). Two accounts on screen are two plan rows; before this they were one
       row below a list, and which account it wrote to was a derivation. */
    await waitFor(() => expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy());
    await userEvent.selectOptions(
      within(accountBlock(CLOUD_ACCOUNT.id)).getByLabelText("Account plan"),
      "dev",
    );
    expect(patch).toHaveBeenCalledWith({
      connections: [{ ...CLOUD_ACCOUNT, plan: "dev" }, other],
    });
  });

  /** The default plan is stored as absence, on both sides of the seam: picking
   *  it back removes the entry rather than writing the default's own id. */
  it("stores the default plan as absence rather than as its id", async () => {
    const patch = vi.fn();
    const config = createAppConfig();
    config.connections = [{ ...CLOUD_ACCOUNT, plan: "dev" }];
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    const plan = (await screen.findByLabelText("Account plan")) as HTMLSelectElement;
    expect(plan).toHaveValue("dev");
    await userEvent.selectOptions(plan, "");
    expect(patch).toHaveBeenCalledWith({ connections: [CLOUD_ACCOUNT] });
  });

  it("states the runtime's recording ceiling rather than the drawing's ~26 min", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("13:39")).toBeInTheDocument();
    expect(screen.queryByText("~26 min")).not.toBeInTheDocument();
  });

  /**
   * **THE LANGUAGE PAIR IS STATED HERE AND EDITED ON PROFILES** (speech track
   * B18, ADR 0068).
   *
   * This case held the opposite and was right to: both rows were a drawing over
   * two fields nothing could set, so *drawn and inert with the reason on it* was
   * the honest report. What made it wrong is that the reason was the wrong one —
   * `Not integrated yet` names a lane that has no adapter, and this lane has
   * one: `speech.language` and `language_locked` reach the capture snapshot, the
   * drift check and both cloud adapters. The value was reachable by the runtime
   * and unreachable by the reader, which is ADR 0020's failure class from the
   * other end and not an unbuilt lane.
   *
   * So the repair is not a control on this screen. ADR 0068 rules that a
   * per-profile value is edited on Profiles and stated here with the tag that
   * opens it — the shape `Into` and `Keep the profile's words` have used since,
   * and the one the owner named.
   */
  it("states the profile's language instead of drawing a control nothing could set", async () => {
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.speech = { ...active.speech!, language: "de", language_locked: true };

    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* NO CONTROL AT ALL, rather than a disabled one: the row is a reading now,
       and a disabled select would still be claiming this is where it is set. */
    await waitFor(() => expect(screen.queryByLabelText("Language")).not.toBeInTheDocument());
    expect(screen.queryByLabelText("Pin this language")).not.toBeInTheDocument();

    /* Scoped to the row rather than to the screen: `Into` offers `German` as an
       option one card down, and a bare text query would pass on the drawing of
       a different setting. */
    const row = screen.getByText("Language").closest(".ws-row")!;
    expect(within(row as HTMLElement).getByText("German")).toBeInTheDocument();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  /** And an unset language reads as the state it is rather than as a language:
   *  every profile is here until somebody picks one, the adapters drop the hint,
   *  and there is nothing for the pin to hold. */
  it("says there is nothing to pin where no language was chosen", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("Auto-detect")).toBeInTheDocument();
    expect(screen.getByText("Nothing to pin")).toBeInTheDocument();
  });

  /**
   * **THE SEAM, ASSERTED — the test ADR 0106 requires before any document may
   * call the mirror a guard.** A provider whose `ProviderCapabilities` denies a
   * role produces a row that cannot be operated and states why, and the *why*
   * is the runtime's rather than the blanket sentence: `AI Models` used to say
   * "Not integrated yet" over a vendor that is integrated and merely cannot do
   * this particular job, which is the conflation that record is about.
   */
  it("states the denied role, from the runtime, on the rows that would run it", async () => {
    invoked.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        /* Groq, integrated and holding a key, that this build cannot ask to
           listen. Not a real state today and that is the point: the two
           registered lanes agree with their drawing by accident, and ten will
           not. */
        return statusFor(args, {
          ...STATUS,
          capabilities: { ...CAPABILITIES, transcription: false },
        });
      }
      if (command === "resolve_provider_tiers") return TIERS;
      return undefined;
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const model = await modelRowOf("Dictation");
    await waitFor(() =>
      expect(model).toHaveAttribute("title", expect.stringContaining("speech recognition")),
    );
    expect(model).toBeDisabled();
    /* Three reasons, three sentences: the denial is not dressed as the blanket
       one. */
    expect(model.getAttribute("title")).not.toContain("Not integrated yet");

    /* And the writing jobs on the same connection are untouched by a denial
       that is not theirs — the axis the runtime denied is speech. **A row the
       runtime has no complaint about now carries no sentence at all** (ADR 0211):
       the blanket *not integrated yet* was true of a screen that offered one
       lane, and a task-first row states what IS rather than what most of the
       screen used to be. */
    const cleanup = await modelRowOf("Cleanup");
    expect(cleanup).not.toBeDisabled();
    expect(cleanup.getAttribute("title") ?? "").not.toContain("speech recognition");
  });

  /**
   * **THE EMPTY BLOCK, WHICH USED TO PASS.** `capabilities: {}` was the mock
   * this file carried while the suite went green — the proof nothing consumed
   * it. It must now read as *the runtime did not answer*, never as nine quiet
   * `false`s: a capability defaulting to absent is a row silently inert, which
   * ADR 0106 calls the same defect one layer down.
   */
  it("reports an unanswered capability block instead of reading it as a denial", async () => {
    invoked.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") return statusFor(args, { ...STATUS, capabilities: {} });
      if (command === "resolve_provider_tiers") return TIERS;
      return undefined;
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const model = await modelRowOf("Dictation");
    await waitFor(() =>
      expect(model).toHaveAttribute("title", expect.stringContaining("without saying what it can do")),
    );
    /* The distinction the whole fourth answer exists for: nine quiet `false`s
       would have read as a denial, and a denial is a statement about the
       vendor rather than about the read. */
    expect(model.getAttribute("title")).not.toContain("does not do");
  });

  /**
   * The registry decides which chips can be picked, not a literal. It was
   * `selectable={wired ? ["Groq"] : undefined}` until ADR 0124, so the first
   * adapter to land would have been offered here only if somebody remembered
   * to edit that line.
   */
  it("offers a chip for the vendors the registry carries and names why the rest cannot", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* IN THE ADD PANEL, which is where a vendor is chosen since ADR 0223. The
       rule is ADR 0124's and unchanged: the registry decides what can be picked
       and the drawing names the rest with its reason. */
    await userEvent.click(await screen.findByRole("button", { name: "Add account" }));
    const chips = await screen.findByRole("radiogroup", { name: "Who is this account with" });
    await waitFor(() =>
      expect(within(chips).getByRole("radio", { name: "Groq" })).not.toBeDisabled(),
    );

    /* THE EXAMPLE MOVED BECAUSE THE REGISTRY DID. This named OpenAI until D1
       registered it, which is the case working rather than breaking: what the
       assertion means is *a vendor the drawing names and the registry does
       not*, and Anthropic is that vendor now. */
    const anthropic = within(chips).getByRole("radio", { name: "Anthropic" });
    expect(anthropic).toBeDisabled();
    expect(anthropic).toHaveAttribute("title", expect.stringContaining("no adapter"));
    expect(within(chips).getByRole("radio", { name: "OpenAI" })).not.toBeDisabled();
  });

  /* One read, not two. The credential row used to run its own `provider_status`
     beside the seam's, which is two reads of one OS secret store on one screen
     open and two components with two opinions of one credential. */
  it("reads the provider status once per vendor and never twice for one", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("gsk_…4f2a");
    /* ONCE PER VENDOR, NOT ONCE ALTOGETHER. This asserted a single call, which
       was the same sentence while one adapter existed and stopped being it when
       D1 added a second Cloud vendor the seam legitimately asks about. What it
       has always meant is that the credential row does not run a read of its
       own beside the seam's — so the check is for a DUPLICATE, and it survives
       the third adapter without being edited again. */
    const read = invoked.mock.calls
      .filter(([command]) => command === "provider_status")
      .map(([, payload]) => (payload as { request: { provider: string } }).request.provider);
    expect(read.length).toBeGreaterThan(0);
    expect(new Set(read).size).toBe(read.length);
  });

  /* The Translate job row, which is where the rule above splits. Its four rows
     are not model choices — they are the mode's own settings and have had a
     config home since the commit that added the mode (ADR 0041) — so two of
     them act. The other two are the profile's and are stated rather than
     edited, per ADR 0068. */
  it("states the two Translate settings the drawing scopes to the profile, and edits neither", async () => {
    /* ADR 0068 already ruled that a per-profile value does not belong on this
       machine-scope screen. These two are stated here, showing what the active
       profile holds, and the `Per profile` tag beside each is the door to where
       they are set. */
    const config = createAppConfig();
    config.text_profiles[0].modes = {
      ...config.text_profiles[0].modes!,
      translate_target_language: "de",
      translate_keep_profile_words: false,
    };
    const patch = vi.fn();
    render(
      <ModelsScreen runtime={createWorkspaceRuntime({ active: true, config, patch })} />,
    );

    const into = (await screen.findByLabelText("Into")) as HTMLSelectElement;
    expect(into).toBeDisabled();
    expect(into.value).toBe("de");
    expect(screen.getByLabelText("Keep the profile's words")).toBeDisabled();
    expect(screen.getByLabelText("Keep the profile's words")).not.toBeChecked();
    expect(patch).not.toHaveBeenCalled();
  });

  it("writes the two the drawing leaves unscoped straight into the config", async () => {
    const patch = vi.fn();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    const sameLanguage = await screen.findByRole("group", {
      name: "When you already dictated in that language",
    });
    await userEvent.click(within(sameLanguage).getByRole("button", { name: "Pass through" }));
    expect(patch).toHaveBeenCalledWith({ translate_same_language: "pass_through" });

    const addressForm = screen.getByRole("group", { name: "Address form" });
    await userEvent.click(within(addressForm).getByRole("button", { name: "Informal" }));
    expect(patch).toHaveBeenCalledWith({ translate_address_form: "informal" });
  });

  /**
   * **THE ASSISTANT'S NAME IS A CONTROL THAT WRITES, AND IT WAS ONE THAT DID
   * NOT.**
   *
   * It shipped as a live `Field` with a drawn default and no writer anywhere in
   * the tree — not a `DrawnField`, so nothing disabled it and nothing carried a
   * reason: a reader could type into it and watch the value survive until the
   * next render. The runtime reads `modes.agent_name` on every dictation
   * (`active_text_profile_agent_name`), and it is also what decides when Auto
   * routes one to the assistant, so this was a routing setting with a control
   * that stored nothing.
   */
  it("writes the assistant's name to the active profile, and states which profile that is", async () => {
    const config = createAppConfig();
    config.text_profiles[0].modes = {
      ...config.text_profiles[0].modes!,
      agent_name: "WordScript",
    };
    const patch = vi.fn();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config, patch })} />);

    const field = (await screen.findByLabelText("Name you address it by")) as HTMLInputElement;
    expect(field).not.toBeDisabled();

    await userEvent.clear(field);
    await userEvent.type(field, "Scribe");
    await userEvent.tab();

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const calls = patch.mock.calls;
    const written = calls[calls.length - 1][0] as {
      text_profiles?: { id: string; modes?: { agent_name?: string } }[];
    };
    expect(
      written.text_profiles?.find((profile) => profile.id === config.active_text_profile_id)?.modes
        ?.agent_name,
    ).toBe("Scribe");
  });

  /**
   * ADR 0088. The row exists because a model call paid on every dictation was
   * named on no surface; it does not open because ADR 0077 resolves that model
   * through `chat_model_for_provider` and there is nothing to set.
   *
   * BOTH HALVES ARE ASSERTED, because the failure mode is turning it into a
   * `LaneJobRow` "for consistency" — which would draw a chevron, a model picker
   * and an override row for a choice the runtime does not read. That is the
   * fake affordance rule 7 forbids, and it would also cost the screen the
   * measured 6 | 6 it now carries.
   */
  it("states the title call without offering a setting for it", () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const titles = screen.getByText("Titles").closest(".ws-job");
    expect(titles).not.toBeNull();
    /* It runs a model, and says which without naming a second one to pick. */
    expect(within(titles as HTMLElement).getByText("Runs the assistant's model")).toBeVisible();
    /* Nothing to open: not a <details>, and no control inside it. */
    expect(titles!.tagName).toBe("DIV");
    expect(titles!.querySelector("summary")).toBeNull();
    expect(within(titles as HTMLElement).queryByRole("combobox")).toBeNull();
  });
});

/**
 * THE DOOR D1 OPENED (ADR 0096 step 1).
 *
 * Every case here failed before the OpenAI adapter landed, and each for a
 * different reason: the chip row held its choice in local state and wrote
 * nothing, the credential row spelled `"groq"` in five places, and the job rows
 * read the connection off `data.ts`. With one registered vendor none of that
 * was visible; with two, each one is a row stating a vendor the runtime is not
 * using.
 */
describe("AI Models, choosing the connection", () => {
  /** The active profile's provider axis, out of whatever the patch carried. */
  function axisOf(patch: { text_profiles?: { id: string; providers?: unknown }[] }, id: string) {
    return patch.text_profiles?.find((profile) => profile.id === id)?.providers;
  }

  /** One account's block in the inventory (speech track B17).
   *
   *  **Two accounts on one vendor make every control in there ambiguous by
   *  name** — two `Remove` buttons, two `Rename`s — and that is a fact about the
   *  surface before it is a fact about its tests: an assertion that has to guess
   *  which one it pressed is the same guess a reader makes. The block carries
   *  the account id, so both stop guessing. */

  /** A second account on one vendor, which is the case the whole axis exists
   *  for: an employer's Groq key and a private one cannot both exist while the
   *  credential is keyed by vendor (ADR 0208).
   *
   *  **AND CREATING ONE ASKS WHO IT IS WITH** (B17). `+ New` used the shown
   *  account's vendor, so it could only ever make a second account on the vendor
   *  already on screen; the chip row above was the only route onto another one,
   *  which is the duty ADR 0212 wanted it to lose. */
  it("creates an account on a vendor the reader picks, with a name they gave it", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = createAppConfig();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    await user.click(await screen.findByRole("button", { name: "Add account" }));
    /* THE VENDOR IS A CHIP AND NOT A `<Select>` (ADR 0223) — the logos moved to
       the one control that decides the vendor, from a row that showed them and
       could not be pressed. */
    await user.click(
      within(
        await screen.findByRole("radiogroup", { name: "Who is this account with" }),
      ).getByRole("radio", { name: "OpenAI" }),
    );
    await user.type(screen.getByLabelText("Account name"), "Personal");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const written = patch.mock.calls[0][0] as {
      connections?: { id: string; label: string; provider: string }[];
      text_profiles?: unknown;
    };
    expect(written.connections).toEqual([
      CLOUD_ACCOUNT,
      expect.objectContaining({ provider: "openai", label: "Personal" }),
    ]);
    /* **AND IT DOES NOT ASSIGN** (ADR 0212). `+ New` created an account AND
       repointed the active profile on one press, while the row beside it already
       carried a docblock saying adding and assigning are two acts. **The rule
       outlived the drawing that carried it**: assigning is the radio on each
       account card since ADR 0223, and creating one still must not do it. */
    expect(written.text_profiles).toBeUndefined();
  });

  /** An empty name takes the vendor's, because an account with no name is one
   *  no sentence on this screen can refer to. */
  it("names a new account after its vendor when the reader gave it none", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config: createAppConfig() })} />);

    await user.click(await screen.findByRole("button", { name: "Add account" }));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const written = patch.mock.calls[0][0] as { connections?: { label: string }[] };
    expect(written.connections?.[1]?.label).toBeTruthy();
  });

  /**
   * **WHICH ACCOUNT A PROFILE BILLS TO IS SET WHERE THE JOBS ARE** (B17,
   * ADR 0212).
   *
   * It was a `Select` inside the `Account` row on the Accounts card — the card
   * headed *what this machine can bill jobs to* — so the one control that
   * decides who pays lived in the one card that is not about the profile.
   * ADR 0212 split adding an account from assigning one and the split survived
   * at the lane level and not at the row level.
   */
  /**
   * **THE PICK IS THE ACCOUNT'S OWN CARD** (ADR 0223).
   *
   * It was a `<Select>` at the head of *What runs what*, two sections below the
   * card that lists the accounts — ADR 0220 put it there deliberately, on the
   * argument that the assignment governs the job rows rather than the inventory.
   * The argument is sound and the drawing was not: the owner could not see what
   * an account was FOR from the card that showed it. One radio per card writes
   * the same field, and the row below states rather than sets.
   */
  it("bills the profile to the account whose card is pressed", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" },
    ];
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    await waitFor(() => expect(accountBlock("connection-groq")).toBeTruthy());
    await user.click(within(accountBlock("connection-groq")).getByRole("radio"));

    expect(axisOf(patch.mock.calls[0][0], config.active_text_profile_id)).toEqual({
      default: "connection-groq",
      overrides: {}, models: {},
    });
  });

  /** **EVERY ACCOUNT, NOT ONE LANE'S.** `providers.default` is a connection id
   *  and a connection carries its own vendor, so *dictation on Cloud with the
   *  assistant on your own server* is a state the config has accepted since
   *  ADR 0094's axis met ADR 0208's object. A picker scoped to the shown lane
   *  would make it storable and unpickable, which is the defect `accountChoices`
   *  was written to end one row down. */
  it("offers every account this machine holds, grouped by lane and vendor", async () => {
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      {
        id: "connection-self_hosted",
        label: "The office box",
        provider: "self_hosted",
        base_url: "http://10.0.0.2:8080/v1",
        model: "",
        plan: "",
      },
    ];
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* **THE CARDS ARE THE LIST** (ADR 0223). This read a `<Select>` grouped by
       lane and vendor; grouping was what the select needed to make a flat list
       of every account legible, and a card per account needs no grouping because
       each one says who it is with on its own header. */
    await waitFor(() => expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy());
    expect(accountBlock("connection-self_hosted")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  /**
   * **THE INVENTORY IS AN INVENTORY** (B17). The card is headed *what this
   * machine can bill jobs to* and it rendered exactly one account — the one
   * `accountForLane` derived, by a rule no reader could see. Measured in the
   * native host at 625 CSS px, that one row was 171 px tall.
   */
  it("shows every account at once, with its vendor and its key state", async () => {
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" },
    ];
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    await waitFor(() => expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy());
    expect(accountBlock("connection-groq")).toBeTruthy();
    /* THE VENDOR ON EACH, EXCEPT WHERE IT IS THE NAME. Two accounts with
       reader-given names are otherwise two words with nothing saying who either
       one is with — and a first account is named after its vendor, so on that
       one the badge would print `Groq Groq`. Found by rendering the card at
       625 px and reading it, which is the ninth defect on this surface a green
       suite did not hold. */
    expect(within(accountBlock("connection-groq")).getByText("Groq")).toBeInTheDocument();
    expect(within(accountBlock(CLOUD_ACCOUNT.id)).getAllByText("Groq")).toHaveLength(1);
    /* And who uses it, derived and never stored (ADR 0123): rotating this key
       touches everything named here. Inside the card, so each one has to be
       opened — the used-by line is a fact about an account and not part of the
       three the collapsed header states (ADR 0224). */
    expect(
      within(await openAccount(CLOUD_ACCOUNT.id)).getByText(/Billed by General writing/),
    ).toBeInTheDocument();
    expect(
      within(await openAccount("connection-groq")).getByText("No profile bills here yet."),
    ).toBeInTheDocument();
  });

  /**
   * **THE SCREEN HAS TWO OWNERS AND SAYS SO THREE TIMES, EACH WHERE IT IS TRUE**
   * (ADR 0226).
   *
   * `connections` is an `AppConfig` field, so an account's name, key, plan and
   * endpoint are the MACHINE's and every profile reads the same ones. Exactly one
   * control on that card is the profile's — the radio. The `Note` that used to
   * stand above the cards claimed *the accounts and models below are this
   * profile's*, which is false for the accounts, and it claimed it in two lines
   * of prose over a screen the reader had already called too wordy.
   *
   * **The deletion is asserted rather than assumed**, because prose is the
   * cheapest thing to put back: a screen that grows a second explanation of its
   * own scope has undone this step whatever else it says.
   */
  it("names the machine, the profile, and the one control that crosses between them", async () => {
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" },
    ];
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    await waitFor(() => expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy());
    const profile = "General writing";

    // The lead names both owners, which is what the note used to do for one.
    expect(screen.getByText(/Accounts belong to this machine/)).toBeInTheDocument();
    expect(
      screen.getByText(/What each job runs on belongs to/),
    ).toHaveTextContent(profile);

    // The inventory says it is the machine's.
    expect(screen.getByText(/Every profile sees the same list/)).toBeInTheDocument();

    /* THE CHIP IS ON THE PICKED CARD AND ON NO OTHER. Both halves matter: the
       first is the fact, the second is what keeps it from becoming furniture. */
    expect(
      within(accountBlock(CLOUD_ACCOUNT.id)).getByText(profile),
    ).toBeInTheDocument();
    expect(within(accountBlock("connection-groq")).queryByText(profile)).toBeNull();

    /* AND THE NAME IS NOT REPEATED PAST THAT. The owner read the shipped screen
       and struck two `ScopeTag`s off it — one on the *What runs what* head, one
       in the `This profile bills to` row — as the third and fourth copies of one
       word. A tag belongs on a control that WRITES the profile (ADR 0209); both
       of those state, and the statement is already made above them. */
    const jobs = screen.getByText("What runs what").closest(".ws-sec-head");
    expect(within(jobs as HTMLElement).queryByText(profile)).toBeNull();
    const bills = screen.getByText("This profile bills to").closest(".ws-row");
    expect(within(bills as HTMLElement).queryByText(profile)).toBeNull();

    /* THE NOTE IS GONE AND MAY NOT COME BACK. Its claim about the accounts was
       the defect; its shape — a paragraph explaining the screen above it — was
       the report that produced this step. */
    expect(screen.queryByText(/the accounts and models below are this profile/i)).toBeNull();
  });

  /**
   * **AN INVENTORY YOU CAN SEE THE WHOLE OF** (ADR 0224).
   *
   * The reader's report: *irgendwann hat man viele Accounts und man hat den
   * Überblick nicht mehr*. Every card carries its own key, plan, endpoint and
   * used-by line since ADR 0223, so four accounts opened onto four expanded
   * cards — the defect ADR 0220 fixed at the list level, arrived at again from
   * the other direction.
   *
   * WHAT A COLLAPSED CARD STILL SAYS is the assertion that matters: the three
   * facts B17 asks to be visible at once — whose it is, what vendor it is with,
   * and whether it holds a key — are the header's, and the header is what stays.
   */
  it("folds every account but the one this profile bills to", async () => {
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" },
    ];
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    await waitFor(() => expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy());
    expect(accountBlock(CLOUD_ACCOUNT.id).hasAttribute("data-open")).toBe(true);
    expect(accountBlock("connection-groq").hasAttribute("data-open")).toBe(false);

    // The name, the vendor and the key state survive the fold.
    const folded = within(accountBlock("connection-groq"));
    expect(folded.getByText("Employer")).toBeInTheDocument();
    expect(folded.getByText("Groq")).toBeInTheDocument();
    expect(folded.getByText(/^Key (set|not read|missing)$|^No key yet$/)).toBeInTheDocument();

    /* AND THE FOLD IS NOT THE PICK. Opening a card must not move which account
       the profile bills to — they were one control before this step and the
       whole point of the split is that they answer different questions. */
    await openAccount("connection-groq");
    expect(accountBlock(CLOUD_ACCOUNT.id).hasAttribute("data-open")).toBe(true);
    expect(
      within(accountBlock(CLOUD_ACCOUNT.id)).getByRole("radio"),
    ).toHaveAttribute("aria-checked", "true");
  });

  /**
   * **THE SENTENCE THE STEP EXISTS FOR, ON THE SURFACE** (ADR 0208).
   *
   * The Rust side asserts that a profile switch moves which entry answers; this
   * asserts the other half — that a key typed while one account is selected is
   * stored under THAT account and cannot land on the other one. Both accounts
   * are Groq, which is the pair the vendor-keyed entry could not tell apart.
   */
  it("saves a key under the account whose card it was typed on, not under the vendor", async () => {
    const user = userEvent.setup();
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" },
    ];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "connection-groq", overrides: {}, models: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* **REACHED THROUGH THE CARD** (ADR 0223). There is no *selected* account
       any more — every card carries its own key row, which is exactly why the
       reader can no longer be wrong about whose key they are typing. */
    await waitFor(() => expect(accountBlock("connection-groq")).toBeTruthy());
    const card = () => within(accountBlock("connection-groq"));
    await user.click(card().getByRole("button", { name: /^(Replace|Add)$/ }));
    await user.type(card().getByLabelText("API key"), "gsk_the_employers_key");
    await user.click(card().getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("save_provider_api_key", {
        request: {
          provider: "groq",
          connection: "connection-groq",
          api_key: "gsk_the_employers_key",
        },
      }),
    );
  });

  /**
   * **REMOVING THE ACCOUNT YOU ARE ON REPOINTS YOU, AND NOBODY ELSE**
   * (ADR 0209).
   *
   * ADR 0208's rule — a deleted account is named, never replaced — is about
   * another profile: choosing who pays for a writing style you are not looking at
   * is not a deletion's decision. Applied to the profile whose reader pressed the
   * button it produced a surface with nothing on it, because this row is scoped
   * to the account and the pointer no longer resolved to one: no vendor, no
   * list, no rename, and an *Add* that returned early. The way back was a vendor
   * chip, which nobody would think to look for.
   */
  it("repoints the profile that removes its own account, and only that one", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = createAppConfig();
    const employer = { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" };
    config.connections = [CLOUD_ACCOUNT, employer];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: employer.id, overrides: {}, models: {} };
    /* A SECOND PROFILE ON THE SAME ACCOUNT, which is the half of ADR 0208 that
       still holds: it keeps naming what it named and its jobs go inert. */
    config.text_profiles.push({
      ...active,
      id: "profile-other",
      label: "Other",
      providers: { default: employer.id, overrides: {}, models: {} },
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    await waitFor(() => expect(accountBlock(employer.id)).toBeTruthy());
    const remove = within(accountBlock(employer.id)).getByRole("button", { name: `Remove ${employer.label}` });
    expect(remove).toHaveAttribute(
      "title",
      "General writing moves to another account. 1 other profile keeps billing here and its jobs stop.",
    );
    await user.click(remove);
    /* THE PRESS OPENS THE QUESTION AND DESTROYS NOTHING (ADR 0210). */
    expect(patch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove account" }));

    const written = patch.mock.calls[0][0] as {
      connections?: unknown;
      text_profiles?: { id: string; providers?: unknown }[];
    };
    expect(written.connections).toEqual([CLOUD_ACCOUNT]);
    expect(axisOf(written, config.active_text_profile_id)).toEqual({
      default: CLOUD_ACCOUNT.id,
      overrides: {}, models: {},
    });
    expect(axisOf(written, "profile-other")).toEqual({
      default: employer.id,
      overrides: {}, models: {},
    });
  });

  /**
   * **A REMOVED ACCOUNT TAKES ITS CREDENTIAL WITH IT** (ADR 0210).
   *
   * `buildConnectionRemovalPatch` wrote `connections` and nothing else, so the
   * key stayed in the OS store under a scope no surface can show and no reader
   * can clear — word for word the state ADR 0208 refused to let the migration
   * create, reached from the other end. The clear runs first: it is the only
   * call that still knows the account's id.
   */
  it("clears the account's credential and says so before it is confirmed", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = createAppConfig();
    const employer = { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" };
    config.connections = [CLOUD_ACCOUNT, employer];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: employer.id, overrides: {}, models: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    await waitFor(() => expect(accountBlock(employer.id)).toBeTruthy());
    await user.click(within(accountBlock(employer.id)).getByRole("button", { name: `Remove ${employer.label}` }));
    /* THE QUESTION NAMES WHAT GOES, and the key is the half that cannot be put
       back by anything this product can do. */
    expect(screen.getByText("Remove the account “Employer”?")).toBeInTheDocument();
    expect(
      screen.getByText(/key is deleted from the OS secret store and cannot be put back/),
    ).toBeInTheDocument();
    expect(invoked).not.toHaveBeenCalledWith("clear_connection_credentials", expect.anything());

    await user.click(screen.getByRole("button", { name: "Remove account" }));

    expect(invoked).toHaveBeenCalledWith("clear_connection_credentials", {
      request: { provider: "groq", connection: employer.id },
    });
    expect((patch.mock.calls[0][0] as { connections?: unknown }).connections).toEqual([
      CLOUD_ACCOUNT,
    ]);
  });

  /**
   * **A SECRET STORE THAT DOES NOT ANSWER KEEPS THE ACCOUNT** (ADR 0210).
   *
   * The order is what makes the failure safe rather than the try/catch: a config
   * write that landed while the keyring call failed would leave the key with
   * nothing naming it, since the account id is the only handle onto it.
   */
  it("keeps the account when the credential could not be cleared", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = createAppConfig();
    const employer = { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" };
    config.connections = [CLOUD_ACCOUNT, employer];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: employer.id, overrides: {}, models: {} };
    const answering = invoked.getMockImplementation()!;
    invoked.mockImplementation(async (command: string, args?: Parameters<typeof invoke>[1]) => {
      if (command === "clear_connection_credentials") {
        throw {
          message:
            "The OS secret store did not answer, so this account still holds its credential: locked",
        };
      }
      return answering(command, args);
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    await waitFor(() => expect(accountBlock(employer.id)).toBeTruthy());
    await user.click(within(accountBlock(employer.id)).getByRole("button", { name: `Remove ${employer.label}` }));
    await user.click(screen.getByRole("button", { name: "Remove account" }));

    expect(patch).not.toHaveBeenCalled();
    expect(await screen.findByText(/this account still holds its credential/)).toBeInTheDocument();
  });

  /** With nobody else on it the sentence is one clause, because a count of zero
   *  other profiles is not a warning. */
  it("states only the move when no other profile names the account", async () => {
    const patch = vi.fn();
    const config = createAppConfig();
    const employer = { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" };
    config.connections = [CLOUD_ACCOUNT, employer];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: employer.id, overrides: {}, models: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    await waitFor(() => expect(accountBlock(employer.id)).toBeTruthy());
    expect(
      within(accountBlock(employer.id)).getByRole("button", { name: `Remove ${employer.label}` }),
    ).toHaveAttribute("title", "General writing moves to another account.");
  });

  /**
   * **THE STATE EVERY BUILD BEFORE THIS ONE COULD WRITE TO DISK** (ADR 0209).
   *
   * A profile naming an account this machine no longer holds is not repaired on
   * load — ADR 0208 keeps the name on purpose — so the row has to be able to
   * state it and get out of it. It stated nothing: an empty select over an empty
   * list, and an *Add* button that was live and did nothing.
   */
  it("states a pointer that resolves to nothing on the rows it stops, and offers every account as the way out", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = createAppConfig();
    const server = {
      id: "connection-self_hosted",
      label: "The office box",
      provider: "self_hosted",
      base_url: "http://10.0.0.2:8080/v1",
      model: "",
      plan: "",
    };
    config.connections = [CLOUD_ACCOUNT, server];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "connection-deleted", overrides: {}, models: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    /* **IT IS STATED WHERE IT BITES NOW** (ADR 0212). The dangling default was
       reported on the `Account` row, which was the only place that knew about it
       while the card followed the profile. The card follows the shown LANE, and
       what a dead pointer actually breaks is the jobs: every row that follows the
       profile says so, and the picker beside the sentence is the way out. */
    const dictation = (await screen.findByText("Dictation")).closest(".ws-job") as HTMLElement;
    await waitFor(() => expect(within(dictation).getByText("Account gone")).toBeInTheDocument());

    /* EVERY ACCOUNT, NOT ONE VENDOR'S AND NOT ONE LANE'S. */
    const runsOn = within(dictation).getByLabelText("Runs on") as HTMLSelectElement;
    expect([...runsOn.options].map((option) => option.textContent)).toEqual([
      "Follow the profile · no account",
      "Groq",
      "The office box",
    ]);

    await user.selectOptions(runsOn, CLOUD_ACCOUNT.id);
    expect(axisOf(patch.mock.calls[0][0], config.active_text_profile_id)).toEqual({
      default: "connection-deleted",
      overrides: { dictation: CLOUD_ACCOUNT.id },
      models: {},
    });
  });

  /**
   * **A `ScopeTag` BELONGS ON A CONTROL THAT WRITES THE PROFILE, AND THIS ROW
   * STOPPED BEING ONE** (ADR 0226, correcting what this case asserted).
   *
   * It was written for ADR 0209's rule — a row that repoints a profile has to
   * name it — and it kept asserting the tag after ADR 0223 turned the row into a
   * statement and moved the write onto the account card's radio. So it was
   * holding the surface to a rule the surface no longer falls under, and the
   * cost showed up on the shipped screen: the owner counted the profile's name
   * four times on one view and struck two of them, this row among them.
   *
   * **The rule itself is unchanged and still has cases** — every control inside
   * a job row that writes the profile carries its tag. What went is a tag on a
   * sentence.
   */
  it("states which account the profile bills to without a scope tag on the statement", async () => {
    const config = createAppConfig();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    const row = (await screen.findByText("This profile bills to")).closest(".ws-row");
    // The fact is still stated — the account it resolves to is what the row is for.
    expect(within(row as HTMLElement).getByText("Groq")).toBeInTheDocument();
    expect(
      within(row as HTMLElement).queryByRole("button", { name: /General writing/ }),
    ).toBeNull();
  });

  /** **AND NOTHING IN THE INVENTORY IS A CONTROL SCOPED TO A PROFILE**, which is
   *  the same rule read backwards: the tag was on the old `Account` row because
   *  the select under it repointed the profile.
   *
   *  **The picked card DOES name the profile since ADR 0226**, and that is not a
   *  reversal — it is a statement about which pick is in force, not a tag on a
   *  control, so it is a `<span>` and not the button this asserts the absence
   *  of. Both halves are checked, because a case that only forbids would pass
   *  just as well if the card said nothing at all. */
  it("names the profile on the picked card without making it a scoped control", async () => {
    const config = createAppConfig();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    await waitFor(() => expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy());
    const card = within(accountBlock(CLOUD_ACCOUNT.id));
    expect(card.getByText("General writing")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: /General writing/ })).toBeNull();
  });

  /**
   * **THE DEFECT THE ECHO EXISTS FOR** (ADR 0209).
   *
   * The status is keyed by vendor and the credential rows are scoped to an
   * account, so a vendor with two accounts had one answer and two rows: the badge
   * read the first account's key while the field wrote the selected one's. A new
   * account arrived carrying the old one's `gsk_…4f2a` and a green *Set*.
   */
  it("refuses to report a key from an answer about another account", async () => {
    const config = createAppConfig();
    const employer = { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" };
    config.connections = [CLOUD_ACCOUNT, employer];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: employer.id, overrides: {}, models: {} };

    /* The runtime answering about the OTHER account — which is what a stale read
       is, and what one render after every account switch holds. */
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") return { ...STATUS, connection: CLOUD_ACCOUNT.id };
      if (command === "resolve_provider_tiers") return TIERS;
      return undefined;
    });

    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* SCOPED TO THE CARD, because every account carries its own key row now
       (ADR 0223) and an unscoped query would answer about whichever card came
       first. That the query HAD to be scoped is the change working: the reader
       has the same problem when the key is not inside anything. */
    await waitFor(() => expect(accountBlock(employer.id)).toBeTruthy());
    const row = within(accountBlock(employer.id)).getByText("API key").closest(".ws-row");
    expect(row).not.toBeNull();
    await waitFor(() => expect(row).toHaveTextContent("Not read"));
    expect(row).not.toHaveTextContent("gsk_…4f2a");
  });

  /**
   * **EVERY ACCOUNT IS ASKED ABOUT, AND IT USED TO BE ONE PER VENDOR.**
   *
   * This case asserted the opposite until the seam went per-account: the hook
   * elected one account per vendor and the negative assertion here was that no
   * call went out about the other one. Electing was the best a vendor-keyed map
   * could do — it holds one answer, so something had to choose whose — and it is
   * exactly what made a second account unanswerable: the job row running on it
   * had no status of its own and reported the elected account's key as its own.
   *
   * A machine reads as many statuses as it holds accounts. That is not ADR 0124
   * reversed: that record refused ten reads for ten vendors nobody had
   * configured, and an account exists because somebody made it.
   */
  it("asks the runtime about every account this machine holds", async () => {
    const config = createAppConfig();
    const employer = { ...CLOUD_ACCOUNT, id: "connection-groq", label: "Employer" };
    config.connections = [CLOUD_ACCOUNT, employer];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: employer.id, overrides: {}, models: {} };

    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    for (const account of [CLOUD_ACCOUNT.id, employer.id]) {
      await waitFor(() =>
        expect(invoked).toHaveBeenCalledWith("provider_status", {
          request: expect.objectContaining({ provider: "groq", connection: account }),
        }),
      );
    }

    /* **AND EVERY CARD REPORTS ITS OWN** (ADR 0223). The key row used to be one
       row below the list answering about whichever account a derivation picked;
       both cards carry one now, so the assertion is per card and the reader's
       question — *whose key is this* — has an answer on screen. */
    for (const account of [CLOUD_ACCOUNT.id, employer.id]) {
      const row = within(await openAccount(account)).getByText("API key").closest(".ws-row");
      await waitFor(() => expect(row).toHaveTextContent("gsk_…4f2a"));
    }
  });

  /**
   * **THE CHIP ROW STATES A VENDOR AND SETS NOTHING** (speech track B17).
   *
   * It used to do two things on one press of a control that named neither:
   * create an account on the picked vendor where the machine held none, and
   * repoint the ACTIVE PROFILE at it. That is the conflation ADR 0212 closed at
   * the lane level and left here — and it made the vendor of an existing account
   * look editable, which it is not: re-pointing an account at another vendor
   * would leave its stored key addressed to a company that never issued it.
   *
   * Both halves have an honest home now. `Add account` creates one and asks for
   * its vendor; `This profile bills to` assigns one and names the profile.
   */
  /**
   * **THIS CASE'S SUBJECT IS RETIRED, AND ADR 0223 RETIRED IT ON PURPOSE.**
   *
   * ADR 0220 made the chip row state a vendor and write nothing, because picking
   * a chip used to create an account AND repoint the profile on one press. That
   * was the right cut and the wrong result: the owner pressed the chips and
   * reported *die Klicks bewirken nichts, denkt der User* — a row of logos that
   * accepts a click and does nothing is the false affordance ADR 0067 rule 1 is
   * about, arrived at from the safe end.
   *
   * The chips moved to `AddAccountPanel`, where pressing one means something and
   * still does not assign. What replaces this case is the pair above it: the
   * chips write in the Add panel, and the account card's radio is the only thing
   * that repoints a profile.
   *
   * The half worth keeping is the one below — nothing on this screen writes the
   * config until the reader asks it to.
   */
  it("writes nothing to the config on open", async () => {
    const patch = vi.fn();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    await waitFor(() => expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy());
    expect(patch).not.toHaveBeenCalled();
  });

  it("saves a key to the vendor the connection names and never to Groq", async () => {
    const user = userEvent.setup();
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    config.connections = [
      CLOUD_ACCOUNT,
      {
        id: "connection-openai",
        label: "OpenAI",
        provider: "openai",
        base_url: "",
        model: "",
        plan: "",
      },
    ];
    active.providers = { default: "connection-openai", overrides: {}, models: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* **THROUGH THE OPENAI CARD**, which is the whole of ADR 0223: the key row is
       inside the account it belongs to, so *which vendor's entry does this
       write* is answered by where the reader typed rather than by a search for
       the one live button on the screen. */
    await waitFor(() => expect(accountBlock("connection-openai")).toBeTruthy());
    const card = () => within(accountBlock("connection-openai"));
    await user.click(card().getByRole("button", { name: /^(Replace|Add)$/ }));
    await user.type(card().getByLabelText(/API key/i), "sk-proj-abcdefghijklmnop");
    await user.click(card().getByRole("button", { name: "Save" }));

    /* THE BUG THIS CASE EXISTS FOR: writing an OpenAI key into Groq's
       secret-store entry, which is one literal away and silent. */
    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("save_provider_api_key", {
        request: {
          provider: "openai",
          connection: "connection-openai",
          api_key: "sk-proj-abcdefghijklmnop",
        },
      }),
    );
    expect(invoked).not.toHaveBeenCalledWith(
      "save_provider_api_key",
      expect.objectContaining({ request: expect.objectContaining({ provider: "groq" }) }),
    );
  });

  /**
   * ONE PUBLISHED CEILING IS A FACT AND NOT A CHOICE (ADR 0167, ADR 0038).
   *
   * This case used to assert the opposite half of the same situation: Groq's
   * `dev` stored machine-wide while the connection was OpenAI, and a select
   * rendering blank because the stored value matched no option. **Both halves
   * of that are now impossible** — the plan is keyed by vendor, so Groq's
   * cannot reach this row, and OpenAI's single ceiling is stated rather than
   * offered.
   */
  it("states a single published ceiling instead of offering it", async () => {
    const config = createAppConfig();
    /* Groq's paid plan, held on the Groq account, while the profile is on an
       OpenAI one. */
    config.connections = [
      { ...CLOUD_ACCOUNT, plan: "dev" },
      {
        id: "connection-openai",
        label: "OpenAI",
        provider: "openai",
        base_url: "",
        model: "",
        plan: "",
      },
    ];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "connection-openai", overrides: {}, models: {} };
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") return STATUS;
      if (command === "resolve_provider_tiers") {
        return [
          { id: "standard", label: "Standard — 25 MiB per request", max_audio_bytes: 26_214_400, default: true },
        ];
      }
      return undefined;
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* ON THE OPENAI CARD, which is the account the profile bills to. Both cards
       carry a plan row now (ADR 0223), so the assertion names the one whose
       vendor publishes a single ceiling — the subject of this case. */
    await waitFor(() => expect(accountBlock("connection-openai")).toBeTruthy());
    const card = () => within(accountBlock("connection-openai"));
    await waitFor(() =>
      expect(card().getByText("Standard — 25 MiB per request")).toBeInTheDocument(),
    );
    expect(card().queryByLabelText("Account plan")).not.toBeInTheDocument();
    expect(card().queryByText("Developer — 25 MiB per request, higher rate limits")).not.toBeInTheDocument();
  });

  /**
   * THE TRAP THIS ROW WAS ONE ADAPTER AWAY FROM (ADR 0167).
   *
   * `resolve_provider_tiers` answers `[]` for a vendor with no adapter and for
   * a lane with nothing to sell alike, and the row read that as *still
   * reading* — a permanently disabled control claiming a read is in flight.
   * The registry answers the first sentence, so the two are told apart.
   */
  it("says a vendor has no adapter rather than reading its plans forever", async () => {
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    /* An account on a vendor with no adapter — which is the state this asserts
       about, and it is reachable: the account is a stored object and the
       registry is what refuses it (ADR 0208). */
    config.connections = [
      {
        id: "connection-anthropic",
        label: "Anthropic",
        provider: "anthropic",
        base_url: "",
        model: "",
        plan: "",
      },
    ];
    active.providers = { default: "connection-anthropic", overrides: {}, models: {} };
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") return STATUS;
      if (command === "resolve_provider_tiers") return [];
      return undefined;
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    expect(await screen.findByText("No speech")).toBeInTheDocument();
    expect(screen.queryByText("Reading the provider plans…")).not.toBeInTheDocument();
  });

  /**
   * A registered vendor that does not listen has no plan to be on, and that is
   * a different sentence from having no adapter — the shape Anthropic will
   * arrive in, tested on a drawn vendor because a runtime id with no drawn name
   * can never be the connection.
   */
  it("says a connection that does not transcribe has no plan", async () => {
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    config.connections = [
      CLOUD_ACCOUNT,
      {
        id: "connection-openai",
        label: "OpenAI",
        provider: "openai",
        base_url: "",
        model: "",
        plan: "",
      },
    ];
    active.providers = { default: "connection-openai", overrides: {}, models: {} };
    /* BOTH READS MOVE, and that is the seam's own rule rather than fixture
       bookkeeping: `resolveProviderAnswer` prefers `provider_status`'s
       capability block over the registered list where it holds one, so a
       registry row alone would be overruled by a status still claiming the
       vendor listens. */
    const deaf = { ...CAPABILITIES, transcription: false };
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers")
        return REGISTERED.map((row) =>
          row.provider === "openai" ? { ...row, roles: ["chat"], capabilities: deaf } : row,
        );
      if (command === "provider_status")
        return { ...STATUS, provider: "openai", capabilities: deaf };
      if (command === "resolve_provider_tiers") return [];
      return undefined;
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    expect(await screen.findByText("No speech")).toBeInTheDocument();
    /* The reason is stated ONCE, on the connection card. This row says why the
       answer matters here and does not reprint it — one fact twice a few pixels
       apart is what the assertion below is guarding against. */
    expect(
      screen.getAllByText(/no speech recognition adapter for OpenAI yet/i),
    ).toHaveLength(1);
    expect(
      screen.getByText(/A plan bounds an upload, and this connection does not transcribe/i),
    ).toBeInTheDocument();
  });

  /** A speech lane whose ceiling is the operator's own has no plans, and says
   *  so — the self-hosted shape, stated where a Cloud vendor could reach it. */
  it("says a speech lane with no plans has none", async () => {
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "openrouter", overrides: {}, models: {} };
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") return STATUS;
      if (command === "resolve_provider_tiers") return [];
      return undefined;
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* THE PROFILE POINTS AT AN ACCOUNT THIS MACHINE DOES NOT HOLD, so no card
       opens on arrival — which is the honest resting state for an orphaned
       pointer (ADR 0224) and means the plan row has to be opened for. */
    const card = within(await openAccount("connection-default"));
    expect(card.getByText("No plans")).toBeInTheDocument();
    expect(screen.queryByText("No speech")).not.toBeInTheDocument();
  });

  it("names the stored connection on a job row that follows it", async () => {
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    config.connections = [
      CLOUD_ACCOUNT,
      {
        id: "connection-openai",
        label: "OpenAI",
        provider: "openai",
        base_url: "",
        model: "",
        plan: "",
      },
    ];
    active.providers = { default: "connection-openai", overrides: {}, models: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* `Follow the profile · Groq` on a profile pointed at OpenAI is the row
       lying about where the job runs, and it is the sentence a user reads to
       find that out. **It names the ACCOUNT now** (ADR 0211): two accounts on
       one vendor are two answers, so a row naming the vendor would be back to
       being unable to say which of them pays. */
    const cleanup = (await screen.findByText("Cleanup")).closest(".ws-job") as HTMLElement;
    const runsOn = within(cleanup).getByLabelText("Runs on") as HTMLSelectElement;
    expect(runsOn).toHaveValue("");
    expect(runsOn.selectedOptions[0].textContent).toBe("Follow the profile · OpenAI");
  });
});

/**
 * THE PER-JOB OVERRIDE (ADR 0128).
 *
 * D1 wired the connection and left this unwritable rather than settle a drawing
 * question quietly: `data.ts` draws three jobs with an `override` literal that
 * decides the row's SHAPE, and A4 decided a fresh profile overrides nothing.
 * The rule that resolves it is that the config answers where there is a config
 * and the drawing answers where there is not — so the gallery keeps its
 * inventory of what is coming and the product states only what is stored.
 */
describe("AI Models, the per-job override", () => {
  function axisOf(patch: { text_profiles?: { id: string; providers?: unknown }[] }, id: string) {
    return patch.text_profiles?.find((profile) => profile.id === id)?.providers;
  }

  /** Overrides are ACCOUNT ids too (ADR 0208), so a fixture naming a vendor
   *  gives the machine an account on it to point at. */
  function configWith(overrides: Record<string, string>) {
    const config = createAppConfig();
    const vendors = [...new Set(Object.values(overrides))];
    config.connections = [
      CLOUD_ACCOUNT,
      ...vendors
        .filter((vendor) => vendor !== "groq")
        .map((vendor) => ({
          id: `connection-${vendor}`,
          label: vendor,
          provider: vendor,
          base_url: "",
          model: "",
          plan: "",
        })),
    ];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = {
      default: CLOUD_ACCOUNT.id,
      overrides: Object.fromEntries(
        Object.entries(overrides).map(([job, vendor]) => [job, `connection-${vendor}`]),
      ),
      models: {},
    };
    return config;
  }

  function rowOf(name: string): HTMLElement {
    return (screen.getByText(name).closest(".ws-job") as HTMLElement) ?? screen.getByText(name);
  }

  it("follows the profile's account where nothing is stored, though the drawing overrides", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config: configWith({}) })} />);

    /* `Upload` is one of the three rows `data.ts` draws with `override:
       "OpenAI"`. The stored answer is that it overrides nothing, and the
       product states the stored answer. */
    const upload = rowOf("Upload");
    await waitFor(() => expect(within(upload).getByLabelText("Runs on")).toHaveValue(""));
    const runsOn = within(upload).getByLabelText("Runs on") as HTMLSelectElement;
    expect(runsOn.selectedOptions[0].textContent).toBe("Follow the profile · Groq");
    /* AND NO KEY EDITOR ON A JOB ROW (ADR 0211). A credential belongs to the
       account, so the row states whether this job can be paid for and the
       inventory is where that is changed — a second key field scoped to a job is
       how *Account* came to look like the thing a job runs on. */
    expect(within(upload).queryByRole("button", { name: /Add key|Replace/ })).toBeNull();
    expect(within(upload).getByText("Key set")).toBeInTheDocument();
  });

  it("names the stored account on the row that overrides, and only that row", async () => {
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({ active: true, config: configWith({ upload: "openai" }) })}
      />,
    );

    await waitFor(() =>
      expect(within(rowOf("Upload")).getByLabelText("Runs on")).toHaveValue("connection-openai"),
    );
    /* Translate is drawn with `override: "Anthropic"` and stores nothing. */
    expect(within(rowOf("Translate")).getByLabelText("Runs on")).toHaveValue("");
  });

  it("writes the override as an account id and clears it by following again", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = configWith({ cleanup: "openai" });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config, patch })} />);

    const select = within(rowOf("Upload")).getByLabelText("Runs on");
    await waitFor(() => expect(select).not.toBeDisabled());
    /* THE OPTION IS AN ACCOUNT, PICKED BY ITS OWN NAME. A vendor's name would
       be back to *which account of theirs*, which is the question ADR 0208's
       object exists to answer. */
    await user.selectOptions(select, "connection-openai");

    expect(axisOf(patch.mock.calls[0][0], config.active_text_profile_id)).toEqual({
      default: CLOUD_ACCOUNT.id,
      overrides: { cleanup: "connection-openai", upload: "connection-openai" },
      models: {},
    });

    /* FOLLOWING AGAIN DELETES THE KEY. Writing the profile's own account id
       would freeze the job onto today's account (ADR 0094 — the absence is the
       value), so the row would stop following one the reader changes later. */
    patch.mockClear();
    const back = within(rowOf("Cleanup")).getByLabelText("Runs on");
    await user.selectOptions(back, "");

    expect(axisOf(patch.mock.calls[0][0], config.active_text_profile_id)).toEqual({
      default: CLOUD_ACCOUNT.id,
      overrides: {},
      models: {},
    });
  });

  it("offers an account whose vendor has no adapter, disabled, carrying its reason", async () => {
    /* THE RULE THIS CASE HOLDS, ONE AXIS OVER (ADR 0128, ADR 0211). The list is
       accounts now, so what stays visible-and-disabled is an ACCOUNT the reader
       holds on a vendor this build cannot operate: deleting it would hide an
       account they can see in the inventory, and enabling it would offer a
       routing that cannot run. Which VENDORS exist at all is the inventory's
       list, and it still shows every one of them. */
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({ active: true, config: configWith({ translate: "anthropic" }) })}
      />,
    );

    const select = within(rowOf("Translate")).getByLabelText("Runs on");
    await waitFor(() => expect(select).not.toBeDisabled());

    const anthropic = within(select as HTMLElement).getByRole("option", { name: "anthropic" });
    expect(anthropic).toBeDisabled();
    expect(anthropic).toHaveAttribute("title", expect.stringContaining("no adapter"));

    const groq = within(select as HTMLElement).getByRole("option", { name: CLOUD_ACCOUNT.label });
    expect(groq).not.toBeDisabled();
  });

  it("keeps the account picker operable on a row that is inert", async () => {
    /* An override onto a vendor with no adapter: the row cannot run, and the
       fix is this very select. Disabling it with the sentence that explains
       the problem is the trap this case exists for. */
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: configWith({ translate: "anthropic" }),
        })}
      />,
    );

    const row = rowOf("Translate");
    await waitFor(() =>
      expect(within(row).getByLabelText("Runs on")).toHaveValue("connection-anthropic"),
    );
    expect(within(row).getByLabelText("Runs on")).not.toBeDisabled();
    /* The model row is a choice ON the vendor, so it stays inert. */
    expect(within(row).getByLabelText("Model")).toBeDisabled();
  });

  /**
   * **ONE PROFILE, THREE ACCOUNTS ACROSS TWO LANES, SET FROM ONE SCREEN**
   * (ADR 0211, ADR 0212).
   *
   * The sentence B15 exists for, and it was storable-but-unpickable: the config
   * has held a connection per job since ADR 0094 met ADR 0208, while the surface
   * offered one lane's vendors. Nothing in this case reaches for a lane control.
   *
   * **Two lanes and not three, and the limit is the runtime's rather than this
   * screen's**: `Local` is withheld by the product until Phase 5 (B12) and
   * `self_hosted` registers speech and not chat (`registry.rs`), so the
   * assistant cannot be pointed at somebody's own server today. The reachable
   * variety is what the row offers; a wider one arrives with the adapter.
   */
  it("puts three jobs on three accounts from the job rows alone", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      { id: "connection-openai", label: "Private OpenAI", provider: "openai", base_url: "", model: "", plan: "" },
      {
        id: "connection-self_hosted",
        label: "Home server",
        provider: "self_hosted",
        base_url: "http://10.0.0.2:8080/v1",
        model: "faster-whisper-medium",
        plan: "",
      },
    ];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: CLOUD_ACCOUNT.id, overrides: {}, models: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    const runsOnOf = (job: string) =>
      within(rowOf(job)).getByLabelText("Runs on") as HTMLSelectElement;

    await waitFor(() => expect(runsOnOf("Cleanup")).not.toBeDisabled());
    await user.selectOptions(runsOnOf("Cleanup"), "connection-openai");
    expect(axisOf(patch.mock.calls[0][0], active.id)).toEqual({
      default: CLOUD_ACCOUNT.id,
      overrides: { cleanup: "connection-openai" },
      models: {},
    });

    /* Upload — a speech job, which is the role that lane serves — onto the
       server. Written off the same config as the first pick, because the mock
       patch does not feed itself back: what this asserts is the write each row
       makes, not the accumulation. */
    patch.mockClear();
    await user.selectOptions(runsOnOf("Upload"), "connection-self_hosted");
    expect(axisOf(patch.mock.calls[0][0], active.id)).toEqual({
      default: CLOUD_ACCOUNT.id,
      overrides: { upload: "connection-self_hosted" },
      models: {},
    });

    /* AND THE SERVER IS OFFERED ON A CHAT JOB AND REFUSED WITH ITS REASON, which
       is the seam doing its job rather than this screen hiding an account
       (ADR 0128 one axis over): the adapter registers speech and not chat. */
    const onChat = within(rowOf("The assistant")).getByLabelText("Runs on") as HTMLSelectElement;
    const server = [...onChat.options].find((option) => option.value === "connection-self_hosted")!;
    expect(server.disabled).toBe(true);
    expect(server.title).toContain("chat");

    /* **AND NOTHING MOVED WHICH PROFILE IS ACTIVE** — the measure this step is
       held to. Every axis write goes through `buildTextProfilesPatch`, which
       restates the active id beside the profile list, so the assertion is that it
       is restated and never CHANGED: a screen that moved the reader between
       profiles as a side effect of setting a job would show up here. */
    for (const [written] of patch.mock.calls) {
      if ("active_text_profile_id" in written) {
        expect(written.active_text_profile_id).toBe(config.active_text_profile_id);
      }
    }
  });

  /** **THE MODEL GOES WITH THE ACCOUNT WHEN THE VENDOR CHANGES** (ADR 0211). A
   *  model chosen for Groq is not a choice about OpenAI, and leaving it would
   *  store a pair the resolver has to refuse while the row named a model no
   *  request carries. Same vendor, second account: the choice still holds. */
  it("clears a row's model when its account moves to another vendor, and keeps it within one", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      { id: "connection-groq-2", label: "Groq private", provider: "groq", base_url: "", model: "", plan: "" },
      { id: "connection-openai", label: "Private OpenAI", provider: "openai", base_url: "", model: "", plan: "" },
    ];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = {
      default: CLOUD_ACCOUNT.id,
      overrides: {},
      models: { cleanup: "llama-3.3-70b-versatile" },
    };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch, config })} />);

    const runsOn = within(rowOf("Cleanup")).getByLabelText("Runs on");
    await waitFor(() => expect(runsOn).not.toBeDisabled());

    await user.selectOptions(runsOn, "connection-groq-2");
    expect(axisOf(patch.mock.calls[0][0], active.id)).toEqual({
      default: CLOUD_ACCOUNT.id,
      overrides: { cleanup: "connection-groq-2" },
      models: { cleanup: "llama-3.3-70b-versatile" },
    });

    patch.mockClear();
    await user.selectOptions(runsOn, "connection-openai");
    expect(axisOf(patch.mock.calls[0][0], active.id)).toEqual({
      default: CLOUD_ACCOUNT.id,
      overrides: { cleanup: "connection-openai" },
      models: {},
    });
  });

  /**
   * **THE COLLAPSED ROW HAS TO BE TRUE AT A GLANCE** (ADR 0212).
   *
   * Found by rendering the card, not by a test: the summary badge read the LANE's
   * drawn catalogue entry, so a cleanup routed to OpenAI with a model of its own
   * summarised itself as Groq's `llama-3.1-8b-instant` — the *surface names one
   * model, the request carries another* defect on the one line a reader takes in
   * without opening anything.
   */
  it("names the account's own model on the collapsed job row", async () => {
    const config = createAppConfig();
    config.connections = [
      CLOUD_ACCOUNT,
      { id: "connection-openai", label: "Private OpenAI", provider: "openai", base_url: "", model: "", plan: "" },
    ];
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = {
      default: CLOUD_ACCOUNT.id,
      overrides: { cleanup: "connection-openai" },
      models: { cleanup: "gpt-5.6-terra" },
    };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* THE BADGE ITSELF, not the row: the model id also appears in the picker
       inside the row, and an assertion that cannot tell the summary from the
       control would pass on the defect this case exists for. */
    const badgeOf = (job: string) => rowOf(job).querySelector(".ws-jobmodel")?.textContent ?? "";
    await waitFor(() => expect(badgeOf("Cleanup")).toContain("gpt-5.6-terra"));
    expect(badgeOf("Cleanup")).not.toContain("llama-3.1-8b-instant");

    /* A row that named no model of its own says which default it falls back to,
       rather than looking like a choice. */
    expect(badgeOf("Rewrite")).toContain("default");
  });

  it("states the overriding job's key from the runtime instead of claiming it is set", async () => {
    /* THE DEFECT THIS CASE EXISTS FOR. The row read a literal
       `StatusBadge tone="success">Set` from Leg 6 until ADR 0128 — a green
       badge asserting a stored credential nothing had been asked about. */
    invoked.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        const provider = (args as { request: { provider: string } }).request.provider;
        if (provider === "openai") {
          return statusFor(args, {
            ...STATUS,
            provider: "openai",
            role_credentials: [
              { provider: "openai", role: "speech", kind: "api_key", configured: false, storage: "os_secret_store", key_preview: null, missing: "an API key" },
              { provider: "openai", role: "chat", kind: "api_key", configured: false, storage: "os_secret_store", key_preview: null, missing: "an API key" },
            ],
          });
        }
        return statusFor(args);
      }
      if (command === "resolve_provider_tiers") return TIERS;
      return undefined;
    });

    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({ active: true, config: configWith({ upload: "openai" }) })}
      />,
    );

    const upload = rowOf("Upload");
    await waitFor(() => expect(within(upload).getByText("No key")).toBeInTheDocument());
    expect(within(upload).queryByText("Key set")).toBeNull();
    /* AND THE ROW DOES NOT OFFER TO FIX IT HERE (ADR 0211): the key belongs to
       the account, so the statement is the row's and the field is the
       inventory's. */
    expect(within(upload).queryByRole("button", { name: /Add key|Replace/ })).toBeNull();
  });
});

/**
 * ON THIS MACHINE, WIRED — B5 (ADR 0122).
 *
 * The tab was drawn and dead since Leg 6: a `downloading` row at 38 %, an
 * installed total of `284 MB`, and nothing behind any of it. What is asserted
 * here is the sentence that replaced the sample — that a machine with nothing
 * installed says so — plus the two rules the surface owes: a row is
 * *installable* rather than available, and a model a profile runs on cannot be
 * removed by accident.
 */
describe("On this machine, wired", () => {
  const LIBRARY = {
    speech_dir: "/home/someone/.config/WordScript/models/speech",
    folders: [
      {
        path: "/home/felix/whisper-models",
        kind: "your folder",
        removable: true,
        exists: true,
      },
      {
        path: "/home/someone/.config/WordScript/models/speech",
        kind: "managed by WordScript",
        removable: false,
        exists: true,
      },
    ],
    server: { base_url: "http://127.0.0.1:11434", reachable: true, detail: "Answering." },
    rows: [
      {
        row: "local-speech-base",
        model_id: "ggml-base",
        role: "speech",
        mechanism: "download",
        origin: "catalogue",
        size_bytes: 147_951_465,
        quantization: null,
        state: { kind: "installable" },
        path: null,
        folder: null,
        in_use_by: null,
      },
      {
        row: "local-speech-small",
        model_id: "ggml-small",
        role: "speech",
        mechanism: "download",
        origin: "catalogue",
        size_bytes: 487_601_967,
        quantization: null,
        state: { kind: "installed", bytes: 487_601_967 },
        path: "/home/someone/.config/WordScript/models/speech/ggml-small.bin",
        folder: null,
        in_use_by: "Technical notes",
      },
      {
        row: "local-chat-qwen-7b",
        model_id: "qwen2.5-7b-instruct",
        role: "chat",
        mechanism: "server_pull",
        origin: "catalogue",
        size_bytes: 4_683_086_845,
        quantization: "Q4_K_M",
        state: { kind: "unknown", detail: "Start Ollama at http://127.0.0.1:11434." },
        path: null,
        folder: null,
        in_use_by: null,
      },
    ],
  };

  function withLibrary(library: unknown = LIBRARY) {
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") return STATUS;
      if (command === "resolve_provider_tiers") return TIERS;
      if (command === "model_library") return library;
      return undefined;
    });
  }

  async function openMachineTab() {
    await userEvent.click(screen.getByRole("tab", { name: "On this machine" }));
  }

  it("counts what is installed rather than drawing a total", async () => {
    withLibrary();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    /* The drawn sample said `2 installed · 284 MB` on a machine with nothing on
       it. One speech model is installed here and its bytes are the total. */
    await waitFor(() => expect(screen.getByText("1 installed · 488 MB")).toBeInTheDocument());
    /* And the language half has none, which is a sentence rather than a blank. */
    expect(screen.getByText("0 installed")).toBeInTheDocument();
    expect(screen.queryByText("2 installed · 284 MB")).toBeNull();
  });

  it("offers a catalogued model with no file for download rather than as available", async () => {
    withLibrary();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    const row = await waitFor(() => {
      const node = screen.getByText("ggml-base").closest(".ws-mdl");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    expect(row).toHaveAttribute("data-state", "available");
    const download = within(row).getByRole("button", { name: "Download" });
    expect(download).not.toBeDisabled();

    await userEvent.click(download);
    expect(invoked).toHaveBeenCalledWith("install_model", { row: "local-speech-base" });
  });

  /* The refusal ADR 0122 requires, stated before the click rather than after
     it: deleting the model your dictation runs on and discovering it at the
     next capture is the fake-state defect with the user's own action as its
     cause. */
  it("refuses to remove a model a profile runs on, and names the profile", async () => {
    withLibrary();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    const row = await waitFor(() => {
      const node = screen.getByText("ggml-small").closest(".ws-mdl");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    expect(row).toHaveAttribute("data-state", "installed");
    expect(within(row).getByText("In use")).toBeInTheDocument();
    const remove = within(row).getByRole("button", { name: /Remove ggml-small/ });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute("title", expect.stringContaining("Technical notes"));
  });

  /**
   * **A server that is not running does not make its models missing.** Nobody
   * looked at that disk, and drawing four rows as *not installed* because a
   * probe failed would be the claim ADR 0106 forbids one layer up.
   */
  it("says why a language row cannot be answered for instead of calling it absent", async () => {
    withLibrary();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    const row = await waitFor(() => {
      const node = screen.getByText("qwen2.5-7b-instruct").closest(".ws-mdl");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    const download = within(row).getByRole("button", { name: "Download" });
    expect(download).toBeDisabled();
    expect(download).toHaveAttribute("title", expect.stringContaining("Start Ollama"));
  });

  /* ADR 0207. `Use` on a language model used to write the correction model and
     nothing else, so the agent — the transcript title, the Auto classifier,
     Agent mode — stayed on the catalogue's `llama3.2:latest`. On a machine that
     pulled something else the title call then asked for a model that is not
     installed, and its fallback is the same first-words filename a model that
     declined to name one produces, so the screen never said so. */
  it("points both of a lane's chat jobs at the language model you chose", async () => {
    const patch = vi.fn();
    const installedChat = {
      ...LIBRARY,
      rows: LIBRARY.rows.map((row) =>
        row.row === "local-chat-qwen-7b"
          ? { ...row, state: { kind: "installed", bytes: 4_683_086_845 } }
          : row,
      ),
    };
    withLibrary(installedChat);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);
    await openMachineTab();

    const row = await waitFor(() => {
      const node = screen.getByText("qwen2.5-7b-instruct").closest(".ws-mdl");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    await userEvent.click(within(row).getByRole("button", { name: "Use" }));

    const written = patch.mock.calls[0][0] as {
      text_profiles: { id: string; speech: Record<string, string> }[];
    };
    const speech = written.text_profiles.find(
      (profile) => profile.id === written.text_profiles[0].id,
    )?.speech;

    /* The PULL TAG, which is what the runner is asked for, and the same string
       in both fields. Per profile, which is what makes an employer's connection
       and a private one two separate sets rather than one machine-wide choice. */
    expect(speech?.local_correction_model).toBe("qwen2.5:7b-instruct-q4_K_M");
    expect(speech?.local_agent_model).toBe("qwen2.5:7b-instruct-q4_K_M");
  });

  /* Every folder the runtime looks in, in rank order, and only the one the
     user added may be removed from here (ADR 0159). */
  it("lists the folders the runtime resolved rather than ones it assembled", async () => {
    withLibrary();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    await waitFor(() =>
      expect(
        screen.getByText("/home/someone/.config/WordScript/models/speech"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("/home/felix/whisper-models")).toBeInTheDocument();

    /* The managed directory is WordScript's own and an environment variable is
       somebody's shell profile; neither is this screen's to delete. */
    expect(
      screen.getByRole("button", { name: /Stop looking in \/home\/felix\/whisper-models/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Stop looking in \/home\/someone/,
      }),
    ).toBeNull();
  });
});

/**
 * THE LIBRARY AT SCALE, AND THE MODEL THE CATALOGUE DOES NOT KNOW (B8, ADR 0159).
 *
 * Two rules with one mechanism between them: a list that is still the drawing
 * renders as the drawing, and a list that has outgrown it gets the toolbar the
 * prototype already specifies. The threshold is what keeps `port:diff` pointed
 * at something real.
 */
describe("On this machine, at scale", () => {
  function speechRow(stem: string, origin: "catalogue" | "yours" = "catalogue") {
    return {
      row: stem,
      model_id: `ggml-${stem}`,
      role: "speech",
      mechanism: "download",
      origin,
      size_bytes: 148_000_000,
      quantization: null,
      state: origin === "yours" ? { kind: "installed", bytes: 612_000_000 } : { kind: "installable" },
      path: origin === "yours" ? `/home/felix/whisper-models/ggml-${stem}.bin` : null,
      folder: origin === "yours" ? "/home/felix/whisper-models" : null,
      in_use_by: null,
    };
  }

  function libraryOf(rows: unknown[]) {
    return {
      speech_dir: "/managed",
      folders: [{ path: "/managed", kind: "managed by WordScript", removable: false, exists: true }],
      server: { base_url: "http://127.0.0.1:11434", reachable: true, detail: "Answering." },
      rows,
    };
  }

  function withRows(rows: unknown[]) {
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") return STATUS;
      if (command === "resolve_provider_tiers") return TIERS;
      if (command === "model_library") return libraryOf(rows);
      return undefined;
    });
  }

  async function openMachineTab() {
    await userEvent.click(screen.getByRole("tab", { name: "On this machine" }));
  }

  /* Below the threshold the surface is exactly what Leg 6 drew, which is what
     lets the gallery keep measuring it. A search field appearing at nine rows
     would put a control on the port's subject that the prototype has no
     counterpart for. */
  it("shows no search while the list is still the drawing", async () => {
    withRows([speechRow("base"), speechRow("small"), speechRow("medium")]);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    await waitFor(() => expect(screen.getByText("ggml-base")).toBeInTheDocument());
    expect(screen.queryByLabelText("Search models")).toBeNull();
  });

  it("brings out the toolbar once the list has outgrown it, and filters on it", async () => {
    const many = Array.from({ length: 14 }, (_, index) => speechRow(`model-${index}`));
    withRows(many);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    const search = await screen.findByLabelText("Search models");
    expect(search).toBeInTheDocument();

    await userEvent.type(search, "model-7");
    await waitFor(() => expect(screen.getByText("ggml-model-7")).toBeInTheDocument());
    expect(screen.queryByText("ggml-model-3")).toBeNull();
  });

  /* The empty state names the query rather than saying "nothing here": the
     list is not empty, the filter is. */
  it("names the query when a filter leaves nothing standing", async () => {
    const many = Array.from({ length: 14 }, (_, index) => speechRow(`model-${index}`));
    withRows(many);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    const search = await screen.findByLabelText("Search models");
    await userEvent.type(search, "nothing-matches-this");

    /* Both cards answer, because one query filters both lists — the toolbar the
       prototype specifies is one line above the thing it filters, and this tab
       has two lists under one intent. */
    await waitFor(() =>
      expect(screen.getAllByText(/No model here matches/).length).toBeGreaterThan(0),
    );
  });

  /* A card with nothing in it is an empty list, not a filter that found
     nothing. Saying "nothing matches that filter" to somebody who has not
     typed one is a false sentence about their machine. */
  it("does not blame a filter nobody set for an empty card", async () => {
    withRows([speechRow("base")]);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    await waitFor(() => expect(screen.getByText("ggml-base")).toBeInTheDocument());
    expect(screen.queryByText(/matches that filter/)).toBeNull();
  });

  /**
   * **The defect B5 left, from the surface side.** The tab is called *On this
   * machine* and listed the catalogue; a file the runtime discovers, resolves
   * and would transcribe with was not on it.
   */
  it("lists a model the catalogue does not know, with the folder it came from", async () => {
    withRows([speechRow("base"), speechRow("my-finetune", "yours")]);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    const row = await waitFor(() => {
      const node = screen.getByText("ggml-my-finetune").closest(".ws-mdl");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    expect(row).toHaveAttribute("data-state", "installed");
    /* Its size is the file's own — nothing else knows it, and a catalogue
       figure borrowed for somebody's own weights would be a fabrication. */
    expect(within(row).getByText(/612 MB/)).toBeInTheDocument();
  });

  it("offers both ways in, and they are different actions", async () => {
    withRows([speechRow("base")]);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    /* One copies a file into the folder WordScript manages; the other points
       at a folder and copies nothing. The owner asked for both because both
       cases are real. */
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add a model…" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Add a folder…" })).toBeInTheDocument();
  });

  /* The language half's way in: a tag rather than a file, because Ollama owns
     that store. Disabled until something is typed — a Pull with no tag is a
     button that can only fail. */
  it("pulls a tag the catalogue does not carry", async () => {
    withRows([speechRow("base")]);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    const field = await screen.findByLabelText("Pull a tag");
    const pull = screen.getByRole("button", { name: "Pull" });
    expect(pull).toBeDisabled();

    await userEvent.type(field, "gemma3:12b-it-q4_K_M");
    await waitFor(() => expect(pull).not.toBeDisabled());
    await userEvent.click(pull);

    expect(invoked).toHaveBeenCalledWith("pull_model_tag", { tag: "gemma3:12b-it-q4_K_M" });
  });
});

describe("AI Models, in the gallery", () => {
  /** **THE DRAWING IS AN ACCOUNT CARD NOW** (ADR 0223), not a lane segment over
   *  a chip row over a credential block. What the gallery is for is unchanged —
   *  it shows the shape and reads nothing (ADR 0055) — so the case keeps its
   *  second half word for word and moves its first onto the card. */
  it("is the drawing: one account card, and nothing read", () => {
    render(<ModelsScreen />);

    expect(document.querySelector(".ws-acct")).toBeTruthy();
    expect(screen.getAllByText("Set").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Plan")).not.toBeDisabled();
    /* AND NO LANE SEGMENT, which is the half of this case that retired: the
       reader pressed those four and two of them did nothing. */
    expect(screen.queryByRole("group", { name: "Lane" })).toBeNull();
    expect(invoked).not.toHaveBeenCalled();
  });

  /* The machine tab in the gallery is the sample state, and it must not reach
     for `model_library` at all — the split `CeilingBadge` already makes, held
     on the one tab that grew a second reader in B5. */
  it("draws the machine tab from the sample state and reads no library", async () => {
    render(<ModelsScreen />);
    await userEvent.click(screen.getByRole("tab", { name: "On this machine" }));

    expect(screen.getByText("2 installed · 284 MB")).toBeInTheDocument();
    expect(invoked).not.toHaveBeenCalled();
  });
});

/**
 * THE WORD *SERVER* MEANS ONE THING ON THIS SCREEN (ADR 0160).
 *
 * The lane row spends four lines establishing that a server is a machine which
 * is NOT this one, and the machine tab then closed on a section called *The
 * server* whose endpoint is `127.0.0.1`. These cases hold the two halves of the
 * fix: the lane reads *Your server* while still being stored as `Self-hosted`,
 * and nothing on *On this machine* calls anything a server at all.
 */
describe("On this machine, and what a server is", () => {
  const SETUP = {
    readiness: "ready",
    runner_ready: true,
    model_ready: true,
    chat_ready: true,
    issue_code: null,
    resolved_runner: "/usr/bin/whisper-cli",
    resolved_model: "/home/someone/models/ggml-base.bin",
    resolved_chat_base_url: "http://127.0.0.1:11434",
    resolved_chat_model: "llama3.2:latest",
    available_chat_models: ["llama3.2:latest"],
    guidance: "",
  };

  const EMPTY_LIBRARY = {
    speech_dir: "/home/someone/.config/WordScript/models/speech",
    folders: [],
    server: { base_url: "http://127.0.0.1:11434", reachable: true, detail: "Answering." },
    rows: [],
  };

  /** `provider_status` answers per provider here, which the older fixtures did
   *  not need: the runner card asks about `local` while the connection rows ask
   *  about the cloud vendor, and one answer for both would let a cloud reply
   *  stand in for the local probe. */
  function withSetup(
    setup: unknown = SETUP,
    library: Record<string, unknown> = EMPTY_LIBRARY,
  ) {
    invoked.mockImplementation(async (command, args) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        const request = (args as { request?: { provider: string } } | undefined)?.request;
        return request?.provider === "local"
          ? statusFor(args, { ...STATUS, local_setup: setup })
          : statusFor(args);
      }
      if (command === "resolve_provider_tiers") return TIERS;
      if (command === "model_library") return library;
      return undefined;
    });
  }

  async function openMachineTab() {
    await userEvent.click(screen.getByRole("tab", { name: "On this machine" }));
  }

  /** ADR 0160's rule outlived the segment that carried it (ADR 0223): the reader
   *  sees `Your server` and the config stores `Self-hosted`. The chips in the Add
   *  panel are where a reader meets that lane by name now. */
  it("reads the lane as Your server and still stores it as Self-hosted", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Add account" }));
    const chips = await screen.findByRole("radiogroup", { name: "Who is this account with" });
    expect(within(chips).getByRole("radio", { name: "Your server" })).toBeInTheDocument();
    expect(within(chips).queryByRole("radio", { name: /^Self-hosted/ })).toBeNull();
    /* The identifier did not move: `Cloud`, `Local` and `Enterprise` are keys in
       the shared catalogue, and this is a label. */
    expect(LANE_LABEL["Self-hosted"]).toBe("Your server");
  });

  it("names the two runners rather than calling one of them a server", async () => {
    withSetup();
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    await screen.findByText("/usr/bin/whisper-cli");
    expect(screen.getByText("Runners on this machine")).toBeInTheDocument();
    expect(screen.getAllByText("http://127.0.0.1:11434").length).toBeGreaterThan(0);

    /* THE RULE, AS A MEASUREMENT. The old section title was *The server* and the
       card below it said *Language models need an OpenAI-compatible server in
       front of them* about a process on this disk. The word may appear on this
       tab only where it points at the lane that IS another machine — and after
       the prose cut (ADR 0161) it appears nowhere at all, which is the stronger
       state and the one this asserts. `queryAllByText` rather than
       `getAllByText` is what lets the case say *none* instead of throwing on
       it. */
    const said = screen.queryAllByText(/\bservers?\b/i).map((node) => node.textContent ?? "");
    for (const sentence of said) {
      expect(sentence, sentence).toMatch(/Your server lane/);
    }
    expect(screen.queryByText("The server")).toBeNull();
  });

  it("says the speech runner was not found rather than staying silent", async () => {
    withSetup({
      ...SETUP,
      runner_ready: false,
      resolved_runner: null,
      guidance: "Install whisper-cli or set WORDSCRIPT_LOCAL_RUNNER.",
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(
      screen.getByText("Install whisper-cli or set WORDSCRIPT_LOCAL_RUNNER."),
    ).toBeInTheDocument();
  });

  it("distinguishes a probe that failed from a runner that is absent", async () => {
    /* `local_setup: null` is the runtime not answering, and the card says so.
       Drawing *Not found* here would tell somebody a binary is missing from a
       disk nobody looked at — the defect ADR 0106 recorded one layer up. */
    withSetup(null);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    expect(await screen.findByText("Not read")).toBeInTheDocument();
    expect(screen.queryByText("Not found")).toBeNull();
  });

  it("states the language runner as not running when nothing answers", async () => {
    withSetup(SETUP, {
      ...EMPTY_LIBRARY,
      server: {
        base_url: "http://127.0.0.1:11434",
        reachable: false,
        detail: "Start Ollama at http://127.0.0.1:11434.",
      },
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    expect(await screen.findByText("Not running")).toBeInTheDocument();
  });

  /**
   * THE SKETCH STAYS AND THE SKETCH DECLARES ITSELF (ADR 0161).
   *
   * The owner's rule for this stage of the build: a row that is planned but not
   * wired keeps its drawing, because the drawing is how anyone knows what the
   * finished thing looks like — and it carries a marker, so nobody mistakes it
   * for a reading. These cases hold the three rows on this tab that are
   * drawings, and the one that used to make a false claim about hardware.
   */
  it("marks every drawn row on the runner card and none of the read ones", async () => {
    withSetup();
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();
    await screen.findByText("/usr/bin/whisper-cli");

    const runners = screen.getByText("Runners on this machine").closest("section")!;
    const tagged = within(runners)
      .getAllByText("Preview")
      .map((tag) => tag.parentElement?.textContent ?? "");

    expect(tagged).toEqual([
      "Who runs OllamaPreview",
      "Keep it warmPreview",
      "AccelerationPreview",
    ]);
  });

  /**
   * ON EVERY SURFACE OF THIS SCREEN, NOT ONLY THE ONE BEING EDITED.
   *
   * **This case is wider than its first draft because the narrow version
   * passed while the defect was still on screen.** The first version checked
   * the machine tab, went green, and the Local lane's own `Acceleration` row —
   * a second copy of the same literal, in `LaneRows` — kept telling the reader
   * he has no GPU. It was caught by looking at the rendered screen, which is
   * the check a test is supposed to replace. So the assertion walks both tabs
   * and every lane instead of the one place the edit happened.
   */
  /* **RENDERED WITHOUT A RUNTIME, AND THAT IS LOAD-BEARING.** With one, every
     lane but Cloud is `disabled` (ADR 0065), so a `userEvent.click` on `Local`
     moves nothing and the case measures the Cloud lane four times under four
     names — green, and blind to the branch it exists to check. The first draft
     of both cases did exactly that. The gallery render is where all four lanes
     are reachable, which makes it the surface these two belong on. */
  it("claims nothing about the reader's GPU anywhere on the screen", async () => {
    renderInDeveloperMode(<ModelsScreen />);

    const gpuClaim = /no CUDA, ROCm or Metal device/;

    /* THE WHOLE TAB AT ONCE, because there are no lanes to walk since ADR 0223 —
       every account is on one page, which makes the sweep stronger than the four
       it replaced rather than weaker. */
    expect(screen.queryByText(gpuClaim)).toBeNull();

    /* **AND THE LANE NO LONGER HAS THE BADGE AT ALL** (ADR 0162): acceleration
       is a property of the machine, so it is stated once, on the tab that owns
       the machine. The duplicate here is what let ADR 0161's fix be applied
       to one copy and miss the other. */
    expect(screen.queryByText("CPU only")).toBeNull();

    await openMachineTab();
    expect(screen.queryByText(gpuClaim)).toBeNull();
    /* The badge stays there — the owner keeps the sketch, and the sketch is how
       the shape of the finished row is decided. Only the measurement it never
       took is gone. */
    expect(screen.getByText("CPU only")).toBeInTheDocument();
  });

  /**
   * THE LANE SUMMARISES THE INSTALLATION, IT DOES NOT RESTATE IT (ADR 0162).
   *
   * **This case exists because removing the duplicate rows made an older one
   * pass for free.** The GPU case above walks every lane asserting the claim is
   * absent; with the `Acceleration` row deleted from `Local`, that lane
   * satisfies it by having nothing to check. Counting the rows is what keeps
   * the deletion deliberate — if someone restores a fourth row here, this fails
   * and the reviewer has to say which one it is and why the tab does not own
   * it.
   */
  /**
   * **ADR 0162's FINDING IS NOW STRUCTURAL RATHER THAN GUARDED** (ADR 0223).
   *
   * That record cut the Local lane from five rows to three, because four of the
   * five restated what the machine tab owns — and its own note said the cost was
   * measured rather than argued: the fix had to be applied twice, and the second
   * application was found by a screenshot after the first was green.
   *
   * Local holds no account, so it has no card, so there is nothing left to
   * duplicate. This case keeps the half that can still fail: the Accounts
   * section says nothing about which program runs or what is on the disk.
   */
  it("says nothing about the machine's runners in the Accounts section", async () => {
    render(<ModelsScreen />);

    const accounts = screen.getByText("Accounts").closest("section") as HTMLElement;
    expect(within(accounts).queryByRole("group", { name: "Language runner" })).toBeNull();
    expect(within(accounts).queryByRole("button", { name: "Bundled" })).toBeNull();
    expect(within(accounts).queryByText("Installed models")).toBeNull();
  });

  it("opens the machine tab from the withheld lane's Manage button", async () => {

    /* Drawn since Leg 6 with no handler: the lane named a total it could not
       reach. **The door outlived the lane row it was on** — since ADR 0223 the
       Local lane has no card at all and `LockedLanes` carries the button, which
       is the one place left that names what is on this disk. */
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await userEvent.click(await screen.findByRole("button", { name: "Manage" }));

    expect(screen.getByText("Runners on this machine")).toBeInTheDocument();
    expect(screen.queryByText("Accounts")).toBeNull();
  });

  it("calls nothing on this machine a server, on either tab", async () => {
    render(<ModelsScreen />);

    /* The Local lane's `Runtime` row read *The server that loads a language
       model* about a process on `127.0.0.1` — ADR 0160's defect, in the branch
       that record did not touch. Measured over the rows' own sentences rather
       than the whole subtree: the segment carries a button LABELLED `Your
       server`, which is the lane's name and not a claim about this machine. */
    const hints = () =>
      Array.from(document.querySelectorAll(".ws-row-hint")).map((n) => n.textContent ?? "");

    /* **THE GALLERY DRAWS ONE CLOUD ACCOUNT** (ADR 0223), and nothing about it
       is a server. The word belongs to the `Your server` lane and to nothing on
       this machine, which is ADR 0160's rule and the whole of this case. */
    expect(hints().filter((h) => /\bservers?\b/i.test(h))).toEqual([]);
  });

  /** **THE BADGE FOLLOWED THE LANE OFF THE CARD** (ADR 0223). It was measured on
   *  the Lane row, which no longer exists; `LockedLanes` is where a withheld lane
   *  is named now, and ADR 0067's rule — mark what is offered and unbuilt — is
   *  carried by the row that does the naming. */
  it("badges each withheld lane where it is named, which ADR 0067 asked for", async () => {
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const local = (await screen.findByText(/Phase 5/)).closest(".ws-row") as HTMLElement;
    expect(within(local).getByText("Preview")).toBeInTheDocument();

    /* And the two lanes a reader CAN make an account on carry none: a badge on
       an operable lane is the false warning the rule's other half forbids. */
    expect(within(accountBlock(CLOUD_ACCOUNT.id)).queryByText("Preview")).toBeNull();
  });

  it("puts the folder list under the card whose files it describes", async () => {
    withSetup(SETUP, {
      ...EMPTY_LIBRARY,
      folders: [
        {
          path: "/home/felix/whisper-models",
          kind: "your folder",
          removable: true,
          exists: true,
        },
      ],
    });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await openMachineTab();

    /* It stood at the foot of the tab titled *Where models come from*, which by
       reading order answered for the language card above it — whose files are in
       a store this list has never described. Both halves now answer for
       themselves, under the same label, inside their own section. */
    const speech = screen.getByText("Speech models").closest("section");
    const language = screen.getByText("Language models").closest("section");

    expect(within(speech!).getByText("/home/felix/whisper-models")).toBeInTheDocument();
    expect(within(speech!).getByText("Where these come from")).toBeInTheDocument();
    expect(within(language!).getByText("Where these come from")).toBeInTheDocument();
    expect(within(language!).getByText("Ollama's store")).toBeInTheDocument();
    expect(screen.queryByText("Where models come from")).toBeNull();
  });
});

/**
 * A LOCKED LANE SAYS WHY, AND WHERE THIS MACHINE STANDS (B12, ADR 0163).
 *
 * **The lock itself is not on trial and these cases assert that it holds.**
 * ADR 0067 rule 1 keeps `Local`, `Your server` and `Enterprise` inoperable;
 * what B12 changes is that the card now says why, and — for the one lane the
 * runtime actually carries — what is already installed and what is not.
 *
 * **The distinction every case here is really about** is *not published*
 * against *not ready*. A machine with `whisper-cli`, a ggml model and Ollama
 * answering is READY and still not offered, and a surface that folds those two
 * into one greyed control is the silence this step closes.
 */
describe("A lane that is locked says why", () => {
  const READY = {
    readiness: "ready",
    runner_ready: true,
    model_ready: true,
    chat_ready: true,
    issue_code: null,
    resolved_runner: "/usr/bin/whisper-cli",
    resolved_model: "/home/someone/models/ggml-base.bin",
    resolved_chat_base_url: "http://127.0.0.1:11434",
    resolved_chat_model: "llama3.2:latest",
    available_chat_models: ["llama3.2:latest"],
    guidance: "Local runtime helper, STT model and AI cleanup model are ready.",
  };

  /** `local` answers about the disk, every other provider about a vendor. One
   *  answer for both would let a cloud reply stand in for the local probe. */
  function withSetup(setup: unknown) {
    invoked.mockImplementation(async (command, args) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        const request = (args as { request?: { provider: string } } | undefined)?.request;
        return request?.provider === "local" ? { ...STATUS, local_setup: setup } : STATUS;
      }
      if (command === "resolve_provider_tiers") return TIERS;
      if (command === "model_library") {
        return {
          speech_dir: "/home/someone/.config/WordScript/models/speech",
          folders: [],
          server: { base_url: "http://127.0.0.1:11434", reachable: true, detail: "Answering." },
          rows: [],
        };
      }
      return undefined;
    });
  }

  /** The row carrying a sentence, as a row — the label is a `<b>` holding the
   *  name and the `Preview` tag, so no element's text is the name alone. */
  async function rowSaying(text: RegExp): Promise<HTMLElement> {
    const sentence = await screen.findByText(text);
    const row = sentence.closest(".ws-row");
    expect(row, `no row saying ${text}`).not.toBeNull();
    return row as HTMLElement;
  }

  const WITHHELD = /Not offered yet: Phase 5 still owes/;
  /* **IT SAID `Neither has an adapter` AND D1a MADE THAT FALSE** (ADR 0164).
     B12 put `Your server` and `Enterprise` on one row because one sentence was
     true of both; the self-hosted adapter lands here, so the two lanes stop
     being withheld for the same reason and stop sharing a row. */
  const NO_ADAPTER_ROW = /No adapter yet, so nothing behind it can run a job/;

  it("says a ready machine is withheld by the product and not by the disk", async () => {
    withSetup(READY);
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = await rowSaying(WITHHELD);
    /* All three questions, in one row: why it cannot be chosen, what this
       machine has, and what is left. The third is Phase 5's list, not a
       setup step, and that is the whole point of the case. */
    expect(within(row).getByText("Ready")).toBeInTheDocument();
    expect(within(row).getByText(/whisper-cli/)).toBeInTheDocument();
    expect(within(row).getByText(/the product, not the setup/)).toBeInTheDocument();
    expect(within(row).getByText(/acceleration probe/)).toBeInTheDocument();

    /* AND THE LANE IS STILL NOT OFFERED. Stating the reason is not offering it —
       ADR 0067's reversal is the commit that FINISHES the lane. With the segment
       gone (ADR 0223) *not offered* means there is no account for it and no
       control that pretends there could be, which is a stronger form of the same
       rule than a greyed-out button. */
    expect(screen.queryByRole("group", { name: "Lane" })).toBeNull();
    expect(within(row).getByText(/Phase 5/)).toBeInTheDocument();
  });

  it("counts what is installed rather than saying setup is needed about all of it", async () => {
    withSetup({
      ...READY,
      readiness: "setup_required",
      model_ready: false,
      resolved_model: null,
      issue_code: "missing_model",
      guidance: "Point WORDSCRIPT_LOCAL_MODEL_DIR at a directory containing ggml-base.bin.",
    });
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = await rowSaying(WITHHELD);
    expect(within(row).getByText("2 of 3 ready")).toBeInTheDocument();
    /* Named forwards and backwards: what is there, and what is not. A row that
       only said *setup required* would read the same on a machine with none of
       the three. */
    expect(
      within(row).getByText(/has whisper-cli and Ollama with a language model/),
    ).toBeInTheDocument();
    expect(within(row).getByText(/would still need a speech model/)).toBeInTheDocument();
  });

  it("says nothing about the disk when the probe did not answer", async () => {
    /* `local_setup: null` is the probe failing, not an empty machine — the
       distinction ADR 0160 already made one tab over, held here because this
       row is the one that would otherwise tell somebody to install what they
       have. */
    withSetup(null);
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = await rowSaying(WITHHELD);
    expect(within(row).getByText("Not read")).toBeInTheDocument();
    expect(within(row).queryByText(/would still need/)).toBeNull();
    expect(within(row).queryByText(/none of the three/)).toBeNull();
  });

  it("separates the lane that is withheld from the one that was never built", async () => {
    withSetup(READY);
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const drawn = await rowSaying(NO_ADAPTER_ROW);
    expect(within(drawn).getByText("No adapter")).toBeInTheDocument();
    /* Both rows are marked `Preview`, and they are not the same sentence: one
       lane is finished enough to run and withheld, one has nothing behind it
       at all. */
    expect(within(drawn).getByText("Preview")).toBeInTheDocument();
    expect(within(await rowSaying(WITHHELD)).getByText("Preview")).toBeInTheDocument();
    expect(within(drawn).queryByText("Ready")).toBeNull();
  });

  /**
   * **THE ROW THAT LASTED ONE EVENING** (ADR 0164, then ADR 0165).
   *
   * B12 wrote *"Neither has an adapter yet"* over `Your server` and
   * `Enterprise`; D1a built the adapter and replaced that with *adapter built,
   * nowhere to type the endpoint*; D1b is the somewhere. **A withheld row is
   * only ever as true as the reason it names**, and when the reason is spent
   * the row does not get a softer sentence — the lane comes back.
   *
   * The absence is asserted three ways, because a row can disappear for the
   * wrong reason: the sentence is gone, the lane is offered, and the two lanes
   * that are still withheld still say why they are.
   */
  it("has no row for the lane whose reason for being withheld is gone", async () => {
    withSetup(READY);
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await rowSaying(WITHHELD);
    expect(screen.queryByText(/store nowhere/)).toBeNull();
    expect(screen.queryByText("No configuration")).toBeNull();
    expect(screen.queryByText(/Neither has an adapter/)).toBeNull();

    /* AND THE LANE IS OFFERED, which is the other half of the same fact — a
       reader can make a `Your server` account, which is what having no withheld
       row for it means since ADR 0223 removed the segment that carried the lock.
       The other two still carry their own reasons, one row each. */
    expect(await screen.findByText(/Phase 5/)).toBeInTheDocument();
    await rowSaying(NO_ADAPTER_ROW);
  });

  it("opens the tab that holds the detail its sentence summarises", async () => {
    withSetup(READY);
    renderInDeveloperMode(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = await rowSaying(WITHHELD);
    await userEvent.click(within(row).getByRole("button", { name: "Manage" }));

    /* The door moved something: the machine tab is the one place the three
       parts are listed by name, and a summary that cannot reach it makes the
       reader hunt for what it just told them. */
    expect(await screen.findByText("Runners on this machine")).toBeInTheDocument();
    expect(screen.queryByText(WITHHELD)).toBeNull();
  });

  it("has no lock to explain in the gallery, and probes no disk to explain it with", async () => {
    render(<ModelsScreen />);

    /* The gallery has no runtime, so it has no lock and no machine — which is
       why this whole surface is wired-only and `port:diff` does not move. */
    expect(screen.queryByText(WITHHELD)).toBeNull();
    expect(screen.queryByText(NO_ADAPTER_ROW)).toBeNull();
    expect(invoked).not.toHaveBeenCalled();
  });
});

/**
 * YOUR SERVER, CONFIGURED ON THE SCREEN THAT OFFERS IT (D1b, ADR 0165).
 *
 * **D1a built the adapter and left four `DrawnField`s over it.** An endpoint
 * reached the runtime through `WORDSCRIPT_SELF_HOSTED_BASE_URL` and through
 * nothing else, so the lane stayed locked under ADR 0067 rule 1 and
 * `LockedLanes` said so in the product. These cases are the somewhere to type
 * it, and each one presses a control that does something: a field that writes
 * the config, a button that reaches the secret store, a probe that calls the
 * runtime. **A control asserted only to exist is not tested** — this screen has
 * already had a case drive four disabled segments and measure the default four
 * times under four names (ADR 0161).
 *
 * They are wired-only by construction, which means `port:diff` cannot see any
 * of it: the gallery opens on `Cloud` and has no runtime to derive a lane from.
 * That is B8's known cost (ADR 0159) and the reason this block is long.
 */
describe("Your server, configured", () => {
  const ENDPOINT = {
    base_url: "http://10.0.0.2:8080/v1",
    base_url_source: "config",
    base_url_problem: null,
    model: "ggml-large-v3-turbo",
    model_source: "config",
  };

  const SELF_HOSTED_STATUS = {
    ...STATUS,
    provider: "self_hosted",
    capabilities: { ...CAPABILITIES, chat_completion: false, requires_api_key: false },
    role_credentials: [
      {
        provider: "self_hosted",
        role: "speech",
        kind: null,
        configured: true,
        storage: "os_secret_store",
        key_preview: null,
        missing: null,
      },
    ],
    self_hosted_endpoint: ENDPOINT,
  };

  /** The runtime answering for this lane, with whatever endpoint the case is
   *  about. Every other provider keeps the ordinary fixture, because the point
   *  of several of these is that one card reads one vendor. */
  function withEndpoint(endpoint: unknown, credential?: unknown) {
    invoked.mockImplementation(async (command, args) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        const request = (args as { request?: { provider: string } } | undefined)?.request;
        if (request?.provider !== "self_hosted") return statusFor(args);
        return statusFor(args, {
          ...SELF_HOSTED_STATUS,
          self_hosted_endpoint: endpoint,
          role_credentials: [
            { ...SELF_HOSTED_STATUS.role_credentials[0], ...(credential ?? {}) },
          ],
        });
      }
      if (command === "resolve_provider_tiers") return TIERS;
      if (command === "validate_provider_api_key") {
        return { ok: true, provider: "self_hosted", checked_with: "configured_endpoint" };
      }
      return undefined;
    });
  }

  /** A machine whose connection is its own server. The lane is not screen state
   *  any more — it is this value read backwards (ADR 0165). */
  function serverConfig(server: Partial<{ base_url: string; model: string }> = {}) {
    const account = {
      id: "connection-self_hosted",
      label: "Your server",
      provider: "self_hosted",
      base_url: "http://10.0.0.2:8080/v1",
      model: "ggml-large-v3-turbo",
      plan: "",
      ...server,
    };
    const config = createAppConfig({ connections: [CLOUD_ACCOUNT, account] });
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: account.id, overrides: {}, models: {} };
    return config;
  }

  it("opens on the lane the config is connected to, not on Cloud", async () => {
    withEndpoint(ENDPOINT);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config: serverConfig() })} />);

    /* A machine dictating through its own server that opened this card on
       `Cloud` would describe a connection the runtime is not using — and every
       row under it would belong to a lane nothing runs on. */
    expect(await screen.findByLabelText("URL")).toHaveValue("http://10.0.0.2:8080/v1");
    expect(screen.queryByRole("radiogroup", { name: "Provider" })).toBeNull();
  });

  /**
   * **CHOOSING A LANE WRITES NOTHING** (ADR 0212), and this case is the reversal
   * of the one it replaces.
   *
   * It used to write `buildVendorConnectionPatch` plus the profile's default, so
   * the screen's topmost control created an account AND repointed a profile the
   * reader was never shown — one click of a segment, two decisions, neither of
   * them stated. The lane groups now. Adding the account is its own labelled
   * action, and it still does not assign: pointing a writing style at an account
   * is the `Account` row's decision and that row carries the profile's name.
   */
  it("opens without writing anything, and adds an account without assigning it", async () => {
    const patch = vi.fn();
    withEndpoint(ENDPOINT);
    const runtime = createWorkspaceRuntime({ active: true, patch });
    render(<ModelsScreen runtime={runtime} />);

    expect(patch).not.toHaveBeenCalled();

    /* **THE WAY ON ASKS WHO THE ACCOUNT IS WITH** (B17), and since ADR 0223 it
       asks with the logos rather than with a text select — the recognition
       affordance moved onto the control that decides, from a row that showed it
       and could not be pressed. Creating one still must not assign. */
    await userEvent.click(await screen.findByRole("button", { name: "Add account" }));
    const chips = await screen.findByRole("radiogroup", { name: "Who is this account with" });
    await userEvent.click(within(chips).getByRole("radio", { name: "Your server" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    const written = patch.mock.calls[0][0] as {
      connections?: { id: string; provider: string }[];
      text_profiles?: unknown;
    };
    expect(written.connections?.some((entry) => entry.provider === "self_hosted")).toBe(true);
    /* **AND IT DID NOT ASSIGN.** The rule outlived every drawing that has carried
       it: `+ New` did both on one press (ADR 0212), the chip row did both before
       that, and the radio on each card is what assigns now. */
    expect(written.text_profiles).toBeUndefined();
  });

  it("stores the URL that is typed into it", async () => {
    const patch = vi.fn();
    withEndpoint({ ...ENDPOINT, base_url: null, base_url_source: "unset" });
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({
          active: true,
          patch,
          config: serverConfig({ base_url: "" }),
        })}
      />,
    );

    const field = await screen.findByLabelText("URL");
    await userEvent.type(field, "https://speech.example.com/v1");
    await userEvent.tab();

    expect(patch).toHaveBeenCalledWith({
      connections: [
        CLOUD_ACCOUNT,
        expect.objectContaining({
          id: "connection-self_hosted",
          base_url: "https://speech.example.com/v1",
        }),
      ],
    });
  });

  it("stores the model id that is typed into it", async () => {
    const patch = vi.fn();
    withEndpoint({ ...ENDPOINT, model: null, model_source: "unset" });
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({
          active: true,
          patch,
          config: serverConfig({ model: "" }),
        })}
      />,
    );

    const field = await screen.findByLabelText("Model id");
    await userEvent.type(field, "Systran/faster-whisper-medium");
    await userEvent.tab();

    expect(patch).toHaveBeenCalledWith({
      connections: [
        CLOUD_ACCOUNT,
        expect.objectContaining({
          id: "connection-self_hosted",
          model: "Systran/faster-whisper-medium",
        }),
      ],
    });
  });

  /**
   * **WHAT IS TYPED OUTRANKS THE ENVIRONMENT, AND THE ROW SAYS SO** (ADR 0165).
   *
   * The variable is the second door now rather than the only one, so the row
   * names it exactly when it is the one answering — and shows the URL it
   * carries, because a sentence naming a variable without its value leaves the
   * reader to go and look up what their own app is talking to.
   */
  it("names the environment as the door when the environment is the door, as a machine token", async () => {
    withEndpoint({
      ...ENDPOINT,
      base_url: "https://from-the-shell.example.com/v1",
      base_url_source: "environment",
    });
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: serverConfig({ base_url: "" }),
        })}
      />,
    );

    const field = await screen.findByLabelText("URL");
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("placeholder", "https://from-the-shell.example.com/v1");

    const named = await screen.findByText("WORDSCRIPT_SELF_HOSTED_BASE_URL");
    expect(named).toHaveClass("ws-mono");
  });

  it("prints the runtime's refusal rather than deciding for itself what a safe URL is", async () => {
    const refusal =
      "The endpoint 'http://speech.example.com/v1' is plain HTTP to a public host, so WordScript will not send audio or a token to it.";
    withEndpoint(
      {
        ...ENDPOINT,
        base_url: "http://speech.example.com/v1",
        base_url_problem: refusal,
      },
      { configured: false, missing: refusal },
    );
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: serverConfig({ base_url: "http://speech.example.com/v1" }),
        })}
      />,
    );

    /* `isSecureEndpoint` lives in `openai_compatible.rs` and is not reimplemented
       here — a second copy of a security rule is a second thing to get wrong,
       and the one in the tree already knows `10.example.com` is not a private
       address. The row's job is to say what the runtime said. */
    expect(await screen.findByText(refusal)).toBeInTheDocument();
    /* AND THE FIELD STILL HOLDS WHAT WAS TYPED. A row that blanked a refused
       URL would ask somebody to fix what it had just hidden. */
    expect(screen.getByLabelText("URL")).toHaveValue("http://speech.example.com/v1");
  });

  it("saves the optional token to this lane and never to the cloud vendor", async () => {
    withEndpoint(ENDPOINT);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config: serverConfig() })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Add" }));
    await userEvent.type(screen.getByLabelText("Bearer token"), "a-server-token");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("save_provider_api_key", {
        request: {
          provider: "self_hosted",
          connection: "connection-self_hosted",
          api_key: "a-server-token",
        },
      }),
    );
    expect(invoked).not.toHaveBeenCalledWith(
      "save_provider_api_key",
      expect.objectContaining({ request: expect.objectContaining({ provider: "groq" }) }),
    );
  });

  it("shows a stored token as a preview and offers to remove it", async () => {
    withEndpoint(ENDPOINT, { kind: "api_key", key_preview: "a-se...oken" });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config: serverConfig() })} />);

    expect(await screen.findByText("a-se...oken")).toBeInTheDocument();
    /* THE TOKEN'S REMOVE, NOT THE ACCOUNT'S. The inventory gives every account
       its own Remove (B17), so the row that clears a credential and the row that
       destroys the account it belongs to are two buttons with one name — which
       is why the token's is reached through its own row rather than by name. */
    const tokenRow = (screen.getByText("a-se...oken").closest(".ws-row")) as HTMLElement;
    await userEvent.click(within(tokenRow).getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("clear_provider_api_key", {
        request: { provider: "self_hosted", connection: "connection-self_hosted" },
      }),
    );
  });

  /**
   * **THE PROBE RUNS WHEN IT IS ASKED TO, AND THE BADGE ONLY THEN CLAIMS ONE.**
   *
   * A settings screen that pings somebody's private server on every open is
   * making network decisions for the reader; and `Answering` before anybody
   * asked is the fake readiness `CLAUDE.md` forbids. So the resting state says
   * `Not tested` — which is a third answer, not a pessimistic one.
   */
  it("tests reachability only when the button is pressed", async () => {
    withEndpoint(ENDPOINT);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config: serverConfig() })} />);

    expect(await screen.findByText("Not tested")).toBeInTheDocument();
    expect(invoked).not.toHaveBeenCalledWith(
      "validate_provider_api_key",
      expect.anything(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("validate_provider_api_key", {
        request: {
          provider: "self_hosted",
          connection: "connection-self_hosted",
          api_key: null,
        },
      }),
    );
    expect(await screen.findByText("Answering")).toBeInTheDocument();
  });

  it("keeps the drawing in the gallery and asks the runtime nothing", async () => {
    render(<ModelsScreen />);

    /* **THE GALLERY DRAWS ONE CLOUD ACCOUNT NOW** (ADR 0223). It drew a lane
       segment over a chip row over a credential block, and all three moved or
       went; a drawing that kept them would be showing a screen this build no
       longer has, which is the one thing a gallery must never do (ADR 0055).
       `port:diff` moves with it, deliberately and measured.

       What this case is FOR is unchanged and is the line below: the drawing
       reads nothing. */
    expect(document.querySelector(".ws-acct")).toBeTruthy();
    expect(screen.getAllByText("API key").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("URL")).toBeNull();
    expect(invoked).not.toHaveBeenCalled();
  });
});

/**
 * WHEN THE LANE AND THE PROFILE ARE ON DIFFERENT ACCOUNTS.
 *
 * **The state every case in this file happened to avoid, and the one the product
 * is in most of the time.** The lane stopped being a mode with ADR 0212 — it
 * groups the accounts the card configures — while three things still followed
 * the PROFILE: the account row's own read, the credential rows' scope, and the
 * vendor the key was handed to. Every fixture on the self-hosted lane puts the
 * profile on the server, so the two agreed by accident and nothing failed.
 *
 * They disagree the moment a reader who dictates on Groq opens `Your server`,
 * which is the ordinary way to configure a second lane. What that produced was
 * not cosmetic: the Cloud card's key field wrote a Groq key into the slot the
 * self-hosted adapter reads its bearer token from — the store keys a secret by
 * account and carries no vendor — so the key went to the reader's own machine on
 * the next request and the token that had been there was gone. ADR 0094's one
 * security rule, reached through a lane switch.
 */
describe("A card shows the lane's account and not the profile's", () => {
  const SERVER_ACCOUNT = {
    id: "connection-self_hosted",
    label: "Home box",
    provider: "self_hosted",
    base_url: "http://10.0.0.2:8080/v1",
    model: "faster-whisper-medium",
    plan: "",
  };

  /** A machine holding both, whose profile dictates through the cloud. */
  function cloudProfileWithAServer() {
    const config = createAppConfig({ connections: [CLOUD_ACCOUNT, SERVER_ACCOUNT] });
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: CLOUD_ACCOUNT.id, overrides: {}, models: {} };
    return config;
  }

  beforeEach(() => {
    invoked.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        const provider = (args as { request?: { provider?: string } } | undefined)?.request
          ?.provider;
        if (provider !== "self_hosted") return statusFor(args);
        return statusFor(args, {
          ...STATUS,
          provider: "self_hosted",
          capabilities: { ...CAPABILITIES, chat_completion: false, requires_api_key: false },
          role_credentials: [
            {
              provider: "self_hosted",
              role: "speech",
              kind: null,
              configured: true,
              storage: "os_secret_store",
              key_preview: null,
              missing: null,
            },
          ],
          self_hosted_endpoint: {
            base_url: SERVER_ACCOUNT.base_url,
            base_url_source: "config",
            base_url_problem: null,
            model: SERVER_ACCOUNT.model,
            model_source: "config",
          },
        });
      }
      if (command === "resolve_provider_tiers") return TIERS;
      if (command === "validate_provider_api_key") return { ok: true, provider: "groq", checked_with: "models" };
      return undefined;
    });
  });

  /** The account row read the literal `"Cloud"` while the self-hosted card
   *  rendered it, so `Your server` named the Groq account — and Rename, New and
   *  Remove all acted on Groq, from a card showing the server's URL.
   *
   *  **The inventory holds the same rule** (B17): it lists what the SHOWN lane
   *  holds, so a Cloud account cannot appear under `Your server` and the Rename
   *  and Remove beside each entry can only ever act on that entry. */
  /**
   * **THE OLD GUARD IS NOW STRUCTURAL** (ADR 0223). This asked that a Cloud
   * account could not appear under `Your server` — the defect where the account
   * row read a literal lane while the card rendered another, so Rename and
   * Remove acted on Groq from a card showing the server's URL. There is no lane
   * view to cross any more: every account is on one page, and the rows that
   * configure one live inside that one's card.
   *
   * So the case keeps what can still fail — an account's actions name and reach
   * that account — and asserts the reverse of what it used to: both accounts are
   * there, whatever lane they are on.
   */
  it("shows every account whatever its lane, with rename and remove on each", async () => {
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({ active: true, config: cloudProfileWithAServer() })}
      />,
    );

    await waitFor(() => expect(accountBlock(SERVER_ACCOUNT.id)).toBeTruthy());
    expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy();

    const block = await openAccount(SERVER_ACCOUNT.id);
    expect(within(block).getByRole("button", { name: `Rename ${SERVER_ACCOUNT.label}` })).toBeTruthy();
    expect(within(block).getByRole("button", { name: `Remove ${SERVER_ACCOUNT.label}` })).toBeTruthy();
    /* AND THE SERVER'S OWN ROWS ARE IN THE SERVER'S CARD — the URL cannot be
       read off a card headed with another account's name. */
    expect(within(block).getByLabelText("URL")).toBeTruthy();
    expect(within(await openAccount(CLOUD_ACCOUNT.id)).queryByLabelText("URL")).toBeNull();
  });

  /**
   * **THE INVENTORY IS THE PRODUCT'S LIST AND NOT A STACK OF ITS OWN** (ADR 0222).
   *
   * B17 gave the card its list and built the row out of `ws-stack ws-gap2`, so
   * the separation between two accounts was a gap with the same value as the gap
   * INSIDE one — the owner read the card and could not tell where an account
   * ended. `.ws-list-item` is the hairline-separated row every other list on the
   * machine uses, and this holds the card to it.
   *
   * **The picked account is marked by ground and `aria-pressed`, not by a filled
   * button.** A primary button is the weight of the strongest action on a screen;
   * spending it on *these rows are about this one* made an account read as a call
   * to action while its neighbour read as prose. `aria-pressed` is the half a
   * border cannot give a screen reader, and it was the one thing the old drawing
   * got right — so it is asserted rather than assumed.
   */
  /**
   * **ADR 0222 MADE THE ACCOUNT A LIST ROW AND ADR 0223 MADE IT A CARD**, one day
   * apart, and the second is not a reversal of the first: 0222 fixed a drawing
   * that had no separators and a filled primary button for the pick, and 0223
   * moved the account's own settings INSIDE it, which a list row has nowhere to
   * put. What survives whole is the half 0222 argued hardest for — the pick is
   * marked, not filled — so that is what this case keeps.
   */
  it("draws each account as a card, and marks the picked one without filling it", async () => {
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({ active: true, config: cloudProfileWithAServer() })}
      />,
    );

    await waitFor(() => expect(accountBlock(CLOUD_ACCOUNT.id)).toBeTruthy());
    const block = accountBlock(CLOUD_ACCOUNT.id);
    expect(block.className, "an account is a card").toContain("ws-acct");

    const pick = within(block).getByRole("radio");
    /* The pick is its own button since ADR 0224 — the header strip around it
       also holds the fold, and a button cannot hold the button beside it. */
    expect(pick.className).toContain("ws-acct-pick");
    expect(pick.className).not.toContain("ws-btn");
    expect(pick).toHaveAttribute("aria-checked", "true");
    expect(block).toHaveAttribute("data-current");

    /* AND THE ACCOUNT'S OWN SETTINGS ARE IN IT, which is the whole of ADR 0223:
       the key read as one key for the machine while it sat beside the list. */
    expect(within(await openAccount(CLOUD_ACCOUNT.id)).getByText("API key")).toBeTruthy();
  });

  /**
   * **THE KEY GOES WHERE THE CARD SAYS IT GOES.**
   *
   * The assertion is the pair, and the vendor half is the dangerous one: a save
   * carrying `self_hosted` hands a Groq key to the adapter that posts to the
   * reader's own machine.
   */
  it("saves a cloud key to the cloud account, never to the account the profile is on", async () => {
    const config = cloudProfileWithAServer();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    /* The profile on the SERVER, which is the direction that crossed: the Cloud
       card then scoped its key row to a self-hosted account. */
    active.providers = { default: SERVER_ACCOUNT.id, overrides: {}, models: {} };

    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* THE CLOUD CARD IS THE FOLDED ONE HERE, because the profile bills to the
       server (ADR 0224). Opening it is what the reader does and it is what makes
       the query below name one card rather than the first one drawn. */
    const cloud = within(await openAccount(CLOUD_ACCOUNT.id));
    await userEvent.click(cloud.getByRole("button", { name: /^(Replace|Add)$/ }));
    await userEvent.type(await screen.findByLabelText("API key"), "gsk_typed_for_groq");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("save_provider_api_key", {
        request: {
          provider: "groq",
          connection: CLOUD_ACCOUNT.id,
          api_key: "gsk_typed_for_groq",
        },
      }),
    );
  });

  /**
   * **THE CHIP ROW IS ABOUT THE SAME ACCOUNT AS EVERY ROW UNDER IT.**
   *
   * It read `Wired.connection` — the vendor the PROFILE dictates on — while the
   * rows beneath it moved to `accountForLane` with ADR 0213. With the profile on
   * the server the value was `Your server`, a name the Cloud list does not carry,
   * so no chip drew as chosen and the capability sentence fell back to describing
   * Groq — over an Account row and a key row that were showing the Groq account
   * all along. The row said nothing true about anything.
   */
  it("marks the vendor of the account this card configures, not the profile's", async () => {
    const config = cloudProfileWithAServer();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: SERVER_ACCOUNT.id, overrides: {}, models: {} };

    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);


    /* **THE MARK IS ON THE CARD AND THE CHECK FOLLOWS THE PROFILE** (ADR 0223).
       This asked a chip row at the top of the screen, which marked the vendor of
       whichever account a derivation had opened — the defect ADR 0209 closed one
       row down and this record removed the row for. The card of the account the
       profile bills to is the one that is checked, and every other card carries
       its own vendor's mark whether or not anything bills to it. */
    await waitFor(() => expect(accountBlock(SERVER_ACCOUNT.id)).toBeTruthy());
    expect(within(accountBlock(SERVER_ACCOUNT.id)).getByRole("radio")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(accountBlock(CLOUD_ACCOUNT.id)).getByRole("radio")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  /** And the reachability probe asks about the server the card is showing, not
   *  about whatever account the profile happens to be on. */
  it("probes this lane's server", async () => {
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({ active: true, config: cloudProfileWithAServer() })}
      />,
    );

    const server = within(await openAccount(SERVER_ACCOUNT.id));
    await userEvent.click(server.getByRole("button", { name: "Test" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("validate_provider_api_key", {
        request: {
          provider: "self_hosted",
          connection: SERVER_ACCOUNT.id,
          api_key: null,
        },
      }),
    );
  });
});

/**
 * WHAT A JOB ROW MAY CLAIM ABOUT THE ACCOUNT IT RUNS ON.
 *
 * ADR 0209 removed a vendor-keyed credential read from the connection card and
 * left the identical one on every job row: `credentialStateFor` took a vendor's
 * drawn name, so two accounts on one vendor shared one answer. A profile whose
 * cleanup ran on an employer's keyless account read a green `Key set` off the
 * private account beside it — the badge ADR 0128 exists to forbid, arriving
 * through the argument list rather than through a literal.
 */
describe("A job row reports its own account's key", () => {
  const EMPLOYER = { ...CLOUD_ACCOUNT, id: "connection-groq-2", label: "Employer" };

  it("says No key for the account without one, beside a sibling that has one", async () => {
    const config = createAppConfig({ connections: [CLOUD_ACCOUNT, EMPLOYER] });
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = {
      default: CLOUD_ACCOUNT.id,
      overrides: { cleanup: EMPLOYER.id },
      models: {},
    };

    invoked.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        /* One vendor, two accounts, and only the first holds a key. */
        return askedAbout(args) === CLOUD_ACCOUNT.id
          ? statusFor(args)
          : statusFor(args, {
              ...STATUS,
              role_credentials: ROLE_CREDENTIALS.map((row) => ({
                ...row,
                configured: false,
                key_preview: null,
                missing: "an API key",
              })),
            });
      }
      if (command === "resolve_provider_tiers") return TIERS;
      return undefined;
    });

    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    const cleanup = (await screen.findByText("Cleanup")).closest(".ws-job") as HTMLElement;
    await waitFor(() => expect(within(cleanup).getByText("No key")).toBeInTheDocument());
    expect(within(cleanup).queryByText("Key set")).toBeNull();

    /* And the row that IS on the account with a key still says so — the point is
       two answers, not a badge that has learned to say No. */
    const rewrite = (await screen.findByText("Rewrite")).closest(".ws-job") as HTMLElement;
    await waitFor(() => expect(within(rewrite).getByText("Key set")).toBeInTheDocument());
  });
});
