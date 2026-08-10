import { useEffect, useState } from "react";
import {
  Icon,
  NavGroup,
  NavRow,
  NavSearch,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFoot,
  SheetHead,
  SheetNav,
  SheetProfile,
} from "@/components/shell";
import type { WorkspaceRuntime } from "@/screens/props";
import { SECTIONS, SECTION_GROUPS, findSection, type SectionId } from "./ia";

/**
 * SETTINGS, AS A SHEET OVER THE WORKSPACE — §11.22.
 *
 * Ten sections in three groups, at the sheet's own scale. What it is NOT is a
 * second top-level window: configuring something is a detour from what you were
 * doing and you come back, and the workspace stays visible behind it so you can
 * see what you will return to.
 *
 * IT RETURNS TO WHAT IT WAS OPENED OVER, and that is free here rather than
 * built: the workspace never unmounts, so closing the sheet reveals the view
 * that was underneath it. The prototype needs `state.under` to remember, because
 * it rebuilds its whole surface on every render.
 *
 * NOT ONE COMPONENT INSIDE IT KNOWS IT IS IN A SHEET. `.ws-modal-win`
 * redeclares eight structure tokens and every screen reads them without being
 * told; the same screens stand in the gallery at the workspace's scale and
 * measure exact against the prototype there. That is ADR 0052's claim, and it
 * is the reason this file is 100 lines rather than a second set of screens.
 */
export function SettingsSheet({
  section,
  runtime,
  onSection,
  onClose,
  closeOnEscape,
  onSearch,
  searchShortcut,
  profile,
  onOpenProfiles,
}: {
  section: SectionId;
  runtime: Omit<WorkspaceRuntime, "active">;
  onSection: (id: SectionId) => void;
  onClose: () => void;
  /** False while the command palette is over this sheet — the Escape stack. */
  closeOnEscape?: boolean;
  onSearch: () => void;
  searchShortcut: string;
  profile: { initials: string; name: string };
  onOpenProfiles: () => void;
}) {
  // P2, the sheet's half: a section the user comes back to is not rebuilt.
  // Bounded to what was actually opened, so a sheet opened on General costs one
  // section rather than ten.
  const [visited, setVisited] = useState<SectionId[]>([section]);
  useEffect(() => {
    setVisited((seen) => (seen.includes(section) ? seen : [...seen, section]));
  }, [section]);

  /* Derived, so the foot cannot disagree with the sections above it. */
  const writes = SECTIONS.some((entry) => !entry.banner);

  return (
    <Sheet onClose={onClose} closeOnEscape={closeOnEscape} label="WordScript Settings">
      <SheetHead title="Settings" onClose={onClose}>
        {/* The profile the whole sheet is read in. Every value carrying a scope
            tag on these screens belongs to it, so it is stated once here rather
            than repeated per section — and pressing it goes to where a profile
            is actually edited, which is a workspace view and therefore closes
            the sheet. */}
        <SheetProfile
          initials={profile.initials}
          name={profile.name}
          onOpen={onOpenProfiles}
          title="Open Profiles"
        />
      </SheetHead>

      <SheetBody>
        <SheetNav label="Settings sections">
          {/* THE SHEET'S SIDEBAR CARRIES ONE TOO, and that is the prototype
              rather than a symmetry: `demo.js` calls `navSearch()` from all
              three of its sidebars, and the sheet's is the one place a reader
              is most likely to be looking for a control by name. No brand mark
              above it here — the window behind it already states the brand. */}
          <NavSearch shortcut={searchShortcut} onOpen={onSearch} />
          {SECTION_GROUPS.map((group) => (
            <NavGroup key={group.name} title={group.name}>
              {group.ids.map((id) => {
                const entry = findSection(id);
                if (!entry) return null;
                return (
                  <NavRow
                    key={id}
                    icon={<Icon name={entry.icon} />}
                    label={entry.label}
                    tag={entry.preview ? "preview" : undefined}
                    current={id === section}
                    onClick={() => onSection(id)}
                  />
                );
              })}
            </NavGroup>
          ))}
        </SheetNav>

        {SECTIONS.filter((entry) => visited.includes(entry.id)).map((entry) => (
          <SheetContent key={entry.id} layout={entry.layout} hidden={entry.id !== section}>
            {entry.render({
              banner: entry.banner,
              runtime: { ...runtime, active: entry.id === section },
            })}
          </SheetContent>
        ))}
      </SheetBody>

      {/* The status strip belongs to the workspace behind, so the sheet does
          not repeat it. What it owes instead is the one fact its own surface
          creates, and the way out.

          THE PROTOTYPE'S LINE IS BACK, and it went back in the commit that made
          the first section write. Leg 3 could not state it — instant save is the
          shipped behaviour, but no section in this sheet reached it, so the line
          would have been the fake-readiness defect at the one place in the sheet
          that is never scrolled away. It is derived rather than hardcoded: the
          moment `ia.tsx` has a section without a banner, the sheet writes, and a
          leg that somehow un-wired all ten would get the honest line back
          without having to remember to. Sections that are still drawn keep
          saying so at their own head. */}
      <SheetFoot trailing="Esc to close">
        {writes
          ? "Every change applies as you make it."
          : "No section here writes to the runtime yet — each one says so at its head."}
      </SheetFoot>
    </Sheet>
  );
}
