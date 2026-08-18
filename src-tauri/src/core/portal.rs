use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CompositorKind {
    #[default]
    Unknown,
    KdePlasma5,
    KdePlasma6,
    GnomeMutter,
    Hyprland,
    Sway,
    Other,
}

impl CompositorKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::KdePlasma5 => "KDE Plasma 5",
            Self::KdePlasma6 => "KDE Plasma 6",
            Self::GnomeMutter => "GNOME Mutter",
            Self::Hyprland => "Hyprland",
            Self::Sway => "Sway",
            Self::Other => "Other Wayland compositor",
            Self::Unknown => "Unknown",
        }
    }

    pub fn supports_remote_desktop_portal(self) -> bool {
        matches!(self, Self::KdePlasma6 | Self::GnomeMutter)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PortalPromptSignal {
    KdeRemoteDesktop,
    InputCapture,
    Unknown,
}

impl PortalPromptSignal {
    pub fn label(&self) -> &'static str {
        match self {
            Self::KdeRemoteDesktop => "KDE Plasma Remote Desktop portal",
            Self::InputCapture => "xdg-desktop-portal InputCapture",
            Self::Unknown => "Unknown portal prompt",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortalCapabilities {
    pub compositor: CompositorKind,
    pub session_type: String,
    pub xdg_current_desktop: Option<String>,
    pub xdg_session_desktop: Option<String>,
    pub has_remote_desktop_portal: bool,
    pub has_input_capture_portal: bool,
    pub has_xdg_desktop_portal_daemon: bool,
    pub xdg_desktop_portal_version: Option<String>,
    pub last_session_active: bool,
}

impl Default for PortalCapabilities {
    fn default() -> Self {
        Self {
            compositor: CompositorKind::Unknown,
            session_type: std::env::var("XDG_SESSION_TYPE").unwrap_or_default(),
            xdg_current_desktop: std::env::var("XDG_CURRENT_DESKTOP").ok(),
            xdg_session_desktop: std::env::var("XDG_SESSION_DESKTOP").ok(),
            has_remote_desktop_portal: false,
            has_input_capture_portal: false,
            has_xdg_desktop_portal_daemon: false,
            xdg_desktop_portal_version: None,
            last_session_active: false,
        }
    }
}

impl PortalCapabilities {
    pub fn diagnose_blockers(&self) -> Vec<String> {
        let mut blockers = Vec::new();
        if !self.has_xdg_desktop_portal_daemon {
            blockers.push(
                "xdg-desktop-portal service is not running; install xdg-desktop-portal and the matching portal backend (xdg-desktop-portal-kde / -gnome / -wlr)."
                    .to_string(),
            );
        }
        if self.compositor == CompositorKind::Unknown
            && matches!(self.session_type.as_str(), "wayland" | "")
        {
            blockers.push(
                "Could not identify the active Wayland compositor from XDG_CURRENT_DESKTOP / WAYLAND_DISPLAY / signature env vars."
                    .to_string(),
            );
        }
        if !self.compositor.supports_remote_desktop_portal() {
            blockers.push(format!(
                "Compositor '{}' does not have a stable RemoteDesktop portal grant; auto-paste is therefore clipboard-only.",
                self.compositor.label()
            ));
        } else if !self.has_remote_desktop_portal {
            blockers.push(format!(
                "Compositor '{}' is detected, but the RemoteDesktop portal interface is not reachable on the session bus.",
                self.compositor.label()
            ));
        }
        blockers
    }
}

pub fn detect_compositor() -> CompositorKind {
    if cfg!(not(target_os = "linux")) {
        return CompositorKind::Unknown;
    }

    let current = std::env::var("XDG_CURRENT_DESKTOP")
        .or_else(|_| std::env::var("XDG_SESSION_DESKTOP"))
        .unwrap_or_default()
        .to_ascii_lowercase();

    let session = std::env::var("XDG_SESSION_DESKTOP")
        .unwrap_or_default()
        .to_ascii_lowercase();

    let combined = format!("{current} {session}");

    if std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some() {
        return CompositorKind::Hyprland;
    }
    if std::env::var_os("SWAYSOCK").is_some() {
        return CompositorKind::Sway;
    }
    // `XDG_CURRENT_DESKTOP` on a KDE session is the string "KDE", not "plasma"
    // — measured on the reporting machine 2026-08-18, where both it and
    // `XDG_SESSION_DESKTOP` read `KDE` while `plasmashell --version` answered
    // 6.7.0. Matching only "plasma" therefore fell through to the
    // `WAYLAND_DISPLAY` arm and classified a KDE Plasma 6 desktop as
    // `Other`, which made `supports_remote_desktop_portal()` false and closed
    // the whole portal path before it could be tried. Nothing said so: the
    // caller returns early WITHOUT logging on an unsupported compositor, so
    // 6539 runtime-log lines carried not one portal line. See ADR 0234.
    if combined.contains("plasma") || combined.contains("kde") {
        let plasma_version = read_plasma_version();
        return match plasma_version {
            Some(version) if version >= 6 => CompositorKind::KdePlasma6,
            Some(_) => CompositorKind::KdePlasma5,
            None => CompositorKind::KdePlasma6,
        };
    }
    if combined.contains("gnome") {
        return CompositorKind::GnomeMutter;
    }
    if std::env::var_os("WAYLAND_DISPLAY").is_some()
        || std::env::var_os("WORDSCRIPT_WAS_WAYLAND").is_some()
    {
        return CompositorKind::Other;
    }
    CompositorKind::Unknown
}

fn read_plasma_version() -> Option<u32> {
    if !command_in_path("plasmashell") {
        return None;
    }
    let output = Command::new("plasmashell")
        .args(["--version"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let token = stdout
        .split_whitespace()
        .find(|token| token.chars().next().map_or(false, |c| c.is_ascii_digit()))?;
    let head = token
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>();
    head.parse::<u32>().ok()
}

fn command_in_path(program: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths)
                .any(|path| path.join(program).is_file())
        })
        .unwrap_or(false)
}

/// Whether a portal interface is actually there, by reading its `version`.
///
/// This replaced a scan of `busctl --user list` for the string
/// "org.freedesktop.portal.remotedesktop", which could never match: that
/// command lists **bus names**, and RemoteDesktop is an **interface** on the
/// single name `org.freedesktop.portal.Desktop`. Measured on the reporting
/// machine 2026-08-18, `busctl --user list` contains no occurrence of
/// "remotedesktop" at all, while
///
/// ```text
/// busctl --user get-property org.freedesktop.portal.Desktop \
///     /org/freedesktop/portal/desktop \
///     org.freedesktop.portal.RemoteDesktop version   ->  u 2
/// ```
///
/// So `has_remote_desktop_portal` was false on every machine, which closed the
/// portal path a second time over and made `diagnose_blockers()` report the
/// interface as unreachable on a session where it answers. Same failure shape
/// as the compositor detection above: a probe that says "no" for a reason that
/// has nothing to do with what it was asked. See ADR 0234.
fn portal_interface_version(interface: &str) -> Option<u32> {
    let output = Command::new("busctl")
        .args([
            "--user",
            "get-property",
            "org.freedesktop.portal.Desktop",
            "/org/freedesktop/portal/desktop",
            interface,
            "version",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parse_busctl_version(&String::from_utf8_lossy(&output.stdout))
}

/// `busctl get-property` prints the D-Bus type and then the value: `u 2`.
fn parse_busctl_version(stdout: &str) -> Option<u32> {
    let mut fields = stdout.split_whitespace();
    if fields.next()? != "u" {
        return None;
    }
    fields.next()?.parse::<u32>().ok()
}

pub fn detect_portal_capabilities() -> PortalCapabilities {
    let mut capabilities = PortalCapabilities::default();
    capabilities.compositor = detect_compositor();

    let version_output = Command::new("xdg-desktop-portal")
        .arg("--version")
        .output();
    match version_output {
        Ok(output) if output.status.success() => {
            capabilities.has_xdg_desktop_portal_daemon = true;
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !stdout.is_empty() {
                capabilities.xdg_desktop_portal_version = Some(stdout);
            }
        }
        _ => {
            capabilities.has_xdg_desktop_portal_daemon = command_in_path("xdg-desktop-portal");
        }
    }

    if command_in_path("busctl") {
        capabilities.has_remote_desktop_portal =
            portal_interface_version("org.freedesktop.portal.RemoteDesktop").is_some();
        capabilities.has_input_capture_portal =
            portal_interface_version("org.freedesktop.portal.InputCapture").is_some();
    } else if capabilities.has_xdg_desktop_portal_daemon {
        capabilities.has_remote_desktop_portal = capabilities.compositor.supports_remote_desktop_portal();
    }

    // Whether a grant from an earlier run is on disk to restore. This read an
    // env var (`WORDSCRIPT_REMOTE_DESKTOP_TOKEN_PATH`) that nothing in the tree
    // ever set, so the field was permanently false and the diagnostics panel
    // permanently said "no session".
    capabilities.last_session_active = load_portal_grant_record().has_token();

    capabilities
}

pub fn detect_portal_prompt_from_stderr(stderr: &str) -> Option<PortalPromptSignal> {
    let lowered = stderr.to_ascii_lowercase();
    if lowered.contains("authorization")
        || lowered.contains("denied")
        || lowered.contains("not allowed")
        || lowered.contains("permission denied")
    {
        if lowered.contains("kde")
            || lowered.contains("remote desktop")
            || lowered.contains("remotedesktop")
            || lowered.contains("kwin")
            || lowered.contains("control input devices")
        {
            return Some(PortalPromptSignal::KdeRemoteDesktop);
        }
        if lowered.contains("inputcapture") || lowered.contains("input capture") {
            return Some(PortalPromptSignal::InputCapture);
        }
        return Some(PortalPromptSignal::Unknown);
    }
    if lowered.contains("protocol") && lowered.contains("wayland") {
        return Some(PortalPromptSignal::KdeRemoteDesktop);
    }
    None
}

pub fn portal_prompt_signal_label(signal: &PortalPromptSignal) -> String {
    match signal {
        PortalPromptSignal::KdeRemoteDesktop => {
            "KDE Plasma Remote Desktop portal rejected the input (org.kde.kwin.RemoteDesktop)."
                .to_string()
        }
        PortalPromptSignal::InputCapture => {
            "xdg-desktop-portal InputCapture rejected the virtual keyboard input.".to_string()
        }
        PortalPromptSignal::Unknown => "An unknown portal rejected the input event.".to_string(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortalSessionHandle {
    pub session_handle: String,
    pub restore_token: Option<String>,
    pub device_types: Vec<u32>,
    pub compositor: CompositorKind,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PortalError {
    Unsupported,
    NoSessionBus,
    NoPortalInterface,
    /// The user closed the compositor's permission dialog without granting it.
    /// Distinct from every other variant: nothing is broken, somebody said no,
    /// and the correct response is to stop asking rather than to retry.
    Refused,
    NoGrant,
    CreateSessionFailed(String),
    SelectDevicesFailed(String),
    StartFailed(String),
    /// A `NotifyKeyboardKeysym` call on an already started session did not come
    /// back `Ok`. Separate from [`Self::StartFailed`] because the two land in
    /// front of different people: `Start` failing is a permission that could
    /// not be obtained and points at the Settings button, while this is a
    /// granted session that would not type and points at nothing the reader
    /// can press. Reporting a failed paste as "Start failed" sent them to the
    /// one control that was already fine.
    PasteFailed(String),
    TokenStoreFailed(String),
}

impl PortalError {
    pub fn label(&self) -> String {
        match self {
            Self::Unsupported => "The active Wayland compositor does not expose a stable RemoteDesktop portal grant.".to_string(),
            Self::NoSessionBus => "Could not connect to the user session D-Bus. Check that DBUS_SESSION_BUS_ADDRESS is set.".to_string(),
            Self::NoPortalInterface => "org.freedesktop.portal.RemoteDesktop is not reachable on the session bus. Install xdg-desktop-portal and the matching portal backend (xdg-desktop-portal-kde / -gnome).".to_string(),
            Self::Refused => "The desktop refused the input-device permission. Insert at cursor stays on the clipboard until you grant it again in Delivery & Insert.".to_string(),
            Self::NoGrant => "Insert at cursor has no input-device permission on this desktop yet. Grant it once in Delivery & Insert; WordScript never raises that dialog during a dictation.".to_string(),
            Self::CreateSessionFailed(detail) => format!("RemoteDesktop portal CreateSession failed: {detail}"),
            Self::SelectDevicesFailed(detail) => format!("RemoteDesktop portal SelectDevices failed: {detail}"),
            Self::StartFailed(detail) => format!("RemoteDesktop portal Start failed: {detail}"),
            Self::PasteFailed(detail) => format!("The desktop did not accept the paste keystroke: {detail}"),
            Self::TokenStoreFailed(detail) => format!("Could not persist the RemoteDesktop restore token: {detail}"),
        }
    }
}

/// Where a granted RemoteDesktop session is remembered between app runs.
///
/// This used to be `$XDG_RUNTIME_DIR`, which the system clears on reboot. That
/// turned "one grant ever" into "one grant per boot" -- close enough to the
/// per-paste prompt the owner rejected that it would have undone the reason
/// this driver was chosen at all (ADR 0228, item 3). `$XDG_STATE_HOME` is the
/// directory for state that should survive a restart but is not configuration,
/// which is exactly what a restore token is.
pub fn portal_state_dir() -> std::path::PathBuf {
    if let Some(state_home) = std::env::var_os("XDG_STATE_HOME") {
        let state_home = std::path::PathBuf::from(state_home);
        if state_home.is_absolute() {
            return state_home.join("wordscript");
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        return std::path::PathBuf::from(home)
            .join(".local")
            .join("state")
            .join("wordscript");
    }
    std::env::temp_dir().join("wordscript")
}

pub fn portal_grant_path() -> std::path::PathBuf {
    portal_state_dir().join("remote-desktop-grant.json")
}

/// What this machine remembers about the one grant the portal driver needs.
///
/// Two fields, because a missing token and a refused grant are different
/// answers to "should WordScript ask". A missing token means nobody has been
/// asked yet; a refusal means somebody said no, and the answer to that is to
/// stop asking until they come back and press the button themselves.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct PortalGrantRecord {
    #[serde(default)]
    pub restore_token: Option<String>,
    #[serde(default)]
    pub refused_at_ms: Option<u64>,
}

impl PortalGrantRecord {
    pub fn has_token(&self) -> bool {
        self.restore_token
            .as_deref()
            .map(|token| !token.trim().is_empty())
            .unwrap_or(false)
    }
}

pub fn load_portal_grant_record() -> PortalGrantRecord {
    let Ok(raw) = std::fs::read_to_string(portal_grant_path()) else {
        return PortalGrantRecord::default();
    };
    serde_json::from_str::<PortalGrantRecord>(&raw).unwrap_or_default()
}

/// Writes the grant record `0600` in a `0700` directory.
///
/// A restore token is not a password, but it is a capability: anything that can
/// read it can ask the portal to restore an input-injection session that this
/// user already approved. It is written with the same care as a credential.
pub fn store_portal_grant_record(record: &PortalGrantRecord) -> Result<(), PortalError> {
    let path = portal_grant_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| PortalError::TokenStoreFailed(error.to_string()))?;
        restrict_permissions(parent, 0o700);
    }
    let raw = serde_json::to_string_pretty(record)
        .map_err(|error| PortalError::TokenStoreFailed(error.to_string()))?;
    std::fs::write(&path, raw)
        .map_err(|error| PortalError::TokenStoreFailed(error.to_string()))?;
    restrict_permissions(&path, 0o600);
    Ok(())
}

#[cfg(unix)]
fn restrict_permissions(path: &std::path::Path, mode: u32) {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode));
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &std::path::Path, _mode: u32) {}

pub fn clear_portal_grant_record() {
    let _ = std::fs::remove_file(portal_grant_path());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compositor_kind_supports_remote_desktop_portal_for_kde6_and_gnome() {
        assert!(CompositorKind::KdePlasma6.supports_remote_desktop_portal());
        assert!(CompositorKind::GnomeMutter.supports_remote_desktop_portal());
        assert!(!CompositorKind::Hyprland.supports_remote_desktop_portal());
        assert!(!CompositorKind::Sway.supports_remote_desktop_portal());
        assert!(!CompositorKind::KdePlasma5.supports_remote_desktop_portal());
    }

    #[test]
    fn compositor_label_is_human_readable() {
        assert_eq!(CompositorKind::KdePlasma6.label(), "KDE Plasma 6");
        assert_eq!(CompositorKind::GnomeMutter.label(), "GNOME Mutter");
    }

    #[test]
    fn detect_portal_prompt_recognises_kde_remote_desktop_messages() {
        let signal = detect_portal_prompt_from_stderr(
            "Authorization denied: org.kde.kwin.RemoteDesktop.SelectDevices",
        );
        assert_eq!(signal, Some(PortalPromptSignal::KdeRemoteDesktop));
    }

    #[test]
    fn detect_portal_prompt_recognises_permission_denied() {
        let signal =
            detect_portal_prompt_from_stderr("xdotool: permission denied by Wayland compositor");
        assert_eq!(signal, Some(PortalPromptSignal::Unknown));
    }

    #[test]
    fn detect_portal_prompt_ignores_unrelated_stderr() {
        let signal = detect_portal_prompt_from_stderr("xdotool type failed: bad window id");
        assert!(signal.is_none());
    }

    #[test]
    fn detect_portal_prompt_recognises_input_capture() {
        let signal = detect_portal_prompt_from_stderr(
            "Authorization denied: org.freedesktop.portal.InputCapture",
        );
        assert_eq!(signal, Some(PortalPromptSignal::InputCapture));
    }

    #[test]
    fn detect_portal_prompt_recognises_kde_control_input_devices_phrase() {
        let signal = detect_portal_prompt_from_stderr(
            "Authorization required: application is asking for special privileges (Control input devices)",
        );
        assert_eq!(signal, Some(PortalPromptSignal::KdeRemoteDesktop));
    }

    #[test]
    fn capabilities_default_blockers_list_is_empty_for_clean_state() {
        let capabilities = PortalCapabilities {
            compositor: CompositorKind::KdePlasma6,
            session_type: "wayland".to_string(),
            xdg_current_desktop: Some("KDE".to_string()),
            xdg_session_desktop: Some("plasma".to_string()),
            has_remote_desktop_portal: true,
            has_input_capture_portal: true,
            has_xdg_desktop_portal_daemon: true,
            xdg_desktop_portal_version: Some("1.18".to_string()),
            last_session_active: false,
        };
        assert!(capabilities.diagnose_blockers().is_empty());
    }

    #[test]
    fn capabilities_diagnose_blockers_reports_missing_daemon() {
        let capabilities = PortalCapabilities {
            compositor: CompositorKind::KdePlasma6,
            has_xdg_desktop_portal_daemon: false,
            has_remote_desktop_portal: false,
            ..PortalCapabilities::default()
        };
        let blockers = capabilities.diagnose_blockers();
        assert!(blockers.iter().any(|item| item.contains("xdg-desktop-portal service is not running")));
    }

    #[test]
    fn capabilities_diagnose_blockers_reports_unsupported_compositor() {
        let capabilities = PortalCapabilities {
            compositor: CompositorKind::Sway,
            has_xdg_desktop_portal_daemon: true,
            ..PortalCapabilities::default()
        };
        let blockers = capabilities.diagnose_blockers();
        assert!(blockers.iter().any(|item| item.contains("Sway")));
    }

    #[test]
    fn portal_error_label_summarises_cause_for_user() {
        assert!(PortalError::Unsupported.label().contains("compositor"));
        assert!(PortalError::NoPortalInterface.label().contains("xdg-desktop-portal"));
    }

    /// A refusal and a missing grant are different sentences, because they ask
    /// the reader for different things: one says "you said no, press the button
    /// if you changed your mind", the other says "nobody has been asked yet".
    /// They were one message until the owner chose to have a refusal remembered
    /// rather than re-asked (ADR 0228, answer 2).
    #[test]
    fn a_refusal_and_a_missing_grant_do_not_read_the_same() {
        let refused = PortalError::Refused.label();
        let missing = PortalError::NoGrant.label();
        assert_ne!(refused, missing);
        assert!(refused.contains("refused"), "{refused}");
        assert!(
            missing.contains("Grant it once"),
            "a missing grant names the action that fixes it: {missing}"
        );
    }

    /// A PASTE THAT FAILED IS NOT A PERMISSION THAT FAILED. Both used to be
    /// `StartFailed`, so a granted session that would not type told the reader
    /// "RemoteDesktop portal Start failed" and pointed them at the one control
    /// that was already working.
    #[test]
    fn a_failed_paste_does_not_read_as_a_failed_permission() {
        let paste = PortalError::PasteFailed("org.freedesktop.DBus.Error.NoReply".to_string());
        let start = PortalError::StartFailed("org.freedesktop.DBus.Error.NoReply".to_string());
        assert_ne!(paste.label(), start.label());
        assert!(!paste.label().contains("Start"), "{}", paste.label());
        assert!(paste.label().contains("paste"), "{}", paste.label());
    }

    /// Step 5 of the insert-delivery track, and not cosmetic: `$XDG_RUNTIME_DIR`
    /// is cleared on reboot, which turns the one grant this driver exists for
    /// into one grant per boot.
    #[test]
    fn the_grant_outlives_a_reboot_because_it_is_not_in_the_runtime_dir() {
        let path = portal_grant_path().to_string_lossy().to_string();
        assert!(path.contains("wordscript"), "{path}");
        assert!(path.ends_with("remote-desktop-grant.json"), "{path}");
        if let Some(runtime_dir) = std::env::var_os("XDG_RUNTIME_DIR") {
            let runtime_dir = runtime_dir.to_string_lossy().to_string();
            if !runtime_dir.is_empty() {
                assert!(
                    !path.starts_with(&runtime_dir),
                    "the grant must survive a reboot, so it cannot live under {runtime_dir}"
                );
            }
        }
    }

    /// The shape `busctl get-property` prints, and nothing else read as a
    /// version. A parser that accepted the type letter as a number would report
    /// every interface as present, which is the failure this replaced running
    /// the other way.
    #[test]
    fn a_portal_version_is_read_from_the_value_and_not_the_type() {
        assert_eq!(parse_busctl_version("u 2\n"), Some(2));
        assert_eq!(parse_busctl_version("u 1"), Some(1));
        assert_eq!(parse_busctl_version(""), None);
        assert_eq!(parse_busctl_version("u"), None);
        assert_eq!(parse_busctl_version("s \"2\""), None);
        assert_eq!(parse_busctl_version("2"), None);
    }

    #[test]
    fn a_blank_token_does_not_count_as_a_grant() {
        assert!(!PortalGrantRecord::default().has_token());
        assert!(!PortalGrantRecord {
            restore_token: Some("   ".to_string()),
            refused_at_ms: None,
        }
        .has_token());
        assert!(PortalGrantRecord {
            restore_token: Some("token-1".to_string()),
            refused_at_ms: None,
        }
        .has_token());
    }

    /// The reporting machine answers `KDE` for both desktop variables and has
    /// no "plasma" anywhere in its environment, so a detector that only looked
    /// for "plasma" called a KDE Plasma 6 session `Other` and closed the portal
    /// path before it started. See ADR 0234.
    #[test]
    fn a_kde_session_is_not_an_unknown_compositor() {
        let restore = (
            std::env::var_os("XDG_CURRENT_DESKTOP"),
            std::env::var_os("XDG_SESSION_DESKTOP"),
        );
        // SAFETY: single-threaded test process for these two variables; both are
        // put back before the test returns.
        unsafe {
            std::env::set_var("XDG_CURRENT_DESKTOP", "KDE");
            std::env::set_var("XDG_SESSION_DESKTOP", "KDE");
        }
        let detected = detect_compositor();
        unsafe {
            match restore.0 {
                Some(value) => std::env::set_var("XDG_CURRENT_DESKTOP", value),
                None => std::env::remove_var("XDG_CURRENT_DESKTOP"),
            }
            match restore.1 {
                Some(value) => std::env::set_var("XDG_SESSION_DESKTOP", value),
                None => std::env::remove_var("XDG_SESSION_DESKTOP"),
            }
        }

        if cfg!(target_os = "linux")
            && std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_none()
            && std::env::var_os("SWAYSOCK").is_none()
        {
            assert!(
                matches!(
                    detected,
                    CompositorKind::KdePlasma6 | CompositorKind::KdePlasma5
                ),
                "XDG_CURRENT_DESKTOP=KDE is a Plasma session, got {detected:?}"
            );
        }
    }
}
