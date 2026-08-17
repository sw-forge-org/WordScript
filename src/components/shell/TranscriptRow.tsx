import { useRef, useState, type MouseEvent } from "react";
import { IconButton } from "./Button";
import { RowMenu, type MenuEntry } from "./FloatBar";
import { Icon } from "./Icon";
import { ListItem, type ListItemBadge, type RawTranscript } from "./ListItem";

/**
 * THE TRANSCRIPT ROW, SHARED BY HOME AND HISTORY — `demo.js`'s
 * `transcriptRow()`.
 *
 * Both screens list the same record and were building it with two different
 * action sets: Home offered Copy and Insert, History offered Copy, Retry and
 * Delete, and neither offered the two the record actually owns — the raw text
 * it was written from, and the file it was written to. One builder, so the row
 * cannot drift apart again. That is also why it is here rather than in a
 * screen: two callers make it a component.
 *
 * TWO CONTROLS STAY ON THE ROW AND THE OTHER FOUR ARE IN A MENU (ADR 0194).
 *
 * Six icon buttons hung off every row, one of them conditional, so a list had
 * rows of two different widths and the eye had to re-find the same verb at a
 * different x from one row to the next. What stays is *View raw* and *Copy*:
 * the first is not a command at all — it is this row's own disclosure, and the
 * row is already `[data-open]` when it is on — and the second is the thing you
 * come to this list to do, over and over, on row after row.
 *
 * ADR 0082 HAS TO BE QUALIFIED HERE RATHER THAN QUOTED. Its rule is *what stays
 * an icon is only what you repeat positionally*, which was written for a list
 * you REORDER: there the repeated gesture is up/down against a neighbour, and
 * everything else is occasional configuration. A transcript row is the other
 * kind of list — nothing is reordered and nothing is configured, it is a record
 * you take text out of — so the rule's own reasoning selects Copy. Reading it as
 * "only reorder controls may be icons" would send all six into the menu on a
 * list that has no reorder, which is the letter of the rule against its point.
 *
 * ONE VERB LIST, TWO WAYS IN. The `…` button and a right-click open the same
 * `RowMenu`, which is what ADR 0082 already answers a right-click with. The
 * menu's state lives HERE rather than in each screen, because two screens
 * copying three lines of dismissal logic is how the two grow apart — the
 * redundancy this row exists to prevent.
 *
 * A DISABLED REASON SURVIVES THE MOVE (ADR 0065). `Retry` and *Show in file
 * manager* were drawn-and-inert with the reason as their tooltip; in the menu
 * the entry is disabled and the reason is its hint, which is the same promise
 * on a surface that has room to state it in full.
 *
 * `Retry` keeps its shipped name, and WHY it cannot run is the caller's to say
 * rather than this row's. It used to take `audioKept` and disable itself
 * whenever the capture was gone — which is one of the runtime's two retry
 * paths, not both: a record that still holds its raw transcript re-runs the
 * transform and needs no audio at all (ADR 0075). A successful run deletes its
 * audio, so that condition greyed the control out on every completed record
 * while the runtime would have re-run any of them.
 *
 * Every row can be shown in the file manager, because every transcript IS a
 * Markdown file (§11.23, ADR 0074). The wired caller passes the record's own
 * path; a record that produced no text has no file and passes
 * `revealDisabledReason` instead, which keeps the verb listed and inert with its
 * reason rather than hidden. The gallery passes neither and keeps the drawing.
 */
export function TranscriptRow({
  title,
  meta,
  badges,
  raw,
  retryDisabledReason: retryLabel,
  restorable,
  open,
  onToggleRaw,
  onReveal,
  onRetry,
  onRestore,
  onCopy,
  onDelete,
  revealDisabledReason,
  busy,
}: {
  title: string;
  meta: string[];
  badges?: ListItemBadge[];
  raw: RawTranscript;
  /** Why Retry cannot run on this record, or nothing. The caller decides,
   *  because what a retry NEEDS is the runtime's rule and not this row's. */
  retryDisabledReason?: string;
  /** The delivery fell back to the clipboard and the text can still be placed. */
  restorable?: boolean;
  open?: boolean;
  onToggleRaw?: () => void;
  onReveal?: () => void;
  onRetry?: () => void;
  onRestore?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  /** Present means the surface has nowhere to reveal to. It becomes the menu
   *  entry's hint as well as its reason — a disabled control with no
   *  explanation is the fake-affordance defect one step quieter. */
  revealDisabledReason?: string;
  /** A row whose command is still in flight. Every acting control idles rather
   *  than queueing a second delete behind the first. */
  busy?: boolean;
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const overflow = useRef<HTMLButtonElement | null>(null);

  /* ORDER, AND IT IS THE ROW'S OLD ONE MINUS WHAT STAYED OUTSIDE: locate, redo,
     take, destroy. The two that only look are on the row; the one that cannot be
     undone is last and is the only one that tones. */
  const items: MenuEntry[] = [
    {
      label: "Show in file manager",
      icon: "folderOpen",
      hint: revealDisabledReason,
      disabled: Boolean(revealDisabledReason),
      onSelect: onReveal && (() => { setMenuAt(null); onReveal(); }),
    },
    {
      label: "Retry",
      icon: "restore",
      hint: retryLabel,
      disabled: Boolean(retryLabel) || busy,
      onSelect: onRetry && (() => { setMenuAt(null); onRetry(); }),
    },
    ...(restorable
      ? [
          {
            label: "Restore to cursor",
            icon: "resume" as const,
            disabled: busy,
            onSelect: onRestore && (() => { setMenuAt(null); onRestore(); }),
          },
        ]
      : []),
    {
      label: "Delete",
      icon: "trash",
      disabled: busy,
      onSelect: onDelete && (() => { setMenuAt(null); onDelete(); }),
    },
  ];

  /* A RIGHT-CLICK ON THE TEXT, NOT ON THE CONTROLS. `onContextMenu` is on the
     row, so it fires over the two buttons too — where the platform's own menu on
     a button is the more useful one, and where the reader was aiming at a
     control rather than at the record. */
  const openAt = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    setMenuAt({ x: event.clientX, y: event.clientY });
  };

  return (
    <>
      <ListItem
        title={title}
        meta={meta}
        badges={badges}
        raw={raw}
        open={open}
        onContextMenu={openAt}
        actions={
          <>
            <IconButton
              label="View raw transcript"
              icon={<Icon name="file" />}
              on={open}
              onClick={onToggleRaw}
            />
            <IconButton label="Copy" icon={<Icon name="copy" />} onClick={onCopy} />
            {/* UNDER THE BUTTON RATHER THAN AT THE POINTER, because a click has
                a target and a right-click has only a position. The menu clamps
                itself into the viewport from there. */}
            <IconButton
              ref={overflow}
              label="More actions"
              icon={<Icon name="more" />}
              on={Boolean(menuAt)}
              onClick={() => {
                if (menuAt) return setMenuAt(null);
                const box = overflow.current?.getBoundingClientRect();
                setMenuAt({ x: box ? box.left : 0, y: box ? box.bottom + 4 : 0 });
              }}
            />
          </>
        }
      />
      {menuAt && (
        <RowMenu
          at={menuAt}
          label={`Actions for ${title}`}
          items={items}
          onClose={() => setMenuAt(null)}
        />
      )}
    </>
  );
}
