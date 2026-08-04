import { useState } from "react";
import {
  Button,
  Card,
  CardRows,
  ChatWinDeco,
  DocLink,
  HandoffPair,
  HandoffSide,
  Icon,
  IconButton,
  Matrix,
  Note,
  PreviewBanner,
  Row,
  SectionHeader,
  SegmentControl,
  Select,
  StatusBadge,
  StatusDot,
  SubTabs,
  TranslateAlt,
  TranslateAlts,
  TranslateBody,
  TranslateConversation,
  TranslateDecoPair,
  TranslateListen,
  TranslatePair,
  TranslatePane,
  TranslateRoute,
  TranslateRouteRow,
  TranslateSource,
  TranslateStage,
  TranslateTabs,
  TranslateText,
  TranslateTurn,
  TranslateWindow,
  ViewTop,
} from "@/components/shell";

/**
 * TRANSLATION — `SCREENS.translate`, a wide preview.
 *
 * ADR 0041 settled that translation is a MODE: a dictation goes in, translated
 * text comes out at the cursor, and Auto never selects it. That decision stands
 * and this window does not touch it. This is the other half, and it is a
 * different shape entirely — a mode serves one person writing into somebody
 * else's document; this serves two people in a room who do not share a
 * language.
 *
 * THE ONE THING NEITHER REFERENCE HAS IS THE REASON THIS IS A DESKTOP PRODUCT.
 * On a phone there is one speaker and one screen, so both people share both. On
 * this machine there are two output devices and two audiences, and they do not
 * want the same thing: THEY need to hear their language out loud, YOU need to
 * hear yours without the room hearing it twice. Routing per language is the
 * whole design.
 *
 * NO TABS ON THE VIEW HEADER. Every other screen puts its sub-tabs there, and
 * here it would be the same control drawn twice: the window below carries its
 * own, because in the product that row is part of the window's chrome. The one
 * in the drawing is the real one.
 */

const TURNS = [
  {
    side: "them" as const,
    lang: "German",
    said: "Ich habe seit drei Tagen Schmerzen im rechten Knie.",
    heard: "I have had pain in my right knee for three days.",
  },
  {
    side: "you" as const,
    lang: "English",
    said: "Does it hurt when you put weight on it?",
    heard: "Tut es weh, wenn Sie es belasten?",
  },
  {
    side: "them" as const,
    lang: "German",
    said: "Ja, besonders beim Treppensteigen.",
    heard: "Yes, especially going up stairs.",
  },
];

/* The listening strip's meter is at rest (ADR 0058): the prototype drives it
   from `orbEnvelope`, and a gallery screen measures nothing. */
const LEVEL_AT_REST = new Array(12).fill(0);

export function TranslateScreen() {
  const [tab, setTab] = useState("One way");
  const [address, setAddress] = useState("As dictated");
  const [theirs, setTheirs] = useState("Out loud");
  const [yours, setYours] = useState("In your ear");

  return (
    <>
      <ViewTop
        title="Translation"
        lead="Two people, two languages, one machine in the middle — and the part a phone cannot do."
        banner={
          <PreviewBanner>
            Not built. Shape and rules only; needs a speech model per direction and text-to-speech.
          </PreviewBanner>
        }
      />

      <SectionHeader
        title="It is not the Translate mode, and it is not a second one"
        description="ADR 0041's mode serves one person writing. This serves two people talking, and the dictation contract breaks in three places the moment there are two."
      >
        <HandoffPair>
          <HandoffSide
            label="Translate, the mode"
            out="one utterance, one insert, session over"
            outIcon="type"
          >
            You dictate, translated text lands at your cursor.
          </HandoffSide>
          <HandoffSide
            label="Translate, the window"
            desk
            out="no insert target, no end, and it has to be heard"
            /* `icon("sound")` in the prototype, which is not a name its own set
               carries — it falls back to the dot. Ported as it renders. */
            outIcon="dot"
          >
            Two of you talk. Nothing is inserted anywhere.
          </HandoffSide>
        </HandoffPair>
        <Note icon="about" tail={<DocLink>ADR 0041</DocLink>}>
          Same name on purpose. It is one capability with two surfaces, the way the assistant is
          one thing with three doors — and the mode keeps its rule: Auto never selects a language.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="The window"
        description="One way for a phrase you need now. Conversation for a table."
      >
        <TranslateStage>
          <TranslateWindow>
            <ChatWinDeco
              title="Translate"
              sub={<TranslateDecoPair>German → English</TranslateDecoPair>}
              actions={<IconButton label="Close" icon={<Icon name="x" />} />}
            />
            <TranslatePair
              from={
                <Select defaultValue="German" aria-label="From">
                  <option>German</option>
                  <option>English</option>
                  <option>French</option>
                  <option>Spanish</option>
                  <option>Turkish</option>
                  <option>Polish</option>
                </Select>
              }
              to={
                <Select defaultValue="English" aria-label="To">
                  <option>English</option>
                  <option>German</option>
                  <option>French</option>
                  <option>Spanish</option>
                  <option>Turkish</option>
                  <option>Polish</option>
                </Select>
              }
            />
            <TranslateTabs>
              <SubTabs
                label="Translate"
                value={tab}
                onChange={setTab}
                items={[
                  { id: "One way", label: "One way" },
                  { id: "Conversation", label: "Conversation" },
                ]}
              />
            </TranslateTabs>

            {tab === "One way" ? (
              <TranslateBody>
                <TranslatePane lang="German" trailing={<TranslateSource>spoken</TranslateSource>}>
                  <TranslateText>
                    Können wir den Termin auf nächste Woche Dienstag verschieben?
                  </TranslateText>
                </TranslatePane>
                <TranslatePane
                  lang="English"
                  out
                  trailing={
                    <span className="ws-rowflex">
                      <IconButton label="Play again" icon={<Icon name="speaker" />} />
                      <IconButton label="Copy" icon={<Icon name="copy" />} />
                    </span>
                  }
                >
                  <TranslateText>
                    Could we <TranslateAlt>move</TranslateAlt> the appointment to next Tuesday?
                  </TranslateText>
                  <TranslateAlts options={["move", "push", "reschedule"]} value="move" />
                </TranslatePane>
              </TranslateBody>
            ) : (
              <TranslateConversation>
                {TURNS.map((turn, index) => (
                  <TranslateTurn
                    key={index}
                    side={turn.side}
                    lang={turn.lang}
                    said={turn.said}
                    heard={turn.heard}
                  />
                ))}
                <TranslateListen>
                  <StatusDot tone="danger" />
                  <Matrix
                    mode="vu"
                    levels={LEVEL_AT_REST}
                    rows={7}
                    cols={12}
                    size={2}
                    gap={1}
                    ariaLabel="Input level"
                  />
                  <b>German</b>
                  <span>heard, switching by itself</span>
                  <span className="ws-grow" />
                  <Button variant="ghost">End</Button>
                </TranslateListen>
              </TranslateConversation>
            )}
          </TranslateWindow>
        </TranslateStage>
        <Note icon="eye">
          The tab above switches this drawing. Conversation takes no button per turn — the switch
          between the two languages is detected, which is the one interaction that decides whether
          this works at a table or only in a demo.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="Where each translation comes out"
        description="Two languages, two audiences, and on this machine two output devices. They are not the same need."
      >
        <Card
          body={
            <TranslateRoute>
              <TranslateRouteRow
                lang="German"
                who="What they hear"
                why="Their language, out loud, so the person across the table hears it without leaning into your screen."
              >
                <SegmentControl
                  aria-label="How German comes out"
                  value={theirs}
                  onChange={setTheirs}
                  options={[
                    { value: "Silent", label: "Silent" },
                    { value: "Out loud", label: "Out loud" },
                    { value: "In your ear", label: "In your ear" },
                  ]}
                />
                <Select defaultValue="Desk speakers" aria-label="German device">
                  <option>Desk speakers</option>
                  <option>System default</option>
                  <option>Desk speakers</option>
                  <option>AirPods Pro</option>
                  <option>Display audio</option>
                </Select>
              </TranslateRouteRow>
              <TranslateRouteRow
                lang="English"
                who="What you hear"
                why="Your language, in your ear. The room does not need every sentence twice, and you do not want to talk over it."
              >
                <SegmentControl
                  aria-label="How English comes out"
                  value={yours}
                  onChange={setYours}
                  options={[
                    { value: "Silent", label: "Silent" },
                    { value: "Out loud", label: "Out loud" },
                    { value: "In your ear", label: "In your ear" },
                  ]}
                />
                <Select defaultValue="AirPods Pro" aria-label="English device">
                  <option>AirPods Pro</option>
                  <option>System default</option>
                  <option>Desk speakers</option>
                  <option>AirPods Pro</option>
                  <option>Display audio</option>
                </Select>
              </TranslateRouteRow>
            </TranslateRoute>
          }
        >
          <CardRows>
            <Row
              label="Silent is a real setting and not a broken one"
              hint="Reading is faster than listening and quieter than both. Somebody translating a menu at the next table wants no sound at all, and that is the same window."
              control={<StatusBadge tone="plan">Per language</StatusBadge>}
            />
            <Row
              label="The voice is text-to-speech and it is named"
              hint="The same connection every other job runs on, chosen on AI Models like the rest. A spoken translation is a model output; a surface that does not say which model spoke is hiding the one thing that decides how it sounds."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open AI Models
                </Button>
              }
            />
            <Row
              label="It never speaks over the microphone it is recording"
              hint="Out loud plus an open microphone is the machine transcribing itself. The recogniser is muted for the length of the utterance being spoken, which is why the two devices matter rather than being a convenience."
              control={<StatusBadge tone="plan">Runtime rule</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="It already knows your words"
        description="The two features a translator charges for are decisions this product made for other reasons, years-deep in the profile."
      >
        <Card>
          <CardRows>
            <Row
              label="Terminology"
              hint="Your profile's Words & names. Names, products and technical terms a translator must leave alone — learned from what you actually dictate rather than typed into a glossary form nobody maintains."
              control={<StatusBadge tone="success">Words &amp; names</StatusBadge>}
            />
            <Row
              label="Address form"
              hint="German, French and Spanish force a choice English does not carry. As dictated keeps a formal sentence formal; the other two decide for you."
              control={
                <SegmentControl
                  aria-label="Address form"
                  value={address}
                  onChange={setAddress}
                  options={[
                    { value: "As dictated", label: "As dictated" },
                    { value: "Formal", label: "Formal" },
                    { value: "Informal", label: "Informal" },
                  ]}
                />
              }
            />
            <Row
              label="Alternatives on the word"
              hint="Marked in the sentence where the choice was, not listed as three whole alternative sentences you have to re-read to find the one word you were unsure about."
              control={<StatusBadge tone="plan">On the output</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* The owner raised practice mode and doubted it in the same sentence,
          which was the right instinct, so this is the evaluation rather than a
          fourth tab. */}
      <SectionHeader
        title="Practice mode, evaluated and not built"
        description="Google added language practice beside Live Translate in 2025. This is why WordScript should not copy it, and the one form that would not be a copy."
      >
        <Card>
          <CardRows>
            <Row
              label="Against: it is a different product"
              hint="VISION names what WordScript is not — a feature collection. A practice surface has its own progress model, its own scheduling and its own content, and none of it shares a line with trigger, capture, transform or insert."
              control={<StatusBadge tone="plan">Out of scope</StatusBadge>}
            />
            <Row
              label="Against: the competition is free and enormous"
              hint="A drill built beside a dictation tool is compared to products with a decade of pedagogy in them, and loses on the axis that is not ours."
              control={<StatusBadge tone="plan">Not our axis</StatusBadge>}
            />
            <Row
              label="For, and it is the only one"
              hint="Every generic app drills a generic word list. This one holds the sentences you actually said, in your own vocabulary, that a translator had to repair. That corpus exists here and nowhere else, and it is the difference between a practice feature and a practice product."
              control={<StatusBadge tone="warning">If ever</StatusBadge>}
            />
            <Row
              label="So the recorded shape is small"
              hint="Not a tab and not a mode: the words your own translations kept getting wrong, offered where the vocabulary already lives. Nothing is built for it now."
              control={<StatusBadge tone="plan">Candidate</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <Note icon="about">
        Speech in two directions and a voice that speaks are both new runtime capability. Neither
        exists today, and this window is drawn so the decisions are settled before either is
        bought.
      </Note>
    </>
  );
}
