import { describe, expect, it } from "vitest";
import {
  SETTINGS_ANCHOR_AUTO_STOP,
  SETTINGS_ANCHOR_TARGETS,
  settingsAnchorElementId,
} from "./settingsAnchors";
import { SECTIONS, VIEWS } from "@/windows/workspace/ia";

/**
 * THE ONE RUNTIME CONTRACT THE PORT DOES NOT GET TO OVERWRITE (ADR 0054).
 *
 * Rust emits an anchor and the workspace has to resolve it. Nothing checked
 * that before this leg, and it was already broken: the mapping named the area
 * `input` while the window's ids were `capture`, `speech` and the rest, so the
 * overlay's only deep link rendered a blank pane. A mapping in one file is only
 * a contract if something fails when it stops being true.
 */
describe("the settings anchors", () => {
  it("resolves every anchor to a surface the workspace actually mounts", () => {
    for (const [anchor, target] of Object.entries(SETTINGS_ANCHOR_TARGETS)) {
      const known =
        target.surface === "view"
          ? VIEWS.some((view) => view.id === target.id)
          : SECTIONS.some((section) => section.id === target.id);
      expect(known, `${anchor} → ${target.surface} ${target.id}`).toBe(true);
    }
  });

  // §11.7 moved auto-stop out of settings and into the profile: it is a
  // per-profile value and settings means this machine. So the one anchor that
  // exists lands in a WORKSPACE VIEW, and resolving it must not open the sheet.
  it("puts the auto-stop where §11.7 put it", () => {
    expect(SETTINGS_ANCHOR_TARGETS[SETTINGS_ANCHOR_AUTO_STOP]).toEqual({
      surface: "view",
      id: "profiles",
    });
  });

  it("derives the element id from the anchor rather than storing a second name", () => {
    expect(settingsAnchorElementId(SETTINGS_ANCHOR_AUTO_STOP)).toBe(
      "settings-anchor-capture-auto_stop",
    );
  });
});
