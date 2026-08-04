import { useState } from "react";
import {
  Button,
  CaptionBar,
  CaptionScene,
  CaptionStage,
  Card,
  CardRows,
  EchoText,
  EchoWrap,
  HandoffPair,
  HandoffSide,
  Icon,
  Note,
  OverlayPillDrawing,
  OverlayStage,
  PreviewBanner,
  Row,
  SectionHeader,
  StatusBadge,
  Toggle,
  ViewTop,
} from "@/components/shell";

/**
 * LIVE SUBTITLES — `SCREENS.subtitles`, a wide preview.
 *
 * TWO FEATURES WITH ONE NAME, named together and built apart. Captions read the
 * room: system audio, its own window, and you are the audience. The echo reads
 * you: the open microphone, on the overlay, and you are the speaker. The only
 * thing they share is the word, so the screen says so first and then treats
 * them as the two things they are.
 *
 * THE PILL IS DRAWN AT REST APART FROM ITS RECORDING BORDER (ADR 0058). The
 * bars are the prototype's own held shape, not a generator, and the echo's two
 * weights are sample text.
 */
export function SubtitlesScreen() {
  const [echoOn, setEchoOn] = useState(false);

  return (
    <>
      <ViewTop
        title="Live subtitles"
        lead="Two features with one name. One reads the room, the other reads you."
        banner={
          <PreviewBanner>
            Not built. Captions need system-audio capture; the echo needs partial results the
            pipeline does not emit yet.
          </PreviewBanner>
        }
      />

      <SectionHeader
        title="They are two things"
        description="Named together, built apart. The only thing they share is the word."
      >
        <HandoffPair>
          <HandoffSide
            label="Captions"
            out="system audio · its own window · you are the audience"
            outIcon="monitor"
          >
            A film, a stream, a call somebody else is on.
          </HandoffSide>
          <HandoffSide
            label="Echo"
            desk
            out="the open microphone · on the overlay · you are the speaker"
            outIcon="mic"
          >
            Your own voice, while you are dictating it.
          </HandoffSide>
        </HandoffPair>
      </SectionHeader>

      <SectionHeader
        title="Captions"
        description="A strip you place once. It stays where you put it, over whatever is playing."
      >
        <CaptionStage>
          <CaptionScene tag="something playing underneath" tagIcon="monitor">
            <CaptionBar>…and that is the part nobody measured before shipping it.</CaptionBar>
          </CaptionScene>
          <CaptionScene tag="the same strip on a bright frame" tagIcon="sun" light>
            <CaptionBar tone="light">
              …and that is the part nobody measured before shipping it.
            </CaptionBar>
          </CaptionScene>
          <CaptionScene tag="translated, when the pair is set" tagIcon="translate">
            <CaptionBar lang="German">
              …und genau das hat vor der Auslieferung niemand gemessen.
            </CaptionBar>
          </CaptionScene>
        </CaptionStage>
        <Note icon="eye">
          Two lines, rolling, no history. A caption strip that scrolls is a transcript window, and
          a transcript is what the recording is for — this is for the sentence being said right
          now.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="What decides whether it is readable"
        description="It lies over content nobody controls, so every rule here is about surviving that."
      >
        <Card>
          <CardRows>
            <Row
              label="The strip carries its own ground"
              hint="Not text on the video. A frame can go white mid-sentence and the caption has to survive the cut, so the ground is part of the component and never borrowed from what is behind it."
              control={<StatusBadge tone="success">Always opaque</StatusBadge>}
            />
            <Row
              label="Never frosted"
              hint="Frost is for a surface that floats over this application. This one floats over somebody else's video, which is exactly the case ADR 0051 excludes — and blurring a moving picture costs a filter pass per frame of theirs."
              control={<StatusBadge tone="plan">ADR 0051</StatusBadge>}
            />
            <Row
              label="It is excluded from screen shares"
              hint="Same rule the meeting window follows. Subtitles you turned on for yourself must not appear in the recording everybody else receives."
              control={<StatusBadge tone="success">Not captured</StatusBadge>}
            />
            <Row
              label="Click-through"
              hint="It sits over a player whose controls are underneath it. A caption that swallows a click on pause is worse than no caption."
              control={<StatusBadge tone="success">Pointer passes</StatusBadge>}
            />
            <Row
              label="Translated is the same strip"
              hint="When a language pair is set it shows the translation rather than the transcript. Not a second window and not a second feature — the pair comes from the same place the translation window reads it."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open Translation
                </Button>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Echo — your own voice, on the overlay"
        description="A different feature entirely: it exists so a long sentence does not lose its thread halfway through."
      >
        <OverlayStage>
          <EchoWrap>
            <OverlayPillDrawing rec mode="Cleanup" timer="00:12" />
            {/* NO CARD, NO GROUND, NO BORDER. This is not a surface, it is a
                trace: it belongs to the pill the way a shadow belongs to an
                object. Give it a panel and it becomes a second window that has
                to be positioned, dismissed and reasoned about. */}
            <EchoText
              done="Wir verschieben den Termin auf Dienstag und "
              live="ich sage Sarah vorher noch"
            />
          </EchoWrap>
        </OverlayStage>
        <Note icon="eye">
          Bare text under the pill. Not a card and not a panel — it is a trace of the pill rather
          than a second surface, and anything with a border around it becomes a window that has to
          be positioned and dismissed.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="How the echo behaves"
        description="Four rules, and three of them exist because it is drawn over a desktop nobody controls."
      >
        <Card>
          <CardRows>
            <Row
              label="The text colour follows the contrast"
              hint="It sits on whatever application you are dictating into — a white document, a dark editor, a photo. The colour is chosen against what is measured behind it, per redraw, and it is the one place in this product where a colour is not a token."
              control={<StatusBadge tone="accent">Measured, not themed</StatusBadge>}
            />
            <Row
              label="Settled text and the live tail read differently"
              hint="What the recogniser has committed is set; the last few words are still moving and are dimmer. Without the split you re-read the whole line every time it changes, which is worse than no echo."
              control={<StatusBadge tone="success">Two weights</StatusBadge>}
            />
            <Row
              label="It shows the tail, not the transcript"
              hint="About one line. Growing upward until it covers the window you are dictating into is the failure mode, and a scrollback is the recording's job."
              control={<StatusBadge tone="plan">~1 line</StatusBadge>}
            />
            <Row
              label="It is off by default"
              hint="Most dictation is one sentence into a text field, where watching words appear is a distraction from the thing you were actually writing. It earns its place in the long ones."
              control={<Toggle checked={echoOn} onCheckedChange={setEchoOn} aria-label="Echo" />}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="What each one needs that does not exist yet">
        <Card>
          <CardRows>
            <Row
              label="Captions"
              hint="System-audio capture — the same dependency meeting capture is waiting on, and the reason both are drawn rather than built."
              control={<StatusBadge tone="plan">System audio</StatusBadge>}
            />
            <Row
              label="Echo"
              hint="Partial results. The pipeline transcribes a finished recording; an echo needs the recogniser to emit as it goes, which is a streaming lane the local and cloud providers expose differently."
              control={<StatusBadge tone="plan">Streaming recognition</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>
    </>
  );
}
