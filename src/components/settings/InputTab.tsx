import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { FormCard, FormRow, InputLevelMeter, Select, StatTiles, StatusBadge, Stepper } from "../shell";
import { useCaptureBudget, formatBudgetDuration } from "../../hooks/useCaptureBudget";
import { SETTINGS_ANCHOR_AUTO_STOP, settingsAnchorElementId } from "../../lib/settingsAnchors";
import { useInputLevel } from "../../hooks/useInputLevel";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import type {
  AppConfig,
  NativeTriggerStatus,
  ShortcutCapabilities,
  ShortcutCapability,
  ShortcutPlatform,
} from "../../types/ipc";
import {
  loadShortcutCapabilities,
  loadShortcutPlatform,
  readTriggerStatus,
  validateShortcut,
} from "../../lib/shortcuts";
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

type ActivationMode = "tap" | "hold" | "double_tap";

const ACTIVATION_MODE_ORDER: ActivationMode[] = ["tap", "double_tap", "hold"];

const ACTIVATION_MODE_LABELS: Record<ActivationMode, string> = {
  tap: "Tap to toggle",
  double_tap: "Double tap to toggle",
  hold: "Hold to talk",
};

/// Whether this session can honor a mode is the runtime's answer, taken from
/// the capability matrix (T12). The UI neither knows platform rules nor
/// re-derives them from the press/release counters (ADR 0006) — it renders the
/// state and the reason it is given.
function capabilityFor(
  capabilities: ShortcutCapabilities | null,
  mode: ActivationMode,
): ShortcutCapability | undefined {
  return capabilities?.activation_modes.find((capability) => capability.id === mode);
}

/// The mechanics of a mode — the timing constants it depends on — plus whatever
/// the matrix says about this session. The first half is what the mode does,
/// the second half is whether it can do it here.
function activationModeHint(
  mode: ActivationMode,
  status: NativeTriggerStatus | null,
  capability?: ShortcutCapability,
  modifierOnly = false,
) {
  const withReason = (base: string) =>
    capability?.reason ? `${base} ${capability.reason}` : base;

  if (mode === "double_tap") {
    const base = `Two taps within ${
      status?.double_tap_window_ms ?? 400
    } ms start or stop the capture. A single tap does nothing.`;
    return withReason(
      modifierOnly
        ? `${base} With a modifier-only shortcut this is the recommended mode: one press stays available to the rest of the desktop, so a combination like Ctrl+Alt+T is not intercepted.`
        : base,
    );
  }

  if (mode !== "hold") {
    const base = `Tap starts and stops on the same shortcut. Repeated presses within ${
      status?.debounce_ms ?? 300
    } ms of the same kind are debounced.`;
    return withReason(
      modifierOnly
        ? `${base} Because this shortcut is modifier-only, every single press acts — which also takes that combination away from other applications. Double tap avoids that.`
        : base,
    );
  }

  const base =
    `Hold records while the shortcut is pressed and stops on release. A press shorter than ${
      status?.hold_arm_ms ?? 300
    } ms is discarded — it starts nothing and leaves nothing behind. To start a recording that keeps running on its own, use one of the toggle modes.` +
    (status?.hold_watchdog_seconds
      ? ` A hold whose key release never arrives is ended after ${status.hold_watchdog_seconds}s with a stated reason.`
      : "");

  return withReason(base);
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
  const [capabilities, setCapabilities] = useState<ShortcutCapabilities | null>(null);

  // The recorder itself releases and restores the OS grabs; refreshing the
  // status afterwards keeps the per-row registration state honest (T8). The
  // capability matrix is refreshed with it because it carries this session's
  // press/release evidence, which the same keystrokes change (T10, T12).
  const refreshTriggerStatus = useCallback(() => {
    void readTriggerStatus()
      .then(setTriggerStatus)
      .catch(() => setTriggerStatus(null));
    void loadShortcutCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null));
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

  // Live level from the runtime's existing audio_level event. Read-only.
  const inputLevel = useInputLevel();

  const defaultAudioDevice = useMemo(
    () => audioDevices.find((device) => device.is_default) ?? null,
    [audioDevices],
  );
  const maxRecordingSeconds = clampCaptureNumber(capture.max_recording_seconds, 60, 1800, 720);

  // What this provider and plan can actually process. Re-read when the speech
  // settings change, because switching provider or account plan moves the
  // ceiling under an open panel.
  const { budget } = useCaptureBudget(`${config.provider}:${config.provider_tier}:${config.local_model}`);

  // The stepper must not offer a length the pipeline cannot honor. Whole
  // minutes, rounded *down*, so the offered maximum is always reachable.
  const autoStopMaxMinutes = budget
    ? Math.max(1, Math.floor(budget.ceiling_seconds / 60))
    : 30;

  // One row, three possible things to say, in order of how much they matter:
  // the stored value is impossible, the stored value has no headroom, or
  // everything is fine and the row explains what it does.
  const autoStopHint = !budget
    ? "Ends the recording at this length, so it always finishes processing."
    : budget.auto_stop_clamped
      ? `Ends the recording at this length. Your saved value of ${formatBudgetDuration(budget.configured_auto_stop_seconds)} is longer than this setup can process, so recordings stop at ${formatBudgetDuration(budget.auto_stop_seconds)} instead. The saved value is kept — lower it, or raise the processing limit by changing provider or plan.`
      : budget.auto_stop_in_margin
        ? `Ends the recording at this length. This sits within ${formatBudgetDuration(budget.safety_margin_seconds)} of the processing limit, which leaves no room for a recording that runs slightly long. ${formatBudgetDuration(budget.recommended_auto_stop_seconds)} or less is the safe range.`
        : `Ends the recording at this length, so it always finishes processing. Recommended: up to ${formatBudgetDuration(budget.recommended_auto_stop_seconds)}, which keeps ${formatBudgetDuration(budget.safety_margin_seconds)} of headroom under the processing limit.`;
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
  const activeCapability = capabilityFor(capabilities, config.activation_mode);
  // A mode the session cannot honor is named, never silently swapped: the
  // persisted value stays the user's (T7, invariant "empty means empty").
  const activeModeUnavailable = activeCapability?.state === "unavailable";
  const autoStopLabel = silenceTimeoutSeconds > 0
    ? `${formatDurationCompact(silenceTimeoutSeconds)} silence`
    : "Manual stop";
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
            {/* The key-class half of the capability matrix (T12). Only the rows
                that carry a consequence are shown; listing what simply works
                would bury the ones that do not. */}
            {capabilities?.key_classes
              .filter((capability) => capability.state !== "available" && capability.reason)
              .map((capability) => (
                <span
                  key={capability.id}
                  className={cn(
                    "mt-1 block",
                    capability.state === "unavailable" ? "text-[var(--red)]" : "text-fg-dim",
                  )}
                >
                  {capability.label}: {capability.reason}
                </span>
              ))}
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
            activeCapability,
            captureIsModifierOnly,
          )}
          hintTone={activeModeUnavailable ? "danger" : undefined}
          align="start"
          divider={false}
          control={
            <Select
              aria-label="Activation mode"
              className="w-[180px]"
              value={config.activation_mode}
              onChange={(event) =>
                onChange({
                  activation_mode: event.target.value as ActivationMode,
                })
              }
            >
              {ACTIVATION_MODE_ORDER.map((mode) => {
                const capability = capabilityFor(capabilities, mode);
                const unavailable = capability?.state === "unavailable";
                return (
                  <option
                    key={mode}
                    value={mode}
                    // An option this session cannot honor is offered as
                    // unselectable with the reason in the hint, instead of
                    // looking available and then doing nothing (T10, T12).
                    disabled={unavailable && mode !== config.activation_mode}
                  >
                    {unavailable
                      ? `${ACTIVATION_MODE_LABELS[mode]} — unavailable here`
                      : ACTIVATION_MODE_LABELS[mode]}
                  </option>
                );
              })}
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
          label="Input level"
          hint="Measured live while you dictate. A capture whose loudest moment never crosses the marked threshold is discarded as empty — which is what a microphone set too quietly looks like. Set the level for this microphone in your system sound settings; WordScript never changes it, because that setting is shared with every other app using the same microphone."
          layout="stacked"
          control={<InputLevelMeter reading={inputLevel} />}
        />
        {/* Three different things end or bound a recording, and they were
            previously two rows that did not mention each other. In order of
            how hard they are:

              1. Stop after silence — you stopped talking.
              2. Auto-stop — the recording got long, and it ends here so that
                 it still goes through.
              3. Processing limit — past this nothing can be processed at all.

            The limit is the runtime's answer, not a number recomputed here: it
            moves with the provider, the account plan and the model, and a copy
            in TypeScript drifts invisibly (ADR 0034). */}
        <FormRow
          label="Processing limit"
          hint={
            budget
              ? `The longest recording this setup can process at all — ${formatBudgetDuration(budget.ceiling_seconds)}, set by ${budget.ceiling_detail}. Past it the recording cannot be transcribed, so the auto-stop below stays underneath it.`
              : "Reading the current provider limit…"
          }
          control={
            budget ? (
              <StatusBadge tone="neutral">{formatBudgetDuration(budget.ceiling_seconds)}</StatusBadge>
            ) : null
          }
        />
        <div id={settingsAnchorElementId(SETTINGS_ANCHOR_AUTO_STOP)} className="settings-anchor">
          <FormRow
            label="Auto-stop"
            hintTone={budget?.auto_stop_clamped ? "danger" : "default"}
            hint={autoStopHint}
            control={
              <Stepper
                value={Math.round(capture.max_recording_seconds / 60)}
                min={1}
                max={autoStopMaxMinutes}
                step={1}
                suffix="min"
                onChange={(value) => onChange(buildProfileCapturePatch(config, { max_recording_seconds: value * 60 }))}
                aria-label="Auto-stop"
              />
            }
          />
        </div>
        <FormRow
          label="Stop after silence"
          hint="Ends the recording after this many seconds without speech (0 = disabled, max 60). Independent of the length limits above — it reacts to you stopping, not to the recording getting long. Enforced in the native capture monitor, so it keeps working after this window is closed."
          divider={false}
          control={
            <Stepper
              value={capture.silence_timeout_seconds}
              min={0}
              max={60}
              step={1}
              suffix={silenceTimeoutSeconds > 0 ? "s" : "Disabled"}
              onChange={(value) => onChange(buildProfileCapturePatch(config, { silence_timeout_seconds: value }))}
              aria-label="Stop after silence"
            />
          }
        />
      </FormCard>
    </div>
  );
}