import { cn } from "@/lib/utils";
import { ICON_PATHS } from "./iconPaths";

/**
 * THE ICON SET — `demo.js`'s `icon()` and its `ICONS` map, ported whole.
 *
 * "Lucide geometry, one stroke weight, DRAWN NOT BORROWED" is the prototype's
 * own header on this set, and it is the reason the paths come across rather
 * than a package name. Several of these exist nowhere else — the handoff (two
 * things and a passage between them), the pending mark (a question inside a
 * clock rather than beside it), the two lanes of `swap` running opposite ways
 * — and each carries a comment in `demo.css` saying why the obvious glyph was
 * rejected. Reaching for the nearest lucide export instead would silently
 * discard those decisions, which is exactly the failure rule 4b names.
 *
 * `lucide-react` stays where Legs 1 and 2a put it: inside the primitives, for
 * the glyphs a control draws for itself (a stepper's chevrons, a chip's ×).
 * A screen names an icon; a control draws its own.
 */

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={cn(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] ?? ICON_PATHS.dot }}
    />
  );
}
