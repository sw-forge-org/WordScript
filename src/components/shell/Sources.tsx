import * as React from "react";
/* The prototype's `inspect` glyph — a magnifier with a bar through it. Lucide's
   export name is about zooming; the geometry is the one the prototype drew. */
import { Icon } from "./Icon";
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
  as: As = "span",
  className,
}: {
  items: React.ReactNode[];
  /** THE PROTOTYPE SPELLS THIS BOTH WAYS and the rule is identical for each:
   *  `.sources` is `display: flex`, so the tag changes nothing it draws. The
   *  Design System screen's *Source list* row writes a `<span>`; the answer
   *  inside a chat bubble writes a `<div>`. Ported as both are written, because
   *  the drawing is what was looked at and accepted — and because a port that
   *  silently normalises one of them makes the measurement report an element
   *  that is missing when nothing is. */
  as?: "span" | "div";
  className?: string;
}) {
  return (
    <As className={cn("ws-sources", className)}>
      <Icon name="inspect" />
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="ws-sep">·</span>}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </As>
  );
}
