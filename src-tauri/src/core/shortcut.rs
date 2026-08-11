use std::str::FromStr;

use serde::{Deserialize, Serialize};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

/// Single owner of the shortcut contract: token vocabulary, canonical storage
/// form, human display strings and validity rules. Both the config layer and
/// the trigger layer parse through this module, and the UI receives the same
/// vocabulary over `shortcut_vocabulary` instead of carrying a second key
/// table. Every token this module accepts is registerable — asserted in
/// `vocabulary_tokens_are_registerable`.

/// Modifier tokens in canonical order. `Super` covers Win / Cmd / Meta.
pub const MODIFIER_TOKENS: [&str; 4] = ["Ctrl", "Alt", "Shift", "Super"];

/// How many modifiers a modifier-only shortcut needs (T3).
///
/// Originally two, because a single part expanded to a grab with no modifier at
/// all — the desktop-wide bare-modifier grab of D2. Since modifier-only
/// shortcuts are observed rather than grabbed (ADR 0009) that is no longer the
/// reason. It stays two because the lane cannot distinguish a deliberate tap of
/// a modifier from the same modifier pressed while typing; see
/// `build_modifier_only` for the full reasoning and what would lift it.
pub const MODIFIER_ONLY_MINIMUM: usize = 2;

/// Canonical key tokens grouped by class. The names are the browser
/// `event.code` values wherever the vendored `global-hotkey` parser accepts
/// them, which lets the recorder send `event.code` unchanged.
pub const LETTER_TOKENS: [&str; 26] = [
    "KeyA", "KeyB", "KeyC", "KeyD", "KeyE", "KeyF", "KeyG", "KeyH", "KeyI", "KeyJ", "KeyK", "KeyL",
    "KeyM", "KeyN", "KeyO", "KeyP", "KeyQ", "KeyR", "KeyS", "KeyT", "KeyU", "KeyV", "KeyW", "KeyX",
    "KeyY", "KeyZ",
];

pub const DIGIT_TOKENS: [&str; 10] = [
    "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8",
    "Digit9",
];

pub const FUNCTION_TOKENS: [&str; 24] = [
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "F13", "F14", "F15",
    "F16", "F17", "F18", "F19", "F20", "F21", "F22", "F23", "F24",
];

pub const EDITING_TOKENS: [&str; 12] = [
    "Space",
    "Enter",
    "Tab",
    "Backspace",
    "Escape",
    "Insert",
    "Delete",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "CapsLock",
];

pub const NAVIGATION_TOKENS: [&str; 4] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

pub const PUNCTUATION_TOKENS: [&str; 11] = [
    "Backquote",
    "Minus",
    "Equal",
    "BracketLeft",
    "BracketRight",
    "Backslash",
    "Semicolon",
    "Quote",
    "Comma",
    "Period",
    "Slash",
];

pub const NUMPAD_TOKENS: [&str; 17] = [
    "Numpad0",
    "Numpad1",
    "Numpad2",
    "Numpad3",
    "Numpad4",
    "Numpad5",
    "Numpad6",
    "Numpad7",
    "Numpad8",
    "Numpad9",
    "NumpadAdd",
    "NumpadSubtract",
    "NumpadMultiply",
    "NumpadDivide",
    "NumpadDecimal",
    "NumpadEnter",
    "NumLock",
];

pub const SYSTEM_TOKENS: [&str; 3] = ["PrintScreen", "ScrollLock", "Pause"];

/// Policy for a single shortcut slot. Capture triggers and mode hotkeys share
/// the same rules today; the struct exists so a future per-slot difference does
/// not reintroduce two rule sets.
#[derive(Debug, Clone, Copy)]
pub struct Policy {
    /// Whether a shortcut made only of modifiers may be used at all.
    pub allow_modifier_only: bool,
    /// Whether this session can tell a deliberate tap of a modifier apart from
    /// the same modifier pressed while typing. True only where the platform
    /// delivers an interruption signal with the observed key edges (ADR 0009);
    /// without it a single modifier would fire during ordinary text entry, so it
    /// stays rejected and two modifiers remain the minimum.
    ///
    /// Deliberately `false` in `Default`, so every call site that means the real
    /// session has to say so — and so the rule under test never depends on the
    /// machine the test runs on.
    pub interruption_signal: bool,
}

impl Default for Policy {
    fn default() -> Self {
        Self {
            allow_modifier_only: true,
            interruption_signal: false,
        }
    }
}

/// Whether the current session delivers the interruption signal that makes a
/// single modifier distinguishable from typing. Linux routes modifier-only
/// shortcuts through XInput2 raw events and reports it; Windows and macOS still
/// grab or drop them entirely, so they do not (see
/// `docs/known-issues/cross-platform-shortcut-verification.md`).
pub fn session_has_interruption_signal(kind: SessionKind) -> bool {
    matches!(kind, SessionKind::LinuxX11 | SessionKind::LinuxXWayland)
}

/// The policy for the current session. The one place that turns platform facts
/// into validation rules, so config normalization, the trigger layer and the
/// UI's inline validation cannot disagree about what is allowed.
pub fn session_policy(allow_modifier_only: bool) -> Policy {
    Policy {
        allow_modifier_only,
        interruption_signal: session_has_interruption_signal(shortcut_platform().kind),
    }
}

/// How the OS delivers a registered shortcut, which decides whether the key is
/// still available to the rest of the desktop (ADR 0009).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Delivery {
    /// A passive grab. The key is delivered to WordScript instead of the focused
    /// window, so the combination is taken from every other application. Correct
    /// for a shortcut with a real key: `Ctrl+F9` should not also type into the
    /// editor underneath.
    Grab,
    /// A non-consuming observation of the raw key stream. The keystroke still
    /// reaches the focused window. Used for modifier-only shortcuts, where a grab
    /// would stop the modifier from doing its ordinary job.
    Observe,
}

impl Delivery {
    /// Derived from the shortcut itself, not from configuration: a modifier as
    /// the main key is observed, anything else is grabbed. The platform layer
    /// applies the same rule, so the two cannot disagree.
    fn for_shortcut(modifier_only: bool) -> Self {
        if modifier_only {
            Self::Observe
        } else {
            Self::Grab
        }
    }

    pub fn as_token(self) -> &'static str {
        match self {
            Self::Grab => "grab",
            Self::Observe => "observe",
        }
    }
}

/// A shortcut that parsed successfully.
#[derive(Debug, Clone)]
pub struct ParsedShortcut {
    /// Storage form, e.g. `Ctrl+Alt+KeyM`. Idempotent under re-parsing.
    pub canonical: String,
    /// Human form shown in the UI, e.g. `Ctrl + Alt + M`.
    pub display: String,
    /// OS-level bindings. More than one only for modifier-only shortcuts,
    /// where each part is registered as the main key of the remaining set.
    pub shortcuts: Vec<Shortcut>,
    /// True when the shortcut consists of modifiers only. Such a shortcut acts
    /// on key release rather than press, which the trigger state machine has to
    /// know about.
    pub modifier_only: bool,
    /// Whether the OS delivers this shortcut by grabbing the key or by observing
    /// it. Decides whether the key stays available to other applications.
    pub delivery: Delivery,
    /// Non-blocking caveat the UI must show, e.g. a bare function key that is
    /// grabbed globally.
    pub warning: Option<String>,
}

/// Result of parsing a shortcut slot. An empty value is a deliberate
/// "disabled", never an error and never a silent fallback to a default.
#[derive(Debug, Clone)]
pub enum ShortcutParse {
    Disabled,
    Valid(Box<ParsedShortcut>),
}

impl ShortcutParse {
    pub fn canonical(&self) -> &str {
        match self {
            Self::Disabled => "",
            Self::Valid(parsed) => parsed.canonical.as_str(),
        }
    }

    pub fn parsed(&self) -> Option<&ParsedShortcut> {
        match self {
            Self::Disabled => None,
            Self::Valid(parsed) => Some(parsed),
        }
    }
}

/// Parses a raw shortcut string into the canonical contract form.
///
/// Accepts the canonical form (`Ctrl+F9`), browser `event.code` names
/// (`ControlLeft+KeyM`), the platform words for a modifier (`cmd`, `win`),
/// common key abbreviations (`esc`, `pgup`) and comma separators. Rejects
/// anything that could not be registered, and anything the contract forbids
/// (single bare modifier, bare letter or digit).
///
/// **This is a boundary, and its tolerance is a feature** — a shortcut arrives
/// from the recorder, from an IPC payload and from a hand-edited config, none
/// of which is this build's own writing. What went with ADR 0112 is the one
/// dialect that was: pynput's `ctrl_l`, produced only by the removed sidecar.
pub fn parse(input: &str, policy: Policy) -> Result<ShortcutParse, String> {
    let raw_parts = input
        .split(['+', ','])
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();

    if raw_parts.is_empty() {
        return Ok(ShortcutParse::Disabled);
    }

    let mut modifiers: Vec<&'static str> = Vec::new();
    let mut key: Option<&'static str> = None;

    for part in raw_parts {
        if let Some(modifier) = normalize_modifier_token(part) {
            if !modifiers.contains(&modifier) {
                modifiers.push(modifier);
            }
            continue;
        }

        let token = normalize_key_token(part)
            .ok_or_else(|| format!("'{part}' is not a key WordScript can register."))?;
        if let Some(existing) = key {
            if existing != token {
                return Err(
                    "A shortcut may contain only one non-modifier key. Remove one of them."
                        .to_string(),
                );
            }
            continue;
        }
        key = Some(token);
    }

    modifiers.sort_by_key(|modifier| {
        MODIFIER_TOKENS
            .iter()
            .position(|candidate| candidate == modifier)
            .unwrap_or(usize::MAX)
    });

    let parsed = match key {
        Some(token) => build_with_key(&modifiers, token, policy)?,
        None => build_modifier_only(&modifiers, policy)?,
    };

    Ok(ShortcutParse::Valid(Box::new(parsed)))
}

fn build_with_key(
    modifiers: &[&'static str],
    key: &'static str,
    _policy: Policy,
) -> Result<ParsedShortcut, String> {
    if modifiers.is_empty() && (is_letter_token(key) || is_digit_token(key)) {
        return Err(format!(
            "'{}' alone would be grabbed from every application on this desktop. \
             Add at least one modifier such as Ctrl or Alt.",
            display_key(key)
        ));
    }

    let canonical = canonical_string(modifiers, Some(key));
    let shortcut = Shortcut::from_str(&canonical)
        .map_err(|error| format!("Could not register '{canonical}': {error}"))?;

    let warning = (modifiers.is_empty() && is_function_token(key)).then(|| {
        format!(
            "{} is registered globally without a modifier — every press anywhere on the desktop reaches WordScript.",
            display_key(key)
        )
    });

    Ok(ParsedShortcut {
        display: display_string(modifiers, Some(key)),
        canonical,
        shortcuts: vec![shortcut],
        modifier_only: false,
        delivery: Delivery::for_shortcut(false),
        warning,
    })
}

fn build_modifier_only(
    modifiers: &[&'static str],
    policy: Policy,
) -> Result<ParsedShortcut, String> {
    if !policy.allow_modifier_only {
        return Err("This shortcut must include a non-modifier key.".to_string());
    }

    // Two reasons have been retired here, and the history is worth keeping
    // straight because each retirement was earned by a mechanism change:
    //
    // 1. Originally: a single part expanded to a grab with no modifier at all,
    //    taking that key from the whole desktop (D2). Retired by observation
    //    (ADR 0009) — an observed key is not taken from anyone.
    // 2. Then: nothing separated a deliberate tap from the `Shift` pressed to
    //    type a capital. Retired by the interruption signal, which reports
    //    whether another key went down while the trigger was held.
    //
    // What is left is a platform question, not a rule: where the session cannot
    // report interruption, a single modifier really would fire during ordinary
    // typing, so it stays rejected there.
    let minimum = if policy.interruption_signal {
        1
    } else {
        MODIFIER_ONLY_MINIMUM
    };

    if modifiers.len() < minimum {
        return Err(format!(
            "A single {modifier} needs this session to report when another key interrupts the \
             hold, and it does not. Without that, {modifier} pressed to type a capital cannot be \
             told apart from a deliberate tap, so the trigger would fire while typing. Use at \
             least two modifiers, or add a key.",
            modifier = modifiers.first().copied().unwrap_or("modifier")
        ));
    }

    // Each part is registered once as the main key, with the remaining parts as
    // modifiers, so the combination fires whichever modifier is pressed last.
    // Every one of these has a modifier as its main key, so the platform layer
    // observes them instead of grabbing them (ADR 0009) — which is what keeps the
    // combination available to the rest of the desktop.
    let mut shortcuts = Vec::with_capacity(modifiers.len());
    for (index, main) in modifiers.iter().enumerate() {
        let rest = modifiers
            .iter()
            .enumerate()
            .filter_map(|(other, token)| (other != index).then_some(*token))
            .collect::<Vec<_>>();
        let mods = rest
            .iter()
            .try_fold(Modifiers::empty(), |acc, token| {
                modifier_flag(token).map(|flag| acc | flag)
            })?;
        // A single modifier is the one case that produces a binding with no
        // modifier at all. That used to be forbidden outright, because it meant a
        // bare grab; it is safe now precisely because such a binding is observed
        // rather than grabbed (ADR 0009), and it is only reachable when the
        // session reports interruption.
        debug_assert!(!mods.is_empty() || modifiers.len() == 1);
        shortcuts.push(Shortcut::new(
            (!mods.is_empty()).then_some(mods),
            modifier_code(main)?,
        ));
    }

    Ok(ParsedShortcut {
        canonical: canonical_string(modifiers, None),
        display: display_string(modifiers, None),
        shortcuts,
        modifier_only: true,
        delivery: Delivery::for_shortcut(true),
        warning: None,
    })
}

/// Canonicalizes a stored value without failing: an unparsable value is
/// returned trimmed and unchanged so the UI can surface it as "not
/// registerable" instead of the config layer silently rewriting it.
pub fn normalize_for_storage(value: &str, policy: Policy) -> String {
    match parse(value, policy) {
        Ok(parse) => parse.canonical().to_string(),
        Err(_) => value.trim().to_string(),
    }
}

/// Human display for a stored value, falling back to the raw value when it
/// cannot be parsed.
pub fn display_for(value: &str, policy: Policy) -> String {
    match parse(value, policy) {
        Ok(ShortcutParse::Valid(parsed)) => parsed.display,
        Ok(ShortcutParse::Disabled) => String::new(),
        Err(_) => value.trim().to_string(),
    }
}

fn canonical_string(modifiers: &[&'static str], key: Option<&'static str>) -> String {
    modifiers
        .iter()
        .map(|modifier| (*modifier).to_string())
        .chain(key.map(canonical_key))
        .collect::<Vec<_>>()
        .join("+")
}

/// Storage spelling of a key token. Letters and digits keep the short form the
/// shortcut parser and every previously persisted config already use (`M`,
/// `4`); every other key is stored under its `event.code` name. Both spellings
/// parse back to the same token, so this stays idempotent.
fn canonical_key(token: &'static str) -> String {
    if let Some(letter) = token.strip_prefix("Key") {
        return letter.to_string();
    }
    if let Some(digit) = token.strip_prefix("Digit") {
        return digit.to_string();
    }
    token.to_string()
}

fn display_string(modifiers: &[&'static str], key: Option<&'static str>) -> String {
    modifiers
        .iter()
        .map(|modifier| display_modifier(modifier).to_string())
        .chain(key.map(|token| display_key(token).to_string()))
        .collect::<Vec<_>>()
        .join(" + ")
}

fn display_modifier(token: &str) -> &str {
    match token {
        "Super" if cfg!(target_os = "macos") => "Cmd",
        "Super" if cfg!(target_os = "windows") => "Win",
        "Alt" if cfg!(target_os = "macos") => "Option",
        other => other,
    }
}

/// Human label for a key token. Letters and digits lose their `event.code`
/// prefix; everything else is spaced out for readability.
pub fn display_key(token: &str) -> String {
    if let Some(letter) = token.strip_prefix("Key") {
        return letter.to_string();
    }
    if let Some(digit) = token.strip_prefix("Digit") {
        return digit.to_string();
    }
    match token {
        "ArrowUp" => "Up".to_string(),
        "ArrowDown" => "Down".to_string(),
        "ArrowLeft" => "Left".to_string(),
        "ArrowRight" => "Right".to_string(),
        "PageUp" => "Page Up".to_string(),
        "PageDown" => "Page Down".to_string(),
        "CapsLock" => "Caps Lock".to_string(),
        "NumLock" => "Num Lock".to_string(),
        "ScrollLock" => "Scroll Lock".to_string(),
        "PrintScreen" => "Print Screen".to_string(),
        "Backquote" => "`".to_string(),
        "Minus" => "-".to_string(),
        "Equal" => "=".to_string(),
        "BracketLeft" => "[".to_string(),
        "BracketRight" => "]".to_string(),
        "Backslash" => "\\".to_string(),
        "Semicolon" => ";".to_string(),
        "Quote" => "'".to_string(),
        "Comma" => ",".to_string(),
        "Period" => ".".to_string(),
        "Slash" => "/".to_string(),
        other if other.starts_with("Numpad") => {
            format!("Num {}", other.trim_start_matches("Numpad"))
        }
        other => other.to_string(),
    }
}

/// Maps any accepted spelling of a modifier onto its canonical token.
///
/// The plain word, the platform word and the browser `event.code` — the three
/// forms that reach this function from a live surface. The pynput dialect
/// (`ctrl_l`, `alt_r`, `shift_l`) went with ADR 0112: it was written by the
/// Python sidecar, the sidecar is gone (ADR 0091), and no config outside this
/// machine ever carried it.
fn normalize_modifier_token(part: &str) -> Option<&'static str> {
    match part.to_ascii_lowercase().as_str() {
        "ctrl" | "control" | "controlleft" | "controlright" => Some("Ctrl"),
        "alt" | "option" | "altleft" | "altright" => Some("Alt"),
        "shift" | "shiftleft" | "shiftright" => Some("Shift"),
        "win" | "cmd" | "command" | "super" | "meta" | "metaleft" | "metaright" | "oskey" => {
            Some("Super")
        }
        _ => None,
    }
}

/// Maps any accepted spelling of a non-modifier key onto its canonical token.
/// Covers common abbreviations, bare characters and browser `event.code`.
pub fn normalize_key_token(part: &str) -> Option<&'static str> {
    let lower = part.trim().to_ascii_lowercase();

    if lower.len() == 1 {
        let ch = lower.chars().next()?;
        if ch.is_ascii_alphabetic() {
            return LETTER_TOKENS
                .get((ch as u8 - b'a') as usize)
                .copied();
        }
        if ch.is_ascii_digit() {
            return DIGIT_TOKENS.get((ch as u8 - b'0') as usize).copied();
        }
    }

    let aliased = match lower.as_str() {
        "esc" => "escape",
        "return" => "enter",
        "del" => "delete",
        "ins" => "insert",
        "pgup" | "prior" => "pageup",
        "pgdn" | "next" => "pagedown",
        "up" => "arrowup",
        "down" => "arrowdown",
        "left" => "arrowleft",
        "right" => "arrowright",
        "`" => "backquote",
        "-" => "minus",
        "=" => "equal",
        "[" => "bracketleft",
        "]" => "bracketright",
        "\\" => "backslash",
        ";" => "semicolon",
        "'" => "quote",
        "," => "comma",
        "." => "period",
        "/" => "slash",
        other => other,
    };

    all_key_tokens()
        .into_iter()
        .find(|token| token.to_ascii_lowercase() == aliased)
}

fn all_key_tokens() -> Vec<&'static str> {
    LETTER_TOKENS
        .iter()
        .chain(DIGIT_TOKENS.iter())
        .chain(FUNCTION_TOKENS.iter())
        .chain(EDITING_TOKENS.iter())
        .chain(NAVIGATION_TOKENS.iter())
        .chain(PUNCTUATION_TOKENS.iter())
        .chain(NUMPAD_TOKENS.iter())
        .chain(SYSTEM_TOKENS.iter())
        .copied()
        .collect()
}

fn is_letter_token(token: &str) -> bool {
    LETTER_TOKENS.contains(&token)
}

fn is_digit_token(token: &str) -> bool {
    DIGIT_TOKENS.contains(&token)
}

fn is_function_token(token: &str) -> bool {
    FUNCTION_TOKENS.contains(&token)
}

fn modifier_flag(token: &str) -> Result<Modifiers, String> {
    match token {
        "Ctrl" => Ok(Modifiers::CONTROL),
        "Alt" => Ok(Modifiers::ALT),
        "Shift" => Ok(Modifiers::SHIFT),
        "Super" => Ok(Modifiers::SUPER),
        _ => Err(format!("Unsupported shortcut modifier '{token}'.")),
    }
}

fn modifier_code(token: &str) -> Result<Code, String> {
    match token {
        "Ctrl" => Ok(Code::ControlLeft),
        "Alt" => Ok(Code::AltLeft),
        "Shift" => Ok(Code::ShiftLeft),
        "Super" => Ok(Code::MetaLeft),
        _ => Err(format!("Unsupported shortcut modifier '{token}'.")),
    }
}

// ── Frontend contract ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct VocabularyGroup {
    pub label: String,
    pub tokens: Vec<VocabularyToken>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VocabularyToken {
    pub token: String,
    pub display: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShortcutVocabulary {
    /// Canonical modifier tokens in the order a chord is rendered.
    pub modifiers: Vec<VocabularyToken>,
    /// Browser `event.code` values that map onto a modifier token.
    pub modifier_codes: Vec<(String, String)>,
    /// Every registerable non-modifier key, grouped for display.
    pub key_groups: Vec<VocabularyGroup>,
    /// Minimum number of modifiers a modifier-only shortcut needs.
    pub modifier_only_minimum: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShortcutValidation {
    pub ok: bool,
    pub disabled: bool,
    pub canonical: String,
    pub display: String,
    /// True when the shortcut is built from modifiers only. Such a shortcut
    /// acts on key release and, in tap mode, on every single press — which is
    /// what makes double-tap activation worth offering for it.
    pub modifier_only: bool,
    /// How the OS would deliver this shortcut: `grab` takes the key from every
    /// other application, `observe` leaves it available (ADR 0009). The UI states
    /// this instead of leaving the consequence invisible.
    pub delivery: Option<&'static str>,
    pub reason: Option<String>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ValidateShortcutRequest {
    pub value: String,
    #[serde(default = "default_allow_modifier_only")]
    pub allow_modifier_only: bool,
}

fn default_allow_modifier_only() -> bool {
    true
}

/// Validates a candidate shortcut for the UI. Never persists and never
/// registers — this is the inline feedback path for the recorder and for
/// manual entry (T5).
#[tauri::command]
pub fn validate_shortcut(request: ValidateShortcutRequest) -> ShortcutValidation {
    let policy = session_policy(request.allow_modifier_only);

    match parse(&request.value, policy) {
        Ok(ShortcutParse::Disabled) => ShortcutValidation {
            ok: true,
            disabled: true,
            canonical: String::new(),
            display: String::new(),
            modifier_only: false,
            delivery: None,
            reason: None,
            warning: None,
        },
        Ok(ShortcutParse::Valid(parsed)) => ShortcutValidation {
            ok: true,
            disabled: false,
            canonical: parsed.canonical,
            display: parsed.display,
            modifier_only: parsed.modifier_only,
            delivery: Some(parsed.delivery.as_token()),
            reason: None,
            warning: parsed.warning,
        },
        Err(reason) => ShortcutValidation {
            ok: false,
            disabled: false,
            canonical: String::new(),
            display: String::new(),
            modifier_only: false,
            delivery: None,
            reason: Some(reason),
            warning: None,
        },
    }
}

/// Exposes the runtime's own token vocabulary so the UI needs no second key
/// table (T2). Every token returned here is registerable.
#[tauri::command]
pub fn shortcut_vocabulary() -> ShortcutVocabulary {
    let group = |label: &str, tokens: &[&'static str]| VocabularyGroup {
        label: label.to_string(),
        tokens: tokens
            .iter()
            .map(|token| VocabularyToken {
                token: (*token).to_string(),
                display: display_key(token),
            })
            .collect(),
    };

    ShortcutVocabulary {
        modifiers: MODIFIER_TOKENS
            .iter()
            .map(|token| VocabularyToken {
                token: (*token).to_string(),
                display: display_modifier(token).to_string(),
            })
            .collect(),
        modifier_codes: [
            "ControlLeft",
            "ControlRight",
            "AltLeft",
            "AltRight",
            "ShiftLeft",
            "ShiftRight",
            "MetaLeft",
            "MetaRight",
        ]
        .iter()
        .filter_map(|code| {
            normalize_modifier_token(code).map(|token| ((*code).to_string(), token.to_string()))
        })
        .collect(),
        key_groups: vec![
            group("Letters", &LETTER_TOKENS),
            group("Digits", &DIGIT_TOKENS),
            group("Function keys", &FUNCTION_TOKENS),
            group("Editing", &EDITING_TOKENS),
            group("Navigation", &NAVIGATION_TOKENS),
            group("Punctuation", &PUNCTUATION_TOKENS),
            group("Numpad", &NUMPAD_TOKENS),
            group("System", &SYSTEM_TOKENS),
        ],
        modifier_only_minimum: MODIFIER_ONLY_MINIMUM,
    }
}

/// The row of the capability matrix (T12) this process is running in. Every
/// branch that differs per platform selects on this instead of on scattered
/// `cfg!` checks, which is what keeps the matrix assertable in tests.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionKind {
    Windows,
    MacOs,
    /// Linux on a real X11 session.
    LinuxX11,
    /// Linux on a Wayland session with the app on XWayland (X11 passive grabs).
    LinuxXWayland,
    /// Linux on a Wayland session with the app as a native Wayland client.
    LinuxNativeWayland,
}

/// What the current session can actually honor, named honestly at the point
/// where the user chooses a shortcut (T8). Nothing here guesses: it reports
/// the session facts and the consequences that follow from them.
#[derive(Debug, Clone, Serialize)]
pub struct ShortcutPlatform {
    /// Which matrix row this session is.
    pub kind: SessionKind,
    /// One-line summary, e.g. "KDE Plasma 6 · Wayland session, app on XWayland".
    pub summary: String,
    /// Whether global shortcuts can be registered at all in this session.
    pub global_shortcuts_available: bool,
    /// Keys the desktop consumes before the app can see them in a recorder.
    pub keys_the_desktop_swallows: Vec<String>,
    /// Constraints the user should know before picking a shortcut.
    pub notes: Vec<String>,
}

/// Reports how global shortcuts behave in the current session.
#[tauri::command]
pub fn shortcut_platform() -> ShortcutPlatform {
    if cfg!(target_os = "macos") {
        return ShortcutPlatform {
            kind: SessionKind::MacOs,
            summary: "macOS".to_string(),
            global_shortcuts_available: true,
            keys_the_desktop_swallows: Vec::new(),
            notes: vec![
                "Low-level key observation needs Accessibility and Input Monitoring permission. \
                 Without them a shortcut can register and still never fire."
                    .to_string(),
            ],
        };
    }

    if cfg!(target_os = "windows") {
        return ShortcutPlatform {
            kind: SessionKind::Windows,
            summary: "Windows".to_string(),
            global_shortcuts_available: true,
            keys_the_desktop_swallows: vec!["Win + L".to_string(), "Ctrl + Alt + Delete".to_string()],
            notes: Vec::new(),
        };
    }

    let compositor = super::portal::detect_compositor();
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
    let native_wayland = std::env::var("WORDSCRIPT_NATIVE_WAYLAND")
        .map(|value| value == "1")
        .unwrap_or(false);

    let mut notes = Vec::new();
    let mut swallowed = Vec::new();

    let backend = if native_wayland {
        "native Wayland"
    } else {
        "XWayland (X11 grabs)"
    };

    let kind = if native_wayland {
        SessionKind::LinuxNativeWayland
    } else if session_type == "wayland" {
        SessionKind::LinuxXWayland
    } else {
        SessionKind::LinuxX11
    };

    let summary = if session_type.is_empty() {
        format!("{} · {backend}", compositor.label())
    } else {
        format!("{} · {session_type} session, app on {backend}", compositor.label())
    };

    let global_shortcuts_available = !native_wayland;

    if native_wayland {
        notes.push(
            "A native Wayland session has no unprivileged global-shortcut API. WordScript would \
             need the org.freedesktop.portal.GlobalShortcuts portal, which this build does not \
             implement — global shortcuts are unavailable here. Restart without \
             WORDSCRIPT_NATIVE_WAYLAND=1 to use the XWayland path."
                .to_string(),
        );
    } else if session_type == "wayland" {
        notes.push(
            "Global shortcuts are X11 passive grabs delivered through XWayland. Whether a grab is \
             honored can depend on which client currently holds keyboard focus, so a shortcut may \
             work while an X11 application is focused and not while a native Wayland one is."
                .to_string(),
        );
    }

    if matches!(
        compositor,
        super::portal::CompositorKind::KdePlasma5 | super::portal::CompositorKind::KdePlasma6
    ) {
        swallowed.push("Super".to_string());
        notes.push(
            "KWin consumes Meta / Super before the focused window sees it, so the recorder cannot \
             capture it. Use manual entry to assign a Super combination deliberately."
                .to_string(),
        );
    }

    ShortcutPlatform {
        kind,
        summary,
        global_shortcuts_available,
        keys_the_desktop_swallows: swallowed,
        notes,
    }
}

/// What the current session has actually delivered for the configured capture
/// shortcut. This is measured, not assumed: the trigger lane counts every
/// press and release it receives (T11), and the ratio is the only honest input
/// to the question whether hold to talk can work here (T10, D11).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReleaseEvidence {
    /// The shortcut has not been pressed yet in this session, so nothing is
    /// known either way. Deliberately not the same as "works".
    Unobserved,
    /// Presses arrived and at least one matching release did too.
    ReleaseObserved,
    /// Presses arrived and no release ever did — the stranded hold of D11.
    ReleaseMissing,
}

impl ReleaseEvidence {
    pub fn from_counters(presses: u64, releases: u64) -> Self {
        if presses == 0 {
            Self::Unobserved
        } else if releases == 0 {
            Self::ReleaseMissing
        } else {
            Self::ReleaseObserved
        }
    }
}

/// Whether the current session can honor one capability. `Conditional` is a
/// deliberate third state: it means "registerable, with a consequence the user
/// has to know", which is different from both "fine" and "cannot work". The
/// previous UI had only the first two and therefore had to guess.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityState {
    Available,
    Conditional,
    Unavailable,
}

/// One row of the matrix: a capability, its state in this session and the
/// reason, phrased for the user. The UI renders `state` and `reason` and
/// derives neither (ADR 0006).
#[derive(Debug, Clone, Serialize)]
pub struct Capability {
    /// Stable id the UI matches on: an activation mode (`tap`, `double_tap`,
    /// `hold`) or a key class (`letters_digits`, `function_keys`,
    /// `modifier_only`, `super_meta`).
    pub id: String,
    pub label: String,
    pub state: CapabilityState,
    pub reason: Option<String>,
}

impl Capability {
    fn new(id: &str, label: &str, state: CapabilityState, reason: Option<String>) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
            state,
            reason,
        }
    }
}

/// The per-OS capability matrix (T12, S7). One documented derivation drives
/// which options the UI offers and what the tests assert, instead of each
/// surface re-deciding what this platform can do.
#[derive(Debug, Clone, Serialize)]
pub struct ShortcutCapabilities {
    pub session: SessionKind,
    pub summary: String,
    pub global_shortcuts_available: bool,
    /// The evidence the activation-mode row was derived from, exposed so the UI
    /// can be explicit about *why* an option is in the state it is in.
    pub release_evidence: ReleaseEvidence,
    pub activation_modes: Vec<Capability>,
    pub key_classes: Vec<Capability>,
}

/// Why a hold might not deliver its release on this specific session type.
/// Appended to the evidence sentence rather than replacing it — the session
/// fact is a plausible cause, the counters are the actual finding.
fn hold_delivery_caveat(kind: SessionKind) -> Option<&'static str> {
    match kind {
        SessionKind::LinuxXWayland => Some(
            "Delivery goes through an X11 passive grab on XWayland, where whether the release \
             arrives can depend on which client holds keyboard focus.",
        ),
        SessionKind::MacOs => Some(
            "Low-level key observation needs Accessibility and Input Monitoring permission; \
             without them a shortcut can register and still never report a release.",
        ),
        SessionKind::Windows | SessionKind::LinuxX11 | SessionKind::LinuxNativeWayland => None,
    }
}

fn with_caveat(sentence: String, caveat: Option<&str>) -> Option<String> {
    Some(match caveat {
        Some(caveat) => format!("{sentence} {caveat}"),
        None => sentence,
    })
}

/// Derives the capability matrix from the session facts plus the release
/// evidence this session produced. Pure on purpose: `shortcut_platform()`
/// collects the facts once, and every matrix branch is unit-testable without a
/// desktop (T12).
pub fn capability_matrix(
    platform: &ShortcutPlatform,
    evidence: ReleaseEvidence,
) -> ShortcutCapabilities {
    let no_global_api =
        "This session has no global-shortcut API, so no shortcut can fire outside the app window."
            .to_string();

    if !platform.global_shortcuts_available {
        let unavailable = |id: &str, label: &str| {
            Capability::new(
                id,
                label,
                CapabilityState::Unavailable,
                Some(no_global_api.clone()),
            )
        };

        return ShortcutCapabilities {
            session: platform.kind,
            summary: platform.summary.clone(),
            global_shortcuts_available: false,
            release_evidence: evidence,
            activation_modes: vec![
                unavailable("tap", "Tap to toggle"),
                unavailable("double_tap", "Double tap to toggle"),
                unavailable("hold", "Hold to talk"),
            ],
            key_classes: vec![
                unavailable("letters_digits", "Letters and digits"),
                unavailable("function_keys", "Function keys"),
                unavailable("modifier_only", "Modifier-only"),
                unavailable("super_meta", "Super / Meta"),
            ],
        };
    }

    let caveat = hold_delivery_caveat(platform.kind);
    let hold = match evidence {
        ReleaseEvidence::ReleaseObserved => Capability::new(
            "hold",
            "Hold to talk",
            CapabilityState::Available,
            Some(
                "Key releases have been observed for this shortcut in this session."
                    .to_string(),
            ),
        ),
        ReleaseEvidence::ReleaseMissing => Capability::new(
            "hold",
            "Hold to talk",
            CapabilityState::Unavailable,
            with_caveat(
                "This session received presses of this shortcut and no key release, so a hold \
                 would start and never stop on release — the watchdog would have to end every \
                 one. Use tap or double tap."
                    .to_string(),
                caveat,
            ),
        ),
        ReleaseEvidence::Unobserved => Capability::new(
            "hold",
            "Hold to talk",
            CapabilityState::Conditional,
            with_caveat(
                "Whether the key release arrives has not been observed yet in this session — \
                 press the shortcut once to find out."
                    .to_string(),
                caveat,
            ),
        ),
    };

    let super_swallowed = platform
        .keys_the_desktop_swallows
        .iter()
        .any(|key| key.eq_ignore_ascii_case("super") || key.eq_ignore_ascii_case("meta"));

    ShortcutCapabilities {
        session: platform.kind,
        summary: platform.summary.clone(),
        global_shortcuts_available: true,
        release_evidence: evidence,
        activation_modes: vec![
            Capability::new("tap", "Tap to toggle", CapabilityState::Available, None),
            Capability::new(
                "double_tap",
                "Double tap to toggle",
                CapabilityState::Available,
                None,
            ),
            hold,
        ],
        key_classes: vec![
            Capability::new(
                "letters_digits",
                "Letters and digits",
                CapabilityState::Available,
                Some(
                    "Registerable with at least one modifier. A bare letter or digit is rejected \
                     because it would be grabbed from every application on this desktop."
                        .to_string(),
                ),
            ),
            Capability::new(
                "function_keys",
                "Function keys",
                CapabilityState::Conditional,
                Some(
                    "Registerable with or without a modifier, but a bare function key is a \
                     desktop-wide grab — it is accepted with a stated warning, not silently."
                        .to_string(),
                ),
            ),
            Capability::new(
                "modifier_only",
                "Modifier-only",
                CapabilityState::Available,
                Some(format!(
                    "Allowed from {} modifiers upward, and observed rather than grabbed — the \
                     combination stays available to other applications, so a trigger like \
                     Ctrl+Super does not stop Ctrl+Super+other-key from working elsewhere. A \
                     single bare modifier is still rejected: it would fire on ordinary typing, \
                     because nothing distinguishes a deliberate tap from the Shift you press to \
                     type a capital.",
                    MODIFIER_ONLY_MINIMUM
                )),
            ),
            Capability::new(
                "super_meta",
                "Super / Meta",
                if super_swallowed {
                    CapabilityState::Conditional
                } else {
                    CapabilityState::Available
                },
                if super_swallowed {
                    Some(
                        "The desktop consumes Super before the focused window sees it, so the \
                         recorder cannot capture it. Assign a Super combination through manual \
                         entry."
                            .to_string(),
                    )
                } else {
                    None
                },
            ),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid(input: &str) -> ParsedShortcut {
        match parse(input, Policy::default()).expect("shortcut should parse") {
            ShortcutParse::Valid(parsed) => *parsed,
            ShortcutParse::Disabled => panic!("expected a shortcut, got disabled"),
        }
    }

    /// Builds one matrix row's input without a desktop, which is what makes
    /// every per-platform branch assertable (T12).
    fn session(kind: SessionKind) -> ShortcutPlatform {
        let (summary, global, swallowed) = match kind {
            SessionKind::Windows => ("Windows", true, vec!["Win + L".to_string()]),
            SessionKind::MacOs => ("macOS", true, Vec::new()),
            SessionKind::LinuxX11 => ("KDE Plasma 6 · x11 session", true, vec!["Super".to_string()]),
            SessionKind::LinuxXWayland => (
                "KDE Plasma 6 · wayland session, app on XWayland (X11 grabs)",
                true,
                vec!["Super".to_string()],
            ),
            SessionKind::LinuxNativeWayland => (
                "KDE Plasma 6 · wayland session, app on native Wayland",
                false,
                Vec::new(),
            ),
        };

        ShortcutPlatform {
            kind,
            summary: summary.to_string(),
            global_shortcuts_available: global,
            keys_the_desktop_swallows: swallowed,
            notes: Vec::new(),
        }
    }

    fn capability<'a>(list: &'a [Capability], id: &str) -> &'a Capability {
        list.iter()
            .find(|capability| capability.id == id)
            .unwrap_or_else(|| panic!("capability '{id}' missing from the matrix"))
    }

    const ALL_SESSIONS: [SessionKind; 5] = [
        SessionKind::Windows,
        SessionKind::MacOs,
        SessionKind::LinuxX11,
        SessionKind::LinuxXWayland,
        SessionKind::LinuxNativeWayland,
    ];

    #[test]
    fn release_evidence_reads_the_counters_and_nothing_else() {
        assert_eq!(
            ReleaseEvidence::from_counters(0, 0),
            ReleaseEvidence::Unobserved
        );
        // Releases without presses is not evidence of a working release either;
        // it is a state the lane should never reach, and it must not read as
        // "hold works".
        assert_eq!(
            ReleaseEvidence::from_counters(0, 4),
            ReleaseEvidence::Unobserved
        );
        assert_eq!(
            ReleaseEvidence::from_counters(3, 0),
            ReleaseEvidence::ReleaseMissing
        );
        assert_eq!(
            ReleaseEvidence::from_counters(3, 3),
            ReleaseEvidence::ReleaseObserved
        );
    }

    #[test]
    fn every_session_reports_all_matrix_rows() {
        // T12 is one matrix, not per-platform ad-hoc lists: the UI must be able
        // to look up the same ids everywhere.
        for kind in ALL_SESSIONS {
            let matrix = capability_matrix(&session(kind), ReleaseEvidence::Unobserved);
            assert_eq!(matrix.session, kind);
            let modes: Vec<&str> = matrix
                .activation_modes
                .iter()
                .map(|capability| capability.id.as_str())
                .collect();
            assert_eq!(modes, vec!["tap", "double_tap", "hold"]);
            let classes: Vec<&str> = matrix
                .key_classes
                .iter()
                .map(|capability| capability.id.as_str())
                .collect();
            assert_eq!(
                classes,
                vec![
                    "letters_digits",
                    "function_keys",
                    "modifier_only",
                    "super_meta"
                ]
            );
        }
    }

    #[test]
    fn a_session_without_a_global_shortcut_api_offers_nothing() {
        let matrix = capability_matrix(
            &session(SessionKind::LinuxNativeWayland),
            ReleaseEvidence::ReleaseObserved,
        );

        assert!(!matrix.global_shortcuts_available);
        for capability in matrix.activation_modes.iter().chain(&matrix.key_classes) {
            assert_eq!(
                capability.state,
                CapabilityState::Unavailable,
                "'{}' must not be offered without a global-shortcut API",
                capability.id
            );
            assert!(capability.reason.is_some(), "'{}' needs a reason", capability.id);
        }
    }

    #[test]
    fn tap_and_double_tap_are_available_wherever_grabs_exist() {
        for kind in ALL_SESSIONS {
            let platform = session(kind);
            if !platform.global_shortcuts_available {
                continue;
            }
            let matrix = capability_matrix(&platform, ReleaseEvidence::ReleaseMissing);
            assert_eq!(
                capability(&matrix.activation_modes, "tap").state,
                CapabilityState::Available
            );
            assert_eq!(
                capability(&matrix.activation_modes, "double_tap").state,
                CapabilityState::Available
            );
        }
    }

    #[test]
    fn hold_follows_the_evidence_not_the_platform() {
        // The point of S0: no platform is assumed to deliver a release, and no
        // platform is assumed not to. The counters decide (T10, D11).
        for kind in ALL_SESSIONS {
            let platform = session(kind);
            if !platform.global_shortcuts_available {
                continue;
            }

            let unobserved = capability_matrix(&platform, ReleaseEvidence::Unobserved);
            assert_eq!(
                capability(&unobserved.activation_modes, "hold").state,
                CapabilityState::Conditional,
                "{kind:?} must not claim hold works before a release was seen"
            );

            let observed = capability_matrix(&platform, ReleaseEvidence::ReleaseObserved);
            assert_eq!(
                capability(&observed.activation_modes, "hold").state,
                CapabilityState::Available
            );

            let missing = capability_matrix(&platform, ReleaseEvidence::ReleaseMissing);
            assert_eq!(
                capability(&missing.activation_modes, "hold").state,
                CapabilityState::Unavailable,
                "{kind:?} must stop offering hold once a release went missing"
            );
        }
    }

    #[test]
    fn hold_names_the_session_specific_delivery_risk() {
        let xwayland = capability_matrix(
            &session(SessionKind::LinuxXWayland),
            ReleaseEvidence::Unobserved,
        );
        let reason = capability(&xwayland.activation_modes, "hold")
            .reason
            .clone()
            .expect("hold needs a reason");
        assert!(reason.contains("XWayland"), "{reason}");
        assert!(reason.contains("keyboard focus"), "{reason}");

        let macos = capability_matrix(&session(SessionKind::MacOs), ReleaseEvidence::Unobserved);
        let reason = capability(&macos.activation_modes, "hold")
            .reason
            .clone()
            .expect("hold needs a reason");
        assert!(reason.contains("Input Monitoring"), "{reason}");

        // Where there is no known session-specific cause, none is invented.
        let x11 = capability_matrix(&session(SessionKind::LinuxX11), ReleaseEvidence::Unobserved);
        let reason = capability(&x11.activation_modes, "hold")
            .reason
            .clone()
            .expect("hold needs a reason");
        assert!(!reason.contains("XWayland"), "{reason}");
        assert!(!reason.contains("Input Monitoring"), "{reason}");
    }

    #[test]
    fn a_release_that_never_arrived_is_stated_as_the_reason() {
        let matrix = capability_matrix(
            &session(SessionKind::LinuxXWayland),
            ReleaseEvidence::ReleaseMissing,
        );
        let reason = capability(&matrix.activation_modes, "hold")
            .reason
            .clone()
            .expect("hold needs a reason");
        assert!(reason.contains("no key release"), "{reason}");
        assert!(reason.contains("watchdog"), "{reason}");
    }

    #[test]
    fn super_is_conditional_only_where_the_desktop_swallows_it() {
        let kde = capability_matrix(
            &session(SessionKind::LinuxXWayland),
            ReleaseEvidence::Unobserved,
        );
        let super_meta = capability(&kde.key_classes, "super_meta");
        assert_eq!(super_meta.state, CapabilityState::Conditional);
        assert!(
            super_meta
                .reason
                .as_deref()
                .unwrap_or_default()
                .contains("manual entry"),
            "the alternative has to be named at the point of failure (T8)"
        );

        let macos = capability_matrix(&session(SessionKind::MacOs), ReleaseEvidence::Unobserved);
        assert_eq!(
            capability(&macos.key_classes, "super_meta").state,
            CapabilityState::Available
        );
    }

    #[test]
    fn a_bare_function_key_is_conditional_rather_than_silently_fine() {
        let matrix = capability_matrix(&session(SessionKind::Windows), ReleaseEvidence::Unobserved);
        assert_eq!(
            capability(&matrix.key_classes, "function_keys").state,
            CapabilityState::Conditional
        );
        assert_eq!(
            capability(&matrix.key_classes, "letters_digits").state,
            CapabilityState::Available
        );
    }

    #[test]
    fn the_modifier_only_minimum_is_reported_from_the_one_constant() {
        let matrix = capability_matrix(&session(SessionKind::Windows), ReleaseEvidence::Unobserved);
        let reason = capability(&matrix.key_classes, "modifier_only")
            .reason
            .clone()
            .expect("modifier-only needs a reason");
        assert!(
            reason.contains(&MODIFIER_ONLY_MINIMUM.to_string()),
            "the matrix must quote the contract's own minimum, not a literal: {reason}"
        );
        assert_eq!(
            shortcut_vocabulary().modifier_only_minimum,
            MODIFIER_ONLY_MINIMUM
        );
    }

    #[test]
    fn vocabulary_tokens_are_registerable() {
        // The contract guarantee behind T2/D8: nothing the UI can produce from
        // the exported vocabulary can fail at registration time.
        for token in all_key_tokens() {
            Shortcut::from_str(token)
                .unwrap_or_else(|error| panic!("key token '{token}' is not registerable: {error}"));
            let with_modifier = format!("Ctrl+{token}");
            Shortcut::from_str(&with_modifier).unwrap_or_else(|error| {
                panic!("'{with_modifier}' is not registerable: {error}")
            });
        }
    }

    /// The dialect a live surface can still produce: the plain word, the comma
    /// separator, the platform name for Super. The pynput spellings that used
    /// to be asserted here went with the sidecar that wrote them (ADR 0112).
    #[test]
    fn accepts_the_spellings_a_live_surface_produces() {
        assert_eq!(valid("ctrl+f9").canonical, "Ctrl+F9");
        assert_eq!(valid("ctrl, alt, escape").canonical, "Ctrl+Alt+Escape");
        assert_eq!(valid("cmd+shift+m").canonical, "Shift+Super+M");
    }

    #[test]
    fn a_pynput_modifier_is_no_longer_a_modifier() {
        // It parses as far as the key table and fails there, which is the same
        // answer any other unknown token gets — not a silent pass-through.
        let error = parse("ctrl_l+f9", Policy::default()).unwrap_err();
        assert!(error.contains("ctrl_l"), "unexpected reason: {error}");
    }

    #[test]
    fn accepts_browser_event_codes_unchanged() {
        assert_eq!(valid("ControlLeft+KeyM").canonical, "Ctrl+M");
        assert_eq!(valid("Ctrl+ArrowUp").canonical, "Ctrl+ArrowUp");
        assert_eq!(valid("Ctrl+NumpadAdd").canonical, "Ctrl+NumpadAdd");
    }

    #[test]
    fn canonicalization_is_idempotent() {
        for input in ["ctrl+f9", "Ctrl+Alt+KeyM", "Ctrl+Alt+M", "shift+ctrl+space", "alt+win"] {
            let once = valid(input).canonical;
            let twice = valid(&once).canonical;
            assert_eq!(once, twice, "canonical form drifted for '{input}'");
        }
    }

    #[test]
    fn modifiers_are_sorted_into_canonical_order() {
        assert_eq!(valid("shift+ctrl+alt+f9").canonical, "Ctrl+Alt+Shift+F9");
    }

    #[test]
    fn empty_value_means_disabled_not_default() {
        assert!(matches!(
            parse("", Policy::default()).unwrap(),
            ShortcutParse::Disabled
        ));
        assert!(matches!(
            parse("   ", Policy::default()).unwrap(),
            ShortcutParse::Disabled
        ));
        assert_eq!(normalize_for_storage("", Policy::default()), "");
    }

    #[test]
    fn single_bare_modifier_is_rejected() {
        // D2: this used to be expanded into Shortcut::new(None, ControlLeft),
        // a desktop-wide grab on Ctrl.
        let error = parse("ctrl", Policy::default()).unwrap_err();
        assert!(error.contains("single"), "unexpected reason: {error}");
        // The reason has to be the current one: not the retired grab argument,
        // and not "cannot be told apart" as an absolute — it is a property of the
        // session, and the message says which one is missing.
        assert!(
            error.contains("interrupts the hold"),
            "the reason must name the missing signal: {error}"
        );
        assert!(
            !error.contains("would stop working everywhere"),
            "stale grab-based reason: {error}"
        );
    }

    #[test]
    fn a_single_modifier_is_allowed_where_interruption_is_reported() {
        // The whole point of the interruption signal: with it, a deliberate tap
        // of Shift is distinguishable from the Shift pressed to type a capital,
        // so the two-modifier minimum has no reason to apply.
        let policy = Policy {
            allow_modifier_only: true,
            interruption_signal: true,
        };

        let parsed = match parse("shift", policy).expect("a single modifier should parse") {
            ShortcutParse::Valid(parsed) => *parsed,
            ShortcutParse::Disabled => panic!("expected a shortcut"),
        };

        assert_eq!(parsed.canonical, "Shift");
        assert!(parsed.modifier_only);
        assert_eq!(parsed.delivery, Delivery::Observe);
        // One part means one binding, and it carries no modifier — which is only
        // safe because it is observed rather than grabbed.
        assert_eq!(parsed.shortcuts.len(), 1);
    }

    #[test]
    fn the_interruption_signal_is_a_session_property_not_a_platform_guess() {
        // Linux routes modifier-only through XInput2 raw events and reports
        // interruption. Windows and macOS do not yet, and must not be assumed to.
        assert!(session_has_interruption_signal(SessionKind::LinuxX11));
        assert!(session_has_interruption_signal(SessionKind::LinuxXWayland));
        assert!(!session_has_interruption_signal(SessionKind::Windows));
        assert!(!session_has_interruption_signal(SessionKind::MacOs));
        assert!(!session_has_interruption_signal(
            SessionKind::LinuxNativeWayland
        ));
    }

    #[test]
    fn modifier_only_is_observed_and_a_real_key_is_grabbed() {
        // ADR 0009: the delivery mechanism follows from the shortcut itself, and
        // it is what decides whether the key stays available to other
        // applications.
        assert_eq!(valid("ctrl+win").delivery, Delivery::Observe);
        assert_eq!(valid("ctrl+alt").delivery, Delivery::Observe);
        assert_eq!(valid("ctrl+f9").delivery, Delivery::Grab);
        assert_eq!(valid("F1").delivery, Delivery::Grab);
        assert_eq!(Delivery::Observe.as_token(), "observe");
        assert_eq!(Delivery::Grab.as_token(), "grab");
    }

    #[test]
    fn the_default_capture_triggers_are_observed_not_grabbed() {
        // The complaint that started the rebuild was shortcuts swallowing keys
        // other applications need. Both modifier-only defaults are observed, so
        // they no longer do.
        for default in [
            super::super::config::default_hotkey(),
            super::super::config::default_abort_hotkey(),
        ] {
            let parsed = valid(default);
            assert_eq!(
                parsed.delivery,
                Delivery::Observe,
                "'{default}' must not take its keys from the desktop"
            );
        }
    }

    #[test]
    fn two_modifiers_are_accepted_and_never_grab_a_bare_modifier() {
        let parsed = valid("ctrl+win");
        assert_eq!(parsed.canonical, "Ctrl+Super");
        assert_eq!(parsed.shortcuts.len(), 2);
        for shortcut in parsed.shortcuts {
            assert!(
                shortcut.mods != Modifiers::empty(),
                "modifier-only expansion produced a bare grab"
            );
        }
    }

    #[test]
    fn bare_letter_and_digit_are_rejected() {
        assert!(parse("a", Policy::default()).is_err());
        assert!(parse("KeyA", Policy::default()).is_err());
        assert!(parse("5", Policy::default()).is_err());
    }

    #[test]
    fn bare_function_key_parses_with_a_warning() {
        // The reporter's escape hatch: it stays usable, but it is named as the
        // desktop-wide grab that it is.
        let parsed = valid("f1");
        assert_eq!(parsed.canonical, "F1");
        assert!(parsed.warning.is_some());
    }

    #[test]
    fn space_combination_is_not_truncated() {
        // D6: persist-time normalization used to drop the trailing key of these
        // three, which silently rewrote the Windows default hotkey.
        assert_eq!(valid("ctrl+alt+space").canonical, "Ctrl+Alt+Space");
        assert_eq!(valid("ctrl+win+space").canonical, "Ctrl+Super+Space");
        assert_eq!(valid("ctrl+cmd+space").canonical, "Ctrl+Super+Space");
    }

    #[test]
    fn unsupported_token_is_an_error_not_a_pass_through() {
        // D5: the config normalizer used to lowercase unknown tokens and store
        // a value that could never register.
        let error = parse("ctrl+florp", Policy::default()).unwrap_err();
        assert!(error.contains("florp"), "unexpected reason: {error}");
    }

    #[test]
    fn unparsable_value_survives_storage_normalization_untouched() {
        assert_eq!(
            normalize_for_storage("ctrl+florp", Policy::default()),
            "ctrl+florp"
        );
    }

    #[test]
    fn two_non_modifier_keys_are_rejected() {
        assert!(parse("ctrl+a+b", Policy::default()).is_err());
    }

    #[test]
    fn modifier_only_can_be_forbidden_per_slot() {
        let policy = Policy {
            allow_modifier_only: false,
            ..Policy::default()
        };
        assert!(parse("ctrl+alt", policy).is_err());
        assert!(parse("ctrl+alt+f9", policy).is_ok());
    }

    #[test]
    fn display_strings_are_human() {
        assert_eq!(valid("ctrl+f9").display, "Ctrl + F9");
        assert_eq!(valid("ctrl+alt+m").display, "Ctrl + Alt + M");
        assert_eq!(valid("ctrl+digit4").display, "Ctrl + 4");
        assert_eq!(valid("ctrl+arrowup").display, "Ctrl + Up");
    }

    #[test]
    fn display_for_falls_back_to_the_raw_value() {
        assert_eq!(display_for("ctrl+f9", Policy::default()), "Ctrl + F9");
        assert_eq!(display_for("", Policy::default()), "");
        assert_eq!(display_for("ctrl+florp", Policy::default()), "ctrl+florp");
    }

    #[test]
    fn vocabulary_tokens_all_normalize_to_themselves() {
        for token in all_key_tokens() {
            assert_eq!(
                normalize_key_token(token),
                Some(token),
                "vocabulary token '{token}' does not round-trip"
            );
        }
    }

    #[test]
    fn validation_command_reports_disabled_and_reasons() {
        let disabled = validate_shortcut(ValidateShortcutRequest {
            value: String::new(),
            allow_modifier_only: true,
        });
        assert!(disabled.ok && disabled.disabled);

        // A single modifier depends on whether this session can report an
        // interrupted hold, so the command is asserted against the same helper
        // rather than against a fixed expectation.
        let single = validate_shortcut(ValidateShortcutRequest {
            value: "ctrl".to_string(),
            allow_modifier_only: true,
        });
        assert_eq!(
            single.ok,
            session_has_interruption_signal(shortcut_platform().kind)
        );
        assert_eq!(single.ok, single.reason.is_none());

        // A bare letter is rejected in every session.
        let rejected = validate_shortcut(ValidateShortcutRequest {
            value: "a".to_string(),
            allow_modifier_only: true,
        });
        assert!(!rejected.ok);
        assert!(rejected.reason.is_some());

        let accepted = validate_shortcut(ValidateShortcutRequest {
            value: "ctrl+f9".to_string(),
            allow_modifier_only: true,
        });
        assert!(accepted.ok);
        assert_eq!(accepted.canonical, "Ctrl+F9");
        assert_eq!(accepted.display, "Ctrl + F9");
    }
}
