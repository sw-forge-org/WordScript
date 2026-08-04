import { useState } from "react";
import "../../lab/lab.css";
import { Orb, type OrbState } from "../../lab/Orb";
import { LiveWaveform } from "../../lab/LiveWaveform";
import { Matrix, loader, snake, wave, digits } from "../../components/ui/matrix";
import { Shortcut } from "../../lab/Keycap";
import { ProviderMark, PROVIDER_IDS } from "../../lab/ProviderMark";
import { Button } from "../../components/ui/button";
import { Kbd } from "../../components/ui/kbd";
import { Spinner } from "../../components/ui/spinner";
import { ButtonGroup } from "../../components/ui/button-group";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "../../components/ui/empty";

/**
 * MOTION — the four motion primitives, folded into /gallery on 2026-08-04.
 *
 * Was the route `/component-lab`, retired by ADR 0055. The content is
 * unchanged apart from losing the page chrome the gallery shell now provides.
 *
 * WHAT IT IS FOR. The settings-rework prototype in `docs/prototypes/` is the
 * agreed target and is written in plain HTML, CSS and JS with no build step,
 * which is exactly why it works as a design instrument: it can be opened by
 * anyone, argued with, and changed in one file. What it cannot do is BE the
 * component. An orb whose motion model is four states with different physics,
 * a canvas waveform, a per-frame envelope — those have to exist as real
 * components before anything can wire them to the runtime, and building them
 * twice guarantees the two drift. A motion model also cannot be judged from a
 * still, which is why §15.2 moved these out of the prototype rather than
 * drawing them there.
 *
 * ON WHERE THESE COME FROM. The ElevenLabs UI registry (`ui.elevenlabs.io`)
 * answers every request with a bot check, so nothing here was installed from
 * it. `matrix` and its siblings were vendored from the repository instead
 * (github.com/elevenlabs/ui, MIT, `6e5b681c01ee`) and carry their upstream
 * path in a header; the orb, the waveform, the keycap and the provider marks
 * are ours, written against our tokens, with the motion decisions recorded
 * where they are made. Where both exist, ours stay: they carry product
 * decisions upstream cannot know about.
 */

const ORB_STATES: Array<{ state: OrbState; title: string; note: string }> = [
  { state: "idle", title: "Idle", note: "Unlit, neutral, motionless. The process exists and is doing nothing." },
  { state: "listening", title: "Listening", note: "Cool material following your level. Fast rise, slow fall — it is receiving, not producing." },
  { state: "thinking", title: "Working", note: "Size holds, light drifts. No amplitude exists here, and a pulse would invent one." },
  { state: "speaking", title: "Speaking", note: "Warm, lit from inside, moving on the voice envelope: syllables and phrase pauses." },
];

function Section({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
        <p className="max-w-[68ch] text-[13px] text-fg-dim">{lead}</p>
      </header>
      {children}
    </section>
  );
}

/** A level array for the meter, standing in for the runtime's. Sixteen columns
 *  of one decaying sweep, so moving the slider moves a shape rather than a
 *  block — a meter that lights every column to the same height is a bar. */
function vuLevels(level: number): number[] {
  return Array.from({ length: 16 }, (_, i) => {
    const age = (15 - i) / 15;
    return Math.max(0, level * (1 - age * 0.75) * (0.72 + 0.28 * Math.sin(i * 1.7)));
  });
}

/* The card, on the card's own material: `--edge-light` rather than the literal
   it used to carry, so the panel inverts with the scheme like every other
   surface (ADR 0048). */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`ws-card px-[var(--pad-card)] ${className ?? ""}`}>{children}</div>
  );
}

export function Motion() {
  const [level, setLevel] = useState(0.62);

  return (
      <div className="flex flex-col gap-[var(--gap-block)]">
        <p className="max-w-[68ch] text-[length:var(--t-note)] text-fg-dim">
          The primitives the rework needs and shadcn does not carry, built against the
          shipped tokens. Wired to no runtime — every moving thing here runs a
          demonstration envelope, not a measurement.
        </p>

        <Section
          title="The orb"
          lead="One voice, one object (ADR 0043). Four states, each moving the way that state behaves — the predecessor had two and a fixed-period pulse, which is a heartbeat, and a heartbeat says ALIVE in three states where that is the wrong thing to say."
        >
          <div className="grid grid-cols-4 gap-3">
            {ORB_STATES.map(({ state, title, note }) => (
              <figure key={state} className="flex min-w-0 flex-col gap-2">
                {/* The stage stays dark in both schemes, deliberately: a glow is
                    legible only against something dark. That is physics, not
                    styling, and it is the same reason a colour swatch sits on a
                    neutral card regardless of the page (ADR 0048). */}
                <div className="grid h-[132px] place-items-center rounded-card bg-[#0d0d0f] ring-1 ring-white/10">
                  <Orb state={state} size={72} demo />
                </div>
                <figcaption className="flex flex-col gap-[3px]">
                  <b className="text-[12px] font-semibold text-fg">{title}</b>
                  <span className="text-[11px] leading-[1.5] text-fg-muted">{note}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section
          title="Live waveform"
          lead="For the two places a microphone is actually judged: the input-level control and meeting capture. It does not replace the level bar — the bar carries the discard threshold, which is a boundary the runtime applies. The bar answers 'is it loud enough', this answers 'is it any good'."
        >
          <Panel>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-fg-muted">
                  Driven by the demonstration envelope
                </span>
                <LiveWaveform demo height={48} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-fg-muted">
                  Driven by a level you control — this is the runtime path
                </span>
                <LiveWaveform level={level} height={48} tone="voice" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={level * 100}
                  onChange={(e) => setLevel(Number(e.target.value) / 100)}
                  aria-label="Input level"
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </div>
          </Panel>
        </Section>

        <Section
          title="The matrix"
          lead="A dot-matrix readout, vendored whole from ElevenLabs UI. It replaced a drifting glyph field that was named after it and was not it: that field was a background, and this is an instrument. The product uses one mode — the level meter, in the meeting HUD, where something is actually being recorded."
        >
          <Panel>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-end gap-8">
                {[
                  { title: "Level", node: <Matrix rows={7} cols={16} mode="vu" levels={vuLevels(level)} size={10} gap={2} ariaLabel="Level meter" /> },
                  { title: "Loader", node: <Matrix rows={7} cols={7} frames={loader} fps={12} ariaLabel="Loader" /> },
                  { title: "Wave", node: <Matrix rows={7} cols={7} frames={wave} fps={16} ariaLabel="Wave" /> },
                  { title: "Snake", node: <Matrix rows={7} cols={7} frames={snake} fps={14} ariaLabel="Snake" /> },
                  { title: "Digit", node: <Matrix rows={7} cols={5} pattern={digits[0]} ariaLabel="Digit zero" /> },
                ].map(({ title, node }) => (
                  <figure key={title} className="flex flex-col gap-2 text-accent">
                    <div className="grid min-h-[76px] place-items-center">{node}</div>
                    <figcaption className="text-[11px] font-medium uppercase tracking-[0.07em] text-fg-muted">
                      {title}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className="max-w-[68ch] text-[11px] leading-[1.6] text-fg-muted">
                <b className="text-fg-dim">pulse</b> is exported and deliberately not drawn here. ADR 0049 settles
                that the orchestrator&rsquo;s voice has four states and that none of them is a periodic pulse, and a
                readout borrowing that motion would be saying &ldquo;alive&rdquo; in the one product where a
                component already owns that job.
              </p>
            </div>
          </Panel>
        </Section>

        <Section
          title="The keycap"
          lead="Home's headline. The caps make the shortcut an object instead of a sentence you skip — which matters because the shortcut is how the product is started, from inside some other application."
        >
          <Panel>
            <div className="flex flex-wrap items-center gap-4">
              <Shortcut keys={["Ctrl", "Super"]} />
              <span className="flex flex-col gap-[2px]">
                <b className="text-[16px] font-semibold text-fg">Hold in any app to dictate</b>
                <span className="text-[13px] text-fg-dim">
                  Release to stop. What it produces goes to the cursor you left.
                </span>
              </span>
            </div>
          </Panel>
        </Section>

        <Section
          title="Provider marks"
          lead="From @lobehub/icons-static-svg. The React package peer-depends on React 19 and antd — a second component library — to render six logos, which is not a trade worth making. Monochrome by default so the accent stays free to mean 'overridden' in a settings list."
        >
          <Panel>
            <div className="flex flex-wrap items-center gap-6">
              {PROVIDER_IDS.map((id) => (
                <span key={id} className="flex items-center gap-2 text-[13px] text-fg-dim">
                  <ProviderMark id={id} size={18} />
                  {id}
                </span>
              ))}
            </div>
          </Panel>
        </Section>

        <Section
          title="shadcn additions"
          lead="Installed for the rework and not yet used by any shipped screen. Nothing existing was overwritten — button, card, input, dialog, separator and textarea were all left exactly as they ship."
        >
          <Panel>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Capture</Button>
                <Button variant="secondary">Refresh</Button>
                <Button variant="ghost">Review</Button>
                <Spinner />
                <span className="flex items-center gap-1 text-[13px] text-fg-dim">
                  Search is <Kbd>⌘</Kbd> <Kbd>K</Kbd>
                </span>
              </div>
              <ButtonGroup>
                <Button variant="secondary">Verbatim</Button>
                <Button variant="secondary">Cleanup</Button>
                <Button variant="secondary">Rewrite</Button>
              </ButtonGroup>
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No transcripts yet</EmptyTitle>
                  <EmptyDescription>
                    Hold Ctrl+Super in any application. What the runtime produces lands here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          </Panel>
        </Section>
      </div>
  );
}
