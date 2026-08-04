import { useEffect, useState } from "react";
import { Card, CardRows, Row, SectionHeader, StatusBadge } from "@/components/shell";
import { contrastRatio, lStar, parseColor, readToken, type Rgb } from "@/lib/color";
import type { ResolvedScheme } from "@/hooks/useColorScheme";

/* ── The ladder ─────────────────────────────────────────────────────────────
   Five steps, and the switch moves the whole ladder rather than its spacing.
   The role column is what the step is FOR, which is the half a swatch cannot
   show: two surfaces one L* apart are a mistake, and two surfaces with two
   different jobs are a system. */
const SURFACES: Array<[token: string, role: string]> = [
  ["--bg-sidebar", "Sidebar, below the window"],
  ["--bg-inset", "Inputs, wells, code, logs"],
  ["--bg-base", "Window"],
  ["--bg-surface", "Card"],
  ["--bg-elevated", "Hover, active, segment thumb"],
];

/* Measured against the card, because that is the plane text is read on. */
const FOREGROUNDS: Array<[token: string, role: string]> = [
  ["--fg", "Primary text"],
  ["--fg-dim", "Row hints, descriptions"],
  ["--fg-muted", "Labels and counts only"],
  ["--accent", "Primary action, selection"],
  ["--success", "Validated runtime state"],
  ["--danger", "Errors, destructive"],
];

const TYPE_STEPS: Array<[token: string, weight: number, role: string]> = [
  ["--t-hero", 600, "Home headline only"],
  ["--t-title", 600, "View title"],
  ["--t-lead", 600, "Section header"],
  ["--t-body", 400, "Body, list rows"],
  ["--t-note", 500, "Card titles, view descriptions, connection names"],
  ["--t-label", 400, "Row hints, descriptions, meta"],
  ["--t-micro", 600, "Key caps, counts, group headers — never prose"],
];

const RHYTHM: Array<[name: string, px: number]> = [
  ["--s1", 4],
  ["--s2", 8],
  ["--s3", 12],
  ["--s4", 16],
  ["--s5", 20],
  ["--s6", 24],
  ["--s7", 32],
  ["--s8", 40],
];

const RADII: Array<[token: string, role: string]> = [
  ["--r-window", "A window or a sheet — the outermost object on its layer"],
  ["--r-card", "A grouping surface — card, panel, stage, well"],
  ["--r-control", "Something you operate — button, input, select, tab bar"],
  ["--r-small", "A label, and anything sitting inside a control"],
];

const ELEVATIONS: Array<[token: string, role: string]> = [
  ["--elev-raised", "A control that lifts off its own surface"],
  ["--elev-pop", "A popover, a menu, a dropdown"],
  ["--elev-window", "A window"],
  ["--elev-sheet", "A sheet, and the command palette"],
];

interface Measured {
  token: string;
  role: string;
  value: string;
  rgb: Rgb | null;
}

function measure(entries: Array<[string, string]>): Measured[] {
  return entries.map(([token, role]) => {
    const value = readToken(token);
    return { token, role, value, rgb: parseColor(value) };
  });
}

const ratio = (n: number) => `${n.toFixed(2)}:1`;

/**
 * FOUNDATIONS — the tokens, live, with their contrast measured rather than
 * asserted (ADR 0055).
 *
 * Every figure on this page is computed from the resolved custom property at
 * render time, so switching the scheme re-measures rather than re-labels. The
 * prototype hardcoded its numbers because it is a static mock and one of them
 * was wrong for a whole pass (§11.1); a number typed beside a colour stops
 * being true the moment the colour moves.
 */
export function Foundations({ resolved }: { resolved: ResolvedScheme }) {
  const [surfaces, setSurfaces] = useState<Measured[]>([]);
  const [foregrounds, setForegrounds] = useState<Measured[]>([]);
  const [card, setCard] = useState<Rgb | null>(null);
  const [elevated, setElevated] = useState<Rgb | null>(null);
  const [base, setBase] = useState<Rgb | null>(null);

  useEffect(() => {
    setSurfaces(measure(SURFACES));
    setForegrounds(measure(FOREGROUNDS));
    setCard(parseColor(readToken("--bg-surface")));
    setElevated(parseColor(readToken("--bg-elevated")));
    setBase(parseColor(readToken("--bg-base")));
  }, [resolved]);

  const separation =
    card && base ? Math.abs(lStar(card) - lStar(base)) : null;

  return (
    <div className="flex flex-col gap-[var(--gap-block)]">
      <SectionHeader
        title="Surfaces"
        description="One ladder, five steps. The scheme moves the whole ladder, not its spacing."
      >
        <Card>
          <div className="ws-rows">
            {surfaces.map(({ token, role, value, rgb }) => (
              <div key={token} className="ws-row">
                <span
                  aria-hidden
                  className="size-9 flex-none rounded-control border border-border"
                  style={{ background: `var(${token})` }}
                />
                <div className="ws-row-text">
                  <b className="ws-mono">{token}</b>
                  <span className="ws-row-hint">{role}</span>
                </div>
                <div className="ws-row-ctl">
                  <span className="ws-mono ws-muted">{value}</span>
                  <span className="ws-badge ws-num">
                    L* {rgb ? lStar(rgb).toFixed(1) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        {separation !== null && (
          <p className="text-[length:var(--t-label)] text-fg-dim">
            Window to card is {separation.toFixed(1)} L*.{" "}
            {resolved === "dark"
              ? "The same separation the shipped ladder had, seven points higher up the range — where a panel can still show it."
              : "A light surface rises by moving its ground down, so the card is white and the window recedes under it (ADR 0048)."}
          </p>
        )}
      </SectionHeader>

      <SectionHeader
        title="Text contrast"
        description="Measured against the card at render time. WCAG AA is 4.5:1 for body text."
      >
        <Card>
          <div className="ws-rows">
            {foregrounds.map(({ token, role, value, rgb }) => {
              const onCard = card && rgb ? contrastRatio(card, rgb) : null;
              return (
                <div key={token} className="ws-row">
                  <div className="ws-row-text">
                    <b className="ws-mono" style={{ color: `var(${token})` }}>
                      {token}
                    </b>
                    <span className="ws-row-hint">{role}</span>
                  </div>
                  <div className="ws-row-ctl">
                    <span className="ws-mono ws-muted">{value}</span>
                    {onCard !== null && (
                      <StatusBadge tone={onCard >= 4.5 ? "success" : "error"}>
                        {ratio(onCard)}
                      </StatusBadge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        {card && elevated && (
          <p className="text-[length:var(--t-label)] text-fg-dim">
            <code className="ws-mono">--fg-muted</code> measures{" "}
            {ratio(contrastRatio(card, parseColor(readToken("--fg-muted")) ?? card))} on the
            card and{" "}
            {ratio(
              contrastRatio(elevated, parseColor(readToken("--fg-muted")) ?? elevated),
            )}{" "}
            on the elevated plane, so it is confined to the card. That is also why a row
            carrying muted text does not change ground on hover — which is the fix for the
            hover repaint in §6 P7.
          </p>
        )}
      </SectionHeader>

      <SectionHeader
        title="Type"
        description="One family, six sizes, six shapes. Fixed px — the window is viewed at a consistent size."
      >
        <Card>
          <div className="ws-scale">
            {TYPE_STEPS.map(([token, weight, role]) => (
              <div
                key={token}
                className="flex items-baseline gap-[var(--s4)] border-b border-border px-[var(--pad-card)] py-[var(--s3)] last:border-b-0"
              >
                <span className="ws-mono ws-muted w-[76px] flex-none">{token}</span>
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{ fontSize: `var(${token})`, fontWeight: weight }}
                >
                  {role}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <p className="text-[length:var(--t-label)] text-fg-dim">
          Width, tracking and weight vary per step — 104% at 11 px through 96% at 28 px —
          because a grotesk set at 11 px and the same grotesk at 28 px are not the same
          shape problem. 13 px is a named step: it lets a card title sit below body size
          and still outrank it, on weight rather than on size.
        </p>
      </SectionHeader>

      <SectionHeader
        title="Spacing"
        description="4 px rhythm. The sheet scale moves card padding and row height, never the rhythm."
      >
        <Card>
          <div className="flex flex-wrap items-end gap-[var(--s4)]">
            {RHYTHM.map(([name, px]) => (
              <div key={name} className="flex flex-col items-center gap-[var(--s1)]">
                <span
                  aria-hidden
                  className="block rounded-small bg-brand-soft"
                  style={{ height: px * 1.6, width: Math.max(14, px) }}
                />
                <span className="ws-mono ws-muted">{px}</span>
              </div>
            ))}
          </div>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Radius"
        description="Four steps, by what a thing is. Not by how big it is."
      >
        <Card>
          <CardRows>
            {RADII.map(([token, role]) => (
              <Row
                key={token}
                label={
                  <span className="inline-flex items-center gap-[var(--s2)]">
                    <span
                      aria-hidden
                      className="size-5 border border-border-strong"
                      style={{ borderRadius: `var(${token})` }}
                    />
                    <span className="ws-mono">{token}</span>
                  </span>
                }
                hint={role}
                control={<span className="ws-mono ws-muted">{readToken(token)}</span>}
              />
            ))}
            <Row
              label="Switch, level bar, dot, avatar, count, radio"
              hint="Round because of what it is, not because rounding was the house style."
              control={<span className="ws-mono ws-muted">999px / 50%</span>}
            />
            <Row
              label="The overlay"
              hint="Exempt, and stays exempt. A capsule by design, out of this plan's scope, with its own tokens."
              control={<span className="ws-mono ws-muted">999px · 14px</span>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Elevation and material"
        description="Background says which plane. The material says how the surface takes light."
      >
        <Card>
          <div className="flex flex-wrap gap-[var(--s4)] py-[var(--s2)]">
            {ELEVATIONS.map(([token, role]) => (
              <figure
                key={token}
                className="flex min-w-[150px] flex-1 flex-col gap-[var(--s2)]"
              >
                <span
                  aria-hidden
                  className="h-14 rounded-card bg-bg-surface"
                  style={{ boxShadow: `var(${token})` }}
                />
                <figcaption className="flex flex-col gap-[2px]">
                  <b className="ws-mono text-[length:var(--t-label)]">{token}</b>
                  <span className="text-[length:var(--t-micro)] leading-[1.5] text-fg-muted">
                    {role}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Card>
        <Card>
          <CardRows>
            <Row
              label="Card"
              hint="A background step and a 1 px inset highlight on the top edge only. A card that also gets it on the bottom is a bevel."
              control={<StatusBadge tone="success">--edge-light</StatusBadge>}
            />
            <Row
              label="Input, select, textarea, log"
              hint="A hairline border. It is the one signal that means “you can put something in here”."
              control={<StatusBadge tone="success">border</StatusBadge>}
            />
            <Row
              label="Hover"
              hint="Background only, and only where the row is a target. Cards never repaint on pointer transit."
              control={<StatusBadge tone="success">background</StatusBadge>}
            />
            <Row
              label="Coloured edge bar"
              hint="Never. A vertical accent rule down the side of a notice reads as a rendering defect at this scale. Emphasis is the ground plus an icon tile."
              control={<StatusBadge tone="error">forbidden</StatusBadge>}
            />
            <Row
              label="Scrollbar"
              hint="Not drawn anywhere, and nothing replaces it. The edge fade was built and removed."
              control={<StatusBadge tone="error">none</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <FrostPair resolved={resolved} />
    </div>
  );
}

/**
 * THE FROST PAIR — the panel and the layer behind it, which is the whole point
 * of ADR 0051. Showing the panel alone would be showing half a material, and
 * the half that reads correctly in a browser preview while doing nothing in the
 * shipped engine is exactly the failure the ADR records.
 *
 * The toggle is here rather than in a screenshot because this is the one
 * material a still cannot settle: `backdrop-filter` looks right in Chromium and
 * renders nothing in WebKitGTK, so the check that matters is this control, in
 * the native host, with the layer behind actually receding.
 */
function FrostPair({ resolved }: { resolved: ResolvedScheme }) {
  const [frosted, setFrosted] = useState(true);

  return (
    <SectionHeader
      title="Frost"
      description="A pair, never a plane: the panel goes translucent and the window behind it recedes."
    >
      <Card
        footer={
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-control border border-border bg-bg-elevated px-[11px] text-[length:var(--t-label)] font-[550]"
            onClick={() => setFrosted((on) => !on)}
            aria-pressed={frosted}
          >
            {frosted ? "Take the blur off the layer behind" : "Put the blur back"}
          </button>
        }
      >
        <div
          className="relative h-[190px] overflow-hidden rounded-card"
          data-frost-stack={frosted ? "" : undefined}
        >
          {/* The layer behind carries its own opaque ground, or the blur's edge
              falloff draws a soft rim just inside the frame and eats the radius. */}
          <div className="ws-frost-stack absolute inset-0 bg-bg-base p-[var(--s4)]">
            <div className="flex flex-col gap-[var(--s2)]">
              <span className="text-[length:var(--t-lead)] font-semibold">
                The application, receding
              </span>
              <span className="text-[length:var(--t-label)] text-fg-dim">
                What comes through is hue and value, never detail. That is what frosted
                glass is: glass you cannot see through.
              </span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className="h-[10px] rounded-small bg-bg-elevated"
                  style={{ width: `${72 - i * 14}%` }}
                />
              ))}
            </div>
          </div>
          <div className="ws-frost-scrim absolute inset-0 grid place-items-center p-[var(--s5)]">
            <div className="ws-frost-panel w-full max-w-[320px] rounded-window p-[var(--s4)]">
              <div className="flex flex-col gap-[var(--s1)]">
                <b className="text-[length:var(--t-note)]">The panel, catching the light</b>
                <span className="text-[length:var(--t-label)] text-fg-dim">
                  blur(var(--frost-blur)) saturate(var(--frost-sat))
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
      <p className="text-[length:var(--t-label)] text-fg-dim">
        The blur runs on the layer <b>behind</b> through <code className="ws-mono">filter:
        blur()</code>, never <code className="ws-mono">backdrop-filter</code> on the panel:
        that property is inert in WebKitGTK 2.52.4 while{" "}
        <code className="ws-mono">@supports</code> reports it as available, so anything
        built on it looks correct in a Chromium preview and ships to Linux as flat
        translucency over legible text (ADR 0051).{" "}
        {resolved === "light"
          ? "On the light ladder the fill goes up to 92%, the sheen almost away, and the scrim is warm — half black over a light room is a bruise."
          : "The strength is the settings sheet’s, copied rather than re-derived, so the two surfaces are one material."}
      </p>
    </SectionHeader>
  );
}
