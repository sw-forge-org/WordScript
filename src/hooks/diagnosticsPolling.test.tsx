import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptionHistoryEntry } from "../types/history";
import { useRuntimeLogs } from "./useRuntimeLogs";
import { useTranscriptionHistory } from "./useTranscriptionHistory";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function createHistoryEntry(overrides: Partial<TranscriptionHistoryEntry> = {}): TranscriptionHistoryEntry {
  return {
    id: "history-1",
    created_at_ms: 1716500000000,
    status: "completed",
    source: "native_pipeline",
    retry_of: null,
    audio_path: null,
    provider: "groq",
    model: "whisper-large-v3-turbo",
    language: "en",
    active_profile: "Developer",
    work_mode: {
      rewrite_style: "clean",
      insert_behavior: "auto_paste",
      recovery_behavior: "standard",
    },
    effective_mode: null,
    title: null,
    transcript_path: null,
    fallback_acknowledged: false,
    provider_profile: null,
    local_prompt_strength: null,
    local_prompt_carry: null,
    local_beam_size: null,
    local_best_of: null,
    raw_transcript: "raw transcript",
    transformed_transcript: "final transcript",
    corrected: false,
    applied_rules: [],
    transform_warning: null,
    insert_mode: "clipboard_fallback",
    active_driver: "arboard",
    pasted: false,
    fallback_available: true,
    fallback_reason: null,
    recovery_action: null,
    recovery_message: null,
    clipboard_restore: null,
    error: null,
    ...overrides,
  };
}

describe("diagnostics polling hooks", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps runtime log background polling out of loading state", async () => {
    const backgroundRefresh = deferred<string[]>();
    invokeMock.mockReturnValue(backgroundRefresh.promise);

    const { result, rerender } = renderHook(({ active }) => useRuntimeLogs(active), {
      initialProps: { active: false },
    });

    rerender({ active: true });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      backgroundRefresh.resolve(["runtime ready"]);
      await flushMicrotasks();
    });

    await waitFor(() => expect(result.current.entries).toEqual(["runtime ready"]));
    expect(result.current.isLoading).toBe(false);
  });

  it("uses loading state for manual runtime log refresh", async () => {
    const manualRefresh = deferred<string[]>();
    invokeMock.mockReturnValue(manualRefresh.promise);

    const { result } = renderHook(() => useRuntimeLogs(false));

    act(() => {
      void result.current.refresh();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      manualRefresh.resolve(["manual refresh"]);
      await flushMicrotasks();
    });

    await waitFor(() => expect(result.current.entries).toEqual(["manual refresh"]));
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps history background polling out of loading state", async () => {
    const backgroundRefresh = deferred<TranscriptionHistoryEntry[]>();
    invokeMock.mockImplementation((command: string) => {
      if (command === "transcription_history_storage_status") {
        return Promise.resolve({ path: "/tmp/history.json" });
      }

      /* The second store the foot states, read beside the index (ADR 0074). */
      if (command === "transcript_store_status") {
        return Promise.resolve({ root: "/tmp/WordScript/transcripts", exists: true });
      }

      if (command === "transcription_history_entries") {
        return backgroundRefresh.promise;
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    const { result, rerender } = renderHook(({ active }) => useTranscriptionHistory(active), {
      initialProps: { active: false },
    });

    rerender({ active: true });

    expect(invokeMock).toHaveBeenCalledWith("transcription_history_storage_status");
    expect(invokeMock).toHaveBeenCalledWith("transcription_history_entries", { query: {} });
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      backgroundRefresh.resolve([createHistoryEntry()]);
      await flushMicrotasks();
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.storagePath).toBe("/tmp/history.json");
    expect(result.current.isLoading).toBe(false);
  });

  it("uses loading state for manual history refresh", async () => {
    const manualRefresh = deferred<TranscriptionHistoryEntry[]>();
    invokeMock.mockImplementation((command: string) => {
      if (command === "transcription_history_entries") {
        return manualRefresh.promise;
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    const { result } = renderHook(() => useTranscriptionHistory(false));

    act(() => {
      void result.current.refresh();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      manualRefresh.resolve([createHistoryEntry({ id: "history-2" })]);
      await flushMicrotasks();
    });

    await waitFor(() => expect(result.current.entries[0]?.id).toBe("history-2"));
    expect(result.current.isLoading).toBe(false);
  });
});