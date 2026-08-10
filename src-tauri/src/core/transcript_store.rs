//! The transcript as a file on disk (ADR 0074, SETTINGS_REWORK_PLAN §11.23).
//!
//! Every record that produced text is also a Markdown file under
//! `~/WordScript/transcripts/<YYYY>/<MM>/<DD-HHMM>-<slug>.md`. `history.json`
//! stays the index and carries the path; this module owns the directory, the
//! slug, the collision suffix and the write, and nothing else writes there.
//!
//! **The runtime creates a file once and later deletes it. It never edits one.**
//! That is the invariant the whole design is arranged around, and it is why the
//! record is one file per transcript rather than one file per day: an appended
//! day file would be rewritten under a reader who has it open, and a delete
//! would rewrite it again. Here a file is immutable from the moment it lands.
//!
//! **The runtime deletes only paths an entry named.** Removal is driven by
//! `transcript_path` on a history entry, never by walking the directory. A
//! sweep that read the folder would eventually delete a file the reader put
//! there or renamed, and this folder is theirs.

use std::path::{Path, PathBuf};

use chrono::{Local, TimeZone};

use super::config::ProcessingMode;
use super::insertion::NativeInsertMode;
use super::paths::transcripts_dir;
use super::runtime_log;

/// What the file states about the record it holds. Assembled by the caller from
/// the entry it is about to persist, so this module needs to know nothing about
/// history's own shape.
#[derive(Debug, Clone, Default)]
pub struct TranscriptDocument {
    pub id: String,
    pub created_at_ms: u64,
    /// The written text — the body of the document. A record with none gets no
    /// file at all, which is the caller's check as well as this module's.
    pub written: String,
    /// What the recogniser heard. Written under a `## Heard` heading only when
    /// it differs from the written text: a Verbatim transcript has one text,
    /// and printing it twice would make every Verbatim file claim an AI stage
    /// ran over it.
    pub heard: Option<String>,
    pub profile: Option<String>,
    pub mode: Option<ProcessingMode>,
    pub provider: String,
    pub model: Option<String>,
    pub insert_mode: Option<NativeInsertMode>,
    /// Present only while the capture is still on disk (ADR 0039).
    pub audio_path: Option<String>,
}

/// The three delivery words §11.23's frontmatter uses. Deliberately coarser
/// than `NativeInsertMode`: the file answers "did this reach the cursor", and
/// the index keeps the full mode for the surface that needs to tell a fallback
/// from a preference.
fn delivery_word(insert_mode: Option<&NativeInsertMode>) -> &'static str {
    match insert_mode {
        Some(NativeInsertMode::DirectPaste) => "insert",
        Some(NativeInsertMode::ClipboardOnly) | Some(NativeInsertMode::ClipboardFallback) => {
            "clipboard"
        }
        Some(NativeInsertMode::ScratchpadFallback) => "failed",
        None => "failed",
    }
}

/// Lowercase, ASCII-ish, hyphen-joined, bounded. Built from the first words of
/// the written text, which is §11.23's rule and which produces an honest name:
/// a one-line dictation has no title, and the first words are the closest
/// truthful thing to one.
///
/// Non-ASCII letters are KEPT rather than transliterated. The dictations this
/// product records are largely German, and a store that turned `Grüße` into
/// `gre` would produce names nobody recognises; every filesystem the product
/// targets takes UTF-8. What is stripped is only what a path cannot carry.
fn slugify(text: &str) -> String {
    let mut slug = String::new();
    let mut pending_dash = false;

    for character in text.chars() {
        if slug.chars().count() >= SLUG_MAX_CHARS {
            break;
        }

        if character.is_alphanumeric() {
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            pending_dash = false;
            for lowered in character.to_lowercase() {
                slug.push(lowered);
            }
        } else {
            pending_dash = true;
        }
    }

    if slug.is_empty() {
        "transcript".to_string()
    } else {
        slug
    }
}

const SLUG_MAX_CHARS: usize = 48;

/// `<root>/<YYYY>/<MM>/<DD-HHMM>-<slug>.md`, with a numeric suffix when that
/// name is taken. Two dictations inside one minute are ordinary — the suffix is
/// the collision rule §11.23 asks for and not an error path.
fn resolve_path(root: &Path, created_at_ms: u64, slug: &str) -> Option<PathBuf> {
    let at = Local.timestamp_millis_opt(created_at_ms as i64).single()?;
    let directory = root
        .join(at.format("%Y").to_string())
        .join(at.format("%m").to_string());
    let stem = format!("{}-{}", at.format("%d-%H%M"), slug);

    let mut candidate = directory.join(format!("{stem}.md"));
    let mut suffix = 2;
    while candidate.exists() {
        candidate = directory.join(format!("{stem}-{suffix}.md"));
        suffix += 1;
        if suffix > 99 {
            return None;
        }
    }
    Some(candidate)
}

/// The document, as it lands on disk.
///
/// `duration_ms` is in §11.23's frontmatter and is NOT written, because the
/// history record does not carry one. An invented number in a field somebody
/// may later read as measurement is worse than an absent field, and this is the
/// same rule the surface follows (rule 7). It goes in when the record grows a
/// duration.
fn render(document: &TranscriptDocument) -> Option<String> {
    let at = Local.timestamp_millis_opt(document.created_at_ms as i64).single()?;

    let mut out = String::new();
    out.push_str("---\n");
    out.push_str(&format!("id: {}\n", document.id));
    out.push_str(&format!("created: {}\n", at.to_rfc3339()));
    if let Some(profile) = document.profile.as_deref().filter(|v| !v.trim().is_empty()) {
        out.push_str(&format!("profile: {profile}\n"));
    }
    if let Some(mode) = document.mode.as_ref() {
        out.push_str(&format!("mode: {}\n", mode.as_str()));
    }
    out.push_str(&format!("provider: {}\n", document.provider));
    if let Some(model) = document.model.as_deref().filter(|v| !v.trim().is_empty()) {
        out.push_str(&format!("model: {model}\n"));
    }
    out.push_str(&format!(
        "delivery: {}\n",
        delivery_word(document.insert_mode.as_ref())
    ));
    if let Some(audio) = document.audio_path.as_deref().filter(|v| !v.trim().is_empty()) {
        out.push_str(&format!("audio: {audio}\n"));
    }
    out.push_str("---\n\n");

    out.push_str(document.written.trim());
    out.push('\n');

    // Only when the two differ, and compared on trimmed text so that trailing
    // whitespace alone never manufactures a `## Heard` section.
    if let Some(heard) = document.heard.as_deref().map(str::trim) {
        if !heard.is_empty() && heard != document.written.trim() {
            out.push_str("\n## Heard\n\n");
            out.push_str(heard);
            out.push('\n');
        }
    }

    Some(out)
}

/// Write the document and answer with the path it took, or `None` when there
/// was nothing to write.
///
/// A failure to write is logged and swallowed. The file is the readable form of
/// a record whose authoritative copy is already in `history.json`, so a full
/// disk must not cost the user the transcript itself — it costs them the file,
/// and the runtime log says so.
pub fn write_transcript(document: &TranscriptDocument) -> Option<String> {
    if document.written.trim().is_empty() {
        return None;
    }

    let root = transcripts_dir();
    let slug = slugify(&document.written);
    let path = resolve_path(&root, document.created_at_ms, &slug)?;
    let body = render(document)?;

    if let Some(parent) = path.parent() {
        if let Err(error) = std::fs::create_dir_all(parent) {
            runtime_log::record(format!(
                "[WordScript] Transcript file directory failed path={} error={error}",
                parent.display(),
            ));
            return None;
        }
    }

    match std::fs::write(&path, body) {
        Ok(()) => Some(path.to_string_lossy().to_string()),
        Err(error) => {
            runtime_log::record(format!(
                "[WordScript] Transcript file write failed path={} error={error}",
                path.display(),
            ));
            None
        }
    }
}

/// Remove a file a record named, and prune the day and year directories behind
/// it once they are empty.
///
/// Only ever called with a path that came off an entry (ADR 0074). A missing
/// file is not an error: the reader may have moved it, and the record is being
/// deleted either way.
pub fn remove_transcript(path: &str) {
    let path = PathBuf::from(path);
    // The store's own root is the boundary. A `transcript_path` that points
    // outside it is not this module's to delete — a config carried over from
    // another machine, or a hand-edited history file, must not turn a delete
    // into an arbitrary unlink.
    let root = transcripts_dir();
    if !path.starts_with(&root) {
        runtime_log::record(format!(
            "[WordScript] Transcript file delete refused outside root path={}",
            path.display(),
        ));
        return;
    }

    if let Err(error) = std::fs::remove_file(&path) {
        if error.kind() != std::io::ErrorKind::NotFound {
            runtime_log::record(format!(
                "[WordScript] Transcript file delete failed path={} error={error}",
                path.display(),
            ));
        }
        return;
    }

    // Empty month, then empty year. `remove_dir` refuses a directory with
    // anything in it, which is exactly the check wanted here.
    let mut parent = path.parent().map(Path::to_path_buf);
    while let Some(directory) = parent {
        if directory == root || !directory.starts_with(&root) {
            break;
        }
        if std::fs::remove_dir(&directory).is_err() {
            break;
        }
        parent = directory.parent().map(Path::to_path_buf);
    }
}

/// Where the transcripts are, for a surface that states it.
///
/// The root is answered whether or not it exists yet: History's foot names the
/// folder its records go to, and a machine that has not dictated anything since
/// ADR 0074 has no folder — the sentence is still true about where the next one
/// lands.
#[tauri::command]
pub fn transcript_store_status() -> TranscriptStoreStatus {
    let root = transcripts_dir();
    TranscriptStoreStatus {
        exists: root.is_dir(),
        root: root.to_string_lossy().to_string(),
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TranscriptStoreStatus {
    pub root: String,
    pub exists: bool,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RevealTranscriptRequest {
    /// A record's own file. Absent reveals the root instead, which is what the
    /// palette's entry does — it is about the collection rather than about one
    /// record.
    #[serde(default)]
    pub path: Option<String>,
}

/// Open the file manager on a transcript, or on the folder they live in.
///
/// **A path is only accepted inside the store's root.** The argument comes from
/// a renderer, and a reveal command that takes an arbitrary path is a way to
/// ask the runtime to open anything on the machine. The root, and the files
/// under it, are the whole surface this command has.
///
/// A record whose file is gone — deleted by hand, or moved — reveals the root
/// rather than failing: the answer to "where is this" is still the folder.
#[tauri::command]
pub fn reveal_transcript_in_file_manager(request: RevealTranscriptRequest) -> Result<(), String> {
    let root = transcripts_dir();

    let target = match request.path.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        Some(path) => {
            let path = PathBuf::from(path);
            if !path.starts_with(&root) {
                return Err("That path is not a transcript this machine wrote.".to_string());
            }
            if path.exists() {
                path
            } else {
                root.clone()
            }
        }
        None => root.clone(),
    };

    // The folder has to exist before anything can be opened on it, and on a
    // machine that has not dictated since ADR 0074 it does not yet.
    if !root.is_dir() {
        std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    }

    tauri_plugin_opener::reveal_item_in_dir(&target).map_err(|error| error.to_string())
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn document(written: &str) -> TranscriptDocument {
        TranscriptDocument {
            id: "history-1-0".to_string(),
            created_at_ms: 1_786_000_000_000,
            written: written.to_string(),
            heard: None,
            profile: Some("General writing".to_string()),
            mode: Some(ProcessingMode::Cleanup),
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            insert_mode: Some(NativeInsertMode::DirectPaste),
            audio_path: None,
        }
    }

    #[test]
    fn slug_takes_the_first_words_and_keeps_non_ascii_letters() {
        assert_eq!(slugify("Grüße an das Team!"), "grüße-an-das-team");
        assert_eq!(slugify("  hello   world  "), "hello-world");
    }

    #[test]
    fn slug_is_bounded_and_never_empty() {
        let long = "wort ".repeat(60);
        assert!(slugify(&long).chars().count() <= SLUG_MAX_CHARS);
        assert_eq!(slugify("...  ???"), "transcript");
    }

    #[test]
    fn a_record_with_no_text_produces_no_file() {
        assert_eq!(write_transcript(&document("   ")), None);
    }

    #[test]
    fn the_document_carries_the_frontmatter_and_the_written_text() {
        let rendered = render(&document("Ship the thing.")).expect("rendered");
        assert!(rendered.starts_with("---\n"));
        assert!(rendered.contains("id: history-1-0\n"));
        assert!(rendered.contains("profile: General writing\n"));
        assert!(rendered.contains("mode: cleanup\n"));
        assert!(rendered.contains("provider: groq\n"));
        assert!(rendered.contains("delivery: insert\n"));
        assert!(rendered.trim_end().ends_with("Ship the thing."));
    }

    /// The field is in §11.23 and the record has no source for it. Asserted so
    /// that a later leg adding a duration adds it deliberately rather than
    /// finding an invented one already there.
    #[test]
    fn no_duration_is_written_because_the_record_does_not_carry_one() {
        let rendered = render(&document("Ship the thing.")).expect("rendered");
        assert!(!rendered.contains("duration_ms"));
    }

    #[test]
    fn an_absent_audio_path_leaves_the_field_out_rather_than_writing_none() {
        let rendered = render(&document("Ship the thing.")).expect("rendered");
        assert!(!rendered.contains("audio:"));

        let mut kept = document("Ship the thing.");
        kept.audio_path = Some("/tmp/capture-3.wav".to_string());
        assert!(render(&kept).expect("rendered").contains("audio: /tmp/capture-3.wav\n"));
    }

    #[test]
    fn the_heard_text_is_written_only_when_it_differs() {
        let mut same = document("Ship the thing.");
        same.heard = Some("Ship the thing.".to_string());
        assert!(!render(&same).expect("rendered").contains("## Heard"));

        let mut differs = document("Ship the thing.");
        differs.heard = Some("ship the thin".to_string());
        let rendered = render(&differs).expect("rendered");
        assert!(rendered.contains("## Heard\n\nship the thin"));
    }

    #[test]
    fn a_second_transcript_in_the_same_minute_takes_a_suffix() {
        let root = transcripts_dir().join("collision-case");
        let _ = std::fs::remove_dir_all(&root);

        let first = resolve_path(&root, 1_786_000_000_000, "one").expect("path");
        std::fs::create_dir_all(first.parent().expect("parent")).expect("mkdir");
        std::fs::write(&first, "x").expect("write");

        let second = resolve_path(&root, 1_786_000_000_000, "one").expect("path");
        assert_ne!(first, second);
        assert!(second.to_string_lossy().ends_with("-2.md"));

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn writing_then_removing_leaves_no_empty_directories_behind() {
        // Its own year, because every other test in this process that records a
        // history entry now writes into this root too — the month directory is
        // only observably empty if nothing else is filing into it.
        let mut alone = document("A record that will be deleted again.");
        alone.created_at_ms = 1_000_000_000_000;

        let written = write_transcript(&alone).expect("a path");
        assert!(PathBuf::from(&written).exists());

        remove_transcript(&written);
        assert!(!PathBuf::from(&written).exists());

        // The month and year directories the write created are gone with it,
        // and the root itself is never removed.
        let month = PathBuf::from(&written).parent().expect("month").to_path_buf();
        assert!(!month.exists());
        assert!(!month.parent().expect("year").exists());
    }

    /// The guard that keeps a delete from becoming an arbitrary unlink.
    #[test]
    fn a_path_outside_the_root_is_never_deleted() {
        let outside = std::env::temp_dir().join("wordscript-not-a-transcript.md");
        std::fs::write(&outside, "keep me").expect("write");

        remove_transcript(&outside.to_string_lossy());
        assert!(outside.exists(), "a path outside the root was deleted");

        let _ = std::fs::remove_file(&outside);
    }
}
