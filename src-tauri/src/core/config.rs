use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::communication_style::{
    CommunicationLength, CommunicationRegister, CommunicationStyle,
};
use super::paths::config_file_path;
use super::providers::{
    default_provider_id, normalize_provider_value, provider_tiers, registered_providers, JobKey,
    JobProvider,
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

/// The model defaults, resolved from the one catalogue instead of spelled here
/// (ADR 0115).
///
/// They were four `&'static str` constants and a fifth literal inline, and they
/// were four of the three places a model id lived: the survey's dated tables and
/// the drawn `LANES` arrays were the other two, and nothing checked any of them
/// against the others. Re-exported rather than moved so every call site keeps
/// reading its default from `core::config`, which is where a default belongs;
/// what changed is that the string now comes from a row with a source and a
/// date on it.
///
/// Functions rather than constants because a `const` cannot be parsed out of a
/// file. That is the whole cost of the change, and it is paid at every call
/// site as a pair of parentheses.
pub use super::model_catalogue::{
    default_agent_model, default_correction_model, default_local_agent_model,
    default_local_correction_model, default_speech_model,
};

pub const DEFAULT_AGENT_NAME: &str = "WordScript";

/// Current version of the shortcut half of the config schema.
///
/// **The counter outlives the rewrites it used to gate** (ADR 0112). Versions 1
/// and 2 rewrote values written by builds nobody runs, and those bodies are
/// gone; the number stays because it is what makes the *next* shortcut
/// migration a one-shot gate rather than a rule that fires on every save — the
/// D6 defect, where a persist-time rewrite silently replaced a value the user
/// had just chosen.
pub const SHORTCUT_SCHEMA_VERSION: u32 = 2;

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

    /// Which job on the provider axis this mode runs, when it runs one of its
    /// own (ADR 0094).
    ///
    /// **`None` is not an omission.** Verbatim reaches no model at all — the
    /// one thing its contract promises — and Auto is resolved into a concrete
    /// mode before anything runs, so neither has a job to name. A caller that
    /// needs an answer for those two is running the correction family and takes
    /// it from the preset, which is the only thing that knows.
    ///
    /// The three modes that own their own prompt map onto the drawn row that
    /// operates them: Agent is the assistant's row, and Prompt Enhance is
    /// `enhance`. The names differ because the mode is what the user selects
    /// and the job is what the settings surface routes.
    pub fn job_key(&self) -> Option<JobKey> {
        match self {
            ProcessingMode::Cleanup => Some(JobKey::Cleanup),
            ProcessingMode::Rewrite => Some(JobKey::Rewrite),
            ProcessingMode::Translate => Some(JobKey::Translate),
            ProcessingMode::Agent => Some(JobKey::Assistant),
            ProcessingMode::PromptEnhance => Some(JobKey::Enhance),
            ProcessingMode::Verbatim | ProcessingMode::Auto => None,
        }
    }
}

/// The three correction-pipeline switches, resolved from the effective
/// processing mode. Built only by [`ProcessingMode::transform_preset`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransformPreset {
    pub post_process: bool,
    pub filter_fillers: bool,
    // `professionalize` below is what tells the two correction jobs apart; see
    // `correction_job`.
    pub professionalize: bool,
}

impl TransformPreset {
    /// Which job the correction transform runs as under this preset
    /// (ADR 0094).
    ///
    /// **The preset is the only thing that can answer**, which is why the
    /// derivation lives here rather than being carried as a field beside it: a
    /// correction that reformulates is Rewrite and one that must stay near its
    /// input is Cleanup, and that distinction *is* `professionalize`. The
    /// conservative arm every non-correction mode retries under lands on
    /// Cleanup, which is what it is running.
    pub fn correction_job(&self) -> JobKey {
        if self.professionalize {
            JobKey::Rewrite
        } else {
            JobKey::Cleanup
        }
    }
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

/// Words a minute, for the typing baseline `Time saved` divides by.
pub const fn default_typing_baseline_wpm() -> u32 {
    40
}

/// The range a typing baseline may take. The floor is not zero because this
/// number is a divisor, and the ceiling is above the fastest sustained typing
/// anybody has recorded — a baseline outside this is a typo, not a claim.
pub const TYPING_BASELINE_RANGE: (u32, u32) = (10, 200);

/// How many dictations the index holds, at most (ADR 0185).
///
/// A CEILING, NOT A PREFERENCE, AND THAT IS THE WHOLE CHANGE. `history_limit`
/// was a picker on Privacy & Data beside the retention days, and two caps over
/// one list meant neither could be read: `prune_entries` sweeps by age and then
/// by count, so `Keep all` still dropped the 1001st record and a reader who set
/// ninety days lost a fortnight's dictation to a number they had chosen without
/// being told what it did. This machine's own config stood at fifty, which is
/// why the activity calendar could draw a single column.
///
/// Nobody reasons about their own privacy in units of *the last two hundred
/// dictations* — they reason in months. So the months stayed a setting, the
/// count became the index's own limit, and the screen states it rather than
/// offering it. A thousand transcripts is a few hundred kilobytes of text, so
/// this bounds the index rather than the disk.
pub const HISTORY_CEILING: usize = 1000;

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

/// The profile shape this build writes.
///
/// **The counter stays; the three migration bodies behind it are gone**
/// (ADR 0112). Versions 1 to 4 read shapes only this machine ever wrote — a
/// free-text hint blob, a curated context field seeded with spellings
/// (ADR 0032), vocabulary entries predating the learned/user distinction
/// (ADR 0035) — and no installation carries any of them. What the number still
/// buys is the *next* migration: a step that lands here guards on its own
/// version, so it runs once instead of rewriting on every save.
///
/// **Version 5 is that next migration and it is the first to use the place
/// A5 kept.** It lifts the profile's one provider onto the provider axis
/// (ADR 0094) and is guarded on `< 5` rather than on the constant, so it runs
/// once per profile and a later version 6 does not re-run it.
pub const TEXT_PROFILE_SCHEMA_VERSION: u32 = 5;

/// The version that introduced the provider axis. The guard is on this number
/// and not on [`TEXT_PROFILE_SCHEMA_VERSION`], which is D6's defect: a
/// migration keyed to the constant fires again on every later bump and rewrites
/// what the user chose in between.
const PROVIDER_AXIS_SCHEMA_VERSION: u32 = 5;

fn default_text_profile_schema_version() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TextProfile {
    pub id: String,
    pub label: String,
    pub prompt: String,
    /// The free-text hint blob, kept for the door it still arrives through.
    ///
    /// **No migration reads it any more** (ADR 0112) — but a `TextRulesDocument`
    /// is a v1 payload written on somebody else's machine, and the newline
    /// string is the only place it can carry terms. `text_rules.rs` honours it
    /// for exactly that case, which is why the field outlives the migration
    /// that used to consume it. An import door is not the config door.
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
    /// Which vendor each of this profile's jobs runs on (ADR 0094).
    ///
    /// Absent means the block has never been written and every job follows the
    /// default connection — the same answer a fresh profile gives, and the
    /// reason the schema-5 migration can leave a profile alone when the value
    /// it lifts is already the default.
    #[serde(default)]
    pub providers: Option<ProfileProviderSettings>,
    // Per-profile settings (tab-oriented sub-objects)
    #[serde(default)]
    pub speech: Option<ProfileSpeechSettings>,
    #[serde(default)]
    pub modes: Option<ProfileModesSettings>,
    #[serde(default)]
    pub capture: Option<ProfileCaptureSettings>,
}

impl TextProfile {
    /// Lands the profile on the shape this build writes. Returns whether
    /// anything changed.
    ///
    /// **A5 left this function stamping and nothing else, and kept the
    /// place.** Three steps used to run here — the hint blob to per-entry
    /// vocabulary, the curated context field back to topics, the origin field —
    /// and each read a shape only this machine ever wrote. They went with the
    /// installations behind them (ADR 0112).
    ///
    /// **A4 is what the place was kept for**: one step, guarded on its own
    /// version rather than on the constant, so it runs once instead of on every
    /// save. That distinction is D6's defect and the reason the counter was
    /// worth keeping when its contents were not.
    pub(crate) fn migrate_to_current_schema(&mut self) -> bool {
        if self.schema_version >= TEXT_PROFILE_SCHEMA_VERSION {
            return false;
        }

        if self.schema_version < PROVIDER_AXIS_SCHEMA_VERSION {
            self.adopt_provider_axis();
        }

        self.schema_version = TEXT_PROFILE_SCHEMA_VERSION;
        true
    }

    /// Lifts the profile's one provider onto the provider axis (ADR 0094).
    ///
    /// **The value read is the profile's, not the machine's, and that choice is
    /// the point of the step.** Two fields meant *the provider* before this:
    /// `speech.provider` per profile, which the live pipeline spent, and
    /// `AppConfig::provider` machine-wide, which the retry and history paths
    /// spent. A config where they disagreed sent a dictation to one vendor and
    /// a retry of that same record to another. Only one can survive, and it is
    /// the one the pipeline actually ran on; the machine-wide field is dropped
    /// under the licence ADR 0112 established, because it maps onto no
    /// per-profile answer when two profiles disagree with it and with each
    /// other.
    ///
    /// A block already present is left alone. That is not defensive coding: a
    /// profile written by this build carries one, and re-deriving it from a key
    /// that is no longer written would replace a user's choice with a default.
    fn adopt_provider_axis(&mut self) {
        if self.providers.is_some() {
            return;
        }

        let stored = self
            .speech
            .as_mut()
            .and_then(|speech| speech.migrated_provider.take())
            .unwrap_or_default();

        // An unreadable id falls back to the default rather than to a rescue
        // path, which is the scope the owner set for this migration on
        // 2026-08-11 (ADR 0112): this machine's config is disposable, so a
        // value that does not map cleanly onto the new shape is dropped.
        self.providers = Some(ProfileProviderSettings {
            default: normalize_provider_value(&stored),
            overrides: BTreeMap::new(),
        });
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

    /// The provider axis for this profile, with an absent block reading as the
    /// default connection and no overrides.
    pub(crate) fn resolved_providers(&self) -> ProfileProviderSettings {
        self.providers.clone().unwrap_or_default()
    }

    /// What one of this profile's jobs runs on, and what pays for it.
    pub(crate) fn job_provider(&self, job: JobKey, connections: &[Connection]) -> JobProvider {
        self.resolved_providers().resolve(job, connections)
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

// ── The connection axis (ADR 0208) ───────────────────────────────────────────

/// The id the migration gives the machine's first connection, and the one a
/// profile with no written axis falls back to.
///
/// **Stable rather than generated**, because two things have to agree on it
/// without having met: `ProfileProviderSettings::default` names it for a
/// profile block that was never written, and `adopt_connection_axis` writes it
/// for a machine that never had a connection. A generated id would make those
/// two disagree on the first load of a fresh install, and every job would
/// resolve to a connection that is not there.
pub const DEFAULT_CONNECTION_ID: &str = "connection-default";

/// Where a job runs, and which account pays for it (ADR 0208).
///
/// **An object profiles point at, rather than a shape each profile carries.**
/// The alternative — every profile holding its own endpoint and its own
/// credential — stores one account once per profile, so the same company key is
/// typed again for every writing style that uses it and rotated once per copy;
/// the copy that is forgotten fails at dictation time rather than at setup
/// time. The unit a reader names is the account (*my employer's*, *mine*), and
/// this is that unit.
///
/// **The vendor lives here and nowhere else.** A profile names a connection and
/// the connection names the vendor, so the pair cannot disagree. Storing the
/// vendor on the profile as well would be one fact in two places (ADR 0123),
/// with no rule for which one is right on the day they differ.
///
/// **The endpoint and the credential are one object on purpose.** A key typed
/// for one host must never be sent to another (ADR 0094's one security rule);
/// keeping the URL beside the credential makes that structural rather than a
/// rule somebody has to remember — a profile cannot take this server with that
/// token, because there is no way to name the pair separately.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct Connection {
    /// What a profile points at, and what the credential is stored under.
    ///
    /// **Changing one of these orphans the credential stored beneath it**, the
    /// same property `credential_store::entry_user` has always had for the
    /// vendor half — which is why the migration writes deterministic ids and
    /// the surface generates one per connection rather than deriving it from
    /// the label a reader can rename.
    pub id: String,
    /// What the reader calls this account. Free text, and the only field on
    /// this object that exists purely for a person.
    pub label: String,
    /// The registered vendor id this connection talks to.
    pub provider: String,
    /// The base URL for the lane that is typed rather than known (ADR 0165).
    ///
    /// Empty on every lane whose host is the vendor's own, which is what makes
    /// this field a property of *this* connection rather than of the machine:
    /// ADR 0165 put it on `AppConfig` because there was nowhere else for it to
    /// live, and said so.
    pub base_url: String,
    /// The model id sent when a job names none.
    ///
    /// It belongs to whoever runs the server, so it belongs to the connection
    /// that names the server. Empty is the ordinary state and not a default
    /// waiting to be filled in — `providers::self_hosted::resolve_model`
    /// refuses rather than guessing.
    pub model: String,
    /// The account plan, with empty meaning this vendor's own default.
    ///
    /// **It sits here because a plan belongs to a credential** (ADR 0167).
    /// That record keyed it by vendor and said what it was really reaching for:
    /// the thing that identifies the account. This object is that thing, so the
    /// plan lands on it rather than beside it.
    pub plan: String,
}

/// A connection naming one vendor, for a test that is about something else.
///
/// **The migration's own id shape**, so a fixture reads the way a lifted config
/// does rather than inventing a third spelling of the same thing.
#[cfg(test)]
pub(crate) fn test_connection(provider: &str) -> Connection {
    Connection {
        id: connection_id_for_lifted_vendor(provider),
        label: default_connection_label(provider),
        provider: provider.to_string(),
        ..Connection::default()
    }
}

/// The connection every fresh install starts with.
///
/// One, not one per lane: a lane with no credential and no endpoint is a row
/// nobody asked for, and the surface creates the second connection at the
/// moment somebody picks a second lane.
fn default_connection() -> Connection {
    let provider = default_provider_id().to_string();
    Connection {
        id: DEFAULT_CONNECTION_ID.to_string(),
        label: default_connection_label(&provider),
        provider,
        base_url: String::new(),
        model: String::new(),
        plan: String::new(),
    }
}

/// A starting name for a connection the migration created.
///
/// **A starting name, not a display rule.** The label is the reader's from the
/// moment the connection exists, and every surface prints what is stored rather
/// than deriving a name from the vendor id — this exists so a lifted connection
/// arrives with something readable on it instead of `self_hosted`.
/// The id the lift gives one vendor's connection.
///
/// **Derived rather than generated**, because two passes have to arrive at the
/// same string without sharing state: the pass that rewrites the profiles and
/// the pass that re-keys the credentials both compute it from the vendor alone.
/// A connection created afterwards by the surface carries a generated id — this
/// shape is the migration's, not the product's.
fn connection_id_for_lifted_vendor(vendor: &str) -> String {
    if vendor == default_provider_id() {
        DEFAULT_CONNECTION_ID.to_string()
    } else {
        format!("connection-{vendor}")
    }
}

fn default_connection_label(provider: &str) -> String {
    match provider {
        "groq" => "Groq",
        "openai" => "OpenAI",
        "openrouter" => "OpenRouter",
        "self_hosted" => "Your server",
        "local" => "On this machine",
        other => other,
    }
    .to_string()
}

/// The connections a job may resolve against.
///
/// **An absent block is one this build has never written and reads as the
/// seeded connection; a block written empty is a reader who deleted every
/// connection and reads as none.** The two are different answers and the
/// `Option` is what keeps them apart — the same shape `provider_plans` used for
/// the same reason (ADR 0167), and the reason the lift needs no version
/// counter.
fn seeded_connections() -> &'static [Connection] {
    static SEEDED: OnceLock<Vec<Connection>> = OnceLock::new();
    SEEDED.get_or_init(|| vec![default_connection()])
}

// ── The provider axis (ADR 0094) ─────────────────────────────────────────────

/// Which vendor each of this profile's jobs runs on.
///
/// **A resolved default plus a sparse override per job**, which is the shape
/// ADR 0094 fixes and the one the `AI Models` matrix has drawn since Leg 6. Not
/// a provider per job: nine full pairs would make *this follows the connection*
/// unrepresentable, and the donor is the evidence — five jobs times eight flat
/// keys, with a fan-out helper to keep them consistent, is a settings surface
/// nobody can read.
///
/// **It sits beside `speech`, `modes` and `capture` rather than inside any of
/// them.** The axis governs the five chat jobs as well as the three speech
/// ones, so filing it under the Speech tab would put the assistant's vendor in
/// the recogniser's block.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct ProfileProviderSettings {
    /// The connection every job follows unless it says otherwise.
    ///
    /// **A connection id since ADR 0208, and a vendor id before it.** The
    /// vendor is read off the connection rather than stored here, so *which
    /// server* and *whose account* move with the profile the way *which vendor*
    /// already did.
    pub default: String,
    /// Sparse, and deliberately so: **a job absent here is not a job without an
    /// answer**, it is a job whose answer is *follow the connection*. The drawn
    /// select carries that as its first option and an overriding row carries a
    /// `Use the default` button back, so the absence is a value the surface can
    /// write and unwrite, and the resolution happens at read time rather than
    /// being baked in at write time (ADR 0094).
    pub overrides: BTreeMap<JobKey, String>,
}

impl Default for ProfileProviderSettings {
    fn default() -> Self {
        Self {
            default: DEFAULT_CONNECTION_ID.to_string(),
            overrides: BTreeMap::new(),
        }
    }
}

impl ProfileProviderSettings {
    /// What one job runs on, and what pays for it.
    ///
    /// The one resolution. Every call site that used to read a `provider` field
    /// asks this for its own job instead, so *recognise with Groq, transform
    /// with something stronger* is a question the config can answer.
    ///
    /// **The vendor is looked up rather than stored** (ADR 0208): the profile
    /// names a connection, the connection names the vendor. A name that
    /// resolves to nothing leaves the vendor empty, which is the state a
    /// deleted connection produces and the one `JobProvider::credential`
    /// refuses with a sentence rather than repairing.
    pub(crate) fn resolve(&self, job: JobKey, connections: &[Connection]) -> JobProvider {
        let (connection, overridden) = match self.overrides.get(&job) {
            Some(connection) => (connection.clone(), true),
            None => (self.default.clone(), false),
        };

        let provider = connections
            .iter()
            .find(|entry| entry.id == connection)
            .map(|entry| entry.provider.clone())
            .unwrap_or_default();

        JobProvider {
            job,
            connection,
            provider,
            overridden,
        }
    }

    /// Drops every override naming a connection this machine no longer holds.
    ///
    /// An override that resolves to nothing is dropped rather than repointed at
    /// the default: silently rewriting it would make the row read *follow the
    /// connection* while the reader's own choice disappeared, and an absent
    /// override says exactly that in a form the surface can restate.
    ///
    /// **The default is not dropped, and that asymmetry is the point.** An
    /// absent override has a meaning; an absent default does not, so a profile
    /// whose connection was deleted keeps naming it and every job goes inert
    /// with that name in the sentence. Repointing it at another account would
    /// be this build choosing who pays.
    fn normalize(&mut self, connection_ids: &[String]) {
        self.default = self.default.trim().to_string();
        self.overrides.retain(|_, connection| {
            let connection = connection.trim();
            connection_ids.iter().any(|id| id == connection)
        });
    }
}

// ── Per-Profile Settings (tab-oriented sub-objects) ──────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProfileSpeechSettings {
    /// **The migration door for the provider axis, read once and never
    /// written** (ADR 0094's config half).
    ///
    /// Version 4 profiles carry the profile's one provider here, and it is the
    /// value the live pipeline actually spent — `capture.rs` read it while the
    /// retry paths read a second, machine-wide field that could disagree with
    /// it. `migrate_to_current_schema` lifts it onto `TextProfile::providers`
    /// and version 5 stops writing it, so the key leaves the file on the next
    /// save.
    ///
    /// **This is not the ballast ADR 0112 removed.** That record's argument is
    /// that no installation carries the shape behind a path; this shape is the
    /// one every installation carries right now, one save old, and reading it
    /// is the difference between a migration and a reset.
    #[serde(rename = "provider", skip_serializing)]
    pub(crate) migrated_provider: Option<String>,
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
            migrated_provider: None,
            model: default_speech_model().to_string(),
            language: String::new(),
            language_locked: false,
            correction_model: default_correction_model().to_string(),
            local_correction_model: default_local_correction_model().to_string(),
            agent_model: default_agent_model().to_string(),
            local_agent_model: default_local_agent_model().to_string(),
            local_model: "base".to_string(),
            local_profile: "local-base-fast".to_string(),
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
    /// `AppConfig::active_text_profile_collect_workspace_context`.
    ///
    /// The pre-rename key `auto_detect_mode` was accepted here as a serde alias
    /// until ADR 0112: it named this toggle back when the context reached Auto
    /// only, and no config outside this machine ever carried it.
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
    /// **The migration door for the plan axis, read once and never written**
    /// (ADR 0167).
    ///
    /// One plan id for the whole machine is what a plan was until this build.
    /// `adopt_provider_plan_axis` lifts it onto `provider_plans` and stops
    /// writing it, so the key leaves the file on the next save — the same door
    /// `ProfileSpeechSettings::migrated_provider` was for the provider axis,
    /// and it is a migration rather than a reset for the same reason: this is
    /// the shape every installation carries right now.
    #[serde(rename = "provider_tier", skip_serializing)]
    pub(crate) migrated_provider_tier: Option<String>,
    /// Every account this machine holds, and where each one is reached
    /// (ADR 0208).
    ///
    /// **The object the profile axis points at.** A profile names a connection
    /// per job; the connection carries the vendor, the endpoint, the plan, and
    /// owns the credential in the OS store. That is what makes *switch the
    /// profile* move the server and the account rather than only the vendor.
    ///
    /// `None` is a config this build has never written and lifts on load;
    /// `Some(vec![])` is a reader who deleted every connection, and is left
    /// alone. Nothing re-derives the list from the profiles once it has been
    /// written — that would replace a deletion with a migration, which is D6's
    /// defect and the reason ADR 0167 chose this shape over a version counter.
    #[serde(default)]
    pub connections: Option<Vec<Connection>>,
    /// **The migration door for the connection axis, read once and never
    /// written** (ADR 0208).
    ///
    /// ADR 0167 keyed the plan by vendor, on the argument that a plan belongs
    /// to a credential and a credential is keyed by vendor. The credential is
    /// keyed by connection now, so the plan rides on the connection and this
    /// key leaves the file on the next save — the same door
    /// `migrated_provider_tier` above is for the axis before it.
    #[serde(rename = "provider_plans", skip_serializing)]
    pub(crate) migrated_provider_plans: Option<BTreeMap<String, String>>,
    pub local_model: String,
    pub local_profile: String,
    pub local_prompt_strength: String,
    pub local_prompt_carry: bool,
    pub local_beam_size: u8,
    pub local_best_of: u8,
    pub local_profile_prompt_settings: Vec<LocalProfilePromptSettings>,
    pub local_profile_decode_settings: Vec<LocalProfileDecodeSettings>,
    /// Folders the user pointed WordScript at, in the order they added them
    /// (ADR 0159).
    ///
    /// **Machine-wide rather than per profile, and never written into.** A
    /// model on a home server or in somebody's own whisper.cpp library is a
    /// property of this installation, not of the writing style it happens to be
    /// used by; and it is used where it lies, because the alternative is a
    /// second copy of a file that can be 1.6 GB. `WORDSCRIPT_LOCAL_MODEL_DIR`
    /// is the same idea for somebody who prefers an environment variable and
    /// still outranks this at resolution time.
    ///
    /// Additive: absent reads as empty, so a config written before this field
    /// existed needs no migration.
    #[serde(default)]
    pub local_model_dirs: Vec<String>,
    /// **The migration door for the `Your server` endpoint, read once and never
    /// written** (ADR 0208).
    ///
    /// ADR 0165 put the URL and the model id here and gave the reason: the
    /// endpoint belongs to this installation, and there was nowhere else for it
    /// to live. There is now — the connection that names the server owns them,
    /// beside the token that may only ever be sent to it. The keys leave the
    /// file on the next save.
    ///
    /// **`WORDSCRIPT_SELF_HOSTED_BASE_URL` and `_MODEL` are untouched.** They
    /// are the door for a machine nobody has typed on, they stay machine-wide
    /// because an environment is, and what is typed still outranks them
    /// (ADR 0165 rule 2).
    #[serde(rename = "self_hosted_base_url", skip_serializing)]
    pub(crate) migrated_self_hosted_base_url: Option<String>,
    #[serde(rename = "self_hosted_model", skip_serializing)]
    pub(crate) migrated_self_hosted_model: Option<String>,
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
    /// Migration gate for the shortcut lane. No rewrite is pending today
    /// (ADR 0112); the number is what keeps the next one a one-shot rule rather
    /// than one that fires on every save and rewrites what the user just chose
    /// (D6).
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
    /// Whether the workspace sidebar stands as a rail — icons only, no labels.
    /// Stored here for the same reason `color_scheme` is: the choice belongs to
    /// the machine rather than to a profile, and a window is not a place to
    /// keep something that has to survive a restart.
    ///
    /// IT IS THE USER'S CHOICE, NOT THE WINDOW'S STATE. The window collapses
    /// the sidebar on its own below the width at which a 232 px column stops
    /// being affordable, and that is not written here — otherwise dragging a
    /// window narrow and wide again would rewrite a preference the user never
    /// touched. Only the toggle writes (ADR 0111).
    #[serde(default)]
    pub workspace_nav_rail: bool,
    /// Which of its two lives Home's opening block is showing: the activity
    /// calendar when true, the four counter tiles when false.
    ///
    /// Stored for the same reason `workspace_nav_rail` is, and on the same shape
    /// — machine-wide, additive, `#[serde(default)]`, so a config written before
    /// this field existed reads back as the tiles and nothing is migrated
    /// (ADR 0054). THE DEFAULT IS THE TILES ON PURPOSE. The calendar can only
    /// draw the window the history file still reaches over, and a machine whose
    /// history is pruned to a few days opens on a calendar one column wide,
    /// which is exactly the "reads as broken rather than as a beginning" state
    /// decision 7 of the home activity track forbids. The tiles degrade to a
    /// rate and a window, both of which read correctly from one day of records.
    ///
    /// It is the user's choice and only the block's own toggle writes it. There
    /// is deliberately no settings row (decision 9).
    #[serde(default)]
    pub home_activity_calendar: bool,
    /// The typing speed `Time saved` measures against, in words a minute
    /// (ADR 0178).
    ///
    /// IT IS AN ASSUMPTION AND IT IS THE WHOLE FIGURE. Nothing in this product
    /// has ever watched the reader type and nothing will, so the baseline is the
    /// one input to that tile that is not a measurement — and it moves the
    /// answer by more than everything else combined: on the machine this was
    /// written against, four weeks of dictation came out at 43 minutes saved
    /// against 40 wpm and 15 against 60. A figure that swings threefold on a
    /// number nobody chose is a figure nobody should be shown, which is why this
    /// is a setting rather than a constant.
    ///
    /// FORTY IS THE DEFAULT because it is the ordinary figure for sustained
    /// prose typing. Somebody who writes all day is faster and should say so.
    /// Zero and absurd values are clamped rather than trusted — this divides.
    #[serde(default = "default_typing_baseline_wpm")]
    pub typing_baseline_wpm: u32,
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
    /// The seventh mode to arrive (ADR 0041) and the fifth in the lane's order.
    /// It shipped unbound at first, on the reasoning that `Alt+1`-`Alt+6` were
    /// taken; the lane now runs `Alt+1`-`Alt+7` and Translate takes `Alt+5`,
    /// with Agent and Prompt Enhance each one place further down. Seven digits
    /// is the row's comfortable limit, so the eighth mode inherits that
    /// question rather than a precedent for extending the row silently.
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
            model: default_speech_model().to_string(),
            language: String::new(),
            active_text_profile_id: default_text_profile_id().to_string(),
            text_profiles: default_seeded_text_profiles(),
            curated_profiles_seeded: true,
            post_process: true,
            correction_model: default_correction_model().to_string(),
            local_correction_model: default_local_correction_model().to_string(),
            filter_fillers: true,
            professionalize: false,
            migrated_provider_tier: None,
            connections: None,
            migrated_provider_plans: None,
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
            local_model_dirs: Vec::new(),
            migrated_self_hosted_base_url: None,
            migrated_self_hosted_model: None,
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
            play_sounds: true,
            sound_volume: default_sound_volume(),
            sound_pack: default_sound_pack(),
            play_startup_sound: default_play_startup_sound(),
            log_level: "INFO".to_string(),
            temp_audio_dir: String::new(),
            history_limit: HISTORY_CEILING,
            history_retention_days: 90,
            agent_name: DEFAULT_AGENT_NAME.to_string(),
            agent_model: default_agent_model().to_string(),
            local_agent_model: default_local_agent_model().to_string(),
            processing_mode: ProcessingMode::default(),
            enhance_sub_mode: None,
            enhance_target: PromptTarget::default(),
            color_scheme: default_color_scheme(),
            workspace_nav_rail: false,
            home_activity_calendar: false,
            typing_baseline_wpm: default_typing_baseline_wpm(),
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

/// The first field that names something, or the catalogue's answer.
///
/// The order is the decision, not a convenience: profile, then connection, then
/// default (ADR 0207). Written once because three model questions ask it.
fn first_named<'a>(candidates: impl IntoIterator<Item = &'a String>, fallback: &str) -> String {
    candidates
        .into_iter()
        .map(|value| value.trim())
        .find(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

impl AppConfig {
    pub fn active_text_profile(&self) -> TextProfile {
        self.text_profiles
            .iter()
            .find(|profile| profile.id == self.active_text_profile_id)
            .cloned()
            .or_else(|| self.text_profiles.first().cloned())
            .unwrap_or_else(|| {
                default_text_profile()
            })
    }

    pub(crate) fn active_text_profile_work_mode(&self) -> TextProfileWorkMode {
        self.active_text_profile().work_mode.normalized()
    }

    /// What one job runs on, and what pays for it (ADR 0094).
    ///
    /// **The single door onto the provider axis.** Every call site that used to
    /// read a `provider` field names its own job here instead, which is what
    /// makes *recognise with Groq, transform with something stronger* a thing
    /// the config can express. The answer comes from the active profile,
    /// because the axis is per profile: two profiles are exactly the place two
    /// different connections belong.
    pub(crate) fn job_provider(&self, job: JobKey) -> JobProvider {
        self.active_text_profile()
            .job_provider(job, self.connections())
    }

    /// Every connection this machine holds (ADR 0208).
    ///
    /// The single door onto the list, so *never written* and *written empty*
    /// are told apart in one place rather than at each reader.
    pub(crate) fn connections(&self) -> &[Connection] {
        self.connections
            .as_deref()
            .unwrap_or_else(|| seeded_connections())
    }

    /// One connection by id, or `None` when it no longer exists.
    pub(crate) fn connection(&self, id: &str) -> Option<&Connection> {
        let id = id.trim();
        self.connections().iter().find(|entry| entry.id == id)
    }

    /// Which account plan this machine is on **with this connection**
    /// (ADR 0167, rescoped by ADR 0208).
    ///
    /// **The single door onto the plan**, and the reason it takes a connection
    /// rather than a vendor: a plan belongs to a credential, and a credential
    /// is a connection's since two accounts on one vendor are two plans. That
    /// is the question ADR 0167's own key could not answer, stated in the
    /// object it was reaching for.
    ///
    /// An empty answer is *this vendor's default plan*, not *no answer*. Every
    /// adapter already resolves an unrecognised id to its own default rather
    /// than to its largest (`groq::capture_limits`), so a connection with no
    /// plan and a connection holding another vendor's plan id land in the same
    /// place — which is what makes this lookup safe to ask about any id at all.
    pub(crate) fn plan_for(&self, connection: &str) -> &str {
        self.connection(connection)
            .map(|entry| entry.plan.trim())
            .unwrap_or("")
    }

    /// The chat model this machine runs one instruction-following job on — the
    /// agent, the translation, the prompt enhancer, or a transcript title
    /// (ADR 0077).
    ///
    /// **It takes the job now rather than reading one machine-wide provider.**
    /// The local lane names its models differently from every cloud one, so the
    /// question *which model* cannot be answered before *which vendor*, and
    /// that is per job since ADR 0094's config half. A job routed to Local
    /// takes the local model even while the connection is on Groq.
    /// **The profile's, then the connection's, then the catalogue's**
    /// (ADR 0207). A profile is where two working lives are kept apart — an
    /// employer's connection and a private one — so the model a job runs on
    /// belongs to the profile for the same reason its vendor does.
    ///
    /// The connection-wide field stays as the fallback rather than being
    /// removed: it is what a profile written before this carries nothing for,
    /// and it is one save away from being replaced by the profile's own value.
    pub(crate) fn chat_model_for_job(&self, job: JobKey) -> String {
        let profile = self.active_text_profile();
        let speech = profile.resolved_speech();

        if profile.job_provider(job, self.connections()).provider
            == super::providers::LOCAL_PROVIDER_ID
        {
            first_named(
                [&speech.local_agent_model, &self.local_agent_model],
                default_local_agent_model(),
            )
        } else {
            first_named(
                [&speech.agent_model, &self.agent_model],
                default_agent_model(),
            )
        }
    }

    /// **The model that listens** — resolved off the same object the vendor is
    /// (ADR 0203).
    ///
    /// The speech job and nothing else: a profile that transforms on another
    /// vendor does not change what listened. Which is what the history path
    /// meant to ask and did not: it read the connection-wide `model` while the
    /// capture read the *profile's* `speech.model`, so every record on a machine
    /// with a per-profile recogniser named a model no request carried. The
    /// provider half of the same question has gone through `job_provider` since
    /// ADR 0094; this is the model half, in one place both paths call.
    ///
    /// `None` is a real answer and the reason this is an `Option`: the cloud and
    /// self-hosted lanes let the adapter pick when nothing is configured, and a
    /// record inventing the id it *would* have picked is this cluster's own
    /// failure class committed by an instrument. The local lane has no such
    /// door — whisper loads a file — so `base` is a resolution rather than a
    /// guess.
    pub(crate) fn speech_model(&self) -> Option<String> {
        let profile = self.active_text_profile();
        let speech = profile.resolved_speech();
        let job = profile.job_provider(JobKey::Dictation, self.connections());

        if job.provider == super::providers::LOCAL_PROVIDER_ID {
            let named = speech.local_model.trim();
            return Some(if named.is_empty() {
                "base".to_string()
            } else {
                named.to_string()
            });
        }

        // The third lane reads the id off the connection (ADR 0165, rescoped by
        // ADR 0208): `speech.model` is a catalogued cloud id and somebody's own
        // server serves none of them, and *which* server is now the profile's
        // answer rather than the machine's — which is what closes the
        // inconsistency ADR 0207 recorded and could not fix.
        let connection_model = self
            .connection(&job.connection)
            .map(|entry| entry.model.trim().to_string())
            .unwrap_or_default();

        let named = if job.provider == super::providers::self_hosted::SELF_HOSTED_PROVIDER_ID {
            connection_model.as_str()
        } else {
            speech.model.trim()
        };

        (!named.is_empty()).then(|| named.to_string())
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

    /// The config as it may leave this runtime.
    ///
    /// **It scrubs nothing today, and it is not therefore removable.** Until
    /// ADR 0112 it cleared `legacy_groq_api_key`, the one secret an `AppConfig`
    /// ever held; that field is gone and every credential now lives in the OS
    /// secret store. What remains is the promise: *nothing leaving this runtime
    /// holds a secret*. It is called on every disk write, on every export and
    /// on the config-changed event ADR 0108 plans, so a later field that does
    /// hold one lands inside a function that already exists rather than making
    /// its author invent the rule again.
    pub fn without_secrets(&self) -> Self {
        self.clone()
    }

    fn load_raw_from_disk() -> Self {
        let path = config_file_path();
        let Ok(raw) = std::fs::read_to_string(path) else {
            return Self::default();
        };

        serde_json::from_str::<Self>(&raw).unwrap_or_default()
    }

    /// Whether the machine's old single plan is still sitting unlifted on disk.
    ///
    /// Read by `load_from_disk_impl` so the snapshot covers this migration the
    /// way it already covers the profile one. **A written map answers `false`
    /// even while the old key is still in the file**: the lift has run, and the
    /// key is only still there because some other build wrote it.
    fn carries_an_unlifted_provider_plan(&self) -> bool {
        self.migrated_provider_plans.is_none()
            && self
                .migrated_provider_tier
                .as_deref()
                .is_some_and(|tier| !tier.trim().is_empty())
    }

    /// Whether the connection axis has never been written for this machine.
    ///
    /// Read on the raw config, before anything is normalized, because it
    /// decides three things at once: whether the load takes a snapshot, whether
    /// the lifted file is written back, and whether the stored credentials are
    /// re-keyed onto the connections the lift just created.
    fn carries_an_unlifted_connection_axis(&self) -> bool {
        self.connections.is_none()
    }

    /// Lifts the machine's one account plan onto the per-vendor axis (ADR 0167).
    ///
    /// **The plan id is offered to every registered vendor and lands on the
    /// ones that declare it.** That is the whole rule, and it is a lookup
    /// rather than a guess: a plan id names a plan OF a vendor, so the vendors
    /// it belongs to are exactly those whose `tiers()` carry it. `dev` is
    /// Groq's, so it lands on Groq and nowhere else. An id no vendor declares
    /// lands nowhere, and every vendor keeps its own default — which is what
    /// the old field already resolved to at every reader, so nothing is lost by
    /// dropping it rather than rescuing it.
    ///
    /// **A default plan is stored as absence.** Writing a vendor's default id
    /// would be a second spelling of what an empty entry already says, and the
    /// two drift the day a vendor renames its free plan.
    ///
    /// Guarded on `provider_plans` being absent rather than on a version
    /// counter: a written map is one this build wrote, and re-deriving it from
    /// a key that is no longer written would replace a user's choice with a
    /// migration. That is D6's defect, one axis over.
    fn adopt_provider_plan_axis(&mut self) {
        if self.migrated_provider_plans.is_some() {
            return;
        }

        let stored = self.migrated_provider_tier.take().unwrap_or_default();
        let stored = stored.trim();

        let mut plans = BTreeMap::new();
        if !stored.is_empty() {
            for registered in registered_providers() {
                let declares_it = provider_tiers(&registered.provider)
                    .iter()
                    .any(|tier| tier.id == stored && !tier.default);
                if declares_it {
                    plans.insert(registered.provider, stored.to_string());
                }
            }
        }

        self.migrated_provider_plans = Some(plans);
    }

    /// Lifts the machine's vendors onto the connection axis (ADR 0208).
    ///
    /// **One connection per vendor any profile actually names**, because that
    /// is the number of accounts this machine has evidence for. Inventing one
    /// per registered vendor would fill the list with accounts nobody holds,
    /// and inventing one per profile would be shape A written by a migration.
    ///
    /// **What it carries across**: the vendor, the plan ADR 0167 keyed by that
    /// vendor, and — for the lane that types its own — the endpoint and model
    /// id ADR 0165 had to keep machine-wide. What it cannot carry is a name,
    /// so it writes the vendor's own and leaves renaming to the reader.
    ///
    /// **The credential is not moved here.** This function is pure and runs in
    /// every test that normalizes a config; the OS secret store is touched on
    /// the load path only, by `rekey_connection_credentials`, which reads the
    /// pairs back off the list this wrote.
    ///
    /// Guarded on the block being absent rather than on a version counter, for
    /// ADR 0167's reason: a written list is one this build wrote, and
    /// re-deriving it would replace a deletion with a migration.
    fn adopt_connection_axis(&mut self) {
        if self.connections.is_some() {
            return;
        }

        // The plan lift feeds this one rather than standing beside it: its
        // output is this function's input, and running it anywhere else would
        // leave a map on the struct that nothing reads afterwards.
        self.adopt_provider_plan_axis();
        let plans = self.migrated_provider_plans.take().unwrap_or_default();
        let base_url = self.migrated_self_hosted_base_url.take().unwrap_or_default();
        let model = self.migrated_self_hosted_model.take().unwrap_or_default();

        // The default vendor leads, so the seeded id belongs to the connection
        // a profile with no written axis already points at.
        let mut vendors = vec![default_provider_id().to_string()];
        for profile in &self.text_profiles {
            // The WRITTEN block and never `resolved_providers`: an absent block
            // means *follow the default connection*, and reading the resolved
            // one here would read a connection id back as if it were a vendor.
            let Some(providers) = profile.providers.as_ref() else {
                continue;
            };
            for named in std::iter::once(&providers.default).chain(providers.overrides.values()) {
                let vendor = normalize_provider_value(named);
                if !vendors.contains(&vendor) {
                    vendors.push(vendor);
                }
            }
        }

        let self_hosted = super::providers::self_hosted::SELF_HOSTED_PROVIDER_ID;
        let connections: Vec<Connection> = vendors
            .iter()
            .map(|vendor| Connection {
                id: connection_id_for_lifted_vendor(vendor),
                label: default_connection_label(vendor),
                provider: vendor.clone(),
                base_url: if vendor == self_hosted {
                    base_url.trim().to_string()
                } else {
                    String::new()
                },
                model: if vendor == self_hosted {
                    model.trim().to_string()
                } else {
                    String::new()
                },
                plan: plans.get(vendor).cloned().unwrap_or_default(),
            })
            .collect();

        for profile in &mut self.text_profiles {
            let Some(providers) = profile.providers.as_mut() else {
                continue;
            };
            providers.default = connection_id_for_lifted_vendor(&normalize_provider_value(
                &providers.default,
            ));
            for named in providers.overrides.values_mut() {
                *named = connection_id_for_lifted_vendor(&normalize_provider_value(named));
            }
        }

        self.connections = Some(connections);
    }

    /// Drops every reference to a connection this machine no longer holds.
    ///
    /// Runs after the lift so the ids it just wrote are the ones checked, and
    /// on every load afterwards so a deleted connection cannot leave an
    /// override pointing into nothing.
    fn normalize_connection_references(&mut self) {
        let ids: Vec<String> = self
            .connections()
            .iter()
            .map(|connection| connection.id.clone())
            .collect();

        for profile in &mut self.text_profiles {
            if let Some(providers) = profile.providers.as_mut() {
                providers.normalize(&ids);
            }
        }
    }

    /// Returns whether normalization rewrote a profile's `work_mode`, so
    /// `load_from_disk_impl` can persist the canonical form instead of
    /// recomputing it on every load. See `normalize_text_profiles`.
    pub(crate) fn normalize_for_runtime(&mut self) -> bool {
        let work_mode_rewritten = self.normalize_text_profiles();
        /* CLAMPED RATHER THAN TRUSTED, because this one is a DIVISOR. A config
           hand-edited to zero would make every minute of dictation save an
           infinite amount of time, and the tile would draw whatever a division
           by zero produces. */
        self.typing_baseline_wpm = self
            .typing_baseline_wpm
            .clamp(TYPING_BASELINE_RANGE.0, TYPING_BASELINE_RANGE.1);
        // After the profiles, because the lift reads the vendor ids the
        // schema-5 migration writes into their provider blocks — and before
        // every reader below, because from here on a job resolves through a
        // connection.
        self.adopt_connection_axis();
        self.normalize_connection_references();
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
        // Clamp all timeout fields to technically realistic ranges.
        // Max recording: 1–30 minutes (60–1800s). Groq free tier caps at
        // ~25 MiB ≈ 13 min; dev tier at ~100 MiB ≈ 53 min. Local runtime has
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
        /* PINNED RATHER THAN CLAMPED (ADR 0185). The count stopped being a
           setting, so a stored value is a leftover from when it was one — and a
           leftover that silently overrides the retention rule the reader DID
           set. Raising it here is the migration: there is one ceiling, every
           install is on it, and the screen can state it as a fact. */
        self.history_limit = HISTORY_CEILING;
        self.history_retention_days = self.history_retention_days.min(3650);
        work_mode_rewritten
    }

    /// Returns whether any profile's `work_mode` was rewritten into its
    /// canonical form.
    fn normalize_text_profiles(&mut self) -> bool {
        if self.text_profiles.is_empty() {
            self.text_profiles.push(default_text_profile());
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

            // The provider block is normalized by `normalize_connection_references`
            // rather than here: what a reference has to be checked against is
            // the connection list, and that list is only lifted once every
            // profile has reached schema 5 (ADR 0208).

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

    /// Whether any stored profile is below the shape this build writes, and a
    /// schema migration is therefore about to run over it.
    ///
    /// Read on the raw config, before anything is normalized, because it is
    /// what decides whether the load takes a snapshot first.
    fn carries_a_profile_below_current_schema(&self) -> bool {
        self.text_profiles
            .iter()
            .any(|profile| profile.schema_version < TEXT_PROFILE_SCHEMA_VERSION)
    }

    fn load_from_disk_impl() -> Self {
        let mut config = Self::load_raw_from_disk();

        // **Snapshot before the migration, not before the save.** The order is
        // the contract `core::backup` states for the import path and it holds
        // here for the same reason: a copy taken after the rewrite is a copy of
        // the rewrite. A failed snapshot does not block the load — the config
        // this build cannot migrate is one it also cannot run on — but it is
        // recorded, and on this path the file has not been touched yet.
        // **The plan lift counts as migrating too** (ADR 0167). It rewrites the
        // config as surely as the profile one does, and a migration that ran
        // without a copy behind it is the one thing this path exists to prevent
        // — the tag names whichever is actually pending so the file on disk can
        // be told apart later.
        let lifting_profiles = config.carries_a_profile_below_current_schema();
        let lifting_plans = config.carries_an_unlifted_provider_plan();
        let lifting_connections = config.carries_an_unlifted_connection_axis();
        let migrating = lifting_profiles || lifting_plans || lifting_connections;
        // A machine with no config file yet is not migrating anything: the
        // connection lift still runs, because a fresh install needs its first
        // connection, but there is no file to copy and a snapshot that failed
        // for that reason would log a failure nobody can act on.
        if migrating && config_file_path().exists() {
            let tag = if lifting_profiles {
                "provider-axis"
            } else if lifting_plans {
                "provider-plan-axis"
            } else {
                "connection-axis"
            };
            // Only the failure is logged here. `snapshot_config` records its own
            // path on success, and a second line saying the same thing is the
            // kind of noise that makes a runtime log unreadable — but it is
            // silent when it fails, and a migration that rewrote the config
            // without a copy behind it is the one fact this path must state.
            if let Err(error) = super::backup::snapshot_config(tag) {
                runtime_log::record(format!(
                    "[WordScript] Config snapshot before {tag} migration FAILED error={error}"
                ));
            }
        }

        let original_hotkeys = (
            config.hotkey.clone(),
            config.pause_hotkey.clone(),
            config.abort_hotkey.clone(),
        );

        // A migrated profile must reach disk, or the lift runs again on every
        // load and the snapshot piles up beside it.
        let mut should_save = migrating;

        // A `work_mode` rewrite counts towards `should_save`. It did not before,
        // which is why a non-canonical `insert_behavior` could be corrected in
        // memory on every load and never written back — see
        // `normalize_text_profiles`.
        should_save |= config.normalize_for_runtime();

        should_save |= original_hotkeys
            != (
                config.hotkey.clone(),
                config.pause_hotkey.clone(),
                config.abort_hotkey.clone(),
            );

        // **The credential follows its connection, and this is the one place
        // the migration touches the OS secret store** (ADR 0208). The lift is
        // pure and runs in every test that normalizes a config; this runs on
        // the load path, once in a machine's life, reading its pairs back off
        // the list the lift just wrote — the vendor a key was stored under, and
        // the connection that now owns it. A failure is logged and never blocks
        // the load: a key that did not move is one the reader re-types, which
        // is the licence ADR 0112 gives.
        if lifting_connections {
            for connection in config.connections() {
                if let Err(error) = super::providers::rekey_connection_credentials(
                    &super::providers::credential_store::OsSecretStore,
                    &connection.provider,
                    &connection.id,
                ) {
                    runtime_log::record(format!(
                        "[WordScript] Connection credential re-key FAILED provider={} connection={} error={error}",
                        connection.provider, connection.id,
                    ));
                }
            }
        }

        if should_save {
            let _ = config.save_to_disk();
        }

        config
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
    // Hold the config file lock across normalize + write so a parallel
    // read-modify-write command (e.g. set_active_profile_processing_mode from
    // the mode hotkey, or a resolve_current_processing_mode re-save) cannot
    // read a stale file and write it back over this change — the cause of
    // "settings switch back to clipboard only".
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

// `acknowledge_profile_health_flag` and `unacknowledge_profile_health_flag`
// stood here until 2026-08-11 and were removed by Leg 9 (ADR 0089). They were
// registered commands writing `profile_health_acknowledged_flags`, and they had
// **no caller in any commit** — not the deleted `PromptsTab.tsx`, which kept its
// acknowledgements in React state and passed them to `get_profile_health` as a
// request field rather than persisting them. ADR 0085 gave the write a real
// caller through the config seam, which is where it stays: these two took no
// `AppHandle` and so could not emit `ready`, meaning a second window would never
// have learned about an acknowledgement made through them.

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

/// Translate sits inside the digit order rather than after it, which is why the
/// two slots below it carry the keys they do: the lane runs `Alt+1` through
/// `Alt+7` in the order the Modes screen lists, and Translate is fifth in that
/// order. It ships bound like every other mode.
fn default_mode_translate_hotkey() -> String {
    "Alt+5".to_string()
}

fn default_mode_agent_hotkey() -> String {
    "Alt+6".to_string()
}

/// The seventh digit, and the last one this row can carry comfortably. An
/// eighth mode inherits the question of what a modifier row holds, not a
/// precedent for extending it silently.
fn default_mode_prompt_enhance_hotkey() -> String {
    "Alt+7".to_string()
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

/// Stamps the shortcut schema version onto a config below it.
///
/// **Two rewrites used to run here and both are gone** (ADR 0112): version 1
/// recorded that a pre-contract normalizer had truncated three space
/// combinations, and version 2 moved an untouched mode lane from `Ctrl` to
/// `Alt`. Each existed for configs written by builds nobody runs.
///
/// The stamp stays because the gate is the point. A shortcut migration that
/// fires on every save rewrites the value the user chose a second ago — D6,
/// observed — so the next one lands here, below its own version number, and
/// runs once.
fn migrate_shortcut_schema(config: &mut AppConfig) {
    if config.shortcut_schema_version >= SHORTCUT_SCHEMA_VERSION {
        return;
    }

    config.shortcut_schema_version = SHORTCUT_SCHEMA_VERSION;
}

fn default_local_prompt_strength() -> &'static str {
    "profile"
}

fn normalize_local_correction_model_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default_local_correction_model().to_string()
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
        "local-{}-{}",
        normalized,
        default_local_profile_mode_for_model(&normalized)
    )
}

pub(crate) fn local_model_from_profile_id(profile: &str) -> Option<String> {
    let normalized = profile.trim().to_ascii_lowercase();
    let rest = normalized.strip_prefix("local-")?;

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

    format!("local-{}-{}", model, mode)
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

/// The profile every fresh install starts from.
///
/// It took a prompt, a hint blob and two rule lists until ADR 0112, because
/// `apply_legacy_text_rules_from_value` built the first profile out of a
/// pre-profile config's four top-level fields. That path is gone and every
/// remaining caller passed empties, so the parameters went with it.
fn default_text_profile() -> TextProfile {
    TextProfile {
        id: default_text_profile_id().to_string(),
        label: default_text_profile_label().to_string(),
        prompt: String::new(),
        stt_hints: String::new(),
        vocabulary_hints: Vec::new(),
        schema_version: TEXT_PROFILE_SCHEMA_VERSION,
        work_mode: TextProfileWorkMode::default(),
        curation: TextProfileCuration::default(),
        dictionary_entries: Vec::new(),
        snippet_entries: Vec::new(),
        providers: None,
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
    let mut profiles = vec![default_text_profile()];
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::providers::{
        ProviderRole, DEFAULT_PROVIDER_ID, LOCAL_PROVIDER_ID,
    };

    /// **The promise, not the field it used to be about.** `without_secrets`
    /// scrubbed `legacy_groq_api_key` until ADR 0112 removed it, and an
    /// identity function is easy to mistake for a dead one. What it guards is
    /// the payload: every write, export and event goes through it, so a field
    /// added later that does hold a credential must be scrubbed here rather
    /// than reach a file the user can read.
    #[test]
    fn disk_config_payload_never_carries_a_credential_field() {
        let serialized = serde_json::to_string(&AppConfig::default().without_secrets())
            .expect("serialize config");

        for name in ["api_key", "groq_api_key", "token", "secret", "password"] {
            assert!(
                !serialized.contains(name),
                "a config field named like a credential ('{name}') reached the disk payload",
            );
        }
    }

    #[test]
    fn normalizes_alternate_spellings_to_the_canonical_contract_form() {
        // The tolerance that stays: comma separators, `event.code` names from
        // the recorder, and the platform words for Super. What went with
        // ADR 0112 is the pynput dialect (`ctrl_l`), which only the removed
        // sidecar ever wrote.
        assert_eq!(normalize_shortcut_value("ctrl, win", true), "Ctrl+Super");
        assert_eq!(
            normalize_shortcut_value("ControlLeft+AltLeft", true),
            "Ctrl+Alt"
        );
        assert_eq!(normalize_shortcut_value("Ctrl+F9", true), "Ctrl+F9");
        assert_eq!(normalize_shortcut_value("ctrl+f9", true), "Ctrl+F9");
    }

    #[test]
    fn space_combinations_survive_persist_time_normalization() {
        // D6: these three used to lose their trailing key on every save, which
        // silently rewrote the Windows default hotkey to a modifier-only value.
        assert_eq!(
            normalize_shortcut_value("ctrl+alt+space", true),
            "Ctrl+Alt+Space"
        );
        assert_eq!(
            normalize_shortcut_value("ctrl+win+space", true),
            "Ctrl+Super+Space"
        );
        assert_eq!(
            normalize_shortcut_value("ctrl+cmd+space", true),
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
            pause_hotkey: "ctrl+f10".to_string(),
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
            mode_cleanup_hotkey: "ctrl+florp".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.mode_cleanup_hotkey, "ctrl+florp");
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

    /// A slot the user chose is never rewritten from below. The version-2 rule
    /// that moved an untouched `Ctrl` mode lane onto `Alt` went with ADR 0112,
    /// but the property it was gated for is the one that outlives it: bumping
    /// the schema must leave every assigned value alone.
    #[test]
    fn a_chosen_mode_shortcut_survives_a_schema_bump() {
        let mut config = AppConfig {
            shortcut_schema_version: 1,
            mode_picker_hotkey: "Ctrl+Alt+M".to_string(),
            mode_auto_hotkey: String::new(),
            mode_agent_hotkey: "Ctrl+5".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.mode_picker_hotkey, "Ctrl+Alt+M");
        assert_eq!(config.mode_auto_hotkey, "", "an empty slot stays disabled");
        assert_eq!(config.mode_agent_hotkey, "Ctrl+5");
        assert_eq!(config.shortcut_schema_version, SHORTCUT_SCHEMA_VERSION);
    }

    #[test]
    fn collision_validation_sees_normalized_values() {
        // D7: `ControlLeft+F9` and `Ctrl+F9` are the same grab. Validating raw
        // values let two spellings of one combination through.
        let config = AppConfig {
            hotkey: "Ctrl+F9".to_string(),
            mode_agent_hotkey: "ControlLeft+F9".to_string(),
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
            mode_agent_hotkey: "ctrl+florp".to_string(),
            ..AppConfig::default()
        };

        assert!(validate_hotkey_collisions(&config).is_ok());
    }

    /// Puts the whole axis of the active profile on one vendor's connection,
    /// creating the connection (ADR 0208).
    fn set_profile_connection(config: &mut AppConfig, provider: &str) {
        let connection = test_connection(provider);
        set_profile_connection_id(config, &connection.id);
        config.connections = Some(vec![connection]);
    }

    /// Points the active profile at a connection id, whether or not it exists.
    fn set_profile_connection_id(config: &mut AppConfig, connection: &str) {
        let active_id = config.active_text_profile_id.clone();
        let profile = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
            .expect("active profile");
        profile.providers = Some(ProfileProviderSettings {
            default: connection.to_string(),
            ..Default::default()
        });
    }

    /// An id no adapter will ever claim — see `providers::mod`'s copy of this
    /// constant for why both files stopped naming a real vendor here.
    const UNREGISTERABLE_PROVIDER_ID: &str = "not-a-vendor-this-build-carries";

    /// **A deleted connection is named, not replaced** (ADR 0208).
    ///
    /// Until the connection axis this asserted the opposite: an unresolvable
    /// value fell back to Groq, which was right while the value was a VENDOR id
    /// — an id nothing registers is a typo, and the default vendor is the only
    /// answer. A connection id is not a typo. It is an account somebody
    /// deleted, and repointing the profile at a different one would be this
    /// build deciding who pays. So the job goes inert and the refusal says
    /// which connection is gone.
    #[test]
    fn a_profile_naming_a_deleted_connection_goes_inert_rather_than_repointed() {
        let mut config = AppConfig::default();
        set_profile_connection_id(&mut config, "connection-that-was-deleted");
        // A WRITTEN list, because that is the only state this can happen in:
        // an absent list means the axis has never been lifted, and the lift
        // reads every stored value as the vendor id it was.
        config.connections = Some(vec![test_connection(DEFAULT_PROVIDER_ID)]);

        config.normalize_for_runtime();

        let job = config.job_provider(JobKey::Cleanup);
        assert_eq!(
            job.connection, "connection-that-was-deleted",
            "the profile keeps naming what it named",
        );
        assert!(
            job.provider.is_empty(),
            "and no vendor is invented for it: {}",
            job.provider,
        );

        let refusal = job.credential().expect_err("an absent account pays for nothing");
        assert!(
            refusal.message.contains("no longer exists"),
            "the refusal names the state rather than a stack trace: {}",
            refusal.message,
        );
    }

    #[test]
    fn an_override_naming_an_unknown_provider_is_dropped_rather_than_normalized() {
        let mut config = AppConfig::default();
        let active_id = config.active_text_profile_id.clone();
        let profile = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
            .expect("active profile");
        let local = test_connection(LOCAL_PROVIDER_ID);
        profile.providers = Some(ProfileProviderSettings {
            default: local.id.clone(),
            overrides: BTreeMap::from([
                (JobKey::Assistant, UNREGISTERABLE_PROVIDER_ID.to_string()),
                (JobKey::Translate, local.id.clone()),
            ]),
        });
        config.connections = Some(vec![local]);

        config.normalize_for_runtime();

        let assistant = config.job_provider(JobKey::Assistant);
        assert!(
            !assistant.overridden,
            "an unresolvable override reads as following the connection"
        );
        assert_eq!(
            assistant.provider, LOCAL_PROVIDER_ID,
            "and it falls to the connection, not to the registry default"
        );
        assert!(
            config.job_provider(JobKey::Translate).overridden,
            "a resolvable override beside it survives untouched"
        );
    }

    #[test]
    fn a_job_that_overrides_takes_its_own_credential_and_never_the_connections() {
        let mut config = AppConfig::default();
        let active_id = config.active_text_profile_id.clone();
        let profile = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
            .expect("active profile");
        let cloud = test_connection(DEFAULT_PROVIDER_ID);
        let local = test_connection(LOCAL_PROVIDER_ID);
        profile.providers = Some(ProfileProviderSettings {
            default: cloud.id.clone(),
            overrides: BTreeMap::from([(JobKey::Assistant, local.id.clone())]),
        });
        config.connections = Some(vec![cloud, local]);

        let assistant = config.job_provider(JobKey::Assistant);
        let cleanup = config.job_provider(JobKey::Cleanup);

        assert_eq!(assistant.provider, LOCAL_PROVIDER_ID);
        assert_eq!(cleanup.provider, DEFAULT_PROVIDER_ID);

        // ADR 0094's one security rule: the credential follows the provider the
        // job actually runs on. Reading it off the connection would send a key
        // to a host it was never entered for. The local lane is the one vendor
        // whose answer can be asserted without a keyring — it needs no
        // credential at all, and that is exactly what the override must produce
        // where the connection would have produced Groq's.
        let credential = assistant
            .credential()
            .expect("the local lane answers for chat");
        assert_eq!(credential.provider, LOCAL_PROVIDER_ID);
        assert_eq!(credential.role, ProviderRole::Chat);
        assert!(
            credential.kind.is_none(),
            "the overriding job took the lane that needs no credential, not the connection's"
        );
    }

    /// **THE SENTENCE THE WHOLE STEP EXISTS FOR** (ADR 0208): switching the
    /// profile switches the account that pays.
    ///
    /// Nothing checked it before this step, because there was nothing to check
    /// — one vendor held one key, so an employer's Groq account and a private
    /// one were the same entry in the OS store and a profile switch moved the
    /// vendor and nothing else. Here the two profiles sit on ONE vendor and on
    /// two accounts, which is the case the old key could not express at all.
    ///
    /// The assertion runs through the real resolution — active profile, its
    /// axis, the connection, the entry name — and only the store is a fake, so
    /// what it proves is the chain rather than a formatting rule.
    #[test]
    fn switching_the_profile_moves_the_credential() {
        use super::super::providers::credential_store::{self, MemorySecretStore};
        use super::super::providers::CredentialKind;

        let work = Connection {
            id: "connection-work".to_string(),
            label: "Employer".to_string(),
            provider: DEFAULT_PROVIDER_ID.to_string(),
            ..Connection::default()
        };
        let private = Connection {
            id: "connection-private".to_string(),
            label: "Mine".to_string(),
            provider: DEFAULT_PROVIDER_ID.to_string(),
            ..Connection::default()
        };

        let mut config = AppConfig {
            connections: Some(vec![work.clone(), private.clone()]),
            text_profiles: vec![
                TextProfile {
                    id: "profile-work".to_string(),
                    label: "Work".to_string(),
                    schema_version: TEXT_PROFILE_SCHEMA_VERSION,
                    providers: Some(ProfileProviderSettings {
                        default: work.id.clone(),
                        overrides: BTreeMap::new(),
                    }),
                    ..TextProfile::default()
                },
                TextProfile {
                    id: "profile-private".to_string(),
                    label: "Private".to_string(),
                    schema_version: TEXT_PROFILE_SCHEMA_VERSION,
                    providers: Some(ProfileProviderSettings {
                        default: private.id.clone(),
                        overrides: BTreeMap::new(),
                    }),
                    ..TextProfile::default()
                },
            ],
            active_text_profile_id: "profile-work".to_string(),
            ..AppConfig::default()
        };

        let store = MemorySecretStore::default();
        let (role, kind) = (ProviderRole::Speech, CredentialKind::ApiKey);
        credential_store::write_to(&store, &work.id, role, kind, "gsk_the_employers_key")
            .expect("the fake store accepts a write");
        credential_store::write_to(&store, &private.id, role, kind, "gsk_my_own_key")
            .expect("the fake store accepts a write");

        let key_in_force = |config: &AppConfig| {
            let job = config.job_provider(JobKey::Dictation);
            assert_eq!(job.provider, DEFAULT_PROVIDER_ID, "one vendor, two accounts");
            credential_store::read_from(&store, &job.connection, role, kind)
                .expect("read must succeed")
        };

        assert_eq!(key_in_force(&config).as_deref(), Some("gsk_the_employers_key"));

        config.active_text_profile_id = "profile-private".to_string();

        assert_eq!(
            key_in_force(&config).as_deref(),
            Some("gsk_my_own_key"),
            "the switch moved the account, not just the vendor",
        );
    }

    /// The other half of the same sentence: a profile that shares an account
    /// shares its key, and does not need a second copy of it typed in.
    ///
    /// **This is the case shape A could not express** and the reason the
    /// connection is an object: two writing styles on one employer account are
    /// one key, rotated once.
    #[test]
    fn two_profiles_on_one_connection_spend_one_key() {
        let mut config = AppConfig {
            connections: Some(vec![test_connection(DEFAULT_PROVIDER_ID)]),
            text_profiles: vec![
                TextProfile {
                    id: "profile-email".to_string(),
                    schema_version: TEXT_PROFILE_SCHEMA_VERSION,
                    providers: Some(ProfileProviderSettings::default()),
                    ..TextProfile::default()
                },
                TextProfile {
                    id: "profile-code".to_string(),
                    schema_version: TEXT_PROFILE_SCHEMA_VERSION,
                    providers: Some(ProfileProviderSettings::default()),
                    ..TextProfile::default()
                },
            ],
            active_text_profile_id: "profile-email".to_string(),
            ..AppConfig::default()
        };

        let email = config.job_provider(JobKey::Dictation).connection;
        config.active_text_profile_id = "profile-code".to_string();
        let code = config.job_provider(JobKey::Dictation).connection;

        assert_eq!(email, code, "one account, and therefore one entry to rotate");
        assert_eq!(email, DEFAULT_CONNECTION_ID);
    }

    #[test]
    fn a_job_resolves_the_role_its_call_is_made_in() {
        assert_eq!(JobKey::Dictation.role(), ProviderRole::Speech);
        assert_eq!(JobKey::Meetings.role(), ProviderRole::Speech);
        assert_eq!(JobKey::Upload.role(), ProviderRole::Speech);
        for job in [
            JobKey::Cleanup,
            JobKey::Rewrite,
            JobKey::Translate,
            JobKey::Enhance,
            JobKey::Assistant,
        ] {
            assert_eq!(job.role(), ProviderRole::Chat, "{}", job.as_str());
        }
    }

    #[test]
    fn recognize_on_one_vendor_and_transform_on_another_is_expressible() {
        let mut config = AppConfig::default();
        let active_id = config.active_text_profile_id.clone();
        let profile = config
            .text_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
            .expect("active profile");
        // The sentence the config could not say before this step.
        let cloud = test_connection(DEFAULT_PROVIDER_ID);
        let local = test_connection(LOCAL_PROVIDER_ID);
        profile.providers = Some(ProfileProviderSettings {
            default: cloud.id.clone(),
            overrides: BTreeMap::from([(JobKey::Rewrite, local.id.clone())]),
        });
        config.connections = Some(vec![cloud, local]);

        assert_eq!(
            config.job_provider(JobKey::Dictation).provider,
            DEFAULT_PROVIDER_ID
        );
        assert_eq!(
            config.job_provider(JobKey::Rewrite).provider,
            LOCAL_PROVIDER_ID
        );
        assert_eq!(
            config.chat_model_for_job(JobKey::Rewrite),
            config.local_agent_model,
            "the model follows the job's vendor, not the connection's"
        );
        assert_eq!(
            config.chat_model_for_job(JobKey::Cleanup),
            config.agent_model,
        );
    }

    #[test]
    fn normalizes_history_settings_to_supported_runtime_values() {
        let mut config = AppConfig {
            history_limit: 2,
            history_retention_days: 9_999,
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.history_limit, HISTORY_CEILING);
        assert_eq!(config.history_retention_days, 3650);
    }

    /// ADR 0185. The count cap is no longer a preference, so a config carrying
    /// one — this machine's own stood at fifty — must come back on the ceiling
    /// rather than keep quietly out-pruning the retention rule beside it.
    #[test]
    fn a_stored_count_cap_is_raised_to_the_ceiling_rather_than_honoured() {
        let mut config = AppConfig {
            history_limit: 50,
            history_retention_days: 90,
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.history_limit, HISTORY_CEILING);
        assert_eq!(
            config.history_retention_days, 90,
            "the rule the reader did set stays theirs"
        );
    }

    #[test]
    fn normalizes_local_controls_into_runtime_safe_values() {
        let mut config = AppConfig {
            local_model: "large_v3".to_string(),
            local_profile: String::new(),
            local_prompt_strength: "strong".to_string(),
            local_beam_size: 0,
            local_best_of: 42,
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_model, "large-v3");
        assert_eq!(config.local_profile, "local-large-v3-quality");
        assert_eq!(config.local_prompt_strength, "profile_and_terms");
        assert!(!config.local_prompt_carry);
        assert!(config.local_profile_prompt_settings.iter().any(|entry| {
            entry
                == &LocalProfilePromptSettings {
                    profile_id: "local-large-v3-quality".to_string(),
                    prompt_strength: "profile_and_terms".to_string(),
                    prompt_carry: false,
                }
        }));
        assert_eq!(config.local_beam_size, 5);
        assert_eq!(config.local_best_of, 5);
        assert!(config.local_profile_decode_settings.iter().any(|entry| {
            entry
                == &LocalProfileDecodeSettings {
                    profile_id: "local-large-v3-quality".to_string(),
                    beam_size: 5,
                    best_of: 5,
                }
        }));
        assert!(config.local_profile_decode_settings.iter().any(|entry| {
            LocalProfileDecodeSettings {
                profile_id: "local-base-fast".to_string(),
                beam_size: 1,
                best_of: 1,
            } == *entry
        }));
    }

    #[test]
    fn selected_local_profile_overrides_stale_local_model() {
        let mut config = AppConfig {
            local_model: "base".to_string(),
            local_profile: "local-medium-fast".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_model, "medium");
        assert_eq!(config.local_profile, "local-medium-fast");
    }

    #[test]
    fn selected_local_profile_uses_profile_specific_decode_settings() {
        let mut config = AppConfig {
            local_model: "base".to_string(),
            local_profile: "local-medium-quality".to_string(),
            local_beam_size: 1,
            local_best_of: 1,
            local_profile_decode_settings: vec![LocalProfileDecodeSettings {
                profile_id: "local-medium-quality".to_string(),
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
                profile_id: "local-medium-quality".to_string(),
                beam_size: 7,
                best_of: 6,
            }
        );
    }

    #[test]
    fn selected_local_profile_uses_profile_specific_prompt_settings() {
        let mut config = AppConfig {
            local_model: "base".to_string(),
            local_profile: "local-medium-quality".to_string(),
            local_prompt_strength: "off".to_string(),
            local_prompt_carry: false,
            local_profile_prompt_settings: vec![LocalProfilePromptSettings {
                profile_id: "local-medium-quality".to_string(),
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
                profile_id: "local-medium-quality".to_string(),
                prompt_strength: "profile_and_terms".to_string(),
                prompt_carry: true,
            }
        );
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

    /// **The shape this build writes still round-trips** — the assertion
    /// ADR 0112 asks for, because a removal must not touch it. The reported
    /// "settings switch back to clipboard only" came from the global
    /// `auto_paste` shadow field forcing a profile back on load; the field is
    /// gone, and the delivery mode a save carries has to survive the trip
    /// regardless.
    #[test]
    fn a_config_written_by_this_build_round_trips_unchanged() {
        let mut written = AppConfig::default();
        written.text_profiles[0].work_mode.insert_behavior = "auto_paste".to_string();
        written.normalize_for_runtime();

        let raw = serde_json::to_value(written.without_secrets()).expect("serialize config");
        let mut reloaded: AppConfig = serde_json::from_value(raw).expect("deserialize config");

        assert!(
            !reloaded.normalize_for_runtime(),
            "a config this build wrote must need no rewrite on the next load",
        );
        assert_eq!(
            reloaded.active_text_profile().work_mode.insert_behavior,
            "auto_paste",
        );
        assert_eq!(reloaded.hotkey, written.hotkey);
        assert_eq!(
            reloaded.result_actions_timeout_s,
            written.result_actions_timeout_s,
        );
        assert_eq!(
            reloaded.shortcut_schema_version,
            SHORTCUT_SCHEMA_VERSION,
            "the counter this build stamps has to come back off disk",
        );
        assert_eq!(
            reloaded.active_text_profile().schema_version,
            TEXT_PROFILE_SCHEMA_VERSION,
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
    fn defaults_to_high_accuracy_correction_model() {
        let config = AppConfig::default();

        assert_eq!(config.correction_model, default_correction_model());
    }

    /// **The catalogue is a snapshot, not a whitelist** (ADR 0115).
    ///
    /// A model absent from `shared/model_catalogue.json` survives a save and a
    /// load as what the user typed. It is the property every enterprise
    /// deployment name depends on — a deployment name is in no catalogue by
    /// construction — and the one that would be quietly lost if a validator
    /// were ever hung off the file. The four fields are checked together
    /// because a whitelist added to one of them would be found by whichever
    /// test happened to cover that field and by no other.
    #[test]
    fn a_model_the_catalogue_never_heard_of_round_trips_as_a_typed_override() {
        let mut written = AppConfig::default();
        written.model = "some-vendors-newest-recogniser".to_string();
        written.correction_model = "some-vendors-newest-model".to_string();
        written.local_correction_model = "a-tag-only-this-machine-has".to_string();
        written.agent_model = "an-enterprise-deployment-name".to_string();
        written.normalize_for_runtime();

        let raw = serde_json::to_value(written.without_secrets()).expect("serialize config");
        let mut reloaded: AppConfig = serde_json::from_value(raw).expect("deserialize config");
        reloaded.normalize_for_runtime();

        assert_eq!(reloaded.model, "some-vendors-newest-recogniser");
        assert_eq!(reloaded.correction_model, "some-vendors-newest-model");
        assert_eq!(reloaded.local_correction_model, "a-tag-only-this-machine-has");
        assert_eq!(reloaded.agent_model, "an-enterprise-deployment-name");

        assert!(
            crate::core::model_catalogue::catalogue()
                .models
                .iter()
                .all(|row| row.model_id != reloaded.correction_model),
            "the point of this test is that the id is not in the file",
        );
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

    /// The per-entry opt-in decides nothing about the recognizer's slots
    /// (ADR 0035). It was the control a user set on their most important terms,
    /// which are the long product names — exactly the ones `vocabulary_repair`
    /// restores afterwards — so the runtime allocates the slots instead. The
    /// field still round-trips because the surface writes it; nothing reads it.
    #[test]
    fn the_stored_opt_in_no_longer_decides_the_recognizer_slots() {
        let build = |use_as_prompt_hint: bool| TextProfile {
            id: "support".to_string(),
            vocabulary_hints: ["Kubernetes", "Statuspage"]
                .iter()
                .enumerate()
                .map(|(index, phrase)| VocabularyHintEntry {
                    id: format!("support-vocab-{index}"),
                    phrase: (*phrase).to_string(),
                    use_as_prompt_hint,
                    ..VocabularyHintEntry::default()
                })
                .collect(),
            ..TextProfile::default()
        };

        let opted_in = build(true);
        let opted_out = build(false);

        assert!(opted_in.vocabulary_hints[0].use_as_prompt_hint);
        assert!(!opted_out.vocabulary_hints[0].use_as_prompt_hint);
        assert_eq!(
            opted_in.recognizer_slot_phrases(),
            opted_out.recognizer_slot_phrases()
        );
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

    /// **Serde's default, not a migration.** An entry with no `origin` in the
    /// JSON is the user's, because nothing was promoting terms when that shape
    /// was written — and the frontend mirror still writes entries, so this is a
    /// live deserialization rule rather than a step that ran once.
    #[test]
    fn an_entry_written_without_an_origin_loads_as_the_users() {
        let raw = r#"{
            "id": "support",
            "label": "Support",
            "prompt": "",
            "vocabulary_hints": [{"id": "support-vocab-0", "phrase": "Kubernetes"}],
            "schema_version": 4,
            "dictionary_entries": [],
            "snippet_entries": []
        }"#;

        let profile: TextProfile = serde_json::from_str(raw).expect("profile parses");

        assert_eq!(profile.vocabulary_hints[0].origin, VocabularyHintOrigin::User);
        assert_eq!(profile.vocabulary_hints[0].learned_at_ms, None);
        assert_eq!(profile.vocabulary_phrases(), vec!["Kubernetes"]);
    }

    /// The counter is a gate, and a load that reaches it rewrites nothing —
    /// which is the whole of what ADR 0112 left standing here. A learned row
    /// stays learned, an edited context field stays edited, a vocabulary the
    /// user emptied stays empty.
    #[test]
    fn landing_on_the_current_schema_rewrites_no_field() {
        let mut profile = TextProfile {
            id: "curated-product-engineering".to_string(),
            prompt: "WordScript\nAPI\nSDK\nSQL\nCI/CD\nSLO\nPR\nTauri".to_string(),
            stt_hints: "status update\ntriage summary".to_string(),
            vocabulary_hints: vec![VocabularyHintEntry {
                id: "support-learned-1".to_string(),
                phrase: "Kubernetes".to_string(),
                origin: VocabularyHintOrigin::Learned,
                learned_at_ms: Some(1_700_000_000_000),
                hit_count: 3,
                ..VocabularyHintEntry::default()
            }],
            schema_version: 1,
            ..TextProfile::default()
        };
        let before = profile.clone();

        assert!(
            profile.migrate_to_current_schema(),
            "a profile below the current version reports the stamp",
        );

        assert_eq!(profile.schema_version, TEXT_PROFILE_SCHEMA_VERSION);
        assert_eq!(profile.prompt, before.prompt);
        assert_eq!(profile.stt_hints, before.stt_hints);
        assert_eq!(
            profile.vocabulary_hints[0].origin,
            VocabularyHintOrigin::Learned,
        );
        assert_eq!(
            profile.vocabulary_hints[0].learned_at_ms,
            Some(1_700_000_000_000),
        );
        assert_eq!(profile.vocabulary_hints[0].hit_count, 3);

        assert!(
            !profile.migrate_to_current_schema(),
            "a profile already at the current version must report nothing",
        );
    }

    /// **The provider axis migration, on the shape version 4 actually wrote.**
    /// A config holding one provider lands on the same resolved default with no
    /// override — the plain reading of ADR 0094's config half, and the case
    /// every profile on this machine is in.
    #[test]
    fn a_version_four_profile_lands_its_one_provider_on_the_axis() {
        let raw = r#"{
            "id": "general",
            "label": "General",
            "prompt": "",
            "vocabulary_hints": [],
            "schema_version": 4,
            "dictionary_entries": [],
            "snippet_entries": [],
            "speech": {
                "provider": "local",
                "model": "whisper-large-v3",
                "local_model": "base"
            }
        }"#;

        let mut profile: TextProfile = serde_json::from_str(raw).expect("profile parses");
        assert!(
            profile.providers.is_none(),
            "the axis does not exist on the stored shape",
        );

        assert!(profile.migrate_to_current_schema());

        assert_eq!(profile.schema_version, PROVIDER_AXIS_SCHEMA_VERSION);
        let axis = profile.resolved_providers();
        assert_eq!(
            axis.default, LOCAL_PROVIDER_ID,
            "the value the live pipeline was spending survives the lift",
        );
        assert!(
            axis.overrides.is_empty(),
            "nothing on disk expressed an override, so the migration invents none",
        );
        for job in JobKey::ALL {
            // The lift writes VENDOR ids; the connection lift one layer up
            // rewrites them into connection ids (ADR 0208). So what this
            // asserts is the sentence it always meant — every job follows the
            // profile's one answer — and the vendor behind that answer is the
            // connection axis's to resolve.
            let resolved = profile.job_provider(job, &[]);
            assert_eq!(resolved.connection, LOCAL_PROVIDER_ID);
            assert!(!resolved.overridden, "{} follows the connection", job.as_str());
        }

        // And the key it was read from leaves the file rather than lingering as
        // a second answer beside the axis.
        let written = serde_json::to_value(&profile).expect("profile serializes");
        assert!(
            written["speech"].get("provider").is_none(),
            "version 5 stops writing the field the migration consumed",
        );
    }

    /// A stored provider this build cannot resolve falls back to the default
    /// rather than to a rescue path — the licence ADR 0112 established and
    /// A4 inherited.
    #[test]
    fn a_version_four_provider_this_build_cannot_resolve_falls_back_to_the_default() {
        let mut profile = TextProfile {
            schema_version: 4,
            speech: Some(ProfileSpeechSettings {
                migrated_provider: Some("anthropic".to_string()),
                ..Default::default()
            }),
            ..TextProfile::default()
        };

        profile.migrate_to_current_schema();

        assert_eq!(profile.resolved_providers().default, DEFAULT_PROVIDER_ID);
    }

    /// The guard is on the axis's own version, not on the constant. A profile
    /// already carrying an axis keeps it, so a later version 6 cannot replace a
    /// user's connection with a default derived from a key nothing writes.
    #[test]
    fn the_lift_runs_once_and_never_over_an_axis_that_exists() {
        let mut profile = TextProfile {
            schema_version: 4,
            providers: Some(ProfileProviderSettings {
                default: LOCAL_PROVIDER_ID.to_string(),
                overrides: BTreeMap::from([(JobKey::Cleanup, DEFAULT_PROVIDER_ID.to_string())]),
            }),
            speech: Some(ProfileSpeechSettings {
                migrated_provider: Some(DEFAULT_PROVIDER_ID.to_string()),
                ..Default::default()
            }),
            ..TextProfile::default()
        };

        profile.migrate_to_current_schema();

        let axis = profile.resolved_providers();
        assert_eq!(axis.default, LOCAL_PROVIDER_ID);
        assert_eq!(
            axis.overrides.get(&JobKey::Cleanup).map(String::as_str),
            Some(DEFAULT_PROVIDER_ID),
            "the override the user set is not replaced by the lift",
        );
    }

    // ── The connection axis (ADR 0208) ──────────────────────────────────────

    /// **What the lift carries, and from where.** One connection per vendor a
    /// profile actually names, the plan ADR 0167 keyed by that vendor, and the
    /// endpoint ADR 0165 had to keep machine-wide — all landing on the object
    /// that owns the credential.
    #[test]
    fn the_lift_makes_one_connection_per_vendor_a_profile_names() {
        let mut config = AppConfig {
            migrated_provider_plans: Some(BTreeMap::from([(
                DEFAULT_PROVIDER_ID.to_string(),
                crate::core::providers::groq::GROQ_DEV_TIER_ID.to_string(),
            )])),
            migrated_self_hosted_base_url: Some("https://speech.example.internal/v1".to_string()),
            migrated_self_hosted_model: Some("ggml-large-v3-turbo".to_string()),
            ..AppConfig::default()
        };
        let self_hosted = crate::core::providers::self_hosted::SELF_HOSTED_PROVIDER_ID;
        set_profile_connection_id(&mut config, self_hosted);
        assert!(config.carries_an_unlifted_connection_axis());

        config.normalize_for_runtime();

        let connections = config.connections.clone().expect("the lift writes a list");
        assert_eq!(
            connections.iter().map(|c| c.provider.as_str()).collect::<Vec<_>>(),
            vec![DEFAULT_PROVIDER_ID, self_hosted],
            "the default vendor leads so the seeded id belongs to it, and the named vendor follows",
        );

        let seeded = &connections[0];
        assert_eq!(seeded.id, DEFAULT_CONNECTION_ID);
        assert_eq!(
            seeded.plan,
            crate::core::providers::groq::GROQ_DEV_TIER_ID,
            "the plan rides to the account that bought it (ADR 0167)",
        );

        let server = &connections[1];
        assert_eq!(server.base_url, "https://speech.example.internal/v1");
        assert_eq!(server.model, "ggml-large-v3-turbo");
        assert_eq!(server.label, "Your server", "a lifted account arrives named");

        // And the profile points at the object rather than at the vendor.
        let job = config.job_provider(JobKey::Dictation);
        assert_eq!(job.connection, server.id);
        assert_eq!(job.provider, self_hosted);

        // The three keys the lift consumed leave the file rather than lingering
        // as a second answer beside the list.
        let written = serde_json::to_value(&config).expect("config serializes");
        for key in ["provider_plans", "self_hosted_base_url", "self_hosted_model"] {
            assert!(
                written.get(key).is_none(),
                "this build stops writing {key}, which the connection now owns",
            );
        }
    }

    /// The guard is the list's presence. A reader who deleted every connection
    /// is left with none, rather than having them re-derived from the profiles
    /// that still point at them — D6's defect, two axes over.
    #[test]
    fn the_connection_lift_never_runs_over_a_list_that_exists() {
        let mut config = AppConfig {
            connections: Some(Vec::new()),
            ..AppConfig::default()
        };
        assert!(!config.carries_an_unlifted_connection_axis());

        config.normalize_for_runtime();

        assert!(
            config.connections.expect("the list is untouched").is_empty(),
            "an emptied list is a decision, not an unlifted config",
        );
    }

    /// **A fresh install gets exactly one account, not one per lane.** A lane
    /// with no credential and no endpoint is a row nobody asked for; the
    /// surface creates the second connection when somebody picks a second lane.
    #[test]
    fn a_fresh_install_is_seeded_with_one_connection() {
        let mut config = AppConfig::default();
        config.normalize_for_runtime();

        let connections = config.connections.expect("the lift writes a list");
        assert_eq!(connections.len(), 1);
        assert_eq!(connections[0].id, DEFAULT_CONNECTION_ID);
        assert_eq!(connections[0].provider, DEFAULT_PROVIDER_ID);
        assert!(
            connections[0].plan.is_empty(),
            "and it is on the vendor's own default plan, stored as absence (ADR 0167)",
        );
    }

    // ── The plan axis (ADR 0167) ────────────────────────────────────────────

    /// **The lift asks the registry, and Groq's plan lands on Groq alone.**
    /// This is the one case every machine carrying a paid plan is in.
    #[test]
    fn the_stored_plan_lands_on_the_vendors_that_declare_it() {
        let mut config = AppConfig {
            migrated_provider_tier: Some(crate::core::providers::groq::GROQ_DEV_TIER_ID.to_string()),
            migrated_provider_plans: None,
            ..AppConfig::default()
        };
        assert!(config.carries_an_unlifted_provider_plan());

        config.adopt_provider_plan_axis();

        let plans = config
            .migrated_provider_plans
            .clone()
            .expect("the lift writes a map");
        assert_eq!(
            plans.get(crate::core::providers::groq::GROQ_PROVIDER_ID).map(String::as_str),
            Some(crate::core::providers::groq::GROQ_DEV_TIER_ID),
            "the vendor whose tiers declare the id keeps it",
        );
        assert_eq!(
            plans.len(),
            1,
            "and no other vendor is handed a plan it never sold: {plans:?}",
        );
        assert!(
            config.migrated_provider_tier.is_none(),
            "the door is read once and closed",
        );

        // And the key it was read from leaves the file rather than lingering as
        // a second answer beside the map.
        let written = serde_json::to_value(&config).expect("config serializes");
        assert!(
            written.get("provider_tier").is_none(),
            "this build stops writing the field the migration consumed",
        );
    }

    /// A plan id no registered vendor declares lands nowhere, and every vendor
    /// keeps its own default. Not a rescue path: that is exactly what the old
    /// machine-wide field already resolved to at every reader.
    #[test]
    fn a_plan_no_vendor_declares_lands_nowhere() {
        let mut config = AppConfig {
            migrated_provider_tier: Some("enterprise-unlimited".to_string()),
            migrated_provider_plans: None,
            ..AppConfig::default()
        };

        config.adopt_provider_plan_axis();

        assert!(
            config
                .migrated_provider_plans
                .expect("the lift writes a map")
                .is_empty(),
            "an id nothing sells is dropped rather than guessed onto a vendor",
        );
    }

    /// **The default plan is stored as absence.** `free` is Groq's default, so
    /// a machine on it holds no entry at all — one spelling of the answer
    /// instead of two that can drift.
    #[test]
    fn a_default_plan_is_not_written_as_an_entry() {
        let mut config = AppConfig {
            migrated_provider_tier: Some(
                crate::core::providers::groq::GROQ_FREE_TIER_ID.to_string(),
            ),
            migrated_provider_plans: None,
            ..AppConfig::default()
        };

        config.adopt_provider_plan_axis();

        assert!(config
            .migrated_provider_plans
            .as_ref()
            .expect("the lift writes a map")
            .is_empty());
        assert_eq!(
            config.plan_for(DEFAULT_CONNECTION_ID),
            "",
            "and an empty answer is what every adapter reads as its own default",
        );
    }

    /// The guard is the map's presence, not a version counter. A machine that
    /// has already chosen lands on its choice, so a stale `provider_tier`
    /// written by an older build beside it cannot overwrite one. D6's defect,
    /// one axis over.
    #[test]
    fn the_plan_lift_never_runs_over_a_map_that_exists() {
        let mut config = AppConfig {
            migrated_provider_tier: Some(crate::core::providers::groq::GROQ_DEV_TIER_ID.to_string()),
            migrated_provider_plans: Some(BTreeMap::new()),
            ..AppConfig::default()
        };
        assert!(
            !config.carries_an_unlifted_provider_plan(),
            "a written map is not an unlifted plan, however old the key beside it",
        );

        config.adopt_provider_plan_axis();

        assert!(
            config
                .migrated_provider_plans
                .expect("the map is untouched")
                .is_empty(),
            "the user's own answer — on the free plan — survives the older key",
        );
    }

    /// An override survives a save and comes back as an override — the sparse
    /// map is a stored shape, not an in-memory convenience.
    #[test]
    fn an_override_round_trips_through_the_stored_shape() {
        let connections = two_test_connections();
        let profile = TextProfile {
            schema_version: TEXT_PROFILE_SCHEMA_VERSION,
            providers: Some(ProfileProviderSettings {
                default: DEFAULT_CONNECTION_ID.to_string(),
                overrides: BTreeMap::from([(
                    JobKey::Assistant,
                    "connection-local".to_string(),
                )]),
            }),
            ..TextProfile::default()
        };

        let raw = serde_json::to_string(&profile).expect("serializes");
        let back: TextProfile = serde_json::from_str(&raw).expect("parses");

        assert_eq!(
            back.job_provider(JobKey::Assistant, &connections).provider,
            LOCAL_PROVIDER_ID,
        );
        assert!(back.job_provider(JobKey::Assistant, &connections).overridden);
        assert!(!back.job_provider(JobKey::Cleanup, &connections).overridden);
    }

    /// Two accounts to resolve against: the seeded cloud one and a local lane.
    fn two_test_connections() -> Vec<Connection> {
        vec![
            Connection {
                id: DEFAULT_CONNECTION_ID.to_string(),
                label: "Groq".to_string(),
                provider: DEFAULT_PROVIDER_ID.to_string(),
                ..Connection::default()
            },
            Connection {
                id: "connection-local".to_string(),
                label: "On this machine".to_string(),
                provider: LOCAL_PROVIDER_ID.to_string(),
                ..Connection::default()
            },
        ]
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
        config.text_profiles = vec![default_text_profile()];
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
        config.hotkey = "ctrl+f9".to_string();
        config.pause_hotkey = "ctrl+f10".to_string();
        config.abort_hotkey = "ctrl+alt+escape".to_string();
        config.mode_picker_hotkey = "ctrl+alt+m".to_string();
        config.mode_auto_hotkey = "ctrl+f6".to_string();
        config.mode_verbatim_hotkey = "ctrl+f1".to_string();
        config.mode_cleanup_hotkey = "ctrl+f2".to_string();
        config.mode_rewrite_hotkey = "ctrl+f3".to_string();
        config.mode_agent_hotkey = "ctrl+f4".to_string();
        config.mode_prompt_enhance_hotkey = "ctrl+f5".to_string();
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
        // Raw `ctrl+alt+m` and canonical `Ctrl+Alt+M` must be treated as
        // the same shortcut.
        config.mode_auto_hotkey = "ctrl+alt+m".to_string();
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

    /// The mode lane is `Alt+1` through `Alt+7` in the order the Modes screen
    /// lists, Translate included. Translate shipped unbound once and no longer
    /// does; the two slots below it each moved one digit down to make room, so
    /// this asserts the whole order rather than only the slot that changed
    /// name.
    #[test]
    fn every_mode_ships_bound_in_the_lane_order() {
        let config = AppConfig::default();

        for (slot, expected) in [
            (&config.mode_auto_hotkey, "Alt+1"),
            (&config.mode_verbatim_hotkey, "Alt+2"),
            (&config.mode_cleanup_hotkey, "Alt+3"),
            (&config.mode_rewrite_hotkey, "Alt+4"),
            (&config.mode_translate_hotkey, "Alt+5"),
            (&config.mode_agent_hotkey, "Alt+6"),
            (&config.mode_prompt_enhance_hotkey, "Alt+7"),
        ] {
            assert_eq!(slot, expected);
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

