import { memo, useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShortcutField } from "./ShortcutField";
import { readTriggerStatus } from "../../lib/shortcuts";
import { FormCard, FormRow, Select, StatusBadge, Stepper, Toggle } from "../shell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import {
  buildProfileModesPatch,
  buildTextProfilesPatch,
  clearTextProfileCuration,
  resolveActiveTextProfile,
  resolveProfileModesSettings,
} from "../../lib/textProfiles";
import type { AppConfig, NativeTriggerStatus, ProcessingMode, EnhanceSubMode, PromptTarget, TextProfile, TextProfileWorkMode } from "../../types/ipc";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}

interface ResolvedProcessingContext {
  mode: ProcessingMode;
  is_override: boolean;
  auto_detected: boolean;
  detected_from: string | null;
}

const MODE_LABELS: Record<ProcessingMode, string> = {
  auto: "Auto",
  verbatim: "Verbatim",
  cleanup: "Cleanup",
  rewrite: "Rewrite",
  agent: "Agent",
  prompt_enhance: "Prompt Enhance",
};

// Each mode is a fixed preset. There are no sub-settings for cleanup behavior
// because the mode *is* the setting — so these descriptions are the only place
// the behavior is stated, and they have to state it precisely.
const MODE_DESCRIPTIONS: Record<ProcessingMode, string> = {
  auto: "Picks Cleanup, Agent or Prompt Enhance per dictation, from the transcript and the workspace context. Never picks Verbatim or Rewrite — those stay your call.",
  verbatim: "No AI processing at all. Only your text rules (dictionary, snippets) are applied. Manual only.",
  cleanup: "Removes filler sounds and fixes typos, grammar and punctuation. Stays close to your phrasing.",
  rewrite: "Cleanup plus rephrasing for clearer, more professional language. Manual only — never auto-selected.",
  agent: "WordScript executes what you dictate as an instruction to it (e.g. \"Hey WordScript, write an email…\").",
  prompt_enhance: "Structures raw dictation into a well-formed AI prompt for external tools (Claude Code, Cursor, …).",
};

const SUB_MODE_LABELS: Record<EnhanceSubMode, string> = {
  enhance: "Enhance — Polish without bloat. Role, constraints, format hints.",
  expand: "Expand — Full restructure. CoT, step-by-step, audience, output format.",
};

const TARGET_OPTIONS: { value: PromptTarget; label: string }[] = [
  { value: "general", label: "General" },
  { value: "claude_code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "copilot", label: "Copilot" },
];

// Maps each processing mode to its dedicated per-mode hotkey config field.
const MODE_HOTKEY_FIELDS = {
  auto: "mode_auto_hotkey",
  verbatim: "mode_verbatim_hotkey",
  cleanup: "mode_cleanup_hotkey",
  rewrite: "mode_rewrite_hotkey",
  agent: "mode_agent_hotkey",
  prompt_enhance: "mode_prompt_enhance_hotkey",
} as const satisfies Record<ProcessingMode, keyof AppConfig>;

function processingModeLabel(mode: ProcessingMode): string {
  return MODE_LABELS[mode] ?? mode;
}

export const ModesTab = memo(function ModesTab({ config, onChange }: Props) {
  const activeProfile = resolveActiveTextProfile(config);
  const activeWorkMode = activeProfile.work_mode;
  const modes = resolveProfileModesSettings(activeProfile);
  const selectedMode: ProcessingMode = activeWorkMode?.processing_mode ?? "auto";
  const selectedSubMode: EnhanceSubMode = activeWorkMode?.enhance_sub_mode ?? "enhance";
  const selectedTarget: PromptTarget = activeWorkMode?.target ?? "general";
  const collectWorkspaceContext = modes.collect_workspace_context;
  const modePickerHotkey = config.mode_picker_hotkey ?? "";

  const [resolved, setResolved] = useState<ResolvedProcessingContext | null>(null);

  const fetchResolved = useCallback(async () => {
    try {
      const ctx = await invoke<ResolvedProcessingContext>("resolve_current_processing_mode");
      setResolved(ctx);
    } catch {
      setResolved(null);
    }
  }, []);

  useEffect(() => {
    void fetchResolved();
  }, [fetchResolved, selectedMode, config.active_text_profile_id, collectWorkspaceContext]);

  // Write the processing mode into the active profile's work_mode, not the
  // global config field. This is the same pattern the Prompts tab uses for
  // rewrite_style, insert_behavior, etc. — each profile carries its own mode
  // default, and the global `config.processing_mode` is only the serde
  // fallback for pre-migration configs.
  const updateActiveProfileWorkMode = useCallback(
    (updater: (workMode: NonNullable<TextProfileWorkMode>) => NonNullable<TextProfileWorkMode>) => {
      const currentWorkMode: NonNullable<TextProfileWorkMode> = activeWorkMode ?? {
        rewrite_style: "clean",
        insert_behavior: "auto_paste",
        recovery_behavior: "standard",
        processing_mode: "auto",
        enhance_sub_mode: null,
        target: null,
      };
      const nextProfiles = config.text_profiles.map((profile) =>
        profile.id === activeProfile.id
          ? clearTextProfileCuration({ ...profile, work_mode: updater(currentWorkMode) })
          : profile,
      );
      onChange(buildTextProfilesPatch(config, nextProfiles, activeProfile.id));
    },
    [activeProfile.id, activeWorkMode, config, onChange],
  );

  const handleSetMode = useCallback((next: ProcessingMode) => {
    updateActiveProfileWorkMode((wm) => ({ ...wm, processing_mode: next }));
  }, [updateActiveProfileWorkMode]);

  const handleSetSubMode = useCallback((next: EnhanceSubMode) => {
    updateActiveProfileWorkMode((wm) => ({ ...wm, enhance_sub_mode: next }));
  }, [updateActiveProfileWorkMode]);

  const handleSetTarget = useCallback((next: PromptTarget) => {
    updateActiveProfileWorkMode((wm) => ({ ...wm, target: next }));
  }, [updateActiveProfileWorkMode]);

  const handleToggleWorkspaceContext = useCallback((next: boolean) => {
    onChange(buildProfileModesPatch(config, { collect_workspace_context: next }));
  }, [config, onChange]);

  const handleModePickerHotkey = useCallback((value: string) => {
    onChange({ mode_picker_hotkey: value });
  }, [onChange]);

  const handlePerModeHotkey = useCallback((mode: ProcessingMode, value: string) => {
    onChange({ [MODE_HOTKEY_FIELDS[mode]]: value });
  }, [onChange]);

  // Mode hotkeys carry the same runtime truth as capture shortcuts: whether
  // the OS actually accepted them (T8). Previously this surface showed only
  // the configured value and called no suspend/resume at all, so pressing a
  // live mode shortcut while recording fired the mode action instead of being
  // captured (D3).
  const [triggerStatus, setTriggerStatus] = useState<NativeTriggerStatus | null>(null);

  const refreshTriggerStatus = useCallback(() => {
    void readTriggerStatus()
      .then(setTriggerStatus)
      .catch(() => setTriggerStatus(null));
  }, []);

  useEffect(() => {
    refreshTriggerStatus();
  }, [refreshTriggerStatus]);

  const bindingFor = useCallback(
    (label: string) => triggerStatus?.bindings.find((binding) => binding.label === label),
    [triggerStatus],
  );

  const otherModeValues = useCallback(
    (self: string) => {
      const entries: Array<[string, string]> = [
        ["mode_picker", config.mode_picker_hotkey ?? ""],
        ...(Object.keys(MODE_HOTKEY_FIELDS) as ProcessingMode[]).map(
          (mode) => [mode, (config[MODE_HOTKEY_FIELDS[mode]] as string | undefined) ?? ""] as [string, string],
        ),
        ["capture", config.hotkey],
        ["pause", config.pause_hotkey],
        ["abort", config.abort_hotkey],
      ];
      return entries
        .filter(([label, value]) => label !== self && Boolean(value))
        .map(([, value]) => value);
    },
    [config],
  );

  const precedenceLine = resolved
    ? resolved.is_override
      ? `Runtime override: ${processingModeLabel(resolved.mode)} (wins over profile default)`
      : resolved.auto_detected
        ? `Auto mode: ${processingModeLabel(resolved.mode)} (LLM will decide per transcription)`
        : `Profile default: ${processingModeLabel(resolved.mode)}`
    : "Resolving effective mode…";

  return (
    <div className="flex flex-col gap-8">
      <FormCard
        title="Effective mode"
        description={`Which processing mode WordScript uses right now for the active profile "${activeProfile.label}". Mode defaults are stored per profile — switch profiles in the sidebar to set different defaults.`}
        bodyClassName="py-4"
      >
        <FormRow
          label="Currently effective"
          align="start"
          divider={false}
          control={
            <StatusBadge tone={resolved?.is_override ? "accent" : resolved?.auto_detected ? "info" : "neutral"} dot>
              {resolved ? processingModeLabel(resolved.mode) : "—"}
            </StatusBadge>
          }
          hint={precedenceLine}
        />
      </FormCard>

      <FormCard
        title="Processing mode"
        description={`How dictation is transformed before it is inserted. This is the default for the active profile "${activeProfile.label}". Trigger hotkeys live in Capture; mode hotkeys are further down.`}
      >
        <div role="radiogroup" aria-label="Processing mode selector" className="flex flex-col">
          {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((mode, index, arr) => {
            const checked = selectedMode === mode;
            const isLast = index === arr.length - 1;
            return (
              <div key={mode} className={cn("border-b border-border", isLast && "border-b-0")}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 py-3",
                    checked && "cursor-default",
                  )}
                >
                  <input
                    type="radio"
                    name="processing_mode"
                    value={mode}
                    checked={checked}
                    onChange={() => handleSetMode(mode)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-foreground">{processingModeLabel(mode)}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-fg-dim">{MODE_DESCRIPTIONS[mode]}</span>
                  </span>
                </label>

                {checked && mode === "prompt_enhance" && (
                  <div className="pb-4 pl-7">
                    <FormRow
                      label="Enhance sub-mode"
                      hint="Enhance polishes without bloat; Expand restructures fully."
                      control={
                        <Select
                          aria-label="Enhance sub-mode"
                          className="w-[200px]"
                          value={selectedSubMode}
                          onChange={(e) => handleSetSubMode(e.target.value as EnhanceSubMode)}
                        >
                          <option value="enhance">Enhance</option>
                          <option value="expand">Expand</option>
                        </Select>
                      }
                    />
                    <FormRow
                      label="Prompt target"
                      hint="Optimizes prompt syntax for the chosen AI tool."
                      divider={false}
                      control={
                        <Select
                          aria-label="Prompt target"
                          className="w-[200px]"
                          value={selectedTarget}
                          onChange={(e) => handleSetTarget(e.target.value as PromptTarget)}
                        >
                          {TARGET_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      }
                    />
                  </div>
                )}
                {checked && mode === "agent" && (
                  <div className="pb-4 pl-7">
                    <AgentControls config={config} onChange={onChange} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </FormCard>

      {/* There is deliberately no "Cleanup settings" card. The three toggles
          that used to sit here (AI cleanup / Remove fillers / Rewrite phrasing)
          were never observable by the runtime, and two of them only restated the
          mode axis: cleanup with AI cleanup off is Verbatim, cleanup with rewrite
          phrasing on is Rewrite. The mode is the setting — see ADR 0020. */}

      <FormCard
        title="Workspace context"
        description="When enabled, WordScript detects the active app (IDE, browser, chat, …) and passes it to every mode as a weak hint: it steers Auto's routing and gives the cleanup, rewrite and agent prompts a sense of where you are writing. It never contributes content. Turn it off to work from the transcript alone."
      >
        <FormRow
          label="Collect workspace context"
          hint="Detects the active app for this profile. Applies to every mode, not just Auto."
          htmlFor="workspace-context-toggle"
          divider={false}
          control={
            <Toggle
              id="workspace-context-toggle"
              checked={collectWorkspaceContext}
              onCheckedChange={handleToggleWorkspaceContext}
            />
          }
        />
      </FormCard>

      <FormCard
        title="Hotkeys"
          description={
            <>
              Global hotkeys for quick mode switching. The select key opens the overlay selector (press again to cycle through modes); per-mode keys jump directly.{" "}
              <span className="text-fg-muted">Trigger hotkeys (start, stop, pause, abort) live in Capture.</span>
            </>
          }
        >
          <ShortcutField
            label="Mode select"
            description="Opens the overlay mode selector; press again to cycle. Leave empty to disable."
            placeholder="Ctrl+Alt+M"
            value={modePickerHotkey}
            binding={bindingFor("mode_picker")}
            takenValues={otherModeValues("mode_picker")}
            clearable
            onCommit={handleModePickerHotkey}
            onStopRecording={refreshTriggerStatus}
          />
        {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((mode, index, arr) => (
          <ShortcutField
            key={mode}
            label={processingModeLabel(mode)}
            description={`Jumps straight to ${processingModeLabel(mode)}. Leave empty to disable.`}
            placeholder="Ctrl+Alt+1"
            value={(config[MODE_HOTKEY_FIELDS[mode]] as string | undefined) ?? ""}
            binding={bindingFor(mode)}
            takenValues={otherModeValues(mode)}
            clearable
            divider={index < arr.length - 1}
            onCommit={(value) => handlePerModeHotkey(mode, value)}
            onStopRecording={refreshTriggerStatus}
          />
        ))}
      </FormCard>

      <FormCard
        title="Mode-select overlay"
        description="How long the mode-select overlay stays visible after the first hotkey press before auto-dismissing. Press the hotkey again to cycle through modes while it is open."
      >
        <FormRow
          label="Mode-select timeout"
          hint="How long the mode-select overlay stays visible in seconds (1–30) after the first hotkey press before auto-dismissing. Press the hotkey again to cycle through modes."
          divider={false}
          control={
            <Stepper
              value={config.mode_select_timeout_s}
              min={1}
              max={30}
              step={1}
              suffix="s"
              onChange={(value) => onChange({ mode_select_timeout_s: value })}
              aria-label="Mode-select timeout"
            />
          }
        />
      </FormCard>
    </div>
  );
});

function AgentControls({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}) {
  const activeProfile = resolveActiveTextProfile(config);
  const modes = resolveProfileModesSettings(activeProfile);
  
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-3 py-3">
      <FormRow
        label="Agent name"
        hint="The name you use when addressing the agent in speech."
        htmlFor="inline-agent-name-input"
        divider={false}
        control={
          <Input
            id="inline-agent-name-input"
            type="text"
            className="w-[200px]"
            value={modes.agent_name}
            placeholder="WordScript"
            onChange={(e) => onChange(buildProfileModesPatch(config, { agent_name: e.target.value }))}
          />
        }
      />
      <p className="text-[12px] leading-snug text-fg-muted">
        The agent model is configured in Speech &amp; AI.
      </p>
    </div>
  );
}