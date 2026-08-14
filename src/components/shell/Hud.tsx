import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import type { PopoutHandle } from "./usePopout";

/**
 * THE MEETING WINDOW — `demo.css`'s `.hud`.
 *
 * A SECOND WINDOW, not a second state of the dictation overlay. The pill is
 * 440 × 60, never takes focus, and lives for seconds because it must not move
 * the insert target away from the app being dictated into. A meeting runs for
 * an hour, inserts nothing, and has to be read while you talk — so it may be
 * moved, resized and focused, because there is no insert target to protect.
 *
 * IT IS THE NOTE, LIVE. Not a control panel for a recorder: during a call you
 * are not operating a recording, you are reading and writing the note the call
 * is producing. Same three tabs it will have in Context afterwards, so there is
 * nothing to learn twice and nothing to migrate when the meeting ends.
 *
 * THE LEVEL READOUT IS DRAWN AT REST HERE (ADR 0058). In the prototype it runs,
 * because a window whose whole claim is that it is recording right now cannot
 * carry a frozen waveform. In the gallery it holds one frame: a moving
 * instrument is a claimed measurement, and this screen measures nothing.
 */
export function HudRow({ children }: { children: ReactNode }) {
  return <div className="ws-hud-row">{children}</div>;
}

export function HudWrap({ children }: { children: ReactNode }) {
  return <div className="ws-hud-wrap">{children}</div>;
}

export function Hud({
  className,
  style,
  children,
}: {
  /** `ws-hud-popout` when it stands over another surface rather than in flow. */
  className?: string;
  /** `usePopout`'s translation. Absent until somebody drags the strip. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={cn("ws-hud", className)} style={style}>
      {children}
      <span className="ws-hud-resize" aria-hidden />
    </div>
  );
}

/** ADR 0003: the OS draws the frame. This stands in for it, exactly as the
 *  main window's strip does — no traffic lights are invented here either. */
export function HudDeco({
  children,
  handle,
  actions,
}: {
  children: ReactNode;
  /** `usePopout`'s handlers, when this HUD is a pop-out over another surface. */
  handle?: PopoutHandle;
  /** A close control, for the same case. In the product the OS draws one. */
  actions?: ReactNode;
}) {
  return (
    <div className="ws-hud-deco" {...handle}>
      {children}
      {actions}
    </div>
  );
}

export function HudHead({ children }: { children: ReactNode }) {
  return <div className="ws-hud-head">{children}</div>;
}

/** The title and the date come from the calendar entry, not from a filename and
 *  not from a prompt asking what to call this. That is what the intake buys:
 *  the object existed before the recording did (§11.41). */
export function HudTitle({ title, date }: { title: string; date: ReactNode }) {
  return (
    <div className="ws-row1">
      <div className="ws-grow">
        <h3>{title}</h3>
        {date}
      </div>
    </div>
  );
}

export function HudTabs({ children }: { children: ReactNode }) {
  return <div className="ws-hud-tabs">{children}</div>;
}

/**
 * One line of state, not the subject. `elapsed` is monospaced and tabular so a
 * running clock does not shift the row it sits in.
 */
export function HudState({ children }: { children: ReactNode }) {
  return <div className="ws-hud-state">{children}</div>;
}

export function HudElapsed({ children }: { children: ReactNode }) {
  return <span className="ws-el">{children}</span>;
}

export function HudScroll({ children }: { children: ReactNode }) {
  return <div className="ws-hud-scroll">{children}</div>;
}

/** A caption under a drawn window, so a mock is never mistaken for a
 *  screenshot. */
export function HudCap({ children }: { children: ReactNode }) {
  return (
    <span className="ws-hud-cap">
      <Icon name="monitor" />
      {children}
    </span>
  );
}

/**
 * THE COPILOT LANE — ADR 0047, §11.46. One strip above the bar, one hint at a
 * time, and it replaces itself.
 *
 * It is not a panel and it is not a stream in the transcript, and both of those
 * were considered. A hint belongs to a moment, so putting it in the transcript
 * column anchors it correctly — and then it scrolls away while new lines
 * arrive, which means the hint you needed is the one you missed. During a call
 * nobody scrolls back; they watch the bottom edge, where the new text appears.
 *
 * TWO RULES IT MAY NOT BREAK, and they are the whole of its design.
 *
 * IT NEVER SPEAKS. The one spoken path in this product is the desk's, and it is
 * guarded (ADR 0030). A second voice talking over a meeting is a product
 * defect, and it would be talking into a microphone that is recording.
 *
 * IT NEVER HINTS WITHOUT A CITATION. Every hint carries the place it came from
 * and the link is part of the hint, not an affordance beside it — which is why
 * `source` is required rather than optional. ADR 0040 already made this a
 * contract for the assistant, and a hint whispered mid-meeting is the
 * highest-cost place in the product to be confidently wrong.
 */
export function Copilot({ text, source }: { text: string; source: string }) {
  return (
    <div className="ws-cop">
      <Icon name="sparkle" />
      <div className="ws-cop-text">
        <b>{text}</b>
        <button type="button" className="ws-cop-src">
          <Icon name="inspect" />
          {source}
        </button>
      </div>
      <button type="button" className="ws-cop-x" aria-label="Dismiss">
        <Icon name="x" />
      </button>
    </div>
  );
}

/**
 * THE THREE STAGES OF A SPEAKER NAME (ADR 0047). Numbered because they are
 * ordered and each one depends on the one above, which a plain list of rows
 * would not say. The right-hand tag carries what each stage costs, since
 * "free", "a second pass" and "not audio at all" is the comparison the reader
 * is making.
 */
export function StageList({ children }: { children: ReactNode }) {
  return <div className="ws-stagelist">{children}</div>;
}

export function StageRow({
  n,
  title,
  children,
  tag,
}: {
  n: string;
  title: string;
  children: ReactNode;
  tag: string;
}) {
  return (
    <div className="ws-stage-row">
      <span className="ws-stage-n">{n}</span>
      <div className="ws-stage-text">
        <b>{title}</b>
        <span>{children}</span>
      </div>
      <span className="ws-stage-tag ws-mono">{tag}</span>
    </div>
  );
}
