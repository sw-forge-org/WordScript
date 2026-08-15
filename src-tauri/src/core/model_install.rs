//! In-app model installation for the local lane — B5, ADR 0122.
//!
//! **The surface has been drawn and dead since Leg 6.** `Models.tsx`'s
//! `MachineTab` draws both kinds of local model with a size per row, a
//! quantization, a `downloading` state with a percentage, an installed total and
//! *Open the model folder*; `Onboarding.tsx` draws the same rows in its
//! first-run step. This module is what goes behind them, and ADR 0042's gate —
//! *until in-app installation exists, the local lane is expert configuration and
//! the surface says so* — closes when it lands.
//!
//! # The two halves do not share a disk
//!
//! ADR 0042 argued one tab from a shared substrate, and half of that is not true
//! in this tree. The local chat role does not run a model; it talks to one
//! Ollama runs, and **Ollama owns its store**. A `.gguf` WordScript downloaded
//! into a folder of its own would be a file that server cannot see, cannot load
//! and will not list — it would appear in the installed total, consume the disk,
//! and serve no job.
//!
//! So the two mechanisms are:
//!
//! | Half | Owner | Mechanism |
//! | --- | --- | --- |
//! | Speech (`ggml-*.bin`) | WordScript | it downloads the file itself, into a directory it manages |
//! | Language (Ollama tags) | the server the user runs | it asks that server to pull, and never places a file beside it |
//!
//! The tab stays whole for the argument that survives contact with the tree:
//! a 4 GB language model and a 1.6 GB speech model compete for the RAM of the
//! machine that loads them, and a total split across two screens is invisible
//! exactly when it matters.
//!
//! # The four rules a download here obeys
//!
//! - **It is verified before it is named.** The bytes land in `<file>.part`,
//!   the SHA256 is checked against the catalogue row, and only then is the file
//!   renamed into place. There is no window in which half a model is spelled
//!   like a whole one.
//! - **The size is known before the first byte is requested.** Free space is
//!   checked against `size_bytes`, because the drawing promises the size and
//!   disk is the one ceiling the runtime can answer up front.
//! - **A late install is discarded, not applied.** One that finishes after its
//!   cancel is dropped and recorded in the runtime log only — the rule this
//!   track already holds for provider, transform and insert results against the
//!   active session, applied to the other place a slow result can outlive what
//!   wanted it.
//! - **Progress travels on its own channel.** `wordscript-model-event`, never
//!   `wordscript-event` and never `wordscript-native-event`. Those two are the
//!   session channels, and ADR 0018 and ADR 0019 spent a leg each establishing
//!   that one session ends in exactly one reducer commit. A download is not a
//!   session and must not be able to reach the reducer at all; the cheapest way
//!   to guarantee that is not to give it the door.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use crate::core::config::AppConfig;
use crate::core::model_catalogue::{self, InstallSource, ModelRow};
use crate::core::paths::user_data_dir;
use crate::core::providers::{local, ProviderRole};
use crate::core::runtime_log;

/// The one channel a model install speaks on (ADR 0122).
pub const MODEL_EVENT_CHANNEL: &str = "wordscript-model-event";

/// How often a running download reports itself. A chunk can be 8 KiB, and
/// emitting per chunk would put tens of thousands of events on the channel for
/// one 1.6 GB file — the surface draws a percentage, and a percentage does not
/// need more than this.
const PROGRESS_INTERVAL_MS: u128 = 250;

/// Free space demanded beyond the file itself, so an install cannot be the
/// thing that fills a disk to zero. Deliberately a fixed floor rather than a
/// percentage: what a machine needs to keep working is not proportional to what
/// is being downloaded onto it.
const FREE_SPACE_HEADROOM_BYTES: u64 = 512 * 1024 * 1024;

// ── Where an installed speech model lives ────────────────────────────────────

/// The directory WordScript manages, and the reason it hangs off
/// `core::paths::user_data_dir` rather than being resolved in this module: it
/// inherits `WORDSCRIPT_DATA_DIR` and the test redirection that keeps
/// `cargo test` out of the developer's real data.
pub fn managed_speech_model_dir() -> PathBuf {
    user_data_dir().join("models").join("speech")
}

/// The managed path for a `Download` row, whether or not the file is there yet.
fn managed_path_for(file_name: &str) -> PathBuf {
    managed_speech_model_dir().join(file_name)
}

// ── What the surface reads ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ManagedModelState {
    /// Catalogued, with an install block, and not on the disk.
    ///
    /// **A different sentence from *available*, and deliberately.** ADR 0106
    /// draws the same distinction one layer up between *no adapter*, *role
    /// denied* and *credential missing*; a row that says *installable* has told
    /// the truth about what it is, which is what the four invented fallback
    /// rows never did.
    Installable,
    Installing {
        install_id: String,
        received_bytes: u64,
    },
    Installed {
        /// What it actually occupies. Read off the disk for a download, taken
        /// from the catalogue for a pull, because the file is the server's and
        /// this build does not go looking in somebody else's store.
        bytes: u64,
    },
    /// The half that owns the file could not be asked.
    ///
    /// Only ever the language half: a directory that cannot be read is an
    /// error, but a server that is not running is the ordinary state of a
    /// machine that has not started Ollama. Saying *not installed* about it
    /// would be a claim about a disk nobody looked at.
    Unknown {
        detail: String,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct ManagedModelRow {
    /// The catalogue slug, or — for a model no catalogue row claims — the stem
    /// its file is named by. Every command below names a row by this string and
    /// never by a model id (ADR 0115).
    pub row: String,
    pub model_id: String,
    pub role: ProviderRole,
    /// `download` or `server_pull` — which card this row belongs on, answered
    /// by the runtime rather than inferred from the role by the drawing.
    pub mechanism: String,
    /// Whether this build knows the row from its catalogue or found the file on
    /// the disk (ADR 0159).
    ///
    /// **A `yours` row is the whole reason this field exists.** B5 listed the
    /// catalogue and called the result *what is on this machine*, which was
    /// false the moment somebody put their own `ggml-*.bin` in the folder: the
    /// runtime discovered it, resolved it and would happily transcribe with it,
    /// and the surface did not show it.
    pub origin: ModelOrigin,
    /// What it costs. The catalogue's figure for a row that is not installed
    /// yet, the file's own length once it is, and always the file's own length
    /// for a `yours` row — nothing else knows.
    pub size_bytes: u64,
    pub quantization: Option<String>,
    pub state: ManagedModelState,
    /// Where the file is, when there is one.
    pub path: Option<String>,
    /// Which folder it came from, for a row that is not in the managed
    /// directory — so a person with three sources can tell two `ggml-small.bin`
    /// apart.
    pub folder: Option<String>,
    /// Which profile runs this model, when one does. **The reason a removal can
    /// be refused by name** rather than with a shrug.
    pub in_use_by: Option<String>,
}

/// Where a row came from.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModelOrigin {
    /// `shared/model_catalogue.json` knows it: it has a size, a checksum and a
    /// source before anybody downloads anything.
    Catalogue,
    /// A file on this disk that no catalogue row claims.
    ///
    /// **It carries no checksum and is not asked for one.** The catalogue's
    /// checksum answers *did this download arrive intact*; a file somebody
    /// already has needs no such answer, and demanding one would make the
    /// feature refuse exactly the models it exists to accept. The donor takes
    /// the same position — Handy's custom rows are `url: None, sha256: None`.
    Yours,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalServerAnswer {
    pub base_url: String,
    pub reachable: bool,
    pub detail: String,
}

/// One place this build looks for a speech model (ADR 0159).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ModelFolder {
    pub path: String,
    /// Which kind of source it is, in the reader's words.
    pub kind: String,
    /// Whether this surface may remove it. An environment variable is somebody's
    /// shell profile and the managed directory is WordScript's own; neither is
    /// this screen's to delete.
    pub removable: bool,
    /// Whether it is there at all. A folder on an unmounted network share is
    /// not an error and not a missing model — it is a folder that is not
    /// mounted, and saying so is the whole difference.
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelLibrary {
    /// The managed directory, so *Open the model folder* opens the path the
    /// runtime resolved rather than one the frontend assembled.
    pub speech_dir: String,
    /// Every place a speech model may come from, highest rank first. The
    /// listing unions them; the rank decides which file runs (ADR 0159).
    pub folders: Vec<ModelFolder>,
    pub server: LocalServerAnswer,
    pub rows: Vec<ManagedModelRow>,
}

// ── The event ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModelInstallPhase {
    Started,
    Progress,
    Verifying,
    Installed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelInstallEvent {
    pub install_id: String,
    pub row: String,
    pub phase: ModelInstallPhase,
    pub received_bytes: u64,
    pub total_bytes: u64,
    pub detail: Option<String>,
}

/// Where a running install reports to.
///
/// **A closure rather than the `AppHandle` itself**, so the transfer and its
/// four rules can be exercised against the real network without a Tauri
/// application. The command below passes one that emits; the acceptance test at
/// the foot of this file passes one that collects. The alternative — an
/// `AppHandle` threaded into the download loop — would have made the one path
/// that writes to a user's disk the one path no test could run.
type Reporter<'a> = &'a (dyn Fn(ModelInstallEvent) + Send + Sync);

fn emit(app: &AppHandle, event: ModelInstallEvent) {
    let _ = app.emit(MODEL_EVENT_CHANNEL, event);
}

// ── The register of running installs ─────────────────────────────────────────

#[derive(Clone)]
struct RunningInstall {
    row: String,
    cancelled: Arc<AtomicBool>,
    received_bytes: Arc<Mutex<u64>>,
}

fn running() -> &'static Mutex<HashMap<String, RunningInstall>> {
    static RUNNING: OnceLock<Mutex<HashMap<String, RunningInstall>>> = OnceLock::new();
    RUNNING.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register(install_id: &str, row: &str) -> RunningInstall {
    let entry = RunningInstall {
        row: row.to_string(),
        cancelled: Arc::new(AtomicBool::new(false)),
        received_bytes: Arc::new(Mutex::new(0)),
    };
    if let Ok(mut map) = running().lock() {
        map.insert(install_id.to_string(), entry.clone());
    }
    entry
}

fn unregister(install_id: &str) {
    if let Ok(mut map) = running().lock() {
        map.remove(install_id);
    }
}

fn running_for_row(row: &str) -> Option<(String, u64)> {
    let map = running().lock().ok()?;
    map.iter().find(|(_, entry)| entry.row == row).map(|(id, entry)| {
        (
            id.clone(),
            entry.received_bytes.lock().map(|value| *value).unwrap_or(0),
        )
    })
}

/// A monotonic id per install, so a result that arrives after its cancel can be
/// told apart from the result of the install that replaced it.
fn next_install_id() -> String {
    use std::sync::atomic::AtomicU64;
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    format!("install-{}", COUNTER.fetch_add(1, Ordering::SeqCst))
}

// ── Free space ───────────────────────────────────────────────────────────────

/// How many bytes are free where a download would land, or `None` where this
/// build cannot answer.
///
/// **`None` is not zero and is not "plenty".** It is the same shape
/// `capture_limits_if_known` uses one axis over: a constraint this build cannot
/// compute is stated as unanswered rather than guessed in either direction, and
/// the caller proceeds instead of refusing an install because of its own
/// blindness. Implemented on unix through `statvfs`; the Windows equivalent
/// (`GetDiskFreeSpaceExW`) is not written here because it cannot be compiled or
/// run on this machine, and an unverified FFI call in a release path is a worse
/// answer than an honest absence.
fn available_bytes(dir: &Path) -> Option<u64> {
    #[cfg(unix)]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        let path = CString::new(dir.as_os_str().as_bytes()).ok()?;
        // SAFETY: `path` is a NUL-terminated C string that outlives the call,
        // and `stats` is a zeroed POD struct the call fills in. Nothing here
        // escapes the function.
        unsafe {
            let mut stats: libc::statvfs = std::mem::zeroed();
            if libc::statvfs(path.as_ptr(), &mut stats) != 0 {
                return None;
            }
            let block = if stats.f_frsize > 0 {
                stats.f_frsize as u64
            } else {
                stats.f_bsize as u64
            };
            Some(block.saturating_mul(stats.f_bavail as u64))
        }
    }

    #[cfg(not(unix))]
    {
        let _ = dir;
        None
    }
}

/// Whether a download of `size_bytes` may start here, and why not when it may
/// not.
fn free_space_refusal(dir: &Path, size_bytes: u64) -> Option<String> {
    let available = available_bytes(dir)?;
    let needed = size_bytes.saturating_add(FREE_SPACE_HEADROOM_BYTES);

    if available >= needed {
        return None;
    }

    Some(format!(
        "Not enough free space: this model needs {} and {} is free on {}.",
        format_bytes(size_bytes),
        format_bytes(available),
        dir.display(),
    ))
}

/// Decimal units, because that is what both sources publish about these files —
/// the Hugging Face file listing and the Ollama library page — and a surface
/// that said `4.4 GB` against a download page saying `4.7 GB` would be two
/// numbers for one fact. `formatUploadSize` in the frontend says MiB for the
/// opposite reason: upload ceilings are documented in MiB by every vendor that
/// states one.
pub fn format_bytes(bytes: u64) -> String {
    const GB: f64 = 1_000_000_000.0;
    const MB: f64 = 1_000_000.0;

    let value = bytes as f64;
    if value >= GB {
        format!("{:.1} GB", value / GB)
    } else {
        format!("{} MB", (value / MB).round() as u64)
    }
}

// ── Reading the library ──────────────────────────────────────────────────────

/// What is on this machine, per catalogued row.
///
/// **Nothing is offered as available that is not on the disk.** That is the
/// whole point of the read: `fallback_provider_profiles` used to invent `base`,
/// `small`, `medium` and `large-v3` whether or not a single one of them existed,
/// which is the fake-readiness defect the runtime rules forbid, sitting under
/// the one lane whose difficulty is that its dependencies are the user's
/// problem.
#[tauri::command]
pub fn model_library() -> Result<ModelLibrary, String> {
    let dir = managed_speech_model_dir();
    let config = AppConfig::load_from_disk();

    // Asked once for the whole language half rather than once per row: it is a
    // network call to a server that is usually not running, and four of them
    // would be four timeouts on a tab that merely opened.
    let server_tags = local::installed_local_chat_tags();
    let base_url = local::local_chat_base_url_for_display();
    let server = match &server_tags {
        Ok(_) => LocalServerAnswer {
            base_url: base_url.clone(),
            reachable: true,
            detail: "Answering.".to_string(),
        },
        Err(detail) => LocalServerAnswer {
            base_url: base_url.clone(),
            reachable: false,
            detail: detail.clone(),
        },
    };

    let mut rows: Vec<ManagedModelRow> = model_catalogue::installable_rows()
        .into_iter()
        .map(|row| managed_row(row, &dir, server_tags.as_deref(), &config))
        .collect();

    /* **AND EVERY FILE ON THE DISK THE CATALOGUE DOES NOT KNOW** (ADR 0159).
       Without this the tab is called *On this machine* and lists something
       else. A model somebody put in the managed folder, or in a folder they
       pointed WordScript at, is discovered by `core::providers::local`,
       resolvable by the decode path, and was invisible here. */
    rows.extend(your_own_rows(&rows, &config));

    Ok(ModelLibrary {
        speech_dir: dir.display().to_string(),
        folders: local::local_model_sources()
            .iter()
            .filter_map(|source| {
                let dir = source.dir()?;
                Some(ModelFolder {
                    path: dir.display().to_string(),
                    kind: source.kind_label().to_string(),
                    /* Only a folder the user added on this screen can be
                       removed from it. An environment variable is somebody's
                       shell profile and is not this surface's to edit, and the
                       managed directory is the one WordScript owns. */
                    removable: source.is_user_dir(),
                    exists: dir.is_dir(),
                })
            })
            .collect(),
        server,
        rows,
    })
}

/// Every `ggml-*.bin` this build can see that no catalogue row claims.
///
/// **The name is the stem, and that is deliberate.** A file on this disk is not
/// a vendor's model id — the one place B3 left a literal standing — so a row of
/// this kind is named by exactly what `core::providers::local` will resolve it
/// by, and choosing it writes that stem into the profile unchanged.
fn your_own_rows(catalogued: &[ManagedModelRow], config: &AppConfig) -> Vec<ManagedModelRow> {
    /* A catalogue row owns its stem even before it is downloaded: a user who
       drops `ggml-base.bin` in themselves has the catalogue's `base`, not a
       second model that happens to share a name. The catalogue row simply
       reports itself installed. */
    let claimed: Vec<String> = model_catalogue::installable_rows()
        .into_iter()
        .filter_map(|row| match row.install.as_ref()? {
            InstallSource::Download { file_name, .. } => Some(
                file_name
                    .strip_prefix("ggml-")
                    .and_then(|rest| rest.strip_suffix(".bin"))
                    .unwrap_or(file_name)
                    .to_string(),
            ),
            InstallSource::ServerPull { .. } => None,
        })
        .collect();

    let mut rows: Vec<ManagedModelRow> = Vec::new();

    for source in local::local_model_sources() {
        let Some(dir) = source.dir() else { continue };

        for stem in local::local_model_names_in_dir(dir) {
            if claimed.iter().any(|name| name == &stem) {
                continue;
            }
            /* The highest-ranked source that offers a stem is the one that
               runs it, so it is the one listed. The rest are the same model. */
            if rows.iter().any(|row| row.row == stem) {
                continue;
            }

            let path = dir.join(format!("ggml-{stem}.bin"));
            let bytes = actual_bytes(&path, dir, &stem);

            rows.push(ManagedModelRow {
                row: stem.clone(),
                model_id: format!("ggml-{stem}"),
                role: ProviderRole::Speech,
                mechanism: "download".to_string(),
                origin: ModelOrigin::Yours,
                size_bytes: bytes,
                quantization: None,
                state: ManagedModelState::Installed { bytes },
                path: Some(path.display().to_string()),
                folder: Some(dir.display().to_string()),
                in_use_by: profile_using_local_stem(&stem, config),
            });
        }
    }

    let _ = catalogued;
    rows
}

/// What a discovered file occupies. Falls back to a directory walk because the
/// discovery matches more spellings than `ggml-{stem}.bin` — `ggml-large-v3-q5_0.bin`
/// is one stem to the resolver and a different file name on the disk.
fn actual_bytes(exact: &Path, dir: &Path, stem: &str) -> u64 {
    if let Ok(meta) = std::fs::metadata(exact) {
        if meta.is_file() {
            return meta.len();
        }
    }

    std::fs::read_dir(dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| entry.ok())
        .find(|entry| {
            entry
                .file_name()
                .to_str()
                .is_some_and(|name| name.eq_ignore_ascii_case(&format!("ggml-{stem}.bin")))
        })
        .and_then(|entry| entry.metadata().ok())
        .map(|meta| meta.len())
        .unwrap_or(0)
}

fn managed_row(
    row: &ModelRow,
    dir: &Path,
    server_tags: Result<&[String], &String>,
    config: &AppConfig,
) -> ManagedModelRow {
    let install = row.install.as_ref().expect("installable_rows filtered");
    let in_use_by = profile_using(row, config);

    let (mechanism, state, path) = match install {
        InstallSource::Download { file_name, .. } => {
            let target = dir.join(file_name);
            let state = if let Some((install_id, received_bytes)) = running_for_row(&row.id) {
                ManagedModelState::Installing {
                    install_id,
                    received_bytes,
                }
            } else {
                match std::fs::metadata(&target) {
                    Ok(meta) if meta.is_file() => ManagedModelState::Installed {
                        // The file's own size, not the catalogue's. They agree
                        // after a verified install; if they ever do not, the
                        // disk is the one telling the truth.
                        bytes: meta.len(),
                    },
                    _ => ManagedModelState::Installable,
                }
            };
            let path = matches!(state, ManagedModelState::Installed { .. })
                .then(|| target.display().to_string());
            ("download".to_string(), state, path)
        }
        InstallSource::ServerPull {
            tag, size_bytes, ..
        } => {
            let state = if let Some((install_id, received_bytes)) = running_for_row(&row.id) {
                ManagedModelState::Installing {
                    install_id,
                    received_bytes,
                }
            } else {
                match server_tags {
                    Ok(tags) => {
                        if tags.iter().any(|installed| installed == tag) {
                            ManagedModelState::Installed { bytes: *size_bytes }
                        } else {
                            ManagedModelState::Installable
                        }
                    }
                    Err(detail) => ManagedModelState::Unknown {
                        detail: detail.clone(),
                    },
                }
            };
            ("server_pull".to_string(), state, None)
        }
    };

    ManagedModelRow {
        row: row.id.clone(),
        model_id: row.model_id.clone(),
        role: row.role,
        mechanism,
        origin: ModelOrigin::Catalogue,
        size_bytes: match state {
            /* Once it is on the disk the file's own length is the honest
               number; before that the catalogue's figure is all anyone has. */
            ManagedModelState::Installed { bytes } if bytes > 0 => bytes,
            _ => install.size_bytes(),
        },
        quantization: install.quantization().map(str::to_string),
        state,
        path,
        folder: None,
        in_use_by,
    }
}

/// Which profile runs this model, by its drawn label.
///
/// **The reason a removal names the profile it refuses for.** Deleting the model
/// your dictation runs on and discovering it at the next capture is the
/// fake-state defect with the user's own action as its cause, which is the shape
/// ADR 0105's credential adoption was written to avoid one axis over.
///
/// The machine-wide fields are checked as well as the per-profile ones, and
/// under a label that says which is which: A4 moved the answer onto the profile
/// and left the machine-wide value as the fallback a profile with no block
/// resolves to, so a model can be in use through either.
fn profile_using(row: &ModelRow, config: &AppConfig) -> Option<String> {
    let install = row.install.as_ref()?;

    let matches_value = |value: &str| -> bool {
        match install {
            // A speech row is named by its stem on the config side (`base`,
            // `large-v3`), never by the file name — a file on this disk is not
            // a vendor's model id, which is the one place B3 deliberately left
            // a literal standing.
            InstallSource::Download { file_name, .. } => {
                let stem = file_name
                    .strip_prefix("ggml-")
                    .and_then(|rest| rest.strip_suffix(".bin"))
                    .unwrap_or(file_name);
                local::normalized_local_model_name(value) == local::normalized_local_model_name(stem)
            }
            InstallSource::ServerPull { tag, .. } => value.trim() == tag,
        }
    };

    let speech_row = matches!(row.role, ProviderRole::Speech);

    for profile in &config.text_profiles {
        let speech = profile.resolved_speech();
        let hit = if speech_row {
            matches_value(&speech.local_model)
        } else {
            matches_value(&speech.local_correction_model)
                || matches_value(&speech.local_agent_model)
        };

        if hit {
            return Some(if profile.label.trim().is_empty() {
                profile.id.clone()
            } else {
                profile.label.clone()
            });
        }
    }

    let machine_wide = if speech_row {
        matches_value(&config.local_model)
    } else {
        matches_value(&config.local_correction_model) || matches_value(&config.local_agent_model)
    };

    machine_wide.then(|| "the machine-wide default".to_string())
}

/// The same question as `profile_using`, asked about a stem rather than a
/// catalogue row — the shape a `yours` row needs, since it has no row.
fn profile_using_local_stem(stem: &str, config: &AppConfig) -> Option<String> {
    let wanted = local::normalized_local_model_name(stem);

    for profile in &config.text_profiles {
        if local::normalized_local_model_name(&profile.resolved_speech().local_model) == wanted {
            return Some(if profile.label.trim().is_empty() {
                profile.id.clone()
            } else {
                profile.label.clone()
            });
        }
    }

    (local::normalized_local_model_name(&config.local_model) == wanted)
        .then(|| "the machine-wide default".to_string())
}

// ── Starting an install ──────────────────────────────────────────────────────

/// Begins an install and answers with its id.
///
/// Returns before the work is done, which is what makes the channel the answer:
/// a 1.6 GB download that resolved its `invoke` only on completion would be a
/// command the webview waits minutes on, and a webview that dies in the meantime
/// is the defect four legs have already found in exactly this shape.
#[tauri::command]
pub async fn install_model(app: AppHandle, row: String) -> Result<String, String> {
    let catalogue_row = model_catalogue::row(&row)
        .ok_or_else(|| format!("No catalogue row '{row}' — nothing to install."))?;
    let install = catalogue_row
        .install
        .as_ref()
        .ok_or_else(|| format!("'{row}' is not a model this build installs."))?;

    if running_for_row(&row).is_some() {
        return Err(format!("'{row}' is already installing."));
    }

    let install_id = next_install_id();
    let total_bytes = install.size_bytes();
    let entry = register(&install_id, &row);

    emit(
        &app,
        ModelInstallEvent {
            install_id: install_id.clone(),
            row: row.clone(),
            phase: ModelInstallPhase::Started,
            received_bytes: 0,
            total_bytes,
            detail: None,
        },
    );
    runtime_log::record(format!(
        "[WordScript] Model install started id={install_id} row={row} bytes={total_bytes}"
    ));

    let handle = app.clone();
    let source = install.clone();
    let started_row = row.clone();
    let started_id = install_id.clone();

    tauri::async_runtime::spawn(async move {
        let reporting_handle = handle.clone();
        let report = move |event: ModelInstallEvent| emit(&reporting_handle, event);

        let outcome = match &source {
            InstallSource::Download {
                url,
                file_name,
                size_bytes,
                sha256,
                ..
            } => {
                run_download(
                    &report,
                    &started_id,
                    &started_row,
                    url,
                    file_name,
                    *size_bytes,
                    sha256,
                    &entry,
                )
                .await
            }
            InstallSource::ServerPull { tag, .. } => {
                run_server_pull(&report, &started_id, &started_row, tag, total_bytes, &entry).await
            }
        };

        unregister(&started_id);

        let cancelled = entry.cancelled.load(Ordering::SeqCst);
        let received = entry.received_bytes.lock().map(|value| *value).unwrap_or(0);

        match outcome {
            /* THE LATE RESULT, DISCARDED. An install that completed after its
               cancel reaches the runtime log and nothing else — the rule the
               track already holds for provider, transform and insert results
               against the active session. */
            Ok(()) if cancelled => {
                runtime_log::record(format!(
                    "[WordScript] Model install completed after cancel, discarded id={started_id} row={started_row}"
                ));
                emit(
                    &handle,
                    ModelInstallEvent {
                        install_id: started_id.clone(),
                        row: started_row.clone(),
                        phase: ModelInstallPhase::Cancelled,
                        received_bytes: received,
                        total_bytes,
                        detail: Some("Cancelled — nothing was installed.".to_string()),
                    },
                );
            }
            Ok(()) => {
                runtime_log::record(format!(
                    "[WordScript] Model install done id={started_id} row={started_row}"
                ));
                emit(
                    &handle,
                    ModelInstallEvent {
                        install_id: started_id.clone(),
                        row: started_row.clone(),
                        phase: ModelInstallPhase::Installed,
                        received_bytes: total_bytes,
                        total_bytes,
                        detail: None,
                    },
                );
            }
            Err(InstallFailure::Cancelled) => {
                runtime_log::record(format!(
                    "[WordScript] Model install cancelled id={started_id} row={started_row}"
                ));
                emit(
                    &handle,
                    ModelInstallEvent {
                        install_id: started_id.clone(),
                        row: started_row.clone(),
                        phase: ModelInstallPhase::Cancelled,
                        received_bytes: received,
                        total_bytes,
                        detail: Some("Cancelled — nothing was installed.".to_string()),
                    },
                );
            }
            Err(InstallFailure::Failed(detail)) => {
                runtime_log::record(format!(
                    "[WordScript] Model install failed id={started_id} row={started_row}: {detail}"
                ));
                emit(
                    &handle,
                    ModelInstallEvent {
                        install_id: started_id.clone(),
                        row: started_row.clone(),
                        phase: ModelInstallPhase::Failed,
                        received_bytes: received,
                        total_bytes,
                        detail: Some(detail),
                    },
                );
            }
        }
    });

    Ok(install_id)
}

enum InstallFailure {
    Cancelled,
    Failed(String),
}

fn failed(message: impl Into<String>) -> InstallFailure {
    InstallFailure::Failed(message.into())
}

#[allow(clippy::too_many_arguments)]
async fn run_download(
    report: Reporter<'_>,
    install_id: &str,
    row: &str,
    url: &str,
    file_name: &str,
    size_bytes: u64,
    expected_sha256: &str,
    entry: &RunningInstall,
) -> Result<(), InstallFailure> {
    let dir = managed_speech_model_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|error| failed(format!("Could not create {}: {error}", dir.display())))?;

    if let Some(refusal) = free_space_refusal(&dir, size_bytes) {
        return Err(failed(refusal));
    }

    let target = dir.join(file_name);
    let part = dir.join(format!("{file_name}.part"));
    // A part file left by a process that died is not resumable state — the hash
    // of a partial file says nothing — so it is removed rather than appended to.
    let _ = std::fs::remove_file(&part);

    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|error| failed(format!("Could not reach {url}: {error}")))?;

    if !response.status().is_success() {
        return Err(failed(format!(
            "{url} answered HTTP {}",
            response.status()
        )));
    }

    let mut response = response;
    let mut file = std::fs::File::create(&part)
        .map_err(|error| failed(format!("Could not write {}: {error}", part.display())))?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut last_report = std::time::Instant::now();

    loop {
        if entry.cancelled.load(Ordering::SeqCst) {
            drop(file);
            let _ = std::fs::remove_file(&part);
            return Err(InstallFailure::Cancelled);
        }

        let chunk = match response.chunk().await {
            Ok(Some(chunk)) => chunk,
            Ok(None) => break,
            Err(error) => {
                drop(file);
                let _ = std::fs::remove_file(&part);
                return Err(failed(format!("The download stopped: {error}")));
            }
        };

        use std::io::Write;
        if let Err(error) = file.write_all(&chunk) {
            drop(file);
            let _ = std::fs::remove_file(&part);
            return Err(failed(format!(
                "Could not write {}: {error}",
                part.display()
            )));
        }
        hasher.update(&chunk);
        received = received.saturating_add(chunk.len() as u64);
        if let Ok(mut value) = entry.received_bytes.lock() {
            *value = received;
        }

        if last_report.elapsed().as_millis() >= PROGRESS_INTERVAL_MS {
            last_report = std::time::Instant::now();
            report(ModelInstallEvent {
                install_id: install_id.to_string(),
                row: row.to_string(),
                phase: ModelInstallPhase::Progress,
                received_bytes: received,
                total_bytes: size_bytes,
                detail: None,
            });
        }
    }

    drop(file);

    report(ModelInstallEvent {
        install_id: install_id.to_string(),
        row: row.to_string(),
        phase: ModelInstallPhase::Verifying,
        received_bytes: received,
        total_bytes: size_bytes,
        detail: None,
    });

    let digest = hex_of(&hasher.finalize());
    if digest != expected_sha256 {
        let _ = std::fs::remove_file(&part);
        return Err(failed(format!(
            "The downloaded file does not match its checksum and was discarded (expected {expected_sha256}, got {digest})."
        )));
    }

    /* Checked again after the hash and before the rename. A cancel that arrives
       during verification must not produce an installed file — the whole point
       of the part-file dance is that nothing is named until it is both complete
       and wanted. */
    if entry.cancelled.load(Ordering::SeqCst) {
        let _ = std::fs::remove_file(&part);
        return Err(InstallFailure::Cancelled);
    }

    std::fs::rename(&part, &target).map_err(|error| {
        let _ = std::fs::remove_file(&part);
        failed(format!(
            "Could not put the model in place at {}: {error}",
            target.display()
        ))
    })?;

    Ok(())
}

async fn run_server_pull(
    report: Reporter<'_>,
    install_id: &str,
    row: &str,
    tag: &str,
    total_bytes: u64,
    entry: &RunningInstall,
) -> Result<(), InstallFailure> {
    let base_url = local::local_chat_base_url().map_err(failed)?;

    let response = reqwest::Client::new()
        .post(format!("{base_url}/api/pull"))
        .json(&serde_json::json!({ "model": tag, "stream": true }))
        .send()
        .await
        .map_err(|error| {
            failed(format!(
                "Could not reach the local model server at {base_url}: {error}. Start Ollama, or point WordScript at the server you run."
            ))
        })?;

    if !response.status().is_success() {
        return Err(failed(format!(
            "{base_url}/api/pull answered HTTP {} for '{tag}'",
            response.status()
        )));
    }

    let mut response = response;
    let mut buffer = String::new();
    let mut last_report = std::time::Instant::now();
    let mut saw_success = false;

    loop {
        if entry.cancelled.load(Ordering::SeqCst) {
            /* **The server is not asked to stop, and the difference is stated
               rather than hidden.** Ollama owns the pull; dropping the response
               ends WordScript's interest in it, and a pull that finishes
               anyway leaves a model on a disk this build does not manage. The
               surface says the install was cancelled, which is true of the
               install; it does not claim the file is gone. */
            runtime_log::record(format!(
                "[WordScript] Model pull abandoned id={install_id} tag={tag} — the server owns the transfer"
            ));
            return Err(InstallFailure::Cancelled);
        }

        let chunk = match response.chunk().await {
            Ok(Some(chunk)) => chunk,
            Ok(None) => break,
            Err(error) => return Err(failed(format!("The pull stopped: {error}"))),
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline) = buffer.find('\n') {
            let line: String = buffer.drain(..=newline).collect();
            match parse_pull_line(line.trim()) {
                PullLine::Ignored => {}
                PullLine::Error(detail) => return Err(failed(detail)),
                PullLine::Success => saw_success = true,
                PullLine::Progress { completed } => {
                    if let Ok(mut value) = entry.received_bytes.lock() {
                        *value = completed;
                    }
                    if last_report.elapsed().as_millis() >= PROGRESS_INTERVAL_MS {
                        last_report = std::time::Instant::now();
                        report(ModelInstallEvent {
                            install_id: install_id.to_string(),
                            row: row.to_string(),
                            phase: ModelInstallPhase::Progress,
                            received_bytes: completed,
                            total_bytes,
                            detail: None,
                        });
                    }
                }
            }
        }
    }

    // Whatever is left without a trailing newline is still a line.
    if !buffer.trim().is_empty() {
        match parse_pull_line(buffer.trim()) {
            PullLine::Error(detail) => return Err(failed(detail)),
            PullLine::Success => saw_success = true,
            _ => {}
        }
    }

    if !saw_success {
        return Err(failed(format!(
            "The server never reported '{tag}' as pulled."
        )));
    }

    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
enum PullLine {
    Ignored,
    Success,
    Error(String),
    Progress { completed: u64 },
}

#[derive(Debug, Deserialize)]
struct OllamaPullLine {
    #[serde(default)]
    status: String,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    completed: Option<u64>,
}

/// One NDJSON line of `POST /api/pull`.
///
/// **An unparseable line is ignored rather than fatal.** The server streams
/// status prose that this build does not model (`pulling manifest`, `verifying
/// sha256 digest`, `writing manifest`), and a stricter reader would turn a
/// vendor adding a status into a failed install.
fn parse_pull_line(line: &str) -> PullLine {
    if line.is_empty() {
        return PullLine::Ignored;
    }

    let Ok(parsed) = serde_json::from_str::<OllamaPullLine>(line) else {
        return PullLine::Ignored;
    };

    if let Some(error) = parsed.error.filter(|value| !value.trim().is_empty()) {
        return PullLine::Error(error);
    }

    if parsed.status.trim() == "success" {
        return PullLine::Success;
    }

    match parsed.completed {
        Some(completed) => PullLine::Progress { completed },
        None => PullLine::Ignored,
    }
}

fn hex_of(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

// ── Cancelling and removing ──────────────────────────────────────────────────

/// Asks a running install to stop.
///
/// Answers immediately and does not wait: the install's own loop notices the
/// flag, cleans its part file up and emits `cancelled`. A caller that blocked
/// here would be blocking on a network read it has just asked to be abandoned.
#[tauri::command]
pub fn cancel_model_install(install_id: String) -> Result<(), String> {
    let map = running()
        .lock()
        .map_err(|_| "The install register is poisoned.".to_string())?;
    let entry = map
        .get(&install_id)
        .ok_or_else(|| format!("No install '{install_id}' is running."))?;

    entry.cancelled.store(true, Ordering::SeqCst);
    runtime_log::record(format!(
        "[WordScript] Model install cancel requested id={install_id} row={}",
        entry.row
    ));
    Ok(())
}

/// Removes an installed model, or refuses and says which profile stopped it.
#[tauri::command]
pub async fn remove_model(row: String) -> Result<(), String> {
    /* A row the catalogue does not know is one of the user's own (ADR 0159),
       and it is removable on exactly one condition: WordScript put it in the
       folder it manages. A file in somebody's own library was never this
       build's to delete — removing the FOLDER is the undo for adding it, and
       that is `remove_model_folder`. */
    let Some(catalogue_row) = model_catalogue::row(&row) else {
        return remove_your_own_model(&row);
    };
    let install = catalogue_row
        .install
        .as_ref()
        .ok_or_else(|| format!("'{row}' is not a model this build installs."))?;

    let config = AppConfig::load_from_disk();
    if let Some(profile) = profile_using(catalogue_row, &config) {
        return Err(format!(
            "{} runs on {} — change that profile's model first.",
            profile, catalogue_row.model_id,
        ));
    }

    match install {
        InstallSource::Download { file_name, .. } => {
            let target = managed_path_for(file_name);
            if !target.is_file() {
                return Err(format!(
                    "{} is not in the folder WordScript manages. A model you pointed an environment variable at is yours to remove.",
                    catalogue_row.model_id,
                ));
            }
            std::fs::remove_file(&target)
                .map_err(|error| format!("Could not remove {}: {error}", target.display()))?;
            runtime_log::record(format!(
                "[WordScript] Model removed row={row} path={}",
                target.display()
            ));
            Ok(())
        }
        InstallSource::ServerPull { tag, .. } => {
            let base_url = local::local_chat_base_url()?;
            let response = reqwest::Client::new()
                .delete(format!("{base_url}/api/delete"))
                .json(&serde_json::json!({ "model": tag }))
                .send()
                .await
                .map_err(|error| {
                    format!("Could not reach the local model server at {base_url}: {error}")
                })?;

            if !response.status().is_success() {
                return Err(format!(
                    "The server refused to delete '{tag}': HTTP {}",
                    response.status()
                ));
            }

            runtime_log::record(format!("[WordScript] Model pull removed row={row} tag={tag}"));
            Ok(())
        }
    }
}

/// Removes a model no catalogue row claims, and refuses where it is not this
/// build's file to remove.
fn remove_your_own_model(stem: &str) -> Result<(), String> {
    let config = AppConfig::load_from_disk();
    if let Some(profile) = profile_using_local_stem(stem, &config) {
        return Err(format!(
            "{profile} runs on ggml-{stem} — change that profile's model first."
        ));
    }

    let managed = managed_speech_model_dir();
    let target = managed.join(format!("ggml-{stem}.bin"));
    if !target.is_file() {
        return Err(format!(
            "ggml-{stem} is in a folder you added, not the one WordScript manages. Remove the folder here, or the file where it lives."
        ));
    }

    std::fs::remove_file(&target)
        .map_err(|error| format!("Could not remove {}: {error}", target.display()))?;
    runtime_log::record(format!(
        "[WordScript] Imported model removed row={stem} path={}",
        target.display()
    ));
    Ok(())
}

/// Copies a model file the user picked into the directory WordScript manages
/// (ADR 0159).
///
/// **One of two ways in, and the one that ends with WordScript owning the
/// file.** The other is `add_model_folder`, which uses a model where it lies.
/// Both exist because both cases are real: somebody with a single `.bin` in
/// their downloads wants it *in*, and somebody with a library on a home server
/// does not want a second copy of a 1.6 GB file.
///
/// It runs on the same channel, id and cancel machinery a download does, for
/// the reason a 1.6 GB copy needs it: a file that large takes long enough that
/// a surface without progress looks broken.
///
/// **No checksum, and that is not an oversight.** The catalogue's checksum
/// answers *did this download arrive intact*; a file somebody already has needs
/// no such answer, and demanding one would refuse exactly the models this
/// exists to accept. What it does check is that the name is one the discovery
/// can see and that no catalogue row already owns it.
#[tauri::command]
pub async fn import_model_file(app: AppHandle, path: String) -> Result<String, String> {
    let source = PathBuf::from(path.trim());
    let meta = std::fs::metadata(&source)
        .map_err(|error| format!("Could not read {}: {error}", source.display()))?;
    if !meta.is_file() {
        return Err(format!("{} is not a file.", source.display()));
    }

    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "That file has no readable name.".to_string())?
        .to_ascii_lowercase();

    /* The name is the contract with the discovery. `core::providers::local`
       finds a recogniser by the `ggml-{stem}.bin` shape, so a file landing
       under any other name would be copied, counted and never resolvable —
       an import that silently does nothing. */
    if !file_name.starts_with("ggml-") || !file_name.ends_with(".bin") {
        return Err(format!(
            "WordScript reads whisper.cpp models named ggml-<name>.bin, and this one is '{file_name}'. Rename it and try again."
        ));
    }

    if model_catalogue::installable_rows().into_iter().any(|row| {
        matches!(row.install.as_ref(), Some(InstallSource::Download { file_name: known, .. }) if known == &file_name)
    }) {
        return Err(format!(
            "'{file_name}' is a model WordScript can download itself — use its Download button rather than importing a copy."
        ));
    }

    let target = managed_path_for(&file_name);
    if target.exists() {
        return Err(format!(
            "'{file_name}' is already in the folder WordScript manages."
        ));
    }

    let install_id = next_install_id();
    let row = file_name
        .strip_prefix("ggml-")
        .and_then(|rest| rest.strip_suffix(".bin"))
        .unwrap_or(&file_name)
        .to_string();
    let total_bytes = meta.len();
    let entry = register(&install_id, &row);

    emit(
        &app,
        ModelInstallEvent {
            install_id: install_id.clone(),
            row: row.clone(),
            phase: ModelInstallPhase::Started,
            received_bytes: 0,
            total_bytes,
            detail: None,
        },
    );
    runtime_log::record(format!(
        "[WordScript] Model import started id={install_id} row={row} bytes={total_bytes}"
    ));

    let handle = app.clone();
    let started_id = install_id.clone();
    let started_row = row.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let reporting = handle.clone();
        let report = move |event: ModelInstallEvent| emit(&reporting, event);
        let outcome = copy_into_managed(&report, &started_id, &started_row, &source, &target, total_bytes, &entry);

        unregister(&started_id);
        let cancelled = entry.cancelled.load(Ordering::SeqCst);
        let received = entry.received_bytes.lock().map(|value| *value).unwrap_or(0);

        match outcome {
            Ok(()) if cancelled => {
                runtime_log::record(format!(
                    "[WordScript] Model import completed after cancel, discarded id={started_id} row={started_row}"
                ));
                emit(&handle, ModelInstallEvent {
                    install_id: started_id, row: started_row,
                    phase: ModelInstallPhase::Cancelled,
                    received_bytes: received, total_bytes,
                    detail: Some("Cancelled — nothing was imported.".to_string()),
                });
            }
            Ok(()) => {
                runtime_log::record(format!(
                    "[WordScript] Model import done id={started_id} row={started_row}"
                ));
                emit(&handle, ModelInstallEvent {
                    install_id: started_id, row: started_row,
                    phase: ModelInstallPhase::Installed,
                    received_bytes: total_bytes, total_bytes, detail: None,
                });
            }
            Err(InstallFailure::Cancelled) => {
                emit(&handle, ModelInstallEvent {
                    install_id: started_id, row: started_row,
                    phase: ModelInstallPhase::Cancelled,
                    received_bytes: received, total_bytes,
                    detail: Some("Cancelled — nothing was imported.".to_string()),
                });
            }
            Err(InstallFailure::Failed(detail)) => {
                runtime_log::record(format!(
                    "[WordScript] Model import failed id={started_id} row={started_row}: {detail}"
                ));
                emit(&handle, ModelInstallEvent {
                    install_id: started_id, row: started_row,
                    phase: ModelInstallPhase::Failed,
                    received_bytes: received, total_bytes,
                    detail: Some(detail),
                });
            }
        }
    });

    Ok(install_id)
}

/// The copy itself: through a `.part` file, like a download, so a cancel or a
/// failure never leaves a truncated model spelled like a whole one.
#[allow(clippy::too_many_arguments)]
fn copy_into_managed(
    report: Reporter<'_>,
    install_id: &str,
    row: &str,
    source: &Path,
    target: &Path,
    total_bytes: u64,
    entry: &RunningInstall,
) -> Result<(), InstallFailure> {
    use std::io::{Read, Write};

    let dir = managed_speech_model_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|error| failed(format!("Could not create {}: {error}", dir.display())))?;

    if let Some(refusal) = free_space_refusal(&dir, total_bytes) {
        return Err(failed(refusal));
    }

    let part = target.with_extension("bin.part");
    let _ = std::fs::remove_file(&part);

    let mut reader = std::fs::File::open(source)
        .map_err(|error| failed(format!("Could not read {}: {error}", source.display())))?;
    let mut writer = std::fs::File::create(&part)
        .map_err(|error| failed(format!("Could not write {}: {error}", part.display())))?;

    let mut buffer = vec![0u8; 1024 * 1024];
    let mut copied: u64 = 0;
    let mut last_report = std::time::Instant::now();

    loop {
        if entry.cancelled.load(Ordering::SeqCst) {
            drop(writer);
            let _ = std::fs::remove_file(&part);
            return Err(InstallFailure::Cancelled);
        }

        let read = match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(read) => read,
            Err(error) => {
                drop(writer);
                let _ = std::fs::remove_file(&part);
                return Err(failed(format!("The copy stopped: {error}")));
            }
        };

        if let Err(error) = writer.write_all(&buffer[..read]) {
            drop(writer);
            let _ = std::fs::remove_file(&part);
            return Err(failed(format!("Could not write {}: {error}", part.display())));
        }

        copied = copied.saturating_add(read as u64);
        if let Ok(mut value) = entry.received_bytes.lock() {
            *value = copied;
        }

        if last_report.elapsed().as_millis() >= PROGRESS_INTERVAL_MS {
            last_report = std::time::Instant::now();
            report(ModelInstallEvent {
                install_id: install_id.to_string(),
                row: row.to_string(),
                phase: ModelInstallPhase::Progress,
                received_bytes: copied,
                total_bytes,
                detail: None,
            });
        }
    }

    drop(writer);

    if entry.cancelled.load(Ordering::SeqCst) {
        let _ = std::fs::remove_file(&part);
        return Err(InstallFailure::Cancelled);
    }

    std::fs::rename(&part, target).map_err(|error| {
        let _ = std::fs::remove_file(&part);
        failed(format!(
            "Could not put the model in place at {}: {error}",
            target.display()
        ))
    })?;

    Ok(())
}

/// Adds a folder WordScript will look in, without copying anything out of it
/// (ADR 0159).
///
/// **The second way in, and the one for a library somebody already keeps.** The
/// folder is read and never written to; the models in it are used where they
/// lie. It ranks below both environment variables and above the managed
/// directory, so an expert's checkout still wins and what this build installed
/// does not shadow what the user pointed at.
#[tauri::command]
pub fn add_model_folder(path: String) -> Result<Vec<String>, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("No folder was chosen.".to_string());
    }

    let dir = PathBuf::from(trimmed);
    if !dir.is_dir() {
        return Err(format!("{} is not a folder.", dir.display()));
    }

    let mut config = AppConfig::load_from_disk();
    let canonical = dir.canonicalize().unwrap_or(dir).display().to_string();

    if config.local_model_dirs.iter().any(|known| known == &canonical) {
        return Err(format!("{canonical} is already on the list."));
    }

    /* Added even when it holds no model today. A folder on a share that is not
       mounted right now is not an empty folder, and refusing it here would make
       the feature work only while the network does. */
    config.local_model_dirs.push(canonical);
    config.save_to_disk()?;
    Ok(config.local_model_dirs)
}

/// Stops looking in a folder. **Removes nothing from the disk** — it was never
/// WordScript's to delete, and a person who added a path expects removing it to
/// undo the adding and nothing else.
#[tauri::command]
pub fn remove_model_folder(path: String) -> Result<Vec<String>, String> {
    let trimmed = path.trim().to_string();
    let mut config = AppConfig::load_from_disk();
    let before = config.local_model_dirs.len();

    config.local_model_dirs.retain(|known| known != &trimmed);
    if config.local_model_dirs.len() == before {
        return Err(format!("{trimmed} was not on the list."));
    }

    config.save_to_disk()?;
    Ok(config.local_model_dirs)
}

/// Asks the local server to pull a tag the catalogue does not carry
/// (ADR 0159).
///
/// **The language half's answer to the same question**, and it is a typed tag
/// rather than a file because Ollama owns that store — there is no folder to
/// point at and no file to copy. The donor draws the same control for the same
/// reason: openwhispr's `allowCustomModelId` is a text field beside a curated
/// list, for the vendors whose catalogue can never be complete.
#[tauri::command]
pub async fn pull_model_tag(app: AppHandle, tag: String) -> Result<String, String> {
    let tag = tag.trim().to_string();
    if tag.is_empty() {
        return Err("Type the tag to pull, such as qwen2.5:7b-instruct-q4_K_M.".to_string());
    }

    if running_for_row(&tag).is_some() {
        return Err(format!("'{tag}' is already being pulled."));
    }

    let install_id = next_install_id();
    let entry = register(&install_id, &tag);

    emit(
        &app,
        ModelInstallEvent {
            install_id: install_id.clone(),
            row: tag.clone(),
            phase: ModelInstallPhase::Started,
            received_bytes: 0,
            /* **Zero, and it has to be.** Nobody has asked the server how big
               this is, and printing the catalogue's idea of a size for a tag
               the catalogue does not carry would be inventing the one number
               this surface promises to state truthfully. The percentage comes
               from the server's own `completed`/`total` as the pull runs. */
            total_bytes: 0,
            detail: None,
        },
    );
    runtime_log::record(format!(
        "[WordScript] Model pull started id={install_id} tag={tag}"
    ));

    let handle = app.clone();
    let started_id = install_id.clone();
    let started_tag = tag.clone();

    tauri::async_runtime::spawn(async move {
        let reporting = handle.clone();
        let report = move |event: ModelInstallEvent| emit(&reporting, event);
        let outcome =
            run_server_pull(&report, &started_id, &started_tag, &started_tag, 0, &entry).await;

        unregister(&started_id);
        let received = entry.received_bytes.lock().map(|value| *value).unwrap_or(0);
        let cancelled = entry.cancelled.load(Ordering::SeqCst);

        let (phase, detail) = match outcome {
            Ok(()) if cancelled => (
                ModelInstallPhase::Cancelled,
                Some("Cancelled — the server may still finish the pull it started.".to_string()),
            ),
            Ok(()) => (ModelInstallPhase::Installed, None),
            Err(InstallFailure::Cancelled) => (
                ModelInstallPhase::Cancelled,
                Some("Cancelled — the server may still finish the pull it started.".to_string()),
            ),
            Err(InstallFailure::Failed(detail)) => (ModelInstallPhase::Failed, Some(detail)),
        };

        runtime_log::record(format!(
            "[WordScript] Model pull ended id={started_id} tag={started_tag} phase={phase:?}"
        ));
        emit(
            &handle,
            ModelInstallEvent {
                install_id: started_id,
                row: started_tag,
                phase,
                received_bytes: received,
                total_bytes: received,
                detail,
            },
        );
    });

    Ok(install_id)
}

/// Opens the directory WordScript manages, creating it first where it does not
/// exist yet — a machine that has installed nothing still has a folder to be
/// shown, and *Open the model folder* answering an error is worse than an empty
/// window.
#[tauri::command]
pub fn open_model_folder() -> Result<(), String> {
    let dir = managed_speech_model_dir();
    if !dir.is_dir() {
        std::fs::create_dir_all(&dir)
            .map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
    }

    tauri_plugin_opener::open_path(&dir, None::<&str>).map_err(|error| error.to_string())
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn catalogue_row(id: &str) -> &'static ModelRow {
        model_catalogue::row(id).expect("the catalogue carries this row")
    }

    #[test]
    fn the_managed_directory_sits_under_the_diverted_data_dir() {
        // The suite must never reach the developer's real model folder, and it
        // is asserted through the resolved path rather than by writing.
        assert!(managed_speech_model_dir().starts_with(user_data_dir()));
    }

    /// **A catalogued model with no file is *installable* and never
    /// *available*.** The sentence ADR 0122 draws the distinction with, as a
    /// test: this is the state that replaced four invented rows.
    #[test]
    fn a_catalogued_model_with_no_file_is_installable() {
        let dir = std::env::temp_dir().join(format!(
            "wordscript-install-none-{}",
            std::process::id()
        ));
        let _ = std::fs::create_dir_all(&dir);
        let config = AppConfig::default();

        let row = managed_row(
            catalogue_row("local-speech-base"),
            &dir,
            Ok(&[]),
            &config,
        );

        assert_eq!(row.state, ManagedModelState::Installable);
        assert_eq!(row.path, None);
    }

    /// The other half: a file on the disk makes the row installed, and the size
    /// is read off the file rather than repeated from the catalogue.
    #[test]
    fn a_file_on_the_disk_makes_the_row_installed() {
        let dir = std::env::temp_dir().join(format!(
            "wordscript-install-some-{}",
            std::process::id()
        ));
        let _ = std::fs::create_dir_all(&dir);
        std::fs::write(dir.join("ggml-base.bin"), b"not really a model").unwrap();

        let row = managed_row(
            catalogue_row("local-speech-base"),
            &dir,
            Ok(&[]),
            &AppConfig::default(),
        );

        assert_eq!(row.state, ManagedModelState::Installed { bytes: 18 });
        assert!(row.path.is_some());

        let _ = std::fs::remove_file(dir.join("ggml-base.bin"));
    }

    /// A server that is not running does not make its models *not installed*.
    /// Saying that would be a claim about a disk nobody looked at.
    #[test]
    fn an_unreachable_server_leaves_the_language_rows_unknown() {
        let dir = std::env::temp_dir().join("wordscript-install-unknown");
        let detail = "Connection refused".to_string();

        let row = managed_row(
            catalogue_row("local-chat-qwen-7b"),
            &dir,
            Err(&detail),
            &AppConfig::default(),
        );

        assert_eq!(
            row.state,
            ManagedModelState::Unknown {
                detail: "Connection refused".to_string()
            }
        );
    }

    /// The pull tag is what a server is asked about, and the model id is not.
    /// A row reporting itself installed because a tag *looked* like its model
    /// id would be the derivation ADR 0122 refuses.
    #[test]
    fn a_language_row_is_installed_when_the_server_lists_its_tag() {
        let dir = std::env::temp_dir().join("wordscript-install-tag");
        let row = catalogue_row("local-chat-qwen-7b");
        let InstallSource::ServerPull { tag, size_bytes, .. } =
            row.install.as_ref().expect("an install block")
        else {
            panic!("the qwen row pulls from a server");
        };

        let listed = [tag.clone()];
        let answered = managed_row(row, &dir, Ok(&listed), &AppConfig::default());
        assert_eq!(
            answered.state,
            ManagedModelState::Installed { bytes: *size_bytes }
        );

        let by_model_id = [row.model_id.clone()];
        let refused = managed_row(row, &dir, Ok(&by_model_id), &AppConfig::default());
        assert_eq!(refused.state, ManagedModelState::Installable);
    }

    /// **Removing a model a profile resolves to is refused, and the refusal
    /// names the profile.** Asserted on the answer `remove_model` reads rather
    /// than through the command, because the command's other half deletes a
    /// file.
    #[test]
    fn a_model_a_profile_runs_on_is_named_as_in_use() {
        let mut config = AppConfig::default();
        config.text_profiles.clear();

        let mut profile = crate::core::config::TextProfile {
            id: "profile-1".to_string(),
            label: "Technical notes".to_string(),
            ..Default::default()
        };
        let mut speech = profile.resolved_speech();
        speech.local_model = "small".to_string();
        speech.local_correction_model = "qwen2.5:7b-instruct-q4_K_M".to_string();
        profile.speech = Some(speech);
        config.text_profiles.push(profile);

        assert_eq!(
            profile_using(catalogue_row("local-speech-small"), &config),
            Some("Technical notes".to_string()),
        );
        assert_eq!(
            profile_using(catalogue_row("local-chat-qwen-7b"), &config),
            Some("Technical notes".to_string()),
        );
        assert_eq!(profile_using(catalogue_row("local-speech-medium"), &config), None);
    }

    /// The machine-wide value is the fallback a profile with no block resolves
    /// to, so a model in use through it is in use.
    #[test]
    fn the_machine_wide_default_counts_as_in_use() {
        let mut config = AppConfig::default();
        config.text_profiles.clear();
        config.local_model = "large-v3-turbo".to_string();

        assert_eq!(
            profile_using(catalogue_row("local-speech-large-v3-turbo"), &config),
            Some("the machine-wide default".to_string()),
        );
    }

    #[test]
    fn a_pull_line_reports_progress_success_and_error_apart() {
        assert_eq!(
            parse_pull_line(r#"{"status":"pulling 1234","completed":512,"total":1024}"#),
            PullLine::Progress { completed: 512 },
        );
        assert_eq!(parse_pull_line(r#"{"status":"success"}"#), PullLine::Success);
        assert_eq!(
            parse_pull_line(r#"{"error":"model 'nope' not found"}"#),
            PullLine::Error("model 'nope' not found".to_string()),
        );
        // Prose statuses and anything unparseable are ignored rather than
        // fatal: a vendor adding a status must not fail an install.
        assert_eq!(parse_pull_line(r#"{"status":"pulling manifest"}"#), PullLine::Ignored);
        assert_eq!(parse_pull_line("not json at all"), PullLine::Ignored);
        assert_eq!(parse_pull_line(""), PullLine::Ignored);
    }

    #[test]
    fn a_download_that_does_not_fit_is_refused_before_the_first_byte() {
        let dir = std::env::temp_dir();

        // No free-space answer means no refusal — an install is not blocked by
        // this build's own blindness.
        if available_bytes(&dir).is_none() {
            assert_eq!(free_space_refusal(&dir, u64::MAX / 2), None);
            return;
        }

        let refusal = free_space_refusal(&dir, u64::MAX / 2).expect("a refusal");
        assert!(refusal.contains("Not enough free space"), "{refusal}");
        assert_eq!(free_space_refusal(&dir, 1), None);
    }

    #[test]
    fn sizes_are_printed_in_the_units_the_sources_publish() {
        assert_eq!(format_bytes(147_951_465), "148 MB");
        assert_eq!(format_bytes(4_683_086_845), "4.7 GB");
    }

    #[test]
    fn a_row_this_build_does_not_install_is_refused_by_name() {
        let error = tauri::async_runtime::block_on(remove_model(
            "groq-speech-turbo".to_string(),
        ))
        .expect_err("a hosted row is not installable");
        assert!(error.contains("groq-speech-turbo"), "{error}");
    }

    #[test]
    fn cancelling_an_install_that_is_not_running_says_so() {
        let error = cancel_model_install("install-does-not-exist".to_string())
            .expect_err("nothing is running under that id");
        assert!(error.contains("install-does-not-exist"), "{error}");
    }

    /// **The defect B5 left, as a test** (ADR 0159). The tab is called *On this
    /// machine* and listed the catalogue; a file the runtime discovers,
    /// resolves and would transcribe with was invisible on it.
    #[test]
    fn a_file_the_catalogue_does_not_know_is_listed_as_yours() {
        let _lock = local::test_env_lock();
        let managed = managed_speech_model_dir();
        let _ = std::fs::remove_dir_all(&managed);
        std::fs::create_dir_all(&managed).expect("create the managed directory");
        std::fs::write(managed.join("ggml-my-finetune.bin"), b"a model of my own")
            .expect("write the user's model");

        let rows = your_own_rows(&[], &AppConfig::default());
        let _ = std::fs::remove_dir_all(&managed);

        let mine = rows
            .iter()
            .find(|row| row.row == "my-finetune")
            .expect("the user's own model is listed");

        assert_eq!(mine.origin, ModelOrigin::Yours);
        assert_eq!(mine.state, ManagedModelState::Installed { bytes: 17 });
        /* The size is the file's own. Nothing else knows it, and a catalogue
           figure borrowed for somebody's own weights would be a fabrication. */
        assert_eq!(mine.size_bytes, 17);
        assert!(mine.quantization.is_none());
        assert!(mine.folder.is_some());
    }

    /// **A catalogue row owns its stem**, even before anybody downloads it. A
    /// user who drops `ggml-base.bin` in themselves has the catalogue's `base`
    /// reporting itself installed, not a second row beside it.
    #[test]
    fn a_catalogued_stem_is_not_listed_twice() {
        let _lock = local::test_env_lock();
        let managed = managed_speech_model_dir();
        let _ = std::fs::remove_dir_all(&managed);
        std::fs::create_dir_all(&managed).expect("create the managed directory");
        std::fs::write(managed.join("ggml-base.bin"), b"dropped in by hand")
            .expect("write base");

        let rows = your_own_rows(&[], &AppConfig::default());
        let catalogued = managed_row(
            catalogue_row("local-speech-base"),
            &managed,
            Ok(&[]),
            &AppConfig::default(),
        );
        let _ = std::fs::remove_dir_all(&managed);

        assert!(
            !rows.iter().any(|row| row.row == "base"),
            "the catalogue's row owns that name",
        );
        assert_eq!(catalogued.origin, ModelOrigin::Catalogue);
        assert!(matches!(
            catalogued.state,
            ManagedModelState::Installed { .. }
        ));
    }

    /// A model in a folder the user pointed at is listed and is **not**
    /// removable from here: it was never this build's file to delete.
    #[test]
    fn a_model_in_a_folder_you_added_is_not_this_screens_to_delete() {
        let error = tauri::async_runtime::block_on(remove_model("not-in-the-managed-dir".to_string()))
            .expect_err("nothing of that name is in the managed directory");

        assert!(error.contains("folder you added"), "{error}");
    }

    #[test]
    fn an_import_refuses_a_name_the_discovery_cannot_see() {
        let scratch = std::env::temp_dir().join(format!("ws-import-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&scratch);
        let wrong = scratch.join("my-model.gguf");
        std::fs::write(&wrong, b"not a ggml name").expect("write the file");

        // A `tauri::AppHandle` cannot be built in a unit test, so the guard is
        // exercised through the same predicate the command applies.
        let name = wrong.file_name().unwrap().to_str().unwrap().to_ascii_lowercase();
        assert!(!(name.starts_with("ggml-") && name.ends_with(".bin")));

        let _ = std::fs::remove_file(&wrong);
    }

    /// **ADR 0122's *done when*, run against the real thing.**
    ///
    /// *A model chosen in the drawn list downloads with progress, is found
    /// afterwards without any environment variable, and no row anywhere claims
    /// a model that is not on the disk.* Every synthetic test above holds one
    /// clause of that sentence; this one holds the whole chain at once —
    /// network, checksum, rename, discovery and decode-path resolution — and it
    /// is the only place the catalogue's URL, size and checksum are proved to
    /// still describe the file at the other end.
    ///
    /// Ignored because it spends 148 MB of somebody's bandwidth. Run it when
    /// the catalogue's `install` block changes, which is the case ADR 0122 gave
    /// `docs/PROVIDERS.md` a maintenance duty for: a weights repository that
    /// moves a file breaks an install rather than a claim, and this is what
    /// turns that break into a red test.
    #[test]
    #[ignore = "downloads a real 148 MB model over the network; run explicitly with --ignored"]
    fn a_real_download_verifies_installs_and_is_then_found_with_no_environment_variable() {
        let _lock = crate::core::providers::local::test_env_lock();

        std::env::remove_var("WORDSCRIPT_LOCAL_MODEL_PATH");
        std::env::remove_var("WORDSCRIPT_LOCAL_MODEL_DIR");

        let dir = managed_speech_model_dir();
        let _ = std::fs::remove_dir_all(&dir);

        let row = catalogue_row("local-speech-base");
        let InstallSource::Download {
            url,
            file_name,
            size_bytes,
            sha256,
            ..
        } = row.install.as_ref().expect("an install block")
        else {
            panic!("the base row is a download");
        };

        let seen: Mutex<Vec<ModelInstallEvent>> = Mutex::new(Vec::new());
        let report = |event: ModelInstallEvent| {
            seen.lock().expect("the collector").push(event);
        };
        let entry = register("acceptance", &row.id);

        tauri::async_runtime::block_on(run_download(
            &report,
            "acceptance",
            &row.id,
            url,
            file_name,
            *size_bytes,
            sha256,
            &entry,
        ))
        .unwrap_or_else(|error| match error {
            InstallFailure::Cancelled => panic!("nothing cancelled this"),
            InstallFailure::Failed(detail) => panic!("the download failed: {detail}"),
        });
        unregister("acceptance");

        // Progress moved, and it ended in a verification rather than a rename
        // taken on trust.
        let events = seen.into_inner().expect("the collector");
        assert!(
            events
                .iter()
                .any(|event| event.phase == ModelInstallPhase::Progress && event.received_bytes > 0),
            "the download reported progress",
        );
        assert!(
            events
                .iter()
                .any(|event| event.phase == ModelInstallPhase::Verifying),
            "the download verified before it named the file",
        );

        // Nothing half-written is left spelled like a whole model.
        let installed = dir.join(file_name);
        assert!(installed.is_file(), "{installed:?} was not installed");
        assert!(!dir.join(format!("{file_name}.part")).exists(), "a part file survived");
        assert_eq!(
            std::fs::metadata(&installed).expect("the installed file").len(),
            *size_bytes,
            "the catalogue's size no longer describes the file at {url}",
        );

        // Found afterwards, with no environment variable set — both by the
        // discovery the surface reads and by the path the decode runs on.
        let profiles = crate::core::providers::local::provider_profiles_for_test();
        assert!(
            profiles.iter().any(|profile| profile.id == "local-base-fast"),
            "an installed model is discovered",
        );
        assert_eq!(
            crate::core::providers::local::resolve_local_model_path_for_test("base")
                .expect("the installed model resolves"),
            installed,
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The register is what keeps a late result apart from the result of
    /// whatever replaced it, so it has to key on the id and not on the row.
    ///
    /// **The row name here is deliberately not a catalogue slug.** The register
    /// is process-wide and the suite is threaded, so registering a real row
    /// would make `managed_row`'s tests read `Installing` on whichever of them
    /// happened to run beside this one — which is exactly the flake this test
    /// found in its own first draft.
    #[test]
    fn the_register_tracks_an_install_by_its_own_id() {
        const ROW: &str = "a-row-only-this-test-registers";

        let id = next_install_id();
        let other = next_install_id();
        assert_ne!(id, other);

        let entry = register(&id, ROW);
        assert_eq!(running_for_row(ROW).map(|(id, _)| id), Some(id.clone()));

        entry.cancelled.store(true, Ordering::SeqCst);
        assert!(running().lock().unwrap()[&id].cancelled.load(Ordering::SeqCst));

        unregister(&id);
        assert_eq!(running_for_row(ROW), None);
    }
}
