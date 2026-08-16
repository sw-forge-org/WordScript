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
 *
 * `level` IS HOW IT MOVES IN THE PRODUCT (ADR 0170). The runtime measures the
 * microphone — a capture through `audio_level`, `core::input_monitor` through
 * `input_monitor_level` when no capture is running — and the drawing runs off
 * that reading. Same geometry, same scrolling, one microphone owner. A surface
 * that passes nothing still draws at rest, which is what the gallery needs and
 * what a screen with no measurement to show must do.
 */
export function Waveform({
  active = false,
  level = null,
  /** The prototype's geometry: full width of its row, 40 px tall. The gallery's
   *  component page overrides it to swatch scale through `.ws-state`. */
  height = 40,
  tone,
  className,
  ariaLabel,
}: {
  active?: boolean;
  /** A ref holding the runtime's 0..1 reading — `levelRef` from
   *  `useInputLevel`. A ref rather than a number so the twenty-four readings a
   *  second reach the canvas without re-rendering the screen around it.
   *  `null` draws the row at rest. */
  level?: { current: number } | null;
  height?: number;
  /** Colours the drawing without the drawing knowing about palettes. */
  tone?: "voice" | "quiet" | "hot";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <LiveWaveform
      active={active}
      externalLevel={level}
      height={height}
      /* NO `barColor`, DELIBERATELY. Upstream falls back to the canvas's own
         computed `color`, which `.ws-wave-live` sets from `--wave-fg` — an
         actual colour rather than the `var()` string a canvas cannot read.
         Passing the token here is what drew the trace black in both themes. */
      fadeEdges={false}
      mode="scrolling"
      role="img"
      data-tone={tone}
      aria-label={ariaLabel ?? "Live input level over the last few seconds"}
      className={cn("ws-wave-live", className)}
    />
  );
}
