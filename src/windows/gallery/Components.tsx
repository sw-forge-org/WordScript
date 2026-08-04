import { useState } from "react";
import {
  CloudIcon,
  HardDriveIcon,
  HistoryIcon,
  ServerIcon,
  TrashIcon,
} from "lucide-react";
import {
  Card,
  CardRows,
  DangerRow,
  DisclosureRow,
  EmptyState,
  LaneCard,
  PreviewBanner,
  Row,
  ScopeTag,
  SectionHeader,
  SegmentControl,
  Select,
  StatusBadge,
  StatusDot,
  Stepper,
  SubTabs,
  Toggle,
  Toolbar,
  ToolbarSearch,
  VolumeSlider,
  type LaneOption,
} from "@/components/shell";
import { InputLevelMeter } from "@/components/shell";
import { VOICE_THRESHOLD, type InputLevelReading } from "@/hooks/useInputLevel";

const LANES: LaneOption[] = [
  {
    id: "cloud",
    icon: <CloudIcon />,
    name: "Groq cloud",
    description: "Bring your own key. Fastest lane.",
  },
  {
    id: "local",
    icon: <HardDriveIcon />,
    name: "Local",
    description: "whisper-cli and Ollama on this machine.",
  },
  {
    id: "hosted",
    icon: <ServerIcon />,
    name: "A server you run",
    description: "Self-hosted, on your own network.",
    badge: "Phase 8",
  },
];

/** A sample reading. It drives the meter's three verdicts without claiming a
 *  microphone was open — the gallery asserts nothing (ADR 0055). */
const reading = (peak: number, active = true): InputLevelReading => ({
  peak,
  rms: peak * 0.6,
  hold: peak,
  active,
});

function States({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-[var(--s3)]">{children}</div>;
}

function State({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col items-start gap-[var(--s2)]">
      <div className="flex min-h-[30px] items-center">{children}</div>
      <figcaption className="text-[length:var(--t-micro)] font-semibold uppercase tracking-[0.07em] text-fg-muted">
        {label}
      </figcaption>
    </figure>
  );
}

/**
 * COMPONENTS — every shell primitive in every state, on the real components.
 *
 * THE GALLERY NEVER COPIES A COMPONENT (ADR 0055). Everything below is imported
 * from `components/shell`; a screen here and the same screen in the product are
 * one implementation with two sets of props. And if a primitive looks right
 * here and wrong in the product, this page is what lied — the section that
 * finds that owes the fix.
 *
 * A component missing a state is a component that ships broken, which is the
 * whole reason for putting every state of each one on one page rather than
 * inferring the system from the screens that happen to use it.
 */
export function Components() {
  const [lane, setLane] = useState("cloud");
  const [sub, setSub] = useState("defaults");
  const [modes, setModes] = useState("cleanup");
  const [on, setOn] = useState(true);
  const [minutes, setMinutes] = useState(5);
  const [volume, setVolume] = useState(70);
  const [activation, setActivation] = useState<"tap" | "double" | "hold">("tap");

  return (
    <div className="flex flex-col gap-[var(--gap-block)]">
      <SectionHeader
        title="LaneCard"
        description="One card of radio rows. Replaces a segmented control plus one card per provider."
      >
        <LaneCard
          options={LANES}
          value={lane}
          onChange={setLane}
          label="Speech lane"
          title="Where speech is recognised"
          description="One connection, stated once. Everything follows it unless a job says otherwise."
        />
      </SectionHeader>

      <SectionHeader
        title="SubTabs"
        description="A pill row under a section header. Depth goes here, never into the sidebar."
      >
        <Card>
          <div className="flex flex-col items-start gap-[var(--s4)]">
            <SubTabs
              label="Profile"
              value={sub}
              onChange={setSub}
              items={[
                { id: "defaults", label: "Defaults" },
                { id: "context", label: "Context" },
                { id: "words", label: "Words" },
                { id: "replacements", label: "Replacements" },
                { id: "snippets", label: "Snippets" },
              ]}
            />
            <SubTabs
              label="Models"
              value={modes}
              onChange={setModes}
              items={[
                { id: "cleanup", label: "Cleanup" },
                { id: "rewrite", label: "Rewrite" },
                { id: "draft", label: "Draft" },
                { id: "enhance", label: "Prompt Enhance" },
                "|",
                { id: "notes", label: "Notes" },
              ]}
            />
          </div>
        </Card>
        <p className="text-[length:var(--t-label)] text-fg-dim">
          The second bar carries the rule. A tab bar is a claim that its entries are the
          same kind of thing, and four of those five are processing modes while the fifth
          is the model a note is formatted with. The rule marks the boundary and the
          control stays one control.
        </p>
      </SectionHeader>

      <SectionHeader
        title="PreviewBanner"
        description="A chip and one line, 26 px. The withdrawn variant keeps its box, because a stop has to interrupt."
      >
        <Card>
          <div className="flex flex-col gap-[var(--s4)]">
            <PreviewBanner>Planned: Phase 8.</PreviewBanner>
            <PreviewBanner tone="withdrawn">
              Withdrawn 2026-08-03. It duplicates Diagnostics and draws a window that
              cannot exist. Do not build Phase 3 from it.
            </PreviewBanner>
          </div>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="EmptyState, DangerRow, ScopeTag"
        description="One line and one action; destructive last in its card; a value that is not the window's."
      >
        <Card>
          <EmptyState
            icon={<HistoryIcon />}
            action={
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-control px-[11px] text-[length:var(--t-label)] font-[550] text-fg-dim hover:bg-bg-elevated hover:text-fg"
              >
                Press Ctrl+Super to start
              </button>
            }
          >
            No transcriptions yet.
          </EmptyState>
        </Card>
        <Card>
          <CardRows>
            <Row
              label="Language"
              hint="What the recognizer expects to hear."
              scope={<ScopeTag profile="Support reply" onOpen={() => undefined} />}
              control={
                <Select defaultValue="en" aria-label="Language" className="w-[140px]">
                  <option value="en">English</option>
                  <option value="de">German</option>
                </Select>
              }
            />
            <DangerRow
              label="Reset all settings"
              hint="Restores every setting to its default. History and profiles are untouched."
              action={
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-[6px] rounded-control border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] px-[11px] text-[length:var(--t-label)] font-[550] text-[var(--danger)]"
                >
                  <TrashIcon className="size-[13px]" />
                  Reset
                </button>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Toolbar"
        description="Filters on one line above the list they act on. The count is the result of a filter, not another filter."
      >
        <Toolbar label="History filters">
          <ToolbarSearch>
            <input
              aria-label="Search transcripts"
              placeholder="Search transcripts"
              className="h-7 w-full rounded-control border border-border bg-bg-inset pl-[27px] pr-[9px] text-[length:var(--t-label)] text-fg placeholder:text-fg-muted"
            />
          </ToolbarSearch>
          <Select defaultValue="all" aria-label="Status" className="w-[150px]">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="empty">Empty</option>
            <option value="failed">Failed</option>
          </Select>
        </Toolbar>
      </SectionHeader>

      <SectionHeader
        title="Status"
        description="A badge is for a status that is NOT expected. An expected one is a dot and a word, or nothing."
      >
        <Card>
          <States>
            <State label="success">
              <StatusBadge tone="success">Ready</StatusBadge>
            </State>
            <State label="warning">
              <StatusBadge tone="warning">Fallback</StatusBadge>
            </State>
            <State label="danger">
              <StatusBadge tone="error">Failed</StatusBadge>
            </State>
            <State label="accent">
              <StatusBadge tone="accent">Active</StatusBadge>
            </State>
            <State label="planned">
              <StatusBadge tone="plan">Phase 8</StatusBadge>
            </State>
            <State label="expected">
              <span className="inline-flex items-center gap-[5px] text-[length:var(--t-label)] text-fg-muted">
                <StatusDot tone="success" />
                Direct paste available
              </span>
            </State>
          </States>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Controls"
        description="One control per kind of value. A bounded number with a unit is never a text field."
      >
        <Card>
          <States>
            <State label="toggle off">
              <Toggle checked={false} onCheckedChange={() => undefined} aria-label="Off" />
            </State>
            <State label="toggle on">
              <Toggle checked={on} onCheckedChange={setOn} aria-label="On" />
            </State>
            <State label="toggle disabled">
              <Toggle checked disabled aria-label="Disabled" />
            </State>
            <State label="segment">
              <SegmentControl
                aria-label="Activation"
                value={activation}
                onChange={setActivation}
                options={[
                  { value: "tap", label: "Tap" },
                  { value: "double", label: "Double tap" },
                  { value: "hold", label: "Hold" },
                ]}
              />
            </State>
            <State label="stepper">
              <Stepper
                value={minutes}
                onChange={setMinutes}
                min={0}
                max={60}
                suffix="min"
                aria-label="Auto-stop"
              />
            </State>
            <State label="stepper at min">
              <Stepper value={0} onChange={() => undefined} min={0} suffix="min" aria-label="Off" />
            </State>
            <State label="select">
              <Select defaultValue="turbo" aria-label="Model" className="w-[230px]">
                <option value="turbo">whisper-large-v3-turbo</option>
                <option value="large">whisper-large-v3</option>
              </Select>
            </State>
          </States>
        </Card>
        <Card title="Slider and level">
          <div className="flex flex-col gap-[var(--s5)] py-[var(--s2)]">
            <VolumeSlider value={volume} onChange={setVolume} />
            <div className="flex flex-col gap-[var(--s4)]">
              <InputLevelMeter reading={reading(0.62)} />
              <InputLevelMeter reading={reading(VOICE_THRESHOLD * 0.6)} />
              <InputLevelMeter reading={reading(0.99)} />
            </div>
          </div>
        </Card>
        <p className="text-[length:var(--t-label)] text-fg-dim">
          The threshold mark is the meter, not decoration on it: a capture whose peak never
          crosses it is discarded as empty, so the bar to clear has to be on screen
          (§11.9). These four controls existed in the kit and the first build replaced all
          of them with bare text fields.
        </p>
      </SectionHeader>

      <SectionHeader
        title="Card grammar"
        description="The card owns its inset; the item carries the horizontal half so the separator reaches the group edge."
      >
        <Card
          title="Recording"
          description="What a capture may cost, and when it stops on its own."
          footer={
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-control border border-border bg-bg-elevated px-[11px] text-[length:var(--t-label)] font-[550]"
            >
              Restore defaults
            </button>
          }
        >
          <CardRows>
            <Row
              label="Processing limit"
              hint="The runtime's number. It follows your account plan."
              control={<span className="ws-mono ws-muted">25 MB</span>}
            />
            <Row
              label="Auto-stop"
              hint="Ends a capture that has run past its limit."
              control={
                <Stepper
                  value={minutes}
                  onChange={setMinutes}
                  min={0}
                  max={60}
                  suffix="min"
                  aria-label="Auto-stop minutes"
                />
              }
            />
            <DisclosureRow title="Decoding">
              <Row
                label="Beam size"
                hint="Folded because the recommended value is right for almost everyone."
                control={<Stepper value={5} onChange={() => undefined} aria-label="Beam size" />}
              />
            </DisclosureRow>
          </CardRows>
        </Card>
        <p className="text-[length:var(--t-label)] text-fg-dim">
          The action sits at the card's foot as a component, not as a flex row with a
          padding guessed per screen. Three different inline paddings had grown in the
          prototype before this rule existed (§11.17, ADR 0052).
        </p>
      </SectionHeader>
    </div>
  );
}
