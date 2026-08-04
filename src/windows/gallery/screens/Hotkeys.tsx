import { useState } from "react";
import {
  Card,
  CardRows,
  DocLink,
  HotkeyButton,
  Note,
  Row,
  SectionHeader,
  SegmentControl,
  StatusBadge,
  Stepper,
  ViewTop,
} from "@/components/shell";

/**
 * HOTKEYS — `SCREENS.hotkeys`.
 *
 * A shortcut the OS refused is the single most expensive silent failure in the
 * product: nothing happens, and nothing says why. It is stated per row, as a
 * badge beside the caps rather than as a sentence under them.
 *
 * TRANSLATE TOOK THE SEVENTH SLOT RATHER THAN DISPLACING ONE (ADR 0041). The
 * shipped defaults run Alt+1..6, so a seventh mode is the first that arrives
 * with no default binding — stated on its row rather than papered over with
 * Alt+7, because the number of digits a modifier row can carry is a real limit
 * and the eighth mode will hit it harder.
 */

const MODES: Array<[string, string | null]> = [
  ["Auto", "Alt+1"],
  ["Verbatim", "Alt+2"],
  ["Cleanup", "Alt+3"],
  ["Rewrite", "Alt+4"],
  ["Translate", null],
  ["Draft", "Alt+5"],
  ["Prompt Enhance", "Alt+6"],
];

export function HotkeysScreen() {
  const [activation, setActivation] = useState("Tap");

  return (
    <>
      <ViewTop title="Hotkeys" lead="Every key WordScript listens for, in one place." />

      <SectionHeader title="Capture">
        <Card>
          <CardRows>
            <Row
              label="Dictate"
              hint="Starts and stops a capture, in any app."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="success">Registered</StatusBadge>
                  <HotkeyButton combo="Ctrl+Super" />
                </span>
              }
            />
            <Row
              label="Pause"
              hint="Holds the capture without ending the session."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="success">Registered</StatusBadge>
                  <HotkeyButton combo="Ctrl+Space" />
                </span>
              }
            />
            <Row
              label="Abort"
              hint="Discards the capture. Nothing is transcribed or inserted."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="danger">Taken by the desktop</StatusBadge>
                  <HotkeyButton combo="Ctrl+Alt" />
                </span>
              }
            />
            <Row
              label="Activation"
              hint="Ctrl+Super is modifier-only, so every press acts — and other apps lose it. Double tap avoids that."
              control={
                <SegmentControl
                  aria-label="Activation"
                  value={activation}
                  onChange={setActivation}
                  options={[
                    { value: "Tap", label: "Tap" },
                    { value: "Double tap", label: "Double tap" },
                    { value: "Hold", label: "Hold" },
                  ]}
                />
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Modes" description="One key per mode, plus a key that opens the picker.">
        <Card>
          <CardRows>
            <Row
              label="Mode select"
              hint="Opens the picker; press again to cycle."
              control={<HotkeyButton combo="Alt+S" />}
            />
            {MODES.map(([mode, combo]) => (
              <Row key={mode} label={mode} control={<HotkeyButton combo={combo} />} />
            ))}
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Mode-select overlay">
        <Card>
          <CardRows>
            <Row
              label="Picker stays for"
              hint="Press the key again to cycle while it is open."
              control={<Stepper value={4} suffix="s" min={1} max={30} aria-label="Picker stays for" />}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* One closing note, not two. The other one explained why the mode keys
          are on Alt rather than Ctrl, which is history: it belongs in the ADR
          that decided it, not under a list of keys that already work. */}
      <Note icon="keyboard" tail={<DocLink>Why the mode keys are on Alt</DocLink>}>
        Linux · X11 — the desktop registers global shortcuts; a combination another app already
        holds is reported here, never silently dropped.
      </Note>
    </>
  );
}
