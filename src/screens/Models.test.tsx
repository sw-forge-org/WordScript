import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ModelsScreen } from "./Models";
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
];

/** The vendors this fixture leaves without an adapter, by drawn name. */
const NO_ADAPTER = /Anthropic|Gemini|Mistral|xAI|OpenRouter/;

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
  it("keeps all four lanes drawn and lets only the integrated one be chosen", async () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const lane = screen.getByRole("group", { name: "Lane" });
    /* ADR 0065 part 1: no lane is deleted, moved or reworded. */
    expect(within(lane).getByRole("button", { name: "Cloud" })).not.toBeDisabled();
    for (const name of ["Local", "Self-hosted", "Enterprise"]) {
      expect(within(lane).getByRole("button", { name }), name).toBeDisabled();
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
    for (const name of ["Cloud", "Local", "Self-hosted", "Enterprise"]) {
      expect(within(lane).getByRole("button", { name }), name).not.toBeDisabled();
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
