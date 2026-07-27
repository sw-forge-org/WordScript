import { useCallback, useEffect, useReducer, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { resolveActiveTextProfile, resolveTextProfileWorkMode } from "../lib/textProfiles";
import type {
  AppConfig,
  BackendEvent,
  RuntimeState,
  RuntimeTranscriptionResult,
} from "../types/ipc";

const RUNTIME_EVENT_CHANNEL = "wordscript-event";
const NATIVE_RUNTIME_EVENT_CHANNEL = "wordscript-native-event";

type Action =
  | { type: "READY"; config: AppConfig }
  | { type: "RECORDING_STARTED" }
  | { type: "RECORDING_STOPPED" }
  | { type: "PROCESSING" }
  | { type: "PREVIEW_READY"; result: RuntimeTranscriptionResult }
  | { type: "TRANSCRIPTION"; result: RuntimeTranscriptionResult; preserveExisting?: boolean }
  | { type: "NATIVE_TRANSCRIPTION_SYNC"; finalText: string; corrected: boolean }
  | { type: "EMPTY" }
  | { type: "MUTED"; muted: boolean }
  | { type: "PAUSED"; paused: boolean }
  | { type: "ERROR"; message: string };

const initial: RuntimeState = {
  status: "idle",
  config: null,
  muted: false,
  paused: false,
  lastTranscription: null,
  pendingResult: null,
  lastResult: null,
  error: null,
  recordingStartMs: null,
  previewStaged: false,
  resultSurfaceOpen: false,
};

function buildRuntimeTranscriptionResult(
  payload: Extract<BackendEvent, { event: "preview_ready" | "transcription" }>,
  config: AppConfig | null,
): RuntimeTranscriptionResult {
  const activeProfile = config ? resolveActiveTextProfile(config) : null;

  return {
    provider: payload.provider ?? null,
    active_profile: payload.active_profile ?? activeProfile?.label ?? null,
    work_mode: payload.work_mode ?? (activeProfile ? resolveTextProfileWorkMode(activeProfile) : null),
    raw_text: payload.raw_text ?? payload.text,
    final_text: payload.text,
    corrected: payload.corrected,
    transform: payload.transform
      ? {
          applied_rules: [...payload.transform.applied_rules],
          warning: payload.transform.warning,
        }
      : null,
    delivery: payload.delivery ?? null,
    insertion: payload.insertion ?? null,
    history: payload.history ?? null,
    occurred_at_ms: Date.now(),
  };
}

function reducer(state: RuntimeState, action: Action): RuntimeState {
  switch (action.type) {
    case "READY":
      return { ...state, config: action.config, error: null };
    case "RECORDING_STARTED":
      return {
        ...state,
        status: "recording",
        muted: false,
        paused: false,
        pendingResult: null,
        lastResult: null,
        error: null,
        recordingStartMs: Date.now(),
        previewStaged: false,
        resultSurfaceOpen: false,
      };
    case "RECORDING_STOPPED":
      return { ...state, paused: false, recordingStartMs: null };
    case "PROCESSING":
      return {
        ...state,
        status: "processing",
        paused: false,
        pendingResult: null,
        previewStaged: false,
        resultSurfaceOpen: false,
      };
    case "PREVIEW_READY":
      return {
        ...state,
        status: "processing",
        paused: false,
        pendingResult: action.result,
        error: null,
        previewStaged: true,
        resultSurfaceOpen: false,
      };
    case "TRANSCRIPTION":
      {
        const existingResult = state.lastResult ?? state.pendingResult;
        const mergedResult = action.preserveExisting && existingResult
          ? {
              ...existingResult,
              final_text: action.result.final_text,
              corrected: action.result.corrected,
              occurred_at_ms: action.result.occurred_at_ms,
            }
          : action.result;

        return {
          ...state,
          status: "idle",
          paused: false,
          lastTranscription: mergedResult.final_text,
          pendingResult: null,
          lastResult: mergedResult,
          // Atomic with `status: "idle"`, the same guarantee RECORDING_STARTED
          // gives on the way in. The overlay's result surface is therefore
          // visible in the very commit the session ends — there is no render
          // where the session is over but no surface has taken over, and hence
          // no bridge predicate is needed to carry the pill across one.
          //
          // One decision surface per delivery mode: a session that staged a
          // processing preview (clipboard_only) already had the user's decision
          // there and closes without a second surface. Everything else — the
          // auto_paste pipeline, a history retry — never had a decision surface
          // and gets the result one.
          //
          // `previewStaged` rather than `pendingResult`: the native-channel sync
          // clears `pendingResult` and can arrive BEFORE this authoritative
          // event, which would read as "no preview" and flash a result surface
          // on a clipboard_only commit (the "eckiger 06b-State" regression).
          //
          // Deliberately NOT keyed on `delivery`: an auto_paste run whose paste
          // fell back to the clipboard also reports `delivery: "clipboard"`, and
          // that is exactly the case where the user needs the result surface to
          // retry the insert.
          resultSurfaceOpen: !state.previewStaged,
        };
      }
    case "NATIVE_TRANSCRIPTION_SYNC":
      {
        // The native-event channel fires transcription/transcription_corrected
        // as a pure status sync (no payload beyond last_transcript). It arrives
        // shortly before (or after) the authoritative wordscript-event
        // transcription. Treating it as a separate TRANSCRIPTION dispatch would
        // set lastResult with a fresh occurred_at_ms and fire the OverlayWindow
        // lastResult-Effect a second time for the same commit, and it would
        // open a result surface on a clipboard_only commit (the "eckiger
        // 06b-State" regression). Instead, only update status +
        // lastTranscription and clear pendingResult here; the authoritative
        // wordscript-event transcription owns lastResult, `resultSurfaceOpen`
        // and therefore the surface decision. Clearing pendingResult is safe:
        // the native-event arrives only after the session has completed, so the
        // preview is no longer valid — and `previewStaged` deliberately stays,
        // because it is what tells the authoritative event that this session
        // already had its decision surface.
        return {
          ...state,
          status: "idle",
          paused: false,
          lastTranscription: action.finalText,
          pendingResult: null,
        };
      }
    case "EMPTY":
      return {
        ...state,
        status: "idle",
        paused: false,
        pendingResult: null,
        lastResult: null,
        previewStaged: false,
        resultSurfaceOpen: false,
      };
    case "MUTED":
      return { ...state, muted: action.muted };
    case "PAUSED":
      return { ...state, paused: action.paused };
    case "ERROR":
      return {
        ...state,
        status: "idle",
        paused: false,
        pendingResult: null,
        error: action.message,
        previewStaged: false,
        resultSurfaceOpen: false,
      };
    default:
      return state;
  }
}

export function useRuntime() {
  const [state, dispatch] = useReducer(reducer, initial);
  const configRef = useRef<AppConfig | null>(initial.config);
  const lastResultRef = useRef<RuntimeTranscriptionResult | null>(initial.lastResult);

  useEffect(() => {
    configRef.current = state.config;
    lastResultRef.current = state.lastResult;
  }, [state.config, state.lastResult]);

  const configureNativeCapture = useCallback((config: AppConfig) => {
    invoke("configure_native_capture", {
      request: {
        audio_device: config.audio_device,
        max_recording_seconds: config.max_recording_seconds,
        silence_timeout_seconds: config.silence_timeout_seconds,
      },
    }).catch((error) => console.error("configure_native_capture failed:", error));
  }, []);

  const syncNativeRuntime = useCallback((config: AppConfig) => {
    invoke("configure_native_trigger", {
      request: {
        hotkey: config.hotkey,
        pause_hotkey: config.pause_hotkey,
        abort_hotkey: config.abort_hotkey,
        activation_mode: config.activation_mode,
      },
    }).catch((error) => console.error("configure_native_trigger failed:", error));
    configureNativeCapture(config);
  }, [configureNativeCapture]);

  useEffect(() => {
    const unlisten = listen<BackendEvent>(RUNTIME_EVENT_CHANNEL, ({ payload }) => {
      if (payload.event === "audio_level") return;

      switch (payload.event) {
        case "ready":
          dispatch({ type: "READY", config: payload.config });
          syncNativeRuntime(payload.config);
          break;
        case "recording_started":
          dispatch({ type: "RECORDING_STARTED" });
          break;
        case "recording_stopped":
          dispatch({ type: "RECORDING_STOPPED" });
          break;
        case "processing":
          dispatch({ type: "PROCESSING" });
          break;
        case "preview_ready":
          dispatch({ type: "PREVIEW_READY", result: buildRuntimeTranscriptionResult(payload, configRef.current) });
          break;
        case "transcription":
          dispatch({ type: "TRANSCRIPTION", result: buildRuntimeTranscriptionResult(payload, configRef.current) });
          break;
        case "empty":
          // A capture that produced nothing but has a diagnosable cause — an
          // input level that never cleared the speech threshold, a muted or
          // wrong device — must reach the user. Silently returning to idle is
          // what made a misconfigured microphone look like a broken app.
          if (payload.input_level && payload.input_level.verdict !== "ok" && payload.message) {
            dispatch({ type: "ERROR", message: payload.message });
          } else {
            dispatch({ type: "EMPTY" });
          }
          break;
        case "muted":
          dispatch({ type: "MUTED", muted: payload.muted });
          break;
        case "paused":
          dispatch({ type: "PAUSED", paused: payload.paused });
          break;
        case "error":
          dispatch({ type: "ERROR", message: payload.message });
          break;
      }
    });

    void invoke<AppConfig>("load_app_config")
      .then((config) => {
        dispatch({ type: "READY", config });
        syncNativeRuntime(config);
      })
      .catch((error) => console.error("load_app_config failed:", error));

    const nativeUnlisten = listen<{ event: string; status?: { last_transcript?: string | null; last_error?: string | null } }>(
      NATIVE_RUNTIME_EVENT_CHANNEL,
      ({ payload }) => {
        switch (payload.event) {
          case "recording_started":
            dispatch({ type: "RECORDING_STARTED" });
            break;
          case "recording_stopped":
            dispatch({ type: "RECORDING_STOPPED" });
            break;
          case "processing":
            dispatch({ type: "PROCESSING" });
            break;
          case "transcription":
          case "transcription_corrected":
            {
              // Pure status sync — do NOT dispatch TRANSCRIPTION (which would
              // set lastResult and fire the OverlayWindow surface decision a
              // second time for the same commit). The authoritative
              // wordscript-event transcription owns lastResult.
              dispatch({
                type: "NATIVE_TRANSCRIPTION_SYNC",
                finalText: payload.status?.last_transcript ?? "",
                corrected: payload.event === "transcription_corrected",
              });
            }
            break;
          case "empty":
          case "aborted":
            dispatch({ type: "EMPTY" });
            break;
          case "error":
            dispatch({ type: "ERROR", message: payload.status?.last_error ?? "Native runtime error" });
            break;
        }
      },
    );

    return () => {
      unlisten.then((fn) => fn());
      nativeUnlisten.then((fn) => fn());
    };
  }, [syncNativeRuntime]);

  const toggleMute = useCallback(async () => {
    try {
      await invoke("toggle_native_capture_mute");
    } catch (error) {
      console.error("toggleMute failed:", error);
    }
  }, []);

  const togglePause = useCallback(async () => {
    try {
      await invoke("toggle_native_capture_pause");
    } catch (error) {
      console.error("togglePause failed:", error);
    }
  }, []);

  const saveConfig = useCallback(async (config: AppConfig) => {
    return invoke<AppConfig>("save_config", { config });
  }, []);

  const openSettings = useCallback(async () => {
    try {
      await invoke<void>("open_settings_window");
    } catch (error) {
      console.error("openSettings failed:", error);
    }
  }, []);

  return { state, toggleMute, togglePause, saveConfig, openSettings };
}