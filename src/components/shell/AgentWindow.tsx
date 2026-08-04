import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * THE AGENT WINDOW — `demo.js`'s `agentWindow()`.
 *
 * Fourth member of the window family — Ask, the meeting HUD, Actions, this —
 * with the same chrome, the same OS-drawn decoration (ADR 0003) and the same
 * resize grip. Everything agent-specific lives here and NOTHING of it lives on
 * the pill.
 *
 * This is where ADR 0030's two halves land, and the split it names is the
 * window's layout rather than two wings on a pill: space on the left (targets,
 * their state, what is unread), time on the right (the thread, and the answer
 * window at its foot). On a pill that split cost 1038 px of always-on-top
 * furniture. In a window it costs nothing until you open it, which is the
 * correction.
 *
 * THE RAIL IS ONE PROCESS, NOT THREE AGENTS — ADR 0043. Three rows, three
 * status dots and three names said nothing about the one process driving all of
 * them, and ADR 0030 is built on that being one process: it is WordScript's only
 * client, the agents it starts get no entry of their own, and for them IT is the
 * human. The fix is not a sentence — the orb sits at the head of the rail as the
 * identity the rail belongs to, and the targets are indented under it, the same
 * relationship the connection block draws for accounts under a provider.
 */
export function AgentStage({ children }: { children: ReactNode }) {
  return <div className="ws-agw-stage">{children}</div>;
}

export function AgentWindow({ children }: { children: ReactNode }) {
  return (
    <div className="ws-agw">
      {children}
      <span className="ws-hud-resize" aria-hidden />
    </div>
  );
}

export function AgentBody({ children }: { children: ReactNode }) {
  return <div className="ws-agw-body">{children}</div>;
}

export function AgentRail({ children }: { children: ReactNode }) {
  return <div className="ws-agw-rail">{children}</div>;
}

export function AgentRailHead({
  orb,
  name,
  sub,
}: {
  orb: ReactNode;
  name: string;
  sub: string;
}) {
  return (
    <div className="ws-agw-rail-head">
      {orb}
      <b>{name}</b>
      <span className="ws-agw-rail-sub">{sub}</span>
    </div>
  );
}

export function AgentRailLabel({ children }: { children: ReactNode }) {
  return (
    <div className="ws-agw-rail-label">
      <label>{children}</label>
    </div>
  );
}

export function AgentTargets({ children }: { children: ReactNode }) {
  return <div className="ws-agw-targets">{children}</div>;
}

export function AgentTarget({
  dot,
  name,
  role,
  unread,
  state,
  current,
}: {
  dot: ReactNode;
  name: string;
  role: string;
  /** A count bubble is one of the few things that stays round: it is a disc
   *  with a digit in it, not a label with a rectangle around it. */
  unread?: string;
  state: string;
  current?: boolean;
}) {
  return (
    <button type="button" className="ws-agw-target" aria-current={current ? "true" : "false"}>
      {dot}
      <span className="ws-agw-target-text">
        <b>{name}</b>
        <span>{role}</span>
      </span>
      {unread && <span className="ws-agw-unread">{unread}</span>}
      <span className="ws-agw-target-state">{state}</span>
    </button>
  );
}

export function AgentRailFoot({ children }: { children: ReactNode }) {
  return <div className="ws-agw-rail-foot">{children}</div>;
}

/** The small text-and-glyph control the rail's foot and the dash both use. */
export function OverlayMiniButton({
  icon,
  children,
}: {
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <button type="button" className="ws-ovp-mini">
      <Icon name={icon} />
      {children}
    </button>
  );
}

export function AgentMain({ children }: { children: ReactNode }) {
  return <div className="ws-agw-main">{children}</div>;
}

export function AgentMainHead({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="ws-agw-main-head">
      <b>{name}</b>
      <span>{meta}</span>
    </div>
  );
}

export function AgentThread({ children }: { children: ReactNode }) {
  return <div className="ws-agw-thread">{children}</div>;
}

/**
 * A completion message is not a question and must not read like one: the thread
 * carries both, so the eye has to sort them without reading them.
 */
export function AgentMessage({
  from,
  when,
  options,
  children,
}: {
  from: "ws" | "done";
  when: string;
  options?: string[];
  children: ReactNode;
}) {
  return (
    <div className="ws-agw-msg" data-from={from}>
      <p>
        {from === "done" && <Icon name="check" />}
        {children}
      </p>
      {options && (
        <div className="ws-agw-opts">
          {options.map((option) => (
            <button key={option} type="button" className="ws-agw-opt">
              {option}
            </button>
          ))}
        </div>
      )}
      <span className="ws-agw-when">{when}</span>
    </div>
  );
}

/** The answer window is open because the question opened it, and it closes
 *  itself. It is the pane's foot rather than a message in the thread: a thing
 *  that is counting down is state. */
export function AgentAnswer({ meter, left }: { meter: ReactNode; left: string }) {
  return (
    <div className="ws-agw-answer">
      <Icon name="mic" />
      {meter}
      <span>Answer window</span>
      <span className="ws-agw-answer-left">{left}</span>
    </div>
  );
}

/**
 * THE DASH — a strip across the foot, and the only place in the product where
 * the machine's own voice is drawn. It is at the foot rather than in the thread
 * because it is a STATE of the window, not an entry in it: what is being said
 * right now is already the last message above, and repeating it as a second
 * bubble would double every question. The strip says who is speaking and how
 * loudly; the thread says what was said.
 */
export function AgentVoice({
  orb,
  what,
  meta,
  action,
}: {
  orb: ReactNode;
  what: string;
  meta: string;
  action: ReactNode;
}) {
  return (
    <div className="ws-agw-voice" data-speaking>
      {orb}
      <span className="ws-agw-voice-text">
        <b>Speaking</b>
        <span>{what}</span>
      </span>
      <span className="ws-agw-voice-meta">{meta}</span>
      {action}
    </div>
  );
}

/* ── The notification ─────────────────────────────────────────────────────── */

export function AgentPopupStage({ children }: { children: ReactNode }) {
  return <div className="ws-agpop-stage">{children}</div>;
}

/**
 * ADR 0043. Same orb, one size up, and nothing else on it but the question and
 * the way out of it. It is WordScript's own always-on-top window rather than an
 * OS notification, because `await` blocks the calling agent until the answer
 * budget expires and a question nobody saw is the one failure this surface may
 * not have: Focus mode and screen sharing suppress OS notifications, and a
 * screen share is when an agent is most likely to be running.
 *
 * The two answer buttons are the ones the agent offered. A question with options
 * never needs the window opened, which is what keeps this small.
 */
export function AgentPopup({
  orb,
  from,
  question,
  options,
  aloud,
  meta,
}: {
  orb: ReactNode;
  from: string;
  question: string;
  options: string[];
  aloud: string;
  meta: string;
}) {
  return (
    <div className="ws-agpop">
      <div className="ws-agpop-orb">{orb}</div>
      <div className="ws-agpop-body">
        <span className="ws-agpop-from">{from}</span>
        <p>{question}</p>
        <div className="ws-agpop-opts">
          {options.map((option) => (
            <button key={option} type="button" className="ws-agw-opt">
              {option}
            </button>
          ))}
          {/* Not a button-shaped thing, because pressing it starts listening
              rather than sending an answer. */}
          <button type="button" className="ws-agpop-more">
            <Icon name="mic" />
            {aloud}
          </button>
        </div>
        <span className="ws-agpop-meta">
          <Icon name="volume" />
          {meta}
        </span>
      </div>
      <button type="button" className="ws-agpop-x" aria-label="Dismiss">
        <Icon name="x" />
      </button>
    </div>
  );
}

/**
 * THE MODE CYCLE. The same rule the sub-tab bar carries before Notes, for the
 * same reason: what follows the rule is reachable from this control and is not a
 * member of the category the control is named after. `Agent` is a delivery
 * target (ADR 0030) and `delivery = agent` makes the mode axis vacuous, so the
 * pill shows `Agent` where a mode would otherwise stand — reachable by cycling
 * the mode, while not being a mode.
 */
export function ModeCycle({ modes, after }: { modes: string[]; after: ReactNode }) {
  return (
    <div className="ws-cycle">
      {modes.map((mode) => (
        <span key={mode} className="ws-cycle-item">
          {mode}
        </span>
      ))}
      <span className="ws-cycle-rule" aria-hidden />
      {after}
    </div>
  );
}

export function ModeCycleItem({
  icon,
  on,
  children,
}: {
  icon?: IconName;
  on?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="ws-cycle-item" data-on={on ? "" : undefined}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}
