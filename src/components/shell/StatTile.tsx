import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatTileItem {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Render the value in the brand accent (e.g. an active selection). */
  accent?: boolean;
}

interface StatTilesProps {
  items: StatTileItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * PRE-PORT. Six shipped areas render this and none of them should: a stat tile
 * carries a NUMBER THAT CHANGES and summarises more rows than fit on screen —
 * otherwise it is a row. Every caller below holds a model name, a lane or a
 * profile, which is a row that has been given a box, and six of those together
 * are a dashboard for a product that has no dashboard. The prototype's eleventh
 * pass removed nine of them for exactly that and left one honest use, above the
 * upload queue.
 *
 * `.ws-stats` in shell.css is the ported drawing and is what the Context ·
 * intake screen will use. This component is not re-ported onto it here, because
 * the Design System screen does not render a stat tile and porting a primitive
 * no ported screen asks for is the same guess the gallery pages were. It goes
 * with the last caller that reads it, which is Leg 3's business.
 */
export function StatTiles({ items, columns = 3, className }: StatTilesProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-4",
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="min-w-0 rounded-lg border border-border bg-card px-4 py-3.5"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">
            {item.label}
          </div>
          <div
            className={cn(
              "mt-1.5 truncate text-[15px] font-semibold leading-tight tracking-[-0.005em]",
              item.accent ? "text-brand-strong" : "text-foreground",
            )}
            title={typeof item.value === "string" ? item.value : undefined}
          >
            {item.value}
          </div>
          {item.hint && (
            <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-fg-muted">
              {item.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
