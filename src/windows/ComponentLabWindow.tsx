import { useState } from "react";
import "../lab/lab.css";
import { Orb, type OrbState } from "../lab/Orb";
import { LiveWaveform } from "../lab/LiveWaveform";
import { MatrixField } from "../lab/MatrixField";
import { Shortcut } from "../lab/Keycap";
import { ProviderMark, PROVIDER_IDS } from "../lab/ProviderMark";
import { Button } from "../components/ui/button";
import { Kbd } from "../components/ui/kbd";
import { Spinner } from "../components/ui/spinner";
import { ButtonGroup } from "../components/ui/button-group";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "../components/ui/empty";

/**
 * THE COMPONENT LAB — not a product surface, and not routed from one.
 *
 * WHAT IT IS FOR. The settings-rework prototype in `docs/prototypes/` is the
 * agreed target and is written in plain HTML, CSS and JS with no build step,
 * which is exactly why it works as a design instrument: it can be opened by
 * anyone, argued with, and changed in one file. What it cannot do is BE the
 * component. An orb whose motion model is four states with different physics,
 * a canvas waveform, a per-frame envelope — those have to exist as real
 * components before Stage 1 can wire them to the runtime, and building them
 * twice guarantees the two drift.
 *
 * So they are built here, once, in React, against the shipped tokens, and the
 * prototype draws the same thing in its own way for the screens that need to
 * show them in context. Where the prototype cannot render one truthfully it
 * says so and points at this route.
 *
 * WHAT IT IS NOT. It is not reachable from Home, Settings or any shipped
 * navigation, it touches no Tauri API, and it changes nothing under
 * `src/components/settings/`. Open it at `/component-lab`.
 *
 * ON THE MISSING IMPORTS. The ElevenLabs UI registry (`ui.elevenlabs.io`) is
 * behind a bot check that returns 429 to the CLI, to `shadcn add <url>` and to
 * plain fetch alike, so `orb`, `live-waveform`, `matrix` and the rest could not
 * be pulled. The four primitives below are ours, written against our tokens,
 * with the motion decisions recorded where they are made. When the registry is
 * reachable again the useful move is to read their versions for ideas, not to
 * swap ours out: these already carry product decisions theirs cannot know
 * about.
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

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[10px] bg-bg-surface p-5 ${className ?? ""}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.055)" }}
    >
      {children}
    </div>
  );
}

export default function ComponentLabWindow() {
  const [level, setLevel] = useState(0.62);

  return (
    <div className="min-h-screen bg-bg-base text-fg" style={{ fontFamily: "var(--font)" }}>
      <div className="mx-auto flex max-w-[860px] flex-col gap-8 px-8 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-[-0.026em] text-fg">Component lab</h1>
          <p className="max-w-[68ch] text-[13px] text-fg-dim">
            The primitives the settings rework needs and shadcn does not carry, built against the
            shipped tokens. Not routed from any product surface and wired to no runtime — every
            moving thing here runs a demonstration envelope, not a measurement.
          </p>
        </header>

        <Section
          title="The orb"
          lead="One voice, one object (ADR 0043). Four states, each moving the way that state behaves — the predecessor had two and a fixed-period pulse, which is a heartbeat, and a heartbeat says ALIVE in three states where that is the wrong thing to say."
        >
          <div className="grid grid-cols-4 gap-3">
            {ORB_STATES.map(({ state, title, note }) => (
              <figure key={state} className="flex min-w-0 flex-col gap-2">
                <div className="grid h-[132px] place-items-center rounded-[8px] bg-[#0d0d0f] ring-1 ring-white/10">
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
          title="Matrix field and the keycap"
          lead="Home's ground and Home's headline. The field answers 'is this thing listening' without being read, from across a desk — which is the distance this app is used at, because you are looking at another application while you talk. The caps make the shortcut an object instead of a sentence you skip."
        >
          <div
            className="relative isolate overflow-hidden rounded-[10px] bg-bg-surface p-8"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.055)" }}
          >
            <MatrixField level={level} />
            <div className="relative z-10 flex flex-col gap-5">
              <span className="flex items-center gap-2 text-[12px] font-medium text-fg-dim">
                <i className="h-[6px] w-[6px] rounded-full bg-green shadow-[0_0_0_3px_rgba(129,214,174,0.16)]" />
                Ready
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <Shortcut keys={["Ctrl", "Super"]} />
                <span className="flex flex-col gap-[2px]">
                  <b className="text-[16px] font-semibold text-fg">Hold in any app to dictate</b>
                  <span className="text-[13px] text-fg-dim">
                    Release to stop. What it produces goes to the cursor you left.
                  </span>
                </span>
              </div>
            </div>
          </div>
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
    </div>
  );
}
