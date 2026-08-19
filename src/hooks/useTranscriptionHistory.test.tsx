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
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { useTranscriptionHistory } from "./useTranscriptionHistory";

const invoked = vi.mocked(invoke);

function emit(payload: Record<string, unknown>) {
  act(() => {
    handlers.forEach((handler) => handler({ payload }));
  });
}

/** How many times the index itself was read, which is the only call this file
 *  is about — the two status reads fire once on mount and are not the cost. */
function indexReads() {
  return invoked.mock.calls.filter(([command]) => command === "transcription_history_summaries").length;
}

/**
 * ADR 0240. The index is read when it changes, and the fact worth protecting is
 * the NEGATIVE one: no clock. This hook polled every five seconds over the whole
 * index — 1.27 MB on the reporting machine, twelve times a minute, for a file
 * that changes only when somebody dictates — and a timer is the kind of thing
 * that comes back in a later edit because it looks harmless.
 */
describe("useTranscriptionHistory", () => {
  beforeEach(() => {
    handlers.length = 0;
    listenMock.mockClear();
    invoked.mockReset();
    invoked.mockResolvedValue([]);
    /* `shouldAdvanceTime` keeps `waitFor` usable: it drives its own timers
       off the mocked clock instead of hanging on a clock nobody advances. */
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the index once on mount and then not again on any clock", async () => {
    renderHook(() => useTranscriptionHistory(true));
    await waitFor(() => expect(indexReads()).toBe(1));

    /* Five minutes. The old build would have read the index sixty times. */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(indexReads()).toBe(1);
  });

  it("reads it again when the runtime says a record landed", async () => {
    renderHook(() => useTranscriptionHistory(true));
    await waitFor(() => expect(indexReads()).toBe(1));

    emit({ event: "transcription", text: "Hallo" });
    await waitFor(() => expect(indexReads()).toBe(2));

    emit({ event: "error", message: "nope" });
    await waitFor(() => expect(indexReads()).toBe(3));
  });

  it("ignores the events that write no record", async () => {
    renderHook(() => useTranscriptionHistory(true));
    await waitFor(() => expect(indexReads()).toBe(1));

    /* `audio_level` arrives many times a second while a capture runs. Reading
       the index on it would be worse than the timer this replaced. */
    emit({ event: "audio_level", level: 0.4 });
    emit({ event: "recording_started" });
    emit({ event: "processing" });
    emit({ event: "preview_ready" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(indexReads()).toBe(1);
  });

  it("does not listen at all while the workspace is inactive", async () => {
    renderHook(() => useTranscriptionHistory(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(indexReads()).toBe(0);
    expect(listenMock).not.toHaveBeenCalled();
  });
});
