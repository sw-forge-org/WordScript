import { Card, CardRows, Note, Row, SectionHeader, StatusBadge } from "@/components/shell";

/**
 * A screen is PORTED when it stands here and SHIPPED when it is wired
 * (ADR 0055). Two acts, two gates — and separating them is what makes a 1:1
 * port of a 25-screen design possible against a runtime that cannot yet answer
 * half of it.
 *
 * Leg 1 built the frame. Leg 2a ported the library and the Design System screen
 * — which is not an entry here, because it IS Foundations plus Components plus
 * Motion. Leg 2b fills the rest.
 *
 * The ledger asserts nothing about the runtime: a row saying "not ported" is a
 * statement about this repository, which is the only kind of claim a gallery is
 * allowed to make. This section is scaffolding and retires per screen in the
 * commit that wires it, during Leg 4 (ADR 0057).
 */

type Group = { group: string; lead: string; screens: string[]; done?: number };

const LEDGER: Group[] = [
  {
    group: "System",
    lead: "The system on one page. Foundations, Components and Motion are it — read out of SCREENS.ds, not composed.",
    screens: ["Design System"],
    done: 1,
  },
  {
    group: "Workspace",
    lead: "Four views. The window behind the settings sheet.",
    screens: ["Home", "History", "Profiles", "Context"],
  },
  {
    group: "Settings",
    lead: "Eleven sections in three groups, in a sheet at its own scale (§11.22).",
    screens: [
      "General",
      "Hotkeys",
      "Notes & Meetings",
      "AI Models",
      "Agents",
      "Integrations",
      "Delivery & Insert",
      "Privacy & Data",
      "Diagnostics",
      "About & Updates",
    ],
  },
  {
    group: "Previews",
    lead: "Layout only, each carrying its PreviewBanner. Six more are previews of a screen already listed above.",
    screens: [
      "Onboarding",
      "Translation",
      "Live subtitles",
      "Meeting capture",
      "Client conversations",
      "Agent overlay",
      "Handoff",
      "Context · intake",
      "Actions & templates",
    ],
  },
];

const WITHDRAWN = "Live preview & commit";

export function Screens() {
  const total = LEDGER.reduce((n, group) => n + group.screens.length, 0) + 1;
  const done = LEDGER.reduce((n, group) => n + (group.done ?? 0), 0);

  return (
    <div className="flex flex-col gap-[var(--gap-block)]">
      <Note>
        {done} of {total} ported. Leg 2b fills the rest, at the prototype's fidelity, on the
        components in the library — never copies of them. Nothing here is wired to the
        runtime, and nothing here claims to be.
      </Note>

      {LEDGER.map(({ group, lead, screens, done: groupDone = 0 }) => (
        <SectionHeader
          key={group}
          title={group}
          description={lead}
          action={
            <span className="ws-mono ws-muted ws-num">
              {groupDone} / {screens.length}
            </span>
          }
        >
          <Card>
            <CardRows>
              {screens.map((screen, index) => (
                <Row
                  key={screen}
                  label={screen}
                  control={
                    index < groupDone ? (
                      <StatusBadge tone="success">Ported</StatusBadge>
                    ) : (
                      <StatusBadge tone="plan">Leg 2b</StatusBadge>
                    )
                  }
                />
              ))}
            </CardRows>
          </Card>
        </SectionHeader>
      ))}

      <SectionHeader
        title="Withdrawn"
        description="Kept in the prototype as an illustration, and not a target shape."
      >
        <Card>
          <CardRows>
            <Row
              label={WITHDRAWN}
              hint="Withdrawn 2026-08-03 (§11.15). It duplicates Diagnostics, which runs raw text through the real runtime and names every applied rule, and it draws the decision as a settings view when the flow lives in a 440 × 60 window that must not take focus."
              control={<StatusBadge tone="error">Do not build</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <p className="text-[length:var(--t-label)] text-fg-muted">
        {total} entries. Six of them are one place in the product seen in two states, which
        is the point: a preview is not a separate place.
      </p>
    </div>
  );
}
