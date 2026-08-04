import { useState } from "react";
import {
  Button,
  Card,
  DocLink,
  Field,
  Icon,
  ListRows,
  Note,
  SectionHeader,
  Select,
  Toolbar,
  ToolbarSearch,
  TranscriptRow,
  ViewTop,
} from "@/components/shell";
import { HISTORY, rawOf } from "./data";

/**
 * HISTORY — `SCREENS.history`.
 *
 * The shipped surface spends a whole card of stacked `FormRow`s on three
 * filters — a search box, a status select and a toggle, each with a label in
 * the left column. Filters are a toolbar: they belong above the thing they
 * filter, on one line, and the count belongs to the list they produce.
 *
 * THREE FILTERS BECAME TWO. The shipped card carried a search box, a status
 * select AND an "Errors only" toggle — but the select already has a Failed
 * option, so two controls narrowed the list to the same set and could
 * contradict each other. The toggle is gone.
 */
export function HistoryScreen() {
  const [openRaw, setOpenRaw] = useState<string | null>(null);

  return (
    <>
      <ViewTop title="History" lead="Every transcription kept on this machine." />

      <Toolbar
        label="Filters"
        right={
          <Button variant="ghost" icon={<Icon name="download" />}>
            Export
          </Button>
        }
      >
        <ToolbarSearch>
          <Field placeholder="Search transcripts…" />
        </ToolbarSearch>
        <Select defaultValue="All statuses" aria-label="Status">
          <option>All statuses</option>
          <option>Completed</option>
          <option>Empty</option>
          <option>Failed</option>
        </Select>
      </Toolbar>

      <SectionHeader title="7 transcriptions">
        <Card>
          <ListRows>
            {HISTORY.map((entry) => (
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

      {/* The pairing with Privacy & Data, stated from this side too (§11.51):
          this screen is the records, that one is the rule about them. */}
      <Note icon="privacy" tail={<DocLink>Change the rule in Privacy &amp; Data</DocLink>}>
        Every transcript is a Markdown file in ~/WordScript/transcripts. Kept 90 days, capped
        at 500 entries.
      </Note>
    </>
  );
}
