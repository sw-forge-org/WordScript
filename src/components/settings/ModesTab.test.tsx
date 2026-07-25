import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import { isShortcutCommand, shortcutInvokeDouble } from "../../test/shortcutRuntime";
import type { AppConfig } from "../../types/ipc";
import { ModesTab } from "./ModesTab";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

afterEach(() => {
  cleanup();
});

describe("ModesTab", () => {
  const onChange = vi.fn<(p: Partial<AppConfig>) => void>();

  beforeEach(() => {
    onChange.mockReset();
    invokeMock.mockReset();
    invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) =>
      Promise.resolve(isShortcutCommand(command) ? shortcutInvokeDouble(command, args) : undefined),
    );
  });

  it("renders the processing mode radio selectors with one mode selected", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.getByText("Processing mode")).toBeInTheDocument();

    const modeSection = screen.getByLabelText("Processing mode selector");
    const allModes = modeSection.querySelectorAll("input[type='radio']");
    expect(allModes.length).toBe(6);
    const checkedInput = modeSection.querySelector("input[checked]") as HTMLInputElement | null;
    expect(checkedInput).toBeTruthy();
    expect(["auto", "verbatim", "cleanup", "rewrite", "agent", "prompt_enhance"]).toContain(checkedInput!.value);
  });

  it("fires onChange with updated text_profiles when selecting a different processing mode", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    const modeSection = screen.getByLabelText("Processing mode selector");
    const verbatimRadio = modeSection.querySelector("input[value='verbatim']") as HTMLInputElement;
    fireEvent.click(verbatimRadio);

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0][0] as Partial<AppConfig>;
    expect(patch.text_profiles).toBeDefined();
    const profiles = patch.text_profiles!;
    const activeProfile = profiles.find((p) => p.id === "general");
    expect(activeProfile).toBeDefined();
    expect(activeProfile!.work_mode?.processing_mode).toBe("verbatim");
  });

  it("shows enhance sub-mode options only when prompt_enhance is selected", () => {
    const config = createAppConfig();
    config.text_profiles = config.text_profiles.map((p) =>
      p.id === "general"
        ? { ...p, work_mode: { ...p.work_mode!, processing_mode: "prompt_enhance" } }
        : p,
    );
    render(<ModesTab config={config} onChange={onChange} />);

    expect(screen.getByText("Enhance sub-mode")).toBeInTheDocument();
    expect(screen.getByText("Prompt target")).toBeInTheDocument();
    expect(screen.getByLabelText(/prompt target/i)).toBeInTheDocument();
  });

  it("hides enhance sub-mode when cleanup is selected", () => {
    const config = createAppConfig();
    config.text_profiles = config.text_profiles.map((p) =>
      p.id === "general"
        ? { ...p, work_mode: { ...p.work_mode!, processing_mode: "cleanup" } }
        : p,
    );
    render(<ModesTab config={config} onChange={onChange} />);

    expect(screen.queryByText("Enhance sub-mode")).not.toBeInTheDocument();
    expect(screen.queryByText("Prompt target")).not.toBeInTheDocument();
  });

  it("shows cleanup settings card always visible", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.getByText("Cleanup settings")).toBeInTheDocument();
    expect(screen.getByLabelText(/ai cleanup/i)).toBeInTheDocument();
  });

  it("toggles auto-detect checkbox", () => {
    const config = createAppConfig();
    // Set auto_detect_mode to false in the active profile's modes settings
    config.text_profiles = config.text_profiles.map((p) =>
      p.id === "general"
        ? { ...p, modes: { ...p.modes!, auto_detect_mode: false } }
        : p,
    );
    render(<ModesTab config={config} onChange={onChange} />);

    const checkbox = screen.getByLabelText(/collect workspace context/i);
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0][0] as Partial<AppConfig>;
    expect(patch.text_profiles).toBeDefined();
    const profiles = patch.text_profiles!;
    const activeProfile = profiles.find((p) => p.id === "general");
    expect(activeProfile).toBeDefined();
    expect(activeProfile!.modes?.auto_detect_mode).toBe(true);
  });

  it("renders workspace context section", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.getByText("Workspace context")).toBeInTheDocument();
    expect(screen.getByLabelText(/collect workspace context/i)).toBeInTheDocument();
  });

  it("does not render per-app mapping section", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.queryByText("Per-app mapping")).not.toBeInTheDocument();
    expect(screen.queryByText("Add mapping")).not.toBeInTheDocument();
  });

  it("renders hotkey recorders including auto mode", () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    expect(screen.getByText("Hotkeys")).toBeInTheDocument();
    expect(screen.getByText("Mode select")).toBeInTheDocument();
    const hotkeyRecorderLabels = screen.getAllByText(/^(Auto|Verbatim|Cleanup|Rewrite|Agent|Prompt Enhance)$/);
    expect(hotkeyRecorderLabels.length).toBeGreaterThanOrEqual(6);
  });

  it("releases the OS grabs when a mode shortcut recording starts", async () => {
    // D3: this surface previously called neither pause nor resume, so pressing
    // a live mode shortcut while recording fired the mode action instead of
    // being captured.
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    const recorder = await screen.findByRole("button", { name: /record mode select/i });
    fireEvent.click(recorder);

    expect(screen.getByText(/press your shortcut/i)).toBeInTheDocument();
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("pause_native_trigger"));
  });

  it("puts the OS grabs back when the recording is cancelled", async () => {
    render(<ModesTab config={createAppConfig()} onChange={onChange} />);

    const recorder = await screen.findByRole("button", { name: /record mode select/i });
    fireEvent.click(recorder);
    fireEvent.keyDown(window, { code: "Escape", key: "Escape" });

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("resume_native_trigger"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows agent controls when agent mode is selected", () => {
    const config = createAppConfig();
    config.text_profiles = config.text_profiles.map((p) =>
      p.id === "general"
        ? { ...p, work_mode: { ...p.work_mode!, processing_mode: "agent" } }
        : p,
    );
    render(<ModesTab config={config} onChange={onChange} />);

    expect(screen.getByText("Agent name")).toBeInTheDocument();
  });

  it("does not show agent controls when cleanup is selected", () => {
    const config = createAppConfig();
    config.text_profiles = config.text_profiles.map((p) =>
      p.id === "general"
        ? { ...p, work_mode: { ...p.work_mode!, processing_mode: "cleanup" } }
        : p,
    );
    render(<ModesTab config={config} onChange={onChange} />);

    expect(screen.queryByText("Agent name")).not.toBeInTheDocument();
  });
});