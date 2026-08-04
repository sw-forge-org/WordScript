import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** One line saying what is not here. Never a paragraph. */
  children: React.ReactNode;
  /** A 22 px glyph. Never an illustration. */
  icon?: React.ReactNode;
  /** The one thing to do about it. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * ONE LINE AND ONE ACTION. Never an illustration, and never two actions: an
 * empty state that offers a choice has stopped being an empty state and become
 * a screen the user has to read. Plan §5.2's budget applies here literally.
 */
export function EmptyState({ children, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("ws-empty", className)}>
      {icon}
      <p>{children}</p>
      {action}
    </div>
  );
}
