import { useState } from "react";
import {
  Button,
  Card,
  CardRows,
  Client,
  ClientHead,
  ClientList,
  ClientRow,
  Cross,
  CrossItem,
  CrossSide,
  DocField,
  DocTemplate,
  DocTemplateBody,
  DocTemplateHead,
  Icon,
  Note,
  PreviewBanner,
  Row,
  SectionHeader,
  SegmentControl,
  Select,
  StatusBadge,
  ViewTop,
} from "@/components/shell";

/**
 * CLIENT CONVERSATIONS — `SCREENS.conversation`, a wide preview.
 *
 * IT IS THE MEETING WINDOW. ADR 0045 exists precisely to stop this from
 * becoming a second thing: a dictation, a meeting, an upload, a link and a
 * calendar entry were five models of one object, and the user had to know which
 * route produced a result in order to find it again. A client conversation
 * recorded on site is a recording. Giving it its own window would rebuild the
 * shape that record removed, one release after removing it, and the second
 * window would then need its own transcript view, its own speaker handling, its
 * own export and its own bugs.
 *
 * WHAT IS ACTUALLY DIFFERENT IS THE OBJECT AROUND IT, NOT THE WINDOW. One
 * microphone with two people in a room; it hangs on a person rather than on a
 * calendar entry; and it ends in a document whose shape is not negotiable.
 *
 * AND ONE THING THE MEETING NEVER HAD: consent. Recording colleagues in a
 * standup and recording a client or a patient are not the same act, and the
 * second one has a rule attached in most of the places this product is used.
 * That is the one genuinely new surface here.
 */

const CONVERSATIONS: Array<{
  when: string;
  title: string;
  length: string;
  state: string;
  tone: "success" | "plan";
}> = [
  { when: "02 Apr", title: "Acceptance", length: "23 min", state: "Documented", tone: "success" },
  { when: "18 Mar", title: "Requirements", length: "67 min", state: "Documented", tone: "success" },
  {
    when: "14 Mar",
    title: "Follow-up call",
    length: "19 min",
    state: "Transcript only",
    tone: "plan",
  },
  {
    when: "11 Mar",
    title: "First conversation",
    length: "42 min",
    state: "Documented",
    tone: "success",
  },
];

export function ConversationScreen() {
  const [consent, setConsent] = useState("Given");

  return (
    <>
      <ViewTop
        title="Client conversations"
        lead="A conversation recorded in the room, filed under the person it was with, ending in the document their process expects."
        banner={
          <PreviewBanner>
            Not built. Uses the meeting window; needs speaker separation on one microphone.
          </PreviewBanner>
        }
      />

      <SectionHeader
        title="It is the meeting window"
        description="The question was whether to build a second one. The answer is no, and the reasoning is below."
      >
        <Card
          body={
            <Cross>
              {/* The reused column is the HELD one, which is the same rule the
                  handoff's pair follows: the accent marks what is new. */}
              <CrossSide label="Reused, unchanged" icon="check" held>
                <CrossItem title="The window">
                  330 × 560, always on top, excluded from screen shares. Same three tabs, same
                  bar, same resize.
                </CrossItem>
                <CrossItem title="Summary, Notes, Transcript">
                  The tabs it has while running are the tabs it has in Context afterwards. Nothing
                  to learn twice.
                </CrossItem>
                <CrossItem title="The copilot lane">
                  One line above the bar, writes and never speaks, never hints without a
                  citation.
                </CrossItem>
                <CrossItem title="Everything downstream">
                  One object type, so history, search, export and retention already cover it.
                </CrossItem>
              </CrossSide>
              <CrossSide label="New, and all of it in the object" icon="plus">
                <CrossItem title="origin: conversation">
                  Beside dictation, meeting, upload, link and calendar. A value on the existing
                  type, not a new type.
                </CrossItem>
                <CrossItem title="It hangs on a client">
                  A meeting belongs to a calendar entry. This belongs to a person, and the person
                  is what you open next month.
                </CrossItem>
                <CrossItem title="One microphone, two voices">
                  No system audio exists in a room. Separation on a single device is the only
                  thing that makes the transcript readable.
                </CrossItem>
                <CrossItem title="Consent">
                  Recording a colleague and recording a client are not the same act. This is the
                  one genuinely new surface.
                </CrossItem>
              </CrossSide>
            </Cross>
          }
        />
        <Note icon="about">
          A second window would need its own transcript view, its own speaker handling, its own
          export and its own bugs — and it would rebuild the shape that was removed, one release
          after removing it.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="The client is the object"
        description="Conversations hang on the person, because the person is what you look for later."
      >
        <Card
          body={
            <Client>
              <ClientHead
                name="Acme GmbH · M. Bergmann"
                meta="4 conversations · 2h 51m recorded · since 11 Mar"
                actions={<Button icon={<Icon name="mic" />}>New conversation</Button>}
              />
              <ClientList>
                {CONVERSATIONS.map((conversation) => (
                  <ClientRow key={conversation.when} {...conversation} />
                ))}
              </ClientList>
            </Client>
          }
        >
          <CardRows>
            <Row
              label="A client is a context object"
              hint="The same type the calendar, an upload and a link already produce. It carries the terms and names the transcript needs, which is why the fourth conversation transcribes better than the first."
              control={<StatusBadge tone="success">Existing type</StatusBadge>}
            />
            <Row
              label="It is not a CRM and does not grow into one"
              hint="A name, the conversations, and what was agreed. Pipelines, deals and reminders belong to the tool that already owns them, and the desk reaches that tool through its own connectors."
              control={<StatusBadge tone="plan">Stays small</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Consent is the one new rule"
        description="Recording a colleague in a standup and recording a client are not the same act. The product does not decide which applies to you — it makes the answer visible and recorded."
      >
        <Card>
          <CardRows>
            <Row
              label="It is asked before the first one, per client"
              hint="Not per recording. Asking again at the start of every conversation trains the answer to become a reflex, which is the opposite of consent."
              control={
                <SegmentControl
                  aria-label="Consent"
                  value={consent}
                  onChange={setConsent}
                  options={[
                    { value: "Given", label: "Given" },
                    { value: "Not asked", label: "Not asked" },
                    { value: "Refused", label: "Refused" },
                  ]}
                />
              }
            />
            <Row
              label="Refused does not mean no notes"
              hint="The window still runs with the microphone off: you type, the copilot stays quiet, and the record says it was written rather than heard. A feature that punishes the honest answer will not get honest answers."
              control={<StatusBadge tone="success">Notes only</StatusBadge>}
            />
            <Row
              label="The recording says which it was"
              hint="On the object, not in a log — whether it was recorded, written, and under which answer. This is the field somebody reads two years later when it matters."
              control={<StatusBadge tone="success">On the object</StatusBadge>}
            />
            <Row
              label="WordScript does not give legal advice"
              hint="Rules differ by country, by profession and by who else is in the room. The product states what it did; it never tells you that what you did was allowed."
              control={<StatusBadge tone="plan">States, never rules</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="It ends in a document with a fixed shape"
        description="A meeting ends in a summary somebody reads once. This ends in a record whose sections are decided by a process outside this product."
      >
        <Card
          body={
            <DocTemplate>
              <DocTemplateHead
                picker={
                  <Select defaultValue="Consultation record" aria-label="Template">
                    <option>Consultation record</option>
                    <option>Site visit report</option>
                    <option>Intake note</option>
                    <option>Custom template</option>
                  </Select>
                }
                badge={<StatusBadge tone="plan">From the profile</StatusBadge>}
              />
              <DocTemplateBody>
                <DocField label="Attending" value="M. Bergmann (client), F. Weiss">
                  From the client object and the speaker separation.
                </DocField>
                <DocField label="Reason" value="Acceptance of the March delivery">
                  One sentence, from the conversation's opening.
                </DocField>
                <DocField
                  label="Agreed"
                  value="Two open defects fixed by 14 Apr; invoicing after that"
                >
                  The part a template exists for — it is looked for in the same place every time.
                </DocField>
                <DocField label="Next step" value="F. Weiss confirms the date in writing">
                  Named owner, or the field says nobody was named.
                </DocField>
                <DocField label="Recorded" value="23 min, consent given 11 Mar">
                  Not editable. It is what happened, not what is being reported.
                </DocField>
              </DocTemplateBody>
            </DocTemplate>
          }
        >
          <CardRows>
            <Row
              label="The template belongs to the profile"
              hint="A care report, a legal file note and a site visit report are three different documents, and the person recording knows which one they owe. The product ships none of them and holds the one you write."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open Profiles
                </Button>
              }
            />
            <Row
              label="An empty field says empty"
              hint="If nobody named an owner, the field says nobody named an owner. A template that fills its gaps from a model produces a document that reads complete and is not, which is the one failure this must never have."
              control={<StatusBadge tone="success">Never invents</StatusBadge>}
            />
            <Row
              label="Every line can be traced back"
              hint="A sentence in the record points at the moment in the transcript it came from. The copilot's rule — never a hint without a citation — is the same rule, applied to a document instead of to a line."
              control={<StatusBadge tone="plan">By design</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <Note icon="about">
        Speaker separation on a single microphone is what this waits on, and it is a different
        problem from the meeting's: there both voices arrive on separate lanes, here they are
        mixed before WordScript ever sees them.
      </Note>
    </>
  );
}
