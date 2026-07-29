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
