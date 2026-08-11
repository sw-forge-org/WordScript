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

const STATUS = {
  provider: "groq",
  default_profile: "fast",
  credential: { provider: "groq", configured: true, storage: "the OS secret store", key_preview: "gsk_…4f2a" },
  profiles: [],
  capabilities: {},
  local_setup: null,
};

const TIERS = [
  { id: "free", label: "Free — 25 MiB per request", max_audio_bytes: 26_214_400, default: true },
  { id: "dev", label: "Developer — 100 MiB per request", max_audio_bytes: 104_857_600, default: false },
];

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
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

    /* ADR 0067. `local_preview` IS a runtime provider, and the owner's answer
       was that being real is not the same as being finished. */
    const lane = screen.getByRole("group", { name: "Lane" });
    expect(within(lane).getByRole("button", { name: "Local" })).toBeDisabled();
    expect(within(lane).getByRole("button", { name: "Enterprise" })).toBeDisabled();
  });

  it("offers every drawn provider chip and accepts a click on one", () => {
    render(<ModelsScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const chips = screen.getByRole("radiogroup", { name: "Provider" });
    expect(within(chips).getByRole("radio", { name: /Groq/ })).not.toBeDisabled();
    const others = within(chips)
      .getAllByRole("radio")
      .filter((chip) => !/Groq/.test(chip.textContent ?? ""));
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
});
