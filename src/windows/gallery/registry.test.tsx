import { describe, expect, it } from "vitest";
import { ALL_SCREENS, SCREEN_GROUPS } from "./registry";
import { SECTIONS, VIEWS } from "@/windows/workspace/ia";

/**
 * The registry is gallery scaffolding and retires per screen in the commit that
 * wires it (ADR 0057), so this file retires with it. It moved out of
 * `screens.test.tsx` in Leg 3, when the screens themselves moved to `src/` and
 * stopped being the gallery's.
 *
 * THE GALLERY SHRINKS BY WIRING AND BY NOTHING ELSE, AND THAT IS THIS FILE'S
 * JOB NOW. Leg 4a measured what a stray deletion costs: 84 components in
 * `components/shell/` are reachable only through the nine screens the product
 * mounts nowhere, and a screen's registry entry is the only thing that
 * references its family. Delete one preview's entry and the whole family is
 * orphaned; the next "nothing imports this" pass takes ~700 lines of ported CSS
 * with it. The old assertion here was `toHaveLength(25)` — a literal that breaks
 * on the first wired screen, so the one commit that must edit it is also the
 * commit where five more entries could go along and every test would still pass.
 *
 * So the count is DERIVED rather than written down: the prototype's 25 are
 * frozen below, and the only ids that may be missing from the registry are the
 * ids the product now mounts WITHOUT a banner. A banner is the statement that a
 * screen is drawn rather than wired (`windows/workspace/ia.tsx`), so its absence
 * is the definition of wired, and ADR 0057 retires an entry in exactly that
 * commit. Both directions fail loudly: an entry deleted without wiring, and a
 * screen wired without retiring its entry.
 */

/**
 * `demo.js`'s `NAV`, frozen. This is provenance rather than configuration — the
 * prototype is read-only (ADR 0057) and can never grow a 26th, so this list does
 * not change again. `ds` is the Design System screen, which is the gallery's own
 * three permanent pages and has no product surface to be wired to.
 */
const PROTOTYPE_SCREENS = [
  "ds",
  "home",
  "history",
  "profiles",
  "context",
  "general",
  "hotkeys",
  "notesettings",
  "models",
  "agents",
  "integrations",
  "delivery",
  "privacy",
  "diagnostics",
  "about",
  "onboarding",
  "translate",
  "subtitles",
  "meeting",
  "conversation",
  "agentoverlay",
  "handoff",
  "commit",
  "contextintake",
  "contextactions",
] as const;

/** Mounted on a product surface and still saying it is drawn rather than wired.
 *  The registry entry IS that statement now — it carries the banner's sentence,
 *  the chip's word, and what Developer Mode off does to the surface. */
function drawnOnAProductSurface(): string[] {
  return [...VIEWS, ...SECTIONS].filter((entry) => entry.preview).map((entry) => entry.id);
}

/** Mounted on a product surface with no registry entry — i.e. wired. */
function wired(): string[] {
  return [...VIEWS, ...SECTIONS].filter((entry) => !entry.preview).map((entry) => entry.id);
}

describe("the registry", () => {
  it("keeps the prototype's four groups", () => {
    expect(SCREEN_GROUPS.map((g) => g.group)).toEqual([
      "System",
      "Workspace",
      "Settings",
      "Previews",
    ]);
  });

  it("invents nothing: every entry is one of the prototype's 25", () => {
    for (const entry of ALL_SCREENS) {
      expect(PROTOTYPE_SCREENS, `${entry.id} is not a screen the prototype drew`).toContain(entry.id);
    }
  });

  // THE GUARD. Not "the registry has N entries" — the set that left it is
  // exactly the set the product mounts without a banner.
  it("loses an entry only to the commit that wires that screen", () => {
    const present = new Set(ALL_SCREENS.map((screen) => screen.id));
    const retired = PROTOTYPE_SCREENS.filter((id) => !present.has(id));

    expect(
      [...retired].sort(),
      "an entry left the gallery without its screen being wired, or a wired screen kept its entry (ADR 0057)",
    ).toEqual([...wired()].sort());
  });

  // The same fact counted, so the drop is visible in the diff of whoever wires
  // a screen rather than only in a set comparison.
  it("holds the prototype's 25 minus the ones already wired", () => {
    expect(ALL_SCREENS).toHaveLength(PROTOTYPE_SCREENS.length - wired().length);
  });

  // A screen the product still draws has to stay reachable in the gallery: the
  // gallery is where the port is judged (ADR 0055), and it is also the only
  // reference to that screen's half of `components/shell/`.
  it("still lists every screen the product mounts but has not wired", () => {
    const present = new Set(ALL_SCREENS.map((screen) => screen.id));
    for (const id of drawnOnAProductSurface()) {
      expect(present.has(id), `${id} is drawn on a product surface and has no gallery entry`).toBe(true);
    }
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
