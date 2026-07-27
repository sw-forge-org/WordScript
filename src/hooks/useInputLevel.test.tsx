import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type EventHandler = (event: { payload: unknown }) => void;

const handlers: EventHandler[] = [];
const listenMock = vi.fn(async (_channel: string, handler: EventHandler) => {
  handlers.push(handler);
  return () => {
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: (channel: string, handler: EventHandler) => listenMock(channel, handler),
}));

import { toDbfs, useInputLevel, VOICE_THRESHOLD } from "./useInputLevel";

function emitLevel(level: number, rms = level / 2) {
  act(() => {
    handlers.forEach((handler) =>
      handler({ payload: { event: "audio_level", level, rms } }),
    );
  });
}

describe("useInputLevel", () => {
  beforeEach(() => {
    handlers.length = 0;
    listenMock.mockClear();
  });

  it("reports nothing measured before the first event", () => {
    const { result } = renderHook(() => useInputLevel());
    expect(result.current.active).toBe(false);
    expect(result.current.peak).toBe(0);
  });

  it("tracks the instantaneous peak", async () => {
    const { result } = renderHook(() => useInputLevel());
    await waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.4);
    expect(result.current.peak).toBeCloseTo(0.4);
    expect(result.current.active).toBe(true);
  });

  it("holds the peak so a short syllable stays readable", async () => {
    const { result } = renderHook(() => useInputLevel());
    await waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.8);
    emitLevel(0.05);

    // The bar follows the signal down, the hold marker does not.
    expect(result.current.peak).toBeCloseTo(0.05);
    expect(result.current.hold).toBeGreaterThan(0.5);
  });

  it("clamps out-of-range values from the runtime", async () => {
    const { result } = renderHook(() => useInputLevel());
    await waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(4.2);
    expect(result.current.peak).toBe(1);

    emitLevel(-1);
    expect(result.current.peak).toBe(0);
  });

  it("does not subscribe while disabled", () => {
    renderHook(() => useInputLevel(false));
    expect(listenMock).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = renderHook(() => useInputLevel());
    await waitFor(() => expect(handlers.length).toBe(1));
    unmount();
    await waitFor(() => expect(handlers.length).toBe(0));
  });
});

describe("toDbfs", () => {
  it("matches known reference points", () => {
    expect(toDbfs(1)).toBeCloseTo(0, 3);
    expect(toDbfs(0.5)).toBeCloseTo(-6.02, 2);
    expect(toDbfs(0.1)).toBeCloseTo(-20, 2);
  });

  it("floors silence instead of returning -Infinity", () => {
    expect(toDbfs(0)).toBe(-120);
    expect(toDbfs(-1)).toBe(-120);
  });

  it("puts the speech threshold well below full scale", () => {
    // The UI states the measurement against this bar, so it has to be a real
    // number the user can compare against.
    expect(toDbfs(VOICE_THRESHOLD)).toBeLessThan(-30);
    expect(toDbfs(VOICE_THRESHOLD)).toBeGreaterThan(-40);
  });
});
