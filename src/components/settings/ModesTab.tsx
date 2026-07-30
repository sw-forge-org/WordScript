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
import styleLexiconsData from "../../data/styleLexicons.json";
import type { AppConfig, CommunicationLength, CommunicationRegister, NativeTriggerStatus, ProcessingMode, EnhanceSubMode, ProfileModesSettings, PromptTarget, TextProfile, TextProfileWorkMode } from "../../types/ipc";

interface StyleLexicons {
  updated: string;
  languages: { code: string; label: string; entries: { term: string }[] }[];
}

const STYLE_LEXICONS = styleLexiconsData as StyleLexicons;

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}

interface ResolvedProcessingContext {
  mode: ProcessingMode;
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

// Mirrors `MAX_STYLE_RULE_CHARS` / `MAX_STYLE_SAMPLE_CHARS` in
// `core::communication_style`. A budget the user cannot see is indistinguishable
// from a bug, so the meter shows it rather than letting them discover it.
const MAX_STYLE_RULE_CHARS = 400;
const MAX_STYLE_SAMPLE_CHARS = 400;

const STYLE_TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-border bg-surface-strong px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-fg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

// Named after the addressee, or — for the lowest step — the medium. A ladder of
// formality adjectives ("formal", "formulaic", "casual", "chat") reads as four
// near-synonyms in a select; "who am I writing to" is something the user
// already knows when they dictate. See ADR 0023.
const REGISTER_OPTIONS: { value: CommunicationRegister; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "authority", label: "Authority" },
  { value: "client", label: "Client" },
  { value: "colleague", label: "Colleague" },
  { value: "friend", label: "Friend" },
  { value: "quick", label: "Quick message" },
];

// Each level is defined by properties you can count in the output, never by an
// adjective — an adjective is neither verifiable nor enforceable.
const REGISTER_DESCRIPTIONS: Record<CommunicationRegister, string> = {
  off: "No style instruction. The agent takes its tone from the dictation, exactly as before.",
  authority: "Authorities, contracts, legal text. Fixed formulas, formal address, no contractions, full salutation and sign-off.",
  client: "Applications, external customer mail, leadership. Complete sentences, formal address, full salutation and sign-off.",
  colleague: "Internal mail to the team. Complete sentences, address form follows your dictation, short salutation.",
  friend: "Private mail, team chat, friends. Familiar address, contractions, short sentences, salutation optional.",
  quick: "Short messages and group chat. No salutation, fragments, minimal punctuation, lowercase starts allowed.",
};

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

  // Two states, not three. The third read "Runtime override: X (wins over
  // profile default)" and described a process-global value that nothing ever
  // cleared, so it announced that an invisible state was beating the setting
  // right above it — with no way to clear it. The profile is the only source
  // now (ADR 0024).
  const precedenceLine = resolved
    ? resolved.auto_detected
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
            <StatusBadge tone={resolved?.auto_detected ? "info" : "neutral"} dot>
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
              </div>
            );
          })}
        </div>
      </FormCard>

      {/* Outside the mode list on purpose. These controls used to render only
          while Agent was the selected mode, but the agent name is also the
          first criterion Auto routes on ("agent name addressed with a task"),
          and Auto is the default — so the field that decides whether Auto ever
          reaches Agent was invisible in the default configuration. */}
      <AgentControls config={config} onChange={onChange} />

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
  const register = modes.communication_register;
  const styleActive = register !== "off";
  const showsLexicon = register === "friend" || register === "quick";

  const patch = useCallback(
    (next: Partial<ProfileModesSettings>) => onChange(buildProfileModesPatch(config, next)),
    [config, onChange],
  );

  const loadLexicon = useCallback(
    (code: string) => {
      const language = STYLE_LEXICONS.languages.find((entry) => entry.code === code);
      if (!language) return;
      // Written into the user's own rules, never into a hidden runtime layer.
      // They then see verbatim what goes into the prompt and can delete what
      // does not fit — a lexicon they cannot see would be the ADR 0020 defect
      // class in a new place.
      const header = `Use these expressions where they fit (${language.label}, as of ${STYLE_LEXICONS.updated}):`;
      const line = `${header} ${language.entries.map((entry) => entry.term).join(", ")}`;
      const existing = modes.style_instructions.trim();
      patch({ style_instructions: existing ? `${existing}\n${line}` : line });
    },
    [modes.style_instructions, patch],
  );

  return (
    <>
      <FormCard
        title="Agent"
        description="Who the agent is when you address it by name. The name also decides whether Auto routes a dictation into Agent mode, so it applies no matter which mode is selected."
      >
        <FormRow
          label="Agent name"
          hint="The name you use when addressing the agent in speech. Leave empty to fall back to the global name."
          htmlFor="inline-agent-name-input"
          divider={false}
          control={
            <Input
              id="inline-agent-name-input"
              type="text"
              className="w-[200px]"
              value={modes.agent_name}
              placeholder={config.agent_name || "WordScript"}
              onChange={(e) => patch({ agent_name: e.target.value })}
            />
          }
        />
        <p className="text-[12px] leading-snug text-fg-muted">
          The agent model is configured in Speech &amp; AI.
        </p>
      </FormCard>

      <FormCard
        title="Communication style"
        description="How this profile writes. Applies to Agent and to Rewrite; Cleanup, Verbatim and Prompt Enhance stay untouched. The level sets the form only — it never changes the language you dictated in."
      >
        <FormRow
          label="Writes to"
          hint={REGISTER_DESCRIPTIONS[register]}
          htmlFor="communication-register-select"
          control={
            <Select
              id="communication-register-select"
              aria-label="Communication register"
              className="w-[200px]"
              value={register}
              onChange={(e) => patch({ communication_register: e.target.value as CommunicationRegister })}
            >
              {REGISTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          }
        />

        {styleActive && (
          <>
            <FormRow
              label="Length"
              hint="Independent of the level above: formal and terse is as valid as informal and expansive."
              htmlFor="communication-length-select"
              control={
                <Select
                  id="communication-length-select"
                  aria-label="Communication length"
                  className="w-[200px]"
                  value={modes.communication_length}
                  onChange={(e) => patch({ communication_length: e.target.value as CommunicationLength })}
                >
                  <option value="terse">Terse</option>
                  <option value="normal">Normal</option>
                  <option value="full">Expansive</option>
                </Select>
              }
            />

            <div className="flex flex-col gap-2 py-3">
              <label
                className="text-[13px] font-medium text-foreground"
                htmlFor="style-instructions-textarea"
              >
                Your rules
              </label>
              <p className="text-[12px] leading-snug text-fg-muted">
                One rule per line, e.g. &quot;always use the informal address form&quot;, &quot;no emoji&quot;,
                &quot;never open with a pleasantry&quot;. <strong className="text-foreground">Rules take precedence
                over the level above.</strong> They describe how to write, never what to write.
              </p>
              <textarea
                id="style-instructions-textarea"
                className={STYLE_TEXTAREA_CLASS}
                aria-label="Style rules"
                rows={4}
                value={modes.style_instructions}
                placeholder={"no emoji\nkeep it under five sentences"}
                onChange={(e) => patch({ style_instructions: e.target.value })}
              />
              <BudgetLine used={modes.style_instructions.trim().length} max={MAX_STYLE_RULE_CHARS} />
            </div>

            <div className="flex flex-col gap-2 py-3">
              <label
                className="text-[13px] font-medium text-foreground"
                htmlFor="style-sample-textarea"
              >
                Writing sample
              </label>
              <p className="text-[12px] leading-snug text-fg-muted">
                A few lines you actually wrote. The agent takes tone, sentence shape and the expressions
                you use from it — never its content. For wording it outranks the level above; for form the
                level and your rules win.
              </p>
              <textarea
                id="style-sample-textarea"
                className={STYLE_TEXTAREA_CLASS}
                aria-label="Writing sample"
                rows={4}
                value={modes.style_sample}
                placeholder={"morning, pushing the call to monday, hope that works"}
                onChange={(e) => patch({ style_sample: e.target.value })}
              />
              <BudgetLine used={modes.style_sample.trim().length} max={MAX_STYLE_SAMPLE_CHARS} />
            </div>

            {showsLexicon && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-3 py-3">
                <p className="text-[12px] leading-snug text-fg-muted">
                  <strong className="text-foreground">Slang comes from you, not from the level.</strong> The
                  agent is forbidden from inventing slang or youth language on its own — models get it
                  wrong more often than right, and wrong slang reads worse than none. It uses only what your
                  rules and writing sample contain. Load a starter set to edit down:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_LEXICONS.languages.map((language) => (
                    <Button
                      key={language.code}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadLexicon(language.code)}
                    >
                      {language.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-fg-dim">
                  Starter sets are dated {STYLE_LEXICONS.updated} and go into your rules, where you can edit
                  them. Youth language turns over fast — treat a stale entry as expected.
                </p>
              </div>
            )}
          </>
        )}
      </FormCard>
    </>
  );
}

function BudgetLine({ used, max }: { used: number; max: number }) {
  const over = used > max;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-fg-muted">
          {used} of {max} characters sent to the prompt
        </span>
        {over && <span className="font-semibold text-destructive">over budget</span>}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-strong">
        <div
          className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.min(100, Math.round((used / Math.max(1, max)) * 100))}%` }}
        />
      </div>
      {over && (
        <p className="text-[12px] leading-snug text-fg-muted">
          Everything past the budget is <strong className="text-foreground">not sent</strong>. Shorten this
          field.
        </p>
      )}
    </div>
  );
}