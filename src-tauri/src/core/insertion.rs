use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use arboard::Clipboard;
use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, State};

use super::config::AppConfig;
use super::paths::{config_file_path, scratchpad_file_path};
use super::portal::{
    detect_portal_capabilities, detect_portal_prompt_from_stderr, portal_prompt_signal_label,
    CompositorKind, PortalCapabilities, PortalPromptSignal,
};
use super::portal_session::{self, PortalGrantPhase, PortalGrantStatus};
use super::runtime_log;
use super::sessions::now_ms;

const CLIPBOARD_RESTORE_DELAY_MS: u64 = 180;
// Upper bound for waiting on wl-copy to exit before reporting a Wayland
// clipboard write as committed. wl-copy normally forks its clipboard-serving
// daemon and exits within a few ms; this absorbs a slow compositor handshake
// without stalling the insert path.
const WL_COPY_WAIT_MS: u64 = 400;
// Upper bound for the `wl-paste` read-back that verifies a wl-copy write. A
// healthy clipboard owner answers immediately; the bound only guards against a
// hung compositor stalling the insert.
const WL_PASTE_WAIT_MS: u64 = 400;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum NativeInsertDriver {
    WlCopy,
    Arboard,
    XdotoolType,
    Xdotool,
    /// Ctrl+V through `org.freedesktop.portal.RemoteDesktop` on a session the
    /// user granted once. The only Linux paste driver whose delivery is a call
    /// with a result rather than a keystroke into the void, and the only one
    /// that reaches a native Wayland window (ADR 0228).
    RemoteDesktopPortal,
    Wtype,
    Ydotool,
    Enigo,
    Scratchpad,
}

impl NativeInsertDriver {
    fn label(self) -> &'static str {
        match self {
            Self::WlCopy => "wl-copy",
            Self::Arboard => "arboard clipboard",
            Self::XdotoolType => "xdotool type",
            Self::Xdotool => "xdotool",
            Self::RemoteDesktopPortal => "RemoteDesktop portal",
            Self::Wtype => "wtype",
            Self::Ydotool => "ydotool",
            Self::Enigo => "enigo",
            Self::Scratchpad => "scratchpad recovery",
        }
    }

    fn role(self) -> &'static str {
        match self {
            Self::WlCopy | Self::Arboard => "clipboard",
            Self::XdotoolType
            | Self::Xdotool
            | Self::RemoteDesktopPortal
            | Self::Wtype
            | Self::Ydotool
            | Self::Enigo => "paste",
            Self::Scratchpad => "recovery",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeInsertDriverStatus {
    pub driver: NativeInsertDriver,
    pub label: String,
    pub role: String,
    pub available: bool,
    pub active: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct NativeInsertPlatformContext {
    pub auto_paste: bool,
    pub is_wayland: bool,
    pub has_x11_display: bool,
    pub has_wl_copy: bool,
    pub has_xdotool: bool,
    pub has_wtype: bool,
    pub has_ydotool: bool,
    pub try_xdotool_type_first: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PasteDisableReason {
    PureWaylandPortalPrompt,
    EnigoPortalDetected,
    XdotoolPortalDetected,
    PortalSessionUnavailable,
    UnsupportedCompositor,
    HyprlandNoPersistentPortal,
    SwayUseWlrVirtualInput,
    KdePlasma5UpgradeRecommended,
}

impl PasteDisableReason {
    pub fn label(self) -> &'static str {
        match self {
            Self::PureWaylandPortalPrompt => {
                "Pure Wayland: auto-paste is disabled to avoid the KDE Plasma 'Control input devices' portal prompt. Paste manually from the clipboard."
            }
            Self::EnigoPortalDetected => {
                "Auto-paste was blocked: the enigo helper triggered the KDE Plasma 'Control input devices' portal prompt. Falling back to clipboard-only."
            }
            Self::XdotoolPortalDetected => {
                "Auto-paste was blocked: xdotool over XWayland triggered the KDE Plasma 'Control input devices' portal prompt. Falling back to clipboard-only."
            }
            Self::PortalSessionUnavailable => {
                "A one-time xdg-desktop-portal RemoteDesktop grant is required to enable direct auto-paste on this system."
            }
            Self::UnsupportedCompositor => {
                "This Wayland compositor does not expose a persistent RemoteDesktop portal grant, so auto-paste stays clipboard-only."
            }
            Self::HyprlandNoPersistentPortal => {
                "Hyprland does not expose a stable RemoteDesktop portal grant. Auto-paste stays clipboard-only; use Hyprland's dispatchers or wlr-virtual-input for a one-shot synthetic input if needed."
            }
            Self::SwayUseWlrVirtualInput => {
                "Sway does not expose a stable RemoteDesktop portal grant. Install xdg-desktop-portal-wlr and wlr-virtual-input, or rely on clipboard-only recovery."
            }
            Self::KdePlasma5UpgradeRecommended => {
                "KDE Plasma 5 does not expose the org.kde.kwin.RemoteDesktop portal. Upgrading to KDE Plasma 6 enables a one-time RemoteDesktop grant for auto-paste."
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeInsertionConfig {
    pub auto_paste: bool,
    /// Leave the transcript on the clipboard instead of restoring the previous
    /// contents after the paste. The profile's switch, resolved by the caller;
    /// read only on the `auto_paste` path, which is the only one that restores.
    #[serde(default)]
    pub keep_on_clipboard: bool,
    pub paste_delay_ms: u64,
    pub xdotool_type_max_chars: usize,
}

impl Default for NativeInsertionConfig {
    fn default() -> Self {
        Self {
            auto_paste: true,
            keep_on_clipboard: false,
            paste_delay_ms: 220,
            xdotool_type_max_chars: 800,
        }
    }
}

impl NativeInsertionConfig {
    pub fn load_from_disk() -> Self {
        let mut config = Self::default();
        let Ok(raw) = std::fs::read_to_string(config_file_path()) else {
            return config;
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
            return config;
        };
        if let Some(auto_paste) = value.get("auto_paste").and_then(|value| value.as_bool()) {
            config.auto_paste = auto_paste;
        }
        let app_config = AppConfig::load_from_disk();
        config.auto_paste = app_config.active_text_profile_auto_paste();
        config.keep_on_clipboard = app_config.active_text_profile_keep_on_clipboard();
        config
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct NativeInsertRequest {
    pub text: String,
    pub source: Option<String>,
    pub corrected: Option<bool>,
    pub auto_paste: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeInsertMode {
    DirectPaste,
    ClipboardOnly,
    ClipboardFallback,
    ScratchpadFallback,
}

impl NativeInsertMode {
    /// What the runtime actually did with the text, as the overlay contract
    /// spells it (`RuntimeTranscriptionResult.delivery` in `src/types/ipc.ts`).
    /// Only a real paste counts as `inserted`; every fallback leaves the text
    /// on the clipboard and nowhere else. The overlay derives its surface from
    /// this, so it must be emitted on EVERY `transcription` event — a missing
    /// field would read as "not inserted" and open a result surface for a
    /// delivery path that already closed.
    pub fn delivery_label(&self) -> &'static str {
        match self {
            NativeInsertMode::DirectPaste => "inserted",
            NativeInsertMode::ClipboardOnly
            | NativeInsertMode::ClipboardFallback
            | NativeInsertMode::ScratchpadFallback => "clipboard",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum NativeInsertRecoveryAction {
    #[default]
    None,
    ManualPaste,
    UseScratchpad,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum NativeClipboardRestoreStatus {
    #[default]
    NotAttempted,
    Scheduled,
    SkippedNoPreviousClipboard,
    /// The paste ran, but nothing could confirm it arrived, so the transcript
    /// was left on the clipboard instead of being replaced by the previous
    /// contents. See `XtestTargetProbe`.
    SkippedDeliveryUnverified,
    /// The profile asked for the transcript to stay on the clipboard, so the
    /// previous contents were deliberately not put back. Distinct from
    /// `SkippedDeliveryUnverified`, which is the same outcome reached because
    /// nothing could confirm the paste — one is a setting, the other a doubt,
    /// and a record that conflated them would make the setting look like a
    /// failure.
    SkippedKeptOnClipboard,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScratchpadEntry {
    pub id: String,
    pub text: String,
    pub source: String,
    pub created_at_ms: u64,
    pub corrected: bool,
    pub insert_mode: NativeInsertMode,
    pub active_driver: NativeInsertDriver,
    pub clipboard_written: bool,
    pub paste_attempted: bool,
    pub pasted: bool,
    pub fallback_reason: Option<String>,
    pub error: Option<String>,
    #[serde(default)]
    pub recovery_action: NativeInsertRecoveryAction,
    #[serde(default)]
    pub recovery_message: Option<String>,
    #[serde(default)]
    pub clipboard_restore: NativeClipboardRestoreStatus,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeInsertResult {
    pub ok: bool,
    pub text: String,
    pub insert_mode: NativeInsertMode,
    pub active_driver: NativeInsertDriver,
    pub clipboard_written: bool,
    pub paste_attempted: bool,
    pub pasted: bool,
    pub scratchpad_entry: ScratchpadEntry,
    pub fallback_available: bool,
    pub fallback_reason: Option<String>,
    pub error: Option<String>,
    pub recovery_action: NativeInsertRecoveryAction,
    pub recovery_message: String,
    pub clipboard_restore: NativeClipboardRestoreStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeSupportTier {
    Tier1,
    Preview,
    Experimental,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeInsertReadiness {
    Ready,
    RecoveryOnly,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeInsertionPlatformStatus {
    pub platform_label: String,
    pub support_tier: NativeSupportTier,
    pub readiness: NativeInsertReadiness,
    pub readiness_message: String,
    pub insert_strategy: NativeInsertMode,
    pub active_driver: NativeInsertDriver,
    pub support_message: String,
    pub driver_chain: Vec<NativeInsertDriverStatus>,
    pub prerequisites: Vec<String>,
    pub caveats: Vec<String>,
    #[serde(default)]
    pub portal_capabilities: Option<PortalCapabilities>,
    #[serde(default)]
    pub paste_disabled_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeInsertionStatus {
    pub config: NativeInsertionConfig,
    pub last_transcript: Option<ScratchpadEntry>,
    pub scratchpad_entries: Vec<ScratchpadEntry>,
    pub scratchpad_path: String,
    pub platform: NativeInsertionPlatformStatus,
    #[serde(default)]
    pub last_portal_prompt: Option<LastPortalPrompt>,
    /// The one-time input permission this machine's Wayland lane needs, and
    /// whether it is held right now. `None` off Linux and on desktops with no
    /// RemoteDesktop portal, where there is nothing to grant.
    #[serde(default)]
    pub portal_grant: Option<PortalGrantStatus>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LastPortalPrompt {
    pub signal: PortalPromptSignal,
    pub driver: NativeInsertDriver,
    pub detected_at_ms: u64,
    pub stderr_excerpt: String,
}

#[derive(Debug)]
pub struct NativeInsertionState {
    config: NativeInsertionConfig,
    entries: Vec<ScratchpadEntry>,
    last_transcript: Option<ScratchpadEntry>,
    last_portal_prompt: Option<LastPortalPrompt>,
}

/// Whether an XTEST paste can reach anything at all in this session.
///
/// Every Linux paste driver that survives the chain on a hybrid XWayland
/// session drives input through the X11 XTEST extension -- `xdotool` directly,
/// and `enigo` through its default `x11rb` backend (see PLATFORMS.md). XTEST
/// delivers to whatever the X server considers focused. On a Wayland session
/// with XWayland alongside, a NATIVE Wayland window holding the focus means the
/// X server has no focused client at all, and the key event is delivered
/// nowhere -- while `xdotool` still exits 0, because the request was
/// successfully SENT.
///
/// That gap is what made `auto_paste` report success for runs that inserted
/// nothing: measured 2026-08-18, nine `auto_paste` runs in `history.json` all
/// carried `insert_mode: direct_paste`, `pasted: true`, `fallback_reason: null`,
/// while `xdotool getactivewindow getwindowname` returned an empty name for
/// window `0x200000`. PLATFORMS.md described the adjacent case correctly -- a
/// compositor that REFUSES the XTEST grant produces an error and falls back --
/// but a grant that is accepted and lands nowhere produced no error to fall
/// back from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum XtestTargetProbe {
    /// A real X client holds the focus, so an XTEST key event has a recipient.
    Reachable,
    /// No X client holds the focus. On a hybrid session that means the focused
    /// window is a native Wayland client, which cannot receive XTEST.
    Unreachable,
    /// Could not be determined. The caller attempts the paste rather than
    /// refusing it: an undetermined probe is not evidence of a missing target.
    Unknown,
}

pub(crate) trait InsertIo {
    fn write_clipboard_with_driver(
        &mut self,
        driver: NativeInsertDriver,
        text: &str,
    ) -> Result<(), String>;
    fn read_clipboard_text(&mut self) -> Option<String>;
    fn paste_with_driver(&mut self, driver: NativeInsertDriver) -> Result<(), String>;
    fn type_with_driver(&mut self, driver: NativeInsertDriver, text: &str) -> Result<(), String>;
    fn schedule_clipboard_restore(&mut self, text: Option<String>, delay_ms: u64);
    fn wait_before_paste(&mut self, delay_ms: u64);
    /// Asked once per run, immediately before the XTEST paste chain, and only
    /// on a hybrid XWayland session. The default is `Unknown` so a test IO that
    /// does not model the X focus keeps its previous behaviour.
    fn probe_xtest_target(&mut self) -> XtestTargetProbe {
        XtestTargetProbe::Unknown
    }

    /// Whether a granted RemoteDesktop session is live and could carry the
    /// paste. Asked once per run, at the same moment as the probe, because the
    /// two answers together decide WHICH single driver runs -- never which one
    /// runs first. The default is `false`, so every pre-existing test keeps the
    /// chain it was written against.
    fn portal_session_is_live(&mut self) -> bool {
        false
    }
}

struct SystemInsertIo;

impl InsertIo for SystemInsertIo {
    fn write_clipboard_with_driver(
        &mut self,
        driver: NativeInsertDriver,
        text: &str,
    ) -> Result<(), String> {
        match driver {
            NativeInsertDriver::WlCopy => write_wayland_clipboard(text),
            NativeInsertDriver::Arboard => write_clipboard_with_arboard(text),
            _ => Err(format!("{} is not a clipboard driver.", driver.label())),
        }
    }

    fn read_clipboard_text(&mut self) -> Option<String> {
        read_clipboard_text()
    }

    fn paste_with_driver(&mut self, driver: NativeInsertDriver) -> Result<(), String> {
        match driver {
            NativeInsertDriver::Xdotool => {
                paste_with_command("xdotool", &["key", "--clearmodifiers", "ctrl+v"], false)
            }
            NativeInsertDriver::RemoteDesktopPortal => {
                portal_session::paste_ctrl_v().map_err(|error| error.label())
            }
            NativeInsertDriver::Wtype => {
                paste_with_command("wtype", &["-M", "ctrl", "-k", "v", "-m", "ctrl"], true)
            }
            NativeInsertDriver::Ydotool => {
                paste_with_command("ydotool", &["key", "29:1", "47:1", "47:0", "29:0"], false)
            }
            NativeInsertDriver::Enigo => paste_with_enigo(),
            _ => Err(format!("{} is not a paste driver.", driver.label())),
        }
    }

    fn type_with_driver(&mut self, driver: NativeInsertDriver, text: &str) -> Result<(), String> {
        match driver {
            NativeInsertDriver::XdotoolType => type_with_xdotool(text),
            _ => Err(format!("{} does not support keyboard typing.", driver.label())),
        }
    }

    fn schedule_clipboard_restore(&mut self, text: Option<String>, delay_ms: u64) {
        schedule_clipboard_restore(text, delay_ms);
    }

    fn wait_before_paste(&mut self, delay_ms: u64) {
        thread::sleep(Duration::from_millis(delay_ms));
    }

    fn probe_xtest_target(&mut self) -> XtestTargetProbe {
        probe_xtest_target_with_xdotool()
    }

    fn portal_session_is_live(&mut self) -> bool {
        portal_session::session_is_live()
    }
}

impl NativeInsertionState {
    pub fn load(config: NativeInsertionConfig) -> Self {
        let entries = load_scratchpad_entries();
        let last_transcript = entries.last().cloned();
        Self {
            config,
            entries,
            last_transcript,
            last_portal_prompt: None,
        }
    }

    fn status(&mut self) -> NativeInsertionStatus {
        // Reading the status no longer CREATES anything. It used to call
        // `request_remote_desktop_session`, which asked the portal for a real
        // session over `busctl` just so a diagnostics row could say "active" --
        // a session that died with the `busctl` process before the panel had
        // finished rendering it. The live session now belongs to
        // `portal_session`, and this only reports what is already true.
        let portal_grant = portal_grant_for_status();
        NativeInsertionStatus {
            config: self.config.clone(),
            last_transcript: self.last_transcript.clone(),
            scratchpad_entries: self.entries.clone(),
            scratchpad_path: scratchpad_file_path().to_string_lossy().to_string(),
            platform: platform_status(self.config.auto_paste),
            last_portal_prompt: self.last_portal_prompt.clone(),
            portal_grant,
        }
    }

    fn configure(&mut self, config: NativeInsertionConfig) -> NativeInsertionStatus {
        self.config = config;
        self.status()
    }

    fn clear(&mut self) -> NativeInsertionStatus {
        self.entries.clear();
        self.last_transcript = None;
        self.last_portal_prompt = None;
        let _ = save_scratchpad_entries(&self.entries);
        self.status()
    }

    fn insert(&mut self, request: NativeInsertRequest) -> NativeInsertResult {
        let started_at = Instant::now();
        let mut io = SystemInsertIo;
        let auto_paste = request.auto_paste.unwrap_or(self.config.auto_paste);
        let mut portal_prompt = None;
        let result = execute_insert_request_with_io(
            request,
            &self.config,
            self.entries.len() + 1,
            detect_insert_platform_context(auto_paste),
            &mut io,
            Some(&mut portal_prompt),
        );

        runtime_log::record(format!(
            "[WordScript] Native insert state core done elapsed_ms={} insert_mode={:?} pasted={} clipboard_written={} portal_prompt={}",
            started_at.elapsed().as_millis(),
            result.insert_mode,
            result.pasted,
            result.clipboard_written,
            portal_prompt.is_some(),
        ));

        self.last_portal_prompt = portal_prompt;
        self.last_transcript = Some(result.scratchpad_entry.clone());
        self.entries.push(result.scratchpad_entry.clone());
        if self.entries.len() > 100 {
            let overflow = self.entries.len() - 100;
            self.entries.drain(0..overflow);
        }
        let save_started_at = Instant::now();
        let _ = save_scratchpad_entries(&self.entries);
        runtime_log::record(format!(
            "[WordScript] Native insert scratchpad save done elapsed_ms={} total_elapsed_ms={}",
            save_started_at.elapsed().as_millis(),
            started_at.elapsed().as_millis(),
        ));

        result
    }
}

/// The grant state a status read reports, or `None` where there is nothing to
/// grant. `None` and "not granted" are different answers and the screen draws
/// them differently: one has no action, the other has one button.
fn portal_grant_for_status() -> Option<PortalGrantStatus> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    let status = portal_session::grant_status();
    if status.phase == PortalGrantPhase::Unsupported {
        return None;
    }
    Some(status)
}

#[tauri::command]
pub fn native_insertion_status(
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertionStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

#[tauri::command]
pub async fn insert_text_native(
    app: AppHandle,
    request: NativeInsertRequest,
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertResult, String> {
    // MUST be async: the clipboard write (wl-copy + verify) can block for up to
    // 800ms. A sync command runs on Tauri's main thread and blocks the webview's
    // JS event loop — frontend safety timeouts cannot fire, the spinner stays
    // forever (State 09). Running the blocking work on a background thread keeps
    // the main thread free so JS timers and IPC events flow normally.
    let app_for_blocking = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let state = app_for_blocking
            .try_state::<Mutex<NativeInsertionState>>()
            .ok_or_else(|| "Native insertion state is not available.".to_string())?;
        let mut state = state.lock().map_err(|error| error.to_string())?;
        let result = state.insert(request.clone());
        drop(state);
        Ok(result)
    })
    .await
    .map_err(|e| format!("Insert task panicked: {e}"))?;

    let _ = state; // state param is unused (we re-fetch via try_state on the blocking thread)
    result
}

#[tauri::command]
pub fn restore_last_transcript(
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertResult, String> {
    let last = {
        let state = state.lock().map_err(|error| error.to_string())?;
        state
            .last_transcript
            .as_ref()
            .map(|entry| entry.text.clone())
            .ok_or_else(|| "No last transcript available.".to_string())?
    };

    let mut state = state.lock().map_err(|error| error.to_string())?;
    let result = state.insert(NativeInsertRequest {
        text: last,
        source: Some("last_transcript_restore".to_string()),
        corrected: Some(false),
        auto_paste: None,
    });
    Ok(result)
}

/// The one place in the product that may raise the compositor's input
/// permission dialog.
///
/// It is a button in Delivery & Insert and nothing else -- not a startup step,
/// not the first dictation, not a retry after a failed paste. The owner's
/// standing objection is to being asked repeatedly, and the answer that survives
/// that objection is that WordScript asks exactly when it is asked to (ADR
/// 0228, answer 1; ADR 0234).
///
/// Async and off the main thread because the call waits for a person to read a
/// dialog: on the main thread that is a frozen webview for as long as they take.
#[tauri::command]
pub async fn request_portal_input_grant(app: AppHandle) -> Result<NativeInsertionStatus, String> {
    let granted = tauri::async_runtime::spawn_blocking(portal_session::request_grant)
        .await
        .map_err(|error| format!("Portal grant task panicked: {error}"))?;
    runtime_log::record(format!(
        "[WordScript] Portal grant action finished phase={:?} session_active={}",
        granted.phase, granted.session_active,
    ));

    let state = app
        .try_state::<Mutex<NativeInsertionState>>()
        .ok_or_else(|| "Native insertion state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

#[tauri::command]
pub fn clear_native_scratchpad(
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertionStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.clear())
}

pub fn insert_transcription_from_legacy<R: Runtime>(
    app: &AppHandle<R>,
    text: &str,
    corrected: bool,
    auto_paste: Option<bool>,
) -> Result<NativeInsertResult, String> {
    let started_at = Instant::now();
    let state = app
        .try_state::<Mutex<NativeInsertionState>>()
        .ok_or_else(|| "Native insertion state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let result = state.insert(NativeInsertRequest {
        text: text.to_string(),
        source: Some(
            if corrected {
                "legacy_transcription_corrected"
            } else {
                "legacy_transcription"
            }
            .to_string(),
        ),
        corrected: Some(corrected),
        auto_paste,
    });
    drop(state);

    runtime_log::record(format!(
        "[WordScript] Native insert legacy state done total_elapsed_ms={}",
        started_at.elapsed().as_millis(),
    ));

    // No cue is played here. This helper is called from three flows that reach
    // "finished" at three different moments, and it runs BEFORE each caller's
    // staleness gate — so a cue emitted here announced a delivery that the
    // session might still discard, and on the auto_paste path it sounded
    // before the result surface appeared (sound ahead of picture). The cues
    // belong to the session lifecycle, next to the event that tells the UI the
    // same thing; see ADR 0012.
    Ok(result)
}

pub fn format_text_for_insert(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if matches!(trimmed.chars().last(), Some('.') | Some('!') | Some('?')) {
        format!("{trimmed} ")
    } else {
        trimmed.to_string()
    }
}

pub(crate) fn execute_insert_request_with_io(
    request: NativeInsertRequest,
    config: &NativeInsertionConfig,
    entry_index: usize,
    platform: NativeInsertPlatformContext,
    io: &mut impl InsertIo,
    portal_prompt_out: Option<&mut Option<LastPortalPrompt>>,
) -> NativeInsertResult {
    let source = request
        .source
        .unwrap_or_else(|| "native_insert".to_string());
    let corrected = request.corrected.unwrap_or(false);
    let insert_text = format_text_for_insert(&request.text);
    let auto_paste = platform.auto_paste;
    let previous_clipboard_text = auto_paste.then(|| io.read_clipboard_text()).flatten();
    let mut clipboard_written = false;
    let mut paste_attempted = false;
    let mut pasted = false;
    let mut error = None;
    let mut fallback_reason = None;
    let mut active_driver = NativeInsertDriver::Scratchpad;
    let mut clipboard_restore = NativeClipboardRestoreStatus::NotAttempted;
    let mut portal_prompt: Option<(PortalPromptSignal, NativeInsertDriver, String)> = None;

    if auto_paste
        && platform.try_xdotool_type_first
        && insert_text.len() <= config.xdotool_type_max_chars
    {
        paste_attempted = true;
        match io.type_with_driver(NativeInsertDriver::XdotoolType, &insert_text) {
            Ok(()) => {
                pasted = true;
                active_driver = NativeInsertDriver::XdotoolType;
                clipboard_restore = NativeClipboardRestoreStatus::SkippedNoPreviousClipboard;
                runtime_log::record(format!(
                    "[WordScript] Native insert xdotool type used text_len={}",
                    insert_text.len(),
                ));
            }
            Err(cause) => {
                if let Some(signal) = detect_portal_prompt_from_stderr(&cause) {
                    runtime_log::record(format!(
                        "[WordScript] Native insert xdotool type triggered portal signal={} stderr={}",
                        signal.label(),
                        cause,
                    ));
                    portal_prompt = Some((signal, NativeInsertDriver::XdotoolType, cause.clone()));
                }
                runtime_log::record(format!(
                    "[WordScript] Native insert xdotool type failed, falling through: {cause}",
                ));
            }
        }
    }

    if !pasted {
        match run_clipboard_driver_chain(&platform, &insert_text, io) {
            Ok(driver) => {
                clipboard_written = true;
                active_driver = driver;
            }
            Err(cause) => {
                error = Some(cause.clone());
                fallback_reason = Some(cause);
            }
        }
    }

    let insert_mode = if pasted && !clipboard_written {
        NativeInsertMode::DirectPaste
    } else if !clipboard_written {
        active_driver = NativeInsertDriver::Scratchpad;
        NativeInsertMode::ScratchpadFallback
    } else if !auto_paste {
        NativeInsertMode::ClipboardOnly
    } else {
        paste_attempted = true;

        // Whether an XTEST paste can be expected to land. This does NOT gate the
        // paste: an earlier version refused outright when no foreign X window
        // held the focus, and the owner's experience contradicted the theory --
        // auto-paste had worked intermittently against native Wayland windows.
        // It can: KWin forwards XTEST fake input from Xwayland into the
        // compositor, so the absence of a focused X client does not prove the
        // keystroke goes nowhere. It only means nothing here can confirm that it
        // went somewhere.
        //
        // What that uncertainty must not cost is the transcript.
        // `schedule_clipboard_restore` puts the PREVIOUS contents back a moment
        // after the paste, so on a run that did not actually insert, the user is
        // left with neither the paste nor the text. When delivery cannot be
        // confirmed, the transcript stays on the clipboard.
        //
        // The probe is asked ONCE, here, and its answer does two jobs: it
        // decides which single driver the lane uses (`PasteLane`), and it
        // decides whether the clipboard may be restored afterwards. Asking twice
        // could give two answers -- the focus can move between them -- and a run
        // that chose its driver on one answer and its restore on another would
        // be reasoning about two different moments.
        let xtest_target = if platform.is_wayland && platform.has_x11_display {
            io.probe_xtest_target()
        } else {
            XtestTargetProbe::Unknown
        };
        let lane = PasteLane {
            xtest_target,
            portal_session_live: platform.is_wayland && io.portal_session_is_live(),
        };
        let xtest_delivery_confirmable = !(platform.is_wayland && platform.has_x11_display)
            || xtest_target != XtestTargetProbe::Unreachable;

        io.wait_before_paste(config.paste_delay_ms);
        match run_paste_driver_chain(&platform, lane, io) {
            Ok(driver) => {
                pasted = true;
                active_driver = driver;
                // A portal paste is a D-Bus call that returned Ok, which is the
                // compositor that owns the focused window saying it took the
                // keys. That is the confirmation this whole track exists for,
                // and it makes the clipboard safe to restore on exactly the
                // lane where XTEST could never say so.
                let delivery_confirmable = matches!(
                    driver,
                    NativeInsertDriver::RemoteDesktopPortal
                ) || xtest_delivery_confirmable;
                if config.keep_on_clipboard {
                    // Asked for, not inferred. The paste is an additional
                    // delivery here rather than a transport that tidies up after
                    // itself, so there is nothing to put back.
                    runtime_log::record(
                        "[WordScript] Native insert clipboard kept by profile setting: the \
                         transcript stays on the clipboard instead of the previous contents \
                         being restored"
                            .to_string(),
                    );
                    clipboard_restore = NativeClipboardRestoreStatus::SkippedKeptOnClipboard;
                } else if !delivery_confirmable {
                    runtime_log::record(
                        "[WordScript] Native insert delivery unconfirmed: no foreign X window held \
                         the focus, so the transcript stays on the clipboard instead of being \
                         restored away"
                            .to_string(),
                    );
                    clipboard_restore = NativeClipboardRestoreStatus::SkippedDeliveryUnverified;
                } else if previous_clipboard_text.is_some() {
                    io.schedule_clipboard_restore(
                        previous_clipboard_text,
                        CLIPBOARD_RESTORE_DELAY_MS,
                    );
                    clipboard_restore = NativeClipboardRestoreStatus::Scheduled;
                } else {
                    clipboard_restore = NativeClipboardRestoreStatus::SkippedNoPreviousClipboard;
                }
                NativeInsertMode::DirectPaste
            }
            Err(cause) => {
                if let Some(signal) = detect_portal_prompt_from_stderr(&cause) {
                    let driver = paste_driver_execution_chain(&platform, lane)
                        .into_iter()
                        .next()
                        .unwrap_or(NativeInsertDriver::Scratchpad);
                    runtime_log::record(format!(
                        "[WordScript] Native insert paste driver={} blocked by portal signal={} stderr={}",
                        driver.label(),
                        signal.label(),
                        cause,
                    ));
                    portal_prompt = Some((signal, driver, cause.clone()));
                }
                error = Some(cause.clone());
                fallback_reason = Some(cause);
                NativeInsertMode::ClipboardFallback
            }
        }
    };

    let (recovery_action, recovery_message) = recovery_guidance_for_insert(
        &insert_mode,
        clipboard_written,
        paste_attempted,
        pasted,
        error.as_deref(),
    );

    let entry = ScratchpadEntry {
        id: format!("scratch-{}-{}", now_ms(), entry_index),
        text: insert_text.clone(),
        source,
        created_at_ms: now_ms(),
        corrected,
        insert_mode: insert_mode.clone(),
        active_driver,
        clipboard_written,
        paste_attempted,
        pasted,
        fallback_reason: fallback_reason.clone(),
        error: error.clone(),
        recovery_action,
        recovery_message: Some(recovery_message.clone()),
        clipboard_restore,
    };

    let result = NativeInsertResult {
        ok: (clipboard_written || pasted)
            && (!auto_paste || pasted || matches!(insert_mode, NativeInsertMode::ClipboardOnly)),
        text: insert_text,
        insert_mode,
        active_driver,
        clipboard_written,
        paste_attempted,
        pasted,
        scratchpad_entry: entry,
        fallback_available: true,
        fallback_reason,
        error,
        recovery_action,
        recovery_message,
        clipboard_restore,
    };

    if let Some(slot) = portal_prompt_out {
        *slot = portal_prompt.map(|(signal, driver, stderr)| LastPortalPrompt {
            signal,
            driver,
            detected_at_ms: now_ms(),
            stderr_excerpt: stderr.chars().take(280).collect(),
        });
    }

    result
}

fn recovery_guidance_for_insert(
    insert_mode: &NativeInsertMode,
    clipboard_written: bool,
    paste_attempted: bool,
    pasted: bool,
    error: Option<&str>,
) -> (NativeInsertRecoveryAction, String) {
    match insert_mode {
        NativeInsertMode::DirectPaste if pasted => (
            NativeInsertRecoveryAction::None,
            "Inserted at the cursor. No recovery action is needed.".to_string(),
        ),
        NativeInsertMode::ClipboardOnly if clipboard_written => (
            NativeInsertRecoveryAction::ManualPaste,
            "Transcript is on the clipboard. Paste manually in the target app when ready."
                .to_string(),
        ),
        NativeInsertMode::ClipboardFallback if clipboard_written && paste_attempted => (
            NativeInsertRecoveryAction::ManualPaste,
            format!(
                "Auto-paste failed, but the transcript is on the clipboard. Paste manually or use the scratchpad recovery.{}",
                error.map(|value| format!(" Last error: {value}")).unwrap_or_default(),
            ),
        ),
        _ => (
            NativeInsertRecoveryAction::UseScratchpad,
            format!(
                "Clipboard delivery failed. Use the recovery scratchpad or last-transcript restore.{}",
                error.map(|value| format!(" Last error: {value}")).unwrap_or_default(),
            ),
        ),
    }
}

fn read_clipboard_text() -> Option<String> {
    Clipboard::new()
        .ok()
        .and_then(|mut clipboard| clipboard.get_text().ok())
}

fn schedule_clipboard_restore(text: Option<String>, delay_ms: u64) {
    let Some(text) = text else {
        return;
    };

    thread::sleep(Duration::from_millis(delay_ms));
    if let Err(error) = write_clipboard_with_system_chain(&text) {
        runtime_log::record(format!(
            "[WordScript] Native insert clipboard restore failed: {error}"
        ));
    } else {
        runtime_log::record(format!(
            "[WordScript] Native insert clipboard restore done after_ms={delay_ms}"
        ));
    }
}

fn write_clipboard_with_arboard(text: &str) -> Result<(), String> {
    // arboard selects its Linux backend from the live environment. WordScript
    // runs the WebKitGTK webview under GDK_BACKEND=x11 with WAYLAND_DISPLAY
    // removed (main.rs), so naively calling arboard here makes it pick the X11
    // backend and write the XWayland clipboard — a different buffer from the
    // Wayland clipboard `wayland-0` the user's apps read. On an original
    // Wayland session, temporarily restore WAYLAND_DISPLAY so arboard writes
    // the Wayland clipboard, then remove it again so WebKitGTK keeps its X11
    // backend. arboard reads the env at Clipboard::new() time.
    let restore_wayland = is_wayland_session();
    if restore_wayland {
        if let Some(display) = original_wayland_display() {
            // SAFETY: set_var/remove_var are unsafe on Unix because env access
            // is not thread-safe in general; here the insert path is single
            // (one commit at a time) and WebKitGTK does not re-read
            // WAYLAND_DISPLAY per frame, so the transient change is safe.
            unsafe { std::env::set_var("WAYLAND_DISPLAY", display) };
        }
    }

    let arboard_result = Clipboard::new()
        .map_err(|error| format!("Clipboard unavailable: {error}"))
        .and_then(|mut clipboard| {
            clipboard
                .set_text(text.to_string())
                .map_err(|error| format!("Could not write clipboard: {error}"))
        });

    if restore_wayland {
        // Re-hide WAYLAND_DISPLAY for WebKitGTK's X11 backend contract.
        unsafe { std::env::remove_var("WAYLAND_DISPLAY") };
    }

    arboard_result
}

fn detect_insert_platform_context(auto_paste: bool) -> NativeInsertPlatformContext {
    let is_wl = is_wayland_session();
    let is_x11 = cfg!(target_os = "linux") && std::env::var_os("DISPLAY").is_some();
    let has_xd = cfg!(target_os = "linux") && command_in_path("xdotool");
    NativeInsertPlatformContext {
        auto_paste,
        is_wayland: is_wl,
        has_x11_display: is_x11,
        has_wl_copy: cfg!(target_os = "linux") && command_in_path("wl-copy"),
        has_xdotool: has_xd,
        has_wtype: cfg!(target_os = "linux") && command_in_path("wtype"),
        has_ydotool: cfg!(target_os = "linux") && command_in_path("ydotool"),
        try_xdotool_type_first: cfg!(target_os = "linux") && !is_wl && is_x11 && has_xd,
    }
}

pub(crate) fn detect_portal_capabilities_for_status() -> PortalCapabilities {
    detect_portal_capabilities()
}

/// Puts `text` on the system clipboard through the platform's driver chain and
/// nothing else — no paste, no scratchpad, no record.
///
/// `pub(crate)` for the `clipboard_only` immediate write: that path needs the
/// text reachable while the preview is still open, which is a clipboard write on
/// its own rather than a delivery.
pub(crate) fn write_clipboard_with_system_chain(text: &str) -> Result<NativeInsertDriver, String> {
    let mut io = SystemInsertIo;
    run_clipboard_driver_chain(&detect_insert_platform_context(false), text, &mut io)
}

fn run_clipboard_driver_chain(
    platform: &NativeInsertPlatformContext,
    text: &str,
    io: &mut impl InsertIo,
) -> Result<NativeInsertDriver, String> {
    // Diagnostic for the clipboard_only-delivery investigation (plan P3):
    // records which Wayland/X11 flags and which clipboard display the chain
    // resolved, plus the driver order it will try. Lets the Diagnostics view
    // confirm whether wl-copy was even a candidate and which WAYLAND_DISPLAY
    // it targeted at insert time.
    runtime_log::record(format!(
        "[WordScript] Clipboard chain entry is_wayland={} has_wl_copy={} wayland_display={} chain={:?}",
        platform.is_wayland,
        platform.has_wl_copy,
        original_wayland_display().unwrap_or_default(),
        clipboard_driver_execution_chain(platform),
    ));

    let mut errors = Vec::new();

    for driver in clipboard_driver_execution_chain(platform) {
        match io.write_clipboard_with_driver(driver, text) {
            Ok(()) => {
                runtime_log::record(format!(
                    "[WordScript] Native insert clipboard strategy={} auto_paste={}",
                    driver.label(),
                    platform.auto_paste,
                ));
                return Ok(driver);
            }
            Err(error) => errors.push(format!("{}: {error}", driver.label())),
        }
    }

    Err(errors.join("; "))
}

fn run_paste_driver_chain(
    platform: &NativeInsertPlatformContext,
    lane: PasteLane,
    io: &mut impl InsertIo,
) -> Result<NativeInsertDriver, String> {
    let mut errors = Vec::new();
    let mut first_portal_signal: Option<PortalPromptSignal> = None;
    let started_at = Instant::now();
    let execution_chain = paste_driver_execution_chain(platform, lane);

    if execution_chain.is_empty() {
        return Err(no_available_paste_driver_reason(platform));
    }


    for driver in execution_chain {
        match io.paste_with_driver(driver) {
            Ok(()) => {
                runtime_log::record(format!(
                    "[WordScript] Native insert paste strategy={} elapsed_ms={}",
                    driver.label(),
                    started_at.elapsed().as_millis(),
                ));
                return Ok(driver);
            }
            Err(error) => {
                if let Some(signal) = detect_portal_prompt_from_stderr(&error) {
                    runtime_log::record(format!(
                        "[WordScript] Native insert portal prompt detected driver={} signal={} stderr={}",
                        driver.label(),
                        signal.label(),
                        error,
                    ));
                    if first_portal_signal.is_none() {
                        first_portal_signal = Some(signal);
                    }
                } else {
                    runtime_log::record(format!(
                        "[WordScript] Native insert paste driver={} failed: {error}",
                        driver.label(),
                    ));
                }
                errors.push(format!("{}: {error}", driver.label()));
            }
        }
    }

    if let Some(signal) = first_portal_signal {
        return Err(format!(
            "{}: {}",
            portal_prompt_signal_label(&signal),
            errors.join("; "),
        ));
    }

    Err(errors.join("; "))
}

fn clipboard_driver_execution_chain(
    platform: &NativeInsertPlatformContext,
) -> Vec<NativeInsertDriver> {
    let mut chain = Vec::new();

    if cfg!(target_os = "linux") && platform.is_wayland && platform.has_wl_copy {
        chain.push(NativeInsertDriver::WlCopy);
    }

    chain.push(NativeInsertDriver::Arboard);
    chain
}

/// What this run knows about where the paste would land, decided once and
/// before any driver is launched.
///
/// SEQUENCING IS A REQUIREMENT, NOT AN OPTIMISATION (owner, 2026-08-18). Each
/// fake-input attempt on Linux is its own privilege prompt, which is why
/// `wtype` and `ydotool` were rejected outright. So the drivers on a Wayland
/// lane are never tried one after another: this pair of answers picks the
/// single one that applies, and if it fails the run goes to the clipboard
/// rather than to a second driver.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PasteLane {
    pub xtest_target: XtestTargetProbe,
    pub portal_session_live: bool,
}

impl PasteLane {
    /// What a caller that is describing the machine rather than delivering a
    /// transcript knows: the portal's state, which is a fact, and nothing about
    /// the focus, which is not knowable until a dictation actually ends.
    fn described(portal_session_live: bool) -> Self {
        Self {
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live,
        }
    }
}

/// The single driver this run may use, as a one-element list on every Linux
/// Wayland lane.
///
/// The table is ADR 0228's, and it reads in exactly one direction:
///
/// | Probe          | Driver                | Prompt            |
/// | -------------- | --------------------- | ----------------- |
/// | `Reachable`    | `xdotool`             | none              |
/// | `Unreachable`  | RemoteDesktop portal  | none, it is granted already |
/// | `Unknown`      | `xdotool`, then clipboard | none          |
///
/// `Unknown` stays on `xdotool` deliberately: an undetermined probe is not
/// evidence that XTEST has no target (KWin forwards XTEST from Xwayland into
/// the compositor, which is what ADR 0229 was written about), and spending the
/// portal on a guess would be spending the one driver that can confirm itself.
fn paste_driver_execution_chain(
    platform: &NativeInsertPlatformContext,
    lane: PasteLane,
) -> Vec<NativeInsertDriver> {
    if cfg!(target_os = "windows") || cfg!(target_os = "macos") {
        return vec![NativeInsertDriver::Enigo];
    }

    if platform.is_wayland {
        // A native Wayland window holds the focus and the grant exists: this is
        // the one case XTEST provably cannot serve and the portal can.
        if lane.portal_session_live && lane.xtest_target == XtestTargetProbe::Unreachable {
            return vec![NativeInsertDriver::RemoteDesktopPortal];
        }

        if platform.has_x11_display && platform.has_xdotool {
            return vec![NativeInsertDriver::Xdotool];
        }

        // Pure Wayland: there is no XTEST lane at all here, so the portal is
        // not a second attempt after anything -- it is the only mechanism.
        if lane.portal_session_live {
            return vec![NativeInsertDriver::RemoteDesktopPortal];
        }

        if platform.has_x11_display {
            // Hybrid X11/Wayland without xdotool: wtype/ydotool stay out to
            // avoid compositor fake-input privilege prompts.
            return vec![NativeInsertDriver::Enigo];
        }

        // Pure Wayland with no grant: clipboard-only is the safe default and
        // the user pastes manually.
        return Vec::new();
    }

    let mut chain = Vec::new();
    if platform.has_x11_display && platform.has_xdotool {
        chain.push(NativeInsertDriver::Xdotool);
    }
    chain.push(NativeInsertDriver::Enigo);
    chain
}

fn no_available_paste_driver_reason(platform: &NativeInsertPlatformContext) -> String {
    if cfg!(target_os = "linux") && platform.is_wayland {
        if platform.has_x11_display {
            return "No usable paste driver available: xdotool is missing in PATH for the active XWayland lane.".to_string();
        }

        return "Auto-paste has no driver on this Wayland session yet. Grant the one-time input permission in Delivery & Insert, or paste manually from the clipboard.".to_string();
    }

    if cfg!(target_os = "linux") {
        return "No usable paste driver available: install xdotool or fall back to clipboard-only recovery on Linux.".to_string();
    }

    "No usable paste driver available for this platform path.".to_string()
}

fn command_in_path(program: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|path| executable_exists(&path, program)))
        .unwrap_or(false)
}

fn executable_exists(path: &PathBuf, program: &str) -> bool {
    let candidate = path.join(program);
    candidate.is_file()
}

fn paste_with_enigo() -> Result<(), String> {
    if cfg!(target_os = "linux") && command_in_path("xdotool") {
        return Err("Enigo skipped because xdotool is available on Linux.".to_string());
    }

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|error| format!("Enigo input adapter unavailable: {error}"))?;
    let modifier = if cfg!(target_os = "macos") {
        Key::Meta
    } else {
        Key::Control
    };
    enigo
        .key(modifier, Press)
        .map_err(|error| format!("Could not press paste modifier: {error}"))?;
    let click_result = enigo.key(Key::Unicode('v'), Click);
    let release_result = enigo.key(modifier, Release);
    click_result.map_err(|error| format!("Could not trigger paste key: {error}"))?;
    release_result.map_err(|error| format!("Could not release paste modifier: {error}"))?;
    Ok(())
}

fn paste_with_command(program: &str, args: &[&str], restore_wayland: bool) -> Result<(), String> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    if restore_wayland {
        if let Some(display) = original_wayland_display() {
            command.env("WAYLAND_DISPLAY", display);
        }
    }

    let output = command
        .output()
        .map_err(|error| format!("{program} unavailable: {error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err(format!(
            "{program} paste failed with status {}",
            output.status
        ))
    } else {
        Err(format!("{program} paste failed: {stderr}"))
    }
}

/// Ask the X server whether it has a focused client with a real window name.
///
/// `xdotool getactivewindow` reads `_NET_ACTIVE_WINDOW` from the root window.
/// On a hybrid XWayland session where a native Wayland window holds the focus,
/// KWin leaves that property pointing at a placeholder with no `WM_NAME`
/// (measured: id `0x200000`, empty name), and `getactivewindow` can also fail
/// outright. Either shape means an XTEST key event has no recipient.
///
/// A non-empty name is the only positive evidence, and anything that prevents
/// the probe from running at all reports `Unknown` rather than `Unreachable`:
/// refusing a paste on a probe that did not work would trade a silent failure
/// for a silent refusal.
fn probe_xtest_target_with_xdotool() -> XtestTargetProbe {
    let output = Command::new("xdotool")
        .args(["getactivewindow", "getwindowname"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    let Ok(output) = output else {
        return XtestTargetProbe::Unknown;
    };

    if !output.status.success() {
        // `getactivewindow` exits non-zero when there is no active window at
        // all, which is exactly the native-Wayland-focus case.
        return XtestTargetProbe::Unreachable;
    }

    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() {
        return XtestTargetProbe::Unreachable;
    }

    // A named X window is not automatically a usable target: OUR OWN windows are
    // X clients too. Measured 2026-08-18 on the reporting machine, the complete
    // list of visible X clients was:
    //
    //     "wordscript", "Wordscript" :: WordScript
    //     "wordscript", "Wordscript" :: WordScript - Settings
    //
    // Every other application in that session -- editor, browser, terminal --
    // was a native Wayland client. So on a hybrid session the overlay and the
    // settings window can be the only things `getactivewindow` ever returns, and
    // treating that as reachable would send the paste into WordScript itself
    // rather than into whatever the user was writing in.
    if active_x_window_belongs_to_this_process() {
        return XtestTargetProbe::Unreachable;
    }

    XtestTargetProbe::Reachable
}

/// Whether the focused X window is one of ours.
///
/// `getwindowpid` reads `_NET_WM_PID`, which not every client sets. A window
/// that does not answer is treated as somebody else's: the question being asked
/// is "is this definitely us", and an unanswered probe is not a yes.
fn active_x_window_belongs_to_this_process() -> bool {
    let Ok(output) = Command::new("xdotool")
        .args(["getactivewindow", "getwindowpid"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
    else {
        return false;
    };
    if !output.status.success() {
        return false;
    }
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<u32>()
        .map(|pid| pid == std::process::id())
        .unwrap_or(false)
}

fn type_with_xdotool(text: &str) -> Result<(), String> {
    let output = Command::new("xdotool")
        .args(["type", "--clearmodifiers", "--delay", "0", "--", text])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("xdotool unavailable: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err(format!("xdotool type failed with status {}", output.status))
    } else {
        Err(format!("xdotool type failed: {stderr}"))
    }
}

fn write_wayland_clipboard(text: &str) -> Result<(), String> {
    let Some(display) = original_wayland_display() else {
        return Err("not an original Wayland session".to_string());
    };

    runtime_log::record(format!(
        "[WordScript] wl-copy write start display={} text_len={}",
        display,
        text.len(),
    ));

    let mut child = Command::new("wl-copy")
        .env("WAYLAND_DISPLAY", &display)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("wl-copy unavailable: {error}"))?;

    // Write the transcript and close stdin (EOF) so wl-copy reads the full
    // payload and forks its clipboard-serving daemon.
    {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "wl-copy stdin unavailable".to_string())?;
        stdin
            .write_all(text.as_bytes())
            .map_err(|error| format!("Could not send transcript to wl-copy: {error}"))?;
    }

    // Block on wl-copy's exit so the clipboard set is committed before we
    // report success. The previous fire-and-forget returned Ok(()) immediately
    // and masked a failed wl-copy (e.g. compositor race / unreachable display)
    // as a successful clipboard write — `clipboard_written=true` then lied, the
    // clipboard-only delivery lost the text, and the chain never fell through
    // to arboard. wl-copy normally forks a daemon and exits quickly; cap the
    // wait so a hung compositor can't stall the insert.
    let deadline = Instant::now() + Duration::from_millis(WL_COPY_WAIT_MS);
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if status.success() {
                    return verify_wayland_clipboard(&display, text);
                }
                let stderr = child
                    .stderr
                    .take()
                    .and_then(|mut s| {
                        let mut buf = String::new();
                        std::io::Read::read_to_string(&mut s, &mut buf).ok().map(|_| buf)
                    })
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
                let detail = stderr
                    .map(|s| format!(": {s}"))
                    .unwrap_or_else(|| format!(" (status {})", status));
                return Err(format!("wl-copy exited non-success{detail}"));
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    // wl-copy did not exit within the wait window. Previously
                    // this returned an OPTIMISTIC Ok(()) — which masked a
                    // wl-copy that forked NO serving daemon (compositor race /
                    // unreachable display) as success, leaving the clipboard
                    // empty while reporting `clipboard_written=true`. Now
                    // verify the clipboard actually holds our text via a
                    // bounded `wl-paste` read-back: if it does, the daemon is
                    // serving and we can safely report Ok; if not, return Err
                    // so the chain falls through to arboard instead of lying.
                    // (plan P3, candidate root R1)
                    runtime_log::record(format!(
                        "[WordScript] wl-copy did not exit within {}ms; verifying clipboard via wl-paste",
                        WL_COPY_WAIT_MS
                    ));
                    return verify_wayland_clipboard(&display, text);
                }
                std::thread::sleep(Duration::from_millis(5));
            }
            Err(error) => return Err(format!("wl-copy wait failed: {error}")),
        }
    }
}

/// Reads back the Wayland clipboard via `wl-paste` (bounded) and confirms it
/// matches the text we just offered. This is the verification that turns a
/// silent wl-copy failure into a detected one: on Wayland the selection only
/// exists while a serving process holds it, so a successful read-back proves
/// the daemon took ownership and is serving our content. A mismatch / empty
/// read-back means the clipboard is NOT reliably populated and the caller
/// should fall through to the next driver. Returns Ok(()) on match, Err on
/// mismatch or when `wl-paste` is unavailable (in which case we cannot
/// disprove success and conservatively trust the wl-copy result). (plan P3)
fn verify_wayland_clipboard(display: &str, expected: &str) -> Result<(), String> {
    if !command_in_path("wl-paste") {
        runtime_log::record(
            "[WordScript] wl-paste unavailable; cannot verify wl-copy write, trusting wl-copy result".to_string(),
        );
        return Ok(());
    }

    match read_wayland_clipboard(display) {
        Ok(Some(actual)) => {
            let expected_trim = expected.trim();
            let actual_trim = actual.trim();
            if actual_trim == expected_trim {
                runtime_log::record(format!(
                    "[WordScript] wl-copy clipboard verified via wl-paste ({} bytes)",
                    actual.len()
                ));
                Ok(())
            } else {
                runtime_log::record(format!(
                    "[WordScript] wl-copy clipboard read-back mismatch: expected {} bytes, got {} bytes",
                    expected_trim.len(),
                    actual_trim.len()
                ));
                Err(format!(
                    "wl-copy clipboard read-back mismatch (expected {} bytes, got {})",
                    expected_trim.len(),
                    actual_trim.len()
                ))
            }
        }
        Ok(None) => {
            runtime_log::record(
                "[WordScript] wl-copy clipboard read-back empty; clipboard not populated".to_string(),
            );
            Err("wl-copy clipboard read-back empty; clipboard not populated".to_string())
        }
        Err(error) => {
            runtime_log::record(format!(
                "[WordScript] wl-paste read-back failed: {error}"
            ));
            // If we cannot read back at all, do not lie about success — let the
            // chain fall through to arboard.
            Err(format!("wl-paste read-back failed: {error}"))
        }
    }
}

/// Runs `wl-paste` against the given Wayland display and returns the current
/// clipboard text. Bounded by `WL_PASTE_WAIT_MS` so a hung compositor cannot
/// stall the insert path. Returns `Ok(None)` when the clipboard has no owner
/// (empty selection) and `Err` only when wl-paste itself fails to run.
fn read_wayland_clipboard(display: &str) -> Result<Option<String>, String> {
    let mut child = Command::new("wl-paste")
        .env("WAYLAND_DISPLAY", display)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("wl-paste unavailable: {error}"))?;

    let deadline = Instant::now() + Duration::from_millis(WL_PASTE_WAIT_MS);
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let output = child
                    .stdout
                    .take()
                    .and_then(|mut s| {
                        let mut buf = String::new();
                        std::io::Read::read_to_string(&mut s, &mut buf).ok().map(|_| buf)
                    })
                    .unwrap_or_default();
                if status.success() {
                    return Ok(if output.is_empty() { None } else { Some(output) });
                }
                return Err(format!("wl-paste exited status {status}"));
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    return Err("wl-paste did not exit within the wait window".to_string());
                }
                std::thread::sleep(Duration::from_millis(5));
            }
            Err(error) => return Err(format!("wl-paste wait failed: {error}")),
        }
    }
}

fn original_wayland_display() -> Option<String> {
    std::env::var("WAYLAND_DISPLAY")
        .ok()
        .or_else(|| std::env::var("WORDSCRIPT_WAYLAND_DISPLAY").ok())
}

fn is_wayland_session() -> bool {
    cfg!(target_os = "linux")
        && (std::env::var_os("WAYLAND_DISPLAY").is_some()
            || std::env::var_os("WORDSCRIPT_WAS_WAYLAND").is_some())
}

fn platform_status(auto_paste: bool) -> NativeInsertionPlatformStatus {
    platform_status_from_context(detect_insert_platform_context(auto_paste))
}

fn platform_status_from_context(
    platform: NativeInsertPlatformContext,
) -> NativeInsertionPlatformStatus {
    // A status read describes the machine; it does not deliver anything. So it
    // asks the portal whether a session is live -- a fact that holds until
    // somebody revokes it -- and does NOT run the focus probe, whose answer is
    // about a moment that has not happened yet. `Unknown` here is the truth:
    // where the next dictation will land is not knowable while a settings
    // screen is open, and the probe costs two process spawns per poll.
    let lane = PasteLane::described(portal_session::session_is_live());
    let active_driver = preferred_active_driver(&platform, lane);
    let driver_chain = build_driver_chain(&platform, active_driver, lane);
    let (readiness, readiness_message) = platform_readiness(&platform, lane);
    let portal_capabilities = if cfg!(target_os = "linux") {
        Some(detect_portal_capabilities_for_status())
    } else {
        None
    };
    let paste_disabled_reason =
        paste_disabled_reason_for_platform(&platform, portal_capabilities.as_ref());

    if cfg!(target_os = "windows") {
        NativeInsertionPlatformStatus {
            platform_label: "Windows".to_string(),
            support_tier: NativeSupportTier::Tier1,
            readiness,
            readiness_message,
            insert_strategy: if platform.auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            active_driver,
            support_message: if platform.auto_paste {
                "Tier-1 path: direct auto-paste is the default, and the scratchpad keeps a recovery copy if insertion still fails.".to_string()
            } else {
                "Tier-1 path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            driver_chain,
            prerequisites: vec![
                "Keep focus on the target app before the auto-paste step runs.".to_string(),
                "Use clipboard-only mode if you want recovery without simulated Ctrl+V.".to_string(),
            ],
            caveats: vec![
                "Elevated target apps can ignore synthetic paste from a non-elevated WordScript process.".to_string(),
            ],
            portal_capabilities,
            paste_disabled_reason: paste_disabled_reason.map(|reason| reason.label().to_string()),
        }
    } else if cfg!(target_os = "macos") {
        NativeInsertionPlatformStatus {
            platform_label: "macOS".to_string(),
            support_tier: NativeSupportTier::Tier1,
            readiness,
            readiness_message,
            insert_strategy: if platform.auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            active_driver,
            support_message: if platform.auto_paste {
                "Tier-1 path: direct Cmd+V auto-paste is the default, and the scratchpad keeps a recovery copy if the target app blocks insertion.".to_string()
            } else {
                "Tier-1 path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            driver_chain,
            prerequisites: vec![
                "Allow Accessibility for WordScript, your terminal, or VS Code in System Settings -> Privacy & Security -> Accessibility before relying on auto-paste.".to_string(),
                "If macOS prompts for Input Monitoring while sending Cmd+V, allow it for the process that launched WordScript in development mode.".to_string(),
                "Disable auto-paste when you only want clipboard handoff without synthetic Cmd+V.".to_string(),
            ],
            caveats: vec![
                "Some sandboxed, remote-desktop, or elevated target apps can still reject simulated paste even after permissions were granted.".to_string(),
                "In development mode the permission entry may appear under Terminal or VS Code instead of a packaged WordScript app name.".to_string(),
            ],
            portal_capabilities,
            paste_disabled_reason: paste_disabled_reason.map(|reason| reason.label().to_string()),
        }
    } else if platform.is_wayland {
        let compositor_label = portal_capabilities
            .as_ref()
            .map(|cap| cap.compositor.label())
            .unwrap_or("Wayland compositor");
        NativeInsertionPlatformStatus {
            platform_label: "Linux Wayland".to_string(),
            support_tier: NativeSupportTier::Experimental,
            readiness,
            readiness_message,
            insert_strategy: if platform.auto_paste {
                NativeInsertMode::ClipboardFallback
            } else {
                NativeInsertMode::ClipboardOnly
            },
            active_driver,
            support_message: if platform.auto_paste {
                format!(
                    "Experimental path on {}: WordScript writes through {}, then tries {} before falling back to clipboard and scratchpad recovery.",
                    compositor_label,
                    preferred_clipboard_driver(&platform).label(),
                    preferred_paste_driver_label(&platform, lane),
                )
            } else {
                format!(
                    "Experimental path on {}: WordScript writes to the clipboard and keeps a scratchpad recovery copy.",
                    compositor_label
                )
            },
            driver_chain,
            prerequisites: vec![
                wayland_prerequisite_message(&platform),
                wayland_portal_prerequisite_message(portal_capabilities.as_ref()),
                "Keep clipboard-only recovery enabled if your desktop blocks direct insert.".to_string(),
            ],
            caveats: wayland_caveats(&platform, portal_capabilities.as_ref()),
            portal_capabilities,
            paste_disabled_reason: paste_disabled_reason.map(|reason| reason.label().to_string()),
        }
    } else {
        NativeInsertionPlatformStatus {
            platform_label: "Linux X11".to_string(),
            support_tier: NativeSupportTier::Preview,
            readiness,
            readiness_message,
            insert_strategy: if platform.auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            active_driver,
            support_message: if platform.auto_paste {
                format!(
                    "Preview path: WordScript writes through {}, then prefers {} for direct paste on X11 before falling back to clipboard and scratchpad recovery.",
                    preferred_clipboard_driver(&platform).label(),
                    preferred_paste_driver_label(&platform, lane),
                )
            } else {
                "Preview path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            driver_chain,
            prerequisites: vec![
                "Run under X11 or XWayland if you want the current direct paste path.".to_string(),
                if platform.has_xdotool {
                    "xdotool is available for the active X11 lane.".to_string()
                } else {
                    "Install xdotool if you want the preferred X11 paste helper instead of the enigo fallback.".to_string()
                },
                "Keep clipboard recovery enabled for apps that do not accept synthetic paste consistently.".to_string(),
            ],
            caveats: vec![
                "Window manager quirks still make Linux less uniform than the Windows and macOS paths.".to_string(),
            ],
            portal_capabilities,
            paste_disabled_reason: paste_disabled_reason.map(|reason| reason.label().to_string()),
        }
    }
}

fn paste_disabled_reason_for_platform(
    platform: &NativeInsertPlatformContext,
    capabilities: Option<&PortalCapabilities>,
) -> Option<PasteDisableReason> {
    if !cfg!(target_os = "linux") || !platform.is_wayland {
        return None;
    }
    let capabilities = capabilities?;
    match capabilities.compositor {
        CompositorKind::KdePlasma6 | CompositorKind::GnomeMutter => {
            if capabilities.has_remote_desktop_portal {
                None
            } else {
                Some(PasteDisableReason::PortalSessionUnavailable)
            }
        }
        CompositorKind::KdePlasma5 => Some(PasteDisableReason::KdePlasma5UpgradeRecommended),
        CompositorKind::Hyprland => Some(PasteDisableReason::HyprlandNoPersistentPortal),
        CompositorKind::Sway => Some(PasteDisableReason::SwayUseWlrVirtualInput),
        CompositorKind::Other | CompositorKind::Unknown => {
            Some(PasteDisableReason::UnsupportedCompositor)
        }
    }
}

fn wayland_portal_prerequisite_message(capabilities: Option<&PortalCapabilities>) -> String {
    let Some(capabilities) = capabilities else {
        return "Wayland portal capabilities could not be detected; expect reduced auto-paste reliability.".to_string();
    };
    if !capabilities.has_xdg_desktop_portal_daemon {
        return "Install xdg-desktop-portal and your compositor's portal backend (xdg-desktop-portal-kde / -gnome / -wlr) to enable the RemoteDesktop grant for auto-paste.".to_string();
    }
    if !capabilities.compositor.supports_remote_desktop_portal() {
        return format!(
            "Detected compositor '{}': no persistent RemoteDesktop portal grant is available, so direct paste stays clipboard-only.",
            capabilities.compositor.label()
        );
    }
    if !capabilities.has_remote_desktop_portal {
        return format!(
            "Detected compositor '{}': the RemoteDesktop portal interface is not reachable on the session bus. Start xdg-desktop-portal and the matching backend, then retry.",
            capabilities.compositor.label()
        );
    }
    format!(
        "Detected compositor '{}': the xdg-desktop-portal RemoteDesktop grant is available. The KDE 'Control input devices' prompt will only appear once if at all.",
        capabilities.compositor.label()
    )
}

fn wayland_caveats(
    platform: &NativeInsertPlatformContext,
    capabilities: Option<&PortalCapabilities>,
) -> Vec<String> {
    let mut caveats = Vec::new();
    if platform.has_x11_display && platform.has_xdotool {
        caveats.push(
            "Hybrid X11/Wayland sessions stay on the xdotool lane first; on KDE Plasma 6 the XTEST key injection can still trigger the 'Control input devices' portal prompt and will then fall back to clipboard-only."
                .to_string(),
        );
    } else {
        caveats.push(
            "Behavior can differ between compositors, portal setups, and XWayland fallback paths on the same distro."
                .to_string(),
        );
    }
    if let Some(capabilities) = capabilities {
        for blocker in capabilities.diagnose_blockers() {
            caveats.push(blocker);
        }
    }
    caveats
}

fn platform_readiness(
    platform: &NativeInsertPlatformContext,
    lane: PasteLane,
) -> (NativeInsertReadiness, String) {
    if cfg!(target_os = "windows") {
        return if platform.auto_paste {
            (
                NativeInsertReadiness::Ready,
                "Direct insert is ready on the current Windows lane before the first dictation."
                    .to_string(),
            )
        } else {
            (
                NativeInsertReadiness::Ready,
                "Clipboard handoff is ready. WordScript will wait for manual paste on Windows."
                    .to_string(),
            )
        };
    }

    if cfg!(target_os = "macos") {
        return if platform.auto_paste {
            (
                NativeInsertReadiness::Ready,
                "Direct insert is available once the required macOS permissions are granted for the active launcher."
                    .to_string(),
            )
        } else {
            (
                NativeInsertReadiness::Ready,
                "Clipboard handoff is ready. WordScript will wait for manual paste on macOS."
                    .to_string(),
            )
        };
    }

    if platform.is_wayland {
        if !platform.auto_paste {
            return (
                NativeInsertReadiness::Ready,
                "Clipboard handoff is ready. WordScript will wait for manual paste on this Wayland lane."
                    .to_string(),
            );
        }

        if lane.portal_session_live {
            return (
                NativeInsertReadiness::Ready,
                if platform.has_x11_display && platform.has_xdotool {
                    "Both lanes are covered: xdotool for XWayland windows, and the granted input permission for native Wayland ones."
                        .to_string()
                } else {
                    "The one-time input permission is granted, so WordScript can insert into native Wayland windows."
                        .to_string()
                },
            );
        }

        if platform.has_x11_display && platform.has_xdotool {
            return (
                NativeInsertReadiness::Ready,
                "XWayland and xdotool are available, so WordScript can attempt direct paste before recovery fallback. Native Wayland windows need the one-time input permission below."
                    .to_string(),
            );
        }

        // Pure Wayland with no grant: nothing here can inject a keystroke.
        return (
            NativeInsertReadiness::RecoveryOnly,
            "Clipboard and scratchpad recovery are ready now. Insert at cursor needs the one-time input permission on this Wayland session; until it is granted, paste manually from the clipboard.".to_string(),
        );
    }

    if !platform.auto_paste {
        return (
            NativeInsertReadiness::Ready,
            "Clipboard handoff is ready. WordScript will wait for manual paste on this X11 lane."
                .to_string(),
        );
    }

    if platform.has_xdotool {
        return (
            NativeInsertReadiness::Ready,
            "xdotool is available, so WordScript can attempt direct paste on the current X11 lane before recovery fallback."
                .to_string(),
        );
    }

    (
        NativeInsertReadiness::RecoveryOnly,
        "Clipboard and scratchpad recovery are ready now. xdotool is missing, so direct paste falls back to the generic helper on this X11 lane."
            .to_string(),
    )
}

fn preferred_active_driver(
    platform: &NativeInsertPlatformContext,
    lane: PasteLane,
) -> NativeInsertDriver {
    if platform.auto_paste {
        if let Some(driver) = paste_driver_execution_chain(platform, lane)
            .into_iter()
            .find(|driver| !platform.is_wayland || !matches!(driver, NativeInsertDriver::Enigo))
        {
            return driver;
        }
    }

    if let Some(driver) = clipboard_driver_execution_chain(platform)
        .into_iter()
        .next()
    {
        return driver;
    }

    NativeInsertDriver::Scratchpad
}

fn preferred_clipboard_driver(platform: &NativeInsertPlatformContext) -> NativeInsertDriver {
    clipboard_driver_execution_chain(platform)
        .into_iter()
        .next()
        .unwrap_or(NativeInsertDriver::Scratchpad)
}

fn preferred_paste_driver_label(
    platform: &NativeInsertPlatformContext,
    lane: PasteLane,
) -> &'static str {
    paste_driver_execution_chain(platform, lane)
        .into_iter()
        .next()
        .unwrap_or(NativeInsertDriver::Scratchpad)
        .label()
}

fn wayland_prerequisite_message(platform: &NativeInsertPlatformContext) -> String {
    if platform.has_x11_display && platform.has_xdotool {
        return "XWayland is available, so WordScript prefers xdotool for the active hybrid session.".to_string();
    }

    if !platform.has_x11_display {
        return "Auto-paste is disabled on pure Wayland sessions to avoid compositor privilege prompts. Paste manually from the clipboard.".to_string();
    }

    let mut helpers = Vec::new();
    if !platform.has_wtype {
        helpers.push("wtype");
    }
    if !platform.has_ydotool {
        helpers.push("ydotool");
    }

    if helpers.is_empty() {
        "Wayland helper tools are present, but compositor policy still decides whether synthetic paste can work at all.".to_string()
    } else {
        format!(
            "Wayland helper tools and compositor policy decide whether synthetic paste can work at all. Missing today: {}.",
            helpers.join(", "),
        )
    }
}

fn build_driver_chain(
    platform: &NativeInsertPlatformContext,
    active_driver: NativeInsertDriver,
    lane: PasteLane,
) -> Vec<NativeInsertDriverStatus> {
    if cfg!(target_os = "windows") || cfg!(target_os = "macos") {
        return vec![
            driver_status(
                NativeInsertDriver::Arboard,
                true,
                active_driver,
                "Clipboard handoff before any paste shortcut runs.",
            ),
            driver_status(
                NativeInsertDriver::Enigo,
                true,
                active_driver,
                "Synthetic paste shortcut for the active target app.",
            ),
            driver_status(
                NativeInsertDriver::Scratchpad,
                true,
                active_driver,
                "Disk-backed recovery if clipboard or paste fails.",
            ),
        ];
    }

    if platform.is_wayland {
        let hybrid_lane = platform.has_x11_display && platform.has_xdotool;
        let pure_wayland = platform.is_wayland && !platform.has_x11_display;
        let mut statuses = vec![
            driver_status(
                NativeInsertDriver::WlCopy,
                platform.has_wl_copy,
                active_driver,
                if platform.has_wl_copy {
                    "Preferred Wayland clipboard writer when wl-copy is installed."
                } else {
                    "wl-copy is not available in PATH for the active Wayland session."
                },
            ),
            driver_status(
                NativeInsertDriver::Arboard,
                true,
                active_driver,
                "Generic clipboard writer fallback via arboard.",
            ),
            driver_status(
                NativeInsertDriver::Xdotool,
                hybrid_lane,
                active_driver,
                if hybrid_lane {
                    "Preferred paste helper for hybrid X11/Wayland sessions."
                } else if platform.has_x11_display {
                    "DISPLAY is present but xdotool is missing in PATH."
                } else {
                    "XWayland is not active, so xdotool is not part of this Wayland lane."
                },
            ),
            driver_status(
                NativeInsertDriver::RemoteDesktopPortal,
                lane.portal_session_live,
                active_driver,
                if lane.portal_session_live {
                    "Granted: takes the paste whenever a native Wayland window holds the focus, which is where xdotool cannot reach."
                } else if portal_session::portal_is_possible() {
                    "Available on this desktop but not granted yet. It is the only driver that reaches a native Wayland window; grant it once above."
                } else {
                    "This desktop has no RemoteDesktop portal, so there is no grant to give."
                },
            ),
            driver_status(
                NativeInsertDriver::Wtype,
                !hybrid_lane && !pure_wayland && platform.has_wtype,
                active_driver,
                if hybrid_lane {
                    "Skipped in hybrid X11/Wayland sessions to avoid compositor fake-input prompts after xdotool."
                } else if pure_wayland {
                    "Not used on pure Wayland sessions to avoid compositor privilege prompts."
                } else if platform.has_wtype {
                    "Wayland-native paste helper for compositors that allow virtual keyboard input."
                } else {
                    "wtype is not available in PATH."
                },
            ),
            driver_status(
                NativeInsertDriver::Ydotool,
                !hybrid_lane && !pure_wayland && platform.has_ydotool,
                active_driver,
                if hybrid_lane {
                    "Skipped in hybrid X11/Wayland sessions to avoid extra fake-input prompts after xdotool."
                } else if pure_wayland {
                    "Not used on pure Wayland sessions to avoid compositor privilege prompts."
                } else if platform.has_ydotool {
                    "Wayland fallback helper when ydotool and its daemon are available."
                } else {
                    "ydotool is not available in PATH."
                },
            ),
            driver_status(
                NativeInsertDriver::Enigo,
                !hybrid_lane && !pure_wayland,
                active_driver,
                if hybrid_lane {
                    "Skipped in the hybrid lane; clipboard and scratchpad recovery take over after xdotool failures."
                } else if pure_wayland {
                    "Not used on pure Wayland sessions to avoid compositor privilege prompts."
                } else {
                    "Last-resort synthetic paste helper after the dedicated Linux tools."
                },
            ),
        ];
        statuses.push(driver_status(
            NativeInsertDriver::Scratchpad,
            true,
            active_driver,
            "Disk-backed recovery if every clipboard or paste helper fails.",
        ));
        return statuses;
    }

    vec![
        driver_status(
            NativeInsertDriver::Arboard,
            true,
            active_driver,
            "Clipboard writer for the X11 path.",
        ),
        driver_status(
            NativeInsertDriver::Xdotool,
            platform.has_xdotool,
            active_driver,
            if platform.has_xdotool {
                "Preferred X11 paste helper."
            } else {
                "xdotool is not available in PATH."
            },
        ),
        driver_status(
            NativeInsertDriver::Enigo,
            true,
            active_driver,
            "Fallback synthetic paste helper if xdotool is unavailable or rejected.",
        ),
        driver_status(
            NativeInsertDriver::Scratchpad,
            true,
            active_driver,
            "Disk-backed recovery if clipboard or paste fails.",
        ),
    ]
}

fn driver_status(
    driver: NativeInsertDriver,
    available: bool,
    active_driver: NativeInsertDriver,
    detail: &str,
) -> NativeInsertDriverStatus {
    NativeInsertDriverStatus {
        driver,
        label: driver.label().to_string(),
        role: driver.role().to_string(),
        available,
        active: driver == active_driver,
        detail: detail.to_string(),
    }
}

fn load_scratchpad_entries() -> Vec<ScratchpadEntry> {
    let Ok(raw) = std::fs::read_to_string(scratchpad_file_path()) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<ScratchpadEntry>>(&raw).unwrap_or_default()
}

fn save_scratchpad_entries(entries: &[ScratchpadEntry]) -> Result<(), String> {
    let path = scratchpad_file_path();
    let raw = serde_json::to_string_pretty(entries).map_err(|error| error.to_string())?;
    std::fs::write(path, raw).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// The lane a hybrid XWayland session is on, with `xdotool` present.
    #[cfg(target_os = "linux")]
    fn hybrid_wayland_context() -> NativeInsertPlatformContext {
        NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: true,
            has_x11_display: true,
            has_wl_copy: true,
            has_xdotool: true,
            has_wtype: false,
            has_ydotool: false,
            try_xdotool_type_first: false,
        }
    }

    /// ADR 0228's table, read straight. The rule the owner set is that a run
    /// gets ONE driver -- each fake-input attempt is its own privilege prompt,
    /// which is why `wtype`/`ydotool` were rejected -- so every row here also
    /// asserts the length. A chain of two on this lane is the bug, even if both
    /// entries are individually correct.
    #[test]
    #[cfg(target_os = "linux")]
    fn the_probe_picks_one_driver_and_never_stacks_two() {
        let platform = hybrid_wayland_context();

        let unreachable = paste_driver_execution_chain(
            &platform,
            PasteLane {
                xtest_target: XtestTargetProbe::Unreachable,
                portal_session_live: true,
            },
        );
        assert_eq!(
            unreachable,
            vec![NativeInsertDriver::RemoteDesktopPortal],
            "a native Wayland window holds the focus: only the portal can reach it"
        );

        let reachable = paste_driver_execution_chain(
            &platform,
            PasteLane {
                xtest_target: XtestTargetProbe::Reachable,
                portal_session_live: true,
            },
        );
        assert_eq!(
            reachable,
            vec![NativeInsertDriver::Xdotool],
            "a real X client holds the focus: xdotool is prompt-free and correct"
        );

        let unknown = paste_driver_execution_chain(
            &platform,
            PasteLane {
                xtest_target: XtestTargetProbe::Unknown,
                portal_session_live: true,
            },
        );
        assert_eq!(
            unknown,
            vec![NativeInsertDriver::Xdotool],
            "an undetermined probe is not evidence of a missing target (ADR 0229), so the run does not spend the portal on a guess"
        );
    }

    /// Without a grant the hybrid lane is exactly what it was before this leg.
    /// Worth stating, because the portal arriving must not quietly change the
    /// behaviour of every machine that never grants it.
    #[test]
    #[cfg(target_os = "linux")]
    fn an_ungranted_machine_keeps_the_chain_it_had() {
        let platform = hybrid_wayland_context();
        for probe in [
            XtestTargetProbe::Reachable,
            XtestTargetProbe::Unreachable,
            XtestTargetProbe::Unknown,
        ] {
            assert_eq!(
                paste_driver_execution_chain(
                    &platform,
                    PasteLane {
                        xtest_target: probe,
                        portal_session_live: false,
                    },
                ),
                vec![NativeInsertDriver::Xdotool],
                "{probe:?} without a grant stays on xdotool"
            );
        }
    }

    /// A pure Wayland session has no XTEST lane at all, so the portal is not a
    /// second attempt after anything -- it is the only mechanism there is. And
    /// without it the chain is empty rather than hopeful.
    #[test]
    #[cfg(target_os = "linux")]
    fn pure_wayland_gains_a_driver_only_from_the_grant() {
        let platform = NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: true,
            has_x11_display: false,
            has_wl_copy: true,
            has_xdotool: false,
            has_wtype: true,
            has_ydotool: true,
            try_xdotool_type_first: false,
        };

        assert_eq!(
            paste_driver_execution_chain(
                &platform,
                PasteLane {
                    xtest_target: XtestTargetProbe::Unknown,
                    portal_session_live: true,
                },
            ),
            vec![NativeInsertDriver::RemoteDesktopPortal],
        );

        assert!(
            paste_driver_execution_chain(
                &platform,
                PasteLane {
                    xtest_target: XtestTargetProbe::Unknown,
                    portal_session_live: false,
                },
            )
            .is_empty(),
            "wtype and ydotool are installed here and stay out anyway: they were rejected on prompt grounds, not on availability"
        );
    }

    /// The end of the thesis this track opened with. A portal paste is a D-Bus
    /// call that returned Ok, so the delivery IS confirmed -- and the clipboard
    /// may be restored on the very lane where XTEST could never say so. The
    /// same run through xdotool leaves the transcript on the clipboard.
    #[test]
    #[cfg(target_os = "linux")]
    fn a_portal_paste_is_confirmed_so_the_clipboard_comes_back() {
        let mut clipboard_results = HashMap::new();
        clipboard_results.insert(NativeInsertDriver::WlCopy, Ok(()));
        let mut paste_results = HashMap::new();
        paste_results.insert(NativeInsertDriver::RemoteDesktopPortal, Ok(()));

        let mut io = FakeInsertIo {
            clipboard_results,
            clipboard_read: Some("Previous clipboard".to_string()),
            paste_results,
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xdotool_type_results: HashMap::new(),
            xtest_target: XtestTargetProbe::Unreachable,
            portal_session_live: true,
        };

        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Portal delivery".to_string(),
                source: None,
                corrected: None,
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            hybrid_wayland_context(),
            &mut io,
            None,
        );

        assert!(result.pasted);
        assert_eq!(
            result.active_driver,
            NativeInsertDriver::RemoteDesktopPortal
        );
        assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
        assert_eq!(
            io.paste_drivers,
            vec![NativeInsertDriver::RemoteDesktopPortal],
            "one driver ran, and it was not tried after another"
        );
        assert_eq!(
            result.clipboard_restore,
            NativeClipboardRestoreStatus::Scheduled,
            "the portal confirmed delivery, so the user's clipboard is theirs again"
        );
    }

    #[test]
    fn only_a_real_paste_reports_inserted_delivery() {
        assert_eq!(
            NativeInsertMode::DirectPaste.delivery_label(),
            "inserted",
            "a completed paste is the only delivery that reached the cursor"
        );
        for mode in [
            NativeInsertMode::ClipboardOnly,
            NativeInsertMode::ClipboardFallback,
            NativeInsertMode::ScratchpadFallback,
        ] {
            assert_eq!(
                mode.delivery_label(),
                "clipboard",
                "{mode:?} left the text on the clipboard, not at the cursor"
            );
        }
    }

    struct FakeInsertIo {
        clipboard_results: HashMap<NativeInsertDriver, Result<(), String>>,
        clipboard_read: Option<String>,
        paste_results: HashMap<NativeInsertDriver, Result<(), String>>,
        xdotool_type_results: HashMap<NativeInsertDriver, Result<(), String>>,
        scheduled_restores: Vec<(Option<String>, u64)>,
        waits: Vec<u64>,
        clipboard_texts: Vec<String>,
        clipboard_drivers: Vec<NativeInsertDriver>,
        paste_drivers: Vec<NativeInsertDriver>,
        type_drivers: Vec<NativeInsertDriver>,
        /// `Unknown` in every pre-existing test, which is what keeps them on
        /// their previous behaviour: the probe only refuses on `Unreachable`.
        xtest_target: XtestTargetProbe,
        /// `false` in every pre-existing test, so the portal driver cannot
        /// appear in a chain that was written before it existed.
        portal_session_live: bool,
    }

    impl FakeInsertIo {
        fn direct_paste() -> Self {
            let mut clipboard_results = HashMap::new();
            clipboard_results.insert(NativeInsertDriver::Arboard, Ok(()));
            let mut paste_results = HashMap::new();
            paste_results.insert(NativeInsertDriver::Enigo, Ok(()));

            Self {
                clipboard_results,
                clipboard_read: Some("Previous clipboard".to_string()),
                paste_results,
                xdotool_type_results: HashMap::new(),
                scheduled_restores: Vec::new(),
                waits: Vec::new(),
                clipboard_texts: Vec::new(),
                clipboard_drivers: Vec::new(),
                paste_drivers: Vec::new(),
                type_drivers: Vec::new(),
                xtest_target: XtestTargetProbe::Unknown,
                portal_session_live: false,
            }
        }
    }

    impl InsertIo for FakeInsertIo {
        fn write_clipboard_with_driver(
            &mut self,
            driver: NativeInsertDriver,
            text: &str,
        ) -> Result<(), String> {
            self.clipboard_drivers.push(driver);
            self.clipboard_texts.push(text.to_string());
            self.clipboard_results
                .get(&driver)
                .cloned()
                .unwrap_or_else(|| Err(format!("{} missing fake clipboard result", driver.label())))
        }

        fn read_clipboard_text(&mut self) -> Option<String> {
            self.clipboard_read.clone()
        }

        fn paste_with_driver(&mut self, driver: NativeInsertDriver) -> Result<(), String> {
            self.paste_drivers.push(driver);
            self.paste_results
                .get(&driver)
                .cloned()
                .unwrap_or_else(|| Err(format!("{} missing fake paste result", driver.label())))
        }

        fn type_with_driver(
            &mut self,
            driver: NativeInsertDriver,
            _text: &str,
        ) -> Result<(), String> {
            self.type_drivers.push(driver);
            self.xdotool_type_results
                .get(&driver)
                .cloned()
                .unwrap_or_else(|| Err(format!("{} not in fake type results", driver.label())))
        }

        fn schedule_clipboard_restore(&mut self, text: Option<String>, delay_ms: u64) {
            self.scheduled_restores.push((text, delay_ms));
        }

        fn wait_before_paste(&mut self, delay_ms: u64) {
            self.waits.push(delay_ms);
        }

        fn probe_xtest_target(&mut self) -> XtestTargetProbe {
            self.xtest_target
        }

        fn portal_session_is_live(&mut self) -> bool {
            self.portal_session_live
        }
    }

    #[test]
    fn adds_trailing_space_after_terminal_punctuation() {
        assert_eq!(format_text_for_insert("Hello."), "Hello. ");
        assert_eq!(format_text_for_insert("Hello"), "Hello");
    }

    #[test]
    fn a_profile_that_keeps_the_clipboard_never_schedules_a_restore() {
        // The switch's whole content: the transcript stays. `direct_paste()`
        // seeds a previous clipboard, so without the setting this run would
        // schedule a restore -- which is what makes the empty vector an
        // assertion rather than an accident of the fixture.
        let mut io = FakeInsertIo::direct_paste();
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello world".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: true,
                auto_paste: true,
                paste_delay_ms: 5,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: false,
                has_x11_display: false,
                has_wl_copy: false,
                has_xdotool: false,
                has_wtype: false,
                has_ydotool: false,
                try_xdotool_type_first: false,
            },
            &mut io,
            None,
        );

        assert!(result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
        assert!(io.scheduled_restores.is_empty());
        // A setting, not a doubt: conflating the two would make the switch read
        // as a delivery that could not be confirmed.
        assert_eq!(
            result.clipboard_restore,
            NativeClipboardRestoreStatus::SkippedKeptOnClipboard
        );
    }

    #[test]
    fn direct_paste_path_is_testable_without_os_clipboard() {
        let mut io = FakeInsertIo::direct_paste();
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello world".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 5,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: false,
                has_x11_display: false,
                has_wl_copy: false,
                has_xdotool: false,
                has_wtype: false,
                has_ydotool: false,
            try_xdotool_type_first: false,
            },
             &mut io, None,
        );

        assert!(result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
        assert_eq!(result.active_driver, NativeInsertDriver::Enigo);
        assert_eq!(result.recovery_action, NativeInsertRecoveryAction::None);
        assert_eq!(
            result.clipboard_restore,
            NativeClipboardRestoreStatus::Scheduled
        );
        assert_eq!(io.waits, vec![5]);
        assert_eq!(io.clipboard_texts, vec!["Hello world".to_string()]);
        assert_eq!(io.clipboard_drivers, vec![NativeInsertDriver::Arboard]);
        assert_eq!(io.paste_drivers, vec![NativeInsertDriver::Enigo]);
        assert_eq!(
            io.scheduled_restores,
            vec![(
                Some("Previous clipboard".to_string()),
                CLIPBOARD_RESTORE_DELAY_MS
            )]
        );
    }

    /// The hybrid XWayland lane has exactly one paste mechanism, XTEST, and it
    /// exits 0 whether or not anything receives the key event. An earlier
    /// version of this probe REFUSED the paste when no foreign X window held the
    /// focus. That was wrong, and the owner's experience is what showed it:
    /// auto-paste had worked intermittently against native Wayland windows,
    /// because KWin forwards XTEST fake input from Xwayland into the compositor.
    /// Refusing turned "unreliable" into "never".
    ///
    /// What the probe is for now is narrower and defensible: when delivery
    /// cannot be confirmed, do not let `schedule_clipboard_restore` take the
    /// transcript away a moment later. The paste still runs; the text survives
    /// either way.
    #[test]
    #[cfg(target_os = "linux")]
    fn an_unconfirmable_delivery_keeps_the_transcript_on_the_clipboard() {
        let mut clipboard_results = HashMap::new();
        clipboard_results.insert(NativeInsertDriver::WlCopy, Ok(()));
        let mut paste_results = HashMap::new();
        paste_results.insert(NativeInsertDriver::Xdotool, Ok(()));

        let mut io = FakeInsertIo {
            clipboard_results,
            clipboard_read: Some("Previous clipboard".to_string()),
            paste_results,
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xdotool_type_results: HashMap::new(),
            xtest_target: XtestTargetProbe::Unreachable,
            portal_session_live: false,
        };

        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello world".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: true,
                has_x11_display: true,
                has_wl_copy: true,
                has_xdotool: true,
                has_wtype: false,
                has_ydotool: false,
                try_xdotool_type_first: false,
            },
            &mut io,
            None,
        );

        assert_eq!(
            io.paste_drivers,
            vec![NativeInsertDriver::Xdotool],
            "the paste must still be attempted -- it can land, we just cannot confirm it"
        );
        assert_eq!(
            result.clipboard_restore,
            NativeClipboardRestoreStatus::SkippedDeliveryUnverified,
            "an unconfirmable delivery must not have the transcript restored away"
        );
        assert!(
            io.scheduled_restores.is_empty(),
            "nothing may be scheduled to overwrite the transcript"
        );
    }

    /// The counterpart: `Unknown` is not evidence of a missing target, so it
    /// behaves exactly like a confirmable delivery -- paste, and restore the
    /// previous clipboard as usual.
    #[test]
    #[cfg(target_os = "linux")]
    fn an_undetermined_xtest_probe_still_attempts_the_paste() {
        let mut clipboard_results = HashMap::new();
        clipboard_results.insert(NativeInsertDriver::WlCopy, Ok(()));
        let mut paste_results = HashMap::new();
        paste_results.insert(NativeInsertDriver::Xdotool, Ok(()));

        let mut io = FakeInsertIo {
            clipboard_results,
            clipboard_read: None,
            paste_results,
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xdotool_type_results: HashMap::new(),
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live: false,
        };

        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello world".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: true,
                has_x11_display: true,
                has_wl_copy: true,
                has_xdotool: true,
                has_wtype: false,
                has_ydotool: false,
                try_xdotool_type_first: false,
            },
            &mut io,
            None,
        );

        assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
        assert_eq!(io.paste_drivers, vec![NativeInsertDriver::Xdotool]);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn clipboard_fallback_surfaces_auto_paste_failure() {
        let mut clipboard_results = HashMap::new();
        clipboard_results.insert(NativeInsertDriver::Arboard, Ok(()));
        let mut paste_results = HashMap::new();
        paste_results.insert(
            NativeInsertDriver::Wtype,
            Err("Target app blocked paste".to_string()),
        );
        paste_results.insert(
            NativeInsertDriver::Ydotool,
            Err("ydotool daemon unavailable".to_string()),
        );
        paste_results.insert(
            NativeInsertDriver::Enigo,
            Err("Enigo input adapter unavailable".to_string()),
        );

        let mut io = FakeInsertIo {
            clipboard_results,
            clipboard_read: Some("Previous clipboard".to_string()),
            paste_results,
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xdotool_type_results: HashMap::new(),
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live: false,
        };
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello world".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: true,
                has_x11_display: false,
                has_wl_copy: false,
                has_xdotool: false,
                has_wtype: true,
                has_ydotool: true,
            try_xdotool_type_first: false,
            },
             &mut io, None,
        );

        assert!(!result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::ClipboardFallback);
        assert!(result.fallback_available);
        assert_eq!(result.active_driver, NativeInsertDriver::Arboard);
        assert_eq!(
            result.recovery_action,
            NativeInsertRecoveryAction::ManualPaste
        );
        assert_eq!(
            result.clipboard_restore,
            NativeClipboardRestoreStatus::NotAttempted
        );
        assert!(result
            .recovery_message
            .contains("transcript is on the clipboard"));
        // The sentence changed with the portal driver and had to: a pure
        // Wayland session without a grant is no longer a session where insert
        // "is not available", it is one where nobody has granted it yet. A
        // reason that describes a permanent limitation would send the reader
        // looking for a different app instead of for the button.
        let reason = result.fallback_reason.as_deref().unwrap_or_default();
        assert!(
            reason.contains("Delivery & Insert"),
            "the reason names where the permission is granted: {reason}"
        );
        assert!(
            reason.contains("paste manually"),
            "and what to do meanwhile: {reason}"
        );
        assert!(io.paste_drivers.is_empty());
        assert!(io.scheduled_restores.is_empty());
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn last_portal_prompt_is_recorded_when_paste_driver_is_blocked() {
        let mut clipboard_results = HashMap::new();
        clipboard_results.insert(NativeInsertDriver::Arboard, Ok(()));
        let mut paste_results = HashMap::new();
        paste_results.insert(
            NativeInsertDriver::Xdotool,
            Err(
                "xdotool key --clearmodifiers ctrl+v: Authorization denied: org.kde.kwin.RemoteDesktop.SelectDevices"
                    .to_string(),
            ),
        );

        let mut io = FakeInsertIo {
            clipboard_results,
            clipboard_read: Some("Previous clipboard".to_string()),
            paste_results,
            xdotool_type_results: HashMap::new(),
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live: false,
        };
        let mut portal_prompt = None;
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig::default(),
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: true,
                has_x11_display: true,
                has_wl_copy: false,
                has_xdotool: true,
                has_wtype: false,
                has_ydotool: false,
                try_xdotool_type_first: false,
            },
            &mut io,
            Some(&mut portal_prompt),
        );
        let _ = result;

        let recorded = portal_prompt.expect("expected portal prompt to be recorded");
        assert_eq!(recorded.signal, PortalPromptSignal::KdeRemoteDesktop);
        assert!(recorded.stderr_excerpt.contains("Authorization denied"));
    }

    #[test]
    fn scratchpad_fallback_surfaces_recovery_action_when_clipboard_fails() {
        let mut clipboard_results = HashMap::new();
        clipboard_results.insert(
            NativeInsertDriver::Arboard,
            Err("Clipboard unavailable".to_string()),
        );

        let mut io = FakeInsertIo {
            clipboard_results,
            clipboard_read: Some("Previous clipboard".to_string()),
            paste_results: HashMap::new(),
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xdotool_type_results: HashMap::new(),
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live: false,
        };

        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello world".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: false,
                has_x11_display: false,
                has_wl_copy: false,
                has_xdotool: false,
                has_wtype: false,
                has_ydotool: false,
            try_xdotool_type_first: false,
            },
             &mut io, None,
        );

        assert!(!result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::ScratchpadFallback);
        assert_eq!(result.active_driver, NativeInsertDriver::Scratchpad);
        assert_eq!(
            result.recovery_action,
            NativeInsertRecoveryAction::UseScratchpad
        );
        assert_eq!(
            result.clipboard_restore,
            NativeClipboardRestoreStatus::NotAttempted
        );
        assert!(result.recovery_message.contains("recovery scratchpad"));
        assert!(io.paste_drivers.is_empty());
        assert!(io.scheduled_restores.is_empty());
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn wayland_platform_status_names_missing_helpers_in_driver_chain() {
        let status = platform_status_from_context(NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: true,
            has_x11_display: false,
            has_wl_copy: false,
            has_xdotool: false,
            has_wtype: false,
            has_ydotool: false,
            try_xdotool_type_first: false,
        });

        assert_eq!(status.platform_label, "Linux Wayland");
        assert_eq!(status.active_driver, NativeInsertDriver::Arboard);
        assert_eq!(status.readiness, NativeInsertReadiness::RecoveryOnly);
        assert!(
            status
                .readiness_message
                .contains("needs the one-time input permission"),
            "{}",
            status.readiness_message
        );
        assert!(status
            .driver_chain
            .iter()
            .any(|item| item.driver == NativeInsertDriver::Wtype && item.detail.contains("Not used on pure Wayland")));
        assert!(status
            .prerequisites
            .iter()
            .any(|item| item.contains("Auto-paste is disabled on pure Wayland")));
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn x11_platform_status_marks_missing_xdotool_as_recovery_only() {
        let status = platform_status_from_context(NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: false,
            has_x11_display: true,
            has_wl_copy: false,
            has_xdotool: false,
            has_wtype: false,
            has_ydotool: false,
            try_xdotool_type_first: false,
        });

        assert_eq!(status.platform_label, "Linux X11");
        assert_eq!(status.readiness, NativeInsertReadiness::RecoveryOnly);
        assert!(status.readiness_message.contains("xdotool is missing"));
    }

    #[test]
    fn macos_platform_status_exposes_permission_diagnostics() {
        if !cfg!(target_os = "macos") {
            return;
        }

        let status = platform_status(true);

        assert_eq!(status.platform_label, "macOS");
        assert_eq!(status.readiness, NativeInsertReadiness::Ready);
        assert!(status
            .prerequisites
            .iter()
            .any(|item| item.contains("Accessibility")));
        assert!(status
            .prerequisites
            .iter()
            .any(|item| item.contains("Input Monitoring")));
        assert!(status
            .caveats
            .iter()
            .any(|item| item.contains("Terminal") || item.contains("VS Code")));
    }

    #[test]
    fn x11_prefers_xdotool_type_for_short_text_without_touching_clipboard() {
        let mut xd_results = HashMap::new();
        xd_results.insert(NativeInsertDriver::XdotoolType, Ok(()));
        let mut io = FakeInsertIo {
            clipboard_results: HashMap::new(),
            clipboard_read: None,
            paste_results: HashMap::new(),
            xdotool_type_results: xd_results,
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live: false,
        };
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Kurzer Text".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: false,
                has_x11_display: true,
                has_wl_copy: false,
                has_xdotool: true,
                has_wtype: false,
                has_ydotool: false,
                try_xdotool_type_first: true,
            },
             &mut io, None,
        );

        assert!(result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
        assert_eq!(result.active_driver, NativeInsertDriver::XdotoolType);
        assert_eq!(result.clipboard_written, false);
        assert_eq!(io.type_drivers, vec![NativeInsertDriver::XdotoolType]);
        assert_eq!(io.clipboard_drivers.len(), 0);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn x11_falls_back_when_text_exceeds_xdotool_threshold() {
        let long_text = "a".repeat(900);
        let mut io = FakeInsertIo {
            clipboard_results: {
                let mut m = HashMap::new();
                m.insert(NativeInsertDriver::Arboard, Ok(()));
                m
            },
            clipboard_read: None,
            paste_results: {
                let mut m = HashMap::new();
                m.insert(NativeInsertDriver::Xdotool, Ok(()));
                m
            },
            xdotool_type_results: HashMap::new(),
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live: false,
        };
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: long_text,
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: false,
                has_x11_display: true,
                has_wl_copy: false,
                has_xdotool: true,
                has_wtype: false,
                has_ydotool: false,
                try_xdotool_type_first: true,
            },
             &mut io, None,
        );

        assert!(result.ok);
        assert_eq!(result.active_driver, NativeInsertDriver::Xdotool);
        assert_eq!(result.clipboard_written, true);
        assert_eq!(io.type_drivers.len(), 0);
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn x11_falls_back_to_clipboard_when_xdotool_type_fails() {
        let mut xd_results = HashMap::new();
        xd_results.insert(
            NativeInsertDriver::XdotoolType,
            Err("xdotool type failed".to_string()),
        );
        let mut io = FakeInsertIo {
            clipboard_results: {
                let mut m = HashMap::new();
                m.insert(NativeInsertDriver::Arboard, Ok(()));
                m
            },
            clipboard_read: None,
            paste_results: {
                let mut m = HashMap::new();
                m.insert(NativeInsertDriver::Xdotool, Ok(()));
                m
            },
            xdotool_type_results: xd_results,
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live: false,
        };
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Kurzer Text".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: true,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: false,
                has_x11_display: true,
                has_wl_copy: false,
                has_xdotool: true,
                has_wtype: false,
                has_ydotool: false,
                try_xdotool_type_first: true,
            },
             &mut io, None,
        );

        assert!(result.ok);
        assert_eq!(result.active_driver, NativeInsertDriver::Xdotool);
        assert_eq!(io.type_drivers, vec![NativeInsertDriver::XdotoolType]);
        assert!(!io.clipboard_texts.is_empty());
    }

    #[test]
    fn x11_clipboard_only_mode_skips_xdotool_type() {
        let mut io = FakeInsertIo {
            clipboard_results: {
                let mut m = HashMap::new();
                m.insert(NativeInsertDriver::Arboard, Ok(()));
                m
            },
            clipboard_read: None,
            paste_results: HashMap::new(),
            xdotool_type_results: HashMap::new(),
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
            type_drivers: Vec::new(),
            xtest_target: XtestTargetProbe::Unknown,
            portal_session_live: false,
        };
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Kurzer Text".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(false),
            },
            &NativeInsertionConfig {
                keep_on_clipboard: false,
                auto_paste: false,
                paste_delay_ms: 0,
                xdotool_type_max_chars: 800,
            },
            1,
            NativeInsertPlatformContext {
                auto_paste: false,
                is_wayland: false,
                has_x11_display: true,
                has_wl_copy: false,
                has_xdotool: true,
                has_wtype: false,
                has_ydotool: false,
                try_xdotool_type_first: true,
            },
             &mut io, None,
        );

        assert!(result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::ClipboardOnly);
        assert_eq!(result.clipboard_written, true);
        assert_eq!(io.type_drivers.len(), 0);
    }
}
