import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
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
  /**
   * WHAT THE ENTRY IS FOR, and it is optional because a VERB does not need one
   * (ADR 0082). This menu was built for the float bar, where the entries are
   * destinations with names worth reading, and ADR 0069 kept the hints for
   * Help's four addresses for the same reason. A row's actions are three
   * verbs — Rename, Duplicate, Delete — and a sentence under each one makes a
   * 230 px panel out of a list of three words. A menu whose entries carry no
   * hint draws itself narrow.
   */
  hint?: string;
  icon?: IconName;
  /** A desk entry runs somewhere else, for minutes, with effects. */
  kind?: "desk";
  on?: boolean;
  /** Absent on a DRAWN menu, which is what this component was built for and is
   *  still what the Context screen renders. Leg 4d gave it its first live
   *  caller (the Help menu, ADR 0069) and an entry that acts says so here. */
  onSelect?: () => void;
  /** Drawn and inert, with the reason in the hint (ADR 0065). */
  disabled?: boolean;
};

/**
 * A POPOVER OVER THE CONTROL THAT OPENED IT.
 *
 * `align="center"` is the float bar's: a 230 px panel centred on a button in
 * the middle of a wide surface. `align="start"` is the sidebar's: a panel that
 * takes the width of the row it belongs to, because a 230 px panel centred on a
 * nav row spills out of both edges of a 200 px sidebar.
 *
 * `at` IS THE THIRD KIND AND IT ANCHORS TO NOTHING — see below. Both anchored
 * variants open UPWARD, which is right for the two callers that have one: they
 * sit at the bottom of their surface. A menu opened from a list row cannot use
 * either, because the list scrolls and the head clips (ADR 0082).
 */
export function Menu({
  items,
  deskLabel,
  align = "center",
  label,
  panelRef,
  at,
}: {
  items: MenuEntry[];
  deskLabel?: string;
  align?: "center" | "start";
  label?: string;
  /** For a caller whose outside-press check cannot use a wrapper element,
   *  because inserting one would be a DOM node in a measured screen. */
  panelRef?: Ref<HTMLDivElement>;
  /**
   * VIEWPORT COORDINATES, WHICH TAKE THE PANEL OUT OF ITS CONTAINER ENTIRELY.
   *
   * An absolutely positioned panel is clipped by any ancestor that scrolls or
   * hides its overflow, and the pane's head is one: the first build of the
   * profile menu came out with its second entry cut off at the head's edge. A
   * menu that is anchored to a ROW rather than to a bar has the same problem
   * everywhere it is opened, so the position becomes the caller's measurement —
   * a button's rect, or a right-click's pointer — and the panel is `fixed`.
   *
   * The caller passes where it WANTS the panel; this clamps it into the
   * viewport, because a right-click near the bottom edge otherwise opens a menu
   * that runs off the screen.
   */
  at?: { x: number; y: number };
}) {
  const ordinary = items.filter((item) => item.kind !== "desk");
  const deskish = items.filter((item) => item.kind === "desk");
  /* Derived rather than a prop: a menu is compact because its entries have
     nothing to explain, which the entries already say. A flag beside them
     would be a second place for the same fact to be wrong. */
  const compact = items.every((item) => !item.hint);
  const own = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState(at);

  /* Measured after paint and before the browser shows it: the panel's height
     depends on how many entries it has and on the hint text inside them, so
     the caller cannot know it. A menu opened near the bottom edge flips above
     its pointer rather than running off the screen. */
  useLayoutEffect(() => {
    if (!at || !own.current) return;
    const box = own.current.getBoundingClientRect();
    const margin = 8;
    setPlace({
      x: Math.max(margin, Math.min(at.x, window.innerWidth - box.width - margin)),
      y:
        at.y + box.height + margin > window.innerHeight
          ? Math.max(margin, at.y - box.height)
          : at.y,
    });
  }, [at?.x, at?.y]);

  return (
    <div
      ref={(node) => {
        own.current = node;
        if (typeof panelRef === "function") panelRef(node);
        else if (panelRef) (panelRef as { current: HTMLDivElement | null }).current = node;
      }}
      className="ws-menu"
      role="menu"
      aria-label={label}
      data-align={align}
      data-compact={compact ? "" : undefined}
      data-fixed={at ? "" : undefined}
      style={at ? { left: place?.x ?? at.x, top: place?.y ?? at.y } : undefined}
    >
      {ordinary.map((item) => (
        <MenuEntryButton key={item.label} entry={item} />
      ))}
      {deskish.length > 0 && deskLabel && (
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

/**
 * A ROW'S OWN MENU, OPENED AT A POINT AND DISMISSED BY THE NEXT THING YOU DO
 * (ADR 0082).
 *
 * It is in the library rather than in a screen because two screens need the
 * same three lines of dismissal logic, and a second copy is how the two grow
 * apart — the redundancy this leg was told to police. What a screen still owns
 * is WHICH verbs its rows carry.
 *
 * Both listeners bubble, which puts them under the command palette's capture
 * listener: while the palette is up the key is the palette's (ADR 0069).
 * `mousedown` rather than `click`, so the menu is gone before whatever was
 * pressed underneath it acts.
 */
export function RowMenu({
  at,
  label,
  items,
  onClose,
}: {
  at: { x: number; y: number };
  label: string;
  items: MenuEntry[];
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (event: globalThis.MouseEvent) => {
      if (panel.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return <Menu at={at} label={label} panelRef={panel} items={items} />;
}

function MenuEntryButton({ entry }: { entry: MenuEntry }) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-current={entry.on ? "true" : "false"}
      disabled={entry.disabled}
      onClick={entry.onSelect}
    >
      <Icon name={entry.icon ?? "sparkle"} />
      <span className="ws-mtext">
        <b>{entry.label}</b>
        {entry.hint && <span>{entry.hint}</span>}
      </span>
    </button>
  );
}
