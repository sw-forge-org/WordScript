import { invoke } from "@tauri-apps/api/core";
import type { ReactNode } from "react";
import type { AppConfig } from "@/types/ipc";
import {
  buildTextProfilesPatch,
  cloneTextProfile,
  displayTextProfileLabel,
  resolveActiveTextProfile,
  textProfileInitials,
} from "@/lib/textProfiles";
import { Icon } from "./Icon";

interface ProfileSwitcherProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  /** One line under the name. The caller states what the profile is doing —
   *  facts it reads from the runtime, never facts this component invents. */
  subtitle?: ReactNode;
  /** True while a capture or its pipeline is running. */
  sessionActive?: boolean;
}

/** Mirrors `sessions::PROFILE_LOCKED_DURING_SESSION`. Shown before the attempt
 *  rather than after it, so the control explains itself instead of failing. */
const LOCKED_HINT =
  "Locked while recording — the profile sets the recognizer, which is fixed once a recording starts. The processing mode can still be changed.";

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
}: ProfileSwitcherProps) {
  const profiles = config.text_profiles?.length
    ? config.text_profiles.map((profile) => cloneTextProfile(profile))
    : [resolveActiveTextProfile(config)];
  const active = resolveActiveTextProfile(config);

  // The runtime is the authority and rejects this during a session, so the
  // local patch has to wait for it. Applying it first and invoking afterwards
  // left the UI showing a profile the runtime had refused to switch to.
  const handleSwitch = (id: string) => {
    if (sessionActive) return;
    void invoke("switch_active_text_profile", { profileId: id })
      .then(() => onChange(buildTextProfilesPatch(config, profiles, id)))
      .catch(() => {});
  };

  return (
    <>
      <div
        className="ws-nav-profile"
        data-locked={sessionActive ? "" : undefined}
        title={sessionActive ? LOCKED_HINT : undefined}
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
        <select
          className="ws-nav-profile-select"
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
      </div>
      {sessionActive && (
        <p className="ws-nav-lock">
          <Icon name="lock" />
          <span>{LOCKED_HINT}</span>
        </p>
      )}
    </>
  );
}
