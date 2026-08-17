import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Card,
  CardRows,
  DocLink,
  Icon,
  InputLevelMeter,
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
import { useInputLevel } from "@/hooks/useInputLevel";
import { useInputMonitor } from "@/hooks/useInputMonitor";
import type { OverlayAnchor, OverlayPositionMode } from "@/types/ipc";
import type { WiredScreenProps } from "./props";

/**
 * GENERAL — `SCREENS.general`, wired.
 *
 * Microphone, sound and where the overlay appears. Three sections and one note,
 * and the note is the section that is NOT here: auto-stop, stop-after-silence
 * and workspace context belong to the profile rather than to this machine,
 * which is what lets Settings mean "this machine" without exception.
 *
 * THE SHIPPED TAB SHOWS DISPLAY AND ANCHOR whether or not they do anything —
 * in "remember last drag" they are inert and still look settable. A control
 * that cannot act is not shown, so with the drawing wired those two rows are
 * absent in manual placement rather than present and dead.
 *
 * EVERY CONTROL HERE WRITES, and each writes the field the runtime already
 * reads: `audio_device`, `play_sounds`, `sound_pack`, `sound_volume`,
 * `play_startup_sound`, `overlay_position_mode`, `overlay_monitor`,
 * `overlay_anchor` and `result_actions_timeout_s`. Instant save, because that
 * is the product's rule and the sheet's foot states it once. The cue buttons
 * call `preview_sound_cue`, which is the runtime synthesising the cue — so what
 * you hear is what you will hear, and it works with cues off, exactly as the
 * row says.
 *
 * READING THE OVERLAY'S CONFIG IS NOT TOUCHING THE OVERLAY (rule 5). No token,
 * size or rule in `overlay*.css` or `OverlayPill.tsx` moves; three fields the
 * overlay window already reads are written from here, as the pre-port
 * `OverlayTab` wrote them.
 *
 * EVERY FACT ON THIS SCREEN NOW HAS A SOURCE, and the waveform was the last one
 * without (ADR 0170). It was drawn at rest because the only way to move it was
 * `Waveform`'s `active`, which has upstream open a microphone with
 * `getUserMedia` — WordScript holding a second capture device for as long as a
 * settings page is open, the very thing ADR 0063's call detection watches for.
 * The measurement is the runtime's instead: `core::input_monitor` opens the
 * configured device read-only while this screen is on top, and BOTH the shape
 * and the meter under it are that one reading. The verdict line still says in
 * dBFS what it means, including "Speak to measure the level." before anything
 * has arrived.
 */

interface NativeInputDevice {
  name: string;
  is_default: boolean;
}

interface NativeCaptureStatus {
  is_recording: boolean;
  device_name: string | null;
  active_capture_id: string | null;
}

interface OverlayMonitorOption {
  id: string;
  label: string;
  is_primary: boolean;
}

/** The runtime's four packs, in `SoundPack`'s order, with the prototype's
 *  labels — which are the pack's own `label()` plus its one-line character. */
const SOUND_PACKS = [
  { value: "timber", label: "Timber — warm mallet" },
  { value: "glass", label: "Glass — soft bell" },
  { value: "air", label: "Air — breath" },
  { value: "tap", label: "Tap — short and dry" },
];

/** `SoundCue::ALL_CUES`, in its order. The drawn row is this list. */
const SOUND_CUES = [
  { value: "startup", label: "Startup" },
  { value: "listen", label: "Listen" },
  { value: "handoff", label: "Handoff" },
  { value: "done", label: "Done" },
  { value: "abort", label: "Abort" },
  { value: "error", label: "Error" },
];

const OVERLAY_ANCHORS: { value: OverlayAnchor; label: string }[] = [
  { value: "top_left", label: "Top left" },
  { value: "top_center", label: "Top center" },
  { value: "top_right", label: "Top right" },
  { value: "center_left", label: "Left center" },
  { value: "center_right", label: "Right center" },
  { value: "bottom_left", label: "Bottom left" },
  { value: "bottom_center", label: "Bottom center" },
  { value: "bottom_right", label: "Bottom right" },
];

const DEFAULT_DEVICE_LABEL = "System default microphone";

export function GeneralScreen({ banner, runtime }: WiredScreenProps) {
  const { config, patch, active, open } = runtime;

  const [devices, setDevices] = useState<NativeInputDevice[]>([]);
  const [captureStatus, setCaptureStatus] = useState<NativeCaptureStatus | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [monitors, setMonitors] = useState<OverlayMonitorOption[]>([]);
  const [monitorError, setMonitorError] = useState<string | null>(null);

  const level = useInputLevel(active);
  /* WHAT MAKES THE ROW LIVE WHEN NOTHING IS BEING RECORDED. The runtime opens
     the microphone read-only while this screen is on top, and gives it back the
     moment it is not — see `useInputMonitor` for why focus is part of the
     condition and ADR 0170 for why the measurement is Rust's. */
  const monitor = useInputMonitor(active);

  const rescan = useCallback(async () => {
    setRescanning(true);
    const [deviceResult, statusResult] = await Promise.allSettled([
      invoke<NativeInputDevice[]>("list_native_input_devices"),
      invoke<NativeCaptureStatus>("native_capture_status"),
    ]);

    /* An enumeration that comes back as anything but a list is a runtime that
       did not answer, not an empty machine — the row then says the microphone
       it has stored rather than claiming there are none. */
    if (deviceResult.status === "fulfilled" && Array.isArray(deviceResult.value)) {
      setDevices(deviceResult.value);
      setDeviceError(null);
    } else if (deviceResult.status === "rejected") {
      setDeviceError(String(deviceResult.reason));
    }
    if (statusResult.status === "fulfilled" && statusResult.value) {
      setCaptureStatus(statusResult.value);
    }
    setRescanning(false);
  }, []);

  const readMonitors = useCallback(async () => {
    try {
      const next = await invoke<OverlayMonitorOption[]>("overlay_monitor_options");
      if (Array.isArray(next)) setMonitors(next);
      setMonitorError(null);
    } catch (cause) {
      setMonitorError(String(cause));
    }
  }, []);

  /* Both are enumerations of hardware, so they are read when the section is
     first opened rather than on a timer — a microphone plugged in while the
     sheet is open is what Rescan is for. */
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!active || asked) return;
    setAsked(true);
    void rescan();
    void readMonitors();
  }, [active, asked, rescan, readMonitors]);

  const hasExplicitDevice = Boolean(config.audio_device.trim());
  const selectedDeviceAvailable =
    !hasExplicitDevice || devices.some((device) => device.name === config.audio_device);

  /* THIS ROW'S ONE-LINE BUDGET IS RUNTIME DATA, NOT A NUMBER ANYONE CAN WRITE
     DOWN. `.ws-sel` is `width: auto`, so the Select is as wide as the longest
     device name the machine reports, and `.ws-row-ctl` is `flex: none`, so
     every one of those pixels comes off the text column. Measured in the host
     on a machine whose devices are ordinary, the control took 377 px of 542 and
     left the hint 165 — about TWENTY-SIX characters per line. The four
     sentences this ternary used to build ran 46 to 124 characters and drew two,
     four and five lines beside an `Input level` row that draws one.

     Leg 10's rule was that a copy budget is a function of the control beside
     it. This row is the sharper case: the control's width is a function of what
     the runtime put IN it, so the budget is not knowable when the sentence is
     written. A row in that position cannot carry a sentence at all.

     A SHORTER SENTENCE WAS NOT THE FIX, and measuring the first attempt is
     what showed it: with the sheet at 457 px the control took 377 and left the
     text column EIGHTY PIXELS — about twelve characters — so a 24-character
     replacement still drew two lines. The row cannot hold a sentence of any
     length, so it is not given one.

     Each state goes where it has room instead. A change landing on the next
     capture is standing and on the card. An unavailable device is exceptional
     and gets the Note below, which spans the card at about seventy characters
     a line. What is left on the row is an ERROR — which must be shown whole,
     wrapping and all, because truncating it would be a lie about the runtime.
     The `<option>` already reads "<name> — not available", so the row was
     repeating its own control in the state it most needed to be readable. */
  const deviceHint = deviceError ?? undefined;

  const placement: OverlayPositionMode = config.overlay_position_mode ?? "preset";
  const usesPreset = placement === "preset";
  const monitorValue = config.overlay_monitor || "primary";
  const anchorValue: OverlayAnchor = config.overlay_anchor ?? "bottom_center";
  const selectedMonitor =
    monitors.find((monitor) => monitor.id === monitorValue) ??
    monitors.find((monitor) => monitor.is_primary) ??
    null;
  /* THE SAME DEFECT AS `Input device`, one card down and invisible in manual
     placement — which is the state this machine is in, so no screenshot of it
     was ever going to show the row at all. `label` is what the Display Select
     above holds, `<name> (Primary)`, and putting it in the Anchor hint made the
     row repeat the control that sets its own width. The drawing names the
     monitor "DP-1" where its Select holds "DP-1 (2560×1440) — primary": the
     short form is the one that belongs in a sentence. */
  const monitorName = selectedMonitor?.label.replace(/\s*\(Primary\)$/, "") ?? null;
  const anchorLabel =
    OVERLAY_ANCHORS.find((anchor) => anchor.value === anchorValue)?.label.toLowerCase() ??
    "the chosen anchor";

  const playCue = (cue: string) => {
    void invoke("preview_sound_cue", {
      cue,
      pack: config.sound_pack,
      volume: config.sound_volume,
    }).catch((cause) => console.error(`preview_sound_cue ${cue} failed:`, cause));
  };

  return (
    <>
      <ViewTop title="General" lead="Microphone, sound and where the overlay appears." banner={banner} />

      <SectionHeader title="Microphone">
        <Card description="A change applies to the next capture, not the one running.">
          <CardRows>
            <Row
              label="Input device"
              hint={deviceHint}
              control={
                <span className="ws-rowflex">
                  <Select
                    value={hasExplicitDevice ? config.audio_device : ""}
                    onChange={(event) => patch({ audio_device: event.target.value })}
                    aria-label="Input device"
                  >
                    <option value="">{DEFAULT_DEVICE_LABEL}</option>
                    {devices.map((device) => (
                      <option key={device.name} value={device.name}>
                        {device.is_default ? `${device.name} — default` : device.name}
                      </option>
                    ))}
                    {/* A saved microphone that is unplugged stays selectable, so
                        the row shows what is stored rather than silently moving
                        the user to another device. */}
                    {hasExplicitDevice && !selectedDeviceAvailable && (
                      <option value={config.audio_device}>{`${config.audio_device} — not available`}</option>
                    )}
                  </Select>
                  <Button
                    variant="ghost"
                    icon={<Icon name="restore" />}
                    busy={rescanning}
                    disabled={rescanning}
                    onClick={() => void rescan()}
                  >
                    Rescan
                  </Button>
                </span>
              }
            />
            {/* The waveform sits ABOVE the bar, in that order, because the shape
                is what you look at while you talk and the threshold is what you
                check afterwards. Reversing them puts the decision boundary
                where the eye is during the only moment it is not being read.

                BOTH MOVE OFF THE SAME MEASUREMENT (ADR 0170), and neither opens
                a device: `level` is the runtime's reading, the waveform draws
                its shape over the last few seconds and the meter draws the
                instant against the threshold. `active` is still never passed —
                that is the prop that would have this webview open a second
                microphone. */}
            {/* THE SENTENCE IS THE ROW'S, NOT A NOTE'S. It answered "where is
                the gain slider" and it answered it through a `Why not here`
                link that went nowhere — a settings fact delivered as a
                footnote to a document the reader cannot open. A row's `hint` is
                where this product states what a control does and does not do,
                so it is stated there. */}
            <Row
              layout="stack"
              label="Input level"
              hint="The level itself is set in your system sound settings — it is shared with every app using this microphone. A capture that never crosses the mark is discarded as empty."
            >
              <Waveform
                ariaLabel="Live input, last few seconds"
                level={monitor.monitoring || level.active ? level.levelRef : null}
              />
              <InputLevelMeter stream={level} />
            </Row>
          </CardRows>
        </Card>
        {/* ONE STATE LEFT, AND IT IS THE ONE THAT IS A PROBLEM. Two Notes stood
            here. The first named the device a running capture was still using
            and said a new selection applies to the next recording — which is
            word for word what the card above already says in its standing
            description, so the card and the Note were two copies of one fact
            and the Note's only addition was a device name nobody had asked
            about mid-dictation.

            What survives is the exceptional state: the saved microphone is
            gone. That is not a fact about the product, it is a fact about this
            machine right now, and it names the device WordScript will fall back
            to — the part neither the card nor the `<option>` label carries.
            `native_capture_status` is still read, because this condition needs
            to know whether a capture is running. */}
        {!deviceError && !captureStatus?.is_recording && !selectedDeviceAvailable && (
          <Note icon="about">
            {`Saved microphone is not available right now. WordScript falls back to ${
              devices.find((device) => device.is_default)?.name ?? "the system default microphone"
            } on the next capture.`}
          </Note>
        )}
      </SectionHeader>

      <SectionHeader title="Sound">
        <Card description="Cues report what the runtime is doing, not what it is about to do.">
          <CardRows>
            <Row
              label="Play sound cues"
              control={
                <Toggle
                  checked={config.play_sounds}
                  onCheckedChange={(next) => patch({ play_sounds: next })}
                  aria-label="Play sound cues"
                />
              }
            />
            <Row
              label="Sound pack"
              hint="All four play the same motif, so a cue stays recognisable across packs."
              control={
                <Select
                  value={config.sound_pack}
                  onChange={(event) => patch({ sound_pack: event.target.value })}
                  aria-label="Sound pack"
                >
                  {SOUND_PACKS.map((pack) => (
                    <option key={pack.value} value={pack.value}>
                      {pack.label}
                    </option>
                  ))}
                </Select>
              }
            />
            <Row
              label="Cue volume"
              hint="Within WordScript. App volume stays in the system mixer."
              control={
                <Slider
                  value={Math.round(config.sound_volume * 100)}
                  onChange={(next) => patch({ sound_volume: next / 100 })}
                  aria-label="Cue volume"
                />
              }
            />
            <Row
              label="Play the signature at launch"
              hint="The full G-major theme, once when WordScript starts. The cues are fragments of it."
              control={
                <Toggle
                  checked={config.play_startup_sound}
                  onCheckedChange={(next) => patch({ play_startup_sound: next })}
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
                {SOUND_CUES.map((cue) => (
                  <Button
                    key={cue.value}
                    variant="ghost"
                    icon={<Icon name="play" />}
                    onClick={() => playCue(cue.value)}
                  >
                    {cue.label}
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
              hint={
                usesPreset
                  ? undefined
                  : config.overlay_manual_x !== 0 || config.overlay_manual_y !== 0
                    ? `Remembered position: ${config.overlay_manual_x}, ${config.overlay_manual_y}.`
                    : "No remembered position yet. The first drag sets it."
              }
              control={
                <Select
                  value={placement}
                  onChange={(event) =>
                    patch({ overlay_position_mode: event.target.value as OverlayPositionMode })
                  }
                  aria-label="Placement"
                >
                  <option value="manual">Remember last drag position</option>
                  <option value="preset">Use preset display anchor</option>
                </Select>
              }
            />
            {/* Absent rather than inert in manual placement: a control that
                cannot act is not shown. */}
            {usesPreset && (
              <Row
                label="Display"
                hint={monitorError ?? undefined}
                control={
                  <Select
                    value={monitorValue}
                    onChange={(event) => patch({ overlay_monitor: event.target.value })}
                    aria-label="Display"
                  >
                    {monitors.length === 0 && <option value={monitorValue}>Reading displays…</option>}
                    {monitors.map((monitor) => (
                      <option key={monitor.id} value={monitor.id}>
                        {monitor.label}
                      </option>
                    ))}
                  </Select>
                }
              />
            )}
            {usesPreset && (
              <Row
                label="Anchor"
                hint={`Kept on ${
                  monitorName ?? "the selected display"
                } at ${anchorLabel} until you drag it somewhere else.`}
                control={
                  <Select
                    value={anchorValue}
                    onChange={(event) => patch({ overlay_anchor: event.target.value as OverlayAnchor })}
                    aria-label="Anchor"
                  >
                    {OVERLAY_ANCHORS.map((anchor) => (
                      <option key={anchor.value} value={anchor.value}>
                        {anchor.label}
                      </option>
                    ))}
                  </Select>
                }
              />
            )}
            <Row
              label="Result overlay stays for"
              hint="Editing the transcript pauses the timer."
              control={
                <Stepper
                  value={config.result_actions_timeout_s}
                  onChange={(next) => patch({ result_actions_timeout_s: next })}
                  suffix="s"
                  min={1}
                  max={60}
                  aria-label="Result overlay stays for"
                />
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* THE DOOR IS A DOOR NOW. It read `Open Profiles → Defaults` and opened
          nothing, which is the fake affordance rule 7 forbids — stated in
          `props.ts` about buttons and never applied to this link. It is drawn
          only where there is somewhere to go, the same condition every other
          door on these screens carries. */}
      <Note
        icon="profiles"
        tail={open && <DocLink onClick={() => open({ view: "profiles" })}>Open Profiles</DocLink>}
      >
        Auto-stop, stop after silence and workspace context belong to the profile, not to this
        machine. The processing limit is stated there too — it follows the provider and account
        plan.
      </Note>
    </>
  );
}
