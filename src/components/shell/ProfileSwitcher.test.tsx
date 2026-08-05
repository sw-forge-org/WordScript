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

const TWO_PROFILES = createAppConfig({
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
});

describe("ProfileSwitcher", () => {
  it("shows the active profile and switches to another one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ProfileSwitcher config={TWO_PROFILES} onChange={onChange} />);

    const combobox = screen.getByRole("combobox", { name: /switch active profile/i });
    expect(combobox).toHaveValue("support");
    // The row states the active one; the options are the select's own, so the
    // name appears twice and only the drawn one is this assertion's subject.
    expect(document.querySelector(".ws-who b")).toHaveTextContent("Support reply");

    await user.selectOptions(combobox, "general");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        active_text_profile_id: "general",
        text_profiles: expect.any(Array),
      }),
    );
  });

  // THE ROW IS THE CONTROL — one popup button rather than the shipped avatar
  // row plus a separate select underneath it. The prototype draws a `<button>`
  // because a drawing does not have to open; this is the native control lying
  // over the same row, which is what keeps the keyboard and the screen reader.
  it("draws the ported row and lets the whole of it be operated", () => {
    const { container } = render(<ProfileSwitcher config={TWO_PROFILES} onChange={vi.fn()} />);

    const row = container.querySelector(".ws-nav-profile");
    expect(row).not.toBeNull();
    expect(row!.querySelector(".ws-av")).toHaveTextContent("SR");
    expect(row!.querySelector(".ws-nav-profile-select")).toBe(
      screen.getByRole("combobox", { name: /switch active profile/i }),
    );
  });

  // The caller states what the profile is doing, from facts it read off the
  // runtime. The component never derives one.
  it("prints the subtitle the caller passed and nothing else", () => {
    render(
      <ProfileSwitcher
        config={TWO_PROFILES}
        onChange={vi.fn()}
        subtitle="Cleanup · Insert at cursor"
      />,
    );
    expect(screen.getByText("Cleanup · Insert at cursor")).toBeInTheDocument();
  });

  // The profile decides the recognizer settings, and those are fixed the moment
  // recording starts — a switch mid-session left the pipeline reading half of
  // one profile and half of the other. The runtime rejects it; this surface
  // says so before the attempt instead of failing silently (ADR 0025).
  it("locks the switcher while a session is running and explains why", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { container } = render(
      <ProfileSwitcher config={createAppConfig()} onChange={onChange} sessionActive />,
    );

    const combobox = screen.getByRole("combobox", { name: /switch active profile/i });
    expect(combobox).toBeDisabled();
    expect(container.querySelector(".ws-nav-profile")).toHaveAttribute("data-locked");
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

    render(<ProfileSwitcher config={createAppConfig()} onChange={onChange} />);

    const combobox = screen.getByRole("combobox", { name: /switch active profile/i });
    const other = Array.from(combobox.querySelectorAll("option"))
      .map((option) => option.value)
      .find((value) => value !== (combobox as HTMLSelectElement).value);
    await user.selectOptions(combobox, other!);

    expect(invoke).toHaveBeenCalledWith("switch_active_text_profile", { profileId: other });
    expect(onChange).not.toHaveBeenCalled();
  });
});
