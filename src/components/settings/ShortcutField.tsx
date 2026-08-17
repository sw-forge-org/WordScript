import { useState } from "react";
import { HotkeyButton, Icon, IconButton } from "@/components/shell";
import { comboFromBinding } from "@/lib/shortcuts";
import type { ShortcutBindingInfo } from "@/types/ipc";
import { HotkeyRecorder } from "./HotkeyRecorder";

/**
 * A SHORTCUT SLOT, WHOLE — the caps, the clear button and the recorder behind
 * them, as one control.
 *
 * WHY THIS EXISTS RATHER THAN A RECORDER EACH SURFACE ASSEMBLES ITSELF. The
 * recorder was always shared; the three things AROUND it were not, and each of
 * them was a defect the first time it was written (ADR 0201):
 *
 * 1. **The click that swaps the button for the recorder is the click that
 *    starts it.** Anything else spends a click on a widget that only looks like
 *    it is listening.
 * 2. **The stored value decides what is drawn, never the runtime's last
 *    registration**, which lags a save. Getting this wrong draws the OLD
 *    shortcut over a new one and reads as "it did not save".
 * 3. **A bound slot can be emptied without choosing a replacement**, because an
 *    empty value is the runtime's own `Disabled` (T7).
 *
 * A second surface assembling those from parts would get to rediscover all
 * three, which is the argument for the component boundary being HERE and not
 * one level down.
 *
 * RECORDING IS CONTROLLED OR IT IS NOT. Pass `recording` plus
 * `onRecordingChange` where several slots sit together and only one may listen
 * at a time — the blur-cancel alone cannot guarantee that, because a pill that
 * never took focus never blurs. Omit both where there is one slot and the
 * question does not arise.
 */
interface Props {
  /** Canonical stored value. Empty means the slot is unbound — which is a
   *  value, not a missing one. */
  value: string;
  onChange: (next: string) => void;
  /** The runtime's last registration for this slot, when it has one. Used only
   *  for the human spelling, and only when it is a spelling OF `value`. */
  binding?: ShortcutBindingInfo;
  /** Human name of the slot. Names the clear button and the recorder. */
  label: string;
  /** Canonical values other slots hold, so a collision is reported before the
   *  value is committed rather than after. */
  takenValues?: string[];
  allowModifierOnly?: boolean;
  /** Recording ended — commit or cancel. A caller that reads runtime state
   *  re-reads it here: the recorder released and restored the OS grabs. */
  onRecordingEnd?: () => void;
  recording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
}

export function ShortcutField({
  value,
  onChange,
  binding,
  label,
  takenValues = [],
  allowModifierOnly = true,
  onRecordingEnd,
  recording,
  onRecordingChange,
}: Props) {
  const [ownRecording, setOwnRecording] = useState(false);
  const isRecording = recording ?? ownRecording;

  const setRecording = (next: boolean) => {
    setOwnRecording(next);
    onRecordingChange?.(next);
  };

  const combo = comboFromBinding(binding, value);

  if (isRecording) {
    return (
      <HotkeyRecorder
        autoStart
        value={value}
        /* Already resolved against the stored value, so the recorder cannot be
           handed a spelling of a shortcut this slot no longer holds. */
        display={combo?.split("+").join(" + ")}
        allowModifierOnly={allowModifierOnly}
        takenValues={takenValues}
        onChange={onChange}
        onStopRecording={() => {
          setRecording(false);
          onRecordingEnd?.();
        }}
        ariaLabel={`${label} shortcut`}
      />
    );
  }

  return (
    <span className="ws-rowflex">
      <HotkeyButton combo={combo} onClick={() => setRecording(true)} />
      {value.trim() ? (
        <IconButton
          label={`Clear the ${label} shortcut`}
          icon={<Icon name="x" />}
          onClick={() => onChange("")}
        />
      ) : null}
    </span>
  );
}
