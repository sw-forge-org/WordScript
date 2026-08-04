import type { ReactNode } from "react";
import { HomeScreen } from "./Home";
import { HistoryScreen } from "./History";
import { GeneralScreen } from "./General";
import { HotkeysScreen } from "./Hotkeys";
import { DeliveryScreen } from "./Delivery";
import { PrivacyScreen } from "./Privacy";
import { DiagnosticsScreen } from "./Diagnostics";
import { AboutScreen } from "./About";
import { ProfilesScreen } from "./Profiles";
import { CommitScreen } from "./Commit";
import { IntegrationsScreen } from "./Integrations";
import { NoteSettingsScreen } from "./NoteSettings";
import { OnboardingScreen } from "./Onboarding";
import { ModelsScreen } from "./Models";

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
  /** Which surface the prototype draws this screen on. `settings` is a sheet
   *  over the workspace and carries the sheet's own scale (§11.22). */
  surface?: "workspace" | "settings" | "standalone" | "system";
  /** `pane` is `SCREENS.<id>.layout` in the prototype: the view fills the
   *  content column and scrolls inside its own two halves. */
  layout?: "pane" | "wide";
};

export type ScreenGroup = { group: string; lead: string; screens: ScreenEntry[] };

export const SCREEN_GROUPS: ScreenGroup[] = [
  {
    group: "System",
    lead: "The system on one page — read out of SCREENS.ds, not composed. It is Foundations plus Components plus Motion, so it has no entry of its own here.",
    screens: [{ id: "ds", surface: "system", label: "Design System", alias: "Foundations · Components · Motion" }],
  },
  {
    group: "Workspace",
    lead: "Four views. The window behind the settings sheet.",
    screens: [
      { id: "home", surface: "workspace", label: "Home", render: () => <HomeScreen /> },
      { id: "history", surface: "workspace", label: "History", render: () => <HistoryScreen /> },
      { id: "profiles", surface: "workspace", layout: "pane", label: "Profiles", render: () => <ProfilesScreen /> },
      { id: "context", surface: "workspace", layout: "pane", label: "Context", preview: true },
    ],
  },
  {
    group: "Settings",
    lead: "Eleven sections in three groups, in a sheet at its own scale (§11.22).",
    screens: [
      { id: "general", surface: "settings", label: "General", render: () => <GeneralScreen /> },
      { id: "hotkeys", surface: "settings", label: "Hotkeys", render: () => <HotkeysScreen /> },
      { id: "notesettings", surface: "settings", label: "Notes & Meetings", preview: true, render: () => <NoteSettingsScreen /> },
      { id: "models", surface: "settings", label: "AI Models", render: () => <ModelsScreen /> },
      { id: "agents", surface: "settings", label: "Agents", preview: true },
      { id: "integrations", surface: "settings", label: "Integrations", preview: true, render: () => <IntegrationsScreen /> },
      { id: "delivery", surface: "settings", label: "Delivery & Insert", render: () => <DeliveryScreen /> },
      { id: "privacy", surface: "settings", label: "Privacy & Data", render: () => <PrivacyScreen /> },
      { id: "diagnostics", surface: "settings", label: "Diagnostics", render: () => <DiagnosticsScreen /> },
      { id: "about", surface: "settings", label: "About & Updates", render: () => <AboutScreen /> },
    ],
  },
  {
    group: "Previews",
    lead: "Layout only, each carrying its PreviewBanner. Four more are previews of a screen already listed above.",
    screens: [
      { id: "onboarding", surface: "standalone", label: "Onboarding", render: () => <OnboardingScreen /> },
      { id: "translate", surface: "standalone", label: "Translation" },
      { id: "subtitles", surface: "standalone", label: "Live subtitles" },
      { id: "meeting", surface: "standalone", label: "Meeting capture" },
      { id: "conversation", surface: "standalone", label: "Client conversations" },
      { id: "agentoverlay", surface: "standalone", label: "Agent overlay" },
      { id: "handoff", surface: "standalone", label: "Handoff" },
      { id: "commit", surface: "standalone", label: "Live preview & commit", withdrawn: true, render: () => <CommitScreen /> },
      { id: "contextintake", surface: "workspace", label: "Context · intake" },
      { id: "contextactions", surface: "workspace", label: "Actions & templates" },
    ],
  },
];

export const ALL_SCREENS = SCREEN_GROUPS.flatMap((group) => group.screens);

export function findScreen(id: string): ScreenEntry | undefined {
  return ALL_SCREENS.find((screen) => screen.id === id);
}
