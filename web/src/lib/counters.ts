/* COUNTERS

   A figure that lands already finished is a figure nobody reads. These run to
   their printed value instead, and they borrow their timing from the bar
   beside them: the delay is read off the track's own computed
   transition-delay, so the stylesheet stays the one place that decides the
   order and this never drifts out of step with it.

   Not an island. These animate text that the server already rendered at its
   final value, so there is nothing here to hydrate: the markup is correct with
   the script absent, and the script only makes it arrive. */
import { $$ } from './dom';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function countUp(el: HTMLElement, dur: number, delay: number, reduced: boolean) {
  const target = parseFloat(el.dataset.n ?? '');
  const dec = parseInt(el.dataset.dec || '0', 10);
  if (!isFinite(target)) return;

  let node = el.firstChild;
  if (!node || node.nodeType !== 3) {
    node = el.insertBefore(document.createTextNode(''), el.firstChild);
  }
  if (reduced) { node.nodeValue = target.toFixed(dec); return; }

  node.nodeValue = (0).toFixed(dec);
  const start = () => {
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      node!.nodeValue = (target * easeOut(t)).toFixed(dec);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  delay > 0 ? setTimeout(start, delay) : start();
}

/** Called once a block has been revealed, so the computed delays are the ones
    the .is-in rules set rather than the ones they had before it. */
export function armCounters(root: HTMLElement, reduced: boolean) {
  $$('[data-n]', root).forEach(el => {
    let d = 0;
    if (el.dataset.delay) {
      d = parseFloat(el.dataset.delay);
    } else {
      const bar = el.parentElement && el.parentElement.querySelector('.tp__track i');
      if (bar) d = parseFloat(getComputedStyle(bar).transitionDelay) * 1000;
    }
    countUp(el, 950, isFinite(d) ? d : 0, reduced);
  });
}
