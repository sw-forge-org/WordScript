import {
  AgentAnswer,
  AgentBody,
  AgentMain,
  AgentMainHead,
  AgentMessage,
  AgentPopup,
  AgentPopupStage,
  AgentRail,
  AgentRailFoot,
  AgentRailHead,
  AgentRailLabel,
  AgentStage,
  AgentTarget,
  AgentTargets,
  AgentThread,
  AgentVoice,
  AgentWindow,
  Card,
  CardRows,
  ChatWinDeco,
  HotkeyButton,
  Matrix,
  ModeCycle,
  ModeCycleItem,
  Note,
  Orb,
  OverlayMiniButton,
  OverlayPillDrawing,
  OverlayStage,
  OverlayTab,
  PreviewBanner,
  Row,
  SectionHeader,
  StatusBadge,
  StatusDot,
  ViewTop,
} from "@/components/shell";
import { DESK, DESK_CAP, DESK_VOICE_PRESET } from "./data";

/**
 * AGENT OVERLAY — `SCREENS.agentoverlay`, a wide preview.
 *
 * THREE STATES, and the screen is the argument that they are three states of
 * ONE overlay rather than a second one: nothing waiting (the pill, with `Agent`
 * where a mode would stand), something waiting (a tab out of the left edge), and
 * looking at the work (the window the tab opens).
 *
 * `Agent` IS WHAT THE MODE CHIP SAYS, and that is the whole point. ADR 0030
 * makes `delivery = agent` vacuous on the mode axis, so the pill shows `Agent`
 * where a mode would otherwise stand. Nothing else about the pill changes.
 *
 * BOTH LIVE INSTRUMENTS ARE DRAWN AT REST (ADR 0058). The answer window's level
 * meter sits at zero, and the orb's level is the prototype's own value with no
 * generator behind it — this repo's `drive` removes the transition and nothing
 * more, which is what Leg 2c settled on Agents.
 */

const TARGETS: Array<{
  name: string;
  role: string;
  state: string;
  tone?: "success" | "accent";
  unread?: string;
}> = [
  { name: "WordScript", role: "work · writes", state: "Waiting for you", tone: "accent", unread: "1" },
  { name: "dotfiles", role: "inspect · read-only", state: "Running", tone: "success" },
  { name: "sw-forge-org", role: "resume · last thread", state: "Idle" },
];

/* The level readout is at rest: the prototype drives it from `orbEnvelope`, and
   a gallery screen measures nothing. */
const LEVEL_AT_REST = new Array(12).fill(0);

export function AgentOverlayScreen() {
  return (
    <>
      <ViewTop
        title="Agent overlay"
        lead="What is on screen while coding agents are working and one of them needs you."
        banner={
          <PreviewBanner id="agent-overlay" />
        }
      />

      {/* Written to budget on both sides of the copy switch throughout this
          screen. Nothing about this surface ships, so there is no shipped copy
          to reduce, and §11.10 forbids claiming a cut against nothing. */}
      <SectionHeader
        title="It is the overlay you already have"
        description="Agent is what the mode chip says. Everything else about the pill is unchanged."
      >
        <OverlayStage>
          <OverlayPillDrawing rec mode="Agent" timer="04:12" />
        </OverlayStage>
        <Note icon="ruler">
          The shipped recording pill, drawn at its real geometry: 40 px tall, max-content wide, the
          composition and tokens from overlay-pill.css. This is a state of that overlay, not a
          second one.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="Something needs you"
        description="A tab grows out of the left edge and stays out. The same component the overlay already has on both sides."
      >
        <OverlayStage>
          <OverlayPillDrawing rec mode="Agent" timer="04:31" tab={<OverlayTab>1 needs you</OverlayTab>} />
        </OverlayStage>
        <Note icon="arrow">
          The left slot is the learned-word tab's, and a bridge session cannot produce one — it runs
          no finalization, so it learns nothing. The right slot stays with the auto-stop.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="Clicking it opens a window"
        description="Everything agent-specific is in here, and none of it is on the pill."
      >
        <AgentStage>
          <AgentWindow>
            <ChatWinDeco title="Agents" sub="3 targets · 1 waiting" onClose={() => undefined} />
            <AgentBody>
              <AgentRail>
                <AgentRailHead
                  orb={<Orb state="idle" size={18} still label={DESK_CAP} />}
                  name={DESK_CAP}
                  sub="one process · speaks for all three"
                />
                <AgentRailLabel>Working on</AgentRailLabel>
                <AgentTargets>
                  {TARGETS.map((target, index) => (
                    <AgentTarget
                      key={target.name}
                      dot={<StatusDot tone={target.tone} />}
                      name={target.name}
                      role={target.role}
                      unread={target.unread}
                      state={target.state}
                      current={index === 0}
                    />
                  ))}
                </AgentTargets>
                <AgentRailFoot>
                  <OverlayMiniButton icon="layers">Compact</OverlayMiniButton>
                  <OverlayMiniButton icon="plus">New session</OverlayMiniButton>
                </AgentRailFoot>
              </AgentRail>

              <AgentMain>
                <AgentMainHead name="WordScript" meta="work · thread since 09:12" />
                <AgentThread>
                  <AgentMessage from="ws" when="spoken · 0:06 ago" options={["the test", "the host"]}>
                    The overlay test expects a 480 by 60 surface. Should I update the test or the
                    host?
                  </AgentMessage>
                  <AgentMessage from="done" when="09:41">
                    dotfiles finished — 3 files changed
                  </AgentMessage>
                </AgentThread>
                <AgentAnswer
                  meter={
                    <Matrix
                      mode="vu"
                      levels={LEVEL_AT_REST}
                      rows={7}
                      cols={12}
                      size={2}
                      gap={1}
                      ariaLabel="Input level"
                    />
                  }
                  left="0:08"
                />
              </AgentMain>
            </AgentBody>

            <AgentVoice
              orb={<Orb state="active" size={22} level={0.74} />}
              what="“Should I update the test or the host?”"
              meta={`${DESK_VOICE_PRESET} · 240 ms`}
              action={<OverlayMiniButton icon="x">Stop</OverlayMiniButton>}
            />
          </AgentWindow>
        </AgentStage>
        <Note icon="layers">
          Fourth member of the window family, after Ask, the meeting HUD and Actions. Same chrome,
          same resize grip, OS-drawn decoration.
        </Note>
        <Note icon="agents">
          The orb at the head of the rail and the strip at the foot are the same object: one
          process, one voice. The targets are what it is working on, not three agents that can each
          speak to you.
        </Note>
      </SectionHeader>

      {/* Deliberately the largest drawing on this screen, because it is the one
          surface here that arrives uninvited and the argument for it is that it
          cannot be missed. */}
      <SectionHeader
        title="And if the window is closed, this arrives"
        description="A small always-on-top window, with a cue on the usual audio stream."
      >
        <AgentPopupStage>
          <AgentPopup
            orb={<Orb state="active" size={72} level={0.9} />}
            from="WordScript · dotfiles"
            question="The overlay test expects a 480 by 60 surface. Should I update the test or the host?"
            options={["the test", "the host"]}
            aloud="Answer out loud"
            meta="question motif · 0:52 of the answer budget left"
          />
        </AgentPopupStage>
        <Note icon="privacy">
          Not an OS notification: Focus mode and screen sharing suppress those, and a screen share
          is exactly when a coding agent is likely to be running. Content-protected, like the
          meeting HUD — a question about a private repository does not belong in a shared screen.
        </Note>
        <Note icon="volume">
          The sound is a motif on the one persistent output stream, not a fresh stream per cue and
          not the system notification sound. That is the shape every other WordScript cue already
          has, re-used rather than re-decided; it also means one application volume in the OS mixer
          governs it.
        </Note>
      </SectionHeader>

      {/* The line this screen has to hold. Two voices, two drawings, and the
          one that ships is not being redesigned here. */}
      <SectionHeader
        title="Your dictation is untouched"
        description="The recording overlay keeps its bars, its geometry and its behaviour. Nothing on this page changes it."
      >
        <Card>
          <CardRows>
            <Row
              label="The bars on the pill"
              hint="Your microphone, drawn as it ships. Eleven bars in a 30 px band."
              control={<StatusBadge tone="success">Unchanged</StatusBadge>}
            />
            <Row
              label="The orb"
              hint={`The machine speaking to you. Only in the agent window and the notification, never on the pill.`}
              control={<StatusBadge tone="plan">Agents only</StatusBadge>}
            />
            <Row
              label="A dictation while an agent waits"
              hint="Records, transcribes and inserts exactly as always. The cue queues until the session ends."
              control={<StatusBadge tone="success">Normal</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="How you get here"
        description="The mode cycle reaches it, and it is not a mode."
      >
        <Card
          body={
            <ModeCycle
              modes={["Verbatim", "Cleanup", "Rewrite", "Draft", "Prompt Enhance"]}
              after={
                <ModeCycleItem icon="agents" on>
                  Agent
                </ModeCycleItem>
              }
            />
          }
        >
          <CardRows>
            <Row
              label="Agent is a delivery target"
              hint="It returns the transcript to the caller and inserts nothing. No transform runs."
              control={<StatusBadge tone="plan">delivery axis</StatusBadge>}
            />
            <Row
              label="So the mode axis goes empty"
              hint="The pill shows Agent where a mode would stand. No greyed-out mode."
              control={<StatusBadge tone="accent">Agent</StatusBadge>}
            />
            <Row
              label="Why it is in the cycle at all"
              hint="Cycling the mode is the control you already have on the overlay."
              control={<HotkeyButton combo="Ctrl+Super+M" />}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <Note icon="about">
        Bridge sessions do not enter the transcript history. They end in the thread above and in the
        Agents settings area, because an answer without its question is unreadable in a list of
        dictations.
      </Note>
    </>
  );
}
