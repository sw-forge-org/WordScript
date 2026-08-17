import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { HotkeysScreen } from "./Hotkeys";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * WHAT A WIRED SCREEN'S TEST IS FOR. Not fidelity — this screen has left the
 * gallery (ADR 0057) — but which facts come from the runtime, which controls
 * write, and that the two things that cannot be read are not invented.
 */

const BINDINGS = [
  {
    label: "capture",
    role: "capture",
    configured: "Ctrl+Super",
    display: "Ctrl + Super",
    registered: true,
    error: null,
    presses: 0,
    releases: 0,
    last_press_ms: null,
    last_release_ms: null,
  },
  {
    label: "pause",
    role: "capture",
    configured: "Ctrl+Space",
    display: "Ctrl + Space",
    registered: true,
    error: null,
    presses: 0,
    releases: 0,
    last_press_ms: null,
    last_release_ms: null,
  },
  {
    label: "abort",
    role: "capture",
    configured: "Ctrl+Alt",
    display: "Ctrl + Alt",
    registered: false,
    error: "Ctrl + Alt is already held by another application.",
    presses: 0,
    releases: 0,
    last_press_ms: null,
    last_release_ms: null,
  },
  {
    label: "cleanup",
    role: "mode",
    configured: "Alt+Digit3",
    display: "Alt + 3",
    registered: false,
    error: "Alt + 3 could not be registered in this session.",
    presses: 0,
    releases: 0,
    last_press_ms: null,
    last_release_ms: null,
  },
];

const TRIGGER_STATUS = {
  configured: true,
  enabled: true,
  paused: false,
  suspended: false,
  hotkey: "Ctrl+Super",
  pause_hotkey: "Ctrl+Space",
  abort_hotkey: "Ctrl+Alt",
  registered_hotkey: "Ctrl + Super",
  registered_pause_hotkey: "Ctrl + Space",
  registered_abort_hotkey: null,
  activation_mode: "tap",
  last_error: null,
  owner: "native",
  bindings: BINDINGS,
  hold_arm_ms: 300,
  debounce_ms: 250,
  hold_watchdog_seconds: 120,
  double_tap_window_ms: 380,
  registered_mode_hotkeys: [],
};

const PLATFORM = {
  kind: "linux_x_wayland",
  summary: "KDE Plasma 6 · wayland session, app on XWayland (X11 grabs)",
  global_shortcuts_available: true,
  keys_the_desktop_swallows: ["Super"],
  notes: ["KWin consumes Meta / Super before the focused window sees it."],
};

const CAPABILITIES = {
  session: "linux_x_wayland",
  summary: PLATFORM.summary,
  global_shortcuts_available: true,
  release_evidence: "release_missing",
  activation_modes: [
    { id: "tap", label: "Tap to toggle", state: "available", reason: null },
    { id: "double_tap", label: "Double tap to toggle", state: "available", reason: null },
    {
      id: "hold",
      label: "Hold to talk",
      state: "unavailable",
      reason: "No key release has been observed in this session, so a hold could never end.",
    },
  ],
  key_classes: [],
};

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "native_trigger_status") return TRIGGER_STATUS;
    if (command === "shortcut_platform") return PLATFORM;
    if (command === "shortcut_capabilities") return CAPABILITIES;
    if (command === "validate_shortcut") {
      return {
        ok: true,
        disabled: false,
        canonical: "Ctrl+Super",
        display: "Ctrl + Super",
        modifier_only: true,
        delivery: "grab",
        reason: null,
        warning: null,
      };
    }
    return undefined;
  });
});

afterEach(cleanup);

describe("Hotkeys", () => {
  it("does not ask the trigger lane anything for a section nobody opened", () => {
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: false })} />);
    expect(invoked).not.toHaveBeenCalled();
  });

  it("states per row what the operating system did with the shortcut", async () => {
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("native_trigger_status"));
    /* Two accepted, one refused — and the refusal carries the runtime's own
       sentence rather than the drawing's three-word guess at a cause. */
    expect(await screen.findAllByText("Registered")).toHaveLength(2);
    expect(screen.getByText("Not registered")).toBeInTheDocument();
    expect(
      screen.getByText("Ctrl + Alt is already held by another application."),
    ).toBeInTheDocument();
  });

  it("says a slot was not checked rather than claiming it is unregistered", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "shortcut_platform") return PLATFORM;
      /* A runtime that does not answer `native_trigger_status` is not a runtime
         that refused every shortcut. */
      return undefined;
    });
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findAllByText("Not checked")).toHaveLength(3);
    expect(screen.queryByText("Not registered")).not.toBeInTheDocument();
  });

  it("shows a mode shortcut's refusal in its hint, because the row has no badge", async () => {
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      await screen.findByText("Alt + 3 could not be registered in this session."),
    ).toBeInTheDocument();
    /* §11.20 — a badge is for a status that is not expected, and an unset mode
       key is the expected case. The drawing gives these rows no badge column. */
    expect(screen.getAllByText("Registered")).toHaveLength(2);
  });

  it("gives Translate the seventh slot, settable and unbound", async () => {
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(screen.getByText("Translate")).toBeInTheDocument();
    /* ADR 0041 gave it the slot and it ships with no binding, because Alt+1
       through Alt+6 are taken. Unbound is not the same as inert: every mode row
       is settable, and this one is empty until somebody sets it. */
    const rows = await screen.findAllByRole("button", { name: /not set/i });
    expect(rows.filter((row) => (row as HTMLButtonElement).disabled)).toHaveLength(0);
    expect(
      screen.queryByText(
        "The runtime carries no key for this mode yet, so there is nothing to bind.",
      ),
    ).not.toBeInTheDocument();
  });

  it("takes the activation hint from the runtime's own answer about the trigger", async () => {
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* `modifier_only` is the runtime's, and so is the shortcut it names. The
       drawing drew this sentence for `Ctrl+Super`; the screen produces it for
       whatever the trigger actually is. */
    expect(
      await screen.findByText(
        "Ctrl+Super is modifier-only, so every press acts — and other apps lose it. Double tap avoids that.",
      ),
    ).toBeInTheDocument();
  });

  it("offers an activation mode this session cannot honor as inert, with the reason", async () => {
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const hold = await screen.findByRole("button", { name: "Hold" });
    expect(hold).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tap" })).not.toBeDisabled();
  });

  it("keeps a stored mode operable even when the matrix calls it unavailable", async () => {
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ activation_mode: "hold" }),
    });
    render(<HotkeysScreen runtime={runtime} />);

    /* A mode the session cannot honor is named, never silently swapped — and
       locking the control would leave the user unable to change away from it. */
    const hold = await screen.findByRole("button", { name: "Hold" });
    expect(hold).not.toBeDisabled();
    expect(
      screen.getByText(/No key release has been observed in this session/),
    ).toBeInTheDocument();
  });

  it("writes the activation mode and the picker timeout to the fields the runtime reads", async () => {
    const patch = vi.fn();
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Double tap" }));
    expect(patch).toHaveBeenCalledWith({ activation_mode: "double_tap" });
  });

  it("shows the shortcut the runtime resolved, never the raw token", async () => {
    render(<HotkeysScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* T9. `Ctrl+Super` is what is stored; `Ctrl + Super` is what the runtime
       renders it as; the caps are that, split. */
    const dictate = await screen.findByRole("button", { name: /Ctrl.*Super.*Change/s });
    expect(dictate).toBeInTheDocument();
  });
});
