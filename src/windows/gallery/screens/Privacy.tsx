import {
  Button,
  Card,
  CardRows,
  Icon,
  Row,
  SectionHeader,
  Select,
  StatusBadge,
  ViewTop,
} from "@/components/shell";

/**
 * PRIVACY & DATA — `SCREENS.privacy`.
 *
 * THE RULE LIVES HERE, THE LIST LIVES IN HISTORY (§11.51). Both screens are
 * about the same records and neither is redundant, because they answer
 * different questions: History is the data — find one, read it, retry it,
 * delete one — and this is the policy: how many, how long, where. The pairing
 * is stated on both sides, so nobody has to discover which screen wins.
 *
 * IT COVERS CONTEXT OBJECTS TOO, and the heading says so: a meeting is a bigger
 * object than a transcript and an hour of audio is a different size of promise,
 * so a retention rule that silently governed only dictations would be the more
 * dangerous half unstated.
 *
 * "DANGER ZONE" WAS A THIRD RED SIGNAL on top of the red row label and the red
 * button, and the least useful of the three: it names a neighbourhood rather
 * than a consequence.
 */
export function PrivacyScreen() {
  return (
    <>
      <ViewTop title="Privacy & Data" lead="What stays on this machine, and how long." />

      <SectionHeader
        title="How long things are kept"
        description="History and context objects, on this machine."
      >
        <Card>
          <CardRows>
            <Row
              label="Stored transcripts"
              hint="The oldest is dropped when the cap is reached."
              control={
                <Select defaultValue="500" aria-label="Stored transcripts">
                  <option>50</option>
                  <option>100</option>
                  <option>200</option>
                  <option>500</option>
                  <option>1000</option>
                </Select>
              }
            />
            <Row
              label="Retention"
              hint="Older entries are pruned automatically."
              control={
                <Select defaultValue="90 days" aria-label="Retention">
                  <option>7 days</option>
                  <option>30 days</option>
                  <option>90 days</option>
                  <option>1 year</option>
                  <option>Keep all</option>
                </Select>
              }
            />
            <Row
              label="Context objects"
              hint="Meetings, uploads and notes are files in a folder you chose. Nothing prunes them, and nothing will without asking."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Kept until you delete</StatusBadge>
                  <Button variant="ghost" icon={<Icon name="arrow" />}>
                    Open Context
                  </Button>
                </span>
              }
            />
            <Row
              label="Meeting audio"
              hint="An hour of recording is a different size of promise than a dictation's few seconds. Undecided."
              control={<StatusBadge tone="warning">Open decision</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Where things live">
        <Card>
          <CardRows>
            <Row
              label="API keys"
              hint="In the OS secret store. Never written to the JSON config and never returned to this window."
              control={<StatusBadge tone="success">OS secret store</StatusBadge>}
            />
            <Row
              label="Transcripts, context, profiles, settings"
              hint="Files on this machine, under paths you can open."
              control={<StatusBadge tone="success">This machine</StatusBadge>}
            />
            <Row
              label="Audio"
              hint="Sent to the selected provider for transcription, then discarded. The local lane sends nothing."
              control={<StatusBadge tone="plan">Provider, then discarded</StatusBadge>}
            />
            <Row
              label="Whether any of it leaves"
              hint="No. There is no WordScript account, no cloud of ours and no sync — nothing to sign up for and no server of ours holding anything."
              control={<StatusBadge tone="success">Never</StatusBadge>}
            />
            <Row
              label="The accounts you do have"
              hint="Groq, Anthropic, an enterprise tenant. Those belong to model vendors, they are the only thing audio is ever sent to, and they are set where the model is chosen."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open AI Models
                </Button>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Export">
        <Card>
          <CardRows>
            <Row
              label="Full export"
              hint="Everything local, as one archive."
              control={<Button icon={<Icon name="download" />}>Export</Button>}
            />
            <Row
              label="Full import"
              hint="Restores from a previously exported archive."
              control={<Button variant="ghost">Import</Button>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Delete and reset"
        description="Both take effect immediately and cannot be undone."
      >
        <Card>
          <CardRows>
            <Row
              label="Clear transcription history"
              hint="Deletes every stored transcript. Profiles and settings stay."
              danger
              control={<Button variant="danger">Clear</Button>}
            />
            <Row
              label="Reset all settings"
              hint="Restores every setting to its default. History and profiles stay."
              danger
              control={<Button variant="danger">Reset</Button>}
            />
          </CardRows>
        </Card>
      </SectionHeader>
    </>
  );
}
