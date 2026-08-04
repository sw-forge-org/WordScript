import { LiveWaveform } from "@/components/ui/live-waveform";
import { cn } from "@/lib/utils";

/**
 * THE LIVE INPUT LEVEL, AS A BAR CHART OF THE LAST FEW SECONDS.
 *
 * Upstream's geometry, upstream's defaults (ElevenLabs UI, MIT): 3 px bars, a
 * 1 px gap, a radius of half the bar, centred on the middle line, and scrolling
 * so the newest sample sits under the leading edge. Two of its rules are why it
 * looks the way it does — alpha carries level as well as height, so a run of
 * near-silence reads as one dim texture instead of a row of marks each drawn at
 * full strength; and the floor is a base bar height rather than a second
 * colour, so silence is a line rather than a gap.
 *
 * `active` OPENS THE MICROPHONE. Upstream reaches for `getUserMedia` and an
 * `AnalyserNode` the moment it is true, so a gallery renders this at rest: a
 * display surface must not take a device, and a moving meter on a page that is
 * measuring nothing is the fake state the runtime rules forbid. The prototype
 * animates it from a synthetic envelope because it has no microphone at all;
 * the product has one, which is exactly why the gallery must not touch it.
 */
export function Waveform({
  active = false,
  /** The prototype's geometry: full width of its row, 40 px tall. The gallery's
   *  component page overrides it to swatch scale through `.ws-state`. */
  height = 40,
  tone,
  className,
  ariaLabel,
}: {
  active?: boolean;
  height?: number;
  /** Colours the drawing without the drawing knowing about palettes. */
  tone?: "voice" | "quiet" | "hot";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <LiveWaveform
      active={active}
      height={height}
      barColor="var(--wave-fg)"
      fadeEdges={false}
      mode="scrolling"
      role="img"
      data-tone={tone}
      aria-label={ariaLabel ?? "Live input level over the last few seconds"}
      className={cn("ws-wave-live", className)}
    />
  );
}
