import * as React from "react";
import { Button } from "./Button";
import { Field, TextArea } from "./Field";
import { StatusBadge } from "./StatusBadge";

/**
 * THE EDITOR IS A PANEL THAT UNFOLDS UNDER ITS OWN ROW, AND IT IS THE SAME
 * SHAPE `RawPanel` ALREADY IS (ADR 0082).
 *
 * The prototype draws no editor for anything — Add, Edit and New profile were
 * drawn, disabled and carrying "no editor is drawn for this yet" since Leg 4c —
 * so this is the first surface the port designs rather than carries across. It
 * is designed as the grammar that is already here rather than as a new one:
 * `.ws-list-raw` is a panel on the inset plane that opens under a list row,
 * whose row drops its rule so the pair reads as one block, and whose own
 * docstring says it is *"not a second row and not a dialog: it is the same
 * record, unfolded."* An editor wants exactly that sentence with fields in it.
 *
 * WHY NOT A DIALOG. Settings is ALREADY a modal sheet over the workspace
 * (ADR 0003, `.ws-modal-win`). A second scrim over it for two text fields is
 * the weight ADR 0069 took off Help eight days ago, for the reason it gave
 * then: a scrim says the surface behind is a detour you come back from, and
 * renaming a snippet is not a detour. Nothing recedes, nothing is dimmed, and
 * the list you were reading stays where it was.
 *
 * WHY NOT THE MENU POPOVER. `.ws-menu` is 230 px of glyph-label-hint rows for
 * choosing among named destinations. It has no field, no validation and no
 * commit, and stretching it into a form would give the library two things
 * called a popover that behave differently.
 *
 * KEYBOARD, BECAUSE THIS IS A CONTROL SOMEBODY USES TWENTY TIMES IN A ROW.
 * The first field takes focus when the panel opens; Enter commits from any
 * single-line field; Escape reverts and closes. A textarea keeps Enter for its
 * own newline and commits on Ctrl/Cmd+Enter, because a snippet body is the one
 * value here that legitimately contains line breaks.
 *
 * ESCAPE STOPS HERE AND THAT IS WHY IT IS A REACT HANDLER. `Sheet` listens for
 * Escape on `window`; React's own listener sits on the root container, which is
 * BELOW window in the bubble path, so `stopPropagation` in this handler is what
 * keeps Escape from closing the whole settings sheet out from under an open
 * editor. It is the stack `Sheet`'s `closeOnEscape` docstring describes,
 * obtained without giving it a second flag to carry.
 *
 * THE PANEL HOLDS THE DRAFT AND NOTHING ELSE DOES. Cancel has to be able to
 * throw the edit away, which a caller writing every keystroke into the config
 * cannot do — and `patchText`'s debounce would have committed half of it
 * anyway. So the values live here until Save, and the caller receives them
 * once. A caller rendering this for a list MUST key it per row: React would
 * otherwise preserve one row's draft into the next row's panel.
 */

/**
 * THE SAME PANEL, ASKING ONCE BEFORE SOMETHING IS GONE (ADR 0082).
 *
 * A destructive action reached from a menu is one click away from a mis-click,
 * and this is a list where the neighbouring entries are Rename and Duplicate.
 * So the menu entry does not delete: it opens this, which states what is about
 * to go and what goes with it, and puts the act on a second control that has to
 * be found and pressed.
 *
 * IT IS NOT A DIALOG, for the reason nothing else here is one. It unfolds where
 * the thing lives, which also means the thing is still on screen behind it —
 * the name, the list, the row — so the reader can check they are deleting what
 * they think they are. A centred confirm covers exactly that evidence.
 *
 * Escape cancels, and the confirming control never takes focus on open: a panel
 * that opens with the danger button focused turns a stray Return into the
 * deletion it exists to prevent.
 */
export function ConfirmPanel({
  question,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  question: string;
  /** What goes with it. Never a reassurance — the things that will be lost. */
  detail?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    cancel.current?.focus();
  }, []);

  return (
    <div
      className="ws-list-edit"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <div className="ws-edit-fields">
        <p className="ws-edit-question">{question}</p>
      </div>
      <div className="ws-edit-foot">
        {detail && <span className="ws-edit-note">{detail}</span>}
        <Button ref={cancel} variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export type EditorFieldSpec = {
  key: string;
  label: string;
  placeholder?: string;
  /** A value that may contain line breaks — a snippet body, and nothing else
   *  on this surface today. */
  multiline?: boolean;
  /** Empty is refused rather than saved, and Save says which field is missing.
   *  The runtime already skips an entry whose phrase or replacement is blank
   *  (`transform.rs`), so saving one writes a rule that silently never runs. */
  required?: boolean;
};

/** What the analysis says about the rule this panel is editing. The shape is
 *  `TextRulesIssue` minus the routing fields, so a screen can pass its own
 *  filtered list without this component learning about text rules. */
export type EditorIssue = { severity: "error" | "warning"; message: string };

export function EditorPanel({
  fields,
  initial,
  onSave,
  onCancel,
  saveLabel = "Save",
  note,
  issues = [],
  busy,
}: {
  fields: EditorFieldSpec[];
  initial?: Record<string, string>;
  onSave: (values: Record<string, string>) => void;
  onCancel: () => void;
  saveLabel?: string;
  /** The rule this editor's value obeys, stated where it is being set. */
  note?: React.ReactNode;
  issues?: EditorIssue[];
  busy?: boolean;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, initial?.[field.key] ?? ""])),
  );
  const first = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  /* FOCUS ON OPEN, AND THE SELECTION DEPENDS ON HOW MANY FIELDS THERE ARE.
     A one-field panel is a rename: the whole value is selected, because
     replacing it is what you came for. A two-field panel is an edit of a pair,
     where select-all would mean the first keystroke destroys the phrase you
     opened the panel to adjust — so the caret goes to the end instead. */
  React.useEffect(() => {
    const element = first.current;
    if (!element) return;
    element.focus();
    if (fields.length === 1) element.select();
    else element.setSelectionRange(element.value.length, element.value.length);
    // Mount only: a re-focus on every keystroke would fight the user's caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missing = fields.filter(
    (field) => field.required && values[field.key]?.trim().length === 0,
  );
  const blocked = missing.length > 0;
  const reason = blocked
    ? `${missing.map((field) => field.label).join(" and ")} ${missing.length === 1 ? "needs" : "need"} a value`
    : undefined;

  const commit = () => {
    if (blocked || busy) return;
    onSave(Object.fromEntries(fields.map((field) => [field.key, values[field.key]?.trim() ?? ""])));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Enter") return;
    const multiline = (event.target as HTMLElement).tagName === "TEXTAREA";
    if (multiline && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    commit();
  };

  return (
    <div className="ws-list-edit" onKeyDown={onKeyDown}>
      <div className="ws-edit-fields">
        {fields.map((field, index) => (
          <label
            key={field.key}
            className="ws-edit-field"
            data-wide={field.multiline ? "" : undefined}
          >
            <span className="ws-edit-label">{field.label}</span>
            {field.multiline ? (
              <TextArea
                ref={index === 0 ? first : undefined}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            ) : (
              <Field
                ref={index === 0 ? first : undefined}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            )}
          </label>
        ))}
      </div>

      {issues.length > 0 && (
        <div className="ws-edit-issues">
          {issues.map((issue) => (
            <p key={`${issue.severity}-${issue.message}`}>
              <StatusBadge tone={issue.severity === "error" ? "danger" : "warning"}>
                {issue.severity}
              </StatusBadge>
              <span>{issue.message}</span>
            </p>
          ))}
        </div>
      )}

      <div className="ws-edit-foot">
        {note && <span className="ws-edit-note">{note}</span>}
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {/* DISABLED WITH THE REASON ON IT (ADR 0065), and the reason is the
            missing field by name. `title` is the only place it fits — the foot
            is one line and a validation sentence under it would move the
            buttons every time a field went empty. */}
        <Button variant="primary" onClick={commit} disabled={blocked} busy={busy} title={reason}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
