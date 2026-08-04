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
  height = 24,
  className,
  ariaLabel,
}: {
  active?: boolean;
  height?: number;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <LiveWaveform
      active={active}
      height={height}
      barColor="var(--fg-dim)"
      fadeEdges={false}
      mode="scrolling"
      role="img"
      aria-label={ariaLabel ?? "Live input level"}
      className={cn("ws-wave-live", className)}
    />
  );
}
