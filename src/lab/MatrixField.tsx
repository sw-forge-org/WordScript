import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./useVoiceEnvelope";

/**
 * A drifting glyph field, used as Home's ground.
 *
 * WHY IT IS NOT DECORATION. Home's job at rest is to answer one question — is
 * this thing listening — and the shipped answer was a sentence. A surface that
 * responds to your voice answers it without being read, from across a desk,
 * which is the distance this app is used at: the user is looking at another
 * application while they talk. At rest the field drifts slowly; while capturing
 * it brightens and accelerates along the input level.
 *
 * The glyphs are the transcript alphabet — letters, punctuation, digits — not
 * katakana. It is the app's own material rather than a film reference.
 *
 * `aria-hidden`, because what it carries is presence, and presence is not a
 * string. Anything a screen-reader user needs from this surface is in the state
 * line above it.
 */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:'\"?!—…0123456789";
const CELL = 14;

interface Column {
  y: number;
  speed: number;
  len: number;
  glyphs: string[];
}

interface MatrixFieldProps {
  /** 0..1. Brightens and accelerates the field. */
  level?: number;
  className?: string;
}

export function MatrixField({ level = 0, className }: MatrixFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cols: Column[] = [];
    let sized = 0;
    let raf = 0;
    let last = 0;

    const draw = (dt: number) => {
      const cssW = el.clientWidth;
      const cssH = el.clientHeight;
      if (!cssW || !cssH) return;

      const dpr = window.devicePixelRatio || 1;
      const key = cssW * 10000 + cssH;
      if (sized !== key) {
        el.width = Math.round(cssW * dpr);
        el.height = Math.round(cssH * dpr);
        sized = key;
        cols = Array.from({ length: Math.ceil(cssW / CELL) }, () => ({
          y: Math.random() * cssH,
          speed: 8 + Math.random() * 26,
          len: 4 + Math.floor(Math.random() * 9),
          glyphs: [],
        }));
      }

      const ctx = el.getContext("2d");
      if (!ctx) return;

      const cs = getComputedStyle(el);
      const hue = cs.getPropertyValue("--matrix-fg").trim() || "255, 156, 43";
      const head = cs.getPropertyValue("--matrix-head").trim() || "255, 246, 232";
      const mono = cs.getPropertyValue("--font-mono").trim() || "monospace";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.font = `11px ${mono}`;
      ctx.textBaseline = "top";

      const lvl = levelRef.current;
      const peak = 0.1 + 0.42 * lvl;

      cols.forEach((col, i) => {
        col.y += col.speed * dt * (1 + lvl * 2.2);
        if (col.y - col.len * CELL > cssH) {
          col.y = -Math.random() * 60;
          col.speed = 8 + Math.random() * 26;
          col.len = 4 + Math.floor(Math.random() * 9);
        }
        for (let k = 0; k < col.len; k++) {
          const gy = Math.floor((col.y - k * CELL) / CELL) * CELL;
          if (gy < -CELL || gy > cssH) continue;
          if (!col.glyphs[k] || Math.random() < 0.02) {
            col.glyphs[k] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
          /* The leading glyph is near-white and the tail falls off behind it.
             Without that head the field is a uniform wash of dim characters,
             legible as noise and not as movement — the head is the only part
             that says which way the column is going. */
          const fade = 1 - k / col.len;
          ctx.fillStyle =
            k === 0
              ? `rgba(${head}, ${(0.3 + 0.55 * lvl).toFixed(3)})`
              : `rgba(${hue}, ${(peak * fade * fade).toFixed(3)})`;
          ctx.fillText(col.glyphs[k], i * CELL, gy);
        }
      });
    };

    if (prefersReducedMotion()) {
      /* One frame, then nothing. The field exists as texture and never moves. */
      requestAnimationFrame(() => draw(0.016));
      return;
    }

    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className={`ws-matrix ${className ?? ""}`} aria-hidden="true" />;
}
