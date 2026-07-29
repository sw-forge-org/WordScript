import type {
  AppConfig,
  LocalProfileDecodeSettings,
  LocalProfilePromptSettings,
  ProfileCaptureSettings,
  ProfileModesSettings,
  ProfileSpeechSettings,
  TextProfile,
  TextProfileCuration,
  TextProfileInsertBehavior,
  TextProfileRecoveryBehavior,
  TextProfileRewriteStyle,
  TextProfileWorkMode,
} from "../types/ipc";

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `profile-${crypto.randomUUID()}`;
  }

  return `profile-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function cloneTextProfileCuration(curation?: TextProfileCuration): TextProfileCuration {
  return {
    curated: curation?.curated ?? false,
    audience: curation?.audience ?? "",
    summary: curation?.summary ?? "",
    highlights: [...(curation?.highlights ?? [])],
  };
}

function normalizeTextProfileRewriteStyle(value?: string | null): TextProfileRewriteStyle {
  switch ((value ?? "").trim().toLowerCase()) {
    case "verbatim":
      return "verbatim";
    case "polished":
    case "professional":
      return "polished";
    default:
      return "clean";
  }
}

function normalizeTextProfileInsertBehavior(value?: string | null): TextProfileInsertBehavior {
  switch ((value ?? "").trim().toLowerCase()) {
    case "clipboard_only":
    case "clipboard":
    case "manual":
      return "clipboard_only";
    default:
      return "auto_paste";
  }
}

function normalizeTextProfileRecoveryBehavior(value?: string | null): TextProfileRecoveryBehavior {
  switch ((value ?? "").trim().toLowerCase()) {
    case "standard":
    default:
      return "standard";
  }
}

function cloneTextProfileWorkMode(workMode?: Partial<TextProfileWorkMode> | null): TextProfileWorkMode {
  return {
    rewrite_style: normalizeTextProfileRewriteStyle(workMode?.rewrite_style),
    insert_behavior: normalizeTextProfileInsertBehavior(workMode?.insert_behavior),
    recovery_behavior: normalizeTextProfileRecoveryBehavior(workMode?.recovery_behavior),
    processing_mode: workMode?.processing_mode,
    enhance_sub_mode: workMode?.enhance_sub_mode ?? null,
    target: workMode?.target ?? null,
  };
}

export function createEmptyTextProfileCuration(): TextProfileCuration {
  return cloneTextProfileCuration();
}

export function createDefaultTextProfileWorkMode(): TextProfileWorkMode {
  return cloneTextProfileWorkMode();
}

// ── Per-Profile Settings Defaults ────────────────────────────────────────────

export function createDefaultProfileSpeechSettings(): ProfileSpeechSettings {
  return {
    provider: "groq",
    model: "whisper-large-v3-turbo",
    language: "",
    language_locked: false,
    correction_model: "llama-3.3-70b-versatile",
    local_correction_model: "llama3.2:latest",
    agent_model: "llama-3.3-70b-versatile",
    local_agent_model: "llama3.2:latest",
    local_model: "base",
    local_profile: "local-preview-base-fast",
    local_prompt_strength: "profile",
    local_prompt_carry: false,
    local_beam_size: 1,
    local_best_of: 1,
    local_profile_prompt_settings: [],
    local_profile_decode_settings: [],
  };
}

export function createDefaultProfileModesSettings(): ProfileModesSettings {
  return {
    post_process: true,
    filter_fillers: true,
    professionalize: false,
    auto_detect_mode: true,
    agent_name: "WordScript",
  };
}

export function createDefaultProfileCaptureSettings(): ProfileCaptureSettings {
  return {
    max_recording_seconds: 720,
    silence_timeout_seconds: 30,
  };
}

function cloneProfileSpeechSettings(settings?: ProfileSpeechSettings | null): ProfileSpeechSettings {
  if (!settings) return createDefaultProfileSpeechSettings();
  return {
    ...settings,
    // Absent in configs written before the language lock existed.
    language_locked: settings.language_locked ?? false,
    local_profile_prompt_settings: settings.local_profile_prompt_settings?.map((s) => ({ ...s })) ?? [],
    local_profile_decode_settings: settings.local_profile_decode_settings?.map((s) => ({ ...s })) ?? [],
  };
}

function cloneProfileModesSettings(settings?: ProfileModesSettings | null): ProfileModesSettings {
  if (!settings) return createDefaultProfileModesSettings();
  return { ...settings };
}

function cloneProfileCaptureSettings(settings?: ProfileCaptureSettings | null): ProfileCaptureSettings {
  if (!settings) return createDefaultProfileCaptureSettings();
  return { ...settings };
}

export function resolveProfileSpeechSettings(profile: Pick<TextProfile, "speech">): ProfileSpeechSettings {
  return cloneProfileSpeechSettings(profile.speech);
}

export function resolveProfileModesSettings(profile: Pick<TextProfile, "modes">): ProfileModesSettings {
  return cloneProfileModesSettings(profile.modes);
}

export function resolveProfileCaptureSettings(profile: Pick<TextProfile, "capture">): ProfileCaptureSettings {
  return cloneProfileCaptureSettings(profile.capture);
}

export function resolveTextProfileWorkMode(profile: Pick<TextProfile, "work_mode">): TextProfileWorkMode {
  return cloneTextProfileWorkMode(profile.work_mode);
}

function rewriteStyleLabel(value: TextProfileRewriteStyle): string {
  switch (value) {
    case "verbatim":
      return "Verbatim rewrite";
    case "polished":
      return "Polished rewrite";
    default:
      return "Clean rewrite";
  }
}

function insertBehaviorLabel(value: TextProfileInsertBehavior): string {
  switch (value) {
    case "clipboard_only":
      return "Clipboard-only delivery";
    default:
      return "Auto-paste delivery";
  }
}

function recoveryBehaviorLabel(value: TextProfileRecoveryBehavior): string {
  switch (value) {
    case "standard":
    default:
      return "Standard recovery";
  }
}

export function describeTextProfileWorkMode(profile: Pick<TextProfile, "work_mode">): string {
  const workMode = resolveTextProfileWorkMode(profile);
  return `${rewriteStyleLabel(workMode.rewrite_style)}, ${insertBehaviorLabel(workMode.insert_behavior)}, ${recoveryBehaviorLabel(workMode.recovery_behavior)}`;
}

export const TEXT_PROFILE_SCHEMA_VERSION = 2;

/** Mirrors `TextProfile::migrate_vocabulary_hints` in `config.rs`, so unsaved
 *  client state matches what a disk load would produce. Lines the hint filter
 *  would reject are dropped there too; this side only has to agree on shape. */
export function migrateLegacyBiasPolicyToVocabularyHints(profile: TextProfile): TextProfile {
  if ((profile.schema_version ?? 1) >= TEXT_PROFILE_SCHEMA_VERSION) {
    return profile;
  }

  // Conservative and Off never forwarded profile terms; only Manual with the
  // cloud flag opted in.
  const defaultUseAsPromptHint =
    profile.work_mode?.bias_mode === "manual" &&
    Boolean(profile.work_mode?.manual_bias?.cloud_include_profile_terms);

  const vocabulary_hints =
    profile.vocabulary_hints?.length
      ? profile.vocabulary_hints
      : (profile.stt_hints ?? "")
          .split("\n")
          .map((line) => line.split(/\s+/).filter(Boolean).join(" "))
          .filter((phrase) => phrase.length > 0 && phrase.length <= 48 && phrase.split(" ").length <= 4)
          .slice(0, 4)
          .map((phrase, index) => ({
            id: `${profile.id}-vocab-${index}`,
            phrase,
            use_as_prompt_hint: defaultUseAsPromptHint,
          }));

  return { ...profile, vocabulary_hints, schema_version: TEXT_PROFILE_SCHEMA_VERSION };
}

export function cloneTextProfile(profile: TextProfile, overrides: Partial<TextProfile> = {}): TextProfile {
  return {
    ...profile,
    ...overrides,
    vocabulary_hints: (overrides.vocabulary_hints ?? profile.vocabulary_hints ?? []).map((entry) => ({ ...entry })),
    schema_version: overrides.schema_version ?? profile.schema_version ?? 1,
    work_mode: cloneTextProfileWorkMode(overrides.work_mode ?? profile.work_mode),
    curation: cloneTextProfileCuration(overrides.curation ?? profile.curation),
    dictionary_entries: (overrides.dictionary_entries ?? profile.dictionary_entries).map((entry) => ({ ...entry })),
    snippet_entries: (overrides.snippet_entries ?? profile.snippet_entries).map((entry) => ({ ...entry })),
    speech: cloneProfileSpeechSettings(overrides.speech ?? profile.speech),
    modes: cloneProfileModesSettings(overrides.modes ?? profile.modes),
    capture: cloneProfileCaptureSettings(overrides.capture ?? profile.capture),
  };
}

export function isCuratedTextProfile(profile: TextProfile): boolean {
  return Boolean(profile.curation?.curated);
}

export function clearTextProfileCuration(profile: TextProfile): TextProfile {
  if (!isCuratedTextProfile(profile)) {
    return profile;
  }

  return {
    ...profile,
    curation: createEmptyTextProfileCuration(),
  };
}

export function displayTextProfileLabel(profile: TextProfile): string {
  return isCuratedTextProfile(profile)
    ? `${profile.label} (included)`
    : profile.label;
}

export function resolveActiveTextProfile(config: AppConfig): TextProfile {
  const profiles = config.text_profiles ?? [];
  const activeProfile = profiles.find((profile) => profile.id === config.active_text_profile_id);

  if (activeProfile) {
    return cloneTextProfile(activeProfile);
  }

  if (profiles.length > 0) {
    return cloneTextProfile(profiles[0]);
  }

  return {
    id: config.active_text_profile_id || "general",
    label: "General writing",
    prompt: "",
    stt_hints: "",
    vocabulary_hints: [],
    schema_version: TEXT_PROFILE_SCHEMA_VERSION,
    work_mode: createDefaultTextProfileWorkMode(),
    curation: createEmptyTextProfileCuration(),
    dictionary_entries: [],
    snippet_entries: [],
    speech: createDefaultProfileSpeechSettings(),
    modes: createDefaultProfileModesSettings(),
    capture: createDefaultProfileCaptureSettings(),
  };
}

export function createTextProfile(): TextProfile {
  return {
    id: createProfileId(),
    label: "New profile",
    prompt: "",
    stt_hints: "",
    vocabulary_hints: [],
    schema_version: TEXT_PROFILE_SCHEMA_VERSION,
    work_mode: createDefaultTextProfileWorkMode(),
    curation: createEmptyTextProfileCuration(),
    dictionary_entries: [],
    snippet_entries: [],
    speech: createDefaultProfileSpeechSettings(),
    modes: createDefaultProfileModesSettings(),
    capture: createDefaultProfileCaptureSettings(),
  };
}

export function buildTextProfilesPatch(
  config: AppConfig,
  nextProfiles: TextProfile[],
  nextActiveProfileId?: string,
): Partial<AppConfig> {
  const normalizedProfiles = nextProfiles.length
    ? nextProfiles
    : [resolveActiveTextProfile(config)];

  const activeProfile = normalizedProfiles.find((profile) => profile.id === nextActiveProfileId)
    ?? normalizedProfiles[0];

  return {
    active_text_profile_id: activeProfile.id,
    text_profiles: normalizedProfiles,
  };
}

// ── Per-Profile Settings Patch Helpers ───────────────────────────────────────

export function buildProfileSpeechPatch(
  config: AppConfig,
  speechUpdate: Partial<ProfileSpeechSettings>,
): Partial<AppConfig> {
  const activeProfile = resolveActiveTextProfile(config);
  const currentSpeech = resolveProfileSpeechSettings(activeProfile);
  const nextSpeech = { ...currentSpeech, ...speechUpdate };
  const nextProfiles = config.text_profiles.map((profile) =>
    profile.id === activeProfile.id
      ? { ...profile, speech: nextSpeech }
      : profile,
  );
  return buildTextProfilesPatch(config, nextProfiles, activeProfile.id);
}

export function buildProfileModesPatch(
  config: AppConfig,
  modesUpdate: Partial<ProfileModesSettings>,
): Partial<AppConfig> {
  const activeProfile = resolveActiveTextProfile(config);
  const currentModes = resolveProfileModesSettings(activeProfile);
  const nextModes = { ...currentModes, ...modesUpdate };
  const nextProfiles = config.text_profiles.map((profile) =>
    profile.id === activeProfile.id
      ? { ...profile, modes: nextModes }
      : profile,
  );
  return buildTextProfilesPatch(config, nextProfiles, activeProfile.id);
}

export function buildProfileCapturePatch(
  config: AppConfig,
  captureUpdate: Partial<ProfileCaptureSettings>,
): Partial<AppConfig> {
  const activeProfile = resolveActiveTextProfile(config);
  const currentCapture = resolveProfileCaptureSettings(activeProfile);
  const nextCapture = { ...currentCapture, ...captureUpdate };
  const nextProfiles = config.text_profiles.map((profile) =>
    profile.id === activeProfile.id
      ? { ...profile, capture: nextCapture }
      : profile,
  );
  return buildTextProfilesPatch(config, nextProfiles, activeProfile.id);
}

export function textProfileInitials(profile: TextProfile): string {
  const words = (profile.label.trim() || "Profile")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return (words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "PR").slice(0, 2);
}