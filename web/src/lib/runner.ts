/* A CANCELLABLE STEP RUNNER

   Every scene on this page is a list of [delay, effect]. Under reduced motion
   the delays collapse to zero, which is what lets one description of a scene
   serve both the animated and the settled reading of it.

   clear() is the whole reason it exists: a tab switch, a mode switch or an
   unmounting island has to be able to stop a sequence mid-flight, or two
   scenes write into the same surface. */
export interface Runner {
  clear(): void;
  play(steps: [number, () => void][]): void;
}

export function runner(reduced: boolean): Runner {
  let timers: ReturnType<typeof setTimeout>[] = [];
  return {
    clear() { timers.forEach(clearTimeout); timers = []; },
    play(steps) {
      this.clear();
      let t = 0;
      steps.forEach(([d, fn]) => {
        t += reduced ? 0 : d;
        timers.push(setTimeout(fn, t));
      });
    },
  };
}

/* TYPING
   A raw transcript is a list of [text, isFiller]. The filler spans carry their
   own colour, so the mode that removes them and the mode that keeps them are
   telling the same story about the same words. */
export type Raw = [string, 0 | 1][];

export const lenOf = (raw: Raw) => raw.reduce((a, [t]) => a + t.length, 0);

export const rawHTML = (raw: Raw, n: number) => {
  let out = '', seen = 0;
  for (const [text, isFill] of raw) {
    if (seen >= n) break;
    out += `<span class="${isFill ? 'fill' : 'raw'}">${text.slice(0, n - seen)}</span>`;
    seen += text.length;
  }
  return out;
};

export const rawFull = (raw: Raw) => rawHTML(raw, lenOf(raw));
