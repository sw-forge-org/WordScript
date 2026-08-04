import * as React from "react";
/* The prototype's `inspect` glyph — a magnifier with a bar through it. Lucide's
   export name is about zooming; the geometry is the one the prototype drew. */
import { ZoomOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AN ANSWER ABOUT YOUR OWN RECORD NAMES THE ROWS IT READ.
 *
 * Under an assistant turn: which of your own rows the answer was read from.
 * Without it the reply has to be taken on faith about facts you own, which is
 * the one class of claim this product is not allowed to make.
 */
export function Sources({
  items,
  className,
}: {
  items: React.ReactNode[];
  className?: string;
}) {
  return (
    <span className={cn("ws-sources", className)}>
      <ZoomOutIcon aria-hidden />
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="ws-sep">·</span>}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </span>
  );
}
