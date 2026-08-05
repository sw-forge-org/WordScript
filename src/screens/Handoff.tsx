import {
  Button,
  Card,
  CardRows,
  Cross,
  CrossFlow,
  CrossFlowStep,
  CrossItem,
  CrossSide,
  DocLink,
  Handoff,
  HandoffCell,
  HandoffFoot,
  HandoffGrid,
  HandoffHead,
  HandoffPair,
  HandoffSaid,
  HandoffSide,
  HandoffStage,
  HotkeyButton,
  Icon,
  LineCompare,
  LineCompareRow,
  Note,
  OverlayPillDrawing,
  OverlayStage,
  OverlayTab,
  PreviewBanner,
  Row,
  SectionHeader,
  StatusBadge,
  ViewTop,
} from "@/components/shell";
import { DESK, DESK_CAP } from "./data";

/**
 * HANDOFF — `SCREENS.handoff`, a wide preview.
 *
 * The screen the second half of the port hangs off: it brings the shipped
 * overlay pill drawn at its real geometry, the handoff card, and the crossing
 * itself. Three later screens read those back.
 *
 * Written to budget on both sides of the copy switch: nothing on this surface
 * ships, so a copy reduction here would be measured against nothing (§11.10).
 */
export function HandoffScreen() {
  return (
    <>
      <ViewTop
        title="Handoff"
        lead="What happens when a dictation asks for something to be done rather than written."
        banner={<PreviewBanner>Planned for Phase 8 — ADR 0044.</PreviewBanner>}
      />

      <SectionHeader
        title="One word apart"
        description="The assistant can do the first of these and must not do the second."
      >
        <HandoffPair>
          <HandoffSide
            label="The assistant"
            out="text at your cursor, in about two seconds"
            outIcon="type"
          >
            “<b>Write</b> the mail from Tuesday's meeting.”
          </HandoffSide>
          <HandoffSide
            label={DESK_CAP}
            desk
            out="a mail leaves your account, in about two minutes"
            outIcon="handoff"
          >
            “<b>Send</b> the mail from Tuesday's meeting.”
          </HandoffSide>
        </HandoffPair>
        <Note icon="about">
          The difference is a verb, and the user does not classify their sentence before saying
          it. Today the choice is made with a hotkey before the sentence exists, so standing in
          the wrong door costs the whole dictation.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="The offer"
        description="The assistant recognises it cannot do this, and offers to pass it on. It does not pass it on."
      >
        <HandoffStage>
          <Handoff>
            <HandoffHead
              title={`Hand this to ${DESK}?`}
              why="You asked for something to happen, not for text."
            />
            <HandoffSaid label="What you said">
              “Take the decisions from Tuesday's Acme review, write the follow-up mail to Sarah
              and send it.”
            </HandoffSaid>
            <HandoffGrid>
              <HandoffCell label="Target" value="General">
                the desk's own thread — no repository involved
              </HandoffCell>
              <HandoffCell label="Role" value="work">
                may act, under this target's permission profile
              </HandoffCell>
              <HandoffCell label="Reads" value="Acme review · 3 objects">
                collected by the assistant before handing over
              </HandoffCell>
              <HandoffCell label="May reach" value="Mail · Calendar">
                through the desk's own connectors, not WordScript's
              </HandoffCell>
            </HandoffGrid>
            <HandoffFoot
              keys={
                <>
                  <kbd>Enter</kbd> hand over<span className="ws-sep">·</span>
                  <kbd>Esc</kbd> insert it as a dictation instead
                </>
              }
              actions={
                <>
                  <Button variant="ghost">Insert instead</Button>
                  <Button icon={<Icon name="handoff" />}>Hand over</Button>
                </>
              }
            />
          </Handoff>
        </HandoffStage>
        <Note icon="privacy" tail={<DocLink>ADR 0029</DocLink>}>
          Nothing has happened when this appears. ADR 0029's prohibition on side-effecting tools
          in the dictation path is intact — what is offered is a handover, and the offer is
          refused by doing nothing to it.
        </Note>
        <Note icon="keyboard" tail={<DocLink>ADR 0006</DocLink>}>
          It does not take focus. The dictation overlay must keep focus: false or the insert
          target moves out of the app you were writing in, and this card stands in exactly that
          moment — so it grabs Enter and Escape while it is visible instead of becoming a focused
          dialog.
        </Note>
      </SectionHeader>

      <SectionHeader
        title="Escape is a fallback, not a cancel"
        description="Refusing costs one keystroke and no words."
      >
        <Card>
          <CardRows>
            <Row
              label="Enter"
              hint="Hands over. The dictation becomes the prompt for a run, the thread opens in the agent window, and nothing is inserted at your cursor."
              control={<StatusBadge tone="accent">Starts a run</StatusBadge>}
            />
            <Row
              label="Escape"
              hint="Treats it as the dictation it always was. The text goes to the cursor in the mode on the pill, and the run never existed."
              control={<StatusBadge tone="success">Inserts the text</StatusBadge>}
            />
            <Row
              label="Neither, for 10 seconds"
              hint="Same as Escape. A card that expires into the destructive option would be a trap, and doing nothing must be the safe answer everywhere in this product."
              control={<StatusBadge tone="success">Inserts the text</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Where the line runs"
        description="Four properties, and they all fall on the same side of the same cut. That is the argument that the boundary is real and not drawn to sort a list."
      >
        <Card
          body={
            <LineCompare>
              <LineCompareRow head cells={["", "The assistant", DESK_CAP]} />
              <LineCompareRow
                cells={["Time", "seconds — inside the dictation", "minutes to days"]}
              />
              <LineCompareRow
                cells={["Effects", "none. Text, and only text", "whatever its connectors reach"]}
              />
              <LineCompareRow
                cells={["Reads", "what is on this disk", "what is reachable over the network"]}
              />
              <LineCompareRow
                cells={["Owned by", "WordScript — model, prompt, stages", "the harness you chose"]}
              />
              <LineCompareRow
                cells={["Ends in", "one reducer commit", "a thread that stays open"]}
              />
            </LineCompare>
          }
        >
          <CardRows>
            <Row
              label="Why they cannot simply be one thing"
              hint="A session ends in exactly one reducer commit (ADR 0018). A process that runs for days has no single end point, and one that has an end point cannot run for days. The rest follows from that."
              control={<StatusBadge tone="plan">ADR 0018</StatusBadge>}
            />
            <Row
              label="And why the surface can be"
              hint="The user has one intent — do this with what I have here. Only the execution differs, and the handoff is where the difference becomes visible instead of being demanded up front."
              control={<StatusBadge tone="success">One input</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Auto never comes here"
        description="The mode picker reaches the assistant. Nothing reaches the desk without a key."
      >
        <Card>
          <CardRows>
            <Row
              label="What Auto may decide"
              hint="Cleanup, Draft or Prompt Enhance — how the text reads."
              control={<StatusBadge tone="success">How it reads</StatusBadge>}
            />
            <Row
              label="What Auto may not decide"
              hint="The language it is in (ADR 0041), and whether anything happens at all. Both are unrecoverable the moment they are wrong: text in the wrong language is already in somebody else's document, and a mail that has been sent cannot be recalled."
              control={<StatusBadge tone="plan">Never</StatusBadge>}
            />
            <Row
              label="So the offer is always an offer"
              hint="Even with the recogniser certain and the sentence unambiguous, the key is pressed by a person. This is the one place in the dictation path where something irreversible starts, and it is the one place two seconds are justified."
              control={<HotkeyButton combo="Enter" />}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* Everything above this point is the offer: why it exists, what the two
          keys do, where the line runs. What the screen never drew is the thing
          the line is FOR — what actually goes across when Enter is pressed.
          ADR 0044's privacy claim lives entirely in this step, and a boundary
          nobody can inspect is a boundary nobody can trust. */}
      <SectionHeader
        title="What crosses"
        description="The assistant assembles the brief before it hands over, because gathering is a read and reads are what the assistant is allowed to do. The desk receives a finished prompt and never searches for anything."
      >
        <Card
          body={
            <Cross>
              <CrossSide label="Handed over" icon="check">
                <CrossItem title="The sentence, verbatim">
                  Not a paraphrase. It is the thing that will be acted on, so it is the thing you
                  were shown.
                </CrossItem>
                <CrossItem title="3 objects from the Acme review">
                  The decisions, the attendee list and the follow-up note — read off this disk by
                  the assistant.
                </CrossItem>
                <CrossItem title="Target and role">
                  General · work. Set once, on the target, not spoken into the dictation.
                </CrossItem>
              </CrossSide>
              <CrossSide label="Stayed here" icon="privacy" held>
                <CrossItem title="The audio">
                  Discarded after transcription, as on every other path. The desk never receives
                  sound.
                </CrossItem>
                <CrossItem title="Your other context objects">
                  The assistant read three and sent three. Nothing is handed over on the chance it
                  might be useful.
                </CrossItem>
                <CrossItem title="Your API keys">
                  The desk authenticates with its own credentials to its own connectors.
                  WordScript's keys never leave the OS secret store.
                </CrossItem>
                <CrossItem title="Profiles, dictionary, history">
                  Personalization is how the text was produced. It is not part of what was asked.
                </CrossItem>
              </CrossSide>
            </Cross>
          }
        >
          <CardRows>
            <Row
              label="Inspect before handing over"
              hint="The brief is readable in the card. A handoff you cannot read before pressing the key is the silent auto-handoff this record forbids, arrived at by a different route."
              control={
                <Button variant="ghost" icon={<Icon name="eye" />}>
                  Show the brief
                </Button>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="After the key"
        description="Four steps, and the first two are the ones that make it safe."
      >
        <Card
          body={
            <CrossFlow>
              <CrossFlowStep title="The card closes and nothing is inserted">
                The dictation does not also go to your cursor. One sentence produces one outcome —
                the failure this whole record exists to remove is a sentence that lands in two
                places.
              </CrossFlowStep>
              <CrossFlowStep title="A new thing starts, with its own lifetime">
                The session that offered the handoff ends in its own single commit (ADR 0018). It
                does not stay open waiting for the run; the run is not part of it.
              </CrossFlowStep>
              <CrossFlowStep title="The thread opens in the agent window">
                Your sentence is its first entry, which is why a handed-over dictation is not in
                the transcript history — it is in the thread, where the answer to it will be.
              </CrossFlowStep>
              <CrossFlowStep title="The overlay tab says so">
                The same left slot the agent tab uses. A handed-over session runs no finalization,
                so it learns no words, so the learned-word tab cannot be there at the same time.
              </CrossFlowStep>
            </CrossFlow>
          }
        />
      </SectionHeader>

      <SectionHeader
        title="And when it comes back"
        description="The desk answers what it can and reaches you for what it cannot. That is a filter, and a filter has an output."
      >
        <Card>
          <CardRows>
            <Row
              label="It finished"
              hint="A line in the thread and the cue that means a round trip completed. No card, no interruption — you asked for it, it happened."
              control={<StatusBadge tone="success">Thread only</StatusBadge>}
            />
            <Row
              label="It has a question"
              hint="A row in Home's decision inbox, sorted by what happens if you do nothing. A desk question expires and takes its blocked run with it, which is why that column and not urgency decides the order."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open the inbox
                </Button>
              }
            />
            <Row
              label="It asked out loud"
              hint="Only when you configured it to. One spoken field, length-limited, and the answer is returned verbatim — the desk may compose the question, never the answer."
              control={<StatusBadge tone="plan">ADR 0030</StatusBadge>}
            />
            <Row
              label="The offer was wrong"
              hint="You pressed Escape and got a dictation. That costs one keystroke and no words, and it is the entire budget the effect-verb recogniser has: if refusals become common the recogniser is wrong, and the fix is fewer offers rather than a faster path through one."
              control={<StatusBadge tone="success">One keystroke</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="It is the same tab"
        description="While a handed-over run is working, the overlay says so with the component it already has."
      >
        <OverlayStage>
          <OverlayPillDrawing mode="Draft" timer="00:00" tab={<OverlayTab>handed over</OverlayTab>} />
        </OverlayStage>
        <Note icon="arrow">
          The left slot, the same one the agent tab uses and for the same reason: a handed-over
          session runs no finalization, so it learns no words, so the learned-word tab is
          structurally absent for exactly as long as this one can exist.
        </Note>
      </SectionHeader>

      <Note icon="about" tail={<DocLink>ADR 0030</DocLink>}>
        A handed-over dictation does not enter the transcript history. What you said becomes the
        first entry of the thread, where the answer to it will also be — the same reason bridge
        sessions stay out of it.
      </Note>
    </>
  );
}
