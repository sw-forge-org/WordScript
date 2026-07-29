import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OverlayWindow from "./OverlayWindow";
import { createAppConfig } from "../test/factories";
import { createEmptyTextProfileCuration } from "../lib/textProfiles";

const useRuntimeMock = vi.fn();
const invokeMock = vi.fn();
const startDraggingMock = vi.fn();
const scaleFactorMock = vi.fn();
const movedHandlers: Array<(event: { payload: { x: number; y: number } }) => void> = [];
const runtimeEventHandlers: Array<(event: { payload: { event: string; level?: number; rms?: number; waveform?: number[] } }) => void> = [];
// D4: capture handlers for the wordscript-mode-event channel so the per-mode
// hotkey test can dispatch the listener directly. The existing listen mock
// only captured "wordscript-event"; extending it to capture all channels keeps
// the existing tests intact (they only assert on runtimeEventHandlers).
const modeEventHandlers: Array<(event: { payload: unknown }) => void> = [];

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

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../hooks/useRuntime", () => ({
  useRuntime: () => useRuntimeMock(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (channel: string, handler: (event: { payload: { event: string; level?: number; rms?: number; waveform?: number[] } }) => void) => {
    if (channel === "wordscript-event") {
      runtimeEventHandlers.push(handler);
    } else if (channel === "wordscript-mode-event") {
      modeEventHandlers.push(handler as never);
    }

    return () => {
      const index = runtimeEventHandlers.indexOf(handler);
      if (index >= 0) {
        runtimeEventHandlers.splice(index, 1);
      }
      const modeIndex = modeEventHandlers.indexOf(handler as never);
      if (modeIndex >= 0) {
        modeEventHandlers.splice(modeIndex, 1);
      }
    };
  }),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    setBackgroundColor: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setBackgroundColor: vi.fn().mockResolvedValue(undefined),
    startDragging: startDraggingMock,
    scaleFactor: scaleFactorMock,
    onMoved: vi.fn(async (handler: (event: { payload: { x: number; y: number } }) => void) => {
      movedHandlers.push(handler);
      return () => {
        const index = movedHandlers.indexOf(handler);
        if (index >= 0) {
          movedHandlers.splice(index, 1);
        }
      };
    }),
  }),
}));

describe("OverlayWindow", () => {
  beforeEach(() => {
    movedHandlers.length = 0;
    runtimeEventHandlers.length = 0;
    modeEventHandlers.length = 0;
    invokeMock.mockReset();
    startDraggingMock.mockReset();
    scaleFactorMock.mockReset();
    startDraggingMock.mockResolvedValue(undefined);
    scaleFactorMock.mockResolvedValue(1);
    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        // Diagnose-Infrastruktur (plan 1784433288646, Phase 1.2): the overlay
        // calls append_diag_log on every render/tap/schedule under DEV. Tolerate
        // these in tests so they don't trip the default throw.
        case "append_diag_log":
        case "overlay_open_devtools":
        case "read_diag_log":
        case "clear_diag_log":
          return Promise.resolve();
        case "sync_overlay_window_visibility":
          return Promise.resolve();
        case "remember_overlay_manual_position":
          return Promise.resolve();
        case "commit_pending_transcription_preview":
          return Promise.resolve({
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
              source: command,
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
          });
        case "abort_native_session":
          return Promise.resolve({
            stage: "aborted",
          });
        case "insert_text_native":
        case "restore_last_transcript":
          return Promise.resolve({
            ok: true,
            text: "Wir shippen das morgen.",
            insert_mode: "direct_paste",
            active_driver: "enigo",
            clipboard_written: true,
            paste_attempted: true,
            pasted: true,
            scratchpad_entry: {
              id: "scratchpad-1",
              text: "Wir shippen das morgen.",
              source: command,
              created_at_ms: 1716500000000,
              corrected: true,
              insert_mode: "direct_paste",
              active_driver: "enigo",
              clipboard_written: true,
              paste_attempted: true,
              pasted: true,
              fallback_reason: null,
              error: null,
              recovery_action: "none",
              recovery_message: "Inserted at the cursor. No recovery action is needed.",
              clipboard_restore: "scheduled",
            },
            fallback_available: false,
            fallback_reason: null,
            error: null,
            recovery_action: "none",
            recovery_message: "Inserted at the cursor. No recovery action is needed.",
            clipboard_restore: "scheduled",
          });
        case "retry_transcription_history_entry":
          return Promise.resolve({
            id: "history-2",
            created_at_ms: 1716500001000,
            status: "completed",
          });
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });

    useRuntimeMock.mockReturnValue({
      state: {
        status: "idle",
        config: createTestConfig(),
        muted: false,
        paused: false,
        lastTranscription: "Wir shippen das morgen.",
        pendingResult: null,
        lastResult: {
          provider: "groq",
          active_profile: "Support reply",
          work_mode: {
            rewrite_style: "polished",
            insert_behavior: "clipboard_only",
            recovery_behavior: "standard",
          },
          raw_text: "ähm wir shippen das morgen",
          final_text: "Wir shippen das morgen.",
          corrected: true,
          transform: {
            applied_rules: ["removed_fillers"],
            warning: null,
          },
          history: {
            entry_id: "history-1",
            retry_of: null,
          },
          delivery: "clipboard",
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
          occurred_at_ms: 1716500000000,
        },
        error: null,
        recordingStartMs: null,
        previewStaged: false,
        resultSurfaceOpen: true,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps result actions inside the same pill instead of expanding into a second preview surface", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument());
    expect(invokeMock).toHaveBeenCalledWith("sync_overlay_window_visibility", { visible: true, surface: "result_actions" });

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insert" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mute" })).not.toBeInTheDocument();
    expect(screen.queryByText("Last pass")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();

    vi.useFakeTimers();
    try {
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes overlay quick actions through the existing native commands", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("insert_text_native", {
      request: {
        text: "Wir shippen das morgen.",
        source: "overlay_preview_copy",
        corrected: true,
        auto_paste: false,
      },
    }));

    cleanup();
    invokeMock.mockClear();

    render(<OverlayWindow />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Insert" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("insert_text_native", {
      request: {
        text: "Wir shippen das morgen.",
        source: "overlay_preview_insert",
        corrected: true,
        auto_paste: true,
      },
    }));
  });

  it("keeps the action-state pill on screen while Dismiss closes it", async () => {
    render(<OverlayWindow />);

    const dismissButton = await screen.findByRole("button", { name: "Dismiss" });
    expect(screen.queryByLabelText("Audio level")).not.toBeInTheDocument();

    fireEvent.click(dismissButton);

    expect(screen.queryByLabelText("Audio level")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("shows the live commit preview during processing for clipboard-only delivery", async () => {
    useRuntimeMock.mockReturnValue({
      state: {
        status: "processing",
        config: createTestConfig(),
        muted: false,
        paused: false,
        lastTranscription: null,
        pendingResult: {
          provider: "groq",
          active_profile: "Support reply",
          work_mode: {
            rewrite_style: "polished",
            insert_behavior: "clipboard_only",
            recovery_behavior: "standard",
          },
          raw_text: "ähm wir shippen das morgen",
          final_text: "Wir shippen das morgen.",
          corrected: true,
          transform: {
            applied_rules: ["removed_fillers"],
            warning: null,
          },
          history: null,
          delivery: null,
          insertion: null,
          occurred_at_ms: 1716500000000,
        },
        lastResult: null,
        error: null,
        recordingStartMs: null,
        previewStaged: true,
        resultSurfaceOpen: false,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    });

    render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
    expect(screen.queryByText("Last pass")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("commit_pending_transcription_preview"));

    fireEvent.click(screen.getByRole("button", { name: "Abort" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("abort_native_session"));
  });

  // The preview is the one surface where the text has NOT been delivered yet,
  // so it is the only place an edit can still change what the user gets. The
  // corrected text goes back through the commit rather than a separate insert,
  // so session completion, history and the insert result describe the same
  // text that was delivered.
  it("delivers an edited transcript through the commit from the processing preview", async () => {
    useRuntimeMock.mockReturnValue({
      state: {
        status: "processing",
        config: createTestConfig(),
        muted: false,
        paused: false,
        lastTranscription: null,
        pendingResult: {
          provider: "groq",
          active_profile: "Support reply",
          work_mode: {
            rewrite_style: "polished",
            insert_behavior: "clipboard_only",
            recovery_behavior: "standard",
          },
          raw_text: "ähm wir shippen das morgen",
          final_text: "Wir shippen das morgen.",
          corrected: true,
          transform: { applied_rules: ["removed_fillers"], warning: null },
          history: null,
          delivery: null,
          insertion: null,
          occurred_at_ms: 1716500000000,
        },
        lastResult: null,
        error: null,
        recordingStartMs: null,
        previewStaged: true,
        resultSurfaceOpen: false,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    });

    render(<OverlayWindow />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const textarea = screen.getByLabelText("Edit transcription text");
    expect(textarea).toHaveValue("Wir shippen das morgen.");
    // The label must state what confirming does — here: deliver, not just copy
    // somewhere. clipboard_only delivery means the corrected text lands on the
    // clipboard as the committed transcript.
    const confirm = screen.getByRole("button", { name: "Copy corrected text" });

    fireEvent.change(textarea, { target: { value: "Wir shippen das übermorgen." } });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("commit_pending_transcription_preview", {
        text: "Wir shippen das übermorgen.",
      }),
    );
    // Not through the standalone insert path — that would deliver one text
    // while the session completed with another.
    expect(invokeMock.mock.calls.some(([command]) => command === "insert_text_native")).toBe(false);
  });

  it("resyncs the native overlay window when the active surface changes while the overlay stays visible", async () => {
    let pendingResult: {
      provider: string;
      active_profile: string;
      work_mode: {
        rewrite_style: string;
        insert_behavior: string;
        recovery_behavior: string;
      };
      raw_text: string;
      final_text: string;
      corrected: boolean;
      transform: {
        applied_rules: string[];
        warning: null;
      };
      history: null;
      delivery: string | null;
      insertion: null;
      occurred_at_ms: number;
    } | null = null;

    let runtimeValue: any = {
      state: {
        status: "recording",
        config: createTestConfig(),
        muted: false,
        paused: false,
        lastTranscription: null,
        pendingResult,
        lastResult: null,
        error: null,
        recordingStartMs: 1716500000000,
        previewStaged: pendingResult != null,
        resultSurfaceOpen: false,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    };

    useRuntimeMock.mockImplementation(() => runtimeValue);

    const { rerender } = render(<OverlayWindow />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("sync_overlay_window_visibility", {
      visible: true,
      surface: "compact",
    }));

    invokeMock.mockClear();

    pendingResult = {
      provider: "groq",
      active_profile: "Support reply",
      work_mode: {
        rewrite_style: "polished",
        insert_behavior: "clipboard_only",
        recovery_behavior: "standard",
      },
      raw_text: "ähm wir shippen das morgen",
      final_text: "Wir shippen das morgen.",
      corrected: true,
      transform: {
        applied_rules: ["removed_fillers"],
        warning: null,
      },
      history: null,
      delivery: null,
      insertion: null,
      occurred_at_ms: 1716500000000,
    };

    runtimeValue = {
      ...runtimeValue,
      state: {
        ...runtimeValue.state,
        status: "processing",
        pendingResult,
      },
    };

    rerender(<OverlayWindow />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("sync_overlay_window_visibility", {
      visible: true,
      surface: "processing_preview",
    }));
  });

  it("persists the dragged overlay position as the remembered manual placement", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    vi.useFakeTimers();

    try {
      await act(async () => {
        fireEvent.pointerDown(copyButton, { button: 0, pointerId: 11, clientX: 20, clientY: 16 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 11, clientX: 34, clientY: 30 });
        vi.advanceTimersByTime(500);
        movedHandlers[0]?.({ payload: { x: 480, y: 220 } });
        vi.advanceTimersByTime(220);
        await Promise.resolve();
      });

      expect(invokeMock).toHaveBeenCalledWith("remember_overlay_manual_position", {
        x: 480,
        y: 220,
        surface: "result_actions",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("converts moved physical positions with the window scale factor before persisting them", async () => {
    scaleFactorMock.mockResolvedValue(2);
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    vi.useFakeTimers();

    try {
      await act(async () => {
        fireEvent.pointerDown(copyButton, { button: 0, pointerId: 19, clientX: 12, clientY: 18 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 19, clientX: 26, clientY: 34 });
        vi.advanceTimersByTime(500);
        movedHandlers[0]?.({ payload: { x: -640, y: 240 } });
        vi.advanceTimersByTime(220);
        await Promise.resolve();
      });

      expect(invokeMock).toHaveBeenCalledWith("remember_overlay_manual_position", {
        x: -320,
        y: 120,
        surface: "result_actions",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("persists the final position after multiple onMoved events during one drag, not an intermediate one (K1)", async () => {
    // Regression: the 180ms persist debounce used to clear `dragSessionActiveRef`
    // after the first persist, so subsequent onMoved events during the same drag
    // were silently dropped — only an intermediate position was saved, not the
    // final one. See docs/BUG_OVERLAY_PLACEMENT_PERSIST.md, K1.
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    vi.useFakeTimers();

    try {
      await act(async () => {
        fireEvent.pointerDown(copyButton, { button: 0, pointerId: 31, clientX: 20, clientY: 16 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 31, clientX: 34, clientY: 30 });
        vi.advanceTimersByTime(500);

        // First onMoved at an intermediate position.
        movedHandlers[0]?.({ payload: { x: 100, y: 100 } });
        // Let the 180ms debounce fire — this persists the intermediate position.
        vi.advanceTimersByTime(200);
        await Promise.resolve();

        // The drag is still active (pointer never released). A second onMoved
        // arrives at the final position. With the old code this was dropped
        // because `dragSessionActiveRef` was cleared; now it must persist.
        movedHandlers[0]?.({ payload: { x: 999, y: 888 } });
        vi.advanceTimersByTime(200);
        await Promise.resolve();
      });

      const calls = invokeMock.mock.calls.filter(
        ([command]) => command === "remember_overlay_manual_position",
      );
      expect(calls.length).toBeGreaterThanOrEqual(2);
      // The last persisted call must carry the final position, not the
      // intermediate one.
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toMatchObject({ x: 999, y: 888, surface: "result_actions" });
    } finally {
      vi.useRealTimers();
    }
  });

  // Regression (K3): the persist handler used to CANCEL the grace timeout that
  // ends a drag session, and deliberately did not clear `dragSessionActiveRef`
  // itself. Since `clearDragIntent` only arms that timeout, nothing ever ended
  // the session again. Both overlay layout effects bail on
  // `dragSessionActiveRef`, so from the first drag onwards the per-surface size
  // sync and the visual-epoch repaint were dead for the rest of the process —
  // and the visual-epoch repaint is the ONLY native repaint trigger for a
  // same-kind visual change such as a mode cycle, which is why cycling modes in
  // the idle picker left the previous mode's pill painted underneath.
  it("ends the drag session after the moves stop so a mode change still repaints (K3)", async () => {
    // The backend confirms whatever mode was just set; otherwise the eager
    // optimistic update and the confirming refetch collapse into one commit
    // inside `act` and the epoch never changes for a harness reason.
    let backendMode = "auto";
    invokeMock.mockImplementation((command: string, args?: unknown) => {
      if (command === "set_active_profile_processing_mode") {
        backendMode = (args as { mode: string }).mode;
        return Promise.resolve();
      }
      if (command === "resolve_current_processing_mode") {
        return Promise.resolve({ mode: backendMode, is_override: false, auto_detected: false, detected_from: null });
      }
      return Promise.resolve();
    });
    useRuntimeMock.mockReturnValue(buildRecordingState());
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const modeChip = await screen.findByRole("button", { name: /^Mode / });
    vi.useFakeTimers();

    try {
      await act(async () => {
        fireEvent.pointerDown(modeChip, { button: 0, pointerId: 51, clientX: 20, clientY: 16 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 51, clientX: 40, clientY: 36 });
        vi.advanceTimersByTime(500);

        // The native drag takes pointer ownership and the webview sees the
        // pointer end early — this is what arms the grace timeout.
        fireEvent.pointerUp(window, { pointerId: 51 });

        // The window keeps moving; the persist handler runs and used to cancel
        // that very timeout.
        movedHandlers[0]?.({ payload: { x: 320, y: 240 } });
        vi.advanceTimersByTime(200);
        await Promise.resolve();
      });

      await act(async () => {
        // Past the grace window with no further movement: the session must be over.
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      invokeMock.mockClear();

      // A mode change keeps `pillState.kind`, so `key={pillState.kind}` does not
      // remount and the surface does not change. The visual-epoch layout effect
      // is the ONLY thing that can force a native repaint here — and it bails on
      // `dragSessionActiveRef`. With the stuck ref this produced no reveal at
      // all, which is why cycling modes left the previous pill painted.
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Mode / }));
        vi.advanceTimersByTime(50);
        await Promise.resolve();
      });

      const reveals = invokeMock.mock.calls.filter(
        ([command]) => command === "sync_overlay_window_visibility",
      );
      expect(
        reveals.length,
        "a mode change after a drag must still force a native repaint",
      ).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("persists onMoved events during a drag started within the reveal grace window (K2)", async () => {
    // Regression: the 420ms reveal-grace suppression dropped onMoved events
    // even when a real drag (pointerdown) had already started, so a fast drag
    // right after reveal was never persisted. See
    // docs/BUG_OVERLAY_PLACEMENT_PERSIST.md, K2.
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    vi.useFakeTimers();

    try {
      await act(async () => {
        // pointerdown immediately after reveal — within the 420ms grace.
        fireEvent.pointerDown(copyButton, { button: 0, pointerId: 42, clientX: 10, clientY: 10 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 42, clientX: 24, clientY: 28 });
        vi.advanceTimersByTime(100);

        // onMoved while still inside the 420ms grace — but dragIntentRef is set,
        // so the grace suppression must NOT apply.
        movedHandlers[0]?.({ payload: { x: 300, y: 200 } });
        vi.advanceTimersByTime(200);
        await Promise.resolve();
      });

      expect(invokeMock).toHaveBeenCalledWith("remember_overlay_manual_position", {
        x: 300,
        y: 200,
        surface: "result_actions",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores moved events that were not caused by an active user drag", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    vi.useFakeTimers();

    try {
      await act(async () => {
        movedHandlers[0]?.({ payload: { x: 520, y: 260 } });
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(invokeMock).not.toHaveBeenCalledWith("remember_overlay_manual_position", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops persisting moved events once the native drag session has finished", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    vi.useFakeTimers();

    try {
      await act(async () => {
        fireEvent.pointerDown(copyButton, { button: 0, pointerId: 23, clientX: 18, clientY: 20 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 23, clientX: 32, clientY: 36 });
        await Promise.resolve();
      });

      expect(startDraggingMock).toHaveBeenCalledTimes(1);

      fireEvent.pointerUp(window, { pointerId: 23 });

      invokeMock.mockClear();

      await act(async () => {
        movedHandlers[0]?.({ payload: { x: 806, y: 1365 } });
        vi.advanceTimersByTime(220);
        await Promise.resolve();
      });

      expect(invokeMock).not.toHaveBeenCalledWith("remember_overlay_manual_position", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts dragging only after pointer movement and does not turn a dragged button press into a click", async () => {
    render(<OverlayWindow />);

    const copyButton = await screen.findByRole("button", { name: "Copy" });

    fireEvent.pointerDown(copyButton, { button: 0, pointerId: 7, clientX: 10, clientY: 12 });
    fireEvent.pointerMove(window, { buttons: 1, pointerId: 7, clientX: 22, clientY: 24 });

    await waitFor(() => expect(startDraggingMock).toHaveBeenCalledTimes(1));
    fireEvent.pointerUp(window, { pointerId: 7 });

    fireEvent.click(copyButton);

    expect(invokeMock.mock.calls.some(([command]) => command === "insert_text_native")).toBe(false);
  });

  it("keeps suppressing button clicks until a long drag actually ends", async () => {
    render(<OverlayWindow />);

    const copyButton = await screen.findByRole("button", { name: "Copy" });

    fireEvent.pointerDown(copyButton, { button: 0, pointerId: 13, clientX: 14, clientY: 18 });
    fireEvent.pointerMove(window, { buttons: 1, pointerId: 13, clientX: 30, clientY: 34 });

    expect(startDraggingMock).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();

    try {
      act(() => {
        vi.advanceTimersByTime(1200);
      });

      fireEvent.pointerUp(window, { pointerId: 13 });

      fireEvent.click(copyButton);

      expect(invokeMock.mock.calls.some(([command]) => command === "insert_text_native")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  // ── Atomic surface swap (plan 1782750354086) ──────────────────────────────
  // A new trigger must make the previous epoch's idle surface (result/error/
  // edit) vanish in the SAME render the recording surface appears. RECORDING_
  // STARTED flips status and clears lastResult/pendingResult/error in one
  // reducer commit; the derived/gated visibility in pillState consumes that in
  // a single render, so no surface overlaps.

  function buildIdleResultState(overrides: Record<string, unknown> = {}) {
    return {
      state: {
        status: "idle",
        config: createTestConfig(),
        muted: false,
        paused: false,
        lastTranscription: "Wir shippen das morgen.",
        pendingResult: null,
        lastResult: {
          provider: "groq",
          active_profile: "Support reply",
          work_mode: {
            rewrite_style: "polished",
            insert_behavior: "clipboard_only",
            recovery_behavior: "standard",
          },
          raw_text: "ähm wir shippen das morgen",
          final_text: "Wir shippen das morgen.",
          corrected: true,
          transform: { applied_rules: ["removed_fillers"], warning: null },
          history: null,
          delivery: "clipboard",
          insertion: null,
          occurred_at_ms: 1716500000000,
        },
        error: null,
        recordingStartMs: null,
        previewStaged: false,
        resultSurfaceOpen: true,
        ...overrides,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    };
  }

  function buildRecordingState() {
    return buildIdleResultState({
      status: "recording",
      lastTranscription: null,
      lastResult: null,
      pendingResult: null,
      error: null,
      recordingStartMs: 1716500005000,
      resultSurfaceOpen: false,
    });
  }

  // ── Gap-free processing -> result swap (auto_paste) ───────────────────────
  // The auto_paste path goes compact(processing) -> result_actions directly:
  // there is no processing_preview in between. The reducer therefore flips
  // `status` to "idle" and `resultSurfaceOpen` to true in ONE commit, and the
  // pill must swap in that same render. If it did not, the pill would fall to
  // `pillState = null` for a frame, and unmounting the processing spinner
  // orphans its WebKitGTK compositor layer — the ghosting mechanism in
  // docs/known-issues/overlay-ghosting.md, seen as the result surface stacking
  // on top of a processing surface that never went away.
  it("swaps processing to result-actions in one render without an empty pill", async () => {
    let runtimeValue = buildIdleResultState({
      status: "processing",
      lastResult: null,
      lastTranscription: null,
      resultSurfaceOpen: false,
    });
    useRuntimeMock.mockImplementation(() => runtimeValue);
    const { rerender, container } = render(<OverlayWindow />);

    await waitFor(() => expect(container.querySelector(".ov-pill-shell")).not.toBeNull());
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();

    // The commit the runtime produces: idle + result surface, together.
    runtimeValue = buildIdleResultState();
    useRuntimeMock.mockImplementation(() => runtimeValue);
    rerender(<OverlayWindow />);

    // Synchronous, no waitFor: the surface must be there in this very render.
    expect(container.querySelector(".ov-pill-shell")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  // A clipboard_only commit already had its decision surface (the processing
  // preview), so no result surface follows it — structurally, via
  // `resultSurfaceOpen`, not via a suppression flag.
  it("does not open a result surface for a session that decided on the preview", async () => {
    const runtimeValue = buildIdleResultState({ resultSurfaceOpen: false, previewStaged: true });
    useRuntimeMock.mockImplementation(() => runtimeValue);
    render(<OverlayWindow />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("clears a visible result-actions surface in the same render a new recording starts", async () => {
    let runtimeValue = buildIdleResultState();
    useRuntimeMock.mockImplementation(() => runtimeValue);
    const { rerender } = render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument());
    expect(screen.queryByLabelText("Audio level")).not.toBeInTheDocument();

    runtimeValue = buildRecordingState();
    useRuntimeMock.mockImplementation(() => runtimeValue);
    rerender(<OverlayWindow />);

    expect(screen.getByLabelText("Audio level")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    // D1+A2: the reveal is coalesced via scheduleReveal (queueMicrotask), so
    // the invoke arrives asynchronously as a microtask. waitFor covers the flush.
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("sync_overlay_window_visibility", { visible: true, surface: "compact" }));
  });

  it("clears a hanging error surface instead of being blocked by error priority", async () => {
    let runtimeValue = buildIdleResultState({ error: "Transcription failed.", lastResult: null });
    useRuntimeMock.mockImplementation(() => runtimeValue);
    const { rerender } = render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByText("Transcription failed.")).toBeInTheDocument());
    expect(screen.queryByLabelText("Audio level")).not.toBeInTheDocument();

    runtimeValue = buildRecordingState();
    useRuntimeMock.mockImplementation(() => runtimeValue);
    rerender(<OverlayWindow />);

    expect(screen.getByLabelText("Audio level")).toBeInTheDocument();
    expect(screen.queryByText("Transcription failed.")).not.toBeInTheDocument();
  });

  it("clears an active edit-mode surface when a new recording starts", async () => {
    let runtimeValue = buildIdleResultState();
    useRuntimeMock.mockImplementation(() => runtimeValue);
    const { rerender } = render(<OverlayWindow />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Edit transcription text")).toBeInTheDocument();

    runtimeValue = buildRecordingState();
    useRuntimeMock.mockImplementation(() => runtimeValue);
    rerender(<OverlayWindow />);

    expect(screen.getByLabelText("Audio level")).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit transcription text")).not.toBeInTheDocument();
  });

  it("re-enters the recording surface without the dismissed result resurfacing", async () => {
    let runtimeValue = buildIdleResultState();
    useRuntimeMock.mockImplementation(() => runtimeValue);
    const { rerender } = render(<OverlayWindow />);

    const dismissButton = await screen.findByRole("button", { name: "Dismiss" });
    fireEvent.click(dismissButton);

    runtimeValue = buildRecordingState();
    useRuntimeMock.mockImplementation(() => runtimeValue);
    rerender(<OverlayWindow />);

    expect(screen.getByLabelText("Audio level")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
  });

  it("shows the Insert affordance on a clipboard fallback delivery even for an auto_paste profile", async () => {
    // Simulates an auto_paste run that fell back to clipboard at runtime
    // (NativeInsertMode::ClipboardFallback). The backend emits
    // delivery:"clipboard" in the transcription payload; the overlay must
    // surface the Insert retry affordance (06b) the same way it does for the
    // explicit clipboard_only setting — without relying on insert_behavior.
    useRuntimeMock.mockReturnValue({
      state: {
        status: "idle",
        config: createAppConfig({
          active_text_profile_id: "support",
          text_profiles: [
            {
              id: "support",
              label: "Support reply",
              prompt: "Support tone",
              stt_hints: "",
              vocabulary_hints: [],
              schema_version: 2,
              work_mode: {
                rewrite_style: "clean" as const,
                insert_behavior: "auto_paste" as const,
                recovery_behavior: "standard" as const,
              },
              curation: createEmptyTextProfileCuration(),
              dictionary_entries: [],
              snippet_entries: [],
            },
          ],
        }),
        muted: false,
        paused: false,
        lastTranscription: "Wir shippen das morgen.",
        pendingResult: null,
        lastResult: {
          provider: "groq",
          active_profile: "Support reply",
          work_mode: {
            rewrite_style: "clean",
            insert_behavior: "auto_paste",
            recovery_behavior: "standard",
          },
          raw_text: "ähm wir shippen das morgen",
          final_text: "Wir shippen das morgen.",
          corrected: true,
          transform: { applied_rules: ["removed_fillers"], warning: null },
          history: null,
          delivery: "clipboard",
          insertion: null,
          occurred_at_ms: 1716500000000,
        },
        error: null,
        recordingStartMs: null,
        previewStaged: false,
        resultSurfaceOpen: true,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    });

    render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument());

    // The Insert affordance (06b) must be visible because delivery === "clipboard".
    expect(screen.getByRole("button", { name: "Insert" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  // ── D4 (plan 1784412908352): Mode-Wechsel-während-Recording-Pfad ──────────

  it("coalesces multiple reveals within one frame into a single native call", async () => {
    // Simulates a mode change during recording: the surface stays "compact"
    // but `pillVisualEpoch` (which includes pillMode) and the per-surface size
    // layoutEffect both re-evaluate. Without D1's scheduleReveal dispatcher,
    // each source fires its own `sync_overlay_window_visibility` → 2–3 native
    // set_size calls per frame with different reveal ticks. With D1+A2, all
    // sources coalesce via queueMicrotask into at most one native call per
    // microtask tick.
    invokeMock.mockImplementation((command: string) => {
      if (command === "resolve_current_processing_mode") {
        return Promise.resolve({ mode: "auto", is_override: false, auto_detected: false, detected_from: null });
      }
      if (command === "sync_overlay_window_visibility") return Promise.resolve();
      if (command === "set_active_profile_processing_mode") return Promise.resolve();
      return Promise.resolve();
    });
    useRuntimeMock.mockReturnValue(buildRecordingState());

    render(<OverlayWindow />);

    // Let the initial recording reveal flush and the chip mount with mode="Auto".
    await waitFor(() => expect(screen.getByLabelText("Mode Auto, tap to cycle")).toBeInTheDocument());

    // Now tap the mode chip to cycle auto → verbatim. This triggers
    // handleCycleMode, which (D2) eagerly sets effectiveMode="verbatim" in the
    // same render → pillVisualEpoch changes → the pillVisualEpoch layoutEffect
    // and the size layoutEffect both fire scheduleReveal in the same tick.
    invokeMock.mockClear();
    fireEvent.click(screen.getByLabelText("Mode Auto, tap to cycle"));

    // Flush the queueMicrotask. The eager update means the rerender happens
    // synchronously inside fireEvent.click, and the two scheduleReveal calls
    // both land in the same microtask queue. After flushing, at most one
    // sync_overlay_window_visibility call should have been dispatched for the
    // reveal (the set_active_profile call is a separate command and not counted).
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    const revealCalls = invokeMock.mock.calls.filter(
      (call) => {
        const [command] = call as [string];
        return command === "sync_overlay_window_visibility";
      },
    );
    expect(revealCalls.length).toBeLessThanOrEqual(1);
    if (revealCalls.length === 1) {
      expect(revealCalls[0][1]).toMatchObject({ visible: true, surface: "compact" });
    }
  });

  it("eager-updates effectiveMode on cycle tap before the backend resolves", async () => {
    // D2: handleCycleMode sets effectiveMode eagerly in the same render as the
    // click, so pillMode/pillVisualEpoch update immediately — even before
    // set_active_profile_processing_mode resolves. The pending invoke is held
    // (never resolved) to prove the update is optimistic, not backend-driven.
    let resolveSetActiveProfile: ((value: unknown) => void) | null = null;
    invokeMock.mockImplementation((command: string) => {
      if (command === "resolve_current_processing_mode") {
        return Promise.resolve({ mode: "auto", is_override: false, auto_detected: false, detected_from: null });
      }
      if (command === "sync_overlay_window_visibility") return Promise.resolve();
      if (command === "set_active_profile_processing_mode") {
        return new Promise((resolve) => { resolveSetActiveProfile = resolve; });
      }
      return Promise.resolve();
    });
    useRuntimeMock.mockReturnValue(buildRecordingState());

    render(<OverlayWindow />);
    await waitFor(() => expect(screen.getByLabelText("Mode Auto, tap to cycle")).toBeInTheDocument());

    // Tap to cycle auto → verbatim. The eager update must flip the chip label
    // to "Verbatim" WITHOUT resolving set_active_profile_processing_mode.
    fireEvent.click(screen.getByLabelText("Mode Auto, tap to cycle"));

    await waitFor(() => expect(screen.getByLabelText("Mode Verbatim, tap to cycle")).toBeInTheDocument());

    // The backend invoke is still pending (never resolved) — proves the
    // label change came from the eager setEffectiveMode, not fetchEffectiveMode.
    // resolveSetActiveProfile is assigned by the invoke mock when
    // set_active_profile_processing_mode is called; the fact that it's set
    // means the backend was contacted, but the promise is still pending (we
    // never call it). The chip label changed BEFORE the promise resolved →
    // the update is optimistic.
    expect(resolveSetActiveProfile).not.toBeNull();
  });

  it("per-mode hotkey still syncs via wordscript-mode-event without eager update", async () => {
    // D2: the wordscript-mode-event listener (for EXTERNAL mode changes like
    // the per-mode hotkey, settings save, auto-resolution) stays purely async.
    // It must NOT eager-update; effectiveMode only changes after
    // resolve_current_processing_mode resolves with the new mode.
    //
    // The fetchEffectiveMode debounce (150ms) collapses redundant refetches
    // that arrive within the same mode-change window (e.g. wordscript-mode-event
    // + the ready event from set_active_profile_processing_mode). The test uses
    // fake timers to advance past the debounce window so the event-driven
    // refetch actually fires.
    let resolveCallCount = 0;
    let resolveResolveMode: ((value: unknown) => void) | null = null;
    invokeMock.mockImplementation((command: string) => {
      if (command === "sync_overlay_window_visibility") return Promise.resolve();
      if (command === "resolve_current_processing_mode") {
        resolveCallCount += 1;
        if (resolveCallCount <= 1) {
          // Initial mount: resolve with "auto".
          return Promise.resolve({ mode: "auto", is_override: false, auto_detected: false, detected_from: null });
        }
        // Subsequent calls (after a mode-event): stay pending until the test
        // resolves it, proving the chip does NOT update eagerly.
        return new Promise((resolve) => { resolveResolveMode = resolve; });
      }
      return Promise.resolve();
    });
    useRuntimeMock.mockReturnValue(buildRecordingState());

    render(<OverlayWindow />);
    // Wait for the wordscript-mode-event listener to subscribe.
    await waitFor(() => expect(modeEventHandlers.length).toBeGreaterThan(0));
    // Wait for the initial resolve to land so the chip shows "Auto".
    await waitFor(() => expect(screen.getByLabelText("Mode Auto, tap to cycle")).toBeInTheDocument());

    // Advance real time past the debounce window so the next fetchEffectiveMode
    // is not skipped. The debounce uses Date.now(), so we must wait >150ms of
    // real time. vi.useFakeTimers would not affect Date.now unless configured;
    // instead use a real delay.
    await act(async () => { await new Promise((r) => setTimeout(r, 160)); });

    // Fire the wordscript-mode-event listener manually (simulates the per-mode
    // hotkey path: set_mode_override_and_emit emits the event, the listener
    // refetches). The chip must STILL say "Auto" until the resolve resolves,
    // because this path does NOT eager-update (D2 — only the user-driven
    // handleCycleMode and wordscript-mode-select listener use the optimistic
    // update).
    modeEventHandlers.forEach((fn) => fn({ payload: { event: "mode-changed" } }));

    // The chip label is still "Auto" — no eager update on the event path.
    expect(screen.getByLabelText("Mode Auto, tap to cycle")).toBeInTheDocument();
    // The second resolve_current_processing_mode call is pending.
    expect(resolveResolveMode).not.toBeNull();

    // Now resolve the backend with "rewrite" — the chip updates AFTER the
    // resolve, proving the async-only path.
    await act(async () => {
      resolveResolveMode?.({ mode: "rewrite", is_override: true, auto_detected: false, detected_from: null });
    });
    await waitFor(() => expect(screen.getByLabelText("Mode Rewrite, tap to cycle")).toBeInTheDocument());
  });

  it("park (visible:false) is not coalesced with reveal", async () => {
    // D1: the visible:false (park) path stays a DIRECT invoke, not routed
    // through scheduleReveal. It fires at the end of the leave timer and must
    // not be coalesced with a concurrent reveal. We verify the park call
    // arrives with visible:false even when a reveal was scheduled shortly
    // before.
    useRuntimeMock.mockReturnValue(buildRecordingState());
    const { rerender } = render(<OverlayWindow />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith(
      "sync_overlay_window_visibility",
      expect.objectContaining({ visible: true, surface: "compact" }),
    ));

    // Transition to idle (no pendingResult, no lastResult → isActive goes
    // false → overlayMotion flips to "leaving" → after OVERLAY_LEAVE_MS the
    // park invoke fires with visible:false).
    invokeMock.mockClear();
    const idleRuntime = buildIdleResultState({
      status: "idle",
      lastResult: null,
      lastTranscription: null,
      pendingResult: null,
    });
    useRuntimeMock.mockReturnValue(idleRuntime);

    // Activate fake timers BEFORE the rerender so the OVERLAY_LEAVE_MS (240ms)
    // leave timer is scheduled in fake-timer space and we can advance it
    // deterministically. Also flush any pending real-timer microtasks first.
    await act(async () => { await Promise.resolve(); });
    vi.useFakeTimers();
    try {
      rerender(<OverlayWindow />);

      // Advance through the OVERLAY_LEAVE_MS (240ms) leave transition. The
      // park invoke (visible:false) fires at the end of the leave timer.
      await act(async () => {
        vi.advanceTimersByTime(260);
      });
      // Flush any coalesced reveals (A2: queueMicrotask) that were scheduled
      // before the park. With fake timers the microtask queue drains inside the
      // prior act() block; this second advance is a defensive no-op to be
      // certain. They must not have swallowed the park call.
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const parkCalls = invokeMock.mock.calls.filter(
        (call) => {
          const [command, args] = call as [string, { visible?: boolean }];
          return command === "sync_overlay_window_visibility" && args?.visible === false;
        },
      );
      expect(parkCalls.length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });
});