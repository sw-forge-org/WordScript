import {
  TARGET_PEAK_HIGH,
  VOICE_THRESHOLD,
  toDbfs,
  type InputLevelReading,
} from "@/hooks/useInputLevel";
import { cn } from "@/lib/utils";

/**
 * Live input meter with the speech threshold drawn in.
 *
 * The threshold marker is the point: a capture whose peak never crosses it is
 * discarded as empty, so the user needs to see the bar they have to clear —
 * not just an abstract level.
 */
export function InputLevelMeter({ reading }: { reading: InputLevelReading }) {
  const { peak, hold, active } = reading;
  const tooQuiet = active && hold > 0 && hold <= VOICE_THRESHOLD;
  const clipping = active && hold >= TARGET_PEAK_HIGH;

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
    <div className="flex w-full flex-col gap-1.5">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-strong">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-75",
            tooQuiet
              ? "bg-fg-muted"
              : clipping
                ? "bg-[var(--red)]"
                : "bg-primary",
          )}
          style={{ width: `${Math.min(peak, 1) * 100}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: `${Math.min(hold, 1) * 100}%` }}
          aria-hidden
        />
        <div
          className="absolute inset-y-0 w-px bg-border-strong"
          style={{ left: `${VOICE_THRESHOLD * 100}%` }}
          aria-hidden
          title="Speech threshold"
        />
      </div>
      <p
        className={cn(
          "text-[12px] leading-snug",
          tooQuiet || clipping ? "text-[var(--red)]" : "text-fg-dim",
        )}
      >
        {verdict}
      </p>
    </div>
  );
}
