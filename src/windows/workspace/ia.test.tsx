import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ENTRY_POINT_HOLES, SECTIONS, SECTION_GROUPS, VIEWS } from "./ia";
import { ALL_SCREENS } from "@/windows/gallery/registry";

afterEach(cleanup);

/**
 * WHAT A UNIT TEST CAN HOLD ABOUT AN INFORMATION ARCHITECTURE. Not that it
 * looks right — `npm run port:diff` measures that against the prototype — but
 * that it is the architecture §4.2 describes, that every row leads somewhere,
 * and that nothing on a product surface claims a runtime state.
 */
describe("the information architecture", () => {
  it("is four workspace views and ten settings sections in three groups", () => {
    expect(VIEWS.map((view) => view.id)).toEqual(["home", "history", "profiles", "context"]);
    expect(SECTION_GROUPS.map((group) => group.name)).toEqual(["App", "AI", "System"]);
    expect(SECTIONS).toHaveLength(10);
  });

  // A group that lists an id no section answers is a nav row that opens
  // nothing, which is the fake affordance rule 7 forbids — and a section no
  // group lists is a screen with no way in.
  it("has every section in exactly one group and every group entry in SECTIONS", () => {
    const grouped = SECTION_GROUPS.flatMap((group) => group.ids);
    expect([...grouped].sort()).toEqual(SECTIONS.map((section) => section.id).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  // ADR 0055: a screen in the gallery and the same screen in the product are
  // ONE implementation with two sets of props. Same function, not same output.
  it("mounts the very same screen the gallery displays", () => {
    const mounted = [...VIEWS, ...SECTIONS];
    for (const entry of mounted) {
      const listed = ALL_SCREENS.find((screenEntry) => screenEntry.id === entry.id);
      expect(listed, `${entry.id} is not in the gallery registry`).toBeDefined();
      expect(listed!.render, `${entry.id} has no gallery render`).toBeDefined();
    }
  });

  // Leg 4 deletes a banner in the commit that wires its section. Until then
  // every mounted screen states on itself that it is drawn rather than wired.
  it("gives every mounted screen a banner until Leg 4 takes it off", () => {
    for (const entry of [...VIEWS, ...SECTIONS]) {
      expect(entry.banner, `${entry.id} would imply a runtime state`).toBeTruthy();
    }
  });

  it("renders the banner it carries, on the screen it carries it for", () => {
    for (const entry of [...VIEWS, ...SECTIONS]) {
      render(<>{entry.render({ banner: entry.banner })}</>);
      expect(screen.getAllByText(/Preview/i).length, entry.id).toBeGreaterThan(0);
      cleanup();
    }
  });

  // §2.6. Six surfaces have a drawn layout and no decided lifecycle; five of
  // them live outside this window. The list is Leg 4a's first input, so it has
  // to survive being edited by somebody who is not reading the record.
  it("still names all six undecided surfaces and where each door would go", () => {
    expect(ENTRY_POINT_HOLES).toHaveLength(6);
    for (const hole of ENTRY_POINT_HOLES) {
      expect(ALL_SCREENS.some((entry) => entry.id === hole.screen), hole.surface).toBe(true);
      expect(hole.wouldGo.length).toBeGreaterThan(0);
      expect(hole.undecided.length).toBeGreaterThan(0);
    }
  });

  // A door that leads to one of the six would be an affordance for a lifecycle
  // nobody has decided. None is mounted, and that is the leg's whole answer to
  // §2.6: write the hole down, do not fill it.
  it("mounts none of the six", () => {
    const holes = new Set<string>(ENTRY_POINT_HOLES.map((hole) => hole.screen));
    for (const entry of [...VIEWS, ...SECTIONS]) {
      expect(holes.has(entry.id), `${entry.id} is Leg 4a's to decide`).toBe(false);
    }
  });
});
