import { useCallback, useEffect, useRef } from "react";
import { useVoiceEnvelope, prefersReducedMotion } from "./useVoiceEnvelope";

/**
 * A rolling live waveform, for the places a microphone is actually judged:
 * the input-level control in settings, and meeting capture.
 *
 * WHY NOT THE LEVEL BAR ALONE. The bar reports one number — current peak — as
 * a length. That is enough to see that a level exists and not enough to see
 * what a person needs when deciding whether their microphone is set right:
 * whether the signal is steady or spiky, whether the room floor is audible
 * under the speech, whether peaks are clipping while the average sits far too
 * low. All of that is shape over time, and a bar has no time axis. This does
 * not replace the bar — the bar carries the discard threshold, which is a
 * boundary the runtime actually applies.
 *
 * Canvas, not DOM. Ninety-odd bars restyled at 60 Hz is a layout thrash; this
 * is one paint into one already-composited node.
 */

interface LiveWaveformProps {
  /** 0..1 from the native `audio_level` event. Omit and pass `demo` to sample. */
  level?: number;
  demo?: boolean;
  kind?: "input" | "voice";
  height?: number;
  tone?: "neutral" | "voice" | "quiet" | "hot";
  className?: string;
  label?: string;
}

export function LiveWaveform({
  level,
  demo = false,
  kind = "input",
  height = 40,
  tone = "neutral",
  className,
  label = "Live input level over the last few seconds",
}: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>([]);
  const sizedRef = useRef(0);

  const paint = useCallback((next: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const cssW = el.clientWidth;
    const cssH = el.clientHeight;
    if (!cssW || !cssH) return;

    const dpr = window.devicePixelRatio || 1;
    const key = cssW * 10000 + cssH;
    if (sizedRef.current !== key) {
      el.width = Math.round(cssW * dpr);
      el.height = Math.round(cssH * dpr);
      sizedRef.current = key;
    }

    const ctx = el.getContext("2d");
    if (!ctx) return;

    const barW = 3;
    const step = barW + 2;
    const slots = Math.max(1, Math.floor(cssW / step));

    barsRef.current.push(next);
    while (barsRef.current.length > slots) barsRef.current.shift();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const cs = getComputedStyle(el);
    const live = cs.getPropertyValue("--wave-fg").trim() || "#c2bfb8";
    const rest = cs.getPropertyValue("--wave-bg").trim() || "rgba(255,255,255,.10)";
    const mid = cssH / 2;
    const maxH = cssH - 2;
    const bars = barsRef.current;

    for (let i = 0; i < slots; i++) {
      const v = bars[bars.length - slots + i];
      const known = v != null;
      /* A floor, so silence is a visible line rather than a gap. An audio view
         that disappears when nothing is happening looks broken. */
      const h = Math.max(2, (known ? v : 0) * maxH);
      const x = i * step + (cssW - slots * step + 2) / 2;
      ctx.fillStyle = known && v > 0.02 ? live : rest;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, mid - h / 2, barW, h, barW / 2);
      else ctx.rect(x, mid - h / 2, barW, h);
      ctx.fill();
    }
  }, []);

  useVoiceEnvelope(
    kind === "voice" ? "speaking" : "listening",
    demo || level != null,
    paint,
    demo ? undefined : level,
  );

  /* With motion reduced the loop never runs, so the canvas would stay blank.
     Fill it once with a plausible history: a still waveform still says the
     microphone is alive, an empty box says it is dead. */
  useEffect(() => {
    if (!prefersReducedMotion()) return;
    const seed = [0.1, 0.35, 0.7, 0.5, 0.85, 0.3, 0.6, 0.2, 0.75, 0.45, 0.15, 0.55];
    for (let i = 0; i < 140; i++) paint(seed[i % seed.length]);
  }, [paint]);

  return (
    <canvas
      ref={canvasRef}
      className={`ws-wave ${className ?? ""}`}
      data-tone={tone}
      style={{ height }}
      role="img"
      aria-label={label}
    />
  );
}
