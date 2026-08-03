import type { ReactNode } from "react";

/**
 * A physical key, for naming a shortcut the user has to perform rather than
 * read. Home's hero is built on it: "Press Ctrl+Super in any app" is the single
 * most important fact in this product, and it was set as body prose in the
 * colour reserved for things you may skip.
 *
 * Four values do the whole job — a lit top edge, a body gradient falling away
 * from it, a dark front lip below the label, and a cast shadow. The lip is real
 * padding rather than a border, so the cap has a front FACE and not just an
 * outline. That is the part that separates a key from a rounded rectangle with
 * a letter in it.
 */

interface KeycapProps {
  children: ReactNode;
  wide?: boolean;
}

export function Keycap({ children, wide = false }: KeycapProps) {
  return (
    <kbd className="ws-keycap" data-wide={wide ? "" : undefined}>
      {children}
    </kbd>
  );
}

/** A shortcut as it is performed: caps joined by the operator between them. */
export function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="ws-shortcut">
      {keys.map((k, i) => (
        <span key={k} className="contents">
          {i > 0 && <span className="ws-shortcut-plus">+</span>}
          <Keycap wide={k.length > 4}>{k}</Keycap>
        </span>
      ))}
    </span>
  );
}
