/* SMOOTH SCROLL, AND THE THREE THINGS IT MUST NOT BREAK.

   Lenis alone, without GSAP. The motion-stack default pairs the two, and the
   pairing exists so that ScrollTrigger reads Lenis' interpolated position
   instead of the browser's -- this page runs no ScrollTrigger. Its reveals are
   one IntersectionObserver in Base.astro and its counters are CSS
   transition-delays, so the second library would ship 70 kB to synchronise
   something that is not there.

   THE REASON IT COMPOSES AT ALL is that Lenis animates the real scroll offset
   rather than transforming a container. `window.scrollY`, IntersectionObserver
   and getBoundingClientRect all keep answering, so the reveal observer, the
   header's is-stuck toggle and the activity field's per-hover panel need no
   knowledge of this file. A transform-based smoother would have broken all
   three at once.

   REDUCED MOTION IS NOT A SETTING HERE, IT IS AN EARLY RETURN. Nothing is
   constructed and no listener is bound, so the page scrolls natively -- which
   is what a reader who asked for less movement is asking for. It is checked
   again on change rather than only at load: the setting is a system toggle and
   the reader may flip it while the page is open. */
import Lenis from 'lenis';

export function armSmoothScroll(): () => void {
  const q = matchMedia('(prefers-reduced-motion: reduce)');
  let lenis: Lenis | null = null;

  const start = () => {
    if (lenis) return;
    lenis = new Lenis({
      /* Lerp rather than duration: a fixed duration makes a short hop and a
         full-page jump take the same time, so the hop feels sluggish and the
         jump feels hurried. Interpolation makes both take the time their
         distance is worth. */
      lerp: 0.11,
      /* THE WHEEL IS SMOOTHED, THE FINGER IS NOT. `syncTouch` re-implements
         momentum that a touch device already does in the compositor, off the
         main thread and better; turning it on trades a native gesture for a
         JavaScript approximation of one. Default is off, and it stays off. */
      smoothWheel: true,
      /* The nav's #how and #numbers, handled by the library rather than by a
         click listener of ours, so a hash typed into the address bar and a
         press on the link take the same path.

         NO `offset` HERE, AND THAT IS THE POINT. Lenis reads the target's own
         `scroll-margin-top`, so `.sec { scroll-margin-top: 76px }` -- the
         number that already keeps a heading out from under the sticky header
         on a native jump -- is the number it uses. Passing the header height a
         second time as an offset applies it twice: measured, the section
         landed 153px down instead of 76px. One clearance, declared in CSS,
         where the no-JavaScript path reads it too. */
      anchors: true,
      autoRaf: true,
    });
  };

  const stop = () => {
    lenis?.destroy();
    lenis = null;
  };

  const sync = () => (q.matches ? stop() : start());
  sync();
  q.addEventListener('change', sync);

  return () => { q.removeEventListener('change', sync); stop(); };
}
