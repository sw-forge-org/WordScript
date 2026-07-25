import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShortcutValidation, ShortcutVocabulary } from "../../types/ipc";
import {
  chordToKeyLabels,
  chordToValue,
  displayToKeyLabels,
  isKnownKeyCode,
  loadShortcutVocabulary,
  modifierTokenForCode,
  resumeGlobalShortcuts,
  suspendGlobalShortcuts,
  validateShortcut,
  type ChordState,
} from "../../lib/shortcuts";

// Recording is an explicitly ended state (T1). It never commits on a key
// release: tapping Ctrl used to finalize `ctrl_l` and close the recorder, which
// is why "Ctrl registers and then no other key can be pressed" was the reported
// symptom (D1). The chord is accumulated and shown live; the user confirms it.

const RECORDING_TIMEOUT_MS = 10_000;

interface Props {
  value: string;
  onChange: (value: string) => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  allowModifierOnly?: boolean;
  /** Canonical values already taken by other slots. Reported live so a
   *  collision is visible before the value is committed. */
  takenValues?: string[];
  /** Human display for `value`, resolved by the runtime. Falls back to the raw
   *  value while it is still loading. */
  display?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

const EMPTY_CHORD: ChordState = { modifiers: [], key: null };

export function HotkeyRecorder({
  value,
  onChange,
  onStartRecording,
  onStopRecording,
  allowModifierOnly = true,
  takenValues = [],
  display,
  disabled = false,
  ariaLabel,
}: Props) {
  const [vocabulary, setVocabulary] = useState<ShortcutVocabulary | null>(null);
  const [recording, setRecording] = useState(false);
  const [chord, setChord] = useState<ChordState>(EMPTY_CHORD);
  const [validation, setValidation] = useState<ShortcutValidation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const heldModifiersRef = useRef<Set<string>>(new Set());
  const chordRef = useRef<ChordState>(EMPTY_CHORD);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadShortcutVocabulary()
      .then((loaded) => {
        if (!cancelled) setVocabulary(loaded);
      })
      .catch(() => {
        if (!cancelled) setNotice("Shortcut vocabulary is unavailable — recording is disabled.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const finishRecording = useCallback(() => {
    clearTimer();
    setRecording(false);
    setChord(EMPTY_CHORD);
    setValidation(null);
    chordRef.current = EMPTY_CHORD;
    heldModifiersRef.current.clear();
    // Always put the OS grabs back, even when the recording was cancelled.
    void resumeGlobalShortcuts();
    onStopRecording?.();
  }, [clearTimer, onStopRecording]);

  const cancel = useCallback(() => {
    setNotice(null);
    finishRecording();
  }, [finishRecording]);

  const confirm = useCallback(() => {
    const current = chordRef.current;
    if (!vocabulary || (current.modifiers.length === 0 && !current.key)) {
      cancel();
      return;
    }

    const candidate = chordToValue(vocabulary, current);
    void validateShortcut(candidate, allowModifierOnly).then((result) => {
      if (!result.ok) {
        setNotice(result.reason);
        return;
      }
      if (takenValues.includes(result.canonical)) {
        setNotice(`${result.display} is already used by another shortcut.`);
        return;
      }
      setNotice(result.warning);
      onChange(result.canonical);
      finishRecording();
    });
  }, [allowModifierOnly, cancel, finishRecording, onChange, takenValues, vocabulary]);

  const startRecording = useCallback(() => {
    if (disabled || !vocabulary) return;
    setNotice(null);
    setValidation(null);
    setChord(EMPTY_CHORD);
    chordRef.current = EMPTY_CHORD;
    heldModifiersRef.current.clear();
    setRecording(true);
    // Release the OS grabs first — a grabbed combination goes to the grab
    // owner, not to this window, so the shortcut in use would be invisible
    // here (D3).
    void suspendGlobalShortcuts();
    onStartRecording?.();
  }, [disabled, onStartRecording, vocabulary]);

  // Re-validate the accumulated chord on every change so the pill can state a
  // problem while the user is still holding the keys.
  useEffect(() => {
    if (!recording || !vocabulary) return;
    if (chord.modifiers.length === 0 && !chord.key) {
      setValidation(null);
      return;
    }

    let cancelled = false;
    void validateShortcut(chordToValue(vocabulary, chord), allowModifierOnly).then((result) => {
      if (!cancelled) setValidation(result);
    });
    return () => {
      cancelled = true;
    };
  }, [allowModifierOnly, chord, recording, vocabulary]);

  useEffect(() => {
    if (!recording || !vocabulary) return;

    const probe = (event: KeyboardEvent, phase: "keydown" | "keyup") => {
      if (!import.meta.env.DEV) return;
      // Dev-only key probe (S0). Answers what actually reaches this window on
      // a given desktop — which keys arrive, which the compositor swallows,
      // and whether the code maps to a registerable token.
      const mapped =
        modifierTokenForCode(vocabulary, event.code) ??
        (isKnownKeyCode(vocabulary, event.code) ? event.code : "unmapped");
      void invoke("append_diag_log", {
        line:
          `[keyprobe] phase=${phase} code=${event.code} key=${event.key} mapped=${mapped} ` +
          `ctrl=${event.ctrlKey} alt=${event.altKey} shift=${event.shiftKey} meta=${event.metaKey} ` +
          `repeat=${event.repeat}`,
      }).catch(() => undefined);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      probe(event, "keydown");

      if (event.repeat) return;

      // Enter confirms and Escape cancels only while no modifier is held.
      // With a modifier down they are ordinary chord members, which is what
      // makes the default abort shortcut `Ctrl+Alt+Escape` recordable at all
      // (D8) — the old recorder hardwired Escape to "cancel" before looking at
      // modifiers.
      const hasModifier = heldModifiersRef.current.size > 0;
      if (!hasModifier && event.code === "Escape") {
        cancel();
        return;
      }
      if (!hasModifier && (event.code === "Enter" || event.code === "NumpadEnter")) {
        confirm();
        return;
      }

      const modifier = modifierTokenForCode(vocabulary, event.code);
      if (modifier) {
        heldModifiersRef.current.add(modifier);
        const next: ChordState = {
          modifiers: [...heldModifiersRef.current],
          key: chordRef.current.key,
        };
        chordRef.current = next;
        setChord(next);
        return;
      }

      if (!isKnownKeyCode(vocabulary, event.code)) {
        setNotice(`${event.key || event.code} is not a key WordScript can register.`);
        return;
      }

      setNotice(null);
      const next: ChordState = { modifiers: [...heldModifiersRef.current], key: event.code };
      chordRef.current = next;
      setChord(next);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      probe(event, "keyup");

      const modifier = modifierTokenForCode(vocabulary, event.code);
      if (modifier) {
        heldModifiersRef.current.delete(modifier);
      }
      // Releasing a key never commits and never shrinks the chord — the
      // largest chord seen is what the user gets to confirm (T1).
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [cancel, confirm, recording, vocabulary]);

  // A recorder left open would keep the whole lane ungrabbed. Time it out.
  useEffect(() => {
    if (!recording) return;
    timeoutRef.current = setTimeout(() => {
      setNotice("Recording timed out — nothing was changed.");
      finishRecording();
    }, RECORDING_TIMEOUT_MS);
    return clearTimer;
  }, [clearTimer, finishRecording, recording]);

  useEffect(() => clearTimer, [clearTimer]);

  const liveLabels = vocabulary ? chordToKeyLabels(vocabulary, chord) : [];
  const storedLabels = displayToKeyLabels(display ?? value);
  const labels = recording ? liveLabels : storedLabels;
  const canConfirm = recording && (validation?.ok ?? false) && !validation?.disabled;
  const problem = recording && validation && !validation.ok ? validation.reason : null;
  const message = problem ?? notice;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "inline-flex min-h-9 min-w-[120px] items-center gap-1.5 rounded-lg border bg-surface-strong px-3 py-1.5 text-[13px] transition-colors outline-none",
            disabled ? "cursor-not-allowed border-border opacity-60" : "cursor-pointer",
            recording
              ? "border-brand ring-2 ring-[var(--accent-soft)]"
              : "border-border hover:border-border-strong focus-visible:border-brand",
          )}
          onClick={recording ? undefined : startRecording}
          onKeyDown={(event) => {
            if (recording) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              startRecording();
            }
          }}
          onBlur={() => {
            if (recording) cancel();
          }}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label={
            ariaLabel ?? (recording ? "Recording shortcut, press your keys" : "Record shortcut")
          }
          aria-disabled={disabled}
        >
          {labels.length > 0 ? (
            labels.map((label, index) => (
              <kbd
                key={`${label}-${index}`}
                className="inline-flex min-w-7 items-center justify-center rounded-md border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[12px] font-medium text-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)]"
              >
                {label}
              </kbd>
            ))
          ) : (
            <span className="text-fg-dim">
              {recording ? "Press your shortcut…" : value ? value : "Not set"}
            </span>
          )}
        </div>

        {recording && (
          <>
            <button
              type="button"
              aria-label="Confirm shortcut"
              disabled={!canConfirm}
              onMouseDown={(event) => event.preventDefault()}
              onClick={confirm}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-md border transition-colors",
                canConfirm
                  ? "border-brand text-brand hover:bg-[var(--accent-soft)]"
                  : "border-border text-fg-dim opacity-60",
              )}
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Cancel recording"
              onMouseDown={(event) => event.preventDefault()}
              onClick={cancel}
              className="inline-flex size-7 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:border-border-strong"
            >
              <X className="size-3.5" />
            </button>
          </>
        )}
      </div>

      <p
        aria-live="polite"
        className={cn(
          "max-w-[280px] text-right text-[11px] leading-snug",
          problem ? "text-danger" : "text-fg-muted",
        )}
      >
        {message ??
          (recording
            ? "Press the combination, then release the keys and confirm with Enter — or click the check mark while still holding. Escape cancels."
            : "")}
      </p>
    </div>
  );
}
