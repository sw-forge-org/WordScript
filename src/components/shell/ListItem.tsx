import { Fragment, type ReactNode } from "react";
import { StatusBadge, type StatusTone } from "./StatusBadge";
import { StatusDot, type StatusDotTone } from "./StatusDot";

/**
 * THE LIST ROW — `demo.js`'s `listItem()` and `rawPanel()`.
 *
 * One builder, because Home and History list the same record and were building
 * it with two different action sets — Home offered Copy and Insert, History
 * offered Copy, Retry and Delete, and neither offered the two the record
 * actually owns: the raw text it was written from, and the file it was written
 * to.
 *
 * `state` IS A DOT PLUS A WORD at the head of the meta line, for a status that
 * is expected. `badges` is for a status that is not — and it is a column rather
 * than a slot, because the moment a row can carry two the pair fought the
 * actions for the same horizontal run and the row reflowed on hover.
 *
 * `raw` OPENS UNDER THE ROW. A transcript has two texts — what was heard and
 * what was written — and the difference is the only evidence that the AI stage
 * did anything at all. It is not a second row and not a dialog: it is the same
 * record, unfolded.
 */

export type ListItemBadge = { text: string; tone: StatusTone };
export type ListItemState = { text: string; tone: StatusDotTone };

export type RawTranscript = {
  heard: string;
  written: string;
  /** No `heard` of its own means the two texts are identical. */
  same?: boolean;
  note?: string;
  /** OPTIONAL, AND ITS ABSENCE IS THE RUNTIME'S ANSWER. The drawing gives every
   *  transcript a Markdown path and since ADR 0074 the runtime writes one, so a
   *  wired caller passes the record's own file. It stays optional because one
   *  record still has none: a run that produced no text. */
  path?: string;
};

export function ListRows({ children }: { children: ReactNode }) {
  return <div className="ws-list">{children}</div>;
}

export function ListItem({
  title,
  meta,
  state,
  badges = [],
  preview,
  previewTone,
  actions,
  raw,
  open,
}: {
  title: string;
  meta: string[];
  state?: ListItemState;
  badges?: ListItemBadge[];
  preview?: string;
  previewTone?: "danger";
  actions?: ReactNode;
  raw?: RawTranscript;
  open?: boolean;
}) {
  return (
    <>
      <div className="ws-list-item" data-open={open ? "" : undefined}>
        <div className="ws-list-item-text">
          <b>{title}</b>
          <span className="ws-list-item-meta">
            {state && (
              <>
                <span className="ws-st">
                  <StatusDot tone={state.tone} />
                  {state.text}
                </span>
                <span className="ws-sep">·</span>
              </>
            )}
            {meta.map((entry, index) => (
              <Fragment key={entry}>
                {index > 0 && <span className="ws-sep">·</span>}
                <span>{entry}</span>
              </Fragment>
            ))}
          </span>
          {preview && (
            <span className="ws-list-item-preview" data-tone={previewTone}>
              {preview}
            </span>
          )}
        </div>
        {badges.length > 0 && (
          <div className="ws-list-item-badges">
            {badges.map((badge) => (
              <StatusBadge key={badge.text} tone={badge.tone}>
                {badge.text}
              </StatusBadge>
            ))}
          </div>
        )}
        {actions && <div className="ws-list-actions">{actions}</div>}
      </div>
      {open && raw && <RawPanel raw={raw} />}
    </>
  );
}

/**
 * Both texts, labelled, with the one fact that decides whether the pair is
 * worth reading: whether they differ at all.
 */
export function RawPanel({ raw }: { raw: RawTranscript }) {
  return (
    <div className="ws-list-raw">
      <div className="ws-raw-col">
        <span className="ws-raw-label">Heard</span>
        <p>{raw.heard}</p>
      </div>
      <div className="ws-raw-col">
        <span className="ws-raw-label">Written</span>
        <p>{raw.written}</p>
      </div>
      <div className="ws-raw-foot">
        {/* THE CALLER'S SENTENCE WINS OVER BOTH DEFAULTS, and it has to: the
            panel can compare two strings and cannot know whether a stage RAN.
            Equal texts and no stage is "Identical"; equal texts and a stage
            that changed nothing is a different fact, and only the caller holds
            the evidence for it. */}
        {raw.note ?? (raw.same ? "Identical — no AI stage ran on this one." : "The AI stage rewrote it.")}
        {raw.path && <span className="ws-raw-path ws-mono">{raw.path}</span>}
      </div>
    </div>
  );
}
