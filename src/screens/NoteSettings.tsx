import {
  Button,
  Card,
  CardRows,
  Command,
  DocLink,
  HotkeyButton,
  Icon,
  ListItem,
  ListRows,
  Note,
  PreviewBanner,
  Row,
  SectionHeader,
  Select,
  StatusBadge,
  Stepper,
  Toggle,
  ViewTop,
} from "@/components/shell";
import { modelId } from "@/lib/modelCatalogue";
import type { PartlyWiredScreenProps } from "./props";

/**
 * NOTES & MEETINGS — `SCREENS.notesettings`.
 *
 * Where notes are written, what can be made from them, and what a meeting
 * records. The Actions list is straight from the donor's ActionPicker: name,
 * description, prompt — and the last one used is what the bar's main button
 * runs.
 *
 * THE MEETING SPEECH ENGINE IS NOT A SECTION HERE. It stood here until
 * 2026-08-03 and repeated Speech-to-Text's rows to say the same thing in a
 * different place — one of the five screens §11.34 found that could each set a
 * model. It is a model setting, so it is a row in AI Models like every other,
 * and what stays here is what a meeting RECORDS, which is a capture question
 * and belongs to the surface that captures.
 */
/* THE SCREEN IS STILL DRAWN, AND ITS TWO DOORS ARE NOT. Nothing here is wired
   to the runtime and the banner says so — but `AI Models` is a section that
   exists in this build, so the two places this screen points at it may open it
   instead of merely naming it. That is the only reason it takes a runtime:
   `PartlyWiredScreenProps` keeps it renderable in the gallery, where `open` is
   absent and neither door is drawn. */
export function NoteSettingsScreen({ banner, runtime }: PartlyWiredScreenProps = {}) {
  const open = runtime?.open;
  const openModels = open && (() => open({ section: "models" }));
  return (
    <>
      <ViewTop
        title="Notes & Meetings"
        lead="Where notes are written, what can be made from them, and what a meeting records."
        banner={banner ?? <PreviewBanner id="notesettings" />}
      />

      <SectionHeader
        title="Where notes live"
        description="Notes are Markdown files. A folder in the sidebar is a directory here."
      >
        <Card>
          <CardRows>
            <Row
              layout="stack"
              label="Notes folder"
              hint="Moving this moves the files with it."
            >
              <div className="ws-rowflex">
                <Command>~/Documents/WordScript</Command>
              </div>
            </Row>
            <Row
              label="Change folder"
              hint="Picks a new location and moves what is already there."
              control={<Button icon={<Icon name="folder" />}>Choose…</Button>}
            />
            <Row
              label="File name"
              hint="How a new note is named before you rename it."
              control={
                <Select defaultValue="2026-06-21 Standup.md" aria-label="File name">
                  <option>2026-06-21 Standup.md</option>
                  <option>Standup.md</option>
                  <option>standup-2026-06-21.md</option>
                </Select>
              }
            />
            <Row
              label="If a file changes outside WordScript"
              hint="The folder is yours — an editor, a sync client or a script may write into it."
              control={
                <Select
                  defaultValue="Reload the note"
                  aria-label="If a file changes outside WordScript"
                >
                  <option>Reload the note</option>
                  <option>Ask</option>
                  <option>Keep what is open</option>
                </Select>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Actions"
        description="What the button at the foot of a note can make from it."
      >
        <Card
          footer={
            <>
              <Button icon={<Icon name="plus" />}>New action</Button>
              <span className="ws-muted">
                Stored as Markdown beside your notes, in <span className="ws-mono">_actions/</span>
              </span>
            </>
          }
        >
          <ListRows>
            {[
              ["Sync template", "Format using the team template", "Last used"],
              ["Meeting summary", "Summarize decisions and actions", null],
              ["Email draft", "Draft the follow-up email", null],
            ].map(([title, description, used]) => (
              <ListItem
                key={title as string}
                title={title as string}
                meta={[description as string]}
                state={used ? { text: used as string, tone: "warning" } : undefined}
                actions={
                  <>
                    <Button variant="ghost">Edit prompt</Button>
                    <Button variant="ghost" icon={<Icon name="trash" />}>
                      Delete
                    </Button>
                  </>
                }
              />
            ))}
          </ListRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Meeting capture"
        description="A second capture type: longer, two audio sources, and it inserts nothing."
      >
        <Card>
          <CardRows>
            <Row
              label="Meeting hotkey"
              hint="Its own key — one press inserts, the other does not."
              control={<HotkeyButton combo={null} />}
            />
            <Row
              label="When a call is detected"
              hint="Offered in a window rather than an OS notification."
              control={
                <Select defaultValue="Ask" aria-label="When a call is detected">
                  <option>Ask</option>
                  <option>Start recording</option>
                  <option>Do nothing</option>
                </Select>
              }
            />
            <Row
              label="Record system audio"
              hint="Everyone else, as this machine plays them. No participant joins the call."
              control={<Toggle checked disabled aria-label="Record system audio" />}
            />
            <Row
              label="Echo cancellation"
              hint="The microphone hears the speakers, so every remote voice arrives twice. Removed before transcription."
              control={<Toggle checked disabled aria-label="Echo cancellation" />}
            />
            <Row
              label="Separate speakers"
              hint="Labelled as the call runs and re-clustered when it ends."
              control={<Toggle checked disabled aria-label="Separate speakers" />}
            />
            <Row
              label="Expected speakers"
              hint="Set it if you know it. Auto-detect is the default and is usually right for two."
              control={<Stepper value={2} aria-label="Expected speakers" />}
            />
            <Row
              label="Keep the audio"
              hint="Goes when nothing needs it any more. Never means never written."
              control={
                <Select defaultValue="Until the note is saved" aria-label="Keep the audio">
                  <option>Until the note is saved</option>
                  <option>7 days</option>
                  <option>Never</option>
                </Select>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Speech engine for meetings"
        description="A different workload from a dictation, and it has its own row."
      >
        <Card>
          <CardRows>
            <Row
              label="Engine"
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">{modelId("groq-speech-large-v3")}</StatusBadge>
                  {/* THE ROW KEEPS ITS CONTROL AND LOSES ITS PRETENCE. A door
                      in a row is not removed when it has nowhere to go — the
                      row would lose the only thing on its right and stop
                      matching its own drawing. It is disabled with the reason
                      on it, which is what `DrawnButton` does one screen over.
                      The prose link in the note below IS removed, because a
                      struck-through sentence fragment is not a state a reader
                      learns anything from. */}
                  <Button
                    variant="ghost"
                    icon={<Icon name="arrow" />}
                    onClick={openModels}
                    disabled={!openModels}
                    title={openModels ? undefined : "Reachable from the settings sheet."}
                  >
                    AI Models
                  </Button>
                </span>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* Corrected 2026-08-03 by ADR 0040. This pointed at a Notes tab that held
          a model of its own. There is no such tab and no such model: the
          summary, the action and the answer are the assistant that Draft is. */}
      <Note
        icon="models"
        tail={openModels && <DocLink onClick={openModels}>Open AI Models</DocLink>}
      >
        The model that writes a summary, runs an action or answers in Ask is the assistant — the
        same one Draft uses in a dictation. One setting, one place.
      </Note>
    </>
  );
}
