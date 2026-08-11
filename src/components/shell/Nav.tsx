import * as React from "react";
import { Icon } from "./Icon";
import wordmarkDark from "../../../assets/logos/wordscipt-logo-transparent.png";
import wordmarkLight from "../../../assets/logos/wordscipt-logo-light-transparent.png";
import appIcon from "../../../assets/logos/wordscript-icon.png";
import { cn } from "@/lib/utils";

/**
 * THE SIDEBAR GRAMMAR — `demo.css` §3, ported by Leg 2.
 *
 * This is the half of the prototype's page shell that IS part of the product.
 * The other half — §2's rig, with its Surface, Theme, Copy and Density switches
 * — is the instrument the prototype is viewed through and is deliberately
 * outside its own design system. It does not come across.
 *
 * Leg 3 replaces the fourteen flat settings areas with a navigation built on
 * exactly these rules. Nothing here is gallery-specific, which is the point:
 * the gallery displays the library and never defines it.
 *
 * THE RAIL IS THIS FILE'S ONE ADDITION TO THE PROTOTYPE (ADR 0111). The
 * prototype's sidebar has exactly one width, so it has no control to change it
 * and nothing about the collapsed state can be ported; what IS ported is every
 * rule the rail reuses — the row, its icon tile, the search field, the footer.
 * The rail is the same sidebar with its labels withheld, not a second sidebar.
 */

/**
 * COLLAPSE TRAVELS BY CONTEXT, NOT BY PROP, and the reason is `HelpMenu`: it
 * renders a `NavRow` of its own from another file, so a prop would have to be
 * threaded through every component that happens to own a row. A row that
 * carries no label needs to say so to the accessibility tree and to the
 * pointer, and that is a fact about the sidebar it sits in rather than about
 * the caller that placed it.
 */
const NavCollapsedContext = React.createContext(false);

/** True while the sidebar this component sits in stands as a rail. */
export function useNavCollapsed(): boolean {
  return React.useContext(NavCollapsedContext);
}

export function Nav({
  className,
  children,
  label,
  collapsed = false,
}: {
  className?: string;
  label?: string;
  children: React.ReactNode;
  /** Icons only, no labels. The window decides; this only draws it. */
  collapsed?: boolean;
}) {
  return (
    <NavCollapsedContext.Provider value={collapsed}>
      <nav
        className={cn("ws-nav", className)}
        aria-label={label}
        data-collapsed={collapsed ? "" : undefined}
      >
        {children}
      </nav>
    </NavCollapsedContext.Provider>
  );
}

/**
 * THE HEAD — the mark and the control that changes the sidebar's width, on one
 * line, because they are the two things in the column that are about the column
 * rather than about what it navigates to.
 *
 * The toggle keeps the top-right corner in both states: expanded it is the
 * trailing end of the brand's line, and in the rail the head turns into a
 * `column-reverse` stack, which puts the same control at the same height with
 * the mark under it. A control that moves when you press it is a control you
 * have to find twice.
 */
export function NavHead({
  scheme,
  collapsed = false,
  onToggle,
  qualifier,
  className,
}: {
  scheme: "light" | "dark";
  collapsed?: boolean;
  onToggle?: () => void;
  qualifier?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ws-nav-head", className)}>
      <BrandMark scheme={scheme} collapsed={collapsed} qualifier={qualifier} />
      {onToggle && <NavCollapseToggle collapsed={collapsed} onToggle={onToggle} />}
    </div>
  );
}

/**
 * ALWAYS DRAWN, IN BOTH STATES. A control that appears on hover is a control a
 * reader has to already know about, which is the same fault the command palette
 * had before `NavSearch` was mounted in front of it.
 */
export function NavCollapseToggle({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const label = collapsed ? "Expand the sidebar" : "Collapse the sidebar";
  return (
    <button
      type="button"
      className={cn("ws-nav-collapse", className)}
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
    >
      <Icon name="sidebar" />
    </button>
  );
}

/**
 * TWO FILES, NOT A FILTER. The mark is a dark tile with a cream quill beside a
 * pure-white wordmark, so on a light ground the tile still reads perfectly and
 * only the word disappears. `filter: invert()` would fix the word by destroying
 * the tile, and a logo is the one thing in a surface that may not be
 * approximated.
 *
 * `qualifier` is what tells two windows apart, since ADR 0003 leaves the title
 * bar to the OS.
 *
 * IN THE RAIL IT IS THE ICON, NOT THE WORDMARK SHRUNK. The wordmark is a word
 * beside a tile and the word is most of its width; scaled into 28 px it is a
 * smudge with a legible corner. The icon file is the same mark drawn for that
 * size, which is why it is a third asset rather than a CSS rule.
 */
export function BrandMark({
  scheme,
  qualifier,
  collapsed = false,
  className,
}: {
  scheme: "light" | "dark";
  qualifier?: React.ReactNode;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("ws-brand", className)} data-collapsed={collapsed ? "" : undefined}>
      <img
        src={collapsed ? appIcon : scheme === "light" ? wordmarkLight : wordmarkDark}
        alt="WordScript"
      />
      {qualifier && !collapsed && <span className="ws-brand-qual">{qualifier}</span>}
    </div>
  );
}

/**
 * NOT A REAL INPUT: it opens the command palette, which is where the typing
 * happens. Two search fields that filter different things would be the more
 * expensive answer to the same question. The shortcut stays and is printed on
 * the control it accelerates — a keyboard shortcut is an accelerator for a
 * thing you can see, not a substitute for it.
 *
 * IT KEEPS ITS FOCUS WHILE THE PALETTE IS UP, deliberately. Blurring it on open
 * was tried once, against an accent ring that turned out to be on the palette's
 * own field rather than on this one, and it costs a keyboard user the thing
 * they need most: closing the palette puts them back on the control they opened
 * it from instead of nowhere.
 *
 * IN THE RAIL IT KEEPS THE SHORTCUT AND LOSES THE PRINT OF IT. The chord is the
 * tooltip's second half, because a rail that drops the accelerator entirely
 * takes the palette back to being reachable only by people who already know.
 */
export function NavSearch({
  onOpen,
  shortcut,
  className,
}: {
  onOpen?: () => void;
  shortcut: string;
  className?: string;
}) {
  const collapsed = useNavCollapsed();
  return (
    <button
      type="button"
      className={cn("ws-nav-search", className)}
      onClick={onOpen}
      aria-label={collapsed ? `Search (${shortcut})` : undefined}
      title={collapsed ? `Search (${shortcut})` : undefined}
    >
      <Icon name="search" />
      <span>Search</span>
      <kbd>{shortcut}</kbd>
    </button>
  );
}

export function NavGroup({
  title,
  className,
  children,
}: {
  title: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("ws-nav-group", className)}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** The tag is what marks an entry that is a preview, or an alias of an entry
 *  that lives in another surface. Never a badge: this is furniture on a
 *  navigation row, not a status. */
export function NavRow({
  icon,
  label,
  tag,
  current,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  tag?: React.ReactNode;
  current?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const collapsed = useNavCollapsed();
  /* THE LABEL STAYS IN THE DOM AND IS HIDDEN BY CSS, so the row keeps its
     accessible name from its own content and a test still finds it by text.
     `title` is added only in the rail: a tooltip repeating a label that is
     already on screen is noise on every hover. */
  const named = collapsed && typeof label === "string" ? label : undefined;
  return (
    <button
      type="button"
      className={cn("ws-nav-row", className)}
      aria-current={current ? "true" : "false"}
      onClick={onClick}
      title={named}
    >
      {icon}
      <span className="ws-nav-label">{label}</span>
      {tag && <span className="ws-nav-tag">{tag}</span>}
    </button>
  );
}

export function NavFoot({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("ws-nav-foot", className)}>{children}</div>;
}
