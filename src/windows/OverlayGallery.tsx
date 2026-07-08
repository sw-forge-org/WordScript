import { useState } from "react";
import { OverlayPill, type OverlayProcessingMode } from "../components/overlay/OverlayPill";

/* ════════════════════════════════════════════════════════════════════════════
   OverlayGallery — Phase 1 isolated state gallery.

   Renders every OverlayPill state on a neutral backdrop so the visual layer
   can be tuned without the Tauri runtime. A mock audio-level slider drives the
   recording waveform; the interactive cards keep their own local mock state.
   No Tauri commands, no window resize — browser hot-reload only.
   ════════════════════════════════════════════════════════════════════════════ */

const MODE_CYCLE: OverlayProcessingMode[] = ["auto", "verbatim", "cleanup", "rewrite", "agent", "prompt_enhance"];

const SAMPLE_RESULT = "The quarter closed strong with revenue up twelve percent year over year.";
const SAMPLE_PREVIEW = "Ship the release notes by Friday.";

type CardProps = {
  index: string;
  title: string;
  hint: string;
  /** Span the full grid row so wide preview/result pills never overflow the card. */
  wide?: boolean;
  children: React.ReactNode;
};

function Card({ index, title, hint, wide, children }: CardProps) {
  return (
    <section className={`og-card${wide ? " og-card--wide" : ""}`}>
      <header className="og-card__head">
        <span className="og-card__index">{index}</span>
        <div className="og-card__meta">
          <h3 className="og-card__title">{title}</h3>
          <p className="og-card__hint">{hint}</p>
        </div>
      </header>
      <div className="og-card__stage">
        {children}
      </div>
    </section>
  );
}

export default function OverlayGallery() {
  const [level, setLevel] = useState(0.62);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<OverlayProcessingMode>("agent");
  const [editText, setEditText] = useState("Edit the transcription before inserting it.");

  const cycleMode = () => {
    const i = MODE_CYCLE.indexOf(mode);
    setMode(MODE_CYCLE[(i + 1) % MODE_CYCLE.length] ?? "agent");
  };

  const recordingHandlers = {
    onMuteToggle: () => setMuted((m) => !m),
    onPauseToggle: () => setPaused((p) => !p),
    onCycleMode: cycleMode,
  };

  return (
    <div className="ov-scope og-shell">
      <div className="og-bg" aria-hidden="true" />

      <main className="og-main">
        <header className="og-header">
          <div>
            <span className="og-eyebrow">Phase 1 · Visual rebuild</span>
            <h1 className="og-title">Overlay capsule — state gallery</h1>
            <p className="og-lede">
              Every visual state in isolation. Adaptive width, fake-glass solid fill (no backdrop blur),
              single warm accent. Wire-up to the Rust runtime lands in Phase 2.
            </p>
          </div>

          <div className="og-controls">
            <label className="og-control" htmlFor="og-level">
              <span className="og-control__label">Mock audio level</span>
              <span className="og-control__value">{Math.round(level * 100)}%</span>
            </label>
            <input
              id="og-level"
              className="og-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={level}
              onChange={(e) => setLevel(parseFloat(e.target.value))}
              aria-label="Mock audio level for the recording waveform"
            />
          </div>
        </header>

        <div className="og-grid">
          <Card index="01" title="Recording" hint="Accent mic · live waveform · mode chip · Pause">
            <OverlayPill
              state={{ kind: "recording", mode, muted, paused, level, elapsedSec: 8, ...recordingHandlers }}
            />
          </Card>

          <Card index="02" title="Recording · muted" hint="Struck mic · red bars with breathe pulse">
            <OverlayPill
              state={{ kind: "recording", mode, muted: true, paused, level, elapsedSec: 8, ...recordingHandlers }}
            />
          </Card>

          <Card index="03" title="Recording · paused" hint="Dimmed bars · blinking timer · Resume">
            <OverlayPill
              state={{ kind: "recording", mode, muted, paused: true, level, elapsedSec: 8, ...recordingHandlers }}
            />
          </Card>

          <Card index="04" title="Processing" hint="Shimmer sweep on bars · weaker accent border · Working">
            <OverlayPill
              state={{
                kind: "processing",
                mode: "cleanup",
                elapsedSec: 3,
                onCycleMode: cycleMode,
              }}
            />
          </Card>

          <Card index="05" title="Processing preview" hint="Live text preview + inline Copy / Abort · clipboard_only gate" wide>
            <OverlayPill
              state={{
                kind: "processing",
                mode: "agent",
                elapsedSec: 4,
                preview: { text: SAMPLE_PREVIEW, clipboardOnly: true },
                onCommit: () => {},
                onAbort: () => {},
              }}
            />
          </Card>

          <Card index="05b" title="Mode picker" hint="Idle silhouette · mode chip · tap to cycle">
            <OverlayPill
              state={{
                kind: "mode-picker",
                mode,
                onCycleMode: cycleMode,
              }}
            />
          </Card>

          <Card index="06" title="Result actions" hint="Final text + Copy / Edit + auto-close 9s" wide>
            <OverlayPill
              state={{
                kind: "result-actions",
                text: SAMPLE_RESULT,
                clipboardOnly: false,
                autoCloseSec: 9,
                onCopy: () => {},
                onEdit: () => {},
                onDismiss: () => {},
              }}
            />
          </Card>

          <Card index="06b" title="Result actions · clipboard_only" hint="Accent-soft border + inline Insert affordance" wide>
            <OverlayPill
              state={{
                kind: "result-actions",
                text: "Copied straight to the clipboard.",
                clipboardOnly: true,
                autoCloseSec: 9,
                onCopy: () => {},
                onEdit: () => {},
                onInsert: () => {},
                onDismiss: () => {},
              }}
            />
          </Card>

          <Card index="07" title="Edit mode" hint="Tall capsule · editable textarea · Confirm / Cancel · resize handle">
            <OverlayPill
              state={{
                kind: "edit-mode",
                text: editText,
                onTextChange: setEditText,
                onConfirm: () => {},
                onCancel: () => {},
              }}
            />
          </Card>

          <Card index="08" title="Error" hint="Red-orange border · red mic glow · pill lifted −2px">
            <OverlayPill state={{ kind: "error", message: "Microphone permission denied." }} />
          </Card>

          <Card index="09" title="Action pending" hint="All buttons disabled · pending label · cursor progress" wide>
            <OverlayPill
              state={{
                kind: "result-actions",
                text: SAMPLE_RESULT,
                clipboardOnly: true,
                autoCloseSec: 9,
                pending: { action: "insert", label: "Inserting" },
              }}
            />
            <OverlayPill
              state={{
                kind: "processing",
                mode: "agent",
                elapsedSec: 4,
                preview: { text: SAMPLE_PREVIEW, clipboardOnly: false },
                pending: { action: "commit", label: "Inserting" },
              }}
            />
          </Card>
        </div>

        <footer className="og-footer">
          <span>Open the audio-level slider to watch the recording waveform react.</span>
          <span className="og-footer__sep">·</span>
          <span>State logic lives outside <code>OverlayPill</code> — it only renders what it is given.</span>
        </footer>
      </main>
    </div>
  );
}
