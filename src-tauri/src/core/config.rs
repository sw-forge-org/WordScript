use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::communication_style::{
    CommunicationLength, CommunicationRegister, CommunicationStyle,
};
use super::paths::config_file_path;
use super::providers::{
    default_provider_id, migrate_legacy_provider_api_key, normalize_provider_value,
    provider_credentials_configured,
};
use super::runtime_log;

/// Serializes every load -> modify -> save sequence touching `config.json`.
/// Without this, parallel Tauri commands race on the config file: e.g. a
/// `save_config` (frontend writing `insert_behavior`) and a
/// `set_active_profile_processing_mode` (mode hotkey writing `processing_mode`)
/// both do load -> modify -> save. If the mode command reads a stale file
/// before the frontend's save lands and writes back after it, it silently
/// overwrites the user's `insert_behavior` change ("settings switch back to
/// clipboard only"). Commands that read-modify-write the config must hold this
/// lock for the whole sequence so each sees the latest on-disk state.
static CONFIG_FILE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn config_file_lock() -> &'static Mutex<()> {
    CONFIG_FILE_LOCK.get_or_init(|| Mutex::new(()))
}

/// Runs `f` while holding the config file lock. Returns a poison/lock error as
/// a String so command handlers can surface it.
pub fn with_config_file_lock<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce() -> R,
{
    let guard = config_file_lock()
        .lock()
        .map_err(|error| format!("config lock poisoned: {error}"))?;
    let result = f();
    drop(guard);
    Ok(result)
}

pub const DEFAULT_CORRECTION_MODEL: &str = "llama-3.3-70b-versatile";
pub const DEFAULT_LOCAL_CORRECTION_MODEL: &str = "llama3.2:latest";
pub const DEFAULT_AGENT_MODEL: &str = "llama-3.3-70b-versatile";
pub const DEFAULT_LOCAL_AGENT_MODEL: &str = "llama3.2:latest";
pub const DEFAULT_AGENT_NAME: &str = "WordScript";

/// Current version of the shortcut half of the config schema. Legacy shortcut
/// rewrites are gated on this so they run once instead of on every save.
pub const SHORTCUT_SCHEMA_VERSION: u32 = 2;

/// The mode lane defaults up to shortcut schema version 1, in the order the
/// version-2 migration walks them. Kept as a table so the migration recognizes
/// an untouched old default instead of guessing at a value the user picked.
const LEGACY_MODE_HOTKEYS: [&str; 7] = [
    "Ctrl+S",
    "Ctrl+1",
    "Ctrl+2",
    "Ctrl+3",
    "Ctrl+4",
    "Ctrl+5",
    "Ctrl+6",
];

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ProcessingMode {
    #[default]
    Auto,
    Cleanup,
    Rewrite,
    /// Renders the dictation in another language instead of tidying it
    /// (ADR 0041). It owns its own prompt in `core::translate` and is not a
    /// member of the cleanup family: a translation replaces every word, which
    /// is the opposite of a correction that has to stay near its input.
    Translate,
    Agent,
    PromptEnhance,
    Verbatim,
}

impl ProcessingMode {
    // String form mirrors the serde snake_case representation; kept in sync with the
    // TypeScript `ProcessingMode` union and used where a stable token is needed.
    pub fn as_str(&self) -> &'static str {
        match self {
            ProcessingMode::Auto => "auto",
            ProcessingMode::Cleanup => "cleanup",
            ProcessingMode::Rewrite => "rewrite",
            ProcessingMode::Translate => "translate",
            ProcessingMode::Agent => "agent",
            ProcessingMode::PromptEnhance => "prompt_enhance",
            ProcessingMode::Verbatim => "verbatim",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "auto" => ProcessingMode::Auto,
            "verbatim" => ProcessingMode::Verbatim,
            "rewrite" | "polished" | "professional" => ProcessingMode::Rewrite,
            "translate" => ProcessingMode::Translate,
            "agent" => ProcessingMode::Agent,
            "prompt_enhance" => ProcessingMode::PromptEnhance,
            _ => ProcessingMode::Cleanup,
        }
    }

    /// Returns true when this mode requires an LLM to decide which concrete
    /// processing path applies per transcription. `Auto` is the only meta-mode;
    /// all others are concrete.
    pub fn is_auto(&self) -> bool {
        matches!(self, ProcessingMode::Auto)
    }

    /// Returns true when this mode routes the transcript through the cleanup /
    /// rewrite transform pipeline (i.e. is not verbatim, translate, agent or
    /// prompt enhance). `Auto` is excluded because it is resolved into a
    /// concrete mode before the transform runs.
    pub fn is_cleanup_family(&self) -> bool {
        matches!(self, ProcessingMode::Cleanup | ProcessingMode::Rewrite)
    }

    /// The transform behavior this mode implies. The mode is the ONLY input —
    /// there is deliberately no per-profile override, because the three toggles
    /// that used to look like overrides never were one: `effective_filter_fillers`
    /// and `effective_professionalize` took the stored value as an argument and
    /// discarded it (`let _ = fallback;`), so Settings showed three controls the
    /// pipeline could not observe. Across 1586 live correction calls only the
    /// three mode-derived combinations below ever occurred. See ADR 0020.
    pub fn transform_preset(&self) -> TransformPreset {
        match self {
            // Raw text: the correction step is skipped entirely.
            ProcessingMode::Verbatim => TransformPreset {
                post_process: false,
                filter_fillers: false,
                professionalize: false,
            },
            ProcessingMode::Cleanup => TransformPreset {
                post_process: true,
                filter_fillers: true,
                professionalize: false,
            },
            ProcessingMode::Rewrite => TransformPreset {
                post_process: true,
                filter_fillers: true,
                professionalize: true,
            },
            // Agent, Prompt Enhance and Translate own their own prompts and do
            // not run the correction transform in the live pipeline. The preset
            // still matters for the history re-transform, where the conservative
            // arm applies: fix obvious typos, never remove or reformulate. For
            // Translate that arm is also the only safe one, because the
            // correction prompt forbids translating and re-running it over an
            // already translated record must not undo the mode's own work.
            ProcessingMode::Agent
            | ProcessingMode::PromptEnhance
            | ProcessingMode::Translate => TransformPreset {
                post_process: true,
                filter_fillers: false,
                professionalize: false,
            },
            // Auto is resolved into a concrete mode before the transform runs, so
            // this arm is only reached by callers that ask about an unresolved
            // mode. Answer with the same safe default Auto resolves to.
            ProcessingMode::Auto => TransformPreset {
                post_process: true,
                filter_fillers: true,
                professionalize: false,
            },
        }
    }

    /// The display style token (`verbatim` / `clean` / `polished`) implied by
    /// this mode. Derived rather than stored so a profile cannot present
    /// "polished" while running `cleanup` — the live config had exactly that
    /// contradiction on `curated-customer-success`.
    pub fn rewrite_style_token(&self) -> &'static str {
        match self {
            ProcessingMode::Verbatim => "verbatim",
            ProcessingMode::Rewrite => "polished",
            ProcessingMode::Auto
            | ProcessingMode::Cleanup
            | ProcessingMode::Translate
            | ProcessingMode::Agent
            | ProcessingMode::PromptEnhance => "clean",
        }
    }
}

/// The three correction-pipeline switches, resolved from the effective
/// processing mode. Built only by [`ProcessingMode::transform_preset`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransformPreset {
    pub post_process: bool,
    pub filter_fillers: bool,
    pub professionalize: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum EnhanceSubMode {
    #[default]
    Enhance,
    Expand,
}

impl EnhanceSubMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            EnhanceSubMode::Enhance => "enhance",
            EnhanceSubMode::Expand => "expand",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "expand" => EnhanceSubMode::Expand,
            _ => EnhanceSubMode::Enhance,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum PromptTarget {
    #[default]
    General,
    ClaudeCode,
    Cursor,
    ChatGPT,
    Copilot,
}

impl PromptTarget {
    pub fn as_str(&self) -> &'static str {
        match self {
            PromptTarget::General => "general",
            PromptTarget::ClaudeCode => "claude_code",
            PromptTarget::Cursor => "cursor",
            PromptTarget::ChatGPT => "chatgpt",
            PromptTarget::Copilot => "copilot",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "claude_code" => PromptTarget::ClaudeCode,
            "cursor" => PromptTarget::Cursor,
            "chatgpt" => PromptTarget::ChatGPT,
            "copilot" => PromptTarget::Copilot,
            _ => PromptTarget::General,
        }
    }
}

/// What Translate does when the dictation is already in the target language.
///
/// It is a stored setting rather than a per-dictation judgement, which is the
/// point ADR 0041 makes about it: the model still decides whether the two
/// languages match, because it is the thing reading the text, but it never
/// decides what follows from that. `Cleanup` is the default because a
/// transcript that reaches an LLM and comes back untouched is the one outcome
/// the user cannot tell apart from a failure.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TranslateSameLanguage {
    PassThrough,
    #[default]
    Cleanup,
}

impl TranslateSameLanguage {
    pub fn as_str(&self) -> &'static str {
        match self {
            TranslateSameLanguage::PassThrough => "pass_through",
            TranslateSameLanguage::Cleanup => "cleanup",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "pass_through" => TranslateSameLanguage::PassThrough,
            _ => TranslateSameLanguage::Cleanup,
        }
    }
}

/// The address form a translation uses.
///
/// German, French and Spanish force a choice English does not carry, so a
/// translation into any of them has to answer it before the first sentence.
/// `AsDictated` keeps a formal sentence formal and is the default, because it
/// is the only value that adds no decision of its own.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TranslateAddressForm {
    #[default]
    AsDictated,
    Formal,
    Informal,
}

impl TranslateAddressForm {
    pub fn as_str(&self) -> &'static str {
        match self {
            TranslateAddressForm::AsDictated => "as_dictated",
            TranslateAddressForm::Formal => "formal",
            TranslateAddressForm::Informal => "informal",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "formal" => TranslateAddressForm::Formal,
            "informal" => TranslateAddressForm::Informal,
            _ => TranslateAddressForm::AsDictated,
        }
    }
}

/// The languages Translate offers, as ISO 639-1 codes paired with the English
/// name the prompt uses.
///
/// A code is stored and a name is sent. Storing the display name would put a
/// piece of user-facing English in the config file, where a later translation
/// of the surface would silently change what the prompt asks for.
pub const TRANSLATE_LANGUAGES: [(&str, &str); 8] = [
    ("en", "English"),
    ("de", "German"),
    ("fr", "French"),
    ("es", "Spanish"),
    ("it", "Italian"),
    ("pt", "Portuguese"),
    ("nl", "Dutch"),
    ("pl", "Polish"),
];

/// The English name for a stored target-language code, defaulting to English.
///
/// The permissive default matches `ProcessingMode::from_str`: a config written
/// by a newer build must not stop a translation, it may only make it land in
/// the wrong language, which is recoverable and visible.
pub fn translate_language_name(code: &str) -> &'static str {
    let wanted = code.trim().to_lowercase();
    TRANSLATE_LANGUAGES
        .iter()
        .find(|(candidate, _)| *candidate == wanted)
        .map(|(_, name)| *name)
        .unwrap_or("English")
}

/// Normalizes a stored target-language code, defaulting to English.
pub fn normalize_translate_language(code: &str) -> String {
    let wanted = code.trim().to_lowercase();
    TRANSLATE_LANGUAGES
        .iter()
        .find(|(candidate, _)| *candidate == wanted)
        .map(|(candidate, _)| (*candidate).to_string())
        .unwrap_or_else(|| default_translate_target_language().to_string())
}

pub fn default_translate_target_language() -> &'static str {
    "en"
}

/// The four answers a translation needs, resolved into one value.
///
/// Two of them are the profile's and two are the machine's, which is the scope
/// split the drawing gives them, and the resolver exists for the same reason
/// `active_text_profile_communication_style` does: a setting each call site
/// reaches for on its own is a setting that ends up read in one place and
/// forgotten in another. It is serializable because it is snapshotted into the
/// capture config at capture start, so a mid-recording edit lands on the next
/// session rather than half of the current one (ADR 0025).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct TranslateSettings {
    /// ISO 639-1, already normalized against `TRANSLATE_LANGUAGES`.
    pub target_language: String,
    pub same_language: TranslateSameLanguage,
    pub address_form: TranslateAddressForm,
    pub keep_profile_words: bool,
}

impl Default for TranslateSettings {
    fn default() -> Self {
        Self {
            target_language: default_translate_target_language().to_string(),
            same_language: TranslateSameLanguage::default(),
            address_form: TranslateAddressForm::default(),
            keep_profile_words: default_translate_keep_profile_words(),
        }
    }
}

impl TranslateSettings {
    /// The English name of the target language, for the prompt.
    pub fn target_language_name(&self) -> &'static str {
        translate_language_name(&self.target_language)
    }
}

fn default_profile_translate_target_language() -> String {
    default_translate_target_language().to_string()
}

fn default_translate_keep_profile_words() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DictionaryEntry {
    pub id: String,
    pub phrase: String,
    pub replace_with: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SnippetEntry {
    pub id: String,
    pub label: String,
    pub trigger: String,
    pub expansion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct TextProfileCuration {
    pub curated: bool,
    pub audience: String,
    pub summary: String,
    pub highlights: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum BiasMode {
    #[default]
    Conservative,
    Manual,
    Off,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(default)]
pub struct ManualBias {
    pub cloud_include_profile_terms: bool,
    pub local_include_profile_terms: bool,
    pub stt_hints_override: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct TextProfileWorkMode {
    #[serde(default)]
    pub rewrite_style: String,
    pub insert_behavior: String,
    pub recovery_behavior: String,
    #[serde(default)]
    pub processing_mode: ProcessingMode,
    #[serde(default)]
    pub enhance_sub_mode: Option<EnhanceSubMode>,
    #[serde(default)]
    pub target: Option<PromptTarget>,
    #[serde(default)]
    pub bias_mode: BiasMode,
    #[serde(default)]
    pub manual_bias: ManualBias,
}

impl Default for TextProfileWorkMode {
    fn default() -> Self {
        Self {
            rewrite_style: default_text_profile_rewrite_style().to_string(),
            insert_behavior: default_text_profile_insert_behavior().to_string(),
            recovery_behavior: default_text_profile_recovery_behavior().to_string(),
            processing_mode: ProcessingMode::default(),
            enhance_sub_mode: None,
            target: None,
            bias_mode: BiasMode::default(),
            manual_bias: ManualBias::default(),
        }
    }
}

impl TextProfileWorkMode {
    pub(crate) fn normalized(&self) -> Self {
        normalize_text_profile_work_mode(self)
    }

    /// The display style token for this work mode, derived from its processing
    /// mode. Takes no fallback arguments: the stored `rewrite_style` is a legacy
    /// field kept for serde compatibility and the v1 slice, not a second axis.
    pub(crate) fn effective_rewrite_style(&self) -> String {
        self.normalized()
            .processing_mode
            .rewrite_style_token()
            .to_string()
    }

    pub(crate) fn effective_processing_mode(&self) -> ProcessingMode {
        self.normalized().processing_mode.clone()
    }

    pub(crate) fn transform_preset(&self) -> TransformPreset {
        self.normalized().processing_mode.transform_preset()
    }

    pub(crate) fn effective_insert_behavior(&self) -> String {
        match self.normalized().insert_behavior.as_str() {
            "clipboard_only" => "clipboard_only".to_string(),
            "auto_paste" => "auto_paste".to_string(),
            // Unrecognized value (corrupt config) — default to auto_paste,
            // matching the profile default.
            _ => "auto_paste".to_string(),
        }
    }

    pub(crate) fn effective_auto_paste(&self) -> bool {
        self.effective_insert_behavior() == "auto_paste"
    }

    pub(crate) fn effective_recovery_behavior(&self) -> String {
        self.normalized().recovery_behavior
    }
}

/// Where a vocabulary entry came from.
///
/// The distinction is what lets the panel stop being a form: a learned row is
/// the display of something the runtime observed, a user row is a term someone
/// knew in advance. Removal works the same on both, because a wrong learned
/// term is removed rather than corrected (ADR 0033 — a term has no left-hand
/// side to fix).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VocabularyHintOrigin {
    /// Typed into the panel. Also what every pre-schema-4 entry migrates to:
    /// nothing was learning terms before, so no existing row can be one.
    #[default]
    User,
    /// Promoted by `vocabulary_learning` after a second sighting.
    Learned,
}

/// A word or name the profile carries.
///
/// `use_as_prompt_hint` is a migration remnant. It used to be the per-entry
/// recognizer opt-in, and its intuitive use was backwards: a user switches on
/// their most important terms, which are the long product names — exactly the
/// ones `vocabulary_repair` recovers reliably afterwards. The terms that
/// actually need a recognizer slot are the short ones, which are unrecoverable
/// once the transcript exists. The runtime allocates the slots now
/// (`recognizer_slot_phrases`) and nothing reads this field (ADR 0035). It is
/// kept the way `stt_hints` is kept, so an older config still loads.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(default)]
pub struct VocabularyHintEntry {
    pub id: String,
    pub phrase: String,
    pub use_as_prompt_hint: bool,
    pub origin: VocabularyHintOrigin,
    /// When the runtime promoted this term. `None` for a term someone typed.
    pub learned_at_ms: Option<u64>,
    /// How often deterministic repair has acted on this term. The panel says
    /// which rows earn their place instead of leaving a term list nobody can
    /// judge.
    pub hit_count: u32,
    /// How many times the correction stage was seen repairing this term before
    /// it was promoted. Ranks the recognizer's slots below the length rule.
    pub observation_count: u32,
}

/// Bumped when a profile's shape changes in a way that needs a one-time
/// migration on load. 1 = pre-vocabulary profiles carrying `stt_hints` as a
/// free-text blob plus a profile-wide bias policy. 2 = curated profiles whose
/// context field was seeded with spellings instead of topics (ADR 0032). 3 =
/// vocabulary entries that predate the learned/user distinction (ADR 0035).
pub const TEXT_PROFILE_SCHEMA_VERSION: u32 = 4;

/// The curated context fields as they were seeded between 2026-05-25 and
/// ADR 0032, when the field held spellings rather than the topics its own
/// description asks for.
///
/// Matched byte for byte and never by shape: an edited value must survive
/// untouched. This is the same restraint `refresh_curated_text_profile_presentation`
/// documents after the `work_mode` reset — a template may not overwrite what a
/// user can edit.
const LEXICAL_SEED_PROMPTS: &[(&str, &str)] = &[
    (
        "curated-customer-success",
        "WordScript\nSEV-1\nSEV-2\nSLA\nRCA\nKB\nStatuspage\nEnterprise plan",
    ),
    (
        "curated-sales",
        "WordScript\nCRM\nMRR\nACV\nPOC\nROI\nMSA\nMutual Action Plan",
    ),
    (
        "curated-founder-ops",
        "WordScript\nP&L\nOKR\nQBR\nSOP\n1:1\nBoard update\nBudget variance",
    ),
    (
        "curated-recruiting",
        "WordScript\nHR\nATS\nHM\nEOD\n1:1\nscorecard\nheadcount",
    ),
    (
        "curated-product-engineering",
        "WordScript\nAPI\nSDK\nSQL\nCI/CD\nSLO\nPR\nTauri",
    ),
];

fn default_text_profile_schema_version() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TextProfile {
    pub id: String,
    pub label: String,
    pub prompt: String,
    /// Legacy free-text hints. Migration-only from schema version 2 onwards:
    /// read once into `vocabulary_hints`, then left alone. Removed in a later
    /// release once no config in the wild still carries version 1.
    #[serde(default)]
    pub stt_hints: String,
    #[serde(default)]
    pub vocabulary_hints: Vec<VocabularyHintEntry>,
    #[serde(default = "default_text_profile_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub work_mode: TextProfileWorkMode,
    #[serde(default)]
    pub curation: TextProfileCuration,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
    // Per-profile settings (tab-oriented sub-objects)
    #[serde(default)]
    pub speech: Option<ProfileSpeechSettings>,
    #[serde(default)]
    pub modes: Option<ProfileModesSettings>,
    #[serde(default)]
    pub capture: Option<ProfileCaptureSettings>,
}

impl TextProfile {
    /// One-time move from the free-text `stt_hints` blob plus the profile-wide
    /// bias policy to per-entry vocabulary. Returns whether anything changed.
    ///
    /// Lines the hint filter would have ignored anyway are dropped here too,
    /// but logged rather than silently lost: they were never reaching Whisper,
    /// and carrying them forward would only recreate the illusion that they did.
    /// Runs every pending one-time migration in version order and lands the
    /// profile on the current schema. Returns whether anything changed.
    ///
    /// Each step guards on its own version rather than on the constant, so
    /// bumping the constant cannot silently re-run a migration that already
    /// happened.
    pub(crate) fn migrate_to_current_schema(&mut self) -> bool {
        let mut changed = self.migrate_vocabulary_hints();
        changed |= self.migrate_lexical_context_seed();
        changed |= self.migrate_vocabulary_origin();
        self.schema_version = TEXT_PROFILE_SCHEMA_VERSION;
        changed
    }

    /// Version 1 -> 2. Returns the curated context field to topics where it
    /// still holds the spellings seeded between 2026-05-25 and ADR 0032.
    ///
    /// Nothing moves to `vocabulary_hints`: every acronym in those seeds is
    /// already a `dictionary_entry`, which is where a dictated form maps to a
    /// written one, and copying it into the recognizer channel would recreate
    /// exactly the redundancy ADR 0017 removed.
    fn migrate_lexical_context_seed(&mut self) -> bool {
        if self.schema_version >= 3 {
            return false;
        }

        let Some((_, lexical_seed)) = LEXICAL_SEED_PROMPTS
            .iter()
            .find(|(id, _)| *id == self.id.as_str())
        else {
            return false;
        };

        if self.prompt != *lexical_seed {
            return false;
        }

        let Some(seed) = curated_text_profile_seeds()
            .into_iter()
            .find(|seed| seed.id == self.id)
        else {
            return false;
        };

        self.prompt = seed.prompt;
        super::runtime_log::record(format!(
            "[WordScript] Profile context restored to topics profile={}",
            self.id,
        ));
        true
    }

    /// Version 3 -> 4: vocabulary entries gained an origin.
    ///
    /// Every entry that existed before the runtime could learn one is the
    /// user's, by definition — nothing was promoting terms yet — and serde's
    /// default already lands there. So this step deliberately rewrites nothing.
    ///
    /// It would be easy to write the loop anyway "to be sure", and it would be
    /// a defect: the frontend mirror in `textProfiles.ts` writes profiles back
    /// at the version *it* can produce, so this step also runs over configs
    /// that already hold learned rows. An unconditional overwrite there would
    /// quietly relabel every learned term as hand-typed on the next load.
    ///
    /// What it does do is report the change, which is what makes the config
    /// carry the new version number after one load.
    fn migrate_vocabulary_origin(&mut self) -> bool {
        if self.schema_version >= 4 {
            return false;
        }

        self.schema_version = 4;
        true
    }

    fn migrate_vocabulary_hints(&mut self) -> bool {
        if self.schema_version >= 2 {
            return false;
        }

        let filtered =
            super::transcription_hints::filter_stt_hint_lines(&self.stt_hints);

        // Conservative and Off never forwarded profile terms; only Manual with
        // the cloud flag opted in. That is the closest honest default.
        let default_use_as_prompt_hint = matches!(self.work_mode.bias_mode, BiasMode::Manual)
            && self.work_mode.manual_bias.cloud_include_profile_terms;

        if self.vocabulary_hints.is_empty() {
            self.vocabulary_hints = filtered
                .accepted
                .iter()
                .enumerate()
                .map(|(index, phrase)| VocabularyHintEntry {
                    id: format!("{}-vocab-{index}", self.id),
                    phrase: phrase.clone(),
                    use_as_prompt_hint: default_use_as_prompt_hint,
                    origin: VocabularyHintOrigin::User,
                    ..VocabularyHintEntry::default()
                })
                .collect();
        }

        if !filtered.ignored.is_empty() {
            super::runtime_log::record(format!(
                "[WordScript] Profile vocabulary migration dropped unusable hint lines profile={} count={} lines={:?}",
                self.id,
                filtered.ignored.len(),
                filtered.ignored,
            ));
        }

        self.schema_version = 2;
        true
    }

    /// Every term in the profile's vocabulary, opted in or not.
    ///
    /// Learned or typed, short or long, in the recognizer's slots or not: a
    /// term is granular profile context and reaches every transform stage
    /// unconditionally (ADR 0033). The recognizer selection below is an
    /// *addition* to this, never a filter on it.
    pub(crate) fn vocabulary_phrases(&self) -> Vec<String> {
        self.vocabulary_hints
            .iter()
            .map(|entry| entry.phrase.trim().to_string())
            .filter(|phrase| !phrase.is_empty())
            .collect()
    }

    /// The terms the recognizer's initial prompt gets, chosen by the runtime.
    ///
    /// The order is the whole point, and it is the one a person gets backwards.
    /// Asked which terms matter most, anyone picks their long product names —
    /// and those are exactly the ones `vocabulary_repair` restores reliably
    /// after the fact. A term below the repair floor has no second chance: once
    /// the transcript exists, "Tauri" is gone. So the short terms go first, and
    /// the slots stop being spent on words that did not need them (ADR 0035).
    ///
    /// Within each group the term seen mangled more often wins, because that is
    /// the evidence that the recognizer actually struggles with it.
    pub(crate) fn recognizer_slot_phrases(&self) -> Vec<String> {
        select_recognizer_slots(&self.vocabulary_hints)
    }

    pub(crate) fn resolved_speech(&self) -> ProfileSpeechSettings {
        self.speech.clone().unwrap_or_default()
    }

    // No `resolved_modes()` counterpart: both remaining fields need to know
    // whether the block is absent, because an absent block falls back to the
    // global value rather than to the struct default.

    pub(crate) fn resolved_capture(&self) -> ProfileCaptureSettings {
        self.capture.clone().unwrap_or_default()
    }
}

/// The recognizer's slot allocation over a raw entry list.
///
/// A free function rather than a method, because the Settings preview analyses
/// unsaved entries that are not a profile yet, and it has to show the same
/// selection the capture path will make. Recomputing the rule there is what
/// made the panel promise an initial prompt the provider never received.
pub(crate) fn select_recognizer_slots(entries: &[VocabularyHintEntry]) -> Vec<String> {
    let mut ranked: Vec<(bool, std::cmp::Reverse<u32>, &str)> = entries
        .iter()
        .map(|entry| {
            let phrase = entry.phrase.trim();
            (
                // `false` sorts first, so a term below the repair floor leads.
                super::vocabulary_repair::is_repairable_term(phrase),
                std::cmp::Reverse(entry.observation_count),
                phrase,
            )
        })
        .filter(|(_, _, phrase)| {
            !phrase.is_empty() && super::transcription_hints::is_stt_hint_candidate(phrase)
        })
        .collect();

    // Stable, so among terms of equal rank the profile's own order decides. A
    // list that reshuffles itself between saves is one nobody can reason about.
    ranked.sort_by_key(|(repairable, observations, _)| (*repairable, *observations));

    let mut selected: Vec<String> = Vec::new();
    for (_, _, phrase) in ranked {
        if selected
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(phrase))
        {
            continue;
        }
        selected.push(phrase.to_string());
        if selected.len() >= super::transcription_hints::max_recognizer_slots() {
            break;
        }
    }

    selected
}

#[derive(Debug, Clone, Deserialize, Default)]
struct LegacyTextRules {
    #[serde(default)]
    prompt: String,
    #[serde(default)]
    stt_hints: String,
    #[serde(default)]
    dictionary_entries: Vec<DictionaryEntry>,
    #[serde(default)]
    snippet_entries: Vec<SnippetEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct LocalProfileDecodeSettings {
    pub profile_id: String,
    pub beam_size: u8,
    pub best_of: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct LocalProfilePromptSettings {
    pub profile_id: String,
    pub prompt_strength: String,
    pub prompt_carry: bool,
}

// ── Per-Profile Settings (tab-oriented sub-objects) ──────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProfileSpeechSettings {
    pub provider: String,
    pub model: String,
    pub language: String,
    /// Whether the chosen language is treated as pinned. It never makes a
    /// language mismatch sufficient on its own to discard text; it only lowers
    /// the corroboration the drift check requires from two signals to one.
    pub language_locked: bool,
    pub correction_model: String,
    pub local_correction_model: String,
    pub agent_model: String,
    pub local_agent_model: String,
    pub local_model: String,
    pub local_profile: String,
    pub local_prompt_strength: String,
    pub local_prompt_carry: bool,
    pub local_beam_size: u8,
    pub local_best_of: u8,
    pub local_profile_prompt_settings: Vec<LocalProfilePromptSettings>,
    pub local_profile_decode_settings: Vec<LocalProfileDecodeSettings>,
}

impl Default for ProfileSpeechSettings {
    fn default() -> Self {
        Self {
            provider: default_provider_id().to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            language: String::new(),
            language_locked: false,
            correction_model: DEFAULT_CORRECTION_MODEL.to_string(),
            local_correction_model: DEFAULT_LOCAL_CORRECTION_MODEL.to_string(),
            agent_model: DEFAULT_AGENT_MODEL.to_string(),
            local_agent_model: DEFAULT_LOCAL_AGENT_MODEL.to_string(),
            local_model: "base".to_string(),
            local_profile: "local-preview-base-fast".to_string(),
            local_prompt_strength: "profile".to_string(),
            local_prompt_carry: false,
            local_beam_size: 1,
            local_best_of: 1,
            local_profile_prompt_settings: Vec::new(),
            local_profile_decode_settings: Vec::new(),
        }
    }
}

/// Per-profile settings shown on the Modes tab.
///
/// `post_process`, `filter_fillers` and `professionalize` used to live here and
/// were removed: the mode alone decides transform behavior
/// (`ProcessingMode::transform_preset`). Configs written before that still carry
/// the keys — they are ignored on load (no `deny_unknown_fields`) and dropped on
/// the next save.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProfileModesSettings {
    /// Whether workspace context is collected for this profile. Read through
    /// `AppConfig::active_text_profile_collect_workspace_context`; the legacy
    /// name is kept as a serde alias because the toggle predates the context
    /// reaching modes other than Auto.
    #[serde(alias = "auto_detect_mode")]
    pub collect_workspace_context: bool,
    pub agent_name: String,
    /// How this profile's agent writes. Defaults to `Off`, so a config written
    /// before the style existed produces a byte-identical prompt.
    pub communication_register: CommunicationRegister,
    pub communication_length: CommunicationLength,
    /// The user's own rules ("immer duzen", "keine Emojis"). They outrank the
    /// register where they touch it.
    pub style_instructions: String,
    /// A piece of the user's own writing. Subordinate to the register for form,
    /// authoritative for wording — see `core::communication_style`.
    pub style_sample: String,
    /// The language Translate renders into, as an ISO 639-1 code (ADR 0041).
    ///
    /// Per profile rather than per machine, because "English mail" and "German
    /// notes" are exactly what profiles are for. A profile switch can therefore
    /// change the output language, which is intended and is why the target is
    /// stated on the profile's own surface as well as on the model surface.
    #[serde(default = "default_profile_translate_target_language")]
    pub translate_target_language: String,
    /// Whether the profile's names, products and technical terms survive a
    /// translation untouched. On by default: they are the one part of a
    /// sentence a translator must leave alone and a model will happily
    /// localize.
    #[serde(default = "default_translate_keep_profile_words")]
    pub translate_keep_profile_words: bool,
}

impl Default for ProfileModesSettings {
    fn default() -> Self {
        Self {
            collect_workspace_context: true,
            agent_name: DEFAULT_AGENT_NAME.to_string(),
            communication_register: CommunicationRegister::Off,
            communication_length: CommunicationLength::Normal,
            style_instructions: String::new(),
            style_sample: String::new(),
            translate_target_language: default_profile_translate_target_language(),
            translate_keep_profile_words: default_translate_keep_profile_words(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProfileCaptureSettings {
    pub max_recording_seconds: u64,
    pub silence_timeout_seconds: u64,
}

impl Default for ProfileCaptureSettings {
    fn default() -> Self {
        Self {
            max_recording_seconds: 720,
            silence_timeout_seconds: 30,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum OverlayPositionMode {
    #[default]
    Preset,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum OverlayAnchor {
    TopLeft,
    TopCenter,
    TopRight,
    CenterLeft,
    CenterRight,
    BottomLeft,
    #[default]
    BottomCenter,
    BottomRight,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    #[serde(alias = "groq_api_key", skip_serializing_if = "String::is_empty")]
    pub legacy_groq_api_key: String,
    pub model: String,
    pub language: String,
    pub active_text_profile_id: String,
    pub text_profiles: Vec<TextProfile>,
    pub curated_profiles_seeded: bool,
    pub post_process: bool,
    pub correction_model: String,
    pub local_correction_model: String,
    pub filter_fillers: bool,
    pub professionalize: bool,
    #[serde(alias = "backend")]
    pub provider: String,
    /// Which of the provider's account plans this machine is on. Plans are
    /// declared by the provider (`providers::provider_tiers`), never listed
    /// here, and they bound how long a recording may be. Machine-wide rather
    /// than per-profile: the plan belongs to the credential, and every profile
    /// using that provider shares it. Empty means the provider's default plan.
    #[serde(default)]
    pub provider_tier: String,
    pub local_model: String,
    pub local_profile: String,
    pub local_prompt_strength: String,
    pub local_prompt_carry: bool,
    pub local_beam_size: u8,
    pub local_best_of: u8,
    pub local_profile_prompt_settings: Vec<LocalProfilePromptSettings>,
    pub local_profile_decode_settings: Vec<LocalProfileDecodeSettings>,
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub activation_mode: String,
    /// Upper bound in seconds for a single hold before the watchdog ends it
    /// with a stated reason. `0` disables the watchdog.
    #[serde(default = "default_hold_watchdog_seconds")]
    pub hold_watchdog_seconds: u64,
    /// How close together the two taps of a double-tap activation must be, in
    /// milliseconds.
    #[serde(default = "default_double_tap_window_ms")]
    pub double_tap_window_ms: u64,
    /// Migration gate for the shortcut lane. Legacy rewrites run once at
    /// version `0` and never again — a migration that fires on every save
    /// silently rewrites values the user just chose (D6).
    #[serde(default)]
    pub shortcut_schema_version: u32,
    pub overlay_position_mode: OverlayPositionMode,
    pub overlay_monitor: String,
    pub overlay_anchor: OverlayAnchor,
    pub overlay_manual_x: i32,
    pub overlay_manual_y: i32,
    pub sample_rate: u32,
    pub channels: u16,
    pub dtype: String,
    pub audio_device: String,
    pub max_recording_seconds: u64,
    pub silence_timeout_seconds: u64,
    #[serde(default = "default_result_actions_timeout_s")]
    pub result_actions_timeout_s: u64,
    #[serde(default = "default_mode_select_timeout_s")]
    pub mode_select_timeout_s: u64,
    // Legacy millisecond fields. Pre-seconds configs stored these; we migrate
    // them into the new `_s` fields in `normalize_for_runtime` and never write
    // them again. `#[serde(default)]` = 0 so we can detect "absent in file".
    #[serde(default, skip_serializing)]
    pub result_actions_timeout_ms: u64,
    #[serde(default, skip_serializing)]
    pub mode_select_timeout_ms: u64,
    // Legacy global auto_paste. The real per-profile control is
    // `TextProfileWorkMode.insert_behavior`. This shadow field exists only for
    // migration (old configs that set `auto_paste: false` are migrated into
    // `insert_behavior: "clipboard_only"` in `normalize_for_runtime`).
    #[serde(default = "default_legacy_auto_paste", skip_serializing)]
    pub auto_paste: bool,
    pub play_sounds: bool,
    #[serde(default = "default_sound_volume")]
    pub sound_volume: f32,
    #[serde(default = "default_sound_pack")]
    pub sound_pack: String,
    #[serde(default = "default_play_startup_sound")]
    pub play_startup_sound: bool,
    pub log_level: String,
    pub temp_audio_dir: String,
    pub history_limit: usize,
    pub history_retention_days: u32,
    pub agent_name: String,
    pub agent_model: String,
    pub local_agent_model: String,
    #[serde(default)]
    pub processing_mode: ProcessingMode,
    #[serde(default)]
    pub enhance_sub_mode: Option<EnhanceSubMode>,
    #[serde(default)]
    pub enhance_target: PromptTarget,
    /// The two Translate settings that are not per profile, in the scope the
    /// drawing gives them: the AI Models surface marks `Into` and `Keep the
    /// profile's words` with a per-profile tag and marks these two with none,
    /// exactly as it does for `enhance_sub_mode` and `enhance_target` above.
    #[serde(default)]
    pub translate_same_language: TranslateSameLanguage,
    #[serde(default)]
    pub translate_address_form: TranslateAddressForm,
    /// Light, dark, or follow the OS. `system` is a deferral rather than a
    /// third palette: the window resolves it at render time and re-resolves it
    /// when the OS changes, so what lands on `<html data-theme>` is always
    /// `light` or `dark` (ADR 0048). Stored here because the choice belongs to
    /// the machine, not to a profile, and because a window is not a place to
    /// keep something that has to survive a restart.
    #[serde(default = "default_color_scheme")]
    pub color_scheme: String,
    #[serde(default)]
    pub auto_detect_mode: bool,
    #[serde(default)]
    pub profile_health_acknowledged_flags: HashMap<String, HashSet<String>>,
    #[serde(default = "default_mode_picker_hotkey")]
    pub mode_picker_hotkey: String,
    #[serde(default = "default_mode_auto_hotkey")]
    pub mode_auto_hotkey: String,
    #[serde(default = "default_mode_verbatim_hotkey")]
    pub mode_verbatim_hotkey: String,
    #[serde(default = "default_mode_cleanup_hotkey")]
    pub mode_cleanup_hotkey: String,
    #[serde(default = "default_mode_rewrite_hotkey")]
    pub mode_rewrite_hotkey: String,
    /// The seventh mode slot, and the first one that ships empty (ADR 0041).
    /// `Alt+1` through `Alt+6` are taken, so Translate either takes `Alt+7` or
    /// takes none. It takes none, and the Hotkeys screen states that rather
    /// than hiding it: the number of digits a modifier row can carry is a real
    /// limit and the eighth mode will hit it harder than the seventh.
    #[serde(default = "default_mode_translate_hotkey")]
    pub mode_translate_hotkey: String,
    #[serde(default = "default_mode_agent_hotkey")]
    pub mode_agent_hotkey: String,
    #[serde(default = "default_mode_prompt_enhance_hotkey")]
    pub mode_prompt_enhance_hotkey: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let default_local_profile = default_local_profile_for_model("base");
        let default_local_beam_size = default_local_beam_size_for_profile(&default_local_profile);
        let default_local_best_of = default_local_best_of_for_profile(&default_local_profile);
        let default_local_prompt_strength = default_local_prompt_strength().to_string();

        Self {
            legacy_groq_api_key: String::new(),
            model: "whisper-large-v3-turbo".to_string(),
            language: String::new(),
            active_text_profile_id: default_text_profile_id().to_string(),
            text_profiles: default_seeded_text_profiles(),
            curated_profiles_seeded: true,
            post_process: true,
            correction_model: DEFAULT_CORRECTION_MODEL.to_string(),
            local_correction_model: DEFAULT_LOCAL_CORRECTION_MODEL.to_string(),
            filter_fillers: true,
            professionalize: false,
            provider: default_provider_id().to_string(),
            provider_tier: String::new(),
            local_model: "base".to_string(),
            local_profile: default_local_profile.clone(),
            local_prompt_strength: default_local_prompt_strength.clone(),
            local_prompt_carry: false,
            local_beam_size: default_local_beam_size,
            local_best_of: default_local_best_of,
            local_profile_prompt_settings: vec![LocalProfilePromptSettings {
                profile_id: default_local_profile.clone(),
                prompt_strength: default_local_prompt_strength,
                prompt_carry: false,
            }],
            local_profile_decode_settings: vec![LocalProfileDecodeSettings {
                profile_id: default_local_profile,
                beam_size: default_local_beam_size,
                best_of: default_local_best_of,
            }],
            hotkey: default_hotkey().to_string(),
            pause_hotkey: default_pause_hotkey().to_string(),
            abort_hotkey: default_abort_hotkey().to_string(),
            activation_mode: default_activation_mode().to_string(),
            hold_watchdog_seconds: default_hold_watchdog_seconds(),
            double_tap_window_ms: default_double_tap_window_ms(),
            shortcut_schema_version: SHORTCUT_SCHEMA_VERSION,
            overlay_position_mode: OverlayPositionMode::Preset,
            overlay_monitor: default_overlay_monitor().to_string(),
            overlay_anchor: OverlayAnchor::BottomCenter,
            overlay_manual_x: 0,
            overlay_manual_y: 0,
            sample_rate: 16_000,
            channels: 1,
            dtype: "int16".to_string(),
            audio_device: String::new(),
            max_recording_seconds: 720,
            silence_timeout_seconds: 30,
            result_actions_timeout_s: 9,
            mode_select_timeout_s: 6,
            result_actions_timeout_ms: 0,
            mode_select_timeout_ms: 0,
            auto_paste: true,
            play_sounds: true,
            sound_volume: default_sound_volume(),
            sound_pack: default_sound_pack(),
            play_startup_sound: default_play_startup_sound(),
            log_level: "INFO".to_string(),
            temp_audio_dir: String::new(),
            history_limit: 200,
            history_retention_days: 90,
            agent_name: DEFAULT_AGENT_NAME.to_string(),
            agent_model: DEFAULT_AGENT_MODEL.to_string(),
            local_agent_model: DEFAULT_LOCAL_AGENT_MODEL.to_string(),
            processing_mode: ProcessingMode::default(),
            enhance_sub_mode: None,
            enhance_target: PromptTarget::default(),
            color_scheme: default_color_scheme(),
            translate_same_language: TranslateSameLanguage::default(),
            translate_address_form: TranslateAddressForm::default(),
            auto_detect_mode: true,
            profile_health_acknowledged_flags: HashMap::new(),
            mode_picker_hotkey: default_mode_picker_hotkey(),
            mode_auto_hotkey: default_mode_auto_hotkey(),
            mode_verbatim_hotkey: default_mode_verbatim_hotkey(),
            mode_cleanup_hotkey: default_mode_cleanup_hotkey(),
            mode_rewrite_hotkey: default_mode_rewrite_hotkey(),
            mode_translate_hotkey: default_mode_translate_hotkey(),
            mode_agent_hotkey: default_mode_agent_hotkey(),
            mode_prompt_enhance_hotkey: default_mode_prompt_enhance_hotkey(),
        }
    }
}

impl AppConfig {
    pub fn active_text_profile(&self) -> TextProfile {
        self.text_profiles
            .iter()
            .find(|profile| profile.id == self.active_text_profile_id)
            .cloned()
            .or_else(|| self.text_profiles.first().cloned())
            .unwrap_or_else(|| {
                default_text_profile(String::new(), String::new(), Vec::new(), Vec::new())
            })
    }

    pub(crate) fn active_text_profile_work_mode(&self) -> TextProfileWorkMode {
        self.active_text_profile().work_mode.normalized()
    }

    /// The chat model this machine runs instruction-following jobs on — the
    /// agent, the translation, the prompt enhancer, and the transcript titles
    /// (ADR 0077). One resolution, so a lane switch moves all of them together.
    pub(crate) fn chat_model_for_provider(&self) -> String {
        if self.provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID {
            self.local_agent_model.clone()
        } else {
            self.agent_model.clone()
        }
    }

    pub(crate) fn resolved_active_text_profile_work_mode(&self) -> TextProfileWorkMode {
        let work_mode = self.active_text_profile_work_mode();
        TextProfileWorkMode {
            rewrite_style: work_mode.effective_rewrite_style(),
            insert_behavior: work_mode.effective_insert_behavior(),
            recovery_behavior: work_mode.effective_recovery_behavior(),
            processing_mode: work_mode.effective_processing_mode(),
            enhance_sub_mode: work_mode.enhance_sub_mode.clone(),
            target: work_mode.target.clone(),
            bias_mode: work_mode.bias_mode.clone(),
            manual_bias: work_mode.manual_bias.clone(),
        }
    }

    /// The transform preset implied by the active profile's stored mode.
    ///
    /// Callers running the live pipeline must prefer the *effective* mode
    /// (override and Auto resolution applied) over this, because the stored mode
    /// can differ from the one the session actually runs in.
    pub(crate) fn active_text_profile_transform_preset(&self) -> TransformPreset {
        self.active_text_profile_work_mode().transform_preset()
    }

    pub(crate) fn active_text_profile_auto_paste(&self) -> bool {
        self.active_text_profile_work_mode()
            .effective_auto_paste()
    }

    /// The agent name for the active profile, falling back to the global value
    /// when the profile leaves it blank. Previously the per-profile field was
    /// editable but never read, so the name shown in Settings and the name the
    /// detection heuristic matched against could differ.
    pub(crate) fn active_text_profile_agent_name(&self) -> String {
        let profile_name = self
            .active_text_profile()
            .modes
            .map(|modes| modes.agent_name)
            .unwrap_or_default();
        let trimmed = profile_name.trim();
        if trimmed.is_empty() {
            self.agent_name.clone()
        } else {
            trimmed.to_string()
        }
    }

    /// The communication style for the active profile.
    ///
    /// Purely per-profile: there is no global fallback, because the point of
    /// the setting is that two profiles write differently. A profile whose
    /// `modes` block predates the style resolves to `Off`, which produces no
    /// style block at all and therefore the prompt it had before.
    ///
    /// Read on every path that builds a generative or reformulating prompt. A
    /// control the runtime does not read is indistinguishable from one that
    /// agrees with the default — that was ADR 0020's failure and it is the
    /// reason this resolver exists rather than each call site reaching into
    /// `profile.modes` itself.
    pub(crate) fn active_text_profile_communication_style(&self) -> CommunicationStyle {
        let Some(modes) = self.active_text_profile().modes else {
            return CommunicationStyle::default();
        };

        CommunicationStyle {
            register: modes.communication_register,
            length: modes.communication_length,
            instructions: modes.style_instructions.trim().to_string(),
            sample: modes.style_sample.trim().to_string(),
        }
    }

    /// What Translate runs with for the active profile.
    ///
    /// The target language and the profile-words switch come from the profile,
    /// the same-language behaviour and the address form from the machine. A
    /// profile whose `modes` block predates Translate resolves to English with
    /// the profile's words kept, which is the same answer a fresh profile gives.
    pub(crate) fn active_text_profile_translate_settings(&self) -> TranslateSettings {
        let modes = self.active_text_profile().modes.unwrap_or_default();

        TranslateSettings {
            target_language: normalize_translate_language(&modes.translate_target_language),
            same_language: self.translate_same_language,
            address_form: self.translate_address_form,
            keep_profile_words: modes.translate_keep_profile_words,
        }
    }

    /// Whether workspace context may be collected for the active profile.
    ///
    /// The runtime used to read the global `auto_detect_mode` here while the UI
    /// wrote the per-profile value, so the toggle in Settings had no effect. The
    /// global field remains the fallback for configs whose profiles predate the
    /// per-profile block.
    pub(crate) fn active_text_profile_collect_workspace_context(&self) -> bool {
        self.active_text_profile()
            .modes
            .map(|modes| modes.collect_workspace_context)
            .unwrap_or(self.auto_detect_mode)
    }

    pub fn active_text_profile_label(&self) -> Option<String> {
        let label = self.active_text_profile().label;
        let trimmed = label.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    }

    pub fn without_secrets(&self) -> Self {
        let mut sanitized = self.clone();
        sanitized.legacy_groq_api_key.clear();
        sanitized
    }

    fn load_raw_from_disk() -> Self {
        let path = config_file_path();
        let Ok(raw) = std::fs::read_to_string(path) else {
            return Self::default();
        };

        let Ok(raw_value) = serde_json::from_str::<serde_json::Value>(&raw) else {
            return Self::default();
        };

        let mut config = serde_json::from_value::<Self>(raw_value.clone()).unwrap_or_default();
        apply_legacy_text_rules_from_value(&mut config, &raw_value);
        if should_reseed_curated_text_profiles(&raw_value) {
            config.curated_profiles_seeded = false;
        }
        config
    }

    fn has_pending_legacy_secret(&self) -> bool {
        !self.legacy_groq_api_key.trim().is_empty()
    }

    fn try_migrate_legacy_secret(&mut self) -> Result<bool, String> {
        let legacy_key = self.legacy_groq_api_key.trim().to_string();
        if legacy_key.is_empty() {
            return Ok(false);
        }

        self.provider = normalize_provider_value(&self.provider);
        let credential = migrate_legacy_provider_api_key(&self.provider, &legacy_key)
            .map_err(|error| error.message)?;
        self.legacy_groq_api_key.clear();

        runtime_log::record(format!(
            "[WordScript] Migrated legacy {} API key to {}",
            self.provider, credential.storage,
        ));

        Ok(true)
    }

    fn reconcile_legacy_secret_before_save() -> Result<(), String> {
        let mut disk_config = Self::load_raw_from_disk();
        if !disk_config.has_pending_legacy_secret() {
            return Ok(());
        }

        disk_config.provider = normalize_provider_value(&disk_config.provider);

        match disk_config.try_migrate_legacy_secret() {
            Ok(true) => {
                disk_config.save_to_disk()?;
                Ok(())
            }
            Ok(false) => Ok(()),
            Err(error) => {
                if provider_credentials_configured(&disk_config.provider)
                    .map_err(|provider_error| provider_error.message)?
                {
                    runtime_log::record(format!(
                        "[WordScript] Dropping unresolved legacy {} API key from disk because a provider credential is already configured after migration failed: {}",
                        disk_config.provider,
                        error,
                    ));
                    return Ok(());
                }

                Err(
                    "Could not migrate the legacy Groq key to the OS secret store. Save the key again in Provider & Models before saving settings."
                        .to_string(),
                )
            }
        }
    }

    /// Returns whether normalization rewrote a profile's `work_mode`, so
    /// `load_from_disk_impl` can persist the canonical form instead of
    /// recomputing it on every load. See `normalize_text_profiles`.
    pub(crate) fn normalize_for_runtime(&mut self) -> bool {
        let work_mode_rewritten = self.normalize_text_profiles();
        self.provider = normalize_provider_value(&self.provider);
        self.local_model = normalize_local_model_value(&self.local_model);
        self.local_profile = normalize_local_profile_id(&self.local_profile, &self.local_model);
        self.local_model = local_model_from_profile_id(&self.local_profile)
            .unwrap_or_else(|| self.local_model.clone());
        self.local_correction_model =
            normalize_local_correction_model_value(&self.local_correction_model);
        self.local_prompt_strength =
            normalize_local_prompt_strength_value(&self.local_prompt_strength);
        self.local_profile_prompt_settings =
            normalize_local_profile_prompt_settings(&self.local_profile_prompt_settings);
        let active_local_prompt = resolve_active_local_profile_prompt_settings(
            &self.local_profile_prompt_settings,
            &self.local_profile,
            &self.local_prompt_strength,
            self.local_prompt_carry,
        );
        self.local_prompt_strength = active_local_prompt.prompt_strength.clone();
        self.local_prompt_carry = active_local_prompt.prompt_carry;
        upsert_local_profile_prompt_settings(
            &mut self.local_profile_prompt_settings,
            active_local_prompt,
        );
        self.local_profile_decode_settings =
            normalize_local_profile_decode_settings(&self.local_profile_decode_settings);
        let active_local_decode = resolve_active_local_profile_decode_settings(
            &self.local_profile_decode_settings,
            &self.local_profile,
            self.local_beam_size,
            self.local_best_of,
        );
        self.local_beam_size = active_local_decode.beam_size;
        self.local_best_of = active_local_decode.best_of;
        upsert_local_profile_decode_settings(
            &mut self.local_profile_decode_settings,
            active_local_decode,
        );
        // Migrate legacy millisecond timeout fields into the new seconds fields.
        // A non-zero `_ms` value from an old config means the file predated the
        // rename; we convert it to seconds (rounded) and clear the legacy field.
        if self.result_actions_timeout_ms > 0 && self.result_actions_timeout_s == default_result_actions_timeout_s() {
            self.result_actions_timeout_s = (self.result_actions_timeout_ms + 500) / 1000;
        }
        if self.mode_select_timeout_ms > 0 && self.mode_select_timeout_s == default_mode_select_timeout_s() {
            self.mode_select_timeout_s = (self.mode_select_timeout_ms + 500) / 1000;
        }
        // Clamp all timeout fields to technically realistic ranges.
        // Max recording: 1–30 minutes (60–1800s). Groq free tier caps at
        // ~25 MiB ≈ 13 min; dev tier at ~100 MiB ≈ 53 min. Local preview has
        // no hard limit but RAM-bound. 30 min is the practical ceiling.
        self.max_recording_seconds = self.max_recording_seconds.clamp(60, 1800);
        // Silence timeout: 0 (disabled) – 60s. Longer than 60s of silence is
        // not a recording anymore.
        self.silence_timeout_seconds = self.silence_timeout_seconds.clamp(0, 60);
        // Result overlay: 1–60s. Five-minute result overlays are impractical.
        self.result_actions_timeout_s = self.result_actions_timeout_s.clamp(1, 60);
        // Mode-select overlay: 1–30s. Two minutes is too long for a picker.
        self.mode_select_timeout_s = self.mode_select_timeout_s.clamp(1, 30);
        // Sound volume is a linear gain on top of the OS volume. NaN from a
        // hand-edited config would silently poison every later comparison.
        if !self.sound_volume.is_finite() {
            self.sound_volume = super::sound::DEFAULT_VOLUME;
        }
        self.sound_volume = self.sound_volume.clamp(0.0, 1.0);
        // An unknown pack name must resolve to a real pack, never to silence.
        self.sound_pack = super::sound::SoundPack::from_str_or_default(&self.sound_pack)
            .as_str()
            .to_string();
        self.result_actions_timeout_ms = 0;
        self.mode_select_timeout_ms = 0;
        // Migrate legacy global `auto_paste: false` into per-profile
        // `insert_behavior: "clipboard_only"`. Only affects profiles whose
        // `insert_behavior` is not already explicitly `"clipboard_only"` (i.e.
        // profiles still on the old default `"auto_paste"` whose user clearly
        // wanted clipboard-only globally).
        if !self.auto_paste {
            for profile in &mut self.text_profiles {
                let behavior = profile.work_mode.normalized().insert_behavior;
                if behavior != "clipboard_only" {
                    profile.work_mode.insert_behavior = "clipboard_only".to_string();
                }
            }
        }
        self.auto_paste = false;
        migrate_shortcut_schema(self);
        self.hold_watchdog_seconds = self.hold_watchdog_seconds.min(3600);
        // Below ~150 ms a deliberate double tap is hard to hit; above ~1 s two
        // unrelated presses start merging into one.
        self.double_tap_window_ms = self.double_tap_window_ms.clamp(150, 1000);
        self.hotkey = normalize_shortcut_value(&self.hotkey, true);
        self.pause_hotkey = normalize_shortcut_value(&self.pause_hotkey, true);
        self.abort_hotkey = normalize_shortcut_value(&self.abort_hotkey, true);
        self.mode_picker_hotkey = normalize_shortcut_value(&self.mode_picker_hotkey, true);
        self.mode_auto_hotkey = normalize_shortcut_value(&self.mode_auto_hotkey, true);
        self.mode_verbatim_hotkey = normalize_shortcut_value(&self.mode_verbatim_hotkey, true);
        self.mode_cleanup_hotkey = normalize_shortcut_value(&self.mode_cleanup_hotkey, true);
        self.mode_rewrite_hotkey = normalize_shortcut_value(&self.mode_rewrite_hotkey, true);
        self.mode_translate_hotkey = normalize_shortcut_value(&self.mode_translate_hotkey, true);
        self.mode_agent_hotkey = normalize_shortcut_value(&self.mode_agent_hotkey, true);
        self.mode_prompt_enhance_hotkey = normalize_shortcut_value(
            &self.mode_prompt_enhance_hotkey,
            true,
        );
        self.color_scheme = normalize_color_scheme(&self.color_scheme);
        self.overlay_monitor = normalize_overlay_monitor_value(&self.overlay_monitor);
        self.history_limit = self.history_limit.clamp(25, 1000);
        self.history_retention_days = self.history_retention_days.min(3650);
        work_mode_rewritten
    }

    /// Returns whether any profile's `work_mode` was rewritten into its
    /// canonical form.
    fn normalize_text_profiles(&mut self) -> bool {
        if self.text_profiles.is_empty() {
            self.text_profiles.push(default_text_profile(
                String::new(),
                String::new(),
                Vec::new(),
                Vec::new(),
            ));
        }

        if !self.curated_profiles_seeded {
            append_missing_curated_text_profiles(&mut self.text_profiles);
            self.curated_profiles_seeded = true;
        }
        refresh_curated_text_profile_presentation(&mut self.text_profiles);

        let mut work_mode_rewritten = false;

        for (index, profile) in self.text_profiles.iter_mut().enumerate() {
            if profile.id.trim().is_empty() {
                profile.id = if index == 0 {
                    default_text_profile_id().to_string()
                } else {
                    format!("profile-{}", index + 1)
                };
            }

            // Runs after the id is settled, because migrated entries derive
            // their ids from the profile id, and the curated context migration
            // matches on it.
            profile.migrate_to_current_schema();

            if profile.label.trim().is_empty() {
                profile.label = if index == 0 {
                    default_text_profile_label().to_string()
                } else {
                    format!("Profile {}", index + 1)
                };
            }

            let prev_work_mode = profile.work_mode.clone();
            profile.work_mode = normalize_text_profile_work_mode(&profile.work_mode);
            // Diagnostic for the insert_behavior-revert investigation (plan P1):
            // logs ONLY when normalization actually rewrites the value (a
            // non-canonical token such as "clipboard"/"manual" → canonical, or
            // an unknown value → the auto_paste default). On a steady canonical
            // config this never fires, so it is effectively zero-noise — but it
            // pinpoints any path that is silently rewriting insert_behavior.
            if profile.work_mode.insert_behavior != prev_work_mode.insert_behavior {
                runtime_log::record(format!(
                    "[WordScript] Config normalize rewrote insert_behavior profile={} from='{}' to='{}'",
                    profile.id, prev_work_mode.insert_behavior, profile.work_mode.insert_behavior,
                ));
            }
            // Reported so the caller can PERSIST the canonical form. Without
            // that, a non-canonical token survives on disk indefinitely and is
            // re-applied on every single load: `"clipboard"` normalizes to
            // `"clipboard_only"`, so a profile carrying it was forced back to
            // clipboard-only after every restart no matter what the user
            // selected — the observed "the delivery mode switches itself back".
            // The diagnostic above logged that 183 times across two runtime logs
            // precisely because the correction was never written down.
            work_mode_rewritten |= profile.work_mode != prev_work_mode;
        }

        let active_index = self
            .text_profiles
            .iter()
            .position(|profile| profile.id == self.active_text_profile_id)
            .unwrap_or(0);

        self.active_text_profile_id = self.text_profiles[active_index].id.clone();
        work_mode_rewritten
    }

    /// Loads, migrates and normalizes the config, persisting it back to disk if
    /// normalization changed anything (migration / shortcut normalization).
    ///
    /// This is the lock-holding entry point for callers that do NOT already
    /// hold [`with_config_file_lock`]. Frequent unlocked callers — notably
    /// `resolve_current_processing_mode` (overlay / mode-event polling) — used
    /// to trigger the conditional re-save here WITHOUT the lock, racing a
    /// concurrent `save_config` (frontend writing e.g. `insert_behavior`):
    /// the resolve read a stale file, re-saved its normalized snapshot and
    /// silently reverted the user's change. Wrapping the whole load→normalize
    /// →re-save in the lock closes that hole. (plan P1, candidate root C2)
    pub fn load_from_disk() -> Self {
        with_config_file_lock(Self::load_from_disk_impl).unwrap_or_default()
    }

    /// Lock-free variant for callers that ALREADY hold [`with_config_file_lock`]
    /// (e.g. `switch_active_text_profile`, `set_active_profile_processing_mode`).
    /// The std `Mutex` is not reentrant, so those callers must not go through
    /// [`load_from_disk`] (which would re-acquire the lock and deadlock).
    pub(crate) fn load_from_disk_within_lock() -> Self {
        Self::load_from_disk_impl()
    }

    fn load_from_disk_impl() -> Self {
        let mut config = Self::load_raw_from_disk();
        let original_provider = config.provider.clone();
        let original_hotkeys = (
            config.hotkey.clone(),
            config.pause_hotkey.clone(),
            config.abort_hotkey.clone(),
        );

        let mut should_save = false;

        match config.try_migrate_legacy_secret() {
            Ok(migrated) => should_save |= migrated,
            Err(error) => runtime_log::record(format!(
                "[WordScript] Legacy provider key migration deferred: {error}"
            )),
        }

        should_save |= config.migrate_global_settings_to_active_profile();

        // A `work_mode` rewrite counts towards `should_save`. It did not before,
        // which is why a non-canonical `insert_behavior` could be corrected in
        // memory on every load and never written back — see
        // `normalize_text_profiles`.
        should_save |= config.normalize_for_runtime();
        should_save |= original_provider != config.provider;

        should_save |= original_hotkeys
            != (
                config.hotkey.clone(),
                config.pause_hotkey.clone(),
                config.abort_hotkey.clone(),
            );

        if should_save && !config.has_pending_legacy_secret() {
            let _ = config.save_to_disk();
        } else if should_save {
            runtime_log::record(
                "[WordScript] Deferred config rewrite because a legacy provider key is still pending migration."
                    .to_string(),
            );
        }

        config
    }

    /// Migrates global settings into the active profile's per-profile sub-objects.
    /// Returns true if any migration was performed.
    fn migrate_global_settings_to_active_profile(&mut self) -> bool {
        let active_index = self
            .text_profiles
            .iter()
            .position(|p| p.id == self.active_text_profile_id)
            .unwrap_or(0);

        if active_index >= self.text_profiles.len() {
            return false;
        }

        let mut migrated = false;
        let profile = &mut self.text_profiles[active_index];

        // Migrate speech settings if not already present
        if profile.speech.is_none() {
            profile.speech = Some(ProfileSpeechSettings {
                provider: self.provider.clone(),
                model: self.model.clone(),
                language: self.language.clone(),
                language_locked: false,
                correction_model: self.correction_model.clone(),
                local_correction_model: self.local_correction_model.clone(),
                agent_model: self.agent_model.clone(),
                local_agent_model: self.local_agent_model.clone(),
                local_model: self.local_model.clone(),
                local_profile: self.local_profile.clone(),
                local_prompt_strength: self.local_prompt_strength.clone(),
                local_prompt_carry: self.local_prompt_carry,
                local_beam_size: self.local_beam_size,
                local_best_of: self.local_best_of,
                local_profile_prompt_settings: self.local_profile_prompt_settings.clone(),
                local_profile_decode_settings: self.local_profile_decode_settings.clone(),
            });
            migrated = true;
        }

        // Migrate modes settings if not already present. The three cleanup flags
        // are deliberately not carried over: the mode owns that behavior now, so
        // copying them would recreate values nothing reads. The communication
        // style has no global predecessor to migrate from and stays at its
        // default, which emits no style block.
        if profile.modes.is_none() {
            profile.modes = Some(ProfileModesSettings {
                collect_workspace_context: self.auto_detect_mode,
                agent_name: self.agent_name.clone(),
                ..ProfileModesSettings::default()
            });
            migrated = true;
        }

        // Migrate capture settings if not already present
        if profile.capture.is_none() {
            profile.capture = Some(ProfileCaptureSettings {
                max_recording_seconds: self.max_recording_seconds,
                silence_timeout_seconds: self.silence_timeout_seconds,
            });
            migrated = true;
        }

        if migrated {
            runtime_log::record(
                "[WordScript] Migrated global settings into active profile's per-profile sub-objects."
                    .to_string(),
            );
        }

        migrated
    }

    pub fn save_to_disk(&self) -> Result<(), String> {
        let path = config_file_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create config directory: {error}"))?;
        }

        let raw = serde_json::to_string_pretty(&self.without_secrets())
            .map_err(|error| format!("Could not serialize config: {error}"))?;
        std::fs::write(path, raw).map_err(|error| format!("Could not write config file: {error}"))
    }
}

#[tauri::command]
pub fn load_app_config() -> Result<AppConfig, String> {
    Ok(AppConfig::load_from_disk().without_secrets())
}

/// Validates that no two hotkeys (capture triggers + mode hotkeys) collide.
/// Returns `Err` with a concrete, user-readable message naming both
/// conflicting assignments when a collision is detected. Empty hotkey strings
/// (disabled) are skipped.
///
/// Runs on already-normalized values (see `save_config`), so two spellings of
/// the same combination cannot slip past. A value that does not parse is
/// skipped rather than rejected: it cannot be registered and is surfaced per
/// row as "not registerable" (T8), and failing the whole save would leave the
/// user unable to change anything else.
pub fn validate_hotkey_collisions(config: &AppConfig) -> Result<(), String> {
    // (label, raw_value) for every hotkey field. Order matters only for the
    // error message (the first-registered label is reported as "already in use").
    let entries: [(&str, &str); 11] = [
        ("Capture trigger", &config.hotkey),
        ("Pause capture", &config.pause_hotkey),
        ("Abort capture", &config.abort_hotkey),
        ("Mode select", &config.mode_picker_hotkey),
        ("Mode auto", &config.mode_auto_hotkey),
        ("Mode verbatim", &config.mode_verbatim_hotkey),
        ("Mode cleanup", &config.mode_cleanup_hotkey),
        ("Mode rewrite", &config.mode_rewrite_hotkey),
        ("Mode translate", &config.mode_translate_hotkey),
        ("Mode agent", &config.mode_agent_hotkey),
        ("Mode prompt enhance", &config.mode_prompt_enhance_hotkey),
    ];

    // Normalize each non-empty entry. A normalization failure (malformed
    // shortcut) is surfaced as a validation error too.
    let mut seen: Vec<(&str, String)> = Vec::new();
    for (label, raw) in entries {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(normalized) = super::trigger::normalize_shortcut(trimmed, true) else {
            continue;
        };

        if let Some((existing_label, existing_display)) = seen
            .iter()
            .find(|(_, display)| display == &normalized)
        {
            return Err(format!(
                "{} hotkey '{}' conflicts with {} (already assigned to '{}'). \
                 Each hotkey must be unique across capture triggers and mode hotkeys.",
                label, normalized, existing_label, existing_display
            ));
        }
        seen.push((label, normalized));
    }

    Ok(())
}

#[tauri::command]
pub fn save_config<R: Runtime>(app: AppHandle<R>, config: AppConfig) -> Result<AppConfig, String> {
    // Validate AFTER normalization, never before (D7). Normalization can change
    // a value, so two fields that pass a raw-value check can still collide on
    // disk — a state the validator would have approved and registration would
    // then reject.
    // Hold the config file lock across the legacy-secret reconcile + normalize
    // + write so a parallel read-modify-write command (e.g.
    // set_active_profile_processing_mode from the mode hotkey, or a
    // resolve_current_processing_mode re-save) cannot read a stale file and
    // write it back over this change — the cause of "settings switch back to
    // clipboard only". `reconcile_legacy_secret_before_save` does its own
    // load -> maybe-save for the legacy provider key; it is now inside the
    // same locked section so that write can't race this one either.
    // A settings save carries the whole config, so it is a second way to change
    // the active profile — by picking another one, or by deleting the active
    // one and letting normalization fall back to the first. Both land in the
    // same mixed state as an explicit switch.
    if super::sessions::session_is_active(&app) {
        let live_id = AppConfig::load_from_disk().active_text_profile_id;
        let incoming_id = config
            .text_profiles
            .iter()
            .find(|profile| profile.id == live_id)
            .map(|profile| profile.id.clone())
            .unwrap_or_else(|| config.active_text_profile_id.clone());
        if config.active_text_profile_id != live_id || incoming_id != live_id {
            return Err(super::sessions::PROFILE_LOCKED_DURING_SESSION.to_string());
        }
    }

    let sanitized = with_config_file_lock(|| {
        AppConfig::reconcile_legacy_secret_before_save()?;
        let mut sanitized = config.without_secrets();
        sanitized.normalize_for_runtime();
        validate_hotkey_collisions(&sanitized)?;
        sanitized.save_to_disk()?;
        Ok::<AppConfig, String>(sanitized)
    })??;
    super::sound::apply_config(&sanitized);
    emit_ready_event(&app, &sanitized);
    emit_effective_mode_event(&app, &sanitized);
    Ok(sanitized)
}

#[tauri::command]
pub fn switch_active_text_profile<R: Runtime>(
    app: AppHandle<R>,
    profile_id: String,
) -> Result<AppConfig, String> {
    // The runtime owns this rule, not the UI. Disabling the switcher covers the
    // button; it does not cover the tray, a hotkey, or any path added later.
    if super::sessions::session_is_active(&app) {
        return Err(super::sessions::PROFILE_LOCKED_DURING_SESSION.to_string());
    }

    // read-modify-write under the lock: prevents clobbering a concurrent save.
    let config = with_config_file_lock(|| {
        let mut config = AppConfig::load_from_disk_within_lock();
        config.active_text_profile_id = profile_id;
        config.normalize_for_runtime();
        config.save_to_disk()?;
        Ok::<AppConfig, String>(config)
    })??;
    super::sound::apply_config(&config);
    emit_ready_event(&app, &config);
    // Switching profile changes the effective mode as surely as setting it
    // does, because the mode lives on the profile.
    emit_effective_mode_event(&app, &config);
    Ok(config.without_secrets())
}

#[tauri::command]
pub fn acknowledge_profile_health_flag(
    profile_id: String,
    flag_kind: String,
) -> Result<AppConfig, String> {
    let trimmed_profile = profile_id.trim();
    let trimmed_flag = flag_kind.trim();
    if trimmed_profile.is_empty() || trimmed_flag.is_empty() {
        return Err("profile_id and flag_kind must be non-empty".to_string());
    }
    with_config_file_lock(|| {
        let mut config = AppConfig::load_from_disk_within_lock();
        config
            .profile_health_acknowledged_flags
            .entry(trimmed_profile.to_string())
            .or_default()
            .insert(trimmed_flag.to_string());
        config.save_to_disk()?;
        Ok::<AppConfig, String>(config.without_secrets())
    })?
}

#[tauri::command]
pub fn unacknowledge_profile_health_flag(
    profile_id: String,
    flag_kind: String,
) -> Result<AppConfig, String> {
    let trimmed_profile = profile_id.trim();
    let trimmed_flag = flag_kind.trim();
    if trimmed_profile.is_empty() || trimmed_flag.is_empty() {
        return Err("profile_id and flag_kind must be non-empty".to_string());
    }
    with_config_file_lock(|| {
        let mut config = AppConfig::load_from_disk_within_lock();
        if let Some(set) = config.profile_health_acknowledged_flags.get_mut(trimmed_profile) {
            set.remove(trimmed_flag);
            if set.is_empty() {
                config.profile_health_acknowledged_flags.remove(trimmed_profile);
            }
        }
        config.save_to_disk()?;
        Ok::<AppConfig, String>(config.without_secrets())
    })?
}

/// Tells every mode listener that the effective mode may have changed.
///
/// Every path that writes the mode owes this alongside `ready`. The overlay
/// listens on `wordscript-mode-event`; before this existed, only the hotkey
/// paths emitted it, and a settings save reached the overlay solely through a
/// `state.config` identity change — a side effect, not a signal, and one the
/// overlay's fetch debounce could drop.
pub fn emit_effective_mode_event<R: Runtime>(app: &AppHandle<R>, config: &AppConfig) {
    let profile_mode = config
        .text_profiles
        .iter()
        .find(|profile| profile.id == config.active_text_profile_id)
        .map(|profile| profile.work_mode.effective_processing_mode())
        .unwrap_or_else(|| config.processing_mode.clone());

    super::mode_router::emit_mode_event(
        app,
        &super::mode_router::resolve_processing_mode(profile_mode),
    );
}

pub fn emit_ready_event<R: Runtime>(app: &AppHandle<R>, config: &AppConfig) {
    let config = config.without_secrets();
    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({
            "event": "ready",
            "version": env!("CARGO_PKG_VERSION"),
            "config": config,
        }),
    );
}

// Default shortcut rotation.
//
// One rotation for every platform, in canonical contract spelling. The previous
// per-OS branching is gone on purpose: divergent defaults are what let the
// legacy persist-time migration silently rewrite the Windows default on every
// save (D6), and a single set is far easier to keep honest. `Super` renders as
// Cmd on macOS and Win on Windows, so the same token reads correctly everywhere.
//
// The two capture triggers below are modifier-only, which the contract allows
// from two modifiers upward (T3). A modifier-only trigger acts on key release
// rather than press — see `tap_hotkey_uses_release_trigger`.

pub(crate) fn default_hotkey() -> &'static str {
    "Ctrl+Super"
}

pub(crate) fn default_abort_hotkey() -> &'static str {
    "Ctrl+Alt"
}

pub(crate) fn default_pause_hotkey() -> &'static str {
    "Ctrl+Space"
}

/// Default activation mode. `double_tap` rather than `tap` because the default
/// capture triggers above are modifier-only: in tap mode every single press of
/// `Ctrl+Super` would act, which takes that combination away from the rest of
/// the desktop. Double tap gives the first press back — a lone `Ctrl+Alt` does
/// nothing, so `Ctrl+Alt+T` still opens a terminal (ADR 0008).
///
/// This changes the default only. `AppConfig` is `#[serde(default)]`, so the
/// value is used when the key is absent from the file; a config that already
/// records an `activation_mode` keeps it. Nothing rewrites a chosen value.
pub(crate) fn default_activation_mode() -> &'static str {
    "double_tap"
}

fn default_overlay_monitor() -> &'static str {
    "primary"
}

fn default_hold_watchdog_seconds() -> u64 {
    120
}

fn default_double_tap_window_ms() -> u64 {
    400
}

fn default_result_actions_timeout_s() -> u64 {
    9
}

fn default_mode_select_timeout_s() -> u64 {
    6
}

fn default_legacy_auto_paste() -> bool {
    true
}

fn default_sound_volume() -> f32 {
    super::sound::DEFAULT_VOLUME
}

fn default_sound_pack() -> String {
    super::sound::DEFAULT_PACK.as_str().to_string()
}

fn default_play_startup_sound() -> bool {
    true
}

/// The mode lane sits on `Alt`, not on `Ctrl`. `Ctrl+S` took the save shortcut
/// away from every editor on the desktop and `Ctrl+1`-`Ctrl+6` took tab
/// switching away from every browser — the two collisions of the rotation users
/// hit daily. `Alt` renders as `Option` on macOS and stays `Alt` on Windows and
/// Linux, so one stored value carries the right platform spelling on its own.
fn default_mode_picker_hotkey() -> String {
    "Alt+S".to_string()
}

fn default_mode_auto_hotkey() -> String {
    "Alt+1".to_string()
}

fn default_mode_verbatim_hotkey() -> String {
    "Alt+2".to_string()
}

fn default_mode_cleanup_hotkey() -> String {
    "Alt+3".to_string()
}

fn default_mode_rewrite_hotkey() -> String {
    "Alt+4".to_string()
}

/// Empty, and it is the only mode default that is. See the field's own note.
/// Dark, which is what every window rendered before this field existed. A
/// config that predates it therefore looks exactly as it did.
fn default_color_scheme() -> String {
    "dark".to_string()
}

/// The three values the shell understands. Anything else normalizes to the
/// default rather than reaching a window that would render it as `undefined`.
pub fn normalize_color_scheme(value: &str) -> String {
    match value.trim().to_lowercase().as_str() {
        "light" => "light".to_string(),
        "system" => "system".to_string(),
        _ => default_color_scheme(),
    }
}

fn default_mode_translate_hotkey() -> String {
    String::new()
}

fn default_mode_agent_hotkey() -> String {
    "Alt+5".to_string()
}

fn default_mode_prompt_enhance_hotkey() -> String {
    "Alt+6".to_string()
}

fn normalize_overlay_monitor_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default_overlay_monitor().to_string()
    } else {
        trimmed.to_string()
    }
}

/// Canonicalizes a persisted shortcut through the single contract owner
/// (`core::shortcut`).
///
/// Three deliberate departures from the previous behavior:
/// - an empty value stays empty, meaning "disabled", instead of silently
///   becoming the platform default (T7);
/// - a value that cannot be parsed is stored unchanged so the UI can show it as
///   "not registerable", instead of being lowercased into something that can
///   never register (D5);
/// - nothing is truncated or rewritten here. The one legacy rewrite that used
///   to run on every save now lives in `migrate_shortcut_schema` behind a
///   version gate (D6).
fn normalize_shortcut_value(value: &str, allow_modifier_only: bool) -> String {
    super::shortcut::normalize_for_storage(
        value,
        super::shortcut::session_policy(allow_modifier_only),
    )
}

/// One-shot migration of shortcut values written by older builds. Runs only
/// while `shortcut_schema_version` is below the current version, so a value the
/// user chose today can never be rewritten by a legacy rule tomorrow.
///
/// Version 1: the pre-contract normalizer dropped the trailing key of
/// `ctrl_l+win+space`, `ctrl_l+cmd+space` and `ctrl_l+alt_l+space` on every
/// save, which turned the Windows default hotkey into a modifier-only shortcut
/// and made those three combinations unselectable. Configs written by that
/// build therefore hold the truncated value; there is nothing to repair, but
/// the version is recorded so the truncation cannot come back.
///
/// Version 2: the whole mode lane moved from `Ctrl` to `Alt` (`Ctrl+S` ->
/// `Alt+S`, `Ctrl+1`-`Ctrl+6` -> `Alt+1`-`Alt+6`). A slot that still holds
/// exactly its old default is moved along, so an installation that never
/// touched the binding ends up on the new standard instead of keeping the save
/// and tab-switching grabs forever. Every other value — a shortcut the user
/// assigned, an empty slot meaning "disabled", and a `Ctrl+…` value re-entered
/// after this migration ran — is left alone, because the version gate makes
/// this a one-shot rule.
fn migrate_shortcut_schema(config: &mut AppConfig) {
    if config.shortcut_schema_version >= SHORTCUT_SCHEMA_VERSION {
        return;
    }

    if config.shortcut_schema_version < 2 {
        migrate_mode_lane_from_ctrl_to_alt(config);
    }

    config.shortcut_schema_version = SHORTCUT_SCHEMA_VERSION;
}

/// Moves every mode slot that still holds its pre-version-2 `Ctrl` default onto
/// the matching `Alt` default.
///
/// A slot is skipped when its new value is already held by a hotkey that is not
/// itself migrating — a user who put `Alt+2` on mode auto by hand must not have
/// mode verbatim migrated on top of it, because a colliding pair cannot be
/// registered and would leave both bindings dead.
fn migrate_mode_lane_from_ctrl_to_alt(config: &mut AppConfig) {
    let replacements = [
        default_mode_picker_hotkey(),
        default_mode_auto_hotkey(),
        default_mode_verbatim_hotkey(),
        default_mode_cleanup_hotkey(),
        default_mode_rewrite_hotkey(),
        default_mode_agent_hotkey(),
        default_mode_prompt_enhance_hotkey(),
    ];
    let mut slots = [
        &mut config.mode_picker_hotkey,
        &mut config.mode_auto_hotkey,
        &mut config.mode_verbatim_hotkey,
        &mut config.mode_cleanup_hotkey,
        &mut config.mode_rewrite_hotkey,
        &mut config.mode_agent_hotkey,
        &mut config.mode_prompt_enhance_hotkey,
    ];

    let moves: Vec<bool> = slots
        .iter()
        .zip(LEGACY_MODE_HOTKEYS)
        .map(|(slot, legacy)| normalize_shortcut_value(slot, true) == legacy)
        .collect();

    let mut taken: Vec<String> = [&config.hotkey, &config.pause_hotkey, &config.abort_hotkey]
        .into_iter()
        .map(|value| normalize_shortcut_value(value, true))
        .collect();
    taken.extend(
        slots
            .iter()
            .zip(&moves)
            .filter(|(_, moving)| !**moving)
            .map(|(slot, _)| normalize_shortcut_value(slot, true)),
    );

    for ((slot, moving), replacement) in slots.iter_mut().zip(moves).zip(replacements) {
        if moving && !taken.contains(&replacement) {
            **slot = replacement;
        }
    }
}

fn default_local_prompt_strength() -> &'static str {
    "profile"
}

fn normalize_local_correction_model_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        DEFAULT_LOCAL_CORRECTION_MODEL.to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_local_decode_value(value: u8, fallback: u8) -> u8 {
    match value {
        1..=8 => value,
        _ => fallback.clamp(1, 8),
    }
}

fn default_local_beam_size_for_profile(profile: &str) -> u8 {
    if normalize_local_profile_id(profile, "base").ends_with("-quality") {
        5
    } else {
        1
    }
}

fn default_local_best_of_for_profile(profile: &str) -> u8 {
    if normalize_local_profile_id(profile, "base").ends_with("-quality") {
        5
    } else {
        1
    }
}

fn normalize_local_profile_prompt_settings(
    settings: &[LocalProfilePromptSettings],
) -> Vec<LocalProfilePromptSettings> {
    let mut normalized = Vec::new();

    for entry in settings {
        let profile_id = normalize_local_profile_id(&entry.profile_id, "base");
        let normalized_entry = LocalProfilePromptSettings {
            profile_id,
            prompt_strength: normalize_local_prompt_strength_value(&entry.prompt_strength),
            prompt_carry: entry.prompt_carry,
        };

        upsert_local_profile_prompt_settings(&mut normalized, normalized_entry);
    }

    normalized
}

fn upsert_local_profile_prompt_settings(
    settings: &mut Vec<LocalProfilePromptSettings>,
    entry: LocalProfilePromptSettings,
) {
    if let Some(existing) = settings
        .iter_mut()
        .find(|candidate| candidate.profile_id == entry.profile_id)
    {
        *existing = entry;
        return;
    }

    settings.push(entry);
}

fn resolve_active_local_profile_prompt_settings(
    settings: &[LocalProfilePromptSettings],
    profile_id: &str,
    active_prompt_strength: &str,
    active_prompt_carry: bool,
) -> LocalProfilePromptSettings {
    let normalized_profile_id = normalize_local_profile_id(profile_id, "base");

    if let Some(existing) = settings
        .iter()
        .find(|candidate| candidate.profile_id == normalized_profile_id)
    {
        return existing.clone();
    }

    LocalProfilePromptSettings {
        profile_id: normalized_profile_id,
        prompt_strength: normalize_local_prompt_strength_value(active_prompt_strength),
        prompt_carry: active_prompt_carry,
    }
}

fn normalize_local_profile_decode_settings(
    settings: &[LocalProfileDecodeSettings],
) -> Vec<LocalProfileDecodeSettings> {
    let mut normalized = Vec::new();

    for entry in settings {
        let profile_id = normalize_local_profile_id(&entry.profile_id, "base");
        let normalized_entry = LocalProfileDecodeSettings {
            beam_size: normalize_local_decode_value(
                entry.beam_size,
                default_local_beam_size_for_profile(&profile_id),
            ),
            best_of: normalize_local_decode_value(
                entry.best_of,
                default_local_best_of_for_profile(&profile_id),
            ),
            profile_id,
        };

        upsert_local_profile_decode_settings(&mut normalized, normalized_entry);
    }

    normalized
}

fn upsert_local_profile_decode_settings(
    settings: &mut Vec<LocalProfileDecodeSettings>,
    entry: LocalProfileDecodeSettings,
) {
    if let Some(existing) = settings
        .iter_mut()
        .find(|candidate| candidate.profile_id == entry.profile_id)
    {
        *existing = entry;
        return;
    }

    settings.push(entry);
}

fn resolve_active_local_profile_decode_settings(
    settings: &[LocalProfileDecodeSettings],
    profile_id: &str,
    active_beam_size: u8,
    active_best_of: u8,
) -> LocalProfileDecodeSettings {
    let normalized_profile_id = normalize_local_profile_id(profile_id, "base");

    if let Some(existing) = settings
        .iter()
        .find(|candidate| candidate.profile_id == normalized_profile_id)
    {
        return existing.clone();
    }

    LocalProfileDecodeSettings {
        profile_id: normalized_profile_id.clone(),
        beam_size: normalize_local_decode_value(
            active_beam_size,
            default_local_beam_size_for_profile(&normalized_profile_id),
        ),
        best_of: normalize_local_decode_value(
            active_best_of,
            default_local_best_of_for_profile(&normalized_profile_id),
        ),
    }
}

fn normalize_local_prompt_strength_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "off" => "off".to_string(),
        "profile_and_terms" | "terms" | "strong" => "profile_and_terms".to_string(),
        _ => default_local_prompt_strength().to_string(),
    }
}

pub(crate) fn normalize_local_model_value(model: &str) -> String {
    let normalized = model.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "" => "base".to_string(),
        "large" => "large-v3".to_string(),
        "large_v3" => "large-v3".to_string(),
        other => other.to_string(),
    }
}

fn default_local_profile_mode_for_model(model: &str) -> &'static str {
    let normalized = normalize_local_model_value(model);

    if normalized.starts_with("tiny")
        || normalized.starts_with("base")
        || normalized.starts_with("small")
        || normalized.starts_with("distil-")
        || normalized.ends_with("-turbo")
    {
        "fast"
    } else {
        "quality"
    }
}

pub(crate) fn default_local_profile_for_model(model: &str) -> String {
    let normalized = normalize_local_model_value(model);
    format!(
        "local-preview-{}-{}",
        normalized,
        default_local_profile_mode_for_model(&normalized)
    )
}

pub(crate) fn local_model_from_profile_id(profile: &str) -> Option<String> {
    let normalized = profile.trim().to_ascii_lowercase();
    let rest = normalized.strip_prefix("local-preview-")?;

    rest.strip_suffix("-fast")
        .or_else(|| rest.strip_suffix("-quality"))
        .map(normalize_local_model_value)
}

pub(crate) fn normalize_local_profile_id(profile: &str, fallback_model: &str) -> String {
    let normalized = profile.trim().to_ascii_lowercase();
    let fallback = default_local_profile_for_model(fallback_model);

    let Some(model) = local_model_from_profile_id(&normalized) else {
        return fallback;
    };

    let mode = if normalized.ends_with("-quality") {
        "quality"
    } else {
        "fast"
    };

    format!("local-preview-{}-{}", model, mode)
}

fn default_text_profile_id() -> &'static str {
    "general"
}

fn default_text_profile_label() -> &'static str {
    "General writing"
}

fn default_text_profile_rewrite_style() -> &'static str {
    "clean"
}

fn default_text_profile_insert_behavior() -> &'static str {
    "auto_paste"
}

fn default_text_profile_recovery_behavior() -> &'static str {
    "standard"
}

fn normalize_text_profile_rewrite_style_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "verbatim" => "verbatim".to_string(),
        "polished" | "professional" => "polished".to_string(),
        _ => default_text_profile_rewrite_style().to_string(),
    }
}

fn normalize_text_profile_insert_behavior_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "clipboard_only" | "clipboard" | "manual" => "clipboard_only".to_string(),
        _ => default_text_profile_insert_behavior().to_string(),
    }
}

fn normalize_text_profile_recovery_behavior_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "standard" => "standard".to_string(),
        _ => default_text_profile_recovery_behavior().to_string(),
    }
}

fn normalize_text_profile_work_mode(value: &TextProfileWorkMode) -> TextProfileWorkMode {
    TextProfileWorkMode {
        rewrite_style: normalize_text_profile_rewrite_style_value(&value.rewrite_style),
        insert_behavior: normalize_text_profile_insert_behavior_value(&value.insert_behavior),
        recovery_behavior: normalize_text_profile_recovery_behavior_value(&value.recovery_behavior),
        processing_mode: value.processing_mode.clone(),
        enhance_sub_mode: value.enhance_sub_mode.clone(),
        target: value.target.clone(),
        bias_mode: normalize_bias_mode(&value.bias_mode),
        manual_bias: normalize_manual_bias(&value.manual_bias),
    }
}

fn normalize_bias_mode(value: &BiasMode) -> BiasMode {
    value.clone()
}

fn normalize_manual_bias(value: &ManualBias) -> ManualBias {
    ManualBias {
        cloud_include_profile_terms: value.cloud_include_profile_terms,
        local_include_profile_terms: value.local_include_profile_terms,
        stt_hints_override: value.stt_hints_override.trim().to_string(),
    }
}

fn default_text_profile(
    prompt: String,
    stt_hints: String,
    dictionary_entries: Vec<DictionaryEntry>,
    snippet_entries: Vec<SnippetEntry>,
) -> TextProfile {
    TextProfile {
        id: default_text_profile_id().to_string(),
        label: default_text_profile_label().to_string(),
        prompt,
        stt_hints,
        // A freshly built profile has nothing to migrate.
        vocabulary_hints: Vec::new(),
        schema_version: TEXT_PROFILE_SCHEMA_VERSION,
        work_mode: TextProfileWorkMode::default(),
        curation: TextProfileCuration::default(),
        dictionary_entries,
        snippet_entries,
        speech: None,
        modes: None,
        capture: None,
    }
}

fn curated_text_profile_seeds() -> Vec<TextProfile> {
    serde_json::from_str(include_str!("../../../src/data/curatedTextProfiles.json"))
        .expect("curated text profile seed data must stay valid")
}

fn default_seeded_text_profiles() -> Vec<TextProfile> {
    let mut profiles = vec![default_text_profile(
        String::new(),
        String::new(),
        Vec::new(),
        Vec::new(),
    )];
    profiles.extend(curated_text_profile_seeds());
    profiles
}

fn append_missing_curated_text_profiles(text_profiles: &mut Vec<TextProfile>) {
    for seed in curated_text_profile_seeds() {
        if text_profiles.iter().any(|profile| profile.id == seed.id) {
            continue;
        }

        text_profiles.push(seed);
    }
}

/// Refreshes the *presentation* of a curated profile from its seed: audience,
/// summary and highlights, so an improved template description reaches an
/// existing install.
///
/// It deliberately does not touch `work_mode`. It used to, and that silently
/// reset a user's delivery mode: the "edited" signal is `curation.curated =
/// false`, set by the UI on edit, but only one of the three write paths
/// actually cleared it. A curated profile switched to `clipboard_only` was
/// therefore reset to the seed's `auto_paste` on the very next save, and the
/// runtime delivered through the wrong pipeline while the settings draft still
/// showed the chosen value.
///
/// Requiring every present and future write path to remember one call is the
/// same shape of defect as the transcription wiring gap (ADR 0015). Behaviour
/// a user can edit is never rewritten from a template here; only presentation
/// is refreshed, which is what the name promises.
fn refresh_curated_text_profile_presentation(text_profiles: &mut [TextProfile]) {
    let seeds = curated_text_profile_seeds();
    for profile in text_profiles.iter_mut() {
        if !profile.curation.curated {
            continue;
        }

        let Some(seed) = seeds.iter().find(|seed| seed.id == profile.id) else {
            continue;
        };

        profile.curation = seed.curation.clone();
    }
}

fn legacy_text_rules_present(legacy: &LegacyTextRules) -> bool {
    !legacy.prompt.trim().is_empty()
        || !legacy.stt_hints.trim().is_empty()
        || !legacy.dictionary_entries.is_empty()
        || !legacy.snippet_entries.is_empty()
}

fn raw_has_persisted_text_profiles(raw_value: &serde_json::Value) -> bool {
    raw_value
        .get("text_profiles")
        .and_then(|profiles| profiles.as_array())
        .map(|profiles| !profiles.is_empty())
        .unwrap_or(false)
}

fn should_reseed_curated_text_profiles(raw_value: &serde_json::Value) -> bool {
    let Some(profiles) = raw_value
        .get("text_profiles")
        .and_then(|profiles| profiles.as_array())
    else {
        return false;
    };

    if profiles.is_empty() {
        return false;
    }

    match raw_value
        .get("curated_profiles_seeded")
        .and_then(|value| value.as_bool())
    {
        Some(false) | None => return true,
        Some(true) => {}
    }

    let has_curated_profile = profiles.iter().any(|profile| {
        profile
            .get("curation")
            .and_then(|curation| curation.get("curated"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false)
    });
    if has_curated_profile {
        return false;
    }

    // Legacy profile configs from before the work-mode rollout were incorrectly
    // treated as already seeded and therefore never received the included baselines.
    profiles
        .iter()
        .all(|profile| profile.get("work_mode").is_none())
}

fn apply_legacy_text_rules_from_value(config: &mut AppConfig, raw_value: &serde_json::Value) {
    if raw_has_persisted_text_profiles(raw_value) {
        return;
    }

    let legacy = serde_json::from_value::<LegacyTextRules>(raw_value.clone()).unwrap_or_default();
    if !legacy_text_rules_present(&legacy) {
        return;
    }

    config.text_profiles = vec![default_text_profile(
        legacy.prompt,
        legacy.stt_hints,
        legacy.dictionary_entries,
        legacy.snippet_entries,
    )];
    config.active_text_profile_id = default_text_profile_id().to_string();
    config.curated_profiles_seeded = false;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disk_config_payload_never_contains_groq_key() {
        let config = AppConfig {
            legacy_groq_api_key: "gsk_secret_value".to_string(),
            ..AppConfig::default()
        };

        let serialized =
            serde_json::to_string(&config.without_secrets()).expect("serialize config");

        assert!(!serialized.contains("gsk_secret_value"));
        assert!(!serialized.contains("legacy_groq_api_key"));
        assert!(!serialized.contains("groq_api_key"));
    }

    #[test]
    fn normalizes_legacy_shortcuts_to_the_canonical_contract_form() {
        assert_eq!(normalize_shortcut_value("ctrl_l, win", true), "Ctrl+Super");
        assert_eq!(normalize_shortcut_value("ctrl_l+alt_l", true), "Ctrl+Alt");
        assert_eq!(normalize_shortcut_value("Ctrl+F9", true), "Ctrl+F9");
        assert_eq!(normalize_shortcut_value("ctrl_l+f9", true), "Ctrl+F9");
    }

    #[test]
    fn space_combinations_survive_persist_time_normalization() {
        // D6: these three used to lose their trailing key on every save, which
        // silently rewrote the Windows default hotkey to a modifier-only value.
        assert_eq!(
            normalize_shortcut_value("ctrl_l+alt_l+space", true),
            "Ctrl+Alt+Space"
        );
        assert_eq!(
            normalize_shortcut_value("ctrl_l+win+space", true),
            "Ctrl+Super+Space"
        );
        assert_eq!(
            normalize_shortcut_value("ctrl_l+cmd+space", true),
            "Ctrl+Super+Space"
        );
    }

    #[test]
    fn empty_shortcut_stays_disabled_instead_of_reverting_to_the_default() {
        // T7: clearing a mode hotkey means "disabled". Reverting to the
        // platform default made a shortcut impossible to switch off.
        let mut config = AppConfig {
            mode_agent_hotkey: String::new(),
            mode_rewrite_hotkey: "   ".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.mode_agent_hotkey, "");
        assert_eq!(config.mode_rewrite_hotkey, "");
    }

    #[test]
    fn bare_function_key_shortcuts_are_preserved_not_rewritten() {
        // The reporter's escaped state (`hotkey = "f1"`, `abort_hotkey = "f4"`)
        // must survive the migration; it is surfaced as a warning, not silently
        // replaced.
        let mut config = AppConfig {
            hotkey: "f1".to_string(),
            abort_hotkey: "f4".to_string(),
            pause_hotkey: "ctrl_l+f10".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.hotkey, "F1");
        assert_eq!(config.abort_hotkey, "F4");
        assert_eq!(config.pause_hotkey, "Ctrl+F10");
    }

    #[test]
    fn unparsable_shortcut_is_kept_verbatim_instead_of_being_mangled() {
        // D5: the old normalizer lowercased unknown tokens and stored a value
        // that could never register, with the failure visible only in a toast.
        let mut config = AppConfig {
            mode_cleanup_hotkey: "ctrl_l+florp".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.mode_cleanup_hotkey, "ctrl_l+florp");
    }

    #[test]
    fn shortcut_schema_version_is_stamped_once() {
        let mut config = AppConfig {
            shortcut_schema_version: 0,
            ..AppConfig::default()
        };

        config.normalize_for_runtime();
        assert_eq!(config.shortcut_schema_version, SHORTCUT_SCHEMA_VERSION);

        // Re-running must not change anything else either.
        let before = config.clone();
        config.normalize_for_runtime();
        assert_eq!(config.hotkey, before.hotkey);
        assert_eq!(config.shortcut_schema_version, before.shortcut_schema_version);
    }

    #[test]
    fn the_untouched_ctrl_mode_lane_moves_to_alt() {
        // Schema version 2: an installation that never touched the mode lane
        // must land on `Alt+S` and `Alt+1`-`Alt+6` instead of keeping the save
        // and tab-switching grabs. The raw legacy spellings count too, because
        // the migration runs before normalization.
        let mut config = AppConfig {
            shortcut_schema_version: 1,
            mode_picker_hotkey: "ctrl_l+s".to_string(),
            mode_auto_hotkey: "Ctrl+1".to_string(),
            mode_verbatim_hotkey: "Ctrl+2".to_string(),
            mode_cleanup_hotkey: "Ctrl+3".to_string(),
            mode_rewrite_hotkey: "Ctrl+4".to_string(),
            mode_agent_hotkey: "ctrl_l+5".to_string(),
            mode_prompt_enhance_hotkey: "Ctrl+6".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.mode_picker_hotkey, "Alt+S");
        assert_eq!(config.mode_auto_hotkey, "Alt+1");
        assert_eq!(config.mode_verbatim_hotkey, "Alt+2");
        assert_eq!(config.mode_cleanup_hotkey, "Alt+3");
        assert_eq!(config.mode_rewrite_hotkey, "Alt+4");
        assert_eq!(config.mode_agent_hotkey, "Alt+5");
        assert_eq!(config.mode_prompt_enhance_hotkey, "Alt+6");
        assert_eq!(config.shortcut_schema_version, SHORTCUT_SCHEMA_VERSION);
        assert!(validate_hotkey_collisions(&config).is_ok());
    }

    #[test]
    fn a_chosen_mode_shortcut_survives_the_default_change() {
        // Only untouched old defaults move. A shortcut the user assigned stays,
        // an empty slot stays disabled, and a `Ctrl+…` value re-entered after
        // the migration ran is never taken away again — the version gate makes
        // the rule one-shot.
        let mut config = AppConfig {
            shortcut_schema_version: 1,
            mode_picker_hotkey: "Ctrl+Alt+M".to_string(),
            mode_auto_hotkey: String::new(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();
        assert_eq!(config.mode_picker_hotkey, "Ctrl+Alt+M");
        assert_eq!(config.mode_auto_hotkey, "");

        let mut reassigned = AppConfig {
            mode_picker_hotkey: "Ctrl+S".to_string(),
            ..AppConfig::default()
        };

        reassigned.normalize_for_runtime();
        assert_eq!(reassigned.mode_picker_hotkey, "Ctrl+S");
    }

    #[test]
    fn the_migration_never_moves_a_slot_onto_an_occupied_shortcut() {
        // A user who put `Alt+2` on mode auto by hand must not get mode
        // verbatim migrated on top of it: a colliding pair cannot be registered
        // and would leave both bindings dead.
        let mut config = AppConfig {
            shortcut_schema_version: 1,
            mode_auto_hotkey: "Alt+2".to_string(),
            mode_verbatim_hotkey: "Ctrl+2".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.mode_auto_hotkey, "Alt+2");
        assert_eq!(config.mode_verbatim_hotkey, "Ctrl+2");
        assert!(validate_hotkey_collisions(&config).is_ok());
    }

    #[test]
    fn collision_validation_sees_normalized_values() {
        // D7: `ctrl_l+f9` and `Ctrl+F9` are the same grab. Validating raw
        // values let two spellings of one combination through.
        let config = AppConfig {
            hotkey: "Ctrl+F9".to_string(),
            mode_agent_hotkey: "ctrl_l+f9".to_string(),
            ..AppConfig::default()
        };

        assert!(validate_hotkey_collisions(&config).is_err());
    }

    #[test]
    fn every_default_shortcut_satisfies_the_contract() {
        // A default that cannot be parsed or registered ships a broken lane to
        // every new user, and a default that collides with another default is
        // rejected at registration time. Both were reachable before: the
        // Windows default was rewritten on every save (D6) and the platform
        // branches were never checked against each other.
        let config = AppConfig::default();
        assert!(validate_hotkey_collisions(&config).is_ok());

        let policy = super::super::shortcut::Policy::default();
        for (label, value) in [
            ("hotkey", &config.hotkey),
            ("pause_hotkey", &config.pause_hotkey),
            ("abort_hotkey", &config.abort_hotkey),
            ("mode_picker", &config.mode_picker_hotkey),
            ("mode_auto", &config.mode_auto_hotkey),
            ("mode_verbatim", &config.mode_verbatim_hotkey),
            ("mode_cleanup", &config.mode_cleanup_hotkey),
            ("mode_rewrite", &config.mode_rewrite_hotkey),
            ("mode_agent", &config.mode_agent_hotkey),
            ("mode_prompt_enhance", &config.mode_prompt_enhance_hotkey),
        ] {
            let parsed = super::super::shortcut::parse(value, policy)
                .unwrap_or_else(|error| panic!("default {label} ('{value}') is invalid: {error}"));
            assert!(
                parsed.parsed().is_some(),
                "default {label} must not be empty"
            );
        }
    }

    #[test]
    fn defaults_survive_normalization_unchanged() {
        // The defaults are already in canonical form, so a fresh config must
        // come back byte-identical from `normalize_for_runtime`.
        let mut config = AppConfig::default();
        let before = config.clone();
        config.normalize_for_runtime();

        assert_eq!(config.hotkey, before.hotkey);
        assert_eq!(config.pause_hotkey, before.pause_hotkey);
        assert_eq!(config.abort_hotkey, before.abort_hotkey);
        assert_eq!(config.mode_picker_hotkey, before.mode_picker_hotkey);
        assert_eq!(config.mode_agent_hotkey, before.mode_agent_hotkey);
    }

    #[test]
    fn collision_validation_skips_unparsable_values() {
        let config = AppConfig {
            mode_agent_hotkey: "ctrl_l+florp".to_string(),
            ..AppConfig::default()
        };

        assert!(validate_hotkey_collisions(&config).is_ok());
    }

    #[test]
    fn normalizes_unknown_provider_to_default_runtime_provider() {
        let mut config = AppConfig {
            provider: "openai".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.provider, "groq");
    }

    #[test]
    fn normalizes_history_settings_to_supported_runtime_values() {
        let mut config = AppConfig {
            history_limit: 2,
            history_retention_days: 9_999,
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.history_limit, 25);
        assert_eq!(config.history_retention_days, 3650);
    }

    #[test]
    fn normalizes_local_preview_controls_into_runtime_safe_values() {
        let mut config = AppConfig {
            provider: "local_preview".to_string(),
            local_model: "large_v3".to_string(),
            local_profile: String::new(),
            local_prompt_strength: "strong".to_string(),
            local_beam_size: 0,
            local_best_of: 42,
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_model, "large-v3");
        assert_eq!(config.local_profile, "local-preview-large-v3-quality");
        assert_eq!(config.local_prompt_strength, "profile_and_terms");
        assert!(!config.local_prompt_carry);
        assert!(config.local_profile_prompt_settings.iter().any(|entry| {
            entry
                == &LocalProfilePromptSettings {
                    profile_id: "local-preview-large-v3-quality".to_string(),
                    prompt_strength: "profile_and_terms".to_string(),
                    prompt_carry: false,
                }
        }));
        assert_eq!(config.local_beam_size, 5);
        assert_eq!(config.local_best_of, 5);
        assert!(config.local_profile_decode_settings.iter().any(|entry| {
            entry
                == &LocalProfileDecodeSettings {
                    profile_id: "local-preview-large-v3-quality".to_string(),
                    beam_size: 5,
                    best_of: 5,
                }
        }));
        assert!(config.local_profile_decode_settings.iter().any(|entry| {
            LocalProfileDecodeSettings {
                profile_id: "local-preview-base-fast".to_string(),
                beam_size: 1,
                best_of: 1,
            } == *entry
        }));
    }

    #[test]
    fn selected_local_profile_overrides_stale_local_model() {
        let mut config = AppConfig {
            provider: "local_preview".to_string(),
            local_model: "base".to_string(),
            local_profile: "local-preview-medium-fast".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_model, "medium");
        assert_eq!(config.local_profile, "local-preview-medium-fast");
    }

    #[test]
    fn selected_local_profile_uses_profile_specific_decode_settings() {
        let mut config = AppConfig {
            provider: "local_preview".to_string(),
            local_model: "base".to_string(),
            local_profile: "local-preview-medium-quality".to_string(),
            local_beam_size: 1,
            local_best_of: 1,
            local_profile_decode_settings: vec![LocalProfileDecodeSettings {
                profile_id: "local-preview-medium-quality".to_string(),
                beam_size: 7,
                best_of: 6,
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_beam_size, 7);
        assert_eq!(config.local_best_of, 6);
        assert_eq!(
            config.local_profile_decode_settings[0],
            LocalProfileDecodeSettings {
                profile_id: "local-preview-medium-quality".to_string(),
                beam_size: 7,
                best_of: 6,
            }
        );
    }

    #[test]
    fn selected_local_profile_uses_profile_specific_prompt_settings() {
        let mut config = AppConfig {
            provider: "local_preview".to_string(),
            local_model: "base".to_string(),
            local_profile: "local-preview-medium-quality".to_string(),
            local_prompt_strength: "off".to_string(),
            local_prompt_carry: false,
            local_profile_prompt_settings: vec![LocalProfilePromptSettings {
                profile_id: "local-preview-medium-quality".to_string(),
                prompt_strength: "profile_and_terms".to_string(),
                prompt_carry: true,
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_prompt_strength, "profile_and_terms");
        assert!(config.local_prompt_carry);
        assert_eq!(
            config.local_profile_prompt_settings[0],
            LocalProfilePromptSettings {
                profile_id: "local-preview-medium-quality".to_string(),
                prompt_strength: "profile_and_terms".to_string(),
                prompt_carry: true,
            }
        );
    }

    #[test]
    fn migrates_legacy_text_rules_into_the_default_profile() {
        let raw_value = serde_json::json!({
            "prompt": "Product names and internal jargon",
            "stt_hints": "status update\nincident review",
            "dictionary_entries": [
                {
                    "id": "dict-brand",
                    "phrase": "word script",
                    "replace_with": "WordScript"
                }
            ],
            "snippet_entries": [
                {
                    "id": "snippet-follow-up",
                    "label": "Follow-up",
                    "trigger": "follow up",
                    "expansion": "Thanks for the update."
                }
            ]
        });

        let mut config = AppConfig {
            active_text_profile_id: String::new(),
            text_profiles: Vec::new(),
            curated_profiles_seeded: false,
            ..AppConfig::default()
        };

        apply_legacy_text_rules_from_value(&mut config, &raw_value);
        config.normalize_for_runtime();

        assert_eq!(config.active_text_profile_id, "general");
        assert!(config.curated_profiles_seeded);
        assert!(config.text_profiles.len() >= 6);

        let general_profile = config
            .text_profiles
            .iter()
            .find(|profile| profile.id == "general")
            .expect("general profile");

        assert_eq!(general_profile.label, "General writing");
        assert_eq!(general_profile.prompt, "Product names and internal jargon");
        assert_eq!(general_profile.stt_hints, "status update\nincident review");
        assert_eq!(general_profile.dictionary_entries.len(), 1);
        assert_eq!(general_profile.snippet_entries.len(), 1);
        assert!(config
            .text_profiles
            .iter()
            .any(|profile| profile.curation.curated));
    }

    #[test]
    fn ships_double_tap_and_insert_at_cursor_out_of_the_box() {
        let mut config = AppConfig::default();
        config.normalize_for_runtime();

        assert_eq!(config.activation_mode, "double_tap");
        assert_eq!(
            config.active_text_profile().work_mode.effective_insert_behavior(),
            "auto_paste"
        );
    }

    #[test]
    fn keeps_existing_active_text_profile_as_runtime_owner() {
        let mut config = AppConfig {
            active_text_profile_id: "support".to_string(),
            text_profiles: vec![
                TextProfile {
                    id: "general".to_string(),
                    label: "General writing".to_string(),
                    prompt: "General".to_string(),
                    stt_hints: String::new(),
                    work_mode: TextProfileWorkMode::default(),
                    curation: TextProfileCuration::default(),
                    dictionary_entries: Vec::new(),
                    snippet_entries: Vec::new(),
                    speech: None,
                    modes: None,
                    capture: None,
                    ..TextProfile::default()
                },
                TextProfile {
                    id: "support".to_string(),
                    label: "Support reply".to_string(),
                    prompt: "Support tone and escalation names".to_string(),
                    stt_hints: "status update\ntriage summary".to_string(),
                    work_mode: TextProfileWorkMode {
                        rewrite_style: "professional".to_string(),
                        insert_behavior: "clipboard".to_string(),
                        recovery_behavior: "guided".to_string(),
                        ..Default::default()
                    },
                    curation: TextProfileCuration::default(),
                    dictionary_entries: vec![DictionaryEntry {
                        id: "dict-escalation".to_string(),
                        phrase: "sev one".to_string(),
                        replace_with: "SEV-1".to_string(),
                    }],
                    snippet_entries: vec![SnippetEntry {
                        id: "snippet-status".to_string(),
                        label: "Status".to_string(),
                        trigger: "status update".to_string(),
                        expansion: "We will send the next status at 10:00.".to_string(),
                    }],
                    speech: None,
                    modes: None,
                    capture: None,
                    ..TextProfile::default()
                },
            ],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        let active_profile = config.active_text_profile();
        assert_eq!(active_profile.id, "support");
        assert_eq!(active_profile.label, "Support reply");
        assert_eq!(active_profile.prompt, "Support tone and escalation names");
        assert_eq!(active_profile.stt_hints, "status update\ntriage summary");
        assert_eq!(active_profile.work_mode.rewrite_style, "polished");
        assert_eq!(active_profile.work_mode.insert_behavior, "clipboard_only");
        assert_eq!(active_profile.work_mode.recovery_behavior, "standard");
        assert_eq!(active_profile.dictionary_entries.len(), 1);
        assert_eq!(active_profile.snippet_entries.len(), 1);
        assert_eq!(
            config.active_text_profile_label().as_deref(),
            Some("Support reply")
        );
    }

    #[test]
    fn seeds_curated_profiles_once_for_existing_configs() {
        let mut config = AppConfig {
            curated_profiles_seeded: false,
            active_text_profile_id: "general".to_string(),
            text_profiles: vec![TextProfile {
                id: "general".to_string(),
                label: "General writing".to_string(),
                prompt: String::new(),
                stt_hints: String::new(),
                work_mode: TextProfileWorkMode::default(),
                curation: TextProfileCuration::default(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
                    speech: None,
                    modes: None,
                    capture: None,
                ..TextProfile::default()
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert!(config.curated_profiles_seeded);
        assert!(config
            .text_profiles
            .iter()
            .any(|profile| profile.id == "curated-customer-success" && profile.curation.curated));
        assert_eq!(
            config
                .text_profiles
                .iter()
                .find(|profile| profile.id == "curated-customer-success")
                .map(|profile| profile.work_mode.rewrite_style.as_str()),
            Some("polished")
        );

        let profile_count = config.text_profiles.len();
        config.normalize_for_runtime();
        assert_eq!(config.text_profiles.len(), profile_count);
    }

    #[test]
    fn refreshes_unedited_curated_profile_work_mode_metadata() {
        let mut config = AppConfig {
            curated_profiles_seeded: true,
            active_text_profile_id: "curated-customer-success".to_string(),
            text_profiles: vec![TextProfile {
                id: "curated-customer-success".to_string(),
                label: "Customer success replies".to_string(),
                prompt: String::new(),
                stt_hints: String::new(),
                work_mode: TextProfileWorkMode::default(),
                curation: TextProfileCuration {
                    curated: true,
                    audience: "Customer success".to_string(),
                    summary: "Old summary".to_string(),
                    highlights: Vec::new(),
                },
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
                    speech: None,
                    modes: None,
                    capture: None,
                ..TextProfile::default()
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        let active_profile = config.active_text_profile();
        // Presentation is refreshed from the seed so an improved template
        // description reaches an existing install.
        assert_eq!(active_profile.curation.summary, "Inbox-ready support follow-ups, escalation language and status updates for customer-facing work.");
        // Behaviour is not. The seed says `polished` / `auto_paste`; the
        // profile keeps what it carries, because a template must never
        // silently rewrite a setting the user owns.
        assert_eq!(
            active_profile.work_mode.insert_behavior,
            TextProfileWorkMode::default().normalized().insert_behavior
        );
    }

    /// The reported bug: every profile except `General writing` delivered
    /// through the wrong pipeline, so the overlay showed the auto-paste surface
    /// while the setting read "Copy to clipboard only".
    ///
    /// `General writing` is the only non-curated profile, which is exactly why
    /// it was the only one unaffected.
    #[test]
    fn a_curated_profile_keeps_the_delivery_mode_the_user_chose() {
        let mut config = AppConfig {
            curated_profiles_seeded: true,
            active_text_profile_id: "curated-customer-success".to_string(),
            text_profiles: vec![TextProfile {
                id: "curated-customer-success".to_string(),
                label: "Customer success replies".to_string(),
                // Still flagged as curated: two of the three UI write paths
                // never cleared it, so this is the realistic persisted state.
                curation: TextProfileCuration {
                    curated: true,
                    ..TextProfileCuration::default()
                },
                work_mode: TextProfileWorkMode {
                    // The seed for this profile says `auto_paste`.
                    insert_behavior: "clipboard_only".to_string(),
                    ..TextProfileWorkMode::default()
                },
                ..TextProfile::default()
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(
            config.active_text_profile().work_mode.insert_behavior,
            "clipboard_only",
            "a save must not reset the chosen delivery mode back to the template"
        );
        assert!(
            !config.active_text_profile_auto_paste(),
            "the runtime delivery decision must follow the chosen mode"
        );
    }

    #[test]
    fn saving_repeatedly_does_not_erode_a_curated_profile_delivery_mode() {
        // The bug only showed up after a save round-trip, so one pass is not
        // enough to prove it stays fixed.
        let mut config = AppConfig {
            curated_profiles_seeded: true,
            active_text_profile_id: "curated-sales".to_string(),
            text_profiles: vec![TextProfile {
                id: "curated-sales".to_string(),
                label: "Sales".to_string(),
                curation: TextProfileCuration {
                    curated: true,
                    ..TextProfileCuration::default()
                },
                work_mode: TextProfileWorkMode {
                    insert_behavior: "clipboard_only".to_string(),
                    ..TextProfileWorkMode::default()
                },
                ..TextProfile::default()
            }],
            ..AppConfig::default()
        };

        for _ in 0..3 {
            config.normalize_for_runtime();
        }

        assert_eq!(
            config.active_text_profile().work_mode.insert_behavior,
            "clipboard_only"
        );
    }

    #[test]
    fn frontend_save_roundtrip_without_legacy_auto_paste_keeps_auto_paste_profile() {
        // The frontend AppConfig has no top-level `auto_paste` field (removed in
        // the mode-hotkey commit); on the Rust side it is `#[serde(default =
        // default_legacy_auto_paste, skip_serializing)]`. A save_config call
        // therefore deserializes a config WITHOUT auto_paste, which must default
        // to `true` so the legacy-migration branch (`if !self.auto_paste`) does
        // NOT force an auto_paste profile back to clipboard_only. This test
        // reproduces the reported "settings switch back to clipboard only" by
        // round-tripping through JSON the way save_config does.
        let raw = serde_json::json!({
            "active_text_profile_id": "general",
            "text_profiles": [{
                "id": "general",
                "label": "General writing",
                "prompt": "",
                "stt_hints": "",
                "work_mode": {
                    "rewrite_style": "polished",
                    "insert_behavior": "auto_paste",
                    "recovery_behavior": "standard",
                    "processing_mode": "auto",
                },
                "curation": { "curated": false, "audience": "", "summary": "", "highlights": [] },
                "dictionary_entries": [],
                "snippet_entries": [],
                "speech": null,
                "modes": null,
                "capture": null,
            }],
            "result_actions_timeout_s": 9,
            "mode_select_timeout_s": 6,
        });

        let mut config: AppConfig = serde_json::from_value(raw).unwrap();
        // auto_paste must have defaulted to true (absent in JSON).
        assert!(config.auto_paste, "legacy auto_paste must default to true when absent");
        config.normalize_for_runtime();
        let active = config.active_text_profile();
        assert_eq!(
            active.work_mode.insert_behavior, "auto_paste",
            "auto_paste profile must NOT be migrated to clipboard_only on a frontend save roundtrip"
        );
    }

    #[test]
    fn normalize_reports_a_rewritten_work_mode_so_the_canonical_form_gets_persisted() {
        // The legacy token `"clipboard"` normalizes to `"clipboard_only"`. If
        // that correction is not reported, `load_from_disk_impl` never sets
        // `should_save`, the raw token survives on disk, and EVERY later load
        // forces the profile back to clipboard-only regardless of what the user
        // selected — observed live as 183 repetitions of the
        // "Config normalize rewrote insert_behavior" diagnostic across two
        // runtime logs, i.e. the correction was recomputed forever and never
        // written down.
        let raw = serde_json::json!({
            "active_text_profile_id": "support",
            "text_profiles": [{
                "id": "support",
                "label": "Support reply",
                "prompt": "",
                "stt_hints": "",
                "work_mode": {
                    "rewrite_style": "polished",
                    "insert_behavior": "clipboard",
                    "recovery_behavior": "standard",
                    "processing_mode": "auto",
                },
                "curation": { "curated": false, "audience": "", "summary": "", "highlights": [] },
                "dictionary_entries": [],
                "snippet_entries": [],
                "speech": null,
                "modes": null,
                "capture": null,
            }],
            "result_actions_timeout_s": 9,
            "mode_select_timeout_s": 6,
        });

        let mut config: AppConfig = serde_json::from_value(raw).unwrap();
        assert!(
            config.normalize_for_runtime(),
            "a rewritten work_mode must be reported so should_save persists it"
        );
        assert_eq!(
            config.active_text_profile().work_mode.insert_behavior,
            "clipboard_only"
        );

        // Second pass on the now-canonical config: nothing left to rewrite, so
        // nothing to save. Without this the fix would trade a silent revert for
        // a config rewritten on every single load.
        assert!(
            !config.normalize_for_runtime(),
            "a canonical work_mode must not report a rewrite"
        );
    }

    #[test]
    fn repairs_legacy_profile_configs_that_were_marked_seeded_too_early() {
        let raw_value = serde_json::json!({
            "active_text_profile_id": "general",
            "text_profiles": [
                {
                    "id": "general",
                    "label": "General writing",
                    "prompt": "",
                    "stt_hints": "",
                    "curation": {
                        "curated": false,
                        "audience": "",
                        "summary": "",
                        "highlights": []
                    },
                    "dictionary_entries": [],
                    "snippet_entries": []
                }
            ],
            "curated_profiles_seeded": true
        });

        assert!(should_reseed_curated_text_profiles(&raw_value));

        let mut config = serde_json::from_value::<AppConfig>(raw_value.clone()).unwrap_or_default();
        apply_legacy_text_rules_from_value(&mut config, &raw_value);
        if should_reseed_curated_text_profiles(&raw_value) {
            config.curated_profiles_seeded = false;
        }
        config.normalize_for_runtime();

        assert!(config.curated_profiles_seeded);
        assert!(config
            .text_profiles
            .iter()
            .any(|profile| profile.id == "curated-customer-success" && profile.curation.curated));
        assert!(config
            .text_profiles
            .iter()
            .any(|profile| profile.id == "curated-sales" && profile.curation.curated));
    }

    #[test]
    fn does_not_reseed_current_shape_configs_after_curated_profiles_were_removed() {
        let raw_value = serde_json::json!({
            "active_text_profile_id": "general",
            "text_profiles": [
                {
                    "id": "general",
                    "label": "General writing",
                    "prompt": "",
                    "stt_hints": "",
                    "work_mode": {
                        "rewrite_style": "clean",
                        "insert_behavior": "auto_paste",
                        "recovery_behavior": "standard"
                    },
                    "curation": {
                        "curated": false,
                        "audience": "",
                        "summary": "",
                        "highlights": []
                    },
                    "dictionary_entries": [],
                    "snippet_entries": []
                }
            ],
            "curated_profiles_seeded": true
        });

        assert!(!should_reseed_curated_text_profiles(&raw_value));
    }

    #[test]
    fn active_text_profile_falls_back_to_first_profile_without_legacy_mirrors() {
        let config = AppConfig {
            active_text_profile_id: "missing".to_string(),
            text_profiles: vec![TextProfile {
                id: "general".to_string(),
                label: "General writing".to_string(),
                prompt: "profile prompt".to_string(),
                stt_hints: "profile hint".to_string(),
                work_mode: TextProfileWorkMode::default(),
                curation: TextProfileCuration::default(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
                    speech: None,
                    modes: None,
                    capture: None,
                ..TextProfile::default()
            }],
            ..AppConfig::default()
        };

        let active_profile = config.active_text_profile();

        assert_eq!(active_profile.id, "general");
        assert_eq!(active_profile.prompt, "profile prompt");
        assert_eq!(active_profile.stt_hints, "profile hint");
        assert_eq!(active_profile.work_mode, TextProfileWorkMode::default());
        assert!(active_profile.dictionary_entries.is_empty());
        assert!(active_profile.snippet_entries.is_empty());
    }

    #[test]
    fn ignores_legacy_text_rules_when_profiles_are_already_persisted() {
        let raw_value = serde_json::json!({
            "prompt": "legacy prompt should stay unused",
            "stt_hints": "legacy hint",
            "dictionary_entries": [
                {
                    "id": "legacy-dict",
                    "phrase": "word script",
                    "replace_with": "WordScript"
                }
            ],
            "snippet_entries": [
                {
                    "id": "legacy-snippet",
                    "label": "Status",
                    "trigger": "status update",
                    "expansion": "Legacy expansion"
                }
            ],
            "text_profiles": [
                {
                    "id": "general",
                    "label": "General writing",
                    "prompt": "profile prompt",
                    "stt_hints": "profile hint",
                    "dictionary_entries": [],
                    "snippet_entries": []
                }
            ]
        });

        let mut config = AppConfig {
            active_text_profile_id: "general".to_string(),
            text_profiles: vec![TextProfile {
                id: "general".to_string(),
                label: "General writing".to_string(),
                prompt: "profile prompt".to_string(),
                stt_hints: "profile hint".to_string(),
                work_mode: TextProfileWorkMode::default(),
                curation: TextProfileCuration::default(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
                    speech: None,
                    modes: None,
                    capture: None,
                ..TextProfile::default()
            }],
            curated_profiles_seeded: true,
            ..AppConfig::default()
        };

        apply_legacy_text_rules_from_value(&mut config, &raw_value);

        let active_profile = config.active_text_profile();
        assert_eq!(active_profile.prompt, "profile prompt");
        assert_eq!(active_profile.stt_hints, "profile hint");
        assert!(active_profile.dictionary_entries.is_empty());
        assert!(active_profile.snippet_entries.is_empty());
    }

    #[test]
    fn defaults_to_high_accuracy_correction_model() {
        let config = AppConfig::default();

        assert_eq!(config.correction_model, DEFAULT_CORRECTION_MODEL);
    }

    #[test]
    fn processing_mode_roundtrip_serde() {
        let mode = ProcessingMode::PromptEnhance;
        let serialized = serde_json::to_string(&mode).expect("serialize");
        let deserialized: ProcessingMode =
            serde_json::from_str(&serialized).expect("deserialize");
        assert_eq!(deserialized, ProcessingMode::PromptEnhance);
    }

    #[test]
    fn processing_mode_serde_snake_case() {
        let json = r#""prompt_enhance""#;
        let mode: ProcessingMode = serde_json::from_str(json).expect("deserialize");
        assert_eq!(mode, ProcessingMode::PromptEnhance);

        let serialized = serde_json::to_string(&ProcessingMode::PromptEnhance).expect("serialize");
        assert_eq!(serialized, r#""prompt_enhance""#);
    }

    #[test]
    fn enhance_sub_mode_defaults_to_enhance() {
        assert_eq!(EnhanceSubMode::default(), EnhanceSubMode::Enhance);

        let mode: EnhanceSubMode = serde_json::from_str(r#""unknown""#).unwrap_or_default();
        assert_eq!(mode, EnhanceSubMode::Enhance);
    }

    #[test]
    fn processing_mode_from_str_maps_aliases() {
        assert_eq!(ProcessingMode::from_str("polished"), ProcessingMode::Rewrite);
        assert_eq!(ProcessingMode::from_str("professional"), ProcessingMode::Rewrite);
        assert_eq!(ProcessingMode::from_str("rewrite"), ProcessingMode::Rewrite);
        assert_eq!(ProcessingMode::from_str("agent"), ProcessingMode::Agent);
        assert_eq!(ProcessingMode::from_str("verbatim"), ProcessingMode::Verbatim);
        assert_eq!(ProcessingMode::from_str("cleanup"), ProcessingMode::Cleanup);
        assert_eq!(ProcessingMode::from_str("auto"), ProcessingMode::Auto);
        assert_eq!(ProcessingMode::from_str("unknown"), ProcessingMode::Cleanup);
    }

    #[test]
    fn processing_mode_is_auto_helper() {
        assert!(ProcessingMode::Auto.is_auto());
        assert!(!ProcessingMode::Cleanup.is_auto());
        assert!(!ProcessingMode::Agent.is_auto());
    }

    #[test]
    fn processing_mode_is_cleanup_family_helper() {
        assert!(ProcessingMode::Cleanup.is_cleanup_family());
        assert!(ProcessingMode::Rewrite.is_cleanup_family());
        assert!(!ProcessingMode::Auto.is_cleanup_family());
        assert!(!ProcessingMode::Agent.is_cleanup_family());
        assert!(!ProcessingMode::PromptEnhance.is_cleanup_family());
        assert!(!ProcessingMode::Verbatim.is_cleanup_family());
    }

    #[test]
    fn prompt_target_defaults_to_general() {
        assert_eq!(PromptTarget::default(), PromptTarget::General);
    }

    #[test]
    fn text_profile_work_mode_has_default_processing_mode() {
        let work_mode = TextProfileWorkMode::default();
        assert_eq!(work_mode.processing_mode, ProcessingMode::Auto);
        assert_eq!(work_mode.enhance_sub_mode, None);
        assert_eq!(work_mode.target, None);
    }

    #[test]
    fn text_profile_work_mode_effective_processing_mode() {
        let mut work_mode = TextProfileWorkMode::default();
        assert_eq!(work_mode.effective_processing_mode(), ProcessingMode::Auto);

        work_mode.processing_mode = ProcessingMode::Rewrite;
        assert_eq!(work_mode.effective_processing_mode(), ProcessingMode::Rewrite);
    }

    #[test]
    fn vocabulary_migration_turns_free_text_hints_into_entries() {
        let mut profile = TextProfile {
            id: "support".to_string(),
            stt_hints: "status update\ntriage summary".to_string(),
            schema_version: 1,
            ..TextProfile::default()
        };

        assert!(profile.migrate_to_current_schema());

        assert_eq!(profile.schema_version, TEXT_PROFILE_SCHEMA_VERSION);
        assert_eq!(
            profile
                .vocabulary_hints
                .iter()
                .map(|entry| entry.phrase.as_str())
                .collect::<Vec<_>>(),
            vec!["status update", "triage summary"]
        );
        // Nothing was learning terms before schema 4, so every migrated row is
        // the user's. Stated rather than inherited from a derive.
        assert!(profile
            .vocabulary_hints
            .iter()
            .all(|entry| entry.origin == VocabularyHintOrigin::User));
    }

    /// The old per-entry opt-in still round-trips so an older config loads, but
    /// it no longer decides anything. A profile that had it switched on must
    /// not get a different recognizer prompt than one that did not (ADR 0035).
    #[test]
    fn the_migrated_opt_in_no_longer_decides_the_recognizer_slots() {
        let build = |bias_mode: BiasMode| {
            let mut profile = TextProfile {
                id: "support".to_string(),
                stt_hints: "Kubernetes\nStatuspage".to_string(),
                schema_version: 1,
                work_mode: TextProfileWorkMode {
                    bias_mode,
                    manual_bias: ManualBias {
                        cloud_include_profile_terms: true,
                        ..ManualBias::default()
                    },
                    ..TextProfileWorkMode::default()
                },
                ..TextProfile::default()
            };
            profile.migrate_to_current_schema();
            profile
        };

        let opted_in = build(BiasMode::Manual);
        let opted_out = build(BiasMode::Conservative);

        assert!(opted_in.vocabulary_hints[0].use_as_prompt_hint);
        assert!(!opted_out.vocabulary_hints[0].use_as_prompt_hint);
        assert_eq!(
            opted_in.recognizer_slot_phrases(),
            opted_out.recognizer_slot_phrases()
        );
    }

    #[test]
    fn vocabulary_migration_runs_once() {
        let mut profile = TextProfile {
            id: "support".to_string(),
            stt_hints: "status update".to_string(),
            schema_version: 1,
            ..TextProfile::default()
        };

        assert!(profile.migrate_to_current_schema());
        profile.vocabulary_hints[0].phrase = "triage summary".to_string();

        assert!(!profile.migrate_to_current_schema());
        assert_eq!(profile.vocabulary_phrases(), vec!["triage summary"]);
    }

    #[test]
    fn context_migration_restores_topics_on_an_untouched_lexical_seed() {
        let mut profile = TextProfile {
            id: "curated-product-engineering".to_string(),
            prompt: "WordScript\nAPI\nSDK\nSQL\nCI/CD\nSLO\nPR\nTauri".to_string(),
            schema_version: 2,
            ..TextProfile::default()
        };

        assert!(profile.migrate_to_current_schema());

        assert_eq!(profile.schema_version, TEXT_PROFILE_SCHEMA_VERSION);
        assert!(profile.prompt.contains("platform constraints"));
        assert!(!profile.prompt.contains("SDK"));
    }

    /// The whole safety of this migration is the byte match. A user who edited
    /// one character owns that field, and a template may not take it back.
    #[test]
    fn context_migration_never_touches_an_edited_field() {
        let edited = "WordScript\nAPI\nSDK\nSQL\nCI/CD\nSLO\nPR\nTauri\nKubernetes";
        let mut profile = TextProfile {
            id: "curated-product-engineering".to_string(),
            prompt: edited.to_string(),
            schema_version: 2,
            ..TextProfile::default()
        };

        profile.migrate_to_current_schema();

        assert_eq!(profile.prompt, edited);
        assert_eq!(profile.schema_version, TEXT_PROFILE_SCHEMA_VERSION);
    }

    /// Installs seeded before 2026-05-25 already hold topics. They must be
    /// left alone rather than matched by shape and rewritten.
    #[test]
    fn context_migration_leaves_a_profile_that_already_holds_topics() {
        let topics = "feature names\nbug IDs\nrelease scope";
        let mut profile = TextProfile {
            id: "curated-product-engineering".to_string(),
            prompt: topics.to_string(),
            schema_version: 2,
            ..TextProfile::default()
        };

        profile.migrate_to_current_schema();

        assert_eq!(profile.prompt, topics);
    }

    #[test]
    fn context_migration_runs_once() {
        let mut profile = TextProfile {
            id: "curated-sales".to_string(),
            prompt: "WordScript\nCRM\nMRR\nACV\nPOC\nROI\nMSA\nMutual Action Plan".to_string(),
            schema_version: 2,
            ..TextProfile::default()
        };

        assert!(profile.migrate_to_current_schema());
        let migrated = profile.prompt.clone();

        // A user who types the old seed back in owns it from here on.
        profile.prompt = "WordScript\nCRM\nMRR\nACV\nPOC\nROI\nMSA\nMutual Action Plan".to_string();
        assert!(!profile.migrate_to_current_schema());
        assert_ne!(profile.prompt, migrated);
    }

    fn vocabulary(entries: &[(&str, u32)]) -> Vec<VocabularyHintEntry> {
        entries
            .iter()
            .enumerate()
            .map(|(index, (phrase, observations))| VocabularyHintEntry {
                id: format!("vocab-{index}"),
                phrase: phrase.to_string(),
                observation_count: *observations,
                ..VocabularyHintEntry::default()
            })
            .collect()
    }

    /// The rule the user gets backwards. Asked which terms matter most, anyone
    /// names their long product names — and those are exactly the ones repair
    /// restores afterwards. A term below the repair floor has no second chance.
    #[test]
    fn the_recognizer_slots_lead_with_the_terms_repair_cannot_reach() {
        let entries = vocabulary(&[
            ("Kubernetes", 9),
            ("Statuspage", 8),
            ("PostgreSQL", 7),
            ("Prometheus", 6),
            ("Tauri", 1),
        ]);

        let slots = select_recognizer_slots(&entries);

        assert_eq!(slots.first().map(String::as_str), Some("Tauri"));
        assert_eq!(slots.len(), 4, "the budget is spent, not exceeded: {slots:?}");
    }

    #[test]
    fn among_equals_the_more_often_mangled_term_wins_the_slot() {
        let entries = vocabulary(&[("Kubernetes", 1), ("Statuspage", 5)]);

        assert_eq!(
            select_recognizer_slots(&entries),
            vec!["Statuspage", "Kubernetes"]
        );
    }

    /// Every short term already fills the budget, so a long one has nothing
    /// left to win — which is the point: those are the recoverable ones.
    #[test]
    fn short_terms_fill_the_budget_before_a_long_one_is_considered() {
        let entries = vocabulary(&[
            ("Kubernetes", 99),
            ("Tauri", 1),
            ("Redis", 1),
            ("Kafka", 1),
            ("Nginx", 1),
        ]);

        let slots = select_recognizer_slots(&entries);

        assert!(!slots.contains(&"Kubernetes".to_string()), "{slots:?}");
        assert_eq!(slots, vec!["Tauri", "Redis", "Kafka", "Nginx"]);
    }

    /// A phrase the initial prompt could never carry must not take a slot from
    /// one that could. Same predicate the recognizer path filters on.
    #[test]
    fn a_term_the_recognizer_channel_cannot_carry_takes_no_slot() {
        let entries = vocabulary(&[
            ("this is a far too long phrase to ever work as an initial prompt hint", 9),
            ("   ", 9),
            ("Tauri", 1),
        ]);

        assert_eq!(select_recognizer_slots(&entries), vec!["Tauri"]);
    }

    #[test]
    fn a_term_repeated_in_the_list_takes_one_slot() {
        let entries = vocabulary(&[("Tauri", 1), ("tauri", 1), ("Redis", 1)]);

        assert_eq!(select_recognizer_slots(&entries), vec!["Tauri", "Redis"]);
    }

    /// The recognizer selection is an addition to the vocabulary, never a
    /// filter on it. Every term still reaches repair and every LLM stage.
    #[test]
    fn the_slot_selection_never_shrinks_what_the_transform_stages_see() {
        let profile = TextProfile {
            vocabulary_hints: vocabulary(&[
                ("Kubernetes", 0),
                ("Statuspage", 0),
                ("PostgreSQL", 0),
                ("Prometheus", 0),
                ("Grafana", 0),
                ("Tauri", 0),
            ]),
            ..TextProfile::default()
        };

        assert_eq!(profile.vocabulary_phrases().len(), 6);
        assert_eq!(profile.recognizer_slot_phrases().len(), 4);
    }

    #[test]
    fn an_entry_written_before_origins_existed_loads_as_the_users() {
        let raw = r#"{
            "id": "support",
            "label": "Support",
            "prompt": "",
            "vocabulary_hints": [{"id": "support-vocab-0", "phrase": "Kubernetes"}],
            "schema_version": 3,
            "dictionary_entries": [],
            "snippet_entries": []
        }"#;

        let mut profile: TextProfile = serde_json::from_str(raw).expect("profile parses");
        assert!(profile.migrate_to_current_schema());

        assert_eq!(profile.schema_version, TEXT_PROFILE_SCHEMA_VERSION);
        assert_eq!(profile.vocabulary_hints[0].origin, VocabularyHintOrigin::User);
        assert_eq!(profile.vocabulary_hints[0].learned_at_ms, None);
        assert_eq!(profile.vocabulary_phrases(), vec!["Kubernetes"]);
    }

    /// The frontend mirror writes profiles back at the version it can produce,
    /// so this migration runs over configs that already hold learned rows. It
    /// must not relabel them — an "overwrite to be sure" here would quietly
    /// turn every learned term into a hand-typed one on the next load.
    #[test]
    fn the_origin_migration_never_relabels_a_learned_term() {
        let mut profile = TextProfile {
            id: "support".to_string(),
            vocabulary_hints: vec![VocabularyHintEntry {
                id: "support-learned-1".to_string(),
                phrase: "Kubernetes".to_string(),
                origin: VocabularyHintOrigin::Learned,
                learned_at_ms: Some(1_700_000_000_000),
                hit_count: 3,
                ..VocabularyHintEntry::default()
            }],
            schema_version: 2,
            ..TextProfile::default()
        };

        profile.migrate_to_current_schema();

        assert_eq!(
            profile.vocabulary_hints[0].origin,
            VocabularyHintOrigin::Learned
        );
        assert_eq!(
            profile.vocabulary_hints[0].learned_at_ms,
            Some(1_700_000_000_000)
        );
        assert_eq!(profile.vocabulary_hints[0].hit_count, 3);
    }

    /// Every migration guards on its own version number rather than on the
    /// constant. Without that, bumping the constant re-runs every earlier step:
    /// the version-2 one would resurrect a deleted vocabulary from the legacy
    /// blob, and the version-3 one would overwrite an edited context field.
    #[test]
    fn bumping_the_schema_does_not_rerun_the_earlier_migrations() {
        let mut profile = TextProfile {
            id: "curated-product-engineering".to_string(),
            prompt: "WordScript\nAPI\nSDK\nSQL\nCI/CD\nSLO\nPR\nTauri".to_string(),
            stt_hints: "status update\ntriage summary".to_string(),
            vocabulary_hints: Vec::new(),
            schema_version: 3,
            ..TextProfile::default()
        };

        profile.migrate_to_current_schema();

        assert!(
            profile.vocabulary_hints.is_empty(),
            "the version-2 step re-ran and resurrected a deleted vocabulary"
        );
        assert!(
            profile.prompt.contains("SDK"),
            "the version-3 step re-ran over a field the user owns: {}",
            profile.prompt
        );
    }

    /// A version-2 profile has already had its vocabulary migrated. Bumping the
    /// schema constant must not re-run that step over an emptied hint list.
    #[test]
    fn bumping_the_schema_does_not_rerun_the_vocabulary_migration() {
        let mut profile = TextProfile {
            id: "support".to_string(),
            stt_hints: "status update\ntriage summary".to_string(),
            vocabulary_hints: Vec::new(),
            schema_version: 2,
            ..TextProfile::default()
        };

        profile.migrate_to_current_schema();

        assert!(
            profile.vocabulary_hints.is_empty(),
            "a deleted vocabulary must not be resurrected from the legacy blob"
        );
    }

    #[test]
    fn transform_preset_is_fixed_per_mode() {
        // The full table. Only three distinct presets exist across six modes,
        // which is why the three per-profile toggles had nothing left to decide.
        let cases = [
            (ProcessingMode::Verbatim, (false, false, false)),
            (ProcessingMode::Cleanup, (true, true, false)),
            (ProcessingMode::Rewrite, (true, true, true)),
            (ProcessingMode::Agent, (true, false, false)),
            (ProcessingMode::PromptEnhance, (true, false, false)),
            // Auto answers with the mode it resolves to by default.
            (ProcessingMode::Auto, (true, true, false)),
        ];

        for (mode, (post_process, filter_fillers, professionalize)) in cases {
            let preset = mode.transform_preset();
            assert_eq!(
                (
                    preset.post_process,
                    preset.filter_fillers,
                    preset.professionalize
                ),
                (post_process, filter_fillers, professionalize),
                "mode={}",
                mode.as_str()
            );
        }
    }

    #[test]
    fn transform_preset_never_professionalizes_without_filtering_fillers() {
        // Guards the assumption that lets `correction_system_prompt` drop its
        // fourth arm: no mode produces `(filter_fillers=false, professionalize=true)`.
        for mode in [
            ProcessingMode::Auto,
            ProcessingMode::Cleanup,
            ProcessingMode::Rewrite,
            ProcessingMode::Agent,
            ProcessingMode::PromptEnhance,
            ProcessingMode::Verbatim,
        ] {
            let preset = mode.transform_preset();
            assert!(
                !(preset.professionalize && !preset.filter_fillers),
                "mode={} produced the unreachable combination",
                mode.as_str()
            );
        }
    }

    #[test]
    fn stored_cleanup_flags_cannot_influence_the_preset() {
        // The regression this whole change exists for. A config written by an
        // older build still carries `post_process` / `filter_fillers` /
        // `professionalize` inside the profile's `modes` block. They must be
        // ignored: Cleanup filters fillers no matter what the file says.
        let raw = serde_json::json!({
            "id": "legacy",
            "label": "Legacy",
            "prompt": "",
            "stt_hints": "",
            "vocabulary_hints": [],
            "dictionary_entries": [],
            "snippet_entries": [],
            "work_mode": { "processing_mode": "cleanup" },
            "modes": {
                "post_process": false,
                "filter_fillers": false,
                "professionalize": true,
                "auto_detect_mode": true,
                "agent_name": "WordScript"
            }
        });

        let profile: TextProfile = serde_json::from_value(raw).expect("profile parses");
        // The removed keys are ignored rather than rejected, so an older config
        // still loads.
        assert!(profile.modes.is_some());
        let preset = profile.work_mode.transform_preset();

        assert!(preset.post_process, "post_process follows the mode");
        assert!(preset.filter_fillers, "filter_fillers follows the mode");
        assert!(
            !preset.professionalize,
            "professionalize follows the mode, not the stored flag"
        );
    }

    #[test]
    fn rewrite_style_is_derived_from_the_mode_not_from_storage() {
        // The live config held `rewrite_style: "polished"` on a profile running
        // `processing_mode: "auto"`, so the profile summary contradicted the
        // selected mode. The stored value must not survive resolution.
        let raw = serde_json::json!({
            "rewrite_style": "polished",
            "insert_behavior": "auto_paste",
            "recovery_behavior": "standard",
            "processing_mode": "cleanup"
        });

        let work_mode: TextProfileWorkMode = serde_json::from_value(raw).expect("work mode parses");
        assert_eq!(work_mode.effective_rewrite_style(), "clean");

        for (mode, expected) in [
            (ProcessingMode::Verbatim, "verbatim"),
            (ProcessingMode::Cleanup, "clean"),
            (ProcessingMode::Rewrite, "polished"),
            (ProcessingMode::Agent, "clean"),
            (ProcessingMode::PromptEnhance, "clean"),
            (ProcessingMode::Auto, "clean"),
        ] {
            assert_eq!(mode.rewrite_style_token(), expected, "mode={}", mode.as_str());
        }
    }

    #[test]
    fn workspace_context_toggle_and_agent_name_resolve_per_profile() {
        // Both were editable per profile and read globally, so neither control
        // could be observed by the runtime.
        let mut config = AppConfig::default();
        config.agent_name = "GlobalName".to_string();
        config.auto_detect_mode = true;
        config.active_text_profile_id = "p1".to_string();
        config.text_profiles = vec![default_text_profile(
            String::new(),
            String::new(),
            Vec::new(),
            Vec::new(),
        )];
        config.text_profiles[0].id = "p1".to_string();
        config.text_profiles[0].modes = Some(ProfileModesSettings {
            collect_workspace_context: false,
            agent_name: "ProfileName".to_string(),
            ..ProfileModesSettings::default()
        });

        assert_eq!(config.active_text_profile_agent_name(), "ProfileName");
        assert!(!config.active_text_profile_collect_workspace_context());

        // A blank per-profile name falls back to the global one.
        config.text_profiles[0].modes = Some(ProfileModesSettings {
            collect_workspace_context: true,
            agent_name: "   ".to_string(),
            ..ProfileModesSettings::default()
        });
        assert_eq!(config.active_text_profile_agent_name(), "GlobalName");
        assert!(config.active_text_profile_collect_workspace_context());

        // A profile predating the block falls back to the global toggle.
        config.text_profiles[0].modes = None;
        config.auto_detect_mode = false;
        assert!(!config.active_text_profile_collect_workspace_context());
    }

    #[test]
    fn legacy_auto_detect_mode_key_still_deserializes() {
        // The key was renamed when the context stopped being Auto-only.
        let modes: ProfileModesSettings =
            serde_json::from_value(serde_json::json!({ "auto_detect_mode": false }))
                .expect("legacy key parses");
        assert!(!modes.collect_workspace_context);
    }

    #[test]
    fn app_config_default_has_processing_mode_auto() {
        let config = AppConfig::default();
        assert_eq!(config.processing_mode, ProcessingMode::Auto);
        assert_eq!(config.enhance_sub_mode, None);
        assert_eq!(config.enhance_target, PromptTarget::General);
        assert!(config.auto_detect_mode);
    }

    #[test]
    fn processing_mode_as_str_roundtrip() {
        for mode in &[
            ProcessingMode::Auto,
            ProcessingMode::Cleanup,
            ProcessingMode::Rewrite,
            ProcessingMode::Agent,
            ProcessingMode::PromptEnhance,
            ProcessingMode::Verbatim,
        ] {
            assert_eq!(ProcessingMode::from_str(mode.as_str()), *mode);
        }
    }

    #[test]
    fn enhance_sub_mode_from_str_defaults_to_enhance() {
        assert_eq!(
            EnhanceSubMode::from_str("unknown"),
            EnhanceSubMode::Enhance
        );
        assert_eq!(EnhanceSubMode::from_str("expand"), EnhanceSubMode::Expand);
    }

    // --- Acknowledge persistence helpers (in-memory) ---

    #[test]
    fn ack_flag_persists_to_in_memory_config() {
        let mut config = AppConfig::default();
        config.profile_health_acknowledged_flags = HashMap::new();

        let entry = config
            .profile_health_acknowledged_flags
            .entry("profile-1".to_string())
            .or_default();
        entry.insert("length_bias".to_string());

        assert!(config
            .profile_health_acknowledged_flags
            .get("profile-1")
            .expect("profile entry")
            .contains("length_bias"));
    }

    #[test]
    fn unack_flag_removes_from_in_memory_config() {
        let mut config = AppConfig::default();
        let mut set = HashSet::new();
        set.insert("length_bias".to_string());
        set.insert("form_conflict".to_string());
        config
            .profile_health_acknowledged_flags
            .insert("profile-1".to_string(), set);

        let entry = config
            .profile_health_acknowledged_flags
            .get_mut("profile-1")
            .expect("profile entry");
        entry.remove("length_bias");

        let remaining = config
            .profile_health_acknowledged_flags
            .get("profile-1")
            .expect("profile entry");
        assert!(!remaining.contains("length_bias"));
        assert!(remaining.contains("form_conflict"));
    }

    #[test]
    fn unack_last_flag_clears_profile_entry() {
        let mut config = AppConfig::default();
        let mut set = HashSet::new();
        set.insert("length_bias".to_string());
        config
            .profile_health_acknowledged_flags
            .insert("profile-1".to_string(), set);

        let entry = config
            .profile_health_acknowledged_flags
            .get_mut("profile-1")
            .expect("profile entry");
        entry.remove("length_bias");
        if entry.is_empty() {
            config.profile_health_acknowledged_flags.remove("profile-1");
        }

        assert!(!config
            .profile_health_acknowledged_flags
            .contains_key("profile-1"));
    }

    #[test]
    fn migration_initializes_empty_ack_map() {
        // Default-init must start with an empty map; existing configs without the
        // field are loaded with the default (empty).
        let config = AppConfig::default();
        assert!(config.profile_health_acknowledged_flags.is_empty());
    }

    // --- Hotkey collision validation ---

    fn collision_test_config() -> AppConfig {
        // All distinct, non-empty hotkeys → no collisions.
        let mut config = AppConfig::default();
        config.hotkey = "ctrl_l+f9".to_string();
        config.pause_hotkey = "ctrl_l+f10".to_string();
        config.abort_hotkey = "ctrl_l+alt_l+escape".to_string();
        config.mode_picker_hotkey = "ctrl_l+alt_l+m".to_string();
        config.mode_auto_hotkey = "ctrl_l+f6".to_string();
        config.mode_verbatim_hotkey = "ctrl_l+f1".to_string();
        config.mode_cleanup_hotkey = "ctrl_l+f2".to_string();
        config.mode_rewrite_hotkey = "ctrl_l+f3".to_string();
        config.mode_agent_hotkey = "ctrl_l+f4".to_string();
        config.mode_prompt_enhance_hotkey = "ctrl_l+f5".to_string();
        config
    }

    #[test]
    fn validate_hotkey_collisions_passes_when_all_distinct() {
        let config = collision_test_config();
        assert!(validate_hotkey_collisions(&config).is_ok());
    }

    #[test]
    fn validate_hotkey_collisions_passes_when_all_empty_mode_hotkeys() {
        let mut config = collision_test_config();
        config.mode_picker_hotkey = String::new();
        config.mode_auto_hotkey = String::new();
        config.mode_verbatim_hotkey = String::new();
        config.mode_cleanup_hotkey = String::new();
        config.mode_rewrite_hotkey = String::new();
        config.mode_agent_hotkey = String::new();
        config.mode_prompt_enhance_hotkey = String::new();
        assert!(validate_hotkey_collisions(&config).is_ok());
    }

    #[test]
    fn validate_hotkey_collisions_detects_mode_vs_capture() {
        let mut config = collision_test_config();
        // Mode-select collides with the capture trigger.
        config.mode_picker_hotkey = config.hotkey.clone();
        let error = validate_hotkey_collisions(&config).unwrap_err();
        assert!(
            error.contains("Mode select"),
            "error should name the mode-select label: {error}"
        );
        assert!(
            error.contains("Capture trigger"),
            "error should name the capture trigger label: {error}"
        );
    }

    #[test]
    fn validate_hotkey_collisions_detects_mode_vs_mode() {
        let mut config = collision_test_config();
        // Mode-select collides with mode-agent.
        config.mode_picker_hotkey = config.mode_agent_hotkey.clone();
        let error = validate_hotkey_collisions(&config).unwrap_err();
        assert!(
            error.contains("Mode select"),
            "error should name the mode-select label: {error}"
        );
        assert!(
            error.contains("Mode agent"),
            "error should name the mode-agent label: {error}"
        );
    }

    #[test]
    fn validate_hotkey_collisions_normalizes_equivalent_forms() {
        let mut config = collision_test_config();
        // Raw `ctrl_l+alt_l+m` and canonical `Ctrl+Alt+M` must be treated as
        // the same shortcut.
        config.mode_auto_hotkey = "ctrl_l+alt_l+m".to_string();
        config.mode_verbatim_hotkey = "Ctrl+Alt+M".to_string();
        let error = validate_hotkey_collisions(&config).unwrap_err();
        assert!(
            error.contains("conflicts"),
            "equivalent normalized forms should collide: {error}"
        );
    }

    // ── Translate, the seventh mode (ADR 0041) ──────────────────────────────

    /// The token has to survive a round trip, or a profile written by this
    /// build reads back as Cleanup on the next launch.
    #[test]
    fn translate_round_trips_through_its_token() {
        assert_eq!(ProcessingMode::Translate.as_str(), "translate");
        assert_eq!(
            ProcessingMode::from_str(ProcessingMode::Translate.as_str()),
            ProcessingMode::Translate
        );
    }

    /// A translation replaces every word, which is the opposite of a correction
    /// that has to stay near its input. Letting it into the cleanup family
    /// would route it through the correction prompt, whose global rules forbid
    /// translating.
    #[test]
    fn translate_is_not_a_member_of_the_cleanup_family() {
        assert!(!ProcessingMode::Translate.is_cleanup_family());
        assert!(!ProcessingMode::Translate.is_auto());

        let preset = ProcessingMode::Translate.transform_preset();
        assert!(!preset.filter_fillers);
        assert!(!preset.professionalize);
    }

    /// `Alt+1` through `Alt+6` are taken, so the seventh mode ships unbound.
    /// It is the only mode slot whose default is empty.
    #[test]
    fn the_seventh_mode_ships_with_no_hotkey() {
        let config = AppConfig::default();

        assert_eq!(config.mode_translate_hotkey, "");
        for bound in [
            &config.mode_auto_hotkey,
            &config.mode_verbatim_hotkey,
            &config.mode_cleanup_hotkey,
            &config.mode_rewrite_hotkey,
            &config.mode_agent_hotkey,
            &config.mode_prompt_enhance_hotkey,
        ] {
            assert!(!bound.is_empty());
        }
    }

    /// A hand-set seventh key must collide with the other six like any other
    /// slot, or two dead bindings ship instead of one refusal.
    #[test]
    fn the_seventh_mode_key_takes_part_in_the_collision_check() {
        let mut config = collision_test_config();
        config.mode_translate_hotkey = config.mode_rewrite_hotkey.clone();

        let error = validate_hotkey_collisions(&config).unwrap_err();
        assert!(
            error.contains("Mode translate"),
            "error should name the translate label: {error}"
        );
    }

    /// Two of the four settings are the profile's and two are the machine's,
    /// which is the scope the drawing gives them.
    #[test]
    fn the_translate_settings_resolve_from_both_scopes() {
        let mut config = AppConfig::default();
        config.translate_same_language = TranslateSameLanguage::PassThrough;
        config.translate_address_form = TranslateAddressForm::Formal;
        let active = config.active_text_profile_id.clone();
        for profile in config.text_profiles.iter_mut() {
            if profile.id == active {
                profile.modes = Some(ProfileModesSettings {
                    translate_target_language: "fr".to_string(),
                    translate_keep_profile_words: false,
                    ..ProfileModesSettings::default()
                });
            }
        }

        let settings = config.active_text_profile_translate_settings();
        assert_eq!(settings.target_language, "fr");
        assert_eq!(settings.target_language_name(), "French");
        assert!(!settings.keep_profile_words);
        assert_eq!(settings.same_language, TranslateSameLanguage::PassThrough);
        assert_eq!(settings.address_form, TranslateAddressForm::Formal);
    }

    /// A profile whose modes block predates Translate must answer, not fail.
    /// The answer is the same one a fresh profile gives.
    #[test]
    fn a_profile_predating_translate_resolves_to_the_shipped_default() {
        let mut config = AppConfig::default();
        for profile in config.text_profiles.iter_mut() {
            profile.modes = None;
        }

        let settings = config.active_text_profile_translate_settings();
        assert_eq!(settings.target_language, "en");
        assert!(settings.keep_profile_words);
    }

    /// An unrecognised code lands on English rather than stopping a
    /// translation, which is the same permissive rule `from_str` follows.
    #[test]
    fn an_unknown_target_language_normalizes_to_the_default() {
        assert_eq!(normalize_translate_language("  DE "), "de");
        assert_eq!(normalize_translate_language("klingon"), "en");
        assert_eq!(translate_language_name("klingon"), "English");
    }

    /// Dark is what every window rendered before the field existed, so a config
    /// that predates it must look exactly as it did.
    #[test]
    fn a_config_predating_the_colour_scheme_stays_dark() {
        assert_eq!(AppConfig::default().color_scheme, "dark");

        let mut config = AppConfig::default();
        config.color_scheme = String::new();
        config.normalize_for_runtime();
        assert_eq!(config.color_scheme, "dark");
    }

    /// The three the shell understands survive; anything else would reach a
    /// window that cannot render it.
    #[test]
    fn the_colour_scheme_normalizes_to_one_of_three() {
        assert_eq!(normalize_color_scheme(" Light "), "light");
        assert_eq!(normalize_color_scheme("SYSTEM"), "system");
        assert_eq!(normalize_color_scheme("dark"), "dark");
        assert_eq!(normalize_color_scheme("solarized"), "dark");
    }
}
