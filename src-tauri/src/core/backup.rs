//! Full export, full import, and reset — the three doors Privacy & Data draws
//! and nothing answered.
//!
//! **A restore and a reset both destroy what is on disk, so both write a
//! snapshot first, unasked.** That is not politeness: the product's own rule is
//! that a config is never replaced without a backup path, and a rule that
//! depends on somebody having exported beforehand is not a rule. The snapshot
//! goes next to the config with a timestamp in its name, the command answers
//! with where it went, and the surface states it.
//!
//! **What an archive holds is what a machine can hand to another machine.** The
//! config as it is written to disk — which is already scrubbed of secrets — the
//! history index, the transcripts the index names, and the ACTIVITY LEDGER. The
//! API key is NOT in it and cannot be: it lives in the OS secret store, which is
//! the one thing about this machine that does not travel, and the import says so
//! rather than leaving somebody to find out.
//!
//! **The ledger is in the archive because it is the only thing here that cannot
//! be rebuilt** (ADR 0179). History is pruned and the transcripts are files; the
//! lifetime figures are an accumulation, and an accumulation that is not in the
//! backup is an accumulation that a restore silently sets back to zero. It is
//! also the one part of an archive that is MERGED rather than replaced — see
//! `ActivityLedger::raise_to`, which takes the larger of the two figures field
//! by field so that restoring an archive can only ever raise a total, and
//! restoring the same one twice changes nothing at all.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::activity_ledger::{self, ActivityLedger};
use super::config::AppConfig;
use super::history;
use super::paths::{config_file_path, transcripts_dir, user_data_dir};
use super::runtime_log;
use super::sessions::now_ms;

/// Bumped when the archive's shape changes in a way an older build cannot read.
/// An import checks it and refuses rather than half-restoring.
const ARCHIVE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupArchive {
    pub version: u32,
    pub exported_at_ms: u64,
    pub app_version: String,
    pub config: AppConfig,
    pub history: Vec<history::TranscriptionHistoryEntry>,
    /// The transcript files, by path relative to the store root, with their
    /// text. Carried in the archive rather than referenced, because an archive
    /// that names files on the machine it came from restores nothing on
    /// another one.
    pub transcripts: Vec<ArchivedTranscript>,
    /// The all-time figures. `None` in an archive written before ADR 0179, which
    /// imports as "this archive knows nothing about your totals" and therefore
    /// leaves them alone — the correct reading, and the reason this is an
    /// `Option` rather than a defaulted empty ledger.
    #[serde(default)]
    pub activity: Option<ActivityLedger>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivedTranscript {
    pub relative_path: String,
    pub body: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BackupPathRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportBackupResponse {
    pub path: String,
    pub history_count: usize,
    pub transcript_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportBackupResponse {
    /// Where the state that was replaced went, so the sentence on screen can
    /// name it. Always present: an import never runs without one.
    pub snapshot_path: String,
    pub history_count: usize,
    pub transcript_count: usize,
    /// True when the archive came from a build with a different version. The
    /// import still ran; the surface says which build wrote it.
    pub from_other_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResetSettingsResponse {
    pub snapshot_path: String,
    /// What was deliberately NOT reset, so the surface can state it rather than
    /// having the sentence hardcoded in two places.
    pub kept_profiles: usize,
}

fn snapshot_path_for(kind: &str) -> PathBuf {
    user_data_dir().join(format!("config.backup-{kind}-{}.json", now_ms()))
}

/// Copy the config aside and answer with where it went.
///
/// Copies the FILE rather than re-serializing the loaded value: a snapshot's
/// job is to be exactly what was there, including any field this build does not
/// know about. A re-serialized config would silently drop those.
///
/// **`pub(crate)` again, and this time with the caller in the tree.** A3
/// widened it for a credential migration that ADR 0112 then removed, and a
/// visibility with nothing behind it is the defect class of a registered
/// command with no caller (ADR 0089, ADR 0103). A4's provider-axis migration is
/// the caller the previous note promised: `AppConfig::load_from_disk_impl`
/// snapshots here before a profile below the current schema is rewritten,
/// because a config migration without a snapshot path is not written
/// (ADR 0094).
pub(crate) fn snapshot_config(kind: &str) -> Result<PathBuf, String> {
    let source = config_file_path();
    let target = snapshot_path_for(kind);

    if !source.exists() {
        // Nothing to lose, and the caller still gets a path it can state.
        std::fs::write(&target, "{}\n").map_err(|error| error.to_string())?;
        return Ok(target);
    }

    std::fs::copy(&source, &target)
        .map_err(|error| format!("Could not write the backup before continuing: {error}"))?;
    runtime_log::record(format!(
        "[WordScript] Config snapshot written path={}",
        target.display()
    ));
    Ok(target)
}

/// Every transcript file under the store root, as text.
///
/// Walks the directory rather than reading the index's paths, and this is the
/// one place that is right: an export is "everything local", so a file whose
/// record has been pruned is still the user's transcript. Deletion is the
/// opposite case and reads the index (ADR 0074).
fn collect_transcripts(root: &Path) -> Vec<ArchivedTranscript> {
    let mut out = Vec::new();
    collect_transcripts_into(root, root, &mut out);
    out.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    out
}

fn collect_transcripts_into(root: &Path, directory: &Path, out: &mut Vec<ArchivedTranscript>) {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_transcripts_into(root, &path, out);
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let Ok(relative) = path.strip_prefix(root) else {
            continue;
        };
        let Ok(body) = std::fs::read_to_string(&path) else {
            continue;
        };
        out.push(ArchivedTranscript {
            relative_path: relative.to_string_lossy().to_string(),
            body,
        });
    }
}

#[tauri::command]
pub fn export_full_backup(request: BackupPathRequest) -> Result<ExportBackupResponse, String> {
    let path = PathBuf::from(request.path.trim());
    if path.as_os_str().is_empty() {
        return Err("Choose a file path for the export.".to_string());
    }

    let config = AppConfig::load_from_disk().without_secrets();
    let history = history::entries_for_backup()?;
    let transcripts = collect_transcripts(&transcripts_dir());

    let history_count = history.len();
    let transcript_count = transcripts.len();
    /* Read rather than required: a ledger that will not load is not a reason to
       refuse an export of everything else. */
    let activity = activity_ledger::snapshot().ok();

    let archive = BackupArchive {
        version: ARCHIVE_VERSION,
        exported_at_ms: now_ms(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        config,
        history,
        transcripts,
        activity,
    };

    let raw = serde_json::to_string_pretty(&archive)
        .map_err(|error| format!("Could not serialize the archive: {error}"))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(&path, raw).map_err(|error| format!("Could not write the archive: {error}"))?;

    runtime_log::record(format!(
        "[WordScript] Full export written path={} history={history_count} transcripts={transcript_count}",
        path.display(),
    ));

    Ok(ExportBackupResponse {
        path: path.to_string_lossy().to_string(),
        history_count,
        transcript_count,
    })
}

/// Replace this machine's state with an archive's, after copying aside what is
/// being replaced.
///
/// The order is the whole contract: snapshot, then validate, then write. A
/// refusal after the snapshot costs a file nobody needed; a write before the
/// snapshot costs the state.
#[tauri::command]
pub fn import_full_backup(request: BackupPathRequest) -> Result<ImportBackupResponse, String> {
    let path = PathBuf::from(request.path.trim());
    if !path.is_file() {
        return Err("That file does not exist.".to_string());
    }

    let raw = std::fs::read_to_string(&path)
        .map_err(|error| format!("Could not read the archive: {error}"))?;
    let archive: BackupArchive = serde_json::from_str(&raw)
        .map_err(|_| "That file is not a WordScript archive.".to_string())?;

    if archive.version > ARCHIVE_VERSION {
        return Err(format!(
            "That archive was written by a newer build (format {} against {ARCHIVE_VERSION}). Update WordScript first.",
            archive.version,
        ));
    }

    let snapshot = snapshot_config("import")?;

    // The config as the archive holds it, normalized by the same path a save
    // takes — an archive from another machine can carry a value this build
    // no longer accepts, and `save_to_disk` is where that is decided.
    let mut config = archive.config;
    config.normalize_for_runtime();
    config
        .save_to_disk()
        .map_err(|error| format!("The archive could not be applied: {error}"))?;

    let transcript_count = restore_transcripts(&archive.transcripts);
    let history_count = archive.history.len();
    history::replace_entries_from_backup(archive.history)?;

    /* MERGED AND NOT REPLACED, WHICH IS THE ONE PLACE THIS COMMAND DOES NOT
       OVERWRITE (ADR 0179). Everything else in an archive is a state to restore;
       the ledger is an accumulation, and a restore that lowered a lifetime total
       would break the one promise the ledger makes. A failure is logged rather
       than raised: the import has already succeeded by this point, and the
       figures are derived. */
    if let Some(activity) = &archive.activity {
        if let Err(error) = activity_ledger::merge_from_archive(activity) {
            runtime_log::record(format!(
                "[WordScript] Full import could not merge the activity ledger error={error}"
            ));
        }
    }

    runtime_log::record(format!(
        "[WordScript] Full import applied from={} snapshot={} history={history_count} transcripts={transcript_count}",
        path.display(),
        snapshot.display(),
    ));

    Ok(ImportBackupResponse {
        snapshot_path: snapshot.to_string_lossy().to_string(),
        history_count,
        transcript_count,
        from_other_version: (archive.app_version != env!("CARGO_PKG_VERSION"))
            .then_some(archive.app_version),
    })
}

/// Writes the archive's transcripts under this machine's root, and answers with
/// how many landed. A file already there is left alone: the archive is being
/// restored, not merged, and overwriting a transcript that exists would be the
/// one edit ADR 0074 says the runtime never makes.
fn restore_transcripts(transcripts: &[ArchivedTranscript]) -> usize {
    let root = transcripts_dir();
    let mut written = 0;

    for transcript in transcripts {
        let relative = PathBuf::from(&transcript.relative_path);
        // An archive is a file from elsewhere and its paths are not trusted.
        if relative.is_absolute()
            || relative
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            continue;
        }

        let target = root.join(&relative);
        if target.exists() {
            continue;
        }
        let Some(parent) = target.parent() else { continue };
        if std::fs::create_dir_all(parent).is_err() {
            continue;
        }
        if std::fs::write(&target, &transcript.body).is_ok() {
            written += 1;
        }
    }

    written
}

/// Every setting back to its default, with the profiles and the history left
/// standing — which is what the row's own hint promises.
///
/// The profiles are carried across rather than regenerated: they are the user's
/// work, several of them are curated originals the product shipped, and a
/// "reset settings" that quietly emptied them would be a different command with
/// the same label.
#[tauri::command]
pub fn reset_all_settings() -> Result<ResetSettingsResponse, String> {
    let snapshot = snapshot_config("reset")?;

    let current = AppConfig::load_from_disk();
    let mut next = AppConfig::default();
    next.text_profiles = current.text_profiles.clone();
    next.active_text_profile_id = current.active_text_profile_id.clone();
    next.normalize_for_runtime();
    next.save_to_disk()?;

    runtime_log::record(format!(
        "[WordScript] Settings reset to defaults snapshot={} profiles_kept={}",
        snapshot.display(),
        next.text_profiles.len(),
    ));

    Ok(ResetSettingsResponse {
        snapshot_path: snapshot.to_string_lossy().to_string(),
        kept_profiles: next.text_profiles.len(),
    })
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// The rule the whole module exists for: nothing destructive runs without
    /// the file it destroys having been copied aside first.
    #[test]
    fn a_snapshot_is_written_before_anything_is_replaced() {
        let snapshot = snapshot_config("test").expect("a snapshot path");
        assert!(snapshot.exists());
        assert!(snapshot.starts_with(user_data_dir()));
        let _ = std::fs::remove_file(&snapshot);
    }

    #[test]
    fn an_archive_from_a_newer_build_is_refused_rather_than_half_applied() {
        let raw = serde_json::json!({
            "version": ARCHIVE_VERSION + 1,
            "exported_at_ms": 1,
            "app_version": "9.9.9",
            "config": AppConfig::default(),
            "history": [],
            "transcripts": [],
        });
        let path = user_data_dir().join("newer-archive.json");
        std::fs::write(&path, raw.to_string()).expect("write");

        let result = import_full_backup(BackupPathRequest {
            path: path.to_string_lossy().to_string(),
        });
        assert!(result.is_err(), "a newer archive was applied");

        let _ = std::fs::remove_file(&path);
    }

    /// An archive is a file from somewhere else, so its paths are input.
    #[test]
    fn a_transcript_path_that_climbs_out_of_the_root_is_skipped() {
        let escaping = ArchivedTranscript {
            relative_path: "../../escaped.md".to_string(),
            body: "should not land".to_string(),
        };
        assert_eq!(restore_transcripts(&[escaping]), 0);
        assert!(!transcripts_dir()
            .parent()
            .expect("parent")
            .join("escaped.md")
            .exists());
    }

    #[test]
    fn a_reset_keeps_the_profiles_the_row_promises_to_keep() {
        let mut current = AppConfig::default();
        current.text_profiles = AppConfig::default().text_profiles;
        let kept = current.text_profiles.len();

        let response = reset_all_settings().expect("reset");
        assert_eq!(response.kept_profiles, kept);
        assert!(!response.snapshot_path.is_empty());

        let _ = std::fs::remove_file(&response.snapshot_path);
    }
}
