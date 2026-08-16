import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { GeneralScreen } from "./General";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isFocused: async () => true,
    onFocusChanged: async () => () => undefined,
  }),
}));

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
    if (command === "start_input_monitor" || command === "renew_input_monitor") {
      return { monitoring: true, device_name: "Yeti Nano Analog Stereo" };
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

  it("lists the microphones this machine has and lets the control say which one is selected", async () => {
    const { container } = render(<GeneralScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("list_native_input_devices"));
    const select = (await screen.findByLabelText("Input device")) as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "System default microphone",
      "System default microphone — default",
      "Yeti Nano Analog Stereo",
    ]);

    /* THE ROW CARRIES NO SENTENCE, and that is a measurement rather than a
       preference. `.ws-sel` is `width: auto` and `.ws-row-ctl` is `flex: none`,
       so this Select is as wide as the longest device name the machine reports
       and takes it off the text column: measured in the host it left EIGHTY
       pixels, about twelve characters a line, and the four sentences this row
       used to build drew two, four and five lines beside an `Input level` row
       that drew one. jsdom reports the string and cannot report the wrap, which
       is why the rule is asserted here as an absence. Leg 11, ADR 0092. */
    const deviceRow = select.closest(".ws-row")!;
    expect(deviceRow.querySelector(".ws-row-hint")).toBeNull();
    expect(container.querySelector(".ws-card-head > p")).toHaveTextContent(
      "A change applies to the next capture, not the one running.",
    );
  });

  it("says a saved microphone is gone instead of quietly showing another one", async () => {
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ audio_device: "Unplugged USB mic" }),
    });
    render(<GeneralScreen runtime={runtime} />);

    /* On the Note under the card, not on the row: the row holds about twelve
       characters beside this Select, and the Note spans it at about seventy. */
    const note = await screen.findByText(/Saved microphone is not available right now/);
    expect(note.closest(".ws-note")).not.toBeNull();
    expect(note.closest(".ws-row")).toBeNull();
    // And the stored value is still what the control shows.
    expect(screen.getByLabelText("Input device")).toHaveValue("Unplugged USB mic");
  });

  /* THE ROW MEASURES, AND IT MEASURES THROUGH THE RUNTIME (ADR 0170). Both
     halves matter and they are one test: a waveform that never moves cannot
     answer "is this microphone set right", and a waveform that answers it by
     opening its own device is a second application on the same microphone. */
  it("has the runtime open the microphone so the row is live before any capture", async () => {
    const { container } = render(<GeneralScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("start_input_monitor"));

    // Driven by the runtime's reading: the at-rest dotted rule is what a
    // waveform with no source draws, and this one has one.
    const wave = container.querySelector(".ws-wave-live")!;
    await waitFor(() => expect(wave.querySelector(".border-dotted")).toBeNull());

    // Nothing has arrived yet, and the verdict says exactly that rather than
    // implying a level was measured.
    expect(screen.getByText("Speak to measure the level.")).toBeInTheDocument();
  });

  it("gives the microphone back when the screen is left", async () => {
    const { rerender } = render(<GeneralScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await waitFor(() => expect(invoked).toHaveBeenCalledWith("start_input_monitor"));

    rerender(<GeneralScreen runtime={createWorkspaceRuntime({ active: false })} />);
    await waitFor(() => expect(invoked).toHaveBeenCalledWith("stop_input_monitor"));
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
