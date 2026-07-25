use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_global_shortcut::{
    GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState,
};

use super::capture::NativeCaptureState;
use super::config::{AppConfig, ProcessingMode};
use super::sessions::{NativeSessionStage, NativeSessionState};
use super::shortcut;

const DEFAULT_DEBOUNCE_MS: u64 = 300;
const DEFAULT_HOLD_MIN_MS: u64 = 300;
const DEFAULT_HOLD_WATCHDOG_SECONDS: u64 = 120;
const DEFAULT_DOUBLE_TAP_WINDOW_MS: u64 = 400;

/// Permanent structured logging for the trigger lane (T11). Every shortcut
/// event, every registration outcome and every decision the state machine
/// takes lands in the runtime log, so a shortcut report can be answered from
/// evidence instead of code reading. This is infrastructure, not a temporary
/// debug patch — the same principle as the overlay diagnostics.
fn log_trigger(event: &str, fields: &[(&str, String)]) {
    let mut line = format!("[trigger] event={event}");
    for (key, value) in fields {
        line.push(' ');
        line.push_str(key);
        line.push('=');
        if value.is_empty() || value.contains(' ') {
            line.push('"');
            line.push_str(value);
            line.push('"');
        } else {
            line.push_str(value);
        }
    }
    super::runtime_log::record(line);
}

/// Renders the decision the state machine took for one received shortcut
/// event. Kept separate from the handler so it is unit-testable without an
/// `AppHandle`.
fn describe_trigger_decision(
    label: &str,
    state: ShortcutState,
    activation_mode: &NativeActivationMode,
    decision: &str,
) -> String {
    format!(
        "binding={label} state={} mode={} decision={decision}",
        match state {
            ShortcutState::Pressed => "pressed",
            ShortcutState::Released => "released",
        },
        activation_mode.as_log_token()
    )
}

/// Processing-mode hotkeys sourced from `AppConfig`. Each entry is either a
/// normalized shortcut string (e.g. `"Ctrl+Alt+M"`) or empty when the user has
/// disabled that particular hotkey.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModeHotkeys {
    pub picker: String,
    pub auto: String,
    pub verbatim: String,
    pub cleanup: String,
    pub rewrite: String,
    pub agent: String,
    pub prompt_enhance: String,
}

impl ModeHotkeys {
    /// Loads all mode hotkeys from a persisted `AppConfig`. The values
    /// are already normalized on save, but normalization is idempotent so we
    /// re-run it defensively against the platform defaults (empty strings pass
    /// through as empty — meaning "disabled").
    fn from_app_config(config: &AppConfig) -> Self {
        Self {
            picker: config.mode_picker_hotkey.clone(),
            auto: config.mode_auto_hotkey.clone(),
            verbatim: config.mode_verbatim_hotkey.clone(),
            cleanup: config.mode_cleanup_hotkey.clone(),
            rewrite: config.mode_rewrite_hotkey.clone(),
            agent: config.mode_agent_hotkey.clone(),
            prompt_enhance: config.mode_prompt_enhance_hotkey.clone(),
        }
    }

    /// Returns the hotkey string for a direct per-mode jump.
    fn for_mode(&self, mode: ProcessingMode) -> &str {
        match mode {
            ProcessingMode::Auto => &self.auto,
            ProcessingMode::Verbatim => &self.verbatim,
            ProcessingMode::Cleanup => &self.cleanup,
            ProcessingMode::Rewrite => &self.rewrite,
            ProcessingMode::Agent => &self.agent,
            ProcessingMode::PromptEnhance => &self.prompt_enhance,
        }
    }

    /// Every mode-hotkey slot with its label, including the empty (disabled)
    /// ones. Used to give disabled bindings a visible row.
    fn all_slots(&self) -> Vec<(&'static str, &str)> {
        vec![
            ("mode_picker", self.picker.as_str()),
            (ProcessingMode::Auto.as_str(), self.auto.as_str()),
            (ProcessingMode::Verbatim.as_str(), self.verbatim.as_str()),
            (ProcessingMode::Cleanup.as_str(), self.cleanup.as_str()),
            (ProcessingMode::Rewrite.as_str(), self.rewrite.as_str()),
            (ProcessingMode::Agent.as_str(), self.agent.as_str()),
            (
                ProcessingMode::PromptEnhance.as_str(),
                self.prompt_enhance.as_str(),
            ),
        ]
    }

    /// Iterates over all non-empty mode hotkeys together with a label describing
    /// their semantic role. Used by the registration loop and the idempotency /
    /// collision checks.
    fn entries(&self) -> Vec<(&'static str, &str)> {
        let mut out = Vec::new();
        if !self.picker.is_empty() {
            out.push(("mode_picker", self.picker.as_str()));
        }
        for (mode, hotkey) in [
            (ProcessingMode::Auto, &self.auto),
            (ProcessingMode::Verbatim, &self.verbatim),
            (ProcessingMode::Cleanup, &self.cleanup),
            (ProcessingMode::Rewrite, &self.rewrite),
            (ProcessingMode::Agent, &self.agent),
            (ProcessingMode::PromptEnhance, &self.prompt_enhance),
        ] {
            if !hotkey.is_empty() {
                out.push((mode.as_str(), hotkey.as_str()));
            }
        }
        out
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeActivationMode {
    Tap,
    Hold,
    DoubleTap,
}

impl NativeActivationMode {
    fn from_config(value: &str) -> Self {
        let value = value.trim();
        if value.eq_ignore_ascii_case("hold") {
            Self::Hold
        } else if value.eq_ignore_ascii_case("double_tap")
            || value.eq_ignore_ascii_case("doubletap")
            || value.eq_ignore_ascii_case("double")
        {
            Self::DoubleTap
        } else {
            Self::Tap
        }
    }

    fn as_log_token(&self) -> &'static str {
        match self {
            Self::Tap => "tap",
            Self::Hold => "hold",
            Self::DoubleTap => "double_tap",
        }
    }
}

/// What a single trigger edge means while `DoubleTap` is active.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DoubleTapOutcome {
    /// First edge: remember it and do nothing. This is what gives the desktop
    /// its keys back — a lone `Ctrl+Alt` no longer acts, so `Ctrl+Alt+T` keeps
    /// opening a terminal without also firing WordScript.
    Armed,
    /// Second edge inside the window: act.
    Fired,
}

fn resolve_double_tap(
    last_edge: Option<Instant>,
    window: Duration,
    now: Instant,
) -> DoubleTapOutcome {
    match last_edge {
        Some(previous) if now.duration_since(previous) <= window => DoubleTapOutcome::Fired,
        _ => DoubleTapOutcome::Armed,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeTriggerConfig {
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub activation_mode: NativeActivationMode,
    pub enabled: bool,
    pub debounce_ms: u64,
    pub hold_min_ms: u64,
    /// Upper bound for a single hold before the watchdog ends it with a stated
    /// reason. A hold whose `Released` event never arrives would otherwise run
    /// until the silence timeout or the maximum-length cap and look like an
    /// unrelated capture bug (D11). `0` disables the watchdog.
    pub hold_watchdog_seconds: u64,
    /// How close together the two taps of a double-tap must be, in
    /// milliseconds.
    pub double_tap_window_ms: u64,
    #[serde(default)]
    pub mode_hotkeys: ModeHotkeys,
}

impl Default for NativeTriggerConfig {
    fn default() -> Self {
        Self {
            hotkey: default_hotkey(),
            pause_hotkey: default_pause_hotkey(),
            abort_hotkey: default_abort_hotkey(),
            activation_mode: NativeActivationMode::from_config(default_activation_mode()),
            enabled: true,
            debounce_ms: DEFAULT_DEBOUNCE_MS,
            hold_min_ms: DEFAULT_HOLD_MIN_MS,
            hold_watchdog_seconds: DEFAULT_HOLD_WATCHDOG_SECONDS,
            double_tap_window_ms: DEFAULT_DOUBLE_TAP_WINDOW_MS,
            mode_hotkeys: ModeHotkeys::default(),
        }
    }
}

impl NativeTriggerConfig {
    pub fn load_from_disk() -> Self {
        let app_config = AppConfig::load_from_disk();
        let mode_hotkeys = ModeHotkeys::from_app_config(&app_config);

        Self {
            hotkey: app_config.hotkey,
            pause_hotkey: app_config.pause_hotkey,
            abort_hotkey: app_config.abort_hotkey,
            activation_mode: NativeActivationMode::from_config(&app_config.activation_mode),
            hold_watchdog_seconds: app_config.hold_watchdog_seconds,
            double_tap_window_ms: app_config.double_tap_window_ms,
            mode_hotkeys,
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConfigureNativeTriggerRequest {
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub activation_mode: String,
    #[serde(default)]
    pub hold_watchdog_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeTriggerStatus {
    pub configured: bool,
    pub enabled: bool,
    pub paused: bool,
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub registered_hotkey: Option<String>,
    pub registered_pause_hotkey: Option<String>,
    pub registered_abort_hotkey: Option<String>,
    pub activation_mode: NativeActivationMode,
    pub last_error: Option<String>,
    pub owner: String,
    /// True while the OS grabs are actually released because a recorder is
    /// open. Distinct from `paused`, which is the user-facing pause of the
    /// capture trigger.
    pub suspended: bool,
    /// Runtime truth per shortcut slot (T8) plus the press/release evidence
    /// the activation-mode question depends on (T10).
    #[serde(default)]
    pub bindings: Vec<BindingInfo>,
    /// Timing constants the activation modes depend on, surfaced so the UI can
    /// state them instead of leaving them invisible (D11).
    pub hold_min_ms: u64,
    pub debounce_ms: u64,
    pub hold_watchdog_seconds: u64,
    pub double_tap_window_ms: u64,
    /// Labels of mode hotkeys currently registered with the OS, together with
    /// their display string. Empty when no mode hotkeys are active. Lets the
    /// frontend show runtime truth instead of assuming registration succeeded.
    #[serde(default)]
    pub registered_mode_hotkeys: Vec<ModeHotkeyStatus>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModeHotkeyStatus {
    pub label: String,
    pub display: String,
}

/// Per-binding runtime truth for one shortcut slot: what is configured, what
/// the OS actually accepted, why it did not, and what the lane has observed
/// coming back from the OS. Settings renders this instead of assuming that a
/// saved value is a live grab (T8), and the press/release counters are the
/// evidence that decides whether hold to talk can work in this session (T10).
#[derive(Debug, Clone, Serialize)]
pub struct BindingInfo {
    /// Stable id: `capture`, `pause`, `abort`, `mode_picker`, or a processing
    /// mode token such as `agent`.
    pub label: String,
    /// `capture` for the three trigger slots, `mode` for mode hotkeys.
    pub role: String,
    /// Canonical configured value. Empty means the binding is disabled.
    pub configured: String,
    /// Human display string for `configured`.
    pub display: String,
    pub registered: bool,
    /// Why registration failed, when it did. Persistent, not a toast.
    pub error: Option<String>,
    pub presses: u64,
    pub releases: u64,
    pub last_press_ms: Option<u64>,
    pub last_release_ms: Option<u64>,
}

impl BindingInfo {
    fn new(label: &str, role: &str, configured: &str, display: &str) -> Self {
        Self {
            label: label.to_string(),
            role: role.to_string(),
            configured: configured.to_string(),
            display: display.to_string(),
            registered: false,
            error: None,
            presses: 0,
            releases: 0,
            last_press_ms: None,
            last_release_ms: None,
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

#[derive(Debug, Clone)]
struct RegisteredShortcutBinding {
    /// Canonical storage form, e.g. `Ctrl+F9`. Used for persistence,
    /// comparison and collision checks.
    display: String,
    /// Human form shown in the UI, e.g. `Ctrl + F9`.
    human: String,
    shortcuts: Vec<Shortcut>,
}

#[derive(Debug, Clone)]
pub enum TriggerEffect {
    StartCapture,
    StopCapture { session_id: String },
    TogglePause,
    AbortCapture,
    DeferredStop { hold_session: u64, delay_ms: u64 },
    /// Mode-select hotkey: toggle signal for the overlay. First press opens
    /// the overlay in the mode-select surface (current mode shown, tap to
    /// cycle). Second press cycles to the next mode persistently. The frontend
    /// owns the toggle state — Rust just emits the signal.
    ModeSelect,
    /// Jump directly to a specific processing mode (per-mode hotkey).
    SetModeDirect(ProcessingMode),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TapShortcutIntent {
    Start,
    Stop,
    Ignore,
}

#[derive(Debug)]
pub struct NativeTriggerState {
    config: NativeTriggerConfig,
    registered_hotkey: Option<String>,
    registered_pause_hotkey: Option<String>,
    registered_abort_hotkey: Option<String>,
    hotkey_ids: Vec<u32>,
    pause_hotkey_ids: Vec<u32>,
    abort_hotkey_ids: Vec<u32>,
    /// Maps each mode-hotkey label (e.g. `"mode_picker"`, or a
    /// processing-mode token like `"agent"`) to the registered shortcut IDs.
    /// Empty when no mode hotkeys are configured / registered.
    mode_hotkey_ids: std::collections::HashMap<String, Vec<u32>>,
    /// Mirrors `mode_hotkey_ids` but stores the human-readable display string
    /// for status reporting and idempotency checks.
    registered_mode_hotkeys: std::collections::HashMap<String, String>,
    /// Runtime truth per slot, rebuilt on every registration and updated in
    /// place as events arrive.
    bindings: Vec<BindingInfo>,
    /// True while the recorder holds the grabs open (T4). Independent of
    /// `paused`.
    suspended: bool,
    paused: bool,
    hotkey_active: bool,
    tap_hotkey_down: bool,
    pause_active: bool,
    abort_active: bool,
    toggled_on: bool,
    hold_session: u64,
    hold_started_at: Option<Instant>,
    /// Whether a `Released` event was seen for the current hold session. The
    /// watchdog only ends a hold that never got one.
    hold_release_seen: bool,
    /// Timestamp of the first tap per binding, while waiting for the second.
    /// Keyed by binding label so capture, pause and abort each get their own
    /// window instead of stealing each other's arm.
    double_tap_edges: std::collections::HashMap<String, Instant>,
    last_hotkey_press: Option<Instant>,
    last_tap_shortcut_intent: Option<TapShortcutIntent>,
    last_error: Option<String>,
}

impl Default for NativeTriggerState {
    fn default() -> Self {
        Self::new(NativeTriggerConfig::default())
    }
}

impl NativeTriggerState {
    pub fn new(config: NativeTriggerConfig) -> Self {
        Self {
            config,
            registered_hotkey: None,
            registered_pause_hotkey: None,
            registered_abort_hotkey: None,
            hotkey_ids: Vec::new(),
            pause_hotkey_ids: Vec::new(),
            abort_hotkey_ids: Vec::new(),
            mode_hotkey_ids: std::collections::HashMap::new(),
            registered_mode_hotkeys: std::collections::HashMap::new(),
            bindings: Vec::new(),
            suspended: false,
            paused: false,
            hotkey_active: false,
            tap_hotkey_down: false,
            pause_active: false,
            abort_active: false,
            toggled_on: false,
            hold_session: 0,
            hold_started_at: None,
            hold_release_seen: false,
            double_tap_edges: std::collections::HashMap::new(),
            last_hotkey_press: None,
            last_tap_shortcut_intent: None,
            last_error: None,
        }
    }

    fn status(&self) -> NativeTriggerStatus {
        NativeTriggerStatus {
            configured: !self.hotkey_ids.is_empty(),
            enabled: self.config.enabled,
            paused: self.paused,
            hotkey: self.config.hotkey.clone(),
            pause_hotkey: self.config.pause_hotkey.clone(),
            abort_hotkey: self.config.abort_hotkey.clone(),
            registered_hotkey: self.registered_hotkey.clone(),
            registered_pause_hotkey: self.registered_pause_hotkey.clone(),
            registered_abort_hotkey: self.registered_abort_hotkey.clone(),
            activation_mode: self.config.activation_mode.clone(),
            last_error: self.last_error.clone(),
            owner: "native_tauri_global_shortcut".to_string(),
            suspended: self.suspended,
            bindings: self.bindings.clone(),
            hold_min_ms: self.config.hold_min_ms,
            debounce_ms: self.config.debounce_ms,
            hold_watchdog_seconds: self.config.hold_watchdog_seconds,
            double_tap_window_ms: self.config.double_tap_window_ms,
            registered_mode_hotkeys: self
                .registered_mode_hotkeys
                .iter()
                .map(|(label, display)| ModeHotkeyStatus {
                    label: label.clone(),
                    display: display.clone(),
                })
                .collect(),
        }
    }

    /// What this session has actually delivered for the configured capture
    /// shortcut. The counters reset whenever the shortcut is re-registered, so
    /// the evidence always belongs to the value currently in force.
    fn capture_release_evidence(&self) -> shortcut::ReleaseEvidence {
        self.bindings
            .iter()
            .find(|binding| binding.label == "capture")
            .map(|binding| shortcut::ReleaseEvidence::from_counters(binding.presses, binding.releases))
            .unwrap_or(shortcut::ReleaseEvidence::Unobserved)
    }
}

/// The per-OS capability matrix for the current session (T12, S7). Joins the
/// session facts from `core::shortcut` with the press/release evidence this
/// trigger lane recorded, so the UI can gate its options on runtime truth
/// instead of re-deriving platform rules (ADR 0006).
#[tauri::command]
pub fn shortcut_capabilities(
    state: State<'_, Mutex<NativeTriggerState>>,
) -> shortcut::ShortcutCapabilities {
    let evidence = state
        .lock()
        .map(|state| state.capture_release_evidence())
        .unwrap_or(shortcut::ReleaseEvidence::Unobserved);

    shortcut::capability_matrix(&shortcut::shortcut_platform(), evidence)
}

#[tauri::command]
pub fn native_trigger_status(
    state: State<'_, Mutex<NativeTriggerState>>,
) -> Result<NativeTriggerStatus, String> {
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

#[tauri::command]
pub fn configure_native_trigger(
    app: AppHandle,
    request: ConfigureNativeTriggerRequest,
    state: State<'_, Mutex<NativeTriggerState>>,
) -> Result<NativeTriggerStatus, String> {
    // Mode hotkeys come from the persisted config, not from the in-memory
    // state.
    //
    // Preserving them from state meant a mode hotkey changed in Settings was
    // written to disk but never re-registered: the OS grab kept firing on the
    // value from the last startup, so "no matter what I assign, mode select
    // does nothing" — configured and registered disagreed silently, which is
    // exactly what T8 forbids. The frontend calls this command only after
    // `save_config` has resolved, so the file is authoritative here.
    let persisted = AppConfig::load_from_disk();
    let mode_hotkeys = ModeHotkeys::from_app_config(&persisted);
    let existing_hold_watchdog = {
        let lock = state.lock().map_err(|error| error.to_string())?;
        lock.config.hold_watchdog_seconds
    };

    let config = NativeTriggerConfig {
        hotkey: request.hotkey,
        pause_hotkey: request.pause_hotkey,
        abort_hotkey: request.abort_hotkey,
        activation_mode: NativeActivationMode::from_config(&request.activation_mode),
        enabled: true,
        debounce_ms: DEFAULT_DEBOUNCE_MS,
        hold_min_ms: DEFAULT_HOLD_MIN_MS,
        hold_watchdog_seconds: request
            .hold_watchdog_seconds
            .unwrap_or(existing_hold_watchdog),
        double_tap_window_ms: persisted.double_tap_window_ms,
        mode_hotkeys,
    };

    register_native_shortcuts(&app, state.inner(), config)
}

/// Releases the OS grabs while a shortcut recorder is open.
///
/// A soft `paused` flag is not sufficient (D3): a grabbed combination is
/// delivered to the grab owner, not to the focused WebKitGTK window, so the
/// shortcut you already use would be invisible to the DOM recorder and could
/// never be re-recorded. This actually unregisters every capture and mode
/// shortcut and remembers the configuration so `resume_native_trigger` can put
/// them back.
#[tauri::command]
pub fn pause_native_trigger<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Mutex<NativeTriggerState>>,
) -> Result<NativeTriggerStatus, String> {
    suspend_native_shortcuts(&app, state.inner())
}

/// Re-registers everything `pause_native_trigger` released. Safe to call when
/// nothing is suspended.
#[tauri::command]
pub fn resume_native_trigger<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Mutex<NativeTriggerState>>,
) -> Result<NativeTriggerStatus, String> {
    resume_native_shortcuts(&app, state.inner())
}

pub fn suspend_native_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    state: &Mutex<NativeTriggerState>,
) -> Result<NativeTriggerStatus, String> {
    let (shortcuts, already_suspended) = {
        let mut lock = state.lock().map_err(|error| error.to_string())?;
        if lock.suspended {
            (Vec::new(), true)
        } else {
            let shortcuts = currently_registered_shortcuts(&lock);
            lock.suspended = true;
            lock.paused = true;
            lock.hotkey_active = false;
            lock.tap_hotkey_down = false;
            lock.pause_active = false;
            lock.abort_active = false;
            lock.hold_started_at = None;
            lock.last_tap_shortcut_intent = None;
            (shortcuts, false)
        }
    };

    if already_suspended {
        log_trigger("suspend", &[("outcome", "already_suspended".to_string())]);
    } else {
        let mut released = 0usize;
        for shortcut in shortcuts {
            match app.global_shortcut().unregister(shortcut) {
                Ok(()) => released += 1,
                Err(error) => log_trigger(
                    "unregister",
                    &[
                        ("id", shortcut.id().to_string()),
                        ("outcome", "error".to_string()),
                        ("error", error.to_string()),
                    ],
                ),
            }
        }
        log_trigger(
            "suspend",
            &[
                ("outcome", "released".to_string()),
                ("shortcuts", released.to_string()),
            ],
        );
    }

    let mut lock = state.lock().map_err(|error| error.to_string())?;
    for binding in &mut lock.bindings {
        binding.registered = false;
    }
    Ok(lock.status())
}

pub fn resume_native_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    state: &Mutex<NativeTriggerState>,
) -> Result<NativeTriggerStatus, String> {
    let config = {
        let mut lock = state.lock().map_err(|error| error.to_string())?;
        if !lock.suspended {
            lock.paused = false;
            return Ok(lock.status());
        }
        lock.suspended = false;
        lock.paused = false;
        // Force a real re-registration: the idempotency guard in
        // `register_native_shortcuts` compares against these fields and would
        // otherwise skip the work that suspending just undid.
        lock.registered_hotkey = None;
        lock.registered_pause_hotkey = None;
        lock.registered_abort_hotkey = None;
        lock.hotkey_ids.clear();
        lock.pause_hotkey_ids.clear();
        lock.abort_hotkey_ids.clear();
        lock.mode_hotkey_ids.clear();
        lock.registered_mode_hotkeys.clear();
        lock.config.clone()
    };

    log_trigger("resume", &[("outcome", "reregistering".to_string())]);
    register_native_shortcuts(app, state, config)
}

/// Every shortcut currently held at the OS level, deduplicated by id.
fn currently_registered_shortcuts(state: &NativeTriggerState) -> Vec<Shortcut> {
    let mut shortcuts = Vec::new();
    let mut ids = Vec::new();

    let registered = [
        state.registered_hotkey.as_deref(),
        state.registered_pause_hotkey.as_deref(),
        state.registered_abort_hotkey.as_deref(),
    ]
    .into_iter()
    .flatten()
    .chain(state.registered_mode_hotkeys.values().map(String::as_str));

    for value in registered {
        if let Ok(binding) = build_shortcut_binding(value, true) {
            collect_unique_shortcuts(&mut shortcuts, &mut ids, &binding.shortcuts);
        }
    }

    shortcuts
}

pub fn register_native_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    state: &Mutex<NativeTriggerState>,
    config: NativeTriggerConfig,
) -> Result<NativeTriggerStatus, String> {
    let hotkey = build_shortcut_binding(&config.hotkey, true)?;
    let mut pause_hotkey = build_shortcut_binding(&config.pause_hotkey, true)?;
    let mut abort_hotkey = build_shortcut_binding(&config.abort_hotkey, true)?;
    if abort_hotkey.display == hotkey.display {
        abort_hotkey = build_shortcut_binding(&default_abort_hotkey(), true)?;
    }
    if pause_hotkey.display == hotkey.display || pause_hotkey.display == abort_hotkey.display {
        pause_hotkey = build_shortcut_binding(&default_pause_hotkey(), true)?;
    }
    if pause_hotkey.display == hotkey.display || pause_hotkey.display == abort_hotkey.display {
        return Err("Pause hotkey must differ from Start / Stop and Abort hotkeys.".to_string());
    }

    // Reserved display strings (start / pause / abort). Mode hotkeys must not
    // collide with any of them.
    let reserved = [hotkey.display.clone(), pause_hotkey.display.clone(), abort_hotkey.display.clone()];

    // Parse all non-empty mode hotkeys and reject collisions with the reserved
    // set and with each other. Empty strings are skipped (hotkey disabled).
    let mut mode_bindings: Vec<(&'static str, RegisteredShortcutBinding)> = Vec::new();
    let mut seen_mode_displays: Vec<String> = Vec::new();
    for (label, raw) in config.mode_hotkeys.entries() {
        let binding = build_shortcut_binding(raw, true)?;
        if reserved.contains(&binding.display) {
            return Err(format!(
                "Mode hotkey '{}' ({}): must differ from Start / Stop / Pause / Abort hotkeys.",
                label, binding.display
            ));
        }
        if seen_mode_displays.contains(&binding.display) {
            return Err(format!(
                "Mode hotkey '{}' ({}): duplicate of another mode hotkey.",
                label, binding.display
            ));
        }
        seen_mode_displays.push(binding.display.clone());
        mode_bindings.push((label, binding));
    }

    let config = NativeTriggerConfig {
        hotkey: hotkey.display.clone(),
        pause_hotkey: pause_hotkey.display.clone(),
        abort_hotkey: abort_hotkey.display.clone(),
        ..config
    };

    // While a recorder holds the grabs open (T4) a config change must not
    // silently re-grab behind it. Keep the new configuration and let
    // `resume_native_shortcuts` register it when the recorder closes.
    {
        let mut current = state.lock().map_err(|error| error.to_string())?;
        if current.suspended {
            log_trigger(
                "register",
                &[
                    ("outcome", "skipped".to_string()),
                    ("reason", "suspended_for_recording".to_string()),
                ],
            );
            current.config = config;
            return Ok(current.status());
        }
    }

    // Idempotency guard: skip unregister/re-register when shortcuts haven't changed.
    // This prevents a brief gap where the shortcut is unregistered (and a user press
    // would be silently dropped) on every concurrent startup call from multiple windows.
    {
        let current = state.lock().map_err(|error| error.to_string())?;
        let base_unchanged = current.registered_hotkey.as_deref()
            == Some(hotkey.display.as_str())
            && current.registered_pause_hotkey.as_deref() == Some(pause_hotkey.display.as_str())
            && current.registered_abort_hotkey.as_deref() == Some(abort_hotkey.display.as_str())
            && !current.hotkey_ids.is_empty();

        let mode_unchanged = mode_bindings.iter().all(|(label, binding)| {
            current
                .registered_mode_hotkeys
                .get(*label)
                .map(|display| display == &binding.display)
                .unwrap_or(false)
        }) && current.registered_mode_hotkeys.len() == mode_bindings.len();

        if base_unchanged && mode_unchanged {
            drop(current);
            log_trigger("register", &[("outcome", "skipped_idempotent".to_string())]);
            let mut state = state.lock().map_err(|error| error.to_string())?;
            state.config = config;
            sync_trigger_state_with_session(&mut state, active_session_stage(app));
            return Ok(state.status());
        }

        let mut old_shortcuts = Vec::new();
        let mut old_shortcut_ids = Vec::new();
        if let Some(value) = &current.registered_hotkey {
            if let Ok(binding) = build_shortcut_binding(value, true) {
                collect_unique_shortcuts(
                    &mut old_shortcuts,
                    &mut old_shortcut_ids,
                    &binding.shortcuts,
                );
            }
        }
        if let Some(value) = &current.registered_pause_hotkey {
            if let Ok(binding) = build_shortcut_binding(value, true) {
                collect_unique_shortcuts(
                    &mut old_shortcuts,
                    &mut old_shortcut_ids,
                    &binding.shortcuts,
                );
            }
        }
        if let Some(value) = &current.registered_abort_hotkey {
            if let Ok(binding) = build_shortcut_binding(value, true) {
                collect_unique_shortcuts(
                    &mut old_shortcuts,
                    &mut old_shortcut_ids,
                    &binding.shortcuts,
                );
            }
        }
        for value in current.registered_mode_hotkeys.values() {
            if let Ok(binding) = build_shortcut_binding(value, true) {
                collect_unique_shortcuts(
                    &mut old_shortcuts,
                    &mut old_shortcut_ids,
                    &binding.shortcuts,
                );
            }
        }
        drop(current);

        for shortcut in old_shortcuts {
            match app.global_shortcut().unregister(shortcut) {
                Ok(()) => log_trigger(
                    "unregister",
                    &[
                        ("id", shortcut.id().to_string()),
                        ("outcome", "ok".to_string()),
                    ],
                ),
                Err(error) => log_trigger(
                    "unregister",
                    &[
                        ("id", shortcut.id().to_string()),
                        ("outcome", "error".to_string()),
                        ("error", error.to_string()),
                    ],
                ),
            }
        }
    }

    let mut bindings: Vec<BindingInfo> = Vec::new();

    register_binding(app, &mut bindings, "capture", "capture", &hotkey)?;
    register_binding(app, &mut bindings, "pause", "capture", &pause_hotkey)?;
    if abort_hotkey.display == hotkey.display {
        // Abort collapsed onto the capture shortcut; it shares the same grab,
        // so it is live without a second registration.
        let mut shared = BindingInfo::new(
            "abort",
            "capture",
            &abort_hotkey.display,
            &abort_hotkey.human,
        );
        shared.registered = true;
        bindings.push(shared);
    } else {
        register_binding(app, &mut bindings, "abort", "capture", &abort_hotkey)?;
    }

    // Register every mode hotkey. A failure here is logged but does NOT abort
    // the whole registration — the base capture hotkeys are already live and
    // a single mode-hotkey collision with another app should not break dictation.
    let mut mode_hotkey_ids: std::collections::HashMap<String, Vec<u32>> =
        std::collections::HashMap::new();
    let mut registered_mode_hotkeys: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for (label, binding) in &mode_bindings {
        let mut info = BindingInfo::new(label, "mode", &binding.display, &binding.human);
        let mut ids = Vec::new();
        for shortcut in &binding.shortcuts {
            match app.global_shortcut().register(*shortcut) {
                Ok(()) => {
                    log_trigger(
                        "register",
                        &[
                            ("binding", (*label).to_string()),
                            ("shortcut", binding.display.clone()),
                            ("id", shortcut.id().to_string()),
                            ("outcome", "ok".to_string()),
                        ],
                    );
                    ids.push(shortcut.id());
                }
                Err(error) => {
                    log_trigger(
                        "register",
                        &[
                            ("binding", (*label).to_string()),
                            ("shortcut", binding.display.clone()),
                            ("id", shortcut.id().to_string()),
                            ("outcome", "error".to_string()),
                            ("error", error.to_string()),
                        ],
                    );
                    info.error = Some(registration_failure_reason(&binding.human, &error.to_string()));
                }
            }
        }
        if !ids.is_empty() {
            info.registered = true;
            mode_hotkey_ids.insert((*label).to_string(), ids);
            registered_mode_hotkeys.insert((*label).to_string(), binding.display.clone());
        }
        bindings.push(info);
    }

    // Disabled mode hotkeys still get a row so Settings can show "disabled"
    // instead of an absent binding (T7).
    for (label, configured) in config.mode_hotkeys.all_slots() {
        if configured.is_empty() && !bindings.iter().any(|binding| binding.label == label) {
            bindings.push(BindingInfo::new(label, "mode", "", ""));
        }
    }

    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.bindings = bindings;
    state.config = config;
    state.registered_hotkey = Some(hotkey.display);
    state.registered_pause_hotkey = Some(pause_hotkey.display);
    state.registered_abort_hotkey = Some(abort_hotkey.display);
    state.hotkey_ids = hotkey.shortcuts.iter().map(Shortcut::id).collect();
    state.pause_hotkey_ids = pause_hotkey.shortcuts.iter().map(Shortcut::id).collect();
    state.abort_hotkey_ids = abort_hotkey.shortcuts.iter().map(Shortcut::id).collect();
    state.mode_hotkey_ids = mode_hotkey_ids;
    state.registered_mode_hotkeys = registered_mode_hotkeys;
    state.pause_active = false;
    state.abort_active = false;
    state.tap_hotkey_down = false;
    state.last_tap_shortcut_intent = None;
    state.last_error = None;
    sync_trigger_state_with_session(&mut state, active_session_stage(app));
    Ok(state.status())
}

pub fn handle_global_shortcut_event<R: Runtime>(
    app: &AppHandle<R>,
    shortcut: &Shortcut,
    event: ShortcutEvent,
) -> Option<TriggerEffect> {
    let trigger_state = app.try_state::<Mutex<NativeTriggerState>>()?;
    let mut state = trigger_state.lock().ok()?;

    let shortcut_id = shortcut.id();
    let is_abort = state.abort_hotkey_ids.contains(&shortcut_id);
    let is_pause = state.pause_hotkey_ids.contains(&shortcut_id);
    let is_hotkey = state.hotkey_ids.contains(&shortcut_id);

    // Mode hotkeys are fire-and-forget: they only act on the initial Press and
    // ignore Release. We look up which mode-hotkey label (if any) owns this
    // shortcut ID and map it to a TriggerEffect.
    let mode_hotkey_label: Option<String> = state
        .mode_hotkey_ids
        .iter()
        .find(|(_, ids)| ids.contains(&shortcut_id))
        .map(|(label, _)| label.clone());

    let label = if is_hotkey {
        "capture".to_string()
    } else if is_pause {
        "pause".to_string()
    } else if is_abort {
        "abort".to_string()
    } else {
        mode_hotkey_label
            .clone()
            .unwrap_or_else(|| "unbound".to_string())
    };

    // Log and count every event that reaches us — including the ones we then
    // drop — so "the key never arrived", "the shortcut is not registered" and
    // "the event was ignored" stop being indistinguishable (D12).
    record_binding_observation(&mut state, &label, event.state);
    log_trigger(
        "shortcut",
        &[
            ("id", shortcut_id.to_string()),
            ("binding", label.clone()),
            (
                "state",
                match event.state {
                    ShortcutState::Pressed => "pressed".to_string(),
                    ShortcutState::Released => "released".to_string(),
                },
            ),
        ],
    );

    let activation_mode = state.config.activation_mode.clone();
    let mut decide = |decision: &str| {
        log_trigger(
            "decision",
            &[(
                "detail",
                describe_trigger_decision(&label, event.state, &activation_mode, decision),
            )],
        );
    };

    if !state.config.enabled {
        decide("ignored_disabled");
        return None;
    }
    if state.suspended {
        decide("ignored_suspended_for_recording");
        return None;
    }
    if state.paused {
        decide("ignored_paused");
        return None;
    }

    if !is_abort && !is_pause && !is_hotkey && mode_hotkey_label.is_none() {
        decide("no_binding");
        return None;
    }

    // Mode hotkeys fire on Press only and don't participate in the
    // capture start/stop state machine below.
    if let Some(mode_label) = mode_hotkey_label {
        if event.state == ShortcutState::Pressed {
            let effect = match mode_label.as_str() {
                "mode_picker" => {
                    decide("mode_select");
                    TriggerEffect::ModeSelect
                }
                other => {
                    decide("set_mode");
                    TriggerEffect::SetModeDirect(ProcessingMode::from_str(other))
                }
            };
            drop(state);
            return Some(effect);
        }
        decide("ignored_mode_release");
        return None;
    }

    let session_stage = active_session_stage(app);
    let capture_is_recording = active_capture_is_recording(app);
    sync_trigger_state_with_session(&mut state, session_stage.clone());

    match event.state {
        ShortcutState::Pressed if is_abort => {
            if state.abort_active {
                decide("ignored_already_active");
                return None;
            }
            state.abort_active = true;
            if requires_double_tap(&state) && !double_tap_gate(&mut state, "abort", Instant::now())
            {
                decide("double_tap_armed");
                return None;
            }
            state.hotkey_active = false;
            state.tap_hotkey_down = false;
            state.toggled_on = false;
            state.hold_started_at = None;
            decide("abort");
            drop(state);
            abort_session(app, "Capture aborted by native abort shortcut.")
        }
        ShortcutState::Released if is_abort => {
            state.abort_active = false;
            decide("armed_for_next_press");
            None
        }
        ShortcutState::Pressed if is_pause => {
            if state.pause_active {
                decide("ignored_already_active");
                return None;
            }
            state.pause_active = true;
            if requires_double_tap(&state) && !double_tap_gate(&mut state, "pause", Instant::now())
            {
                decide("double_tap_armed");
                return None;
            }
            decide("toggle_pause");
            drop(state);
            Some(TriggerEffect::TogglePause)
        }
        ShortcutState::Released if is_pause => {
            state.pause_active = false;
            decide("armed_for_next_press");
            None
        }
        ShortcutState::Pressed if is_hotkey => {
            let now = Instant::now();

            match state.config.activation_mode {
                NativeActivationMode::Tap => {
                    if !begin_tap_press(&mut state) {
                        decide("ignored_key_repeat");
                        return None;
                    }
                    if tap_hotkey_uses_release_trigger(&state) {
                        state.last_tap_shortcut_intent = None;
                        decide("deferred_to_release_modifier_only");
                        return None;
                    }
                    let intent = match resolve_tap_shortcut_intent(
                        &mut state,
                        session_stage,
                        capture_is_recording,
                        now,
                    ) {
                        Some(intent) => intent,
                        None => {
                            decide("debounced");
                            return None;
                        }
                    };

                    decide(tap_intent_decision(intent));
                    drop(state);
                    apply_tap_shortcut_intent(app, intent, capture_is_recording)
                }
                NativeActivationMode::DoubleTap => {
                    if !begin_tap_press(&mut state) {
                        decide("ignored_key_repeat");
                        return None;
                    }
                    if double_tap_uses_release_trigger(&state) {
                        decide("deferred_to_release_modifier_only");
                        return None;
                    }
                    match apply_double_tap_edge(
                        &mut state,
                        session_stage,
                        capture_is_recording,
                        now,
                    ) {
                        Some(intent) => {
                            decide(tap_intent_decision(intent));
                            drop(state);
                            apply_tap_shortcut_intent(app, intent, capture_is_recording)
                        }
                        None => {
                            decide("double_tap_armed");
                            None
                        }
                    }
                }
                NativeActivationMode::Hold => {
                    if state
                        .last_hotkey_press
                        .map(|last| {
                            now.duration_since(last)
                                < Duration::from_millis(state.config.debounce_ms)
                        })
                        .unwrap_or(false)
                    {
                        decide("debounced");
                        return None;
                    }
                    if state.hotkey_active {
                        decide("ignored_already_active");
                        return None;
                    }
                    state.last_hotkey_press = Some(now);
                    state.last_tap_shortcut_intent = None;
                    state.hotkey_active = true;
                    state.hold_session += 1;
                    state.hold_started_at = Some(now);
                    state.hold_release_seen = false;
                    let hold_session = state.hold_session;
                    let watchdog_seconds = state.config.hold_watchdog_seconds;
                    decide("hold_start");
                    drop(state);
                    let effect = start_session(app, "native_hold_hotkey");
                    if effect.is_some() {
                        arm_hold_watchdog(app, hold_session, watchdog_seconds);
                    }
                    effect
                }
            }
        }
        ShortcutState::Released if is_hotkey => {
            // An interrupted hold is not a tap of the trigger: another key went
            // down while it was held, so this was `Shift` on the way to a capital
            // or `Ctrl+Alt` on the way to `Ctrl+Alt+T`. Only the edge-counting
            // modes discard it — hold mode started something on the press edge
            // and still has to end it (ADR 0009).
            if event.interrupted
                && matches!(
                    state.config.activation_mode,
                    NativeActivationMode::Tap | NativeActivationMode::DoubleTap
                )
            {
                end_tap_press(&mut state);
                state.last_tap_shortcut_intent = None;
                decide("ignored_interrupted_chord");
                return None;
            }

            if state.config.activation_mode == NativeActivationMode::DoubleTap {
                end_tap_press(&mut state);
                if !double_tap_uses_release_trigger(&state) {
                    decide("armed_for_next_press");
                    return None;
                }

                let now = Instant::now();
                return match apply_double_tap_edge(
                    &mut state,
                    session_stage,
                    capture_is_recording,
                    now,
                ) {
                    Some(intent) => {
                        decide(tap_intent_decision(intent));
                        drop(state);
                        apply_tap_shortcut_intent(app, intent, capture_is_recording)
                    }
                    None => {
                        decide("double_tap_armed");
                        None
                    }
                };
            }

            if state.config.activation_mode == NativeActivationMode::Tap {
                if !tap_hotkey_uses_release_trigger(&state) {
                    end_tap_press(&mut state);
                    state.last_tap_shortcut_intent = None;
                    decide("armed_for_next_press");
                    return None;
                }

                if !state.tap_hotkey_down {
                    state.last_tap_shortcut_intent = None;
                    decide("ignored_release_without_press");
                    return None;
                }

                end_tap_press(&mut state);
                let now = Instant::now();
                let intent = match resolve_tap_shortcut_intent(
                    &mut state,
                    session_stage,
                    capture_is_recording,
                    now,
                ) {
                    Some(intent) => intent,
                    None => {
                        decide("debounced");
                        return None;
                    }
                };

                decide(tap_intent_decision(intent));
                drop(state);
                return apply_tap_shortcut_intent(app, intent, capture_is_recording);
            }

            state.last_tap_shortcut_intent = None;
            state.hold_release_seen = true;
            if state.config.activation_mode != NativeActivationMode::Hold || !state.hotkey_active {
                decide("ignored_release_without_press");
                return None;
            }
            state.hotkey_active = false;
            let held_for = state
                .hold_started_at
                .map(|start| start.elapsed())
                .unwrap_or_default();
            let min_hold = Duration::from_millis(state.config.hold_min_ms);
            let hold_session = state.hold_session;
            state.hold_started_at = None;

            if held_for >= min_hold {
                decide("hold_stop");
                drop(state);
                stop_session(app, active_capture_is_recording(app))
            } else {
                decide("hold_stop_deferred_below_hold_min");
                Some(TriggerEffect::DeferredStop {
                    hold_session,
                    delay_ms: (min_hold - held_for).as_millis().min(u128::from(u64::MAX)) as u64,
                })
            }
        }
        _ => {
            decide("ignored");
            None
        }
    }
}

fn tap_intent_decision(intent: TapShortcutIntent) -> &'static str {
    match intent {
        TapShortcutIntent::Start => "start",
        TapShortcutIntent::Stop => "stop",
        TapShortcutIntent::Ignore => "ignored_processing",
    }
}

/// Counts and timestamps what the OS actually delivered for one binding. The
/// press/release ratio is the evidence that decides whether hold to talk can
/// work in this session — on Linux a passive X11 grab may deliver a press but
/// never the matching release depending on which client holds focus (D11).
fn record_binding_observation(state: &mut NativeTriggerState, label: &str, event: ShortcutState) {
    let now = now_ms();
    if let Some(binding) = state
        .bindings
        .iter_mut()
        .find(|binding| binding.label == label)
    {
        match event {
            ShortcutState::Pressed => {
                binding.presses += 1;
                binding.last_press_ms = Some(now);
            }
            ShortcutState::Released => {
                binding.releases += 1;
                binding.last_release_ms = Some(now);
            }
        }
    }
}

/// Ends a hold whose `Released` event never arrived, with a stated reason
/// instead of letting it drift into the silence timeout or the maximum-length
/// cap (T10). `0` seconds disables the watchdog.
fn arm_hold_watchdog<R: Runtime>(app: &AppHandle<R>, hold_session: u64, watchdog_seconds: u64) {
    if watchdog_seconds == 0 {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(watchdog_seconds)).await;

        let Some(trigger_state) = app.try_state::<Mutex<NativeTriggerState>>() else {
            return;
        };
        let stranded = {
            let Ok(mut state) = trigger_state.lock() else {
                return;
            };
            let stranded = state.config.activation_mode == NativeActivationMode::Hold
                && state.hold_session == hold_session
                && state.hotkey_active
                && !state.hold_release_seen;
            if stranded {
                state.hotkey_active = false;
                state.hold_started_at = None;
            }
            stranded
        };

        if !stranded {
            return;
        }

        log_trigger(
            "hold_watchdog",
            &[
                ("hold_session", hold_session.to_string()),
                ("after_seconds", watchdog_seconds.to_string()),
                ("outcome", "release_missing".to_string()),
            ],
        );

        if let Some(effect) = stop_session(&app, active_capture_is_recording(&app)) {
            crate::apply_trigger_effect(&app, effect);
        }
    });
}

pub fn resolve_deferred_hold_stop<R: Runtime>(
    app: &AppHandle<R>,
    hold_session: u64,
) -> Option<TriggerEffect> {
    let trigger_state = app.try_state::<Mutex<NativeTriggerState>>()?;
    let state = trigger_state.lock().ok()?;
    if state.hold_session == hold_session
        && state.config.activation_mode == NativeActivationMode::Hold
    {
        drop(state);
        stop_session(app, active_capture_is_recording(app))
    } else {
        None
    }
}

fn start_session<R: Runtime>(app: &AppHandle<R>, trigger: &str) -> Option<TriggerEffect> {
    match super::sessions::start_from_native(app, trigger) {
        Ok(_) => Some(TriggerEffect::StartCapture),
        Err(error) => {
            super::sessions::fail_from_native_error(app, &error);
            None
        }
    }
}

fn stop_session<R: Runtime>(
    app: &AppHandle<R>,
    capture_is_recording: bool,
) -> Option<TriggerEffect> {
    match super::sessions::processing_or_recover_from_native(
        app,
        capture_is_recording,
        "native_capture_recovery",
    ) {
        Ok(status) => status
            .active_session_id
            .map(|session_id| TriggerEffect::StopCapture { session_id }),
        Err(error) => {
            super::sessions::fail_from_native_error(app, &error);
            None
        }
    }
}

fn abort_session<R: Runtime>(app: &AppHandle<R>, reason: &str) -> Option<TriggerEffect> {
    match super::sessions::abort_from_native(app, reason) {
        Ok(_) => Some(TriggerEffect::AbortCapture),
        Err(error) => {
            super::sessions::fail_from_native_error(app, &error);
            None
        }
    }
}

/// Registers one capture-side binding, records the outcome per shortcut in the
/// runtime log and appends the resulting truth row. A failure here is fatal for
/// the whole registration call — the capture triggers are the lane's contract,
/// unlike mode hotkeys which degrade individually.
fn register_binding<R: Runtime>(
    app: &AppHandle<R>,
    bindings: &mut Vec<BindingInfo>,
    label: &str,
    role: &str,
    binding: &RegisteredShortcutBinding,
) -> Result<(), String> {
    let mut info = BindingInfo::new(label, role, &binding.display, &binding.human);

    for shortcut in &binding.shortcuts {
        match app.global_shortcut().register(*shortcut) {
            Ok(()) => log_trigger(
                "register",
                &[
                    ("binding", label.to_string()),
                    ("shortcut", binding.display.clone()),
                    ("id", shortcut.id().to_string()),
                    ("outcome", "ok".to_string()),
                ],
            ),
            Err(error) => {
                let reason = registration_failure_reason(&binding.human, &error.to_string());
                log_trigger(
                    "register",
                    &[
                        ("binding", label.to_string()),
                        ("shortcut", binding.display.clone()),
                        ("id", shortcut.id().to_string()),
                        ("outcome", "error".to_string()),
                        ("error", error.to_string()),
                    ],
                );
                info.error = Some(reason.clone());
                bindings.push(info);
                return Err(reason);
            }
        }
    }

    info.registered = true;
    bindings.push(info);
    Ok(())
}

/// Turns a raw backend error into something a user can act on. The vendored
/// crate does not distinguish "reserved by the desktop" from "already grabbed",
/// so the message names both possibilities rather than guessing (T8).
fn registration_failure_reason(display: &str, error: &str) -> String {
    format!(
        "'{display}' could not be registered with the operating system — it is most likely already \
         taken by the desktop or another application. Choose a different combination. ({error})"
    )
}

fn collect_unique_shortcuts(
    target: &mut Vec<Shortcut>,
    known_ids: &mut Vec<u32>,
    shortcuts: &[Shortcut],
) {
    for shortcut in shortcuts {
        let shortcut_id = shortcut.id();
        if !known_ids.contains(&shortcut_id) {
            known_ids.push(shortcut_id);
            target.push(*shortcut);
        }
    }
}

fn active_session_stage<R: Runtime>(app: &AppHandle<R>) -> Option<NativeSessionStage> {
    let session_state = app.try_state::<Mutex<NativeSessionState>>()?;
    let session_state = session_state.lock().ok()?;
    Some(session_state.status().stage)
}

fn active_capture_is_recording<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Some(capture_state) = app.try_state::<Mutex<NativeCaptureState>>() else {
        return false;
    };

    capture_state
        .lock()
        .map(|state| state.is_recording())
        .unwrap_or(false)
}

fn tap_shortcut_intent(
    stage: Option<NativeSessionStage>,
    capture_is_recording: bool,
) -> TapShortcutIntent {
    if capture_is_recording {
        return TapShortcutIntent::Stop;
    }

    match stage {
        Some(NativeSessionStage::Capturing) => TapShortcutIntent::Stop,
        Some(NativeSessionStage::Processing) => TapShortcutIntent::Ignore,
        _ => TapShortcutIntent::Start,
    }
}

fn should_debounce_tap_press(
    last_press: Option<Instant>,
    debounce_ms: u64,
    last_intent: Option<TapShortcutIntent>,
    next_intent: TapShortcutIntent,
    now: Instant,
) -> bool {
    last_press
        .map(|last| now.duration_since(last) < Duration::from_millis(debounce_ms))
        .unwrap_or(false)
        && last_intent == Some(next_intent)
}

fn resolve_tap_shortcut_intent(
    state: &mut NativeTriggerState,
    session_stage: Option<NativeSessionStage>,
    capture_is_recording: bool,
    now: Instant,
) -> Option<TapShortcutIntent> {
    let intent = tap_shortcut_intent(session_stage, capture_is_recording);
    if should_debounce_tap_press(
        state.last_hotkey_press,
        state.config.debounce_ms,
        state.last_tap_shortcut_intent,
        intent,
        now,
    ) {
        return None;
    }

    state.last_hotkey_press = Some(now);
    state.last_tap_shortcut_intent = Some(intent);

    match intent {
        TapShortcutIntent::Stop => {
            state.toggled_on = false;
            state.hotkey_active = false;
        }
        TapShortcutIntent::Ignore => {}
        TapShortcutIntent::Start => {
            state.toggled_on = true;
            state.hotkey_active = true;
        }
    }

    Some(intent)
}

fn apply_tap_shortcut_intent<R: Runtime>(
    app: &AppHandle<R>,
    intent: TapShortcutIntent,
    capture_is_recording: bool,
) -> Option<TriggerEffect> {
    match intent {
        TapShortcutIntent::Stop => stop_session(app, capture_is_recording),
        TapShortcutIntent::Ignore => None,
        TapShortcutIntent::Start => start_session(app, "native_tap_hotkey"),
    }
}

fn tap_hotkey_uses_release_trigger(state: &NativeTriggerState) -> bool {
    state.config.activation_mode == NativeActivationMode::Tap
        && is_modifier_only_shortcut(&state.config.hotkey)
}

/// Double-tap counts the same edge tap mode acts on: the release for a
/// modifier-only shortcut (there is no "press" that is distinguishable from
/// holding a modifier), the press otherwise — which is also the more reliably
/// delivered edge on Linux.
fn double_tap_uses_release_trigger(state: &NativeTriggerState) -> bool {
    is_modifier_only_shortcut(&state.config.hotkey)
}

/// Handles one trigger edge in double-tap mode. Returns `None` while waiting
/// for the second tap, and the resolved intent once it arrives.
fn apply_double_tap_edge(
    state: &mut NativeTriggerState,
    session_stage: Option<NativeSessionStage>,
    capture_is_recording: bool,
    now: Instant,
) -> Option<TapShortcutIntent> {
    if !double_tap_gate(state, "capture", now) {
        return None;
    }

    {
        // The second tap is the deliberate one, so the debounce that protects
        // tap mode from key repeat must not swallow it.
        state.last_tap_shortcut_intent = None;
        state.last_hotkey_press = None;
        resolve_tap_shortcut_intent(state, session_stage, capture_is_recording, now)
    }
}

/// Returns true when this edge is the second tap of a double tap and the
/// binding should act. The first tap is remembered and swallowed — that is what
/// leaves a single press to the rest of the desktop.
fn double_tap_gate(state: &mut NativeTriggerState, label: &str, now: Instant) -> bool {
    let window = Duration::from_millis(state.config.double_tap_window_ms);
    let previous = state.double_tap_edges.get(label).copied();

    match resolve_double_tap(previous, window, now) {
        DoubleTapOutcome::Armed => {
            state.double_tap_edges.insert(label.to_string(), now);
            false
        }
        DoubleTapOutcome::Fired => {
            state.double_tap_edges.remove(label);
            true
        }
    }
}

/// Whether this binding must see two taps before it acts. Applies to the three
/// capture-lane triggers only; mode hotkeys stay single-press, where a stray
/// activation costs a mode switch rather than a lost or unwanted recording.
fn requires_double_tap(state: &NativeTriggerState) -> bool {
    state.config.activation_mode == NativeActivationMode::DoubleTap
}

fn begin_tap_press(state: &mut NativeTriggerState) -> bool {
    if state.tap_hotkey_down {
        return false;
    }

    state.tap_hotkey_down = true;
    true
}

fn end_tap_press(state: &mut NativeTriggerState) {
    state.tap_hotkey_down = false;
}

fn sync_trigger_state_with_session(
    state: &mut NativeTriggerState,
    stage: Option<NativeSessionStage>,
) {
    let is_capturing = matches!(stage, Some(NativeSessionStage::Capturing));
    state.toggled_on = is_capturing;
    if !is_capturing {
        state.hotkey_active = false;
        state.hold_started_at = None;
        state.last_tap_shortcut_intent = None;
    }
}

/// Builds an OS binding from a raw shortcut value. All token knowledge,
/// display strings and validity rules live in `core::shortcut` — this layer
/// only turns the parse result into something registerable and rejects the
/// empty value, which is meaningful ("disabled") for mode hotkeys but not for
/// a slot that is about to be registered.
fn build_shortcut_binding(
    input: &str,
    allow_modifier_only: bool,
) -> Result<RegisteredShortcutBinding, String> {
    let policy = shortcut::session_policy(allow_modifier_only);

    match shortcut::parse(input, policy)? {
        shortcut::ShortcutParse::Disabled => Err("Shortcut must not be empty.".to_string()),
        shortcut::ShortcutParse::Valid(parsed) => Ok(RegisteredShortcutBinding {
            display: parsed.canonical.clone(),
            human: parsed.display.clone(),
            shortcuts: parsed.shortcuts.clone(),
        }),
    }
}

pub fn normalize_shortcut(input: &str, allow_modifier_only: bool) -> Result<String, String> {
    build_shortcut_binding(input, allow_modifier_only).map(|binding| binding.display)
}

fn is_modifier_only_shortcut(value: &str) -> bool {
    matches!(
        shortcut::parse(value, shortcut::Policy::default()),
        Ok(shortcut::ShortcutParse::Valid(ref parsed)) if parsed.modifier_only
    )
}

// The defaults live in `core::config` and are used from there. A second copy
// here is how the two layers drifted apart in the first place.
fn default_hotkey() -> String {
    super::config::default_hotkey().to_string()
}

fn default_abort_hotkey() -> String {
    super::config::default_abort_hotkey().to_string()
}

fn default_pause_hotkey() -> String {
    super::config::default_pause_hotkey().to_string()
}

fn default_activation_mode() -> &'static str {
    super::config::default_activation_mode()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri_plugin_global_shortcut::{Code, Modifiers};

    #[test]
    fn normalizes_legacy_hotkey_names() {
        assert_eq!(normalize_shortcut("ctrl_l+f9", true).unwrap(), "Ctrl+F9");
        assert_eq!(
            normalize_shortcut("ctrl_l, alt_l, escape", false).unwrap(),
            "Ctrl+Alt+Escape"
        );
    }

    #[test]
    fn allows_modifier_only_start_shortcuts() {
        let binding = build_shortcut_binding("ctrl_l+win", true).unwrap();
        assert_eq!(binding.display, "Ctrl+Super");
        assert_eq!(binding.shortcuts.len(), 2);
        assert!(binding
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::SUPER), Code::ControlLeft)));
        assert!(binding
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::CONTROL), Code::MetaLeft)));
    }

    #[test]
    fn rejects_modifier_only_secondary_shortcuts() {
        assert!(normalize_shortcut("ctrl_l+win", false).is_err());
        assert!(normalize_shortcut("ctrl_l+alt_l", false).is_err());
    }

    #[test]
    fn allows_modifier_only_pause_and_abort_shortcuts() {
        let pause = build_shortcut_binding("ctrl_l+alt_l", true).unwrap();
        let abort = build_shortcut_binding("shift_l+win", true).unwrap();
        assert!(pause
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::CONTROL), Code::AltLeft)));
        assert!(pause
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::ALT), Code::ControlLeft)));
        assert!(abort
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::SHIFT), Code::MetaLeft)));
        assert!(abort
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::SUPER), Code::ShiftLeft)));
    }

    #[test]
    fn rejects_empty_shortcut() {
        assert!(normalize_shortcut(" ", true).is_err());
    }

    #[test]
    fn a_single_bare_modifier_follows_the_session_capability() {
        // D2 rejected a lone modifier because it expanded into a grab with no
        // modifier at all, swallowing every Ctrl press on the desktop. Both
        // reasons for the blanket rule are gone (observation, then the
        // interruption signal — ADR 0009), so what is left is a session
        // property. The assertion has to follow the same helper the runtime
        // does, or it would pass on one machine and fail on another.
        let interruption_reported =
            shortcut::session_has_interruption_signal(shortcut::shortcut_platform().kind);

        assert_eq!(build_shortcut_binding("ctrl_l", true).is_ok(), interruption_reported);
        assert_eq!(build_shortcut_binding("win", true).is_ok(), interruption_reported);

        // What no session ever allows: a bare letter, and a modifier-only value
        // in a slot that forbids modifier-only at all.
        assert!(build_shortcut_binding("a", true).is_err());
        assert!(build_shortcut_binding("ctrl_l+alt_l", false).is_err());
    }

    #[test]
    fn binding_carries_both_canonical_and_human_forms() {
        let binding = build_shortcut_binding("ctrl_l+f9", true).unwrap();
        assert_eq!(binding.display, "Ctrl+F9");
        assert_eq!(binding.human, "Ctrl + F9");
    }

    #[test]
    fn tap_hotkey_follows_real_session_stage() {
        assert_eq!(
            tap_shortcut_intent(Some(NativeSessionStage::Capturing), false),
            TapShortcutIntent::Stop
        );
        assert_eq!(
            tap_shortcut_intent(Some(NativeSessionStage::Processing), false),
            TapShortcutIntent::Ignore
        );
        assert_eq!(
            tap_shortcut_intent(Some(NativeSessionStage::Completed), false),
            TapShortcutIntent::Start
        );
        assert_eq!(tap_shortcut_intent(None, false), TapShortcutIntent::Start);
        assert_eq!(
            tap_shortcut_intent(Some(NativeSessionStage::Idle), true),
            TapShortcutIntent::Stop
        );
    }

    #[test]
    fn debounce_allows_fast_switch_from_start_to_stop() {
        let now = Instant::now();

        assert!(should_debounce_tap_press(
            Some(now),
            300,
            Some(TapShortcutIntent::Start),
            TapShortcutIntent::Start,
            now + Duration::from_millis(120),
        ));

        assert!(!should_debounce_tap_press(
            Some(now),
            300,
            Some(TapShortcutIntent::Start),
            TapShortcutIntent::Stop,
            now + Duration::from_millis(120),
        ));
    }

    #[test]
    fn tap_press_ignores_duplicate_pressed_events_until_release() {
        let mut state = NativeTriggerState::default();

        assert!(begin_tap_press(&mut state));
        assert!(!begin_tap_press(&mut state));

        end_tap_press(&mut state);

        assert!(begin_tap_press(&mut state));
    }

    #[test]
    fn detects_modifier_only_shortcuts() {
        assert!(is_modifier_only_shortcut("Ctrl+Super"));
        assert!(is_modifier_only_shortcut("Ctrl+Alt+Shift"));
        assert!(!is_modifier_only_shortcut("Ctrl+F9"));
        assert!(!is_modifier_only_shortcut("Ctrl+Space"));
    }

    #[test]
    fn mode_hotkeys_entries_skips_empty_and_preserves_order() {
        let hotkeys = ModeHotkeys {
            picker: "Ctrl+Alt+M".to_string(),
            auto: "Ctrl+F6".to_string(),
            verbatim: "Ctrl+F1".to_string(),
            cleanup: String::new(),
            rewrite: String::new(),
            agent: String::new(),
            prompt_enhance: String::new(),
        };

        let entries = hotkeys.entries();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0], ("mode_picker", "Ctrl+Alt+M"));
        assert_eq!(entries[1], ("auto", "Ctrl+F6"));
        assert_eq!(entries[2], ("verbatim", "Ctrl+F1"));
    }

    #[test]
    fn mode_hotkeys_for_mode_returns_correct_field() {
        let hotkeys = ModeHotkeys {
            picker: String::new(),
            auto: "A".to_string(),
            verbatim: "V".to_string(),
            cleanup: "C".to_string(),
            rewrite: "R".to_string(),
            agent: "G".to_string(),
            prompt_enhance: "P".to_string(),
        };

        assert_eq!(hotkeys.for_mode(ProcessingMode::Auto), "A");
        assert_eq!(hotkeys.for_mode(ProcessingMode::Verbatim), "V");
        assert_eq!(hotkeys.for_mode(ProcessingMode::Cleanup), "C");
        assert_eq!(hotkeys.for_mode(ProcessingMode::Rewrite), "R");
        assert_eq!(hotkeys.for_mode(ProcessingMode::Agent), "G");
        assert_eq!(hotkeys.for_mode(ProcessingMode::PromptEnhance), "P");
    }

    #[test]
    fn mode_hotkeys_all_empty_yields_no_entries() {
        let hotkeys = ModeHotkeys::default();
        assert!(hotkeys.entries().is_empty());
    }

    #[test]
    fn native_trigger_status_reports_registered_mode_hotkeys() {
        let mut state = NativeTriggerState::default();
        state
            .registered_mode_hotkeys
            .insert("mode_picker".to_string(), "Ctrl+Alt+M".to_string());
        state
            .registered_mode_hotkeys
            .insert("agent".to_string(), "Ctrl+Alt+5".to_string());

        let status = state.status();
        assert_eq!(status.registered_mode_hotkeys.len(), 2);
        assert!(status
            .registered_mode_hotkeys
            .iter()
            .any(|h| h.label == "mode_picker" && h.display == "Ctrl+Alt+M"));
        assert!(status
            .registered_mode_hotkeys
            .iter()
            .any(|h| h.label == "agent" && h.display == "Ctrl+Alt+5"));
    }

    #[test]
    fn activation_mode_parses_every_spelling() {
        assert_eq!(NativeActivationMode::from_config("tap"), NativeActivationMode::Tap);
        assert_eq!(NativeActivationMode::from_config("hold"), NativeActivationMode::Hold);
        for value in ["double_tap", "doubleTap", "DOUBLE", " double_tap "] {
            assert_eq!(
                NativeActivationMode::from_config(value),
                NativeActivationMode::DoubleTap,
                "'{value}' should parse as double tap"
            );
        }
        // Anything unknown stays on the safe, well-understood default.
        assert_eq!(NativeActivationMode::from_config("wobble"), NativeActivationMode::Tap);
    }

    #[test]
    fn a_single_tap_never_fires_in_double_tap_mode() {
        // This is the whole point: a lone Ctrl+Alt must not act, so
        // Ctrl+Alt+T keeps opening a terminal without also triggering
        // WordScript.
        let now = Instant::now();
        assert_eq!(
            resolve_double_tap(None, Duration::from_millis(400), now),
            DoubleTapOutcome::Armed
        );
    }

    #[test]
    fn two_taps_inside_the_window_fire() {
        let first = Instant::now();
        assert_eq!(
            resolve_double_tap(
                Some(first),
                Duration::from_millis(400),
                first + Duration::from_millis(180),
            ),
            DoubleTapOutcome::Fired
        );
    }

    #[test]
    fn two_taps_outside_the_window_only_rearm() {
        let first = Instant::now();
        assert_eq!(
            resolve_double_tap(
                Some(first),
                Duration::from_millis(400),
                first + Duration::from_millis(900),
            ),
            DoubleTapOutcome::Armed
        );
    }

    #[test]
    fn double_tap_toggles_start_then_stop() {
        let mut state = NativeTriggerState::new(NativeTriggerConfig {
            hotkey: "Ctrl+Alt".to_string(),
            activation_mode: NativeActivationMode::DoubleTap,
            ..NativeTriggerConfig::default()
        });

        let t0 = Instant::now();
        // First tap arms only.
        assert!(apply_double_tap_edge(&mut state, None, false, t0).is_none());
        // Second tap inside the window starts the capture.
        assert_eq!(
            apply_double_tap_edge(&mut state, None, false, t0 + Duration::from_millis(150)),
            Some(TapShortcutIntent::Start)
        );

        // While capturing, the next double tap stops it.
        let t1 = t0 + Duration::from_secs(5);
        assert!(apply_double_tap_edge(
            &mut state,
            Some(NativeSessionStage::Capturing),
            true,
            t1
        )
        .is_none());
        assert_eq!(
            apply_double_tap_edge(
                &mut state,
                Some(NativeSessionStage::Capturing),
                true,
                t1 + Duration::from_millis(150),
            ),
            Some(TapShortcutIntent::Stop)
        );
    }

    #[test]
    fn a_slow_second_tap_rearms_instead_of_firing() {
        let mut state = NativeTriggerState::new(NativeTriggerConfig {
            hotkey: "Ctrl+Alt".to_string(),
            activation_mode: NativeActivationMode::DoubleTap,
            ..NativeTriggerConfig::default()
        });

        let t0 = Instant::now();
        assert!(apply_double_tap_edge(&mut state, None, false, t0).is_none());
        assert!(apply_double_tap_edge(
            &mut state,
            None,
            false,
            t0 + Duration::from_millis(900)
        )
        .is_none());
        // …but the tap after that one is within the window of the re-arm.
        assert_eq!(
            apply_double_tap_edge(
                &mut state,
                None,
                false,
                t0 + Duration::from_millis(900 + 150),
            ),
            Some(TapShortcutIntent::Start)
        );
    }

    #[test]
    fn each_binding_keeps_its_own_double_tap_window() {
        // Abort and pause must not consume each other's first tap, and a tap on
        // one must not complete a double tap on the other.
        let mut state = NativeTriggerState::new(NativeTriggerConfig {
            activation_mode: NativeActivationMode::DoubleTap,
            ..NativeTriggerConfig::default()
        });

        let t0 = Instant::now();
        assert!(!double_tap_gate(&mut state, "abort", t0));
        assert!(!double_tap_gate(&mut state, "pause", t0 + Duration::from_millis(50)));

        // Each completes only with its own second tap.
        assert!(double_tap_gate(&mut state, "abort", t0 + Duration::from_millis(100)));
        assert!(double_tap_gate(&mut state, "pause", t0 + Duration::from_millis(150)));

        // And both are disarmed again afterwards.
        assert!(!double_tap_gate(&mut state, "abort", t0 + Duration::from_secs(5)));
    }

    #[test]
    fn double_tap_applies_to_the_capture_lane_only_when_the_mode_is_selected() {
        for (mode, expected) in [
            (NativeActivationMode::Tap, false),
            (NativeActivationMode::Hold, false),
            (NativeActivationMode::DoubleTap, true),
        ] {
            let state = NativeTriggerState::new(NativeTriggerConfig {
                activation_mode: mode.clone(),
                ..NativeTriggerConfig::default()
            });
            assert_eq!(
                requires_double_tap(&state),
                expected,
                "unexpected gate for {mode:?}"
            );
        }
    }

    #[test]
    fn double_tap_uses_the_release_edge_only_for_modifier_only_shortcuts() {
        let modifier_only = NativeTriggerState::new(NativeTriggerConfig {
            hotkey: "Ctrl+Alt".to_string(),
            activation_mode: NativeActivationMode::DoubleTap,
            ..NativeTriggerConfig::default()
        });
        let with_key = NativeTriggerState::new(NativeTriggerConfig {
            hotkey: "Ctrl+F9".to_string(),
            activation_mode: NativeActivationMode::DoubleTap,
            ..NativeTriggerConfig::default()
        });

        assert!(double_tap_uses_release_trigger(&modifier_only));
        // A real key gives us the press edge, which is the more reliably
        // delivered one on Linux.
        assert!(!double_tap_uses_release_trigger(&with_key));
    }

    #[test]
    fn binding_observations_count_presses_and_releases_separately() {
        // The evidence D11/T10 depend on: a binding that reports presses but no
        // releases is a hold mode that cannot work in this session.
        let mut state = NativeTriggerState::default();
        state
            .bindings
            .push(BindingInfo::new("capture", "capture", "Ctrl+F9", "Ctrl + F9"));

        record_binding_observation(&mut state, "capture", ShortcutState::Pressed);
        record_binding_observation(&mut state, "capture", ShortcutState::Pressed);
        record_binding_observation(&mut state, "capture", ShortcutState::Released);

        let binding = &state.bindings[0];
        assert_eq!(binding.presses, 2);
        assert_eq!(binding.releases, 1);
        assert!(binding.last_press_ms.is_some());
        assert!(binding.last_release_ms.is_some());
    }

    #[test]
    fn observations_for_an_unknown_binding_are_dropped_without_panicking() {
        let mut state = NativeTriggerState::default();
        record_binding_observation(&mut state, "unbound", ShortcutState::Pressed);
        assert!(state.bindings.is_empty());
    }

    #[test]
    fn decision_lines_name_binding_state_mode_and_outcome() {
        let line = describe_trigger_decision(
            "capture",
            ShortcutState::Pressed,
            &NativeActivationMode::Hold,
            "hold_start",
        );
        assert_eq!(
            line,
            "binding=capture state=pressed mode=hold decision=hold_start"
        );
    }

    #[test]
    fn status_exposes_the_timing_constants_the_ui_has_to_state() {
        let state = NativeTriggerState::default();
        let status = state.status();
        assert_eq!(status.hold_min_ms, DEFAULT_HOLD_MIN_MS);
        assert_eq!(status.debounce_ms, DEFAULT_DEBOUNCE_MS);
        assert_eq!(status.hold_watchdog_seconds, DEFAULT_HOLD_WATCHDOG_SECONDS);
        assert!(!status.suspended);
    }

    #[test]
    fn currently_registered_shortcuts_covers_capture_and_mode_grabs() {
        // What suspend has to release (T4). A soft `paused` flag left all of
        // these grabbed, so the recorder never saw the keys.
        let mut state = NativeTriggerState::default();
        state.registered_hotkey = Some("Ctrl+F9".to_string());
        state.registered_pause_hotkey = Some("Ctrl+F10".to_string());
        state.registered_abort_hotkey = Some("Ctrl+Alt+Escape".to_string());
        state
            .registered_mode_hotkeys
            .insert("mode_picker".to_string(), "Ctrl+Alt+M".to_string());

        let shortcuts = currently_registered_shortcuts(&state);
        assert_eq!(shortcuts.len(), 4);

        let ids: Vec<u32> = shortcuts.iter().map(Shortcut::id).collect();
        let mut unique = ids.clone();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(ids.len(), unique.len(), "shortcuts must be deduplicated");
    }

    #[test]
    fn mode_hotkeys_are_read_from_the_persisted_config() {
        // Regression: `configure_native_trigger` used to preserve the mode
        // hotkeys from in-memory state, so a value changed in Settings was
        // saved but never re-registered — the grab kept firing on the value
        // from the last startup and mode select appeared dead whatever you
        // assigned.
        let config = AppConfig {
            mode_picker_hotkey: "Ctrl+S".to_string(),
            mode_auto_hotkey: "Ctrl+1".to_string(),
            mode_verbatim_hotkey: "Ctrl+2".to_string(),
            mode_cleanup_hotkey: "Ctrl+3".to_string(),
            mode_rewrite_hotkey: "Ctrl+4".to_string(),
            mode_agent_hotkey: "Ctrl+5".to_string(),
            mode_prompt_enhance_hotkey: "Ctrl+6".to_string(),
            ..AppConfig::default()
        };

        let hotkeys = ModeHotkeys::from_app_config(&config);

        assert_eq!(hotkeys.picker, "Ctrl+S");
        assert_eq!(hotkeys.auto, "Ctrl+1");
        assert_eq!(hotkeys.verbatim, "Ctrl+2");
        assert_eq!(hotkeys.cleanup, "Ctrl+3");
        assert_eq!(hotkeys.rewrite, "Ctrl+4");
        assert_eq!(hotkeys.agent, "Ctrl+5");
        assert_eq!(hotkeys.prompt_enhance, "Ctrl+6");
        assert_eq!(hotkeys.entries().len(), 7);
    }

    #[test]
    fn mode_hotkeys_all_slots_includes_disabled_ones() {
        let hotkeys = ModeHotkeys {
            picker: "Ctrl+Alt+M".to_string(),
            ..ModeHotkeys::default()
        };

        let slots = hotkeys.all_slots();
        assert_eq!(slots.len(), 7);
        assert_eq!(slots[0], ("mode_picker", "Ctrl+Alt+M"));
        assert!(slots.iter().filter(|(_, value)| value.is_empty()).count() == 6);
    }

    #[test]
    fn registration_failure_reason_names_the_shortcut_and_the_likely_cause() {
        let reason = registration_failure_reason("Ctrl + F9", "HotKey already registered");
        assert!(reason.contains("Ctrl + F9"));
        assert!(reason.contains("already"));
    }

    #[test]
    fn trigger_effect_mode_variants_are_debug_reachable() {
        // Smoke test: the new variants construct and match without panic.
        let select = TriggerEffect::ModeSelect;
        let direct = TriggerEffect::SetModeDirect(ProcessingMode::Agent);

        match select {
            TriggerEffect::ModeSelect => {}
            _ => panic!("expected ModeSelect"),
        }
        match direct {
            TriggerEffect::SetModeDirect(ProcessingMode::Agent) => {}
            _ => panic!("expected SetModeDirect(Agent)"),
        }
    }
}
