import * as React from "react";
import { Icon, type IconName } from "./Icon";
import { cn } from "@/lib/utils";

/**
 * THE COMMAND PALETTE — `demo.js`'s `commandPalette()` and `demo.css`'s
 * `.cmdk*`, ported by Leg 4d. It is the only surface the prototype drew that no
 * earlier leg carried.
 *
 * WHAT IS HERE AND WHAT IS NOT. These parts are the drawing: the panel, the
 * field, the list, a row and its match highlight, the foot. WHAT the palette
 * indexes and what each row DOES is the workspace's — `windows/workspace/
 * palette.tsx` — because the index is a list of that window's views, its
 * settings sections and its runtime's actions, and a library component that
 * knew those would be the gallery-as-second-product ADR 0055 forbids.
 *
 * IT IS NOT `role="dialog"` WITH `aria-modal`. The prototype is explicit that
 * it never blocks: nothing behind it is disabled and it is abandoned mid-task
 * constantly, so `aria-modal` would be a promise about protected focus that it
 * does not keep. It is a dialog that owns focus while it is up, and Escape and
 * a click outside are both ways out.
 */

export function Palette({
  label,
  onClose,
  className,
  children,
}: {
  label: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const scrim = React.useRef<HTMLDivElement>(null);
  return (
    <div
      ref={scrim}
      className={cn("ws-cmdk-scrim", className)}
      /* The scrim closes and the panel does not, so the target has to BE the
         scrim — `closest` would match on both, since the panel is inside it.
         `mousedown` rather than `click` for the sheet's own reason: a drag that
         started in the field and ended on the scrim reports the scrim as the
         click target. */
      onMouseDown={(event) => {
        if (event.target === scrim.current) onClose();
      }}
    >
      <div className="ws-cmdk ws-frost-panel" role="dialog" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/** The field is the whole top of the panel and carries no label of its own:
 *  the placeholder is what it is for, and a label above it would be a second
 *  heading on a panel whose entire content is one question. */
export const PaletteField = React.forwardRef<
  HTMLInputElement,
  { value: string; onValue: (next: string) => void; placeholder: string }
>(({ value, onValue, placeholder }, ref) => (
  <div className="ws-cmdk-field">
    <Icon name="search" />
    <input
      ref={ref}
      className="ws-cmdk-input"
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onValue(event.target.value)}
    />
  </div>
));
PaletteField.displayName = "PaletteField";

export const PaletteList = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => (
    <div ref={ref} className="ws-cmdk-list">
      {children}
    </div>
  ),
);
PaletteList.displayName = "PaletteList";

export function PaletteGroup({ children }: { children: React.ReactNode }) {
  return <div className="ws-cmdk-group">{children}</div>;
}

export function PaletteEmpty({ children }: { children: React.ReactNode }) {
  return <p className="ws-cmdk-empty">{children}</p>;
}

/**
 * MATCH HIGHLIGHTING LIVES WITH THE ROW rather than beside it, because `<mark>`
 * has a rule in `shell.css` and a helper that returned markup would let a
 * second call site draw the same highlight differently.
 *
 * It marks the first occurrence only — the query is one run of characters and
 * the row exists to be recognised at a glance, not to be audited.
 */
function marked(label: string, query: string): React.ReactNode {
  const needle = query.trim();
  if (!needle) return label;
  const at = label.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return label;
  return (
    <>
      {label.slice(0, at)}
      <mark>{label.slice(at, at + needle.length)}</mark>
      {label.slice(at + needle.length)}
    </>
  );
}

export function PaletteRow({
  icon,
  label,
  query,
  where,
  selected,
  disabled,
  onRun,
  onPoint,
}: {
  icon: IconName;
  label: string;
  /** What is highlighted inside the label. */
  query: string;
  /** The room this lives in — or, on a row that cannot act, the reason. */
  where?: string;
  selected?: boolean;
  disabled?: boolean;
  onRun: () => void;
  /** THE POINTER MOVES THE SELECTION RATHER THAN PAINTING BESIDE IT. A palette
   *  has exactly one row Return will run, and a hover highlight that is not
   *  that row is a second answer to the only question the surface asks. */
  onPoint: () => void;
}) {
  return (
    <button
      type="button"
      className="ws-cmdk-row"
      /* `aria-current`, not `aria-selected`: the row is a button and stays one.
         `role="option"` would take the button role away from a control whose
         whole job is to be pressed, and a listbox is a chooser rather than a
         run-this list. `aria-current="true"` is valid on any element and says
         the one true thing — this is the row Return will take. */
      aria-current={selected ? "true" : undefined}
      data-sel={selected ? "" : undefined}
      disabled={disabled}
      onClick={onRun}
      onMouseMove={onPoint}
    >
      <Icon name={icon} />
      <span className="ws-grow">{marked(label, query)}</span>
      {where && <span className="ws-where">{where}</span>}
    </button>
  );
}

/** Fixed content, because it is the drawing rather than a configuration: three
 *  keys, in the order the hand uses them. */
export function PaletteFoot() {
  return (
    <div className="ws-cmdk-foot">
      <span className="ws-k">
        <kbd>↑</kbd>
        <kbd>↓</kbd> move
      </span>
      <span className="ws-k">
        <kbd>↵</kbd> open
      </span>
      <span className="ws-k">
        <kbd>esc</kbd> close
      </span>
    </div>
  );
}
