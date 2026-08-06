import type { AppConfig, RuntimeState } from "../types/ipc";
import type { WorkspaceRuntime } from "../screens/props";
import { buildCuratedTextProfiles } from "../lib/textProfileTemplates";
import {
  createDefaultProfileCaptureSettings,
  createDefaultProfileModesSettings,
  createDefaultProfileSpeechSettings,
  createDefaultTextProfileWorkMode,
  createEmptyTextProfileCuration,
} from "../lib/textProfiles";

export function createAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    model: "whisper-large-v3-turbo",
    provider_tier: "",
    language: "",
    active_text_profile_id: "general",
    text_profiles: [
      {
        id: "general",
        label: "General writing",
        prompt: "",
        stt_hints: "",
        vocabulary_hints: [],
        schema_version: 2,
        work_mode: createDefaultTextProfileWorkMode(),
        curation: createEmptyTextProfileCuration(),
        dictionary_entries: [],
        snippet_entries: [],
        speech: createDefaultProfileSpeechSettings(),
        modes: createDefaultProfileModesSettings(),
        capture: createDefaultProfileCaptureSettings(),
      },
      ...buildCuratedTextProfiles(),
    ],
    curated_profiles_seeded: true,
    post_process: true,
    correction_model: "llama-3.3-70b-versatile",
    local_correction_model: "llama3.2:latest",
    filter_fillers: true,
    professionalize: false,
    provider: "groq",
    local_model: "base",
    local_profile: "local-preview-base-fast",
    local_prompt_strength: "profile",
    local_prompt_carry: false,
    local_beam_size: 1,
    local_best_of: 1,
    local_profile_prompt_settings: [
      {
        profile_id: "local-preview-base-fast",
        prompt_strength: "profile",
        prompt_carry: false,
      },
    ],
    local_profile_decode_settings: [
      {
        profile_id: "local-preview-base-fast",
        beam_size: 1,
        best_of: 1,
      },
    ],
    hotkey: "Ctrl+Super",
    pause_hotkey: "Ctrl+Space",
    abort_hotkey: "Ctrl+Alt",
    activation_mode: "tap",
    overlay_position_mode: "preset",
    overlay_monitor: "primary",
    overlay_anchor: "bottom_center",
    overlay_manual_x: 0,
    overlay_manual_y: 0,
    sample_rate: 16000,
    channels: 1,
    dtype: "int16",
    audio_device: "",
    max_recording_seconds: 180,
    silence_timeout_seconds: 2,
    result_actions_timeout_s: 9,
    mode_select_timeout_s: 6,
    play_sounds: true,
    sound_volume: 0.6,
    sound_pack: "timber",
    play_startup_sound: true,
    log_level: "info",
    temp_audio_dir: "",
    history_limit: 200,
    history_retention_days: 90,
    agent_name: "WordScript",
    agent_model: "llama-3.3-70b-versatile",
    local_agent_model: "llama3.2:latest",
    processing_mode: "auto",
    enhance_sub_mode: "enhance",
    enhance_target: "general",
    auto_detect_mode: true,
    mode_picker_hotkey: "",
    mode_auto_hotkey: "",
    mode_verbatim_hotkey: "",
    mode_cleanup_hotkey: "",
    mode_rewrite_hotkey: "",
    mode_agent_hotkey: "",
    mode_prompt_enhance_hotkey: "",
    ...overrides,
  };
}
/**
 * WHAT A WIRED SCREEN IS HANDED, for a test that is not the workspace.
 *
 * A wired screen takes `WorkspaceRuntime` because there is exactly one reader
 * per window (`src/screens/props.ts`). The default here is inert — `patch` and
 * `patchText` record nothing and `active` is false — so a test opts INTO the
 * behaviour it is about rather than inheriting a surface that writes.
 */
export function createWorkspaceRuntime(
  overrides: Partial<WorkspaceRuntime> = {},
): WorkspaceRuntime {
  return {
    config: createAppConfig(),
    state: createRuntimeState(),
    patch: () => undefined,
    patchText: () => undefined,
    flushText: () => undefined,
    active: false,
    ...overrides,
  };
}

export function createRuntimeState(overrides: Partial<RuntimeState> = {}): RuntimeState {
  return {
    status: "idle",
    config: null,
    muted: false,
    paused: false,
    lastTranscription: null,
    pendingResult: null,
    lastResult: null,
    error: null,
    errorAudioRetained: false,
    recordingStartMs: null,
    previewStaged: false,
    resultSurfaceOpen: false,
    nativeSyncMirror: null,
    ...overrides,
  };
}
