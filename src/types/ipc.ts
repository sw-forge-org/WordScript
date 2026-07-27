// ── Runtime → Tauri events (received via listen("wordscript-event")) ─────────

import type { NativeInsertResult } from "./nativeInsertion";

export interface DictionaryEntry {
  id:                      string;
  phrase:                  string;
  replace_with:            string;
}

export interface SnippetEntry {
  id:                      string;
  label:                   string;
  trigger:                 string;
  expansion:               string;
}

export interface TextProfileCuration {
  curated:                 boolean;
  audience:                string;
  summary:                 string;
  highlights:              string[];
}

export type TextProfileRewriteStyle = "verbatim" | "clean" | "polished";
export type TextProfileInsertBehavior = "auto_paste" | "clipboard_only";
export type TextProfileRecoveryBehavior = "standard";

export type ProcessingMode = "auto" | "cleanup" | "rewrite" | "agent" | "prompt_enhance" | "verbatim";

/** Mirrors `core::capture::InputLevelVerdict`. Diagnosis only — WordScript
 *  never writes the OS input volume, which is per device rather than per app. */
export type InputLevelVerdict = "ok" | "too_quiet" | "silent" | "clipping";

/** Mirrors `core::capture::InputLevelSummary`. */
export interface InputLevelSummary {
  peak:                 number;
  peak_dbfs:            number;
  clipped_ratio:        number;
  verdict:              InputLevelVerdict;
  voice_threshold_dbfs: number;
}
export type EnhanceSubMode = "enhance" | "expand";
export type PromptTarget = "general" | "claude_code" | "cursor" | "chatgpt" | "copilot";

export type BiasMode = "conservative" | "manual" | "off";

export interface ManualBias {
  cloud_include_profile_terms: boolean;
  local_include_profile_terms: boolean;
  stt_hints_override: string;
}

export interface TextProfileWorkMode {
  rewrite_style:           TextProfileRewriteStyle;
  insert_behavior:         TextProfileInsertBehavior;
  recovery_behavior:       TextProfileRecoveryBehavior;
  processing_mode?:         ProcessingMode;
  enhance_sub_mode?:        EnhanceSubMode | null;
  target?:                  PromptTarget | null;
  bias_mode?:               BiasMode;
  manual_bias?:             ManualBias;
}

export interface WorkspaceContext {
  app_name:            string;
  bundle_id:           string;
  category:            string;
  window_title:        string;
  detected_language?:  string | null;
  detected_framework?: string | null;
  browser_domain?:     string | null;
}

export interface ProcessingModeEvent {
  mode:           ProcessingMode;
  is_override:    boolean;
  auto_detected:  boolean;
}

export interface RuntimeTransformEvent {
  applied_rules:           string[];
  warning:                 string | null;
}

export interface RuntimeHistoryEvent {
  entry_id:                string;
  retry_of:                string | null;
}

export interface RuntimeResultEvent {
  text:                    string;
  corrected:               boolean;
  provider?:               string;
  active_profile?:         string | null;
  work_mode?:              TextProfileWorkMode;
  raw_text?:               string | null;
  transform?:              RuntimeTransformEvent;
  /** "inserted" | "clipboard" — derived from the native insert outcome in the
   *  auto_paste path. When the paste failed and the chain fell back to
   *  clipboard (`ClipboardFallback`), this is "clipboard" so the overlay can
   *  surface the Insert retry affordance (06b) the same way it does for the
   *  explicit `clipboard_only` setting. */
  delivery?:               "inserted" | "clipboard";
  insertion?:              NativeInsertResult;
  history?:                RuntimeHistoryEvent;
}

export interface RuntimeTranscriptionResult {
  provider:                string | null;
  active_profile:          string | null;
  work_mode:               TextProfileWorkMode | null;
  raw_text:                string | null;
  final_text:              string;
  corrected:               boolean;
  transform:               RuntimeTransformEvent | null;
  /** "inserted" | "clipboard" | null — propagated from the transcription event
   *  payload so the overlay can derive `clipboardOnly` for the result-actions
   *  surface even on the auto_paste path (ClipboardFallback). Null on
   *  preview_ready / native-event transcription merge paths. */
  delivery:                "inserted" | "clipboard" | null;
  insertion:               NativeInsertResult | null;
  history:                 RuntimeHistoryEvent | null;
  occurred_at_ms:          number;
}

export interface TextProfile {
  id:                      string;
  label:                   string;
  prompt:                  string;
  stt_hints:               string;
  work_mode?:              TextProfileWorkMode;
  curation:                TextProfileCuration;
  dictionary_entries:      DictionaryEntry[];
  snippet_entries:         SnippetEntry[];
  // Per-profile settings (tab-oriented sub-objects)
  speech?:                 ProfileSpeechSettings;
  modes?:                  ProfileModesSettings;
  capture?:                ProfileCaptureSettings;
}

export interface LocalProfileDecodeSettings {
  profile_id:              string;
  beam_size:               number;
  best_of:                 number;
}

export interface LocalProfilePromptSettings {
  profile_id:              string;
  prompt_strength:         "off" | "profile" | "profile_and_terms";
  prompt_carry:            boolean;
}

// ── Per-Profile Settings (tab-oriented sub-objects) ──────────────────────────

export interface ProfileSpeechSettings {
  provider:                string;
  model:                   string;
  language:                string;
  correction_model:        string;
  local_correction_model:  string;
  agent_model:             string;
  local_agent_model:       string;
  local_model:             string;
  local_profile:           string;
  local_prompt_strength:   "off" | "profile" | "profile_and_terms";
  local_prompt_carry:      boolean;
  local_beam_size:         number;
  local_best_of:           number;
  local_profile_prompt_settings: LocalProfilePromptSettings[];
  local_profile_decode_settings: LocalProfileDecodeSettings[];
}

export interface ProfileModesSettings {
  post_process:            boolean;
  filter_fillers:          boolean;
  professionalize:         boolean;
  auto_detect_mode:        boolean;
  agent_name:              string;
}

export interface ProfileCaptureSettings {
  max_recording_seconds:   number;
  silence_timeout_seconds: number;
}

export type OverlayPositionMode = "preset" | "manual";
export type OverlayAnchor =
  | "top_left"
  | "top_center"
  | "top_right"
  | "center_left"
  | "center_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right";

export interface AppConfig {
  model:                   string;
  language:                string;
  active_text_profile_id:  string;
  text_profiles:           TextProfile[];
  curated_profiles_seeded: boolean;
  post_process:            boolean;
  correction_model:        string;
  local_correction_model:  string;
  filter_fillers:          boolean;
  professionalize:         boolean;
  provider:                string;
  local_model:             string;
  local_profile:           string;
  local_prompt_strength:   "off" | "profile" | "profile_and_terms";
  local_prompt_carry:      boolean;
  local_beam_size:         number;
  local_best_of:           number;
  local_profile_prompt_settings: LocalProfilePromptSettings[];
  local_profile_decode_settings: LocalProfileDecodeSettings[];
  hotkey:                  string;
  pause_hotkey:            string;
  abort_hotkey:            string;
  activation_mode:         "tap" | "hold" | "double_tap";
  overlay_position_mode:   OverlayPositionMode;
  overlay_monitor:         string;
  overlay_anchor:          OverlayAnchor;
  overlay_manual_x:        number;
  overlay_manual_y:        number;
  sample_rate:             number;
  channels:                number;
  dtype:                   string;
  audio_device:            string;
  max_recording_seconds:        number;
  silence_timeout_seconds:      number;
  result_actions_timeout_s:       number;
  mode_select_timeout_s:          number;
  play_sounds:                    boolean;
  sound_volume:                   number;
  sound_pack:                     string;
  play_startup_sound:             boolean;
  log_level:               string;
  temp_audio_dir:          string;
  history_limit:           number;
  history_retention_days:  number;
  agent_name:              string;
  agent_model:             string;
  local_agent_model:       string;
  processing_mode?:         ProcessingMode;
  enhance_sub_mode?:        EnhanceSubMode | null;
  enhance_target?:          PromptTarget;
  auto_detect_mode?:        boolean;
  mode_picker_hotkey?:      string;
  mode_auto_hotkey?:        string;
  mode_verbatim_hotkey?:    string;
  mode_cleanup_hotkey?:     string;
  mode_rewrite_hotkey?:     string;
  mode_agent_hotkey?:       string;
  mode_prompt_enhance_hotkey?: string;
  hold_watchdog_seconds?:   number;
  double_tap_window_ms?:    number;
  shortcut_schema_version?: number;
}

/// Mirrors `core::shortcut::ShortcutValidation`.
export interface ShortcutValidation {
  ok:        boolean;
  disabled:  boolean;
  canonical: string;
  display:   string;
  /** True when the shortcut is modifiers only — it acts on key release and, in
   *  tap mode, on every single press. */
  modifier_only: boolean;
  /** How the OS delivers the shortcut: `grab` takes the key from every other
   *  application, `observe` leaves it available (ADR 0009). Null when the value
   *  is disabled or could not be parsed. */
  delivery:  "grab" | "observe" | null;
  reason:    string | null;
  warning:   string | null;
}

export interface ShortcutVocabularyToken {
  token:   string;
  display: string;
}

/// Mirrors `core::shortcut::ShortcutVocabulary`. The UI derives its key
/// handling from this instead of carrying a second key table — every token in
/// here is registerable by the runtime.
export interface ShortcutVocabulary {
  modifiers:             ShortcutVocabularyToken[];
  modifier_codes:        Array<[string, string]>;
  key_groups:            Array<{ label: string; tokens: ShortcutVocabularyToken[] }>;
  modifier_only_minimum: number;
}

/// Mirrors `core::shortcut::SessionKind` — the row of the capability matrix
/// this session runs in.
export type ShortcutSessionKind =
  | "windows"
  | "mac_os"
  | "linux_x11"
  | "linux_x_wayland"
  | "linux_native_wayland";

/// Mirrors `core::shortcut::ShortcutPlatform`.
export interface ShortcutPlatform {
  kind:                        ShortcutSessionKind;
  summary:                     string;
  global_shortcuts_available:  boolean;
  keys_the_desktop_swallows:   string[];
  notes:                       string[];
}

/// Mirrors `core::shortcut::ReleaseEvidence`. Measured from the trigger lane's
/// press/release counters — never assumed from the platform.
export type ShortcutReleaseEvidence = "unobserved" | "release_observed" | "release_missing";

/// Mirrors `core::shortcut::CapabilityState`. `conditional` means registerable
/// with a consequence the user has to know — distinct from both "fine" and
/// "cannot work".
export type ShortcutCapabilityState = "available" | "conditional" | "unavailable";

/// Mirrors `core::shortcut::Capability`. The UI renders `state` and `reason`
/// and derives neither (ADR 0006).
export interface ShortcutCapability {
  id:     string;
  label:  string;
  state:  ShortcutCapabilityState;
  reason: string | null;
}

/// Mirrors `core::shortcut::ShortcutCapabilities` — the per-OS capability
/// matrix (T12) for the current session, joined with this session's evidence.
export interface ShortcutCapabilities {
  session:                    ShortcutSessionKind;
  summary:                    string;
  global_shortcuts_available: boolean;
  release_evidence:           ShortcutReleaseEvidence;
  activation_modes:           ShortcutCapability[];
  key_classes:                ShortcutCapability[];
}

/// Mirrors `core::trigger::BindingInfo` — runtime truth per shortcut slot.
export interface ShortcutBindingInfo {
  label:           string;
  role:            "capture" | "mode";
  configured:      string;
  display:         string;
  registered:      boolean;
  error:           string | null;
  presses:         number;
  releases:        number;
  last_press_ms:   number | null;
  last_release_ms: number | null;
}

/// Mirrors `core::trigger::NativeTriggerStatus`.
export interface NativeTriggerStatus {
  configured:               boolean;
  enabled:                  boolean;
  paused:                   boolean;
  suspended:                boolean;
  hotkey:                   string;
  pause_hotkey:             string;
  abort_hotkey:             string;
  registered_hotkey:        string | null;
  registered_pause_hotkey:  string | null;
  registered_abort_hotkey:  string | null;
  activation_mode:          "tap" | "hold" | "double_tap";
  last_error:               string | null;
  owner:                    string;
  bindings:                 ShortcutBindingInfo[];
  hold_min_ms:              number;
  debounce_ms:              number;
  hold_watchdog_seconds:    number;
  double_tap_window_ms:     number;
  registered_mode_hotkeys:  Array<{ label: string; display: string }>;
}

export type BackendEvent =
  | { event: "ready";            version: string; config: AppConfig }
  | { event: "recording_started" }
  | { event: "recording_stopped" }
  | { event: "processing" }
  | ({ event: "preview_ready" } & RuntimeResultEvent)
  | ({ event: "transcription" } & RuntimeResultEvent)
  | ({ event: "empty" } & { message?: string; input_level?: InputLevelSummary })
  | { event: "muted";            muted: boolean }
  | { event: "paused";           paused: boolean }
  | { event: "error";            message: string }
  | { event: "audio_level";      level: number; rms?: number; waveform?: number[] }
  | { event: "shutdown" };

// ── Runtime state (derived in useRuntime) ─────────────────────────────────────

export type RuntimeStatus = "idle" | "recording" | "processing";

export interface RuntimeState {
  status:            RuntimeStatus;
  config:            AppConfig | null;
  muted:             boolean;
  paused:            boolean;
  lastTranscription: string | null;
  pendingResult:     RuntimeTranscriptionResult | null;
  lastResult:        RuntimeTranscriptionResult | null;
  error:             string | null;
  recordingStartMs:  number | null;   // Date.now() when recording started
  /** Whether a processing preview was staged for the current session. One
   *  decision surface per delivery mode: a session that stopped on the preview
   *  (clipboard_only) has already had the user's decision and must not show a
   *  second surface afterwards. Sticky for the whole session so it survives the
   *  native/authoritative event ordering race that `pendingResult` alone does
   *  not. */
  previewStaged: boolean;
  /** Whether the overlay's result-actions surface belongs on screen for
   *  `lastResult`. Set in the SAME reducer commit that flips `status` to
   *  "idle", so the overlay never renders a frame where the session has ended
   *  but no surface has taken over. */
  resultSurfaceOpen: boolean;
}
