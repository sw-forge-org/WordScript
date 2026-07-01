import { type MouseEvent, type PointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useRuntime } from "../hooks/useRuntime";
import { resolveActiveTextProfile, resolveTextProfileWorkMode } from "../lib/textProfiles";
import type { AppConfig, ProcessingMode } from "../types/ipc";
import type { NativeInsertResult } from "../types/nativeInsertion";
import {
  OverlayPill,
  type OverlayPendingPreview,
  type OverlayPendingResult,
  type OverlayPillState,
  type OverlayProcessingMode,
} from "../components/overlay/OverlayPill";
import "../styles/overlay-shell.css";

const RUNTIME_EVENT_CHANNEL = "wordscript-event";
// Order the in-overlay mode cycler rotates through. Mirrors the modes exposed in
// Settings → Modes.
const MODE_CYCLE: ProcessingMode[] = ["auto", "verbatim", "cleanup", "rewrite", "agent", "prompt_enhance"];
const OVERLAY_ENTER_MS = 320;
const OVERLAY_LEAVE_MS = 240;
const DRAG_DISTANCE_THRESHOLD = 6;
const DRAG_CLICK_SUPPRESS_MS = 1000;
// Matches the .overlay-shell padding so the native window hugs the pill plus its
// transparent breathing room on every edge.
const SHELL_PADDING = 4;
// Extra slack on top of the measured pill box. WebKitGTK under-reports the
// scaled (scale 0.87) sub-pixel box of the transformed pill — on XWayland by
// enough to clip both ends of the processing pill, on native Wayland only by a
// few pixels (the orange mode/accent content at the ends read as a clipped
// "shimmer"). 4px was too tight; 12px absorbs the under-report plus border /
// antialiasing without a visible gap (the transparent headroom is click-through
// via .overlay-shell pointer-events:none). See handoff Abschnitt 0/2.
const MEASURE_BUFFER = 12;

type OverlayMotion = "idle" | "entering" | "open" | "leaving";
type OverlaySurface = "compact" | "processing_preview" | "result_actions" | "edit_mode" | "mode_picker";

// Proven per-surface widths, mirrored from OverlaySurface::dimensions() in
// src-tauri/src/lib.rs. Used as a floor under the live measurement: if WebKitGTK
// under-reports the scaled box, the known-good constant still prevents clipping.
const SURFACE_MIN_WIDTH: Record<OverlaySurface, number> = {
  compact: 256,
  processing_preview: 300,
  result_actions: 388,
  edit_mode: 420,
  mode_picker: 256,
};

interface AudioLevelEvent {
  event: string;
  level?: number;
  rms?: number;
  waveform?: number[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function setOverlayDocumentState(idle: boolean) {
  const targets = [document.documentElement, document.body, document.getElementById("root")]
    .filter((node): node is HTMLElement => Boolean(node));

  targets.forEach((node) => {
    node.classList.add("overlay-window");
    node.classList.toggle("overlay-idle", idle);
  });
}

// Derives the processing mode from runtime config as a fallback for the
// initial render before the first `resolve_current_processing_mode` call
// resolves. The overlay's primary source of truth is the Tauri command
// `resolve_current_processing_mode`, kept in sync via `wordscript-mode-event`.
function resolveOverlayProcessingMode(config: AppConfig): ProcessingMode {
  const workMode = resolveTextProfileWorkMode(resolveActiveTextProfile(config));
  const explicit = workMode.processing_mode ?? config.processing_mode;
  if (explicit) return explicit;
  switch (workMode.rewrite_style) {
    case "verbatim": return "verbatim";
    case "polished": return "rewrite";
    default: return "auto";
  }
}

interface ResolvedProcessingContext {
  mode: ProcessingMode;
  is_override: boolean;
  auto_detected: boolean;
  detected_from: string | null;
}

// Collapses the native capture payload into a single perceptual level (0–1) that
// OverlayPill turns into bar heights. The gain mirrors the legacy waveform mapping
// so quiet speech still reads, while genuine room silence settles to the idle
// silhouette (level 0).
function audioPayloadToLevel(payload: AudioLevelEvent): number {
  const level = clamp01(payload.level ?? 0);
  const rms = clamp01(payload.rms ?? level * 0.65);
  const waveformPeak = (payload.waveform ?? []).reduce((peak, sample) => Math.max(peak, clamp01(sample)), 0);

  if (level < 0.022 && waveformPeak < 0.05) {
    return 0;
  }

  return clamp01(Math.max(level * 3.15, rms * 3.45, waveformPeak * 2.2));
}

export default function OverlayWindow() {
  const { state, toggleMute, togglePause } = useRuntime();
  const { status, muted, paused, error } = state;
  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const overlayMotionRef = useRef<OverlayMotion>("idle");
  const overlaySurfaceRef = useRef<OverlaySurface>("compact");
  const shellRef = useRef<HTMLDivElement>(null);
  const dragIntentRef = useRef<{ pointerId: number; startX: number; startY: number; dragged: boolean } | null>(null);
  const movePersistTimeoutRef = useRef<number | null>(null);
  const dragSessionActiveRef = useRef(false);
  const dragSessionEndTimeoutRef = useRef<number | null>(null);
  const autoCloseResultTimerRef = useRef<number | null>(null);
  const autoCloseModePickerTimerRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const suppressMovedPersistenceUntilRef = useRef(0);
  const suppressNextResultActionsRef = useRef(false);
  const lastVisibleSurfaceRef = useRef<OverlaySurface>("compact");
  // `errorHidden` only owns the 4.2 s auto-dismiss of an error pill; it never
  // owns visibility. Error visibility is derived (see `showError` below) so a
  // new trigger atomically hides a previous epoch's error instead of the old
  // hard-priority `showError` blocking the new recording surface.
  const [errorHidden, setErrorHidden] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [overlayMotion, setOverlayMotion] = useState<OverlayMotion>("idle");
  const [actionPending, setActionPending] = useState<"commit" | "abort" | "copy" | "edit" | "insert" | null>(null);
  const [editText, setEditText] = useState("");
  const [showEditMode, setShowEditMode] = useState(false);
  // `occurred_at_ms` of a result that was suppressed by a commit / edit-confirm
  // (those flows intentionally close without showing a result-actions pill).
  // Sticky per-result: unlike the one-shot `suppressNextResultActionsRef`
  // (reset in the lastResult Effect), this stays set until a NEW result arrives,
  // so the `bridgeResultFromStop` hold cannot re-arm in a later render
  // after the ref was reset and briefly flash a suppressed result.
  const [suppressedResultMs, setSuppressedResultMs] = useState<number | null>(null);
  // Mode-select surface — opened by the `mode_picker_hotkey` global shortcut.
  // Reuses the compact pill geometry; the frontend switches the pill into a
  // selector mode via the `wordscript-mode-select` runtime event.
  const [showModePicker, setShowModePicker] = useState(false);
  // Effective processing mode from the Rust runtime (the single source of
  // truth). Fetched via `resolve_current_processing_mode` and kept in sync
  // through `wordscript-mode-event` events.
  const [effectiveMode, setEffectiveMode] = useState<ProcessingMode | null>(null);
  const fetchEffectiveMode = useCallback(async () => {
    try {
      const ctx = await invoke<ResolvedProcessingContext>("resolve_current_processing_mode");
      setEffectiveMode(ctx.mode);
    } catch {
      setEffectiveMode(null);
    }
  }, []);
  // Derived error visibility. Atomic against a new trigger: RECORDING_STARTED
  // clears `error` AND flips `status` to "recording" in a single reducer
  // commit (useRuntime.ts), so this evaluates to false in the SAME render that
  // the recording surface appears. Previously `showError` was independent
  // useState with hard priority over `isRecording` and only reset in the next
  // effect commit, which let a previous epoch's error block the new trigger
  // (plan 1782750354086, Phase 1.1/1.2).
  const showError = Boolean(error) && status === "idle" && !errorHidden;

  const pendingPreviewResult = state.pendingResult;
  const previewResult = state.lastResult;
  const showProcessingPreview = Boolean(isProcessing && pendingPreviewResult && !showError);
  const showResultPreview = Boolean(showPreview && previewResult && status === "idle" && !showError);
  const showAnyPreview = showProcessingPreview || showResultPreview;
  // Mode select is only relevant in idle — during an active session the
  // recording/processing surface wins and the picker is dismissed.
  const renderModePicker = showModePicker && status === "idle" && !showError && !showAnyPreview;
  const overlaySurface: OverlaySurface = showEditMode
    ? "edit_mode"
    : showResultPreview
      ? "result_actions"
      : showProcessingPreview
        ? "processing_preview"
        : renderModePicker
          ? "mode_picker"
          : "compact";
  const holdPreviewDuringClose = !showAnyPreview
    && !showError
    && status === "idle"
    && overlayMotion !== "idle"
    && lastVisibleSurfaceRef.current !== "compact";
  const renderProcessingPreview = showProcessingPreview
    || (holdPreviewDuringClose
      && lastVisibleSurfaceRef.current === "processing_preview"
      && Boolean(pendingPreviewResult));
  // Bridge the stop/commit -> result swap so the pill never hits a
  // pillState=null/unmount gap during the transition. That gap orphaned the
  // previous surface's compositor layers on WebKitGTK and produced the
  // ghosted "processing preview instead of result" / jagged-edges artifact.
  //
  // Covers BOTH in-flight surfaces that lead into a result:
  //   - "processing_preview" (clipboard_only State 05, backend waits on commit)
  //   - "compact"            (auto_paste State 04, direct insert)
  // `holdPreviewDuringClose` excludes "compact" (it is the generic idle/in-flight
  // surface), so the bridge runs on its own idle+open predicate instead.
  //
  // Suppression gate — commit / edit-confirm intentionally close WITHOUT a
  // result. Two windows must be covered:
  //   (1) the render where `transcription` just arrived but the lastResult
  //       Effect hasn't run yet — `suppressNextResultActionsRef` is still true;
  //   (2) every later render — the ref was reset in that Effect, so a sticky
  //       per-result marker `suppressedResultMs` (set to this result's
  //       occurred_at_ms in the Effect) keeps the bridge disarmed. Without the
  //       sticky marker the bridge would re-arm after the reset and flash the
  //       suppressed result for a frame.
  const bridgeResultFromStop =
    status === "idle"
    && !showError
    && !showAnyPreview
    && overlayMotion === "open"
    && !suppressNextResultActionsRef.current
    && previewResult != null
    && previewResult.occurred_at_ms !== suppressedResultMs
    && (lastVisibleSurfaceRef.current === "processing_preview"
      || lastVisibleSurfaceRef.current === "compact");
  const renderResultPreview = showResultPreview
    || (holdPreviewDuringClose
      && (lastVisibleSurfaceRef.current === "result_actions" || lastVisibleSurfaceRef.current === "edit_mode")
      && Boolean(previewResult))
    || bridgeResultFromStop;
  const renderOverlaySurface: OverlaySurface = showEditMode
    ? "edit_mode"
    : renderResultPreview
      ? "result_actions"
      : renderProcessingPreview
        ? "processing_preview"
        : overlaySurface;
  const activePreviewResult = renderProcessingPreview ? pendingPreviewResult : renderResultPreview ? previewResult : null;
  const finalPreviewText = activePreviewResult?.final_text?.trim() ?? "";
  const previewClipboardOnly = activePreviewResult?.work_mode?.insert_behavior === "clipboard_only";

  // Track the ACTUAL rendered surface (incl. held/bridged state) so drag
  // position persistence and native visibility sync agree with what is on
  // screen — not the raw `overlaySurface` which can fall back to "compact"
  // during a held/bridged render.
  overlaySurfaceRef.current = renderOverlaySurface;

  const applyOverlayMotion = (next: OverlayMotion) => {
    overlayMotionRef.current = next;
    setOverlayMotion(next);
  };

  // Mark html element before first paint so the overlay window stays transparent while idle.
  useLayoutEffect(() => {
    setOverlayDocumentState(true);
    void getCurrentWindow().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
    void getCurrentWebview().setBackgroundColor([0, 0, 0, 0]).catch(() => {});

    return () => {
      const targets = [document.documentElement, document.body, document.getElementById("root")]
        .filter((node): node is HTMLElement => Boolean(node));

      targets.forEach((node) => {
        node.classList.remove("overlay-window");
        node.classList.remove("overlay-idle");
      });
    };
  }, []);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    const unlistenPromise = currentWindow.onMoved(({ payload }) => {
      // Ignore host-driven moves; remembered placement should only follow an active native drag session.
      if (!dragSessionActiveRef.current) {
        return;
      }

      if (Date.now() < suppressMovedPersistenceUntilRef.current) {
        return;
      }

      if (movePersistTimeoutRef.current) {
        window.clearTimeout(movePersistTimeoutRef.current);
      }

      movePersistTimeoutRef.current = window.setTimeout(async () => {
        try {
          const scale = await currentWindow.scaleFactor();
          const logicalX = Math.round(payload.x / Math.max(scale, 1));
          const logicalY = Math.round(payload.y / Math.max(scale, 1));
          await invoke("remember_overlay_manual_position", {
            x: logicalX,
            y: logicalY,
            surface: overlaySurfaceRef.current,
          });
        } catch {
          // Ignore transient move persistence failures during drag.
        }
        // End drag session here so trailing onMoved events after a native drag
        // (where pointerup already fired before the window moved) are still captured.
        dragSessionActiveRef.current = false;
        if (dragSessionEndTimeoutRef.current) {
          window.clearTimeout(dragSessionEndTimeoutRef.current);
          dragSessionEndTimeoutRef.current = null;
        }
      }, 180);
    });

    return () => {
      if (movePersistTimeoutRef.current) {
        window.clearTimeout(movePersistTimeoutRef.current);
        movePersistTimeoutRef.current = null;
      }
      if (dragSessionEndTimeoutRef.current) {
        window.clearTimeout(dragSessionEndTimeoutRef.current);
        dragSessionEndTimeoutRef.current = null;
      }
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const dragIntent = dragIntentRef.current;
      if (!dragIntent || dragIntent.pointerId !== event.pointerId) {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        dragIntentRef.current = null;
        return;
      }

      if (dragIntent.dragged) {
        return;
      }

      const distance = Math.hypot(event.clientX - dragIntent.startX, event.clientY - dragIntent.startY);
      if (distance < DRAG_DISTANCE_THRESHOLD) {
        return;
      }

      dragIntent.dragged = true;
      dragSessionActiveRef.current = true;
      void startDrag().catch(() => {
        dragSessionActiveRef.current = false;
        dragIntentRef.current = null;
      });
    };

    const clearDragIntent = () => {
      if (dragIntentRef.current?.dragged) {
        // On Windows, startDragging() causes WebView2 to fire pointercancel/pointerup
        // immediately (native drag takes pointer ownership), before any onMoved events
        // arrive. Do not clear dragSessionActive here; let the onMoved persist handler
        // clear it after saving the position. A fallback timeout covers the case where
        // onMoved never fires (e.g. window not actually moved).
        if (dragSessionEndTimeoutRef.current) {
          window.clearTimeout(dragSessionEndTimeoutRef.current);
        }
        dragSessionEndTimeoutRef.current = window.setTimeout(() => {
          dragSessionActiveRef.current = false;
          dragSessionEndTimeoutRef.current = null;
        }, 2000);
        suppressNextClickRef.current = true;
        suppressClickUntilRef.current = Date.now() + DRAG_CLICK_SUPPRESS_MS;
      }
      dragIntentRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", clearDragIntent);
    window.addEventListener("pointercancel", clearDragIntent);
    window.addEventListener("blur", clearDragIntent);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", clearDragIntent);
      window.removeEventListener("pointercancel", clearDragIntent);
      window.removeEventListener("blur", clearDragIntent);
    };
  }, []);

  // Auto-dismiss the error pill after 4.2 s. `errorHidden` only suppresses the
  // display; visibility stays derived (see `showError`), so a new trigger
  // atomically hides the error even mid-countdown. Resetting on `error` going
  // null re-arms auto-dismiss for the next error instance.
  useEffect(() => {
    if (!error) {
      setErrorHidden(false);
      return;
    }
    setShowPreview(false);
    const timeout = window.setTimeout(() => setErrorHidden(true), 4200);
    return () => window.clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (!state.pendingResult?.occurred_at_ms) {
      return;
    }

    setActionPending(null);
  }, [state.pendingResult?.occurred_at_ms]);

  useEffect(() => {
    const ms = state.lastResult?.occurred_at_ms;
    if (!ms) {
      return;
    }

    if (suppressNextResultActionsRef.current) {
      suppressNextResultActionsRef.current = false;
      // Mark this result as suppressed so `bridgeResultFromStop` stays
      // disarmed for it across later renders (the one-shot ref would otherwise
      // be reset to false here and let the bridge re-arm).
      setSuppressedResultMs(ms);
      return;
    }

    // A fresh, unsuppressed result — clear any prior suppression marker and
    // surface the result-actions pill.
    setSuppressedResultMs(null);
    setShowPreview(true);
    setShowEditMode(false);
    setEditText("");
    setActionPending(null);
  }, [state.lastResult?.occurred_at_ms]);

  useEffect(() => {
    if (!showResultPreview || actionPending || showEditMode) {
      if (autoCloseResultTimerRef.current) {
        window.clearTimeout(autoCloseResultTimerRef.current);
        autoCloseResultTimerRef.current = null;
      }
      return;
    }

    const autoCloseMs = (state.config?.result_actions_timeout_s ?? 9) * 1000;
    autoCloseResultTimerRef.current = window.setTimeout(() => {
      autoCloseResultTimerRef.current = null;
      setShowPreview(false);
    }, autoCloseMs);

    return () => {
      if (autoCloseResultTimerRef.current) {
        window.clearTimeout(autoCloseResultTimerRef.current);
        autoCloseResultTimerRef.current = null;
      }
    };
  }, [showResultPreview, actionPending, showEditMode, state.config?.result_actions_timeout_s]);

  // Atomic surface reset on session start. The atomic SWAP itself is already
  // guaranteed by the derived/gated visibility used in `pillState`; this effect
  // clears the lingering local interaction flags (so they cannot flash back
  // when the session ends) and cancels the result auto-close timer so a late
  // fire cannot dismiss a future surface (plan Phase 1.3/3.1).
  useEffect(() => {
    if (status === "recording" || (status === "processing" && !pendingPreviewResult)) {
      setShowPreview(false);
      setShowEditMode(false);
      setShowModePicker(false);
      setEditText("");
      setActionPending(null);
      setSuppressedResultMs(null);
      if (autoCloseResultTimerRef.current) {
        window.clearTimeout(autoCloseResultTimerRef.current);
        autoCloseResultTimerRef.current = null;
      }
      if (autoCloseModePickerTimerRef.current) {
        window.clearTimeout(autoCloseModePickerTimerRef.current);
        autoCloseModePickerTimerRef.current = null;
      }
    }
  }, [pendingPreviewResult, status]);

  const isActive =
    status === "recording"
    || status === "processing"
    || showError
    || showAnyPreview
    || renderModePicker
    || bridgeResultFromStop;

  // Dismiss the mode-select surface when the overlay leaves the active state (user
  // dismissed it or lost focus). Prevents a stale picker from reappearing on
  // the next idle phase.
  useEffect(() => {
    if (!isActive) {
      setShowModePicker(false);
    }
  }, [isActive]);

  // Auto-dismiss the mode-select picker after a short idle window so it never
  // stays stuck in a stale state. The timeout resets every time the effective
  // mode changes (cycle press) or the picker reopens.
  useEffect(() => {
    if (!showModePicker) {
      if (autoCloseModePickerTimerRef.current) {
        window.clearTimeout(autoCloseModePickerTimerRef.current);
        autoCloseModePickerTimerRef.current = null;
      }
      return;
    }
    autoCloseModePickerTimerRef.current = window.setTimeout(() => {
      autoCloseModePickerTimerRef.current = null;
      setShowModePicker(false);
    }, (state.config?.mode_select_timeout_s ?? 6) * 1000);
    return () => {
      if (autoCloseModePickerTimerRef.current) {
        window.clearTimeout(autoCloseModePickerTimerRef.current);
        autoCloseModePickerTimerRef.current = null;
      }
    };
  }, [showModePicker, effectiveMode]);

  useEffect(() => {
    if (isActive) {
      lastVisibleSurfaceRef.current = overlaySurface;
    }
  }, [isActive, overlaySurface]);

  useEffect(() => {
    if (isActive) {
      suppressMovedPersistenceUntilRef.current = Date.now() + 420;
      void invoke("sync_overlay_window_visibility", { visible: true, surface: overlaySurface }).catch(() => {});
      void getCurrentWindow().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
      void getCurrentWebview().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
      setOverlayDocumentState(false);
      // Trigger-during-leave guarantee (plan Phase 2): a new trigger arriving
      // while the overlay is mid-"leaving" flips isActive back to true and
      // transitions leaving→entering here directly. The leaving timer is then
      // cancelled by the effect cleanup below (deps include overlayMotion), so
      // the overlay re-enters without an idle/park dip and without flicker.
      if (overlayMotionRef.current !== "open" && overlayMotionRef.current !== "entering") {
        applyOverlayMotion("entering");
      }
    } else {
      if (overlayMotionRef.current === "open" || overlayMotionRef.current === "entering") {
        applyOverlayMotion("leaving");
      }
    }
  }, [isActive, overlaySurface]);

  // WebKitGTK can fire animationend too early on filtered/transformed layers.
  // Drive the state machine from the known animation durations instead.
  useEffect(() => {
    if (overlayMotion === "entering") {
      const timeout = window.setTimeout(() => {
        if (overlayMotionRef.current !== "entering") return;
        applyOverlayMotion(isActive ? "open" : "leaving");
      }, OVERLAY_ENTER_MS);

      return () => window.clearTimeout(timeout);
    }

    if (overlayMotion === "leaving") {
      const timeout = window.setTimeout(() => {
        if (overlayMotionRef.current !== "leaving") return;
        setOverlayDocumentState(true);
        suppressMovedPersistenceUntilRef.current = Date.now() + 420;
        void invoke("sync_overlay_window_visibility", { visible: false, surface: "compact" satisfies OverlaySurface }).catch(() => {});
        applyOverlayMotion("idle");
      }, OVERLAY_LEAVE_MS);

      return () => window.clearTimeout(timeout);
    }
  }, [isActive, overlayMotion, overlaySurface]);

  // Fallback from local config for the very first render before the Tauri
  // command resolves. Once effectiveMode is populated it becomes the sole
  // source of truth.
  const configFallbackMode = useMemo(
    () => (state.config ? resolveOverlayProcessingMode(state.config) : null),
    [state.config],
  );
  const pillMode: OverlayProcessingMode = effectiveMode ?? configFallbackMode ?? "auto";

  // Refs mirroring the effective/fallback mode so the stable mode-select
  // listener can read the current value without re-subscribing every render.
  const effectiveModeRef = useRef(pillMode);
  useEffect(() => { effectiveModeRef.current = pillMode; }, [pillMode]);
  const configFallbackModeRef = useRef(configFallbackMode);
  useEffect(() => { configFallbackModeRef.current = configFallbackMode; }, [configFallbackMode]);

  // Re-fetch effective mode when config changes (e.g. after a settings save
  // that changes the profile default).
  useEffect(() => {
    if (state.config) void fetchEffectiveMode();
  }, [state.config, fetchEffectiveMode]);

  // Fixed per-surface window size. Dynamic pill-based sizing is unreliable on
  // WebKitGTK/GTK: set_size is applied ASYNCHRONOUSLY (one event-loop tick
  // behind), so back-to-back resizes (ResizeObserver) leave the window stuck at
  // the previous, too-small size and clip the pill ends. A fixed size per
  // surface means one set_size on first reveal, then size_changed=false (no
  // further async churn) — the window is stable and never clips. All flat
  // surfaces share one size (wide enough for the widest, result-actions); the
  // pill is centred inside, so compact has transparent side margins. That is
  // acceptable: click-through beneath the window is already a Wayland layer-
  // shell limit (docs/STATUS.md:108), not a sizing concern.
  useLayoutEffect(() => {
    if (!isActive) return;
    if (overlayMotionRef.current === "leaving") return;
    if (dragSessionActiveRef.current) return;
    const surface = overlaySurfaceRef.current;
    const { width, height } =
      surface === "edit_mode"
        ? { width: 460, height: 164 }
        : { width: 440, height: 60 };
    if (import.meta.env.DEV) {
      const pill = shellRef.current?.querySelector<HTMLElement>(".ov-pill-shell");
      console.warn(
        `[ov-dom] surface=${surface} reqW=${width} innerW=${window.innerWidth} innerH=${window.innerHeight} pillOffsetW=${pill?.offsetWidth ?? "n/a"}`,
      );
    }
    void invoke("sync_overlay_window_visibility", {
      visible: true,
      surface,
      width,
      height,
    }).catch(() => {});
  }, [isActive, renderOverlaySurface]);

  // DEV: mirror the native reveal (req/outer/inner window sizes) into the
  // overlay console so window-vs-webview sizing is diagnosable without the
  // terminal (the Rust eprintln goes to the terminal, this goes to devtools).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let unlisten: (() => void) | undefined;
    void listen<unknown>("ov-reveal-debug", (event) => {
      console.warn("[ov-reveal]", JSON.stringify(event.payload));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // Reactive waveform level driven by native capture sample buckets. OverlayPill
  // turns the single level into bar heights.
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    const unlisten = listen<AudioLevelEvent>(RUNTIME_EVENT_CHANNEL, ({ payload }) => {
      if (paused) return;
      if (payload.event === "audio_level" && typeof payload.level === "number") {
        setAudioLevel(audioPayloadToLevel(payload));
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [paused]);

  // Session lifecycle events (aborted, empty, error, recording_started) arrive
  // on the native-event channel, not the wordscript-event channel. Dismiss the
  // mode-select picker whenever one fires so the overlay never lingers in a
  // stale picker state after an abort or a new recording start. This includes
  // the abort hotkey — it emits `aborted` via the native session event path.
  useEffect(() => {
    const unlisten = listen<{ event: string }>("wordscript-native-event", ({ payload }) => {
      if (
        payload.event === "aborted" ||
        payload.event === "empty" ||
        payload.event === "error" ||
        payload.event === "recording_started"
      ) {
        setShowModePicker(false);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Listen for processing-mode events from the Rust runtime so the pill stays
  // in sync when the mode changes from outside the overlay (per-mode hotkey,
  // settings save, overlay cycle, auto-resolution). The effective mode is
  // always re-fetched from the backend to keep a single source of truth.
  useEffect(() => {
    void fetchEffectiveMode();
    const unlisten = listen<unknown>("wordscript-mode-event", () => {
      void fetchEffectiveMode();
    });
    return () => { unlisten.then(fn => fn()); };
  }, [fetchEffectiveMode]);

  // Mode-select hotkey: the Rust runtime emits `wordscript-mode-select` when
  // the configured select shortcut fires. Toggle behavior:
  //   1. If the mode-select surface is closed → open it (shows current mode,
  //      user can tap to cycle or use per-mode hotkeys).
  //   2. If already open → cycle to the next mode (persistent) so rapid
  //      repeated presses walk through the modes without reopening.
  // A ref mirrors `showModePicker` so the stable listener can read the current
  // toggle state without re-subscribing on every render.
  const showModePickerRef = useRef(false);
  useEffect(() => { showModePickerRef.current = showModePicker; }, [showModePicker]);

  useEffect(() => {
    const unlisten = listen<unknown>("wordscript-mode-select", () => {
      if (showModePickerRef.current) {
        // Already open → cycle to the next mode.
        const current = effectiveModeRef.current ?? configFallbackModeRef.current;
        if (!current) return;
        const index = MODE_CYCLE.indexOf(current);
        const next = MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? MODE_CYCLE[0];
        void invoke("set_active_profile_processing_mode", { mode: next })
          .then(() => fetchEffectiveMode())
          .catch(() => {});
      } else {
        // Closed → open the mode-select surface.
        setShowModePicker(true);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [fetchEffectiveMode]);

  // Settle the level when capture is not actively producing sound.
  useEffect(() => {
    if (status !== "recording" || muted || paused) {
      setAudioLevel(0);
    }
  }, [status, muted, paused]);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);
  const sessionActiveRef = useRef(false);

  useEffect(() => {
    const isSessionActive = status === "recording" || status === "processing";

    if (!isSessionActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      sessionActiveRef.current = false;
      setElapsed(0);
      return;
    }

    if (!sessionActiveRef.current) {
      sessionActiveRef.current = true;
      setElapsed(0);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!paused) {
      timerRef.current = window.setInterval(() => setElapsed(s => s + 1), 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, paused]);

  const startDrag = async () => {
    await getCurrentWindow().startDragging();
  };

  const handleOverlayPointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;

    dragIntentRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
    };
  };

  // Capture-phase guard: swallow the click that ends a drag before it can reach
  // any pill button, so dragging the overlay never fires an action.
  const handleInteractiveClickCapture = (event: MouseEvent<HTMLElement>) => {
    const suppressClick = suppressNextClickRef.current && Date.now() < suppressClickUntilRef.current;
    if (!suppressClick) {
      if (Date.now() >= suppressClickUntilRef.current) {
        suppressNextClickRef.current = false;
      }
      return;
    }

    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  // Tap-to-cycle through processing modes straight from the overlay. Uses
  // `set_active_profile_processing_mode` so the change is persisted into the
  // active profile's work_mode (survives restarts) and takes effect
  // immediately via the runtime override. The effective mode is then
  // re-fetched so the pill reflects the backend's resolved state.
  const handleCycleMode = () => {
    const current = effectiveMode ?? configFallbackMode;
    if (!current) return;
    const index = MODE_CYCLE.indexOf(current);
    const next = MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? MODE_CYCLE[0];
    void invoke("set_active_profile_processing_mode", { mode: next })
      .then(() => fetchEffectiveMode())
      .catch(() => {});
  };

  const beginOverlayAction = (action: "commit" | "abort" | "copy" | "edit" | "insert") => {
    setShowPreview(true);
    setActionPending(action);
  };

  const finishOverlayAction = (failed = false) => {
    setActionPending(null);
    if (!failed) {
      setShowPreview(false);
    }
  };

  const handleDismissPreview = () => {
    if (actionPending) return;

    setShowPreview(false);
    setShowEditMode(false);
    setEditText("");
  };

  const handleCommitPreview = async () => {
    if (!pendingPreviewResult || actionPending) return;

    beginOverlayAction("commit");
    suppressNextResultActionsRef.current = true;
    try {
      const result = await invoke<NativeInsertResult>("commit_pending_transcription_preview");
      finishOverlayAction(!result.ok);
      if (!result.ok) {
        suppressNextResultActionsRef.current = false;
      }
    } catch {
      suppressNextResultActionsRef.current = false;
      finishOverlayAction(true);
    }
  };

  const handleAbortPreview = async () => {
    if (!pendingPreviewResult || actionPending) return;

    beginOverlayAction("abort");
    try {
      await invoke("abort_native_session");
      finishOverlayAction();
    } catch {
      finishOverlayAction(true);
    }
  };

  const handleCopyResult = async () => {
    if (!finalPreviewText || actionPending) return;

    beginOverlayAction("copy");
    try {
      const result = await invoke<NativeInsertResult>("insert_text_native", {
        request: {
          text: finalPreviewText,
          source: "overlay_preview_copy",
          corrected: previewResult?.corrected ?? false,
          auto_paste: false,
        },
      });
      finishOverlayAction(!result.ok);
    } catch {
      finishOverlayAction(true);
    }
  };

  const handleEditOpen = () => {
    setEditText(finalPreviewText);
    setShowEditMode(true);
  };

  const handleEditCancel = () => {
    setShowEditMode(false);
    setEditText("");
  };

  const handleEditConfirm = async () => {
    if (!editText.trim() || actionPending) return;

    beginOverlayAction("edit");
    suppressNextResultActionsRef.current = true;
    const isAutoPaste = previewResult?.work_mode?.insert_behavior !== "clipboard_only";
    try {
      const result = await invoke<NativeInsertResult>("insert_text_native", {
        request: {
          text: editText,
          source: "overlay_edit_confirm",
          corrected: false,
          auto_paste: isAutoPaste,
        },
      });
      if (result.ok) {
        setActionPending(null);
        setShowEditMode(false);
        setEditText("");
        setShowPreview(false);
      } else {
        suppressNextResultActionsRef.current = false;
        finishOverlayAction(true);
      }
    } catch {
      suppressNextResultActionsRef.current = false;
      finishOverlayAction(true);
    }
  };

  const handleInsertResult = async () => {
    if (!finalPreviewText || actionPending) return;

    beginOverlayAction("insert");
    try {
      const result = await invoke<NativeInsertResult>("insert_text_native", {
        request: {
          text: finalPreviewText,
          source: "overlay_preview_insert",
          corrected: previewResult?.corrected ?? false,
          auto_paste: true,
        },
      });
      finishOverlayAction(!result.ok);
    } catch {
      finishOverlayAction(true);
    }
  };

  const resultPending: OverlayPendingResult | undefined =
    actionPending === "copy" || actionPending === "edit" || actionPending === "insert"
      ? { action: actionPending, label: actionPending }
      : undefined;
  const previewPending: OverlayPendingPreview | undefined =
    actionPending === "commit"
      ? { action: "commit", label: "commit" }
      : actionPending === "abort"
        ? { action: "abort", label: "abort" }
        : undefined;

  const pillState: OverlayPillState | null = (() => {
    // An active session ALWAYS wins. RECORDING_STARTED flips `status` and
    // clears lastResult/pendingResult/error in one reducer commit, so the
    // recording/processing surface appears in the SAME render that any
    // previous epoch's idle surface (error/result/edit) vanishes — no overlap,
    // no hard-priority block. This reordering is the atomic-swap guarantee
    // (plan 1782750354086, Phase 1.2). All non-session surfaces below are
    // additionally gated on `status === "idle"` (derived) as defense.
    if (renderProcessingPreview && activePreviewResult) {
      return {
        kind: "processing",
        mode: pillMode,
        elapsedSec: elapsed,
        preview: { text: finalPreviewText, clipboardOnly: previewClipboardOnly },
        pending: previewPending,
        onCommit: () => void handleCommitPreview(),
        onAbort: () => void handleAbortPreview(),
        onCycleMode: handleCycleMode,
      };
    }
    if (isRecording) {
      return {
        kind: "recording",
        mode: pillMode,
        muted,
        paused,
        level: audioLevel,
        elapsedSec: elapsed,
        onMuteToggle: () => toggleMute(),
        onPauseToggle: () => togglePause(),
        onCycleMode: handleCycleMode,
      };
    }
    if (isProcessing) {
      return {
        kind: "processing",
        mode: pillMode,
        elapsedSec: elapsed,
        onCycleMode: handleCycleMode,
      };
    }
    // Idle-phase surfaces. Each is gated on `status === "idle"` via the
    // derived `showError`/`showResultPreview` and an explicit idle guard on
    // edit-mode, so a stale local flag can never bleed into a new session.
    if (showError && error) {
      return { kind: "error", message: error };
    }
    if (renderModePicker) {
      // Mode-picker surface: a compact pill showing the current mode chip.
      // Tapping the chip cycles (same handler as in-session), per-mode hotkeys
      // jump directly, and dismissing the overlay closes the picker. Uses its
      // own `kind: "mode-picker"` (not "recording") so the `key={pillState.kind}`
      // remount at `:1042` forces a clean mount on the Picker -> real-recording
      // transition — otherwise the recording pill keeps stale animation/layer
      // state from the picker and ghosts.
      return {
        kind: "mode-picker",
        mode: pillMode,
        onCycleMode: handleCycleMode,
      };
    }
    if (showEditMode && status === "idle" && previewResult) {
      return {
        kind: "edit-mode",
        text: editText,
        onTextChange: setEditText,
        onConfirm: () => void handleEditConfirm(),
        onCancel: handleEditCancel,
      };
    }
    if (renderResultPreview && activePreviewResult) {
      return {
        kind: "result-actions",
        text: finalPreviewText,
        clipboardOnly: previewClipboardOnly,
        autoCloseSec: state.config?.result_actions_timeout_s ?? 9,
        pending: resultPending,
        onCopy: () => void handleCopyResult(),
        onEdit: handleEditOpen,
        onInsert: () => void handleInsertResult(),
        onDismiss: handleDismissPreview,
      };
    }
    return null;
  })();

  // Visual identity epoch: every value that changes the pill's APPEARANCE
  // without necessarily changing its `kind` or `surface`. The mode cycler
  // (`handleCycleMode`) flips `pillMode` but keeps `kind === "recording"`, so a
  // `kind`-only dep would NOT fire — WebKitGTK then keeps the previous mode's
  // cached raster and the new mode overlaps the old one ("jeder neue Mode
  // überlappt das darunterliegende"). `muted`/`paused`/`actionPending`/
  // `showEditMode` likewise change appearance within a kind. Bundling them into
  // one epoch string and keying the native repaint on it forces a reveal
  // (→ flat-height oscillation → backing-store reallocation → full repaint)
  // on EVERY visual change, not just kind/surface swaps.
  const pillVisualEpoch = `${pillState?.kind ?? ""}|${pillMode}|${muted ? "m" : ""}|${paused ? "p" : ""}|${showEditMode ? "e" : ""}|${actionPending ?? ""}|${Boolean(previewClipboardOnly && renderResultPreview)}`;

  // Force a native repaint whenever the pill VISUAL IDENTITY changes — even
  // when the surface AND kind stay the same (mode-cycle within "recording",
  // mute/pause toggles, action-pending spinner). On WebKitGTK/XWayland the
  // React DOM update alone does not invalidate the `.ov-pill-shell` wrapper
  // layer's cached raster, so the previous visual ghosts through. A reveal here
  // triggers reveal_overlay_window → the flat-height oscillation forces a
  // backing-store reallocation → a full repaint that clears the cached raster
  // before the new visual paints. (plan 1782750354086, §5)
  useLayoutEffect(() => {
    if (!isActive) return;
    if (overlayMotionRef.current === "leaving") return;
    if (dragSessionActiveRef.current) return;
    void invoke("sync_overlay_window_visibility", {
      visible: true,
      surface: overlaySurfaceRef.current,
    }).catch(() => {});
  }, [pillVisualEpoch, isActive]);

  return (
    <div
      ref={shellRef}
      className="ov-scope overlay-shell"
      data-motion={overlayMotion}
      onPointerDownCapture={handleOverlayPointerDownCapture}
      onClickCapture={handleInteractiveClickCapture}
    >
      {pillState && (
        // .ov-pill-shell is a persistent wrapper: it never unmounts across a
        // surface (kind) change (recording→processing→result→error), only the
        // inner <OverlayPill> subtree swaps. The compositor layer that the
        // visual scale promotes therefore belongs to this stable element, not
        // to .pill.
        //
        // The `key={pillState.kind}` forces React to FULLY remount the
        // <OverlayPill> subtree on every surface change. On WebKitGTK/XWayland
        // the previous surface's animated children (ov-shimmer bars, ov-spin
        // spinner) are promoted to their own compositor layers; without a
        // remount those layers orphan and ghost behind the new surface
        // ("alte States verschwinden verzögert"). A keyed remount unmounts
        // those children (releasing their layers) and mounts fresh ones.
        // Combined with the native 1px backing-store reallocation in
        // reveal_overlay_window this gives a deterministic clear-before-paint
        // swap. (plan 1782750354086, §5 follow-up)
        <div className="ov-pill-shell">
          <OverlayPill key={pillState.kind} state={pillState} />
        </div>
      )}
    </div>
  );
}
