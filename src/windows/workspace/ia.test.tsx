import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTRY_POINT_HOLES, SECTIONS, SECTION_GROUPS, VIEWS, surfaceBanner } from "./ia";
import { DeveloperModeProvider } from "@/lib/developerMode";
import { ALL_SCREENS } from "@/windows/gallery/registry";
import { createWorkspaceRuntime } from "@/test/factories";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn().mockResolvedValue(undefined) }));

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
  // It holds while both exist; a wired screen has left the gallery in the
  // commit that wired it (ADR 0057), and `registry.test.tsx` holds that half.
  it("mounts the very same screen the gallery displays, for as long as both exist", () => {
    for (const entry of [...VIEWS, ...SECTIONS]) {
      const listed = ALL_SCREENS.find((screenEntry) => screenEntry.id === entry.id);
      if (!listed) {
        expect(entry.preview, `${entry.id} left the gallery without being wired`).toBeUndefined();
        continue;
      }
      expect(listed.render, `${entry.id} has no gallery render`).toBeDefined();
    }
  });

  // Leg 4 deletes a banner in the commit that wires its section. Until then
  // every screen that is still a drawing states on itself that it is drawn
  // rather than wired — and a screen that has stopped saying so has to have
  // stopped being a drawing, which is the assertion above.
  it("gives every screen that is still a drawing a registry entry", () => {
    const drawn = [...VIEWS, ...SECTIONS].filter((entry) =>
      ALL_SCREENS.some((screenEntry) => screenEntry.id === entry.id),
    );
    expect(drawn.length, "every screen is wired — this test has done its job").toBeGreaterThan(0);
    for (const entry of drawn) {
      expect(entry.preview, `${entry.id} would imply a runtime state`).toBeTruthy();
    }
  });

  /* WHAT IS HELD IS THAT THE BANNER IS THERE, NOT WHICH WORD ITS CHIP CARRIES.
     This case read `/Preview/i` off the rendered screen, which was the same
     thing while every banner said `Preview` — and stopped being the same thing
     the moment a screen graded itself: Home reads its inbox, its record and two
     of its four counters from the runtime, so its chip says `Wired in part`.
     Pinning the vocabulary here would make the honest word the failing one. */
  it("renders the banner it carries, on the screen it carries it for", () => {
    for (const entry of [...VIEWS, ...SECTIONS]) {
      if (!entry.preview) continue;
      /* IN DEVELOPER MODE, BECAUSE THAT IS THE ONLY STATE THAT HAS A BANNER TO
         RENDER. Outside it the marker suppresses itself and this case would be
         asserting that a chip the reader asked not to see is absent, which is
         the filter's test rather than the banner's. */
      const { container } = render(
        <DeveloperModeProvider value={true}>
          {entry.render({ banner: surfaceBanner(entry.preview), runtime: createWorkspaceRuntime() })}
        </DeveloperModeProvider>,
      );
      const banner = container.querySelector(".ws-banner");
      expect(banner, `${entry.id} does not render the banner it carries`).not.toBeNull();
      expect(
        banner!.querySelector(".ws-banner-tag")?.textContent?.trim(),
        `${entry.id} renders a banner with no grade on it`,
      ).toBeTruthy();
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
