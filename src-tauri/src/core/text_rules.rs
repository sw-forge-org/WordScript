use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
};

use serde::{Deserialize, Serialize};

use super::{
    config::{BiasMode, DictionaryEntry, ManualBias, SnippetEntry, VocabularyHintEntry},
    profile_context::{profile_context_budget, ProfileContextBudget},
    transcription_hints::{
        analyze_transcription_bias_with_mode, BiasRequestContext, TranscriptionBiasPreview,
    },
    transform::NativeTransformConfig,
};

const TEXT_RULES_SCHEMA_VERSION: u32 = 1;
const DEFAULT_PREVIEW_TEXT: &str = "word script follow up note";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRulesDocument {
    pub schema_version: u32,
    pub prompt: String,
    #[serde(default)]
    pub stt_hints: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextRulesConflictResolution {
    MergeImportedWins,
    ReplaceCurrent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextRulesIssueSeverity {
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextRulesIssueCode {
    EmptyDictionaryPhrase,
    EmptyDictionaryReplacement,
    EmptySnippetLabel,
    EmptySnippetTrigger,
    EmptySnippetExpansion,
    DuplicateDictionaryPhrase,
    DuplicateSnippetTrigger,
    DictionarySnippetOverlap,
    DuplicateRuleId,
    IgnoredSttHint,
    SttHintLimitReached,
    NoUsableSttHints,
    ImportSchemaMismatch,
    ImportParseFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRulesIssue {
    pub severity: TextRulesIssueSeverity,
    pub code: TextRulesIssueCode,
    pub message: String,
    pub rule_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRulesPreview {
    pub input: String,
    pub output: String,
    pub applied_rules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRulesAnalysis {
    pub blocking: bool,
    pub issues: Vec<TextRulesIssue>,
    pub preview: TextRulesPreview,
    pub transcription_bias: TranscriptionBiasPreview,
    /// What the transform prompts do with the context field, including the
    /// lines that exceed the budget. The UI shows this instead of recomputing
    /// the rule, so the boundary it draws is the one the runtime applies.
    pub profile_context: ProfileContextBudget,
    /// Which vocabulary terms the deterministic repair layer can act on. The
    /// panel marks the rows that only reach the LLM stages, and restating
    /// `MIN_TERM_CHARS` in TypeScript would let the two drift apart.
    pub vocabulary_repair: VocabularyRepairCoverage,
    pub dictionary_count: usize,
    pub snippet_count: usize,
}

/// The split `core::vocabulary_repair` applies to a profile's term list.
///
/// `too_short` is not a defect to fix — the floor exists because a short term
/// has too many neighbours to rewrite safely (ADR 0033). It is reported so the
/// row can say which of its two effects it actually has.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VocabularyRepairCoverage {
    pub repairable: Vec<String>,
    pub too_short: Vec<String>,
    pub min_chars: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyzeTextRulesRequest {
    pub prompt: String,
    /// Legacy free-text hints. Only consulted when `vocabulary_hints` is empty
    /// — see `recognizer_phrases`.
    #[serde(default)]
    pub stt_hints: String,
    /// The per-entry recognizer opt-in that replaced the free-text field.
    #[serde(default)]
    pub vocabulary_hints: Vec<VocabularyHintEntry>,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
    pub sample_text: Option<String>,
    #[serde(default)]
    pub bias_mode: Option<String>,
    #[serde(default)]
    pub local_prompt_strength: Option<String>,
    #[serde(default)]
    pub local_prompt_carry: Option<bool>,
    #[serde(default)]
    pub manual_bias: Option<ManualBiasPayload>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ManualBiasPayload {
    #[serde(default)]
    pub cloud_include_profile_terms: bool,
    #[serde(default)]
    pub local_include_profile_terms: bool,
    #[serde(default)]
    pub stt_hints_override: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExportTextRulesRequest {
    pub path: String,
    pub prompt: String,
    #[serde(default)]
    pub stt_hints: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportTextRulesResponse {
    pub path: String,
    pub analysis: TextRulesAnalysis,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImportTextRulesRequest {
    pub path: String,
    pub current_prompt: Option<String>,
    #[serde(default)]
    pub current_stt_hints: Option<String>,
    pub current_dictionary_entries: Vec<DictionaryEntry>,
    pub current_snippet_entries: Vec<SnippetEntry>,
    pub sample_text: Option<String>,
    pub resolution: TextRulesConflictResolution,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportTextRulesResponse {
    pub document: TextRulesDocument,
    pub analysis: TextRulesAnalysis,
}

// ── Profile Health ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LengthBiasDirection {
    Inflating,
    Deflating,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ProfileHealthFlag {
    LengthBias {
        direction: LengthBiasDirection,
        entry_count: usize,
        hint: String,
    },
    FormConflict {
        hint: String,
    },
    CleanupInterference {
        hint: String,
    },
    BiasPolicyWeak {
        hint: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProfileHealthLevel {
    Green,
    Yellow,
    Red,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProfileHealthStatus {
    pub level: ProfileHealthLevel,
    pub flags: Vec<ProfileHealthFlag>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GetProfileHealthRequest {
    pub prompt: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    #[serde(default)]
    pub acknowledged_flags: Vec<String>,
    #[serde(default)]
    pub bias_mode: Option<String>,
    #[serde(default)]
    pub processing_mode: Option<String>,
    #[serde(default)]
    pub profile_id: Option<String>,
}

#[allow(dead_code)]
pub fn analyze_profile_health(
    prompt: &str,
    dictionary_entries: &[DictionaryEntry],
    acknowledged_flags: &[String],
) -> ProfileHealthStatus {
    analyze_profile_health_with_policy(
        prompt,
        dictionary_entries,
        acknowledged_flags,
        None,
        None,
    )
}

pub fn analyze_profile_health_with_policy(
    prompt: &str,
    dictionary_entries: &[DictionaryEntry],
    acknowledged_flags: &[String],
    bias_mode: Option<&str>,
    processing_mode: Option<&str>,
) -> ProfileHealthStatus {
    let mut flags = Vec::new();

    if let Some(flag) = detect_length_bias(dictionary_entries) {
        flags.push(flag);
    }
    if let Some(flag) = detect_form_conflict(prompt) {
        flags.push(flag);
    }
    if let Some(flag) = detect_cleanup_interference(prompt) {
        flags.push(flag);
    }
    if let Some(flag) = detect_bias_policy_weak(bias_mode, processing_mode) {
        flags.push(flag);
    }

    let acked: std::collections::HashSet<&str> =
        acknowledged_flags.iter().map(String::as_str).collect();
    let level = derive_health_level(&flags, &acked);

    ProfileHealthStatus { level, flags }
}

fn derive_health_level(
    flags: &[ProfileHealthFlag],
    acknowledged: &std::collections::HashSet<&str>,
) -> ProfileHealthLevel {
    let has_unacked_red = flags
        .iter()
        .any(|f| !acknowledged.contains(flag_kind(f)) && is_red_flag(f));

    if has_unacked_red {
        return ProfileHealthLevel::Red;
    }

    let has_any_unacked = flags.iter().any(|f| !acknowledged.contains(flag_kind(f)));

    if has_any_unacked {
        ProfileHealthLevel::Yellow
    } else {
        ProfileHealthLevel::Green
    }
}

fn flag_kind(flag: &ProfileHealthFlag) -> &'static str {
    match flag {
        ProfileHealthFlag::LengthBias { .. } => "length_bias",
        ProfileHealthFlag::FormConflict { .. } => "form_conflict",
        ProfileHealthFlag::CleanupInterference { .. } => "cleanup_interference",
        ProfileHealthFlag::BiasPolicyWeak { .. } => "bias_policy_weak",
    }
}

fn is_red_flag(flag: &ProfileHealthFlag) -> bool {
    matches!(
        flag,
        ProfileHealthFlag::FormConflict { .. } | ProfileHealthFlag::BiasPolicyWeak { .. }
    )
}

fn detect_bias_policy_weak(
    bias_mode: Option<&str>,
    processing_mode: Option<&str>,
) -> Option<ProfileHealthFlag> {
    // BiasPolicyWeak fires only when bias_mode == Off AND the active processing
    // mode amplifies the lack of STT bias (agent, prompt_enhance). Cleanup /
    // Rewrite / Verbatim do not need STT bias, so Off is fine for them.
    let is_off = bias_mode
        .map(|mode| mode.eq_ignore_ascii_case("off"))
        .unwrap_or(false);
    if !is_off {
        return None;
    }

    let mode_amplifies_bias = matches!(
        processing_mode.map(|m| m.to_ascii_lowercase()).as_deref(),
        Some("agent") | Some("prompt_enhance")
    );

    if mode_amplifies_bias {
        return Some(ProfileHealthFlag::BiasPolicyWeak {
            hint: "Bias Mode is Off but the active Processing Mode (agent / prompt_enhance) depends on STT vocabulary. Re-enable Conservative or Manual bias to keep STT quality stable.".to_string(),
        });
    }

    None
}

fn detect_length_bias(entries: &[DictionaryEntry]) -> Option<ProfileHealthFlag> {
    let qualified: Vec<_> = entries
        .iter()
        .filter(|e| !e.phrase.trim().is_empty() && !e.replace_with.trim().is_empty())
        .collect();

    if qualified.len() < 3 {
        return None;
    }

    let total = qualified.len();
    let threshold = ((total as f64) * 0.6).ceil() as usize;

    let inflating = qualified
        .iter()
        .filter(|e| {
            let phrase_len = e.phrase.trim().len() as f64;
            let replace_len = e.replace_with.trim().len() as f64;
            replace_len >= phrase_len * 2.0
        })
        .count();

    if inflating >= threshold {
        return Some(ProfileHealthFlag::LengthBias {
            direction: LengthBiasDirection::Inflating,
            entry_count: inflating,
            hint: format!(
                "{inflating} of {total} dictionary entries expand text to 2× or more. \
                AI-Cleanup will see consistently longer raw text than you dictated."
            ),
        });
    }

    let deflating = qualified
        .iter()
        .filter(|e| {
            let phrase_len = e.phrase.trim().len() as f64;
            let replace_len = e.replace_with.trim().len() as f64;
            phrase_len > 0.0 && replace_len <= phrase_len * 0.4
        })
        .count();

    if deflating >= threshold {
        return Some(ProfileHealthFlag::LengthBias {
            direction: LengthBiasDirection::Deflating,
            entry_count: deflating,
            hint: format!(
                "{deflating} of {total} dictionary entries shrink text to less than half the original length. \
                AI-Cleanup will see consistently shorter raw text than you dictated."
            ),
        });
    }

    None
}

fn detect_form_conflict(prompt: &str) -> Option<ProfileHealthFlag> {
    let lower = prompt.to_lowercase();

    const CONFLICTING_PAIRS: &[(&str, &[&str])] = &[
        ("formal", &["casual", "informal", "relaxed", "conversational"]),
        ("professional", &["casual", "informal", "relaxed"]),
        ("concise", &["detailed", "comprehensive", "verbose", "elaborate", "thorough"]),
        ("brief", &["detailed", "comprehensive", "verbose", "elaborate", "thorough", "long"]),
        ("short", &["detailed", "comprehensive", "verbose", "long", "elaborate"]),
        ("bullet", &["paragraph", "prose", "narrative", "flowing"]),
    ];

    let mut found = Vec::new();
    for (term_a, terms_b) in CONFLICTING_PAIRS {
        if lower.contains(term_a) {
            for term_b in *terms_b {
                if lower.contains(term_b) {
                    found.push(format!("\"{term_a}\" vs \"{term_b}\""));
                    break;
                }
            }
        }
    }

    if found.is_empty() {
        return None;
    }

    Some(ProfileHealthFlag::FormConflict {
        hint: format!(
            "Contradictory style instructions detected: {}. \
            The AI-Cleanup model receives conflicting signals and will produce inconsistent output.",
            found.join(", ")
        ),
    })
}

fn detect_cleanup_interference(prompt: &str) -> Option<ProfileHealthFlag> {
    let lower = prompt.to_lowercase();

    const PATTERNS: &[(&str, &str)] = &[
        ("do not change", "\"Do not change\" instructions prevent AI-Cleanup from improving the text."),
        ("don't change", "\"Don't change\" instructions prevent AI-Cleanup from improving the text."),
        ("keep as is", "\"Keep as is\" instructions prevent AI-Cleanup from making corrections."),
        ("keep exactly", "\"Keep exactly\" instructions conflict with AI-Cleanup's rewrite pass."),
        ("verbatim", "\"Verbatim\" instructions conflict with AI-Cleanup. Use Verbatim work mode instead."),
        ("word for word", "\"Word for word\" conflicts with AI-Cleanup. Use Verbatim work mode instead."),
        ("word-for-word", "\"Word-for-word\" conflicts with AI-Cleanup. Use Verbatim work mode instead."),
        ("answer any question", "Instructions to answer questions conflict with the AI-Cleanup guardrail."),
        ("respond to question", "Instructions to respond to questions conflict with the AI-Cleanup guardrail."),
        ("act as ", "\"Act as\" persona instructions cause AI-Cleanup to behave inconsistently."),
    ];

    for (pattern, hint) in PATTERNS {
        if lower.contains(pattern) {
            return Some(ProfileHealthFlag::CleanupInterference {
                hint: (*hint).to_string(),
            });
        }
    }

    None
}

#[tauri::command]
pub fn get_profile_health(request: GetProfileHealthRequest) -> Result<ProfileHealthStatus, String> {
    let mut combined = request.acknowledged_flags.clone();
    if let Some(profile_id) = request.profile_id.as_deref() {
        let persisted = super::config::AppConfig::load_from_disk();
        if let Some(persisted_flags) = persisted.profile_health_acknowledged_flags.get(profile_id) {
            for flag in persisted_flags {
                if !combined.iter().any(|existing| existing == flag) {
                    combined.push(flag.clone());
                }
            }
        }
    }
    Ok(analyze_profile_health_with_policy(
        &request.prompt,
        &request.dictionary_entries,
        &combined,
        request.bias_mode.as_deref(),
        request.processing_mode.as_deref(),
    ))
}

// ── Text Rules Analysis ───────────────────────────────────────────────────────

#[tauri::command]
pub fn analyze_text_rules(request: AnalyzeTextRulesRequest) -> Result<TextRulesAnalysis, String> {
    let bias_context = bias_context_from_request(&request);
    let recognizer_phrases = recognizer_phrases(&request);
    // Every term, not the opted-in subset: repair and the LLM term block do not
    // consult the recognizer switch.
    let vocabulary: Vec<String> = request
        .vocabulary_hints
        .iter()
        .map(|entry| entry.phrase.trim().to_string())
        .filter(|phrase| !phrase.is_empty())
        .collect();
    let document = TextRulesDocument {
        schema_version: TEXT_RULES_SCHEMA_VERSION,
        prompt: request.prompt,
        // The recognizer sees only the entries the user opted in, so the preview
        // has to derive its phrases the way the capture path does
        // (`NativeCaptureConfig::from_app_config`). Reading the legacy
        // `stt_hints` field here is what made the panel promise an initial
        // prompt the provider never received — the field survives migration but
        // no longer feeds the recognizer.
        stt_hints: recognizer_phrases,
        dictionary_entries: request.dictionary_entries,
        snippet_entries: request.snippet_entries,
    };
    Ok(analyze_document_with_vocabulary(
        &document,
        request.sample_text.as_deref(),
        &bias_context,
        &vocabulary,
    ))
}

/// The phrases the recognizer would actually receive for this request.
///
/// `vocabulary_hints` is the authority (ADR 0017), and which of them reach the
/// initial prompt is the runtime's decision rather than a per-entry switch
/// (ADR 0035). The selection is asked for rather than reproduced: a preview
/// that recomputes the rule is a preview that eventually promises an initial
/// prompt the provider never received.
///
/// The legacy `stt_hints` string is only honoured when the caller sent no
/// vocabulary block at all, which is the import path — an imported document
/// predates the per-entry model and has nowhere else to carry its phrases.
fn recognizer_phrases(request: &AnalyzeTextRulesRequest) -> String {
    if request.vocabulary_hints.is_empty() {
        return request.stt_hints.clone();
    }

    super::config::select_recognizer_slots(&request.vocabulary_hints).join("\n")
}

fn bias_context_from_request(
    request: &AnalyzeTextRulesRequest,
) -> super::transcription_hints::BiasRequestContext {
    let bias_mode = match request.bias_mode.as_deref() {
        Some("off") => BiasMode::Off,
        Some("manual") => BiasMode::Manual,
        _ => BiasMode::Conservative,
    };
    let manual_bias = request
        .manual_bias
        .clone()
        .map(|m| super::config::ManualBias {
            cloud_include_profile_terms: m.cloud_include_profile_terms,
            local_include_profile_terms: m.local_include_profile_terms,
            stt_hints_override: m.stt_hints_override,
        })
        .unwrap_or_default();
    let local_prompt_strength = request
        .local_prompt_strength
        .clone()
        .unwrap_or_else(|| "profile".to_string());
    let local_prompt_carry = request.local_prompt_carry.unwrap_or(false);

    super::transcription_hints::BiasRequestContext {
        bias_mode,
        manual_bias,
        local_prompt_strength,
        local_prompt_carry,
    }
}

#[tauri::command]
pub fn export_text_rules(
    request: ExportTextRulesRequest,
) -> Result<ExportTextRulesResponse, String> {
    let document = TextRulesDocument {
        schema_version: TEXT_RULES_SCHEMA_VERSION,
        prompt: request.prompt,
        stt_hints: request.stt_hints,
        dictionary_entries: request.dictionary_entries,
        snippet_entries: request.snippet_entries,
    };
    let analysis = analyze_document(&document, None);
    let raw = serde_json::to_string_pretty(&document)
        .map_err(|error| format!("Could not serialize text rules export: {error}"))?;
    std::fs::write(export_path(&request.path)?, raw)
        .map_err(|error| format!("Could not write text rules export: {error}"))?;

    Ok(ExportTextRulesResponse {
        path: request.path,
        analysis,
    })
}

#[tauri::command]
pub fn import_text_rules(
    request: ImportTextRulesRequest,
) -> Result<ImportTextRulesResponse, String> {
    let raw = std::fs::read_to_string(import_path(&request.path)?)
        .map_err(|error| format!("Could not read text rules import: {error}"))?;
    let imported = parse_document(&raw)?;
    let merged = match request.resolution {
        TextRulesConflictResolution::ReplaceCurrent => imported,
        TextRulesConflictResolution::MergeImportedWins => merge_documents(
            TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: request.current_prompt.unwrap_or_default(),
                stt_hints: request.current_stt_hints.unwrap_or_default(),
                dictionary_entries: request.current_dictionary_entries,
                snippet_entries: request.current_snippet_entries,
            },
            imported,
        ),
    };
    let analysis = analyze_document(&merged, request.sample_text.as_deref());

    Ok(ImportTextRulesResponse {
        document: merged,
        analysis,
    })
}

pub fn analyze_document(
    document: &TextRulesDocument,
    sample_text: Option<&str>,
) -> TextRulesAnalysis {
    let context = bias_context_for_document(document);
    analyze_document_with_context(document, sample_text, &context)
}

/// Analysis for a document that carries no vocabulary of its own.
///
/// The import and export paths land here: an exported document predates the
/// per-entry vocabulary block and has nowhere to carry terms, so the preview
/// they show is honestly term-free.
pub fn analyze_document_with_context(
    document: &TextRulesDocument,
    sample_text: Option<&str>,
    bias_context: &super::transcription_hints::BiasRequestContext,
) -> TextRulesAnalysis {
    analyze_document_with_vocabulary(document, sample_text, bias_context, &[])
}

/// The full analysis, including what the vocabulary layer does.
///
/// `vocabulary` is every term in the profile, not the recognizer-opted subset:
/// deterministic repair and the LLM term block are unconditional, and only the
/// recognizer hint is opt-in (ADR 0033).
pub fn analyze_document_with_vocabulary(
    document: &TextRulesDocument,
    sample_text: Option<&str>,
    bias_context: &super::transcription_hints::BiasRequestContext,
    vocabulary: &[String],
) -> TextRulesAnalysis {
    let mut issues = Vec::new();
    let mut seen_ids = BTreeMap::<String, Vec<String>>::new();
    let mut seen_dictionary = BTreeMap::<String, Vec<String>>::new();
    let mut seen_snippets = BTreeMap::<String, Vec<String>>::new();
    let mut dictionary_keys = BTreeSet::new();

    for entry in &document.dictionary_entries {
        let key = normalized_key(&entry.phrase);
        push_duplicate_id(&mut seen_ids, &entry.id);
        if key.is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Error,
                TextRulesIssueCode::EmptyDictionaryPhrase,
                "Dictionary entries need a non-empty 'Heard as' phrase.",
                vec![entry.id.clone()],
            ));
        } else {
            dictionary_keys.insert(key.clone());
            seen_dictionary
                .entry(key)
                .or_default()
                .push(entry.id.clone());
        }
        if entry.replace_with.trim().is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Error,
                TextRulesIssueCode::EmptyDictionaryReplacement,
                "Dictionary entries need a non-empty replacement.",
                vec![entry.id.clone()],
            ));
        }
    }

    for entry in &document.snippet_entries {
        let key = normalized_key(&entry.trigger);
        push_duplicate_id(&mut seen_ids, &entry.id);
        if entry.label.trim().is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Warning,
                TextRulesIssueCode::EmptySnippetLabel,
                "Snippet labels should be filled so import previews and conflict lists stay readable.",
                vec![entry.id.clone()],
            ));
        }
        if key.is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Error,
                TextRulesIssueCode::EmptySnippetTrigger,
                "Snippets need a non-empty trigger phrase.",
                vec![entry.id.clone()],
            ));
        } else {
            if dictionary_keys.contains(&key) {
                issues.push(issue(
                    TextRulesIssueSeverity::Warning,
                    TextRulesIssueCode::DictionarySnippetOverlap,
                    format!(
                        "Dictionary and snippet share the same spoken key '{}'. Dictionary replacements run before snippets.",
                        entry.trigger.trim()
                    ),
                    vec![entry.id.clone()],
                ));
            }
            seen_snippets.entry(key).or_default().push(entry.id.clone());
        }
        if entry.expansion.trim().is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Error,
                TextRulesIssueCode::EmptySnippetExpansion,
                "Snippets need a non-empty expansion.",
                vec![entry.id.clone()],
            ));
        }
    }

    issues.extend(duplicate_issues(
        seen_ids,
        TextRulesIssueSeverity::Warning,
        TextRulesIssueCode::DuplicateRuleId,
        "Two or more text rules share the same id. Imported rules will still work, but stable ids make diffs and future team sync safer.",
    ));
    issues.extend(duplicate_issues(
        seen_dictionary,
        TextRulesIssueSeverity::Warning,
        TextRulesIssueCode::DuplicateDictionaryPhrase,
        "Two or more dictionary entries share the same spoken phrase. Later entries win because rules run top-to-bottom.",
    ));
    issues.extend(duplicate_issues(
        seen_snippets,
        TextRulesIssueSeverity::Warning,
        TextRulesIssueCode::DuplicateSnippetTrigger,
        "Two or more snippets share the same trigger phrase. Later entries win because rules run top-to-bottom.",
    ));

    let sample_text = sample_text
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_PREVIEW_TEXT);
    let (output, applied_rules) = preview_transform(document, sample_text, vocabulary);
    let transcription_bias = analyze_transcription_bias_with_mode(
        &document.stt_hints,
        &document.dictionary_entries,
        bias_context,
    );
    issues.extend(bias_warning_issues(document, &transcription_bias));

    TextRulesAnalysis {
        blocking: issues
            .iter()
            .any(|issue| matches!(issue.severity, TextRulesIssueSeverity::Error)),
        issues,
        preview: TextRulesPreview {
            input: sample_text.to_string(),
            output,
            applied_rules,
        },
        transcription_bias,
        profile_context: profile_context_budget(&document.prompt),
        vocabulary_repair: vocabulary_repair_coverage(vocabulary),
        dictionary_count: document.dictionary_entries.len(),
        snippet_count: document.snippet_entries.len(),
    }
}

fn _unused_transcription_bias_for_document(
    document: &TextRulesDocument,
) -> TranscriptionBiasPreview {
    let context = bias_context_for_document(document);
    analyze_transcription_bias_with_mode(
        &document.stt_hints,
        &document.dictionary_entries,
        &context,
    )
}

fn bias_context_for_document(_document: &TextRulesDocument) -> BiasRequestContext {
    // The TextRulesDocument is the in-memory profile-less document shape; the
    // runtime request path passes a richer context. For the analysis view we
    // fall back to Conservative with global defaults so the preview matches
    // what the production cloud path actually sends to Whisper.
    BiasRequestContext {
        bias_mode: BiasMode::Conservative,
        manual_bias: ManualBias::default(),
        local_prompt_strength: "profile".to_string(),
        local_prompt_carry: false,
    }
}

#[allow(dead_code)]
fn transcription_bias_for_document(
    document: &TextRulesDocument,
) -> TranscriptionBiasPreview {
    let context = bias_context_for_document(document);
    analyze_transcription_bias_with_mode(
        &document.stt_hints,
        &document.dictionary_entries,
        &context,
    )
}

fn bias_warning_issues(
    document: &TextRulesDocument,
    bias: &TranscriptionBiasPreview,
) -> Vec<TextRulesIssue> {
    let mut issues = Vec::new();

    // The profile's context field is deliberately not judged here. It holds
    // topics for the transform prompt, and the recognizer never reads it
    // (ADR 0032), so there is no such thing as a context line that is "too
    // broad" for a path it does not travel.
    let stt_hint_line_count = document
        .stt_hints
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .count();

    if !bias.ignored_stt_hint_lines.is_empty() {
        issues.push(issue(
            TextRulesIssueSeverity::Warning,
            TextRulesIssueCode::IgnoredSttHint,
            format!(
                "{} STT hint line(s) are too long for the conservative bias path and will be ignored. Keep STT hints short and phrase-like.",
                bias.ignored_stt_hint_lines.len()
            ),
            Vec::new(),
        ));
    }

    if !bias.over_limit_stt_hint_lines.is_empty() {
        issues.push(issue(
            TextRulesIssueSeverity::Warning,
            TextRulesIssueCode::SttHintLimitReached,
            format!(
                "{} word(s) are switched on for the recognizer beyond the {} it can take, so they are not sent. Switch some off to choose which ones travel; they still reach every AI mode either way.",
                bias.over_limit_stt_hint_lines.len(),
                bias.stt_hints.len(),
            ),
            Vec::new(),
        ));
    }

    if stt_hint_line_count > 0 && bias.stt_hints.is_empty() {
        issues.push(issue(
            TextRulesIssueSeverity::Warning,
            TextRulesIssueCode::NoUsableSttHints,
            "None of the current STT hints qualify for the automatic bias path. Keep them to a few short spoken cues instead of full sentences or macros.".to_string(),
            Vec::new(),
        ));
    }

    issues
}

fn parse_document(raw: &str) -> Result<TextRulesDocument, String> {
    let value = serde_json::from_str::<serde_json::Value>(raw)
        .map_err(|error| format!("Could not parse text rules JSON: {error}"))?;
    let schema_version = value
        .get("schema_version")
        .and_then(|value| value.as_u64())
        .unwrap_or(u64::from(TEXT_RULES_SCHEMA_VERSION)) as u32;
    if schema_version != TEXT_RULES_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported text rules schema version {schema_version}. Expected {TEXT_RULES_SCHEMA_VERSION}."
        ));
    }
    serde_json::from_value::<TextRulesDocument>(value)
        .map_err(|error| format!("Could not decode text rules document: {error}"))
}

fn merge_documents(current: TextRulesDocument, imported: TextRulesDocument) -> TextRulesDocument {
    TextRulesDocument {
        schema_version: TEXT_RULES_SCHEMA_VERSION,
        prompt: if current.prompt.trim().is_empty() {
            imported.prompt
        } else {
            current.prompt
        },
        stt_hints: if current.stt_hints.trim().is_empty() {
            imported.stt_hints
        } else {
            current.stt_hints
        },
        dictionary_entries: merge_dictionary_entries(
            current.dictionary_entries,
            imported.dictionary_entries,
        ),
        snippet_entries: merge_snippet_entries(current.snippet_entries, imported.snippet_entries),
    }
}

fn merge_dictionary_entries(
    current: Vec<DictionaryEntry>,
    imported: Vec<DictionaryEntry>,
) -> Vec<DictionaryEntry> {
    let mut merged = BTreeMap::<String, DictionaryEntry>::new();
    let mut order = Vec::<String>::new();

    for entry in current {
        let key = normalized_key(&entry.phrase);
        if key.is_empty() {
            order.push(format!("current:{}", entry.id));
            merged.insert(format!("current:{}", entry.id), entry);
        } else {
            order.push(key.clone());
            merged.insert(key, entry);
        }
    }
    for entry in imported {
        let key = normalized_key(&entry.phrase);
        if key.is_empty() {
            let synthetic = format!("imported:{}", entry.id);
            order.push(synthetic.clone());
            merged.insert(synthetic, entry);
        } else {
            if !order.contains(&key) {
                order.push(key.clone());
            }
            merged.insert(key, entry);
        }
    }

    order
        .into_iter()
        .filter_map(|key| merged.remove(&key))
        .collect()
}

fn merge_snippet_entries(
    current: Vec<SnippetEntry>,
    imported: Vec<SnippetEntry>,
) -> Vec<SnippetEntry> {
    let mut merged = BTreeMap::<String, SnippetEntry>::new();
    let mut order = Vec::<String>::new();

    for entry in current {
        let key = normalized_key(&entry.trigger);
        if key.is_empty() {
            let synthetic = format!("current:{}", entry.id);
            order.push(synthetic.clone());
            merged.insert(synthetic, entry);
        } else {
            order.push(key.clone());
            merged.insert(key, entry);
        }
    }
    for entry in imported {
        let key = normalized_key(&entry.trigger);
        if key.is_empty() {
            let synthetic = format!("imported:{}", entry.id);
            order.push(synthetic.clone());
            merged.insert(synthetic, entry);
        } else {
            if !order.contains(&key) {
                order.push(key.clone());
            }
            merged.insert(key, entry);
        }
    }

    order
        .into_iter()
        .filter_map(|key| merged.remove(&key))
        .collect()
}

/// Splits a term list by whether the deterministic layer can act on it.
///
/// Blank entries are neither, so a half-typed row does not immediately accuse
/// itself of being too short.
fn vocabulary_repair_coverage(vocabulary: &[String]) -> VocabularyRepairCoverage {
    let mut repairable = Vec::new();
    let mut too_short = Vec::new();

    for term in vocabulary {
        let term = term.trim();
        if term.is_empty() {
            continue;
        }
        if super::vocabulary_repair::is_repairable_term(term) {
            repairable.push(term.to_string());
        } else {
            too_short.push(term.to_string());
        }
    }

    VocabularyRepairCoverage {
        repairable,
        too_short,
        min_chars: super::vocabulary_repair::min_repairable_chars(),
    }
}

fn preview_transform(
    document: &TextRulesDocument,
    sample_text: &str,
    vocabulary: &[String],
) -> (String, Vec<String>) {
    let config = NativeTransformConfig {
        provider: "groq".to_string(),
        profile_prompt: String::new(),
        // Repair runs ahead of the explicit rules in the real transform, so a
        // preview without it would show a pipeline the runtime does not have.
        vocabulary: vocabulary.to_vec(),
        dictionary_entries: document.dictionary_entries.clone(),
        snippet_entries: document.snippet_entries.clone(),
        post_process: false,
        correction_model: "llama-3.1-8b-instant".to_string(),
        filter_fillers: true,
        professionalize: false,
        ..Default::default()
    };
    let (output, applied_rules) = super::transform::preview_text_rules_only(sample_text, &config);
    (output, applied_rules)
}

fn duplicate_issues(
    groups: BTreeMap<String, Vec<String>>,
    severity: TextRulesIssueSeverity,
    code: TextRulesIssueCode,
    message: &str,
) -> Vec<TextRulesIssue> {
    groups
        .into_values()
        .filter(|ids| ids.len() > 1)
        .map(|rule_ids| {
            issue(
                severity.clone(),
                code.clone(),
                message.to_string(),
                rule_ids,
            )
        })
        .collect()
}

fn push_duplicate_id(seen_ids: &mut BTreeMap<String, Vec<String>>, id: &str) {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return;
    }
    seen_ids
        .entry(trimmed.to_string())
        .or_default()
        .push(trimmed.to_string());
}

fn issue(
    severity: TextRulesIssueSeverity,
    code: TextRulesIssueCode,
    message: impl Into<String>,
    rule_ids: Vec<String>,
) -> TextRulesIssue {
    TextRulesIssue {
        severity,
        code,
        message: message.into(),
        rule_ids,
    }
}

fn normalized_key(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_lowercase()
}

fn export_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Export path must not be empty.".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

fn import_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Import path must not be empty.".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vocabulary_request(
        stt_hints: &str,
        hints: Vec<(&str, bool)>,
    ) -> AnalyzeTextRulesRequest {
        // The bool is the migrated `use_as_prompt_hint`. Nothing reads it any
        // more (ADR 0035); it stays in the fixture so a test can assert that.
        AnalyzeTextRulesRequest {
            prompt: String::new(),
            stt_hints: stt_hints.to_string(),
            vocabulary_hints: hints
                .into_iter()
                .enumerate()
                .map(|(index, (phrase, opted_in))| VocabularyHintEntry {
                    id: format!("vocab-{index}"),
                    phrase: phrase.to_string(),
                    use_as_prompt_hint: opted_in,
                    ..VocabularyHintEntry::default()
                })
                .collect(),
            dictionary_entries: Vec::new(),
            snippet_entries: Vec::new(),
            sample_text: None,
            bias_mode: Some("conservative".to_string()),
            local_prompt_strength: None,
            local_prompt_carry: None,
            manual_bias: None,
        }
    }

    /// The regression this guards: the panel showed the legacy `stt_hints`
    /// lines as the recognizer prompt while the capture path sent something
    /// else entirely, so the preview described a pipeline the runtime does not
    /// have.
    #[test]
    fn the_recognizer_preview_never_falls_back_to_the_legacy_field() {
        let analysis = analyze_text_rules(vocabulary_request(
            "triage summary\nrelease note",
            vec![("Kubernetes", false), ("Grafana", false)],
        ))
        .expect("analysis");

        let cloud = analysis
            .transcription_bias
            .cloud_prompt_preview
            .unwrap_or_default();
        assert!(
            !cloud.contains("triage summary"),
            "legacy field must not leak: {cloud}"
        );
        assert_eq!(
            analysis.transcription_bias.stt_hints,
            vec!["Kubernetes", "Grafana"],
            "the preview shows what the runtime allocated"
        );
    }

    /// The rule intuition gets backwards, asserted end to end through the
    /// preview: a short term cannot be recovered once the transcript exists, so
    /// it takes the slot ahead of the long one that repair restores anyway
    /// (ADR 0035).
    #[test]
    fn the_recognizer_slots_go_to_the_terms_repair_cannot_reach() {
        let long_terms: Vec<(&str, bool)> = vec![
            ("Kubernetes", true),
            ("Statuspage", true),
            ("PostgreSQL", true),
            ("Prometheus", true),
            ("Tauri", false),
        ];
        let analysis = analyze_text_rules(vocabulary_request("", long_terms)).expect("analysis");

        assert_eq!(
            analysis.transcription_bias.stt_hints.first().map(String::as_str),
            Some("Tauri"),
            "the unrecoverable term must lead: {:?}",
            analysis.transcription_bias.stt_hints
        );
        let cloud = analysis
            .transcription_bias
            .cloud_prompt_preview
            .unwrap_or_default();
        assert!(cloud.contains("Tauri"), "{cloud}");
    }

    /// The old per-entry switch is a migration remnant. A profile that had it
    /// on must get exactly the prompt a profile that had it off gets.
    #[test]
    fn the_migrated_opt_in_no_longer_changes_the_recognizer_preview() {
        let opted_in = analyze_text_rules(vocabulary_request(
            "",
            vec![("Kubernetes", true), ("Tauri", true)],
        ))
        .expect("analysis");
        let opted_out = analyze_text_rules(vocabulary_request(
            "",
            vec![("Kubernetes", false), ("Tauri", false)],
        ))
        .expect("analysis");

        assert_eq!(
            opted_in.transcription_bias.stt_hints,
            opted_out.transcription_bias.stt_hints
        );
    }

    /// An imported document predates the per-entry opt-in and carries its
    /// phrases nowhere else, so the legacy field still applies there.
    #[test]
    fn an_import_without_vocabulary_entries_still_uses_the_legacy_field() {
        let analysis = analyze_text_rules(vocabulary_request("imported phrase", Vec::new()))
            .expect("analysis");

        assert_eq!(analysis.transcription_bias.stt_hints, vec!["imported phrase"]);
    }

    #[test]
    fn flags_empty_entries_and_duplicates() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: String::new(),
                stt_hints: String::new(),
                dictionary_entries: vec![
                    DictionaryEntry {
                        id: "dict-1".to_string(),
                        phrase: "".to_string(),
                        replace_with: "WordScript".to_string(),
                    },
                    DictionaryEntry {
                        id: "dict-2".to_string(),
                        phrase: "word script".to_string(),
                        replace_with: "WordScript".to_string(),
                    },
                    DictionaryEntry {
                        id: "dict-3".to_string(),
                        phrase: "word   script".to_string(),
                        replace_with: "WordScript".to_string(),
                    },
                ],
                snippet_entries: vec![SnippetEntry {
                    id: "snippet-1".to_string(),
                    label: "".to_string(),
                    trigger: "follow up note".to_string(),
                    expansion: "Thanks".to_string(),
                }],
            },
            None,
        );

        assert!(analysis.blocking);
        assert!(analysis
            .issues
            .iter()
            .any(|issue| matches!(issue.code, TextRulesIssueCode::EmptyDictionaryPhrase)));
        assert!(analysis
            .issues
            .iter()
            .any(|issue| matches!(issue.code, TextRulesIssueCode::DuplicateDictionaryPhrase)));
        assert!(analysis
            .issues
            .iter()
            .any(|issue| matches!(issue.code, TextRulesIssueCode::EmptySnippetLabel)));
    }

    #[test]
    fn merge_imported_rules_replace_matching_keys() {
        let merged = merge_documents(
            TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "current prompt".to_string(),
                stt_hints: "current hint".to_string(),
                dictionary_entries: vec![DictionaryEntry {
                    id: "dict-current".to_string(),
                    phrase: "word script".to_string(),
                    replace_with: "Current".to_string(),
                }],
                snippet_entries: vec![SnippetEntry {
                    id: "snippet-current".to_string(),
                    label: "Current".to_string(),
                    trigger: "follow up note".to_string(),
                    expansion: "Current expansion".to_string(),
                }],
            },
            TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "imported prompt".to_string(),
                stt_hints: "imported hint".to_string(),
                dictionary_entries: vec![DictionaryEntry {
                    id: "dict-imported".to_string(),
                    phrase: "word script".to_string(),
                    replace_with: "Imported".to_string(),
                }],
                snippet_entries: vec![SnippetEntry {
                    id: "snippet-imported".to_string(),
                    label: "Imported".to_string(),
                    trigger: "follow up note".to_string(),
                    expansion: "Imported expansion".to_string(),
                }],
            },
        );

        assert_eq!(merged.prompt, "current prompt");
        assert_eq!(merged.stt_hints, "current hint");
        assert_eq!(merged.dictionary_entries.len(), 1);
        assert_eq!(merged.dictionary_entries[0].replace_with, "Imported");
        assert_eq!(merged.snippet_entries.len(), 1);
        assert_eq!(merged.snippet_entries[0].expansion, "Imported expansion");
    }

    #[test]
    fn analysis_surfaces_effective_bias_and_ignored_lines() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "customer names\nWordScript\nSEV-1\nrefund policy".to_string(),
                stt_hints: "status update\nthis hint is too long to stay in the automatic bias path".to_string(),
                dictionary_entries: vec![DictionaryEntry {
                    id: "dict-1".to_string(),
                    phrase: "sev one".to_string(),
                    replace_with: "SEV-1".to_string(),
                }],
                snippet_entries: Vec::new(),
            },
            None,
        );

        assert_eq!(
            analysis.transcription_bias.dictionary_terms,
            vec!["SEV-1"]
        );
        assert_eq!(
            analysis.transcription_bias.stt_hints,
            vec!["status update"]
        );
        assert_eq!(
            analysis.transcription_bias.ignored_stt_hint_lines,
            vec!["this hint is too long to stay in the automatic bias path"]
        );
        assert!(analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::IgnoredSttHint
        )));
    }

    /// A term the user switched on must never vanish unreported. The filter
    /// used to stop at the limit, so terms past it reached no list at all and
    /// no surface could name them.
    #[test]
    fn analysis_names_the_terms_that_exceed_the_recognizer_slot_budget() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: String::new(),
                stt_hints: "one\ntwo\nthree\nfour\nfive\nsix".to_string(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            },
            None,
        );

        assert_eq!(
            analysis.transcription_bias.over_limit_stt_hint_lines,
            vec!["five", "six"]
        );
        assert!(analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::SttHintLimitReached
        )));
    }

    #[test]
    fn analysis_stays_quiet_when_everything_fits_the_slot_budget() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: String::new(),
                stt_hints: "one\ntwo".to_string(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            },
            None,
        );

        assert!(analysis.transcription_bias.over_limit_stt_hint_lines.is_empty());
        assert!(!analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::SttHintLimitReached
        )));
    }

    /// The panel marks which rows get a deterministic rewrite. It reads this
    /// split instead of restating `MIN_TERM_CHARS`, so the two cannot drift.
    #[test]
    fn the_analysis_says_which_terms_the_repair_layer_can_act_on() {
        let analysis = analyze_text_rules(vocabulary_request(
            "",
            vec![("Kubernetes", false), ("Tauri", false)],
        ))
        .expect("analysis");

        assert_eq!(analysis.vocabulary_repair.repairable, vec!["Kubernetes"]);
        assert_eq!(analysis.vocabulary_repair.too_short, vec!["Tauri"]);
        assert_eq!(
            analysis.vocabulary_repair.min_chars,
            super::super::vocabulary_repair::min_repairable_chars(),
        );
    }

    /// A term the recognizer never carries still gets repaired and still
    /// reaches the AI modes, so the coverage must not follow the recognizer
    /// selection (ADR 0033).
    #[test]
    fn repair_coverage_ignores_the_recognizer_opt_in() {
        let opted_out = analyze_text_rules(vocabulary_request("", vec![("Kubernetes", false)]))
            .expect("analysis");
        let opted_in = analyze_text_rules(vocabulary_request("", vec![("Kubernetes", true)]))
            .expect("analysis");

        assert_eq!(
            opted_out.vocabulary_repair.repairable,
            opted_in.vocabulary_repair.repairable,
        );
    }

    /// A half-typed row should not accuse itself of being too short before it
    /// holds a word.
    #[test]
    fn a_blank_row_is_neither_repairable_nor_too_short() {
        let analysis =
            analyze_text_rules(vocabulary_request("", vec![("   ", false)])).expect("analysis");

        assert!(analysis.vocabulary_repair.repairable.is_empty());
        assert!(analysis.vocabulary_repair.too_short.is_empty());
    }

    /// The preview ran without vocabulary while the real transform ran with it,
    /// so the panel showed a pipeline the runtime does not have.
    #[test]
    fn the_preview_runs_the_repair_pass_the_transform_runs() {
        let mut request = vocabulary_request("", vec![("Kubernetes", false)]);
        request.sample_text = Some("wir rollen das auf cuber netties aus".to_string());
        let analysis = analyze_text_rules(request).expect("analysis");

        assert!(
            analysis.preview.output.contains("Kubernetes"),
            "preview did not repair the term: {}",
            analysis.preview.output,
        );
        assert!(
            analysis
                .preview
                .applied_rules
                .iter()
                .any(|rule| rule == "vocabulary:Kubernetes"),
            "repair was not reported: {:?}",
            analysis.preview.applied_rules,
        );
    }

    #[test]
    fn analysis_warns_when_stt_hints_produce_no_usable_bias() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "customer names\nrefund policy".to_string(),
                stt_hints: "this hint is too long to stay in the automatic bias path".to_string(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            },
            None,
        );

        assert!(analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::NoUsableSttHints
        )));
    }

    /// A profile whose context field holds nothing but broad topics is correct,
    /// not under-configured: the recognizer never reads that field (ADR 0032).
    /// The analysis must therefore raise nothing about it.
    #[test]
    fn a_topic_only_context_field_produces_no_analysis_issue() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "customer success\nfollow up with client\nescalation handling\nsatisfaction score".to_string(),
                stt_hints: String::new(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            },
            None,
        );

        assert!(
            analysis.issues.is_empty(),
            "a topic-only context field must raise nothing, got: {:?}",
            analysis.issues
        );
        assert_eq!(analysis.profile_context.accepted.len(), 4);
    }

    // --- Profile Health: BiasPolicyWeak + acknowledged persistence ---

    #[test]
    fn health_red_on_form_conflict() {
        let status = analyze_profile_health_with_policy(
            "formal and casual tone",
            &[],
            &[],
            None,
            None,
        );
        assert_eq!(status.level, ProfileHealthLevel::Red);
        assert!(status.flags.iter().any(|f| matches!(f, ProfileHealthFlag::FormConflict { .. })));
    }

    #[test]
    fn health_red_on_bias_policy_weak_with_agent_mode() {
        let status = analyze_profile_health_with_policy(
            "customer follow-up",
            &[],
            &[],
            Some("off"),
            Some("agent"),
        );
        assert_eq!(status.level, ProfileHealthLevel::Red);
        assert!(status
            .flags
            .iter()
            .any(|f| matches!(f, ProfileHealthFlag::BiasPolicyWeak { .. })));
    }

    #[test]
    fn health_red_on_bias_policy_weak_with_prompt_enhance_mode() {
        let status = analyze_profile_health_with_policy(
            "",
            &[],
            &[],
            Some("off"),
            Some("prompt_enhance"),
        );
        assert_eq!(status.level, ProfileHealthLevel::Red);
        assert!(status
            .flags
            .iter()
            .any(|f| matches!(f, ProfileHealthFlag::BiasPolicyWeak { .. })));
    }

    #[test]
    fn health_yellow_on_length_bias_unacknowledged() {
        let entries: Vec<DictionaryEntry> = (0..6)
            .map(|i| DictionaryEntry {
                id: format!("e{i}"),
                phrase: format!("a{i}"),
                replace_with: format!("expanded replacement phrase number {i} and more text"),
            })
            .collect();
        let status = analyze_profile_health_with_policy(
            "",
            &entries,
            &[],
            None,
            None,
        );
        // LengthBias alone is yellow, not red.
        assert_eq!(status.level, ProfileHealthLevel::Yellow);
        assert!(status
            .flags
            .iter()
            .any(|f| matches!(f, ProfileHealthFlag::LengthBias { .. })));
    }

    #[test]
    fn health_green_when_all_acknowledged() {
        let entries: Vec<DictionaryEntry> = (0..6)
            .map(|i| DictionaryEntry {
                id: format!("e{i}"),
                phrase: format!("a{i}"),
                replace_with: format!("expanded replacement phrase number {i} and more text"),
            })
            .collect();
        let status = analyze_profile_health_with_policy(
            "informal and brief",
            &entries,
            &["length_bias".to_string(), "form_conflict".to_string()],
            None,
            None,
        );
        assert_eq!(status.level, ProfileHealthLevel::Green);
    }

    #[test]
    fn bias_policy_weak_not_red_for_cleanup_only_profiles() {
        let status = analyze_profile_health_with_policy(
            "",
            &[],
            &[],
            Some("off"),
            Some("cleanup"),
        );
        assert!(
            !status
                .flags
                .iter()
                .any(|f| matches!(f, ProfileHealthFlag::BiasPolicyWeak { .. })),
            "Off bias for cleanup-only profiles must not raise BiasPolicyWeak"
        );
    }

    #[test]
    fn bias_policy_weak_acked_downgrades_to_green() {
        let status = analyze_profile_health_with_policy(
            "",
            &[],
            &["bias_policy_weak".to_string()],
            Some("off"),
            Some("agent"),
        );
        assert_eq!(status.level, ProfileHealthLevel::Green);
    }

    // --- analyze_document_with_context: provider-specific preview ---

    #[test]
    fn analyze_document_conservative_surfaces_cloud_preview_without_profile_hints() {
        let document = TextRulesDocument {
            schema_version: TEXT_RULES_SCHEMA_VERSION,
            prompt: "WordScript\nSEV-1".to_string(),
            stt_hints: "status update".to_string(),
            dictionary_entries: vec![DictionaryEntry {
                id: "d1".to_string(),
                phrase: "word script".to_string(),
                replace_with: "WordScript".to_string(),
            }],
            snippet_entries: Vec::new(),
        };
        let context = BiasRequestContext {
            bias_mode: BiasMode::Conservative,
            manual_bias: ManualBias::default(),
            local_prompt_strength: "profile".to_string(),
            local_prompt_carry: false,
        };
        let analysis = analyze_document_with_context(&document, None, &context);

        let cloud = analysis
            .transcription_bias
            .cloud_prompt_preview
            .expect("cloud preview present");
        assert!(!cloud.contains("Vocabulary:"));
        assert!(cloud.contains("Likely phrases: status update"));
        assert_eq!(analysis.transcription_bias.effective_stt_hints_source, "profile");
        assert!(analysis.transcription_bias.manual_overrides_applied.is_empty());
    }

    /// The preview's job is to answer "what does the provider actually get".
    /// Since the context field no longer travels that path (ADR 0032), the
    /// preview must not show it — including under the legacy manual flags,
    /// which survive in old configs but no longer route anything.
    #[test]
    fn analyze_document_never_previews_the_context_field_as_recognizer_input() {
        let document = TextRulesDocument {
            schema_version: TEXT_RULES_SCHEMA_VERSION,
            prompt: "WordScript\nSEV-1".to_string(),
            stt_hints: "ignored profile hint".to_string(),
            dictionary_entries: Vec::new(),
            snippet_entries: Vec::new(),
        };
        let context = BiasRequestContext {
            bias_mode: BiasMode::Manual,
            manual_bias: ManualBias {
                cloud_include_profile_terms: true,
                local_include_profile_terms: false,
                stt_hints_override: "alpha\nbeta".to_string(),
            },
            local_prompt_strength: "profile".to_string(),
            local_prompt_carry: false,
        };
        let analysis = analyze_document_with_context(&document, None, &context);

        let cloud = analysis
            .transcription_bias
            .cloud_prompt_preview
            .expect("cloud preview present");
        assert!(!cloud.contains("Vocabulary:"));
        assert!(!cloud.contains("SEV-1"));
        assert!(cloud.contains("Likely phrases: alpha; beta"));
        assert_eq!(
            analysis.transcription_bias.effective_stt_hints_source,
            "manual_override"
        );
        assert!(analysis
            .transcription_bias
            .manual_overrides_applied
            .contains(&"stt_hints_override".to_string()));
    }

    #[test]
    fn analyze_document_off_yields_no_cloud_or_local_preview() {
        let document = TextRulesDocument {
            schema_version: TEXT_RULES_SCHEMA_VERSION,
            prompt: "WordScript".to_string(),
            stt_hints: "status update".to_string(),
            dictionary_entries: Vec::new(),
            snippet_entries: Vec::new(),
        };
        let context = BiasRequestContext {
            bias_mode: BiasMode::Off,
            manual_bias: ManualBias::default(),
            local_prompt_strength: "profile".to_string(),
            local_prompt_carry: false,
        };
        let analysis = analyze_document_with_context(&document, None, &context);

        assert!(analysis.transcription_bias.cloud_prompt_preview.is_none());
        assert!(analysis.transcription_bias.local_prompt_preview.is_none());
    }
}
