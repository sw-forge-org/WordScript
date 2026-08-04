import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

export type CheckState = "ok" | "fail" | "todo";

export interface CheckItem {
  state: CheckState;
  label: React.ReactNode;
  /** What the probe found. */
  detail?: React.ReactNode;
  /** The command, path or identifier the probe used. */
  code?: React.ReactNode;
  /** A badge or a button, at the trailing edge. */
  trailing?: React.ReactNode;
}

/**
 * A CHECK REPORTS A PROBE: the runtime looked, and this is what it found.
 *
 * IT IS NOT A BULLET. A checkmark beside an argument claims a measurement
 * nobody took, which is exactly the kind of fake readiness the runtime rules
 * forbid on a product surface. `todo` is the state for a probe that has not run
 * — an empty ring, not a tick.
 *
 * The stack draws separators, so it runs to the card's edge and each check
 * carries the horizontal inset itself (ADR 0052).
 */
export function CheckList({
  items,
  className,
}: {
  items: CheckItem[];
  className?: string;
}) {
  return (
    <div className={cn("ws-check-list", className)}>
      {items.map((item, index) => (
        <div key={index} className="ws-check" data-state={item.state}>
          <span className="ws-check-mark">
            {item.state === "ok" && <Icon name="check" />}
            {item.state === "fail" && <Icon name="x" />}
          </span>
          <span className="ws-check-text">
            <b>{item.label}</b>
            {item.detail && <span>{item.detail}</span>}
            {item.code && <code>{item.code}</code>}
          </span>
          {item.trailing}
        </div>
      ))}
    </div>
  );
}
