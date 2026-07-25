import { invoke } from "@tauri-apps/api/core";
import type {
  NativeTriggerStatus,
  ShortcutPlatform,
  ShortcutValidation,
  ShortcutVocabulary,
} from "../types/ipc";

// The shortcut contract lives in Rust (`core::shortcut`). This module is the
// only place the UI talks to it, and it deliberately carries no key table of
// its own: the vocabulary — including which browser `event.code` values are
// modifiers — is fetched from the runtime, so every token the recorder can
// produce is registerable by construction.

let vocabularyPromise: Promise<ShortcutVocabulary> | null = null;
let platformPromise: Promise<ShortcutPlatform> | null = null;

/// Fetches the runtime token vocabulary once per window and caches it. The
/// vocabulary is static for the life of the process.
export function loadShortcutVocabulary(): Promise<ShortcutVocabulary> {
  vocabularyPromise ??= invoke<ShortcutVocabulary>("shortcut_vocabulary");
  return vocabularyPromise;
}

export function loadShortcutPlatform(): Promise<ShortcutPlatform> {
  platformPromise ??= invoke<ShortcutPlatform>("shortcut_platform");
  return platformPromise;
}

/// Test seam: lets a test install a vocabulary without a Tauri host.
export function __setShortcutRuntimeForTests(
  vocabulary: ShortcutVocabulary | null,
  platform: ShortcutPlatform | null = null,
) {
  vocabularyPromise = vocabulary ? Promise.resolve(vocabulary) : null;
  platformPromise = platform ? Promise.resolve(platform) : null;
}

export function validateShortcut(
  value: string,
  allowModifierOnly = true,
): Promise<ShortcutValidation> {
  return invoke<ShortcutValidation>("validate_shortcut", {
    request: { value, allow_modifier_only: allowModifierOnly },
  });
}

export function readTriggerStatus(): Promise<NativeTriggerStatus> {
  return invoke<NativeTriggerStatus>("native_trigger_status");
}

/// Releases the OS grabs so a recorder can actually observe the keys, and puts
/// them back afterwards. A grabbed combination is delivered to the grab owner,
/// not to the focused window, so without this the shortcut you already use can
/// never be re-recorded.
export function suspendGlobalShortcuts(): Promise<unknown> {
  return invoke("pause_native_trigger").catch(() => undefined);
}

export function resumeGlobalShortcuts(): Promise<unknown> {
  return invoke("resume_native_trigger").catch(() => undefined);
}

export interface ChordState {
  modifiers: string[];
  key: string | null;
}

/// Maps a browser `event.code` onto a canonical modifier token, or null when
/// the code is not a modifier.
export function modifierTokenForCode(
  vocabulary: ShortcutVocabulary,
  code: string,
): string | null {
  const match = vocabulary.modifier_codes.find(([eventCode]) => eventCode === code);
  return match ? match[1] : null;
}

/// True when the runtime can register this `event.code` as a main key. The
/// recorder uses it to reject keys with a stated reason instead of dropping
/// them silently.
export function isKnownKeyCode(vocabulary: ShortcutVocabulary, code: string): boolean {
  return vocabulary.key_groups.some((group) =>
    group.tokens.some((token) => token.token === code),
  );
}

/// Serializes an accumulated chord into the token string the runtime parses.
/// Modifier order follows the vocabulary so the value is stable regardless of
/// the order the keys were pressed in.
export function chordToValue(vocabulary: ShortcutVocabulary, chord: ChordState): string {
  const order = vocabulary.modifiers.map((modifier) => modifier.token);
  const modifiers = [...chord.modifiers].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  return [...modifiers, ...(chord.key ? [chord.key] : [])].join("+");
}

/// Renders a chord for the live pill while recording, before the runtime has
/// validated it. Uses the runtime's own display strings.
export function chordToKeyLabels(
  vocabulary: ShortcutVocabulary,
  chord: ChordState,
): string[] {
  const order = vocabulary.modifiers.map((modifier) => modifier.token);
  const modifiers = [...chord.modifiers]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(
      (token) =>
        vocabulary.modifiers.find((modifier) => modifier.token === token)?.display ?? token,
    );

  if (!chord.key) return modifiers;

  const key = vocabulary.key_groups
    .flatMap((group) => group.tokens)
    .find((token) => token.token === chord.key);

  return [...modifiers, key?.display ?? chord.key];
}

/// Splits a stored value into the labels rendered as individual key caps.
/// A value the runtime could not parse is shown as a single cap so it stays
/// visible rather than silently disappearing.
export function displayToKeyLabels(display: string): string[] {
  const trimmed = display.trim();
  if (!trimmed) return [];
  return trimmed.includes(" + ") ? trimmed.split(" + ") : [trimmed];
}
