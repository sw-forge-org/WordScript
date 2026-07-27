use std::collections::VecDeque;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use crate::core::paths;

const MAX_RUNTIME_LOG_ENTRIES: usize = 400;
const RUNTIME_LOG_MAX_BYTES: u64 = 4 * 1024 * 1024;

fn process_start() -> Instant {
    static START: OnceLock<Instant> = OnceLock::new();
    *START.get_or_init(Instant::now)
}

/// Wall-clock epoch milliseconds plus monotonic seconds since process start.
///
/// Both are needed and neither replaces the other: the epoch value correlates a
/// line with `journalctl` and with the overlay diagnostic log, while the
/// monotonic value makes a stall visible at a glance and survives wall-clock
/// jumps from NTP. Convert the epoch value with `date -d @<seconds>`.
fn log_timestamp() -> String {
    let epoch_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0);
    format!("[{epoch_ms} +{:.3}]", process_start().elapsed().as_secs_f64())
}

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
    let message = format!("{} {message}", log_timestamp());
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
        assert!(entries
            .iter()
            .any(|entry| entry.ends_with(" wordscript-test-line-a")));
        assert!(entries
            .iter()
            .any(|entry| entry.ends_with(" wordscript-test-line-b")));
    }

    #[test]
    fn recorded_entries_carry_an_epoch_and_monotonic_timestamp() {
        let mut entries = runtime_log_store().lock().unwrap();
        entries.clear();
        drop(entries);

        record("wordscript-test-timestamped".to_string());

        let entries = runtime_log_store().lock().unwrap();
        let entry = entries
            .iter()
            .find(|entry| entry.ends_with(" wordscript-test-timestamped"))
            .expect("recorded entry is buffered");

        let stamp = entry
            .strip_prefix('[')
            .and_then(|rest| rest.split_once(']'))
            .map(|(stamp, _)| stamp)
            .expect("entry starts with a bracketed timestamp");
        let (epoch_ms, monotonic) = stamp.split_once(" +").expect("stamp has both parts");

        assert!(epoch_ms.parse::<u128>().expect("epoch is numeric") > 0);
        assert!(monotonic.parse::<f64>().is_ok(), "monotonic is numeric");
    }
}
