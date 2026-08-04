import { useState } from "react";
import {
  Button,
  Card,
  CardRows,
  CheckList,
  Diff,
  DiffMark,
  DiffPane,
  Icon,
  Log,
  Row,
  Select,
  StatusBadge,
  SubTabs,
  ViewTop,
  type LogLine,
} from "@/components/shell";

/**
 * DIAGNOSTICS — `SCREENS.diagnostics`. Three tabs, and the sub-tab row is part
 * of the masthead rather than a section of the view.
 *
 * WHAT THE RUNTIME IS DOING, IN ITS OWN VOCABULARY. That is the whole brief and
 * it is why the values are monospaced facts rather than prose: this screen is
 * read when something is wrong, and what is copied out of it goes into a bug
 * report.
 *
 * The Preview tab is also why `Live preview & commit` is withdrawn (§11.15) —
 * this already does it, against the real runtime, and names every applied rule.
 */

const LOG_LINES: LogLine[] = [
  { at: "09:42:11.204", level: "INFO", message: "trigger: hotkey Ctrl+Super pressed, activation=tap" },
  { at: "09:42:11.207", level: "INFO", message: "capture: started, device=System default microphone" },
  { at: "09:42:25.881", level: "INFO", message: "capture: stopped, 14.6s, peak=-11.2dBFS" },
  { at: "09:42:25.883", level: "INFO", message: "provider: groq whisper-large-v3-turbo, 1 segment" },
  { at: "09:42:26.940", level: "INFO", message: "provider: ok, 1057ms" },
  { at: "09:42:26.942", level: "INFO", message: "mode_router: auto -> cleanup (workspace_context=editor)" },
  { at: "09:42:27.615", level: "INFO", message: "transform: cleanup ok, 673ms, 2 repairs applied" },
  { at: "09:42:27.618", level: "INFO", message: "insert: driver=xdotool strategy=paste" },
  { at: "09:42:27.702", level: "INFO", message: "insert: ok, clipboard restored" },
  { at: "09:42:27.703", level: "INFO", message: "session: ended, surface=result_overlay" },
  { at: "09:41:02.118", level: "WARN", message: "portal: RemoteDesktop.SelectDevices unavailable, staying on xdotool" },
  { at: "09:38:44.007", level: "ERROR", message: "insert: target ignored paste, fell back to scratchpad" },
];

const TABS = ["Checks", "Preview", "Logs"];

export function DiagnosticsScreen() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <>
      <ViewTop
        title="Diagnostics"
        lead="What the runtime is doing, in its own vocabulary."
        tabs={
          <SubTabs
            label="Diagnostics"
            value={tab}
            onChange={setTab}
            items={TABS.map((id) => ({ id, label: id }))}
          />
        }
      />

      {tab === "Checks" && (
        <>
          <Card
            title="Runtime snapshot"
            description="From the native runtime. Unsaved edits here do not change it."
          >
            <CardRows>
              <Row label="Stage" control={<StatusBadge tone="plan">idle</StatusBadge>} />
              <Row label="Active session" control={<span className="ws-mono ws-muted">no session armed</span>} />
              <Row
                label="Transcription path"
                control={<span className="ws-mono ws-muted">groq / whisper-large-v3-turbo</span>}
              />
              <Row label="Provider readiness" control={<StatusBadge tone="success">Ready</StatusBadge>} />
              <Row label="Work mode" control={<span className="ws-mono ws-muted">auto → cleanup</span>} />
              <Row
                label="Capture runtime"
                control={<span className="ws-mono ws-muted">native · 10 min cap · 3 s silence stop</span>}
              />
              <Row
                label="Capture device"
                control={<span className="ws-mono ws-muted">Yeti Nano Analog Stereo</span>}
              />
              <Row
                label="Pipeline"
                control={<span className="ws-mono ws-muted">capture · provider · transform · insert</span>}
              />
            </CardRows>
          </Card>

          <Card
            title="Run a check"
            description="A full capture-to-insert pass against the current native state."
            footer={
              <>
                <Button variant="primary" icon={<Icon name="play" />}>
                  Run check
                </Button>
                <Button variant="ghost" icon={<Icon name="external" />}>
                  Open pop-out
                </Button>
              </>
            }
          >
            <CardRows>
              <Row
                label="Session source"
                control={
                  <Select defaultValue="Diagnostics demo" aria-label="Session source">
                    <option>Hold to talk</option>
                    <option>Tap to toggle</option>
                    <option>Diagnostics demo</option>
                  </Select>
                }
              />
              <Row
                label="Text profile"
                control={
                  <Select defaultValue="General writing" aria-label="Text profile">
                    <option>Developer notes</option>
                    <option>General writing</option>
                    <option>Support reply</option>
                  </Select>
                }
              />
              <Row
                label="Preview target"
                control={
                  <Select defaultValue="Editor preview" aria-label="Preview target">
                    <option>Editor preview</option>
                    <option>Clipboard fallback preview</option>
                  </Select>
                }
              />
            </CardRows>
          </Card>
        </>
      )}

      {tab === "Preview" && (
        <>
          <Card
            title="Diagnostics preview"
            description="The diagnostics lane only. Not the recovery scratchpad."
          >
            <CardRows>
              <Row label="Target" control={<span className="ws-mono ws-muted">this window</span>} />
              <Row label="Insert mode" control={<span className="ws-mono ws-muted">auto_paste</span>} />
              <Row
                label="Fallback path"
                control={<span className="ws-mono ws-muted">clipboard → scratchpad</span>}
              />
              <Row label="Profile used" control={<span className="ws-mono ws-muted">General writing</span>} />
            </CardRows>
            {/* Raw beside transformed — a pairing, not a feature. No commit
                action follows it here: a commit control in Diagnostics would
                commit a session nobody dictated. */}
            <CardRows>
              <Row layout="stack">
                <Diff>
                  <DiffPane side="in" title="Raw">
                    um okay so let&apos;s uh ship the settings restructure today and and review the
                    overlay tab yeah
                  </DiffPane>
                  <DiffPane side="out" title="Cleanup">
                    Okay, let&apos;s ship the settings restructure today and review the{" "}
                    <DiffMark>overlay</DiffMark> tab.
                  </DiffPane>
                </Diff>
              </Row>
            </CardRows>
          </Card>

          <Card title="Decoded transform rules" description="Rules from recent entries, translated.">
            <CheckList
              items={[
                { state: "ok", label: "Removed filler words", detail: "“um”, “uh”." },
                { state: "ok", label: "Collapsed a repeated word", detail: "“and and” → “and”." },
                {
                  state: "ok",
                  label: "Dictionary replacement applied",
                  detail: "“overlay”, from the profile vocabulary.",
                },
                { state: "ok", label: "Capitalized sentence start", detail: "One sentence." },
                { state: "ok", label: "AI post-correction applied", detail: "Cleanup, 673 ms." },
                {
                  state: "todo",
                  label: "Hallucination filtered",
                  detail: "Nothing filtered. No content was added.",
                },
              ]}
            />
          </Card>
        </>
      )}

      {tab === "Logs" && (
        <Card
          title="Runtime logs"
          description="Buffered while the runtime is active. Durable transcripts live in History."
        >
          <Log lines={LOG_LINES} />
        </Card>
      )}
    </>
  );
}
