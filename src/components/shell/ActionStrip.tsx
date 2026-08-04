import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * HOME ONLY, AND ONLY WHEN SOMETHING IS OWED.
 *
 * NO COLOURED EDGE BAR. A vertical accent rule down the left of a notice is a
 * web convention, not a native one, and at this scale it reads as a rendering
 * defect — ruled out by review on 2026-08-03 for this component and for every
 * future one. The differentiation is the ground plus an icon tile: a tinted
 * surface says "not the record", and the tile is the same idiom the lane rows
 * already use, so the accent arrives as a shape the system owns rather than as
 * a stripe stuck to an edge.
 */
export function ActionStrip({
  icon,
  title,
  children,
  actions,
  className,
}: {
  /** A 15 px glyph, in the tile. */
  icon: React.ReactNode;
  title: React.ReactNode;
  /** One line saying what is owed. */
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ws-strip", className)}>
      <span className="ws-strip-tile">{icon}</span>
      <span className="ws-strip-text">
        <b>{title}</b>
        {children && <span>{children}</span>}
      </span>
      {actions && <span className="ws-rowflex">{actions}</span>}
    </div>
  );
}
