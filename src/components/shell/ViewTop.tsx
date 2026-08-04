import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * THE MASTHEAD OF A VIEW: what it is called, what it is, whether it is a
 * preview, and which of its tabs is open. ONE block, one rhythm.
 *
 * As three siblings they inherited the content column's 32 px block gap and
 * drifted apart: a one-line preview banner floated in the middle of 64 px of
 * nothing, and the sub-tab row looked detached from the view it switches.
 * Inside the masthead the rhythm is 16 px and the 32 px gap is spent once,
 * below it. That is "Title, banner and sub-tabs are one masthead" on the Design
 * System screen's *Rules this pass added*.
 *
 * Home is the one view that does not use it, and only Home: every other view is
 * a place you navigated to on purpose and already know the name of. Home is the
 * one you land on, and what it owes you on landing is not its own name.
 */
export function ViewTop({
  title,
  lead,
  banner,
  tabs,
  className,
}: {
  title: React.ReactNode;
  /** One line. At most 90 characters. */
  lead?: React.ReactNode;
  /** A `PreviewBanner`, when this view is one. */
  banner?: React.ReactNode;
  /** A `SubTabs` row. */
  tabs?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ws-view-top", className)}>
      <header className="ws-view-head">
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </header>
      {banner}
      {tabs}
    </div>
  );
}
