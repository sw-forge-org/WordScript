import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

export type NoteTone = "info" | "check" | "alert" | "eye";

/** The four tones Leg 1 named, resolved onto the prototype's own icon set.
 *  `info` is `about`, which is `note()`'s default when no icon is passed. */
const TONE_ICON: Record<NoteTone, IconName> = {
  info: "about",
  check: "check",
  alert: "alert",
  eye: "eye",
};

/**
 * A FACT ABOUT THE THING ABOVE IT, on the window rather than in a card.
 *
 * The glyph is `--fg-muted` in every tone, and so is the note — a coloured
 * paragraph under a card is a second alert competing with whatever the card
 * itself is saying. `alert` marks a note that names a defect, `check` one that
 * names a property that holds, and `eye` one that reports something that was
 * looked at.
 *
 * `icon` IS THE PROTOTYPE'S ACTUAL PARAMETER and `tone` is the four-value
 * shorthand over it. `demo.js`'s `note(text, iconName, tail)` takes any name in
 * the set — `privacy`, `keyboard`, `models`, `calendar`, `ruler`, `volume` —
 * and a note whose glyph names its subject is doing work a generic info dot
 * cannot. Leg 1 built the shorthand before any screen that needed the general
 * form existed; both are here now and neither call site repeats a mapping,
 * which is ADR 0052's whole subject.
 *
 * `tail` is the link after the prose. It is navigation rather than prose, which
 * is why the prototype keeps it out of the sentence and out of the copy budget.
 */
export function Note({
  tone = "info",
  icon,
  tail,
  className,
  children,
}: {
  tone?: NoteTone;
  icon?: IconName;
  tail?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("ws-note", className)}>
      <Icon name={icon ?? TONE_ICON[tone]} />
      <span>
        {children}
        {tail && <> {tail}</>}
      </span>
    </p>
  );
}

/**
 * A link inside prose. `demo.js`'s `docLink()` — raw HTML appended after the
 * sentence, deliberately not escaped and deliberately not counted, because a
 * link is navigation and not prose.
 */
export function DocLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      className="ws-link"
      href="#"
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}
