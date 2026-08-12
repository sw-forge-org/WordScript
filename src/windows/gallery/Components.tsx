import { useState, type ReactNode } from "react";
import {
  ArrowRightIcon,
  CloudIcon,
  HistoryIcon,
  RotateCcwIcon,
  SearchIcon,
  ServerIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  ActionStrip,
  Button,
  Card,
  CardRows,
  AnswerPanel,
  ConfirmPanel,
  FlagPanel,
  Disclosure,
  EditorPanel,
  EmptyState,
  Field,
  HotkeyButton,
  LaneCard,
  LevelMeter,
  ListItem,
  ListRows,
  Menu,
  Note,
  PreviewBanner,
  Reorder,
  Row,
  ScopeTag,
  SectionHeader,
  SegmentControl,
  Select,
  Slider,
  Sources,
  StatusBadge,
  StatusDot,
  Stepper,
  SubTabs,
  TermChips,
  Toggle,
  Toolbar,
  ToolbarSearch,
  Waveform,
  type LaneOption,
  type TermChip,
} from "@/components/shell";
import { LANES as PROVIDER_LANES } from "@/screens/data";

/**
 * COMPONENTS — the *Components*, *Layout primitives* and *Motion* sections of
 * `SCREENS.ds`, ported out of `demo.js`.
 *
 * "EVERY STATE, ON ONE PAGE. A component missing a state is a component that
 * ships broken." That sentence is the section's own description and it is why
 * the page exists: a component judged from the one screen that happens to use
 * it is a component judged in one state.
 *
 * Leg 1 wrote this page from scratch and the five cards it drew were not the
 * prototype's five. The copy below is the prototype's, on the budget side of
 * its copy switch — `state.copy` defaults to `after`, so the shorter of every
 * `{b, a}` pair is the decided text.
 *
 * IT ASSERTS NOTHING. Every value is sample data and no control here reaches
 * the runtime. The one thing that had to be settled rather than copied is the
 * waveform: the prototype animates it from a synthetic envelope because it has
 * no microphone at all, and the real component opens one through
 * `getUserMedia`. A display surface does not take a device, so it is drawn at
 * rest — which is also the only honest state for a page measuring nothing.
 */

/** The prototype's `state_(label, body)`: a swatch under its name. */
function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ws-state">
      <label>{label}</label>
      {children}
    </div>
  );
}

/** The Cloud lane's dictation row, so the Select demo lists what the product
 *  lists rather than three strings that were true in August 2026. */
const CLOUD_DICTATION = {
  model: PROVIDER_LANES.Cloud.jobs.dictation.model ?? "",
  models: PROVIDER_LANES.Cloud.jobs.dictation.models ?? [],
};

const LANES: LaneOption[] = [
  {
    id: "cloud",
    icon: <CloudIcon aria-hidden />,
    name: "Groq cloud",
    description: "Bring your own key. Fastest lane.",
  },
  {
    id: "local",
    icon: <ServerIcon aria-hidden />,
    name: "Local",
    description: "whisper-cli and Ollama on this machine.",
  },
];

const INITIAL_TERMS: TermChip[] = [
  { term: "WordScript", origin: "learned" },
  { term: "ydotool", origin: "added" },
];

export function Components() {
  const [on, setOn] = useState(true);
  const [trigger, setTrigger] = useState("Tap");
  const [beam, setBeam] = useState(5);
  const [bestOf, setBestOf] = useState(5);
  const [volume, setVolume] = useState(70);
  const [sub, setSub] = useState("Defaults");
  const [lane, setLane] = useState("cloud");
  const [terms, setTerms] = useState(INITIAL_TERMS);

  return (
    <div className="flex flex-col gap-[var(--gap-block)]">
      <SectionHeader
        title="Components"
        description="Every state, on one page. A component missing a state is a component that ships broken."
      >
        <Card title="Buttons">
          <div className="ws-states">
            <State label="default">
              <Button variant="primary">Capture</Button>
            </State>
            <State label="secondary">
              <Button>Refresh</Button>
            </State>
            <State label="ghost">
              <Button variant="ghost">Review</Button>
            </State>
            <State label="with icon">
              <Button icon={<RotateCcwIcon aria-hidden />}>Restore</Button>
            </State>
            <State label="danger">
              <Button variant="danger">Reset all settings</Button>
            </State>
            <State label="disabled">
              <Button variant="primary" disabled>
                Commit
              </Button>
            </State>
            <State label="loading">
              <Button busy>Running check</Button>
            </State>
          </div>
        </Card>

        <Card title="Inputs" description="One control per kind of value.">
          <div className="ws-states">
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
                aria-label="Trigger"
                value={trigger}
                onChange={setTrigger}
                options={[
                  { value: "Tap", label: "Tap" },
                  { value: "Double tap", label: "Double tap" },
                  { value: "Hold", label: "Hold" },
                ]}
              />
            </State>
            <State label="select">
              {/* The lane's own three, off the catalogue (ADR 0115), so the
                  component gallery cannot show a model list the product no
                  longer offers. */}
              <Select defaultValue={CLOUD_DICTATION.model} aria-label="Model">
                {CLOUD_DICTATION.models.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </Select>
            </State>
            <State label="stepper">
              <Stepper value={12} min={0} max={60} suffix="s" aria-label="Stepper" />
            </State>
            <State label="stepper at min">
              <Stepper value={0} min={0} max={60} suffix="Disabled" aria-label="At minimum" />
            </State>
            <State label="slider">
              <Slider value={volume} onChange={setVolume} aria-label="Slider" />
            </State>
            <State label="text">
              <Field defaultValue="General writing" style={{ width: 170 }} aria-label="Text" />
            </State>
            <State label="invalid">
              <Field defaultValue="Ctrl+" invalid style={{ width: 120 }} aria-label="Invalid" />
            </State>
            <State label="hotkey">
              <HotkeyButton combo="Ctrl+Super" />
            </State>
            <State label="hotkey empty">
              <HotkeyButton combo={null} />
            </State>
          </div>
        </Card>

        <Card
          title="Level"
          description="The threshold mark is the component — a capture below it is discarded as empty."
        >
          <div className="ws-stack ws-gap4">
            <LevelMeter
              peak={62}
              hold={74}
              threshold={34}
              state="ok"
              verdict="Good — peak −13 dBFS."
            />
            <LevelMeter
              peak={18}
              hold={22}
              threshold={34}
              state="quiet"
              verdict="Too quiet — peak −34 dBFS is below the −26 dBFS needed to register as speech."
            />
            <LevelMeter
              peak={97}
              hold={99}
              threshold={34}
              state="hot"
              verdict="Very hot — peak −1 dBFS. Lower the input level to avoid distortion."
            />
          </div>
        </Card>

        <Card title="Status">
          <div className="ws-states">
            <State label="success">
              <StatusBadge tone="success">Ready</StatusBadge>
            </State>
            <State label="warning">
              <StatusBadge tone="warning">Fallback</StatusBadge>
            </State>
            <State label="danger">
              <StatusBadge tone="danger">Failed</StatusBadge>
            </State>
            <State label="accent">
              <StatusBadge tone="accent">Active</StatusBadge>
            </State>
            <State label="planned">
              <StatusBadge tone="plan">Phase 8</StatusBadge>
            </State>
            <State label="dot">
              <span className="ws-rowflex">
                <StatusDot tone="success" />
                <span className="ws-muted">Direct paste available</span>
              </span>
            </State>
            {/* THE LIVE COMPONENT, NOT A STILL OF IT — the prototype's own note.
                This swatch used to be a row of bars from a sine, drawn once,
                which is a picture of a waveform standing in a gallery of working
                controls. */}
            <State label="waveform">
              {/* Swatch scale. `.ws-state` sizes the width; the height is an
                  inline style on the instrument, so it is passed here. */}
              <Waveform height={24} ariaLabel="Live input level" />
            </State>
          </div>
        </Card>

        <Card
          title="New in this plan"
          description="Each replaces an ad-hoc pattern that exists in more than one place today."
        >
          <div className="ws-stack ws-gap3">
            <LaneCard label="Provider lane" options={LANES} value={lane} onChange={setLane} />

            <SubTabs
              label="Design system"
              value={sub}
              onChange={setSub}
              items={[
                { id: "Defaults", label: "Defaults" },
                { id: "Context", label: "Context" },
                { id: "Words", label: "Words" },
                { id: "Replacements", label: "Replacements" },
                { id: "Snippets", label: "Snippets" },
              ]}
            />

            <PreviewBanner>Planned: Phase 8.</PreviewBanner>

            <Card>
              <CardRows>
                <Row
                  label="Reset all settings"
                  hint="Restores every setting to its default. History and profiles are untouched."
                  danger
                  control={<Button variant="danger">Reset</Button>}
                />
              </CardRows>
            </Card>

            <EmptyState
              icon={<HistoryIcon aria-hidden />}
              action={<Button variant="ghost">Press Ctrl+Super to start</Button>}
            >
              No transcriptions yet.
            </EmptyState>

            <TermChips
              items={terms}
              onRemove={(term) => setTerms((list) => list.filter((t) => t.term !== term))}
            />

            <ActionStrip
              icon={<TriangleAlertIcon aria-hidden />}
              title="Action strip"
              actions={
                <>
                  <Button icon={<ArrowRightIcon aria-hidden />}>Review</Button>
                  <Button variant="ghost">Dismiss</Button>
                </>
              }
            >
              Home only, and only when something is owed.
            </ActionStrip>

            <Toolbar label="Filters">
              <ToolbarSearch>
                <Field placeholder="Toolbar — filters belong above the list, not in a card" />
              </ToolbarSearch>
              <Select defaultValue="All statuses" aria-label="Status">
                <option>All statuses</option>
                <option>Completed</option>
                <option>Empty</option>
                <option>Failed</option>
              </Select>
            </Toolbar>

            <Card>
              <CardRows>
                <Row
                  label="Scope tag"
                  hint="On any row whose value belongs to the active profile rather than to this machine."
                  control={<ScopeTag />}
                />
                <Row
                  label="Action strip"
                  hint="Ground plus icon tile. Never a coloured edge bar."
                  control={<StatusBadge tone="success">no edge rule</StatusBadge>}
                />
                <Row
                  label="Source list"
                  hint="Under an assistant turn: which of your own rows the answer was read from."
                  control={<Sources items={["Support reply · Words & names"]} />}
                />
                <Row
                  label="Transcript line"
                  hint="Time, speaker, what was said. The time is how a note points at a moment."
                  control={<StatusBadge tone="plan">tline</StatusBadge>}
                />
              </CardRows>
              <Disclosure
                summary="Disclosure — states what is inside, never “Advanced”"
                count={2}
              >
                <Row
                  label="Beam size"
                  hint="Folded because the recommended value is right for almost everyone."
                  control={
                    <Stepper
                      value={beam}
                      onChange={setBeam}
                      min={1}
                      max={10}
                      aria-label="Beam size"
                    />
                  }
                />
                <Row
                  label="Best of"
                  hint="Same. Visible in one click, absent from the first read."
                  control={
                    <Stepper
                      value={bestOf}
                      onChange={setBestOf}
                      min={1}
                      max={10}
                      aria-label="Best of"
                    />
                  }
                />
              </Disclosure>
            </Card>
          </div>
        </Card>
      </SectionHeader>

      {/* ADR 0082. It is shown UNDER A ROW rather than on its own, because the
          panel's whole argument is its relationship to the row above it: the
          shared inset plane, the dropped rule, the actions that stay visible
          while it is open. A swatch of it floating in a `State` box would draw
          a form and hide the design. */}
      <SectionHeader
        title="The editor, unfolded"
        description="Add and Edit open under the row they act on. No dialog, no scrim, nothing behind it recedes."
      >
        <Card title="Two halves of one sentence" description="A replacement, opened for editing.">
          <ListRows>
            <ListItem
              title="hdb  →  Herzliche Gruesse"
              meta={["exact", "case-insensitive"]}
              open
              actions={
                <Reorder what="replacement" onUp={() => {}} onDown={() => {}} atTop atBottom={false} />
              }
            />
            <EditorPanel
              fields={[
                { key: "phrase", label: "What you say", required: true },
                { key: "replace_with", label: "What gets written", required: true },
              ]}
              initial={{ phrase: "hdb", replace_with: "Herzliche Gruesse" }}
              note="Runs in order. A later rule sees what an earlier one wrote."
              onSave={() => {}}
              onCancel={() => {}}
            />
          </ListRows>
        </Card>

        <Card
          title="A value that holds line breaks"
          description="A snippet body takes the full row; Enter is its own newline and Ctrl+Enter commits."
        >
          <ListRows>
            <ListItem title="Standard reply" meta={["expands to 4 lines"]} open />
            <EditorPanel
              fields={[
                { key: "trigger", label: "Trigger phrase", required: true },
                { key: "label", label: "Name" },
                { key: "expansion", label: "Expands to", multiline: true, required: true },
              ]}
              initial={{ trigger: "standard reply", label: "Standard reply", expansion: "" }}
              issues={[
                {
                  severity: "warning",
                  message: "This trigger also matches a replacement. The replacement runs first.",
                },
              ]}
              onSave={() => {}}
              onCancel={() => {}}
            />
          </ListRows>
        </Card>

        <Note>
          Save is disabled while a required field is empty and names the field in its tooltip
          (ADR 0065). The snippet above is missing its body, so its Save is drawn in that state.
        </Note>

        <Card
          title="Before something is gone"
          description="A destructive action asks where the thing is, with the thing still on screen behind it."
        >
          <ListRows>
            <ListItem title="KA  →  Kundenanfrage" meta={["exact", "case-insensitive"]} open />
            <ConfirmPanel
              question="Delete the replacement for “KA”?"
              detail="It writes “Kundenanfrage” today."
              confirmLabel="Delete replacement"
              onConfirm={() => {}}
              onCancel={() => {}}
            />
          </ListRows>
        </Card>

        <Note tone="alert">
          Cancel takes focus when this opens, never the danger button. A panel that opens with the
          destructive control focused turns a stray Return into the deletion it exists to prevent.
        </Note>

        {/* THE THIRD PANEL ON THE PLANE (ADR 0085), and the states a screen
            cannot show at once: a severe flag, an ordinary one, and one already
            acknowledged. Only the gallery can stand all three side by side —
            the runtime answers with whatever this machine's profile happens to
            have. */}
        <Card
          title="What is wrong, and where each of it lives"
          description="The health flag counts four kinds of problem that point at three tabs, so the click opens the list rather than picking one."
        >
          <ListRows>
            <FlagPanel
              flags={[
                {
                  kind: "form_conflict",
                  name: "Contradictory style instructions",
                  hint: 'Contradictory style instructions detected: "formal" vs "casual". The model receives conflicting signals and will produce inconsistent output.',
                  where: "Context",
                  severe: true,
                  acknowledged: false,
                },
                {
                  kind: "length_bias",
                  name: "Replacements that all pull one way — expanding, 3 entries",
                  hint: "3 of 4 replacements expand text to 2x or more. The cleanup will see consistently longer raw text than you dictated.",
                  where: "Replacements",
                  severe: false,
                  acknowledged: true,
                },
              ]}
              onOpen={() => {}}
              onAcknowledge={() => {}}
              onClose={() => {}}
            />
          </ListRows>
        </Card>

        <Note>
          An acknowledged row dims and stays. The flag is still true — what acknowledging changes is
          whether it colours the profile, which is the runtime's own distinction rather than a
          dismissal.
        </Note>

        {/* The readout half of the same grammar. Two columns because it is a
            COMPARISON: what the reader is doing is holding one against the
            other, which is the difference from the rows above. */}
        <Card
          title="An answer, unfolded where it was asked for"
          description="A command with nowhere to put its answer put it on a screen of its own. This opens under the card that asked."
        >
          <ListRows>
            <AnswerPanel
              columns={[
                { label: "Heard", body: <p>send them the KA by friday</p> },
                { label: "Written", body: <p>send them the Kundenanfrage by friday</p> },
              ]}
              foot="KA → Kundenanfrage"
              onClose={() => {}}
            />
          </ListRows>
        </Card>
      </SectionHeader>

      {/* The menu is `fixed` at a measured point, so a gallery that rendered it
          live would drop a panel over the page. What is shown is the SHAPE:
          three verbs, no descriptions, at the width that makes. */}
      <SectionHeader
        title="A row's own actions"
        description="Every list answers a right-click the same way. Verbs, not descriptions — the width follows."
      >
        <Card>
          <div className="ws-states">
            <State label="a row's verbs">
              <Menu
                label="Actions"
                items={[
                  { label: "Rename", icon: "type" },
                  { label: "Duplicate", icon: "copy" },
                  { label: "Delete", icon: "trash" },
                ]}
              />
            </State>
            <State label="one entry that cannot act">
              <Menu
                label="Actions, last profile"
                items={[
                  { label: "Rename", icon: "type" },
                  { label: "Duplicate", icon: "copy" },
                  {
                    label: "Delete",
                    icon: "trash",
                    hint: "The last profile cannot be deleted",
                    disabled: true,
                  },
                ]}
              />
            </State>
          </div>
        </Card>
        <Note>
          A menu whose entries carry no hint draws itself narrow. The one entry that needs a reason
          gets one, which is why the second panel is the wide shape — and why the reason is worth
          the width.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="Layout primitives"
        description="Three ways a view can be built. Picking the wrong one is what made the first build of Profiles, Notes and Chat hard to read."
      >
        <Card>
          <CardRows>
            <Row
              label="Column"
              hint="Sections of cards down one centred column. Every settings section, History, Home."
              control={<StatusBadge tone="plan">default</StatusBadge>}
            />
            <Row
              label="Pane"
              hint="A list column and its detail as ONE surface — the list is borderless, sits on the sidebar plane and is separated by a hairline. Profiles, Notes, Chat."
              control={<StatusBadge tone="plan">list + detail</StatusBadge>}
            />
            <Row
              label="Split column"
              hint="Two columns INSIDE a pane detail, when reading and writing have to happen at once. Notes: the transcript on the left, your notes and the summary on the right."
              control={<StatusBadge tone="plan">read + work</StatusBadge>}
            />
            <Row
              label="Solo — removed"
              hint="One centred 460 px column. It existed for Upload, which is a band over a full-width queue now, and nothing else has one job and nothing to show. A primitive with no user is not part of the system."
              control={<StatusBadge tone="danger">no user</StatusBadge>}
            />
          </CardRows>
        </Card>
        <Note tone="alert">
          Two cards side by side is not a pane. It reads as two unrelated boxes, because
          nothing on screen states that the left one governs the right one.
        </Note>
        <Note tone="alert">
          A tab row is not a layout. Three sub-tabs put the transcript, the notes and the
          summary in three places you cannot see at once — which is the one thing a meeting
          note exists to do.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="Motion"
        description="One authored moment per interaction, on transform and opacity only."
      >
        <Card>
          <CardRows>
            <Row
              label="Control state"
              hint="Toggle knob, radio fill, segment thumb."
              control={<span className="ws-mono ws-muted">120ms</span>}
            />
            <Row
              label="Disclosure, sheet"
              hint="Anything that changes layout height."
              control={<span className="ws-mono ws-muted">180ms</span>}
            />
            <Row
              label="Tab and navigation change"
              hint="Immediate. A crossfade here regressed WebKitGTK scrolling once already."
              control={<span className="ws-mono ws-muted">0ms</span>}
            />
            <Row
              label="Card hover"
              hint="None. Cards do not respond to pointer transit."
              control={<StatusBadge tone="success">none</StatusBadge>}
            />
            <Row
              label="prefers-reduced-motion"
              hint="Every duration collapses to 1 ms."
              control={<StatusBadge tone="success">respected</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>
    </div>
  );
}
