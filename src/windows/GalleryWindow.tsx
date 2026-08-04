import { useState } from "react";
import {
  CircleDotIcon,
  LayersIcon,
  LayoutTemplateIcon,
  PaletteIcon,
  WavesIcon,
} from "lucide-react";
import { useColorScheme, type ColorScheme } from "@/hooks/useColorScheme";
import { SegmentControl } from "@/components/shell";
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
 * be looked at inside the product: it is vanilla HTML under `docs/`, outside
 * the Vite root, so a native host shows the shipped surface with the shipped
 * tokens and the proposal is judged by looking at something that is not the
 * proposal (§11.13). Here the palette, the frost pair and the light scheme are
 * checkable in WebKitGTK with one `npm run tauri build` and a walk through
 * Foundations.
 *
 * IT ASSERTS NOTHING. A gallery screen may carry sample data precisely because
 * it claims no runtime state; the fake state the runtime rules forbid is the
 * same screen on a PRODUCT surface implying the runtime reached something it
 * did not.
 *
 * AND IT NEVER COPIES A COMPONENT. Every primitive below is imported from
 * `components/shell`. If one looks right here and wrong in the product, this
 * page is what lied.
 */

type SectionId = "foundations" | "components" | "motion" | "overlay" | "screens";

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  lead: string;
}> = [
  {
    id: "foundations",
    label: "Foundations",
    icon: <PaletteIcon />,
    lead: "The tokens in all three schemes, with contrast measured at render time, the type scale, the spacing rhythm, the radius ladder, elevation and the frost pair.",
  },
  {
    id: "components",
    label: "Components",
    icon: <LayersIcon />,
    lead: "Every shell primitive in every state, on the real components. A component missing a state is a component that ships broken.",
  },
  {
    id: "motion",
    label: "Motion",
    icon: <WavesIcon />,
    lead: "The four motion primitives. A motion model cannot be judged from a still, which is why they live once, here, and not twice.",
  },
  {
    id: "overlay",
    label: "Overlay",
    icon: <CircleDotIcon />,
    lead: "Every OverlayPill state. Out of the rework's scope and unchanged — this page is where that is checked.",
  },
  {
    id: "screens",
    label: "Screens",
    icon: <LayoutTemplateIcon />,
    lead: "Every screen of the prototype, at the prototype's fidelity. Leg 1 builds the frame; Leg 2 fills it.",
  },
];

export default function GalleryWindow() {
  const [active, setActive] = useState<SectionId>("foundations");
  const { scheme, setScheme, resolved } = useColorScheme("dark");
  const section = SECTIONS.find((entry) => entry.id === active) ?? SECTIONS[0];

  return (
    <div className="flex h-full w-full bg-bg-base text-fg" style={{ fontFamily: "var(--font)" }}>
      <nav
        className="flex w-[var(--nav-w)] flex-none flex-col gap-[var(--s1)] overflow-y-auto border-r border-border bg-bg-sidebar p-[var(--s3)]"
        aria-label="Gallery sections"
      >
        <div className="flex flex-col gap-[3px] px-[var(--s2)] pb-[var(--s4)] pt-[var(--s2)]">
          <span className="text-[length:var(--t-lead)] font-semibold tracking-[var(--ls-lead)]">
            Gallery
          </span>
          <span className="text-[length:var(--t-micro)] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Design time · not a product surface
          </span>
        </div>

        {SECTIONS.map((entry) => {
          const current = entry.id === active;
          return (
            <button
              key={entry.id}
              type="button"
              aria-current={current}
              onClick={() => setActive(entry.id)}
              className={[
                "flex min-h-[var(--nav-row-h)] w-full items-center gap-[10px] rounded-control px-[var(--s2)] text-left text-[length:var(--t-note)]",
                current
                  ? "bg-bg-elevated font-[550] text-fg"
                  : "font-[450] text-fg-dim hover:text-fg",
              ].join(" ")}
            >
              {/* The icon is a tile, which is most of why a System Settings
                  sidebar reads as a Mac sidebar. Neutral rather than one hue per
                  section: the accent already means primary action, active
                  selection and live capture, and six competing hues in one
                  column would leave it as merely one of them. */}
              <span
                className={[
                  "grid size-[21px] flex-none place-items-center rounded-[6px] [&_svg]:size-[13px]",
                  current
                    ? "bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg-elevated))] text-brand"
                    : "bg-bg-elevated text-fg-muted",
                ].join(" ")}
                style={{ boxShadow: "inset 0 1px 0 var(--specular)" }}
              >
                {entry.icon}
              </span>
              {entry.label}
            </button>
          );
        })}

        <div className="mt-auto flex flex-col gap-[var(--s2)] border-t border-border pt-[var(--s3)]">
          <span className="px-[var(--s2)] text-[length:var(--t-micro)] font-semibold uppercase tracking-[0.07em] text-fg-muted">
            Scheme
          </span>
          {/* The scheme switch belongs here, so the three schemes are judged in
              one place rather than one screen at a time. `System` is a deferral
              resolved against prefers-color-scheme, not a third palette
              (ADR 0048). */}
          <SegmentControl<ColorScheme>
            aria-label="Colour scheme"
            size="sm"
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
            <span className="px-[var(--s2)] text-[length:var(--t-micro)] text-fg-muted">
              Following the OS — resolved to {resolved}.
            </span>
          )}
        </div>
      </nav>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div
          className="mx-auto flex w-full flex-col gap-[var(--gap-block)] p-[var(--content-pad)]"
          style={{ maxWidth: active === "overlay" ? "none" : "var(--content-max)" }}
        >
          <header className="flex flex-col gap-[5px]">
            <h1
              className="text-[length:var(--t-title)] font-semibold leading-[1.2] tracking-[var(--ls-title)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {section.label}
            </h1>
            <p className="max-w-[62ch] text-[length:var(--t-note)] text-fg-dim">
              {section.lead}
            </p>
          </header>

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
