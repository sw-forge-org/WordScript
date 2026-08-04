import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * THE HANDOFF CARD — `demo.js`'s `handoffCard()`.
 *
 * NOT A MEMBER OF THE WINDOW FAMILY and deliberately not shaped like one: no
 * title bar, no close control, no resize grip, because it is not a place you
 * work — it is one question with two answers that is on screen for about four
 * seconds. Window chrome would invite the user to move it, which would mean
 * remembering where they put it, which would mean it has a life. It does not.
 *
 * IT DOES NOT TAKE FOCUS, AND THAT IS THE HARD PART. The dictation overlay must
 * keep `focus: false` or the insert target moves out of the app being dictated
 * into, and this card stands in exactly that moment. So it cannot be a focused
 * dialog with a default button — it grabs two keys for as long as it is visible,
 * the same way the dictation hotkey is grabbed, and releases them when it
 * closes. Rust owns that, like every other shortcut (ADR 0006).
 *
 * ESCAPE IS NOT A CANCEL, IT IS A FALLBACK. Refusing the handoff does not throw
 * the dictation away: the text goes to the cursor as an ordinary dictation in
 * the mode the pill is showing. That is what makes the offer cheap enough to be
 * offered at all — a wrong guess costs one keystroke and no words.
 */
export function HandoffStage({ children }: { children: ReactNode }) {
  return <div className="ws-hoff-stage">{children}</div>;
}

export function Handoff({ children }: { children: ReactNode }) {
  return <div className="ws-hoff">{children}</div>;
}

export function HandoffHead({ title, why }: { title: string; why: string }) {
  return (
    <div className="ws-hoff-head">
      <Icon name="handoff" />
      <b>{title}</b>
      <span className="ws-hoff-why">{why}</span>
    </div>
  );
}

/**
 * THE DICTATION, VERBATIM. ADR 0030 requires the dictated prompt to be shown
 * verbatim before a run starts, and the reason is the same one that makes the
 * confirmation keyed rather than spoken: the input arrived over an unreliable
 * channel, so the last thing the user sees has to be the thing that will
 * actually be sent. Not a summary of it, not the desk's paraphrase of it.
 */
export function HandoffSaid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ws-hoff-said">
      <span className="ws-hoff-label">{label}</span>
      <p>{children}</p>
    </div>
  );
}

/**
 * WHAT IT WILL DO WITH IT. Four facts, and every one of them is configuration
 * that hangs on the target rather than on the utterance (ADR 0030) — which is
 * why they are stated and not spoken. Speech is a bad configuration language
 * and this surface does not ask it to be one: you said the intent, the rest was
 * set once.
 *
 * Two by two rather than four in a row: the pairs are (what it is, what it may
 * do) and (what it reads, what it can reach).
 */
export function HandoffGrid({ children }: { children: ReactNode }) {
  return <div className="ws-hoff-grid">{children}</div>;
}

export function HandoffCell({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="ws-hoff-cell">
      <span className="ws-hoff-label">{label}</span>
      <b>{value}</b>
      <span>{children}</span>
    </div>
  );
}

export function HandoffFoot({ keys, actions }: { keys: ReactNode; actions: ReactNode }) {
  return (
    <div className="ws-hoff-foot">
      <span className="ws-hoff-keys">{keys}</span>
      <span className="ws-rowflex">{actions}</span>
    </div>
  );
}

/** The two sentences, side by side. Only the desk half is tinted: the point is
 *  that one of the two crosses a line, and tinting both would say they are two
 *  flavours of the same thing. */
export function HandoffPair({ children }: { children: ReactNode }) {
  return <div className="ws-hoff-pair">{children}</div>;
}

export function HandoffSide({
  label,
  desk,
  out,
  outIcon,
  children,
}: {
  label: string;
  desk?: boolean;
  out: string;
  outIcon: IconName;
  children: ReactNode;
}) {
  return (
    <div className="ws-hoff-side" data-desk={desk ? "" : undefined}>
      <span className="ws-hoff-label">{label}</span>
      <p>{children}</p>
      <span className="ws-hoff-side-out">
        <Icon name={outIcon} />
        {out}
      </span>
    </div>
  );
}

/** A grid rather than a real table because the first column is a label and the
 *  other two are the things being compared, and a table header would claim the
 *  first cell is a column heading. */
export function LineCompare({ children }: { children: ReactNode }) {
  return <div className="ws-linecmp">{children}</div>;
}

export function LineCompareRow({
  head,
  cells,
}: {
  head?: boolean;
  cells: [ReactNode, ReactNode, ReactNode];
}) {
  return (
    <div className="ws-linecmp-row" data-head={head ? "" : undefined}>
      <span>{cells[0]}</span>
      <span>{cells[1]}</span>
      <span>{cells[2]}</span>
    </div>
  );
}

/**
 * WHAT CROSSES — and the second column is the argument.
 *
 * A list of what was handed over is a feature description. A list of what was
 * deliberately held back is the privacy boundary shown instead of asserted,
 * which is the only form in which ADR 0044's claim — the assistant reads this
 * disk, the desk reaches the network — is checkable by the person it is about.
 *
 * THE HELD COLUMN IS NOT TINTED RED. Nothing failed and nothing was blocked:
 * the material stayed where it belongs, which is the normal case and the good
 * one. The accent goes on the column that crossed, because it marks the thing
 * that leaves.
 */
export function Cross({ children }: { children: ReactNode }) {
  return <div className="ws-cross">{children}</div>;
}

export function CrossSide({
  label,
  icon,
  held,
  children,
}: {
  label: string;
  icon: IconName;
  held?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ws-cross-side" data-held={held ? "" : undefined}>
      <span className="ws-cross-label">
        <Icon name={icon} />
        {label}
      </span>
      <ul className="ws-cross-list">{children}</ul>
    </div>
  );
}

export function CrossItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <b>{title}</b>
      <span>{children}</span>
    </li>
  );
}

/** A numbered list, and the number is doing real work: this is the one sequence
 *  in the product where the order is the safety argument. */
export function CrossFlow({ children }: { children: ReactNode }) {
  return <ol className="ws-crossflow">{children}</ol>;
}

export function CrossFlowStep({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <b>{title}</b>
      <span>{children}</span>
    </li>
  );
}
