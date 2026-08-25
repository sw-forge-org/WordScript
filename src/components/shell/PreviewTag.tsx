import * as React from "react";
import { cn } from "@/lib/utils";
import { useDeveloperMode } from "@/lib/developerMode";
import { findPreview, type PreviewId } from "@/lib/previewSurfaces";

interface PreviewTagProps {
  /** The row's entry in `previewSurfaces.ts`, which carries what it will do
   *  once it is built. A tag with an id draws nothing outside Developer Mode;
   *  a tag without one is a literal and `previewSurfaces.test.ts` refuses it
   *  outside the gallery. */
  id?: PreviewId;
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
export function PreviewTag({ id, title, tone = "preview", className }: PreviewTagProps) {
  const developer = useDeveloperMode();
  /* A REGISTERED TAG IS THE SWITCH'S BUSINESS; A LITERAL ONE IS THE GALLERY'S.
     The gallery provides `true` and sees both, so the branch costs it nothing
     and the workspace cannot draw a chip it was told to put away. */
  if (id && !developer) return null;
  /* THE ID DECIDES WHETHER IT IS DRAWN; THE TITLE MAY STILL DECIDE WHAT IT
     SAYS. One caller needs both — Onboarding tags each withheld lane with that
     lane's own reason out of `LANE_NOT_OFFERED`, and two lanes withheld for two
     different reasons may not share one sentence. The registry entry is what
     makes the tag reachable by the filter; the override is what keeps it
     specific. */
  const says = title ?? (id ? findPreview(id).says : undefined);
  return (
    <span
      className={cn("ws-ptag", className)}
      data-tone={tone === "withdrawn" ? "withdrawn" : undefined}
      title={says}
    >
      {tone === "withdrawn" ? "Withdrawn" : "Preview"}
    </span>
  );
}
