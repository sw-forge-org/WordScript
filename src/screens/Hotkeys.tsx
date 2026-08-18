import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardRows,
  Row,
  SectionHeader,
  SegmentControl,
  StatusBadge,
  Stepper,
  ViewTop,
} from "@/components/shell";
import { ShortcutField } from "@/components/settings/ShortcutField";
import {
  comboFromBinding,
  loadShortcutCapabilities,
  readTriggerStatus,
  validateShortcut,
} from "@/lib/shortcuts";
import type {
  AppConfig,
  NativeTriggerStatus,
  ShortcutBindingInfo,
  ShortcutCapabilities,
  ShortcutCapability,
} from "@/types/ipc";
import type { WiredScreenProps } from "./props";

/**
 * HOTKEYS — `SCREENS.hotkeys`, wired.
 *
 * A shortcut the OS refused is the single most expensive silent failure in the
 * product: nothing happens, and nothing says why. It is stated per row, as a
 * badge beside the caps rather than as a sentence under them — and the badge is
 * `native_trigger_status`'s answer for that slot, not a drawing of one.
 *
 * Translate took the seventh slot rather than displacing one (ADR 0041), and it
 * now sits inside the digit order rather than after it: the lane runs Alt+1
 * through Alt+7, Translate takes Alt+5, and Draft and Prompt Enhance each moved
 * one place down. Seven digits is where a modifier row stops being comfortable,
 * so the eighth mode inherits that question rather than a precedent for
 * extending the row silently.
 *
 * Every row is settable and every row may be emptied. An empty slot means
 * "nothing is bound", the same as any mode the user cleared, which is why no
 * row needs a note of its own.
 *
 * WHY THE MODE ROWS CARRY NO BADGE AND THE CAPTURE ROWS DO. That is the
 * drawing's own split and it is the badge rule (§11.20): a badge is for a
 * status that is NOT expected. Every capture shortcut is expected to be
 * registered, so its state is worth a permanent column; a mode shortcut is
 * empty by default, so "not registered" there is usually just "not set". A mode
 * row that DOES have a problem says so in its hint, which is the slot the
 * drawing already uses on the row above it.
 *
 * THE ONE FACT WITH NO SOURCE IS "TAKEN BY THE DESKTOP" AS A PHRASE. The
 * runtime answers `registered` plus a sentence, never a three-word cause, so
 * the badge states what it knows — `Registered`, `Not registered`, `Disabled`,
 * `Not checked` — and the sentence goes in the hint where a sentence fits.
 */

/** `mode_hotkeys.all_slots()` in `core::trigger`, which is what `BindingInfo`'s
 *  `label` carries. The three capture slots are its first three registrations. */
type CaptureField = "hotkey" | "pause_hotkey" | "abort_hotkey";
type ModeField =
  | "mode_picker_hotkey"
  | "mode_auto_hotkey"
  | "mode_verbatim_hotkey"
  | "mode_cleanup_hotkey"
  | "mode_rewrite_hotkey"
  | "mode_translate_hotkey"
  | "mode_agent_hotkey"
  | "mode_prompt_enhance_hotkey";

const CAPTURE_SLOTS: { field: CaptureField; binding: string; label: string; hint: string }[] = [
  {
    field: "hotkey",
    binding: "capture",
    label: "Dictate",
    hint: "Starts and stops a capture, in any app.",
  },
  {
    field: "pause_hotkey",
    binding: "pause",
    label: "Pause",
    hint: "Holds the capture without ending the session.",
  },
  {
    field: "abort_hotkey",
    binding: "abort",
    label: "Abort",
    hint: "Discards the capture. Nothing is transcribed or inserted.",
  },
];

/**
 * The drawn seven, in the drawing's order. `Draft` is the surface's name for the
 * runtime's `agent`; the mapping is the port's, and the binding label is the
 * runtime's own `ProcessingMode::as_str()`.
 */
const MODE_SLOTS: { label: string; field: ModeField; binding: string }[] = [
  { label: "Auto", field: "mode_auto_hotkey", binding: "auto" },
  { label: "Verbatim", field: "mode_verbatim_hotkey", binding: "verbatim" },
  { label: "Cleanup", field: "mode_cleanup_hotkey", binding: "cleanup" },
  { label: "Rewrite", field: "mode_rewrite_hotkey", binding: "rewrite" },
  { label: "Translate", field: "mode_translate_hotkey", binding: "translate" },
  { label: "Draft", field: "mode_agent_hotkey", binding: "agent" },
  { label: "Prompt Enhance", field: "mode_prompt_enhance_hotkey", binding: "prompt_enhance" },
];

const ACTIVATION_MODES: { value: AppConfig["activation_mode"]; label: string }[] = [
  { value: "tap", label: "Tap" },
  { value: "double_tap", label: "Double tap" },
  { value: "hold", label: "Hold" },
];

const ALL_FIELDS: (CaptureField | ModeField)[] = [
  "hotkey",
  "pause_hotkey",
  "abort_hotkey",
  "mode_picker_hotkey",
  "mode_auto_hotkey",
  "mode_verbatim_hotkey",
  "mode_cleanup_hotkey",
  "mode_rewrite_hotkey",
  "mode_translate_hotkey",
  "mode_agent_hotkey",
  "mode_prompt_enhance_hotkey",
];

function readField(config: AppConfig, field: CaptureField | ModeField): string {
  return (config[field] as string | undefined) ?? "";
}


/**
 * The mechanics of an activation mode, from the runtime's own timing constants,
 * plus whatever the capability matrix says about this session. The drawing drew
 * ONE member of this family — tap, on a modifier-only trigger — and it is kept
 * word for word as that case.
 */
function activationHint(
  mode: AppConfig["activation_mode"],
  status: NativeTriggerStatus | null,
  capability: ShortcutCapability | undefined,
  modifierOnly: boolean,
  triggerLabel: string,
): string {
  const withReason = (base: string) => (capability?.reason ? `${base} ${capability.reason}` : base);

  if (mode === "double_tap") {
    return withReason(
      `Two taps within ${status?.double_tap_window_ms ?? 400} ms start or stop the capture. A single tap does nothing.`,
    );
  }
  if (mode === "hold") {
    return withReason(
      `Records while the shortcut is held and stops on release. A press shorter than ${
        status?.hold_arm_ms ?? 300
      } ms starts nothing and leaves nothing behind.`,
    );
  }
  return withReason(
    modifierOnly
      ? `${triggerLabel} is modifier-only, so every press acts — and other apps lose it. Double tap avoids that.`
      : `Tap starts and stops on the same shortcut. Repeated presses within ${
          status?.debounce_ms ?? 300
        } ms are debounced.`,
  );
}

/** Four answers and no fifth. `undefined` is the runtime not having answered
 *  yet, which is not the same as "not registered" and does not claim to be —
 *  and neither is an answer about the value this slot held a moment ago, which
 *  is why the binding has to be FOR the stored value to count as one. */
/** `Registered` is a claim about the OS accepting the binding, and until the
 *  backend's event loop stopped being able to report its own death that claim
 *  was the only thing this badge could say. It outlived the truth: the recorded
 *  failure is a session where every slot read `Registered` and not one key event
 *  could ever arrive again.
 *
 *  So a stopped loop outranks the per-binding answer. It is not a per-slot
 *  fact — nothing is delivering, for any slot — but this badge is where a user
 *  looks, and a screen that keeps saying `Registered` at them is the fake
 *  readiness the runtime rules forbid. */
function badgeFor(
  binding: ShortcutBindingInfo | undefined,
  stored: string,
  delivering: boolean,
) {
  const value = stored.trim();
  if (!value) return { tone: "neutral" as const, text: "Disabled" };
  if (!binding || binding.configured.trim() !== value) {
    return { tone: "neutral" as const, text: "Not checked" };
  }
  if (binding.registered && !delivering) {
    return { tone: "danger" as const, text: "Not delivering" };
  }
  if (binding.registered) return { tone: "success" as const, text: "Registered" };
  return { tone: "danger" as const, text: "Not registered" };
}

export function HotkeysScreen({ banner, runtime }: WiredScreenProps) {
  const { config, patch, active } = runtime;

  const [status, setStatus] = useState<NativeTriggerStatus | null>(null);
  const [capabilities, setCapabilities] = useState<ShortcutCapabilities | null>(null);
  const [modifierOnly, setModifierOnly] = useState(false);
  const [recording, setRecording] = useState<CaptureField | ModeField | null>(null);

  /* The recorder itself releases and restores the OS grabs, so the registration
     state and the capability matrix are both stale the moment it closes: the
     matrix carries this session's press/release evidence, which the same
     keystrokes change. Read together, always. */
  const refresh = useCallback(() => {
    void readTriggerStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
    void loadShortcutCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null));
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh();
  }, [active, refresh]);

  /* A saved shortcut is re-registered by the runtime, so the row's badge has to
     be re-read when the value changes — not when the section is opened. EVERY
     value: the three capture slots were listed here and the eight mode slots
     were not, so a mode row kept the runtime's answer about whatever it used to
     be bound to until something else on the screen happened to refresh. */
  const storedShortcuts = ALL_FIELDS.map((field) => readField(config, field)).join(" ");
  useEffect(() => {
    if (!active) return;
    refresh();
  }, [active, refresh, storedShortcuts]);

  /* Whether the trigger is modifier-only is the runtime's answer, never a rule
     re-derived here — the UI owns no key knowledge (ADR 0006). */
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void validateShortcut(config.hotkey)
      .then((result) => {
        if (!cancelled) setModifierOnly(result.ok && result.modifier_only);
      })
      .catch(() => {
        if (!cancelled) setModifierOnly(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, config.hotkey]);

  const bindingFor = (label: string | null) =>
    label ? status?.bindings.find((binding) => binding.label === label) : undefined;

  const takenBy = (self: CaptureField | ModeField) =>
    ALL_FIELDS.filter((field) => field !== self)
      .map((field) => readField(config, field))
      .filter(Boolean);

  const commit = (field: CaptureField | ModeField, value: string) => {
    /* A shortcut is a discrete value — there is no half-recorded chord — so it
       takes the instant-save path the sheet's foot states, not `patchText`. */
    patch({ [field]: value } as Partial<AppConfig>);
    setRecording(null);
    refresh();
  };

  /* The one thing on this screen that no per-binding answer can carry: the
     backend's event loop has stopped, so nothing can fire in this session no
     matter what each slot says about itself. It is not recoverable in process —
     every grab lived on the connection that died — so the hint states the only
     action that helps rather than describing the fault. */
  const deliveryStopped = status?.delivery?.stoppedReason
    ? "Shortcuts stopped arriving in this session. Restart WordScript to rebuild them."
    : null;
  const delivering = !deliveryStopped;

  const captureBinding = bindingFor("capture");
  const triggerLabel = comboFromBinding(captureBinding, config.hotkey) ?? "The trigger";
  const activationCapability = capabilities?.activation_modes.find(
    (entry) => entry.id === config.activation_mode,
  );

  /** The row's control. Every rule about how a shortcut slot behaves lives in
   *  `ShortcutField` and is shared with every other surface that offers one
   *  (ADR 0201); what belongs here is only which slot this row is and which
   *  values the other ten already hold.
   *
   *  RECORDING IS CONTROLLED FROM THE SCREEN because eleven of these sit
   *  together and only one may listen at a time. The recorder's blur-cancel
   *  cannot guarantee that on its own — a pill that never took focus never
   *  blurs — so the screen holds the single open slot. */
  const control = (
    field: CaptureField | ModeField,
    binding: ShortcutBindingInfo | undefined,
    label: string,
    allowModifierOnly = true,
  ) => (
    <ShortcutField
      value={readField(config, field)}
      binding={binding}
      label={label}
      allowModifierOnly={allowModifierOnly}
      takenValues={takenBy(field)}
      onChange={(next) => commit(field, next)}
      recording={recording === field}
      onRecordingChange={(on) => setRecording(on ? field : null)}
      onRecordingEnd={refresh}
    />
  );

  return (
    <>
      <ViewTop title="Hotkeys" lead="Every key WordScript listens for, in one place." banner={banner} />

      <SectionHeader title="Capture">
        <Card>
          <CardRows>
            {CAPTURE_SLOTS.map((slot) => {
              const binding = bindingFor(slot.binding);
              const stored = readField(config, slot.field);
              const badge = badgeFor(binding, stored, delivering);
              return (
                <Row
                  key={slot.field}
                  label={slot.label}
                  hint={deliveryStopped ?? binding?.error ?? slot.hint}
                  control={
                    <span className="ws-rowflex">
                      <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
                      {control(slot.field, binding, slot.label)}
                    </span>
                  }
                />
              );
            })}
            <Row
              label="Activation"
              hint={activationHint(
                config.activation_mode,
                status,
                activationCapability,
                modifierOnly,
                triggerLabel,
              )}
              control={
                <SegmentControl
                  aria-label="Activation"
                  value={config.activation_mode}
                  onChange={(next) => patch({ activation_mode: next })}
                  options={ACTIVATION_MODES.map((mode) => ({
                    value: mode.value,
                    label: mode.label,
                    /* A mode this session cannot honor is offered inert with
                       the reason in the hint, never silently swapped — and the
                       one that is already stored stays operable, so a user is
                       never locked out of the value they have. */
                    disabled:
                      capabilities?.activation_modes.find((entry) => entry.id === mode.value)
                        ?.state === "unavailable" && mode.value !== config.activation_mode,
                  }))}
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
              hint={bindingFor("mode_picker")?.error ?? "Opens the picker; press again to cycle."}
              control={control("mode_picker_hotkey", bindingFor("mode_picker"), "Mode select")}
            />
            {MODE_SLOTS.map((slot) => {
              const binding = bindingFor(slot.binding);
              return (
                <Row
                  key={slot.label}
                  label={slot.label}
                  hint={binding?.error ?? undefined}
                  control={control(slot.field, binding, slot.label)}
                />
              );
            })}
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Mode-select overlay">
        <Card>
          <CardRows>
            <Row
              label="Picker stays for"
              hint="Press the key again to cycle while it is open."
              control={
                <Stepper
                  value={config.mode_select_timeout_s}
                  onChange={(next) => patch({ mode_select_timeout_s: next })}
                  suffix="s"
                  min={1}
                  max={30}
                  aria-label="Picker stays for"
                />
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

    </>
  );
}
