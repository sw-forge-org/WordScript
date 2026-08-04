import * as React from "react";
import { CheckIcon, EyeIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoteTone = "info" | "check" | "alert" | "eye";

const GLYPH: Record<NoteTone, React.ReactNode> = {
  info: <InfoIcon aria-hidden />,
  check: <CheckIcon aria-hidden />,
  alert: <TriangleAlertIcon aria-hidden />,
  eye: <EyeIcon aria-hidden />,
};

/**
 * A FACT ABOUT THE THING ABOVE IT, on the window rather than in a card.
 *
 * `tone` picks the glyph and nothing else — the note is `--fg-muted` in every
 * tone, because a coloured paragraph under a card is a second alert competing
 * with whatever the card itself is saying. `alert` marks a note that names a
 * defect, `check` one that names a property that holds, and `eye` one that
 * reports something that was looked at.
 *
 * The mapping lives here so a call site never repeats it. That is the whole
 * subject of ADR 0052.
 */
export function Note({
  tone = "info",
  className,
  children,
}: {
  tone?: NoteTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("ws-note", className)}>
      {GLYPH[tone]}
      <span>{children}</span>
    </p>
  );
}
