import { useState } from "react";
import {
  Button,
  Card,
  CardRows,
  CheckList,
  Field,
  Icon,
  HotkeyButton,
  LevelMeter,
  ModelList,
  ModelRow,
  Note,
  OnboardingFoot,
  OnboardingRail,
  OnboardingStepHead,
  PreviewBanner,
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
import { InertSegment, ProviderPick } from "./Models";
import type { LaneName } from "./data";

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
      {step.id === "hotkey" && <Hotkey />}
      {step.id === "insert" && <Insert />}
      {step.id === "try" && <TryIt />}
      {step.id === "done" && <Done />}

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
              <Row
                label="Speech"
                hint="A chat endpoint does not transcribe. Recognition needs the Cloud or Local lane; the writing jobs use your server."
                control={<StatusBadge tone="warning">Needs another lane</StatusBadge>}
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
                <ModelRow brand="openai" name="ggml-base" size="142 MB" detail="multilingual · the recommended balance" state="downloading" pct={46} />
                <ModelRow brand="openai" name="ggml-base.en" size="142 MB" detail="English only, more accurate on English" />
                <ModelRow brand="openai" name="ggml-small" size="466 MB" detail="multilingual · better on accents" />
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
                <ModelRow brand="llama" name="llama-3.2-3b-instruct" size="2.0 GB" detail="Q4_K_M · fast enough for cleanup on CPU" />
                <ModelRow brand="qwen" name="qwen2.5-7b-instruct" size="4.4 GB" detail="Q4_K_M · the general recommendation" />
                <ModelRow brand="gemma" name="gemma-3-4b-it" size="2.5 GB" detail="Q4_K_M · strong on German" />
              </ModelList>
            </Card>
            <Card>
              <CardRows>
                <Row
                  label="Server"
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
                  hint="Detected, not configured. CPU-only runs the small models and struggles above 7B."
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

function Hotkey() {
  return (
    <Card
      title="Which key starts a dictation"
      description="Registered with the OS now, so a refusal is found here rather than the first time you need it."
    >
      <CardRows>
        <Row
          label="Dictate"
          hint="Works in any application, including ones WordScript knows nothing about."
          control={<HotkeyButton combo="Ctrl+Super" />}
        />
        <Row
          label="Registration"
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

function TryIt() {
  return (
    <>
      <Card title="Try it once" description="The only step that demonstrates the product rather than configuring it.">
        <CardRows>
          <Row label="Press" hint="Anywhere — including in this field." control={<HotkeyButton combo="Ctrl+Super" />} />
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

function Done() {
  return (
    <>
      <Card title="Ready" description="What is set, and where to change it.">
        <CardRows>
          <Row
            label="Connection"
            control={
              <span className="ws-jobmodel">
                <ProviderMark name="Groq" />
                <span className="ws-jobmodel-name">whisper-large-v3-turbo</span>
              </span>
            }
          />
          <Row label="Hotkey" control={<HotkeyButton combo="Ctrl+Super" />} />
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
