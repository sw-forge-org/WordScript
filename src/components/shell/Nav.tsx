import * as React from "react";
import { Icon } from "./Icon";
import wordmarkDark from "../../../assets/logos/wordscipt-logo-transparent.png";
import wordmarkLight from "../../../assets/logos/wordscipt-logo-light-transparent.png";
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
 */

export function Nav({
  className,
  children,
  label,
}: {
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <nav className={cn("ws-nav", className)} aria-label={label}>
      {children}
    </nav>
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
 */
export function BrandMark({
  scheme,
  qualifier,
  className,
}: {
  scheme: "light" | "dark";
  qualifier?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ws-brand", className)}>
      <img src={scheme === "light" ? wordmarkLight : wordmarkDark} alt="WordScript" />
      {qualifier && <span className="ws-brand-qual">{qualifier}</span>}
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
  return (
    <button type="button" className={cn("ws-nav-search", className)} onClick={onOpen}>
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
  return (
    <button
      type="button"
      className={cn("ws-nav-row", className)}
      aria-current={current ? "true" : "false"}
      onClick={onClick}
    >
      {icon}
      {label}
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
