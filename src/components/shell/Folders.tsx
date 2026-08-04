import type { ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * THE RAIL'S SECOND LEVEL — `demo.js`'s `contextRail`, `paneSecHead` and
 * `folderRow`.
 *
 * Notes were one flat list, which works until there are forty of them and the
 * meeting you want is under two weeks of dictations. The rail carries the
 * folders above the objects, and the folder selection governs the list the way
 * the list governs the detail: one column, two levels, no second window.
 *
 * THESE FOLDERS ARE DIRECTORIES. WordScript keeps notes as files under a real
 * path on this machine, so a folder here is the same thing the file manager
 * shows and moving an object between folders moves a file. That is a promise
 * the surface makes and the runtime has to keep — the path stated in the rail
 * footer (`PanePath`) is there precisely so this cannot quietly become a
 * database table with folder-shaped rows.
 */
export function PaneSec({ grow, children }: { grow?: boolean; children: ReactNode }) {
  return <div className={grow ? "ws-pane-sec ws-grow" : "ws-pane-sec"}>{children}</div>;
}

/** A section head owns its own addition — which is why the rail's foot does
 *  not repeat one. */
export function PaneSecHead({
  label,
  addLabel,
  addOn,
  onAdd,
}: {
  label: string;
  addLabel: string;
  /** The add control is `data-on` while the intake it opens is the state. */
  addOn?: boolean;
  onAdd?: () => void;
}) {
  return (
    <div className="ws-pane-sec-head">
      <b>{label}</b>
      <button
        type="button"
        className="ws-add"
        aria-label={addLabel}
        data-on={addOn ? "" : undefined}
        onClick={onAdd}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

export function Folders({ children }: { children: ReactNode }) {
  return <div className="ws-folders">{children}</div>;
}

export function FolderRow({
  name,
  count,
  current,
  onClick,
}: {
  name: string;
  count: number;
  current?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="ws-folder-row"
      aria-current={current ? "true" : "false"}
      onClick={onClick}
    >
      <Icon name={current ? "folderOpen" : "folder"} />
      <span className="ws-fname">{name}</span>
      <span className="ws-n">{count}</span>
    </button>
  );
}
