import type {
  AppConfig,
  CommunicationRegister,
  DictionaryEntry,
  JobKey,
  LocalProfileDecodeSettings,
  LocalProfilePromptSettings,
  ProfileCaptureSettings,
  ProfileModesSettings,
  ProfileProviderSettings,
  Connection,
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

/** The id the migration gives this machine's first account, and the one a
 *  profile with no written axis falls back to. Mirrors
 *  `core::config::DEFAULT_CONNECTION_ID` — a stable string rather than a
 *  generated one, because two sides have to agree on it without having met. */
export const DEFAULT_CONNECTION_ID = "connection-default";

/** The connection a fresh install starts with, mirroring `default_connection`. */
const SEEDED_CONNECTION: Connection = {
  id: DEFAULT_CONNECTION_ID,
  label: "Groq",
  provider: "groq",
  base_url: "",
  model: "",
  plan: "",
};

/** Every account this machine holds, with an absent list read as the seeded one.
 *
 *  Mirrors `AppConfig::connections` (ADR 0208), including the distinction the
 *  `Option` carries: **never written** is not **written empty**. A config this
 *  build has not lifted yet still has to answer *where does a job run*, and a
 *  reader who deleted every account is answered with none. */
export function resolveConnections(config: AppConfig): Connection[] {
  return config.connections ?? [SEEDED_CONNECTION];
}

/** One account by id, or `undefined` for one this machine no longer holds. */
export function connectionById(
  config: AppConfig,
  id: string,
): Connection | undefined {
  return resolveConnections(config).find((entry) => entry.id === id);
}

/** The account the active profile's dictation runs on — the one the connection
 *  card configures and every credential row on it is scoped to. */
export function activeConnection(config: AppConfig): Connection | undefined {
  return connectionById(config, resolveConfigJobProvider(config, "dictation").connection);
}
import { runtimeDefault } from "./modelCatalogue";

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
function createRuleId(prefix: "dict" | "snippet" | "vocab") {
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

/** The axis a fresh profile starts on: one connection, nothing overriding it. */
/** Mirrors `ProfileProviderSettings::default()`.
 *
 *  **The value is an ACCOUNT id since ADR 0208**, not a vendor id: a profile
 *  points at a connection and the connection names the vendor. The seeded id is
 *  a constant on both sides for the reason the Rust one is — a profile block
 *  written before any account existed still has to name the one the machine is
 *  given on its first load. */
export function createDefaultProfileProviderSettings(): ProfileProviderSettings {
  return { default: DEFAULT_CONNECTION_ID, overrides: {} };
}

/* The mirror of `ProfileSpeechSettings::default()`, and the four model fields
   now come off the same catalogue the Rust default reads (ADR 0115) — they were
   a hand-kept copy of four literals in `core/config.rs`, which is one of the
   three places a model id used to live. `local_model` stays a literal: `base` is
   a whisper.cpp file stem that `core::providers::local` resolves to
   `ggml-{stem}.bin`, not a vendor's model id. */
export function createDefaultProfileSpeechSettings(): ProfileSpeechSettings {
  return {
    model: runtimeDefault("speech"),
    language: "",
    language_locked: false,
    correction_model: runtimeDefault("correction"),
    local_correction_model: runtimeDefault("local_correction"),
    agent_model: runtimeDefault("agent"),
    local_agent_model: runtimeDefault("local_agent"),
    local_model: "base",
    local_profile: "local-base-fast",
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

function cloneProfileProviderSettings(
  settings?: ProfileProviderSettings | null,
): ProfileProviderSettings {
  if (!settings) return createDefaultProfileProviderSettings();
  return { default: settings.default, overrides: { ...(settings.overrides ?? {}) } };
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
  return {
    ...defaults,
    ...settings,
    // Absent in a block written before the toggle existed. The pre-rename key
    // `auto_detect_mode` was read here too until ADR 0112; the runtime no
    // longer accepts it either, so there is no second name to fall back to.
    collect_workspace_context:
      settings.collect_workspace_context ?? defaults.collect_workspace_context,
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

export function resolveProfileProviderSettings(
  profile: Pick<TextProfile, "providers">,
): ProfileProviderSettings {
  return cloneProfileProviderSettings(profile.providers);
}

/** What one job runs on: its own override, or the profile's connection when it
 *  has none.
 *
 *  Mirrors `ProfileProviderSettings::resolve` — the runtime owns the decision
 *  and this restates it for a surface that has to draw the answer, **including
 *  the vendor lookup** (ADR 0208): the profile names a connection and the
 *  connection names the vendor, so a caller with no connection list gets the
 *  name and an empty vendor rather than a guess. An empty `provider` is a
 *  connection this machine no longer holds. */
export function resolveJobProvider(
  profile: Pick<TextProfile, "providers">,
  job: JobKey,
  connections: Connection[] = [],
): { connection: string; provider: string; overridden: boolean } {
  const axis = resolveProfileProviderSettings(profile);
  const override = axis.overrides[job];
  const connection = override === undefined ? axis.default : override;
  return {
    connection,
    provider: connections.find((entry) => entry.id === connection)?.provider ?? "",
    overridden: override !== undefined,
  };
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

/** The profile shape this build writes, mirroring `config.rs`.
 *
 *  It read `2` until ADR 0112, because this file could honestly perform only
 *  the first of the runtime's four migrations and claiming a higher number
 *  would have told the runtime the later steps had run. There are no migrations
 *  left on either side, so a profile the UI creates is a current-shape profile
 *  and says so. */
export const TEXT_PROFILE_SCHEMA_VERSION = 4;

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
    providers: cloneProfileProviderSettings(overrides.providers ?? profile.providers),
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

/** What one job runs on for the machine's active profile, mirroring
 *  `AppConfig::job_provider`. The one door a surface asks the provider axis
 *  through — reaching into `providers.overrides` at a call site is how the
 *  drawing and the runtime start answering differently. */
export function resolveConfigJobProvider(
  config: AppConfig,
  job: JobKey,
): { connection: string; provider: string; overridden: boolean } {
  return resolveJobProvider(
    resolveActiveTextProfile(config),
    job,
    resolveConnections(config),
  );
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
    providers: createDefaultProfileProviderSettings(),
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
    providers: createDefaultProfileProviderSettings(),
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
 * IT CONVERTS THE WORDS HERE, AND THIS IS THE ONLY PLACE LEFT THAT DOES. The
 * conversion used to be `migrateLegacyBiasPolicyToVocabularyHints`, a mirror of
 * `TextProfile::migrate_vocabulary_hints` in `config.rs`, and the import ran it
 * because a document IS a v1-shaped payload. ADR 0112 removed the runtime
 * migration — nothing on this machine's disk needs it — but an archive arrives
 * from somebody else's, and the newline string is still the only home its
 * schema has for terms. So the conversion moved to the door it was always
 * really serving. A document whose words stayed in `stt_hints` would reach no
 * recognizer (ADR 0035); dropping them here would be the import quietly
 * discarding half of what the file carries.
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
  return {
    ...createTextProfile(),
    label,
    prompt: document.prompt,
    // Kept beside the converted terms rather than cleared: it is what the file
    // said, and `text_rules.rs` still reads it for a document that carries its
    // phrases nowhere else.
    stt_hints: document.stt_hints,
    vocabulary_hints: vocabularyHintsFromDocumentTerms(document.stt_hints),
    dictionary_entries: document.dictionary_entries.map((entry) => ({
      ...entry,
      id: createRuleId("dict"),
    })),
    snippet_entries: document.snippet_entries.map((entry) => ({
      ...entry,
      id: createRuleId("snippet"),
    })),
  };
}

/** The document schema's newline string as per-entry vocabulary.
 *
 *  The three limits are the recognizer's own — 48 characters, four words, four
 *  slots — and this is a copy of them, which is a cost the import pays
 *  knowingly: the runtime resolves what actually reaches the recognizer
 *  (`select_recognizer_slots`), so a drift here changes what an import creates
 *  and never what a capture sends. */
function vocabularyHintsFromDocumentTerms(sttHints: string): TextProfile["vocabulary_hints"] {
  return (sttHints ?? "")
    .split("\n")
    .map((line) => line.split(/\s+/).filter(Boolean).join(" "))
    .filter((phrase) => phrase.length > 0 && phrase.length <= 48 && phrase.split(" ").length <= 4)
    .slice(0, 4)
    .map((phrase) => ({
      id: createRuleId("vocab"),
      phrase,
      // Nothing about a file says a term was learned, and an imported row is
      // one somebody wrote down.
      use_as_prompt_hint: false,
      origin: "user" as const,
      learned_at_ms: null,
      hit_count: 0,
      observation_count: 0,
    }));
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

/** Writes the provider axis of the active profile (ADR 0094's config half).
 *
 *  **The axis A4 built and nothing could set.** That step landed the shape and
 *  said so explicitly: the runtime honours a per-job provider and the surface
 *  cannot yet write one. This is the door, and it opens onto the CONNECTION —
 *  `default` — because that is what makes a second lane operable. The per-job
 *  `overrides` map is writable through the same patch, and the surface that
 *  writes it is a drawing decision that is not this step's to take (see
 *  `docs/PROVIDERS.md`, open disagreement 13). */
export function buildProfileProvidersPatch(
  config: AppConfig,
  providersUpdate: Partial<ProfileProviderSettings>,
): Partial<AppConfig> {
  const activeProfile = resolveActiveTextProfile(config);
  const currentProviders = resolveProfileProviderSettings(activeProfile);
  const nextProviders = { ...currentProviders, ...providersUpdate };
  const nextProfiles = config.text_profiles.map((profile) =>
    profile.id === activeProfile.id
      ? { ...profile, providers: nextProviders }
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
/* ════════════════════════════════════════════════════════════════════════════
   WHEN THE ACTIVE PROFILE MAY NOT BE SWITCHED, AND WHAT TO SAY ABOUT IT.

   The runtime is the authority — `sessions::PROFILE_LOCKED_DURING_SESSION` —
   and three surfaces now have to agree with it: the sidebar switcher, the
   settings header's, and the Profiles row menu (ADR 0197). Each of them had, or
   would have grown, its own spelling of "recording or processing" and its own
   sentence about why. That is three copies of one rule, which is how two of them
   end up disagreeing with the runtime and each other (ADR 0123).

   It lives with the profile helpers because the question is about a PROFILE —
   can this one be made active right now — rather than about the session, which
   is only the reason the answer is no.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Whether a capture or its pipeline is running, which is when the runtime
 *  refuses a profile switch. */
export function profileSwitchLocked(state: { status?: string } | null | undefined): boolean {
  return state?.status === "recording" || state?.status === "processing";
}

/** What a locked control says on the surface: three words, because a control
 *  that is refusing has to say THAT it is refusing and nothing else (ADR 0196). */
export const PROFILE_LOCKED_LINE = "Locked while recording";

/** And why, on the hover or in a menu entry's hint, where a sentence is
 *  affordable. Mirrors the runtime's own refusal. */
export const PROFILE_LOCKED_HINT =
  "Locked while recording — the profile sets the recognizer, which is fixed once a recording starts. The processing mode can still be changed.";
