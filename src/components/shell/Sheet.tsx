import * as React from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

/**
 * THE SETTINGS SHEET — `demo.css` §2b, derived in plan §11.22.
 *
 * A modal laid over the workspace, at its own scale. Configuring something is a
 * detour from what you were doing and you come back; a second top-level window
 * says the opposite, and it leaves the workspace behind with no indication that
 * it is still there. Here the workspace stays visible, dimmed and pushed back —
 * which is the whole difference between a detour and a departure.
 *
 * THE SCALE IS NOT THIS COMPONENT'S DOING. `.ws-modal-win` redeclares `--nav-w`,
 * `--nav-row-h`, `--content-max`, `--content-pad`, `--pad-card`, `--row-py`,
 * `--gap-block` and `--gap-row`, and every component inside it reads those
 * instead of the workspace values without knowing it has moved. That is
 * ADR 0052's claim, and the sheet is where it was tested: the scale travelled
 * from the gallery's content column to here and not one component changed.
 *
 * THREE THINGS IT DROPS, each because the window behind it still has them: the
 * wordmark (the brand stated twice on one screen), a "Back to workspace" row
 * (closing IS going back), and the status strip. The profile switcher survives,
 * promoted into the header — the context every scope tag on these screens
 * refers to, stated once and readable from every section.
 */

export function Sheet({
  onClose,
  label,
  closeOnEscape = true,
  className,
  children,
}: {
  /** Called by the scrim, the close control and Escape alike. */
  onClose: () => void;
  label: string;
  /**
   * ESCAPE DISMISSES THE TOPMOST TRANSIENT THING, AND THAT IS A STACK RATHER
   * THAN A SWITCH. The command palette opens OVER this sheet, so while it is up
   * the key is the palette's and this sheet must not take it — Escape closing
   * the sheet out from under an open palette is the bug the ordering exists to
   * prevent, and the prototype names it in `demo.js`'s keyboard layer.
   *
   * It is a prop rather than a check for the palette's DOM, because a sheet
   * that knew what could be laid over it would have to learn about every future
   * layer. The window owns the stack; this owns the key while it is on top.
   */
  closeOnEscape?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const scrim = React.useRef<HTMLDivElement>(null);

  /* Escape closes, and it is caught here rather than in the window: a sheet
     that is on screen owns the key, and the window would have to ask whether a
     sheet is open before it could answer it. */
  React.useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOnEscape, onClose]);

  return (
    <div
      ref={scrim}
      className={cn("ws-modal-scrim", className)}
      data-enter=""
      /* The scrim closes and the sheet does not, so the target has to BE the
         scrim. A click that started inside the sheet and ended on the scrim —
         a drag out of a text field — reports the scrim as its target on
         `click` but not on `mousedown`, which is why this is the down event. */
      onMouseDown={(event) => {
        if (event.target === scrim.current) onClose();
      }}
    >
      <div className="ws-modal-win" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function SheetHead({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  /** The profile control, and nothing else — see the component's note. */
  children?: React.ReactNode;
}) {
  return (
    <header className="ws-modal-head">
      <h2>{title}</h2>
      {children}
      <button
        type="button"
        className="ws-modal-close"
        onClick={onClose}
        aria-label="Close settings"
      >
        <Icon name="x" />
      </button>
    </header>
  );
}

/* `SheetProfile` STOOD HERE AND IS GONE (ADR 0054: a replaced surface is
   deleted in the commit that replaces it, not aliased). It drew the double
   chevron that announces a popup button and navigated instead of opening one,
   which is the fake-affordance defect rule 7 names, on the one control in the
   sheet that is always on screen. What stands in its place is
   `ProfileSwitcher variant="sheet"` — the same control the sidebar has, which
   is what this file's own note claimed it already was. */

export function SheetBody({ children }: { children: React.ReactNode }) {
  return <div className="ws-modal-body">{children}</div>;
}

export function SheetNav({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <nav className="ws-modal-nav" aria-label={label}>
      {children}
    </nav>
  );
}

export function SheetContent({
  layout,
  hidden,
  children,
}: {
  layout?: "pane" | "wide";
  /** One scroll box per section the sheet has shown, only one of them visible
   *  (plan P2). Its own box, because each section keeps its own scroll position
   *  and its own layout. */
  hidden?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="ws-modal-content" data-layout={layout} hidden={hidden}>
      <div className="ws-content-inner" data-layout={layout}>
        {children}
      </div>
    </div>
  );
}

export function SheetFoot({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="ws-modal-foot">
      <span>{children}</span>
      {trailing && <span className="ws-right">{trailing}</span>}
    </div>
  );
}
