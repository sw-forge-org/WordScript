/* THE PILL

   Not a screenshot. The app's own surface rebuilt as live DOM against the
   geometry in src/styles/overlay-pill.css, driven by the same levelToBars
   curve the runtime uses. Everything it does here, it does there. If the
   shipped pill moves, this moves with it.

   THE STATE NAMES ARE THE RUNTIME'S OWN, and that is load-bearing rather than
   tidy. The union is OverlayPillState in src/components/overlay/OverlayPill.tsx:
   recording, processing, result-actions, edit-mode, mode-picker, error. Six
   states, and `preview` is not among them -- a staged preview is a FIELD on
   processing, which is why it is an option here and not a state.

   The distinction is the whole point of ADR 0011a: each delivery mode has
   exactly one decision surface. `auto_paste` delivers and then shows
   result-actions (Copy / Edit / Dismiss). `clipboard_only` stops on a real
   processing preview (Copy / Edit / Abort) and closes on the commit, with no
   result surface at all. A sequence that shows a preview AND a result surface
   describes neither mode, and it was what this file used to draw.

   The capsule is the one capsule on this site: the radius ladder says a
   capsule survives only where the object is physically a capsule, and this
   object is. */
import { $, $$ } from './dom';

// verbatim from src/components/overlay/OverlayPill.tsx
export const BAR_COUNT = 11;
export const MIN_BAR = 5;
export const MAX_BAR = 30;
export const IDLE_BARS = [5, 7, 9, 12, 15, 17, 15, 12, 9, 7, 5];

export function levelToBars(level: number): number[] {
  const c = Math.min(1, Math.max(0, level));
  if (c < 0.018) return IDLE_BARS.slice();
  const gain = Math.min(1, c * 2.9);
  const center = (BAR_COUNT - 1) / 2;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const distance = Math.abs(i - center) / center;
    const falloff = 1 - distance * 0.42;
    const wobble = 1 - Math.abs(((i * 1.7) % 5) - 2) / 6;
    const energy = Math.min(1, gain * falloff * wobble * 1.25);
    return Math.round(MIN_BAR + (MAX_BAR - MIN_BAR) * energy);
  });
}

// Speech is syllables inside words inside breaths. Three sines, three rates.
export const speechLevel = (t: number) => {
  const syl = 0.5 + 0.5 * Math.sin(t * 9.2);
  const word = 0.5 + 0.5 * Math.sin(t * 2.6 + 1.1);
  const jit = 0.5 + 0.5 * Math.sin(t * 23.7 + 0.4);
  return Math.max(0, Math.min(1, 0.30 + 0.46 * syl * word + 0.13 * jit));
};

export const mm = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;

const svg = (d: string, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"
    stroke-linecap="round" stroke-linejoin="round" class="${extra}" aria-hidden="true">${d}</svg>`;

export const ICON = {
  mic:    svg('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>'),
  load:   svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', 'pill__spin'),
  clip:   svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
  pencil: svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  stop:   svg('<rect x="3" y="3" width="18" height="18" rx="2"/>'),
  enter:  svg('<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/>'),
  up:     svg('<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>'),
  link:   svg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  check:  svg('<path d="m4 12 5 5L20 6"/>'),
  x:      svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  alert:  svg('<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>'),
};

const bars = () => `<div class="pill__bars" aria-label="Audio level">${
  IDLE_BARS.map(h => `<span class="bar" style="height:${h}px"></span>`).join('')}</div>`;
const mic = () => `<span class="pill__mic">${ICON.mic}</span>`;
const div = () => `<span class="pill__divider" aria-hidden="true"></span>`;
/* THE MODE CHIP IS A BUTTON IN THE APP, so it is a button here.
   aria-label and title are the shipped ones, because "tap to cycle" is how the
   overlay answers the question this page's readers keep asking: where do you
   press to change the mode. */
const mode_ = (label: string, lang?: string) =>
  `<button type="button" class="pill__mode" data-cycle=""
     aria-label="Mode ${label}, tap to cycle" title="Mode: ${label}, tap to cycle"
   ><span class="pill__mode-dot"></span><span class="pill__mode-label">${label}</span></button>` +
  (lang
    ? `<button type="button" class="pill__lang" data-cycle-lang=""
         aria-label="Target language ${lang.toUpperCase()}, tap to cycle"
         title="Target language: ${lang.toUpperCase()}"
       >${lang.toUpperCase()}</button>`
    : '');
const time = (s: number) => `<span class="pill__timer">${mm(s)}</span>`;
const act = (icon: string, label: string, primary?: boolean) =>
  `<span class="pill__act${primary ? ' pill__act--primary' : ''}" role="img" aria-label="${label}">${icon}</span>`;

/** The runtime's own union, minus `edit-mode`, which this page has no scene
 *  for yet. Adding one means adding it here, not inventing a name for it. */
export type PillState =
  | 'recording' | 'processing' | 'result-actions' | 'mode-picker' | 'error';

export type PillOpts = {
  mode?: string;
  /** ISO 639-1, and only meaningful while the mode is Translate. */
  lang?: string;
  seconds?: number;
  /** processing: the staged preview text. Its presence is what turns the
   *  compact processing pill into the decision surface, exactly as the
   *  `preview` field does on the runtime's processing state. */
  preview?: string;
  /** result-actions: the delivered text. */
  text?: string;
  /** Which delivery path this surface belongs to. It decides the primary
   *  action's icon and label: Copy for clipboard_only, Insert for auto_paste. */
  clipboardOnly?: boolean;
  /** error only. */
  message?: string;
};

export interface Pill {
  readonly kind: PillState | null;
  set(next: PillState, o?: PillOpts): Pill;
  /** Bind the mode chip. Sticky rather than per-call: every `set` repaints the
   *  capsule from scratch, so a handler passed once would survive exactly one
   *  state change and then silently stop working. */
  onCycle(fn: () => void): Pill;
  tab(html: string, hold?: number, label?: string): Pill;
  /** The words one dictation taught, in the order the runtime learned them. */
  learn(...words: string[]): Pill;
  run(on: boolean, idle?: boolean): Pill;
  stop(): Pill;
  clear(): Pill;
}

/** One live capsule bound to a host element. */
export function mountPill(host: HTMLElement | null, reduced: boolean): Pill | null {
  if (!host) return null;
  let raf = 0, t0 = 0, base = 0, running = false;
  let kind: PillState | null = null;
  let cycle: (() => void) | null = null;

  /* DELEGATED, AND INSTALLED EXACTLY ONCE. `set` repaints the capsule from
     scratch, so a listener bound to the chip element dies with it; re-binding
     per paint stacks duplicates instead, because each arm passes a fresh
     closure. The host outlives every state, so the listener lives there. */
  host.addEventListener('click', (e) => {
    if (cycle && (e.target as HTMLElement).closest('[data-cycle]')) cycle();
  });

  const paint = (html: string, cls: string) => {
    host.innerHTML = `<div class="pill ${cls}">${html}</div>`;
  };

  const api: Pill = {
    get kind() { return kind; },

    /** One of the runtime's own states. See the file header for why `preview`
     *  is an option on processing rather than a state beside it. */
    set(next, o = {}) {
      kind = next;
      const label = o.mode || 'Cleanup';
      const sec = o.seconds ?? 0;
      const clip = o.clipboardOnly ?? false;
      base = sec;

      if (next === 'recording') {
        paint(mic() + bars() + div() + mode_(label, o.lang) + div() + time(sec),
              'pill--compact pill--recording');
        api.run(true);

      } else if (next === 'processing' && o.preview !== undefined) {
        /* THE DECISION SURFACE OF clipboard_only, and of nothing else.
           The primary action is Copy, because the text has not been delivered
           and this mode's commit puts it on the clipboard. Abort is here and
           not on the result surface because this is the last moment at which
           there is still something to abort. */
        paint(mic()
              + `<span class="pill__text pill__text--pre">${o.preview}</span>`
              + `<span class="pill__group">`
              + act(clip ? ICON.clip : ICON.enter, clip ? 'Copy' : 'Insert', true)
              + act(ICON.pencil, 'Edit') + act(ICON.stop, 'Abort')
              + `</span>`
              + div() + time(sec) + div()
              + `<span class="pill__act" role="img" aria-label="Working">${ICON.load}</span>`,
              'pill--preview-actions pill--processing');
        api.run(true, true);

      } else if (next === 'processing') {
        paint(mic() + bars() + div() + mode_(label, o.lang) + div() + time(sec) + div()
              + `<span class="pill__act" role="img" aria-label="Working">${ICON.load}</span>`,
              'pill--compact pill--processing');
        api.run(true, true);

      } else if (next === 'result-actions') {
        /* THE DECISION SURFACE OF auto_paste. The text is already at the
           cursor and cannot be retracted, so there is no Abort: Copy takes a
           second copy, Edit can only offer a correction, Dismiss closes.
           Insert appears only when the paste fell back to the clipboard. */
        paint(`<span class="pill__text">${o.text || ''}</span>`
              + `<span class="pill__group">${act(ICON.clip, 'Copy')}${act(ICON.pencil, 'Edit')}`
              + (clip ? act(ICON.enter, 'Insert', true) : '')
              + `</span>`
              + `<span class="pill__act" role="img" aria-label="Dismiss">${ICON.x}</span>`,
              'pill--result-actions' + (clip ? ' pill--clipboard' : ''));
        api.run(false);

      } else if (next === 'mode-picker') {
        /* Alt+S. Idle bars, no timer, no mic: nothing is being captured, the
           overlay is only asking which mode the next capture runs in. */
        paint(bars() + div() + mode_(label, o.lang), 'pill--compact pill--mode-picker');
        api.run(false);

      } else if (next === 'error') {
        paint(`<span class="pill__act pill__act--bad" role="img" aria-label="Error">${ICON.alert}</span>`
              + `<span class="pill__text">${o.message || ''}</span>`,
              'pill--error');
        api.run(false);
      }

      return api;
    },

    onCycle(fn) { cycle = fn; return api; },

    /** A shutter widening out of the pill's left edge. The runtime grows two
        of these: the learned word (ADR 0035) and, in agent delivery, the
        target that is waiting. Width is animated rather than transform,
        which is load-bearing against a WebKitGTK compositor bug. */
    tab(html, hold = 3660, label?: string) {
      const pill = $('.pill', host);
      if (!pill || reduced) return api;
      const el = document.createElement('span');
      el.className = 'pill__learn';
      /* The shutter paints nothing and spans dead space beside the pill, so it
         never takes the pointer. Only a tab that is actually open is announced;
         at width 0 a screen reader saying it is there is the audible version of
         drawing something that is not on screen. */
      if (label) {
        el.setAttribute('role', 'status');
        el.setAttribute('title', label);
        el.setAttribute('aria-label', label);
      } else {
        el.setAttribute('aria-hidden', 'true');
      }
      el.innerHTML = `<span class="pill__learn-in">${html}</span>`;
      pill.appendChild(el);
      requestAnimationFrame(() => {
        const inner = $('.pill__learn-in', el);
        if (!inner) return;
        el.style.setProperty('--w', `${inner.offsetWidth}px`);
        el.classList.add('is-on');
      });
      setTimeout(() => el.classList.remove('is-on'), hold);
      setTimeout(() => el.remove(), hold + 500);
      return api;
    },

    /* WHAT THE SHIPPED TAB SAYS, AND IT IS THE WORD ALONE.
       `activeNudge` in src/windows/OverlayWindow.tsx builds two strings from
       the words the runtime just learned: the TEXT is `word` on its own, or
       `word +N` when a dictation taught more than one, and the LABEL is
       `Learned: a, b` and lives in the title and the aria-label. The visible
       tab is a dot and a term. It has never carried the verb.

       The page drew `learned <b>word</b>` instead, which is two errors in one
       object: it printed a word the surface does not print, and it split the
       tab into a muted half and an accent half where the shipped one is a
       single accent dot beside one line of plain text. The capsule is the app's
       own surface and this is the part of it a reader is most likely to see in
       a screenshot, so it is also the part least able to afford a difference.

       The hold is the runtime's own 4 s (LEARNED_NUDGE_DURATION_MS, raised
       from 1.9 s on 2026-08-16): 3660 ms plus the shutter's two ~170 ms ramps
       is the same time on screen, spent the same way. */
    learn(...words) {
      if (!words.length) return api;
      const text = words.length > 1 ? `${words[0]} +${words.length - 1}` : words[0];
      return api.tab(
        `<span class="pill__learn-dot" aria-hidden="true"></span><span class="pill__learn-label">${text}</span>`,
        3660,
        `Learned: ${words.join(', ')}`,
      );
    },

    /** Drive bars + timer. `idle` keeps the timer moving but the bars flat. */
    run(on, idle) {
      cancelAnimationFrame(raf);
      running = on && !reduced;
      if (!running) return api;
      t0 = performance.now();
      const barEls = $$('.bar', host);
      const timer = $('.pill__timer', host);
      const step = (now: number) => {
        if (!running) return;
        const t = (now - t0) / 1000;
        if (timer) timer.textContent = mm(base + t);
        if (!idle && barEls.length) {
          const hs = levelToBars(speechLevel(t));
          for (let i = 0; i < barEls.length; i++) barEls[i].style.height = `${hs[i]}px`;
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return api;
    },

    stop() { running = false; cancelAnimationFrame(raf); return api; },
    clear() { api.stop(); host.innerHTML = ''; kind = null; return api; },
  };
  return api;
}

/* THE QUANTISED LEVEL MATRIX
   The meeting window and the desk's answer strip both draw one, and for the
   same reason: in 70 px a waveform is a texture and a matrix is still a meter.
   A still one on a surface that claims to be listening is a fake state, so
   this one moves or it is not drawn. */
export interface Matrix { run(): Matrix; stop(): Matrix }

export function mountMatrix(
  host: HTMLElement | null,
  cols = 16,
  rows = 7,
  reduced = false,
): Matrix | null {
  if (!host) return null;
  host.innerHTML = Array.from({ length: cols }, () =>
    `<span class="mx__c">${'<i></i>'.repeat(rows)}</span>`).join('');
  const cells = $$('.mx__c', host);
  let raf = 0, t0 = 0, on = false, last = 0;
  const api: Matrix = {
    run() {
      cancelAnimationFrame(raf);
      if (reduced) { cells.forEach((c, i) => { c.dataset.l = String(2 + (i % 3)); }); return api; }
      on = true; t0 = performance.now();
      const step = (now: number) => {
        if (!on) return;
        if (now - last > 55) {
          last = now;
          const t = (now - t0) / 1000;
          for (let i = 0; i < cells.length; i++) {
            const v = speechLevel(t - i * 0.045);
            cells[i].dataset.l = String(Math.max(1, Math.round(v * rows)));
          }
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return api;
    },
    stop() { on = false; cancelAnimationFrame(raf); return api; },
  };
  return api;
}
