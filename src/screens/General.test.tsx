import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { GeneralScreen } from "./General";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * WHAT A WIRED SCREEN'S TEST IS FOR. Not fidelity — this screen has left the
 * gallery (ADR 0057) — but which facts come from the runtime, which controls
 * write, and that the one thing that cannot be read is not invented.
 */

const DEVICES = [
  { name: "System default microphone", is_default: true },
  { name: "Yeti Nano Analog Stereo", is_default: false },
];

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "list_native_input_devices") return DEVICES;
    if (command === "native_capture_status") {
      return { is_recording: false, device_name: null, active_capture_id: null };
    }
    if (command === "overlay_monitor_options") {
      return [
        { id: "DP-1", label: "DP-1 (2560×1440) — primary", is_primary: true },
        { id: "HDMI-A-1", label: "HDMI-A-1 (1920×1080)", is_primary: false },
      ];
    }
    return undefined;
  });
});

afterEach(cleanup);

describe("General", () => {
  it("does not enumerate hardware for a section nobody opened", () => {
    render(<GeneralScreen runtime={createWorkspaceRuntime({ active: false })} />);
    expect(invoked).not.toHaveBeenCalled();
  });

  it("lists the microphones this machine has and says which one the next capture takes", async () => {
    render(<GeneralScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("list_native_input_devices"));
    const select = (await screen.findByLabelText("Input device")) as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "System default microphone",
      "System default microphone — default",
      "Yeti Nano Analog Stereo",
    ]);
    expect(screen.getByText("Next capture will use System default microphone.")).toBeInTheDocument();
  });

  it("says a saved microphone is gone instead of quietly showing another one", async () => {
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ audio_device: "Unplugged USB mic" }),
    });
    render(<GeneralScreen runtime={runtime} />);

    expect(
      await screen.findByText(/Saved microphone is not available right now/),
    ).toBeInTheDocument();
    // And the stored value is still what the control shows.
    expect(screen.getByLabelText("Input device")).toHaveValue("Unplugged USB mic");
  });

  it("draws the waveform at rest — it would open a second microphone of its own", async () => {
    const { container } = render(<GeneralScreen runtime={createWorkspaceRuntime({ active: true })} />);
    const wave = container.querySelector(".ws-wave-live")!;
    /* ADR 0058, and the runtime's `audio_level` carries one scalar rather than
       the sample history a waveform needs. The measurement below it is live. */
    expect(wave.querySelector(".border-dotted")).not.toBeNull();
    expect(screen.getByText("Speak to measure the level.")).toBeInTheDocument();
  });

  it("writes every sound control to the field the runtime reads", async () => {
    const patch = vi.fn();
    render(<GeneralScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    await userEvent.click(screen.getByLabelText("Play sound cues"));
    expect(patch).toHaveBeenCalledWith({ play_sounds: false });

    await userEvent.selectOptions(screen.getByLabelText("Sound pack"), "glass");
    expect(patch).toHaveBeenCalledWith({ sound_pack: "glass" });
  });

  it("plays a cue through the runtime, so what you hear is what you will hear", async () => {
    render(<GeneralScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(screen.getByRole("button", { name: "Handoff" }));
    expect(invoked).toHaveBeenCalledWith("preview_sound_cue", {
      cue: "handoff",
      pack: "timber",
      volume: expect.any(Number),
    });
  });

  it("offers the displays this machine has, and pins the overlay to one", async () => {
    const patch = vi.fn();
    render(<GeneralScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    const display = (await screen.findByLabelText("Display")) as HTMLSelectElement;
    expect([...display.options].map((option) => option.textContent)).toEqual([
      "DP-1 (2560×1440) — primary",
      "HDMI-A-1 (1920×1080)",
    ]);
    expect(
      screen.getByText("Kept on DP-1 (2560×1440) — primary at bottom center until you drag it somewhere else."),
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Anchor"), "top_right");
    expect(patch).toHaveBeenCalledWith({ overlay_anchor: "top_right" });
  });

  it("shows no Display or Anchor control it cannot act on", async () => {
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ overlay_position_mode: "manual" }),
    });
    render(<GeneralScreen runtime={runtime} />);

    /* The shipped tab showed both whether or not they did anything; in
       "remember last drag" they were inert and still looked settable. */
    expect(screen.getByLabelText("Placement")).toHaveValue("manual");
    expect(screen.queryByLabelText("Anchor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Display")).not.toBeInTheDocument();
  });

  it("sends the profile-owned settings to the profile rather than duplicating them", () => {
    render(<GeneralScreen runtime={createWorkspaceRuntime()} />);
    expect(screen.getByText(/belong to the profile, not to this machine/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/auto-stop/i)).not.toBeInTheDocument();
  });
});
