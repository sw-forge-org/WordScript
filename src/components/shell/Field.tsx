import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends React.ComponentPropsWithoutRef<"input"> {
  /** The border carries the state at reduced strength and a faint ground backs
   *  it up; the sentence underneath carries the reason. */
  invalid?: boolean;
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
  ({ invalid, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn("ws-field", className)}
      data-invalid={invalid ? "" : undefined}
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
