import * as React from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

interface PreviewBannerProps {
  /** What it will be. One line: "Planned: Phase 8." */
  children: React.ReactNode;
  /** The chip's word. `preview` is the default and is almost always right. */
  lead?: React.ReactNode;
  tone?: "preview" | "withdrawn";
  icon?: React.ReactNode;
  className?: string;
}

/**
 * A PREVIEW SAYS SO, ON THE SURFACE, EVERY TIME. Plan §4.3 rule 5 and §7.
 *
 * A CHIP AND ONE LINE, 26 px — not the dashed card it was (§11.47). The box
 * stood at the top of eleven screens at about 60 px, which on the three that
 * need it most was a third of everything above the fold, spent on a fact the
 * reader takes in once and scrolls past forever after. The dashed border went
 * with it: the chip already says the status, and a dashed rule around a single
 * line reads as an unfinished control rather than as a caveat.
 *
 * THE LEAD IS A WORD. "Layout preview — not wired to the runtime." was accurate
 * and it was also the fourth time the surface said so.
 *
 * `withdrawn` KEEPS ITS BOX AND ITS BORDER, because a stop is exactly the case
 * that has to interrupt. A screen the plan decided against still has to say so
 * on itself, or the next reader builds from it (§11.15).
 */
export function PreviewBanner({
  children,
  lead,
  tone = "preview",
  icon,
  className,
}: PreviewBannerProps) {
  const withdrawn = tone === "withdrawn";
  const glyph =
    icon ?? <Icon name={withdrawn ? "about" : "eye"} />;

  return (
    <div
      className={cn("ws-banner", className)}
      data-tone={withdrawn ? "withdrawn" : undefined}
    >
      <span className="ws-banner-tag">
        {glyph}
        {lead ?? (withdrawn ? "Withdrawn" : "Preview")}
      </span>
      <span className="ws-banner-text">{children}</span>
    </div>
  );
}
