import type { ReactNode } from "react";
import type { AppConfig, RuntimeState } from "@/types/ipc";

/**
 * THE ONE PROP EVERY DRAWN SCREEN TAKES, and it is the seam ADR 0055 named.
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

/**
 * WHAT THE WORKSPACE HANDS A WIRED SCREEN — the other half of the same seam.
 *
 * A wired screen reads the runtime, and there is exactly one reader per window:
 * `useRuntime` opens two event channels and loads the config, so a second
 * instance inside a screen would double every listener and give two components
 * two different opinions of one config. So the window reads and the screen is
 * handed the result.
 *
 * IT IS REQUIRED, NOT OPTIONAL, AND THAT IS THE POINT. A screen that takes
 * `WiredScreenProps` cannot be rendered by the gallery's registry, which passes
 * nothing — the compiler refuses it. So "wired" and "retired from the gallery"
 * are the same edit rather than two edits somebody has to remember to make
 * together (ADR 0057), and `registry.test.tsx` holds the other direction.
 */
export interface WorkspaceRuntime {
  /** The config the runtime holds, as this window last saw it. Never null on a
   *  wired screen: the workspace does not render one until the runtime answers. */
  config: AppConfig;
  /** Session status, the last result, the last error. */
  state: RuntimeState;
  /** Instant save for a DISCRETE control — a toggle, a select, a radio. Every
   *  patch is persisted immediately, which is the fact the sheet's foot states. */
  patch: (partial: Partial<AppConfig>) => void;
  /** Draft-then-commit for a TEXT input (plan P1). The draft is applied to the
   *  form on the keystroke and the disk write is debounced, so what you typed is
   *  never behind the cursor and typing is not five config writes a second. */
  patchText: (partial: Partial<AppConfig>) => void;
  /** Commit a pending `patchText` now — a field's blur, or leaving the screen. */
  flushText: () => void;
  /** False while the surface is mounted but hidden (plan P2 keeps a visited view
   *  mounted rather than rebuilding it). A screen that polls idles on false. */
  active: boolean;
  /**
   * Go to another surface of the workspace — the `Open Home`, `Open Context`
   * and `Change in profile` doors several screens draw.
   *
   * OPTIONAL, AND ITS ABSENCE IS LOAD-BEARING. The Diagnostics pop-out is its
   * own window with one section in it and nowhere to navigate to, so it does
   * not pass one, and a screen that draws such a door renders it only when
   * there is somewhere for it to go. A button that opens nothing is the fake
   * affordance rule 7 forbids — the same rule that keeps the sidebar's search
   * field unmounted while there is no command palette.
   *
   * Untyped ids for the same reason `SETTINGS_ANCHOR_TARGETS` carries them
   * untyped: the workspace is the authority on what exists, and it opens
   * nothing rather than guessing when it does not recognise one.
   */
  open?: (target: { view: string } | { section: string }) => void;
}

export interface WiredScreenProps extends ScreenProps {
  runtime: WorkspaceRuntime;
}

/**
 * What `windows/workspace/ia.tsx` hands to a row's `render`. `runtime` is always
 * present on a product surface; a screen that has not been wired yet simply
 * ignores it, which is what keeps the table one shape for all fourteen rows.
 */
export interface ScreenSlot extends ScreenProps {
  runtime: WorkspaceRuntime;
}
