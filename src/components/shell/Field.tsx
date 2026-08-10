import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends React.ComponentPropsWithoutRef<"input"> {
  /** The border carries the state at reduced strength and a faint ground backs
   *  it up; the sentence underneath carries the reason. */
  invalid?: boolean;
  /** `demo.js`'s `field(value, { w })`. A field is sized to what it holds — a
   *  URL is not a model id is not a name — and the length is a property of the
   *  value, so it is the field's option rather than a style at the call site. */
  w?: string;
}

/**
 * A TEXT FIELD, AND ITS BORDER IS THE ONE SIGNAL THAT MEANS "YOU CAN PUT
 * SOMETHING IN HERE" (the elevation rule, on the Design System screen).
 *
 * `invalid` is deliberately not a ring. A full-saturation ring around a text
 * field is the loudest object on a settings card, and it is spent on a field
 * the user is usually still typing in. Two quiet signals that agree — a
 * weakened border and a faint ground — beat one loud one that only says
 * "wrong".
 */
export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ invalid, w, style, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn("ws-field", className)}
      data-invalid={invalid ? "" : undefined}
      style={w ? { width: w, ...style } : style}
      {...props}
    />
  ),
);
Field.displayName = "Field";

/** The same control for a value that is a paragraph. Resizes vertically only. */
export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea">
>(({ className, rows = 3, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn("ws-field", className)} {...props} />
));
TextArea.displayName = "TextArea";

/**
 * WHAT A BOUNDED FIELD HAS SPENT — `demo.css`'s `.meter`, whose builder
 * (`meterLine`) is the one function in `demo.js` that nothing ever called. It
 * was written for the communication style's two bounded fields and stayed
 * behind when that card moved into the profile and was never drawn there, so
 * this is a port with provenance rather than a new component (ADR 0068).
 *
 * The class is `.ws-meter` and the component is not, because `LevelMeter` and
 * `InputLevelMeter` already mean the audio kind: this one measures a budget,
 * not a signal.
 *
 * It states the count rather than only colouring: what passes the bound is not
 * sent to the model, and "over" without a number leaves the reader guessing by
 * how much.
 */
export function BudgetMeter({ used, max }: { used: number; max: number }) {
  const over = used > max;
  return (
    <div className="ws-meter" data-over={over ? "" : undefined}>
      <span>
        {used} / {max}
      </span>
      <span className="ws-meter-bar">
        <i style={{ width: `${Math.min(100, Math.round((used / Math.max(1, max)) * 100))}%` }} />
      </span>
    </div>
  );
}

/** A field and whatever states its constraint, on one column. */
export function FieldWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("ws-field-wrap", className)}>{children}</div>;
}
