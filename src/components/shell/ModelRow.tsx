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
 *
 * **B5 gave the controls something to do** (ADR 0122) and changed nothing about
 * the row's shape. Every handler is optional and every one of them is absent in
 * the gallery, which is what keeps this component measurable against the
 * prototype: with no handler and no reason the rendered tree is the one Leg 6
 * ported, attribute for attribute.
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
  onDownload,
  onCancel,
  onRemove,
  onUse,
  reason,
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
  onDownload?: () => void;
  onCancel?: () => void;
  onRemove?: () => void;
  onUse?: () => void;
  /**
   * Why the control on this row cannot be operated, as one sentence.
   *
   * **Not a fourth state.** A language model whose server is not running is
   * still *installable* — nobody has looked at that disk — and the row says the
   * ordinary thing with the reason as its tooltip, rather than inventing a
   * greyed-out fourth appearance for a fact that is about the server.
   */
  reason?: string;
}) {
  const blocked = Boolean(reason);
  /* Spread rather than passed, because `IconButton` sets `title={label}` before
     its own props and a literal `title={undefined}` would delete that tooltip
     on every row that has no reason — which is every row in the gallery. */
  const why = reason ? { title: reason } : {};

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
              <Button variant="ghost" onClick={onUse} disabled={blocked} {...why}>
                Use
              </Button>
            )}
            <IconButton
              label={`Remove ${name}`}
              icon={<Icon name="trash" />}
              tone="danger"
              onClick={onRemove}
              disabled={blocked}
              {...why}
            />
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
            <IconButton label="Cancel" icon={<Icon name="x" />} onClick={onCancel} />
          </span>
        ) : (
          <Button
            variant="ghost"
            icon={<Icon name="download" />}
            onClick={onDownload}
            disabled={blocked}
            {...why}
          >
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
