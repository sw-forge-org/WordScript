import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { StatusBadge } from "./StatusBadge";

/**
 * ACTIONS & TEMPLATES — the third member of the window family.
 *
 * §11.20 answered where a template lives — Markdown files in `_actions/`
 * beside the notes — and put the management of them in Settings → Notes &
 * Meetings. That was wrong, and this is the correction (§11.25). An action is
 * not configuration: it is a prompt you write, run, read the result of, and
 * edit because the result was not what you wanted — a loop that happens
 * entirely inside a note. Sending it to a settings section breaks the loop at
 * every turn. Settings is for what you set once; this is authoring, so it
 * lives where the authoring is.
 *
 * BUILT AS A WINDOW, NOT A DIALOG, and not a docked panel either. Ask is a
 * small always-on-top window and this is reached from the button beside it, so
 * it has to BE the same thing — two overlays that open from adjacent buttons
 * and behave differently teach two rules for one gesture. Not modal, for the
 * reason the panel was not: the note underneath is the evidence for whether a
 * prompt is right, and greying out your own evidence is a dialog that has
 * forgotten what it is for.
 */
export function ActionsBody({ children }: { children: ReactNode }) {
  return <div className="ws-actions-body">{children}</div>;
}

export function ActionsList({ children }: { children: ReactNode }) {
  return <div className="ws-actions-list">{children}</div>;
}

/**
 * ONE LIST, TWO KINDS, AND THE RULE BETWEEN THEM (§11.30, §11.43).
 *
 * An action declares who runs it, and the two kinds differ in every way that
 * matters to the person about to press the button:
 *
 *   assistant   seconds · produces text · no effects · runs on this object
 *   desk        minutes · produces effects · runs somewhere else · confirmed
 *               by key before it starts
 *
 * They stay in ONE list because the user's intent is one intent — "do this
 * with what I have here" — and splitting the list would ask them to classify
 * their own idea before they can act on it. What must not be shared is the
 * button: a desk action starts a process, so it goes through the same keyed
 * confirmation a dictated handoff does.
 */
export function ActionsRule({ children }: { children: ReactNode }) {
  return (
    <div className="ws-actions-rule">
      <span>{children}</span>
    </div>
  );
}

export function ActionRow({
  icon,
  name,
  description,
  builtin,
  current,
  onClick,
}: {
  icon: IconName;
  name: string;
  description: string;
  /** Readable and runnable but not editable. "Duplicate" is how you get an
   *  editable one, so the shipped prompt is a starting point, not a black box. */
  builtin?: boolean;
  current?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="ws-action-row"
      aria-current={current ? "true" : "false"}
      onClick={onClick}
    >
      <Icon name={icon} />
      <span className="ws-action-text">
        <b>{name}</b>
        <span>{description}</span>
      </span>
      {builtin && <StatusBadge tone="plan">Built-in</StatusBadge>}
    </button>
  );
}

export function ActionNew({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="ws-action-new" onClick={onClick}>
      <Icon name="plus" />
      {children}
    </button>
  );
}

export function ActionsEdit({ children }: { children: ReactNode }) {
  return <div className="ws-actions-edit">{children}</div>;
}

/** Two decisions side by side, because they are one decision in two halves:
 *  which repository, and what it may do there. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="ws-field-row">{children}</div>;
}

export function ActionsDesk({ children }: { children: ReactNode }) {
  return <div className="ws-actions-desk">{children}</div>;
}

export function ActionsFoot({ children }: { children: ReactNode }) {
  return <div className="ws-actions-foot">{children}</div>;
}
