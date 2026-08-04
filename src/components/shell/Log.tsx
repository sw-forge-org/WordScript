import type { ReactNode } from "react";

/**
 * THE RUNTIME LOG — `demo.js`'s `.log` block.
 *
 * Structured native logs, buffered while the runtime is active. The durable
 * transcript record lives in History; this is for reading what just happened.
 *
 * The level column is fixed-width so the messages start at one x and the eye
 * can scan down them. Only the three levels carry a hue, and INFO's is the
 * voice colour rather than the accent, which stays spent on what needs acting
 * on.
 */

export type LogLevel = "INFO" | "WARN" | "ERROR";
export type LogLine = { at: string; level: LogLevel; message: string };

export function Log({ lines }: { lines: LogLine[] }) {
  return (
    <div className="ws-log">
      {lines.map((line, index) => (
        <div key={`${line.at}-${index}`}>
          <span className="ws-ts">{line.at}</span>
          <span className="ws-lv" data-l={line.level}>
            {line.level}
          </span>
          <span className="ws-msg">{line.message}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * RAW BESIDE TRANSFORMED. A pairing, not a feature — the one idea kept from
 * the withdrawn commit screen (§11.15), where it was first drawn. Stacked, the
 * reader has to hold the first text in memory to answer the only question the
 * pair exists for.
 */
export function Diff({ children }: { children: ReactNode }) {
  return <div className="ws-diff">{children}</div>;
}

export function DiffPane({
  side,
  title,
  children,
}: {
  side: "in" | "out";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ws-diff-pane" data-side={side}>
      <h4>{title}</h4>
      <p>{children}</p>
    </div>
  );
}

/** A word the transform changed, marked inside the transformed pane. */
export function DiffMark({ children }: { children: ReactNode }) {
  return <mark>{children}</mark>;
}
