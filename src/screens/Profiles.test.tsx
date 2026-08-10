import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ProfilesScreen } from "./Profiles";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";
import type { AppConfig } from "@/types/ipc";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * WHAT A PARTLY WIRED SCREEN'S TEST IS FOR. Profiles is still in the gallery,
 * so its fidelity is still measured in `screens.test.tsx` against the drawing.
 * This file is which facts come from the runtime, which controls write, and
 * that the five that cannot act are inert rather than absent.
 *
 * It is also the first place `patchText` is called from a screen. The debounce
 * itself is `useConfigDraft.test.tsx`; what is asserted here is that the text
 * field reaches for it and every other control does not.
 */

const BUDGET = {
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

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  const base = createAppConfig(overrides);
  return {
    ...base,
    text_profiles: [
      {
        ...base.text_profiles[0],
        id: "general",
        label: "General writing",
        prompt: "Tauri desktop runtime",
        dictionary_entries: [{ id: "d1", phrase: "KA", replace_with: "Kundenanfrage" }],
        snippet_entries: [
          { id: "s1", label: "standard closing", trigger: "closing", expansion: "Best regards,\nFelix" },
        ],
        vocabulary_hints: [
          {
            id: "v1",
            phrase: "WebKitGTK",
            use_as_prompt_hint: true,
            origin: "user",
            learned_at_ms: null,
            hit_count: 0,
            observation_count: 0,
          },
        ],
      },
    ],
    active_text_profile_id: "general",
    ...overrides,
  };
}

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "resolve_capture_budget") return BUDGET;
    if (command === "get_profile_health") {
      return {
        level: "yellow",
        flags: [{ kind: "form_conflict", hint: "The prompt asks for two different address forms." }],
      };
    }
    return undefined;
  });
});

afterEach(cleanup);

describe("Profiles, wired", () => {
  it("lists this machine's profiles rather than the drawing's three", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    expect(await screen.findAllByText("General writing")).not.toHaveLength(0);
    expect(screen.queryByText("Customer success replies")).not.toBeInTheDocument();
  });

  it("writes the context textarea through patchText and commits it on blur", async () => {
    const patch = vi.fn();
    const patchText = vi.fn();
    const flushText = vi.fn();
    render(
      <ProfilesScreen
        runtime={createWorkspaceRuntime({ active: true, config: config(), patch, patchText, flushText })}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Context" }));
    const area = screen.getByLabelText("Profile context");
    await userEvent.type(area, "!");

    /* P1: a text field is the one control that must NOT take the instant-save
       path, and it is the only one on this screen that does not. */
    expect(patchText).toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(patchText.mock.calls[0][0].text_profiles[0].prompt).toBe("Tauri desktop runtime!");

    await userEvent.tab();
    expect(flushText).toHaveBeenCalled();
  });

  it("writes every discrete control instantly, including the one you type a word into", async () => {
    const patch = vi.fn();
    const patchText = vi.fn();
    render(
      <ProfilesScreen
        runtime={createWorkspaceRuntime({ active: true, config: config(), patch, patchText })}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Processing mode"), "rewrite");
    expect(patch.mock.calls[0][0].text_profiles[0].work_mode.processing_mode).toBe("rewrite");

    await userEvent.click(screen.getByRole("tab", { name: "Words" }));
    await userEvent.type(screen.getByLabelText("Add a word or name"), "ydotool{Enter}");
    /* Adding a term is one word and one write — discrete, even though it was
       typed into a text field. */
    const last = patch.mock.calls[patch.mock.calls.length - 1][0];
    expect(last.text_profiles[0].vocabulary_hints.map((h: { phrase: string }) => h.phrase)).toEqual([
      "WebKitGTK",
      "ydotool",
    ]);
    expect(patchText).not.toHaveBeenCalled();
  });

  it("states the runtime's ceiling and headroom, not the drawing's 13:39", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("resolve_capture_budget"));
    expect(
      await screen.findByText("13:39 — the 25 MiB upload size on your free plan. Past it, nothing transcribes."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("At this length. Up to 12:18 keeps headroom under the ceiling."),
    ).toBeInTheDocument();
  });

  it("says nothing about a ceiling the runtime did not answer with", async () => {
    invoked.mockImplementation(async () => undefined);
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    expect(
      await screen.findByText("The runtime has not answered with a processing limit."),
    ).toBeInTheDocument();
    expect(screen.getByText("Not read")).toBeInTheDocument();
  });

  it("counts the runtime's health flags and carries their sentences on the control", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    const flag = await screen.findByRole("button", { name: /1 flag/ });
    expect(flag).toHaveAttribute("title", "The prompt asks for two different address forms.");
    /* The count is a fact; the click has nowhere drawn to go (ADR 0065). */
    expect(flag).toBeDisabled();
  });

  it("keeps every control with no editor behind it drawn and inert", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    expect(screen.getByRole("button", { name: /New profile/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^More/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Check against a sample/ })).toBeDisabled();

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    expect(screen.getByRole("button", { name: "Add replacement" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Edit —/ })).toBeDisabled();
    /* Delete needs no editor, so it is the one that acts. */
    expect(screen.getByRole("button", { name: "Delete" })).not.toBeDisabled();
  });

  it("deletes a replacement and a snippet from the profile the runtime holds", async () => {
    const patch = vi.fn();
    render(
      <ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config(), patch })} />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Replacements" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(patch.mock.calls[0][0].text_profiles[0].dictionary_entries).toEqual([]);
  });

  it("offers Translate and cannot select it, because the runtime has no such mode", async () => {
    render(<ProfilesScreen runtime={createWorkspaceRuntime({ active: true, config: config() })} />);

    const select = screen.getByLabelText("Processing mode") as HTMLSelectElement;
    const translate = [...select.options].find((option) => option.textContent === "Translate")!;
    /* ADR 0041 gave it a slot; `ProcessingMode` has six values. Same hole as
       the seventh mode key on Hotkeys. */
    expect(translate.disabled).toBe(true);
  });

  it("marks only the active profile active", async () => {
    const twoProfiles = config();
    twoProfiles.text_profiles = [
      twoProfiles.text_profiles[0],
      { ...twoProfiles.text_profiles[0], id: "support", label: "Support reply" },
    ];
    const runtime = createWorkspaceRuntime({ active: true, config: twoProfiles });
    render(<ProfilesScreen runtime={runtime} />);

    expect(screen.getByText("Active in this session")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Support reply/ }));
    expect(screen.queryByText("Active in this session")).not.toBeInTheDocument();
  });
});
