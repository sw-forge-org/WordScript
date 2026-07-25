import type {
  NativeTriggerStatus,
  ShortcutCapabilities,
  ShortcutCapability,
  ShortcutPlatform,
  ShortcutReleaseEvidence,
  ShortcutValidation,
  ShortcutVocabulary,
} from "../types/ipc";

// Test double for the Rust shortcut contract (`core::shortcut`).
//
// The UI deliberately owns no key table and no validation rules, so a test that
// renders a shortcut surface has to stand in for the runtime. This double
// mirrors the contract closely enough for the interaction tests — the rules
// themselves are asserted in `cargo test`, not here.

const MODIFIER_CODES: Array<[string, string]> = [
  ["ControlLeft", "Ctrl"],
  ["ControlRight", "Ctrl"],
  ["AltLeft", "Alt"],
  ["AltRight", "Alt"],
  ["ShiftLeft", "Shift"],
  ["ShiftRight", "Shift"],
  ["MetaLeft", "Super"],
  ["MetaRight", "Super"],
];

const LETTERS = Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`);
const DIGITS = Array.from({ length: 10 }, (_, index) => `Digit${index}`);
const FUNCTIONS = Array.from({ length: 24 }, (_, index) => `F${index + 1}`);
const EDITING = ["Space", "Enter", "Tab", "Backspace", "Escape", "Delete", "Home", "End"];

export function createShortcutVocabulary(): ShortcutVocabulary {
  const token = (value: string) => ({ token: value, display: displayKey(value) });
  return {
    modifiers: ["Ctrl", "Alt", "Shift", "Super"].map((value) => ({
      token: value,
      display: value,
    })),
    modifier_codes: MODIFIER_CODES,
    key_groups: [
      { label: "Letters", tokens: LETTERS.map(token) },
      { label: "Digits", tokens: DIGITS.map(token) },
      { label: "Function keys", tokens: FUNCTIONS.map(token) },
      { label: "Editing", tokens: EDITING.map(token) },
    ],
    modifier_only_minimum: 2,
  };
}

export function createShortcutPlatform(
  overrides: Partial<ShortcutPlatform> = {},
): ShortcutPlatform {
  return {
    kind: "linux_x11",
    summary: "Test session",
    global_shortcuts_available: true,
    keys_the_desktop_swallows: [],
    notes: [],
    ...overrides,
  };
}

/// Mirrors `core::shortcut::ReleaseEvidence::from_counters`.
export function releaseEvidenceFromCounters(
  presses: number,
  releases: number,
): ShortcutReleaseEvidence {
  if (presses === 0) return "unobserved";
  return releases === 0 ? "release_missing" : "release_observed";
}

/// Mirrors `core::shortcut::capability_matrix` closely enough for the interaction
/// tests. The derivation rules themselves are asserted in `cargo test` — this
/// double only has to produce the same shape and the same three hold states so a
/// rendered surface can be exercised without a Tauri host.
export function createShortcutCapabilities(
  overrides: Partial<ShortcutCapabilities> = {},
): ShortcutCapabilities {
  const platform = createShortcutPlatform();
  const evidence = overrides.release_evidence ?? "unobserved";
  const capability = (
    id: string,
    label: string,
    state: ShortcutCapability["state"],
    reason: string | null = null,
  ): ShortcutCapability => ({ id, label, state, reason });

  const hold =
    evidence === "release_observed"
      ? capability(
          "hold",
          "Hold to talk",
          "available",
          "Key releases have been observed for this shortcut in this session.",
        )
      : evidence === "release_missing"
        ? capability(
            "hold",
            "Hold to talk",
            "unavailable",
            "This session received presses of this shortcut and no key release, so a hold would start and never stop on release — the watchdog would have to end every one. Use tap or double tap.",
          )
        : capability(
            "hold",
            "Hold to talk",
            "conditional",
            "Whether the key release arrives has not been observed yet in this session — press the shortcut once to find out.",
          );

  return {
    session: platform.kind,
    summary: platform.summary,
    global_shortcuts_available: true,
    release_evidence: evidence,
    activation_modes: [
      capability("tap", "Tap to toggle", "available"),
      capability("double_tap", "Double tap to toggle", "available"),
      hold,
    ],
    key_classes: [
      capability("letters_digits", "Letters and digits", "available", null),
      capability(
        "function_keys",
        "Function keys",
        "conditional",
        "Registerable with or without a modifier, but a bare function key is a desktop-wide grab.",
      ),
      capability("modifier_only", "Modifier-only", "available", null),
      capability("super_meta", "Super / Meta", "available", null),
    ],
    ...overrides,
  };
}

export function createTriggerStatus(
  overrides: Partial<NativeTriggerStatus> = {},
): NativeTriggerStatus {
  return {
    configured: true,
    enabled: true,
    paused: false,
    suspended: false,
    hotkey: "Ctrl+F9",
    pause_hotkey: "Ctrl+F10",
    abort_hotkey: "Ctrl+Alt+Escape",
    registered_hotkey: "Ctrl+F9",
    registered_pause_hotkey: "Ctrl+F10",
    registered_abort_hotkey: "Ctrl+Alt+Escape",
    activation_mode: "tap",
    last_error: null,
    owner: "native_tauri_global_shortcut",
    bindings: [],
    hold_min_ms: 300,
    debounce_ms: 300,
    hold_watchdog_seconds: 120,
    double_tap_window_ms: 400,
    registered_mode_hotkeys: [],
    ...overrides,
  };
}

function displayKey(token: string): string {
  if (token.startsWith("Key")) return token.slice(3);
  if (token.startsWith("Digit")) return token.slice(5);
  return token;
}

function canonicalKey(token: string): string {
  if (token.startsWith("Key")) return token.slice(3);
  if (token.startsWith("Digit")) return token.slice(5);
  return token;
}

function normalizeToken(part: string): { modifier?: string; key?: string } | null {
  const lower = part.toLowerCase();
  const modifier = MODIFIER_CODES.find(([code]) => code.toLowerCase() === lower)?.[1];
  if (modifier) return { modifier };
  switch (lower) {
    case "ctrl":
    case "ctrl_l":
    case "ctrl_r":
    case "control":
      return { modifier: "Ctrl" };
    case "alt":
    case "alt_l":
    case "alt_r":
      return { modifier: "Alt" };
    case "shift":
    case "shift_l":
    case "shift_r":
      return { modifier: "Shift" };
    case "win":
    case "cmd":
    case "super":
    case "meta":
      return { modifier: "Super" };
    default:
      break;
  }

  const all = [...LETTERS, ...DIGITS, ...FUNCTIONS, ...EDITING];
  const direct = all.find((token) => token.toLowerCase() === lower);
  if (direct) return { key: direct };
  if (/^[a-z]$/.test(lower)) return { key: `Key${lower.toUpperCase()}` };
  if (/^[0-9]$/.test(lower)) return { key: `Digit${lower}` };
  return null;
}

/// Mirrors `core::shortcut::validate_shortcut`.
export function validateShortcutDouble(
  value: string,
  allowModifierOnly = true,
): ShortcutValidation {
  const parts = value
    .split(/[+,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { ok: true, disabled: true, canonical: "", display: "", modifier_only: false, reason: null, warning: null };
  }

  const modifiers: string[] = [];
  let key: string | null = null;

  for (const part of parts) {
    const token = normalizeToken(part);
    if (!token) {
      return {
        ok: false,
        disabled: false,
        canonical: "",
        display: "",
        modifier_only: false,
        reason: `'${part}' is not a key WordScript can register.`,
        warning: null,
      };
    }
    if (token.modifier) {
      if (!modifiers.includes(token.modifier)) modifiers.push(token.modifier);
    } else if (token.key) {
      key = token.key;
    }
  }

  const order = ["Ctrl", "Alt", "Shift", "Super"];
  modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  if (!key) {
    if (!allowModifierOnly) {
      return {
        ok: false,
        disabled: false,
        canonical: "",
        display: "",
        modifier_only: false,
        reason: "This shortcut must include a non-modifier key.",
        warning: null,
      };
    }
    if (modifiers.length < 2) {
      return {
        ok: false,
        disabled: false,
        canonical: "",
        display: "",
        modifier_only: false,
        reason: `A single ${modifiers[0]} would be grabbed from every application on this desktop.`,
        warning: null,
      };
    }
    return {
      ok: true,
      disabled: false,
      canonical: modifiers.join("+"),
      display: modifiers.join(" + "),
      modifier_only: true,
      reason: null,
      warning: null,
    };
  }

  if (modifiers.length === 0 && (key.startsWith("Key") || key.startsWith("Digit"))) {
    return {
      ok: false,
      disabled: false,
      canonical: "",
      display: "",
      modifier_only: false,
      reason: `'${displayKey(key)}' alone would be grabbed from every application on this desktop.`,
      warning: null,
    };
  }

  const warning =
    modifiers.length === 0 && FUNCTIONS.includes(key)
      ? `${key} is registered globally without a modifier.`
      : null;

  return {
    ok: true,
    disabled: false,
    canonical: [...modifiers, canonicalKey(key)].join("+"),
    display: [...modifiers, displayKey(key)].join(" + "),
    modifier_only: false,
    reason: null,
    warning,
  };
}

const SHORTCUT_COMMANDS = new Set([
  "shortcut_vocabulary",
  "shortcut_platform",
  "shortcut_capabilities",
  "native_trigger_status",
  "validate_shortcut",
  "pause_native_trigger",
  "resume_native_trigger",
  "append_diag_log",
]);

export function isShortcutCommand(command: string): boolean {
  return SHORTCUT_COMMANDS.has(command);
}

/// Handles the shortcut-lane commands for a mocked `invoke`. Guard the call
/// with `isShortcutCommand` — some of these commands legitimately resolve to
/// `undefined`.
///
/// `context.triggerStatus` stands in for the runtime state the real
/// `shortcut_capabilities` command reads: the capability matrix is derived from
/// the same capture binding the status reports, so a test that sets up press and
/// release counters gets a matching matrix without stating it twice.
export function shortcutInvokeDouble(
  command: string,
  args?: Record<string, unknown>,
  context: { triggerStatus?: NativeTriggerStatus } = {},
): unknown | undefined {
  const triggerStatus = context.triggerStatus ?? createTriggerStatus();

  switch (command) {
    case "shortcut_vocabulary":
      return createShortcutVocabulary();
    case "shortcut_platform":
      return createShortcutPlatform();
    case "shortcut_capabilities": {
      const capture = triggerStatus.bindings.find((binding) => binding.label === "capture");
      return createShortcutCapabilities({
        release_evidence: releaseEvidenceFromCounters(
          capture?.presses ?? 0,
          capture?.releases ?? 0,
        ),
      });
    }
    case "native_trigger_status":
      return triggerStatus;
    case "validate_shortcut": {
      const request = (args?.request ?? {}) as {
        value?: string;
        allow_modifier_only?: boolean;
      };
      return validateShortcutDouble(request.value ?? "", request.allow_modifier_only ?? true);
    }
    case "pause_native_trigger":
    case "resume_native_trigger":
    case "append_diag_log":
      return undefined;
    default:
      return undefined;
  }
}
