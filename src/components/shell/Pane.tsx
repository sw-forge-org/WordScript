import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { StatusBadge, type StatusTone } from "./StatusBadge";

/**
 * PANE — a list column and its detail, as ONE surface. `demo.js`'s `pane()`.
 *
 * THE LIST IS NOT A CARD. Two cards side by side read as two unrelated boxes
 * with no stated relationship — which is exactly how the first build of
 * Profiles, Notes and Chat failed. The column belongs to the window: it is
 * borderless, sits on the sidebar plane, and is separated by a hairline.
 * Selection in the column governs everything to the right of that hairline.
 *
 * THE HEAD IS TWO ROWS WHEN IT CARRIES TABS. Measured at the sheet's width, a
 * fourth tab took the tab bar to 349 px against 387 px of head with 245 px of
 * buttons still to place: the title wrapped and the buttons dropped under the
 * tabs, unaligned. Squeezing it back was available and wrong — the ways to fit
 * were to drop a tab or to unlabel two, and both are content decisions being
 * made by a layout. So identity and windows share the first row, views get the
 * second, and the head grows by 30 px once.
 */
export function Pane({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return (
    <div className="ws-pane">
      <div className="ws-pane-list">{list}</div>
      <div className="ws-pane-detail">{detail}</div>
    </div>
  );
}

export function PaneListHead({ title, count }: { title: string; count?: ReactNode }) {
  return (
    <div className="ws-pane-list-head">
      <b>{title}</b>
      {count !== undefined && <span className="ws-count">{count}</span>}
    </div>
  );
}

export function PaneSearch({ children }: { children: ReactNode }) {
  return <div className="ws-pane-search">{children}</div>;
}

export function PaneScroll({ children }: { children: ReactNode }) {
  return <div className="ws-pane-scroll">{children}</div>;
}

export function PaneGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ws-pane-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function PaneRow({
  icon,
  title,
  when,
  sub,
  badge,
  pinned,
  current,
  onClick,
}: {
  icon?: IconName;
  title: string;
  /** On the title line, so the sub-line gets the full width. */
  when?: string;
  sub?: string;
  /** On the SUB-line, never beside the title — the column is 236 px wide. */
  badge?: { text: string; tone: StatusTone };
  pinned?: boolean;
  current?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="ws-pane-row"
      aria-current={current ? "true" : "false"}
      onClick={onClick}
    >
      {icon && <Icon name={icon} />}
      <span className="ws-pane-row-text">
        <span className="ws-pane-row-top">
          <b>{title}</b>
          {when && <span className="ws-when">{when}</span>}
        </span>
        {(sub || badge) && (
          <span className="ws-pane-row-meta">
            {badge && <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>}
            {sub && <span>{sub}</span>}
          </span>
        )}
      </span>
      {pinned && (
        <span className="ws-pin">
          <Icon name="pin" />
        </span>
      )}
    </button>
  );
}

export function PaneListFoot({ children }: { children: ReactNode }) {
  return <div className="ws-pane-list-foot">{children}</div>;
}

/**
 * Where the folders actually are — a path, not a reassurance, and a control
 * rather than a caption. A path you can read but not change is a statement
 * about somebody else's machine.
 */
export function PanePath({ path, onOpen }: { path: string; onOpen?: () => void }) {
  return (
    <button type="button" className="ws-pane-path" onClick={onOpen}>
      <Icon name="folder" />
      <span>{path}</span>
      <span className="ws-chg">Change</span>
    </button>
  );
}

export function PaneDetailHead({
  title,
  description,
  actions,
  tabs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <div className="ws-pane-detail-head" data-two={tabs ? "" : undefined}>
      <div className="ws-pane-detail-row">
        <div className="ws-grow">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="ws-rowflex">{actions}</div>}
      </div>
      {tabs && <div className="ws-pane-detail-tabs">{tabs}</div>}
    </div>
  );
}

export function PaneDetailMain({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="ws-pane-detail-main" data-panel={overlay ? "" : undefined}>
      <div className="ws-pane-detail-body">{children}</div>
      {overlay}
    </div>
  );
}

/**
 * Four lists, four destinations. A LEGEND, not a settings card: three columns,
 * one line each, no hint column — because the block sets nothing.
 */
export function Legend({ children }: { children: ReactNode }) {
  return <div className="ws-legend">{children}</div>;
}

export function LegendRow({
  name,
  what,
  where,
}: {
  name: string;
  what: string;
  where: string;
}) {
  return (
    <div className="ws-legend-row">
      <b>{name}</b>
      <span>{what}</span>
      <StatusBadge tone="plan">{where}</StatusBadge>
    </div>
  );
}

/**
 * The one thing wrong with the selected profile, in its header. A flag is a
 * count AND a way in, so it is one control — not a badge beside a button.
 */
export function Flag({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="ws-flag" onClick={onClick}>
      <Icon name="alert" />
      {children}
    </button>
  );
}
