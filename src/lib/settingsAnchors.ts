/**
 * Deep-link targets into the surface.
 *
 * A semantic name for a *control*, not for the place it currently sits. This is
 * the one exception ADR 0054 names: the port overwrites the shipped surface and
 * aliases nothing, EXCEPT here, because this is a runtime contract with a native
 * caller (`open_settings_window(target)` in `src-tauri/src/lib.rs`) rather than
 * a convenience for a human's habit. A link that named the area would keep
 * resolving to a screen that no longer has the control, and it would do so
 * silently.
 *
 * IT WAS ALREADY SILENTLY BROKEN when Leg 3 opened it. The mapping named the
 * area `input`; the window's area ids were `capture`, `speech`, `modes` and the
 * rest, and `input` was the id the tab carried before it was renamed. So the
 * overlay's only deep link navigated to an area that did not exist, the switch
 * fell through to `default: return null`, and the window showed a header with a
 * blank pane under it. A mapping written down in one file is only a contract if
 * something checks it, which is what `settingsAnchors.test.ts` does now.
 *
 * THE TARGET IS A SURFACE AND AN ID, NOT AN ID. Settings is a sheet over the
 * workspace (§11.22), so "where a control lives" has two answers: a view in the
 * window, or a section in the sheet. The one anchor that exists resolves to a
 * VIEW — §11.7 moved auto-stop out of settings and into the profile, because it
 * is a per-profile value and settings means this machine — so the link lands in
 * Profiles → Defaults and does not open the sheet at all.
 */
export const SETTINGS_ANCHOR_AUTO_STOP = "capture.auto_stop";

export type SettingsAnchor = typeof SETTINGS_ANCHOR_AUTO_STOP;

export interface SettingsAnchorTarget {
  /** `view` is the workspace window; `section` opens the settings sheet. */
  surface: "view" | "section";
  id: string;
}

/** Which surface currently owns each anchored control. */
export const SETTINGS_ANCHOR_TARGETS: Record<SettingsAnchor, SettingsAnchorTarget> = {
  [SETTINGS_ANCHOR_AUTO_STOP]: { surface: "view", id: "profiles" },
};

/** The DOM id the target row carries, so the surface can scroll it into view. */
export function settingsAnchorElementId(anchor: SettingsAnchor): string {
  return `settings-anchor-${anchor.replace(/\./g, "-")}`;
}
