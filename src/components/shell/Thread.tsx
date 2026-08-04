import type { ReactNode } from "react";
import { StatusBadge, type StatusTone } from "./StatusBadge";

/**
 * WHAT THE DESK CAN REACH — `demo.js`'s `mcpl` block, ADR 0046.
 *
 * A READOUT of the harness's own MCP configuration. The desk is an agent CLI,
 * so it is its own MCP client and carries its own connectors; WordScript reads
 * that file and shows it, does not write it, and offers no second place to add
 * one. There is deliberately no "Add server" button — a second writer would put
 * WordScript in the business of maintaining connectors, which is the one thing
 * using a real agent CLI avoids.
 *
 * It carries the privacy consequence at the rows that spend it (ADR 0034): a
 * local-first product with a Gmail server attached to its agent is not a
 * local-first path for that traffic, and saying so here is cheaper than being
 * caught not saying it.
 */
export function McpList({ children }: { children: ReactNode }) {
  return <div className="ws-mcpl">{children}</div>;
}

export function McpRow({
  name,
  verbs,
  where,
  owner,
  why,
}: {
  name: string;
  /** What the server exposes, as the harness names it. */
  verbs: string;
  where: "loopback" | "local" | "network";
  /** `ours` is the one server WordScript issued. */
  owner: "ours" | "theirs";
  why: string;
}) {
  const tone: StatusTone = where === "loopback" ? "success" : where === "local" ? "plan" : "warning";
  return (
    <div className="ws-mcp-row" data-owner={owner}>
      <span className="ws-mcp-name">
        <b>{name}</b>
        <span className="ws-mono">{verbs}</span>
      </span>
      <span className="ws-mcp-where">
        <StatusBadge tone={tone}>{where}</StatusBadge>
      </span>
      <span className="ws-mcp-why">{why}</span>
    </div>
  );
}

/**
 * A THREAD — one question and its answer, as they were actually exchanged.
 *
 * The initial is the speaker and the accent marks the one that is not you. A
 * question carries the options it offered, because an answer that matched one
 * of them can be taken back inside the undo window and a free answer cannot.
 */
export function Thread({ children }: { children: ReactNode }) {
  return <div className="ws-thread">{children}</div>;
}

export function Message({
  from,
  who,
  text,
  options,
  when,
}: {
  from: "ws" | "me";
  /** The initial in the tile. */
  who: string;
  text: string;
  options?: ReactNode;
  when: string;
}) {
  return (
    <div className="ws-msg" data-from={from}>
      <span className="ws-who">{who}</span>
      <div className="ws-msg-body">
        <p>{text}</p>
        {options && <div className="ws-msg-opts">{options}</div>}
        <span className="ws-when">{when}</span>
      </div>
    </div>
  );
}
