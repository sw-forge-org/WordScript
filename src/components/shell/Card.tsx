import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  /** The card's own head, inside the card. A group of cards is headed by `SectionHeader`. */
  title?: React.ReactNode;
  /** One line, at most 90 characters. */
  description?: React.ReactNode;
  /** The action that acts on this card's content. Rendered as the card's foot. */
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * THE GROUPING SURFACE. Elevation is a background step, never a shadow.
 *
 * THE CARD OWNS ITS INSET AND THE ITEM CARRIES THE HORIZONTAL HALF (ADR 0052).
 * The card pays its vertical padding; a separated stack — `.ws-rows`,
 * `.ws-list`, `.ws-lane` — spans the card's full width so its hairlines reach
 * both edges of the group, and every item inside the stack pays `--pad-card`
 * left and right so its content still lands on the card's own vertical line.
 * Everything that is not such a stack takes the inset from the card's guard in
 * `shell.css`. Nothing inside a card needs to know it is at an edge, and no
 * screen needs an inline padding.
 *
 * This component carries no spacing value of its own. Every inset it draws
 * comes from `--pad-card`, which the settings sheet redeclares at its own scale
 * (§11.22) without this file changing.
 *
 * Not to be confused with `FormCard`, which is the pre-port card the shipped
 * settings areas still use. Legs 2 and 3 move those callers here and delete it.
 */
export function Card({ title, description, footer, className, children }: CardProps) {
  return (
    <div className={cn("ws-card", className)}>
      {(title || description) && (
        <div className="ws-card-head">
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </div>
      )}
      {children}
      {footer && <CardFooter>{footer}</CardFooter>}
    </div>
  );
}

/**
 * The action that acts on a card's content, at the foot of the card that holds
 * it — as a component, not as a flex row with a padding guessed per screen.
 * Three different inline paddings had grown in the prototype before this
 * existed (§11.17).
 */
export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("ws-card-foot", className)}>{children}</div>;
}

/**
 * A stack of rows inside a card. It spans the card so its separators reach the
 * group's edge; the rows pay the inset.
 *
 * `tinted` is for a stack whose rows carry a ground of their own. There the
 * stack owns the vertical padding too, because dropping the first row's top
 * padding would leave an untinted band above its colour and the tint would read
 * as floating inside the group rather than as one row of it (ADR 0052).
 */
export function CardRows({
  tinted,
  className,
  children,
}: {
  tinted?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("ws-rows", className)} data-tinted={tinted ? "" : undefined}>
      {children}
    </div>
  );
}

export interface RowProps {
  label?: React.ReactNode;
  /** One line, at most 90 characters. It sits on `--fg-dim`, never on muted. */
  hint?: React.ReactNode;
  /** The control. One per kind of value: a bounded number with a unit is a
   *  stepper, a proportion is a slider, a measurement with a decision threshold
   *  is a meter with the threshold drawn in, and a text field is what is left. */
  control?: React.ReactNode;
  /** Stack the control under the label — for a control that is the row's own
   *  content rather than the answer to a label on the same line. */
  layout?: "inline" | "stack";
  /** Marks a value that belongs to the active profile rather than to this
   *  machine. Rendered between the text and the control. */
  scope?: React.ReactNode;
  danger?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * One row inside a card's row stack. It carries the horizontal inset so the
 * hairline below it reaches the group's edge.
 *
 * The pre-port row is `FormRow`; this is the ported one and takes no spacing
 * value from its caller.
 */
export function Row({
  label,
  hint,
  control,
  layout = "inline",
  scope,
  danger,
  className,
  children,
}: RowProps) {
  const trailing = control ?? children;
  return (
    <div
      className={cn("ws-row", className)}
      data-layout={layout === "stack" ? "stack" : undefined}
      data-danger={danger ? "" : undefined}
    >
      {(label || hint) && (
        <div className="ws-row-text">
          {label && <b>{label}</b>}
          {hint && <span className="ws-row-hint">{hint}</span>}
        </div>
      )}
      {(trailing || scope) && (
        <div className="ws-row-ctl">
          {scope}
          {trailing}
        </div>
      )}
    </div>
  );
}
