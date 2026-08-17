import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
// symptom (D1). The chord is accumulated and shown live.
//
// WHAT ADR 0201 NARROWED, AND WHY. T1 was written as one rule for every chord,
// and it cost a keystroke on every assignment: press the combination, then say
// again that you meant it. The D1 hazard is not the release edge — it is a
// chord that cannot be told apart from an unfinished one, and only a
// modifier-only chord has that property. `Ctrl+Shift+D` is finished the moment
// the keys come up; `Ctrl` is a prefix of everything the user might still be
// reaching for. So a chord with a non-modifier key commits when the last key is
// released, and a modifier-only chord, a runtime warning and a collision each
// still wait for the confirmation they were always the reason for.
//
// THERE ARE NO BUTTONS. A check mark and a cross beside a pill that already
// commits on release are two controls for gestures the widget performs by
// itself — the keys you are already touching say everything: let go to set,
// Escape to cancel, Backspace to clear, Enter for the one chord the release
// edge cannot finish. Two lines of instructions under a control this small were
// the same mistake in prose.

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
  /** Records from the moment it mounts. A caller that has ALREADY spent the
   *  user's click getting here — a row that swaps its button for this widget —
   *  must set it, or that click buys a widget that looks like it is listening
   *  and is not. */
  autoStart?: boolean;
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
  autoStart = false,
}: Props) {
  const [vocabulary, setVocabulary] = useState<ShortcutVocabulary | null>(null);
  /* An autostarting recorder is recording ON ITS FIRST FRAME. Starting it from
     an effect meant the idle pill — stored caps, no ring, "Change" gone — was
     painted first and replaced a moment later, and the vocabulary it waited for
     is a runtime round trip, so the moment was long enough to see. The keys
     need the vocabulary; the state does not. */
  const [recording, setRecording] = useState(autoStart && !disabled);
  const [chord, setChord] = useState<ChordState>(EMPTY_CHORD);
  const [validation, setValidation] = useState<ShortcutValidation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /* Every key event re-arms the timeout. A ten-second budget that starts at the
     first click is a budget for deciding, not for typing. */
  const [activity, setActivity] = useState(0);

  const heldModifiersRef = useRef<Set<string>>(new Set());
  /* The non-modifier key currently down. Held separately from the chord because
     the chord remembers the largest grip and this remembers the live one — the
     difference is what "the user has let go of everything" means. */
  const heldKeyRef = useRef<string | null>(null);
  const chordRef = useRef<ChordState>(EMPTY_CHORD);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* A release can arrive twice on X11 — measured, not assumed (see
     `docs/known-issues/capture-shortcut-recording.md`, S0 run 1). Validation is
     async, so without this the second release commits a second time into a
     recorder that has already closed. */
  const commitInFlightRef = useRef(false);
  const autoStartedRef = useRef(false);
  const pillRef = useRef<HTMLDivElement>(null);

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
    heldKeyRef.current = null;
    commitInFlightRef.current = false;
    // Always put the OS grabs back, even when the recording was cancelled.
    void resumeGlobalShortcuts();
    onStopRecording?.();
  }, [clearTimer, onStopRecording]);

  const cancel = useCallback(() => {
    setNotice(null);
    finishRecording();
  }, [finishRecording]);

  /** Empties the slot. Clearing is a value in its own right (T7) — the runtime
   *  reads an empty shortcut as "disabled", which is why removing one does not
   *  require choosing a replacement first. */
  const clear = useCallback(() => {
    setNotice(null);
    onChange("");
    finishRecording();
  }, [finishRecording, onChange]);

  /**
   * Writes the accumulated chord, or states why it did not.
   *
   * `auto` is the release edge rather than a deliberate confirmation, so it
   * holds back on everything a keystroke should not decide alone: a warning the
   * runtime attached, and a value another slot already owns. It stays silent on
   * an outright invalid chord because the live pill is already saying so.
   */
  const commitChord = useCallback(
    (auto: boolean) => {
      const current = chordRef.current;
      if (!vocabulary || (current.modifiers.length === 0 && !current.key)) {
        if (!auto) cancel();
        return;
      }
      if (commitInFlightRef.current) return;
      commitInFlightRef.current = true;

      const candidate = chordToValue(vocabulary, current);
      void validateShortcut(candidate, allowModifierOnly)
        .then((result) => {
          if (!result.ok) {
            if (!auto) setNotice(result.reason);
            commitInFlightRef.current = false;
            return;
          }
          if (takenValues.includes(result.canonical)) {
            setNotice(`${result.display} is already used by another shortcut.`);
            commitInFlightRef.current = false;
            return;
          }
          if (auto && result.warning) {
            setNotice(`${result.warning} Press Enter to keep it anyway.`);
            commitInFlightRef.current = false;
            return;
          }
          setNotice(result.warning);
          onChange(result.canonical);
          finishRecording();
        })
        .catch(() => {
          commitInFlightRef.current = false;
        });
    },
    [allowModifierOnly, cancel, finishRecording, onChange, takenValues, vocabulary],
  );

  const confirm = useCallback(() => commitChord(false), [commitChord]);

  const beginRecording = useCallback(() => {
    setNotice(null);
    setValidation(null);
    setChord(EMPTY_CHORD);
    chordRef.current = EMPTY_CHORD;
    heldModifiersRef.current.clear();
    heldKeyRef.current = null;
    commitInFlightRef.current = false;
    setRecording(true);
    // Release the OS grabs first — a grabbed combination goes to the grab
    // owner, not to this window, so the shortcut in use would be invisible
    // here (D3).
    void suspendGlobalShortcuts();
    onStartRecording?.();
  }, [onStartRecording]);

  /** The click path. It waits for the vocabulary because a recorder nobody has
   *  opened yet loses nothing by staying a button. */
  const startRecording = useCallback(() => {
    if (disabled || !vocabulary) return;
    beginRecording();
  }, [beginRecording, disabled, vocabulary]);

  /* The autostart path does NOT wait for it — the state is already `recording`
     from the initial render, and this is the side of it that cannot happen
     during a render. Once: a re-render after a rejected chord must not restart
     a recording the user is in the middle of. */
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || disabled) return;
    autoStartedRef.current = true;
    beginRecording();
    pillRef.current?.focus();
  }, [autoStart, beginRecording, disabled]);

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
        lines: [
          `[keyprobe] phase=${phase} code=${event.code} key=${event.key} mapped=${mapped} ` +
          `ctrl=${event.ctrlKey} alt=${event.altKey} shift=${event.shiftKey} meta=${event.metaKey} ` +
          `repeat=${event.repeat}`,
        ],
      }).catch(() => undefined);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      probe(event, "keydown");

      if (event.repeat) return;
      setActivity((tick) => tick + 1);

      // Enter confirms, Escape cancels and Backspace clears — each only while
      // no modifier is held. With a modifier down they are ordinary chord
      // members, which is what makes the default abort shortcut
      // `Ctrl+Alt+Escape` recordable at all (D8) — the old recorder hardwired
      // Escape to "cancel" before looking at modifiers.
      const hasModifier = heldModifiersRef.current.size > 0;
      if (!hasModifier && event.code === "Escape") {
        cancel();
        return;
      }
      if (!hasModifier && (event.code === "Enter" || event.code === "NumpadEnter")) {
        confirm();
        return;
      }
      if (!hasModifier && (event.code === "Backspace" || event.code === "Delete")) {
        clear();
        return;
      }

      /* A press with nothing else down starts a fresh chord. The largest grip
         wins WITHIN one grip; across two of them the older one is a leftover,
         and after a rejected chord it is a leftover the user is trying to
         replace. */
      const startsNewGrip = heldModifiersRef.current.size === 0 && heldKeyRef.current === null;
      const carriedKey = startsNewGrip ? null : chordRef.current.key;

      const modifier = modifierTokenForCode(vocabulary, event.code);
      if (modifier) {
        heldModifiersRef.current.add(modifier);
        const next: ChordState = {
          modifiers: [...heldModifiersRef.current],
          key: carriedKey,
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
      heldKeyRef.current = event.code;
      const next: ChordState = { modifiers: [...heldModifiersRef.current], key: event.code };
      chordRef.current = next;
      setChord(next);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      probe(event, "keyup");
      setActivity((tick) => tick + 1);

      const modifier = modifierTokenForCode(vocabulary, event.code);
      if (modifier) {
        heldModifiersRef.current.delete(modifier);
      } else if (heldKeyRef.current === event.code) {
        heldKeyRef.current = null;
      }
      // Releasing a key never shrinks the chord — the largest grip is what the
      // user gets (T1). What it can do is END the recording: once nothing is
      // held any more and the chord carries a real key, the combination is
      // finished by construction and is written without a second gesture
      // (ADR 0201). A modifier-only chord is not finished by construction, so
      // it stays on screen for the confirmation.
      const nothingHeld = heldModifiersRef.current.size === 0 && heldKeyRef.current === null;
      if (nothingHeld && chordRef.current.key) {
        commitChord(true);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [cancel, clear, commitChord, confirm, recording, vocabulary]);

  // A recorder left open would keep the whole lane ungrabbed. Time it out —
  // from the last key event, not from the start.
  useEffect(() => {
    if (!recording) return;
    timeoutRef.current = setTimeout(() => {
      setNotice("Recording timed out — nothing was changed.");
      finishRecording();
    }, RECORDING_TIMEOUT_MS);
    return clearTimer;
  }, [activity, clearTimer, finishRecording, recording]);

  useEffect(() => clearTimer, [clearTimer]);

  const liveLabels = vocabulary ? chordToKeyLabels(vocabulary, chord) : [];
  const storedLabels = displayToKeyLabels(display ?? value);
  const labels = recording ? liveLabels : storedLabels;
  const problem = recording && validation && !validation.ok ? validation.reason : null;
  const message = problem ?? notice;
  /* The one chord the release edge cannot finish is the one that needs the
     sentence, so the hint answers the state the user is actually in. */
  const awaitingKey = recording && chord.modifiers.length > 0 && !chord.key;

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        ref={pillRef}
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
        /* The slot's name and the widget's state are both in it. A caller's
           `ariaLabel` used to REPLACE the state, so a recorder that was
           listening announced itself as one that was not. */
        aria-label={
          recording
            ? `Recording ${ariaLabel ?? "shortcut"}, press your keys`
            : `Record ${ariaLabel ?? "shortcut"}`
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

      <p
        aria-live="polite"
        className={cn(
          "max-w-[280px] text-right text-[11px] leading-snug",
          problem ? "text-danger" : "text-fg-muted",
        )}
      >
        {message ??
          (recording
            ? awaitingKey
              ? "Add a key, or let go and press Enter for these alone."
              : "Esc cancels · Backspace clears"
            : "")}
      </p>
    </div>
  );
}
