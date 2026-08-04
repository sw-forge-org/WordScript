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

   `FormCard`, `FormRow`, `Sidebar` and `StatTiles` at the foot are the PRE-PORT
   shell: what the shipped settings areas still render. Legs 2b and 3 move their
   callers onto the ported grammar and delete them with the last screen that
   reads them. Nothing new may use them. */

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

/* ── Controls — demo.css §6, ported by Leg 2 ── */
export { Button, IconButton } from "./Button";
export type { ButtonVariant } from "./Button";
export { Field, FieldWrap, TextArea } from "./Field";
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
export { Note } from "./Note";
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

export { StatusBadge } from "./StatusBadge";
export type { StatusTone } from "./StatusBadge";
export { StatusDot } from "./StatusDot";
export type { StatusDotTone } from "./StatusDot";
export { Inspector } from "./Inspector";
export { ProfileSwitcher } from "./ProfileSwitcher";

/* Pre-port. */
export { Sidebar } from "./Sidebar";
export type { SidebarItem, SidebarGroup } from "./Sidebar";
export { FormCard } from "./FormCard";
export { FormRow } from "./FormRow";
export { StatTiles } from "./StatTile";
export type { StatTileItem } from "./StatTile";
