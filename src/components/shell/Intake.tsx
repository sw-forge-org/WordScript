import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { MicButton } from "./FloatBar";

/**
 * THE INTAKE — `demo.js`'s `contextIntake`, and §11.24's two equal ways in.
 *
 * THE FAULT THIS SHAPE CORRECTS. Pressing `+` used to land straight in a
 * dropzone. That made importing an existing recording the definition of "add
 * something", and it is the rarest of the ways material arrives: most of what
 * enters the list is something you are about to say or type. Merging Notes into
 * Context had quietly deleted the plainest thing the old Notes could do — make
 * an empty note and start writing in it — because the merge kept Upload's
 * screen and dropped Notes'.
 *
 * So three ways in, and they are genuinely three: each produces a different
 * object from a different source and the controls under them have nothing in
 * common. `Write` is the default because it is the cheapest and the most
 * frequent; an intake whose default is its rarest case makes the common case
 * feel like the exception.
 */

/**
 * A dropzone with a queue below it is a band, not a hero. Upload was built as
 * one centred 460 px column, which is right for an empty Upload and wrong the
 * moment a file is in it: the rows carry a name, a size, a status and a
 * transcript, and 460 px squeezed all four into a column two words wide.
 */
export function DropZone({
  band,
  title,
  hint,
  onClick,
  onFile,
  accept,
}: {
  band?: boolean;
  title: string;
  hint: ReactNode;
  onClick?: () => void;
  /**
   * THE FILE ITSELF, WHERE A CALLER WANTS IT (B7).
   *
   * **Its only consumer today reads `size` and nothing else.** ADR 0129's
   * picker greys a vendor that cannot take this many bytes, and a size cannot
   * be known before there is a file — so without this the constraint is built
   * and permanently unobservable, which is a guard nobody can trust.
   *
   * Reading the file, transcribing it and producing an object is the context
   * object track's C2, not this. The drawing does not change: the input is
   * `display: none` behind the same button.
   */
  onFile?: (file: File) => void;
  accept?: string;
}) {
  const text = (
    <>
      <b>{title}</b>
      <span>{hint}</span>
    </>
  );

  const zone = (
    <button type="button" className="ws-dropzone" data-band={band ? "" : undefined} onClick={onClick}>
      <Icon name="upload" />
      {band ? <span className="ws-dz-text">{text}</span> : text}
    </button>
  );

  if (!onFile) return zone;

  /* A label wrapping the button rather than a click handler reaching for a ref:
     the element already carries the picker, the keyboard behaviour and the
     accessibility contract. The button keeps `type="button"` so it does not
     submit anything it happens to stand inside. */
  return (
    <label className="ws-dropzone-pick">
      <input
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {zone}
    </label>
  );
}

/**
 * Two ways in, one block. Built as two stacked cards they read as a primary
 * and a fallback, and which one is which changes with whoever laid them out;
 * side by side with a rule and the word "or" between them, neither is
 * subordinate and the choice is stated rather than implied. The dropzone keeps
 * the larger share (3:2) because dropping is the gesture the screen is named
 * after, not because linking is a lesser intake.
 */
export function Intake({ children }: { children: ReactNode }) {
  return <div className="ws-intake">{children}</div>;
}

/** The rule and its word. `or` sits on the window plane so the line appears to
 *  pass behind it rather than to stop at a box. */
export function IntakeOr({ children = "or" }: { children?: ReactNode }) {
  return (
    <div className="ws-intake-or">
      <span>{children}</span>
    </div>
  );
}

export function IntakeLink({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ws-intake-link">
      <label className="ws-intake-link-label">
        <Icon name="link" />
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Record: one target, big enough to be the answer to "how do I start one".
 * Deliberately almost empty — everything about a live capture belongs to the
 * window that runs it, and a second copy of those controls here would make this
 * the place a meeting is configured and the HUD the place it is watched, which
 * is one decision in two rooms.
 */
export function RecStart({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="ws-rec-start">
      <MicButton label="Start recording" big />
      <b>{title}</b>
      <p>{children}</p>
      <div className="ws-rowflex">{actions}</div>
    </div>
  );
}
