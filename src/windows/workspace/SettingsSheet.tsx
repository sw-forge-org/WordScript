import {
  Icon,
  NavGroup,
  NavRow,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFoot,
  SheetHead,
  SheetNav,
  SheetProfile,
} from "@/components/shell";
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
  onSection,
  onClose,
  profile,
  onOpenProfiles,
}: {
  section: SectionId;
  onSection: (id: SectionId) => void;
  onClose: () => void;
  profile: { initials: string; name: string };
  onOpenProfiles: () => void;
}) {
  const current = findSection(section) ?? SECTIONS[0];

  return (
    <Sheet onClose={onClose} label="WordScript Settings">
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
          {/* No search field, for the reason the workspace sidebar has none:
              it opens the command palette and there is no palette. */}
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

        <SheetContent layout={current.layout}>
          {current.render({ banner: current.banner })}
        </SheetContent>
      </SheetBody>

      {/* The status strip belongs to the workspace behind, so the sheet does
          not repeat it. What it owes instead is the one fact its own surface
          creates, and the way out.

          THE PROTOTYPE'S LINE IS "Every change applies as you make it." and it
          is not true here yet: instant save is the shipped behaviour and no
          section in this sheet is wired to it. Stating it anyway would be the
          fake-readiness defect at the one place in the sheet that is never
          scrolled away. Leg 4 puts the prototype's line back in the commit that
          makes the first section write. */}
      <SheetFoot trailing="Esc to close">
        No section here writes to the runtime yet — each one says so at its head.
      </SheetFoot>
    </Sheet>
  );
}
