import { useState } from "react";
import {
  Button,
  Card,
  CardRows,
  Command,
  Disclosure,
  Field,
  Icon,
  ListItem,
  ListRows,
  McpList,
  McpRow,
  Message,
  Note,
  Orb,
  OrbDemo,
  OrbFigure,
  PreviewBanner,
  ProviderMark,
  Row,
  Select,
  StatusBadge,
  SubTabs,
  Thread,
  ViewTop,
} from "@/components/shell";
import { InertSegment, InertToggle } from "./Models";
import { DESK_CAP, DESK_VOICE_PRESET } from "./data";
import { modelId } from "@/lib/modelCatalogue";
import type { ScreenProps } from "./props";

/**
 * AGENTS — `SCREENS.agents`.
 *
 * Three things were tangled here in the first build. They are separated onto
 * their own tabs, and the disambiguation is stated rather than implied:
 *
 *   The desk  — the one process WordScript starts and talks to. It is
 *               WordScript's only client (ADR 0030).
 *   Targets   — the repositories it works in, each with a role.
 *   Voice     — how a question reaches you and how your answer returns.
 *
 * None of this is the Draft mode in AI Models. And per ADR 0030 the bridge is a
 * DELIVERY target, not a processing mode: the pill shows `Agent` where the mode
 * would otherwise stand, which is why it appears in Delivery & Insert and not
 * in the mode list.
 *
 * The first tab was called `Orchestrator`, which is what the thing is and not
 * what anyone calls it (§11.44). The section stays `Agents`, because that is
 * what the user came here about — the desk is the answer to it, not the
 * subject.
 */
export function AgentsScreen({ banner }: ScreenProps = {}) {
  const [tab, setTab] = useState(DESK_CAP);

  return (
    <>
      <ViewTop
        title="Agents"
        lead="Coding agents that ask you out loud, and the one process that speaks for them."
        banner={banner ?? <PreviewBanner>Planned for Phase 8.</PreviewBanner>}
        tabs={
          <SubTabs
            items={[
              { id: DESK_CAP, label: DESK_CAP },
              { id: "Targets", label: "Targets" },
              { id: "Voice", label: "Voice" },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      {tab === DESK_CAP && <Desk />}
      {tab === "Targets" && <Targets />}
      {tab === "Voice" && <Voice />}
    </>
  );
}

function Desk() {
  return (
    <>
      <Card
        title={DESK_CAP}
        description="One process. It drives the coding agents, and for them it is the human."
      >
        <CardRows>
          <Row
            label="Harness"
            hint="Which agent CLI runs as the desk. Presets carry the command, the roles and the environment each one needs."
            control={
              <Select defaultValue="Claude Code" aria-label="Harness">
                <option>Claude Code</option>
                <option>Codex CLI</option>
                <option>Gemini CLI</option>
                <option>opencode</option>
                <option>Custom command</option>
              </Select>
            }
          />
          <Row
            label="Command"
            control={<span className="ws-mono ws-muted">claude --print --permission-mode plan</span>}
          />
          <Row label="Status" control={<StatusBadge tone="plan">Not configured</StatusBadge>} />
          <Row
            label="Answer budget"
            hint="How long await may block before the caller is told nobody answered."
            control={
              <span className="ws-rowflex">
                <Field defaultValue="90" w="56px" aria-label="Answer budget" />
                <span className="ws-muted">s</span>
              </span>
            }
          />
          <Row
            label="Spoken questions"
            hint="One open question at a time, so an answer belongs to it by construction."
            control={<StatusBadge tone="plan">Serial</StatusBadge>}
          />
        </CardRows>
      </Card>

      {/* WHICH MODEL THE DESK RUNS, AND WHY IT IS NOT SET HERE — §11.45. This
          card exists because its absence was being read as an oversight. ADR
          0042 put every model choice in the product on one surface, and the
          desk's own model is genuinely not one of them: it is a setting of
          somebody else's program. Stating that is the same move as the "Runs no
          model" group on AI Models — an absence answers nothing. */}
      <Card
        title="Its own model"
        description="The desk is a program you chose. Its model is its own setting, not ours."
      >
        <CardRows>
          <Row
            label="Currently"
            hint="Read from the harness configuration in the directory below. WordScript reports it and does not set it."
            control={
              <span className="ws-rowflex">
                <ProviderMark name="anthropic" />
                <span className="ws-mono ws-muted">{modelId("anthropic-chat-opus")}</span>
                <StatusBadge tone="plan">read-only</StatusBadge>
              </span>
            }
          />
          <Row
            label="Changing it"
            hint="Edit it where it lives, then restart the desk. A running process does not re-read its configuration, and pretending otherwise would be the worst kind of fake readiness."
            control={<StatusBadge tone="warning">Needs a restart</StatusBadge>}
          />
          <Row
            label="Every other model in the product"
            hint="Dictation, meetings, cleanup, translate, the assistant and the voice are all on one surface, and this row is the documented exception to that."
            control={
              <Button variant="ghost" icon={<Icon name="arrow" />}>
                Open AI Models
              </Button>
            }
          />
        </CardRows>
      </Card>

      {/* THE DOOR INTO THE DIRECTORY — §11.45. ADR 0030 forbids REBUILDING the
          CLI's controls in the overlay. A button that opens the real directory
          rebuilds nothing — it hands over the original.

          ONE HONESTY THIS SURFACE OWES: the running desk is headless, so there
          is no terminal to reveal. What the button opens is a SECOND session in
          the same directory, and it is not the process answering questions. */}
      <Card
        title="Its directory"
        description="WordScript makes this folder and generates one file in it. The rest is the harness's."
      >
        <CardRows>
          <Row layout="stack" label="Where it is">
            <Command>~/.local/state/wordscript/desk/</Command>
          </Row>
          <Row
            label="Open a terminal here"
            hint="A new interactive session in this folder — for editing configuration, adding MCP servers, or running the harness by hand. It is not the running desk: that one is headless and has no terminal to show."
            control={
              <Button variant="ghost" icon={<Icon name="terminal" />}>
                Open terminal
              </Button>
            }
          />
          <Row
            label="Open the folder"
            hint="The same directory in your file manager."
            control={
              <Button variant="ghost" icon={<Icon name="folderOpen" />}>
                Show
              </Button>
            }
          />
          <Row
            label="Instruction file"
            hint="WordScript rewrites only the region between its two markers — the target list, the delegation rule, the rules on asking. Everything outside it is yours and is never touched."
            control={
              <span className="ws-rowflex">
                <StatusBadge tone="plan">2 regions</StatusBadge>
                <Button variant="ghost" icon={<Icon name="file" />}>
                  Edit
                </Button>
              </span>
            }
          />
          <Row
            label="Restart it"
            hint="Picks up everything changed in here. It also costs the context it has built: a desk that has been running for days filters well because it knows the recent decisions, and a fresh one does not."
            control={
              <span className="ws-rowflex">
                <StatusBadge tone="warning">Loses its context</StatusBadge>
                <Button variant="ghost" icon={<Icon name="restore" />}>
                  Restart
                </Button>
              </span>
            }
          />
        </CardRows>
      </Card>

      <Card
        title="What it can reach"
        description="The desk carries its own connectors. WordScript reads that list and does not write it."
      >
        <CardRows>
          <Row
            label="Who runs these"
            hint="The desk's own process, under its own permissions, from its own configuration file. WordScript never calls them and cannot see what they returned."
            control={<StatusBadge tone="plan">Not WordScript</StatusBadge>}
          />
          <Row
            label="Adding one"
            hint="Open the terminal above and configure it the way that harness documents. A second editor here would be a connector surface to maintain, and maintaining connectors is what using a real agent CLI avoids."
            control={
              <Button variant="ghost" icon={<Icon name="terminal" />}>
                Open terminal
              </Button>
            }
          />
          <Row
            label="What WordScript reads by itself"
            hint="Calendars, and nothing else. That one is an intake — it makes a meeting have a name and attendees before it starts — and it never writes."
            control={
              <Button variant="ghost" icon={<Icon name="arrow" />}>
                Open Integrations
              </Button>
            }
          />
        </CardRows>
        <McpList>
          <McpRow
            name="WordScript"
            verbs="ask · await"
            where="loopback"
            owner="ours"
            why="This is how it reaches you. Issued and rotated by WordScript."
          />
          <McpRow
            name="Gmail"
            verbs="read · send"
            where="network"
            owner="theirs"
            why="Sends mail as you. Nothing about this path is local."
          />
          <McpRow
            name="Google Calendar"
            verbs="read · write"
            where="network"
            owner="theirs"
            why="Writes events. WordScript's own calendar intake is read-only and separate."
          />
          <McpRow
            name="GitHub"
            verbs="read · write"
            where="network"
            owner="theirs"
            why="Opens issues and pull requests in your name."
          />
          <McpRow
            name="Filesystem"
            verbs="read · write"
            where="local"
            owner="theirs"
            why="Scoped to the target directories you configured."
          />
        </McpList>
      </Card>

      <Card>
        <CardRows>
          <Row
            label="This is not the Draft mode"
            hint="Draft turns one dictation into a first version of a text, in seconds, at your cursor. Nothing here writes into your editor."
            control={
              <Button variant="ghost" icon={<Icon name="arrow" />}>
                Open the assistant
              </Button>
            }
          />
          <Row
            label="Agent is a delivery target"
            hint="A bridge session returns the transcript to the caller and inserts nothing, so it sits on the delivery axis, not the mode axis."
            control={
              <Button variant="ghost" icon={<Icon name="arrow" />}>
                Open Delivery
              </Button>
            }
          />
          <Row
            label="A dictation can arrive here"
            hint="When what you said asks for something to be done rather than written, the assistant offers to hand it over. It never hands it over by itself."
            control={
              <Button variant="ghost" icon={<Icon name="handoff" />}>
                Open Handoff
              </Button>
            }
          />
        </CardRows>
      </Card>
    </>
  );
}

function Targets() {
  return (
    <>
      <Card
        title="Targets"
        description="A target is a repository, a role and a thread. Configuration hangs on the target, never on what you said."
        footer={<Button icon={<Icon name="plus" />}>New target</Button>}
      >
        <ListRows>
          {[
            ["WordScript", "work · writes · General writing", "Ready", "success"],
            ["dotfiles", "inspect · read-only · General writing", "Ready", "success"],
            ["sw-forge-org", "resume · continues last thread", "No thread yet", "plan"],
          ].map(([name, meta, state, tone]) => (
            <ListItem
              key={name}
              title={name}
              meta={[meta]}
              badges={[{ text: state, tone: tone as "success" | "plan" }]}
              actions={
                <>
                  <Button variant="ghost">Edit</Button>
                  <Button variant="ghost" icon={<Icon name="play" />}>
                    Start
                  </Button>
                </>
              }
            />
          ))}
        </ListRows>
      </Card>

      {/* The roles were a second card of three rows whose only control was a
          bare icon — a legend for a vocabulary the list above already uses in
          every row. What each role means belongs to the row that picks it, so it
          is a disclosure on this card rather than a card of its own. */}
      <Card>
        <Disclosure summary="What the three roles do" count="3">
          <Row label="inspect" hint="Reads the repository and answers. Writes nothing." />
          <Row label="work" hint="May write, under the target’s permission profile." />
          <Row
            label="resume"
            hint="Continues the target’s existing thread instead of starting one."
          />
        </Disclosure>
      </Card>

      <Note>
        Runs are headless. A discussion is a sequence of runs with resume, not an open connection.
      </Note>
    </>
  );
}

function Voice() {
  return (
    <>
      <Card title="Speaking" description="Chosen by time to first byte, not by price.">
        <CardRows>
          <Row
            label="Preset"
            control={
              <Select defaultValue={DESK_VOICE_PRESET} aria-label="Preset">
                <option>{DESK_VOICE_PRESET}</option>
                <option>Kokoro-82M (local)</option>
              </Select>
            }
          />
          <Row
            label="Measured TTFB"
            hint="Measured on this machine, not quoted from a datasheet."
            control={<StatusBadge tone="plan">Not measured</StatusBadge>}
          />
          <Row
            label="Rate limit"
            hint="Reported to the caller when it bites. Never silent."
            control={
              <span className="ws-rowflex">
                <Field defaultValue="6" w="50px" aria-label="Rate limit" />
                <span className="ws-muted">/ hour</span>
              </span>
            }
          />
          <Row
            label="Output guard"
            hint="Stays quiet while a call is running."
            control={<InertToggle label="Output guard" on />}
          />
        </CardRows>
      </Card>

      {/* THE VOICE HAS ONE BODY, AND THIS IS WHERE IT IS CONFIGURED — ADR 0043.
          Its four drawings sit beside the settings that govern them rather than
          in a legend somewhere else, because "what does the orb mean" is the
          question this card exists to close.

          Drawn at rest: the prototype drives two of the four from a synthetic
          envelope because it has no voice to follow. `drive` here removes the
          transition and nothing else — no generator, no device (ADR 0058). */}
      <Card
        title="How the voice shows itself"
        description="One voice, one object. It appears in the agent window and in the notification."
      >
        <CardRows>
          <Row
            label="Motion"
            hint="Reduced motion holds every state still and keeps all four distinguishable, because material and glow carry the state and only movement is dropped."
            control={
              <InertSegment
                options={["Follow the system", "Always still"]}
                active="Follow the system"
                label="Motion"
              />
            }
          />
        </CardRows>
        <OrbDemo four>
          <OrbFigure
            name="Idle"
            description="Unlit, neutral, motionless. The process exists and is not doing anything."
          >
            <Orb state="idle" size={72} still />
          </OrbFigure>
          <OrbFigure
            name="Listening"
            description="Cool material, following your level with a fast rise and a slow fall. It is receiving, so it is not lit from inside."
          >
            <Orb state="listening" size={72} drive="listening" />
          </OrbFigure>
          <OrbFigure
            name="Working"
            description="The size holds and the light drifts. There is no amplitude to show here, and a pulse would be inventing one."
          >
            <Orb state="thinking" size={72} />
          </OrbFigure>
          <OrbFigure
            name="Speaking"
            description="Warm, lit from inside, moving on the voice envelope — syllables and phrase pauses, not a period."
          >
            <Orb state="speaking" size={72} drive="speaking" />
          </OrbFigure>
        </OrbDemo>
      </Card>

      {/* THE NOTIFICATION, AND WHY IT IS A WINDOW. A question that is never seen
          is worse than no question: `await` blocks the agent until the budget
          runs out, so the one thing this surface may not do is be missable. An
          OS notification is suppressed by Focus and by screen sharing — which is
          when a coding agent is most likely to be running. */}
      <Card
        title="The notification"
        description="A small window over every other surface. Not an OS notification — Focus suppresses those."
      >
        <CardRows>
          <Row
            label="Show it"
            hint="Off leaves the tab on the overlay and the window as the only signals."
            control={<InertToggle label="Show it" on />}
          />
          <Row
            label="Where"
            hint="Remembered per monitor. It never covers the dictation overlay — it offsets above it while one is on screen."
            control={
              <Select defaultValue="Top right" aria-label="Where">
                <option>Top right</option>
                <option>Top centre</option>
                <option>Bottom right</option>
                <option>Where I last put it</option>
              </Select>
            }
          />
          <Row
            label="Sound"
            hint="A cue on the same stream as every other sound, not the system notification sound."
            control={
              <span className="ws-rowflex">
                <Select defaultValue="Question motif" aria-label="Sound">
                  <option>Question motif</option>
                  <option>Silent</option>
                </Select>
                <Button variant="ghost" icon={<Icon name="play" />}>
                  Play
                </Button>
              </span>
            }
          />
          <Row
            label="Stay quiet while I dictate"
            hint="A cue during a capture is picked up by the microphone. It queues and fires after the session ends."
            control={<InertToggle label="Stay quiet while I dictate" on />}
          />
          <Row
            label="Answer from the notification"
            hint="The offered options are buttons on it, so a question with two answers never needs the window opened."
            control={<InertToggle label="Answer from the notification" on />}
          />
          <Row
            label="Dismisses when"
            hint="Answered, or the answer budget expired. It never times out on its own — an unanswered question is still blocking somebody."
            control={<StatusBadge tone="plan">Answered or expired</StatusBadge>}
          />
        </CardRows>
      </Card>

      <Card title="Answering">
        <CardRows>
          <Row
            label="Answer window"
            hint="Opens after a question. Continuous listening is an option and shows a microphone indicator."
            control={
              <InertSegment
                options={["After a question", "Continuous"]}
                active="After a question"
                label="Answer window"
              />
            }
          />
          <Row
            label="Undo window"
            hint="How long a matched option answer can be taken back."
            control={
              <span className="ws-rowflex">
                <Field defaultValue="4" w="50px" aria-label="Undo window" />
                <span className="ws-muted">s</span>
              </span>
            }
          />
          <Row
            label="The microphone belongs to you"
            hint="A request during a dictation gets the busy answer; your dictation hotkey ends a bridge session."
            control={<StatusBadge tone="success">Always</StatusBadge>}
          />
        </CardRows>
      </Card>

      <Card title="Thread">
        <Thread>
          <Message
            from="ws"
            who="WS"
            text="WordScript · The overlay test expects a 480 by 60 surface. Should I update the test or the host?"
            options={
              <>
                <Button variant="ghost">the test</Button>
                <Button variant="ghost">the host</Button>
              </>
            }
            when="spoken · waiting 0:12"
          />
          <Message
            from="me"
            who="F"
            text="the host"
            when="answered by voice · undo window 4 s"
          />
        </Thread>
      </Card>
    </>
  );
}
