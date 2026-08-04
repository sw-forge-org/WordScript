import * as React from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
      {right && <div className="ws-toolbar-right">{right}</div>}
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
    <div className={cn("ws-search", className)}>
      <SearchIcon aria-hidden />
      {children}
    </div>
  );
}
