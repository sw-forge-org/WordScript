import { useState, type CSSProperties } from "react";
import type { PopoutHandle } from "@/components/shell";
import { ACTION_MENU } from "./contextData";
import {
  Button,
  Card,
  CardRows,
  Copilot,
  Enh,
  EnhItem,
  FloatBar,
  HotkeyButton,
  Hud,
  HudCap,
  HudDeco,
  HudElapsed,
  HudHead,
  HudRow,
  HudScroll,
  HudState,
  HudTabs,
  HudTitle,
  HudWrap,
  Icon,
  Matrix,
  Menu,
  MicButton,
  Note,
  NoteDate,
  NoteTabs,
  PreviewBanner,
  Readout,
  Row,
  ScopeTag,
  SectionHeader,
  Select,
  SplitButton,
  StageList,
  StageRow,
  StatusBadge,
  StatusDot,
  Stepper,
  TLine,
  Toggle,
  Transcript,
  ViewTop,
} from "@/components/shell";

/**
 * MEETING CAPTURE — `SCREENS.meeting`.
 *
 * ONE WINDOW, DRAWN IN THE THREE STATES THAT CARRY THE ARGUMENT: what it looks
 * like while the meeting runs (Summary), what it looks like while you are
 * writing in it (Notes, with the action menu open), and what it looks like on
 * the record itself (Transcript, with one copilot hint). Same window, same
 * width, same bar. `Enhanced` was renamed to `Summary` with the tab in Context,
 * so the two surfaces still teach one vocabulary (§11.41).
 *
 * THE LEVEL READOUT IS DRAWN AT REST (ADR 0058). The prototype animates it from
 * a synthetic envelope, because a window whose whole claim is that it is
 * recording right now cannot carry a frozen waveform. A gallery screen measures
 * nothing, so it holds one frame — and it holds a frame rather than an empty
 * grid, because the argument the screen is making is that a 16 × 7 meter at a
 * 2 px pixel still reads as a meter.
 */

const LINES = [
  {
    at: "11:48",
    who: "S2",
    tone: "b" as const,
    text: "…so the placement bug is still open on the second monitor.",
  },
  {
    at: "11:57",
    who: "S1",
    tone: "a" as const,
    text: "Right, I’ll take the Diagnostics sub-tabs this week.",
  },
  {
    at: "12:04",
    who: "S2",
    tone: "b" as const,
    text: "Can we decide the MCP server question before Friday?",
  },
];

const HUD_TABS = [
  { id: "Transcript" as const },
  { id: "Notes" as const },
  { id: "Summary" as const, icon: "sparkle" as const },
];

/* THE MENU IS DERIVED AND NO LONGER WRITTEN TWICE. A hand-kept list of four
   stood here and had already drifted from `ACTIONS`, which the Actions window
   edits — two lists for one fact, which ADR 0123 says to replace with a link.
   It carries the rule the window carries (§11.43): the last entries run
   somewhere else, for minutes, and do something. Right after a meeting is
   exactly when one of those gets picked. */
/* THE LEVEL IS AT REST, AND IT IS THE ONE THING ON THIS SCREEN THAT IS.
   ADR 0058: a moving instrument is a claimed measurement. The prototype drives
   this readout from `orbEnvelope` at 12 fps because it has no microphone and a
   window whose whole claim is that it is recording cannot carry a frozen
   waveform; the gallery measures nothing, so it sits at zero — the same value
   Leg 2c gave the orb on Agents, and for the same reason. The unlit grid is
   still drawn, which is what makes a mostly-off display read as a display.

   The mic button beside it is a different kind of thing and follows the
   prototype: `data-live` is a colour, not a generator. It states which control
   is the running one in a window whose elapsed time and red dot are already
   sample data (ADR 0055). What must not be faked is a reading, and a tinted
   button is not one. */
const LEVEL_AT_REST = new Array(16).fill(0);

type HudTab = "Transcript" | "Notes" | "Summary";

/**
 * EXPORTED SINCE 2026-08-14, so `Record meeting` in Context can raise the real
 * window instead of describing one. It is the same specimen either way — this
 * screen stands three of them side by side in flow, and Context floats one over
 * the object; `popout` and `onClose` are what tell them apart, and neither adds
 * a state the window did not already have.
 */
export function MeetingHud({
  tab,
  menu,
  copilot,
  popout,
  onClose,
  bare,
}: {
  tab: HudTab;
  menu?: boolean;
  copilot?: { text: string; source: string };
  popout?: { style?: CSSProperties; handle: PopoutHandle };
  onClose?: () => void;
  /** In its own OS window: the compositor draws the frame, so the stand-in
   *  strip goes rather than being drawn a second time. */
  bare?: boolean;
}) {
  /* `menu` opens it for the three specimens this screen stands side by side —
     one of them exists to show the menu open. `liveMenu` is the caret actually
     working, which the specimens never needed and a real window does. */
  const [liveMenu, setLiveMenu] = useState(false);

  return (
    <Hud className={popout ? "ws-hud-popout" : undefined} style={popout?.style}>
      {!bare && (
        <HudDeco
          handle={popout?.handle}
          actions={
            onClose && (
              <button type="button" aria-label="Close the meeting window" onClick={onClose}>
                <Icon name="x" />
              </button>
            )
          }
        >
          native window decoration — drawn by the OS
        </HudDeco>
      )}
      <HudHead>
        {/* Two rows, as in the pane and for the same measured reason: at the
            HUD's 330 px the three tabs and the title cannot share a line, and
            adding the calendar origin to the date line is what finally proved
            it — the tabs were painting over "from Google Calendar". */}
        <HudTitle
          title="Sprint Planning"
          date={<NoteDate from="· from Google Calendar">Mar 11, 2026</NoteDate>}
        />
        <HudTabs>
          <NoteTabs label="Meeting note" items={HUD_TABS} value={tab} onChange={() => undefined} />
        </HudTabs>
        {/* THE ONE LEVEL READOUT IN THE PRODUCT, AND THIS IS WHERE IT LIVES.
            It is the matrix and not the waveform, and the reason is the width:
            the state line is ~70 px of spare run inside a 330 px window. A
            waveform trace in 70 px is a texture; a 7-row quantised meter is
            still a meter. 16 × 7 at a 2 px pixel is 47 × 20 — the height of
            the line it sits in. */}
        <HudState>
          <StatusDot tone="danger" />
          <HudElapsed>12:04</HudElapsed>
          <span>·</span>
          <span>2 of 4 speaking</span>
          <span>·</span>
          <span>mic + system</span>
          <span className="ws-grow" />
          <Matrix
            mode="vu"
            levels={LEVEL_AT_REST}
            rows={7}
            cols={16}
            size={2}
            gap={1}
            ariaLabel="Input level"
          />
        </HudState>
      </HudHead>

      <HudScroll>
        {tab === "Summary" && (
          <>
            <Enh title="Decisions">
              <EnhItem>
                Voice pipeline is the top priority — ship by end of March before any other
                workstream
              </EnhItem>
              <EnhItem>
                UI redesign deferred until the pipeline lands, don’t want to split focus
              </EnhItem>
              <EnhItem>
                Dictionary feature approved: custom words for medical, legal and technical terms
              </EnhItem>
            </Enh>
            <Enh title="Action items">
              <EnhItem>
                <b>Sarah</b> — frontend migration to the new component library by end of sprint
              </EnhItem>
              <EnhItem>
                <b>Alex</b> — API refactor plus latency benchmarks, target sub-200 ms, currently
                ~280 ms
              </EnhItem>
              <EnhItem>
                <b>Gabriel</b> — follow up with finance on the Q2 budget, headcount approval by
                Friday
              </EnhItem>
            </Enh>
            <Enh title="Open questions">
              <EnhItem>Real-time collaboration on notes — CRDT or OT? No timeline yet</EnhItem>
              <EnhItem>Third-party dependency audit needed before public open-sourcing</EnhItem>
            </Enh>
          </>
        )}
        {tab === "Notes" && (
          <Readout>
            {"- ship voice pipeline by march\n- talk to design team re: new UI\n- budget Q: ask finance"}
          </Readout>
        )}
        {tab === "Transcript" && (
          <Transcript>
            {LINES.map((line) => (
              <TLine key={line.at} at={line.at} who={line.who} tone={line.tone} text={line.text} />
            ))}
          </Transcript>
        )}
      </HudScroll>

      {copilot && <Copilot text={copilot.text} source={copilot.source} />}

      <FloatBar>
        <MicButton label="Dictate into this note" live />
        <SplitButton
          action={menu ? "Sync template" : "Stop and save"}
          menu={
            menu || liveMenu ? (
              <Menu items={ACTION_MENU} deskLabel="Runs on the desk" />
            ) : undefined
          }
          onToggleMenu={() => setLiveMenu((open) => !open)}
        />
      </FloatBar>
    </Hud>
  );
}

export function MeetingScreen() {
  const [copilotOn, setCopilotOn] = useState(false);

  return (
    <>
      <ViewTop
        title="Meeting capture"
        lead="A recording that lasts an hour, inserts nothing, and ends as a note."
        banner={<PreviewBanner>Planned for V2. No system audio is captured today.</PreviewBanner>}
      />

      {/* The window IS the note. The first sketch made it a strip of transcript
          with a quick-note field beside it — a control panel for a recorder.
          Wrong object: during a call you are not operating a recording, you are
          reading and writing the note the call is producing. */}
      <SectionHeader
        title="The window"
        description="It is the object, live. Same tabs it has in Context afterwards."
      >
        <HudRow>
          <HudWrap>
            <MeetingHud tab="Summary" />
            <HudCap>
              <b>While it runs</b> · 330 × 560, resizable, always on top, and excluded from screen
              shares
            </HudCap>
          </HudWrap>
          <HudWrap>
            <MeetingHud tab="Notes" menu />
            <HudCap>
              <b>Writing in it</b> · the bar's chevron opens what else can be made from this object
            </HudCap>
          </HudWrap>
          <HudWrap>
            <MeetingHud
              tab="Transcript"
              copilot={{
                text: "Budget was left open on Monday too, and nobody has named an owner yet.",
                source: "Product Sync · 27 Jul · 14:02",
              }}
            />
            <HudCap>
              <b>The record, and a hint</b> · timestamps, speakers, and one thing the copilot
              noticed
            </HudCap>
          </HudWrap>
        </HudRow>
        <Note icon="eye">
          Drawn, not screenshotted. The sizes are the proposal; the dictation overlay's 440 × 60 is
          measured from tauri.conf.json and is a different window.
        </Note>
      </SectionHeader>

      {/* The most speculative surface in this prototype, and the one with the
          worst failure mode, so it is drawn with its limits rather than with
          its possibilities. */}
      <SectionHeader
        title="The copilot"
        description="One line above the bar. It notices things and it is wrong sometimes, which is why every rule below exists."
      >
        <Card>
          <CardRows>
            <Row
              label="It never speaks"
              hint="There is one spoken path in this product and it is the desk's, guarded and rate-limited. A second voice over a live call would also be talking into a microphone that is recording."
              control={<StatusBadge tone="success">Writes only</StatusBadge>}
            />
            <Row
              label="It never hints without a source"
              hint="The citation is part of the hint and clicking it opens the line it came from. ADR 0040 made this a contract for the assistant; a hint arriving mid-meeting is the highest-cost place in the product to be confidently wrong."
              control={<StatusBadge tone="success">Always cited</StatusBadge>}
            />
            <Row
              label="One at a time"
              hint="It replaces rather than stacks. A list of hints is something to read, and reading it is time not spent in the conversation."
              control={<StatusBadge tone="plan">Replaces</StatusBadge>}
            />
            <Row
              label="What it is allowed to notice"
              hint="Contradictions against earlier objects, questions raised and not answered, and a topic on the invite's agenda that has not come up. Not sentiment, not coaching, not how the meeting is going."
              control={<StatusBadge tone="plan">3 kinds</StatusBadge>}
            />
            <Row
              label="What it costs"
              hint="One index lookup per finished turn — not a continuous comparison — and a model only when something clears the bar. It stays off by default because it is sometimes wrong mid-call, which is the expensive place to be wrong, not because of what it costs."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Per turn</StatusBadge>
                  <Toggle checked={copilotOn} onCheckedChange={setCopilotOn} aria-label="Copilot" />
                </span>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* Three stages, worth separating on the surface because they fail
          differently and because the third one is not a model at all. Read out
          of the donors rather than invented. */}
      <SectionHeader
        title="Where a speaker's name comes from"
        description="Three stages, and only the first two are audio. A name is never in the recording."
      >
        <Card
          body={
            <StageList>
              <StageRow n="1" title="Source" tag="SimpleDiarizer · free">
                Your microphone is you; system audio is everyone else. No model, no error worth
                speaking of — and this alone already separates you from the room.
              </StageRow>
              <StageRow n="2" title="Cluster" tag="ECAPA-TDNN · a second pass">
                Voice embeddings, compared against each other, group the remaining turns into
                distinct speakers. This produces Speaker 1 and Speaker 2 — a count and a
                separation, never an identity.
              </StageRow>
              <StageRow n="3" title="Name" tag="not audio at all">
                Comes from the calendar's attendee list, from a saved voice you labelled before,
                or from you clicking one. Nothing in an audio stream produces a name.
              </StageRow>
            </StageList>
          }
        >
          <CardRows>
            <Row
              label="A name you set is never overwritten"
              hint="Clustering runs again when the call ends, over the whole recording instead of the live window, and it renumbers freely. A name you confirmed is locked against that pass — otherwise every name typed during a call changes after it, which is worse than offering no names."
              control={<StatusBadge tone="accent">locked survives</StatusBadge>}
            />
            <Row
              label="The echo problem is real and is upstream of all three"
              hint="The microphone hears the speakers, so a remote voice arrives on both streams and stage 1 attributes part of it to you. Cancellation runs before any of this; what leaks through is caught by comparing the two streams for overlapping text."
              control={<StatusBadge tone="plan">Before stage 1</StatusBadge>}
            />
            <Row
              label="Expected speakers"
              hint="From the invite when there is one, and settable when there is not. Clustering with a known count is a materially easier problem than clustering without one."
              control={
                <span className="ws-rowflex">
                  <Stepper value={4} aria-label="Expected speakers" />
                  <ScopeTag profile="from the invite" onOpen={() => undefined} />
                </span>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="The bar" description="Two things you do to a note, at every scroll position.">
        <Card>
          <CardRows>
            <Row
              label="Talk to it"
              hint="The same hotkey as dictation. It writes into the note instead of into another app — nothing is inserted anywhere while a meeting runs."
              control={
                <span className="ws-rowflex">
                  <HotkeyButton combo="Ctrl+Super" />
                  <MicButton label="Dictate" live />
                </span>
              }
            />
            <Row
              label="Make something of it"
              hint="One default action, the rest behind the chevron. A select would make you choose before you can act."
              control={<StatusBadge tone="plan">3 actions</StatusBadge>}
            />
            <Row
              label="Stop"
              hint="Ends the capture and keeps the note. It is the default action while recording, and becomes Sync template once the call is over."
              control={<StatusBadge tone="accent">primary while live</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* The table is the point of the screen. Without it, "a bigger overlay"
          is exactly the thing §1 forbids and §10.3 proved impossible. With it,
          the two windows are visibly different objects with different
          obligations. */}
      <SectionHeader title="Why this is not the dictation overlay">
        <Card>
          <CardRows>
            <Row
              label="Focus"
              hint="The pill must never take focus — that would move the insert target away from the app being dictated into. A meeting inserts nothing, so there is no target to protect."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">pill: never</StatusBadge>
                  <StatusBadge tone="accent">meeting: may</StatusBadge>
                </span>
              }
            />
            <Row
              label="Size"
              hint="440 × 60 is a pill above the work. A transcript read for an hour is not a pill."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">pill: fixed</StatusBadge>
                  <StatusBadge tone="accent">meeting: resizable</StatusBadge>
                </span>
              }
            />
            <Row
              label="Lifetime"
              hint="Seconds against the length of a call."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">pill: seconds</StatusBadge>
                  <StatusBadge tone="accent">meeting: the call</StatusBadge>
                </span>
              }
            />
            <Row
              label="Audio"
              hint="The pill records you. A meeting records you and the room, which means the microphone hears the speakers and the echo has to come back out."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">pill: mic</StatusBadge>
                  <StatusBadge tone="accent">meeting: mic + system</StatusBadge>
                </span>
              }
            />
            <Row
              label="Ends in"
              hint="Text at your cursor against a note you can read afterwards."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">pill: insert</StatusBadge>
                  <StatusBadge tone="accent">meeting: a note</StatusBadge>
                </span>
              }
            />
            <Row
              label="Screen share"
              hint="A window that floats over a call being shared must not appear in the share or in the recording. The pill never had this problem."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">pill: visible</StatusBadge>
                  <StatusBadge tone="success">meeting: excluded</StatusBadge>
                </span>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="What it captures">
        <Card>
          <CardRows>
            <Row
              label="Your microphone"
              hint="The same device the next dictation would use."
              control={<StatusBadge tone="plan">Required</StatusBadge>}
            />
            <Row
              label="System audio"
              hint="Everyone else, as the machine plays them. No participant joins the call."
              control={<StatusBadge tone="plan">Required</StatusBadge>}
            />
            <Row
              label="Echo cancellation"
              hint="The microphone hears the speakers, so every remote voice arrives twice. It is removed from the system stream before transcription."
              control={<StatusBadge tone="plan">Required</StatusBadge>}
            />
            <Row
              label="Speakers"
              hint="Separated as it runs and re-clustered when it ends. The count comes from the invite when there is one."
              control={<Stepper value={4} aria-label="Speakers" />}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="How it starts and where it goes">
        <Card>
          <CardRows>
            <Row
              label="It already existed"
              hint="A meeting on a connected calendar is a context object before anyone presses anything — with its name, its time, its attendees and the questions the last one in the series left open. Recording fills in the transcript; it does not create the object."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open Context
                </Button>
              }
            />
            <Row
              label="Meeting hotkey"
              hint="Its own key. Dictation and meeting capture must never be the same press — one inserts and one does not."
              control={<HotkeyButton combo="" />}
            />
            <Row
              label="When a call is detected"
              hint="Offer to record, in a window rather than an OS notification, so it is visible in Focus mode and absent from a share. With a calendar connected, the offer can name the meeting instead of asking what this is."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="warning">Open decision</StatusBadge>
                  <Select defaultValue="Ask" aria-label="When a call is detected">
                    <option>Ask</option>
                    <option>Start recording</option>
                    <option>Do nothing</option>
                  </Select>
                </span>
              }
            />
            <Row
              label="It becomes readable"
              hint="The same object, no longer live. Nothing is migrated and nothing is created — the window simply stops being the way you look at it."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open Context
                </Button>
              }
            />
            <Row
              label="The audio afterwards"
              hint="It goes when nothing needs it any more: the meeting ended, a transcript exists, and neither the notes pass nor the speaker pass is still reading it. A meeting that failed keeps its recording either way."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Until nothing needs it</StatusBadge>
                  <Button variant="ghost" icon={<Icon name="arrow" />}>
                    Notes &amp; Meetings
                  </Button>
                </span>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <Note icon="about">
        This screen proposes product. It is here so the direction is written down and argued with,
        not so it is built from — no roadmap phase is pulled forward by drawing it.
      </Note>
    </>
  );
}
