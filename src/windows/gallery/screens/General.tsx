import { useState } from "react";
import {
  Button,
  Card,
  CardRows,
  DocLink,
  Icon,
  LevelMeter,
  Note,
  Row,
  SectionHeader,
  Select,
  Slider,
  Stepper,
  Toggle,
  ViewTop,
  Waveform,
} from "@/components/shell";

/**
 * GENERAL — `SCREENS.general`.
 *
 * Microphone, sound and where the overlay appears. Three sections and one note,
 * and the note is the section that is NOT here: auto-stop, stop-after-silence
 * and workspace context belong to the profile rather than to this machine,
 * which is what lets Settings mean "this machine" without exception.
 *
 * THE SHIPPED TAB SHOWS DISPLAY AND ANCHOR whether or not they do anything —
 * in "remember last drag" they are inert and still look settable. A control
 * that cannot act is not shown.
 */
export function GeneralScreen() {
  const [cues, setCues] = useState(true);
  const [signature, setSignature] = useState(false);
  const [volume, setVolume] = useState(70);

  return (
    <>
      <ViewTop title="General" lead="Microphone, sound and where the overlay appears." />

      <SectionHeader title="Microphone">
        <Card>
          <CardRows>
            <Row
              label="Input device"
              hint="Next capture will use Yeti Nano Analog Stereo."
              control={
                <span className="ws-rowflex">
                  <Select defaultValue="Yeti Nano Analog Stereo — default" aria-label="Input device">
                    <option>System default microphone</option>
                    <option>Yeti Nano Analog Stereo — default</option>
                    <option>HD Pro Webcam C920</option>
                  </Select>
                  <Button variant="ghost" icon={<Icon name="restore" />}>
                    Rescan
                  </Button>
                </span>
              }
            />
            {/* The waveform sits ABOVE the bar, in that order, because the shape
                is what you look at while you talk and the threshold is what you
                check afterwards. Reversing them puts the decision boundary
                where the eye is during the only moment it is not being read.

                Drawn at rest: `active` opens a microphone, and a display
                surface does not take a device (ADR 0058). */}
            <Row
              layout="stack"
              label="Input level"
              hint="A capture that never crosses the mark is discarded as empty."
            >
              <Waveform ariaLabel="Live input, last few seconds" />
              <LevelMeter
                peak={62}
                hold={74}
                threshold={34}
                state="ok"
                verdict="Good — peak −13 dBFS."
              />
              <Note tail={<DocLink>Why not here</DocLink>}>
                Set the level itself in your system sound settings — it is shared with every app
                using this microphone.
              </Note>
            </Row>
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Sound">
        <Card description="Cues report what the runtime is doing, not what it is about to do.">
          <CardRows>
            <Row
              label="Play sound cues"
              control={<Toggle checked={cues} onCheckedChange={setCues} aria-label="Play sound cues" />}
            />
            <Row
              label="Sound pack"
              hint="All four play the same motif, so a cue stays recognisable across packs."
              control={
                <Select defaultValue="Timber — warm mallet" aria-label="Sound pack">
                  <option>Timber — warm mallet</option>
                  <option>Glass — soft bell</option>
                  <option>Air — breath</option>
                  <option>Tap — short and dry</option>
                </Select>
              }
            />
            <Row
              label="Cue volume"
              hint="Within WordScript. App volume stays in the system mixer."
              control={<Slider value={volume} onChange={setVolume} aria-label="Cue volume" />}
            />
            <Row
              label="Play the signature at launch"
              hint="The full G-major theme, once when WordScript starts. The cues are fragments of it."
              control={
                <Toggle
                  checked={signature}
                  onCheckedChange={setSignature}
                  aria-label="Play the signature at launch"
                />
              }
            />
            <Row
              layout="stack"
              label="Hear them"
              hint="Played by the runtime, so this is what you will hear. Works with cues off."
            >
              <div className="ws-rowflex">
                {["Startup", "Listen", "Handoff", "Done", "Abort", "Error"].map((cue) => (
                  <Button key={cue} variant="ghost" icon={<Icon name="play" />}>
                    {cue}
                  </Button>
                ))}
              </div>
            </Row>
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Overlay">
        <Card description="Reopen where you dragged it, or pin it to a display anchor.">
          <CardRows>
            <Row
              label="Placement"
              control={
                <Select defaultValue="Use preset display anchor" aria-label="Placement">
                  <option>Remember last drag position</option>
                  <option>Use preset display anchor</option>
                </Select>
              }
            />
            <Row
              label="Display"
              control={
                <Select defaultValue="DP-1 (2560×1440) — primary" aria-label="Display">
                  <option>DP-1 (2560×1440) — primary</option>
                  <option>HDMI-A-1 (1920×1080)</option>
                </Select>
              }
            />
            <Row
              label="Anchor"
              hint="Kept on DP-1 at bottom center until you drag it somewhere else."
              control={
                <Select defaultValue="Bottom center" aria-label="Anchor">
                  <option>Top left</option>
                  <option>Top center</option>
                  <option>Top right</option>
                  <option>Left center</option>
                  <option>Right center</option>
                  <option>Bottom left</option>
                  <option>Bottom center</option>
                  <option>Bottom right</option>
                </Select>
              }
            />
            <Row
              label="Result overlay stays for"
              hint="Editing the transcript pauses the timer."
              control={<Stepper value={12} suffix="s" min={1} max={60} aria-label="Result overlay stays for" />}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <Note icon="profiles" tail={<DocLink>Open Profiles → Defaults</DocLink>}>
        Auto-stop, stop after silence and workspace context belong to the profile, not to this
        machine. The processing limit is stated there too — it follows the provider and account
        plan.
      </Note>
    </>
  );
}
