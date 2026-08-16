import type { ReactNode } from "react";
import { DigitCounter } from "./DigitCounter";

/**
 * HOME'S OPENING BLOCK — `demo.js`'s `homeHero()`, and the first surface to
 * leave the drawing behind.
 *
 * Replaces `ViewTop` on Home, and only on Home. Every other view keeps the
 * title-and-lead header, because every other view is a place you navigated to
 * on purpose and already know the name of. Home is the one you land on, and
 * what it owes you on landing is not its own name.
 *
 * WHAT USED TO BE IN IT, AND WHY IT IS NOT. This block's own note read: *No
 * metric, no count, no ring, no "3 dictations today". The product does not have
 * a number worth that position — the thing worth that position is the shortcut.*
 * Both halves were right when they were written and both have since stopped
 * being true.
 *
 * The shortcut was worth that position **once**. AN INSTRUCTION IS READ EXACTLY
 * ONCE, and after the first day the most prominent surface in the product was
 * spent on a sentence nobody reads again — while the reader had no idea what the
 * tool had actually done for them. And the product does now have numbers:
 * `TranscriptionHistoryEntry` carries words, a capture clock, insert outcomes
 * and timestamps, and nothing read them.
 *
 * SO THE BLOCK HAS TWO LIVES. `HeroInvoke` is the state before the first
 * measured dictation; `HomeDisplay` is the state after. The same surface, and
 * never both — a zero in a counter does not read as *nothing yet*, it reads as
 * *broken*, so a fresh profile is shown the instruction rather than four
 * zeroes. The shortcut keeps a permanent home in `HeroFacts` below, at the size
 * a sentence can hold it.
 */
export function HomeOpen({ children }: { children: ReactNode }) {
  return <section className="ws-home-open">{children}</section>;
}

/**
 * THE INSTRUCTION. What the product is and how it is started, for the reader who
 * has not started it yet.
 *
 * It carried two 42 px caps until the display existed. They are gone with the
 * `KeyCap` component and the style block that drew them: a physical cap is the
 * right object for a surface whose whole job is *press this*, and the wrong one
 * for a surface that has to give the position up as soon as it has been read.
 */
export function HeroInvoke({ title, description }: { title: string; description: string }) {
  return (
    <div className="ws-hero-invoke">
      <span className="ws-what">
        <b>{title}</b>
        <span>{description}</span>
      </span>
    </div>
  );
}

/**
 * THE DISPLAY. Four counters that read left to right as one sentence: this is
 * how fast you speak, this is what it gives you back, everywhere, in these
 * languages.
 *
 * They are allowed to be slow-moving, and that is the arrangement rather than a
 * shortcoming: the day-by-day movement belongs to the activity calendar this
 * block will also carry, and everything day-scoped belongs in that calendar's
 * hover. The tiles answer a different question — not *what did you do*, but
 * *who are you, averaged*.
 */
export function HomeDisplay({ children }: { children: ReactNode }) {
  return <div className="ws-home-display">{children}</div>;
}

/**
 * THE SWITCH BETWEEN THE TWO VIEWS — decision 9, and it is on the thing rather
 * than in settings.
 *
 * The calendar and the tiles are ALTERNATIVES rather than companions, because
 * they answer two different questions: the calendar is your rhythm, what you did
 * day by day, and the tiles are your character, who you are averaged. Since the
 * calendar carries all the movement, the tiles are allowed to be slow — which
 * was their problem when one block had to do both jobs.
 *
 * SO THE BLOCK ITSELF IS THE CONTROL. Clicking it swaps the view, and a
 * two-dot carousel indicator says there is a second one to find; a settings row
 * for this would put a display preference three screens away from the display.
 *
 * IT IS A `<button>` AND NOT A CLICKABLE `<div>`. The block is the hit area, so
 * the block has to be the thing a keyboard reaches and a screen reader
 * announces. `aria-pressed` is deliberately not used: this is not a control that
 * is on or off, it is one that moves between two named views, so it says which
 * view it will go to.
 */
export function HomeSwitch({
  calendar,
  onToggle,
  children,
}: {
  calendar: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="ws-home-switch">
      <button
        type="button"
        className="ws-home-switch-face"
        onClick={onToggle}
        title={calendar ? "Show the counters" : "Show the activity calendar"}
        aria-label={calendar ? "Show the counters" : "Show the activity calendar"}
      >
        {children}
      </button>
      {/* The indicator is decoration for a control that is already labelled, so
          it is hidden from the accessibility tree rather than announced as two
          more things to press. */}
      <span className="ws-home-dots" aria-hidden="true">
        <i data-on={calendar ? undefined : ""} />
        <i data-on={calendar ? "" : undefined} />
      </span>
    </div>
  );
}

interface StatTileProps {
  label: string;
  /** `PreviewTag` where the reading is drawn (ADR 0161). It sits AT THE LABEL,
   *  which is where a reader looks before they look at the value. */
  tag?: ReactNode;
  /** `null` is no reading, and the counter draws it as a dark display rather
   *  than as a zero. A drawn tile passes `null` and shows no figure at all. */
  value: number | null;
  ariaLabel: string;
  /** WHAT THE FIGURE WAS COMPUTED OVER. Not a caption: `capture_integrity` is
   *  null on a retry and on every record older than the measurement, so a rate
   *  that did not say which records it saw is a plausible wrong number. */
  foot: ReactNode;
  /** The long form, on hover — the baseline a figure assumes, or the field a
   *  drawn tile is waiting for. */
  title?: string;
}

export function StatTile({ label, tag, value, ariaLabel, foot, title }: StatTileProps) {
  return (
    <div className="ws-tile">
      <span className="ws-tile-label" title={title}>
        {label}
        {tag}
      </span>
      <DigitCounter value={value} ariaLabel={ariaLabel} />
      <span className="ws-tile-foot">{foot}</span>
    </div>
  );
}

/**
 * The standing facts, on one line at the foot of the hero. They were a card of
 * their own with a heading, which spent a whole grouping surface on four words
 * that never change while you read them.
 *
 * THE SHORTCUT LIVES HERE NOW. It is the one fact on this line that does not
 * change with the next dictation, and it is first for that reason: the reader
 * who has forgotten which keys to press finds them where the standing facts are,
 * rather than nowhere.
 */
export function HeroFacts({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="ws-hero-facts">
      {children}
      {action && <span className="ws-grow">{action}</span>}
    </div>
  );
}
