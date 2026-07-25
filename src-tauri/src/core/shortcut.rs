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
    /// Whether a shortcut made only of modifiers may be used at all. Even when
    /// true, a *single* bare modifier stays rejected (it would grab that
    /// modifier desktop-wide).
    pub allow_modifier_only: bool,
}

impl Default for Policy {
    fn default() -> Self {
        Self {
            allow_modifier_only: true,
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
/// Accepts legacy pynput tokens (`ctrl_l+f9`), the previous canonical form
/// (`Ctrl+F9`), browser `event.code` names (`Ctrl+KeyM`) and comma separators.
/// Rejects anything that could not be registered, and anything the contract
/// forbids (single bare modifier, bare letter or digit).
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

    if modifiers.len() < 2 {
        return Err(format!(
            "A single {} would be grabbed from every application on this desktop. \
             Use at least two modifiers, or add a key.",
            modifiers.first().copied().unwrap_or("modifier")
        ));
    }

    // Each part is registered once as the main key, with the remaining parts as
    // modifiers, so the combination fires whichever modifier is pressed last.
    // Registering a part with an EMPTY modifier set is exactly the bare-modifier
    // grab this contract forbids, which is why fewer than two parts is rejected
    // above.
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
        debug_assert!(!mods.is_empty());
        shortcuts.push(Shortcut::new(Some(mods), modifier_code(main)?));
    }

    Ok(ParsedShortcut {
        canonical: canonical_string(modifiers, None),
        display: display_string(modifiers, None),
        shortcuts,
        modifier_only: true,
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

fn normalize_modifier_token(part: &str) -> Option<&'static str> {
    match part.to_ascii_lowercase().as_str() {
        "ctrl" | "ctrl_l" | "ctrl_r" | "control" | "controlleft" | "controlright" => Some("Ctrl"),
        "alt" | "alt_l" | "alt_r" | "option" | "altleft" | "altright" => Some("Alt"),
        "shift" | "shift_l" | "shift_r" | "shiftleft" | "shiftright" => Some("Shift"),
        "win" | "cmd" | "command" | "super" | "meta" | "metaleft" | "metaright" | "oskey" => {
            Some("Super")
        }
        _ => None,
    }
}

/// Maps any accepted spelling of a non-modifier key onto its canonical token.
/// Covers legacy pynput names, bare characters and browser `event.code`.
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
    let policy = Policy {
        allow_modifier_only: request.allow_modifier_only,
    };

    match parse(&request.value, policy) {
        Ok(ShortcutParse::Disabled) => ShortcutValidation {
            ok: true,
            disabled: true,
            canonical: String::new(),
            display: String::new(),
            modifier_only: false,
            reason: None,
            warning: None,
        },
        Ok(ShortcutParse::Valid(parsed)) => ShortcutValidation {
            ok: true,
            disabled: false,
            canonical: parsed.canonical,
            display: parsed.display,
            modifier_only: parsed.modifier_only,
            reason: None,
            warning: parsed.warning,
        },
        Err(reason) => ShortcutValidation {
            ok: false,
            disabled: false,
            canonical: String::new(),
            display: String::new(),
            modifier_only: false,
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
        modifier_only_minimum: 2,
    }
}

/// What the current session can actually honor, named honestly at the point
/// where the user chooses a shortcut (T8). Nothing here guesses: it reports
/// the session facts and the consequences that follow from them.
#[derive(Debug, Clone, Serialize)]
pub struct ShortcutPlatform {
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
        summary,
        global_shortcuts_available,
        keys_the_desktop_swallows: swallowed,
        notes,
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

    #[test]
    fn accepts_legacy_pynput_tokens() {
        assert_eq!(valid("ctrl_l+f9").canonical, "Ctrl+F9");
        assert_eq!(valid("ctrl_l, alt_l, escape").canonical, "Ctrl+Alt+Escape");
        assert_eq!(valid("ctrl_l+alt_l+m").canonical, "Ctrl+Alt+M");
    }

    #[test]
    fn accepts_browser_event_codes_unchanged() {
        assert_eq!(valid("ControlLeft+KeyM").canonical, "Ctrl+M");
        assert_eq!(valid("Ctrl+ArrowUp").canonical, "Ctrl+ArrowUp");
        assert_eq!(valid("Ctrl+NumpadAdd").canonical, "Ctrl+NumpadAdd");
    }

    #[test]
    fn canonicalization_is_idempotent() {
        for input in ["ctrl_l+f9", "Ctrl+Alt+KeyM", "Ctrl+Alt+M", "shift_l+ctrl_l+space", "alt_l+win"] {
            let once = valid(input).canonical;
            let twice = valid(&once).canonical;
            assert_eq!(once, twice, "canonical form drifted for '{input}'");
        }
    }

    #[test]
    fn modifiers_are_sorted_into_canonical_order() {
        assert_eq!(valid("shift_l+ctrl_l+alt_l+f9").canonical, "Ctrl+Alt+Shift+F9");
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
        let error = parse("ctrl_l", Policy::default()).unwrap_err();
        assert!(error.contains("single"), "unexpected reason: {error}");
    }

    #[test]
    fn two_modifiers_are_accepted_and_never_grab_a_bare_modifier() {
        let parsed = valid("ctrl_l+win");
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
        assert_eq!(valid("ctrl_l+alt_l+space").canonical, "Ctrl+Alt+Space");
        assert_eq!(valid("ctrl_l+win+space").canonical, "Ctrl+Super+Space");
        assert_eq!(valid("ctrl_l+cmd+space").canonical, "Ctrl+Super+Space");
    }

    #[test]
    fn unsupported_token_is_an_error_not_a_pass_through() {
        // D5: the config normalizer used to lowercase unknown tokens and store
        // a value that could never register.
        let error = parse("ctrl_l+florp", Policy::default()).unwrap_err();
        assert!(error.contains("florp"), "unexpected reason: {error}");
    }

    #[test]
    fn unparsable_value_survives_storage_normalization_untouched() {
        assert_eq!(
            normalize_for_storage("ctrl_l+florp", Policy::default()),
            "ctrl_l+florp"
        );
    }

    #[test]
    fn two_non_modifier_keys_are_rejected() {
        assert!(parse("ctrl_l+a+b", Policy::default()).is_err());
    }

    #[test]
    fn modifier_only_can_be_forbidden_per_slot() {
        let policy = Policy {
            allow_modifier_only: false,
        };
        assert!(parse("ctrl_l+alt_l", policy).is_err());
        assert!(parse("ctrl_l+alt_l+f9", policy).is_ok());
    }

    #[test]
    fn display_strings_are_human() {
        assert_eq!(valid("ctrl_l+f9").display, "Ctrl + F9");
        assert_eq!(valid("ctrl_l+alt_l+m").display, "Ctrl + Alt + M");
        assert_eq!(valid("ctrl_l+digit4").display, "Ctrl + 4");
        assert_eq!(valid("ctrl_l+arrowup").display, "Ctrl + Up");
    }

    #[test]
    fn display_for_falls_back_to_the_raw_value() {
        assert_eq!(display_for("ctrl_l+f9", Policy::default()), "Ctrl + F9");
        assert_eq!(display_for("", Policy::default()), "");
        assert_eq!(display_for("ctrl_l+florp", Policy::default()), "ctrl_l+florp");
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

        let rejected = validate_shortcut(ValidateShortcutRequest {
            value: "ctrl_l".to_string(),
            allow_modifier_only: true,
        });
        assert!(!rejected.ok);
        assert!(rejected.reason.is_some());

        let accepted = validate_shortcut(ValidateShortcutRequest {
            value: "ctrl_l+f9".to_string(),
            allow_modifier_only: true,
        });
        assert!(accepted.ok);
        assert_eq!(accepted.canonical, "Ctrl+F9");
        assert_eq!(accepted.display, "Ctrl + F9");
    }
}
