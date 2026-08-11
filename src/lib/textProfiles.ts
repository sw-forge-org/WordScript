import type {
  AppConfig,
  CommunicationRegister,
  DictionaryEntry,
  LocalProfileDecodeSettings,
  LocalProfilePromptSettings,
  ProfileCaptureSettings,
  ProfileModesSettings,
  ProfileSpeechSettings,
  SnippetEntry,
  TextProfile,
  TextProfileCuration,
  TextProfileInsertBehavior,
  TextProfileRecoveryBehavior,
  TextProfileRewriteStyle,
  TextProfileWorkMode,
} from "../types/ipc";
import { PROCESSING_MODE_LABELS } from "./transformRules";

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `profile-${crypto.randomUUID()}`;
  }

  return `profile-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

/** A rule's id, on the same construction as a profile's.
 *
 *  IT HAS TO BE STABLE AND UNIQUE FOR A REASON BEYOND REACT KEYS: the runtime
 *  names the rule that fired in its applied-rules line (`rule_label` in
 *  `transform.rs`), and `analyze_text_rules` routes every issue back through
 *  `rule_ids`. Two entries sharing an id make both of those point at the wrong
 *  row, which the analysis reports as `duplicate_rule_id`. */
function createRuleId(prefix: "dict" | "snippet") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function createDictionaryEntry(phrase = "", replaceWith = ""): DictionaryEntry {
  return { id: createRuleId("dict"), phrase, replace_with: replaceWith };
}

export function createSnippetEntry(
  trigger = "",
  expansion = "",
  label = "",
): SnippetEntry {
  return { id: createRuleId("snippet"), label, trigger, expansion };
}

/** Move one entry of an ordered rule list, and it is a library function because
 *  BOTH lists are ordered and the runtime reads both orders the same way:
 *  `apply_dictionary_entries` and `apply_snippet_entries` each feed one rule's
 *  output into the next. A screen-local copy per list is how the two drift. */
export function moveEntry<T>(entries: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= entries.length || target < 0 || target >= entries.length) {
    return entries;
  }
  const next = [...entries];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
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
    collect_workspace_context: true,
    agent_name: "WordScript",
    communication_register: "off",
    communication_length: "normal",
    style_instructions: "",
    style_sample: "",
    translate_target_language: "en",
    translate_keep_profile_words: true,
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
  const defaults = createDefaultProfileModesSettings();
  if (!settings) return defaults;
  // Configs written before the rename carry `auto_detect_mode`. Rust accepts it
  // as a serde alias; the UI has to accept the same shape so a profile loaded
  // from such a config does not read the toggle as undefined and render it off.
  const legacy = (settings as ProfileModesSettings & { auto_detect_mode?: boolean })
    .auto_detect_mode;
  return {
    ...defaults,
    ...settings,
    collect_workspace_context:
      settings.collect_workspace_context ?? legacy ?? defaults.collect_workspace_context,
    // Absent in every config written before the communication style existed.
    // Spreading `settings` over the defaults would put `undefined` back on top
    // of them, and a Select bound to `undefined` renders as uncontrolled.
    communication_register: settings.communication_register ?? defaults.communication_register,
    communication_length: settings.communication_length ?? defaults.communication_length,
    style_instructions: settings.style_instructions ?? defaults.style_instructions,
    style_sample: settings.style_sample ?? defaults.style_sample,
    // Absent for the same reason and with the same consequence: a Select bound
    // to `undefined` renders as uncontrolled, and a Toggle bound to it renders
    // off while the runtime keeps the terms.
    translate_target_language:
      settings.translate_target_language ?? defaults.translate_target_language,
    translate_keep_profile_words:
      settings.translate_keep_profile_words ?? defaults.translate_keep_profile_words,
  };
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

/** The words the rest of the product uses for the same value — the Delivery
 *  segment on this screen, the strip along the bottom of the window and the
 *  Delivery & Insert section all read `Insert at cursor` / `Clipboard only`.
 *  `Auto-paste delivery` was this file's own private vocabulary for it and was
 *  the only place either phrase appeared. */
function insertBehaviorLabel(value: TextProfileInsertBehavior): string {
  switch (value) {
    case "clipboard_only":
      return "Clipboard only";
    default:
      return "Insert at cursor";
  }
}

/** `off` is not drawn — a profile with no register shows its delivery instead,
 *  which is the pair the prototype draws on two of its three rows. */
function communicationRegisterLabel(register: CommunicationRegister): string | null {
  switch (register) {
    case "off":
      return null;
    case "quick":
      return "Quick-message register";
    default:
      return `${register[0].toUpperCase()}${register.slice(1)} register`;
  }
}

/**
 * THE PROFILE LIST'S SUBLINE — decided in Leg 4d, not guessed, because Leg 4c
 * found it returning the IDENTICAL string for all six profiles on the owner's
 * machine and §2.5 recorded it as nobody's decision.
 *
 * WHAT WAS ACTUALLY WRONG WAS NOT THAT IT REPEATED. It stated one fact three
 * times. `recovery_behavior` has exactly one value in the type
 * (`TextProfileRecoveryBehavior = "standard"`), so `Standard recovery` was a
 * constant on every profile that has ever existed. And `rewrite_style` is
 * DERIVED from the processing mode, collapsing six modes onto three labels —
 * `auto`, `cleanup`, `agent` and `prompt_enhance` all read `Clean rewrite`. Two
 * of the three clauses could not vary, and the one that could was a lossy
 * function of a value the row was not showing.
 *
 * SO IT STATES THE MODE ITSELF AND ONE SECOND FACT, which is the drawing's own
 * shape: `Auto · Insert at cursor`, `Rewrite · Client register`, `Rewrite ·
 * Clipboard only`. A mode and a delivery, not a sentence.
 *
 * THE SECOND SLOT IS THE REGISTER WHEN THERE IS ONE AND THE DELIVERY OTHERWISE,
 * and that is what reproduces all three drawn rows exactly rather than two of
 * them. A register is opt-in, defaults to `off`, and is the one thing about a
 * profile with no other surface than the tab ADR 0068 adds — so where it is
 * set it is the most specific true thing about that profile. Delivery is one of
 * two values and is the fallback.
 *
 * IT IS A SUMMARY, NOT A KEY. Five profiles configured the same way read the
 * same, and that is the honest answer: the thing that tells two profiles apart
 * is the name above this line. Inventing a difference where the runtime holds
 * none would be the fake-readiness defect in a subtitle.
 */
export function describeTextProfileWorkMode(
  profile: Pick<TextProfile, "work_mode" | "modes">,
): string {
  const workMode = resolveTextProfileWorkMode(profile);
  const register = communicationRegisterLabel(
    resolveProfileModesSettings(profile).communication_register,
  );
  /* `processing_mode` is optional on the wire and a profile written before it
     existed carries none. The runtime resolves that absence to Auto, so the
     subline says Auto rather than a blank — the same default the screen's own
     mode select applies. */
  return `${PROCESSING_MODE_LABELS[workMode.processing_mode ?? "auto"]} · ${
    register ?? insertBehaviorLabel(workMode.insert_behavior)
  }`;
}

/** The version this mirror can honestly produce, which is deliberately not the
 *  runtime's current one (`config.rs` is at 4).
 *
 *  This file mirrors one migration: the free-text hint blob to per-entry
 *  vocabulary. The later steps — restoring a curated context field to topics,
 *  and the origin field — belong to the runtime and are not reproduced here.
 *  Claiming a higher number would tell the runtime those steps had run. */
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
            // Nothing was learning terms before this migration existed, so a
            // row it produces is the user's by definition.
            origin: "user" as const,
            learned_at_ms: null,
            hit_count: 0,
            observation_count: 0,
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

/**
 * A COPY OF A PROFILE, WITH IDENTITIES OF ITS OWN (ADR 0082).
 *
 * It re-ids the RULES as well as the profile. `rule_label` in `transform.rs`
 * puts a rule's id into the runtime's applied-rules line, so two profiles
 * carrying the same rule id make that line ambiguous about which profile's rule
 * fired — and `analyze_text_rules` reports `duplicate_rule_id` for entries that
 * are genuinely different rules the moment the two are ever merged.
 *
 * The copy is not curated, for the reason `clearTextProfileCuration` exists: a
 * curated profile somebody has taken a copy of to change is no longer the one
 * WordScript ships.
 */
export function duplicateTextProfile(profile: TextProfile, label: string): TextProfile {
  return cloneTextProfile(profile, {
    id: createProfileId(),
    label,
    curation: createEmptyTextProfileCuration(),
    dictionary_entries: profile.dictionary_entries.map((entry) => ({
      ...entry,
      id: createRuleId("dict"),
    })),
    snippet_entries: profile.snippet_entries.map((entry) => ({
      ...entry,
      id: createRuleId("snippet"),
    })),
  });
}

/**
 * WHAT A PROFILE PUTS IN A SHAREABLE RULES FILE (ADR 0090).
 *
 * `TextRulesDocument` is the runtime's own schema and carries four things: the
 * prompt, the words, the replacements and the snippets. It is a profile's
 * CONTENT and none of its settings — a rules file that carried a delivery
 * target or a processing mode would be a profile, and a profile is what
 * `export_full_backup` already moves.
 *
 * THE WORDS COME FROM `vocabulary_hints` AND NOT FROM `stt_hints`, which is the
 * one thing about this that is not mechanical. The document schema is v1 and
 * predates the per-entry vocabulary model, so its only home for terms is the
 * legacy newline string — but `stt_hints` is a field the current surface never
 * writes (ADR 0035: it survives migration and no longer feeds the recognizer).
 * Exporting it would write whatever string a profile happened to carry from
 * before its migration and silently drop every word the user has added since.
 */
export function textRulesDocumentFromProfile(profile: TextProfile): {
  prompt: string;
  stt_hints: string;
  dictionary_entries: DictionaryEntry[];
  snippet_entries: SnippetEntry[];
} {
  return {
    prompt: profile.prompt,
    stt_hints: profile.vocabulary_hints.map((hint) => hint.phrase).join("\n"),
    dictionary_entries: profile.dictionary_entries,
    snippet_entries: profile.snippet_entries,
  };
}

/**
 * A NEW PROFILE FROM AN IMPORTED RULES FILE (ADR 0090).
 *
 * IT RE-IDS THE RULES, for `duplicateTextProfile`'s reason and one more. A
 * file's rule ids were minted in somebody else's profile, so importing them
 * verbatim is the `duplicate_rule_id` collision that function exists against —
 * except here the two profiles are not even related, so nothing about the
 * collision would look like a copy to whoever eventually reads the runtime's
 * applied-rules line.
 *
 * IT RUNS THE LEGACY MIGRATION RATHER THAN CONVERTING THE WORDS ITSELF. An
 * imported document IS a v1-shaped payload — terms in the newline string,
 * nothing in `vocabulary_hints` — and the product already owns exactly one
 * function that turns that shape into the current one, mirroring
 * `TextProfile::migrate_vocabulary_hints` in `config.rs`. Converting the string
 * here would be a second copy of the recognizer's own limits (48 characters,
 * four words, four slots), and the copy that drifts is the one that decides an
 * imported word reaches the recognizer when the runtime says it does not.
 */
export function textProfileFromRulesDocument(
  document: {
    prompt: string;
    stt_hints: string;
    dictionary_entries: DictionaryEntry[];
    snippet_entries: SnippetEntry[];
  },
  label: string,
): TextProfile {
  const imported: TextProfile = {
    ...createTextProfile(),
    label,
    prompt: document.prompt,
    stt_hints: document.stt_hints,
    vocabulary_hints: [],
    // The migration is a no-op at or above the current schema version, so the
    // profile has to declare the version its payload actually is.
    schema_version: 1,
    dictionary_entries: document.dictionary_entries.map((entry) => ({
      ...entry,
      id: createRuleId("dict"),
    })),
    snippet_entries: document.snippet_entries.map((entry) => ({
      ...entry,
      id: createRuleId("snippet"),
    })),
  };

  return migrateLegacyBiasPolicyToVocabularyHints(imported);
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