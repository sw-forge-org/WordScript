import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntime } from "./useRuntime";
import { createAppConfig } from "../test/factories";
import { createEmptyTextProfileCuration } from "../lib/textProfiles";

const invokeMock = vi.fn();
const eventListeners = new Map<string, Array<(event: { payload: unknown }) => void>>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (channel: string, callback: (event: { payload: unknown }) => void) => {
    const listeners = eventListeners.get(channel) ?? [];
    listeners.push(callback);
    eventListeners.set(channel, listeners);

    return () => {
      const current = eventListeners.get(channel) ?? [];
      eventListeners.set(channel, current.filter((listener) => listener !== callback));
    };
  }),
}));

function emit(channel: string, payload: unknown) {
  for (const listener of eventListeners.get(channel) ?? []) {
    listener({ payload });
  }
}

function createTestConfig() {
  return createAppConfig({
    active_text_profile_id: "support",
    text_profiles: [
      {
        id: "support",
        label: "Support reply",
        prompt: "Support tone and escalation names",
        stt_hints: "status update",
        vocabulary_hints: [],
        schema_version: 2,
        work_mode: {
          rewrite_style: "polished" as const,
          insert_behavior: "clipboard_only" as const,
          recovery_behavior: "standard" as const,
        },
        curation: createEmptyTextProfileCuration(),
        dictionary_entries: [],
        snippet_entries: [],
      },
    ],
  });
}

describe("useRuntime", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    eventListeners.clear();
    const config = createTestConfig();

    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        case "load_app_config":
          return Promise.resolve(config);
        case "configure_native_trigger":
        case "configure_native_insertion":
        case "configure_native_capture":
          return Promise.resolve(null);
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("preserves rich backend payload when native completion event arrives", async () => {
    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.config?.active_text_profile_id).toBe("support"));

    await act(async () => {
      emit("wordscript-event", {
        event: "transcription",
        text: "Wir shippen das morgen.",
        corrected: true,
        provider: "groq",
        active_profile: "Support reply",
        raw_text: "ähm wir shippen das morgen",
        work_mode: {
          rewrite_style: "polished",
          insert_behavior: "clipboard_only",
          recovery_behavior: "standard",
        },
        transform: {
          applied_rules: ["removed_fillers", "capitalized_sentence_start"],
          warning: null,
        },
        history: {
          entry_id: "history-1",
          retry_of: null,
        },
        insertion: {
          ok: true,
          text: "Wir shippen das morgen.",
          insert_mode: "clipboard_only",
          active_driver: "arboard",
          clipboard_written: true,
          paste_attempted: false,
          pasted: false,
          scratchpad_entry: {
            id: "scratchpad-1",
            text: "Wir shippen das morgen.",
            source: "legacy_transcription_corrected",
            created_at_ms: 1716500000000,
            corrected: true,
            insert_mode: "clipboard_only",
            active_driver: "arboard",
            clipboard_written: true,
            paste_attempted: false,
            pasted: false,
            fallback_reason: null,
            error: null,
            recovery_action: "manual_paste",
            recovery_message: "The transcript is on the clipboard.",
            clipboard_restore: "skipped_no_previous_clipboard",
          },
          fallback_available: true,
          fallback_reason: null,
          error: null,
          recovery_action: "manual_paste",
          recovery_message: "The transcript is on the clipboard.",
          clipboard_restore: "skipped_no_previous_clipboard",
        },
      });

      emit("wordscript-native-event", {
        event: "transcription_corrected",
        status: {
          last_transcript: "Wir shippen das morgen.",
          last_error: null,
        },
      });
    });

    expect(result.current.state.lastTranscription).toBe("Wir shippen das morgen.");
    expect(result.current.state.lastResult?.raw_text).toBe("ähm wir shippen das morgen");
    expect(result.current.state.lastResult?.active_profile).toBe("Support reply");
    expect(result.current.state.lastResult?.work_mode?.insert_behavior).toBe("clipboard_only");
    expect(result.current.state.lastResult?.history?.entry_id).toBe("history-1");
    expect(result.current.state.lastResult?.insertion?.insert_mode).toBe("clipboard_only");
    expect(result.current.state.lastResult?.insertion?.recovery_action).toBe("manual_paste");
  });

  it("keeps a pending live preview during processing and carries it through the thinner native completion event", async () => {
    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.config?.active_text_profile_id).toBe("support"));

    await act(async () => {
      emit("wordscript-event", {
        event: "processing",
      });

      emit("wordscript-event", {
        event: "preview_ready",
        text: "Wir shippen das morgen.",
        corrected: true,
        provider: "groq",
        active_profile: "Support reply",
        raw_text: "ähm wir shippen das morgen",
        work_mode: {
          rewrite_style: "polished",
          insert_behavior: "clipboard_only",
          recovery_behavior: "standard",
        },
        transform: {
          applied_rules: ["removed_fillers"],
          warning: null,
        },
      });
    });

    expect(result.current.state.status).toBe("processing");
    expect(result.current.state.pendingResult?.raw_text).toBe("ähm wir shippen das morgen");
    expect(result.current.state.pendingResult?.transform?.applied_rules).toEqual(["removed_fillers"]);
    expect(result.current.state.lastResult).toBeNull();

    await act(async () => {
      emit("wordscript-native-event", {
        event: "transcription_corrected",
        status: {
          last_transcript: "Wir shippen das morgen.",
          last_error: null,
        },
      });
    });

    // The native-event transcription is a pure status sync: it mirrors the
    // transcript text and NOTHING else. It does not set lastResult (that is
    // owned by the authoritative wordscript-event transcription, and setting it
    // here would fire the OverlayWindow lastResult-Effect a second time — the
    // "eckiger 06b-State" regression), and it does not end the session: this is
    // its own React commit, and ending the session in it leaves a render where
    // no surface owns the pill (ADR 0018).
    expect(result.current.state.status).toBe("processing");
    expect(result.current.state.pendingResult).not.toBeNull();
    expect(result.current.state.lastResult).toBeNull();
    expect(result.current.state.lastTranscription).toBe("Wir shippen das morgen.");

    // Now the authoritative wordscript-event transcription arrives and owns
    // lastResult + the surface decision.
    await act(async () => {
      emit("wordscript-event", {
        event: "transcription",
        text: "Wir shippen das morgen.",
        corrected: true,
        provider: "groq",
        active_profile: "Support reply",
        raw_text: "ähm wir shippen das morgen",
        work_mode: {
          rewrite_style: "polished",
          insert_behavior: "clipboard_only",
          recovery_behavior: "standard",
        },
        transform: {
          applied_rules: ["removed_fillers"],
          warning: null,
        },
      });
    });

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.lastResult?.raw_text).toBe("ähm wir shippen das morgen");
    expect(result.current.state.lastResult?.transform?.applied_rules).toEqual(["removed_fillers"]);
    // One decision surface per delivery mode: this session decided on the
    // processing preview, so no result surface follows. `previewStaged` carries
    // that across the native sync, which already cleared `pendingResult`.
    expect(result.current.state.previewStaged).toBe(true);
    expect(result.current.state.resultSurfaceOpen).toBe(false);
  });

  it("opens the result surface atomically with idle when no preview was staged", async () => {
    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.config?.active_text_profile_id).toBe("support"));

    await act(async () => {
      emit("wordscript-event", { event: "processing" });
    });

    expect(result.current.state.resultSurfaceOpen).toBe(false);

    await act(async () => {
      emit("wordscript-event", {
        event: "transcription",
        text: "Wir shippen das morgen.",
        corrected: true,
        provider: "groq",
        active_profile: "Support reply",
        raw_text: "ähm wir shippen das morgen",
        work_mode: {
          rewrite_style: "polished",
          insert_behavior: "auto_paste",
          recovery_behavior: "standard",
        },
        transform: { applied_rules: [], warning: null },
        delivery: "inserted",
      });
    });

    // status and surface flip in the SAME commit — the overlay never sees a
    // render where the session has ended but no surface has taken over. That
    // render was the only reason the old `bridgeResultFromStop` predicate
    // existed, and it only ever occurred on this (auto_paste) path.
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.previewStaged).toBe(false);
    expect(result.current.state.resultSurfaceOpen).toBe(true);
  });

  // The REAL auto_paste ordering: Rust emits the native completion sync first
  // and the authoritative wordscript-event transcription second, as two IPC
  // messages and therefore two React commits. If the sync ends the session, the
  // commit between them has `status: "idle"` with no lastResult and no
  // resultSurfaceOpen — the render in which no surface owns the pill, which
  // unmounts <OverlayPill> and orphans the processing pill's compositor layers
  // on WebKitGTK (docs/known-issues/overlay-ghosting.md). ADR 0018.
  it("keeps the session alive across the native sync so auto_paste never renders a surface-less frame", async () => {
    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.config?.active_text_profile_id).toBe("support"));

    await act(async () => {
      emit("wordscript-event", { event: "processing" });
    });

    expect(result.current.state.status).toBe("processing");

    await act(async () => {
      emit("wordscript-native-event", {
        event: "transcription_corrected",
        status: { last_transcript: "Wir shippen das morgen.", last_error: null },
      });
    });

    // The gap render: the session must still be running here, so the compact
    // processing surface keeps owning the pill.
    expect(result.current.state.status).toBe("processing");
    expect(result.current.state.resultSurfaceOpen).toBe(false);
    expect(result.current.state.lastResult).toBeNull();
    expect(result.current.state.lastTranscription).toBe("Wir shippen das morgen.");

    await act(async () => {
      emit("wordscript-event", {
        event: "transcription",
        text: "Wir shippen das morgen.",
        corrected: true,
        provider: "groq",
        active_profile: "Support reply",
        raw_text: "ähm wir shippen das morgen",
        work_mode: {
          rewrite_style: "polished",
          insert_behavior: "auto_paste",
          recovery_behavior: "standard",
        },
        transform: { applied_rules: [], warning: null },
        delivery: "inserted",
      });
    });

    // Session end and result surface in one commit — processing hands the pill
    // straight to result-actions, with no frame in between.
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.previewStaged).toBe(false);
    expect(result.current.state.resultSurfaceOpen).toBe(true);
    expect(result.current.state.lastResult?.final_text).toBe("Wir shippen das morgen.");
  });

  // The fallback exists so a lost authoritative event cannot strand the overlay
  // in "processing" forever. It is the explicit way out, not the default path.
  it("ends the session itself when the authoritative event never follows the native sync", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRuntime());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.state.config?.active_text_profile_id).toBe("support");

      await act(async () => {
        emit("wordscript-event", { event: "processing" });
        emit("wordscript-native-event", {
          event: "transcription",
          status: { last_transcript: "Wir shippen das morgen.", last_error: null },
        });
      });

      expect(result.current.state.status).toBe("processing");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.state.status).toBe("idle");
      expect(result.current.state.pendingResult).toBeNull();
      expect(result.current.state.lastTranscription).toBe("Wir shippen das morgen.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not end the session late when the authoritative event already arrived", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRuntime());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        emit("wordscript-event", { event: "processing" });
        emit("wordscript-native-event", {
          event: "transcription",
          status: { last_transcript: "Wir shippen das morgen.", last_error: null },
        });
      });

      await act(async () => {
        emit("wordscript-event", {
          event: "transcription",
          text: "Wir shippen das morgen.",
          corrected: false,
          provider: "groq",
          active_profile: "Support reply",
          raw_text: "wir shippen das morgen",
          work_mode: {
            rewrite_style: "polished",
            insert_behavior: "auto_paste",
            recovery_behavior: "standard",
          },
          transform: { applied_rules: [], warning: null },
          delivery: "inserted",
        });
        emit("wordscript-event", { event: "recording_started" });
      });

      expect(result.current.state.status).toBe("recording");

      // The cancelled fallback must not fire into the NEXT session.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.state.status).toBe("recording");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the result surface when an auto_paste run falls back to the clipboard", async () => {
    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.config?.active_text_profile_id).toBe("support"));

    await act(async () => {
      emit("wordscript-event", { event: "processing" });
      emit("wordscript-event", {
        event: "transcription",
        text: "Wir shippen das morgen.",
        corrected: false,
        provider: "groq",
        active_profile: "Support reply",
        raw_text: "wir shippen das morgen",
        work_mode: {
          rewrite_style: "polished",
          insert_behavior: "auto_paste",
          recovery_behavior: "standard",
        },
        transform: { applied_rules: [], warning: null },
        // The paste failed and the text only reached the clipboard. This is
        // exactly the case where the user needs the result surface to retry,
        // so the decision must not be keyed on `delivery`.
        delivery: "clipboard",
      });
    });

    expect(result.current.state.resultSurfaceOpen).toBe(true);
  });

  it("closes the result surface again when the next session starts", async () => {
    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.config?.active_text_profile_id).toBe("support"));

    await act(async () => {
      emit("wordscript-event", { event: "processing" });
      emit("wordscript-event", {
        event: "transcription",
        text: "Wir shippen das morgen.",
        corrected: false,
        provider: "groq",
        active_profile: "Support reply",
        raw_text: "wir shippen das morgen",
        work_mode: {
          rewrite_style: "polished",
          insert_behavior: "auto_paste",
          recovery_behavior: "standard",
        },
        transform: { applied_rules: [], warning: null },
        delivery: "inserted",
      });
    });

    expect(result.current.state.resultSurfaceOpen).toBe(true);

    await act(async () => {
      emit("wordscript-event", { event: "recording_started" });
    });

    expect(result.current.state.resultSurfaceOpen).toBe(false);
  });
});