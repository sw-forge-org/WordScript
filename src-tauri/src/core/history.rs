use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::config::{AppConfig, TextProfileWorkMode};
use super::insertion::{
    insert_transcription_from_legacy, NativeClipboardRestoreStatus, NativeInsertDriver,
    NativeInsertMode, NativeInsertRecoveryAction, NativeInsertResult,
};
use super::paths::history_file_path;
use super::runtime_log;
use super::sessions::now_ms;
use super::transform::{apply_native_transform, NativeTransformConfig, NativeTransformResult};

const DEFAULT_HISTORY_LIMIT: usize = 200;
const MS_PER_DAY: u64 = 86_400_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionHistoryStatus {
    Completed,
    Empty,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionHistorySource {
    NativePipeline,
    Retry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionHistoryEntry {
    pub id: String,
    pub created_at_ms: u64,
    pub status: TranscriptionHistoryStatus,
    pub source: TranscriptionHistorySource,
    pub retry_of: Option<String>,
    pub provider: String,
    pub model: Option<String>,
    pub language: Option<String>,
    pub active_profile: Option<String>,
    #[serde(default)]
    pub work_mode: Option<TextProfileWorkMode>,
    pub provider_profile: Option<String>,
    pub local_prompt_strength: Option<String>,
    pub local_prompt_carry: Option<bool>,
    pub local_beam_size: Option<u8>,
    pub local_best_of: Option<u8>,
    pub raw_transcript: Option<String>,
    pub transformed_transcript: Option<String>,
    pub corrected: bool,
    pub applied_rules: Vec<String>,
    pub transform_warning: Option<String>,
    pub insert_mode: Option<NativeInsertMode>,
    pub active_driver: Option<NativeInsertDriver>,
    pub pasted: Option<bool>,
    pub fallback_available: Option<bool>,
    pub fallback_reason: Option<String>,
    pub recovery_action: Option<NativeInsertRecoveryAction>,
    pub recovery_message: Option<String>,
    pub clipboard_restore: Option<NativeClipboardRestoreStatus>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RecordHistoryEntryRequest {
    pub status: TranscriptionHistoryStatus,
    pub source: TranscriptionHistorySource,
    pub retry_of: Option<String>,
    pub provider: String,
    pub model: Option<String>,
    pub language: Option<String>,
    pub active_profile: Option<String>,
    pub provider_profile: Option<String>,
    pub local_prompt_strength: Option<String>,
    pub local_prompt_carry: Option<bool>,
    pub local_beam_size: Option<u8>,
    pub local_best_of: Option<u8>,
    pub raw_transcript: Option<String>,
    pub transformed_transcript: Option<String>,
    pub corrected: bool,
    pub applied_rules: Vec<String>,
    pub transform_warning: Option<String>,
    pub insert_mode: Option<NativeInsertMode>,
    pub active_driver: Option<NativeInsertDriver>,
    pub pasted: Option<bool>,
    pub fallback_available: Option<bool>,
    pub fallback_reason: Option<String>,
    pub recovery_action: Option<NativeInsertRecoveryAction>,
    pub recovery_message: Option<String>,
    pub clipboard_restore: Option<NativeClipboardRestoreStatus>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteTranscriptionHistoryEntryRequest {
    pub id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RetryTranscriptionHistoryEntryRequest {
    pub id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct TranscriptionHistoryQuery {
    pub limit: Option<usize>,
    pub provider: Option<String>,
    pub status: Option<TranscriptionHistoryStatus>,
    pub source: Option<TranscriptionHistorySource>,
    pub active_profile: Option<String>,
    pub search: Option<String>,
    pub include_errors_only: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExportTranscriptionHistoryRequest {
    pub path: String,
    #[serde(default)]
    pub query: TranscriptionHistoryQuery,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportTranscriptionHistoryResponse {
    pub path: String,
    pub exported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionHistoryStorageStatus {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TranscriptionHistoryExportDocument {
    exported_at_ms: u64,
    history_limit: usize,
    history_retention_days: u32,
    count: usize,
    entries: Vec<TranscriptionHistoryEntry>,
}

#[derive(Debug, Clone, Default)]
struct LocalHistoryContext {
    provider_profile: Option<String>,
    local_prompt_strength: Option<String>,
    local_prompt_carry: Option<bool>,
    local_beam_size: Option<u8>,
    local_best_of: Option<u8>,
}

#[derive(Debug, Default)]
struct TranscriptionHistoryStore {
    loaded: bool,
    entries: VecDeque<TranscriptionHistoryEntry>,
}

fn history_store() -> &'static Mutex<TranscriptionHistoryStore> {
    static STORE: OnceLock<Mutex<TranscriptionHistoryStore>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(TranscriptionHistoryStore::default()))
}

#[cfg(test)]
fn history_path_override() -> &'static Mutex<Option<PathBuf>> {
    static OVERRIDE: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    OVERRIDE.get_or_init(|| Mutex::new(None))
}

#[cfg(test)]
fn history_policy_override() -> &'static Mutex<Option<(usize, u32)>> {
    static OVERRIDE: OnceLock<Mutex<Option<(usize, u32)>>> = OnceLock::new();
    OVERRIDE.get_or_init(|| Mutex::new(None))
}

fn resolved_history_file_path() -> PathBuf {
    #[cfg(test)]
    if let Ok(guard) = history_path_override().lock() {
        if let Some(path) = guard.clone() {
            return path;
        }
    }

    history_file_path()
}

fn ensure_loaded(store: &mut TranscriptionHistoryStore) {
    if store.loaded {
        return;
    }

    store.entries = load_history_entries();
    store.loaded = true;
}

fn load_history_entries() -> VecDeque<TranscriptionHistoryEntry> {
    let path = resolved_history_file_path();
    let Ok(raw) = std::fs::read_to_string(path) else {
        return VecDeque::with_capacity(DEFAULT_HISTORY_LIMIT);
    };

    let mut entries = serde_json::from_str::<VecDeque<TranscriptionHistoryEntry>>(&raw)
        .or_else(|_| {
            serde_json::from_str::<Vec<TranscriptionHistoryEntry>>(&raw).map(VecDeque::from)
        })
        .unwrap_or_else(|_| VecDeque::with_capacity(DEFAULT_HISTORY_LIMIT));
    prune_entries_for_runtime(&mut entries);
    entries
}

fn save_history_entries(entries: &VecDeque<TranscriptionHistoryEntry>) -> Result<(), String> {
    let path = resolved_history_file_path();
    let raw = serde_json::to_string_pretty(entries).map_err(|error| error.to_string())?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(path, raw).map_err(|error| error.to_string())
}

fn next_history_id(created_at_ms: u64, entries_len: usize) -> String {
    format!("history-{created_at_ms}-{entries_len}")
}

#[cfg(test)]
pub fn record_entry(
    request: RecordHistoryEntryRequest,
) -> Result<TranscriptionHistoryEntry, String> {
    record_entry_with_work_mode(request, None)
}

fn record_entry_with_work_mode(
    request: RecordHistoryEntryRequest,
    work_mode: Option<TextProfileWorkMode>,
) -> Result<TranscriptionHistoryEntry, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);

    let created_at_ms = now_ms();
    let entry = TranscriptionHistoryEntry {
        id: next_history_id(created_at_ms, store.entries.len()),
        created_at_ms,
        status: request.status,
        source: request.source,
        retry_of: request.retry_of,
        provider: request.provider,
        model: request.model,
        language: request.language,
        active_profile: request.active_profile,
        work_mode,
        provider_profile: request.provider_profile,
        local_prompt_strength: request.local_prompt_strength,
        local_prompt_carry: request.local_prompt_carry,
        local_beam_size: request.local_beam_size,
        local_best_of: request.local_best_of,
        raw_transcript: request.raw_transcript,
        transformed_transcript: request.transformed_transcript,
        corrected: request.corrected,
        applied_rules: request.applied_rules,
        transform_warning: request.transform_warning,
        insert_mode: request.insert_mode,
        active_driver: request.active_driver,
        pasted: request.pasted,
        fallback_available: request.fallback_available,
        fallback_reason: request.fallback_reason,
        recovery_action: request.recovery_action,
        recovery_message: request.recovery_message,
        clipboard_restore: request.clipboard_restore,
        error: request.error,
    };

    store.entries.push_front(entry.clone());
    prune_entries_for_runtime(&mut store.entries);

    save_history_entries(&store.entries)?;
    Ok(entry)
}

fn entries_snapshot() -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    prune_entries_for_runtime(&mut store.entries);
    Ok(store.entries.iter().cloned().collect())
}

#[tauri::command]
pub fn transcription_history_entries(
    query: Option<TranscriptionHistoryQuery>,
) -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let entries = entries_snapshot()?;
    Ok(filter_history_entries(entries, &query.unwrap_or_default()))
}

#[tauri::command]
pub fn transcription_history_storage_status() -> Result<TranscriptionHistoryStorageStatus, String> {
    Ok(TranscriptionHistoryStorageStatus {
        path: resolved_history_file_path().to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn clear_transcription_history_entries() -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    store.entries.clear();
    save_history_entries(&store.entries)?;
    Ok(Vec::new())
}

#[tauri::command]
pub fn delete_transcription_history_entry(
    request: DeleteTranscriptionHistoryEntryRequest,
) -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    store.entries.retain(|entry| entry.id != request.id);
    save_history_entries(&store.entries)?;
    Ok(store.entries.iter().cloned().collect())
}

#[tauri::command]
pub fn export_transcription_history(
    request: ExportTranscriptionHistoryRequest,
) -> Result<ExportTranscriptionHistoryResponse, String> {
    let entries = filter_history_entries(entries_snapshot()?, &request.query);
    let path = PathBuf::from(request.path.trim());
    if path.as_os_str().is_empty() {
        return Err("Choose a file path for the history export.".to_string());
    }

    let (history_limit, history_retention_days) = runtime_history_policy();
    let document = TranscriptionHistoryExportDocument {
        exported_at_ms: now_ms(),
        history_limit,
        history_retention_days,
        count: entries.len(),
        entries,
    };
    let raw = serde_json::to_string_pretty(&document).map_err(|error| error.to_string())?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(&path, raw).map_err(|error| error.to_string())?;

    Ok(ExportTranscriptionHistoryResponse {
        path: path.to_string_lossy().to_string(),
        exported_count: document.count,
    })
}

#[tauri::command]
pub async fn retry_transcription_history_entry<R: Runtime>(
    app: AppHandle<R>,
    request: RetryTranscriptionHistoryEntryRequest,
) -> Result<TranscriptionHistoryEntry, String> {
    let existing = entries_snapshot()?
        .into_iter()
        .find(|entry| entry.id == request.id)
        .ok_or_else(|| format!("History entry '{}' was not found.", request.id))?;
    let raw_transcript = existing
        .raw_transcript
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            "This history entry does not contain a raw transcript, so it cannot be re-processed."
                .to_string()
        })?;

    let app_config = AppConfig::load_from_disk();
    let transform_config = transform_config_from_app_config(&app_config);
    let local_history = local_history_context(&app_config);

    runtime_log::record(format!(
        "[WordScript] History retry start entry_id={} provider={} post_process={}",
        existing.id, transform_config.provider, transform_config.post_process,
    ));

    let transformed = apply_native_transform(&raw_transcript, transform_config.clone()).await;
    let transformed_text = transformed.text.trim().to_string();

    let retried_entry = if transformed_text.is_empty() {
        record_entry_with_work_mode(
            RecordHistoryEntryRequest {
                status: TranscriptionHistoryStatus::Empty,
                source: TranscriptionHistorySource::Retry,
                retry_of: Some(existing.id.clone()),
                provider: transform_config.provider,
                model: Some(active_model_for_provider(&app_config)),
                language: optional_non_empty(&app_config.language),
                active_profile: app_config.active_text_profile_label(),
                provider_profile: local_history.provider_profile,
                local_prompt_strength: local_history.local_prompt_strength,
                local_prompt_carry: local_history.local_prompt_carry,
                local_beam_size: local_history.local_beam_size,
                local_best_of: local_history.local_best_of,
                raw_transcript: Some(raw_transcript),
                transformed_transcript: None,
                corrected: transformed.corrected,
                applied_rules: transformed.applied_rules,
                transform_warning: transformed.warning,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: Some("Retry produced no usable transcript.".to_string()),
            },
            Some(app_config.resolved_active_text_profile_work_mode()),
        )?
    } else {
        let insert_result = insert_transcription_from_legacy(
            &app,
            &transformed_text,
            transformed.corrected,
            Some(app_config.active_text_profile_auto_paste()),
        )
        .map_err(|error| error.to_string())?;

        let entry = history_entry_from_insert_result(
            &app_config,
            Some(existing.id.as_str()),
            Some(raw_transcript),
            transformed,
            &insert_result,
        )?;

        if insert_result.ok {
            let _ = app.emit(
                "wordscript-event",
                serde_json::json!({
                    "event": "transcription",
                    "text": transformed_text,
                    "corrected": entry.corrected,
                    "provider": entry.provider,
                    "active_profile": entry.active_profile,
                    "work_mode": entry.work_mode,
                    "raw_text": entry.raw_transcript,
                    "transform": {
                        "applied_rules": entry.applied_rules,
                        "warning": entry.transform_warning,
                    },
                    "history": {
                        "entry_id": entry.id,
                        "retry_of": entry.retry_of,
                    },
                    "delivery": insert_result.insert_mode.delivery_label(),
                    "insertion": insert_result,
                }),
            );
            // The retry's delivery point, next to the event that tells the UI
            // the same thing (ADR 0012).
            super::sound::play_if_enabled(super::sound::SoundCue::Done);
        } else {
            super::sound::play_if_enabled(super::sound::SoundCue::Error);
        }

        entry
    };

    runtime_log::record(format!(
        "[WordScript] History retry done entry_id={} retry_of={:?} status={:?}",
        retried_entry.id, retried_entry.retry_of, retried_entry.status,
    ));

    Ok(retried_entry)
}

pub fn history_entry_from_insert_result(
    app_config: &AppConfig,
    retry_of: Option<&str>,
    raw_transcript: Option<String>,
    transformed: NativeTransformResult,
    insert_result: &NativeInsertResult,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: if insert_result.ok {
                TranscriptionHistoryStatus::Completed
            } else {
                TranscriptionHistoryStatus::Failed
            },
            source: if retry_of.is_some() {
                TranscriptionHistorySource::Retry
            } else {
                TranscriptionHistorySource::NativePipeline
            },
            retry_of: retry_of.map(ToString::to_string),
            provider: app_config.provider.clone(),
            model: Some(active_model_for_provider(app_config)),
            language: optional_non_empty(&app_config.language),
            active_profile: app_config.active_text_profile_label(),
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript,
            transformed_transcript: Some(insert_result.text.clone()),
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: Some(insert_result.insert_mode.clone()),
            active_driver: Some(insert_result.active_driver),
            pasted: Some(insert_result.pasted),
            fallback_available: Some(insert_result.fallback_available),
            fallback_reason: insert_result.fallback_reason.clone(),
            recovery_action: Some(insert_result.recovery_action),
            recovery_message: Some(insert_result.recovery_message.clone()),
            clipboard_restore: Some(insert_result.clipboard_restore),
            error: insert_result.error.clone(),
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
    )
}

pub fn record_insert_failure(
    app_config: &AppConfig,
    raw_transcript: String,
    transformed_text: String,
    transformed: NativeTransformResult,
    error: String,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: app_config.provider.clone(),
            model: Some(active_model_for_provider(app_config)),
            language: optional_non_empty(&app_config.language),
            active_profile: app_config.active_text_profile_label(),
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: Some(raw_transcript),
            transformed_transcript: Some(transformed_text),
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some(error),
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
    )
}

pub fn record_transcription_failure(
    app_config: &AppConfig,
    provider: &str,
    model: Option<String>,
    language: Option<String>,
    error: String,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: provider.to_string(),
            model,
            language,
            active_profile: app_config.active_text_profile_label(),
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: None,
            transformed_transcript: None,
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some(error),
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
    )
}

pub fn record_empty_result(
    app_config: &AppConfig,
    raw_transcript: String,
    transformed: NativeTransformResult,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Empty,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: app_config.provider.clone(),
            model: Some(active_model_for_provider(app_config)),
            language: optional_non_empty(&app_config.language),
            active_profile: app_config.active_text_profile_label(),
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: Some(raw_transcript),
            transformed_transcript: None,
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some("Pipeline produced no usable transcript.".to_string()),
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
    )
}

fn transform_config_from_app_config(config: &AppConfig) -> NativeTransformConfig {
    let active_profile = config.active_text_profile();

    NativeTransformConfig {
        provider: config.provider.clone(),
        profile_prompt: active_profile.prompt,
        dictionary_entries: active_profile.dictionary_entries,
        snippet_entries: active_profile.snippet_entries,
        post_process: config.post_process,
        correction_model: if config.provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID {
            config.local_correction_model.clone()
        } else {
            config.correction_model.clone()
        },
        filter_fillers: config.active_text_profile_filter_fillers(),
        professionalize: config.active_text_profile_professionalize(),
        ..Default::default()
    }
}

fn active_model_for_provider(config: &AppConfig) -> String {
    if config.provider == super::providers::LOCAL_PREVIEW_PROVIDER_ID {
        let trimmed = config.local_model.trim();
        if trimmed.is_empty() {
            "base".to_string()
        } else {
            trimmed.to_string()
        }
    } else {
        let trimmed = config.model.trim();
        if trimmed.is_empty() {
            "whisper-large-v3-turbo".to_string()
        } else {
            trimmed.to_string()
        }
    }
}

fn local_history_context(config: &AppConfig) -> LocalHistoryContext {
    if config.provider != super::providers::LOCAL_PREVIEW_PROVIDER_ID {
        return LocalHistoryContext::default();
    }

    LocalHistoryContext {
        provider_profile: optional_non_empty(&config.local_profile),
        local_prompt_strength: optional_non_empty(&config.local_prompt_strength),
        local_prompt_carry: Some(config.local_prompt_carry),
        local_beam_size: Some(config.local_beam_size),
        local_best_of: Some(config.local_best_of),
    }
}

fn optional_non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn runtime_history_policy() -> (usize, u32) {
    #[cfg(test)]
    if let Ok(guard) = history_policy_override().lock() {
        if let Some((history_limit, history_retention_days)) = *guard {
            return (
                history_limit.clamp(25, 1000),
                history_retention_days.min(3650),
            );
        }
    }

    let app_config = AppConfig::load_from_disk();
    (
        configured_history_limit(&app_config),
        configured_history_retention_days(&app_config),
    )
}

fn configured_history_limit(config: &AppConfig) -> usize {
    config.history_limit.clamp(25, 1000)
}

fn configured_history_retention_days(config: &AppConfig) -> u32 {
    config.history_retention_days.min(3650)
}

fn prune_entries_for_runtime(entries: &mut VecDeque<TranscriptionHistoryEntry>) {
    let (history_limit, history_retention_days) = runtime_history_policy();
    prune_entries(entries, history_limit, history_retention_days, now_ms());
}

fn prune_entries(
    entries: &mut VecDeque<TranscriptionHistoryEntry>,
    history_limit: usize,
    history_retention_days: u32,
    reference_now_ms: u64,
) {
    if history_retention_days > 0 {
        let cutoff_ms =
            reference_now_ms.saturating_sub(u64::from(history_retention_days) * MS_PER_DAY);
        entries.retain(|entry| entry.created_at_ms >= cutoff_ms);
    }

    while entries.len() > history_limit {
        entries.pop_back();
    }
}

fn filter_history_entries(
    entries: Vec<TranscriptionHistoryEntry>,
    query: &TranscriptionHistoryQuery,
) -> Vec<TranscriptionHistoryEntry> {
    let provider_filter = normalized_filter(&query.provider);
    let profile_filter = normalized_filter(&query.active_profile);
    let search_filter = normalized_filter(&query.search);
    let limit = query.limit.map(|value| value.clamp(1, 1000));

    let mut filtered = entries
        .into_iter()
        .filter(|entry| match &provider_filter {
            Some(provider) => entry.provider.eq_ignore_ascii_case(provider),
            None => true,
        })
        .filter(|entry| match &query.status {
            Some(status) => &entry.status == status,
            None => true,
        })
        .filter(|entry| match &query.source {
            Some(source) => &entry.source == source,
            None => true,
        })
        .filter(|entry| match &profile_filter {
            Some(active_profile) => entry
                .active_profile
                .as_deref()
                .map(|value| value.eq_ignore_ascii_case(active_profile))
                .unwrap_or(false),
            None => true,
        })
        .filter(|entry| !query.include_errors_only || entry.error.as_deref().is_some())
        .filter(|entry| match &search_filter {
            Some(search) => history_entry_matches_search(entry, search),
            None => true,
        })
        .collect::<Vec<_>>();

    if let Some(limit) = limit {
        filtered.truncate(limit);
    }

    filtered
}

fn normalized_filter(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
}

fn history_entry_matches_search(entry: &TranscriptionHistoryEntry, search: &str) -> bool {
    let contains = |value: Option<&str>| {
        value
            .map(|candidate| candidate.to_ascii_lowercase().contains(search))
            .unwrap_or(false)
    };

    entry.provider.to_ascii_lowercase().contains(search)
        || contains(entry.model.as_deref())
        || contains(entry.language.as_deref())
        || contains(entry.active_profile.as_deref())
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.rewrite_style.as_str()),
        )
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.insert_behavior.as_str()),
        )
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.recovery_behavior.as_str()),
        )
        || contains(entry.provider_profile.as_deref())
        || contains(entry.local_prompt_strength.as_deref())
        || contains(entry.raw_transcript.as_deref())
        || contains(entry.transformed_transcript.as_deref())
        || contains(entry.transform_warning.as_deref())
        || contains(entry.fallback_reason.as_deref())
        || contains(entry.recovery_message.as_deref())
        || contains(entry.error.as_deref())
}

#[cfg(test)]
fn set_history_path_override_for_tests(path: PathBuf) {
    if let Ok(mut guard) = history_path_override().lock() {
        *guard = Some(path);
    }
}

#[cfg(test)]
fn set_history_policy_override_for_tests(history_limit: usize, history_retention_days: u32) {
    if let Ok(mut guard) = history_policy_override().lock() {
        *guard = Some((history_limit, history_retention_days));
    }
}

#[cfg(test)]
fn reset_store_for_tests() {
    if let Ok(mut store) = history_store().lock() {
        store.loaded = false;
        store.entries.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn test_history_path(test_name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wordscript-history-tests-{test_name}"));
        let _ = std::fs::create_dir_all(&dir);
        dir.join("history.json")
    }

    fn prepare_test_history_path(test_name: &str) -> PathBuf {
        let path = test_history_path(test_name);
        let _ = std::fs::remove_file(&path);
        set_history_path_override_for_tests(path.clone());
        set_history_policy_override_for_tests(DEFAULT_HISTORY_LIMIT, 90);
        reset_store_for_tests();
        path
    }

    #[test]
    fn records_and_reads_history_entries_with_retention() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("retention");

        for index in 0..(DEFAULT_HISTORY_LIMIT + 5) {
            record_entry(RecordHistoryEntryRequest {
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: Some("whisper-large-v3-turbo".to_string()),
                language: Some("de".to_string()),
                active_profile: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some(format!("raw-{index}")),
                transformed_transcript: Some(format!("final-{index}")),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
            })
            .expect("record history entry");
        }

        let entries = transcription_history_entries(None).expect("history entries");

        assert_eq!(entries.len(), DEFAULT_HISTORY_LIMIT);
        assert!(path.is_file());
        assert_eq!(
            entries
                .last()
                .and_then(|entry| entry.raw_transcript.as_deref()),
            Some("raw-5")
        );
    }

    #[test]
    fn deletes_history_entries_by_id() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("delete");

        let first = record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: None,
            language: None,
            active_profile: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("eins".to_string()),
            transformed_transcript: Some("eins".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
        })
        .expect("first history entry");
        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: None,
            language: None,
            active_profile: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("zwei".to_string()),
            transformed_transcript: Some("zwei".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
        })
        .expect("second history entry");

        let remaining =
            delete_transcription_history_entry(DeleteTranscriptionHistoryEntryRequest {
                id: first.id,
            })
            .expect("delete history entry");

        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].raw_transcript.as_deref(), Some("zwei"));
    }

    #[test]
    fn filters_history_entries_by_provider_status_and_search() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("filtering");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            language: Some("de".to_string()),
            active_profile: Some("developer".to_string()),
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("ship release notes".to_string()),
            transformed_transcript: Some("Ship release notes.".to_string()),
            corrected: true,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
        })
        .expect("groq history entry");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::Retry,
            retry_of: Some("history-old".to_string()),
            provider: "local_preview".to_string(),
            model: Some("base.en".to_string()),
            language: Some("en".to_string()),
            active_profile: Some("support".to_string()),
            provider_profile: Some("local-preview-base-quality".to_string()),
            local_prompt_strength: Some("profile_and_terms".to_string()),
            local_prompt_carry: Some(true),
            local_beam_size: Some(5),
            local_best_of: Some(5),
            raw_transcript: Some("follow up".to_string()),
            transformed_transcript: None,
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some("Model missing".to_string()),
        })
        .expect("local preview history entry");

        let filtered = transcription_history_entries(Some(TranscriptionHistoryQuery {
            provider: Some("local_preview".to_string()),
            status: Some(TranscriptionHistoryStatus::Failed),
            source: Some(TranscriptionHistorySource::Retry),
            search: Some("model missing".to_string()),
            include_errors_only: true,
            ..TranscriptionHistoryQuery::default()
        }))
        .expect("filtered history entries");

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].provider, "local_preview");
        assert_eq!(filtered[0].active_profile.as_deref(), Some("support"));
        assert_eq!(
            filtered[0].provider_profile.as_deref(),
            Some("local-preview-base-quality")
        );
    }

    #[test]
    fn exports_filtered_history_entries_with_policy_metadata() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let export_path = test_history_path("export").with_file_name("history-export.json");
        let _ = std::fs::remove_file(&export_path);
        prepare_test_history_path("export");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            language: Some("de".to_string()),
            active_profile: Some("developer".to_string()),
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("eins".to_string()),
            transformed_transcript: Some("eins".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
        })
        .expect("first export history entry");
        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "local_preview".to_string(),
            model: Some("base".to_string()),
            language: Some("en".to_string()),
            active_profile: Some("support".to_string()),
            provider_profile: Some("local-preview-base-fast".to_string()),
            local_prompt_strength: Some("profile".to_string()),
            local_prompt_carry: Some(false),
            local_beam_size: Some(1),
            local_best_of: Some(1),
            raw_transcript: Some("zwei".to_string()),
            transformed_transcript: Some("zwei".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
        })
        .expect("second export history entry");

        let response = export_transcription_history(ExportTranscriptionHistoryRequest {
            path: export_path.to_string_lossy().to_string(),
            query: TranscriptionHistoryQuery {
                provider: Some("groq".to_string()),
                ..TranscriptionHistoryQuery::default()
            },
        })
        .expect("export history response");

        let raw = std::fs::read_to_string(export_path).expect("read export file");
        let document: TranscriptionHistoryExportDocument =
            serde_json::from_str(&raw).expect("parse export document");

        assert_eq!(response.exported_count, 1);
        assert_eq!(document.count, 1);
        assert_eq!(document.history_limit, DEFAULT_HISTORY_LIMIT);
        assert_eq!(document.history_retention_days, 90);
        assert_eq!(document.entries[0].provider, "groq");
    }

    #[test]
    fn prune_entries_drops_old_entries_before_limit_is_applied() {
        let cutoff_reference = 10 * MS_PER_DAY;
        let mut entries = VecDeque::from(vec![
            TranscriptionHistoryEntry {
                id: "old".to_string(),
                created_at_ms: cutoff_reference.saturating_sub(8 * MS_PER_DAY),
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                active_profile: None,
                work_mode: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("old".to_string()),
                transformed_transcript: Some("old".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
            },
            TranscriptionHistoryEntry {
                id: "fresh-a".to_string(),
                created_at_ms: cutoff_reference.saturating_sub(MS_PER_DAY),
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                active_profile: None,
                work_mode: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("fresh-a".to_string()),
                transformed_transcript: Some("fresh-a".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
            },
            TranscriptionHistoryEntry {
                id: "fresh-b".to_string(),
                created_at_ms: cutoff_reference,
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                active_profile: None,
                work_mode: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("fresh-b".to_string()),
                transformed_transcript: Some("fresh-b".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
            },
        ]);

        prune_entries(&mut entries, 1, 3, cutoff_reference);

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "fresh-a");
    }

    #[test]
    fn history_entry_preserves_insert_recovery_semantics() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("insert-recovery-semantics");

        let entry = history_entry_from_insert_result(
            &AppConfig::default(),
            None,
            Some("raw text".to_string()),
            NativeTransformResult {
                text: "final text".to_string(),
                corrected: false,
                applied_rules: vec!["removed_fillers".to_string()],
                warning: None,
            },
            &NativeInsertResult {
                ok: false,
                text: "final text".to_string(),
                insert_mode: NativeInsertMode::ClipboardFallback,
                active_driver: NativeInsertDriver::Arboard,
                clipboard_written: true,
                paste_attempted: true,
                pasted: false,
                scratchpad_entry: super::super::insertion::ScratchpadEntry {
                    id: "scratch-1".to_string(),
                    text: "final text".to_string(),
                    source: "native_insert".to_string(),
                    created_at_ms: 1,
                    corrected: false,
                    insert_mode: NativeInsertMode::ClipboardFallback,
                    active_driver: NativeInsertDriver::Arboard,
                    clipboard_written: true,
                    paste_attempted: true,
                    pasted: false,
                    fallback_reason: Some("xdotool failed".to_string()),
                    error: Some("xdotool failed".to_string()),
                    recovery_action: NativeInsertRecoveryAction::ManualPaste,
                    recovery_message: Some(
                        "Transcript is on the clipboard. Paste manually.".to_string(),
                    ),
                    clipboard_restore: NativeClipboardRestoreStatus::NotAttempted,
                },
                fallback_available: true,
                fallback_reason: Some("xdotool failed".to_string()),
                error: Some("xdotool failed".to_string()),
                recovery_action: NativeInsertRecoveryAction::ManualPaste,
                recovery_message: "Transcript is on the clipboard. Paste manually.".to_string(),
                clipboard_restore: NativeClipboardRestoreStatus::NotAttempted,
            },
        )
        .expect("history entry from insert result");

        assert_eq!(
            entry.recovery_action,
            Some(NativeInsertRecoveryAction::ManualPaste)
        );
        assert_eq!(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.rewrite_style.as_str()),
            Some("clean")
        );
        assert_eq!(
            entry.clipboard_restore,
            Some(NativeClipboardRestoreStatus::NotAttempted)
        );
        assert_eq!(
            entry.recovery_message.as_deref(),
            Some("Transcript is on the clipboard. Paste manually.")
        );
    }
}
