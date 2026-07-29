use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::runtime_log;

const DETECTION_TIMEOUT_MS: u64 = 2_000;
const CACHE_TTL_MS: u64 = 5_000;

static APP_CACHE: Mutex<Option<(WorkspaceContext, Instant)>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceContext {
    pub app_name: String,
    pub bundle_id: String,
    pub category: String,
    pub window_title: String,
    pub detected_language: Option<String>,
    pub detected_framework: Option<String>,
    pub browser_domain: Option<String>,
}

impl WorkspaceContext {
    // Category convenience accessors used by consumers of the detected context.
    #[allow(dead_code)]
    pub fn is_ide(&self) -> bool {
        self.category == "ide"
    }
    #[allow(dead_code)]
    pub fn is_browser(&self) -> bool {
        self.category == "browser"
    }
    #[allow(dead_code)]
    pub fn is_chat_app(&self) -> bool {
        self.category == "chat"
    }
}

pub fn detect_active_app() -> WorkspaceContext {
    {
        if let Ok(cached) = APP_CACHE.lock() {
            if let Some((cached_ctx, cached_at)) = cached.as_ref() {
                if cached_at.elapsed().as_millis() < CACHE_TTL_MS as u128 {
                    return cached_ctx.clone();
                }
            }
        }
    }

    let result = detect_active_app_inner();

    if let Ok(mut cache) = APP_CACHE.lock() {
        *cache = Some((result.clone(), Instant::now()));
    }

    result
}

fn detect_active_app_inner() -> WorkspaceContext {
    #[cfg(target_os = "macos")]
    {
        return detect_macos_inner();
    }
    #[cfg(target_os = "windows")]
    {
        return detect_windows_inner();
    }
    #[cfg(target_os = "linux")]
    {
        return detect_linux_inner();
    }

    #[allow(unreachable_code)]
    WorkspaceContext::default()
}

fn run_with_timeout(mut command: Command) -> Result<std::process::Output, String> {
    use std::io::Read;

    let mut child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {e}"))?;

    let pid = child.id();

    // Drain stdout/stderr on dedicated threads. Without this the child can block
    // forever once a pipe buffer fills up, and the captured output stays empty.
    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();
    let stdout_handle = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(pipe) = stdout_pipe.as_mut() {
            let _ = pipe.read_to_end(&mut buf);
        }
        buf
    });
    let stderr_handle = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(pipe) = stderr_pipe.as_mut() {
            let _ = pipe.read_to_end(&mut buf);
        }
        buf
    });

    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if start.elapsed().as_millis() > DETECTION_TIMEOUT_MS as u128 {
                    let _ = child.kill();
                    let _ = child.wait();
                    runtime_log::record(format!(
                        "[WorkspaceContext] Detection timeout after {DETECTION_TIMEOUT_MS}ms pid={pid}"
                    ));
                    // Killing the child closes its pipe ends, so the reader threads finish.
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    return Err("timeout".to_string());
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => {
                runtime_log::record(format!(
                    "[WorkspaceContext] wait failed pid={pid}: {e}"
                ));
                return Err(format!("wait failed: {e}"));
            }
        }
    };

    let stdout = stdout_handle.join().unwrap_or_default();
    let stderr = stderr_handle.join().unwrap_or_default();

    Ok(std::process::Output {
        status,
        stdout,
        stderr,
    })
}

#[cfg(target_os = "macos")]
fn detect_macos_inner() -> WorkspaceContext {
    let cmd = {
        let mut c = Command::new("osascript");
        c.args([
            "-e",
            r#"tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  try
    set bundleId to bundle identifier of frontApp
  on error
    set bundleId to ""
  end try
  try
    set winTitle to name of front window of frontApp
  on error
    set winTitle to ""
  end try
  return appName & "|" & bundleId & "|" & winTitle
end tell"#,
        ]);
        c
    };

    match run_with_timeout(cmd) {
        Ok(output) if output.status.success() => {
            let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let parts: Vec<&str> = raw.splitn(3, '|').collect();
            let app_name = parts.first().copied().unwrap_or_default().to_string();
            let bundle_id = parts.get(1).copied().unwrap_or_default().to_string();
            let window_title = parts.get(2).copied().unwrap_or_default().to_string();
            let category = categorize_app(&bundle_id, &app_name);
            let browser_domain = if category == "browser" {
                detect_browser_domain(&app_name)
            } else {
                None
            };
            let project_root = resolve_project_root();
            let (detected_language, detected_framework) = if category == "ide" {
                detect_ide_context(&project_root)
                    .map(|(lang, framework)| (Some(lang), framework))
                    .unwrap_or((None, None))
            } else {
                (None, None)
            };

            WorkspaceContext {
                app_name,
                bundle_id,
                category: category.to_string(),
                window_title,
                detected_language,
                detected_framework,
                browser_domain,
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            runtime_log::record(format!(
                "[WorkspaceContext] osascript failed exit={} stderr={}",
                output.status.code().unwrap_or(-1),
                stderr.trim()
            ));
            WorkspaceContext::default()
        }
        Err(e) => {
            runtime_log::record(format!("[WorkspaceContext] osascript error: {e}"));
            WorkspaceContext::default()
        }
    }
}

#[cfg(target_os = "windows")]
fn detect_windows_inner() -> WorkspaceContext {
    let script = r#"
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
public class Win32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
$pid = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
$proc = Get-Process -Id $pid
Write-Output "$($proc.ProcessName)|$($proc.MainModule.FileName)|$($sb.ToString())"
"#;

    let cmd = {
        let mut c = Command::new("powershell");
        c.args(["-NoProfile", "-Command", script]);
        c
    };

    match run_with_timeout(cmd) {
        Ok(output) if output.status.success() => {
            let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let parts: Vec<&str> = raw.splitn(3, '|').collect();
            let app_name = parts.first().copied().unwrap_or_default().to_string();
            let bundle_id = parts.get(1).copied().unwrap_or_default().to_string();
            let window_title = parts.get(2).copied().unwrap_or_default().to_string();
            let category = categorize_app(&bundle_id, &app_name).to_string();

            WorkspaceContext {
                app_name,
                bundle_id,
                category,
                window_title,
                ..Default::default()
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            runtime_log::record(format!(
                "[WorkspaceContext] powershell failed exit={} stderr={}",
                output.status.code().unwrap_or(-1),
                stderr.trim()
            ));
            WorkspaceContext::default()
        }
        Err(e) => {
            runtime_log::record(format!("[WorkspaceContext] powershell error: {e}"));
            WorkspaceContext::default()
        }
    }
}

#[cfg(target_os = "linux")]
fn detect_linux_inner() -> WorkspaceContext {
    let window_title = {
        let mut cmd = Command::new("xdotool");
        cmd.args(["getactivewindow", "getwindowname"]);
        match run_with_timeout(cmd) {
            Ok(output) if output.status.success() => {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
            Ok(output) => {
                runtime_log::record(format!(
                    "[WorkspaceContext] xdotool getwindowname failed exit={}",
                    output.status.code().unwrap_or(-1)
                ));
                String::new()
            }
            Err(e) => {
                runtime_log::record(format!("[WorkspaceContext] xdotool getwindowname error: {e}"));
                String::new()
            }
        }
    };

    let process_name = if !window_title.is_empty() {
        let mut cmd = Command::new("xdotool");
        cmd.args(["getactivewindow", "getwindowpid"]);
        match run_with_timeout(cmd) {
            Ok(output) if output.status.success() => {
                let pid = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if pid.is_empty() || !pid.chars().all(|c| c.is_ascii_digit()) {
                    String::new()
                } else {
                    std::fs::read_to_string(format!("/proc/{}/comm", pid))
                        .ok()
                        .map(|s| s.trim().to_string())
                        .unwrap_or_default()
                }
            }
            Ok(output) => {
                runtime_log::record(format!(
                    "[WorkspaceContext] xdotool getwindowpid failed exit={}",
                    output.status.code().unwrap_or(-1)
                ));
                String::new()
            }
            Err(e) => {
                runtime_log::record(format!("[WorkspaceContext] xdotool getwindowpid error: {e}"));
                String::new()
            }
        }
    } else {
        String::new()
    };

    if process_name.is_empty() {
        return WorkspaceContext::default();
    }

    let category = categorize_app("", &process_name).to_string();

    WorkspaceContext {
        app_name: process_name,
        category,
        window_title,
        ..Default::default()
    }
}

fn categorize_app(bundle_id: &str, app_name: &str) -> &'static str {
    let lower_id = bundle_id.to_lowercase();
    let lower_name = app_name.to_lowercase();

    if lower_id.contains("vscode")
        || lower_id.contains("cursor")
        || lower_id.contains("jetbrains")
        || lower_name.contains("code")
        || lower_name.contains("cursor")
        || lower_name.contains("intellij")
        || lower_name.contains("xcode")
        || lower_name.contains("android studio")
    {
        return "ide";
    }

    if lower_id.contains("safari")
        || lower_id.contains("chrome")
        || lower_id.contains("firefox")
        || lower_id.contains("brave")
        || lower_id.contains("edge")
        || lower_id.contains("opera")
        || lower_name.contains("chrome")
        || lower_name.contains("firefox")
        || lower_name.contains("safari")
    {
        return "browser";
    }

    if lower_id.contains("slack")
        || lower_id.contains("discord")
        || lower_id.contains("teams")
        || lower_name.contains("slack")
        || lower_name.contains("discord")
        || lower_name.contains("teams")
    {
        return "chat";
    }

    if lower_id.contains("mail")
        || lower_id.contains("outlook")
        || lower_id.contains("thunderbird")
        || lower_name.contains("mail")
        || lower_name.contains("outlook")
    {
        return "mail";
    }

    if lower_id.contains("terminal")
        || lower_id.contains("iterm")
        || lower_id.contains("alacritty")
        || lower_id.contains("warp")
        || lower_name.contains("terminal")
        || lower_name.contains("iterm")
    {
        return "terminal";
    }

    if lower_name.contains("notes") {
        return "notes";
    }

    "other"
}

// Only consumed by the macOS IDE-context path today; harmless elsewhere.
#[allow(dead_code)]
fn resolve_project_root() -> Option<std::path::PathBuf> {
    resolve_configured_project_root(std::env::var("WORDSCRIPT_PROJECT_ROOT").ok().as_deref())
}

// The env lookup is split off so tests can exercise both branches without
// mutating the process environment, which is shared by every test thread.
fn resolve_configured_project_root(configured: Option<&str>) -> Option<std::path::PathBuf> {
    if let Some(root) = configured {
        let path = std::path::PathBuf::from(root.trim());
        if path.is_dir() {
            return Some(path);
        }
    }

    std::env::current_dir().ok()
}

#[allow(dead_code)]
pub fn detect_browser_domain(app_name: &str) -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        detect_macos_browser_domain(app_name)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app_name;
        None
    }
}

#[cfg(target_os = "macos")]
fn detect_macos_browser_domain(app_name: &str) -> Option<String> {
    let lower = app_name.to_lowercase();

    #[derive(Clone, Copy)]
    struct BrowserScript {
        app_name_hint: &'static str,
        apple_script_app: &'static str,
        apple_script_property: &'static str,
    }

    const BROWSER_SCRIPTS: &[BrowserScript] = &[
        BrowserScript {
            app_name_hint: "safari",
            apple_script_app: "Safari",
            apple_script_property: "URL of front document",
        },
        BrowserScript {
            app_name_hint: "chrome",
            apple_script_app: "Google Chrome",
            apple_script_property: "URL of active tab of front window",
        },
        BrowserScript {
            app_name_hint: "brave",
            apple_script_app: "Brave Browser",
            apple_script_property: "URL of active tab of front window",
        },
        BrowserScript {
            app_name_hint: "edge",
            apple_script_app: "Microsoft Edge",
            apple_script_property: "URL of active tab of front window",
        },
    ];

    let script_info = BROWSER_SCRIPTS
        .iter()
        .find(|info| lower.contains(info.app_name_hint))?;

    let script = format!(
        "tell application \"{}\" to get {}",
        script_info.apple_script_app, script_info.apple_script_property
    );

    let mut cmd = Command::new("osascript");
    cmd.args(["-e", &script]);

    let output = match run_with_timeout(cmd) {
        Ok(output) if output.status.success() => output,
        Ok(output) => {
            runtime_log::record(format!(
                "[WorkspaceContext] browser domain detection failed exit={} app={}",
                output.status.code().unwrap_or(-1),
                app_name
            ));
            return None;
        }
        Err(e) => {
            runtime_log::record(format!(
                "[WorkspaceContext] browser domain detection error app={}: {e}",
                app_name
            ));
            return None;
        }
    };

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() {
        return None;
    }

    raw.strip_prefix("https://")
        .or_else(|| raw.strip_prefix("http://"))
        .and_then(|rest| rest.split('/').next())
        .map(|s| s.to_string())
}

#[allow(dead_code)]
pub fn detect_ide_context(project_root: &Option<std::path::PathBuf>) -> Option<(String, Option<String>)> {
    let mut dir = project_root.as_ref()?.clone();

    for _ in 0..3 {
        if dir.join("Cargo.toml").is_file() {
            let framework = std::fs::read_to_string(dir.join("Cargo.toml"))
                .ok()
                .and_then(|content| {
                    if content.contains("tauri") {
                        Some("tauri".to_string())
                    } else {
                        None
                    }
                });
            return Some(("rust".to_string(), framework));
        }

        if dir.join("package.json").is_file() {
            let framework = std::fs::read_to_string(dir.join("package.json"))
                .ok()
                .and_then(|content| {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
                        let deps = value.get("dependencies");
                        if let Some(deps) = deps {
                            if deps.get("react").is_some() {
                                return Some("react".to_string());
                            }
                            if deps.get("next").is_some() {
                                return Some("next.js".to_string());
                            }
                            if deps.get("vue").is_some() {
                                return Some("vue".to_string());
                            }
                            if deps.get("svelte").is_some() {
                                return Some("svelte".to_string());
                            }
                            if deps.get("astro").is_some() {
                                return Some("astro".to_string());
                            }
                        }
                    }
                    None
                });
            return Some(("typescript".to_string(), framework));
        }

        if dir.join("go.mod").is_file() {
            return Some(("go".to_string(), None));
        }

        if dir.join("requirements.txt").is_file() || dir.join("pyproject.toml").is_file() {
            return Some(("python".to_string(), None));
        }

        if dir.join("Gemfile").is_file() {
            return Some(("ruby".to_string(), None));
        }

        if !dir.pop() {
            break;
        }
    }

    None
}

#[tauri::command]
pub fn get_workspace_context() -> Result<WorkspaceContext, String> {
    Ok(detect_active_app())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn categorize_app_recognizes_vscode_as_ide() {
        assert_eq!(
            categorize_app("com.microsoft.VSCode", "Visual Studio Code"),
            "ide"
        );
        assert_eq!(categorize_app("", "Code"), "ide");
        assert_eq!(categorize_app("com.cursor.Cursor", "Cursor"), "ide");
        assert_eq!(
            categorize_app("com.jetbrains.intellij", "IntelliJ IDEA"),
            "ide"
        );
    }

    #[test]
    fn categorize_app_recognizes_chrome_as_browser() {
        assert_eq!(
            categorize_app("com.google.Chrome", "Google Chrome"),
            "browser"
        );
        assert_eq!(categorize_app("", "chrome"), "browser");
        assert_eq!(categorize_app("org.mozilla.firefox", "Firefox"), "browser");
    }

    #[test]
    fn categorize_app_recognizes_slack_as_chat() {
        assert_eq!(
            categorize_app("com.tinyspeck.slackmacgap", "Slack"),
            "chat"
        );
        assert_eq!(categorize_app("", "discord"), "chat");
        assert_eq!(
            categorize_app("com.microsoft.teams", "Microsoft Teams"),
            "chat"
        );
    }

    #[test]
    fn unknown_app_defaults_to_other() {
        assert_eq!(categorize_app("com.example.foo", "FooApp"), "other");
        assert_eq!(categorize_app("", "unknown-app"), "other");
    }

    #[test]
    fn workspace_context_default_is_empty() {
        let ctx = WorkspaceContext::default();
        assert!(ctx.app_name.is_empty());
        assert!(ctx.bundle_id.is_empty());
        assert_eq!(ctx.category, "");
        assert!(ctx.window_title.is_empty());
        assert!(ctx.detected_language.is_none());
        assert!(ctx.detected_framework.is_none());
        assert!(ctx.browser_domain.is_none());
    }

    #[test]
    fn is_ide_returns_true_for_ide() {
        let ctx = WorkspaceContext {
            category: "ide".to_string(),
            ..Default::default()
        };
        assert!(ctx.is_ide());
        assert!(!ctx.is_browser());
        assert!(!ctx.is_chat_app());
    }

    #[test]
    fn is_browser_returns_true_for_browser() {
        let ctx = WorkspaceContext {
            category: "browser".to_string(),
            ..Default::default()
        };
        assert!(!ctx.is_ide());
        assert!(ctx.is_browser());
        assert!(!ctx.is_chat_app());
    }

    #[test]
    fn is_chat_app_returns_true_for_chat() {
        let ctx = WorkspaceContext {
            category: "chat".to_string(),
            ..Default::default()
        };
        assert!(!ctx.is_ide());
        assert!(!ctx.is_browser());
        assert!(ctx.is_chat_app());
    }

    #[test]
    #[cfg(unix)]
    fn resolve_project_root_reads_env_var() {
        assert_eq!(
            resolve_configured_project_root(Some("/tmp")),
            Some(std::path::PathBuf::from("/tmp"))
        );
    }

    #[test]
    fn resolve_project_root_falls_back_to_cwd_for_invalid_env() {
        assert_eq!(
            resolve_configured_project_root(Some("/nonexistent/path/xyz")),
            std::env::current_dir().ok()
        );
    }

    #[test]
    fn resolve_project_root_falls_back_to_cwd_without_env() {
        assert_eq!(
            resolve_configured_project_root(None),
            std::env::current_dir().ok()
        );
    }
}
