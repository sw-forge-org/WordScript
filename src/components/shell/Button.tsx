import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "ghost" | "danger";

interface ButtonProps extends Omit<React.ComponentPropsWithoutRef<"button">, "type"> {
  /** Omitted is the secondary button — the prototype's bare `.btn`. */
  variant?: ButtonVariant;
  /** A 13 px glyph before the label. */
  icon?: React.ReactNode;
  /** The label goes transparent and a spinner takes the box, so the button
   *  keeps its width and nothing beside it moves. */
  busy?: boolean;
  /** `ghost` only: this button opens something, and that something is open. */
  on?: boolean;
  type?: "button" | "submit" | "reset";
}

/**
 * THE BUTTON, AND THE PRIMARY ACTION IS A MATERIAL.
 *
 * Leg 1 built the eight primitives plan §5.3 names and `.btn` is not one of
 * them, so the shipped surface kept a flat accent fill while the accepted
 * design had already spent three values on the one control that is allowed to
 * be loud: light from above, a shadow plane below, and a darker edge where the
 * surface turns away. A flat fill of one hex is the cheapest possible button
 * and reads as one — nothing about it says it can be pressed.
 *
 * Every value lives in `.ws-btn` in shell.css. This component decides nothing;
 * it names the states.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, icon, busy, on, className, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn("ws-btn", className)}
      data-v={variant}
      data-busy={busy ? "" : undefined}
      data-on={on ? "" : undefined}
      {...props}
    >
      {icon}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

interface IconButtonProps extends Omit<React.ComponentPropsWithoutRef<"button">, "type"> {
  /** The accessible name AND the tooltip. It is not lost — only its drawing is. */
  label: string;
  icon: React.ReactNode;
  tone?: "danger";
  /** The thing this button controls is currently on. */
  on?: boolean;
  type?: "button" | "submit" | "reset";
}

/**
 * A ROW ACTION REDUCED TO ITS ICON.
 *
 * Five labelled buttons on a transcript row spend more width than the
 * transcript does: the row's own subject ends in an ellipsis while "Show in
 * File Manager" gets to say all four of its words. Five labelled ghost buttons
 * ran to roughly 330 px on a row whose whole job is to show a sentence; the
 * same five as icons run to 140.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, tone, on, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn("ws-ibtn", className)}
      data-tone={tone}
      data-on={on ? "" : undefined}
      title={label}
      aria-label={label}
      {...props}
    >
      {icon}
    </button>
  ),
);
IconButton.displayName = "IconButton";
