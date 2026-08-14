import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

/**
 * THE WINDOW FAMILY IS DRAGGABLE, BECAUSE IT ALREADY SAID SO.
 *
 * `.ws-chatwin-deco` has carried `cursor: grab` since the port, and nothing
 * moved. That is ADR 0020's defect written in CSS rather than in JSX — a
 * control whose effect is invisible — and it is the one instance of it that
 * costs a hook to fix rather than a runtime.
 *
 * WHAT THIS IS FOR, AND IT IS NOT A FEATURE. Ask, Actions and the meeting HUD
 * are separate windows in the product (ADR 0003: the OS draws the frame). In a
 * preview they are boxes pinned to one corner, which is exactly the arrangement
 * that hides whether two of them can be open at once, what one covers, and
 * whether the thing behind is still readable. Being able to shove them around
 * is how the drawing gets judged instead of remembered.
 *
 * IT PERSISTS NOTHING. A position that survived a reload would be a stored
 * preference for a window that does not exist yet, and ADR 0064 already says
 * where a real one's geometry would live. Drag it, look, let go.
 *
 * `transform` rather than `left`/`top`: the family is anchored by `right` and
 * `bottom`, the HUD by its flow position, and a translation moves both without
 * either having to be converted into the other's coordinate system first.
 */
export function usePopout() {
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);
  const from = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    /* The strip carries close and minimise. A drag that started on one of them
       would swallow the click that was meant for it. */
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const base = offset ?? { dx: 0, dy: 0 };
    from.current = { x: event.clientX, y: event.clientY, ...base };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = from.current;
    if (!start) return;
    setOffset({
      dx: start.dx + event.clientX - start.x,
      dy: start.dy + event.clientY - start.y,
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!from.current) return;
    from.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const style: CSSProperties | undefined = offset
    ? { transform: `translate(${offset.dx}px, ${offset.dy}px)` }
    : undefined;

  return { style, handle: { onPointerDown, onPointerMove, onPointerUp } };
}

export type PopoutHandle = ReturnType<typeof usePopout>["handle"];
