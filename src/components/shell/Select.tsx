import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends React.ComponentPropsWithoutRef<"select"> {
  /** Spans its cell. Only inside a stacked row, where the select is the row's
   *  own content rather than the answer to a label on the same line. */
  wide?: boolean;
  wrapClassName?: string;
}

/**
 * THE POP-UP BUTTON, AND IT IS SIZED TO ITS CONTENT.
 *
 * `width: 100%` was the whole complaint. A select stretched to its cell, so
 * "Yeti Nano Analog Stereo — default" and "Auto" were the same width, and the
 * control stopped saying anything about the length of what it holds. A macOS
 * pop-up button is sized to its content: the chevron sits immediately after the
 * value, and a row of them ends on a ragged right edge that tells you at a
 * glance which settings hold long values and which hold a word.
 *
 * THE CHEVRON IS A WELL, NOT A MARK. It was a rotated glyph floating over the
 * field; here it is a tinted well at the trailing edge carrying a double
 * chevron, so the control reads as pressable rather than as a text field that
 * happens to have something in the corner. Drawn as a mask rather than a
 * background image so its colour is still `--fg-dim` and still changes with the
 * scheme — an inline SVG painted as a background carries a literal hex, and
 * would be the one mark on the surface that stays dark under the light palette.
 *
 * A native `<select>` keeps the keyboard and scroll behaviour correct and feels
 * closer to a system control than a custom listbox for long option lists.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapClassName, wide, children, ...props }, ref) => (
    <span className={cn("ws-sel-wrap", wrapClassName)}>
      <select
        ref={ref}
        className={cn("ws-sel", className)}
        data-wide={wide ? "" : undefined}
        {...props}
      >
        {children}
      </select>
    </span>
  ),
);
Select.displayName = "Select";
