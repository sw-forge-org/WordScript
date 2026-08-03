/**
 * Deep-link targets into the settings surface.
 *
 * A semantic name for a *control*, not for the area it currently sits in. The
 * settings surface is being reworked (docs/SETTINGS_REWORK_PLAN.md): the
 * auto-stop lives in Input today and moves to Profiles → Defaults with Stage 4.
 * A link that named the area would keep resolving to a screen that no longer
 * has the control, and it would do so silently.
 *
 * `SETTINGS_ANCHOR_AREAS` is the one place that mapping is written down.
 */
export const SETTINGS_ANCHOR_AUTO_STOP = "capture.auto_stop";

export type SettingsAnchor = typeof SETTINGS_ANCHOR_AUTO_STOP;

/** Which area currently owns each anchored control. */
export const SETTINGS_ANCHOR_AREAS: Record<SettingsAnchor, string> = {
  [SETTINGS_ANCHOR_AUTO_STOP]: "input",
};

/** The DOM id the target row carries, so the area can scroll it into view. */
export function settingsAnchorElementId(anchor: SettingsAnchor): string {
  return `settings-anchor-${anchor.replace(/\./g, "-")}`;
}
