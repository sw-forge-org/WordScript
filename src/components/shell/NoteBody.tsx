import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

/**
 * THE CONTEXT OBJECT, AS IT IS READ — `demo.js`'s note grammar.
 *
 * FOUR TABS, AND THE FIRST DRAFT HAD SEVEN. Summary · Transcript · People ·
 * Decisions · Tasks · Linked was written out and thrown away, for a reason
 * worth keeping: a tab is a view of the whole object, not a heading inside one
 * of them. Decisions and Tasks are sections of the summary — that is where
 * they are derived and where they are read — and putting them on tabs of their
 * own splits one page into three and asks the reader to guess which of the
 * three holds the sentence they remember. People are not a view at all; they
 * are chips on the transcript and in the object's own header.
 *
 * `Enhanced` was renamed to `Summary` in the same pass: "enhanced" describes
 * how it was made, which is only interesting for the ten seconds after it is
 * made, and it means nothing at all on a dictation.
 */
export function NoteTabs<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: Array<{ id: T; icon?: IconName }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="ws-note-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value ? "true" : "false"}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <Icon name={item.icon} />}
          {item.id}
        </button>
      ))}
    </div>
  );
}

/** The body scrolls under a floating action bar, so it owes that bar room at
 *  the bottom — otherwise the last line is unreadable exactly when the note is
 *  longest. `demo.css` spends 64 px on it. */
export function NoteBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("ws-note-body", className)}>{children}</div>;
}

/**
 * THE OBJECT'S OWN HEADER LINE, AND IT NAMES ITS ORIGIN.
 *
 * Every object in the list carries the same line and it always answers the
 * same three questions: when, where it came from, and what it is made of. On
 * an upload it reads `uploaded file · 34:18`; on a dictation, `dictation ·
 * Cleanup`. Same slot, same order, so the merge of Notes into Context does not
 * cost the reader a second layout to learn.
 */
export function NoteDate({ children, from }: { children: ReactNode; from?: ReactNode }) {
  return (
    <span className="ws-note-date">
      {children}
      {from && <> <span className="ws-origin-from">{from}</span></>}
    </span>
  );
}

/* ── The transcript ───────────────────────────────────────────────────────── */

/**
 * A meeting transcript without timestamps cannot be used against a recording.
 * The time is the index: it is how you get back to the moment, and how a note
 * refers to a line.
 */
export function Transcript({ children }: { children: ReactNode }) {
  return <div className="ws-tscript">{children}</div>;
}

export function TLine({
  at,
  who,
  tone,
  text,
  marked,
}: {
  at: string;
  who?: string;
  /** `a` is you, `b` and `c` are the other voices. */
  tone?: "a" | "b" | "c";
  text: ReactNode;
  /** Marked during the meeting. */
  marked?: boolean;
}) {
  return (
    <div className="ws-tline" data-marked={marked ? "" : undefined}>
      <time>{at}</time>
      <span className="ws-said">
        {who && (
          <span className="ws-speaker" data-tone={tone}>
            {who}
          </span>
        )}
        {text}
      </span>
    </div>
  );
}

export function Speakers({ children }: { children: ReactNode }) {
  return <div className="ws-speakers">{children}</div>;
}

export function Speaker({ tone, children }: { tone?: "a" | "b" | "c"; children: ReactNode }) {
  return (
    <span className="ws-speaker" data-tone={tone}>
      {children}
    </span>
  );
}

/* ── Speaker chips — the name, and how sure the product is of it ──────────── */

/**
 * ADR 0047. Four statuses, borrowed whole from the donor's
 * `speakerAssignmentPolicy` because it is the part of diarization that is a
 * product decision rather than a model:
 *
 *   provisional  a cluster with no name yet — `Speaker 2`
 *   suggested    a name proposed from the calendar or a saved voice profile
 *   confirmed    the model matched a voice it has seen labelled before
 *   locked       you said so, and re-clustering may not overwrite it
 *
 * `locked` is the one that has to exist. Clustering runs again when the meeting
 * ends, over the whole recording rather than the live window, and it will
 * happily renumber everybody. Without a status that survives that pass, every
 * name the user typed during the call is a name that changes after it — which
 * is worse than never having offered names.
 *
 * The chip states its source in as many words, because "Sarah Chen" from the
 * attendee list and "Sarah Chen" that you typed are different claims.
 */
export type WhoStatus = "provisional" | "suggested" | "confirmed" | "locked";
export type WhoHow = "mic" | "calendar" | "cluster" | "profile";

const HOW_TEXT: Record<WhoHow, string> = {
  mic: "from your microphone",
  calendar: "suggested from the invite",
  cluster: "voice cluster, unnamed",
  profile: "matched a saved voice",
};

export function WhoChips({ children }: { children: ReactNode }) {
  return <div className="ws-who-chips">{children}</div>;
}

export function WhoChip({
  name,
  how,
  status,
}: {
  name: string;
  how: WhoHow;
  status: WhoStatus;
}) {
  return (
    <span className="ws-who-chip" data-status={status}>
      <span className="ws-who-dot" />
      <b>{name}</b>
      <span className="ws-who-how">{HOW_TEXT[how]}</span>
    </span>
  );
}

export function WhoAdd({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="ws-who-add" onClick={onClick}>
      <Icon name="plus" />
      {children}
    </button>
  );
}

/* ── The derived output ───────────────────────────────────────────────────── */

/**
 * A DERIVED LIST, WITH OR WITHOUT AN ACTION COLUMN. Most entries have nothing
 * to do — an action on every row would make the two that matter invisible — so
 * the button is revealed on hover and on focus and holds its space when it is
 * not visible.
 *
 * An open question that can be escalated is the one thing on the Summary tab
 * that reaches the decision inbox, and it goes there because somebody is stuck
 * on it, not because it is important. A task that can be handed over goes to
 * the desk. Both are explicit gestures with a button; nothing on the tab
 * reaches out on its own.
 */
export function Enh({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="ws-enh">
      {title && <h4>{title}</h4>}
      <ul>{children}</ul>
    </div>
  );
}

export function EnhItem({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

export function EnhAct({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <li className="ws-enh-act">
      <span>{children}</span>
      {action && <span className="ws-enh-act-btn">{action}</span>}
    </li>
  );
}

/* ── Linked ───────────────────────────────────────────────────────────────── */

/**
 * ONE GROUP OF THE LINKED TAB. Deliberately a list and deliberately not a
 * graph (§11.42): a graph shows THAT things connect, and the question a reader
 * arrives with is WHAT connects. The entry point from the other direction —
 * every object touching one person or one project — is a filter on the rail,
 * not a second view.
 */
export function LinkGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ws-linkgrp">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

export function LinkRow({
  icon,
  name,
  meta,
  onOpen,
}: {
  icon: IconName;
  name: string;
  meta: string;
  onOpen?: () => void;
}) {
  return (
    <button type="button" className="ws-link-row" onClick={onOpen}>
      <Icon name={icon} />
      <span className="ws-link-text">
        <b>{name}</b>
        <span>{meta}</span>
      </span>
      <span className="ws-link-go">
        <Icon name="chevron" />
      </span>
    </button>
  );
}

/** Transcript and enhanced output are read, not edited. */
export function Readout({ lead, children }: { lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="ws-readout">
      {lead && <div className="ws-lead">{lead}</div>}
      {children}
    </div>
  );
}
