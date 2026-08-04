import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

interface ToolbarProps {
  children: React.ReactNode;
  /** Pushed to the trailing edge. For the control that acts on the list rather
   *  than filtering it — a refresh, a sort, an export. */
  right?: React.ReactNode;
  label?: string;
  className?: string;
}

/**
 * FILTERS ON ONE LINE ABOVE THE LIST THEY ACT ON.
 *
 * Filters are not settings. The shipped History spends a card of labelled rows
 * on a search box, a status select and a toggle — three labels for what is one
 * line — and a card says "these are values you set", when a filter is something
 * you throw away as soon as you have found the row. Here they sit directly
 * above the list, which is where every list view in macOS puts them.
 *
 * THE COUNT IS NOT A FILTER and does not belong here. It is the result of one,
 * and it goes on the section header. Plan §5.3.
 */
export function Toolbar({ children, right, label, className }: ToolbarProps) {
  return (
    <div className={cn("ws-toolbar", className)} role="toolbar" aria-label={label}>
      {children}
      {/* THE TRAILING SLOT IS A ROW, not just a margin. The prototype writes it
          `class="right rowflex"` — two classes, and Leg 2a carried only the
          first across, so a slot holding more than one control drew them
          touching and unaligned. It has one caller with one button today,
          which is exactly why it went unseen. */}
      {right && <span className="ws-toolbar-right ws-rowflex">{right}</span>}
    </div>
  );
}

/**
 * The search affordance, unscoped from the toolbar deliberately: the same shape
 * is needed inside a note, and the alternative is an inline
 * `position:relative;display:flex` at the call site — the class of patch this
 * grammar exists to delete.
 */
export function ToolbarSearch({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("ws-search", className)}>
      <Icon name="search" />
      {children}
    </span>
  );
}
