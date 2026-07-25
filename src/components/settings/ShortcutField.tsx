import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardIcon } from "lucide-react";
import { FormRow } from "../shell";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import type { ShortcutBindingInfo, ShortcutValidation } from "../../types/ipc";
import { validateShortcut } from "../../lib/shortcuts";
import { HotkeyRecorder } from "./HotkeyRecorder";

// One settings row for one shortcut slot, shared by Capture and Modes so both
// surfaces obey the same contract. The default view is a human shortcut plus
// what the OS actually did with it; raw tokens appear only when the user opts
// into manual editing (T9).

interface Props {
  label: string;
  description: string;
  value: string;
  onCommit: (value: string) => void;
  /** Runtime truth for this slot: registered, or why not (T8). */
  binding?: ShortcutBindingInfo;
  /** Canonical values held by the other slots, for live collision feedback. */
  takenValues?: string[];
  allowModifierOnly?: boolean;
  /** Mode hotkeys may be cleared to mean "disabled" (T7). */
  clearable?: boolean;
  placeholder?: string;
  divider?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
}

export function ShortcutField({
  label,
  description,
  value,
  onCommit,
  binding,
  takenValues = [],
  allowModifierOnly = true,
  clearable = false,
  placeholder = "Ctrl+F9",
  divider = true,
  onStartRecording,
  onStopRecording,
}: Props) {
  const [manual, setManual] = useState(false);
  // The manual field edits a LOCAL DRAFT. Nothing is persisted, validated
  // destructively or registered until commit (T5). Per-keystroke saving was
  // what made typing impossible: intermediate states like `c` are themselves
  // valid single-key shortcuts and got registered as bare global grabs that
  // then swallowed the very letters being typed (D4).
  const [draft, setDraft] = useState(value);
  const [draftIssue, setDraftIssue] = useState<ShortcutValidation | null>(null);
  const [resolved, setResolved] = useState<ShortcutValidation | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    void validateShortcut(value, allowModifierOnly)
      .then((result) => {
        if (!cancelled) setResolved(result);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [allowModifierOnly, value]);

  useEffect(() => {
    if (!manual) {
      setDraftIssue(null);
      return;
    }
    let cancelled = false;
    void validateShortcut(draft, allowModifierOnly)
      .then((result) => {
        if (!cancelled) setDraftIssue(result);
      })
      .catch(() => {
        if (!cancelled) setDraftIssue(null);
      });
    return () => {
      cancelled = true;
    };
  }, [allowModifierOnly, draft, manual]);

  const commitDraft = useCallback(() => {
    if (draft.trim() === value.trim()) return;
    void validateShortcut(draft, allowModifierOnly).then((result) => {
      if (!result.ok) return;
      if (result.disabled && !clearable) return;
      if (result.canonical && takenValues.includes(result.canonical)) return;
      onCommit(result.canonical);
    });
  }, [allowModifierOnly, clearable, draft, onCommit, takenValues, value]);

  const status = useMemo(() => {
    if (!value.trim()) {
      return { tone: "muted" as const, text: "Disabled" };
    }
    if (resolved && !resolved.ok) {
      return {
        tone: "danger" as const,
        text: resolved.reason ?? "This shortcut cannot be registered.",
      };
    }
    if (binding?.error) {
      return { tone: "danger" as const, text: binding.error };
    }
    if (binding && !binding.registered) {
      return {
        tone: "danger" as const,
        text: "Not registered with the operating system.",
      };
    }
    if (binding?.registered) {
      return { tone: "ok" as const, text: "Registered" };
    }
    return { tone: "muted" as const, text: "Registration state unknown" };
  }, [binding, resolved, value]);

  const draftProblem = manual && draft.trim() && draftIssue && !draftIssue.ok
    ? draftIssue.reason
    : manual && draftIssue?.disabled && !clearable
      ? "This shortcut is required and cannot be empty."
      : null;

  const hint = resolved?.warning ?? description;

  return (
    <FormRow
      label={label}
      hint={hint}
      hintTone={resolved?.warning ? "danger" : undefined}
      align="start"
      divider={divider}
      control={
        <div className="flex flex-col items-end gap-2">
          <HotkeyRecorder
            value={value}
            display={resolved?.ok ? resolved.display : undefined}
            allowModifierOnly={allowModifierOnly}
            takenValues={takenValues}
            onChange={onCommit}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
            ariaLabel={`Record ${label}`}
          />

          <div className="flex items-center gap-2 text-[11px]">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                status.tone === "ok" && "text-fg-muted",
                status.tone === "danger" && "text-danger",
                status.tone === "muted" && "text-fg-dim",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block size-1.5 rounded-full",
                  status.tone === "ok" && "bg-[var(--ok)]",
                  status.tone === "danger" && "bg-[var(--danger)]",
                  status.tone === "muted" && "bg-border-strong",
                )}
              />
              {status.text}
            </span>

            <button
              type="button"
              className="inline-flex items-center gap-1 text-fg-muted underline-offset-2 hover:underline"
              onClick={() => {
                setManual((open) => !open);
                setDraft(value);
              }}
              aria-expanded={manual}
            >
              <KeyboardIcon className="size-3" />
              {manual ? "Hide manual entry" : "Enter manually"}
            </button>
          </div>

          {manual && (
            <div className="flex flex-col items-end gap-1">
              <Input
                autoFocus
                aria-label={`${label} manual entry`}
                className="w-[220px] font-mono text-[12px]"
                value={draft}
                placeholder={`e.g. ${placeholder}`}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitDraft();
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraft(value);
                  }
                }}
              />
              <p
                aria-live="polite"
                className={cn(
                  "max-w-[280px] text-right text-[11px] leading-snug",
                  draftProblem ? "text-danger" : "text-fg-muted",
                )}
              >
                {draftProblem ??
                  (draftIssue?.ok && draftIssue.display
                    ? `${draftIssue.display} — press Enter to apply.`
                    : clearable
                      ? "Combine keys with +, for example Ctrl+Alt+M. Leave empty to disable."
                      : "Combine keys with +, for example Ctrl+F9.")}
              </p>
            </div>
          )}
        </div>
      }
    />
  );
}
