import { Slider } from "./Slider";

/**
 * The cue volume, as a proportion. A thin caller over `Slider` because the
 * value the runtime holds is 0–1 and the control is 0–100; the drawing, the
 * read-out and the hit target are the primitive's.
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
  return (
    <Slider
      id={id}
      value={Math.round(Math.min(Math.max(value, 0), 1) * 100)}
      step={5}
      disabled={disabled}
      aria-label="Sound cue volume"
      onChange={(next) => onChange(next / 100)}
    />
  );
}
