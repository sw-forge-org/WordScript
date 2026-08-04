import {
  TARGET_PEAK_HIGH,
  VOICE_THRESHOLD,
  toDbfs,
  type InputLevelReading,
} from "@/hooks/useInputLevel";
import { LevelMeter, type LevelState } from "./LevelMeter";

/**
 * The live input meter: `LevelMeter` fed by the runtime's reading.
 *
 * The drawing, the threshold mark and the three states belong to the primitive.
 * What lives here is the one thing that is not design — reading a level the
 * runtime measured and saying in dBFS what it means.
 */
export function InputLevelMeter({ reading }: { reading: InputLevelReading }) {
  const { peak, hold, active } = reading;
  const tooQuiet = active && hold > 0 && hold <= VOICE_THRESHOLD;
  const clipping = active && hold >= TARGET_PEAK_HIGH;
  const state: LevelState = tooQuiet ? "quiet" : clipping ? "hot" : "ok";

  const verdict = !active
    ? "Speak to measure the level."
    : hold === 0
      ? "No signal."
      : tooQuiet
        ? `Too quiet — peak ${toDbfs(hold).toFixed(0)} dBFS is below the ${toDbfs(VOICE_THRESHOLD).toFixed(0)} dBFS needed to register as speech.`
        : clipping
          ? `Very hot — peak ${toDbfs(hold).toFixed(0)} dBFS. Lower the input level to avoid distortion.`
          : `Good — peak ${toDbfs(hold).toFixed(0)} dBFS.`;

  return (
    <LevelMeter
      peak={Math.min(peak, 1) * 100}
      hold={Math.min(hold, 1) * 100}
      threshold={VOICE_THRESHOLD * 100}
      state={state}
      verdict={verdict}
    />
  );
}
