import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

/**
 * THE SUMMARY STATES WHAT IS INSIDE, NEVER "ADVANCED".
 *
 * Twelve identical rows in one card is a lot of equal weight, so the
 * recommended path stays visible and the rest folds. "Advanced" tells the
 * reader only that somebody else decided they would not want it; the summary
 * has to name the thing, so the fold is a shortcut rather than a locked door.
 *
 * `count` is what is behind the fold, right-aligned in the summary — visible in
 * one click, absent from the first read.
 *
 * A `<details>`, not a button and a conditional: the element already carries
 * the open state, the keyboard behaviour and the accessibility contract, and
 * the disclosure is not the place to reimplement any of them.
 */
export function Disclosure({
  summary,
  count,
  defaultOpen,
  className,
  children,
}: {
  summary: React.ReactNode;
  count?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details className={cn("ws-disc", className)} open={defaultOpen}>
      <summary>
        <Icon name="chevron" />
        {summary}
        {count !== undefined && <span className="ws-disc-n">{count}</span>}
      </summary>
      <div className="ws-rows">{children}</div>
    </details>
  );
}
