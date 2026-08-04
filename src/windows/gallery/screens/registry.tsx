import type { ReactNode } from "react";
import { HomeScreen } from "./Home";
import { HistoryScreen } from "./History";

/**
 * THE SCREEN REGISTRY — the prototype's `NAV`, minus its rig.
 *
 * The four groups and their order are `demo.js`'s, including the two entries
 * that are aliases of a settings screen rather than screens of their own. What
 * does not come across is the rig's picker chrome; what does come across is
 * what it was picking between.
 *
 * `render` ABSENT MEANS NOT YET PORTED, and the ledger reads this file rather
 * than a hand-kept count — a tally maintained beside the thing it counts is a
 * tally that goes stale. This section is scaffolding and retires per screen in
 * the commit that wires it (ADR 0057).
 */

export type ScreenEntry = {
  id: string;
  label: string;
  /** Absent until the screen is ported. */
  render?: () => ReactNode;
  /** The prototype's own `preview` tag on a nav entry. */
  preview?: boolean;
  /** Drawn, and explicitly not a target shape (§11.15). */
  withdrawn?: boolean;
  /** An entry that is the same place as one listed above it. */
  alias?: string;
};

export type ScreenGroup = { group: string; lead: string; screens: ScreenEntry[] };

export const SCREEN_GROUPS: ScreenGroup[] = [
  {
    group: "System",
    lead: "The system on one page — read out of SCREENS.ds, not composed. It is Foundations plus Components plus Motion, so it has no entry of its own here.",
    screens: [{ id: "ds", label: "Design System", alias: "Foundations · Components · Motion" }],
  },
  {
    group: "Workspace",
    lead: "Four views. The window behind the settings sheet.",
    screens: [
      { id: "home", label: "Home", render: () => <HomeScreen /> },
      { id: "history", label: "History", render: () => <HistoryScreen /> },
      { id: "profiles", label: "Profiles" },
      { id: "context", label: "Context", preview: true },
    ],
  },
  {
    group: "Settings",
    lead: "Eleven sections in three groups, in a sheet at its own scale (§11.22).",
    screens: [
      { id: "general", label: "General" },
      { id: "hotkeys", label: "Hotkeys" },
      { id: "notesettings", label: "Notes & Meetings", preview: true },
      { id: "models", label: "AI Models" },
      { id: "agents", label: "Agents", preview: true },
      { id: "integrations", label: "Integrations", preview: true },
      { id: "delivery", label: "Delivery & Insert" },
      { id: "privacy", label: "Privacy & Data" },
      { id: "diagnostics", label: "Diagnostics" },
      { id: "about", label: "About & Updates" },
    ],
  },
  {
    group: "Previews",
    lead: "Layout only, each carrying its PreviewBanner. Four more are previews of a screen already listed above.",
    screens: [
      { id: "onboarding", label: "Onboarding" },
      { id: "translate", label: "Translation" },
      { id: "subtitles", label: "Live subtitles" },
      { id: "meeting", label: "Meeting capture" },
      { id: "conversation", label: "Client conversations" },
      { id: "agentoverlay", label: "Agent overlay" },
      { id: "handoff", label: "Handoff" },
      { id: "commit", label: "Live preview & commit", withdrawn: true },
      { id: "contextintake", label: "Context · intake" },
      { id: "contextactions", label: "Actions & templates" },
    ],
  },
];

export const ALL_SCREENS = SCREEN_GROUPS.flatMap((group) => group.screens);

export function findScreen(id: string): ScreenEntry | undefined {
  return ALL_SCREENS.find((screen) => screen.id === id);
}
