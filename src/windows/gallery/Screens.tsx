import { useEffect, useState } from "react";
import {
  Card,
  CardRows,
  Note,
  Row,
  SectionHeader,
  Select,
  StatusBadge,
  Toolbar,
} from "@/components/shell";
import { ALL_SCREENS, SCREEN_GROUPS, findScreen } from "./registry";

/**
 * A screen is PORTED when it stands here and SHIPPED when it is wired
 * (ADR 0055). Two acts, two gates — and separating them is what makes a 1:1
 * port of a 25-screen design possible against a runtime that cannot yet answer
 * half of it.
 *
 * THE PICKER IS THE RIG'S ONE OTHER SURVIVOR, for the same reason the scheme
 * switch was: 25 screens have to be reachable from one place, and the gallery's
 * own sidebar carries five sections rather than thirty. It is the prototype's
 * `#pick` — the same grouping, the same order — and nothing else of `demo.css`
 * §2 comes across.
 *
 * THE LEDGER READS THE REGISTRY. A count kept by hand beside the thing it
 * counts is a count that goes stale; this one cannot disagree with what is
 * mounted. This section is scaffolding and retires per screen in the commit
 * that wires it, during Leg 4 (ADR 0057).
 */
export function Screens({ onLayout }: { onLayout?: (layout?: "pane" | "wide") => void }) {
  const [active, setActive] = useState("");
  const screen = active ? findScreen(active) : undefined;

  /* The content column, not the screen, carries `data-layout` — a pane view
     gives up the column's measure, padding and block rhythm, and only the
     column can do that. Reported upward rather than reached for. */
  useEffect(() => onLayout?.(screen?.layout), [screen?.layout, onLayout]);

  const total = ALL_SCREENS.length;
  const done = ALL_SCREENS.filter((entry) => entry.render || entry.alias).length;

  return (
    <div className="ws-screens">
      <Toolbar label="Screen">
        <Select
          value={active}
          onChange={(event) => setActive(event.target.value)}
          aria-label="Jump to any screen"
        >
          <option value="">The ledger</option>
          {SCREEN_GROUPS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.screens.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={!entry.render}>
                  {entry.label}
                  {entry.render ? "" : entry.alias ? " — see Foundations" : " — not ported"}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Toolbar>

      {/* `display: contents` — the stage is a handle for the computed-style
          diff to root itself at, and it must not be a box. The prototype's
          screen blocks are direct children of `.content-inner`; a real wrapper
          here would make every measurement compare a different box tree. */}
      <div
        className="ws-screen-stage"
        data-screen={active || "ledger"}
        data-surface={screen?.surface}
      >
        {screen?.render ? screen.render() : <Ledger done={done} total={total} />}
      </div>
    </div>
  );
}

function Ledger({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex flex-col gap-[var(--gap-block)]">
      <Note>
        {done} of {total} ported, at the prototype's fidelity, on the components in the
        library — never copies of them. Nothing here is wired to the runtime, and nothing
        here claims to be.
      </Note>

      {SCREEN_GROUPS.map(({ group, lead, screens }) => {
        const groupDone = screens.filter((entry) => entry.render || entry.alias).length;
        return (
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
                {screens.map((entry) => (
                  <Row
                    key={entry.id}
                    label={entry.label}
                    hint={
                      entry.withdrawn
                        ? "Withdrawn 2026-08-03 (§11.15). It duplicates Diagnostics, which runs raw text through the real runtime and names every applied rule, and it draws the decision as a settings view when the flow lives in a 440 × 60 window that must not take focus. Drawn with the stop on it."
                        : entry.alias
                    }
                    control={
                      entry.alias ? (
                        <StatusBadge tone="success">Ported</StatusBadge>
                      ) : entry.render ? (
                        <StatusBadge tone={entry.withdrawn ? "danger" : "success"}>
                          {entry.withdrawn ? "Drawn — do not build" : "Ported"}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="plan">Leg 2b</StatusBadge>
                      )
                    }
                  />
                ))}
              </CardRows>
            </Card>
          </SectionHeader>
        );
      })}

      <p className="text-[length:var(--t-label)] text-fg-muted">
        {total} screens. The prototype's picker carries four more rows than this — Agents,
        Integrations, Notes &amp; Meetings and Context appear a second time under Previews,
        because a preview is not a separate place.
      </p>
    </div>
  );
}
