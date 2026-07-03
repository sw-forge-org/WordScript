use std::collections::VecDeque;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::{Mutex, OnceLock};

use crate::core::paths;

const MAX_RUNTIME_LOG_ENTRIES: usize = 400;
const RUNTIME_LOG_MAX_BYTES: u64 = 4 * 1024 * 1024;

fn runtime_log_store() -> &'static Mutex<VecDeque<String>> {
    static STORE: OnceLock<Mutex<VecDeque<String>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(VecDeque::with_capacity(MAX_RUNTIME_LOG_ENTRIES)))
}

fn runtime_log_file_path() -> std::path::PathBuf {
    paths::user_data_dir()
        .join("logs")
        .join("wordscript-runtime.log")
}

fn append_to_log_file(message: &str) {
    let path = runtime_log_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    if let Ok(metadata) = std::fs::metadata(&path) {
        if metadata.len() >= RUNTIME_LOG_MAX_BYTES {
            let rotated = path.with_extension("log.1");
            let _ = std::fs::rename(&path, &rotated);
        }
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{message}");
    }
}

pub fn record(message: String) {
    eprintln!("{message}");
    append_to_log_file(&message);

    let Ok(mut entries) = runtime_log_store().lock() else {
        return;
    };

    entries.push_back(message);
    while entries.len() > MAX_RUNTIME_LOG_ENTRIES {
        entries.pop_front();
    }
}

#[tauri::command]
pub fn runtime_log_entries() -> Result<Vec<String>, String> {
    let entries = runtime_log_store()
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(entries.iter().cloned().collect())
}

#[tauri::command]
pub fn clear_runtime_log_entries() -> Result<Vec<String>, String> {
    let mut entries = runtime_log_store()
        .lock()
        .map_err(|error| error.to_string())?;
    entries.clear();
    Ok(Vec::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_log_file_lives_under_user_data_logs() {
        let path = runtime_log_file_path();
        assert!(path.ends_with("logs/wordscript-runtime.log"));
    }

    #[test]
    fn record_appends_to_in_memory_ring_buffer() {
        let mut entries = runtime_log_store().lock().unwrap();
        entries.clear();
        drop(entries);

        record("wordscript-test-line-a".to_string());
        record("wordscript-test-line-b".to_string());

        let entries = runtime_log_store().lock().unwrap();
        assert!(entries.iter().any(|entry| entry == "wordscript-test-line-a"));
        assert!(entries.iter().any(|entry| entry == "wordscript-test-line-b"));
    }
}
