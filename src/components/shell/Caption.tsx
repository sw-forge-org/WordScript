import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * THE CAPTION STRIP — `demo.js`'s `captionBar()`.
 *
 * Its own always-on-top strip, wide and short, sitting where the user drags it
 * — over the bottom of a video, usually. It is NOT the dictation overlay
 * wearing a hat: that one is 440 × 60 and parked by the native host, and a
 * caption strip has to be as wide as the reading measure of two lines.
 *
 * THE STRIP CARRIES ITS OWN GROUND. A frame can go white mid-sentence and the
 * caption has to survive the cut, so the ground is part of the component and
 * never borrowed from what is behind it. Frost is excluded for the same reason
 * ADR 0051 excludes it: the surface it would sample belongs to somebody else's
 * player.
 */
export function CaptionStage({ children }: { children: ReactNode }) {
  return <div className="ws-cap-stage">{children}</div>;
}

/** A stand-in for "something is playing under this". Deliberately abstract: a
 *  screenshot of a real video would be read as a supported integration. */
export function CaptionScene({
  tag,
  tagIcon,
  light,
  children,
}: {
  tag: string;
  tagIcon: IconName;
  light?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ws-cap-scene" data-light={light ? "" : undefined}>
      <span className="ws-cap-scene-tag">
        <Icon name={tagIcon} />
        {tag}
      </span>
      {children}
    </div>
  );
}

export function CaptionBar({
  lang,
  tone,
  children,
}: {
  /** Shown only when a language pair is set — the translation, not a second
   *  window and not a second feature. */
  lang?: string;
  /** The bright-frame case is the same component with the pair inverted, which
   *  is what "the colour follows the contrast" means in practice. */
  tone?: "light";
  children: ReactNode;
}) {
  return (
    <div className="ws-cap-bar" data-tone={tone}>
      {lang && <span className="ws-cap-lang">{lang}</span>}
      <p className="ws-cap-text">{children}</p>
    </div>
  );
}

/**
 * THE ECHO — your own voice, under the pill, while you are dictating it.
 *
 * NO CARD, NO GROUND, NO BORDER. It is a trace of the pill rather than a second
 * surface: give it a panel and it becomes a window that has to be positioned,
 * dismissed and reasoned about, and the dictation overlay's whole discipline is
 * that it is one small object that does not grow.
 *
 * `done` is what the recogniser has committed and `live` is the tail that is
 * still moving. Without the split you re-read the whole line every time it
 * changes, which is worse than no echo.
 */
export function EchoWrap({ children }: { children: ReactNode }) {
  return <div className="ws-echo-wrap">{children}</div>;
}

export function EchoText({ done, live }: { done: string; live: string }) {
  return (
    <p className="ws-echo-text">
      <span className="ws-echo-done">{done}</span>
      <span className="ws-echo-live">{live}</span>
    </p>
  );
}
