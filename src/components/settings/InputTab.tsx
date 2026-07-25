import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { FormCard, FormRow, Select, StatTiles, Stepper } from "../shell";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import type {
  AppConfig,
  NativeTriggerStatus,
  ShortcutBindingInfo,
  ShortcutPlatform,
} from "../../types/ipc";
import { loadShortcutPlatform, readTriggerStatus, validateShortcut } from "../../lib/shortcuts";
import { ShortcutField } from "./ShortcutField";
import {
  buildProfileCapturePatch,
  resolveActiveTextProfile,
  resolveProfileCaptureSettings,
} from "../../lib/textProfiles";

type ShortcutSlot = "hotkey" | "pause_hotkey" | "abort_hotkey";

const SHORTCUT_FIELDS: Array<{
  field: ShortcutSlot;
  binding: string;
  label: string;
  placeholder: string;
  description: string;
}> = [
  {
    field: "hotkey",
    binding: "capture",
    label: "Start / Stop Hotkey",
    placeholder: "Ctrl+F9",
    description: "Starts or stops the active capture.",
  },
  {
    field: "pause_hotkey",
    binding: "pause",
    label: "Pause / Resume Hotkey",
    placeholder: "Ctrl+F10",
    description: "Pause toggles the active recording without finishing the capture.",
  },
  {
    field: "abort_hotkey",
    binding: "abort",
    label: "Abort Hotkey",
    placeholder: "Ctrl+Alt+Escape",
    description: "Abort stops the active recording and discards the current capture.",
  },
];

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}

interface NativeInputDevice {
  name: string;
  is_default: boolean;
}

interface NativeCaptureStatus {
  is_recording: boolean;
  device_name: string | null;
  active_capture_id: string | null;
}

/// Hold to talk depends entirely on a `Released` event that three different
/// platform mechanisms deliver with three different sets of edge cases, and
/// nothing verifies that one actually arrives. Until this session has observed
/// a release for the configured shortcut, the mode selector says so instead of
/// silently doing nothing (T10, D11).
function holdReleaseUnverified(binding?: ShortcutBindingInfo) {
  if (!binding) return false;
  return binding.presses > 0 && binding.releases === 0;
}

function activationModeHint(
  mode: "tap" | "hold" | "double_tap",
  status: NativeTriggerStatus | null,
  binding?: ShortcutBindingInfo,
  modifierOnly = false,
) {
  if (mode === "double_tap") {
    const base = `Two taps within ${
      status?.double_tap_window_ms ?? 400
    } ms start or stop the capture. A single tap does nothing.`;
    return modifierOnly
      ? `${base} With a modifier-only shortcut this is the recommended mode: one press stays available to the rest of the desktop, so a combination like Ctrl+Alt+T is not intercepted.`
      : base;
  }

  if (mode !== "hold") {
    const base = `Tap starts and stops on the same shortcut. Repeated presses within ${
      status?.debounce_ms ?? 300
    } ms of the same kind are debounced.`;
    return modifierOnly
      ? `${base} Because this shortcut is modifier-only, every single press acts — which also takes that combination away from other applications. Double tap avoids that.`
      : base;
  }

  const base =
    `Hold records while the shortcut is pressed and stops on release. A hold shorter than ${
      status?.hold_min_ms ?? 300
    } ms is extended to that length before stopping.` +
    (status?.hold_watchdog_seconds
      ? ` A hold whose key release never arrives is ended after ${status.hold_watchdog_seconds}s with a stated reason.`
      : "");

  if (holdReleaseUnverified(binding)) {
    return `${base} This session has seen ${binding?.presses} press(es) of this shortcut and no key release — hold to talk cannot work reliably here. Use Tap to toggle.`;
  }

  if (binding && binding.releases > 0) {
    return `${base} Key releases have been observed for this shortcut in this session.`;
  }

  return `${base} Whether the key release arrives has not been observed yet in this session — press the shortcut once to find out.`;
}

function clampCaptureNumber(value: number, minimum: number, maximum: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function formatDurationCompact(seconds: number) {
  const normalized = Math.max(0, Math.round(seconds));

  if (normalized < 60) {
    return `${normalized}s`;
  }

  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainingSeconds = normalized % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function InputTab({ config, onChange }: Props) {
  const [audioDevices, setAudioDevices] = useState<NativeInputDevice[]>([]);
  const [captureStatus, setCaptureStatus] = useState<NativeCaptureStatus | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isRefreshingAudio, setIsRefreshingAudio] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<NativeTriggerStatus | null>(null);
  const [platform, setPlatform] = useState<ShortcutPlatform | null>(null);

  // The recorder itself releases and restores the OS grabs; refreshing the
  // status afterwards keeps the per-row registration state honest (T8).
  const refreshTriggerStatus = useCallback(() => {
    void readTriggerStatus()
      .then(setTriggerStatus)
      .catch(() => setTriggerStatus(null));
  }, []);

  useEffect(() => {
    refreshTriggerStatus();
    void loadShortcutPlatform()
      .then(setPlatform)
      .catch(() => setPlatform(null));
  }, [refreshTriggerStatus]);

  useEffect(() => {
    refreshTriggerStatus();
  }, [config.hotkey, config.pause_hotkey, config.abort_hotkey, refreshTriggerStatus]);

  // Read capture settings from active profile
  const activeProfile = resolveActiveTextProfile(config);
  const capture = resolveProfileCaptureSettings(activeProfile);

  const refreshAudioSetup = useCallback(async () => {
    setIsRefreshingAudio(true);

    const [devicesResult, captureStatusResult] = await Promise.allSettled([
      invoke<NativeInputDevice[]>("list_native_input_devices"),
      invoke<NativeCaptureStatus>("native_capture_status"),
    ]);

    if (devicesResult.status === "fulfilled") {
      setAudioDevices(devicesResult.value);
      setAudioError(null);
    } else {
      setAudioError(String(devicesResult.reason));
    }

    if (captureStatusResult.status === "fulfilled") {
      setCaptureStatus(captureStatusResult.value);
    }

    setIsRefreshingAudio(false);
  }, []);

  useEffect(() => {
    void refreshAudioSetup();
  }, [refreshAudioSetup]);

  const updateShortcut = useCallback(
    (field: ShortcutSlot, value: string) => {
      onChange({ [field]: value } as Pick<AppConfig, ShortcutSlot>);
    },
    [onChange],
  );

  const bindingFor = useCallback(
    (label: string) => triggerStatus?.bindings.find((binding) => binding.label === label),
    [triggerStatus],
  );

  const defaultAudioDevice = useMemo(
    () => audioDevices.find((device) => device.is_default) ?? null,
    [audioDevices],
  );
  const maxRecordingSeconds = clampCaptureNumber(capture.max_recording_seconds, 60, 1800, 720);
  const silenceTimeoutSeconds = clampCaptureNumber(capture.silence_timeout_seconds, 0, 60, 30);
  const hasExplicitAudioDevice = Boolean(config.audio_device.trim());
  const selectedAudioDeviceAvailable = !hasExplicitAudioDevice || audioDevices.some((device) => device.name === config.audio_device);
  const selectedAudioDeviceLabel = hasExplicitAudioDevice
    ? config.audio_device
    : defaultAudioDevice?.name ?? "System default microphone";
  const activationLabel =
    config.activation_mode === "hold"
      ? "Hold to talk"
      : config.activation_mode === "double_tap"
        ? "Double tap"
        : "Tap to toggle";
  const autoStopLabel = silenceTimeoutSeconds > 0
    ? `${formatDurationCompact(silenceTimeoutSeconds)} silence`
    : "Manual stop";
  const captureBinding = bindingFor("capture");
  // The summary tile shows the human shortcut, never the raw token (T9, D9).
  const [captureDisplay, setCaptureDisplay] = useState("");
  // Whether the trigger is modifier-only is the runtime's answer, not a rule
  // the UI re-derives — the UI owns no key knowledge (ADR 0006).
  const [captureIsModifierOnly, setCaptureIsModifierOnly] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void validateShortcut(config.hotkey)
      .then((result) => {
        if (cancelled) return;
        setCaptureDisplay(result.ok ? result.display : config.hotkey);
        setCaptureIsModifierOnly(result.ok && result.modifier_only);
      })
      .catch(() => {
        if (!cancelled) setCaptureDisplay(config.hotkey);
      });
    return () => {
      cancelled = true;
    };
  }, [config.hotkey]);
  const audioStatusMessage = audioError
    ? audioError
    : captureStatus?.is_recording && captureStatus.device_name
      ? `Current capture is still using ${captureStatus.device_name}. Any new mic selection applies to the next recording.`
      : !selectedAudioDeviceAvailable
        ? `Saved microphone is not available right now. WordScript will fall back to ${defaultAudioDevice?.name ?? "the system default microphone"} on the next capture.`
        : `Next capture will use ${selectedAudioDeviceLabel}.`;

  return (
    <div className="flex flex-col gap-8">
      <StatTiles
        items={[
          {
            label: "Trigger",
            value: activationLabel,
            hint: captureDisplay || "Start / stop shortcut not set",
          },
          {
            label: "Capture",
            value: selectedAudioDeviceLabel,
            hint: `Cap ${formatDurationCompact(maxRecordingSeconds)} · ${autoStopLabel}`,
          },
        ]}
      />

      <FormCard
        title="Shortcuts"
        description={
          <>
            Shortcuts are registered in the native trigger layer and stay active after this window closes. Each row
            shows whether the operating system actually accepted the combination.
            <span className="block text-fg-muted">Mode hotkeys (picker, cycle, per-mode) live in Modes.</span>
            {platform && (
              <span className="mt-1 block text-fg-dim">
                {platform.summary}
                {platform.notes.length > 0 && <> — {platform.notes.join(" ")}</>}
              </span>
            )}
          </>
        }
      >
        {SHORTCUT_FIELDS.map((shortcut) => (
          <ShortcutField
            key={shortcut.field}
            label={shortcut.label}
            description={shortcut.description}
            placeholder={shortcut.placeholder}
            value={config[shortcut.field]}
            binding={bindingFor(shortcut.binding)}
            takenValues={SHORTCUT_FIELDS.filter((other) => other.field !== shortcut.field)
              .map((other) => config[other.field])
              .filter(Boolean)}
            onCommit={(next) => updateShortcut(shortcut.field, next)}
            onStopRecording={refreshTriggerStatus}
          />
        ))}
        <FormRow
          label="Activation mode"
          hint={activationModeHint(
            config.activation_mode,
            triggerStatus,
            captureBinding,
            captureIsModifierOnly,
          )}
          hintTone={
            config.activation_mode === "hold" && holdReleaseUnverified(captureBinding)
              ? "danger"
              : undefined
          }
          align="start"
          divider={false}
          control={
            <Select
              aria-label="Activation mode"
              className="w-[180px]"
              value={config.activation_mode}
              onChange={(event) =>
                onChange({
                  activation_mode: event.target.value as "tap" | "hold" | "double_tap",
                })
              }
            >
              <option value="tap">Tap to toggle</option>
              <option value="double_tap">Double tap to toggle</option>
              <option value="hold">Hold to talk</option>
            </Select>
          }
        />
      </FormCard>

      <FormCard title="Microphone">
        <FormRow
          label="Input device"
          hint={audioStatusMessage}
          hintTone={audioError || !selectedAudioDeviceAvailable ? "danger" : undefined}
          align="start"
          control={
            <div className="flex items-center gap-2">
              <Select
                aria-label="Input device"
                className="w-[240px]"
                value={config.audio_device}
                onChange={(event) => onChange({ audio_device: event.target.value })}
              >
                <option value="">
                  {defaultAudioDevice ? `System default (${defaultAudioDevice.name})` : "System default microphone"}
                </option>
                {audioDevices.map((device) => (
                  <option key={device.name} value={device.name}>
                    {device.is_default ? `${device.name} — default` : device.name}
                  </option>
                ))}
              </Select>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Refresh microphones"
                disabled={isRefreshingAudio}
                onClick={() => void refreshAudioSetup()}
              >
                <RefreshCw className={cn("size-3.5", isRefreshingAudio && "animate-spin")} />
              </Button>
            </div>
          }
        />
        <FormRow
          label="Max recording"
          hint="Maximum recording length in minutes (1–30). Enforced in the native capture monitor — keeps working after this window is closed."
          control={
            <Stepper
              value={Math.round(capture.max_recording_seconds / 60)}
              min={1}
              max={30}
              step={1}
              suffix="min"
              onChange={(value) => onChange(buildProfileCapturePatch(config, { max_recording_seconds: value * 60 }))}
              aria-label="Max recording"
            />
          }
        />
        <FormRow
          label="Silence timeout"
          hint="Auto-stop after this many seconds of silence (0 = disabled, max 60). Enforced in the native capture monitor — keeps working after this window is closed."
          divider={false}
          control={
            <Stepper
              value={capture.silence_timeout_seconds}
              min={0}
              max={60}
              step={1}
              suffix={silenceTimeoutSeconds > 0 ? "s" : "Disabled"}
              onChange={(value) => onChange(buildProfileCapturePatch(config, { silence_timeout_seconds: value }))}
              aria-label="Silence timeout"
            />
          }
        />
      </FormCard>
    </div>
  );
}