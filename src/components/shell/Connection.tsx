import type { ReactNode } from "react";
import { Button, IconButton } from "./Button";
import { Icon, type IconName } from "./Icon";
import { StatusBadge, type StatusTone } from "./StatusBadge";

/**
 * A CONNECTABLE PROVIDER — `demo.js`'s `conn()`.
 *
 * NOT A CARD OF ROWS. A row is a label and a control, and the control here
 * changes what the block contains: connected, it grows a list; unconnected, it
 * is one sentence and one button. Connected accounts are children of the
 * provider, indented to the tile's right edge, because they are instances of it
 * and not three more providers.
 */
export function ConnectionList({ children }: { children: ReactNode }) {
  return <div className="ws-conn-list">{children}</div>;
}

export function Connection({
  icon,
  name,
  description,
  accounts = [],
  state,
  action,
}: {
  icon: IconName;
  name: string;
  description: string;
  accounts?: string[];
  /** For a provider that cannot be connected here, and why. */
  state?: { text: string; tone: StatusTone };
  action?: ReactNode;
}) {
  const connected = accounts.length > 0;
  return (
    <div className="ws-conn" data-on={connected ? "" : undefined}>
      <div className="ws-conn-top">
        <span className="ws-conn-tile">
          <Icon name={icon} />
        </span>
        <span className="ws-conn-text">
          <b>{name}</b>
          <span>{description}</span>
        </span>
        <span className="ws-conn-ctl">
          {connected ? (
            <StatusBadge tone="success">Connected</StatusBadge>
          ) : state ? (
            <StatusBadge tone={state.tone}>{state.text}</StatusBadge>
          ) : null}
          {!connected && action}
        </span>
      </div>
      {connected && (
        <div className="ws-conn-accounts">
          {accounts.map((account) => (
            <div key={account} className="ws-conn-account">
              <Icon name="user" />
              <span>{account}</span>
              <IconButton
                label={`Disconnect ${account}`}
                icon={<Icon name="x" />}
                tone="danger"
              />
            </div>
          ))}
          <div className="ws-conn-add">{action}</div>
        </div>
      )}
    </div>
  );
}

/** A command you copy, not a code block you read. */
export function Command({ children }: { children: string }) {
  return (
    <div className="ws-cmd">
      <code>{children}</code>
      <Button variant="ghost" icon={<Icon name="copy" />}>
        Copy
      </Button>
    </div>
  );
}

/**
 * THREE KINDS, AND ONE QUESTION SORTS THEM: does it write anywhere? The table
 * is the screen's argument and it replaces most of its former prose.
 *
 * A fourth column was cut. It carried an example per class, which the three
 * sections below the table already are — and at the sheet's 640 px it took the
 * `what` column down to about 220 px and wrapped every row to three lines, so
 * the table meant to be read at a glance was the tallest thing on the screen.
 */
export function KindTable({ children }: { children: ReactNode }) {
  return <div className="ws-klass">{children}</div>;
}

export function KindRow({
  kind,
  what,
  who,
}: {
  kind: "intake" | "bridge" | "reach";
  what: string;
  who: string;
}) {
  return (
    <div className="ws-klass-row" data-k={kind}>
      <span className="ws-klass-name">{kind}</span>
      <span className="ws-klass-what">{what}</span>
      <span className="ws-klass-who">{who}</span>
    </div>
  );
}

/**
 * The two bridge surfaces, side by side (§11.49). They were two sections of
 * rows, each spending its first line introducing itself; as two panels the
 * comparison IS the layout.
 */
export function ServerPanels({ children }: { children: ReactNode }) {
  return <div className="ws-srvl">{children}</div>;
}

export function ServerPanel({
  name,
  tools,
  description,
  clients,
  canSpeak,
}: {
  name: string;
  tools: string;
  description: string;
  clients: string;
  /** The one difference that matters, in the same place on both. */
  canSpeak: boolean;
}) {
  return (
    <div className="ws-srv-row">
      <div className="ws-srv-head">
        <b>{name}</b>
        <span className="ws-mono">{tools}</span>
      </div>
      <p>{description}</p>
      <div className="ws-srv-meta">
        <StatusBadge tone="plan">{clients}</StatusBadge>
        <StatusBadge tone={canSpeak ? "accent" : "success"}>
          {canSpeak ? "can speak to you" : "cannot speak to you"}
        </StatusBadge>
      </div>
    </div>
  );
}
