import type { ReactNode } from "react";
import { PreviewBanner } from "@/components/shell";
import type { IconName } from "@/components/shell";
import { HomeScreen } from "@/screens/Home";
import { HistoryScreen } from "@/screens/History";
import { ProfilesScreen } from "@/screens/Profiles";
import { ContextScreen } from "@/screens/Context";
import { GeneralScreen } from "@/screens/General";
import { HotkeysScreen } from "@/screens/Hotkeys";
import { NoteSettingsScreen } from "@/screens/NoteSettings";
import { ModelsScreen } from "@/screens/Models";
import { AgentsScreen } from "@/screens/Agents";
import { IntegrationsScreen } from "@/screens/Integrations";
import { DeliveryScreen } from "@/screens/Delivery";
import { PrivacyScreen } from "@/screens/Privacy";
import { DiagnosticsScreen } from "@/screens/Diagnostics";
import { AboutScreen } from "@/screens/About";

/**
 * THE INFORMATION ARCHITECTURE — plan §4.2, as the product mounts it.
 *
 * FOURTEEN FLAT ENTRIES BECOME FOUR VIEWS AND TEN SECTIONS IN THREE GROUPS.
 * The longest list anybody scans drops from fourteen to four. Nothing was
 * deleted without a destination: `ModesTab` split four ways along ADR 0024's
 * seam (which mode is effective → Home, which mode a profile defaults to →
 * Profiles, which model a mode uses → AI Models, which key selects one →
 * Hotkeys); Chat became a panel inside Context (§11.19); Upload became
 * Context's intake state (§11.41); Integrations moved into settings because
 * nothing on it is authored (§11.16); Speech-to-Text, Language Models and the
 * Providers & Keys screen that had grown between them became AI Models
 * (ADR 0042, §11.34); Account & Sync was removed with its screen, because an
 * entry promises a decision lives behind it and there is no account to decide
 * anything about.
 *
 * IT IS TEN SETTINGS SECTIONS, NOT ELEVEN. The plan's §4.2 counted eleven and
 * so did three documents downstream of it; the eleventh was Account & Sync,
 * which §4.2 itself lists and the prototype removed on 2026-08-04. Counted off
 * `demo.js`'s `settingsNav` groups, which is what the port is measured against.
 *
 * ONE VERB PER SURFACE (§4.3.1). If a user DOES it, it is a view; if a user
 * SETS it, it is a section in the sheet. That is the whole rule, and the four
 * screens that look like exceptions are not: History is a record you read,
 * Profiles is content you author, Context is the object list, and Diagnostics
 * is what the runtime is doing rather than what you have told it to do.
 *
 * EVERY ROW CARRIES ITS BANNER, AND THAT IS THE POINT OF THIS TABLE. A screen
 * mounted on a product surface and not wired to the runtime may not imply the
 * runtime reached a state it did not (rule 7), so until Leg 4 wires a section
 * the section says so on itself. Leg 4 deletes a row's `banner` in the commit
 * that wires it, and this table is therefore also the list of what is left.
 * The gallery passes no banner, which is what keeps `npm run port:diff` exact:
 * the screen is one implementation and the banner is a prop.
 */

export type ViewId = "home" | "history" | "profiles" | "context";
export type SectionId =
  | "general"
  | "hotkeys"
  | "notesettings"
  | "models"
  | "agents"
  | "integrations"
  | "delivery"
  | "privacy"
  | "diagnostics"
  | "about";

export interface SurfaceEntry<Id extends string> {
  id: Id;
  label: string;
  icon: IconName;
  /** `pane` gives up the column's measure, padding and block rhythm. */
  layout?: "pane" | "wide";
  /** The prototype's `tag: "prev"` — the feature itself is not built yet. */
  preview?: boolean;
  /** Stated on the surface until Leg 4 wires the section. */
  banner?: ReactNode;
  render: (props: { banner?: ReactNode }) => ReactNode;
}

/** Said once, so that fourteen rows cannot disagree about what they are. */
function notWired(what: string): ReactNode {
  return <PreviewBanner>{what}</PreviewBanner>;
}

export const VIEWS: SurfaceEntry<ViewId>[] = [
  {
    id: "home",
    label: "Home",
    icon: "home",
    banner: notWired("Drawn, not wired — the hero, the decision inbox and the record are sample data."),
    render: (props) => <HomeScreen {...props} />,
  },
  {
    id: "history",
    label: "History",
    icon: "history",
    banner: notWired("Drawn, not wired — the transcription record is sample data."),
    render: (props) => <HistoryScreen {...props} />,
  },
  {
    id: "profiles",
    label: "Profiles",
    icon: "profiles",
    layout: "pane",
    banner: notWired("Drawn, not wired — the profile list and every value in it are sample data."),
    render: (props) => <ProfilesScreen {...props} />,
  },
  {
    id: "context",
    label: "Context",
    icon: "notes",
    layout: "pane",
    preview: true,
    banner: notWired("Planned for V2, and drawn rather than wired. The context object does not exist in the runtime."),
    render: (props) => <ContextScreen {...props} />,
  },
];

export interface SectionGroup {
  name: string;
  ids: SectionId[];
}

/** `demo.js`'s `settingsNav` groups, in its order. */
export const SECTION_GROUPS: SectionGroup[] = [
  { name: "App", ids: ["general", "hotkeys", "notesettings"] },
  { name: "AI", ids: ["models", "agents", "integrations"] },
  { name: "System", ids: ["delivery", "privacy", "diagnostics", "about"] },
];

export const SECTIONS: SurfaceEntry<SectionId>[] = [
  {
    id: "general",
    label: "General",
    icon: "general",
    banner: notWired("Drawn, not wired — no control here reaches the runtime yet."),
    render: (props) => <GeneralScreen {...props} />,
  },
  {
    id: "hotkeys",
    label: "Hotkeys",
    icon: "keyboard",
    banner: notWired("Drawn, not wired — the shortcuts shown are sample data and none is registered."),
    render: (props) => <HotkeysScreen {...props} />,
  },
  {
    id: "notesettings",
    label: "Notes & Meetings",
    icon: "notes",
    preview: true,
    banner: notWired("Planned for V2, and drawn rather than wired."),
    render: (props) => <NoteSettingsScreen {...props} />,
  },
  {
    id: "models",
    label: "AI Models",
    icon: "models",
    banner: notWired("Drawn, not wired — the connection, the jobs and the installed models are sample data."),
    render: (props) => <ModelsScreen {...props} />,
  },
  {
    id: "agents",
    label: "Agents",
    icon: "agents",
    preview: true,
    banner: notWired("Planned for Phase 8 — ADR 0030 — and drawn rather than wired."),
    render: (props) => <AgentsScreen {...props} />,
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: "integrations",
    preview: true,
    banner: notWired("Planned for Phase 8, and drawn rather than wired."),
    render: (props) => <IntegrationsScreen {...props} />,
  },
  {
    id: "delivery",
    label: "Delivery & Insert",
    icon: "delivery",
    banner: notWired("Drawn, not wired — the driver chain and the readiness checks are sample data."),
    render: (props) => <DeliveryScreen {...props} />,
  },
  {
    id: "privacy",
    label: "Privacy & Data",
    icon: "privacy",
    banner: notWired("Drawn, not wired — retention and export do not act on this machine's data yet."),
    render: (props) => <PrivacyScreen {...props} />,
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: "diagnostics",
    banner: notWired("Drawn, not wired — the checks, the preview and the log are sample data."),
    render: (props) => <DiagnosticsScreen {...props} />,
  },
  {
    id: "about",
    label: "About & Updates",
    icon: "about",
    banner: notWired("Drawn, not wired — the version and the update state are sample data."),
    render: (props) => <AboutScreen {...props} />,
  },
];

export function findView(id: string): SurfaceEntry<ViewId> | undefined {
  return VIEWS.find((view) => view.id === id);
}

export function findSection(id: string): SurfaceEntry<SectionId> | undefined {
  return SECTIONS.find((section) => section.id === id);
}

/**
 * WHERE THE SIX UNDECIDED SURFACES WOULD GO, AND WHY EACH HOLE IS STILL A HOLE.
 *
 * §2.6 of the relay lists six surfaces the demo GUI drew a layout for and never
 * decided a lifecycle for: how each is entered, what holds its state, what
 * dismisses it, and what happens to it when the thing it is about ends. Those
 * are Leg 4a's decisions, taken with the owner. This leg owns the windows and
 * therefore owns the doors, so what it owes is the list of doors it did NOT
 * build — a nav row that opens nothing is the fake affordance rule 7 forbids,
 * the same reason the gallery's sidebar carries no search box.
 *
 * It is data rather than prose because Leg 4a's first act is to read it, and
 * because the surfaces are mounted in the gallery today: the entry point is the
 * only thing missing, and naming its place is what makes that checkable.
 */
export const ENTRY_POINT_HOLES = [
  {
    surface: "Onboarding",
    screen: "onboarding",
    wouldGo: "Before the workspace, in this window, ahead of every view.",
    undecided:
      "When it runs. First launch only, or re-runnable and from where. Whether skipping is offered at all, and what a skipped setup leaves behind. Which window it is — its own, or this one before the workspace exists. It is the only one of the six that lands inside this window, and the shell cannot answer it: a full-window flow ahead of the workspace is a routing decision, not a layout.",
  },
  {
    surface: "Meeting capture",
    screen: "meeting",
    wouldGo:
      "A second always-on-top window, 330 × 560, plus a start control that has no home yet — the meeting hotkey is drawn `not set` and call detection is drawn as an Open decision with three answers.",
    undecided:
      "How a capture starts and what ends it. §10.4 is the window question and is only part of it; the HUD's behaviour when the meeting ends is prose, not a transition.",
  },
  {
    surface: "Live subtitles",
    screen: "subtitles",
    wouldGo:
      "A strip over somebody else's video, placed once and remembered; the echo under the overlay pill. Settings → Notes & Meetings is where the toggles would sit.",
    undecided:
      "What turns either on, and where the placement is stored — per source or globally. What makes the echo appear under the pill for THIS dictation and not that one is undrawn.",
  },
  {
    surface: "Translation",
    screen: "translate",
    wouldGo: "Its own window. No entry point for it exists anywhere in the 25 screens.",
    undecided:
      "How the window is opened. Whether it is one window or one per conversation, what a swapped pair does to a running conversation, and where the two device routings are persisted.",
  },
  {
    surface: "Agent overlay",
    screen: "agentoverlay",
    wouldGo:
      "A tab on the shipped overlay pill, a window behind it, and a system notification — three surfaces, none of them in this window.",
    undecided:
      "The state machine between the three. That the tab appears and never retracts is stated; what fires the notification INSTEAD of the tab is only implied. What a dictation starting while an agent waits does to the tab is drawn as a settings row, not as a transition.",
  },
  {
    surface: "Handoff",
    screen: "handoff",
    wouldGo:
      "A keyed card over whatever has focus, offered at the end of a dictation. Rust owns the key grab (ADR 0006), so the door is native rather than a route.",
    undecided:
      "What detects the effect verb, and where that stage runs. The card's whole budget is that refusing costs one keystroke, so the refusal rate has to be measurable or the recogniser cannot be judged.",
  },
] as const;
