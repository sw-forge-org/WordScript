import { describe, expect, it } from "vitest";
import { ALL_SCREENS, SCREEN_GROUPS } from "./registry";

/**
 * The registry is gallery scaffolding and retires per screen in the commit that
 * wires it (ADR 0057), so this file retires with it. It moved out of
 * `screens.test.tsx` in Leg 3, when the screens themselves moved to `src/` and
 * stopped being the gallery's.
 */
describe("the registry", () => {
  it("carries the prototype's 25 screens in the prototype's four groups", () => {
    expect(SCREEN_GROUPS.map((g) => g.group)).toEqual([
      "System",
      "Workspace",
      "Settings",
      "Previews",
    ]);
    expect(ALL_SCREENS).toHaveLength(25);
  });

  it("has no duplicate id, so the picker cannot mount the wrong screen", () => {
    const ids = ALL_SCREENS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks the withdrawn screen as withdrawn rather than as a target", () => {
    const withdrawn = ALL_SCREENS.filter((s) => s.withdrawn);
    expect(withdrawn.map((s) => s.id)).toEqual(["commit"]);
  });
});
