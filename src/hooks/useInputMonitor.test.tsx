import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const invokeMock = vi.fn();
let focusHandler: ((event: { payload: boolean }) => void) | null = null;
let windowFocused = true;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, args?: unknown) => invokeMock(command, args),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isFocused: async () => windowFocused,
    onFocusChanged: async (handler: (event: { payload: boolean }) => void) => {
      focusHandler = handler;
      return () => {
        focusHandler = null;
      };
    },
  }),
}));

import { useInputMonitor } from "./useInputMonitor";

/**
 * WHAT THIS HOOK IS ACCOUNTABLE FOR: a microphone that is open exactly while
 * somebody is looking at the meter, and closed on every path out. Everything
 * below is one of those paths.
 */

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ monitoring: true, device_name: "Yeti Nano" });
  focusHandler = null;
  windowFocused = true;
});

const commands = () => invokeMock.mock.calls.map(([command]) => command);

describe("useInputMonitor", () => {
  it("asks for nothing while the screen is not on top", () => {
    renderHook(() => useInputMonitor(false));
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("opens the microphone and names the device the runtime actually opened", async () => {
    const { result } = renderHook(() => useInputMonitor(true));

    await waitFor(() => expect(result.current.monitoring).toBe(true));
    expect(commands()).toContain("start_input_monitor");
    expect(result.current.deviceName).toBe("Yeti Nano");
    expect(result.current.error).toBeNull();
  });

  it("does not open a microphone behind a window nobody is looking at", async () => {
    windowFocused = false;
    const { result } = renderHook(() => useInputMonitor(true));

    await waitFor(() => expect(focusHandler).not.toBeNull());
    expect(commands()).not.toContain("start_input_monitor");
    expect(result.current.monitoring).toBe(false);
  });

  it("gives the microphone back when the screen goes away", async () => {
    const { unmount } = renderHook(() => useInputMonitor(true));
    await waitFor(() => expect(commands()).toContain("start_input_monitor"));

    unmount();
    await waitFor(() => expect(commands()).toContain("stop_input_monitor"));
  });

  it("gives the microphone back when the window loses focus, and takes it again on return", async () => {
    const { result } = renderHook(() => useInputMonitor(true));
    await waitFor(() => expect(result.current.monitoring).toBe(true));

    invokeMock.mockClear();
    focusHandler?.({ payload: false });
    await waitFor(() => expect(commands()).toContain("stop_input_monitor"));
    expect(commands()).not.toContain("start_input_monitor");

    invokeMock.mockClear();
    focusHandler?.({ payload: true });
    await waitFor(() => expect(commands()).toContain("start_input_monitor"));
  });

  it("never hands back a microphone it did not ask for", async () => {
    // The screen mounted while hidden and was never shown: the runtime should
    // not hear from it at all.
    const { unmount } = renderHook(() => useInputMonitor(false));
    unmount();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("states why the meter is not moving when the device will not open", async () => {
    invokeMock.mockRejectedValue("A capture is running; it owns the microphone.");
    const { result } = renderHook(() => useInputMonitor(true));

    await waitFor(() => expect(result.current.error).toContain("A capture is running"));
    expect(result.current.monitoring).toBe(false);
  });

  it("renews the lease so a monitor nobody stopped is stopped by the runtime", async () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useInputMonitor(true));
      // Let the focus answer land, so the interval below is the renewal's and
      // not the one that has not been set up yet.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(commands()).toContain("start_input_monitor");
      invokeMock.mockClear();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });
      expect(commands()).toContain("renew_input_monitor");
    } finally {
      vi.useRealTimers();
    }
  });
});
