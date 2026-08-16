import { VOICE_THRESHOLD, toDbfs, type InputLevelStream } from "@/hooks/useInputLevel";
import { LevelMeter } from "./LevelMeter";

/**
 * The live input meter: `LevelMeter` fed by the runtime's reading.
 *
 * The drawing, the threshold mark and the three states belong to the primitive.
 * What lives here is the one thing that is not design — reading a level the
 * runtime measured and saying in dBFS what it means.
 *
 * TWO CLOCKS, AND THAT IS THE WHOLE IDEA. The bar takes the stream's ref and
 * animates itself at the display's rate, so it moves the way the microphone
 * does. The SENTENCE takes the stream's verdict, which is decided over seconds:
 * a speaking voice crosses the speech threshold on each syllable and drops under
 * it in each gap, so a sentence decided per reading flipped between "Good" and
 * "Too quiet" several times a sentence — and since the two are different
 * lengths, the card resized with every flip. The figure quoted is the same
 * window's peak, so the number and the verdict are about one stretch of time.
 */
export function InputLevelMeter({ stream }: { stream: InputLevelStream }) {
  const { state, windowPeak, meterRef } = stream;

  const verdict =
    state === "measuring"
      ? "Speak to measure the level."
      : state === "silent"
        ? "No signal."
        : state === "quiet"
          ? `Too quiet — peak ${toDbfs(windowPeak).toFixed(0)} dBFS is below the ${toDbfs(VOICE_THRESHOLD).toFixed(0)} dBFS needed to register as speech.`
          : state === "hot"
            ? `Very hot — peak ${toDbfs(windowPeak).toFixed(0)} dBFS. Lower the input level to avoid distortion.`
            : `Good — peak ${toDbfs(windowPeak).toFixed(0)} dBFS.`;

  return (
    <LevelMeter
      live={meterRef}
      threshold={VOICE_THRESHOLD * 100}
      state={state === "quiet" ? "quiet" : state === "hot" ? "hot" : "ok"}
      verdict={verdict}
    />
  );
}
