/* The product, running.

   Not a screenshot: the same capsule the app draws, floating over the window
   the way it floats over your apps. The island renders its own markup, so the
   window, the chrome and the three facts are in the served HTML and are
   correct before a byte of JS arrives.

   IT RUNS BY ITSELF, AND THAT IS A REVERSAL OF ADR 0252 SECTION 3.

   That decision said a surface which invites a press has to answer one, and it
   built hold-to-talk: the reader held a pointer or the space bar and the
   transcript arrived at the speed they held. The argument was sound and the
   object was not. Holding is the one gesture a page cannot ask for cheaply --
   it fights text selection, it fights scrolling, it has no equivalent on a
   touch screen, and it fails in a way the reader reads as the page breaking
   rather than as the demonstration working: a press under about a quarter of a
   second produced the runtime's `error` state, which is truthful and is also
   the first thing most readers ever saw. A hero that greets a third of its
   traffic with a failure is arguing against itself.

   So the demonstration goes back to being a demonstration. It loops: capture,
   transform, delivery, park, the next mode. Nothing has to be pressed and
   nothing can be got wrong.

   WHAT SURVIVES OF THAT ADR IS THE HALF THAT WAS RIGHT. A surface that invites
   a press still has to answer one, so there is exactly one control and it is
   the control the app itself puts there: the mode chip on the capsule, which
   is a button in `OverlayPill.tsx` with a "tap to cycle" title. Pressing it
   jumps to the next mode and starts that mode's pass. One affordance, on the
   object it belongs to, doing what it does in the product.

   AND IT IS NOT ANNOUNCED IN PROSE UNDER THE WINDOW. A caption sat there
   naming the chip and, while the capture ran, spelling the capture hotkey out
   as a sentence. It failed twice over. It was set thirty pixels under a
   capsule that hangs twenty below the window's edge, so the line the reader
   was meant to read was the line the product was standing on; and the keys are
   taught two sections down, on keycaps, where a reader who wants them is
   looking for them. What is left is what the app itself carries: the chip's
   own `title` and `aria-label`, which say "tap to cycle" in the product and
   now say it here.

   The sequence is the auto_paste path from ADR 0011a and nothing else:
   recording, processing, the text at the cursor, then the result surface. The
   preview surface belongs to clipboard_only and is demonstrated where the two
   can be compared, which is the demo section, not here. */
import { useEffect, useRef } from 'react';
import { prefersReduced } from '../lib/dom';
import { mountPill } from '../lib/pill';
import { lenOf, rawFull, rawHTML, runner } from '../lib/runner';
import { MODES, SCENES, modeLabel, type TextScene } from '../lib/scenes/cursor';

/** The modes the hero cycles through. Auto is not among them: it decides which
 *  of the others runs, and a hero that opens on the router is explaining the
 *  exception before it has shown the rule. */
const CYCLE = MODES.filter(m => !m.rule && m.id !== 'auto') as Extract<typeof MODES[number], { id: string }>[];

export default function HeroStage() {
  const stage = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLSpanElement>(null);
  const title = useRef<HTMLSpanElement>(null);
  const pillHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = prefersReduced();
    const pill = mountPill(pillHost.current, reduced);
    const run = runner(reduced);
    const f = field.current!;
    const h = hint.current!;
    const w = title.current!;
    const root = stage.current!;

    let modeIx = 0;
    /* A pass that is no longer on screen is a pass nobody is reading, and it
       is still a timer chain and a requestAnimationFrame on the bars. The
       observer below flips this and the loop stops at its next boundary. */
    let onScreen = false;

    const say = (s: string) => { h.textContent = s; };

    /* ---- one pass, for one mode -----------------------------------------
       The park at the end is not decoration. The result surface closes itself
       in the app (autoCloseSec) and the overlay parks into the picker, which
       is where the mode chip is: result-actions carries no chip, here or
       there, so a loop that stopped on it would end by removing the one
       control the reader can press. */
    const pass = () => {
      run.clear();
      const m = CYCLE[modeIx];
      const s = SCENES[m.id] as TextScene;
      const lang = m.id === 'translate' ? 'de' : undefined;
      const n = lenOf(s.raw);
      const delivered = s.keep
        ? `<span class="kept">${rawFull(s.raw)}</span>`
        : `<span class="out">${s.out}</span>`;

      w.textContent = s.win;
      f.innerHTML = '<span class="caret"></span>';
      pill?.set('mode-picker', { mode: modeLabel(m.id), lang });
      say('ready');

      const steps: [number, () => void][] = [
        [900, () => { pill?.set('recording', { mode: modeLabel(m.id), lang }); }],
        [0,   () => say('listening')],
      ];
      /* A long transcript types faster, so every mode's pass takes about the
         same time and the loop keeps one rhythm across six different lengths. */
      const per = Math.max(9, Math.round(2000 / n));
      for (let i = 1; i <= n; i++) {
        steps.push([per, () => { f.innerHTML = rawHTML(s.raw, i) + '<span class="caret"></span>'; }]);
      }
      steps.push(
        [420,  () => { pill?.set('processing', { mode: modeLabel(m.id), seconds: 4, lang }); }],
        [0,    () => say(s.keep ? 'nothing to correct' : 'transforming')],
        [1150, () => { f.innerHTML = delivered; }],
        [0,    () => { pill?.set('result-actions', { text: s.short }); }],
        [0,    () => say('delivered to the focused window')],
      );
      /* THE TAB GETS ITS FOUR SECONDS. The runtime holds it that long
         (LEARNED_NUDGE_DURATION_MS) and the park has to wait for it, or the
         page draws a retraction the app never draws. */
      if (s.learn) {
        steps.push([700, () => { pill?.learn(s.learn!); }]);
        steps.push([4300, next]);
      } else {
        steps.push([2700, next]);
      }
      run.play(steps);
    };

    function next() {
      modeIx = (modeIx + 1) % CYCLE.length;
      if (onScreen) pass();
    }

    /* Bound once. The pill re-attaches it to whatever chip the current state
       draws, so arming it per state would only stack duplicates. */
    pill?.onCycle(() => { modeIx = (modeIx + 1) % CYCLE.length; pass(); });

    /* ---- the settled reading -------------------------------------------
       No loop and no invitation: one delivered dictation, held. */
    if (reduced) {
      const s = SCENES.cleanup as TextScene;
      w.textContent = s.win;
      f.innerHTML = `<span class="out">${s.out}</span>`;
      pill?.set('result-actions', { text: s.short });
      say('delivered to the focused window');
      return () => { run.clear(); pill?.stop(); };
    }

    // The sequence does not play into an empty room, and it stops when the
    // room empties again.
    const io = new IntersectionObserver((es) => es.forEach(e => {
      onScreen = e.isIntersecting;
      if (onScreen) pass();
      else { run.clear(); pill?.stop(); }
    }), { threshold: 0.25 });
    io.observe(root);

    return () => { io.disconnect(); run.clear(); pill?.stop(); };
  }, []);

  /* `is-in` BELONGS TO THE PAGE SCRIPT, NOT TO REACT. Every `.rise` on the
     page is revealed by one observer in Base.astro, which adds the class
     imperatively; this island is `client:visible`, so by the time React
     hydrates the root below, the class is already on the served DOM and is
     not in this JSX. React reports that as a mismatch and then leaves the
     server's value alone, which is the right outcome and the wrong noise --
     `suppressHydrationWarning` says the difference is intended. The className
     is a literal that never changes, so React writes it once, at hydration,
     and the reveal survives. */
  return (
    <div className="stage rise" data-d="2" ref={stage} suppressHydrationWarning>
      <div className="stage__win">
        <div className="stage__chrome">
          <span className="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span className="t" ref={title}>whatever window has focus</span>
          <span className="stage__hint" ref={hint}></span>
        </div>
        <div className="stage__body" ref={field}><span className="caret"></span></div>
        <div className="stage__float"><div className="ov" ref={pillHost}></div></div>
      </div>
    </div>
  );
}
