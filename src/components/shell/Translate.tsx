import type { ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * THE TRANSLATION WINDOW — `demo.js`'s `SCREENS.translate` drawing.
 *
 * Fifth member of the window family, so it takes `ChatWinDeco` like the other
 * four rather than inventing a header. Wider than the meeting HUD and shorter:
 * this one is read across, not scrolled down.
 *
 * IT IS NOT THE TRANSLATE MODE AND IT IS NOT A SECOND ONE. ADR 0041's mode
 * serves one person writing into somebody else's document. This serves two
 * people talking, and the dictation contract breaks in three places the moment
 * there are two: there is no insert target, the session does not end after one
 * utterance, and the output has to be HEARD rather than pasted.
 */
export function TranslateStage({ children }: { children: ReactNode }) {
  return <div className="ws-trw-stage">{children}</div>;
}

export function TranslateWindow({ children }: { children: ReactNode }) {
  return <div className="ws-trw">{children}</div>;
}

/** The pair, in the deco strip. `German → English` is the window's state read
 *  back where the OS would put a document name. */
export function TranslateDecoPair({ children }: { children: ReactNode }) {
  return <span className="ws-trw-deco-pair">{children}</span>;
}

/**
 * THE PAIR SITS IN THE CHROME. It is the window's entire state and it changes
 * what every other pixel means, so it belongs above the tabs rather than inside
 * whichever one is open. Swap is ONE control and not two selects re-picked:
 * reversing direction is the most frequent thing that happens here and it is
 * not a change of configuration.
 */
export function TranslatePair({
  from,
  to,
  onSwap,
}: {
  from: ReactNode;
  to: ReactNode;
  onSwap?: () => void;
}) {
  return (
    <div className="ws-trw-pair">
      <span className="ws-trw-lang">{from}</span>
      <button
        type="button"
        className="ws-trw-swap"
        aria-label="Swap the two languages"
        onClick={onSwap}
      >
        <Icon name="swap" />
      </button>
      <span className="ws-trw-lang">{to}</span>
    </div>
  );
}

export function TranslateTabs({ children }: { children: ReactNode }) {
  return <div className="ws-trw-tabs">{children}</div>;
}

export function TranslateBody({ children }: { children: ReactNode }) {
  return <div className="ws-trw-body">{children}</div>;
}

/** Source above target. On a 16:9 desktop window side-by-side panes give each
 *  half a 40-character measure, and this is prose. */
export function TranslatePane({
  lang,
  trailing,
  out,
  children,
}: {
  lang: string;
  /** The source's `spoken` mark, or the output's play-and-copy pair. */
  trailing?: ReactNode;
  /** The output is the answer, so it sits on the raised plane and the input
   *  does not — two panes at one elevation read as a form with two fields. */
  out?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ws-trw-pane" data-out={out ? "" : undefined}>
      <div className="ws-trw-pane-head">
        <span>{lang}</span>
        {trailing}
      </div>
      {children}
    </div>
  );
}

export function TranslateSource({ children }: { children: ReactNode }) {
  return (
    <span className="ws-trw-src">
      <Icon name="mic" />
      {children}
    </span>
  );
}

export function TranslateText({ children }: { children: ReactNode }) {
  return <p className="ws-trw-text">{children}</p>;
}

/** The word that could have gone another way, marked in place. Picking a
 *  different one rewrites the sentence around it. */
export function TranslateAlt({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="ws-trw-alt" aria-haspopup="listbox">
      {children}
    </button>
  );
}

export function TranslateAlts({ options, value }: { options: string[]; value: string }) {
  return (
    <div className="ws-trw-alts">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="ws-trw-altopt"
          data-on={option === value ? "" : undefined}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/* ── Conversation ─────────────────────────────────────────────────────────── */

export function TranslateConversation({ children }: { children: ReactNode }) {
  return <div className="ws-trw-conv">{children}</div>;
}

/**
 * Each speaker owns a half and reads only their own language in it — their own
 * words to check they were heard, the other's to understand.
 *
 * WHAT WAS SAID IS SECONDARY AND WHAT WAS HEARD IS PRIMARY, which is the
 * reverse of a transcript and correct here: you already know what you said. The
 * line you need is the one in the other language.
 */
export function TranslateTurn({
  side,
  lang,
  said,
  heard,
}: {
  side: "you" | "them";
  lang: string;
  said: string;
  heard: string;
}) {
  return (
    <div className="ws-trw-turn" data-side={side}>
      <span className="ws-trw-turn-lang">{lang}</span>
      <p className="ws-trw-said">{said}</p>
      <p className="ws-trw-heard">
        <Icon name="translate" />
        <span>{heard}</span>
      </p>
    </div>
  );
}

/**
 * THE LISTENING STRIP IS ONE THING AND NOT TWO BUTTONS. Nobody presses a
 * language button mid-sentence, which is the interaction the references removed
 * and the reason their conversation modes became usable. The strip says which
 * of the two it is currently hearing, and that is a readout rather than a
 * control.
 */
export function TranslateListen({ children }: { children: ReactNode }) {
  return <div className="ws-trw-listen">{children}</div>;
}

/**
 * WHERE EACH TRANSLATION COMES OUT — one row per LANGUAGE, not per device,
 * because the question is "what happens to this language" and the device is the
 * answer to it. Inverted — a device list with languages hung off it — it
 * becomes an audio-settings panel and stops being about the conversation.
 */
export function TranslateRoute({ children }: { children: ReactNode }) {
  return <div className="ws-trw-route">{children}</div>;
}

export function TranslateRouteRow({
  lang,
  who,
  why,
  children,
}: {
  lang: string;
  who: string;
  why: string;
  /** The delivery segment and the device select. */
  children: ReactNode;
}) {
  return (
    <div className="ws-trw-route-row">
      <div className="ws-trw-route-lang">
        <b>{lang}</b>
        <span>{who}</span>
      </div>
      <p className="ws-trw-route-why">{why}</p>
      <div className="ws-trw-route-ctl">{children}</div>
    </div>
  );
}
