/* THE DEMO

   Three tabs and, inside two of them, a second axis: the seven processing
   modes of the mode contract, and the three intakes of Context.

   The tabs, the strips and every static frame are rendered by the server, so
   the section is readable and navigable in markup before hydration. What the
   effect owns is the three sequences, which write into the surfaces through
   refs. Those sequences are step lists with cancellation, not derived state,
   so React holds the frame and the scene modules drive it.

   The window is the only thing in this section with an edge. The tabs stand on
   the ground as separate cards, and the replay footer sits outside the window
   because it is a control for the demo rather than part of the surface being
   demonstrated.

   THE MODE IS CHANGED ON THE CAPSULE, WHICH IS WHERE THE PRODUCT CHANGES IT.

   This panel used to carry a strip of seven buttons above the window, and that
   strip was the single largest thing in the section: seven controls, each with
   a name and a key, sitting over a surface that already has a mode control on
   it. The chip on the capsule is a button in `OverlayPill.tsx` with the title
   "tap to cycle"; drawing a second, larger, differently shaped mode control
   beside it taught a gesture the app does not have and buried the one it does.

   So the strip is gone and the chip does the work. What replaces it is one
   line naming the mode, its direct key and the count, which is the same
   information the strip carried at a seventh of the height. The three ways in
   are then all on the page and all in the app's own terms: the direct key, the
   picker on its own key, and the chip.

   THE CAPSULE PARKS AFTER EVERY ENDING, for the reason ADR 0252 gives about
   the hero: the result surface carries no chip, so a sequence that stopped on
   it would leave the reader with the mode control off screen. */
import { useEffect, useRef, useState } from 'react';
import { prefersReduced } from '../lib/dom';
import { runner, type Runner } from '../lib/runner';
import { KEYS, MODES, makeCursor, type Delivery } from '../lib/scenes/cursor';
import { INTAKES, makeContext } from '../lib/scenes/context';
import { makeAgent } from '../lib/scenes/agent';

const TABS = [
  { n: '01', t: 'Cursor',  s: 'seven modes, one hotkey' },
  { n: '02', t: 'Context', s: 'three ways in, one folder' },
  { n: '03', t: 'Agent',   s: 'one process, asking out loud' },
];

/* The two paths, named as the config names them. `insert_behavior` is the
   stored field, so the page uses its two values rather than a friendlier pair
   invented here -- a reader who goes looking for this setting finds the same
   two words.

   Only the selected one's sentence is drawn now. Two sentences side by side is
   a comparison the reader has to hold in their head; one sentence that changes
   under a two-state control is the same comparison performed. */
const DELIVERIES: { id: Delivery; what: string }[] = [
  { id: 'auto_paste',     what: 'lands at the cursor, then the surface asks what else' },
  { id: 'clipboard_only', what: 'stops and asks first, then goes to the clipboard' },
];

/** The cycle the chip walks, in the order the app's own mode list has them:
 *  the six concrete modes, then Auto, which is the decision about which of the
 *  six runs rather than a seventh way of writing. */
const MODE_IDS = MODES.filter(m => m.id).map(m => m.id!);

const FOOT = [
  "Constructed example. The capsule is the app's own surface.",
  'Constructed example. Three intakes, one directory, and it is yours.',
  'Constructed example. One orchestrator, and it is the only party WordScript talks to.',
];

/** Roving arrow keys, shared by the tab row and both strips. */
const arrows = (len: number, i: number, e: React.KeyboardEvent, go: (n: number) => void) => {
  const k = e.key;
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(k)) return;
  e.preventDefault();
  const last = len - 1;
  go(k === 'Home' ? 0 : k === 'End' ? last
     : k === 'ArrowRight' ? (i === last ? 0 : i + 1)
     : (i === 0 ? last : i - 1));
};

export default function Demo() {
  const root = useRef<HTMLDivElement>(null);
  const stepEl = useRef<HTMLSpanElement>(null);
  const tabEls = useRef<(HTMLButtonElement | null)[]>([]);
  const stripEls = useRef<Record<string, HTMLButtonElement | null>>({});

  const [tab, setTab] = useState(0);
  const [mode, setMode] = useState('cleanup');
  const [intake, setIntake] = useState('write');
  const [delivery, setDelivery] = useState<Delivery>('auto_paste');
  const [seen, setSeen] = useState(false);
  const [nonce, setNonce] = useState(0);

  /* The chip handler is bound once, on a host that outlives every repaint of
     the capsule, so it cannot close over the mode that was current when it was
     bound. A ref is the whole fix and it is smaller than re-binding. */
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /* The scenes are built once against the server-rendered frame and then
     re-driven; rebuilding them per render would re-mount three capsules on
     every keystroke of the mode strip. */
  const scenes = useRef<{
    run: Runner;
    cursor: ReturnType<typeof makeCursor>;
    context: ReturnType<typeof makeContext>;
    agent: ReturnType<typeof makeAgent>;
    stopAll: () => void;
  } | null>(null);

  useEffect(() => {
    const reduced = prefersReduced();
    const r = root.current!;
    const say = (s: string) => { if (stepEl.current) stepEl.current.textContent = s; };
    const run = runner(reduced);
    const cursor = makeCursor(r, reduced, say);
    const context = makeContext(r, reduced, say);
    const agent = makeAgent(r, reduced, say);

    /* THE ONE CONTROL ON THE SURFACE ITSELF. `tap to cycle` is the chip's own
       shipped title, so pressing it here has to do what it says there: the
       next mode, in the app's order, wrapping at the end. */
    cursor.pill?.onCycle(() => {
      const i = MODE_IDS.indexOf(modeRef.current);
      setMode(MODE_IDS[(i + 1) % MODE_IDS.length]);
    });

    const stopAll = () => {
      run.clear();
      cursor.pill?.clear();
      agent.pill?.clear();
      context.stop();
      agent.stop();
    };

    scenes.current = { run, cursor, context, agent, stopAll };
    return () => { stopAll(); scenes.current = null; };
  }, []);

  /* No sequence plays into an empty room, so nothing runs until the stage has
     been seen once. This is state rather than a ref because the driving effect
     below has to re-run when it flips. */
  useEffect(() => {
    if (seen) return;
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }), { threshold: 0.25 });
    io.observe(root.current!.querySelector('.demo__stage')!);
    return () => io.disconnect();
  }, [seen]);

  /* One effect drives the visible scene. Its dependency list is the whole
     selection state, so a tab change, a mode change and a replay all take the
     same path: stop everything, clear the step readout, play the one scene the
     selection names. */
  useEffect(() => {
    const s = scenes.current;
    if (!s || !seen) return;
    s.stopAll();
    if (stepEl.current) stepEl.current.textContent = '';
    if (tab === 0) s.cursor.play(s.run, mode, delivery);
    else if (tab === 1) s.context.play(s.run, intake);
    else s.agent.play(s.run);
  }, [seen, tab, mode, intake, delivery, nonce]);

  const pickTab = (n: number, focus: boolean) => {
    setTab(n);
    if (focus) tabEls.current[n]?.focus();
  };

  const currentMode = MODES.find(m => m.id === mode)!;
  const cycleMode = () => {
    const i = MODE_IDS.indexOf(mode);
    setMode(MODE_IDS[(i + 1) % MODE_IDS.length]);
  };

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
    <div className="demo rise" data-d="1" ref={root} suppressHydrationWarning>
      <div className="demo__tabs" role="tablist" aria-label="What a dictation becomes">
        {TABS.map((t, i) => (
          <button
            key={t.t}
            className="demo__tab"
            role="tab"
            id={`tab-${i + 1}`}
            aria-controls={`p${i + 1}`}
            aria-selected={tab === i}
            ref={(el) => { tabEls.current[i] = el; return () => { tabEls.current[i] = null; }; }}
            onClick={() => pickTab(i, false)}
            onKeyDown={(e) => arrows(TABS.length, i, e, (n) => pickTab(n, true))}
          >
            <span className="demo__tab-n mono">{t.n}</span>
            <span className="demo__tab-t">{t.t}</span>
            <span className="demo__tab-s">{t.s}</span>
          </button>
        ))}
      </div>

      <div className="demo__stage">
        {/* THE BAR SAYS HOW YOU GET IN AND WHAT IS HAPPENING. It used to say
            "WordScript", which made it read as a window title bar wrapped
            around a panel that already contains a window -- two chromes for
            one surface. The legend on the left is the answer to the question
            the mode strip raises, at the top where the question is asked. */}
        <div className="demo__bar mono">
          <span className="demo__keys">
            <b>{KEYS.capture}</b> hold to talk
            <i aria-hidden="true"></i>
            <b>{KEYS.picker}</b> mode picker
            <i aria-hidden="true"></i>
            <b>{KEYS.abort}</b> abort
          </span>
          <span className="step" data-step="" aria-live="polite" ref={stepEl}></span>
        </div>

        {/* 1: cursor */}
        <div className="panel" id="p1" role="tabpanel" aria-labelledby="tab-1" data-on={tab === 0 ? '1' : '0'}>
          <p className="panel__lead"><b>The cursor.</b> Hold the hotkey and speak. The mode decides
            <b> which</b> text lands, and the mode is the only thing the transform stage reads.</p>

          <div className="d1">
            {/* THE CAPSULE FLOATS OVER THE WINDOW, because that is the only
                place it is ever seen. Beside the window it is a stray object
                on the page's ground and the reader has to be told what it is;
                over the window it explains itself. */}
            <div className="d1__win">
              <div className="slab">
                <div className="slab__k mono" data-scene-win="">Your window</div>
                <div className="field" data-field=""><span className="caret"></span></div>
              </div>
              <div className="d1__float"><div className="ov" data-cap-pill=""></div></div>
            </div>

            {/* THE CONTROL ROW. The mode is read here and changed on the
                capsule; the delivery is changed here because one profile has
                one of these and there is nowhere on the overlay that it lives
                (ADR 0011a). Two controls, one row, and the sentence under it
                belongs to whichever of the two is selected. */}
            <div className="d1__ctl">
              {/* THE SAME ACTION AS THE CHIP, IN A PLACE THAT IS ALWAYS THERE.
                  The chip is drawn only on the compact states, and under
                  reduced motion the panel settles on an ending that has none --
                  so a reader on that setting, or on a keyboard, would have had
                  no way to change the mode at all once the strip went. One line
                  rather than seven buttons, and it says what it does. */}
              <button type="button" className="d1__mode" onClick={cycleMode}>
                <b>{currentMode.label}</b>
                <span className="d1__key mono">{currentMode.key}</span>
                <span className="d1__hint">next of {MODE_IDS.length}, here or on the capsule's chip</span>
              </button>

              <div className="seg" role="radiogroup" aria-label="Delivery mode">
                {DELIVERIES.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    className="seg__b mono"
                    role="radio"
                    aria-checked={delivery === d.id}
                    onClick={() => setDelivery(d.id)}
                  >{d.id}</button>
                ))}
              </div>
            </div>

            <p className="d1__what">
              {DELIVERIES.find(d => d.id === delivery)!.what}
              <span className="d1__clip" data-clip-note=""></span>
            </p>

            <div className="d1__rules">
              <div className="slab__k mono" data-rules-k="">What it changed</div>
              <div className="rules" data-rules=""></div>
            </div>
            <p className="slab__note slab__note--wide" data-scene-note=""></p>
          </div>
        </div>

        {/* 2: context */}
        <div className="panel" id="p2" role="tabpanel" aria-labelledby="tab-2" data-on={tab === 1 ? '1' : '0'}>
          <p className="panel__lead"><b>Context.</b> A dictation, a meeting, an uploaded file and a
            pasted link are the same kind of record, and they accumulate in a directory you own.</p>

          <div className="strip" role="tablist" aria-label="How a record arrives">
            {INTAKES.map((x, i) => (
              <button
                key={x.id}
                className="strip__b"
                role="tab"
                aria-selected={intake === x.id}
                ref={(el) => { stripEls.current[`i:${x.id}`] = el; return () => { stripEls.current[`i:${x.id}`] = null; }; }}
                onClick={() => setIntake(x.id)}
                onKeyDown={(e) => arrows(INTAKES.length, i, e, (n) => {
                  setIntake(INTAKES[n].id);
                  stripEls.current[`i:${INTAKES[n].id}`]?.focus();
                })}
              >{x.label}</button>
            ))}
          </div>

          <div className="d2">
            <div className="d2__l" data-intake=""></div>
            <div className="d2__r">
              <div className="slab">
                <div className="slab__k mono">On your disk</div>
                <div className="disk" data-disk=""></div>
                <p className="slab__note">Plain files, in a directory you named. Your editor, your
                  grep and your agent already know how to open them.</p>
              </div>
              <p className="d2__cap mono" data-ctx-cap=""></p>
            </div>
          </div>
        </div>

        {/* 3: agent */}
        <div className="panel" id="p3" role="tabpanel" aria-labelledby="tab-3" data-on={tab === 2 ? '1' : '0'}>
          <p className="panel__lead"><b>The agent.</b> One orchestrator drives your coding agents and
            WordScript talks to nobody else. When it cannot decide, it asks you out loud and waits.</p>

          <div className="d3">
            <div className="desk">
              <div className="desk__rail">
                <div className="desk__head">
                  <span className="orb" data-orb="" aria-hidden="true"></span>
                  <b>the desk</b>
                  <span className="desk__sub">one process, speaking for all three</span>
                </div>
                <div className="desk__k mono">Working on</div>
                <div className="desk__targets" data-targets=""></div>
              </div>
              <div className="desk__main">
                <div className="desk__mh mono"><b>WordScript</b><span>work, thread since 09:12</span></div>
                <div className="thread" data-thread=""></div>
                <div className="answer" data-answer=""></div>
              </div>
            </div>
            <div className="d3__r">
              <div className="slab">
                <div className="slab__k mono">A run, headless</div>
                <div className="term" data-term=""></div>
              </div>
              <div className="d1__cap"><div className="ov" data-agent-pill=""></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="demo__foot mono">
        <button className="btn btn--ghost" onClick={() => setNonce(n => n + 1)}>Replay</button>
        <span>{FOOT[tab]}</span>
      </div>
    </div>
  );
}
