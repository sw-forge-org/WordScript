import * as React from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

/** A label on the inset plane. Not a badge: a badge reports a status, a chip
 *  carries a value that is part of a set. */
export function Chip({
  icon,
  className,
  children,
}: {
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("ws-chip", className)}>
      {icon}
      {children}
    </span>
  );
}

export interface TermChip {
  term: string;
  /** `learned` is a term the runtime picked up rather than one that was typed.
   *  It is marked by the chip's border, because the origin is a property of the
   *  word — a chip carrying a chip is two objects for one fact. */
  origin?: "added" | "learned";
}

/**
 * A WORD LIST IS CHIPS, NOT ROWS WITH HOVER ACTIONS.
 *
 * Bias terms, names and replacements are a set of short strings, and a card of
 * rows spends a full row height and a separator on each one to say a word.
 */
export function TermChips({
  items,
  onRemove,
  className,
}: {
  items: TermChip[];
  onRemove?: (term: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("ws-chips", className)}>
      {items.map((item) => (
        <span key={item.term} className="ws-chip-x" data-origin={item.origin}>
          {item.term}
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${item.term}`}
              onClick={() => onRemove(item.term)}
            >
              <Icon name="x" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
