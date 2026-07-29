import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import {
  createShortcutCapabilities,
  createTriggerStatus,
  isShortcutCommand,
  shortcutInvokeDouble,
} from "../../test/shortcutRuntime";
import type {
  NativeTriggerStatus,
  ShortcutBindingInfo,
  ShortcutCapabilities,
} from "../../types/ipc";
import { InputTab } from "./InputTab";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

function captureBinding(overrides: Partial<ShortcutBindingInfo> = {}): ShortcutBindingInfo {
  return {
    label: "capture",
    role: "capture",
    configured: "Ctrl+F9",
    display: "Ctrl + F9",
    registered: true,
    error: null,
    presses: 0,
    releases: 0,
    last_press_ms: null,
    last_release_ms: null,
    ...overrides,
  };
}

function mockRuntime(triggerStatus?: NativeTriggerStatus, capabilities?: ShortcutCapabilities) {
  invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
    if (command === "shortcut_capabilities" && capabilities) {
      return Promise.resolve(capabilities);
    }

    if (command === "list_native_input_devices") {
      return Promise.resolve([
        { name: "USB Podcast Mic", is_default: false },
        { name: "Built-in Microphone", is_default: true },
      ]);
    }

    if (command === "native_capture_status") {
      return Promise.resolve({
        is_recording: false,
        device_name: null,
        active_capture_id: null,
      });
    }

    if (isShortcutCommand(command)) {
      return Promise.resolve(shortcutInvokeDouble(command, args, { triggerStatus }));
    }

    return Promise.resolve(undefined);
  });
}

describe("InputTab", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    mockRuntime();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows native mic selection in the input tab", async () => {
    render(<InputTab config={createAppConfig()} onChange={vi.fn()} />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("list_native_input_devices"));

    expect(screen.getAllByText("Trigger").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Microphone").length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: /input device/i })).toBeInTheDocument();
    expect(screen.getAllByText(/next capture will use built-in microphone/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/mode hotkeys \(picker, cycle, per-mode\) live in modes\./i)).toBeInTheDocument();
    expect(screen.queryByText(/play sound feedback/i)).not.toBeInTheDocument();
    expect(screen.queryByText("First dictation preflight")).not.toBeInTheDocument();
    expect(screen.queryByText("Overlay placement")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /overlay placement mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /overlay display/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /overlay anchor/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^recovery$/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Linux Wayland")).not.toBeInTheDocument();
  });

  it("renders the human shortcut instead of the raw token", async () => {
    // D9/T9: the summary tile and the pill used to print `ctrl_l+f9`.
    render(<InputTab config={createAppConfig({ hotkey: "ctrl_l+f9" })} onChange={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText("Ctrl").length).toBeGreaterThan(0));
    expect(screen.queryByText("ctrl_l+f9")).not.toBeInTheDocument();
  });

  it("keeps manual entry local until it is committed", async () => {
    // D4/T5: every keystroke used to be persisted, which walked through
    // intermediate values like `c` — themselves valid single-key shortcuts that
    // were registered as bare global grabs and then swallowed the typing.
    const onChange = vi.fn();
    render(<InputTab config={createAppConfig({ hotkey: "Ctrl+F9" })} onChange={onChange} />);

    const toggles = await screen.findAllByRole("button", { name: /enter manually/i });
    fireEvent.click(toggles[0]);

    const field = await screen.findByRole("textbox", {
      name: /start \/ stop hotkey manual entry/i,
    });

    for (const value of ["c", "ct", "ctr", "ctrl", "ctrl+", "ctrl+f", "ctrl+f1", "ctrl+f10"]) {
      fireEvent.change(field, { target: { value } });
    }

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ hotkey: "Ctrl+F10" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reverts the manual draft on Escape without saving", async () => {
    const onChange = vi.fn();
    render(<InputTab config={createAppConfig({ hotkey: "Ctrl+F9" })} onChange={onChange} />);

    const toggles = await screen.findAllByRole("button", { name: /enter manually/i });
    fireEvent.click(toggles[0]);

    const field = await screen.findByRole("textbox", {
      name: /start \/ stop hotkey manual entry/i,
    });
    fireEvent.change(field, { target: { value: "ctrl+f11" } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect((field as HTMLInputElement).value).toBe("Ctrl+F9");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names an unregistered shortcut persistently instead of only in a toast", async () => {
    // T8: registration failure used to survive only as a transient toast, so
    // configured and registered could disagree invisibly.
    mockRuntime(
      createTriggerStatus({
        bindings: [
          {
            label: "capture",
            role: "capture",
            configured: "Ctrl+F9",
            display: "Ctrl + F9",
            registered: false,
            error: "'Ctrl + F9' could not be registered with the operating system.",
            presses: 0,
            releases: 0,
            last_press_ms: null,
            last_release_ms: null,
          },
        ],
      }),
    );

    render(<InputTab config={createAppConfig({ hotkey: "Ctrl+F9" })} onChange={vi.fn()} />);

    expect(
      await screen.findByText(/could not be registered with the operating system/i),
    ).toBeInTheDocument();
  });

  it("offers double tap and explains what it buys for a modifier-only trigger", async () => {
    render(
      <InputTab
        config={createAppConfig({ hotkey: "Ctrl+Alt", activation_mode: "double_tap" })}
        onChange={vi.fn()}
      />,
    );

    const select = await screen.findByRole("combobox", { name: /activation mode/i });
    expect(
      Array.from(select.querySelectorAll("option")).map((option) => option.value),
    ).toEqual(["tap", "double_tap", "hold"]);

    expect(await screen.findByText(/a single tap does nothing/i)).toBeInTheDocument();
    expect(screen.getByText(/ctrl\+alt\+t is not intercepted/i)).toBeInTheDocument();
  });

  it("warns that a modifier-only trigger in tap mode takes the combination away", async () => {
    render(
      <InputTab
        config={createAppConfig({ hotkey: "Ctrl+Alt", activation_mode: "tap" })}
        onChange={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/takes that combination away from other applications/i),
    ).toBeInTheDocument();
  });

  it("states that hold to talk has no observed key release in this session", async () => {
    // T10/D11: hold used to be offered as an equal choice while silently doing
    // nothing when the platform never delivers a release.
    mockRuntime(
      createTriggerStatus({
        activation_mode: "hold",
        bindings: [captureBinding({ presses: 3, releases: 0, last_press_ms: 1 })],
      }),
    );

    render(
      <InputTab
        config={createAppConfig({ hotkey: "Ctrl+F9", activation_mode: "hold" })}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText(/no key release/i)).toBeInTheDocument();
  });

  it("states that a press below the hold threshold is discarded", async () => {
    // ADR 0013: the old wording promised that a too-short hold was *extended*
    // to the minimum, which is what made a stray tap produce a transcript and
    // hold to talk feel like tap to toggle. The mode now discards it, and the
    // hint has to say so — otherwise the mode looks broken instead of strict.
    mockRuntime(
      createTriggerStatus({
        activation_mode: "hold",
        bindings: [captureBinding({ presses: 3, releases: 3, last_press_ms: 1 })],
      }),
    );

    render(
      <InputTab
        config={createAppConfig({ hotkey: "Ctrl+F9", activation_mode: "hold" })}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText(/shorter than 300 ms is discarded/i)).toBeInTheDocument();
    expect(screen.getByText(/use one of the toggle modes/i)).toBeInTheDocument();
  });

  it("gates the activation selector on the runtime capability matrix", async () => {
    // T10/T12/S7: an option the session cannot honor is unselectable with the
    // runtime's reason, instead of looking available and doing nothing. The
    // persisted value is still shown — it is the user's, and nothing rewrites it.
    mockRuntime(
      createTriggerStatus({
        activation_mode: "tap",
        bindings: [captureBinding({ presses: 4, releases: 0, last_press_ms: 1 })],
      }),
    );

    render(
      <InputTab
        config={createAppConfig({ hotkey: "Ctrl+F9", activation_mode: "tap" })}
        onChange={vi.fn()}
      />,
    );

    const select = await screen.findByRole("combobox", { name: /activation mode/i });
    await waitFor(() =>
      expect(
        (select.querySelector('option[value="hold"]') as HTMLOptionElement).disabled,
      ).toBe(true),
    );
    expect((select.querySelector('option[value="tap"]') as HTMLOptionElement).disabled).toBe(
      false,
    );
    expect(
      (select.querySelector('option[value="double_tap"]') as HTMLOptionElement).disabled,
    ).toBe(false);
    expect(screen.getByText(/hold to talk — unavailable here/i)).toBeInTheDocument();
  });

  it("keeps an unavailable mode selectable-as-current instead of silently swapping it", async () => {
    // The user's persisted choice is never rewritten by the UI. Hold stays the
    // selected value, is not disabled out from under the select, and the reason
    // is stated in the hint.
    mockRuntime(
      createTriggerStatus({
        activation_mode: "hold",
        bindings: [captureBinding({ presses: 2, releases: 0, last_press_ms: 1 })],
      }),
    );

    const onChange = vi.fn();
    render(
      <InputTab
        config={createAppConfig({ hotkey: "Ctrl+F9", activation_mode: "hold" })}
        onChange={onChange}
      />,
    );

    const select = (await screen.findByRole("combobox", {
      name: /activation mode/i,
    })) as HTMLSelectElement;
    await waitFor(() =>
      expect(screen.getByText(/hold to talk — unavailable here/i)).toBeInTheDocument(),
    );
    expect(select.value).toBe("hold");
    expect((select.querySelector('option[value="hold"]') as HTMLOptionElement).disabled).toBe(
      false,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names the key classes this session cannot record", async () => {
    // The key-class half of the matrix (T12) has to be visible, not internal:
    // Super on KDE is registerable but not recordable, and manual entry is the
    // alternative the user needs to be told about at that point (T8).
    mockRuntime(
      undefined,
      createShortcutCapabilities({
        key_classes: [
          {
            id: "super_meta",
            label: "Super / Meta",
            state: "conditional",
            reason:
              "The desktop consumes Super before the focused window sees it, so the recorder cannot capture it. Assign a Super combination through manual entry.",
          },
        ],
      }),
    );

    render(<InputTab config={createAppConfig()} onChange={vi.fn()} />);

    expect(
      await screen.findByText(/Super \/ Meta: The desktop consumes Super/i),
    ).toBeInTheDocument();
  });
});
