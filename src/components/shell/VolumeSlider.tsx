import { Slider } from "@/components/ui/slider";

/**
 * Percentage slider with a live read-out. The read-out matters here because
 * the value multiplies with the OS volume — without a number there is no way
 * to tell an in-app change from a system-level one.
 */
export function VolumeSlider({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  return (
    <div className="flex w-40 items-center gap-3">
      <Slider
        id={id}
        value={[percent]}
        min={0}
        max={100}
        step={5}
        disabled={disabled}
        aria-label="Sound cue volume"
        onValueChange={([next]) => onChange((next ?? 0) / 100)}
      />
      <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-fg-muted">
        {percent}%
      </span>
    </div>
  );
}
