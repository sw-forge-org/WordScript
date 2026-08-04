import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * ONE ROW OF THE DECISION INBOX — ADR 0044, ported from `demo.js`'s `owed()`.
 *
 * `ActionStrip` is the same shape for one item. This is the shape for a list of
 * them, and it carries one column the strip never needed: `cost`, which answers
 * **what happens if I do nothing**.
 *
 * That column is the entire difference between a decision inbox and a to-do
 * list. So `cost` is not a timestamp and not a status. It is a sentence about
 * the future, it is what the list sorts on, and `urgent` is set by whether that
 * sentence names a deadline — never by which surface raised the item.
 *
 * THE COST IS A LINE, NOT A COLUMN. Measured in the browser at the sheet's
 * 640 px, a 190 px cost column plus two answer buttons left about 200 px for the
 * title and all three titles truncated. The answer buttons cannot become icons
 * — they are the words the agent offered — so the cost moves down instead.
 */
export function OwedList({ children }: { children: ReactNode }) {
  return <div className="ws-owed-list">{children}</div>;
}

export function Owed({
  icon = "pending",
  urgent,
  title,
  from,
  cost,
  actions,
}: {
  icon?: IconName;
  urgent?: boolean;
  title: string;
  from: string;
  cost: string;
  actions: ReactNode;
}) {
  return (
    <div className="ws-owed" data-urgent={urgent ? "" : undefined}>
      <span className="ws-owed-tile">
        <Icon name={icon} />
      </span>
      <div className="ws-owed-text">
        <b>{title}</b>
        <span className="ws-owed-from">{from}</span>
        <span className="ws-owed-cost">
          <Icon name={urgent ? "clock" : "minus"} />
          <span>{cost}</span>
        </span>
      </div>
      <div className="ws-owed-acts ws-rowflex">{actions}</div>
    </div>
  );
}
