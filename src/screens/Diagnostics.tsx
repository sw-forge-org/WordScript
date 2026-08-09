import { Fragment, useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  type CheckItem,
  type LogLine,
  type StatusTone,
} from "@/components/shell";
import { useRuntimeLogs } from "@/hooks/useRuntimeLogs";
import { useV1Slice } from "@/hooks/useV1Slice";
import { describeAppliedRule } from "@/lib/transformRules";
import type { SliceStage } from "@/types/v1Slice";
import type { WiredScreenProps } from "./props";

/**
 * DIAGNOSTICS — `SCREENS.diagnostics`, wired. Three tabs, and the sub-tab row is
 * part of the masthead rather than a section of the view.
 *
 * WHAT THE RUNTIME IS DOING, IN ITS OWN VOCABULARY. That is the whole brief and
 * it is why the values are monospaced facts rather than prose: this screen is
 * read when something is wrong, and what is copied out of it goes into a bug
 * report.
 *
 * The Preview tab is also why `Live preview & commit` is withdrawn (§11.15) —
 * this already does it, against the real runtime, and names every applied rule.
 *
 * THIS IS WHERE `RebuildLabTab` COMES BACK. Leg 3 deleted about a thousand lines
 * of real checks against the native runtime, because the ported screen replaced
 * it in the sheet and ADR 0054 forbids the old and the new standing at once.
 * What it did maps onto this drawing almost row for row — its three panels ARE
 * these three tabs, and its three selects carry exactly these three option
 * lists — so restoring it is reading the same commands into a different shape
 * rather than rebuilding a surface:
 *
 * - `useV1Slice` is the runtime snapshot and the check: stage, session,
 *   provider, work mode, capture and the four pipeline steps, plus start,
 *   complete and reset.
 * - `useRuntimeLogs` is the Logs tab, polled while it is the tab being looked
 *   at and only then.
 * - `describeAppliedRule` moved to `lib/transformRules.ts` and is the Decoded
 *   transform rules card.
 *
 * WHAT COULD NOT BE READ, AND IS THEREFORE VISIBLY ABSENT (rule 7):
 *
 * - THE RUNTIME LOG HAS NO SEVERITY FIELD. `runtime_log::record` takes one
 *   string; INFO / WARN / ERROR exist only in the drawing. Deriving one from
 *   whether a line contains the word "error" would be a guess printed in the
 *   one place somebody reads to find out what went wrong, so the level column
 *   is left empty and the line draws in the neutral colour. Leg 5 owes the
 *   field; the three levels stay in `Log` waiting for it.
 * - NOTHING HAS RUN UNTIL SOMETHING HAS. Every value that only exists after a
 *   check says `not run` rather than showing a plausible one, and the rules
 *   list uses `CheckList`'s `todo` — the empty ring that means a probe that has
 *   not run — rather than a tick.
 * - `clear_runtime_log_entries` HAS NO DOOR ON THIS DRAWING. The pre-port panel
 *   had a Clear button; the ported card has no footer. The command still
 *   exists and nothing here calls it, which is a missing control rather than a
 *   missing capability. Adding one would be drawing.
 */

const TABS = ["Checks", "Preview", "Logs"];

/* The prototype's own option lists, and they are also the pre-port area's:
   `TRIGGER_OPTIONS` and `INSERT_TARGET_OPTIONS` had exactly these labels, so
   the drawing was read off the surface it is replacing. The values are what
   `start_v1_slice_capture` and `complete_v1_slice_capture` accept. */
const TRIGGERS = [
  { value: "hold_to_talk", label: "Hold to talk" },
  { value: "tap_to_toggle", label: "Tap to toggle" },
  { value: "diagnostic_demo", label: "Diagnostics demo" },
] as const;

const INSERT_TARGETS = [
  { value: "editor_preview", label: "Editor preview" },
  { value: "clipboard_preview", label: "Clipboard fallback preview" },
] as const;

/* THE CHECK'S INPUT, and it is an input rather than a reading. The drawn card
   carries no text field — the pre-port panel had one and the port did not keep
   it — so a check needs a transcript to put through the transform, and this is
   the pre-port panel's own sample. What comes back out of it is measured; what
   goes in is chosen. */
const CHECK_SAMPLE =
  "wir shippen morgen die neue WordScript Version und brauchen klare release notes ohne Halluzinationen oder Fallback Chaos";

const NOT_RUN = "not run";

function stageLabel(stage: SliceStage | undefined): string {
  return stage ?? "unknown";
}

function stageTone(stage: SliceStage | undefined): StatusTone {
  switch (stage) {
    case "completed":
      return "success";
    case "error":
      return "danger";
    case "capturing":
    case "processing":
      return "accent";
    default:
      return "plan";
  }
}

/** `[1770000000000 +12.345] [WordScript] message` — the shape `runtime_log`
 *  writes. The stamp is real; the level is not there to be read. */
function parseLogEntry(entry: string): LogLine {
  const match = entry.match(/^\[(\d+)\s+\+[\d.]+\]\s*(.*)$/s);
  if (!match) return { at: "", message: entry };

  const at = new Date(Number(match[1]));
  const stamp = Number.isNaN(at.getTime())
    ? ""
    : `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}:${String(
        at.getSeconds(),
      ).padStart(2, "0")}.${String(at.getMilliseconds()).padStart(3, "0")}`;

  return { at: stamp, message: match[2] };
}

/**
 * The words the transform changed, marked in the pane that shows the result.
 *
 * Computed from the two strings the runtime returned rather than reported by
 * it: a word in the output that the input did not carry, exactly, is a word the
 * transform changed. A multiset, so a repetition the transform collapsed does
 * not mark the survivor, and exact rather than case-folded, because
 * `capitalized_sentence_start` and `added_terminal_punctuation` are two of the
 * five rules this lane can apply and folding them away would hide the change
 * the rule list beneath is claiming. It is coarse and it is honest — it never
 * marks a word the two texts agree on.
 */
function markChangedWords(raw: string, final: string) {
  const remaining = new Map<string, number>();
  for (const word of raw.split(/\s+/).filter(Boolean)) {
    remaining.set(word, (remaining.get(word) ?? 0) + 1);
  }

  return final.split(/(\s+)/).map((token, index) => {
    if (!token.trim()) return <Fragment key={index}>{token}</Fragment>;
    const left = remaining.get(token) ?? 0;
    if (left > 0) {
      remaining.set(token, left - 1);
      return <Fragment key={index}>{token}</Fragment>;
    }
    return <DiffMark key={index}>{token}</DiffMark>;
  });
}

export function DiagnosticsScreen({ banner, runtime }: WiredScreenProps) {
  const [tab, setTab] = useState(TABS[0]);
  const { config, active } = runtime;

  const { status, result, error, isPending, startCapture, completeCapture, reset } = useV1Slice();
  // Polled only while it is the tab being looked at. A 1.2 s poll behind a
  // closed sheet is a poll nobody asked for.
  const logs = useRuntimeLogs(active && tab === "Logs");

  const [trigger, setTrigger] = useState<string>(TRIGGERS[0].value);
  const [profileId, setProfileId] = useState<string>(config.active_text_profile_id);
  const [insertTarget, setInsertTarget] = useState<string>(INSERT_TARGETS[0].value);

  const contract = status?.runtime_contract ?? null;
  const capture = contract?.capture_status ?? null;

  const runCheck = useCallback(async () => {
    await reset();
    if (!(await startCapture({ trigger }))) return;
    await completeCapture({ raw_text: CHECK_SAMPLE, insert_target: insertTarget, profile: profileId });
  }, [completeCapture, insertTarget, profileId, reset, startCapture, trigger]);

  const ruleChecks = useMemo<CheckItem[]>(() => {
    const rules = result?.transcript.applied_rules ?? [];
    if (!rules.length) {
      return [
        {
          state: "todo",
          label: "No check has run in this session",
          detail: "Run a check on the Checks tab and the rules the transform applied are decoded here.",
        },
      ];
    }
    return rules.map((rule) => {
      const info = describeAppliedRule(rule);
      return { state: "ok", label: info.label, detail: info.description, code: info.id };
    });
  }, [result?.transcript.applied_rules]);

  const logLines = useMemo(() => logs.entries.map(parseLogEntry), [logs.entries]);

  /* The configured mode and the mode the router resolves it to. Both come off
     the contract the runtime just handed back, so `auto → cleanup` is two facts
     rather than one label. */
  const configuredMode = contract?.work_mode.processing_mode ?? null;
  const effectiveMode =
    configuredMode === "auto"
      ? contract?.work_mode.rewrite_style === "verbatim"
        ? "verbatim"
        : contract?.work_mode.rewrite_style === "polished"
          ? "rewrite"
          : "cleanup"
      : configuredMode;

  return (
    <>
      <ViewTop
        title="Diagnostics"
        lead="What the runtime is doing, in its own vocabulary."
        banner={banner}
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
              <Row
                label="Stage"
                control={<StatusBadge tone={stageTone(status?.stage)}>{stageLabel(status?.stage)}</StatusBadge>}
              />
              <Row
                label="Active session"
                control={
                  <span className="ws-mono ws-muted">{status?.session_id ?? "no session armed"}</span>
                }
              />
              <Row
                label="Transcription path"
                control={
                  <span className="ws-mono ws-muted">
                    {contract ? `${contract.provider} / ${contract.model}` : NOT_RUN}
                  </span>
                }
              />
              <Row
                label="Provider readiness"
                control={
                  contract ? (
                    <StatusBadge tone={contract.provider_status.ready ? "success" : "warning"}>
                      {contract.provider_status.ready ? "Ready" : "Needs attention"}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="plan">{NOT_RUN}</StatusBadge>
                  )
                }
              />
              <Row
                label="Work mode"
                control={
                  <span className="ws-mono ws-muted">
                    {configuredMode
                      ? configuredMode === effectiveMode
                        ? configuredMode
                        : `${configuredMode} → ${effectiveMode}`
                      : NOT_RUN}
                  </span>
                }
              />
              <Row
                label="Capture runtime"
                control={
                  <span className="ws-mono ws-muted">
                    {capture
                      ? [
                          capture.is_recording ? (capture.paused ? "paused" : "recording") : "native",
                          `${Math.round(config.max_recording_seconds / 60)} min cap`,
                          `${capture.silence_seconds} s silence stop`,
                        ].join(" · ")
                      : NOT_RUN}
                  </span>
                }
              />
              <Row
                label="Capture device"
                control={
                  <span className="ws-mono ws-muted">{capture?.device_name ?? "no active device"}</span>
                }
              />
              <Row
                label="Pipeline"
                control={
                  <span className="ws-mono ws-muted">
                    {status?.pipeline.length
                      ? status.pipeline
                          .map((step) =>
                            step.duration_ms === null
                              ? `${step.step} ${step.state}`
                              : `${step.step} ${step.state} ${step.duration_ms}ms`,
                          )
                          .join(" · ")
                      : NOT_RUN}
                  </span>
                }
              />
            </CardRows>
          </Card>

          <Card
            title="Run a check"
            description="A full capture-to-insert pass against the current native state."
            footer={
              <>
                <Button
                  variant="primary"
                  icon={<Icon name="play" />}
                  busy={isPending}
                  disabled={isPending}
                  onClick={() => void runCheck()}
                >
                  Run check
                </Button>
                <Button
                  variant="ghost"
                  icon={<Icon name="external" />}
                  onClick={() => {
                    void invoke("open_rebuild_lab_window").catch((cause) =>
                      console.error("open_rebuild_lab_window failed:", cause),
                    );
                  }}
                >
                  Open pop-out
                </Button>
              </>
            }
          >
            <CardRows>
              <Row
                label="Session source"
                control={
                  <Select
                    value={trigger}
                    onChange={(event) => setTrigger(event.target.value)}
                    aria-label="Session source"
                  >
                    {TRIGGERS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                }
              />
              {/* The profiles this machine actually has, not three sample
                  names. What the runtime does with the choice is narrower than
                  the row implies and is on the §2.5 list: the slice RECORDS the
                  profile on the result and decodes its rules from the ACTIVE
                  profile's work mode, so picking another one labels the run
                  without changing it. */}
              <Row
                label="Text profile"
                control={
                  <Select
                    value={profileId}
                    onChange={(event) => setProfileId(event.target.value)}
                    aria-label="Text profile"
                  >
                    {config.text_profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </Select>
                }
              />
              <Row
                label="Preview target"
                control={
                  <Select
                    value={insertTarget}
                    onChange={(event) => setInsertTarget(event.target.value)}
                    aria-label="Preview target"
                  >
                    {INSERT_TARGETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                }
              />
            </CardRows>
          </Card>

          {(error ?? status?.last_error) && (
            <Card title="Last error" description="What the diagnostic lane reported.">
              <CardRows>
                <Row layout="stack">
                  <span className="ws-mono">{error ?? status?.last_error}</span>
                </Row>
              </CardRows>
            </Card>
          )}
        </>
      )}

      {tab === "Preview" && (
        <>
          <Card
            title="Diagnostics preview"
            description="The diagnostics lane only. Not the recovery scratchpad."
          >
            <CardRows>
              <Row
                label="Target"
                control={<span className="ws-mono ws-muted">{result?.insertion.target ?? NOT_RUN}</span>}
              />
              <Row
                label="Insert mode"
                control={<span className="ws-mono ws-muted">{result?.insertion.mode ?? NOT_RUN}</span>}
              />
              <Row
                label="Fallback path"
                control={<span className="ws-mono ws-muted">{result?.insertion.fallback ?? NOT_RUN}</span>}
              />
              <Row
                label="Profile used"
                control={<span className="ws-mono ws-muted">{result?.transcript.profile ?? NOT_RUN}</span>}
              />
            </CardRows>
            {/* Raw beside transformed — a pairing, not a feature. No commit
                action follows it here: a commit control in Diagnostics would
                commit a session nobody dictated. */}
            <CardRows>
              <Row layout="stack">
                <Diff>
                  <DiffPane side="in" title="Raw">
                    {result?.transcript.raw_text ?? "No check has run in this session."}
                  </DiffPane>
                  <DiffPane side="out" title="Cleanup">
                    {result
                      ? markChangedWords(result.transcript.raw_text, result.transcript.final_text)
                      : "No check has run in this session."}
                  </DiffPane>
                </Diff>
              </Row>
            </CardRows>
          </Card>

          <Card title="Decoded transform rules" description="Rules from recent entries, translated.">
            <CheckList items={ruleChecks} />
          </Card>
        </>
      )}

      {tab === "Logs" && (
        <Card
          title="Runtime logs"
          description="Buffered while the runtime is active. Durable transcripts live in History."
        >
          {logs.error ? (
            <CardRows>
              <Row layout="stack">
                <span className="ws-mono">{logs.error}</span>
              </Row>
            </CardRows>
          ) : logLines.length ? (
            <Log lines={logLines} />
          ) : (
            <CardRows>
              <Row layout="stack">
                <span className="ws-muted">
                  {logs.isLoading ? "Reading the runtime buffer…" : "The runtime buffer is empty."}
                </span>
              </Row>
            </CardRows>
          )}
        </Card>
      )}
    </>
  );
}
