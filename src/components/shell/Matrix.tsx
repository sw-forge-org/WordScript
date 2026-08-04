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
 *
 * `ws-matrix-wrap` NAMES THE WRAPPER THE PROTOTYPE ALSO NAMES, and it is the
 * one place the two are not the same DOM. The prototype hand-builds its SVG —
 * one `<circle>` per pixel written by `matrixMount` — where this mounts
 * upstream's component, which brings its own wrapper, its own inline `<style>`
 * and its own active-pixel class. The drawing agrees; the tree does not, and
 * the class is what lets the port verifier say so by name rather than report a
 * hundred and twelve missing elements. Same recorded divergence as the live
 * waveform, and for the same reason.
 */
export function Matrix({ className, palette, ...props }: MatrixProps) {
  return (
    <MatrixLed
      /* `inline-flex` and `static` are here to BEAT upstream's own
         `relative inline-block`, not to restate it: they are in the same
         tailwind-merge groups, so passing them drops upstream's pair and the
         wrapper computes what `.ws-matrix-wrap` in shell.css asks for. Without
         them the utilities layer wins over the components layer and the
         prototype's inline-flex is silently not what ships. */
      className={cn("ws-matrix-wrap inline-flex static flex-none", className)}
      palette={palette ?? { on: "var(--accent)", off: "var(--fg-muted)" }}
      {...props}
    />
  );
}
