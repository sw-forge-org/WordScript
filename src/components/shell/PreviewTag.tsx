import * as React from "react";
import { cn } from "@/lib/utils";

interface PreviewTagProps {
  /** What the row will do once it is built. Becomes the tag's tooltip, so the
   *  reader can find out without the sentence occupying the row forever. */
  title?: string;
  /** `withdrawn` for a control the plan decided against but has not removed. */
  tone?: "preview" | "withdrawn";
  className?: string;
}

/**
 * A DRAWN ROW SAYS SO ON ITSELF, NEXT TO ITS OWN LABEL (ADR 0161).
 *
 * **`PreviewBanner` answers for a screen; this answers for one row.** The banner
 * is the right size for *this whole view is a sketch* and the wrong size for a
 * card where four rows are read from the runtime and three are drawings — the
 * case AI Models became once B5 and B8 wired half of it. A per-screen banner on
 * a half-wired screen is either a lie about the wired half or a caveat the
 * reader learns to ignore.
 *
 * **It sits by the label, not by the control.** A reader scans labels and then
 * looks right for the value. A marker at the value is read *after* the value,
 * which means the sentence `CPU only · no CUDA device found` is believed first
 * and corrected second. At the label it is read before.
 *
 * **The word is the banner's word.** One vocabulary for one status: a screen
 * that says *Preview* at the top and *Not built* in a row would be two grades
 * of the same fact.
 *
 * **It is not a `StatusBadge`.** A badge states what the runtime found; this
 * states that nothing looked. Giving them one shape would put *this is a
 * drawing* on the same axis as *this is what your machine says*, which is the
 * one distinction the whole marker exists to carry.
 */
export function PreviewTag({ title, tone = "preview", className }: PreviewTagProps) {
  return (
    <span
      className={cn("ws-ptag", className)}
      data-tone={tone === "withdrawn" ? "withdrawn" : undefined}
      title={title}
    >
      {tone === "withdrawn" ? "Withdrawn" : "Preview"}
    </span>
  );
}
