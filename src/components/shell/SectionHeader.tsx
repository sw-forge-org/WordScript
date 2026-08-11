import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: React.ReactNode;
  /** One line. Anything longer belongs in `docs/`. HOW LONG "one line" IS
   *  DEPENDS ON THE `action` BESIDE IT: this paragraph shares its row with the
   *  section's action, so Leg 11 measured it between 131 px (23 characters) and
   *  444 px (about 70) on the shipped surfaces. The 90 this said until then was
   *  never measured and is wrong in both directions — quote the budget with the
   *  action, or measure the section. */
  description?: React.ReactNode;
  /** A control that acts on the whole section — a count, a sub-tab row, a link. */
  action?: React.ReactNode;
  /** The section's blocks. Given children, the header renders the section too. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * A section title and its one line, OUTSIDE the card.
 *
 * `FormCard`'s inline header is kept for the head of a single card; this is the
 * head of a group of them, which is why it sits on the window rather than on a
 * surface. Plan §5.3.
 *
 * It renders the section when it is given children rather than only the head,
 * because the 12 px head-to-body rhythm and the `--gap-row` between blocks are
 * design-system values and a screen that assembles them by hand is a screen
 * that will assemble them differently on the next screen. That is the shape of
 * the failure §11.17 records.
 */
export function SectionHeader({
  title,
  description,
  action,
  children,
  className,
}: SectionHeaderProps) {
  const head = (
    <div className="ws-sec-head">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="ws-sec-action">{action}</div>}
    </div>
  );

  if (children === undefined) {
    return <div className={className}>{head}</div>;
  }

  return (
    <section className={cn("ws-sec", className)}>
      {head}
      <div className="ws-sec-body">{children}</div>
    </section>
  );
}
