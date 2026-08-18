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
 *
 * THE BUTTON IS NOW A LAYER BEHIND THE VIEW RATHER THAN A WRAPPER AROUND IT
 * (ADR 0183). The calendar grew controls of its own — a period picker, two
 * arrows, a scroller — and interactive content inside a `<button>` is invalid
 * and behaves like it: every press of an arrow would also swap the view. So the
 * hit area is a sibling that fills the block, the view is painted over it, and
 * only the controls take pointer events back. What is left over — the margins,
 * the grid, the foot, the whole counter view — still swaps on a click, which is
 * the affordance decision 9 asked for.
 */
export function HomeSwitch({
  calendar,
  detail,
  onToggle,
  onSelect,
  children,
}: {
  calendar: boolean;
  /** A metric is open (ADR 0235). The block still holds the dots, and it holds
   *  NOTHING that swaps on a background click: a reader who opened a detail did
   *  not ask to be taken to the calendar by pointing at the white space around
   *  the chart. The way back is the control in the detail's own head. */
  detail?: boolean;
  onToggle: () => void;
  /** Pick a view outright rather than flipping to the other one. The dots call
   *  it; the block's own hit area still toggles. */
  onSelect?: (calendar: boolean) => void;
  children: ReactNode;
}) {
  const select = (next: boolean) => {
    if (onSelect) return onSelect(next);
    if (next !== calendar) onToggle();
  };
  return (
    <div className="ws-home-switch">
      <div className="ws-home-switch-face">
        {/* NO `title`. It was on the wrapping button and was one tooltip on one
            object; as a full-bleed layer it is a tooltip that follows the cursor
            across the whole block — including over the calendar, where it sits
            on top of the day panel the reader actually asked for. The label
            stays: a screen reader still needs to be told what pressing this
            does, and nothing else on the layer says it. */}
        {!detail && (
          <button
            type="button"
            className="ws-home-switch-hit"
            onClick={onToggle}
            aria-label={calendar ? "Show the counters" : "Show the activity calendar"}
          />
        )}
        {/* Painted over the hit area and transparent to the pointer. The
            stylesheet gives pointer events back to the few things inside that
            have their own answer to a click — the calendar's cells, its
            scroller, its picker and its arrows, and the whole of each counter
            tile, which carries the tooltip that explains it (ADR 0186).

            SO THE COUNTER VIEW SWAPS FROM HERE RATHER THAN FROM UNDERNEATH. A
            tile that takes the pointer is a tile a click no longer falls
            through, and the tiles are most of that view; this layer catches
            what they intercepted and does the same thing the hit area would
            have. ONLY IN THAT VIEW: in the calendar the cells, the picker and
            the arrows all bubble through here too, and a handler on this
            element would swap the view on every arrow press — which is the
            exact defect ADR 0183 took the wrapping `<button>` apart to fix. */}
        <div
          className="ws-home-switch-body"
          data-swaps={calendar || detail ? undefined : ""}
          onClick={calendar || detail ? undefined : onToggle}
        >
          {children}
        </div>
      </div>
      {/* THE DOTS ARE THE CONTROL NOW, NOT A PICTURE OF ONE (ADR 0184).
          They were `aria-hidden` decoration beside a block you had to know was
          clickable — the discoverability of the whole arrangement rested on a
          reader trying a click on something that looks like a read-out. Two
          buttons, each SELECTING its view rather than toggling: with exactly two
          states, "go to the calendar" is a shorter thought than "go to the other
          one", and pressing the dot you are already on does nothing rather than
          bouncing you away.

          Still five pixels of ink, and a hit area of twenty-two: the indicator
          is the smallest thing on the block and may not become the loudest just
          because it can be pressed. */}
      {/* THE DOTS NAME THEIR VIEW; THE BLOCK BEHIND THEM NAMES THE MOVE. Two
          controls with the same accessible name would be announced twice and
          read as a duplicate, so the pair here is `Counters` / `Activity
          calendar` with the current one pressed — which is what a group of two
          alternatives is — and the hit area keeps `Show the …`, because that is
          a swap rather than a choice. */}
      <span className="ws-home-dots" role="group" aria-label="Which view">
        <button
          type="button"
          onClick={() => select(false)}
          aria-label="Counters"
          title="Counters"
          aria-pressed={!calendar}
        >
          <i data-on={calendar ? undefined : ""} />
        </button>
        <button
          type="button"
          onClick={() => select(true)}
          aria-label="Activity calendar"
          title="Activity calendar"
          aria-pressed={calendar}
        >
          <i data-on={calendar ? "" : undefined} />
        </button>
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
  /** Digits to the right of the point (ADR 0191). One tile needs it and the
   *  rest are whole numbers; it is on the tile rather than in the counter's
   *  defaults because the unit is the caller's fact. */
  decimals?: number;
  ariaLabel: string;
  /** WHAT THE FIGURE WAS COMPUTED OVER. Not a caption: `capture_integrity` is
   *  null on a retry and on every record older than the measurement, so a rate
   *  that did not say which records it saw is a plausible wrong number. */
  foot: ReactNode;
  /** The long form, on hover — the baseline a figure assumes, or the field a
   *  drawn tile is waiting for.
   *
   *  IT IS ON THE TILE AND NOT ON THE LABEL (ADR 0186). The label is one line of
   *  small caps at the top of a 150 px column, so a hover that only answered
   *  there answered almost nowhere: a reader pointing at the FIGURE — which is
   *  the thing they are asking about — got nothing, and reported the tooltips as
   *  broken. The whole tile is the object; the whole tile explains itself. */
  title?: string;
  /** Opens this metric's own view of the block (ADR 0235). A tile with one is a
   *  `<button>`; a tile without one stays the `<div>` it always was, because a
   *  control that does nothing is worse than a read-out that says so. */
  onOpen?: () => void;
}

export function StatTile({
  label,
  tag,
  value,
  decimals,
  ariaLabel,
  foot,
  title,
  onOpen,
}: StatTileProps) {
  const body = (
    <>
      <span className="ws-tile-label">
        {label}
        {tag}
      </span>
      <DigitCounter value={value} decimals={decimals} ariaLabel={ariaLabel} />
      <span className="ws-tile-foot">{foot}</span>
    </>
  );

  if (!onOpen) return <div className="ws-tile" title={title}>{body}</div>;

  /* NO `aria-label` ON THE BUTTON, and that is deliberate. One would REPLACE the
     name computed from the contents, and the contents are where the counter's
     own reading is announced — a tile that says "Time saved, open the detail"
     and not what it reads is a worse object for a screen reader than a verbose
     one.

     THE CLICK STOPS HERE. The layer behind the counter view swaps to the
     calendar on anything that reaches it (ADR 0183), and it has to keep doing
     that for the background; a tile that opens its own view may not also change
     the view underneath it on the way. */
  return (
    <button
      type="button"
      className="ws-tile"
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      {body}
    </button>
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
