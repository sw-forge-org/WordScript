import { invoke } from "@tauri-apps/api/core";
import { useState, type ReactNode } from "react";
import type { AppConfig } from "@/types/ipc";
import {
  buildTextProfilesPatch,
  cloneTextProfile,
  displayTextProfileLabel,
  PROFILE_LOCKED_HINT,
  PROFILE_LOCKED_LINE,
  resolveActiveTextProfile,
  textProfileInitials,
} from "@/lib/textProfiles";
import { Icon } from "./Icon";
import { useNavCollapsed } from "./Nav";

interface ProfileSwitcherProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  /** One line under the name. The caller states what the profile is doing —
   *  facts it reads from the runtime, never facts this component invents. */
  subtitle?: ReactNode;
  /** True while a capture or its pipeline is running. */
  sessionActive?: boolean;
  /**
   * WHICH GROUND IT IS DRAWN ON, not which control it is. `nav` is the
   * sidebar's footer row; `sheet` is the settings header's, which is shorter
   * and carries no sub-line because the header has no room for one. The
   * mechanism, the refusal and the runtime call are identical — that is the
   * whole point of the prop existing instead of a second component.
   */
  variant?: "nav" | "sheet";
}

/**
 * WHY THE PICKER WILL NOT MOVE, IN THREE WORDS ON THE ROW AND A SENTENCE ON THE
 * HOVER (ADR 0196).
 *
 * It was one string doing both jobs, and it was a paragraph:
 *
 * > Locked while recording — the profile sets the recognizer, which is fixed
 * > once a recording starts. The processing mode can still be changed.
 *
 * Thirty words printed UNDER THE SIDEBAR ROW, in a 200 px column, for the whole
 * duration of every recording — four wrapped lines of explanation standing under
 * a control nobody is trying to press, at the exact moment the reader is talking
 * and not reading. What a locked control has to say in that position is THAT it
 * is locked; why is a question somebody asks afterwards, and a tooltip is where
 * afterwards lives.
 *
 * Same rule the counters' tooltips were cut to (ADR 0186) and the same one that
 * took the recited foot off History (ADR 0184): a surface states the fact and
 * offers the reason. It does not recite the reason at somebody who did not ask.
 *
 * BOTH STRINGS LIVE IN `lib/textProfiles` (ADR 0197), because the Profiles row
 * menu now refuses the same switch for the same reason and a second copy of a
 * refusal is a second refusal to keep in step with the runtime.
 */
const LOCKED_LINE = PROFILE_LOCKED_LINE;
const LOCKED_HINT = PROFILE_LOCKED_HINT;

/**
 * THE ACTIVE PROFILE — `demo.css`'s `.nav-profile`, ported by Leg 3.
 *
 * THE ROW IS THE CONTROL. What shipped was an avatar row, a label and a
 * separate `<select>` underneath it — two controls for one decision, plus a
 * chevron button that went somewhere else. The prototype answers with one macOS
 * popup button, which is what the double chevron announces, and it is the same
 * control in the workspace sidebar and in the settings sheet's header.
 *
 * THE PROTOTYPE DRAWS A `<button>` AND THIS IS A `<select>`, because the
 * prototype is static HTML and a drawing of a popup button does not have to
 * open. A real one does, and the native control is the one that already answers
 * the keyboard, the screen reader and the platform's own menu behaviour —
 * building a listbox to look identical would be a worse answer to a solved
 * problem. It is the same divergence the ported slider already carries, and
 * `.ws-nav-profile` is what makes the two look alike.
 */
export function ProfileSwitcher({
  config,
  onChange,
  subtitle,
  sessionActive = false,
  variant = "nav",
}: ProfileSwitcherProps) {
  const profiles = config.text_profiles?.length
    ? config.text_profiles.map((profile) => cloneTextProfile(profile))
    : [resolveActiveTextProfile(config)];
  const active = resolveActiveTextProfile(config);
  /* IN THE RAIL THE ROW IS THE AVATAR, and the two things it stops saying are
     said by the tooltip instead — which profile is active, and why it cannot be
     switched right now. Dropping the lock sentence without replacing it would
     leave a control that silently refuses, which is the failure `[data-locked]`
     was added to prevent. */
  const collapsed = useNavCollapsed();
  const railTitle = sessionActive
    ? `${active.label} — ${LOCKED_HINT}`
    : `${active.label} — switch the active profile`;

  /* A REFUSAL THE USER CAN SEE. `.catch(() => {})` stood here, and it is the
     whole of the "sometimes it just does not switch" the owner reported on
     2026-08-11: the runtime is the authority and it declines — during a session
     by `sessions::PROFILE_LOCKED_DURING_SESSION`, and on any other error too —
     the promise rejects, the swallow eats it, and the `<select>` springs back
     to the profile it started on with nothing said. A control that silently
     undoes what you did is worse than one that refuses out loud.

     It is held in state rather than logged, because the log is not on screen.
     It clears on the next attempt, so a refusal cannot outlive the condition
     that caused it. */
  const [refused, setRefused] = useState<string | null>(null);

  // The runtime is the authority and rejects this during a session, so the
  // local patch has to wait for it. Applying it first and invoking afterwards
  // left the UI showing a profile the runtime had refused to switch to.
  const handleSwitch = (id: string) => {
    if (sessionActive) return;
    setRefused(null);
    void invoke("switch_active_text_profile", { profileId: id })
      .then(() => onChange(buildTextProfilesPatch(config, profiles, id)))
      .catch((error) =>
        setRefused(
          typeof error === "string" ? error : "The runtime refused the switch.",
        ),
      );
  };

  const sheet = variant === "sheet";
  /* ONE `<select>`, TWO GROUNDS. The picker below is byte for byte the same in
     both variants — the same options, the same handler, the same refusal — and
     what the variant chooses is the row drawn under it. A second component
     would be a second place for the runtime call to drift. */
  const picker = (
    <select
      className={sheet ? "ws-modal-profile-select" : "ws-nav-profile-select"}
      value={active.id}
      onChange={(event) => handleSwitch(event.target.value)}
      aria-label="Switch active profile"
      disabled={sessionActive}
    >
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {displayTextProfileLabel(profile)}
        </option>
      ))}
    </select>
  );

  if (sheet) {
    return (
      <div
        className="ws-modal-profile"
        data-locked={sessionActive ? "" : undefined}
        /* The header strip has no line to spend on a paragraph, so a refusal is
           drawn on the row itself and carried in full by the tooltip. The
           sidebar, which does have the line, prints it. */
        data-refused={refused && !sessionActive ? "" : undefined}
        title={
          sessionActive
            ? LOCKED_HINT
            : refused ?? `${active.label} — switch the active profile`
        }
      >
        <span className="ws-av" aria-hidden>
          {textProfileInitials(active)}
        </span>
        <span className="ws-modal-profile-name">{active.label}</span>
        <Icon name="updown" />
        {picker}
      </div>
    );
  }

  return (
    <>
      <div
        className="ws-nav-profile"
        data-locked={sessionActive ? "" : undefined}
        title={collapsed ? railTitle : sessionActive ? LOCKED_HINT : undefined}
      >
        <span className="ws-av" aria-hidden>
          {textProfileInitials(active)}
        </span>
        <span className="ws-who">
          <b>{active.label}</b>
          {subtitle && <span>{subtitle}</span>}
        </span>
        <span className="ws-caret" aria-hidden>
          <Icon name="updown" />
        </span>
        {picker}
      </div>
      {sessionActive && !collapsed && (
        /* THE LINE SAYS WHAT; THE HOVER SAYS WHY (ADR 0196). The title is on the
           line rather than only on the row above it, so the reader who wants the
           reason finds it by pointing at the sentence that raised the
           question. */
        <p className="ws-nav-lock" title={LOCKED_HINT}>
          <Icon name="lock" />
          <span>{LOCKED_LINE}</span>
        </p>
      )}
      {refused && !sessionActive && !collapsed && (
        <p className="ws-nav-lock" role="status">
          <Icon name="alert" />
          <span>{refused}</span>
        </p>
      )}
    </>
  );
}
