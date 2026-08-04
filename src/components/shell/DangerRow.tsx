import * as React from "react";
import { Row } from "./Card";

interface DangerRowProps {
  label: React.ReactNode;
  /** What it destroys, and what it leaves alone. One line. */
  hint?: React.ReactNode;
  /** The destructive control. */
  action: React.ReactNode;
  className?: string;
}

/**
 * A DESTRUCTIVE ACTION, RED, LAST IN ITS CARD. Plan §5.3.
 *
 * The tone lives on the label and on the control, not on the row's ground. A
 * red surface under a settings row is a warning about the row, which is wrong —
 * the row is fine, and it is pressing the button that cannot be undone.
 *
 * NO COLOURED EDGE BAR, EVER (§11.17). A vertical accent rule down the side of
 * a notice is a web convention that reads as a rendering defect at this scale;
 * emphasis is the ground plus an icon tile. That rule was ruled out by review
 * on 2026-08-03 for the action strip and for every component after it, and this
 * is the component most likely to want one.
 */
export function DangerRow({ label, hint, action, className }: DangerRowProps) {
  return <Row danger label={label} hint={hint} control={action} className={className} />;
}
