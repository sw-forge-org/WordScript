import { useState } from "react";
import {
  CircleDotIcon,
  LayersIcon,
  LayoutTemplateIcon,
  PaletteIcon,
  WavesIcon,
} from "lucide-react";
import { useColorScheme, type ColorScheme } from "@/hooks/useColorScheme";
import {
  BrandMark,
  Nav,
  NavFoot,
  NavGroup,
  NavRow,
  SegmentControl,
  ViewTop,
} from "@/components/shell";
import { Foundations } from "./gallery/Foundations";
import { Components } from "./gallery/Components";
import { Motion } from "./gallery/Motion";
import { OverlayStates } from "./gallery/OverlayStates";
import { Screens } from "./gallery/Screens";

/**
 * THE GALLERY — the acceptance surface for the settings-rework port (ADR 0055).
 *
 * ONE design-time route, in the shipping bundle, lazy-loaded, using no Tauri
 * API and linked from no product surface — the same terms `/component-lab`
 * already shipped under. It folds in the two unlinked routes that existed
 * before it: `/overlay-gallery` and `/component-lab` are gone, not aliased
 * (ADR 0054).
 *
 * WHAT IT IS FOR. The prototype is the accepted shape of the surface and cannot
 * be looked at inside the product: it is vanilla HTML under `docs/`, outside the
 * Vite root, so a native host shows the shipped surface with the shipped tokens
 * and the proposal is judged by looking at something that is not the proposal
 * (§11.13). Here the palette, the frost pair and the light scheme are checkable
 * in WebKitGTK.
 *
 * IT ASSERTS NOTHING. A gallery screen may carry sample data precisely because
 * it claims no runtime state; the fake state the runtime rules forbid is the
 * same screen on a PRODUCT surface implying the runtime reached something it
 * did not.
 *
 * AND IT NEVER COPIES A COMPONENT. Every primitive below is imported from
 * `components/shell`, including this window's own sidebar — Leg 1 drew that
 * sidebar out of Tailwind utilities, which made the gallery's navigation a
 * second implementation of the one Leg 3 has to build. It is `.ws-nav` now,
 * ported from `demo.css` §3, and Leg 3 inherits it.
 *
 * THE RIG DOES NOT COME ACROSS. `demo.css` §2 — the Surface, Theme, Copy and
 * Density switches — is the instrument the prototype is viewed through and is
 * deliberately outside its own design system. The scheme switch is the one
 * control that survives, because three schemes have to be judged in one place.
 */

type SectionId = "foundations" | "components" | "motion" | "overlay" | "screens";

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  lead: string;
  wide?: boolean;
}> = [
  {
    id: "foundations",
    label: "Foundations",
    icon: <PaletteIcon />,
    lead: "The system this library is made of. Every value below is live — switch the scheme in the sidebar and this page is re-measured, not re-labelled.",
  },
  {
    id: "components",
    label: "Components",
    icon: <LayersIcon />,
    lead: "Every state, on one page. A component missing a state is a component that ships broken.",
  },
  {
    id: "motion",
    label: "Motion",
    icon: <WavesIcon />,
    lead: "One component, four frame sources and a level mode. A motion model cannot be judged from a still, which is why it lives once, here.",
  },
  {
    id: "overlay",
    label: "Overlay",
    icon: <CircleDotIcon />,
    lead: "Every OverlayPill state. Out of the rework's scope and unchanged — this page is where that is checked.",
    wide: true,
  },
  {
    id: "screens",
    label: "Screens",
    icon: <LayoutTemplateIcon />,
    lead: "Every screen of the prototype, at the prototype's fidelity, on the components in the library. Scaffolding: a screen's entry here is deleted in the commit that wires it (ADR 0057).",
  },
];

export default function GalleryWindow() {
  const [active, setActive] = useState<SectionId>("foundations");
  const { scheme, setScheme, resolved } = useColorScheme("dark");
  const section = SECTIONS.find((entry) => entry.id === active) ?? SECTIONS[0];

  return (
    <div className="flex h-full w-full bg-bg-base text-fg" style={{ fontFamily: "var(--font)" }}>
      <Nav label="Gallery sections">
        <BrandMark scheme={resolved} qualifier="Gallery · design time" />

        <NavGroup title="The library">
          {SECTIONS.map((entry) => (
            <NavRow
              key={entry.id}
              icon={entry.icon}
              label={entry.label}
              current={entry.id === active}
              onClick={() => setActive(entry.id)}
            />
          ))}
        </NavGroup>

        {/* The scheme switch is the rig's one survivor. `System` is a deferral
            resolved against prefers-color-scheme, not a third palette
            (ADR 0048). */}
        <NavFoot>
          <h3 className="px-[var(--s2)] pb-[var(--s2)] text-[length:var(--t-micro)] font-semibold uppercase tracking-[0.07em] text-fg-muted">
            Scheme
          </h3>
          <SegmentControl<ColorScheme>
            aria-label="Colour scheme"
            className="mx-[var(--s2)]"
            value={scheme}
            onChange={setScheme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
          {scheme === "system" && (
            <span className="mt-[var(--s2)] block px-[var(--s2)] text-[length:var(--t-micro)] text-fg-muted">
              Following the OS — resolved to {resolved}.
            </span>
          )}
        </NavFoot>
      </Nav>

      <main className="ws-content">
        <div className="ws-content-inner" data-layout={section.wide ? "wide" : undefined}>
          <ViewTop title={section.label} lead={section.lead} />

          {active === "foundations" && <Foundations resolved={resolved} />}
          {active === "components" && <Components />}
          {active === "motion" && <Motion />}
          {active === "overlay" && <OverlayStates />}
          {active === "screens" && <Screens />}
        </div>
      </main>
    </div>
  );
}
