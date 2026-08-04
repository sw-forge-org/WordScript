import { cn } from "@/lib/utils";

/**
 * THE 7 px STATUS DOT — `demo.js`'s `dot()`, on `.ws-dot`.
 *
 * An EXPECTED status: a dot and a word, at the head of a meta line. A badge is
 * for a status that is not expected — nine rows each carrying a coloured pill
 * is a colour chart, and the one row that actually needs attention has nothing
 * left to stand out from.
 *
 * Leg 1 ported `.ws-dot` into `shell.css` and left this component drawing
 * itself out of Tailwind utilities at 8 px with `--green` / `--orange` /
 * `--red`, so the one place the dot was defined and the one place it was drawn
 * disagreed on its size and on all three of its colours. Found by measuring the
 * withdrawn screen.
 *
 * `accent` RENDERS MUTED, AND THAT IS THE PROTOTYPE. `demo.css` defines rules
 * for `success`, `warning` and `danger` only, while `demo.js` calls
 * `dot("accent")` once — on the withdrawn screen's overlay drawing — so that
 * dot falls through to `--fg-muted` there. Carried across as it renders rather
 * than as it reads: where a prototype's stylesheet and its markup disagree, the
 * drawing is what was looked at and accepted.
 */
export type StatusDotTone = "success" | "warning" | "error" | "danger" | "accent" | "neutral";

/** The port's names on the left, the prototype's `data-tone` on the right. */
const TONE: Partial<Record<StatusDotTone, string>> = {
  success: "success",
  warning: "warning",
  error: "danger",
  danger: "danger",
  accent: "accent",
};

export function StatusDot({
  tone = "neutral",
  label,
  className,
}: {
  tone?: StatusDotTone;
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-label={label}
      aria-hidden={!label}
      className={cn("ws-dot", className)}
      data-tone={TONE[tone]}
    />
  );
}
