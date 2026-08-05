import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusDot } from "./StatusDot";
import type { StatusDotTone } from "./StatusDot";

/**
 * THE WINDOW — `demo.css` §2, minus the mock that framed it.
 *
 * The prototype draws `.win` as a rounded, shadowed rectangle inside a stage,
 * with a `.win-deco` strip standing in for what the window manager draws. None
 * of that is product: ADR 0003 gives the real window native decorations on
 * every OS, so this root has no radius, no shadow, no measure and no fake title
 * bar. It is the viewport, and what it carries is what the mock was a frame
 * around — the ground, the typographic base, the body split and the strip along
 * the bottom edge.
 *
 * IT IS ALSO WHERE THE TWO BASE RULES LIVE. `svg { flex: none }` and the 16 px
 * default icon size are `demo.css`'s only unscoped rules, and Leg 2b had to
 * fence them to `.ws-content` / `.ws-nav` while the pre-port areas still
 * rendered lucide icons under their own assumptions. Those areas are gone; the
 * rules sit on `.ws-win` now, which is where the prototype has them.
 */
export function WindowShell({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ws-win", className)} {...rest}>
      {children}
    </div>
  );
}

/** The nav and the content column, side by side. */
export function WindowBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("ws-win-body", className)}>{children}</div>;
}

/**
 * THE STATUS STRIP. The shipped surface saved every change immediately and said
 * so twice — an "Auto-saved" badge in the header and "Changes are saved
 * automatically." in the footer. Two statements of one fact is one too many,
 * and a badge that is permanently green is furniture. What survives is one
 * quiet line in the place macOS puts standing state, carrying the readiness the
 * settings surface would otherwise lose sight of.
 *
 * IT READS THE RUNTIME. Everything on it is a fact `useRuntime` already answers
 * — the session status, the lane and the delivery target — which is what
 * separates it from the views it sits under. A strip that stated a readiness
 * nobody measured would be the fake-readiness defect at the one place on screen
 * that is never scrolled away.
 */
export function StatusStrip({
  tone,
  label,
  facts,
  title,
  trailing,
  className,
}: {
  tone: StatusDotTone;
  label: React.ReactNode;
  /** One entry per fact. Separated by the strip, never by the caller. */
  facts?: React.ReactNode[];
  title?: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ws-win-foot", className)} title={title}>
      <StatusDot tone={tone} />
      <b>{label}</b>
      {facts?.map((fact, index) => (
        <React.Fragment key={index}>
          <span className="ws-sep">·</span>
          <span>{fact}</span>
        </React.Fragment>
      ))}
      {trailing && <span className="ws-right">{trailing}</span>}
    </div>
  );
}
