import { useState } from "react";
import {
  Button,
  Card,
  CardRows,
  DocLink,
  Field,
  Flag,
  Icon,
  IconButton,
  Legend,
  LegendRow,
  ListItem,
  ListRows,
  Note,
  Pane,
  PaneDetailHead,
  PaneDetailMain,
  PaneListFoot,
  PaneListHead,
  PaneRow,
  PaneScroll,
  Row,
  SegmentControl,
  Select,
  StatusBadge,
  Stepper,
  SubTabs,
  TermChips,
  TextArea,
  Toggle,
  ViewTop,
  type TermChip,
} from "@/components/shell";

/**
 * PROFILES — `SCREENS.profiles`, a pane view.
 *
 * DEFAULTS IS THE TAB THE IA IMPLIES AND THE FIRST BUILD DID NOT HAVE. ADR
 * 0024 puts "which mode this profile defaults to" in the profile and nowhere
 * else; ADR 0025 makes the session inherit it. The delivery target, the
 * workspace-context switch and the recording limits are per-profile in the
 * runtime as well, and were sitting in three different settings sections where
 * they read as machine-wide. Gathering them here is what lets Settings mean
 * "this machine" without exception.
 *
 * REBUILT FOR WEIGHT. Defaults was one card of six rows each carrying two or
 * three sentences, then a health card, then a four-row card with its own
 * two-sentence description — about 230 words to configure six values, on the
 * tab that opens first. Three faults:
 *
 *   1. SIX EQUAL ROWS WERE NOT SIX EQUAL DECISIONS. Three decide how this
 *      profile writes; three decide when a recording stops.
 *   2. THE HEALTH CARD WAS A CARD. One flag, one sentence, one button — for a
 *      status that belongs beside the profile's name, where it is visible from
 *      all five tabs instead of only from this one.
 *   3. THE HINTS EXPLAINED THE FEATURE, NOT THE CHOICE. The reader is deciding
 *      whether to leave a switch alone; what they need is what changes if they
 *      don't — one clause, not three sentences.
 */

const TABS = ["Defaults", "Context", "Words", "Replacements", "Snippets"];

const PROFILE_ROWS = [
  { title: "General writing", sub: "Auto · Insert at cursor", on: true },
  { title: "Support reply", sub: "Rewrite · Client register" },
  { title: "Customer success replies", sub: "Rewrite · Clipboard only" },
];

const TERMS: TermChip[] = [
  { term: "WordScript", origin: "learned" },
  { term: "Tauri", origin: "learned" },
  { term: "WebKitGTK", origin: "added" },
  { term: "ydotool", origin: "added" },
  { term: "Kundenanfrage", origin: "added" },
  { term: "Groq", origin: "learned" },
  { term: "whisper-cli", origin: "added" },
  { term: "Ollama", origin: "learned" },
];

const REPLACEMENTS: Array<[string, string]> = [
  ["KA", "Kundenanfrage"],
  ["WS", "WordScript"],
  ["asap", "as soon as possible"],
];

const SNIPPETS: Array<[string, string]> = [
  ["standard closing", "Best regards,\nFelix"],
  ["ticket header", "Ticket: \nStatus: \nNext step: "],
];

export function ProfilesScreen() {
  const [tab, setTab] = useState(TABS[0]);
  const [selected, setSelected] = useState(PROFILE_ROWS[0].title);
  const [delivery, setDelivery] = useState("Insert at cursor");
  const [workspace, setWorkspace] = useState(true);

  return (
    <>
      <ViewTop
        title="Profiles"
        lead="What a profile knows, and what it changes about how you are written."
      />

      <Pane
        list={
          <>
            <PaneListHead title="Profiles" count="3" />
            <PaneScroll>
              {PROFILE_ROWS.map((profile) => (
                <PaneRow
                  key={profile.title}
                  icon="profiles"
                  title={profile.title}
                  sub={profile.sub}
                  current={profile.title === selected}
                  onClick={() => setSelected(profile.title)}
                />
              ))}
            </PaneScroll>
            <PaneListFoot>
              <Button variant="ghost" icon={<Icon name="plus" />}>
                New profile
              </Button>
            </PaneListFoot>
          </>
        }
        detail={
          <>
            {/* The health flag lives in the detail header. It is a property of
                the profile, not of the Defaults tab, and from here it is
                visible on all five. Duplicate and Export went with it — they
                are things you do to a profile rarely and from the list. */}
            <PaneDetailHead
              title="General writing"
              description="Active in this session"
              actions={
                <>
                  <StatusBadge tone="success">Active</StatusBadge>
                  <Flag>1 flag</Flag>
                  <IconButton label="More" icon={<Icon name="updown" />} />
                </>
              }
            />
            <PaneDetailMain>
              <SubTabs
                label="Profile"
                value={tab}
                onChange={setTab}
                items={TABS.map((id) => ({ id, label: id }))}
              />

              {tab === "Defaults" && (
                <>
                  <Card
                    title="How this profile writes"
                    description="Travels with the profile. A running session keeps what it started with."
                  >
                    <CardRows>
                      <Row
                        label="Processing mode"
                        hint="Auto never picks Verbatim or Rewrite — those stay your call."
                        control={
                          <Select defaultValue="Auto" aria-label="Processing mode">
                            <option>Auto</option>
                            <option>Verbatim</option>
                            <option>Cleanup</option>
                            <option>Rewrite</option>
                            <option>Translate</option>
                            <option>Draft</option>
                            <option>Prompt Enhance</option>
                          </Select>
                        }
                      />
                      <Row
                        label="Delivery"
                        hint="Where a finished transcript goes."
                        control={
                          <SegmentControl
                            aria-label="Delivery"
                            value={delivery}
                            onChange={setDelivery}
                            options={[
                              { value: "Insert at cursor", label: "Insert at cursor" },
                              { value: "Clipboard only", label: "Clipboard only" },
                            ]}
                          />
                        }
                      />
                      <Row
                        label="Workspace context"
                        hint="Tells the AI which app you are writing into. Never adds content."
                        control={
                          <Toggle
                            checked={workspace}
                            onCheckedChange={setWorkspace}
                            aria-label="Workspace context"
                          />
                        }
                      />
                    </CardRows>
                  </Card>

                  {/* Three things bound a recording, ordered by how hard each
                      one is: you stop talking, the recording gets long, the
                      provider cannot take any more. The ceiling is the
                      runtime's number, so it is stated, not offered. */}
                  <Card
                    title="When a recording stops"
                    description="Nothing here can pass the ceiling, and the ceiling is not yours to set."
                  >
                    <CardRows>
                      <Row
                        label="Stop after silence"
                        hint="When you stop talking. 0 disables it."
                        control={<Stepper value={3} suffix="s" min={0} max={60} aria-label="Stop after silence" />}
                      />
                      <Row
                        label="Auto-stop"
                        hint="At this length. Up to 12:18 keeps headroom under the ceiling."
                        control={<Stepper value={10} suffix="min" min={1} max={13} aria-label="Auto-stop" />}
                      />
                      <Row
                        label="Ceiling"
                        hint="13:39 — the 25 MiB upload size on your plan. Past it, nothing transcribes."
                        control={<StatusBadge>13:39</StatusBadge>}
                      />
                    </CardRows>
                  </Card>

                  <Card
                    title="Where each list lands"
                    footer={
                      <Button variant="ghost" icon={<Icon name="play" />}>
                        Check against a sample
                      </Button>
                    }
                  >
                    <Legend>
                      <LegendRow name="Context" what="steers which word the AI picks" where="AI modes" />
                      <LegendRow name="Words & names" what="repairs mangled terms" where="recognizer + AI" />
                      <LegendRow name="Replacements" what="exact swap, before the AI" where="every mode" />
                      <LegendRow name="Snippets" what="phrase expands to a block" where="every mode" />
                    </Legend>
                  </Card>
                </>
              )}

              {tab === "Context" && (
                <Card
                  title="Profile context"
                  description="Topics you talk about, one per line. Not spellings."
                >
                  <CardRows>
                    <Row layout="stack">
                      <TextArea
                        rows={5}
                        placeholder="One topic per line"
                        defaultValue={
                          "Tauri desktop runtime\nWhisper speech-to-text\nRust native insert chain\nSettings information architecture"
                        }
                      />
                    </Row>
                  </CardRows>
                  <Note icon="arrow" tail={<DocLink>How context reaches the model</DocLink>}>
                    For individual terms, use Words &amp; names.
                  </Note>
                </Card>
              )}

              {tab === "Words" && (
                <>
                  {/* A word list is an input and a set of chips. Rows with hover
                      actions imply a record with fields; a term has none. */}
                  <Card
                    title="Words & names"
                    description="Terms this profile knows. Repaired automatically when speech mangles them."
                  >
                    <CardRows>
                      <Row layout="stack">
                        <Field placeholder="Add a word or name…" />
                        <TermChips items={TERMS} />
                        <p className="ws-muted">Outlined chips were learned from repairs. 8 terms.</p>
                      </Row>
                    </CardRows>
                  </Card>
                  <Card>
                    <CardRows>
                      <Row
                        label="Effective transcription bias"
                        hint="Which of these the recognizer actually receives — it takes only a few."
                        control={
                          <Button variant="ghost" icon={<Icon name="eye" />}>
                            Show
                          </Button>
                        }
                      />
                    </CardRows>
                  </Card>
                </>
              )}

              {tab === "Replacements" && (
                <>
                  <Card
                    title="Replacements"
                    description="Shorthand you say on purpose. Exact match, every mode."
                    footer={
                      <Button icon={<Icon name="plus" />}>Add replacement</Button>
                    }
                  >
                    <ListRows>
                      {REPLACEMENTS.map(([from, to]) => (
                        <ListItem
                          key={from}
                          title={`${from}  →  ${to}`}
                          meta={["exact", "case-insensitive"]}
                          actions={
                            <>
                              <IconButton label="Edit" icon={<Icon name="type" />} />
                              <IconButton label="Delete" icon={<Icon name="trash" />} tone="danger" />
                            </>
                          }
                        />
                      ))}
                    </ListRows>
                  </Card>
                  <Note icon="arrow" tail={<DocLink>Why</DocLink>}>
                    Misheard names belong in Words &amp; names instead.
                  </Note>
                </>
              )}

              {tab === "Snippets" && (
                <Card
                  title="Snippets"
                  description="A trigger phrase you say, and the block it expands to."
                  footer={<Button icon={<Icon name="plus" />}>Add snippet</Button>}
                >
                  <ListRows>
                    {SNIPPETS.map(([name, body]) => (
                      <ListItem
                        key={name}
                        title={name}
                        meta={[`expands to ${body.split("\n").length} lines`]}
                        actions={
                          <>
                            <IconButton label="Edit" icon={<Icon name="type" />} />
                            <IconButton label="Delete" icon={<Icon name="trash" />} tone="danger" />
                          </>
                        }
                      />
                    ))}
                  </ListRows>
                </Card>
              )}
            </PaneDetailMain>
          </>
        }
      />
    </>
  );
}
