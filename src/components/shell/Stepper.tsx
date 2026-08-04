import * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** The unit lives INSIDE the control, not in a sentence beside it. */
  suffix?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * A BOUNDED NUMBER ADJUSTED BY ONE.
 *
 * "One control per kind of value": a number with a unit and a small range is a
 * stepper, never a text field. The two buttons are the whole affordance, which
 * is why the readout in the middle is a readout — Leg 1 kept an editable
 * `<input type="number">` there, and a field invites a keyboard for a value
 * whose entire range is reachable in a few presses. The end of the range is
 * visible because the button at that end is disabled.
 */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  id,
  className,
  ...rest
}: StepperProps) {
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;

  const clamp = (n: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));

  return (
    <span
      id={id}
      role="group"
      aria-label={rest["aria-label"]}
      className={cn("ws-stepper", className)}
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={atMin}
        onClick={() => onChange?.(clamp(value - step))}
      >
        <MinusIcon aria-hidden />
      </button>
      <span className="ws-stepper-val">{value}</span>
      <button
        type="button"
        aria-label="Increase"
        disabled={atMax}
        onClick={() => onChange?.(clamp(value + step))}
      >
        <PlusIcon aria-hidden />
      </button>
      {suffix && <span className="ws-stepper-unit">{suffix}</span>}
    </span>
  );
}
