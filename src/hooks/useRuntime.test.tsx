import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntime } from "./useRuntime";
import { createAppConfig } from "../test/factories";
import { createEmptyTextProfileCuration } from "../lib/textProfiles";
import type { NativeSessionSnapshot } from "../types/ipc";

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

/** What the runtime answers a window that mounts while nothing is running.
 *  Every test that does not care about the restore gets this one. */
function createIdleSnapshot(): NativeSessionSnapshot {
  return {
    stage: "idle",
    session_id: null,
    started_at_ms: null,
    muted: false,
    paused: false,
    pending_preview: null,
  };
}

describe("useRuntime", () => {
  let snapshot: NativeSessionSnapshot;

  beforeEach(() => {
    invokeMock.mockReset();
    eventListeners.clear();
    const config = createTestConfig();
    snapshot = createIdleSnapshot();

    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        case "load_app_config":
          return Promise.resolve(config);
        case "native_session_snapshot":
          return Promise.resolve(snapshot);
        case "configure_native_trigger":
        case "configure_native_insertion":
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

  // The fallback ends a session, so it owes the same atomic swap the
  // authoritative commit gives: idle AND the surface that reports it, together.
  // Ending it without a surface left `resultSurfaceOpen` false, and a late
  // authoritative event flipped it true one commit later — the ADR 0018 gap,
  // re-entered through the fallback ADR 0018 introduced. On auto_paste the last
  // visible surface is "compact", which the leave hold refuses, so that gap
  // unmounts the pill and orphans its compositor layers on WebKitGTK.
  it("ends an auto_paste session with a result surface when the fallback fires", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRuntime());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        emit("wordscript-event", { event: "processing" });
        emit("wordscript-native-event", {
          event: "transcription_corrected",
          status: { last_transcript: "Wir shippen das morgen.", last_error: null },
        });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.state.status).toBe("idle");
      expect(result.current.state.resultSurfaceOpen).toBe(true);
      expect(result.current.state.lastResult?.final_text).toBe("Wir shippen das morgen.");
      // The native channel distinguishes transcription from
      // transcription_corrected, so this one is known, not guessed.
      expect(result.current.state.lastResult?.corrected).toBe(true);
      // Everything the authoritative event owns stays unknown rather than
      // being invented — the overlay must not show a delivery that was never
      // reported.
      expect(result.current.state.lastResult?.delivery).toBeNull();
      expect(result.current.state.lastResult?.provider).toBeNull();
      expect(result.current.state.lastResult?.work_mode).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets a late authoritative event update the open surface instead of re-opening it", async () => {
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
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.state.resultSurfaceOpen).toBe(true);
      const openedAt = result.current.state.lastResult?.occurred_at_ms;

      // Move the clock so a re-stamped `occurred_at_ms` would be visible. The
      // stamp drives the overlay's result effect, which resets the interaction
      // flags and restarts the auto-close timer — the surface has been on screen
      // since the fallback and must not be treated as freshly arrived.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

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

      // The richer payload lands, but the surface stays the one that is already
      // on screen: no false→true flip, and the occurrence stamp does not move,
      // so the surface is updated in place rather than mounted a second time.
      expect(result.current.state.resultSurfaceOpen).toBe(true);
      expect(result.current.state.lastResult?.delivery).toBe("inserted");
      expect(result.current.state.lastResult?.provider).toBe("groq");
      expect(result.current.state.lastResult?.occurred_at_ms).toBe(openedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  // The degenerate fallback: the native status carried no transcript, so the
  // fallback ended the session with nothing to show and the overlay tore down.
  // A late authoritative event must not mount a result surface into that — the
  // session is over and its pill is gone, which is exactly the unmount-then-
  // mount sequence that orphans compositor layers on WebKitGTK. It still takes
  // the payload, so history and the transcript stay correct.
  it("does not open a surface for a session the fallback already closed empty-handed", async () => {
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
          status: { last_transcript: "", last_error: null },
        });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.state.status).toBe("idle");
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

      expect(result.current.state.resultSurfaceOpen).toBe(false);
      expect(result.current.state.lastTranscription).toBe("Wir shippen das morgen.");
    } finally {
      vi.useRealTimers();
    }
  });

  // One decision surface per delivery mode holds in the fallback too: a
  // clipboard_only run already decided on the processing preview.
  it("opens no result surface when the fallback fires on a clipboard_only run", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRuntime());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        emit("wordscript-event", { event: "processing" });
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
          transform: { applied_rules: [], warning: null },
        });
        emit("wordscript-native-event", {
          event: "transcription",
          status: { last_transcript: "Wir shippen das morgen.", last_error: null },
        });
      });

      expect(result.current.state.previewStaged).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.state.status).toBe("idle");
      expect(result.current.state.resultSurfaceOpen).toBe(false);
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

  // ── The restore (ADR 0151) ────────────────────────────────────────────────
  //
  // A window that mounts into a running session used to render nothing: every
  // input to its surface arrives as an event, and the events went to a window
  // that no longer exists.

  it("repaints a capture that was already running when the window mounted", async () => {
    snapshot = {
      stage: "capturing",
      session_id: "native-7",
      started_at_ms: Date.now() - 42_000,
      muted: true,
      paused: false,
      pending_preview: null,
    };

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.status).toBe("recording"));
    expect(result.current.state.muted).toBe(true);
    // The runtime's session start, not the mount: this is what lets the pill
    // show the elapsed time the capture actually has.
    expect(result.current.state.recordingStartMs).toBe(snapshot.started_at_ms);
  });

  it("repaints a staged preview and marks it as the session's one decision surface", async () => {
    snapshot = {
      stage: "processing",
      session_id: "native-8",
      started_at_ms: Date.now() - 9_000,
      muted: false,
      paused: false,
      pending_preview: {
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
        transform: { applied_rules: ["removed_fillers"], warning: null },
        preview_epoch: 4,
        occurred_at_ms: Date.now() - 2_000,
      },
    };

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.status).toBe("processing"));
    expect(result.current.state.pendingResult?.final_text).toBe("Wir shippen das morgen.");
    // The epoch is how the restored edit surface asks the runtime to keep
    // waiting (ADR 0152), and a restored window is exactly the one that never
    // saw the event carrying it.
    expect(result.current.state.pendingResult?.preview_epoch).toBe(4);
    expect(result.current.state.previewStaged).toBe(true);
    expect(result.current.state.resultSurfaceOpen).toBe(false);

    // And `previewStaged` earns its keep: the commit that follows must not open
    // a second decision surface for a session that already had one (ADR 0018).
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
        transform: { applied_rules: ["removed_fillers"], warning: null },
        delivery: "clipboard",
      });
    });

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.resultSurfaceOpen).toBe(false);
  });

  /** ADR 0134's obligation on the restore. The deadline commits a preview whose
   *  window never came back; a window that mounts afterwards must not be handed
   *  that preview as something still to decide. */
  it("offers nothing for a session the deadline already finished", async () => {
    snapshot = {
      stage: "completed",
      session_id: null,
      started_at_ms: null,
      muted: false,
      paused: false,
      pending_preview: null,
    };

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.config).not.toBeNull());

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.pendingResult).toBeNull();
    expect(result.current.state.previewStaged).toBe(false);
    expect(result.current.state.resultSurfaceOpen).toBe(false);
  });

  /** The snapshot is a round trip, so a live event can beat it home. Whichever
   *  arrives second is not automatically newer — the event always is. */
  it("drops a snapshot that lost its race against a live event", async () => {
    let releaseSnapshot: (() => void) | null = null;
    const snapshotArrives = new Promise<void>((resolve) => {
      releaseSnapshot = resolve;
    });
    const staleSnapshot: NativeSessionSnapshot = {
      stage: "capturing",
      session_id: "native-1",
      started_at_ms: Date.now() - 30_000,
      muted: true,
      paused: false,
      pending_preview: null,
    };
    const config = createTestConfig();
    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        case "load_app_config":
          return Promise.resolve(config);
        case "native_session_snapshot":
          return snapshotArrives.then(() => staleSnapshot);
        default:
          return Promise.resolve(null);
      }
    });

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.state.config).not.toBeNull());

    // The session this window mounted into ended before the snapshot answered.
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
    });

    await act(async () => {
      releaseSnapshot?.();
      await snapshotArrives;
    });

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.muted).toBe(false);
    expect(result.current.state.recordingStartMs).toBeNull();
    expect(result.current.state.lastResult?.final_text).toBe("Wir shippen das morgen.");
  });
});