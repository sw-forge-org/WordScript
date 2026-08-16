import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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

import { toDbfs, toDisplayLevel, useInputLevel, VOICE_THRESHOLD } from "./useInputLevel";

function emit(payload: Record<string, unknown>) {
  act(() => {
    handlers.forEach((handler) => handler({ payload }));
  });
}

function emitLevel(level: number, rms = level / 2) {
  emit({ event: "audio_level", level, rms });
}

/** The reading a person READS is published on an interval rather than per
 *  event, so a test that asserts on it has to let one interval pass. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("useInputLevel", () => {
  beforeEach(() => {
    handlers.length = 0;
    listenMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports nothing measured before the first event", () => {
    const { result } = renderHook(() => useInputLevel());
    expect(result.current.active).toBe(false);
    expect(result.current.meterRef.current.peak).toBe(0);
    expect(result.current.state).toBe("measuring");
  });

  /* THE MOVING NUMBERS ARE ON THE REFS, AND THEY ARE THERE IMMEDIATELY. That
     is the contract the bar and the waveform depend on: they read once per
     animation frame, so a value that waited for a React commit would arrive as
     a step rather than as a movement. */
  it("puts every reading on the refs without waiting for a render", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.4);
    expect(result.current.meterRef.current.peak).toBeCloseTo(0.4);
    expect(result.current.levelRef.current).toBeGreaterThan(0);
  });

  it("marks the measurement as live once a reading has arrived", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.4);
    await settle();
    expect(result.current.active).toBe(true);
  });

  it("holds the peak so a short syllable stays readable", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.8);
    emitLevel(0.05);

    // The bar follows the signal down, the hold marker does not.
    expect(result.current.meterRef.current.peak).toBeCloseTo(0.05);
    expect(result.current.meterRef.current.hold).toBeGreaterThan(0.5);
  });

  it("clamps out-of-range values from the runtime", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(4.2);
    expect(result.current.meterRef.current.peak).toBe(1);

    emitLevel(-1);
    expect(result.current.meterRef.current.peak).toBe(0);
  });

  it("reads the monitor's channel as the same measurement", async () => {
    // A microphone measured with nothing recording is still that microphone.
    // The screen asks one question and must not have to know which of the two
    // runtime paths happens to be emitting.
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emit({ event: "input_monitor_level", level: 0.5, rms: 0.25 });
    await settle();
    expect(result.current.meterRef.current.peak).toBeCloseTo(0.5);
    expect(result.current.active).toBe(true);
  });

  it("stops reporting a level when the monitor gives the microphone back", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emit({ event: "input_monitor_level", level: 0.6 });
    await settle();
    expect(result.current.active).toBe(true);

    // Holding the last reading here would state a level nothing is measuring.
    emit({ event: "input_monitor_stopped", reason: "lease_expired" });
    await settle();
    expect(result.current.active).toBe(false);
    expect(result.current.meterRef.current.peak).toBe(0);
    expect(result.current.levelRef.current).toBe(0);
  });

  it("does not subscribe while disabled", () => {
    renderHook(() => useInputLevel(false));
    expect(listenMock).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));
    unmount();
    await vi.waitFor(() => expect(handlers.length).toBe(0));
  });
});

/**
 * THE VERDICT IS THE PART A PERSON READS, and the defect it exists to prevent
 * is a real one: decided per reading, it flipped between "Good" and "Too quiet"
 * several times a sentence, and because the two sentences are different lengths
 * the card resized with every flip.
 */
describe("useInputLevel — the verdict over time", () => {
  beforeEach(() => {
    handlers.length = 0;
    listenMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays good through the gaps between words", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.3);
    await settle();
    expect(result.current.state).toBe("ok");

    // A syllable ends and the room is quiet for a moment. The microphone did
    // not become badly set in that moment.
    for (let i = 0; i < 10; i += 1) {
      emitLevel(0.004);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(42);
      });
    }
    await settle();
    expect(result.current.state).toBe("ok");
  });

  it("says too quiet once nothing has crossed the threshold for seconds", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.3);
    await settle();
    expect(result.current.state).toBe("ok");

    for (let i = 0; i < 80; i += 1) {
      emitLevel(0.004);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(42);
      });
    }
    await settle();
    expect(result.current.state).toBe("quiet");
  });

  it("quotes the window's peak, not the last frame's", async () => {
    // Otherwise the sentence carries a number that changes twenty-four times a
    // second under a verdict that does not.
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.5);
    emitLevel(0.01);
    await settle();
    expect(result.current.windowPeak).toBeCloseTo(0.5);
  });

  it("keeps a clipping warning up past the syllable that caused it", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    emitLevel(0.95);
    await settle();
    expect(result.current.state).toBe("hot");

    // Clipping is the failure you cannot repair afterwards; a warning gone with
    // the syllable would never be read.
    emitLevel(0.3);
    await settle();
    expect(result.current.state).toBe("hot");
  });

  it("separates a silent device from a quiet one", async () => {
    const { result } = renderHook(() => useInputLevel());
    await vi.waitFor(() => expect(handlers.length).toBe(1));

    for (let i = 0; i < 80; i += 1) {
      emitLevel(0, 0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(42);
      });
    }
    await settle();
    // Nothing at all is a different fact from "audible but under the bar", and
    // the two have different fixes.
    expect(result.current.state).toBe("silent");
  });
});

describe("toDisplayLevel", () => {
  it("leaves silence at the floor", () => {
    expect(toDisplayLevel({ peak: 0, rms: 0 })).toBe(0);
  });

  it("lifts ordinary speech into the height of the row", () => {
    // Drawn unmodified, a 0.2 peak is a 20% bar — a flat smear along the
    // bottom of a 40 px row rather than the shape of a voice.
    expect(toDisplayLevel({ peak: 0.2, rms: 0.08 })).toBeGreaterThan(0.5);
  });

  it("never draws past the top of the row", () => {
    expect(toDisplayLevel({ peak: 1, rms: 1 })).toBe(1);
  });

  it("does not gate a quiet room to zero", () => {
    // The row exists partly to show whether the room floor is audible under
    // the speech, which a gate would hide.
    expect(toDisplayLevel({ peak: 0.01, rms: 0.005 })).toBeGreaterThan(0);
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
