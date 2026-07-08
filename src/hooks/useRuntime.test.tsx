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

    // The native-event transcription is a pure status sync: it clears
    // pendingResult and flips status to idle, but does NOT set lastResult —
    // that is owned by the authoritative wordscript-event transcription which
    // arrives on the same commit. Setting lastResult here would fire the
    // OverlayWindow lastResult-Effect a second time and defeat the commit
    // suppression (the "eckiger 06b-State" regression).
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.pendingResult).toBeNull();
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
  });
});