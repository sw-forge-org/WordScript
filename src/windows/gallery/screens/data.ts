import type { ListItemBadge, RawTranscript } from "@/components/shell";

/**
 * THE PROTOTYPE'S SAMPLE DATA, copied out of `demo.js`.
 *
 * A gallery screen carries sample data and asserts nothing (ADR 0055) — and
 * the sample data is part of the design, not filler chosen to fill a row. The
 * seventh history entry is what a swept record looks like; the fourth is a
 * delivery exception; the third has no `heard` at all, which is what Verbatim
 * produces. A port that invented its own rows would have drawn none of the
 * three states the list exists to show.
 *
 * `DESK_CAP` is the desk's display name, once, so the screens that name it
 * cannot drift apart.
 */

export const DESK_CAP = "The desk";

export type Transcript = {
  id: string;
  text: string;
  heard?: string;
  at: string;
  mode: string;
  profile: string;
  path: string;
  badges?: ListItemBadge[];
  restore?: boolean;
  /** `false` is a record whose audio has been swept — Retry has nothing to
   *  re-run (ADR 0039) and says so by disabling rather than by hiding. */
  audio?: boolean;
  rawNote?: string;
};

export function rawOf(entry: Transcript): RawTranscript {
  return {
    heard: entry.heard ?? entry.text,
    written: entry.text,
    same: !entry.heard,
    note: entry.rawNote ?? "The AI stage rewrote it.",
    path: entry.path,
  };
}

export const RECENT: Transcript[] = [
  {
    id: "r1",
    text: "Let’s ship the settings restructure today and review the overlay tab.",
    heard: "lets ship the settings restructure today and uh review the overlay tab",
    at: "2 min ago",
    mode: "Cleanup",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0942-settings-restructure.md",
  },
  {
    id: "r2",
    text: "Hey WordScript, write a short reply confirming Thursday works.",
    heard: "hey wordscript write a short reply confirming thursday works",
    at: "18 min ago",
    mode: "Draft",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0926-reply-thursday.md",
  },
  {
    id: "r3",
    text: "Consolidate insert recovery into a single home.",
    at: "1 h ago",
    mode: "Verbatim",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0851-insert-recovery.md",
  },
  {
    id: "r4",
    text: "Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.",
    heard: "kundenanfrage zum lieferstatus bitte freundlich beantworten",
    at: "Yesterday",
    mode: "Rewrite",
    profile: "Support reply",
    badges: [{ text: "Clipboard", tone: "warning" }],
    restore: true,
    path: "~/WordScript/transcripts/2026/08/02-1703-lieferstatus.md",
  },
  {
    id: "r5",
    text: "Structure this into a prompt for Claude Code with the constraints I listed.",
    heard: "structure this into a prompt for claude code with the constraints i listed",
    at: "Yesterday",
    mode: "Prompt Enhance",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/02-1540-claude-prompt.md",
  },
];

export const HISTORY: Transcript[] = [
  {
    id: "h1",
    text: "Let’s ship the settings restructure today and review the overlay tab.",
    heard: "lets ship the settings restructure today and uh review the overlay tab",
    at: "09:42",
    mode: "Cleanup",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0942-settings-restructure.md",
  },
  {
    id: "h2",
    text: "Hey WordScript, write a short reply confirming Thursday works.",
    heard: "hey wordscript write a short reply confirming thursday works",
    at: "09:26",
    mode: "Draft",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0926-reply-thursday.md",
  },
  {
    id: "h3",
    text: "Consolidate insert recovery into a single home.",
    at: "08:51",
    mode: "Verbatim",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0851-insert-recovery.md",
  },
  {
    id: "h4",
    text: "Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.",
    heard: "kundenanfrage zum lieferstatus bitte freundlich beantworten",
    at: "Yesterday 17:03",
    mode: "Rewrite",
    profile: "Support reply",
    badges: [{ text: "Insert failed", tone: "danger" }],
    restore: true,
    path: "~/WordScript/transcripts/2026/08/02-1703-lieferstatus.md",
  },
  {
    id: "h5",
    text: "Structure this into a prompt for Claude Code with the constraints I just listed.",
    heard: "structure this into a prompt for claude code with the constraints i just listed",
    at: "Yesterday 15:40",
    mode: "Prompt Enhance",
    profile: "General writing",
    badges: [{ text: "Retried once", tone: "plan" }],
    path: "~/WordScript/transcripts/2026/08/02-1540-claude-prompt.md",
  },
  {
    id: "h6",
    text: "Standup notes: overlay placement fixed, shortcuts still open.",
    heard: "standup notes overlay placement fixed shortcuts still open",
    at: "Yesterday 09:12",
    mode: "Cleanup",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/02-0912-standup.md",
  },
  {
    id: "h7",
    text: "Danke fuer die Rueckmeldung, ich schaue mir das heute noch an.",
    heard: "danke für die rückmeldung ich schaue mir das heute noch an",
    at: "Mon 16:22",
    mode: "Rewrite",
    profile: "Support reply",
    audio: false,
    badges: [
      { text: "Clipboard only", tone: "warning" },
      { text: "Audio swept", tone: "plan" },
    ],
    restore: true,
    path: "~/WordScript/transcripts/2026/07/31-1622-rueckmeldung.md",
  },
];
