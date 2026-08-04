import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SegmentControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * THE SEGMENTED CONTROL. One inset track, the active segment an elevated chip
 * carrying the accent on its label. For binary and few-way choices where every
 * option is a word; where an option needs a sentence, the control is `LaneCard`.
 *
 * The track is a control (`--r-control`) and the chip is inside one
 * (`--r-small`). It was a capsule on both counts until the radius ladder
 * (§11.32).
 *
 * IT IS A GROUP OF PRESSED BUTTONS, NOT A TABLIST. The prototype draws these
 * two things differently on purpose: `.subtabs` is `role="tablist"` with
 * `aria-selected`, because a sub-tab swaps the panel under it; `.seg` is
 * `aria-pressed`, because a segment sets a value and nothing is revealed. Leg 1
 * gave this one the tab roles, which made every value control on the surface
 * announce itself as navigation.
 *
 * The `size` prop went with them. The prototype has one segment size — 4/12
 * padding at the label step — and a second existed here only so the gallery's
 * scheme switch could be smaller than the control it is displaying.
 */
export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ...rest
}: SegmentControlProps<T>) {
  return (
    <div role="group" aria-label={rest["aria-label"]} className={cn("ws-seg", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
