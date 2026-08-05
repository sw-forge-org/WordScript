import { useState } from "react";
import {
  ActionNew,
  ActionRow,
  ActionsBody,
  ActionsDesk,
  ActionsEdit,
  ActionsFoot,
  ActionsList,
  ActionsRule,
  AiChatBody,
  AiChatFoot,
  Bubble,
  Button,
  Card,
  CardRows,
  ChatWinDeco,
  ChatWindow,
  DropZone,
  Enh,
  EnhAct,
  EnhItem,
  Field,
  FieldRow,
  FieldWrap,
  FloatBar,
  FolderRow,
  Folders,
  Icon,
  IconButton,
  Intake,
  IntakeLink,
  IntakeOr,
  Keycaps,
  LinkGroup,
  LinkRow,
  Menu,
  MicButton,
  Msg,
  Note,
  NoteBody,
  NoteDate,
  NoteTabs,
  Pane,
  PaneDetailHead,
  PaneDetailMain,
  PaneListFoot,
  PanePath,
  PaneRow,
  PaneScroll,
  PaneSearch,
  PaneSec,
  PaneSecHead,
  PreviewBanner,
  RecStart,
  Row,
  ScopeTag,
  SegmentControl,
  Select,
  Sources,
  SplitButton,
  StatusBadge,
  TextArea,
  TLine,
  Toggle,
  Transcript,
  Typing,
  ViewTop,
  WhoAdd,
  WhoChip,
  WhoChips,
} from "@/components/shell";
import { DESK, DESK_CAP } from "./data";
import { ACTIONS, CTX, FOLDERS } from "./contextData";
import type { ScreenProps } from "./props";

/**
 * CONTEXT — `SCREENS.context`, and its two other panels.
 *
 * ONE OBJECT TYPE. A meeting note, a dictation, an uploaded file and a fetched
 * link are the same record with different origins, so the queue Upload used to
 * own is this list filtered to the objects that are not ready yet: a file being
 * transcribed IS a context object without a transcript, and giving it a second
 * list was giving it a second identity.
 *
 * THREE PANELS OVER ONE OBJECT, and the thing you are asking about — or
 * running an action over, or adding to — is the thing behind them (§11.19).
 * `panel` picks which. The intake is a state of this screen rather than a place
 * beside it, which is why it renders in the same detail column and the rail
 * behind it keeps showing what is already running.
 *
 * `SCREENS.notes`, `SCREENS.noteactions` and `SCREENS.upload` are aliases of
 * the three, so a deep link survives the restructure (§4.3).
 */

type Tab = "Transcript" | "Notes" | "Summary" | "Linked";

const TABS: Array<{ id: Tab; icon: "list" | "notes" | "sparkle" | "layers" }> = [
  { id: "Transcript", icon: "list" },
  { id: "Notes", icon: "notes" },
  { id: "Summary", icon: "sparkle" },
  { id: "Linked", icon: "layers" },
];

const LINES = [
  { at: "00:12", who: "S1", tone: "a" as const, text: "Let’s ship the settings restructure today." },
  {
    at: "00:31",
    who: "S2",
    tone: "b" as const,
    text: "Agreed. Then review the overlay tab — the placement bug is still open.",
  },
  { at: "01:04", who: "S1", tone: "a" as const, text: "I’ll handle the Diagnostics sub-tabs.", marked: true },
  { at: "01:22", who: "S2", tone: "b" as const, text: "Can we decide the MCP server question this week?" },
  { at: "01:40", who: "S1", tone: "a" as const, text: "Not this week. It needs its own ADR." },
];

/** The rail is shared by the reading state and the intake state, because it is
 *  the same list either way — the intake is a thing you do TO this list, not a
 *  different collection. */
function ContextRail({ addOn }: { addOn?: boolean }) {
  return (
    <>
      <PaneSec>
        <PaneSecHead label="Folders" addLabel="New folder" />
        <Folders>
          {FOLDERS.map((folder) => (
            <FolderRow key={folder.name} name={folder.name} count={folder.n} current={folder.on} />
          ))}
        </Folders>
      </PaneSec>
      <PaneSec grow>
        <PaneSecHead label="Everything" addLabel="Add a recording, file or link" addOn={addOn} />
        <PaneSearch>
          <Field placeholder="Search transcripts, notes and people…" />
        </PaneSearch>
        <PaneScroll>
          {CTX.map((object) => (
            <PaneRow
              key={object.title}
              title={object.title}
              when={object.when}
              sub={object.sub}
              icon={object.icon}
              current={object.on && !addOn}
              badge={object.state}
            />
          ))}
        </PaneScroll>
      </PaneSec>
    </>
  );
}

/* ── The Ask window ─────────────────────────────────────────────────────────
   Its two shipped facts survive the move out of the old Chat screen: an answer
   names the rows it read, and voice input is the dictation hotkey rather than
   a second recording path. */
function AskWindow() {
  return (
    <ChatWindow>
      <ChatWinDeco title="Ask" onMinimize={() => undefined} onClose={() => undefined} />
      <AiChatBody>
        <Msg from="me">
          <Bubble>
            <p>Summarize what we discussed in today’s meetings.</p>
          </Bubble>
        </Msg>
        <Msg from="ws">
          <Bubble copyLabel="Copy message">
            <p>Based on today’s discussions:</p>
            <Enh>
              <EnhItem>Voice pipeline — ship by end of March</EnhItem>
              <EnhItem>UI redesign deferred post-pipeline</EnhItem>
              <EnhItem>Follow up with finance on the Q2 budget</EnhItem>
            </Enh>
            <Sources as="div" items={["Product Sync", "Weekly standup"]} />
          </Bubble>
        </Msg>
        <Typing />
      </AiChatBody>
      <AiChatFoot>
        Hold <kbd>Ctrl</kbd> <kbd>Space</kbd> to speak · nothing here is kept
      </AiChatFoot>
    </ChatWindow>
  );
}

/* ── The Actions window ───────────────────────────────────────────────────── */
function ActionsWindow() {
  /* The selected one is the desk action, because that is the half of this
     window that is new and the half whose extra fields have to be visible. */
  const selected = ACTIONS[4];
  const desk = selected.kind === "desk";

  return (
    <ChatWindow className="ws-actionswin">
      <ChatWinDeco
        title="Actions"
        sub={`6 · 2 built-in · 2 run on ${DESK}`}
        closeLabel="Close actions"
        onClose={() => undefined}
      />
      <ActionsBody>
        <ActionsList>
          {ACTIONS.filter((action) => action.kind !== "desk").map((action) => (
            <ActionRow
              key={action.name}
              icon={action.icon}
              name={action.name}
              description={action.desc}
              builtin={action.builtin}
              current={action === selected}
            />
          ))}
          <ActionsRule>Runs on {DESK}</ActionsRule>
          {ACTIONS.filter((action) => action.kind === "desk").map((action) => (
            <ActionRow
              key={action.name}
              icon={action.icon}
              name={action.name}
              description={action.desc}
              builtin={action.builtin}
              current={action === selected}
            />
          ))}
          <ActionNew>New action</ActionNew>
        </ActionsList>

        <ActionsEdit>
          <FieldWrap>
            <label>Name</label>
            <Field defaultValue={selected.name} />
          </FieldWrap>
          <FieldWrap>
            <label>Description</label>
            <Field defaultValue={selected.desc} />
          </FieldWrap>

          {/* WHO RUNS IT is the first decision, not a detail under the prompt:
              it changes what the prompt may ask for, how long it takes, and
              whether anything happens outside this window. */}
          <FieldWrap>
            <label>Runs on</label>
            <RunsOn desk={desk} />
          </FieldWrap>

          {desk && (
            <ActionsDesk>
              <FieldRow>
                <FieldWrap className="ws-grow">
                  <label>Target</label>
                  <Select defaultValue={selected.target} aria-label="Target">
                    <option>General</option>
                    <option>WordScript</option>
                    <option>dotfiles</option>
                    <option>sw-forge-org</option>
                  </Select>
                </FieldWrap>
                <FieldWrap className="ws-grow">
                  <label>Role</label>
                  <Select defaultValue={selected.role} aria-label="Role">
                    <option>inspect</option>
                    <option>work</option>
                    <option>resume</option>
                  </Select>
                </FieldWrap>
              </FieldRow>
              <Note icon="handoff">
                What the assistant collects out of the selected objects is assembled into the
                prompt below and handed over. Reading is the assistant{"'"}s half; the desk never
                searches for anything.
              </Note>
            </ActionsDesk>
          )}

          <FieldWrap>
            <label>Prompt</label>
            <TextArea
              rows={7}
              defaultValue={selected.prompt}
              placeholder={
                desk ? "What should the desk do, and with what?" : "What should the model do with this object?"
              }
            />
          </FieldWrap>
          <Note icon="file">
            {selected.file} — a file in the notes folder. Edit it here or in your editor; it is
            the same file.
          </Note>

          <ActionsFoot>
            {/* ADR 0030 puts a visible keyed confirmation before anything a
                process does in a real repository, and an action is not exempt
                just because the prompt was written in advance rather than
                dictated — if anything it is further from the user. */}
            {desk ? (
              <Button icon={<Icon name="handoff" />}>Hand over…</Button>
            ) : (
              <Button icon={<Icon name="play" />}>Run on this object</Button>
            )}
            <Button variant="ghost" icon={<Icon name="copy" />}>
              Duplicate
            </Button>
            <span className="ws-right">
              <IconButton label="Delete action" icon={<Icon name="trash" />} tone="danger" />
            </span>
          </ActionsFoot>
        </ActionsEdit>
      </ActionsBody>
    </ChatWindow>
  );
}

function RunsOn({ desk }: { desk: boolean }) {
  const [who, setWho] = useState(desk ? DESK_CAP : "The assistant");
  return (
    <SegmentControl
      aria-label="Runs on"
      value={who}
      onChange={setWho}
      options={[
        { value: "The assistant", label: "The assistant" },
        { value: DESK_CAP, label: DESK_CAP },
      ]}
    />
  );
}

/* ── The reading state ──────────────────────────────────────────────────── */

function ContextScreenBody({ panel, banner }: { panel: "ask" | "actions" } & ScreenProps) {
  const [tab, setTab] = useState<Tab>("Summary");

  return (
    <>
      <ViewTop
        title="Context"
        lead="Everything you have said, recorded or brought in — and what follows from it."
        banner={banner ?? <PreviewBanner>Planned for V2. Nothing on the Summary tab is wired.</PreviewBanner>}
      />
      <Pane
        list={
          <>
            <ContextRail />
            {/* `New note` was here and is gone. The section heads own their own
                additions, which is the pattern the whole rail is built on; a
                third button repeating one of them at the foot made the foot
                look like the place new things are made, and then contradicted
                itself by not offering a new folder. What is left is the one
                action the rail cannot express as an addition to a list. */}
            <PaneListFoot>
              <Button icon={<Icon name="users" />}>Record meeting</Button>
            </PaneListFoot>
            <PanePath path="~/Documents/WordScript/Meetings" onOpen={() => undefined} />
          </>
        }
        detail={
          <>
            <PaneDetailHead
              title="Product Sync"
              /* Two windows, two buttons, side by side — they open the same
                 kind of thing and are told apart by their names, not by their
                 behaviour. Export lost its label in the same pass: it is the
                 one control here that is neither a way of looking at the object
                 nor a window over it, and §11.28 says a labelled ghost button
                 has to earn its width against the row's own sentence. */
              actions={
                <>
                  <Button variant="ghost" icon={<Icon name="chat" />} on={panel === "ask"}>
                    Ask
                  </Button>
                  <Button variant="ghost" icon={<Icon name="template" />} on={panel === "actions"}>
                    Actions
                  </Button>
                  <IconButton label="Export" icon={<Icon name="download" />} />
                </>
              }
              tabs={<NoteTabs label="Context" items={TABS} value={tab} onChange={setTab} />}
            />
            <PaneDetailMain
              /* The menu is drawn closed here and open on the meeting HUD. It
                 was open on this screen and the list grew from four entries to
                 six, so it ran up behind the Ask window — two overlays at once,
                 which is a state nobody is ever in. */
              float={
                <FloatBar>
                  <MicButton label="Dictate into this note" />
                  <SplitButton action={ACTIONS[0].name} />
                </FloatBar>
              }
              overlay={panel === "actions" ? <ActionsWindow /> : <AskWindow />}
            >
              <NoteBody>
                <NoteDate from="· from Google Calendar">
                  Mar 11, 2026 · 12:04 · meeting · mic + system audio · 2 speakers
                </NoteDate>
                {tab === "Transcript" && <TranscriptTab />}
                {tab === "Notes" && <NotesTab />}
                {tab === "Summary" && <SummaryTab />}
                {tab === "Linked" && <LinkedTab />}
              </NoteBody>
            </PaneDetailMain>
          </>
        }
      />
    </>
  );
}

/**
 * PEOPLE ARE HERE, NOT ON A TAB OF THEIR OWN — and the chips carry the
 * speaker's status, which is the part the surface was missing entirely.
 *
 * Nothing in the audio produces a name (ADR 0047). The source separates you
 * from everyone else, clustering separates the others from each other, and a
 * name arrives from the calendar, from a click, or from a saved voice profile.
 * A chip therefore has to say which of those it is, because "Sarah" that was
 * guessed and "Sarah" that you confirmed behave differently: the guessed one is
 * replaced when the meeting ends and the clustering runs again over the whole
 * recording, and the confirmed one is not. Drawing them identically is how a
 * name silently changes after the fact.
 */
function TranscriptTab() {
  return (
    <>
      <div className="ws-rowflex">
        <span className="ws-search">
          <Icon name="search" />
          <Field placeholder="Find in this transcript…" />
        </span>
        <span className="ws-muted">5 lines · 2 speakers</span>
        <Button variant="ghost" icon={<Icon name="copy" />}>
          Copy
        </Button>
      </div>
      <WhoChips>
        <WhoChip name="You" how="mic" status="locked" />
        <WhoChip name="Sarah Chen" how="calendar" status="suggested" />
        <WhoChip name="Speaker 2" how="cluster" status="provisional" />
        <WhoAdd>Name a speaker</WhoAdd>
      </WhoChips>
      <Transcript>
        {LINES.map((line) => (
          <TLine
            key={line.at}
            at={line.at}
            who={line.who}
            tone={line.tone}
            text={line.text}
            marked={line.marked}
          />
        ))}
      </Transcript>
      <p className="ws-muted">Highlighted lines were marked during the meeting.</p>
    </>
  );
}

function NotesTab() {
  return (
    <>
      <TextArea
        rows={10}
        placeholder="Type while you listen…"
        defaultValue={
          "- ship voice pipeline by march\n- talk to design team re: new UI\n- budget Q: ask finance\n- settings restructure today, overlay tab after"
        }
      />
      {/* The prototype's copy switch defaults to its SHORT side, so the short
          sentence is the one that was drawn and accepted. */}
      <Note icon="about">Enhance reads this alongside the transcript. It never overwrites it.</Note>
    </>
  );
}

/**
 * Decisions, tasks and open questions stay SECTIONS of this tab rather than
 * becoming tabs of their own. What is new is that two of the three are now
 * connected to something outside the note: an open question can go to the
 * decision inbox because somebody is stuck on it, and a task can go to the
 * desk. Both are explicit gestures with a button; nothing on this tab reaches
 * out on its own.
 */
function SummaryTab() {
  return (
    <>
      <Enh title="Decisions">
        <EnhItem>
          Voice pipeline is the top priority — ship by end of March before any other workstream
        </EnhItem>
        <EnhItem>UI redesign deferred until the pipeline lands, to avoid splitting focus</EnhItem>
        <EnhItem>
          Dictionary feature approved: custom words for medical, legal and technical terms
        </EnhItem>
      </Enh>
      <Enh title="Tasks">
        <EnhAct>
          <b>Sarah</b> — frontend migration to the new component library, by end of sprint
        </EnhAct>
        <EnhAct>
          <b>Alex</b> — API refactor plus latency benchmarks, target sub-200 ms, currently ~280 ms
        </EnhAct>
        <EnhAct>
          <b>Gabriel</b> — follow up with finance on the Q2 budget, headcount approval by Friday
        </EnhAct>
        <EnhAct
          action={
            <Button variant="ghost" icon={<Icon name="handoff" />}>
              Hand to {DESK}
            </Button>
          }
        >
          Draft the migration plan from the three architecture notes and open a PR
        </EnhAct>
      </Enh>
      <Enh title="Open questions">
        <EnhAct
          action={
            <Button variant="ghost" icon={<Icon name="pending" />}>
              Send to inbox
            </Button>
          }
        >
          Q2 headcount budget — raised twice, still unanswered
        </EnhAct>
        <EnhAct>Real-time collaboration on notes — CRDT or OT? No timeline yet</EnhAct>
        <EnhAct>Third-party dependency audit needed before public open-sourcing</EnhAct>
      </Enh>
      <Note icon="eye">Derived from the transcript and your notes together.</Note>
    </>
  );
}

/**
 * LINKED — the relationships, at the object, and not as a graph (§11.42).
 *
 * A graph shows THAT things connect; the question a user actually arrives with
 * is WHAT connects, and that is a list. The entry point from the other
 * direction — every object touching one person or one project — is a filter on
 * the rail, not a second view.
 *
 * What is NOT here and says so: mail. It would be the obvious fifth group and
 * it is on the other side of the effect line (ADR 0046) — the desk reaches a
 * mailbox, WordScript does not read one.
 */
function LinkedTab() {
  return (
    <>
      <LinkGroup title="People">
        <LinkRow icon="user" name="Sarah Chen" meta="6 objects · from Google Calendar" />
        <LinkRow icon="user" name="Alex Rivera" meta="4 objects · named by you" />
        <LinkRow icon="user" name="Gabriel Ost" meta="2 objects · named by you" />
      </LinkGroup>
      <LinkGroup title="Before this">
        <LinkRow icon="users" name="Product Sync — 27 Jul" meta="same series · 2 decisions still open" />
        <LinkRow icon="users" name="Voice pipeline" meta="shares 3 topics and 2 people" />
      </LinkGroup>
      <LinkGroup title="Came out of it">
        <LinkRow icon="mic" name="Settings restructure" meta="dictation · 09:42 · inserted into the plan" />
        <LinkRow
          icon="file"
          name="03-0942-settings-restructure.md"
          meta="~/WordScript/transcripts/2026/08/"
        />
      </LinkGroup>
      <LinkGroup title="From the calendar">
        <LinkRow icon="calendar" name="Product Sync · weekly, Mon 10:30" meta="Google Calendar · read-only" />
      </LinkGroup>
      <Note icon="local">Computed on this machine. Nothing was fetched to build this.</Note>
    </>
  );
}

/* ── Context · intake ─────────────────────────────────────────────────────── */

type Way = "Write" | "Record" | "Import";

/**
 * THREE WAYS IN, AND THEY ARE GENUINELY THREE. The segment is not a filter or
 * a preference; each one produces a different object from a different source,
 * and the controls under it have nothing in common:
 *
 *   Write    an empty object. Type into it, or hold the dictation key and talk
 *            into it. Nothing is transcribed because nothing was recorded — the
 *            words arrive as words.
 *   Record   a meeting, live, in the HUD. The only one that opens another
 *            window, because a capture that lasts an hour cannot be operated
 *            from a settings-shaped panel (§10.4).
 *   Import   a file you have or a link you can reach — §11.24's two equal
 *            intakes with §11.25's batch decisions under them.
 *
 * THE SEGMENT IS NOT INERT, for the same reason the connection lane is not
 * (§11.38): it decides what is being made, so a switch that left the panel
 * identical would assert the three ways are one thing with three names.
 */
export function ContextIntakeScreen() {
  const [way, setWay] = useState<Way>("Write");

  return (
    <>
      <ViewTop
        title="Context"
        lead="Everything you have said, recorded or brought in — and what follows from it."
        banner={<PreviewBanner>Planned for V2.</PreviewBanner>}
      />
      <Pane
        list={
          <>
            <ContextRail addOn />
            <PaneListFoot>
              <Button icon={<Icon name="users" />}>Record meeting</Button>
            </PaneListFoot>
            <PanePath path="~/Documents/WordScript/Meetings" onOpen={() => undefined} />
          </>
        }
        detail={
          <>
            <PaneDetailHead
              title="New"
              actions={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Back to reading
                </Button>
              }
              tabs={
                <SegmentControl
                  aria-label="Intake"
                  value={way}
                  onChange={setWay}
                  options={[
                    { value: "Write", label: "Write" },
                    { value: "Record", label: "Record" },
                    { value: "Import", label: "Import" },
                  ]}
                />
              }
            />
            <PaneDetailMain>
              <NoteBody className="ws-intake-body">
                {way === "Write" && <WriteWay />}
                {way === "Record" && <RecordWay />}
                {way === "Import" && <ImportWay />}
                <Note icon="list">
                  What is running is in the list on the left with its state on the row. There is
                  no second queue: a file being transcribed is a context object without a
                  transcript yet.
                </Note>
              </NoteBody>
            </PaneDetailMain>
          </>
        }
      />
    </>
  );
}

/**
 * No card and no form. A blank object is a title and a body, and every row of
 * chrome between the button and the first word is a reason not to have pressed
 * the button. The two decisions that do apply — where it lands and whose
 * vocabulary runs — are one line under the editor, not a settings block above
 * it.
 */
function WriteWay() {
  return (
    <>
      <div className="ws-write-head">
        <Field className="ws-write-title" placeholder="Untitled" />
        <span className="ws-write-meta">
          Nothing is recorded. What you type and what you dictate both arrive as text.
        </span>
      </div>
      <TextArea rows={12} placeholder="Start typing, or hold Ctrl+Space and talk." />
      {/* A plain key display, not the hotkey editor: that one carries a
          `Change` affordance, which here would offer to rebind the dictation
          shortcut from inside a text editor. */}
      <div className="ws-write-foot">
        <span className="ws-rowflex">
          <Icon name="mic" />
          <Keycaps combo="Ctrl+Space" />
          <span className="ws-muted">to dictate into it</span>
        </span>
        <span className="ws-right ws-rowflex">
          <Select defaultValue="Meetings" aria-label="Folder">
            <option>Personal</option>
            <option>Meetings</option>
            <option>Work</option>
          </Select>
          <Select defaultValue="General writing" aria-label="Profile">
            <option>General writing</option>
            <option>Support reply</option>
          </Select>
        </span>
      </div>
    </>
  );
}

function RecordWay() {
  return (
    <>
      <RecStart
        title="Record a meeting"
        actions={
          <>
            <Button icon={<Icon name="users" />}>Start recording</Button>
            <Button variant="ghost" icon={<Icon name="arrow" />}>
              What it captures
            </Button>
          </>
        }
      >
        Opens the meeting window: your microphone, the system audio, and the note filling in
        while people talk. It never inserts anything anywhere.
      </RecStart>
      <Card>
        <CardRows>
          <Row
            label="Acme — quarterly review"
            hint="14:00, in 2 h · 4 attendees · from Google Calendar. Recording it fills in the transcript; the object already exists."
            control={
              <Button variant="ghost" icon={<Icon name="play" />}>
                Record this
              </Button>
            }
          />
        </CardRows>
      </Card>
      <Note icon="calendar">
        A meeting on a connected calendar is already in the list on the left, with its attendees
        and the questions the last one left open.
      </Note>
    </>
  );
}

function ImportWay() {
  const [speakers, setSpeakers] = useState(true);
  return (
    <>
      <Intake>
        <DropZone
          band
          title="Drop audio or video, or click to browse"
          hint="MP3, WAV, M4A, WebM, OGG, FLAC · up to 25 MiB per file on your Free plan"
        />
        <IntakeOr />
        <IntakeLink label="Paste a link">
          <div className="ws-rowflex">
            <span className="ws-search ws-grow">
              <Field placeholder="YouTube, podcast episode or direct audio URL" />
            </span>
            <Button icon={<Icon name="download" />}>Fetch</Button>
          </div>
          <p className="ws-intake-hint">
            WordScript resolves the media stream. Nothing is kept but the audio it needs and the
            transcript it produces.
          </p>
        </IntakeLink>
      </Intake>

      <Card>
        <CardRows>
          <Row
            label="Speaker detection"
            hint="Labels each turn by speaker. A second pass — off for one voice."
            control={<Toggle checked={speakers} onCheckedChange={setSpeakers} aria-label="Speaker detection" />}
          />
          <Row
            label="Folder"
            hint="Where the finished object lands."
            control={
              <Select defaultValue="Meetings" aria-label="Folder">
                <option>Personal</option>
                <option>Meetings</option>
                <option>Work</option>
              </Select>
            }
          />
          <Row
            label="Profile"
            hint="Whose vocabulary and replacements run over every transcript."
            control={
              <>
                <Select defaultValue="General writing" aria-label="Profile">
                  <option>General writing</option>
                  <option>Support reply</option>
                  <option>Customer success replies</option>
                </Select>
                <ScopeTag profile="this batch" onOpen={() => undefined} />
              </>
            }
          />
        </CardRows>
      </Card>

      {/* `Write a note` was a fourth decision here and is withdrawn with the
          thing it decided. It asked whether the transcript should also become a
          note — a question that only existed while a transcript and a note were
          two objects. */}
      <Note icon="layers">
        “Write a note” is gone — the file and the note about it are one object.
      </Note>
    </>
  );
}

export function ContextScreen({ banner }: ScreenProps = {}) {
  return <ContextScreenBody panel="ask" banner={banner} />;
}

export function ContextActionsScreen() {
  return <ContextScreenBody panel="actions" />;
}
