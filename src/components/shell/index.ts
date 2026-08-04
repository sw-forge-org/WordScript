/* ── The ported shell kit ─────────────────────────────────────────────────────
   The eight primitives of plan §5.3 plus the card grammar they sit in, ported
   from the accepted prototype by Leg 1 of the GUI port relay. The design-system
   rules live in these components and in `styles/shell.css`, never in a screen —
   §11.17 found the prototype patching four missing rules screen by screen, and
   porting the patches instead of the rules is how the port fails.

   `FormCard`, `FormRow` and `Sidebar` at the foot are the PRE-PORT shell: what
   the shipped settings areas still render. Legs 2 and 3 move their callers onto
   `Card`, `Row` and the new navigation and delete them with the last screen
   that reads them. Nothing new may use them. */

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

/* Kept, and used everywhere their value type occurs (§11.9). The first Stage 0
   build silently substituted a bare text field for all four — which is how the
   level meter, the one control that states the speech threshold deciding
   whether a capture is kept at all, became a decorative waveform. */
export { Stepper } from "./Stepper";
export { VolumeSlider } from "./VolumeSlider";
export { InputLevelMeter } from "./InputLevelMeter";
export { DisclosureRow } from "./DisclosureRow";

export { SegmentControl } from "./SegmentControl";
export type { SegmentOption } from "./SegmentControl";
export { StatusBadge } from "./StatusBadge";
export type { StatusTone } from "./StatusBadge";
export { StatusDot } from "./StatusDot";
export type { StatusDotTone } from "./StatusDot";
export { StatTiles } from "./StatTile";
export type { StatTileItem } from "./StatTile";
export { Select } from "./Select";
export { Toggle } from "./Toggle";
export { Inspector } from "./Inspector";
export { ProfileSwitcher } from "./ProfileSwitcher";

/* Pre-port. */
export { Sidebar } from "./Sidebar";
export type { SidebarItem, SidebarGroup } from "./Sidebar";
export { FormCard } from "./FormCard";
export { FormRow } from "./FormRow";
