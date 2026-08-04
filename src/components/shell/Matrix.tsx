import * as React from "react";
import {
  Matrix as MatrixLed,
  digits,
  loader,
  pulse,
  snake,
  vu,
  wave,
  type Frame,
} from "@/components/ui/matrix";
import { cn } from "@/lib/utils";

export type { Frame };
export const MATRIX_FRAMES = { digits, loader, pulse, snake, wave };
export { vu };

type MatrixProps = React.ComponentProps<typeof MatrixLed>;

/**
 * THE DOT-MATRIX READOUT, with the product's two colours pinned.
 *
 * Upstream (ElevenLabs UI, MIT) reads its lit and unlit colours from
 * `--matrix-on` / `--matrix-off` and takes them as a `palette` prop. Those two
 * values are a design decision, not a call-site one — an emitting pixel is the
 * accent and the dark grid is `--fg-muted` — so they are declared once, here,
 * which is what makes a matrix in the dark scheme and one in the light scheme
 * the same component rather than two.
 *
 * `flex: none`, because a shrinkable SVG inside a flex row gets squashed to its
 * content box rather than clipped: the meter came out 28 px wide inside a 166
 * px drawing, which reads as a dash and not as a reading.
 *
 * THE UNLIT GRID IS DRAWN, NEVER OMITTED. It is what makes a mostly-off display
 * read as a display rather than as loose dots floating on the panel.
 */
export function Matrix({ className, palette, ...props }: MatrixProps) {
  return (
    <MatrixLed
      className={cn("flex-none", className)}
      palette={palette ?? { on: "var(--accent)", off: "var(--fg-muted)" }}
      {...props}
    />
  );
}
