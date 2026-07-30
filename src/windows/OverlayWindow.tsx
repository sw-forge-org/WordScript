import { type MouseEvent, type PointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
// requestAnimationFrame is provided by the browser (WebKitGTK). In tests where
// rAF is not installed, fall back to setTimeout(0). The dispatcher below also
// re-checks `document.visibilityState` per the plan's R1 mitigation: in
// decorationless transparent overlay windows WebKitGTK can pause rAF when it
// classifies the window as not-visible even though it is on-screen.
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
// How long after the last drag signal the drag session is considered over. Long
// enough that a slow drag's `onMoved` debounce (180 ms) keeps re-arming it, and
// bounded so a drag whose pointer-end never reaches the webview still releases.
const DRAG_SESSION_END_GRACE_MS = 2000;
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

// A queued native reveal request. All three `sync_overlay_window_visibility`
// sources (the isActive surface effect, the per-surface size layoutEffect, and
// the pillVisualEpoch repaint layoutEffect) go through `scheduleReveal` so the
// latest surface + width/height within one synchronous tick wins and only ONE
// native `set_size` is dispatched per frame. This is the frontend-side fix for
// RC1 (three competing reveal sources) and RC3 (no coalescing on the Rust
// side). The `visible: false` (park) path is NOT routed through here — it
// fires deterministically at the end of the leave timer and does not race with
// reveal sources.
type RevealRequest = {
  surface: OverlaySurface;
  width?: number;
  height?: number;
};

// Proven per-surface widths, mirrored from OverlaySurface::dimensions() in
// src-tauri/src/lib.rs. Used as a floor under the live measurement: if WebKitGTK
// under-reports the scaled box, the known-good constant still prevents clipping.
const SURFACE_MIN_WIDTH: Record<OverlaySurface, number> = {
  compact: 480,
  processing_preview: 480,
  result_actions: 480,
  edit_mode: 420,
  mode_picker: 480,
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

// DEV-only diagnostic log (plan 1784433288646, Phase 1.2). Writes to both the
// browser console and the Rust-side /tmp/kilo/overlay-diag.log via
// `append_diag_log`. The Settings-Window Diagnose-Panel polls that file for
// live display. Never blocks the render or reveal path. In production
// (import.meta.env.DEV === false) this is a no-op.
//
// Every line carries a monotonic sequence number. The log is read to decide
// whether an effect ran at all — a missing `[ov-repaint]` next to its
// `[ov-sched]` is the difference between "the effect was skipped" and "the
// write was lost". Without the counter those two are indistinguishable, and the
// previous fire-and-forget `invoke` per line made losing or reordering one
// entirely possible: concurrent Tauri commands are not ordered against each
// other. A gap in `#n` now makes a lost line visible instead of silent.
//
// Lines are buffered and flushed per synchronous run in one command. That
// collapses the per-line IPC round trip that made per-render tracing expensive
// enough to distort what it measures (see RENDER_TRACE_ENABLED below).
//
// The flush is a MICROTASK, not `requestAnimationFrame`, for the same reason
// `scheduleReveal` is: WebKitGTK can pause rAF when it classifies the
// decorationless transparent overlay as not-visible, and one window this log has
// to be trusted in is exactly the leave, where that classification is likely.
// A paused rAF would hold lines in the buffer until the next wake — the log
// would go quiet precisely where it is being read. Microtasks always run.
//
// The cost is that a commit's layout-effect lines and its passive-effect lines
// land in two batches, and separate Tauri commands are not ordered against each
// other. `#n` is what makes that recoverable: emit order is in the line, so
// analysis sorts by it and a gap still means a lost write.
//
// `console.debug` rather than `console.warn`: at the overlay's ~24 Hz render
// rate a warn-level line per render is expensive once an inspector is attached,
// and this is trace output, not a warning.
let diagSeq = 0;
let diagPending: string[] = [];
let diagFlushScheduled = false;

function flushDiagLog() {
  diagFlushScheduled = false;
  if (diagPending.length === 0) return;
  const lines = diagPending;
  diagPending = [];
  void invoke("append_diag_log", { lines }).catch(() => {});
}

function diagLog(line: string) {
  if (!import.meta.env.DEV) return;
  const stamped = `#${++diagSeq} ${line}`;
  console.debug(stamped);
  diagPending.push(stamped);
  if (diagFlushScheduled) return;
  diagFlushScheduled = true;
  queueMicrotask(flushDiagLog);
}

// Per-render tracing is opt-in even in dev builds (see
// docs/known-issues/overlay-recording-freeze.md). It fires on every commit,
// which during a capture used to mean one extra IPC round trip per audio_level
// event — enough load that it could plausibly cause the very main-thread stall
// it is meant to observe. The per-frame batching above removes most of that
// cost, but the flag stays opt-in: the freeze it was blamed for is still open,
// and turning it on by default would fold a diagnostic into the very path under
// investigation. Enable with `WORDSCRIPT_OVERLAY_RENDER_TRACE=1` in the
// environment `npm run tauri dev` inherits.
const RENDER_TRACE_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE === "1";

// Main-thread heartbeat. A blocked WebKit main thread cannot run this interval
// on time, so an actual delay far above HEARTBEAT_INTERVAL_MS is direct proof
// of a stall — and it is exactly what distinguishes a real freeze from the
// overlay legitimately not re-rendering because the input was silent.
const HEARTBEAT_INTERVAL_MS = 250;
const HEARTBEAT_REPORT_THRESHOLD_MS = 400;

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
  const lastVisibleSurfaceRef = useRef<OverlaySurface>("compact");
  // Whether the open edit surface was entered from the pre-delivery preview
  // (clipboard_only) rather than from the post-delivery result surface. Set
  // once when the edit opens, because that is when the user's intent is fixed.
  const editFromPreviewRef = useRef(false);
  // Snapshot of the last LIVE Processing-Preview content (final text +
  // clipboardOnly). A clipboard_only commit closes WITHOUT a result surface
  // (the runtime reports `delivery: "clipboard"`, so `resultSurfaceOpen` stays
  // false), which leaves the processing_preview surface with no hold: the
  // commit consumes `pendingResult`, `renderProcessingPreview`'s hold (which
  // required `pendingPreviewResult`) fails, and the pill falls through to
  // `pillState=null` — an unmount gap that orphaned the previous surface's
  // compositor layers on WebKitGTK and produced the ghosted "square pill /
  // jagged edges" artifact (plan P2). This snapshot feeds a STATIC processing
  // hold during `overlayMotion==="leaving"` so the surface stays painted
  // (without spinner / pending) until the clean idle unmount. (plan P2, Opt A)
  const lastProcessingPreviewSnapshotRef = useRef<{ text: string; clipboardOnly: boolean } | null>(null);
  // Frozen frame for the edit-surface leave hold, so clearing the live
  // `editText` cannot pull the surface out mid-fade (see `renderEditHold`).
  const lastEditTextSnapshotRef = useRef<string | null>(null);
  // `errorHidden` only owns the 4.2 s auto-dismiss of an error pill; it never
  // owns visibility. Error visibility is derived (see `showError` below) so a
  // new trigger atomically hides a previous epoch's error instead of the old
  // hard-priority `showError` blocking the new recording surface.
  const [errorHidden, setErrorHidden] = useState(false);
  // Whether the USER (or the auto-close timer) has closed the result surface
  // for the current result. Whether the surface belongs on screen at all is
  // NOT decided here — that is `state.resultSurfaceOpen`, set atomically with
  // `status: "idle"` in the runtime reducer. Splitting the two is what removes
  // the render in which the session has ended but no surface has claimed the
  // pill yet; that render was the only reason the old `bridgeResultFromStop`
  // predicate existed, and it only ever occurred on the auto_paste path.
  const [resultDismissed, setResultDismissed] = useState(false);
  const [overlayMotion, setOverlayMotion] = useState<OverlayMotion>("idle");
  const [actionPending, setActionPending] = useState<"commit" | "abort" | "copy" | "edit" | "insert" | null>(null);
  const [editText, setEditText] = useState("");
  const [showEditMode, setShowEditMode] = useState(false);
  // Mode-select surface — opened by the `mode_picker_hotkey` global shortcut.
  // Reuses the compact pill geometry; the frontend switches the pill into a
  // selector mode via the `wordscript-mode-select` runtime event.
  const [showModePicker, setShowModePicker] = useState(false);
  // Effective processing mode from the Rust runtime (the single source of
  // truth). Fetched via `resolve_current_processing_mode` and kept in sync
  // through `wordscript-mode-event` events.
  const [effectiveMode, setEffectiveMode] = useState<ProcessingMode | null>(null);
  // Debounce guard: a single mode tap triggers up to FOUR redundant
  // fetchEffectiveMode calls across different event paths:
  //   1. handleCycleMode's .then(() => fetchEffectiveMode())
  //   2. set_active_profile_processing_mode emits `ready` → state.config
  //      changes → the [state.config] effect fires fetchEffectiveMode
  //   3. set_active_profile_processing_mode emits `ready` → state.config
  //      changes → configFallbackMode recomputes (another render)
  //   4. (per-mode hotkey only) wordscript-mode-event listener fires
  //      fetchEffectiveMode
  // Each fetchEffectiveMode → setEffectiveMode is a separate React render
  // commit. With `transform: scale(0.87)` on .ov-pill-shell, WebKitGTK caches
  // the compositor layer between commits and can briefly paint two pill
  // geometries when commits arrive in rapid succession (the ghosting).
  // Collapsing all fetches within a 150ms window into a SINGLE setEffectiveMode
  // commit eliminates the multi-render cascade → one geometry → no ghost.
  const lastModeFetchRef = useRef(0);
  const fetchEffectiveMode = useCallback(async () => {
    const now = Date.now();
    if (now - lastModeFetchRef.current < 150) return; // skip redundant refetch within debounce window
    lastModeFetchRef.current = now;
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
  const showResultPreview = Boolean(
    state.resultSurfaceOpen && !resultDismissed && previewResult && status === "idle" && !showError,
  );
  const showAnyPreview = showProcessingPreview || showResultPreview;
  // Mode select is only relevant in idle — during an active session the
  // recording/processing surface wins and the picker is dismissed.
  const renderModePicker = showModePicker && status === "idle" && !showError && !showAnyPreview;
  // Edit mode is reachable from BOTH decision surfaces, and each one owns a
  // different source of truth for the text. Gating on that source keeps the
  // atomic-swap guarantee: a new session nulls `pendingResult`/`lastResult` in
  // one reducer commit, so the edit surface cannot survive into it even before
  // the local flag reset effect runs.
  const editSourceAvailable = editFromPreviewRef.current
    ? Boolean(isProcessing && pendingPreviewResult)
    : Boolean(status === "idle" && previewResult);
  const showEditSurface = showEditMode && editSourceAvailable && !showError;
  // The LIVE surface: what the runtime state says belongs on screen right now.
  // Every input is derived from the same reducer commit, so this never lags a
  // render behind the session state.
  const liveSurface: OverlaySurface = showEditSurface
    ? "edit_mode"
    : showResultPreview
      ? "result_actions"
      : showProcessingPreview
        ? "processing_preview"
        : renderModePicker
          ? "mode_picker"
          : "compact";
  // The leave animation is the ONLY reason the rendered surface may differ from
  // the live one: while the pill fades out, the surface it was showing must
  // keep painting. Without the hold the pill would fall to `pillState=null`,
  // and an unmount orphans the outgoing subtree's compositor layers on
  // WebKitGTK — the ghosting mechanism in docs/known-issues/overlay-ghosting.md.
  //
  // The `!== "compact"` clause deliberately gives a compact surface no hold:
  // there is nothing worth replaying for an abort or an empty capture, and a
  // held processing pill would keep painting a live spinner over them. It is
  // NOT a defence for the compact→result_actions transition — that used to fall
  // through this hole when the native completion sync ended the session one
  // commit early. The session now ends in exactly one commit, together with the
  // surface that reports it (ADR 0018), so no render arrives here without a
  // surface in the first place.
  const holdPreviewDuringClose = !showAnyPreview
    && !showError
    && status === "idle"
    && overlayMotion !== "idle"
    && lastVisibleSurfaceRef.current !== "compact";
  const renderProcessingPreview = showProcessingPreview
    || (holdPreviewDuringClose
      && lastVisibleSurfaceRef.current === "processing_preview"
      && (Boolean(pendingPreviewResult) || lastProcessingPreviewSnapshotRef.current != null));
  const renderResultPreview = showResultPreview
    || (holdPreviewDuringClose
      && lastVisibleSurfaceRef.current === "result_actions"
      && Boolean(previewResult));
  // The hold replays the surface that is actually leaving. An edit surface that
  // closes must keep painting the edit surface — replaying result-actions here
  // (as it did while edit_mode shared the result hold) flashes a surface this
  // session never showed, for the full 240 ms of the leave.
  //
  // The text comes from the snapshot once the live `editText` is gone, the same
  // way the processing hold reads `lastProcessingPreviewSnapshotRef`. Keying the
  // hold on the live state made it collapse one commit into the fade: a
  // confirmed edit ends the session, the new `lastResult` fires the
  // interaction-reset effect, that clears `editText`, and the hold's own
  // condition went false while the overlay was still visibly fading — measured
  // in 4 of 5 edit closes as `surface=edit_mode` at the `motion=open` commit and
  // `surface=compact` at the `motion=leaving` commit right after. Unmounting a
  // surface mid-fade is the orphaned-layer mechanism in
  // docs/known-issues/overlay-ghosting.md.
  const editHoldText = editText.trim().length > 0
    ? editText
    : (lastEditTextSnapshotRef.current ?? "");
  const renderEditHold = holdPreviewDuringClose
    && lastVisibleSurfaceRef.current === "edit_mode"
    && editHoldText.trim().length > 0;
  const renderOverlaySurface: OverlaySurface = showEditSurface || renderEditHold
    ? "edit_mode"
    : renderResultPreview
      ? "result_actions"
      : renderProcessingPreview
        ? "processing_preview"
        : liveSurface;
  const activePreviewResult = renderProcessingPreview ? pendingPreviewResult : renderResultPreview ? previewResult : null;
  // When the processing surface is held only by the snapshot (the commit has
  // already consumed `pendingResult`), read the held content from the snapshot
  // instead of the now-null `activePreviewResult`. Only relevant during
  // `overlayMotion!=="idle"`; harmless otherwise (the hold predicate gates it).
  const processingHoldSnapshot = renderProcessingPreview && !pendingPreviewResult
    ? lastProcessingPreviewSnapshotRef.current
    : null;
  const finalPreviewText = (activePreviewResult?.final_text?.trim() ?? "")
    || (processingHoldSnapshot ? processingHoldSnapshot.text : "");
  const previewClipboardOnly = activePreviewResult?.work_mode?.insert_behavior === "clipboard_only"
    ? true
    : activePreviewResult?.delivery === "clipboard"
      ? true
      : processingHoldSnapshot ? processingHoldSnapshot.clipboardOnly : false;

  // Capture the live Processing-Preview content while it is genuinely active so
  // the leaving-hold has a frozen frame to paint. Written during render (same
  // pattern as `overlaySurfaceRef.current` above); only updates on the live
  // surface, so the last value survives the commit that clears `pendingResult`.
  if (showProcessingPreview) {
    lastProcessingPreviewSnapshotRef.current = {
      text: finalPreviewText,
      clipboardOnly: previewClipboardOnly,
    };
  }

  // Same for the edit surface. Only while it is genuinely live, so the last
  // value survives the commit that clears `editText`.
  if (showEditSurface) {
    lastEditTextSnapshotRef.current = editText;
  }

  // ONE surface value for everything that leaves this component: drag position
  // persistence, `lastVisibleSurfaceRef`, and every native reveal. Rust must
  // never be told a different surface than the one being painted — with
  // per-surface window geometry that is a sizing bug, and it was only harmless
  // before because every flat surface happens to be 480x60
  // (`OverlaySurface::dimensions()`).
  overlaySurfaceRef.current = renderOverlaySurface;

  const applyOverlayMotion = (next: OverlayMotion) => {
    overlayMotionRef.current = next;
    setOverlayMotion(next);
  };

  // ── Reveal serializer (D1, plan 1784412908352; A2, plan 1784429726777) ──────
  // All `sync_overlay_window_visibility` "visible:true" calls go through this
  // dispatcher. Within one synchronous tick, multiple sources (the isActive
  // surface effect, the per-surface size layoutEffect, and the pillVisualEpoch
  // repaint layoutEffect) can each request a reveal — e.g. on a mode change
  // during recording, where the surface stays "compact" but `pillVisualEpoch`
  // and the size layoutEffect both re-evaluate. Without coalescing, each
  // request fires a separate native `set_size` with a different
  // `OVERLAY_FLAT_REVEAL_TICK` value, and WebKitGTK/XWayland applies async
  // `set_size` calls out of order → the window lands at the wrong height and a
  // ghost of the previous geometry overlaps the new one (RC1 + RC3).
  //
  // A2 (plan 1784429726777, Subagent A — NI1): the flush is scheduled via
  // `queueMicrotask` instead of `requestAnimationFrame`. rAF deferred the
  // native `set_size` to the NEXT frame: React committed the new DOM in frame
  // N, the browser painted the new content onto the OLD backing store, then
  // the rAF callback in frame N+1 triggered `set_size` with an oscillated
  // height → backing-store reallocation → the just-painted content was
  // discarded → black flash. Microtasks run after the current synchronous work
  // (React commit + useLayoutEffect callbacks) but BEFORE the browser paints,
  // so the native `set_size` is dispatched in the same frame as the new DOM
  // commit → no backing-store reallocation after paint → no black flash. This
  // also eliminates R1 (rAF can pause when WebKitGTK classifies a decorationless
  // transparent overlay as not-visible): microtasks always run regardless of
  // visibility state.
  const pendingRevealRef = useRef<RevealRequest | null>(null);
  const revealScheduledRef = useRef(false);
  const scheduleReveal = useCallback((req: RevealRequest) => {
    pendingRevealRef.current = req; // latest-wins, overwrites any prior request in the same tick
    diagLog(`[ov-sched] schedule surface=${req.surface} w=${req.width ?? "-"} h=${req.height ?? "-"} t=${Date.now()}`);
    if (revealScheduledRef.current) return;
    revealScheduledRef.current = true;
    const flush = () => {
      revealScheduledRef.current = false;
      const r = pendingRevealRef.current;
      pendingRevealRef.current = null;
      if (!r) return;
      diagLog(`[ov-sched] flush surface=${r.surface} w=${r.width ?? "-"} h=${r.height ?? "-"} t=${Date.now()}`);
      void invoke("sync_overlay_window_visibility", {
        visible: true,
        surface: r.surface,
        ...(r.width != null ? { width: r.width } : {}),
        ...(r.height != null ? { height: r.height } : {}),
      }).catch(() => {});
    };
    // A2: microtask flush. Runs after the current synchronous work (React
    // commit + layout effects) but before the browser paints → the native
    // set_size lands in the same frame as the new DOM. Coalescing is preserved
    // because `revealScheduledRef` stays true until the microtask runs, so
    // multiple scheduleReveal calls in the same tick collapse into one invoke.
    queueMicrotask(flush);
  }, []);

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

  // Ends the drag session once the moves stop. Every caller RE-ARMS rather than
  // cancels, so a long drag keeps pushing the deadline out while a finished one
  // always releases the session. `dragSessionActiveRef` gates both overlay
  // layout effects, so a session that never ends silently disables the
  // per-surface size sync and the visual-epoch repaint for the rest of the
  // process.
  const armDragSessionEnd = useCallback(() => {
    if (dragSessionEndTimeoutRef.current) {
      window.clearTimeout(dragSessionEndTimeoutRef.current);
    }
    dragSessionEndTimeoutRef.current = window.setTimeout(() => {
      dragSessionActiveRef.current = false;
      dragSessionEndTimeoutRef.current = null;
    }, DRAG_SESSION_END_GRACE_MS);
  }, []);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    const unlistenPromise = currentWindow.onMoved(({ payload }) => {
      // Ignore host-driven moves; remembered placement should only follow an active native drag session.
      if (!dragSessionActiveRef.current) {
        return;
      }

      // Suppress host-driven moves (reveal repositioning) for a short grace
      // window after reveal/park so they are not mistaken for a user drag.
      // BUT: once a real drag has started (`dragIntentRef` is set, meaning
      // pointerdown happened), user drag moves take priority over the grace
      // suppression. Without this, a fast drag started within the 420ms
      // reveal grace had its first onMoved events silently dropped, so the
      // drag position was never persisted (K2, see
      // docs/BUG_OVERLAY_PLACEMENT_PERSIST.md).
      if (Date.now() < suppressMovedPersistenceUntilRef.current && !dragIntentRef.current) {
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
        // NOTE: do NOT clear `dragSessionActiveRef` here. The session is
        // ended by `clearDragIntent` (pointerup/pointercancel/blur) plus a
        // grace timeout. Clearing it here — as the old code did — meant that
        // after the FIRST 180ms debounce during a long drag, all subsequent
        // `onMoved` events were silently dropped (the guard at the top of
        // this handler rejected them), so only an early intermediate
        // position was persisted instead of the final drag end position.
        // That was the root cause of "overlay placement is not always
        // saved" (see docs/BUG_OVERLAY_PLACEMENT_PERSIST.md, K1).
        //
        // RE-ARM, never cancel. This used to clear the grace timeout outright,
        // which left `dragSessionActiveRef` stuck at true for the rest of the
        // process: `clearDragIntent` only ARMS that timeout, so cancelling it
        // removed the one path that ever ends a drag session. Both overlay
        // layout effects bail on `dragSessionActiveRef`, so from the first drag
        // onwards the per-surface size sync and the visual-epoch repaint were
        // dead — and with them the only native repaint trigger for a same-kind
        // visual change such as a mode cycle. Re-arming keeps K1 intact (a long
        // drag keeps pushing the deadline out) while still ending the session
        // once the moves stop.
        armDragSessionEnd();
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
  }, [armDragSessionEnd]);

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
        // arrive. Do not clear dragSessionActive here; the onMoved persist handler
        // still needs the session alive to save the final position. It re-arms the
        // same deadline on every persist, so this arming also covers the case where
        // onMoved never fires (e.g. window not actually moved).
        armDragSessionEnd();
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
  }, [armDragSessionEnd]);

  // Auto-dismiss the error pill after 4.2 s. `errorHidden` only suppresses the
  // display; visibility stays derived (see `showError`), so a new trigger
  // atomically hides the error even mid-countdown. Resetting on `error` going
  // null re-arms auto-dismiss for the next error instance.
  useEffect(() => {
    if (!error) {
      setErrorHidden(false);
      return;
    }
    const timeout = window.setTimeout(() => setErrorHidden(true), 4200);
    return () => window.clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (!state.pendingResult?.occurred_at_ms) {
      return;
    }

    setActionPending(null);
  }, [state.pendingResult?.occurred_at_ms]);

  // A fresh result clears the interaction flags of the previous one. Whether
  // the result surface opens is NOT decided here — the reducer already decided
  // it from `delivery` in the same commit that delivered the result. This
  // effect must therefore never gate visibility, only reset local state.
  useEffect(() => {
    if (!state.lastResult?.occurred_at_ms) {
      return;
    }

    setResultDismissed(false);
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
      setResultDismissed(true);
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
      setResultDismissed(false);
      setShowEditMode(false);
      setShowModePicker(false);
      setEditText("");
      setActionPending(null);
      lastProcessingPreviewSnapshotRef.current = null;
      lastEditTextSnapshotRef.current = null;
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
    || renderModePicker;

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

  // Remember the LIVE surface, not the rendered one: during the leave hold the
  // rendered surface is a replay of this value, so feeding it back would pin
  // the hold to itself instead of to the last surface the session really had.
  useEffect(() => {
    if (isActive) {
      lastVisibleSurfaceRef.current = liveSurface;
    }
  }, [isActive, liveSurface]);

  useEffect(() => {
    if (isActive) {
      suppressMovedPersistenceUntilRef.current = Date.now() + 420;
      // D1: route through scheduleReveal so this reveal coalesces with the
      // per-surface size layoutEffect and the pillVisualEpoch repaint
      // layoutEffect when they fire in the same frame (e.g. mode change during
      // recording). The previous direct invoke raced with those sources and
      // produced 2–3 set_size calls per frame with different reveal ticks.
      scheduleReveal({ surface: overlaySurfaceRef.current });
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
  }, [isActive, renderOverlaySurface]);

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
  }, [isActive, overlayMotion, renderOverlaySurface]);

  // Fallback from local config for the very first render before the Tauri
  // command resolves. Once effectiveMode is populated it becomes the sole
  // source of truth.
  const configFallbackMode = useMemo(
    () => (state.config ? resolveOverlayProcessingMode(state.config) : null),
    [state.config],
  );
  const pillMode: OverlayProcessingMode = effectiveMode ?? configFallbackMode ?? "auto";

  // [ov-render] (plan 1784433288646, Phase 1.2): per-commit diagnostic of the
  // mode resolution + surface + motion state. Confirms one pillMode step per
  // tap (disproving NI2/NI4) and shows the render context per commit.
  //
  // Runs in an effect rather than in the render body: an effect fires once per
  // commit, which is what this claims to measure, whereas the render body also
  // fires on discarded renders and twice under StrictMode. Opt-in via
  // RENDER_TRACE_ENABLED — see the note there on measurement cost.
  useEffect(() => {
    if (!RENDER_TRACE_ENABLED) return;
    diagLog(`[ov-render] pillMode=${pillMode} eff=${effectiveMode ?? "null"} fb=${configFallbackMode ?? "null"} live=${liveSurface} surface=${renderOverlaySurface} motion=${overlayMotion} active=${isActive}`);
  });

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
        : { width: 480, height: 60 };
    if (import.meta.env.DEV) {
      const pill = shellRef.current?.querySelector<HTMLElement>(".ov-pill-shell");
      diagLog(
        `[ov-dom] surface=${surface} reqW=${width} innerW=${window.innerWidth} innerH=${window.innerHeight} pillOffsetW=${pill?.offsetWidth ?? "n/a"}`,
      );
    }
    // D1: route through scheduleReveal with the explicit width/height
    // overrides. If the isActive surface effect or the pillVisualEpoch repaint
    // also fired this frame, this request's width/height wins as the latest
    // pending request and only one native set_size is dispatched.
    scheduleReveal({ surface, width, height });
  }, [isActive, renderOverlaySurface, scheduleReveal]);

  // DEV: mirror the native reveal (req/outer/inner window sizes) into the
  // overlay console so window-vs-webview sizing is diagnosable without the
  // terminal (the Rust eprintln goes to the terminal, this goes to devtools).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let unlisten: (() => void) | undefined;
    void listen<unknown>("ov-reveal-debug", (event) => {
      diagLog(`[ov-reveal] ${JSON.stringify(event.payload)}`);
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

  // [ov-beat]: main-thread heartbeat for the overlay-recording-freeze
  // investigation (docs/known-issues/overlay-recording-freeze.md).
  //
  // Logs only when an interval lands late — a quiet log means a healthy main
  // thread, so the diagnostic costs nothing in the normal case. A reported gap
  // is the discriminator the existing telemetry lacks: if the render rate drops
  // without a gap here, the overlay was idle because the input was silent, not
  // frozen.
  //
  // It also covers `overlayMotion !== "idle"`, not just an active session,
  // because the leave window is where the measured anomaly sits: the
  // `leaving -> idle` transition was observed never to run on its own 240 ms
  // timer, arriving instead with the NEXT activation (1.2 s, 61.6 s, 258.0 s in
  // three consecutive closes). If the main thread is suspended there, the
  // interval cannot fire either and reports the whole gap as one delta on wake
  // — which is what distinguishes a throttled webview from a timer that was
  // cleared or guarded away. `motion` is in the line for the same reason: the
  // phase is what identifies the window.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const isSessionActive = status === "recording" || status === "processing";
    if (!isSessionActive && overlayMotion === "idle") return;

    let previous = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      if (delta >= HEARTBEAT_REPORT_THRESHOLD_MS) {
        diagLog(
          `[ov-beat] stalled_ms=${Math.round(delta)} expected_ms=${HEARTBEAT_INTERVAL_MS} status=${status} motion=${overlayMotion}`,
        );
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [status, overlayMotion]);

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
    const unlisten = listen<{ event?: string }>("wordscript-mode-select", (payload) => {
      // `show` comes from a per-mode hotkey: the mode is already set, so only
      // reveal the surface to confirm it. Cycling here would move the user off
      // the mode they just picked.
      if (payload.payload?.event === "show") {
        void fetchEffectiveMode();
        setShowModePicker(true);
        return;
      }

      if (showModePickerRef.current) {
        // Already open → cycle to the next mode.
        // D2: eager setEffectiveMode so pillMode/pillVisualEpoch update in the
        // same frame as the hotkey press, coalescing the repaint reveal with
        // any size layoutEffect via scheduleReveal (same rationale as
        // handleCycleMode). fetchEffectiveMode in .then confirms/corrects.
        const current = effectiveModeRef.current ?? configFallbackModeRef.current;
        if (!current) return;
        const index = MODE_CYCLE.indexOf(current);
        const next = MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? MODE_CYCLE[0];
        setEffectiveMode(next);
        void invoke("set_active_profile_processing_mode", { mode: next })
          .then(() => fetchEffectiveMode())
          .catch(() => fetchEffectiveMode());
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
  // D2 (plan 1784412908352): the next mode is locally known from MODE_CYCLE,
  // so commit it eagerly via setEffectiveMode in the SAME render as the click.
  // This makes `pillMode` (and therefore `pillVisualEpoch`) update immediately,
  // so the pillVisualEpoch repaint layoutEffect fires in the same frame as the
  // click → coalesces with the size layoutEffect via scheduleReveal into a
  // single native set_size. Without the eager update, `pillMode` stays stale
  // for 1–3 renders until the async fetchEffectiveMode roundtrip resolves,
  // opening a render gap where the new mode content paints into the previous,
  // non-invalidated backing-store rect → ghosting (RC2).
  // `fetchEffectiveMode` in `.then` confirms or corrects the eager value; the
  // `.catch` rolls back to the backend's authoritative state. The async
  // `wordscript-mode-event` listener (for external changes like settings save
  // or auto-resolution) stays purely async — only the user-driven paths use
  // the optimistic update.
  const handleCycleMode = () => {
    const current = effectiveMode ?? configFallbackMode;
    if (!current) return;
    const index = MODE_CYCLE.indexOf(current);
    const next = MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? MODE_CYCLE[0];
    diagLog(`[ov-tap] ${current} -> ${next} t=${Date.now()}`);
    setEffectiveMode(next);
    void invoke("set_active_profile_processing_mode", { mode: next })
      .then(() => fetchEffectiveMode())
      .catch(() => fetchEffectiveMode());
  };

  const beginOverlayAction = (action: "commit" | "abort" | "copy" | "edit" | "insert") => {
    // An action the user just started must not be closed underneath them by a
    // pending auto-close.
    setResultDismissed(false);
    setActionPending(action);
  };

  const finishOverlayAction = (failed = false) => {
    setActionPending(null);
    if (!failed) {
      setResultDismissed(true);
    }
  };

  // Copy is a non-destructive action — it writes to the clipboard but the user
  // may still want to Edit / Insert / Dismiss afterwards. Only clear the pending
  // spinner; keep the result-actions surface visible.
  const finishCopyAction = (failed = false) => {
    setActionPending(null);
    if (failed) {
      setResultDismissed(true);
    }
  };

  const handleDismissPreview = () => {
    if (actionPending) return;

    setResultDismissed(true);
    setShowEditMode(false);
    setEditText("");
  };

  const handleCommitPreview = async () => {
    if (!pendingPreviewResult || actionPending) return;

    beginOverlayAction("commit");
    // No suppression flag is needed here any more: the commit reports
    // `delivery: "clipboard"`, so the reducer keeps `resultSurfaceOpen` false
    // and the result surface is structurally unreachable for this flow.
    // Race the invoke against a 1.5s safety timeout. If the native clipboard
    // write hangs (wl-copy daemon deadlock, compositor race), the invoke
    // Promise never resolves and the spinner stays forever (State 09). The
    // timeout guarantees the pending state is cleared and the user can act
    // again. The invoke continues in the background; if it resolves late the
    // settled guard prevents a double-finish.
    let settled = false;
    const finishSafely = (failed: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(safety);
      finishOverlayAction(failed);
    };
    const safety = window.setTimeout(() => finishSafely(false), 1500);
    try {
      const result = await invoke<NativeInsertResult>("commit_pending_transcription_preview");
      finishSafely(!result.ok);
    } catch {
      finishSafely(true);
    }
  };

  const handleAbortPreview = async () => {
    if (!pendingPreviewResult || actionPending) return;

    beginOverlayAction("abort");
    let settled = false;
    const finishSafely = (failed: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(safety);
      finishOverlayAction(failed);
    };
    const safety = window.setTimeout(() => finishSafely(false), 1500);
    try {
      await invoke("abort_native_session");
      finishSafely(false);
    } catch {
      finishSafely(true);
    }
  };

  const handleCopyResult = async () => {
    if (!finalPreviewText || actionPending) return;

    beginOverlayAction("copy");
    let settled = false;
    const finishSafely = (failed: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(safety);
      finishCopyAction(failed);
    };
    const safety = window.setTimeout(() => finishSafely(false), 1500);
    try {
      const result = await invoke<NativeInsertResult>("insert_text_native", {
        request: {
          text: finalPreviewText,
          source: "overlay_preview_copy",
          corrected: previewResult?.corrected ?? false,
          auto_paste: false,
        },
      });
      finishSafely(!result.ok);
    } catch {
      finishSafely(true);
    }
  };

  const handleEditOpen = () => {
    // Where the edit is opened decides which source has to be live — the same
    // split `editFromPreviewRef` records below. The other two preview actions
    // have always guarded on their source; this one did not, so during the
    // leave hold it could open an edit surface against a preview the runtime
    // had already consumed. Confirming then ran
    // `commit_pending_transcription_preview` against an empty
    // `take_pending_preview()` and failed in the runtime instead of here.
    const fromPreview = renderProcessingPreview;
    if (fromPreview ? !pendingPreviewResult : !previewResult) return;

    setEditText(finalPreviewText);
    // Where the edit was opened decides what confirming can do, and the two are
    // genuinely different actions — see `editFromPreview` below. Captured at
    // open time so a surface change mid-edit cannot silently switch the action
    // under the user.
    editFromPreviewRef.current = fromPreview;
    setShowEditMode(true);
  };

  const handleEditCancel = () => {
    if (actionPending) return;
    setShowEditMode(false);
    setEditText("");
  };

  // Editing BEFORE delivery (clipboard_only preview): the corrected text goes
  // back through the commit, so session completion, history and the insert
  // result all describe the text the user actually got. Editing AFTER delivery
  // (result surface): the original is already at the cursor and cannot be
  // retracted, so the correction can only be offered on the clipboard.
  const handleEditConfirm = async () => {
    if (!editText.trim() || actionPending) return;

    const fromPreview = editFromPreviewRef.current;
    beginOverlayAction("edit");
    let settled = false;
    const finishSafely = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(safety);
      if (ok) {
        setActionPending(null);
        setShowEditMode(false);
        // `editText` is deliberately NOT cleared: the overlay is now leaving,
        // and the leave hold needs the text to keep painting the surface that
        // is fading out. It is reset on the next edit open, the next result and
        // the next session start.
        setResultDismissed(true);
      } else {
        finishOverlayAction(true);
      }
    };
    const safety = window.setTimeout(() => finishSafely(true), 1500);
    try {
      const result = fromPreview
        ? await invoke<NativeInsertResult>("commit_pending_transcription_preview", {
            text: editText,
          })
        : await invoke<NativeInsertResult>("insert_text_native", {
            request: {
              text: editText,
              source: "overlay_edit_confirm",
              corrected: false,
              auto_paste: false,
            },
          });
      finishSafely(result.ok);
    } catch {
      finishSafely(false);
    }
  };

  const handleInsertResult = async () => {
    if (!finalPreviewText || actionPending) return;

    beginOverlayAction("insert");
    let settled = false;
    const finishSafely = (failed: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(safety);
      finishOverlayAction(failed);
    };
    const safety = window.setTimeout(() => finishSafely(false), 1500);
    try {
      const result = await invoke<NativeInsertResult>("insert_text_native", {
        request: {
          text: finalPreviewText,
          source: "overlay_preview_insert",
          corrected: previewResult?.corrected ?? false,
          auto_paste: true,
        },
      });
      finishSafely(!result.ok);
    } catch {
      finishSafely(true);
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
    //
    // Edit mode comes first because it is reachable from BOTH decision
    // surfaces, including the still-processing preview. `showEditSurface`
    // already carries the session gate (it requires the live source the edit
    // was opened from), so an active session still wins.
    if (showEditSurface || renderEditHold) {
      return {
        kind: "edit-mode",
        text: showEditSurface ? editText : editHoldText,
        confirmLabel: editFromPreviewRef.current
          ? (previewClipboardOnly ? "Copy corrected text" : "Insert corrected text")
          : "Copy corrected text",
        // The leave hold is a frozen frame, not an interactive surface.
        busy: showEditSurface && actionPending === "edit",
        onTextChange: showEditSurface ? setEditText : undefined,
        onConfirm: showEditSurface ? () => void handleEditConfirm() : undefined,
        onCancel: showEditSurface ? handleEditCancel : undefined,
      };
    }
    if (renderProcessingPreview && (activePreviewResult || processingHoldSnapshot != null)) {
      return {
        kind: "processing",
        mode: pillMode,
        elapsedSec: elapsed,
        preview: { text: finalPreviewText, clipboardOnly: previewClipboardOnly },
        pending: previewPending,
        // The leave hold is a frozen frame, not an interactive surface — the
        // same rule the edit-mode branch above already follows.
        //
        // `clipboard_only` is the mode this matters in: it never opens a result
        // surface, so `processing_preview` is the only surface it ever has, and
        // its source (`pendingResult`) is exactly what the authoritative
        // transcription nulls. During the hold that follows, the handlers below
        // all early-return on `!pendingPreviewResult` — so wiring them
        // unconditionally rendered a fully enabled "Copy" button that silently
        // did nothing, which is indistinguishable from a frozen overlay for the
        // one delivery mode where the pill is the only route to the transcript.
        onCommit: showProcessingPreview ? () => void handleCommitPreview() : undefined,
        onEdit: showProcessingPreview ? handleEditOpen : undefined,
        onAbort: showProcessingPreview ? () => void handleAbortPreview() : undefined,
        onCycleMode: showProcessingPreview ? handleCycleMode : undefined,
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
  // überlappt das darunterliegende"). `muted`/`paused`/`showEditMode`
  // likewise change appearance within a kind. Bundling them into one epoch
  // string and keying the native repaint on it forces a reveal
  // (→ flat-height oscillation → backing-store reallocation → full repaint)
  // on EVERY visual change, not just kind/surface swaps.
  //
  // EXCLUDED from the epoch: `actionPending`. An action-pending spinner (copy/
  // edit/insert/commit) is an in-place icon swap on a button, not a surface
  // change. Keying a native reveal on it triggers a 1px-height oscillation +
  // set_size → backing-store reallocation → a full repaint that WebKitGTK
  // renders as a brief "another overlay state pops up" flash on top of the
  // current result-actions surface. The opaque --ov-surface already blocks
  // ghosting, so the spinner swap does not need a native repaint.
  //
  // `previewClipboardOnly` counts on BOTH decision surfaces, not just on
  // result-actions. On the processing preview the same flag swaps the primary
  // button between Copy (`Clipboard`) and Insert (`CornerDownLeft`) and toggles
  // the `pill--clipboard` class (OverlayPill.tsx, `PreviewActions`) — a visual
  // identity change of exactly the kind this epoch exists to catch. Scoping it
  // to `renderResultPreview` left the preview surface able to change appearance
  // with no native repaint behind it, which on WebKitGTK is the condition that
  // keeps the previous raster. It goes live when the delivery mode changes
  // between two closely spaced sessions.
  const previewClipboardEpoch = Boolean(
    previewClipboardOnly && (renderResultPreview || renderProcessingPreview),
  );
  const pillVisualEpoch = `${pillState?.kind ?? ""}|${pillMode}|${muted ? "m" : ""}|${paused ? "p" : ""}|${showEditSurface ? "e" : ""}|${previewClipboardEpoch}`;

  // Force a native repaint whenever the pill VISUAL IDENTITY changes — even
  // when the surface AND kind stay the same (mode-cycle within "recording",
  // mute/pause toggles, action-pending spinner). On WebKitGTK/XWayland the
  // React DOM update alone does not invalidate the `.ov-pill-shell` wrapper
  // layer's cached raster, so the previous visual ghosts through. A reveal here
  // triggers reveal_overlay_window → the flat-height oscillation forces a
  // backing-store reallocation → a full repaint that clears the cached raster
  // before the new visual paints. (plan 1782750354086, §5)
  // D1: routed through scheduleReveal so a same-frame mode change (which also
  // re-evaluates the per-surface size layoutEffect) coalesces into a single
  // native set_size instead of two with different reveal ticks (RC1).
  useLayoutEffect(() => {
    if (!isActive) return;
    if (overlayMotionRef.current === "leaving") return;
    if (dragSessionActiveRef.current) return;
    // [ov-repaint] (plan 1784433288646, Phase 1.2): misst Pill-Breite +
    // ModeChip-Breite pro Repaint-Trigger. Zeigt ob die Geometrie pro
    // Mode-Wechsel oszilliert (die 27px-Variation die das Ghosting treibt).
    if (import.meta.env.DEV) {
      const shell = shellRef.current?.querySelector<HTMLElement>(".ov-pill-shell");
      const pill = shellRef.current?.querySelector<HTMLElement>(".pill");
      const mode = shellRef.current?.querySelector<HTMLElement>(".pill__mode");
      diagLog(`[ov-repaint] epoch=${pillVisualEpoch} shellW=${shell?.offsetWidth ?? "n/a"} pillW=${pill?.offsetWidth ?? "n/a"} modeW=${mode?.offsetWidth ?? "n/a"}`);
    }
    scheduleReveal({ surface: overlaySurfaceRef.current });
  }, [pillVisualEpoch, isActive, scheduleReveal]);

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
        // reveal_overlay_window AND the opaque --ov-surface (which blocks
        // residual bleed-through deterministically), this gives a clean swap.
        // NOTE: keying on the full pillVisualEpoch was tried and reverted — it
        // caused a 1-frame empty render on every visual change (e.g. commit
        // pending → idle) that read as a brief "flash" after the result pill.
        // (plan 1782750354086, §5 follow-up)
        <div className="ov-pill-shell">
          <OverlayPill key={pillState.kind} state={pillState} />
        </div>
      )}
    </div>
  );
}
