import type { ReactNode } from "react";
import { Button, IconButton } from "./Button";
import { Icon } from "./Icon";
import { ProviderMark } from "./ProviderMark";
import { StatusBadge } from "./StatusBadge";

/**
 * A DOWNLOADABLE MODEL — `demo.js`'s `modelRow()`.
 *
 * Shared by Settings and onboarding for the same reason the provider picker is:
 * onboarding's local lane needs real download controls, not a select that names
 * files it cannot fetch, and a second implementation of the same row would drift
 * from this one.
 *
 * THE STATE DECIDES THE CONTROL: not installed → download; installing →
 * progress and cancel; installed → use it or remove it. The size is stated
 * before the download rather than discovered during it, because the size is the
 * fact that decides whether you want it.
 */

export type ModelState = "available" | "downloading" | "installed";

export function ModelList({ children }: { children: ReactNode }) {
  return <div className="ws-mdl-list">{children}</div>;
}

export function ModelRow({
  brand,
  name,
  size,
  detail,
  state = "available",
  active,
  pct = 0,
}: {
  /** The brand whose mark answers "whose model is this" before the name is read. */
  brand?: string;
  name: string;
  size: string;
  detail: string;
  state?: ModelState;
  /** Installed and currently the one a job runs. */
  active?: boolean;
  pct?: number;
}) {
  return (
    <div className="ws-mdl" data-state={state}>
      <span className="ws-mdl-mark">
        <ProviderMark name={brand} fallback={<Icon name="models" />} />
      </span>
      <div className="ws-mdl-text">
        <b>{name}</b>
        <span className="ws-mdl-meta">
          {size} · {detail}
        </span>
      </div>
      <div className="ws-mdl-ctl">
        {state === "installed" ? (
          <span className="ws-rowflex">
            {active ? (
              <StatusBadge tone="success">In use</StatusBadge>
            ) : (
              <Button variant="ghost">Use</Button>
            )}
            <IconButton label={`Remove ${name}`} icon={<Icon name="trash" />} tone="danger" />
          </span>
        ) : state === "downloading" ? (
          <span className="ws-rowflex">
            {/* A progress bar in a row, not a dialog over one. A download that
                blocks the list it came from is a download you cannot start a
                second of. */}
            <span className="ws-dl">
              <i style={{ width: `${pct}%` }} />
            </span>
            <span className="ws-muted ws-mono">{`${pct}%`}</span>
            <IconButton label="Cancel" icon={<Icon name="x" />} />
          </span>
        ) : (
          <Button variant="ghost" icon={<Icon name="download" />}>
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
