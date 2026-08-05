import {
  Button,
  Card,
  CardRows,
  Command,
  Connection,
  ConnectionList,
  Icon,
  KindRow,
  KindTable,
  PreviewBanner,
  Row,
  SectionHeader,
  ServerPanel,
  ServerPanels,
  StatusBadge,
  ViewTop,
} from "@/components/shell";
import { DESK, DESK_CAP } from "./data";
import type { ScreenProps } from "./props";

/**
 * INTEGRATIONS — `SCREENS.integrations`. A preview.
 *
 * Moved here from the workspace on 2026-08-03: it is an endpoint, a token, a
 * port file and an install command — nothing on it is authored, and a thing you
 * *set* belongs in settings. It also sits next to the screen it shares a
 * subject with, because Agents is the other half of the same MCP question.
 *
 * THREE KINDS, AND ONE QUESTION SORTS THEM: does it write anywhere? The table
 * at the top is the screen's argument and it replaces most of its former prose.
 */
export function IntegrationsScreen({ banner }: ScreenProps = {}) {
  return (
    <>
      <ViewTop
        title="Integrations"
        lead="What reaches WordScript, and what reaches out for you."
        banner={banner ?? <PreviewBanner>Planned for Phase 8. No port is open.</PreviewBanner>}
      />

      <SectionHeader
        title="Three kinds, and one question sorts them"
        description="Does it write anywhere?"
      >
        <Card>
          <KindTable>
            <KindRow
              kind="intake"
              what="Reads. What it reads is why a context object exists."
              who="WordScript"
            />
            <KindRow kind="bridge" what="Answers a call from something else." who="WordScript" />
            <KindRow kind="reach" what="Writes something, somewhere, for you." who={DESK_CAP} />
          </KindTable>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Intake · Calendar"
        description="The only source of a speaker's name, and the only intake there is."
      >
        <ConnectionList>
          <Connection
            icon="calendar"
            name="Google Calendar"
            description="Reads the calendars you pick. Never writes."
            accounts={["felix@sw-labs.dev", "felix@wordscript.app"]}
            action={
              <Button variant="ghost" icon={<Icon name="plus" />}>
                Add account
              </Button>
            }
          />
          <Connection
            icon="calendar"
            name="Apple Calendar"
            description="Local calendars through EventKit. Nothing leaves the machine."
            state={{ text: "macOS only", tone: "plan" }}
            action={<Button disabled>Connect</Button>}
          />
          <Connection
            icon="server"
            name="CalDAV"
            description="Fastmail, Nextcloud, iCloud by URL, or any server that speaks it."
            action={<Button disabled>Connect</Button>}
          />
        </ConnectionList>
        <Card>
          <CardRows>
            <Row
              label="What it gives a meeting"
              hint="A name, a time, attendees and the questions the last one left open — before it starts."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open Context
                </Button>
              }
            />
            <Row
              label="No calendar view"
              hint="A scheduled meeting is a row in Context. A month grid here would hold nothing that row does not."
              control={<StatusBadge tone="plan">By design</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Bridge · What can call in"
        description="Two surfaces and a command line, all on loopback."
      >
        <Card>
          <CardRows>
            <Row
              label="Address"
              control={
                <span className="ws-mono ws-muted">127.0.0.1 · port assigned at start</span>
              }
            />
            <Row
              label="Token"
              hint="Bearer token, plus Origin rejection. Rotating it disconnects every client."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Not issued</StatusBadge>
                  <Button disabled>Generate</Button>
                </span>
              }
            />
            <Row
              layout="stack"
              label="Port file"
              hint="Written at start, so a client finds the port without being configured."
            >
              <Command>~/.local/state/wordscript/mcp.port</Command>
            </Row>
          </CardRows>
        </Card>

        {/* `card()` renders its rows BEFORE its body, so the row that carries
            the open decision sits above the two panels it is about. */}
        <Card>
          <CardRows>
            <Row
              label="How the two are kept apart"
              hint="Undecided. A note reader must not end up holding a token that also reaches ask."
              control={<StatusBadge tone="warning">Open decision</StatusBadge>}
            />
          </CardRows>
          <ServerPanels>
            <ServerPanel
              name="Agent bridge"
              tools="ask · await"
              description="Lets a running agent ask you out loud and wait."
              clients={`One client — ${DESK}`}
              canSpeak
            />
            <ServerPanel
              name="Transcripts & notes"
              tools="history.search · notes.read · vocabulary.list"
              description="Lets an MCP client you configure read what is here."
              clients="Any client you configure"
              canSpeak={false}
            />
          </ServerPanels>
        </Card>

        {/* MCP is for processes, the CLI is for people. ADR 0030 rejected a CLI
            as an agent transport with evidence — sandboxes block loopback —
            so what is left is the surface for the user in a terminal. */}
        <Card
          title="Command line"
          description="For you, in your own shell. Not a second way for an agent to call in."
        >
          <CardRows>
            <Row
              label="Discovery"
              hint="Reads the port file."
              control={<StatusBadge tone="success">Automatic</StatusBadge>}
            />
            <Row
              label="Not for agents"
              hint="Their sandboxes block loopback, so a CLI call fails as an unexplained command error. Agents use MCP, which sits outside it."
              control={<StatusBadge tone="plan">People only</StatusBadge>}
            />
            <Row
              label="Dictating from it"
              hint="Not offered. The microphone belongs to whoever is at the keyboard."
              control={<StatusBadge tone="plan">By design</StatusBadge>}
            />
          </CardRows>
          <div className="ws-stack ws-gap2">
            <Command>brew install wordscript   ·   npm i -g @wordscript/cli</Command>
            <Command>wordscript context search &quot;budget&quot; --since 30d</Command>
            <Command>wordscript notes export --format md &gt; standup.md</Command>
          </div>
        </Card>
      </SectionHeader>

      <SectionHeader
        title={`Reach · What ${DESK} can do for you`}
        description="Configured there, not here."
      >
        <Card>
          <CardRows>
            <Row
              label="Where they live"
              hint={`${DESK_CAP} is an agent CLI with its own MCP client. WordScript reads that configuration and shows it.`}
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open Agents
                </Button>
              }
            />
            <Row
              label="Typical ones"
              control={
                <span className="ws-mono ws-muted">Gmail · Calendar · GitHub · Notion · Linear</span>
              }
            />
            <Row
              label="No second door"
              hint="No way to add one here. A connector configured in two places is a connector that disagrees with itself."
              control={<StatusBadge tone="plan">By design</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Deliberately absent" description="Named so it is not looked for.">
        <Card>
          <CardRows>
            <Row
              label="Per-repository setup"
              hint={`Nothing to paste into a repo. ${DESK_CAP} is the only client.`}
              control={<StatusBadge tone="plan">By design</StatusBadge>}
            />
            <Row
              label="Remote access"
              hint="Loopback only. No tunnel, no account to hang one on."
              control={<StatusBadge tone="plan">By design</StatusBadge>}
            />
            <Row
              label="Editor plugins"
              hint="Insert already works in every focused app."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open Delivery
                </Button>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>
    </>
  );
}
