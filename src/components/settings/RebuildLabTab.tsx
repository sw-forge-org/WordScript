import { memo, useMemo, useState, type ReactNode } from "react";
import { FormCard, FormRow, Select, StatusBadge, type StatusTone } from "../shell";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useRuntimeLogs } from "../../hooks/useRuntimeLogs";
import { useV1Slice } from "../../hooks/useV1Slice";
import { describeTextProfileWorkMode } from "../../lib/textProfiles";
import type { AppConfig } from "../../types/ipc";
import type {
  SlicePipelineState,
  SlicePipelineStep,
  SlicePipelineStepStatus,
  SliceRuntimeContract,
  SliceStage,
} from "../../types/v1Slice";

type DiagnosticsPanel = "slice-runner" | "diagnostics-preview" | "runtime-logs";

const DIAGNOSTICS_PANELS: ReadonlyArray<{ id: DiagnosticsPanel; label: string; sub: string; aria: string }> = [
  {
    id: "slice-runner",
    label: "Slice runner",
    sub: "Run checks, snapshot, coverage and sample dictation",
    aria: "Open slice runner panel",
  },
  {
    id: "diagnostics-preview",
    label: "Diagnostics preview",
    sub: "Inspect the live transcript and insert plan",
    aria: "Open diagnostics preview panel",
  },
  {
    id: "runtime-logs",
    label: "Runtime logs",
    sub: "Read the buffered native log stream",
    aria: "Open runtime logs panel",
  },
];

const DEFAULT_TEXT = "wir shippen morgen die neue WordScript Version und brauchen klare release notes ohne Halluzinationen oder Fallback Chaos";

const TRIGGER_OPTIONS = [
  { value: "hold_to_talk", label: "Hold to talk" },
  { value: "tap_to_toggle", label: "Tap to toggle" },
  { value: "diagnostic_demo", label: "Diagnostics demo" },
] as const;

const PROFILE_OPTIONS = [
  { value: "developer", label: "Developer notes" },
  { value: "general", label: "General writing" },
  { value: "support", label: "Support reply" },
] as const;

const INSERT_TARGET_OPTIONS = [
  { value: "editor_preview", label: "Editor preview" },
  { value: "clipboard_preview", label: "Clipboard fallback preview" },
] as const;

function stageLabel(stage: SliceStage | undefined) {
  switch (stage) {
    case "idle":
      return "Idle";
    case "capturing":
      return "Capturing";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

function pipelineStepLabel(step: SlicePipelineStep) {
  switch (step) {
    case "capture":
      return "Capture";
    case "provider":
      return "Provider";
    case "transform":
      return "Transform";
    case "insert":
      return "Insert";
    default:
      return "Pipeline step";
  }
}

function pipelineStateLabel(state: SlicePipelineState) {
  switch (state) {
    case "idle":
      return "Idle";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return "Unknown";
  }
}

function pipelineDurationLabel(durationMs: number | null) {
  return durationMs === null ? "Duration pending" : `${durationMs} ms`;
}

function pipelineTone(step: SlicePipelineStepStatus): StatusTone {
  return step.state === "failed" ? "warning" : "neutral";
}

const RL_TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-border bg-surface-strong px-3 py-2 font-mono text-[12px] text-foreground outline-none transition-colors placeholder:text-fg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-surface-strong px-2.5 py-0.5 text-[11px] text-fg-dim">{children}</span>;
}

function MetaRow({ label, value, divider = true }: { label: string; value: ReactNode; divider?: boolean }) {
  return (
    <FormRow
      label={label}
      divider={divider}
      control={<span className="text-right text-[12px] text-fg-dim">{value}</span>}
    />
  );
}

function DiagItem({
  title,
  tone = "neutral",
  lines,
}: {
  title: ReactNode;
  tone?: StatusTone;
  lines: ReactNode[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
      <StatusBadge tone={tone} dot>
        {title}
      </StatusBadge>
      <div className="mt-2 flex flex-col gap-0.5 text-[12px] leading-snug text-fg-dim">
        {lines.map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>
    </div>
  );
}

function humanizeValue(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function optionLabel(options: ReadonlyArray<{ value: string; label: string }>, value: string | null | undefined, fallback: string) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

interface AppliedRuleInfo {
  id: string;
  label: string;
  description: string;
}

interface RuntimeLogRuleHint {
  entry: string;
  rules: AppliedRuleInfo[];
  corrected: boolean | null;
}

function describeAppliedRule(rule: string): AppliedRuleInfo {
  if (rule.startsWith("dictionary:")) {
    return {
      id: rule,
      label: "Dictionary replacement applied",
      description: "A personal dictionary rule replaced a known phrase in the transcript.",
    };
  }

  if (rule.startsWith("snippet:")) {
    return {
      id: rule,
      label: "Snippet expansion applied",
      description: "A snippet trigger was expanded into its saved full text.",
    };
  }

  switch (rule) {
    case "trimmed_edges":
      return {
        id: rule,
        label: "Trimmed transcript edges",
        description: "Leading and trailing whitespace was removed before further processing.",
      };
    case "removed_fillers":
      return {
        id: rule,
        label: "Removed filler words",
        description: "Common spoken fillers such as ähm, äh or um were removed from the transcript.",
      };
    case "collapsed_whitespace":
      return {
        id: rule,
        label: "Collapsed repeated spaces",
        description: "Repeated whitespace was normalized to a single spacing pass.",
      };
    case "capitalized_sentence_start":
      return {
        id: rule,
        label: "Capitalized sentence start",
        description: "The transcript start was normalized to sentence case.",
      };
    case "added_terminal_punctuation":
      return {
        id: rule,
        label: "Added final punctuation",
        description: "A trailing period or equivalent closing punctuation was added.",
      };
    case "empty_transcription":
      return {
        id: rule,
        label: "No usable transcript",
        description: "The transcription stage returned no usable text.",
      };
    case "hallucination_filtered":
      return {
        id: rule,
        label: "Hallucination filtered",
        description: "The runtime rejected the transcript because it matched a known hallucination pattern.",
      };
    case "char_repetition_collapsed":
      return {
        id: rule,
        label: "Collapsed a stuck character run",
        description:
          "A short character cluster repeated far past any plausible emphasis was shortened. This is the signature of a decoder that got stuck.",
      };
    case "word_repetition_collapsed":
      return {
        id: rule,
        label: "Collapsed a repeated word",
        description:
          "The same word repeated four or more times in a row was reduced to one. Doubled words for emphasis are left alone.",
      };
    case "phrase_repetition_collapsed":
      return {
        id: rule,
        label: "Collapsed an echoed phrase",
        description:
          "A whole phrase repeated back to back was reduced to a single occurrence, the classic Whisper repetition loop.",
      };
    case "artifact_pattern_filtered":
      return {
        id: rule,
        label: "Removed subtitle boilerplate",
        description:
          "A line matched broadcaster or platform subtitle boilerplate that Whisper emits over silence, such as a ZDF subtitling credit.",
      };
    case "language_switch_flagged":
      return {
        id: rule,
        label: "Language switch observed",
        description:
          "A passage was written in a different script than the profile language. Nothing was removed: a language switch is never on its own a reason to discard text.",
      };
    case "language_drift_stripped":
      return {
        id: rule,
        label: "Removed unsupported language drift",
        description:
          "A passage in another script was removed because the confidence metrics, the artifact filter or a repetition collapse independently marked it as invented.",
      };
    case "post_process_disabled":
      return {
        id: rule,
        label: "AI post-correction skipped",
        description: "Whisper output was kept as-is because AI post-correction was disabled.",
      };
    case "post_corrected":
      return {
        id: rule,
        label: "AI post-correction applied",
        description: "The correction model changed the transcript and the rewrite passed the runtime guardrails.",
      };
    case "post_correction_no_change":
      return {
        id: rule,
        label: "No AI rewrite needed",
        description: "The correction stage ran, but the resulting text stayed effectively the same.",
      };
    case "post_correction_failed_fallback":
      return {
        id: rule,
        label: "Correction request failed",
        description: "The correction model failed, so WordScript kept the original transcript.",
      };
    case "empty_correction_fallback":
      return {
        id: rule,
        label: "Empty correction rejected",
        description: "The correction model returned no text, so WordScript kept the original transcript.",
      };
    case "assistant_like_correction_rejected":
      return {
        id: rule,
        label: "Assistant-style rewrite rejected",
        description: "The correction output looked like an assistant response instead of a cleaned transcript.",
      };
    case "over_shortened_correction_rejected":
      return {
        id: rule,
        label: "Over-shortened rewrite rejected",
        description: "The correction output removed too much content compared with the original dictation.",
      };
    case "correction_guardrail_fallback":
      return {
        id: rule,
        label: "Guardrail kept original transcript",
        description: "The model returned a rewrite, but the runtime kept the safer original transcript because the output looked too risky or drifted too far.",
      };
    default:
      return {
        id: rule,
        label: humanizeValue(rule, "Applied rule"),
        description: "A runtime text-processing rule changed or validated the transcript.",
      };
  }
}

function describeCorrectionOutcome(corrected: boolean | null) {
  switch (corrected) {
    case true:
      return "AI rewrite applied in this pass";
    case false:
      return "Original transcript kept in this pass";
    default:
      return "Decoded transform rules";
  }
}

function localPromptStrengthLabel(value: string | null | undefined) {
  switch (value) {
    case "off":
      return "Prompt bias off";
    case "profile":
      return "Prompt bias profile";
    case "profile_and_terms":
      return "Prompt bias profile + terms";
    default:
      return null;
  }
}

function runtimeProviderLabel(runtimeContract: SliceRuntimeContract | null | undefined, fallback: string | null | undefined) {
  if (runtimeContract?.provider_profile) {
    return humanizeValue(runtimeContract.provider_profile, "Runtime provider");
  }

  return humanizeValue(fallback, "Cloud Fast");
}

function providerReadinessLabel(runtimeContract: SliceRuntimeContract | null | undefined) {
  if (!runtimeContract) {
    return "Unknown";
  }

  return runtimeContract.provider_status.ready ? "Ready" : "Needs attention";
}

function captureRuntimeLabel(runtimeContract: SliceRuntimeContract | null | undefined) {
  const capture = runtimeContract?.capture_status;

  if (!capture) {
    return "Unknown";
  }
  if (capture.is_recording && capture.paused) {
    return "Recording paused";
  }
  if (capture.is_recording) {
    return capture.muted ? "Recording muted" : "Recording live";
  }

  return "Idle";
}

function localSetupReadinessLabel(readiness: string | null | undefined) {
  switch (readiness) {
    case "ready":
      return "Local setup ready";
    case "setup_required":
      return "Local setup required";
    default:
      return "Local setup unknown";
  }
}

function describeRuntimeDraftDifferences(
  runtimeContract: SliceRuntimeContract | null | undefined,
  config: AppConfig,
): string[] {
  if (!runtimeContract) {
    return [];
  }

  const differences: string[] = [];
  if (runtimeContract.provider !== config.provider) {
    differences.push(
      `Provider runtime ${humanizeValue(runtimeContract.provider, "unknown")} differs from unsaved draft ${humanizeValue(config.provider, "unknown")}.`,
    );
  }

  const runtimeLocal = runtimeContract.local_preview;
  if (!runtimeLocal || config.provider !== "local_preview") {
    return differences;
  }

  if (runtimeLocal.provider_profile !== config.local_profile) {
    differences.push(`Profile runtime ${runtimeLocal.provider_profile} differs from unsaved draft ${config.local_profile}.`);
  }
  if (runtimeLocal.prompt_strength !== config.local_prompt_strength) {
    differences.push(
      `Prompt bias runtime ${localPromptStrengthLabel(runtimeLocal.prompt_strength) ?? runtimeLocal.prompt_strength} differs from unsaved draft ${localPromptStrengthLabel(config.local_prompt_strength) ?? config.local_prompt_strength}.`,
    );
  }
  if (runtimeLocal.prompt_carry !== config.local_prompt_carry) {
    differences.push(
      `Prompt carry runtime ${runtimeLocal.prompt_carry ? "enabled" : "disabled"} differs from unsaved draft ${config.local_prompt_carry ? "enabled" : "disabled"}.`,
    );
  }
  if (runtimeLocal.beam_size !== config.local_beam_size) {
    differences.push(`Beam size runtime ${runtimeLocal.beam_size} differs from unsaved draft ${config.local_beam_size}.`);
  }
  if (runtimeLocal.best_of !== config.local_best_of) {
    differences.push(`Best of runtime ${runtimeLocal.best_of} differs from unsaved draft ${config.local_best_of}.`);
  }

  return differences;
}

function parseRuntimeLogRuleHints(entries: string[]): RuntimeLogRuleHint[] {
  return entries
    .filter((entry) => entry.includes(" rules="))
    .slice(-5)
    .flatMap((entry) => {
      const rulesMatch = entry.match(/\brules=([^\s]*)/);

      if (!rulesMatch) return [];

      const ruleIds = rulesMatch[1]
        .split(",")
        .map((rule) => rule.trim())
        .filter(Boolean);

      if (!ruleIds.length) return [];

      const correctedMatch = entry.match(/\bcorrected=(true|false)/);

      return [
        {
          entry,
          rules: ruleIds.map(describeAppliedRule),
          corrected: correctedMatch ? correctedMatch[1] === "true" : null,
        },
      ];
    });
}

interface RuntimeRuleHintListProps {
  hints: RuntimeLogRuleHint[];
}

const RuntimeRuleHintList = memo(function RuntimeRuleHintList({ hints }: RuntimeRuleHintListProps) {
  if (!hints.length) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-3">
      <div>
        <strong className="text-[13px] font-semibold text-foreground">Decoded transform rules</strong>
        <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
          Raw logs stay unchanged in the textarea above. Known transform rules from recent entries are translated here for
          faster reading.
        </p>
      </div>
      {hints.map((hint, index) => (
        <div key={`${hint.entry}-${index}`} className="rounded-lg border border-border bg-surface px-3.5 py-3">
          <strong className="text-[12px] font-semibold text-foreground">{describeCorrectionOutcome(hint.corrected)}</strong>
          <p className="mt-0.5 font-mono text-[11px] leading-snug text-fg-muted">{hint.entry}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hint.rules.map((rule) => (
              <span
                key={`${hint.entry}:${rule.id}`}
                title={rule.id}
                className="rounded-full bg-surface-strong px-2.5 py-0.5 text-[11px] text-fg-dim"
              >
                {rule.label}
              </span>
            ))}
          </div>
          <div className="mt-2.5 grid gap-2">
            {hint.rules.map((rule) => (
              <div key={`${hint.entry}:${rule.id}:details`}>
                <strong className="text-[12px] font-semibold text-foreground">{rule.label}</strong>
                <p className="mt-0.5 text-[12px] leading-snug text-fg-dim">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

interface RebuildLabTabProps {
  isActive: boolean;
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

export function RebuildLabTab({ isActive, config, onChange }: RebuildLabTabProps) {
  const { status, result, error, isPending, refresh, startCapture, completeCapture, reset } = useV1Slice();
  const runtimeLogs = useRuntimeLogs(isActive);
  const [trigger, setTrigger] = useState("hold_to_talk");
  const [profile, setProfile] = useState("developer");
  const [insertTarget, setInsertTarget] = useState("editor_preview");
  const [rawText, setRawText] = useState(DEFAULT_TEXT);
  const [editorValue, setEditorValue] = useState("");
  const [activePanel, setActivePanel] = useState<DiagnosticsPanel>("slice-runner");

  const capabilityText = useMemo(() => {
    if (!status) return [];
    return [
      status.capabilities.cloud_transcription ? "Cloud path ready" : "Cloud path pending",
      status.capabilities.typed_contracts ? "Typed contracts active" : "Typed contracts pending",
      status.capabilities.insertion_fallback ? "Fallback path ready" : "Fallback missing",
      status.capabilities.rebuild_lab ? "Diagnostics unlocked" : "Diagnostics pending",
    ];
  }, [status]);
  const transcriptRules = useMemo(
    () => (result?.transcript.applied_rules ?? []).map(describeAppliedRule),
    [result?.transcript.applied_rules],
  );
  const runtimeRuleHints = useMemo(
    () => parseRuntimeLogRuleHints(runtimeLogs.entries),
    [runtimeLogs.entries],
  );
  const runtimeContract = status?.runtime_contract ?? null;
  const runtimeLocalPreview = runtimeContract?.local_preview ?? null;
  const runtimeProviderStatus = runtimeContract?.provider_status ?? null;
  const runtimeCaptureStatus = runtimeContract?.capture_status ?? null;
  const runtimeLocalSetup = runtimeProviderStatus?.local_setup ?? null;
  const runtimeWorkModeLabel = runtimeContract?.work_mode
    ? describeTextProfileWorkMode({ work_mode: runtimeContract.work_mode })
    : "No active work mode";
  const runtimeDraftDifferences = describeRuntimeDraftDifferences(runtimeContract, config);

  const stage = status?.stage;
  const runtimeLogText = useMemo(
    () => (runtimeLogs.entries.length ? runtimeLogs.entries.join("\n") : "No runtime logs yet."),
    [runtimeLogs.entries],
  );
  const canStartSession = !isPending && stage !== "capturing" && stage !== "processing";
  const canCompleteSession = !isPending && stage === "capturing";
  const previewTranscript = result?.transcript.final_text ?? status?.last_transcript ?? "No transcript yet.";
  const previewProfileLabel = optionLabel(
    PROFILE_OPTIONS,
    result?.transcript.profile ?? profile,
    humanizeValue(result?.transcript.profile ?? profile, "Developer"),
  );
  const previewTargetLabel = optionLabel(
    INSERT_TARGET_OPTIONS,
    result?.insertion.target ?? insertTarget,
    humanizeValue(result?.insertion.target ?? insertTarget, "Editor preview"),
  );
  const previewModeLabel = humanizeValue(result?.insertion.mode, "Pending");
  const previewFallbackLabel = humanizeValue(result?.insertion.fallback, "Clipboard fallback planned");

  const appendPreview = (text: string) => {
    setEditorValue((current) => (current ? `${current}\n${text}` : text));
  };

  const handleStart = async () => {
    await startCapture({ trigger });
  };

  const handleComplete = async () => {
    const next = await completeCapture({
      raw_text: rawText,
      insert_target: insertTarget,
      profile,
    });

    if (next) {
      appendPreview(next.transcript.final_text);
    }
  };

  const handleRunDemo = async () => {
    await reset();
    const started = await startCapture({ trigger });
    if (!started) return;

    const next = await completeCapture({
      raw_text: rawText,
      insert_target: insertTarget,
      profile,
    });

    if (next) {
      appendPreview(next.transcript.final_text);
    }
  };

  const handleReset = async () => {
    await reset();
    setEditorValue("");
  };

  const handleLoadSample = () => {
    setRawText(DEFAULT_TEXT);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="px-1">
          <strong className="text-[15px] font-semibold text-foreground">Diagnostics</strong>
          <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
            Native control room for capture, transform, recovery, insert and log inspection. Switch between the live
            diagnostic panels without leaving the settings shell.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Diagnostics workspace"
          className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface p-1"
        >
          {DIAGNOSTICS_PANELS.map((tab) => {
            const active = activePanel === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-label={tab.aria}
                aria-selected={active}
                onClick={() => setActivePanel(tab.id)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-[7px] px-3 py-2 text-left",
                  active ? "bg-card" : "hover:bg-[rgba(255,255,255,0.04)]",
                )}
              >
                <span className={cn("text-[13px] font-medium", active ? "text-foreground" : "text-fg-dim")}>
                  {tab.label}
                </span>
                <span className="text-[11px] text-fg-muted">{tab.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activePanel === "slice-runner" && (
        <div className="flex flex-col gap-8">
          <FormCard
            title="Runtime checks"
            description="Run a full capture-to-insert check, inspect the current native state and confirm which fallback path the runtime will use right now."
            bodyClassName="py-4"
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void refresh()}>
                  Refresh status
                </Button>
                <Button size="sm" disabled={isPending} onClick={() => void handleRunDemo()}>
                  Run end-to-end check
                </Button>
              </div>
            }
          >
            <p className="text-[12px] leading-snug text-fg-muted">
              Diagnostics is the native control room for capture, transform, recovery and insert. Use it to verify the live
              runtime path without leaving the settings shell.
            </p>
          </FormCard>

          <FormCard title="Runtime snapshot">
        <FormRow
          label="Stage"
          control={
            <StatusBadge tone={status?.stage === "completed" ? "success" : "neutral"} dot>
              {stageLabel(status?.stage)}
            </StatusBadge>
          }
        />
        <MetaRow label="Active session" value={status?.session_id ?? "No session armed"} />
        <MetaRow
          label="Session source"
          value={optionLabel(TRIGGER_OPTIONS, status?.active_trigger, humanizeValue(status?.active_trigger, "Not armed"))}
        />
        <MetaRow label="Transcription path" value={runtimeProviderLabel(runtimeContract, status?.preferred_provider)} />
        <MetaRow label="Runtime model" value={runtimeContract?.model ?? "No runtime model loaded"} />
        <MetaRow label="Provider readiness" value={providerReadinessLabel(runtimeContract)} />
        <MetaRow label="Work mode" value={runtimeWorkModeLabel} />
        <MetaRow label="Capture runtime" value={captureRuntimeLabel(runtimeContract)} />
        <MetaRow label="Capture device" value={runtimeCaptureStatus?.device_name ?? "No active device"} />
        <MetaRow
          label="Pipeline"
          value={humanizeValue(status?.architecture_mode, "Native Runtime Slice")}
          divider={Boolean(status?.pipeline.length) || isPending}
        />
        {!!status?.pipeline.length && (
          <div className="flex flex-col gap-2 py-3">
            {status.pipeline.map((step) => (
              <DiagItem
                key={step.step}
                title={`${pipelineStepLabel(step.step)} · ${pipelineStateLabel(step.state)}`}
                tone={pipelineTone(step)}
                lines={[
                  pipelineDurationLabel(step.duration_ms),
                  ...(step.error_code ? [`Error code: ${step.error_code}`] : []),
                  ...(step.detail ? [step.detail] : []),
                ]}
              />
            ))}
          </div>
        )}
        {isPending && <p className="py-3 text-[12px] text-fg-muted">Refreshing native runtime status…</p>}
      </FormCard>

      {(runtimeLocalPreview || config.provider === "local_preview") && (
        <FormCard
          title="Local runtime contract"
          description="This contract comes from the native runtime snapshot. Unsaved changes in this window do not change the running contract until you save settings."
          bodyClassName="py-4"
        >
          <div className="flex flex-col gap-3">
            {runtimeLocalPreview ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Chip>{runtimeLocalPreview.provider_profile}</Chip>
                  <Chip>{localPromptStrengthLabel(runtimeLocalPreview.prompt_strength) ?? "Prompt bias unknown"}</Chip>
                  <Chip>{runtimeLocalPreview.prompt_carry ? "Carry initial prompt" : "Do not carry prompt"}</Chip>
                  <Chip>{`Beam ${runtimeLocalPreview.beam_size}`}</Chip>
                  <Chip>{`Best of ${runtimeLocalPreview.best_of}`}</Chip>
                </div>
                <p className="text-[12px] leading-snug text-fg-muted">
                  These values are currently active in the native runtime and flow into local runtime requests and
                  transcription history.
                </p>
                {runtimeLocalSetup && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip>{localSetupReadinessLabel(runtimeLocalSetup.readiness)}</Chip>
                      <Chip>{runtimeLocalSetup.runner_ready ? "Runner ready" : "Runner missing"}</Chip>
                      <Chip>{runtimeLocalSetup.model_ready ? "Model ready" : "Model missing"}</Chip>
                      <Chip>{runtimeLocalSetup.chat_ready ? "Cleanup ready" : "Cleanup missing"}</Chip>
                    </div>
                    <div className="flex flex-col gap-2">
                      {[
                        { title: "Resolved runner", value: runtimeLocalSetup.resolved_runner ?? "Not resolved" },
                        { title: "Resolved model", value: runtimeLocalSetup.resolved_model ?? "Not resolved" },
                        { title: "Resolved cleanup endpoint", value: runtimeLocalSetup.resolved_chat_base_url ?? "Not resolved" },
                        { title: "Resolved cleanup model", value: runtimeLocalSetup.resolved_chat_model ?? "Not resolved" },
                      ].map((item) => (
                        <DiagItem
                          key={item.title}
                          title={item.title}
                          tone={runtimeProviderStatus?.ready ? "neutral" : "warning"}
                          lines={[item.value]}
                        />
                      ))}
                      {runtimeLocalSetup.issue_code && (
                        <DiagItem
                          title="Provider issue"
                          tone="warning"
                          lines={[humanizeValue(runtimeLocalSetup.issue_code, runtimeLocalSetup.issue_code)]}
                        />
                      )}
                      <DiagItem
                        title="Setup guidance"
                        tone={runtimeProviderStatus?.ready ? "neutral" : "warning"}
                        lines={[runtimeLocalSetup.guidance]}
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-[12px] leading-snug text-fg-muted">
                The native runtime is not currently using the local runtime lane.
              </p>
            )}
            {runtimeDraftDifferences.length > 0 && (
              <div className="flex flex-col gap-2">
                {runtimeDraftDifferences.map((difference) => (
                  <DiagItem key={difference} title="Unsaved draft differs from runtime" tone="warning" lines={[difference]} />
                ))}
              </div>
            )}
            {config.provider === "local_preview" && (
              <div>
                <strong className="text-[12px] font-semibold text-foreground">Draft in this window</strong>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip>{config.local_profile}</Chip>
                  <Chip>{localPromptStrengthLabel(config.local_prompt_strength) ?? "Prompt bias unknown"}</Chip>
                  <Chip>{config.local_prompt_carry ? "Carry initial prompt" : "Do not carry prompt"}</Chip>
                  <Chip>{`Beam ${config.local_beam_size}`}</Chip>
                  <Chip>{`Best of ${config.local_best_of}`}</Chip>
                </div>
              </div>
            )}
          </div>
        </FormCard>
      )}

      <FormCard title="Coverage" bodyClassName="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {capabilityText.map((item) => (
              <Chip key={item}>{item}</Chip>
            ))}
          </div>
          {(status?.next_milestones ?? []).length > 0 && (
            <div className="flex flex-col gap-2">
              {(status?.next_milestones ?? []).map((item) => (
                <DiagItem key={item} title="Next" tone="warning" lines={[item]} />
              ))}
            </div>
          )}
          {!status?.next_milestones?.length && (
            <p className="text-[12px] leading-snug text-fg-muted">
              No pending milestones were reported by the runtime snapshot.
            </p>
          )}
        </div>
      </FormCard>

      <FormCard title="Run a diagnostic" bodyClassName="py-1">
        <FormRow
          label="Session source"
          control={
            <Select aria-label="Session source" className="w-[220px]" value={trigger} onChange={(event) => setTrigger(event.target.value)}>
              {TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          }
        />
        <FormRow
          label="Text profile"
          control={
            <Select aria-label="Text profile" className="w-[220px]" value={profile} onChange={(event) => setProfile(event.target.value)}>
              {PROFILE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          }
        />
        <FormRow
          label="Preview target"
          divider={false}
          control={
            <Select aria-label="Preview target" className="w-[220px]" value={insertTarget} onChange={(event) => setInsertTarget(event.target.value)}>
              {INSERT_TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          }
        />
      </FormCard>

      <FormCard title="Sample dictation" bodyClassName="py-4">
        <div className="flex flex-col gap-3">
          <textarea className={RL_TEXTAREA_CLASS} value={rawText} onChange={(event) => setRawText(event.target.value)} rows={5} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleLoadSample}>
              Load sample text
            </Button>
            <Button size="sm" variant="outline" disabled={!canStartSession} onClick={() => void handleStart()}>
              Start capture
            </Button>
            <Button size="sm" variant="outline" disabled={!canCompleteSession} onClick={() => void handleComplete()}>
              Complete step
            </Button>
            <Button size="sm" disabled={isPending} onClick={() => void handleRunDemo()}>
              Run end-to-end
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => void handleReset()}>
              Reset diagnostics
            </Button>
          </div>
          <p className="text-[12px] leading-snug text-fg-muted">
            Start capture opens a fresh native session. Complete step resolves the current session with the sample text
            below. End-to-end does both in one go and appends the final insert preview.
          </p>
        </div>
      </FormCard>
        </div>
      )}

      {activePanel === "diagnostics-preview" && (
        <div className="flex flex-col gap-8">
          <FormCard
            title="Diagnostics Preview"
            description="This preview belongs to the active diagnostics lane in this window. It is not the recovery scratchpad from Input."
            bodyClassName="py-4"
            action={
              <div className="flex flex-wrap gap-1.5">
                <Chip>{previewProfileLabel}</Chip>
                <Chip>{previewTargetLabel}</Chip>
                <Chip>{previewModeLabel}</Chip>
                <Chip>{runtimeWorkModeLabel}</Chip>
              </div>
            }
          >
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">Transcript</span>
                  <p className="mt-1 text-[13px] leading-snug text-foreground">{previewTranscript}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">Insert plan</span>
                  <div className="mt-2 flex flex-col gap-2">
                    <DiagItem title="Target" lines={[previewTargetLabel]} />
                    <DiagItem title="Insert mode" lines={[previewModeLabel]} />
                    <DiagItem title="Fallback path" lines={[previewFallbackLabel]} />
                  </div>
                </div>
              </div>

              <div>
                <strong className="text-[12px] font-semibold text-foreground">Preview editor</strong>
                <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                  This editor mirrors the current insert plan. It is diagnostic, but it already reflects the real fallback
                  contract coming back from the native runtime.
                </p>
                <textarea
                  className={cn(RL_TEXTAREA_CLASS, "mt-2")}
                  value={editorValue}
                  onChange={(event) => setEditorValue(event.target.value)}
                  rows={8}
                  placeholder="No preview text yet."
                />
              </div>

              <MetaRow label="Profile used" value={previewProfileLabel} divider={false} />

              {transcriptRules.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {transcriptRules.map((rule) => (
                    <span key={rule.id} title={rule.id} className="rounded-full bg-surface-strong px-2.5 py-0.5 text-[11px] text-fg-dim">
                      {rule.label}
                    </span>
                  ))}
                </div>
              )}
              {transcriptRules.length > 0 && (
                <div className="grid gap-2.5">
                  {transcriptRules.map((rule) => (
                    <div key={rule.id}>
                      <strong className="text-[12px] font-semibold text-foreground">{rule.label}</strong>
                      <p className="mt-0.5 text-[12px] leading-snug text-fg-dim">{rule.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormCard>
        </div>
      )}

      {activePanel === "runtime-logs" && (
        <div className="flex flex-col gap-8">
          <FormCard
            title="Runtime Logs"
            description="Structured native logs stay enabled and are buffered here for fast inspection while the runtime is active. The durable transcript record lives in the History area."
            bodyClassName="py-4"
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={runtimeLogs.isLoading} onClick={() => void runtimeLogs.refresh()}>
                  Refresh logs
                </Button>
                <Button size="sm" variant="ghost" disabled={runtimeLogs.isLoading || !runtimeLogs.entries.length} onClick={() => void runtimeLogs.clear()}>
                  Clear logs
                </Button>
              </div>
              <textarea className={cn(RL_TEXTAREA_CLASS, "font-mono text-[12px]")} value={runtimeLogText} readOnly rows={10} />
              <RuntimeRuleHintList hints={runtimeRuleHints} />
              <p className={cn("text-[12px] leading-snug", runtimeLogs.error ? "text-danger" : "text-fg-muted")}>
                {runtimeLogs.error ?? `${runtimeLogs.entries.length} runtime log entries buffered.`}
              </p>
            </div>
          </FormCard>
        </div>
      )}

      {(error || status?.last_error) && (
        <p className="text-[12px] leading-snug text-danger">{error ?? status?.last_error}</p>
      )}
    </div>
  );
}