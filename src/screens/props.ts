import type { ReactNode } from "react";

/**
 * THE ONE PROP EVERY MOUNTED SCREEN TAKES, and it is the seam ADR 0055 named.
 *
 * A screen in the gallery and the same screen in the product are ONE
 * implementation with two sets of props. The gallery passes nothing: it asserts
 * no runtime state, it is measured against the prototype property by property,
 * and an extra element in its masthead would break forty measurements at once.
 * The product passes a banner, because the moment the same drawing stands on a
 * product surface it may not imply a state the runtime did not reach (rule 7).
 *
 * It replaces the screen's own banner rather than stacking with it, on the
 * grounds that a masthead states one thing: "planned for Phase 8" is a fact
 * about the feature, "drawn, not wired" is a fact about this build, and where
 * both are true the product's row in `windows/workspace/ia.tsx` says both in
 * one line. Leg 4 deletes that row's banner in the commit that wires the
 * screen, and the screen goes back to carrying its own.
 */
export interface ScreenProps {
  banner?: ReactNode;
}
