/* THE ASCII BAND
   The signal, sampled and printed. The machine has no curve, only glyphs.

   The number of glyph rows is fixed at seven, so the server prints seven blank
   rows and the box has its final height before any script runs. Without that
   the strip is one line tall until the island hydrates and the page grows 58 px
   under the reader's scroll: the frame needs the viewport width to compute, but
   the height it will occupy does not.

   It is drawn on mount and only ticks while it is on screen. The band is about
   2.9 times the viewport wide on purpose and clips against body overflow-x. */
import { useEffect, useRef } from 'react';
import { prefersReduced } from '../lib/dom';

const RAMP = [' ', '.', ':', ';', '!', '|', '#'];
const ROWS = 7;
const MID = (ROWS - 1) / 2;

function bandFrame(cols: number, phase: number) {
  const out: string[][] = Array.from({ length: ROWS }, () => []);
  for (let x = 0; x < cols; x++) {
    const u = x / cols;
    const a = Math.abs(
      0.42 * Math.sin(u * 21 + phase) +
      0.30 * Math.sin(u * 47 - phase * 1.7) +
      0.22 * Math.sin(u * 8.5 + phase * 0.6) +
      0.14 * Math.sin(u * 103 + phase * 2.9)
    ) * (0.42 + 0.58 * Math.sin(u * Math.PI));
    const half = a * MID * 1.35;
    for (let r = 0; r < ROWS; r++) {
      const d = Math.abs(r - MID);
      const depth = half - d;
      out[r].push(depth <= 0 ? RAMP[0] : RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(depth * 2.2))]);
    }
  }
  return out.map(r => r.join('')).join('\n');
}

export default function Band() {
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const band = pre.current!;
    const reduced = prefersReduced();
    let phase = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const cols = () => Math.min(300, Math.max(60, Math.floor(band.clientWidth / 6.2)));
    const draw = () => { band.textContent = bandFrame(cols(), phase); };

    draw();
    addEventListener('resize', draw, { passive: true });

    let io: IntersectionObserver | null = null;
    if (!reduced) {
      io = new IntersectionObserver((es) => es.forEach(e => {
        if (e.isIntersecting && !timer) {
          timer = setInterval(() => { phase += 0.09; draw(); }, 90);
        } else if (!e.isIntersecting && timer) {
          clearInterval(timer); timer = null;
        }
      }), { threshold: 0 });
      io.observe(band);
    }

    return () => {
      removeEventListener('resize', draw);
      io?.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <div className="band" aria-hidden="true">
      <pre ref={pre}>{Array.from({ length: ROWS }, () => ' ').join('\n')}</pre>
    </div>
  );
}
