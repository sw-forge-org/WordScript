import { useState } from "react";
import {
  Button,
  Card,
  HeroFacts,
  HeroInvoke,
  HomeOpen,
  Icon,
  IconButton,
  KeyCap,
  ListRows,
  Owed,
  OwedList,
  SectionHeader,
  TranscriptRow,
} from "@/components/shell";
import { DESK_CAP, RECENT, rawOf } from "./data";

/**
 * HOME — `SCREENS.home`.
 *
 * Home is the dictation record, not a dashboard. The first build opened on a
 * "Ready to dictate" hero with a Capture button, and nothing can press that
 * button into a recording: dictation starts with the global hotkey, in whatever
 * app has focus, and this window is usually not that app.
 *
 * Three blocks: the hero, the decision inbox, the record. The mode row and the
 * lane/model/target row that stood between them are gone — the first moved into
 * the hero's foot, the second to the window's bottom edge, where it is readable
 * from every view instead of only from this one.
 */
export function HomeScreen() {
  const [openRaw, setOpenRaw] = useState<string | null>(null);

  return (
    <>
      <HomeOpen>
        <HeroInvoke
          keys={
            <>
              <KeyCap>Ctrl</KeyCap>
              <span className="ws-plus">+</span>
              <KeyCap wide>Super</KeyCap>
            </>
          }
          title="Hold in any app to dictate"
          description="Release to stop. What it produces goes to the cursor you left."
        />
        <HeroFacts action={<Button variant="ghost" icon={<Icon name="arrow" />}>Change in profile</Button>}>
          <span>
            Next dictation runs as <b>Cleanup</b>
          </span>
          <span className="ws-sep">·</span>
          <span>
            <b>General writing</b> on Auto
          </span>
        </HeroFacts>
      </HomeOpen>

      {/* THE DECISION INBOX — ADR 0044. Three sources, one list, and the reason
          they can share a list is not that they are alike: it is that all three
          are the same question to the user, something is stopped until you say
          something. Nothing is drawn here when nothing is owed; a standing
          "all clear" is furniture. */}
      <SectionHeader title="Waiting for you · 3">
        <Card>
          <OwedList>
            <Owed
              icon="agents"
              urgent
              title="“Should I update the overlay test or the host?”"
              from={`${DESK_CAP} · WordScript · asked 6 min ago, out loud`}
              cost="The run stays blocked and stops in 24 min without an answer."
              actions={
                <>
                  <Button variant="ghost">the test</Button>
                  <Button variant="ghost">the host</Button>
                  <IconButton label="Answer out loud" icon={<Icon name="mic" />} />
                </>
              }
            />
            <Owed
              icon="users"
              title="Budget for Q2 headcount — unanswered since Monday"
              from="Product Sync · raised twice, in two meetings"
              cost="Nothing. It stays an open question on both notes."
              actions={
                <>
                  <Button variant="ghost" icon={<Icon name="arrow" />}>
                    Open note
                  </Button>
                  <Button variant="ghost">Dismiss</Button>
                </>
              }
            />
            <Owed
              icon="alert"
              title="One insert fell back to the clipboard"
              from="Yesterday 17:03 · Support reply · the target app ignored the paste"
              cost="The text is lost the next time you copy anything."
              actions={
                <>
                  <Button icon={<Icon name="restore" />}>Restore</Button>
                  <Button variant="ghost">Dismiss</Button>
                </>
              }
            />
          </OwedList>
        </Card>
      </SectionHeader>

      {/* The count is in the header for the same reason History's is: a count is
          the result of a list, not a label on it. "Open History" is the action
          of this card and sits at its foot, not loose on the page under it. */}
      <SectionHeader title="Recent · 5">
        <Card
          footer={
            <Button variant="ghost" icon={<Icon name="arrow" />}>
              Open History
            </Button>
          }
        >
          <ListRows>
            {RECENT.map((entry) => (
              <TranscriptRow
                key={entry.id}
                title={entry.text}
                meta={[entry.at, entry.mode, entry.profile]}
                badges={entry.badges}
                raw={rawOf(entry)}
                audioKept={entry.audio !== false}
                restorable={entry.restore}
                open={openRaw === entry.id}
                onToggleRaw={() => setOpenRaw((id) => (id === entry.id ? null : entry.id))}
              />
            ))}
          </ListRows>
        </Card>
      </SectionHeader>
    </>
  );
}
