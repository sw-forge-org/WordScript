import type { ReactNode } from "react";

/**
 * HOME'S OPENING BLOCK — `demo.js`'s `homeHero()`.
 *
 * Replaces `ViewTop` on Home, and only on Home. Every other view keeps the
 * title-and-lead header, because every other view is a place you navigated to
 * on purpose and already know the name of. Home is the one you land on, and
 * what it owes you on landing is not its own name.
 *
 * WHAT IS NOT IN IT. No metric, no count, no ring, no "3 dictations today".
 * The product does not have a number worth that position — the thing worth that
 * position is the shortcut, because the shortcut is how the product is used and
 * it is used from inside another application.
 */
export function HomeOpen({ children }: { children: ReactNode }) {
  return <section className="ws-home-open">{children}</section>;
}

/**
 * A PHYSICAL CAP, not a graphic of one. Lit top edge, a body falling away from
 * it, a front lip below the label and a cast shadow — because the thing being
 * named is a physical act.
 *
 * This is not `Keycaps`. That draws a shortcut inside a sentence at 20 px; this
 * is the object Home is built around, at 42.
 */
export function KeyCap({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <kbd className="ws-keycap" data-wide={wide ? "" : undefined}>
      {children}
    </kbd>
  );
}

export function HeroInvoke({
  keys,
  title,
  description,
}: {
  keys: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="ws-hero-invoke">
      <span className="ws-hero-keys">{keys}</span>
      <span className="ws-what">
        <b>{title}</b>
        <span>{description}</span>
      </span>
    </div>
  );
}

/**
 * The standing facts, on one line at the foot of the hero. They were a card of
 * their own with a heading, which spent a whole grouping surface on four words
 * that never change while you read them.
 */
export function HeroFacts({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="ws-hero-facts">
      {children}
      {action && <span className="ws-grow">{action}</span>}
    </div>
  );
}
