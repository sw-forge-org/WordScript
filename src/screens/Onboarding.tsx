import { useState } from "react";
import {
  Button,
  Card,
  CardRows,
  CheckList,
  Field,
  Icon,
  Keycaps,
  LevelMeter,
  ModelList,
  ModelRow,
  Note,
  OnboardingFoot,
  OnboardingRail,
  OnboardingStepHead,
  PreviewBanner,
  PreviewTag,
  ProviderMark,
  Row,
  SectionHeader,
  Select,
  StatusBadge,
  StatusDot,
  TextArea,
  ViewTop,
  type OnboardingStep,
} from "@/components/shell";
import { ShortcutField } from "@/components/settings/ShortcutField";
import { InertSegment, ProviderPick } from "./Models";
import { TypingBaseline } from "./Privacy";
import { LANES, libraryModel, type LaneName } from "./data";

/**
 * ONBOARDING — `SCREENS.onboarding`.
 *
 * Seven steps, walkable, because a setup flow's content IS its order and a
 * single frame cannot show an order.
 *
 * WHAT IS NOT IN THIS FLOW IS STATED RATHER THAN OMITTED, on the last step. A
 * setup flow's real failure mode is length, and the way it gets long is one
 * defensible addition at a time. The test each omission failed: does it block
 * the first dictation? Nothing on that card does.
 */
const OB_STEPS: OnboardingStep[] = [
  { id: "welcome", label: "Welcome", icon: "wand" },
  { id: "mic", label: "Microphone", icon: "mic" },
  { id: "models", label: "AI Models", icon: "models" },
  { id: "hotkey", label: "Hotkey", icon: "keyboard" },
  { id: "insert", label: "Insert", icon: "delivery" },
  { id: "try", label: "Try it", icon: "play" },
  { id: "done", label: "Done", icon: "check" },
];

export function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const [lane, setLane] = useState<LaneName>("Cloud");
  /* LOCAL, LIKE EVERY OTHER ANSWER IN THIS FLOW. The flow has no entry point
     yet (`ENTRY_POINT_HOLES`) and writes no config; the banner at the top says
     so for the whole screen, which is why this control is not marked
     separately. The default is the runtime's own. */
  const [baseline, setBaseline] = useState(40);
  /* THE HOTKEY IS AN ANSWER, SO IT LIVES WHERE THE OTHER ANSWERS DO. The step
     that sets it, the step that asks you to press it and the summary that
     recites it are three different components, and a shortcut chosen in the
     first one that the other two do not know about is the kind of lie this
     screen argues against everywhere else. The default is the drawing's, which
     is the platform default it stands in for. */
  const [hotkey, setHotkey] = useState("Ctrl+Super");
  const step = OB_STEPS[index];
  const last = index === OB_STEPS.length - 1;

  return (
    <>
      <ViewTop
        title="Onboarding"
        lead="Seven steps, walkable. Nothing is claimed until it is proved."
        banner={
          <PreviewBanner>
            Planned for Phase 6. The flow's shape and order, not a working setup.
          </PreviewBanner>
        }
      />

      <OnboardingRail steps={OB_STEPS} index={index} onJump={setIndex} />

      <OnboardingStepHead n={index + 1} total={OB_STEPS.length} title={step.label} />

      {step.id === "welcome" && <Welcome />}
      {step.id === "mic" && <Microphone />}
      {step.id === "models" && <Models lane={lane} onLane={setLane} />}
      {step.id === "hotkey" && <Hotkey value={hotkey} onValue={setHotkey} />}
      {step.id === "insert" && <Insert />}
      {step.id === "try" && <TryIt hotkey={hotkey} />}
      {step.id === "done" && (
        <Done hotkey={hotkey} baseline={baseline} onBaseline={setBaseline} />
      )}

      <OnboardingFoot
        onBack={index > 0 ? () => setIndex(index - 1) : undefined}
        onNext={() => setIndex(index + 1)}
        nextLabel={step.id === "try" ? "It worked" : "Continue"}
        skip={step.id === "try" ? "Skip the proof" : undefined}
        onSkip={() => setIndex(index + 1)}
        last={last}
        onRestart={() => setIndex(0)}
      />
    </>
  );
}

function Welcome() {
  return (
    <Card
      title="WordScript turns speech into text, in any application"
      description="Press one key anywhere, speak, and the text appears at your cursor. Six steps, and the last one proves it."
    >
      <CardRows>
        <Row
          label="Where your audio goes"
          hint="You choose in step three: a cloud provider you hold a key for, or a model on this machine."
          control={<StatusBadge tone="plan">Your choice</StatusBadge>}
        />
        <Row
          label="What is stored"
          hint="Transcripts stay on this machine. API keys go to the OS secret store, never to a config file."
          control={<StatusBadge tone="success">Locally</StatusBadge>}
        />
      </CardRows>
    </Card>
  );
}

function Microphone() {
  return (
    <Card title="Which microphone" description="The device, and proof that sound is actually arriving from it.">
      <CardRows>
        <Row
          label="Input device"
          control={
            <span className="ws-rowflex">
              <Select defaultValue="Yeti Nano Analog Stereo — default" aria-label="Input device">
                <option>Yeti Nano Analog Stereo — default</option>
                <option>Built-in Audio</option>
              </Select>
              <Button variant="ghost">Rescan</Button>
            </span>
          }
        />
        <Row
          label="Permission"
          hint="Granted by the OS, checked natively rather than assumed."
          control={<StatusBadge tone="success">Granted</StatusBadge>}
        />
      </CardRows>
      <CardRows>
        {/* Drawn at rest: `active` opens a microphone, and a display surface
            does not take a device (ADR 0058). */}
        <Row
          layout="stack"
          label="Say something"
          hint="A capture that never crosses the mark is discarded as empty, so this is worth checking before the hotkey exists."
        >
          <LevelMeter peak={64} hold={71} threshold={30} state="ok" verdict="Good — peak −13 dBFS." />
        </Row>
      </CardRows>
    </Card>
  );
}

/**
 * WHY A LANE IS NOT OFFERED, PER LANE, OR NOTHING WHERE IT IS (D1c).
 *
 * Two lanes can be operated as of D1b and carry no tag: `Cloud` since Leg 6 and
 * `Your server` since ADR 0165 reversed ADR 0067 rule 1 over it. The other two
 * are withheld for reasons that are not the same reason, and merging them is
 * what ADR 0163 forbids — `Local` is finished in the runtime and held back by
 * the product, `Enterprise` has no adapter at all. A tag that said *drawn, not
 * built* over `Local` would be false about a lane whose runtime works.
 */
const LANE_NOT_OFFERED: Partial<Record<LaneName, string>> = {
  Local:
    "Built and withheld, not drawn. The runtime carries this lane and can install for it; what is withheld is OFFERING it, until ROADMAP Phase 5 has finished it.",
  Enterprise:
    "Drawn, not built. The rows show the shape this lane will have; WordScript has no adapter behind it yet.",
};

/**
 * THE STEP THIS FLOW WAS MISSING ENTIRELY. Setup asked for a provider in one
 * line and never mentioned that the same connection drives cleanup, translation
 * and the assistant — so the first surprise arrived later, in settings, as five
 * model rows nobody had been told about.
 *
 * It renders the SAME lane segment and the SAME provider picker as AI Models.
 * Not a simplified twin: the control the user meets here is the control they
 * will find again.
 */
function Models({ lane, onLane }: { lane: LaneName; onLane: (lane: LaneName) => void }) {
  return (
    <>
      <Card
        title="One connection, for everything"
        description="The same connection recognizes speech and runs every text job. Set once; any job can be repointed later."
      >
        <CardRows>
          <Row
            label="Lane"
            /* ADR 0161'S TAG, ON THE SCREEN ADR 0163 FOUND WITHOUT IT (D1c).
               `AI Models` marks the lane it is sitting on when that lane is not
               operable, and this flow renders the same segment and marked
               nothing — so a reader who walked to step three and pressed
               `Local` was shown a lane with no statement about it anywhere.

               **The two withheld lanes are withheld for different reasons and
               the tag says which**, rather than borrowing one sentence for
               both: `AI Models` splits exactly this way (ADR 0163), because a
               withheld row is only ever as true as the reason it names. */
            tag={LANE_NOT_OFFERED[lane] && <PreviewTag title={LANE_NOT_OFFERED[lane]} />}
            hint="Cloud sends audio and text to a provider you hold a key for. Local keeps everything on this machine and needs a download."
            control={
              <InertSegment
                options={["Cloud", "Local", "Self-hosted", "Enterprise"]}
                active={lane}
                label="Lane"
                onChange={(value) => onLane(value as LaneName)}
              />
            }
          />
          {/* THE ONE SETTING THAT EARNS A LINE HERE AND IS NOT A CONNECTION.
              Auto-detect works, so this is not blocking — but the user this
              product is built for dictates German and writes English, and
              getting it wrong is the difference between a usable first
              dictation and a baffling one. One row, no step of its own. */}
          <Row
            label="What you speak"
            hint="Auto-detect reads it from the audio, per dictation. Naming it is a little faster and a little more accurate."
            control={
              <Select defaultValue="Auto-detect" aria-label="What you speak">
                <option>Auto-detect</option>
                <option>German</option>
                <option>English</option>
                <option>French</option>
                <option>Spanish</option>
              </Select>
            }
          />

          {lane === "Cloud" && (
            <>
              <ProviderPick
                lane="Cloud"
                selected="Groq"
                hint="Speech and language are different capabilities and not every provider has both."
              />
              <Row
                label="API key"
                hint="Held in the OS secret store. Never written to the config file, and never read back into the interface."
                control={
                  <span className="ws-rowflex">
                    <Field defaultValue="gsk_••••••••••••••••" w="190px" aria-label="API key" />
                    <StatusBadge tone="success">Verified</StatusBadge>
                  </span>
                }
              />
            </>
          )}

          {lane === "Enterprise" && (
            <>
              <ProviderPick
                lane="Enterprise"
                selected="AWS Bedrock"
                label="Account"
                hint="These authenticate against an account and a region rather than with a single token, and each carries its own credential shape."
              />
              <Row
                label="Region"
                control={
                  <Select defaultValue="eu-central-1" aria-label="Region">
                    <option>eu-central-1</option>
                    <option>us-east-1</option>
                    <option>us-west-2</option>
                  </Select>
                }
              />
              <Row
                label="Credentials"
                hint="Access key, secret and region — or the ambient AWS credential chain when this machine already has one."
                control={
                  <span className="ws-rowflex">
                    <StatusBadge tone="plan">Not configured</StatusBadge>
                    <Button variant="ghost" icon={<Icon name="key" />}>
                      Configure
                    </Button>
                  </span>
                }
              />
              <Row
                label="Speech"
                hint="Only Azure OpenAI transcribes among the three. On the other two, recognition needs the Cloud or Local lane and the writing jobs use your account."
                control={<StatusBadge tone="warning">Azure only</StatusBadge>}
              />
            </>
          )}

          {lane === "Self-hosted" && (
            <>
              <Row
                label="URL"
                hint="An OpenAI-compatible server you operate, on another machine. Not another name for the on-device lane."
                control={
                  <span className="ws-rowflex">
                    <Field placeholder="http://10.0.0.2:8080/v1" w="220px" aria-label="URL" />
                    <Button variant="ghost">Test</Button>
                  </span>
                }
              />
              <Row
                label="Model id"
                hint="A server behind a URL does not have to publish a model list, so it is typed rather than picked."
                control={<Field placeholder="llama-3.3-70b" w="190px" aria-label="Model id" />}
              />
              <Row
                label="Credential"
                hint="Optional. Some self-hosted servers take a bearer token, most take none."
                control={
                  <span className="ws-rowflex">
                    <StatusBadge tone="plan">None</StatusBadge>
                    <Button variant="ghost" icon={<Icon name="key" />}>
                      Add
                    </Button>
                  </span>
                }
              />
              {/* INVERTED, BECAUSE THE LANE WENT THE OTHER WAY (D1c).
                  This row read *A chat endpoint does not transcribe.
                  Recognition needs the Cloud or Local lane; the writing jobs
                  use your server* — written when the lane was a drawing of a
                  `/chat/completions` host. D1a registered it with
                  `speech: Some, chat: None` and D1b gave it somewhere to type
                  its endpoint, so both halves of that sentence are now the
                  wrong way round: it listens, and it is the writing jobs that
                  need another connection. The words are the seam's own for
                  this exact shape (`connectionCapabilitySentence`). */}
              <Row
                label="Speech"
                hint="Your server does the listening — WordScript posts the audio to its transcription endpoint. Speech only: the writing jobs stay on whichever connection can write."
                control={<StatusBadge tone="success">This lane</StatusBadge>}
              />
            </>
          )}
        </CardRows>
      </Card>

      {/* THE LOCAL LANE GETS THE REAL THING, NOT A SELECT. A picker that names
          `ggml-base · 142 MB` and cannot fetch it is the same failure the
          settings surface had before §11.34: the lane can be chosen and then not
          populated. Onboarding is the worst place for it — it is the one moment
          the user has agreed to spend time on setup. So it renders the component
          the settings screen uses, with its real controls. */}
      {lane === "Local" && (
        <>
          <SectionHeader
            title="Pick one speech model"
            description="It runs on this machine, so it has to be downloaded once. Sizes are stated before the download, not during it."
          >
            <Card>
              <ModelList>
                <ModelRow {...libraryModel("local-speech-base")} state="downloading" pct={46} />
                <ModelRow {...libraryModel("local-speech-base-en")} />
                <ModelRow {...libraryModel("local-speech-small")} />
              </ModelList>
            </Card>
          </SectionHeader>

          {/* Two cards, not one with rows and body. The card renders rows before
              body, so a single card put "which server runs it" above "which
              model" — the answer before the question. */}
          <SectionHeader
            title="And one language model"
            description="This one writes: cleanup, rewrite, translate and the assistant all use it."
          >
            <Card>
              <ModelList>
                <ModelRow {...libraryModel("local-chat-llama-3b")} />
                <ModelRow {...libraryModel("local-chat-qwen-7b")} />
                <ModelRow {...libraryModel("local-chat-gemma-4b")} />
              </ModelList>
            </Card>
            <Card>
              <CardRows>
                {/* THE SECOND COPY ADR 0163 NAMED AND LEFT (D1c). ADR 0161
                    marked these two claims on `AI Models`; the same two stood
                    unmarked here, one step of a flow away, and the reason they
                    survived is the reason ADR 0161 gives for finding them at
                    all — nobody looked at the rendered screen.

                    **`Detected, not configured` is the sharpest form of it**:
                    the row says out loud that it read the machine, and nothing
                    in `src-tauri/` reads either fact. The drawing stays and
                    declares itself, which is the owner's rule (ADR 0161); it is
                    not deleted, because the sketch is the deliverable. */}
                <Row
                  label="Server"
                  tag={
                    <PreviewTag title="Not built. WordScript ships no Ollama today — tauri.conf.json bundles no binary — so a server you already run is the only real answer." />
                  }
                  hint="WordScript ships one and starts it when a job needs it. If you already run Ollama or LM Studio, point it there instead in Settings."
                  control={
                    <span className="ws-rowflex">
                      <span className="ws-selmark">
                        <ProviderMark name="ollama" />
                      </span>
                      <StatusBadge tone="success">Bundled</StatusBadge>
                    </span>
                  }
                />
                <Row
                  label="This machine"
                  tag={
                    <PreviewTag title="Not built. Nothing in the runtime detects CUDA, ROCm or Metal, or reads how much memory this machine has — the badge and the number are a drawing, not a reading of your hardware." />
                  }
                  hint="CPU-only runs the small models and struggles above 7B."
                  control={
                    <span className="ws-rowflex">
                      <StatusBadge tone="warning">CPU only</StatusBadge>
                      <span className="ws-muted">32 GB RAM</span>
                    </span>
                  }
                />
                <Row
                  label="Credential"
                  hint="None, and nothing to add. This lane sends nothing anywhere."
                  control={<StatusBadge tone="success">Not needed</StatusBadge>}
                />
              </CardRows>
            </Card>
          </SectionHeader>
        </>
      )}

      <Note icon="models">
        Every job that runs a model is listed in Settings → AI Models, with this connection as its
        default. Nothing below it has to be set now.
      </Note>
    </>
  );
}

/**
 * SETTING A SHORTCUT IS ONE INTERACTION AND IT IS THE SAME ONE EVERYWHERE.
 * `ShortcutField` is the control Settings → Hotkeys uses, unchanged: one click
 * starts the recording, releasing the keys sets it, `Backspace` empties the
 * slot and `Escape` cancels (ADR 0201). A drawing of that control here would
 * teach a workflow the product does not have, and would go stale the next time
 * the real one is corrected — which it did, twice, in one afternoon.
 *
 * The value it writes is local, like every other answer in this flow, and there
 * is no `binding` to hand it because nothing has registered anything: the
 * shortcut is the user's choice and its registration is the step that has not
 * been built.
 */
function Hotkey({ value, onValue }: { value: string; onValue: (next: string) => void }) {
  return (
    <Card
      title="Which key starts a dictation"
      description="Registered with the OS now, so a refusal is found here rather than the first time you need it."
    >
      <CardRows>
        <Row
          label="Dictate"
          hint="Works in any application, including ones WordScript knows nothing about."
          control={<ShortcutField value={value} onChange={onValue} label="Dictate" />}
        />
        <Row
          label="Registration"
          tag={
            <PreviewTag title="Not built. The flow registers nothing with the OS, so this badge is a drawing of the answer rather than the answer — the shortcut above is your choice, and whether the desktop accepts it is not known here." />
          }
          hint="The OS accepted it. A combination another application already holds is reported here, not swallowed."
          control={<StatusBadge tone="success">Accepted</StatusBadge>}
        />
        <Row
          label="How it activates"
          hint="Tap to start and tap to stop, or hold the key for as long as you speak."
          control={<InertSegment options={["Tap", "Hold"]} active="Tap" label="How it activates" />}
        />
      </CardRows>
    </Card>
  );
}

/**
 * OUR STEP, NOT THE DONOR'S, and it is here because of what has actually gone
 * wrong: a dictation that transcribes perfectly and then cannot be placed. It is
 * invisible until the first real one, it depends on the session type rather than
 * on anything the user chose, and on Wayland it is a decision rather than a
 * missing package.
 */
function Insert() {
  return (
    <>
      <Card
        title="Can text reach the app you were in"
        description="The part that fails quietly: placing text depends on the window system, not on your settings."
      >
        <CheckList
          items={[
            {
              state: "ok",
              label: "Session",
              detail: "Linux · X11 — direct paste is available.",
              trailing: <StatusBadge tone="success">tier 1</StatusBadge>,
            },
            {
              state: "ok",
              label: "Driver",
              detail: "xdotool resolved. Your previous clipboard is restored after every insert.",
              code: "auto_paste · xdotool",
            },
            {
              state: "ok",
              label: "Fallback",
              detail: "If an app ignores the paste, the transcript waits in recovery instead of being lost.",
            },
          ]}
        />
      </Card>
      <Note>
        On a pure Wayland session this step reports clipboard-only instead, and says why: the paste
        drivers there raise a compositor prompt on every insert, which is worse than pressing Ctrl+V
        yourself.
      </Note>
    </>
  );
}

function TryIt({ hotkey }: { hotkey: string }) {
  return (
    <>
      <Card title="Try it once" description="The only step that demonstrates the product rather than configuring it.">
        <CardRows>
          {/* An instruction, not a control: this row says which key to press,
              and the key it names is the one chosen two steps ago. */}
          <Row
            label="Press"
            hint="Anywhere — including in this field."
            control={hotkey ? <Keycaps combo={hotkey} /> : <StatusBadge tone="warning">No hotkey set</StatusBadge>}
          />
        </CardRows>
        <CardRows>
          <Row
            layout="stack"
            label="Click here and use your hotkey"
            hint="Whatever you say lands in this field. Nothing is saved and nothing is sent anywhere you did not choose."
          >
            <TextArea placeholder="waiting for the hotkey…" rows={3} aria-label="Dictation lands here" />
            <div className="ws-rowflex">
              <StatusDot tone="success" />
              <span className="ws-muted">
                Hotkey registered · microphone reachable · insert driver xdotool
              </span>
            </div>
          </Row>
        </CardRows>
      </Card>
      <Card>
        <CheckList
          items={[
            { state: "ok", label: "Connection", detail: "Groq, key verified in the OS secret store." },
            { state: "ok", label: "Microphone", detail: "Yeti Nano reachable, level checked." },
            { state: "ok", label: "Insert", detail: "xdotool available on the active X11 session." },
            { state: "todo", label: "First dictation", detail: "Not yet. This step ends when text lands above." },
          ]}
        />
      </Card>
    </>
  );
}

function Done({
  hotkey,
  baseline,
  onBaseline,
}: {
  hotkey: string;
  baseline: number;
  onBaseline: (wpm: number) => void;
}) {
  return (
    <>
      <Card title="Ready" description="What is set, and where to change it.">
        <CardRows>
          <Row
            label="Connection"
            control={
              <span className="ws-jobmodel">
                <ProviderMark name="Groq" />
                <span className="ws-jobmodel-name">{LANES.Cloud.jobs.dictation.model}</span>
              </span>
            }
          />
          {/* A recital of what was set, so it recites what was actually set —
              including the case where the slot was deliberately emptied. */}
          <Row
            label="Hotkey"
            control={
              hotkey ? <Keycaps combo={hotkey} /> : <StatusBadge tone="neutral">Disabled</StatusBadge>
            }
          />
          <Row label="Delivery" control={<StatusBadge tone="success">Insert at cursor</StatusBadge>} />
          <Row
            label="Mode"
            hint="Auto picks Cleanup, Draft or Prompt Enhance per dictation. Every other mode stays your call."
            control={<StatusBadge tone="accent">Auto</StatusBadge>}
          />
        </CardRows>
      </Card>

      <Card
        title="One thing is still open"
        description="Names and terms it cannot know yet. It learns them from your corrections — adding a few now just helps the first day."
      >
        <CardRows>
          <Row
            label="Words & names"
            hint="Lives in the active profile, with everything else that is per profile."
            control={
              <Button variant="ghost" icon={<Icon name="arrow" />}>
                Add a few
              </Button>
            }
          />
        </CardRows>
      </Card>

      {/* THE ONE NUMBER HOME CANNOT MEASURE, ASKED WHILE SOMEBODY IS STILL
          ANSWERING QUESTIONS (ADR 0182).

          IT IS HERE AND NOT A STEP OF ITS OWN, for the reason the card below
          gives: nothing that fails to block a first dictation earns a step, and
          this blocks nothing. But it is asked rather than left to a settings
          screen nobody visits, because `Time saved` is DIVIDED by it — the same
          four weeks read 43 minutes at 40 words a minute and 15 at 60, and a
          reader who never chose has a figure that looks measured and is not.

          The reader who does not know their speed is why the presets describe
          how you type rather than listing numbers; forty is preselected, so
          skipping this card is a valid answer and lands where it landed
          before. */}
      <Card
        title="What Home counts it against"
        description="One figure on Home is your words as typing time, less the time you dictated them. This is the typing speed in that sum."
      >
        <CardRows>
          <Row
            label="Typing baseline"
            layout="stack"
            hint="Nothing in WordScript has ever watched you type, and nothing will. Pick the description that fits, or enter the figure if you know it."
          >
            <TypingBaseline value={baseline} onChange={onBaseline} />
          </Row>
        </CardRows>
      </Card>

      {/* WHAT IS NOT IN THIS FLOW, STATED RATHER THAN OMITTED. This card is on
          the last step and not the first, because it is only readable once the
          flow is behind you: on step 1 it would be a list of things you have not
          seen yet. */}
      <Card
        title="Deliberately not in this flow"
        description="Each has a working default and none blocks a first dictation. One click away when you want them."
      >
        <CardRows>
          <Row
            label="Processing modes"
            hint="Auto picks per dictation. Cleanup, Rewrite, Translate, Prompt Enhance and the assistant all have models already, from the connection you set."
            control={<StatusBadge tone="plan">Auto</StatusBadge>}
          />
          <Row
            label="Communication style"
            hint="Register, length and writing sample. Empty is a valid setting and the assistant writes plainly without it."
            control={<StatusBadge tone="plan">In the profile</StatusBadge>}
          />
          <Row
            label="Overlay placement, sound cues, history policy"
            hint="Defaults are safe: the overlay follows the active screen, cues are on, history is kept locally."
            control={<StatusBadge tone="plan">Settings</StatusBadge>}
          />
          <Row
            label="Notes, meetings and the Ask window"
            hint="A second capture type and a second surface. Nothing about a dictation depends on them."
            control={<StatusBadge tone="plan">Later</StatusBadge>}
          />
          <Row
            label="Coding agents and integrations"
            hint="Phase 8, and a different job entirely — those speak to you while they work."
            control={<StatusBadge tone="plan">Phase 8</StatusBadge>}
          />
        </CardRows>
      </Card>
    </>
  );
}
