import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ModelsScreen } from "./Models";
import { LANE_LABEL } from "./data";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";

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

const STATUS = {
  provider: "groq",
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

const TIERS = [
  { id: "free", label: "Free — 25 MiB per request", max_audio_bytes: 26_214_400, default: true },
  { id: "dev", label: "Developer — 100 MiB per request", max_audio_bytes: 104_857_600, default: false },
];

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "registered_providers") return REGISTERED;
    if (command === "provider_status") return STATUS;
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

describe("AI Models, wired", () => {
  it("keeps all four lanes drawn and lets the two operable ones be chosen", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const lane = screen.getByRole("group", { name: "Lane" });
    /* ADR 0065 part 1: no lane is deleted or moved. Asked by LABEL rather than
       by identifier since ADR 0160 — `Self-hosted` is stored and `Your server`
       is read, and what this case is about is what the user can reach.

       **`Your server` JOINED CLOUD IN D1b** (ADR 0165). The rule was never
       *only the integrated lane*, which is what this case used to be called; it
       is ADR 0067 rule 1 — a lane that is offered must be operable. That lane
       now stores a URL, an optional token and a model id, so it is offered.
       The two that stay disabled stay for their own reasons, one per row on
       `LockedLanes`. */
    expect(within(lane).getByRole("button", { name: LANE_LABEL.Cloud })).not.toBeDisabled();
    expect(
      within(lane).getByRole("button", { name: LANE_LABEL["Self-hosted"] }),
    ).not.toBeDisabled();
    for (const lane_ of ["Local", "Enterprise"] as const) {
      expect(
        within(lane).getByRole("button", { name: LANE_LABEL[lane_] }),
        lane_,
      ).toBeDisabled();
    }
  });

  it("treats Local exactly as it treats the two lanes the runtime has never carried", () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* ADR 0067. `local` IS a runtime provider, and the owner's answer
       was that being real is not the same as being finished. */
    const lane = screen.getByRole("group", { name: "Lane" });
    expect(within(lane).getByRole("button", { name: "Local" })).toBeDisabled();
    expect(within(lane).getByRole("button", { name: "Enterprise" })).toBeDisabled();
  });

  /* AWAITED SINCE ADR 0124, and the wait is the change: which chip can be
     picked used to be the literal `["Groq"]` and is now the registry's answer,
     so it arrives with the command rather than with the first paint. Until it
     does every chip is inert — a chip enabled before the runtime has said
     anything is the fake readiness this screen's own comment warns about. */
  it("offers every drawn provider chip and accepts a click on one", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const chips = screen.getByRole("radiogroup", { name: "Provider" });
    await waitFor(() =>
      expect(within(chips).getByRole("radio", { name: /Groq/ })).not.toBeDisabled(),
    );
    /* Both registered vendors are selectable and every drawn one without an
       adapter is not — which is the sentence ADR 0124 wanted the chip row to
       make, now that there is more than one of each. */
    await waitFor(() =>
      expect(within(chips).getByRole("radio", { name: /OpenAI/ })).not.toBeDisabled(),
    );
    const others = within(chips)
      .getAllByRole("radio")
      .filter((chip) => NO_ADAPTER.test(chip.textContent ?? ""));
    expect(others.length).toBeGreaterThan(0);
    for (const chip of others) expect(chip).toBeDisabled();
  });

  it("reads the credential the runtime holds and shows its preview, never the key", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("provider_status", expect.anything()));
    expect(await screen.findByText("gsk_…4f2a")).toBeInTheDocument();
    expect(screen.getByText("In the OS secret store. Never written to the config file.")).toBeInTheDocument();
  });

  it("says Not set rather than Set when the runtime has no key", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        return { ...STATUS, credential: { ...STATUS.credential, configured: false, key_preview: null } };
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
        request: { provider: "groq", api_key: "gsk_newkey" },
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
      "Developer — 100 MiB per request",
    ]);
    await userEvent.selectOptions(plan, "dev");
    expect(patch).toHaveBeenCalledWith({ provider_tier: "dev" });
  });

  it("states the runtime's recording ceiling rather than the drawing's ~26 min", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("13:39")).toBeInTheDocument();
    expect(screen.queryByText("~26 min")).not.toBeInTheDocument();
  });

  it("leaves every job-row control drawn and inert, with the reason on it", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const language = await screen.findByLabelText("Language");
    expect(language).toBeDisabled();
    expect(language).toHaveAttribute("title", expect.stringContaining("Not integrated yet"));
    expect(screen.getByLabelText("Pin this language")).toBeDisabled();
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
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        /* Groq, integrated and holding a key, that this build cannot ask to
           listen. Not a real state today and that is the point: the two
           registered lanes agree with their drawing by accident, and ten will
           not. */
        return { ...STATUS, capabilities: { ...CAPABILITIES, transcription: false } };
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
       that is not theirs — the axis the runtime denied is speech. */
    const cleanup = await modelRowOf("Cleanup");
    expect(cleanup.getAttribute("title")).not.toContain("speech recognition");
  });

  /**
   * **THE EMPTY BLOCK, WHICH USED TO PASS.** `capabilities: {}` was the mock
   * this file carried while the suite went green — the proof nothing consumed
   * it. It must now read as *the runtime did not answer*, never as nine quiet
   * `false`s: a capability defaulting to absent is a row silently inert, which
   * ADR 0106 calls the same defect one layer down.
   */
  it("reports an unanswered capability block instead of reading it as a denial", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") return { ...STATUS, capabilities: {} };
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

    const chips = screen.getByRole("radiogroup", { name: "Provider" });
    await waitFor(() =>
      expect(within(chips).getByRole("radio", { name: /Groq/ })).not.toBeDisabled(),
    );

    /* THE EXAMPLE MOVED BECAUSE THE REGISTRY DID. This named OpenAI until D1
       registered it, which is the case working rather than breaking: what the
       assertion means is *a vendor the drawing names and the registry does
       not*, and Anthropic is that vendor now. */
    const anthropic = within(chips).getByRole("radio", { name: /Anthropic/ });
    expect(anthropic).toBeDisabled();
    expect(anthropic).toHaveAttribute("title", expect.stringContaining("no adapter"));
    expect(within(chips).getByRole("radio", { name: /OpenAI/ })).not.toBeDisabled();
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

  it("writes the chosen connection onto the active profile", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const runtime = createWorkspaceRuntime({ active: true, patch });
    render(<ModelsScreen runtime={runtime} />);

    const chips = screen.getByRole("radiogroup", { name: "Provider" });
    await waitFor(() =>
      expect(within(chips).getByRole("radio", { name: /OpenAI/ })).not.toBeDisabled(),
    );
    await user.click(within(chips).getByRole("radio", { name: /OpenAI/ }));

    expect(patch).toHaveBeenCalledTimes(1);
    /* The RUNTIME id, never the drawn name: `providers.default` is read by
       `resolve_entry`, which knows `openai` and has never heard of `OpenAI`. */
    expect(axisOf(patch.mock.calls[0][0], runtime.config.active_text_profile_id)).toEqual({
      default: "openai",
      overrides: {},
    });
  });

  it("saves a key to the vendor the connection names and never to Groq", async () => {
    const user = userEvent.setup();
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "openai", overrides: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* Several rows draw a Replace button — every overriding job row has one —
       and exactly one of them is live: the connection's. The drawn ones are
       disabled by `InertBecause`, which is what picks it out here. */
    const keyButtons = await screen.findAllByRole("button", { name: /Replace|Add/ });
    const live = keyButtons.find((button) => !(button as HTMLButtonElement).disabled);
    expect(live, "the connection's key button is the live one").toBeDefined();
    await user.click(live as HTMLElement);
    await user.type(screen.getByLabelText(/API key/i), "sk-proj-abcdefghijklmnop");
    await user.click(screen.getByRole("button", { name: "Save" }));

    /* THE BUG THIS CASE EXISTS FOR: writing an OpenAI key into Groq's
       secret-store entry, which is one literal away and silent. */
    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("save_provider_api_key", {
        request: { provider: "openai", api_key: "sk-proj-abcdefghijklmnop" },
      }),
    );
    expect(invoked).not.toHaveBeenCalledWith(
      "save_provider_api_key",
      expect.objectContaining({ request: expect.objectContaining({ provider: "groq" }) }),
    );
  });

  it("reads a plan the new vendor never had as that vendor's default", async () => {
    const config = createAppConfig();
    /* Groq's paid plan, stored machine-wide, while the connection is OpenAI —
       which publishes one ceiling for every account. */
    config.provider_tier = "dev";
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "openai", overrides: {} };
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

    /* A select whose value matches no option renders blank, and blank reads as
       a setting nobody made rather than one that does not apply. The runtime
       already falls back to the default for an unrecognised plan id; the
       surface has to say the same thing. */
    await waitFor(() =>
      expect(screen.getByLabelText("Account plan")).toHaveValue(""),
    );
    expect(screen.getByLabelText("Account plan")).not.toBeDisabled();
  });

  it("names the stored connection on a job row that follows it", async () => {
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "openai", overrides: {} };
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    /* `Follow the connection · Groq` on a profile connected to OpenAI is the
       row lying about where the job runs, and it is the sentence a user reads
       to find that out. */
    const cleanup = (await screen.findByText("Cleanup")).closest(".ws-job") as HTMLElement;
    expect(within(cleanup).getByLabelText("Provider")).toHaveValue(
      "Follow the connection · OpenAI",
    );
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

  function configWith(overrides: Record<string, string>) {
    const config = createAppConfig();
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "groq", overrides };
    return config;
  }

  function rowOf(name: string): HTMLElement {
    return (screen.getByText(name).closest(".ws-job") as HTMLElement) ?? screen.getByText(name);
  }

  it("follows the connection where nothing is stored, though the drawing overrides", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config: configWith({}) })} />);

    /* `Upload` is one of the three rows `data.ts` draws with `override:
       "OpenAI"`. The stored answer is that it overrides nothing, and the
       product states the stored answer. */
    const upload = rowOf("Upload");
    await waitFor(() =>
      expect(within(upload).getByLabelText("Provider")).toHaveValue(
        "Follow the connection · Groq",
      ),
    );
    /* And the key row belongs to the override, so it is not drawn at all —
       the row is on the connection and the connection's key is above. */
    expect(within(upload).queryByText(/^(Set|Not set|Not read)$/)).toBeNull();
  });

  it("draws the override shape only for the job that stores one", async () => {
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({ active: true, config: configWith({ upload: "openai" }) })}
      />,
    );

    await waitFor(() =>
      expect(within(rowOf("Upload")).getByLabelText("Provider")).toHaveValue("OpenAI"),
    );
    /* Translate is drawn with `override: "Anthropic"` and stores nothing. */
    expect(within(rowOf("Translate")).getByLabelText("Provider")).toHaveValue(
      "Follow the connection · Groq",
    );
  });

  it("writes the override as a runtime id and clears it rather than storing the connection", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const config = configWith({});
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config, patch })} />);

    const select = within(rowOf("Upload")).getByLabelText("Provider");
    await waitFor(() => expect(select).not.toBeDisabled());
    await user.selectOptions(select, "OpenAI");

    expect(axisOf(patch.mock.calls[0][0], config.active_text_profile_id)).toEqual({
      default: "groq",
      overrides: { upload: "openai" },
    });

    /* *Use the default* DELETES the key. Writing the connection's id would
       freeze the job onto today's connection (ADR 0094 — the absence is the
       value), so the row would stop following one the user changes later. */
    patch.mockClear();
    cleanup();
    const stored = configWith({ upload: "openai" });
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config: stored, patch })} />);
    const useDefault = await within(rowOf("Upload")).findByRole("button", {
      name: "Use the default",
    });
    await waitFor(() => expect(useDefault).not.toBeDisabled());
    await user.click(useDefault);

    expect(axisOf(patch.mock.calls[0][0], stored.active_text_profile_id)).toEqual({
      default: "groq",
      overrides: {},
    });
  });

  it("offers a vendor with no adapter, disabled, carrying its reason", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true, config: configWith({}) })} />);

    const select = within(rowOf("Translate")).getByLabelText("Provider");
    await waitFor(() => expect(select).not.toBeDisabled());

    /* THE RULE THIS CASE HOLDS: an unbuilt vendor stays visible so the screen
       keeps showing what the product still owes, and is disabled so it cannot
       be chosen. Deleting the option and enabling it are both wrong. */
    const anthropic = within(select as HTMLElement).getByRole("option", { name: "Anthropic" });
    expect(anthropic).toBeDisabled();
    expect(anthropic).toHaveAttribute("title", expect.stringContaining("no adapter"));

    const openai = within(select as HTMLElement).getByRole("option", { name: "OpenAI" });
    expect(openai).not.toBeDisabled();
  });

  it("keeps the provider select operable on a row that is inert", async () => {
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
    await waitFor(() => expect(within(row).getByLabelText("Provider")).toHaveValue("Anthropic"));
    expect(within(row).getByLabelText("Provider")).not.toBeDisabled();
    expect(within(row).getByRole("button", { name: "Use the default" })).not.toBeDisabled();
    /* The model row is a choice ON the vendor, so it stays inert. */
    expect(within(row).getByLabelText("Model")).toBeDisabled();
  });

  it("reads the overriding job's key from the runtime instead of claiming it is set", async () => {
    /* THE DEFECT THIS CASE EXISTS FOR. The row read a literal
       `StatusBadge tone="success">Set` from Leg 6 until ADR 0128 — a green
       badge asserting a stored credential nothing had been asked about. */
    invoked.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "registered_providers") return REGISTERED;
      if (command === "provider_status") {
        const provider = (args as { request: { provider: string } }).request.provider;
        if (provider === "openai") {
          return {
            ...STATUS,
            provider: "openai",
            role_credentials: [
              { provider: "openai", role: "speech", kind: "api_key", configured: false, storage: "os_secret_store", key_preview: null, missing: "an API key" },
              { provider: "openai", role: "chat", kind: "api_key", configured: false, storage: "os_secret_store", key_preview: null, missing: "an API key" },
            ],
          };
        }
        return STATUS;
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
    await waitFor(() => expect(within(upload).getByText("Not set")).toBeInTheDocument());
    expect(within(upload).queryByText("Set")).toBeNull();
    expect(within(upload).getByRole("button", { name: "Add key" })).toBeInTheDocument();
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
  it("is the drawing, with every lane selectable and nothing read", () => {
    render(<ModelsScreen />);

    const lane = screen.getByRole("group", { name: "Lane" });
    for (const lane_ of ["Cloud", "Local", "Self-hosted", "Enterprise"] as const) {
      expect(
        within(lane).getByRole("button", { name: LANE_LABEL[lane_] }),
        lane_,
      ).not.toBeDisabled();
    }
    expect(screen.getAllByText("Set").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Account plan")).not.toBeDisabled();
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
        return request?.provider === "local" ? { ...STATUS, local_setup: setup } : STATUS;
      }
      if (command === "resolve_provider_tiers") return TIERS;
      if (command === "model_library") return library;
      return undefined;
    });
  }

  async function openMachineTab() {
    await userEvent.click(screen.getByRole("tab", { name: "On this machine" }));
  }

  it("reads the lane as Your server and still stores it as Self-hosted", () => {
    render(<ModelsScreen />);

    const lane = screen.getByRole("group", { name: "Lane" });
    expect(within(lane).getByRole("button", { name: "Your server" })).toBeInTheDocument();
    expect(within(lane).queryByRole("button", { name: "Self-hosted" })).toBeNull();
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
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);
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
    render(<ModelsScreen />);

    const gpuClaim = /no CUDA, ROCm or Metal device/;

    for (const lane of ["Cloud", "Local", "Your server", "Enterprise"]) {
      await userEvent.click(screen.getByRole("button", { name: lane }));
      expect(screen.queryByText(gpuClaim), lane).toBeNull();
    }

    /* **AND THE LANE NO LONGER HAS THE BADGE AT ALL** (ADR 0162): acceleration
       is a property of the machine, so it is stated once, on the tab that owns
       the machine. The duplicate here is what let ADR 0161's fix be applied
       to one copy and miss the other. */
    await userEvent.click(screen.getByRole("button", { name: "Local" }));
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
  it("keeps the Local lane to the three rows that are about the connection", async () => {
    render(<ModelsScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Local" }));

    const connection = screen.getByText("Connection").closest("section") as HTMLElement;
    const labels = Array.from(connection.querySelectorAll(".ws-row-text > b")).map((node) =>
      /* The lane row's own `PreviewTag` rides inside the label, so the tag text
         comes off before the label is compared. */
      (node.textContent ?? "").replace(/Preview$/, ""),
    );

    expect(labels).toEqual(["Lane", "Language runner", "Credential", "Installed models"]);

    /* **AND NO CONTROL IS DUPLICATED EITHER**, which the row count alone does
       not catch: `Bundled | Yours` survived the first cut inside the surviving
       `Language runner` row while the count already read three. Which program
       runs belongs to the tab that lists the runners. */
    expect(within(connection).queryByRole("group", { name: "Language runner" })).toBeNull();
    expect(within(connection).queryByRole("button", { name: "Bundled" })).toBeNull();
  });

  it("opens the machine tab from the lane's Manage button", async () => {
    render(<ModelsScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Local" }));

    /* Drawn since Leg 6 with no handler: the lane named a total it could not
       reach. Everything else on this lane stays a drawing; a door is the one
       inert control that costs the reader the thing it names. */
    await userEvent.click(screen.getByRole("button", { name: "Manage" }));

    expect(screen.getByText("Runners on this machine")).toBeInTheDocument();
    expect(screen.queryByText("Connection")).toBeNull();
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

    await userEvent.click(screen.getByRole("button", { name: "Local" }));
    expect(hints().filter((h) => /\bservers?\b/i.test(h))).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Your server" }));
    expect(hints().filter((h) => /\bservers?\b/i.test(h)).length).toBeGreaterThan(0);
  });

  it("badges a drawn lane on the screen that offers it, which ADR 0067 asked for", async () => {
    render(<ModelsScreen />);

    /* Measured on the Lane row itself rather than on the section: the Local
       lane's own `Acceleration` row carries a second tag, so a section-wide
       count would pass for the wrong reason. */
    const laneRow = () => screen.getByText("Lane").closest(".ws-row") as HTMLElement;

    expect(within(laneRow()).queryByText("Preview")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Local" }));
    expect(within(laneRow()).getByText("Preview")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cloud" }));
    expect(within(laneRow()).queryByText("Preview")).toBeNull();
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
  const NO_ADAPTER_ROW = /no adapter yet, so there is nothing behind it/;

  it("says a ready machine is withheld by the product and not by the disk", async () => {
    withSetup(READY);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = await rowSaying(WITHHELD);
    /* All three questions, in one row: why it cannot be chosen, what this
       machine has, and what is left. The third is Phase 5's list, not a
       setup step, and that is the whole point of the case. */
    expect(within(row).getByText("Ready")).toBeInTheDocument();
    expect(within(row).getByText(/whisper-cli/)).toBeInTheDocument();
    expect(within(row).getByText(/the product, not the setup/)).toBeInTheDocument();
    expect(within(row).getByText(/acceleration probe/)).toBeInTheDocument();

    /* AND THE LOCK STILL HOLDS. Stating the reason is not offering the lane —
       removing `disabled` is ADR 0067's reversal and is not this step. */
    const lane = screen.getByRole("group", { name: "Lane" });
    expect(within(lane).getByRole("button", { name: LANE_LABEL.Local })).toBeDisabled();
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
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

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
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = await rowSaying(WITHHELD);
    expect(within(row).getByText("Not read")).toBeInTheDocument();
    expect(within(row).queryByText(/would still need/)).toBeNull();
    expect(within(row).queryByText(/none of the three/)).toBeNull();
  });

  it("separates the lane that is withheld from the one that was never built", async () => {
    withSetup(READY);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

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
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await rowSaying(WITHHELD);
    expect(screen.queryByText(/store nowhere/)).toBeNull();
    expect(screen.queryByText("No configuration")).toBeNull();
    expect(screen.queryByText(/Neither has an adapter/)).toBeNull();

    /* AND THE LANE IS OFFERED, which is the other half of the same fact. The
       row existed because ADR 0067 rule 1 forbids offering a lane that cannot
       be operated; removing the row and leaving the lock would grey a lane out
       for no stated reason at all, which is the silence B12 closed. */
    const lane = screen.getByRole("group", { name: "Lane" });
    expect(
      within(lane).getByRole("button", { name: LANE_LABEL["Self-hosted"] }),
    ).not.toBeDisabled();

    /* The other two are untouched and still carry their own reasons. */
    expect(within(lane).getByRole("button", { name: LANE_LABEL.Local })).toBeDisabled();
    expect(within(lane).getByRole("button", { name: LANE_LABEL.Enterprise })).toBeDisabled();
    await rowSaying(NO_ADAPTER_ROW);
  });

  it("opens the tab that holds the detail its sentence summarises", async () => {
    withSetup(READY);
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

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
        if (request?.provider !== "self_hosted") return STATUS;
        return {
          ...SELF_HOSTED_STATUS,
          self_hosted_endpoint: endpoint,
          role_credentials: [
            { ...SELF_HOSTED_STATUS.role_credentials[0], ...(credential ?? {}) },
          ],
        };
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
  function serverConfig(overrides: Partial<ReturnType<typeof createAppConfig>> = {}) {
    const config = createAppConfig({
      self_hosted_base_url: "http://10.0.0.2:8080/v1",
      self_hosted_model: "ggml-large-v3-turbo",
      ...overrides,
    });
    const active = config.text_profiles.find(
      (profile) => profile.id === config.active_text_profile_id,
    )!;
    active.providers = { default: "self_hosted", overrides: {} };
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

  it("writes the lane onto the provider axis when it is chosen", async () => {
    const patch = vi.fn();
    withEndpoint(ENDPOINT);
    const runtime = createWorkspaceRuntime({ active: true, patch });
    render(<ModelsScreen runtime={runtime} />);

    await userEvent.click(screen.getByRole("button", { name: LANE_LABEL["Self-hosted"] }));

    /* THE RUNTIME id, and onto the same axis the chip row writes: picking a
       lane and picking a vendor are one question asked at two altitudes. */
    expect(patch).toHaveBeenCalledTimes(1);
    const written = patch.mock.calls[0][0] as {
      text_profiles?: { id: string; providers?: { default?: string } }[];
    };
    expect(
      written.text_profiles?.find((p) => p.id === runtime.config.active_text_profile_id)?.providers,
    ).toEqual({ default: "self_hosted", overrides: {} });
  });

  it("stores the URL that is typed into it", async () => {
    const patch = vi.fn();
    withEndpoint({ ...ENDPOINT, base_url: null, base_url_source: "unset" });
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({
          active: true,
          patch,
          config: serverConfig({ self_hosted_base_url: "" }),
        })}
      />,
    );

    const field = await screen.findByLabelText("URL");
    await userEvent.type(field, "https://speech.example.com/v1");
    await userEvent.tab();

    expect(patch).toHaveBeenCalledWith({ self_hosted_base_url: "https://speech.example.com/v1" });
  });

  it("stores the model id that is typed into it", async () => {
    const patch = vi.fn();
    withEndpoint({ ...ENDPOINT, model: null, model_source: "unset" });
    render(
      <ModelsScreen
        runtime={createWorkspaceRuntime({
          active: true,
          patch,
          config: serverConfig({ self_hosted_model: "" }),
        })}
      />,
    );

    const field = await screen.findByLabelText("Model id");
    await userEvent.type(field, "Systran/faster-whisper-medium");
    await userEvent.tab();

    expect(patch).toHaveBeenCalledWith({ self_hosted_model: "Systran/faster-whisper-medium" });
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
          config: serverConfig({ self_hosted_base_url: "" }),
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
          config: serverConfig({ self_hosted_base_url: "http://speech.example.com/v1" }),
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
        request: { provider: "self_hosted", api_key: "a-server-token" },
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
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("clear_provider_api_key", {
        request: { provider: "self_hosted" },
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
        request: { provider: "self_hosted", api_key: null },
      }),
    );
    expect(await screen.findByText("Answering")).toBeInTheDocument();
  });

  it("keeps the drawing in the gallery and asks the runtime nothing", async () => {
    render(<ModelsScreen />);
    await userEvent.click(screen.getByRole("button", { name: LANE_LABEL["Self-hosted"] }));

    /* The gallery is what `port:diff` measures, so the drawn rows stay exactly
       as Leg 6 drew them — including `Model ids are typed`, which the wired
       card replaces with a field, and the drawn URL's own literal, which is the
       value the harness compares against the prototype. */
    expect(screen.getByText("Model ids are typed")).toBeInTheDocument();
    expect(screen.getByLabelText("URL")).toHaveValue("http://10.0.0.2:8080/v1");
    expect(screen.getByText("Answering")).toBeInTheDocument();
    expect(invoked).not.toHaveBeenCalled();
  });
});
