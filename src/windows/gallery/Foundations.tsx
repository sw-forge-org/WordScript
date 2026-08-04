import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardRows,
  Note,
  Row,
  SectionHeader,
  StatusBadge,
} from "@/components/shell";
import { contrastRatio, lStar, parseColor, readToken, type Rgb } from "@/lib/color";
import type { ResolvedScheme } from "@/hooks/useColorScheme";

/**
 * FOUNDATIONS — `SCREENS.ds` in `docs/prototypes/settings-rework/demo.js`, its
 * sections up to and including *Radius*, ported rather than composed.
 *
 * Leg 1 built this page from what `DESIGN_SYSTEM.md` implies and the owner saw
 * the difference in one glance: the ladder was five rows with a swatch instead
 * of the ramp, the contrast figures were badges instead of the spec table, and
 * *Rules this pass added* — eight rows, each one a rule that was a defect
 * somewhere first — was missing entirely. Every section below is the
 * prototype's, in the prototype's order, with the prototype's copy.
 *
 * THE ONE ADDITION IS LEG 1'S AND IT STAYS: contrast and L* are MEASURED from
 * the live tokens at render time, never printed as literals. The prototype
 * hardcodes its figures and prints the dark ladder's numbers on both sides of
 * its theme switch, which is how the light `--fg-muted` sat below AA for a
 * whole pass without anybody seeing it (ADR 0056). A number typed beside a
 * colour stops being true the moment the colour moves.
 */

/* ── Surfaces — the prototype's `surfaces` array, proposed side ─────────────── */
const SURFACES: Array<[token: string, role: string]> = [
  ["--bg-sidebar", "Sidebar, below the window"],
  ["--bg-inset", "Inputs, wells, code, logs"],
  ["--bg-base", "Window"],
  ["--bg-surface", "Card"],
  ["--bg-elevated", "Hover, active, segment thumb"],
];

/* ── Text contrast — the prototype's `contrast` array, proposed side ────────── */
const FOREGROUNDS: Array<[token: string, role: string]> = [
  ["--fg", "Primary text"],
  ["--fg-dim", "Row hints, descriptions"],
  ["--fg-muted", "Labels and counts only"],
  ["--accent", "Primary action, selection"],
  ["--success", "Validated runtime state"],
  ["--danger", "Errors, destructive"],
];

/* ── Type — the prototype's `typeScale`, plus the step its own page omits ───── */
const TYPE_SCALE: Array<[token: string, spec: string, role: string]> = [
  ["--t-hero", "28px / 600", "Home headline only"],
  ["--t-title", "20px / 600", "View title"],
  ["--t-lead", "16px / 600", "Section header"],
  ["--t-body", "14px / 400", "Body, list rows"],
  /* NOT IN THE PROTOTYPE'S TABLE, AND IN ITS STYLESHEET. `demo.css` declares
     `--t-note: 13px` and reads it 28 times — card titles, row labels, list
     items — while the Design System screen's own `typeScale` array lists six
     steps and leaves it out. The page is behind the system it draws. Shown
     here, because a page whose job is to show the scale may not be missing a
     step of it, and reported in the leg record rather than fixed upstream: the
     prototype is read-only (ADR 0055). */
  ["--t-note", "13px / 500", "Card titles, row labels, list items"],
  ["--t-label", "12px / 400", "Row hints, descriptions, meta"],
  ["--t-micro", "11px / 600", "Key caps, counts, group headers — never prose"],
];

/* ── Spacing — the 4 px rhythm ─────────────────────────────────────────────── */
const RHYTHM: Array<[name: string, px: number]> = [
  ["s1", 4],
  ["s2", 8],
  ["s3", 12],
  ["s4", 16],
  ["s5", 20],
  ["s6", 24],
  ["s7", 32],
  ["s8", 40],
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

const ratio = (n: number) => `${n.toFixed(2)}`;

export function Foundations({ resolved }: { resolved: ResolvedScheme }) {
  const [surfaces, setSurfaces] = useState<Measured[]>([]);
  const [foregrounds, setForegrounds] = useState<Measured[]>([]);
  const [card, setCard] = useState<Rgb | null>(null);
  const [elevated, setElevated] = useState<Rgb | null>(null);
  const [base, setBase] = useState<Rgb | null>(null);
  const [muted, setMuted] = useState<Rgb | null>(null);
  const [radii, setRadii] = useState<Record<string, string>>({});

  useEffect(() => {
    setSurfaces(measure(SURFACES));
    setForegrounds(measure(FOREGROUNDS));
    setCard(parseColor(readToken("--bg-surface")));
    setElevated(parseColor(readToken("--bg-elevated")));
    setBase(parseColor(readToken("--bg-base")));
    setMuted(parseColor(readToken("--fg-muted")));
    setRadii({
      window: readToken("--r-window"),
      card: readToken("--r-card"),
      control: readToken("--r-control"),
      small: readToken("--r-small"),
    });
  }, [resolved]);

  const separation = card && base ? Math.abs(lStar(card) - lStar(base)) : null;
  const mutedOnCard = card && muted ? contrastRatio(card, muted) : null;
  const mutedOnElevated = elevated && muted ? contrastRatio(elevated, muted) : null;

  return (
    <div className="flex flex-col gap-[var(--gap-block)]">
      <SectionHeader
        title="Surfaces"
        description="One ladder, five steps. The switch moves the whole ladder, not its spacing."
      >
        <div className="ws-ramp">
          {surfaces.map(({ token, role, value, rgb }) => (
            <div key={token} className="ws-ramp-row" style={{ background: `var(${token})` }}>
              <span className="ws-ramp-lbl ws-mono">{token}</span>
              <span className="ws-ramp-val">{value}</span>
              <span>{role}</span>
              <span className="ws-ramp-lstar">
                L* {rgb ? lStar(rgb).toFixed(1) : "—"}
              </span>
            </div>
          ))}
        </div>
        {separation !== null && (
          <Note tone="check">
            Window to card is {separation.toFixed(1)} L*
            {resolved === "dark"
              ? " — the same separation as the shipped ladder had, seven points higher up the range, where a panel can still show it."
              : " — and it is the card that rose, not the window. A light surface cannot be raised by lightening it; the ground moves down instead (ADR 0048)."}
          </Note>
        )}
      </SectionHeader>

      <SectionHeader
        title="Text contrast"
        description="Measured against the card surface. WCAG AA is 4.5:1 for body text."
      >
        <Card>
          <div className="ws-spec-scroll">
            <table className="ws-spec">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Value</th>
                  <th>On card</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {foregrounds.map(({ token, role, value, rgb }) => {
                  const onCard = card && rgb ? contrastRatio(card, rgb) : null;
                  const pass = onCard !== null && onCard >= 4.5;
                  return (
                    <tr key={token}>
                      <td className="ws-mono">{token}</td>
                      <td className="ws-spec-n">{value}</td>
                      <td className={`ws-spec-n ${pass ? "ws-pass" : "ws-fail"}`}>
                        {onCard === null ? "—" : `${ratio(onCard)}:1 ${pass ? "✓" : "✗"}`}
                      </td>
                      <td>{role}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        {mutedOnCard !== null && mutedOnElevated !== null && (
          <Note tone="alert">
            <code className="ws-mono">--fg-muted</code> measures{" "}
            {ratio(mutedOnElevated)}:1 on the elevated surface even after the lift, against{" "}
            {ratio(mutedOnCard)}:1 on the card, so it is confined to the card plane. That is
            why rows carrying muted text do not change background on hover — which is also
            the fix for the hover repaint in §2.4 P7.
          </Note>
        )}
      </SectionHeader>

      <SectionHeader
        title="Type"
        description="One family. Fixed px scale, not fluid — the window is viewed at a consistent size."
      >
        <Card>
          {TYPE_SCALE.map(([token, spec, role]) => (
            <div key={token} className="ws-type-row">
              <span className="ws-type-tag">{token}</span>
              <span
                className="min-w-0 flex-1 truncate"
                style={{
                  fontSize: `var(${token})`,
                  fontWeight: spec.includes("600") ? 600 : spec.includes("500") ? 500 : 400,
                }}
              >
                {role}
              </span>
            </div>
          ))}
        </Card>
        <Note>
          Scale kept from DESIGN_SYSTEM.md (12, 14, 16, 20, 28). 11 px is added for key caps
          and counts and never carries a sentence.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="Spacing"
        description="4 px rhythm. The sheet scale moves card padding and row height, never the rhythm."
      >
        <Card>
          <div className="ws-rhythm">
            {RHYTHM.map(([name, px]) => (
              <div key={name}>
                <i style={{ height: px * 1.6, width: Math.max(14, px) }} />
                {px}
              </div>
            ))}
          </div>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Elevation"
        description="Declared once. Background carries grouping; a border means the thing accepts input."
      >
        <Card>
          <CardRows>
            <Row
              label="Card"
              hint="Background step only. No shadow, no border in the proposed palette."
              control={<StatusBadge tone="success">background</StatusBadge>}
            />
            <Row
              label="Input, select, textarea, log"
              hint="Hairline border. This is the one signal that means “you can put something in here”."
              control={<StatusBadge tone="success">border</StatusBadge>}
            />
            <Row
              label="Row divider"
              hint="Hairline inside a card, never around it."
              control={<StatusBadge tone="success">border</StatusBadge>}
            />
            <Row
              label="Hover"
              hint="Background only, and only where the row is a target. Cards never repaint on pointer transit."
              control={<StatusBadge tone="success">background</StatusBadge>}
            />
            <Row
              label="Coloured edge bar"
              hint="Never. A vertical accent rule down the side of a notice is a web convention that reads as a rendering defect at this scale. Emphasis is the ground plus an icon tile."
              control={<StatusBadge tone="danger">forbidden</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* The record of the 2026-08-03 pass. Every row here is a rule that was
          broken somewhere before it was written down, and each names where.
          Without it the next reader re-derives the same three inline paddings
          and the same 17 px radio. */}
      <SectionHeader
        title="Rules this pass added"
        description="Each one was a defect somewhere first."
      >
        <Card>
          <CardRows>
            <Row
              label="A card owns its inset"
              hint="Padding on all four sides; the first and last child of a row stack drop their own edge padding. Nothing inside a card knows it is at an edge."
              control={<StatusBadge tone="danger">was 20 / 13 / 0</StatusBadge>}
            />
            <Row
              label="A control that must look centred is drawn on integers"
              hint="Even box, whole-pixel border. The radio was 17 px with a 1.5 px border, which has no integer centre and snaps differently on each side."
              control={
                <span className="ws-rowflex">
                  <span className="ws-radio" aria-hidden />
                  <StatusBadge tone="success">16 / 2 / 8</StatusBadge>
                </span>
              }
            />
            <Row
              label="A stat tile carries a number that changes"
              hint="And summarises more rows than fit on screen. Otherwise it is a row. Nine tiles left three screens; one honest use remains, above the Upload queue."
              control={<StatusBadge tone="success">1 use left</StatusBadge>}
            />
            <Row
              label="The action on a card sits at its foot"
              hint="As a component, not as a flex row with a padding guessed per screen."
              control={<StatusBadge tone="plan">card-foot</StatusBadge>}
            />
            <Row
              label="A check reports a probe"
              hint="The runtime looked, and this is what it found. Not a bullet — a checkmark beside an argument claims a measurement nobody took."
              control={<StatusBadge tone="plan">check-list</StatusBadge>}
            />
            <Row
              label="Muted text never lands on the elevated plane"
              hint={
                mutedOnCard !== null && mutedOnElevated !== null
                  ? `${ratio(mutedOnCard)}:1 on the card, ${ratio(mutedOnElevated)}:1 on elevated. The rule was written on this page and broken by the selected pane row, which is elevated by definition.`
                  : "The rule was written on this page and broken by the selected pane row, which is elevated by definition."
              }
              control={<StatusBadge tone="success">fixed</StatusBadge>}
            />
            <Row
              label="An action zone shrinks once there is a list under it"
              hint="A dropzone is the whole screen while the screen is empty and a band once it is not. Upload's 460 px column could not hold a row carrying a name, a size, a status and a transcript."
              control={<StatusBadge tone="plan">dropzone[data-band]</StatusBadge>}
            />
            <Row
              label="Title, banner and sub-tabs are one masthead"
              hint="16 px inside it, 32 px below it. As siblings of the content blocks they inherited the block rhythm and drifted apart."
              control={<StatusBadge tone="plan">view-top</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* REWRITTEN in the prototype's 2026-08-03 pass. There was no scale — the
          surface had accumulated twelve radius values with no rule about which
          belonged to what, and the aggregate read soft to the point of
          unseriousness. Four steps, assigned by what a thing IS rather than by
          how big it is. Capsules survive only where the object is physically a
          capsule. */}
      <SectionHeader
        title="Radius"
        description="Four steps, by what a thing is. Concentric: an inner radius is its outer minus the gap."
      >
        <Card>
          <CardRows>
            <Row
              label="Window, sheet"
              hint="The outermost object on its layer."
              control={<span className="ws-mono ws-muted">{radii.window}</span>}
            />
            <Row
              label="Card, panel, well"
              hint="A grouping surface."
              control={<span className="ws-mono ws-muted">{radii.card}</span>}
            />
            <Row
              label="Button, input, tab bar"
              hint="Something you operate."
              control={<span className="ws-mono ws-muted">{radii.control}</span>}
            />
            <Row
              label="Badge, chip, tab, segment"
              hint="A label, and anything inside a control."
              control={<span className="ws-mono ws-muted">{radii.small}</span>}
            />
            <Row
              label="Switch, level bar, dot, avatar, count"
              hint="Round because of what it is, not because rounding was the house style."
              control={<span className="ws-mono ws-muted">999px / 50%</span>}
            />
            <Row
              label="The overlay"
              hint="Exempt. A capsule by design, out of this plan's scope, and it keeps its own tokens."
              control={<span className="ws-mono ws-muted">999px · 14px</span>}
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
 * NOT IN `SCREENS.ds`. The prototype builds frost into its own stage
 * (`demo.css` §2's `.stage`), which is the rig, and the rig does not come
 * across. This is the material shown as itself instead — Leg 1's, kept where it
 * stands, because §2.4 of the relay names its position: the foot of Foundations,
 * with a button that takes the blur off the layer behind.
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
          <Button onClick={() => setFrosted((on) => !on)} aria-pressed={frosted}>
            {frosted ? "Take the blur off the layer behind" : "Put the blur back"}
          </Button>
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
      <Note tone="eye">
        The blur runs on the layer <b>behind</b> through{" "}
        <code className="ws-mono">filter: blur()</code>, never{" "}
        <code className="ws-mono">backdrop-filter</code> on the panel: that property is
        inert in WebKitGTK 2.52.4 while <code className="ws-mono">@supports</code> reports
        it as available, so anything built on it looks correct in a Chromium preview and
        ships to Linux as flat translucency over legible text (ADR 0051).{" "}
        {resolved === "light"
          ? "On the light ladder the fill goes up to 92%, the sheen almost away, and the scrim is warm — half black over a light room is a bruise."
          : "The strength is the settings sheet’s, copied rather than re-derived, so the two surfaces are one material."}
      </Note>
    </SectionHeader>
  );
}
