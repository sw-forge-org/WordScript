import type { ReactNode } from "react";
import { StatusBadge, type StatusTone } from "./StatusBadge";

/**
 * THE CLIENT, AND ITS CONVERSATIONS — `demo.js`'s `.clnt` block.
 *
 * A list of recordings hung off one person. Deliberately not a table: four
 * conversations are read, not scanned, and a table header would promise sorting
 * and filtering this surface does not have and should not grow.
 *
 * A CLIENT IS A CONTEXT OBJECT — the same type the calendar, an upload and a
 * link already produce (ADR 0045). It is not a CRM and does not grow into one:
 * a name, the conversations, and what was agreed. Pipelines, deals and
 * reminders belong to the tool that already owns them.
 */
export function Client({ children }: { children: ReactNode }) {
  return <div className="ws-clnt">{children}</div>;
}

export function ClientHead({
  name,
  meta,
  actions,
}: {
  name: string;
  meta: string;
  actions?: ReactNode;
}) {
  return (
    <div className="ws-clnt-head">
      <div className="ws-clnt-id">
        <b>{name}</b>
        <span>{meta}</span>
      </div>
      {actions && <span className="ws-rowflex">{actions}</span>}
    </div>
  );
}

export function ClientList({ children }: { children: ReactNode }) {
  return <div className="ws-clnt-list">{children}</div>;
}

export function ClientRow({
  when,
  title,
  length,
  state,
  tone,
}: {
  when: string;
  title: string;
  length: string;
  state: string;
  tone: StatusTone;
}) {
  return (
    <div className="ws-clnt-row">
      <span className="ws-clnt-when ws-mono">{when}</span>
      <b>{title}</b>
      <span className="ws-clnt-len ws-mono">{length}</span>
      <StatusBadge tone={tone}>{state}</StatusBadge>
    </div>
  );
}

/**
 * THE DOCUMENT IT ENDS IN — a form the conversation fills, and the third line
 * of every field is the part that matters: WHERE the value came from.
 *
 * A meeting ends in a summary somebody reads once. This ends in a record whose
 * sections are decided by a process outside this product, and a generated
 * document whose provenance is invisible is one nobody can defend in the
 * meeting where it is questioned — and these are documents that get questioned.
 *
 * AN EMPTY FIELD SAYS EMPTY. If nobody named an owner, the field says nobody
 * named an owner. A template that fills its gaps from a model produces a
 * document that reads complete and is not, which is the one failure this must
 * never have.
 */
export function DocTemplate({ children }: { children: ReactNode }) {
  return <div className="ws-doct">{children}</div>;
}

export function DocTemplateHead({ picker, badge }: { picker: ReactNode; badge: ReactNode }) {
  return (
    <div className="ws-doct-head">
      <span className="ws-doct-pick">{picker}</span>
      {badge}
    </div>
  );
}

export function DocTemplateBody({ children }: { children: ReactNode }) {
  return <div className="ws-doct-body">{children}</div>;
}

export function DocField({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  /** Where the value came from. Set apart from the value it explains, because
   *  it is a note about the document rather than part of it. */
  children: ReactNode;
}) {
  return (
    <div className="ws-doct-field">
      <span className="ws-doct-label">{label}</span>
      <p className="ws-doct-val">{value}</p>
      <span className="ws-doct-why">{children}</span>
    </div>
  );
}
