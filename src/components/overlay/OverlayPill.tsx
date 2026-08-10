import { type ChangeEvent, type ReactNode } from "react";
import {
  Ban,
  Check,
  Clipboard,
  CornerDownLeft,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import "../../styles/overlay-pill.css";

/* ── Public types ────────────────────────────────────────────────────────── */

export type OverlayProcessingMode =
  | "auto"
  | "verbatim"
  | "cleanup"
  | "rewrite"
  | "translate"
  | "prompt_enhance"
  | "agent";

/**
 * The recording's auto-stop, as the overlay states it.
 *
 * Rendered beside the pill, not inside it: in the flow it would widen the pill,
 * and a pill wider than the 480px window has its rounded ends clipped — the
 * defect the uniform window width exists to prevent.
 */
export type OverlayRecordingLimit = {
  /** Short form: "Ends 12:00" far out, "01:24 left" close in. */
  text: string;
  /** Sharpens as the auto-stop approaches. */
  tone: "neutral" | "warning" | "danger";
  /** The full sentence, for the tooltip and the screen reader. */
  label: string;
};

export type OverlayPendingPreview = { action: "commit" | "abort"; label: string };
export type OverlayPendingResult = { action: "copy" | "edit" | "insert"; label: string };

export type OverlayPillState =
  | {
      kind: "recording";
      mode: OverlayProcessingMode;
      muted: boolean;
      paused: boolean;
      level: number;
      elapsedSec: number;
      onMuteToggle?: () => void;
      onPauseToggle?: () => void;
      onCycleMode?: () => void;
    }
  | {
      kind: "processing";
      mode: OverlayProcessingMode;
      elapsedSec: number;
      preview?: { text: string; clipboardOnly: boolean };
      pending?: OverlayPendingPreview;
      onCommit?: () => void;
      onEdit?: () => void;
      onAbort?: () => void;
      onCycleMode?: () => void;
    }
  | {
      kind: "result-actions";
      text: string;
      clipboardOnly: boolean;
      autoCloseSec: number;
      pending?: OverlayPendingResult;
      onCopy?: () => void;
      onEdit?: () => void;
      onInsert?: () => void;
      onDismiss?: () => void;
    }
  | {
      kind: "edit-mode";
      text: string;
      /** What confirming actually does, which depends on where the edit was
       *  opened. From the pre-delivery preview it delivers the corrected text;
       *  from the result surface the original text is already at the cursor and
       *  cannot be retracted, so confirming only puts the correction on the
       *  clipboard. The label must say which. */
      confirmLabel: string;
      busy?: boolean;
      onTextChange?: (text: string) => void;
      onConfirm?: () => void;
      onCancel?: () => void;
    }
  | {
      kind: "mode-picker";
      mode: OverlayProcessingMode;
      onCycleMode?: () => void;
    }
  | {
      kind: "error";
      message: string;
      /** Present only when the runtime kept the failed session's audio, so
       *  there is something for a retry to work from. A Retry that has nothing
       *  behind it is a button that lies. */
      onRetry?: () => void;
      retrying?: boolean;
    };

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const BAR_COUNT = 11;
const MIN_BAR = 5;
const MAX_BAR = 30;
const IDLE_BARS = [5, 7, 9, 12, 15, 17, 15, 12, 9, 7, 5];

function modeShortLabel(mode: OverlayProcessingMode): string {
  switch (mode) {
    case "auto": return "Auto";
    case "cleanup": return "Cleanup";
    case "rewrite": return "Rewrite";
    case "translate": return "Translate";
    case "agent": return "Agent";
    case "verbatim": return "Verbatim";
    case "prompt_enhance": return "Enhance";
    default: return "Cleanup";
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function levelToBars(level: number): number[] {
  const clamped = Math.min(1, Math.max(0, level));
  if (clamped < 0.018) return [...IDLE_BARS];

  const gain = Math.min(1, clamped * 2.9);
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    const center = (BAR_COUNT - 1) / 2;
    const distance = Math.abs(index - center) / center;
    const falloff = 1 - distance * 0.42;
    const wobble = 1 - Math.abs(((index * 1.7) % 5) - 2) / 6;
    const energy = Math.min(1, gain * falloff * wobble * 1.25);
    return Math.round(MIN_BAR + (MAX_BAR - MIN_BAR) * energy);
  });
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function OverlayPill({ state }: { state: OverlayPillState }) {
  switch (state.kind) {
    case "recording":      return <RecordingPill state={state} />;
    case "processing":     return <ProcessingPill state={state} />;
    case "result-actions": return <ResultActionsPill state={state} />;
    case "edit-mode":      return <EditPill state={state} />;
    case "mode-picker":    return <ModePickerPill state={state} />;
    case "error":          return <ErrorPill state={state} />;
  }
}

export default OverlayPill;

/* ─ Recording ────────────────────────────────────────────────────────────── */

function RecordingPill({ state }: { state: Extract<OverlayPillState, { kind: "recording" }> }) {
  const classes = ["pill", "pill--compact", "pill--recording"];
  if (state.muted) classes.push("pill--muted");
  if (state.paused) classes.push("pill--paused");

  return (
    <div className={classes.join(" ")}>
      <MicButton muted={state.muted} onClick={state.onMuteToggle} />
      <Bars heights={levelToBars(state.level)} muted={state.muted} />
      <span className="pill__divider" aria-hidden="true" />
      <ModeChip mode={state.mode} onClick={state.onCycleMode} />
      <span className="pill__divider" aria-hidden="true" />
      <Timer
        seconds={state.elapsedSec}
        paused={state.paused}
        onTogglePause={state.onPauseToggle}
      />
    </div>
  );
}

/* ── Processing ───────────────────────────────────────────────────────────── */

function ProcessingPill({ state }: { state: Extract<OverlayPillState, { kind: "processing" }> }) {
  if (state.preview) {
    return (
      <div className="pill pill--preview-actions pill--processing">
        <MicButton muted={false} disabled />
        <PreviewText text={state.preview.text} preliminary />
        <PreviewActions
          clipboardOnly={state.preview.clipboardOnly}
          pending={state.pending}
          onCommit={state.onCommit}
          onEdit={state.onEdit}
          onAbort={state.onAbort}
        />
        <span className="pill__divider" aria-hidden="true" />
        <Timer seconds={state.elapsedSec} />
        <span className="pill__divider" aria-hidden="true" />
        <IconAction
          icon={<Loader2 size={16} strokeWidth={2.25} className="pill__spinner" />}
          label="Working"
          disabled
        />
      </div>
    );
  }

  return (
    <div className="pill pill--compact pill--processing">
      <MicButton muted={false} disabled />
      <Bars heights={IDLE_BARS} muted={false} />
      <span className="pill__divider" aria-hidden="true" />
      <ModeChip mode={state.mode} onClick={state.onCycleMode} />
      <span className="pill__divider" aria-hidden="true" />
      <Timer seconds={state.elapsedSec} />
      <span className="pill__divider" aria-hidden="true" />
      <IconAction
        icon={<Loader2 size={16} strokeWidth={2.25} className="pill__spinner" />}
        label="Working"
        disabled
      />
    </div>
  );
}

/* ── Result actions ───────────────────────────────────────────────────────── */

function ResultActionsPill({ state }: { state: Extract<OverlayPillState, { kind: "result-actions" }> }) {
  const classes = ["pill", "pill--result-actions"];
  if (state.clipboardOnly) classes.push("pill--clipboard");
  return (
    <div className={classes.join(" ")}>
      <PreviewText text={state.text} />
      <ResultActions
        clipboardOnly={state.clipboardOnly}
        pending={state.pending}
        onCopy={state.onCopy}
        onEdit={state.onEdit}
        onInsert={state.onInsert}
      />
      <IconAction
        icon={<X size={16} strokeWidth={2.25} />}
        label="Dismiss"
        onClick={state.onDismiss}
      />
    </div>
  );
}

/* ── Edit mode (tall capsule) ────────────────────────────────────────────── */

function EditPill({ state }: { state: Extract<OverlayPillState, { kind: "edit-mode" }> }) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    state.onTextChange?.(e.target.value);
  };

  return (
    <div className="pill pill--edit-mode">
      <div className="pill__edit-body">
        <textarea
          className="pill__edit-textarea"
          value={state.text}
          onChange={handleChange}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          aria-label="Edit transcription text"
          spellCheck={false}
        />
        <div className="pill__edit-footer">
          <IconAction
            icon={<Check size={16} strokeWidth={2.25} />}
            label={state.confirmLabel}
            primary
            busy={state.busy}
            disabled={!state.text.trim()}
            onClick={state.onConfirm}
          />
          <IconAction
            icon={<X size={16} strokeWidth={2.25} />}
            label="Cancel"
            disabled={state.busy}
            onClick={state.onCancel}
          />
        </div>
      </div>
      <span className="pill__resize-handle" aria-hidden="true" title="Resize" />
    </div>
  );
}

/* ── Error ────────────────────────────────────────────────────────────────── */

function ErrorPill({ state }: { state: Extract<OverlayPillState, { kind: "error" }> }) {
  return (
    <div className="pill pill--compact pill--error">
      <span className="pill__error-icon" aria-hidden="true">
        <Ban size={18} strokeWidth={2.25} />
      </span>
      <span className="pill__error-text" title={state.message}>{state.message}</span>
      {/* The one surface where a failure could previously only be read. When
          the runtime kept the recording, the error is recoverable and the
          overlay is where the user already is — sending them to the history
          list to act on something that just happened here is a detour. */}
      {state.onRetry && (
        <>
          <span className="pill__divider" aria-hidden="true" />
          <IconAction
            icon={<RotateCcw size={16} strokeWidth={2.25} />}
            label="Retry from the recording"
            primary
            busy={state.retrying}
            onClick={state.onRetry}
          />
        </>
      )}
    </div>
  );
}

/* ── Mode picker (idle selector) ──────────────────────────────────────────── */

function ModePickerPill({ state }: { state: Extract<OverlayPillState, { kind: "mode-picker" }> }) {
  return (
    <div className="pill pill--compact pill--mode-picker">
      <Bars heights={IDLE_BARS} muted={false} />
      <span className="pill__divider" aria-hidden="true" />
      <ModeChip mode={state.mode} onClick={state.onCycleMode} />
    </div>
  );
}

/* ── Shared sub-components ────────────────────────────────────────────────── */

function MicButton({ muted, onClick, disabled }: { muted: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="pill__mic"
      onClick={onClick}
      aria-pressed={muted}
      aria-label={muted ? "Unmute microphone" : "Mute microphone"}
      title={muted ? "Unmute" : "Mute"}
      disabled={disabled}
    >
      {muted ? <MicOff size={18} strokeWidth={2.25} /> : <Mic size={18} strokeWidth={2.25} />}
    </button>
  );
}

function Bars({ heights, muted }: { heights: number[]; muted: boolean }) {
  return (
    <div className="pill__bars" aria-label="Audio level">
      {heights.map((h, i) => (
        <span key={i} className={`bar${muted ? " bar--muted" : ""}`} style={{ height: h }} />
      ))}
    </div>
  );
}

function Timer({
  seconds,
  paused,
  onTogglePause,
}: {
  seconds: number;
  paused?: boolean;
  onTogglePause?: () => void;
}) {
  const content = formatElapsed(seconds);
  if (onTogglePause) {
    return (
      <button
        type="button"
        className="pill__timer"
        onClick={onTogglePause}
        aria-label={paused ? "Resume recording" : "Pause recording"}
        title={paused ? "Resume recording" : "Pause recording"}
      >
        {content}
      </button>
    );
  }
  return (
    <span className="pill__timer" aria-label={`Elapsed time ${content}`}>
      {content}
    </span>
  );
}

function ModeChip({ mode, onClick }: { mode: OverlayProcessingMode; onClick?: () => void }) {
  const label = modeShortLabel(mode);
  return (
    <button
      type="button"
      className="pill__mode"
      onClick={onClick}
      aria-label={`Mode ${label}, tap to cycle`}
      title={`Mode: ${label} · tap to cycle`}
    >
      <span className="pill__mode-dot" aria-hidden="true" />
      <span className="pill__mode-label">{label}</span>
    </button>
  );
}

function PreviewText({ text, preliminary }: { text: string; preliminary?: boolean }) {
  return (
    <span className={`pill__preview-text${preliminary ? " pill__preview-text--preliminary" : ""}`} title={text}>
      {text}
    </span>
  );
}

function PreviewActions({
  clipboardOnly,
  pending,
  onCommit,
  onEdit,
  onAbort,
}: {
  clipboardOnly: boolean;
  pending?: OverlayPendingPreview;
  onCommit?: () => void;
  onEdit?: () => void;
  onAbort?: () => void;
}) {
  const committing = pending?.action === "commit";
  const aborting = pending?.action === "abort";
  // A missing handler means this surface is a replay, not a live decision (the
  // leave hold paints the last frame from a snapshot). Rendering the buttons as
  // enabled there produced a Copy button that looked completely normal and did
  // nothing — in clipboard-only runs that reads as "the overlay froze and ate
  // my transcript". Absent handler == not interactive, no extra prop needed.
  const held = !onCommit && !onEdit && !onAbort;
  return (
    <div className="pill__action-group" role="group" aria-label="Preview actions">
      <IconAction
        icon={clipboardOnly
          ? <Clipboard size={16} strokeWidth={2.25} />
          : <CornerDownLeft size={16} strokeWidth={2.25} />}
        label={clipboardOnly ? "Copy" : "Insert"}
        busy={committing}
        primary
        disabled={Boolean(pending) || held}
        onClick={onCommit}
      />
      {/* This is the surface where the text has NOT been delivered yet, so it
          is the one place where editing can still change what gets delivered.
          The result surface's Edit can only offer a corrected copy. */}
      <IconAction
        icon={<Pencil size={16} strokeWidth={2.25} />}
        label="Edit"
        disabled={Boolean(pending) || held}
        onClick={onEdit}
      />
      <IconAction
        icon={<Square size={16} strokeWidth={2.25} />}
        label="Abort"
        busy={aborting}
        disabled={Boolean(pending) || held}
        onClick={onAbort}
      />
    </div>
  );
}

function ResultActions({
  clipboardOnly,
  pending,
  onCopy,
  onEdit,
  onInsert,
}: {
  clipboardOnly: boolean;
  pending?: OverlayPendingResult;
  onCopy?: () => void;
  onEdit?: () => void;
  onInsert?: () => void;
}) {
  return (
    <div className="pill__action-group" role="group" aria-label="Result actions">
      <IconAction
        icon={<Clipboard size={16} strokeWidth={2.25} />}
        label="Copy"
        busy={pending?.action === "copy"}
        disabled={Boolean(pending)}
        onClick={onCopy}
      />
      <IconAction
        icon={<Pencil size={16} strokeWidth={2.25} />}
        label="Edit"
        busy={pending?.action === "edit"}
        disabled={Boolean(pending)}
        onClick={onEdit}
      />
      {clipboardOnly && (
        <IconAction
          icon={<CornerDownLeft size={16} strokeWidth={2.25} />}
          label="Insert"
          busy={pending?.action === "insert"}
          primary
          disabled={Boolean(pending)}
          onClick={onInsert}
        />
      )}
    </div>
  );
}

/** Icon-only action button. Busy state swaps the icon for a spinner.
 *  Primary (Insert/Confirm) uses an accent-filled background to stand out
 *  from the ghost peers. Every instance carries title + aria-label. */
function IconAction({
  icon,
  label,
  busy,
  primary,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  busy?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`pill__action${primary ? " pill__action--primary" : ""}`}
      onClick={busy ? undefined : onClick}
      disabled={disabled || busy}
      aria-label={label}
      title={label}
    >
      <span className="pill__action-icon" aria-hidden="true">
        {busy
          ? <Loader2 size={16} strokeWidth={2.5} className="pill__spinner" />
          : icon}
      </span>
    </button>
  );
}
