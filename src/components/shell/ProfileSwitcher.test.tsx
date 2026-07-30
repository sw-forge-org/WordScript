import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import { createEmptyTextProfileCuration } from "../../lib/textProfiles";
import { ProfileSwitcher } from "./ProfileSwitcher";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfileSwitcher", () => {
  it("shows the active profile and switches to another one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ProfileSwitcher
        config={createAppConfig({
          active_text_profile_id: "support",
          text_profiles: [
            {
              id: "general",
              label: "General writing",
              prompt: "",
              stt_hints: "",
              vocabulary_hints: [],
              schema_version: 2,
              curation: createEmptyTextProfileCuration(),
              dictionary_entries: [],
              snippet_entries: [],
            },
            {
              id: "support",
              label: "Support reply",
              prompt: "Escalation contacts",
              stt_hints: "",
              vocabulary_hints: [],
              schema_version: 2,
              curation: createEmptyTextProfileCuration(),
              dictionary_entries: [],
              snippet_entries: [],
            },
          ],
        })}
        onChange={onChange}
        onEdit={vi.fn()}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: /switch active profile/i });
    expect(combobox).toHaveValue("support");

    await user.selectOptions(combobox, "general");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        active_text_profile_id: "general",
        text_profiles: expect.any(Array),
      }),
    );
  });

  // The profile decides the recognizer settings, and those are fixed the moment
  // recording starts — a switch mid-session left the pipeline reading half of
  // one profile and half of the other. The runtime rejects it; this surface
  // says so before the attempt instead of failing silently (ADR 0025).
  it("locks the switcher while a session is running and explains why", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ProfileSwitcher
        config={createAppConfig()}
        onChange={onChange}
        onEdit={vi.fn()}
        sessionActive
      />,
    );

    const combobox = screen.getByRole("combobox", { name: /switch active profile/i });
    expect(combobox).toBeDisabled();
    expect(screen.getByText(/locked while recording/i)).toBeInTheDocument();
    expect(screen.getByText(/processing mode can still be changed/i)).toBeInTheDocument();

    await user.click(combobox);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("waits for the runtime before applying the switch locally", async () => {
    // The optimistic order showed a profile the runtime had refused.
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockRejectedValueOnce(new Error("session running"));
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ProfileSwitcher config={createAppConfig()} onChange={onChange} onEdit={vi.fn()} />,
    );

    const combobox = screen.getByRole("combobox", { name: /switch active profile/i });
    const other = Array.from(combobox.querySelectorAll("option"))
      .map((option) => option.value)
      .find((value) => value !== (combobox as HTMLSelectElement).value);
    await user.selectOptions(combobox, other!);

    expect(invoke).toHaveBeenCalledWith("switch_active_text_profile", { profileId: other });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("invokes the edit callback", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <ProfileSwitcher config={createAppConfig()} onChange={vi.fn()} onEdit={onEdit} />,
    );

    await user.click(screen.getByRole("button", { name: /edit profiles/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
