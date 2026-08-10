/* ── The ported shell kit ─────────────────────────────────────────────────────
   THE LIBRARY IS THE DELIVERABLE. This directory plus `styles/shell.css` is the
   productive component library: it is where the design components live and it
   is what the product renders. The gallery displays it and never defines it — a
   component that exists only under `windows/gallery/` has made the gallery a
   second product, which is the one thing ADR 0055 forbids.

   Leg 1 ported the card grammar and the eight primitives of plan §5.3. Leg 2
   added the controls those primitives sit next to, because the Design System
   screen's Components section is a page of exactly those controls and could not
   be ported without them: the button and its three-value primary material, the
   icon button, the switch, the segmented control, the pop-up button, the text
   field, the stepper, the slider, the level meter, the key caps, the chips, the
   note, the check list, the action strip and the disclosure.

   The design-system rules live in these components and in `styles/shell.css`,
   never in a screen — §11.17 found the prototype patching four missing rules
   screen by screen, and porting the patches instead of the rules is how the
   port fails (ADR 0052).

   THE PRE-PORT SHELL IS GONE. `FormCard`, `FormRow`, `Sidebar` and `StatTiles`
   stood at the foot of this file for three legs, marked as what the shipped
   settings areas still rendered. Leg 3 deleted their last caller — the fourteen
   flat areas — and deleted them in the same commit, which is ADR 0054's rule
   about a replaced surface. Their `bodyClassName="py-4"` patches went with
   them; the ported card owns its own vertical inset (§11.17, ADR 0052) and the
   patches were the defect that rule exists to prevent. */

export { Card, CardFooter, CardRows, Row } from "./Card";
export type { RowProps } from "./Card";
export { LaneCard } from "./LaneCard";
export type { LaneOption } from "./LaneCard";
export { SubTabs } from "./SubTabs";
export type { SubTabItem } from "./SubTabs";
export { SectionHeader } from "./SectionHeader";
export { PreviewBanner } from "./PreviewBanner";
export { EmptyState } from "./EmptyState";
export { DangerRow } from "./DangerRow";
export { Toolbar, ToolbarSearch } from "./Toolbar";
export { ScopeTag } from "./ScopeTag";

/* ── The shell itself — demo.css §3 and §4, ported by Leg 2 ── */
export { Nav, NavFoot, NavGroup, NavRow, NavSearch, BrandMark } from "./Nav";
export { ViewTop } from "./ViewTop";

/* ── The window and the sheet over it — demo.css §2 and §2b, Leg 3 ── */
export { WindowShell, WindowBody, StatusStrip } from "./Window";
export {
  Sheet, SheetHead, SheetProfile, SheetBody, SheetNav, SheetContent, SheetFoot,
} from "./Sheet";

/* ── The palette over both of them — demo.css §"The command palette", Leg 4d ── */
export {
  Palette, PaletteField, PaletteList, PaletteGroup, PaletteRow, PaletteEmpty, PaletteFoot,
} from "./Palette";

/* ── Controls — demo.css §6, ported by Leg 2 ── */
export { Button, IconButton } from "./Button";
export type { ButtonVariant } from "./Button";
export { BudgetMeter, Field, FieldWrap, TextArea } from "./Field";
export { Toggle } from "./Toggle";
export { SegmentControl } from "./SegmentControl";
export type { SegmentOption } from "./SegmentControl";
export { Select } from "./Select";
export { Stepper } from "./Stepper";
export { Slider } from "./Slider";
export { VolumeSlider } from "./VolumeSlider";
export { LevelMeter } from "./LevelMeter";
export type { LevelState } from "./LevelMeter";
export { InputLevelMeter } from "./InputLevelMeter";
export { Keycaps, HotkeyButton } from "./Keycap";
export { Chip, TermChips } from "./Chip";
export type { TermChip } from "./Chip";
export { Note, DocLink } from "./Note";
export type { NoteTone } from "./Note";
export { CheckList } from "./CheckList";
export type { CheckItem, CheckState } from "./CheckList";
export { ActionStrip } from "./ActionStrip";
export { Disclosure } from "./Disclosure";
export { Sources } from "./Sources";

/* ── The two live drawings ── */
export { Matrix, MATRIX_FRAMES, vu } from "./Matrix";
export type { Frame } from "./Matrix";
export { Waveform } from "./Waveform";

/* ── The icon set, the orchestrator's body, the provider marks — Leg 2b ── */
export { Icon } from "./Icon";
export type { IconName } from "./Icon";
export { Orb, OrbDemo, OrbFigure } from "./Orb";
export type { OrbState } from "./Orb";
export { ProviderMark, ProviderSprite, ProviderChips, brandSymbolId } from "./ProviderMark";

/* ── The workspace grammar — Leg 2b ── */
export { HomeOpen, HeroInvoke, HeroFacts, KeyCap } from "./HomeHero";
export { ListRows, ListItem, RawPanel } from "./ListItem";
export type { ListItemBadge, ListItemState, RawTranscript } from "./ListItem";
export { TranscriptRow } from "./TranscriptRow";
export { OwedList, Owed } from "./Owed";
export { Log, Diff, DiffPane, DiffMark } from "./Log";
export {
  Pane, PaneListHead, PaneSearch, PaneScroll, PaneGroup, PaneRow, PaneListFoot,
  PanePath, PaneDetailHead, PaneDetailMain, Legend, LegendRow, Flag,
} from "./Pane";
export {
  ConnectionList, Connection, Command, KindTable, KindRow, ServerPanels, ServerPanel,
} from "./Connection";
export type { LogLevel, LogLine } from "./Log";

/* ── AI Models, and onboarding's rail — Leg 2c ── */
export { OnboardingRail, OnboardingStepHead, OnboardingFoot } from "./Onboarding";
export type { OnboardingStep } from "./Onboarding";
export { JobList, Job, JobNone, JobModel, SelectMark } from "./Job";
export { McpList, McpRow, Thread, Message } from "./Thread";
export { ModelList, ModelRow } from "./ModelRow";
export type { ModelState } from "./ModelRow";

/* ── Context: the rail's second level, the note, and the windows over it — 2d ── */
export { PaneSec, PaneSecHead, Folders, FolderRow } from "./Folders";
export {
  NoteTabs, NoteBody, NoteDate, Transcript, TLine, Speakers, Speaker,
  WhoChips, WhoChip, WhoAdd, Enh, EnhItem, EnhAct, LinkGroup, LinkRow, Readout,
} from "./NoteBody";
export type { WhoHow, WhoStatus } from "./NoteBody";
export { FloatBar, MicButton, SplitButton, Menu } from "./FloatBar";
export type { MenuEntry } from "./FloatBar";
export {
  ChatWindow, ChatWinDeco, AiChatBody, AiChatFoot, Msg, Bubble, Typing,
} from "./ChatWindow";
export {
  ActionsBody, ActionsList, ActionsRule, ActionRow, ActionNew, ActionsEdit,
  ActionsDesk, ActionsFoot, FieldRow,
} from "./ActionsWindow";
export { DropZone, Intake, IntakeOr, IntakeLink, RecStart } from "./Intake";
export { CaptionStage, CaptionScene, CaptionBar, EchoWrap, EchoText } from "./Caption";
export {
  TranslateStage, TranslateWindow, TranslateDecoPair, TranslatePair, TranslateTabs,
  TranslateBody, TranslatePane, TranslateSource, TranslateText, TranslateAlt,
  TranslateAlts, TranslateConversation, TranslateTurn, TranslateListen,
  TranslateRoute, TranslateRouteRow,
} from "./Translate";
export {
  Client, ClientHead, ClientList, ClientRow,
  DocTemplate, DocTemplateHead, DocTemplateBody, DocField,
} from "./Client";
export {
  AgentStage, AgentWindow, AgentBody, AgentRail, AgentRailHead, AgentRailLabel,
  AgentTargets, AgentTarget, AgentRailFoot, OverlayMiniButton, AgentMain,
  AgentMainHead, AgentThread, AgentMessage, AgentAnswer, AgentVoice,
  AgentPopupStage, AgentPopup, ModeCycle, ModeCycleItem,
} from "./AgentWindow";
export {
  Hud, HudRow, HudWrap, HudDeco, HudHead, HudTitle, HudTabs, HudState, HudElapsed,
  HudScroll, HudCap, Copilot, StageList, StageRow,
} from "./Hud";
/* The shipped overlay, DRAWN — rule 5 stands, `overlay*.css` is untouched. */
export { OverlayPillDrawing, OverlayStage, OverlayTab } from "./OverlayPillDrawing";
export {
  Handoff, HandoffStage, HandoffHead, HandoffSaid, HandoffGrid, HandoffCell,
  HandoffFoot, HandoffPair, HandoffSide, LineCompare, LineCompareRow,
  Cross, CrossSide, CrossItem, CrossFlow, CrossFlowStep,
} from "./Handoff";

export { StatusBadge } from "./StatusBadge";
export type { StatusTone } from "./StatusBadge";
export { StatusDot } from "./StatusDot";
export type { StatusDotTone } from "./StatusDot";
export { Inspector } from "./Inspector";
export { ProfileSwitcher } from "./ProfileSwitcher";
