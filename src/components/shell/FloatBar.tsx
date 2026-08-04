import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

/**
 * THE FLOATING ACTION BAR — `demo.js`'s `floatbar()`.
 *
 * Centred at the foot of the note, over the content rather than after it: the
 * two things you do to a note — talk to it, and act on it — are available at
 * every scroll position instead of only at the end.
 *
 * IT IS DRAWN AT REST HERE (ADR 0058). `live` is the prototype's own flag and
 * tints the mic; a gallery screen never passes it, because a lit capture
 * control is a claim that a microphone is open.
 */
export function FloatBar({ children }: { children: ReactNode }) {
  return <div className="ws-floatbar">{children}</div>;
}

export function MicButton({
  label,
  live,
  big,
  onClick,
}: {
  label: string;
  /** A capture that is actually running. Never set from a gallery screen. */
  live?: boolean;
  /** The intake's single large target. */
  big?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn("ws-mic-btn", big && "ws-rec-big")}
      data-live={live ? "" : undefined}
      aria-label={label}
      onClick={onClick}
    >
      <Icon name="mic" />
    </button>
  );
}

/**
 * THE COMMON ACTION, PLUS THE MENU OF THE ACTIONS IT BELONGS TO. A select would
 * make you choose before you can act; this way the default is one click and the
 * alternatives are two.
 */
export function SplitButton({
  action,
  menu,
  onAction,
  onToggleMenu,
}: {
  action: string;
  /** Rendered above the button when the menu is open; the caret flips with it. */
  menu?: ReactNode;
  onAction?: () => void;
  onToggleMenu?: () => void;
}) {
  return (
    <span className="ws-split-btn">
      {menu}
      <Button variant="primary" icon={<Icon name="sparkle" />} onClick={onAction}>
        {action}
      </Button>
      <Button variant="primary" aria-label="Other actions" onClick={onToggleMenu}>
        <Icon name={menu ? "caretDown" : "caretUp"} />
      </Button>
    </span>
  );
}

/**
 * The same boundary rule the actions window uses (§11.30): entries from two
 * categories, one control, a rule between them. Here it also carries a label,
 * because the menu is where the split is met first — the window is opened by
 * people who are editing, the menu by people who are running.
 */
export type MenuEntry = {
  label: string;
  hint: string;
  icon?: IconName;
  /** A desk entry runs somewhere else, for minutes, with effects. */
  kind?: "desk";
  on?: boolean;
};

export function Menu({ items, deskLabel }: { items: MenuEntry[]; deskLabel: string }) {
  const ordinary = items.filter((item) => item.kind !== "desk");
  const deskish = items.filter((item) => item.kind === "desk");
  return (
    <div className="ws-menu" role="menu">
      {ordinary.map((item) => (
        <MenuEntryButton key={item.label} entry={item} />
      ))}
      {deskish.length > 0 && (
        <>
          <div className="ws-menu-rule">
            <span>{deskLabel}</span>
          </div>
          {deskish.map((item) => (
            <MenuEntryButton key={item.label} entry={item} />
          ))}
        </>
      )}
    </div>
  );
}

function MenuEntryButton({ entry }: { entry: MenuEntry }) {
  return (
    <button type="button" role="menuitem" aria-current={entry.on ? "true" : "false"}>
      <Icon name={entry.icon ?? "sparkle"} />
      <span className="ws-mtext">
        <b>{entry.label}</b>
        <span>{entry.hint}</span>
      </span>
    </button>
  );
}
