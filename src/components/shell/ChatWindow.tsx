import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import type { PopoutHandle } from "./usePopout";

/**
 * THE SMALL WINDOW — `demo.css`'s `.chatwin`, and the family Ask, Actions and
 * the meeting HUD all belong to.
 *
 * Chat was a separate workspace view, then a full-height panel welded to the
 * right edge of the note. Both are wrong for the same reason in opposite
 * directions: the view made you leave the note to ask about the note, and the
 * panel covered the note you were asking about.
 *
 * So it is a window. Always on top, movable, resizable — it can sit beside the
 * main window so the note and the answer are readable at once, which is the
 * entire point of asking. Drawn over the note here because that is where it
 * opens; nothing holds it there.
 *
 * ADR 0003: THE OS DRAWS THE FRAME. `ChatWinDeco` stands in for the decoration
 * strip exactly as the main window's does. No traffic lights are invented, and
 * the resize grip is the corner the compositor would give it.
 */
export function ChatWindow({
  className,
  style,
  children,
}: {
  className?: string;
  /** `usePopout`'s translation. Absent until somebody drags the strip. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={cn("ws-chatwin", className)} style={style}>
      {children}
      <span className="ws-hud-resize" aria-hidden />
    </div>
  );
}

export function ChatWinDeco({
  title,
  sub,
  actions,
  onMinimize,
  onClose,
  closeLabel = "Close",
  handle,
}: {
  title: string;
  /** A count or a boundary, in the middle. With one beside it the title stops
   *  growing and the close control keeps the right edge. */
  sub?: ReactNode;
  /** THE FOUR WINDOWS DO NOT ALL CLOSE THE SAME WAY, and the difference is the
   *  prototype's. Ask and Actions draw the strip's own bare buttons; the
   *  translation window reaches for `IconButton`, because at its width the
   *  control sits beside a language pair rather than alone at an edge. Passing
   *  the controls in is what keeps that a decision instead of a divergence. */
  actions?: ReactNode;
  onMinimize?: () => void;
  onClose?: () => void;
  closeLabel?: string;
  /** The strip has advertised `cursor: grab` since the port. This is what
   *  finally answers it — `usePopout`'s handlers, spread onto the strip. */
  handle?: PopoutHandle;
}) {
  return (
    <div className="ws-chatwin-deco" {...handle}>
      <b>{title}</b>
      {typeof sub === "string" ? <span className="ws-win-sub">{sub}</span> : sub}
      {actions ?? (
        <>
          {onMinimize && (
            <button type="button" aria-label="Minimize" onClick={onMinimize}>
              <Icon name="minus" />
            </button>
          )}
          <button type="button" aria-label={closeLabel} onClick={onClose}>
            <Icon name="x" />
          </button>
        </>
      )}
    </div>
  );
}

export function AiChatBody({ children }: { children: ReactNode }) {
  return <div className="ws-aichat-body">{children}</div>;
}

/**
 * The chat's boundary, stated once in its own foot: voice input is the
 * dictation hotkey rather than a second recording path, and nothing here is
 * kept.
 */
export function AiChatFoot({ children }: { children: ReactNode }) {
  return (
    <div className="ws-aichat-foot">
      <Icon name="mic" />
      <span>{children}</span>
    </div>
  );
}

/** A turn. `me` runs the other way — the rule is declared with the thread. */
export function Msg({ from, children }: { from: "me" | "ws"; children: ReactNode }) {
  return (
    <div className="ws-msg" data-from={from}>
      {children}
    </div>
  );
}

export function Bubble({
  head,
  copyLabel,
  children,
}: {
  head?: ReactNode;
  /** Revealed on hover and on focus, so a column of turns is not a column of
   *  buttons. */
  copyLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="ws-bubble">
      {head}
      {children}
      {copyLabel && (
        <button type="button" className="ws-copy" aria-label={copyLabel}>
          <Icon name="copy" />
        </button>
      )}
    </div>
  );
}

/**
 * Three dots, the one place a loop is the message. Opacity, not a hop: a
 * bouncing dot reads as decoration, and this is the only animation in the
 * surface that runs unattended.
 */
export function Typing() {
  return (
    <span className="ws-typing">
      <i />
      <i />
      <i />
    </span>
  );
}
