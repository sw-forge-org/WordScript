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

export type ProcessingMode =
  | "auto"
  | "cleanup"
  | "rewrite"
  /// Renders the dictation in another language instead of tidying it. Its own
  /// mode rather than a flag on cleanup, because it replaces every word and a
  /// mode indicator that said "Cleanup" while doing so would be wrong about
  /// what happened (ADR 0041).
  | "translate"
  | "agent"
  | "prompt_enhance"
  | "verbatim";

/** Mirrors `core::capture::InputLevelVerdict`. Diagnosis only — WordScript
 *  never writes the OS input volume, which is per device rather than per app. */
export type InputLevelVerdict =
  | "ok"
  | "too_quiet"
  | "silent"
  | "clipping"
  | "too_short";

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

/** Where a vocabulary entry came from. `learned` rows were promoted by the
 *  runtime after seeing the correction stage repair the same term twice; `user`
 *  rows were typed. Removal works the same on both (ADR 0035). */
export type VocabularyHintOrigin = "user" | "learned";

/** A word or name the profile carries.
 *
 *  `use_as_prompt_hint` is a migration remnant and nothing reads it. It used to
 *  be a per-entry recognizer opt-in whose intuitive use was backwards: people
 *  switch on their long product names, which are exactly the terms
 *  `vocabulary_repair` restores afterwards, while the short ones that are
 *  unrecoverable after transcription got nothing. The runtime allocates the
 *  slots now (ADR 0035). */
export interface VocabularyHintEntry {
  id:                      string;
  phrase:                  string;
  /** @deprecated Migration-only. The runtime decides which terms reach the
   *  recognizer; do not write. */
  use_as_prompt_hint:      boolean;
  origin:                  VocabularyHintOrigin;
  /** Epoch ms of the promotion, or null for a term someone typed. */
  learned_at_ms:           number | null;
  /** How often deterministic repair has acted on this term. */
  hit_count:               number;
  /** How often the correction stage was seen repairing it before promotion. */
  observation_count:       number;
}

export interface TextProfile {
  id:                      string;
  label:                   string;
  prompt:                  string;
  /** @deprecated Migration-only remnant of the free-text hint blob.
   *  Read once into `vocabulary_hints` on load; do not write. */
  stt_hints:               string;
  vocabulary_hints:        VocabularyHintEntry[];
  schema_version:          number;
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
  /** Never enough on its own to discard text — it only lowers the
   *  corroboration the drift check needs from two signals to one. */
  language_locked:         boolean;
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

// Mirrors the Rust `ProfileModesSettings`. The cleanup switches that used to
// live here are gone: the processing mode is the only input to transform
// behavior (ADR 0020).
// The addressee a profile writes to, or — for the lowest step — the medium.
// Deliberately not a ladder of formality adjectives: those all sit in one
// semantic field and stop being distinguishable past three steps. Mirrors the
// Rust `CommunicationRegister` (ADR 0023).
export type CommunicationRegister =
  | "off"
  | "authority"
  | "client"
  | "colleague"
  | "friend"
  | "quick";

/// Mirrors `AppConfig.color_scheme`. Structurally identical to the shell's own
/// `ColorScheme` in `hooks/useColorScheme`, which is where the resolution rule
/// lives; this is the persisted half of it.
export type ColorScheme = "light" | "dark" | "system";

export type CommunicationLength = "terse" | "normal" | "full";

/// What `core::communication_style` does with one of the two bounded free-text
/// style fields, including the part it will not send.
export interface StyleFieldBudget {
  /// What reaches the prompt, after whitespace is collapsed, duplicate lines
  /// are dropped and a line past 120 characters is truncated.
  accepted:                string[];
  /// What the budget refused. Not drawn anywhere: the meter says how much of
  /// the budget is spent, and the rules that spend it are in `REFERENCE.md`.
  dropped:                 string[];
  /// The characters the prompt actually costs, which is never more and is often
  /// less than the characters that were typed.
  used_chars:              number;
  max_chars:               number;
}

/// Mirrors `core::communication_style::CommunicationStyleAnalysis`.
export interface CommunicationStyleAnalysis {
  register:                string;
  length:                  string;
  instructions:            StyleFieldBudget;
  sample:                  StyleFieldBudget;
}

/// What Translate does when the dictation is already in the target language.
/// Stored rather than judged per dictation: the model still decides whether the
/// two languages match, it never decides what follows from that (ADR 0041).
export type TranslateSameLanguage = "pass_through" | "cleanup";

/// German, French and Spanish force a choice English does not carry.
/// `as_dictated` keeps a formal sentence formal and adds no decision of its own.
export type TranslateAddressForm = "as_dictated" | "formal" | "informal";

/// The languages Translate offers, as the runtime's `TRANSLATE_LANGUAGES`.
/// A code is stored and the English name is what reaches the prompt, so a later
/// translation of this surface cannot change what the prompt asks for.
export const TRANSLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
];

export interface ProfileModesSettings {
  /// Applies to every mode, not only Auto. Persisted under the legacy key
  /// `auto_detect_mode` in configs written by older builds; Rust accepts both.
  collect_workspace_context: boolean;
  agent_name:              string;
  /// Sets the form of generated text, never its wording. Defaults to "off",
  /// which emits no style block and leaves every prompt as it was.
  communication_register:  CommunicationRegister;
  communication_length:    CommunicationLength;
  /// The user's own rules. They outrank the register where they touch it.
  style_instructions:      string;
  /// A piece of the user's own writing. Subordinate to the register for form,
  /// authoritative for wording — the register is forbidden from supplying slang
  /// on its own, so this is where any comes from.
  style_sample:            string;
  /// The language Translate renders into, as an ISO 639-1 code. Per profile
  /// rather than per machine: "English mail" and "German notes" are exactly
  /// what profiles are for, so a profile switch may change the output language.
  translate_target_language: string;
  /// Whether the profile's names, products and technical terms survive a
  /// translation untouched. They are the one part of a sentence a translator
  /// must leave alone and a model will otherwise localize.
  translate_keep_profile_words: boolean;
}

export interface ProfileCaptureSettings {
  max_recording_seconds:   number;
  silence_timeout_seconds: number;
}

/// Why a recording cannot be longer than the processing limit.
export type CaptureCeilingReason =
  | "provider_upload_limit"
  | "decode_budget"
  | "configured_maximum";

/**
 * What a recording may cost under the current provider and settings.
 *
 * Every field is the runtime's answer, resolved by `resolve_capture_budget`.
 * None of it is recomputed here: a threshold restated in TypeScript drifts, and
 * the drift is invisible because both sides still look right in isolation
 * (ADR 0034).
 */
export interface CaptureBudget {
  provider:                      string;
  /** The hard limit: past this, the recording cannot be processed at all. */
  ceiling_seconds:               number;
  ceiling_reason:                CaptureCeilingReason;
  /** The cause, phrased for display: "the 25 MiB upload size on your free plan". */
  ceiling_detail:                string;
  /** The auto-stop in force — the configured value, clamped to the ceiling. */
  auto_stop_seconds:             number;
  configured_auto_stop_seconds:  number;
  auto_stop_clamped:             boolean;
  safety_margin_seconds:         number;
  recommended_auto_stop_seconds: number;
  /** Legal, but with no headroom left between auto-stop and processing limit. */
  auto_stop_in_margin:           boolean;
}

/** An account plan and the upload it buys. Declared by the provider. */
export interface ProviderTier {
  id:              string;
  label:           string;
  max_audio_bytes: number;
  default:         boolean;
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
  /// Legacy globals. The runtime no longer reads them for behavior — they exist
  /// so configs predating per-profile modes can still be migrated. Do not write
  /// to them from the UI.
  post_process:            boolean;
  correction_model:        string;
  local_correction_model:  string;
  filter_fillers:          boolean;
  professionalize:         boolean;
  provider:                string;
  /// Which of the provider's account plans this machine is on. Plans come from
  /// `resolve_provider_tiers`; empty means the provider's default.
  provider_tier:           string;
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
  /// The two Translate settings that are not per profile. The target language
  /// and the profile-words switch are, and live on `ProfileModesSettings`.
  translate_same_language?: TranslateSameLanguage;
  translate_address_form?:  TranslateAddressForm;
  /// Light, dark, or follow the OS. `system` is a deferral resolved at render
  /// time, so what lands on `<html data-theme>` is always `light` or `dark`
  /// (ADR 0048). Machine-wide: it belongs to the window, not to a profile.
  color_scheme?:            ColorScheme;
  /// Global fallback for profiles that predate the per-profile modes block. The
  /// real control is `ProfileModesSettings.collect_workspace_context`.
  auto_detect_mode?:        boolean;
  mode_picker_hotkey?:      string;
  mode_auto_hotkey?:        string;
  mode_verbatim_hotkey?:    string;
  mode_cleanup_hotkey?:     string;
  mode_rewrite_hotkey?:     string;
  /// Empty by default, and the only mode slot that is: `Alt+1` through `Alt+6`
  /// are taken, so the seventh mode either takes `Alt+7` or takes none
  /// (ADR 0041).
  mode_translate_hotkey?:   string;
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
  hold_arm_ms:              number;
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
  | {
      event: "error";
      message: string;
      /** True when the runtime kept the capture, so the failure can be retried
       *  from the audio rather than only reported. */
      audio_retained?: boolean;
    }
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
  /** Whether the failed session's audio survived, i.e. whether the error
   *  surface has something to offer a retry from. */
  errorAudioRetained: boolean;
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
  /** What the `wordscript-native-event` channel mirrored for the current
   *  session, or null. Set by the completion sync, which by itself never ends
   *  the session (ADR 0018). Two readers: the NATIVE_SYNC_TIMEOUT fallback
   *  builds its result from it when the authoritative event never arrives, and
   *  its presence on an already-idle session identifies a late authoritative
   *  event — one that must merge into the open surface rather than open a
   *  second one. Cleared at every session boundary. */
  nativeSyncMirror: { finalText: string; corrected: boolean } | null;
}
