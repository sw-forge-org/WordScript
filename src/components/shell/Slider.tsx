import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  /** 0–100. */
  value: number;
  onChange?: (value: number) => void;
  step?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * A PROPORTION WITH NO UNIT WORTH TYPING.
 *
 * The read-out is not decoration: the cue volume multiplies with the OS volume,
 * so without a number there is no telling an in-app change from a system one.
 *
 * The drawing is the prototype's — a 4 px inset track, an accent fill, a 14 px
 * knob with a cast shadow, and the percentage right-aligned in a fixed 34 px
 * column so the track does not move as the number changes width. The input is a
 * native `range` laid transparently over the track, which is what keeps drag,
 * arrow keys, Home/End and Page Up/Down behaving the way every other slider on
 * the machine does.
 */
export function Slider({
  value,
  onChange,
  step = 1,
  disabled,
  id,
  className,
  ...rest
}: SliderProps) {
  const pct = Math.round(Math.min(Math.max(value, 0), 100));

  return (
    <span className={cn("ws-slider", className)}>
      <span className="ws-slider-track">
        <i style={{ width: `${pct}%` }} />
        <span className="ws-slider-knob" style={{ left: `${pct}%` }} />
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={step}
          value={pct}
          disabled={disabled}
          aria-label={rest["aria-label"]}
          onChange={(event) => onChange?.(Number(event.target.value))}
          className="ws-slider-input"
        />
      </span>
      <span className="ws-slider-out">{pct}%</span>
    </span>
  );
}
