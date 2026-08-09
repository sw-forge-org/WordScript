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
 * THE ONE FACT WITH NO SOURCE IS THE WAVEFORM, and it is the shape rather than
 * the measurement. `Waveform`'s `active` makes upstream open a microphone with
 * `getUserMedia`, so driving it here would have WordScript hold a second
 * capture device for as long as a settings page is open — the very thing
 * ADR 0063's call detection watches for. The runtime's `audio_level` event
 * carries one scalar and no sample history, which is what a waveform needs, so
 * it stays at rest and the fact is on the relay's §2.5 list. The MEASUREMENT
 * under it is live: `InputLevelMeter` reads the runtime's own event and its
 * verdict line says in dBFS what the reading means, including "Speak to measure
 * the level." when nothing has arrived yet.
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
  const { config, patch, active } = runtime;

  const [devices, setDevices] = useState<NativeInputDevice[]>([]);
  const [captureStatus, setCaptureStatus] = useState<NativeCaptureStatus | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [monitors, setMonitors] = useState<OverlayMonitorOption[]>([]);
  const [monitorError, setMonitorError] = useState<string | null>(null);

  const level = useInputLevel(active);

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

  const defaultDevice = devices.find((device) => device.is_default) ?? null;
  const hasExplicitDevice = Boolean(config.audio_device.trim());
  const selectedDeviceLabel = hasExplicitDevice
    ? config.audio_device
    : defaultDevice?.name ?? DEFAULT_DEVICE_LABEL;
  const selectedDeviceAvailable =
    !hasExplicitDevice || devices.some((device) => device.name === config.audio_device);

  /* The pre-port area's own sentence, and the one the drawing carries: which
     microphone the NEXT capture takes, plus the two cases where that answer is
     not the obvious one. */
  const deviceHint = deviceError
    ? deviceError
    : captureStatus?.is_recording && captureStatus.device_name
      ? `Current capture is still using ${captureStatus.device_name}. Any new mic selection applies to the next recording.`
      : !selectedDeviceAvailable
        ? `Saved microphone is not available right now. WordScript will fall back to ${
            defaultDevice?.name ?? "the system default microphone"
          } on the next capture.`
        : `Next capture will use ${selectedDeviceLabel}.`;

  const placement: OverlayPositionMode = config.overlay_position_mode ?? "preset";
  const usesPreset = placement === "preset";
  const monitorValue = config.overlay_monitor || "primary";
  const anchorValue: OverlayAnchor = config.overlay_anchor ?? "bottom_center";
  const selectedMonitor =
    monitors.find((monitor) => monitor.id === monitorValue) ??
    monitors.find((monitor) => monitor.is_primary) ??
    null;
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
        <Card>
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

                Drawn at rest even here: `active` opens a microphone of its own
                (ADR 0058, and the header of this file). The meter beneath it is
                the live one. */}
            <Row
              layout="stack"
              label="Input level"
              hint="A capture that never crosses the mark is discarded as empty."
            >
              <Waveform ariaLabel="Live input, last few seconds" />
              <InputLevelMeter reading={level} />
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
                  selectedMonitor?.label ?? "the selected display"
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

      <Note icon="profiles" tail={<DocLink>Open Profiles → Defaults</DocLink>}>
        Auto-stop, stop after silence and workspace context belong to the profile, not to this
        machine. The processing limit is stated there too — it follows the provider and account
        plan.
      </Note>
    </>
  );
}
