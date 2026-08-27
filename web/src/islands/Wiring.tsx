/* THE WIRING DIAGRAM

   ADR 0046 is a claim about wiring, so it is drawn as wiring. The two states
   differ in one quantity a reader can count, and the count line prints that
   quantity so they do not have to.

   The two captions are one sentence each, deliberately. Whatever the picture
   already says, the text must not say again: the drawing carries the argument
   and the count line lands it; the sentence only names what is being counted.

   The switch is not a cross-fade. Every path carries pathLength="1", which is
   what lets one stroke-dashoffset rule work across eleven paths of eleven
   different lengths, and the wires draw and undraw themselves. Read in the
   direction that matters: the five owned wires retract into the hub, the
   folder drops in where they met, one wire comes back up into it, and only
   then do the borrowed wires reach down. The delays are the argument.

   The travelling dots ride an unpainted full-length rail via animateMotion and
   mpath, while the visible wire is drawn short of both ends. That is what
   makes a dot enter and leave a node cleanly instead of stopping dead on its
   edge. No JS, no rAF.

   THE DOTS ARRIVE, AND THEY ARRIVE ONE AT A TIME. They used to slide the
   length of every wire at once, forever, at constant speed -- the flowing-data
   cliche, which says nothing and which nothing can land in. Now the two states
   share one 5.4s beat and differ in how many arrivals fit inside it: five on
   the left, one on the right. The reader hears the count before reading it,
   and it is the same count the line under the drawing prints.

   Each dot therefore waits through the rest of the beat rather than looping
   through it, which is what keyTimes/keyPoints do below: hold at 0, ease
   across during its own slice, hold at 1. The node it reaches takes a halo on
   the same clock, so the arrival is an event rather than a disappearance.

   The destinations are generic on purpose. This is a comparative diagram, and
   a real mark inside one asserts something about that vendor's integrations
   that we have not verified; the glyphs say what kind of tool without naming
   one. */
import { useEffect, useRef, useState } from 'react';
import { prefersReduced } from '../lib/dom';

type StateName = 'other' | 'ws';

/* ONE BEAT FOR BOTH STATES, so the difference between them is countable in
   time as well as in wires. Five slots, because the busier state has five
   wires; the quieter state uses one of the five and leaves the rest silent,
   which is the whole argument played as rhythm. */
const BEAT = 5.4;
const SLOTS = 5;
const TRAVEL = 0.62;

function Dot({ rail, slot }: { rail: string; slot: number }) {
  const t0 = (slot * (BEAT / SLOTS)) / BEAT;
  const t1 = t0 + TRAVEL / BEAT;
  const dur = `${BEAT}s`;
  const at = (v: number) => v.toFixed(4);
  return (
    <circle className="w-dot" r="2.6" opacity="0">
      <animateMotion
        dur={dur}
        repeatCount="indefinite"
        calcMode="spline"
        keyTimes={`0;${at(t0)};${at(t1)};1`}
        keyPoints="0;0;1;1"
        /* hold, ease across, hold. The middle segment is the only one that
           moves, and it decelerates into the node rather than stopping dead. */
        keySplines="0 0 1 1;.34 0 .16 1;0 0 1 1"
      >
        <mpath href={`#${rail}`} />
      </animateMotion>
      <animate
        attributeName="opacity"
        dur={dur}
        repeatCount="indefinite"
        keyTimes={`0;${at(t0)};${at(t0 + 0.012)};${at(t1 - 0.022)};${at(t1)};1`}
        values="0;0;.95;.95;0;0"
      />
    </circle>
  );
}

/** The ring a node takes when something reaches it. Same clock as the dot on
 *  the wire that ends there, so the two read as one event. */
function Halo({ cx, cy, slot, rx, ry }: {
  cx: number; cy: number; slot: number; rx?: number; ry?: number;
}) {
  const t1 = (slot * (BEAT / SLOTS) + TRAVEL) / BEAT;
  const at = (v: number) => v.toFixed(4);
  const times = `0;${at(t1)};${at(t1 + 0.055)};1`;
  const dur = `${BEAT}s`;
  const fade = (
    <animate attributeName="opacity" dur={dur} repeatCount="indefinite"
             keyTimes={times} values="0;.55;0;0" />
  );
  // The folder is a box, so its halo is an ellipse around the box rather than
  // a circle that cuts its corners off.
  if (rx && ry) {
    return (
      <ellipse className="w-halo" cx={cx} cy={cy} rx={rx} ry={ry} opacity="0">
        <animate attributeName="rx" dur={dur} repeatCount="indefinite"
                 keyTimes={times} values={`${rx};${rx};${rx + 9};${rx + 9}`} />
        <animate attributeName="ry" dur={dur} repeatCount="indefinite"
                 keyTimes={times} values={`${ry};${ry};${ry + 9};${ry + 9}`} />
        {fade}
      </ellipse>
    );
  }
  return (
    <circle className="w-halo" cx={cx} cy={cy} r="15" opacity="0">
      <animate attributeName="r" dur={dur} repeatCount="indefinite"
               keyTimes={times} values="15;15;23;23" />
      {fade}
    </circle>
  );
}

const STATES: Record<StateName, {
  k: string; t: string; swL: string; hub: string;
  countLabel: string; cap: string; own: number;
}> = {
  other: {
    k: 'The usual shape',
    t: 'A connector layer',
    swL: 'Everyone else',
    hub: 'a dictation app',
    countLabel: 'Connections the product has to build and keep working',
    cap: 'Every destination is a connection somebody has to build, authenticate and keep ' +
         'working. Which places your words can go is then their roadmap, not yours.',
    own: 5,
  },
  ws: {
    k: 'How WordScript is wired',
    t: 'No connector layer',
    swL: 'WordScript',
    hub: 'WordScript',
    countLabel: 'Connections WordScript has to build and keep working',
    cap: 'One plain file into a folder your agent CLI already opens. Nothing has to be ' +
         'built for the next tool to reach it.',
    own: 1,
  },
};

const NODES = [
  { cx: 60,  label: 'your editor',    ico: <><path d="M -2.5,-4 L -6,0 L -2.5,4" /><path d="M 2.5,-4 L 6,0 L 2.5,4" /></> },
  { cx: 160, label: 'your notes',     ico: <><rect x="-5" y="-6" width="10" height="12" rx="1.5" /><path d="M -2.5,-2.5 H 2.5 M -2.5,.5 H 2.5 M -2.5,3.5 H .5" /></> },
  { cx: 260, label: 'your chat',      ico: <><path d="M -6,-5 H 6 V 2.5 H -1 L -4.5,6 V 2.5 H -6 Z" /><path d="M -3,-1.4 H 3" /></> },
  { cx: 360, label: 'your agent CLI', ico: <><path d="M -6,-4 L -2,0 L -6,4" /><path d="M 0,4.5 H 6" /></> },
  { cx: 460, label: 'your grep',      ico: <><circle cx="-1" cy="-1" r="4.5" /><path d="M 2.4,2.4 L 6,6" /></> },
];

const RAILS = [
  'M 260,268 L 60,66', 'M 260,268 L 160,66', 'M 260,268 L 260,66',
  'M 260,268 L 360,66', 'M 260,268 L 460,66',
];
const OWN_A = [
  'M 260,240 L 74,80', 'M 260,240 L 168,80', 'M 260,240 L 260,82',
  'M 260,240 L 352,80', 'M 260,240 L 446,80',
];
const THEIRS = [
  'M 244,168 L 74,80', 'M 246,164 L 168,80', 'M 260,158 L 260,82',
  'M 274,164 L 352,80', 'M 276,168 L 446,80',
];

export default function Wiring() {
  const wire = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  /* Server-rendered on the connector state, which is where a reader without JS
     is left; the effect moves it to the product's own state on first sight, or
     starts there outright under reduced motion. */
  const [state, setState] = useState<StateName>('other');
  const touched = useRef(false);

  useEffect(() => {
    const reduced = prefersReduced();

    /* SMIL does not honour prefers-reduced-motion the way CSS animations do,
       so the travelling dots have to be stopped by hand rather than by media
       query. Pausing the timeline also stops the hidden state's dots, which
       are only invisible, not idle. */
    if (reduced) {
      svg.current?.pauseAnimations();
      setState('ws');
      return;
    }

    /* In normal motion the diagram demonstrates itself once on first sight,
       the way every other surface on this page does, and stays wherever the
       reader last put it after that. A passive reader never leaves with the
       wrong picture on screen. */
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.disconnect();
      timer = setTimeout(() => { if (!touched.current) setState('ws'); }, 1400);
    }), { threshold: 0.35 });
    io.observe(wire.current!);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, []);

  const st = STATES[state];

  return (
    <div
      className="wire lit rise"
      data-d="1"
      data-wire=""
      data-state={state}
      ref={wire}
    >
      <div className="wire__head">
        <div className="wire__state">
          <span className="wire__k mono">{st.k}</span>
          <b className="wire__t">{st.t}</b>
        </div>
        <button
          className="wire__sw"
          role="switch"
          aria-checked={state === 'ws'}
          aria-label="Show how WordScript is wired instead"
          onClick={() => {
            touched.current = true;
            setState(s => (s === 'ws' ? 'other' : 'ws'));
          }}
        >
          <span className="wire__sw-l mono">{st.swL}</span>
          <span className="wire__sw-track"><span className="wire__sw-knob"></span></span>
        </button>
      </div>

      <div className="wire__stage">
        <svg
          viewBox="0 0 520 338"
          role="img"
          ref={svg}
          aria-label="Two wiring diagrams. With a connector layer the app maintains one connection to each destination. Without one, the app makes a single write into a directory, and the tools you already have open that directory themselves."
        >
          {/* motion rails: full-length, never painted */}
          <g fill="none" stroke="none">
            {RAILS.map((d, i) => <path id={`w-r${i}`} d={d} key={i} />)}
            <path id="w-rf" d="M 260,268 L 260,196" />
          </g>

          {/* state A: five wires the product owns */}
          <g className="w-own">
            {OWN_A.map((d, i) => <path className="w-wire w-wire--own" pathLength="1" d={d} key={i} />)}
          </g>

          {/* state B: one wire the product owns, and five it does not */}
          <g className="w-borrowed">
            {THEIRS.map((d, i) => <path className="w-wire w-wire--theirs" pathLength="1" d={d} key={i} />)}
            <path className="w-wire w-wire--own" pathLength="1" d="M 260,240 L 260,198" />
          </g>

          {/* the dots ride only the wires the product is responsible for */}
          <g data-wire-dots-a="">
            {RAILS.map((_, i) => <Dot rail={`w-r${i}`} slot={i} key={i} />)}
            {NODES.map((n, i) => <Halo cx={n.cx} cy={66} slot={i} key={n.label} />)}
          </g>
          <g data-wire-dots-b="">
            <Dot rail="w-rf" slot={0} />
            {/* the folder is what receives here, and it is the only thing that
                does -- one arrival per beat against the other state's five */}
            <Halo cx={260} cy={178} slot={0} rx={44} ry={26} />
          </g>

          <g className="w-nodes">
            {NODES.map((n) => (
              <g className="w-node" key={n.label}>
                <circle cx={n.cx} cy="66" r="15" />
                <g className="w-ico" transform={`translate(${n.cx},66)`}>{n.ico}</g>
                <text x={n.cx} y="34">{n.label}</text>
              </g>
            ))}
          </g>

          {/* the directory, which exists only in state B */}
          <g className="w-folder">
            <rect x="222" y="158" width="76" height="40" rx="5" />
            <path className="w-folder-tab" d="M 224,158 L 224,150 L 246,150 L 252,158" />
            <text className="w-folder-l" x="308" y="182">a folder you named</text>
          </g>

          {/* the product */}
          <g className="w-hub">
            <circle cx="260" cy="268" r="26" />
            <g className="w-ico w-ico--hub" transform="translate(260,268)">
              <path d="M 0,-8 a 3.4,3.4 0 0 1 3.4,3.4 v 4.6 a 3.4,3.4 0 0 1 -6.8,0 v -4.6 A 3.4,3.4 0 0 1 0,-8 Z" />
              <path d="M -6.2,-1 v 1.2 a 6.2,6.2 0 0 0 12.4,0 V -1" />
              <path d="M 0,6.4 V 9" />
            </g>
            <text x="260" y="322" className="w-hub-t">{st.hub}</text>
          </g>
        </svg>

        <p className="wire__cap">{st.cap}</p>
        <p className="wire__count mono">{st.countLabel}: <b>{st.own}</b></p>
      </div>
    </div>
  );
}
