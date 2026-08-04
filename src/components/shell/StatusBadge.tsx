import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "accent"
  | "plan"
  | "neutral";

/**
 * The grammar carries five tones. `error` and `info` are pre-port names two
 * shipped callers still use; `error` is `danger` and `info` takes the neutral
 * ground, because the voice colour was never a status.
 */
const dataTone: Partial<Record<StatusTone, string>> = {
  success: "success",
  warning: "warning",
  error: "danger",
  accent: "accent",
  plan: "plan",
};

const dotTone: Partial<Record<StatusTone, string>> = {
  success: "success",
  warning: "warning",
  error: "danger",
  accent: "warning",
};

interface StatusBadgeProps {
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * A BADGE IS FOR A STATUS THAT IS NOT EXPECTED (§11.20). An expected status is
 * a dot and a word, or nothing. The upload queue was nine rows each carrying a
 * coloured pill, two thirds of them reporting that things had gone as expected,
 * which left the one row needing a decision nothing to stand out from.
 *
 * AND IT IS A RECTANGLE NOW. It was a capsule until the radius ladder (§11.32):
 * a badge, a status tag, a segmented control, a sub-tab row, a chip and a
 * profile flag were all capsules, so every label-shaped thing on screen was a
 * pill. A tool people keep open all day is not a consumer app, and a capsule on
 * every label is the fastest way to look like one. Capsules survive only where
 * the object is physically a capsule — which the dot beside the text still is.
 *
 * IN A LIST, BADGES LIVE IN A FIXED RIGHT-ALIGNED COLUMN, not in the flow
 * (§11.28). One inline badge works until a row is both "Clipboard only" and
 * "Audio swept", at which point the actions start at whatever x the badges
 * happened to end at and every row ends its actions somewhere different. That
 * column belongs to the list, not to this component.
 */
export function StatusBadge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: StatusBadgeProps) {
  return (
    <span className={cn("ws-badge", className)} data-tone={dataTone[tone]}>
      {dot && <span className="ws-dot" data-tone={dotTone[tone]} aria-hidden />}
      {children}
    </span>
  );
}
