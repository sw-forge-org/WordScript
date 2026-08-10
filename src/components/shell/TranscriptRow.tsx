import { IconButton } from "./Button";
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
 * ORDER. Read, locate, redo, take, destroy. The two that only look are first,
 * the one that cannot be undone is last and is the only one that tones.
 * `Retry` keeps its shipped name — it re-runs the pipeline over kept audio
 * (ADR 0039), so a row whose audio has been swept cannot use it and says so by
 * disabling the control rather than by hiding it.
 *
 * Every row can be shown in the file manager, because every transcript IS a
 * Markdown file (§11.23, ADR 0074). The wired caller passes the record's own
 * path; a record that produced no text has no file and passes
 * `revealDisabledReason` instead, which keeps the control drawn and inert with
 * its reason (ADR 0065) rather than hidden. The gallery passes neither and
 * keeps the drawing, which is what keeps `port:diff` exact.
 */
export function TranscriptRow({
  title,
  meta,
  badges,
  raw,
  audioKept = true,
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
  /** `false` is a record whose audio has been swept. */
  audioKept?: boolean;
  /** The delivery fell back to the clipboard and the text can still be placed. */
  restorable?: boolean;
  open?: boolean;
  onToggleRaw?: () => void;
  onReveal?: () => void;
  onRetry?: () => void;
  onRestore?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  /** Present means the surface has nowhere to reveal to. It becomes the
   *  button's label as well as its reason, because `IconButton`'s label IS its
   *  tooltip — a disabled control with no explanation is the fake-affordance
   *  defect one step quieter. */
  revealDisabledReason?: string;
  /** A row whose command is still in flight. Every acting control idles rather
   *  than queueing a second delete behind the first. */
  busy?: boolean;
}) {
  return (
    <ListItem
      title={title}
      meta={meta}
      badges={badges}
      raw={raw}
      open={open}
      actions={
        <>
          <IconButton
            label="View raw transcript"
            icon={<Icon name="file" />}
            on={open}
            onClick={onToggleRaw}
          />
          <IconButton
            label={revealDisabledReason ?? "Show in file manager"}
            icon={<Icon name="folderOpen" />}
            disabled={Boolean(revealDisabledReason)}
            onClick={onReveal}
          />
          <IconButton
            label={audioKept ? "Retry" : "Retry — audio no longer kept"}
            icon={<Icon name="restore" />}
            disabled={!audioKept || busy}
            onClick={onRetry}
          />
          {restorable && (
            <IconButton
              label="Restore to cursor"
              icon={<Icon name="resume" />}
              disabled={busy}
              onClick={onRestore}
            />
          )}
          <IconButton label="Copy" icon={<Icon name="copy" />} onClick={onCopy} />
          <IconButton
            label="Delete"
            icon={<Icon name="trash" />}
            tone="danger"
            disabled={busy}
            onClick={onDelete}
          />
        </>
      }
    />
  );
}
