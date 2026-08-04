import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

/**
 * THE SWITCH, PORTED. Was `export { Switch as Toggle }` — the shadcn/Radix
 * primitive — until Leg 2 of the GUI port relay. Three things made that the
 * wrong object rather than merely a different one:
 *
 * THE KNOB WAS DARK WHEN CHECKED. `--on-accent` is a near-black disc on a
 * saturated track, and that inversion is what makes an on switch read as a
 * solid orange slab with a hole punched in it rather than as a knob that has
 * travelled. A light knob keeps the track readable as a track, which is the
 * whole reason the shape works.
 *
 * THE DISABLED-ON STATE WORE THE ATTENTION COLOUR. At `opacity: .4` an accent
 * track is still the most saturated thing in its row, so the eye goes to the
 * one switch in the card that cannot be operated. Disabled means the accent is
 * spent elsewhere, so it is dropped entirely rather than dimmed.
 *
 * AND IT MEASURED ITS OWN THUMB. Radix's Switch reaches for a ResizeObserver in
 * a layout effect, which jsdom does not have — every test that rendered a
 * switch threw from a layout effect until `vitest.setup.ts` grew a stub for it.
 * A 38 × 22 track with a 16 px knob that travels 16 px needs no measurement.
 */
export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
  ...aria
}: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn("ws-toggle", className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...aria}
    />
  );
}
