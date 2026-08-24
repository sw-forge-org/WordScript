import { Fragment, type MouseEvent, type ReactNode } from "react";
import { IconButton } from "./Button";
import { Icon } from "./Icon";
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
 * what was written — and the difference is the evidence that anything happened
 * to it at all. WHICH stage is a claim neither text supports on its own, which
 * is what `note` is for: since ADR 0249 the runtime names its own stages on the
 * record, so the panel can say *WordScript did this* instead of leaving every
 * difference to be read as the AI stage's. It is not a second row and not a
 * dialog: it is the same record, unfolded.
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
  foot,
  footTone,
  onSelect,
  selectHint,
  current,
  onContextMenu,
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
  /**
   * MAKES THE TITLE THE PICK, for a list where one row governs what is drawn
   * under it (ADR 0222).
   *
   * **The title rather than a control beside it**, because what the reader is
   * choosing IS the thing named — the Accounts card's own note for the
   * hand-rolled row this replaced. A radio would be the right drawing for a
   * setting with N mutually exclusive values (`LaneCard`); this is disclosure,
   * and the row already has somewhere to say so.
   *
   * It is a `<button>` INSIDE the item rather than the item being one, which is
   * what lets `actions` exist at all: a row-wide button cannot hold the icon
   * buttons that act on the same row.
   */
  onSelect?: () => void;
  /** The pick's tooltip — what opens, in the caller's own words. */
  selectHint?: string;
  /** This row is the one the rows below it are about. */
  current?: boolean;
  /**
   * A SENTENCE UNDER THE ROW, AT THE ROW'S FULL WIDTH — and not `preview`.
   *
   * `preview` is a sample: one line of a transcript, truncated, because the
   * record it samples is one click away. A foot is a fact the reader needs
   * before acting on the row — *who uses this account* before Remove — so it is
   * neither cut nor squeezed into the text column beside a fixed badge column
   * (ADR 0222). See the geometry in `shell.css`.
   */
  foot?: string;
  footTone?: "danger";
  /** The row's own actions, at the row (ADR 0082). Every list in the product
   *  answers a right-click the same way; what stays as an ICON on the row is
   *  only what you repeat positionally, which is the reorder pair. */
  onContextMenu?: (event: MouseEvent) => void;
}) {
  return (
    <>
      <div
        className="ws-list-item"
        data-open={open ? "" : undefined}
        data-current={current ? "" : undefined}
        onContextMenu={onContextMenu}
      >
        <div className="ws-list-item-text">
          {onSelect ? (
            <b>
              <button
                type="button"
                className="ws-list-item-pick"
                aria-pressed={current ?? false}
                title={selectHint}
                onClick={onSelect}
              >
                {title}
              </button>
            </b>
          ) : (
            <b>{title}</b>
          )}
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
        {foot && (
          <span className="ws-list-item-foot" data-tone={footTone}>
            {foot}
          </span>
        )}
      </div>
      {open && raw && <RawPanel raw={raw} />}
    </>
  );
}

/**
 * MOVE THIS ROW UP OR DOWN, FOR A LIST WHOSE ORDER THE RUNTIME READS.
 *
 * It is a library pair rather than two buttons a screen assembles, because the
 * ordering affordance has to look and sit the same on every list that grows one
 * — `.ws-list-actions` reserves its space either way, and a screen that put
 * Delete first would give its rows a different rhythm from the list above it.
 *
 * BOTH ENDS ARE DISABLED RATHER THAN HIDDEN. Hiding the up arrow on the first
 * row makes every other row's action run start at a different x, which is the
 * defect `.ws-list-item-badges` was rebuilt to fix one line further left.
 * ADR 0072's hide-instead-of-disable exception is for a setting that is
 * IRRELEVANT under the current state; the first row's "up" is not irrelevant,
 * it is unavailable, and that is what disabled means (ADR 0065).
 */
export function Reorder({
  onUp,
  onDown,
  atTop,
  atBottom,
  what,
}: {
  onUp: () => void;
  onDown: () => void;
  atTop: boolean;
  atBottom: boolean;
  /** What is being moved, for the accessible name: "Move replacement up". */
  what: string;
}) {
  return (
    <>
      <IconButton
        label={`Move ${what} up`}
        icon={<Icon name="caretUp" />}
        disabled={atTop}
        onClick={onUp}
      />
      <IconButton
        label={`Move ${what} down`}
        icon={<Icon name="caretDown" />}
        disabled={atBottom}
        onClick={onDown}
      />
    </>
  );
}

/**
 * AN ANSWER, UNFOLDED WHERE IT WAS ASKED FOR — the same panel as `RawPanel`
 * with N labelled columns instead of its two (ADR 0082).
 *
 * `analyze_text_rules` has been a real command with nowhere to put its answer
 * since Leg 4c, and the two controls that call it — *Check against a sample*
 * and *Show the effective bias* — sit at the foot of the cards whose content
 * they are about. So the answer opens there, on the plane a reader has already
 * learned means "inside this", rather than on a screen of its own that would
 * have to restate which profile and which list it was computed from.
 *
 * `head` is for the input an answer is computed FROM — the sample sentence.
 * It spans the columns because a field sized to half the panel would wrap a
 * sentence that the output below it prints in full.
 */
export function AnswerPanel({
  head,
  columns,
  foot,
  onClose,
}: {
  head?: ReactNode;
  columns: { label: string; body: ReactNode }[];
  foot?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="ws-list-raw">
      {head && <div className="ws-raw-head">{head}</div>}
      {columns.map((column) => (
        <div key={column.label} className="ws-raw-col">
          <span className="ws-raw-label">{column.label}</span>
          {column.body}
        </div>
      ))}
      <div className="ws-raw-foot">
        {foot}
        <button type="button" className="ws-raw-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
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
