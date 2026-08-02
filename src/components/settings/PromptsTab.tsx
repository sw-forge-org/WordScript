import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Copy,
  Download,
  FilePlus2,
  Plus,
  SquarePen,
  Trash2,
  Upload,
} from "lucide-react";
import { FormCard, FormRow, SegmentControl, Select, StatTiles, StatusBadge, Toggle } from "../shell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import type {
  AppConfig,
  BiasMode,
  DictionaryEntry,
  SnippetEntry,
  TextProfile,
  TextProfileInsertBehavior,
  VocabularyHintEntry,
} from "../../types/ipc";
import {
  buildTextProfilesPatch,
  clearTextProfileCuration,
  cloneTextProfile,
  createTextProfile,
  createEmptyTextProfileCuration,
  displayTextProfileLabel,
  isCuratedTextProfile,
  resolveActiveTextProfile,
} from "../../lib/textProfiles";
import type {
  ExportTextRulesResponse,
  GetProfileHealthRequest,
  ImportTextRulesResponse,
  ProfileHealthStatus,
  TextRulesAnalysis,
  TextRulesBiasPreview,
  TextRulesConflictResolution,
  TextRulesIssue,
  VocabularyRepairCoverage,
} from "../../types/textRules";

const DEFAULT_SAMPLE_TEXT = "word script follow up note";
const ANALYSIS_DEBOUNCE_MS = 120;
const EMPTY_ISSUES: TextRulesIssue[] = [];

const MODE_LABELS: Record<string, string> = {
  auto: "Auto",
  verbatim: "Verbatim",
  cleanup: "Cleanup",
  rewrite: "Rewrite",
  agent: "Agent",
  prompt_enhance: "Prompt Enhance",
};

function modeLabelForProfile(profile: Pick<TextProfile, "work_mode">): string {
  const mode = profile.work_mode?.processing_mode;
  if (!mode) return "Auto";
  return MODE_LABELS[mode] ?? mode;
}

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
  onValidationChange?: (analysis: TextRulesAnalysis | null) => void;
  onHealthChange?: (status: ProfileHealthStatus | null) => void;
}

interface RuleSummary {
  id: string;
  kind: "dictionary" | "snippet";
  label: string;
  detail: string;
}

interface PreviewRuleChip {
  key: string;
  label: string;
  title: string;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;

  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(nextIndex, 0, item);
  return nextItems;
}

function formatRuleTitle(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function buildRuleLookup(dictionaryEntries: DictionaryEntry[], snippetEntries: SnippetEntry[]) {
  const lookup = new Map<string, RuleSummary>();

  for (const entry of dictionaryEntries) {
    lookup.set(entry.id, {
      id: entry.id,
      kind: "dictionary",
      label: `Dictionary: ${formatRuleTitle(entry.phrase, "Untitled term")}`,
      detail: entry.replace_with.trim()
        ? `Replaces with ${entry.replace_with.trim()}`
        : "Replacement missing",
    });
  }

  for (const entry of snippetEntries) {
    const label = entry.label.trim() || entry.trigger.trim() || "Untitled snippet";
    lookup.set(entry.id, {
      id: entry.id,
      kind: "snippet",
      label: `Snippet: ${label}`,
      detail: entry.trigger.trim()
        ? `Triggered by ${entry.trigger.trim()}`
        : "Trigger missing",
    });
  }

  return lookup;
}

function humanizeFallbackRule(rule: string) {
  const parts = rule.split(":");
  const trimmed = parts[parts.length - 1] ?? rule;
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character: string) => character.toUpperCase());
}

function buildPreviewRuleChip(rule: string, lookup: Map<string, RuleSummary>): PreviewRuleChip {
  const [kind, ruleId] = rule.split(":", 2);
  const resolved = ruleId ? lookup.get(ruleId) : undefined;

  if (resolved) {
    return {
      key: rule,
      label: resolved.label,
      title: `${resolved.label}. ${resolved.detail}`,
    };
  }

  // A fuzzy rewrite has more reason to be named than an exact one: no rule card
  // spells out what it matched, so the chip is the only place it is visible
  // (ADR 0033). Falling through to the generic branch made the one changed word
  // nobody authored the one change nobody could explain.
  if (kind === "vocabulary") {
    // Not `ruleId`: a term may contain a colon, and the split above keeps only
    // the first segment.
    const term = rule.slice("vocabulary:".length) || humanizeFallbackRule(rule);
    return {
      key: rule,
      label: `Repaired: ${term}`,
      title: `The recognizer's spelling was close enough to "${term}" to rewrite it. No spoken form was needed.`,
    };
  }

  if (kind === "dictionary") {
    return {
      key: rule,
      label: `Dictionary: ${humanizeFallbackRule(rule)}`,
      title: "Dictionary replacement applied during preview.",
    };
  }

  if (kind === "snippet") {
    return {
      key: rule,
      label: `Snippet: ${humanizeFallbackRule(rule)}`,
      title: "Snippet expansion applied during preview.",
    };
  }

  return {
    key: rule,
    label: humanizeFallbackRule(rule),
    title: "A text rule changed the preview output.",
  };
}

function buildIssueMap(issues: TextRulesIssue[]) {
  const ruleIssues = new Map<string, TextRulesIssue[]>();

  for (const issue of issues) {
    for (const ruleId of issue.rule_ids) {
      const current = ruleIssues.get(ruleId) ?? [];
      current.push(issue);
      ruleIssues.set(ruleId, current);
    }
  }

  return ruleIssues;
}

function hasSeverity(issues: TextRulesIssue[], severity: TextRulesIssue["severity"]) {
  return issues.some((issue) => issue.severity === severity);
}

function createRuleId(prefix: string) {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 100000)}`;
  return `${prefix}-${random}`;
}

function countPromptLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
}

/**
 * What one vocabulary row actually does, per effect.
 *
 * Both axes are reported, never chosen. The recognizer's few slots are
 * allocated by the runtime, because the allocation intuition produces is
 * systematically wrong (ADR 0035), and the repair floor was never a setting.
 */
type VocabularyRowState = {
  recognizer: "carried" | "not_carried" | "pending";
  repair: "repaired" | "context_only" | "pending";
};

function containsPhrase(list: string[], phrase: string) {
  const needle = phrase.trim().toLowerCase();
  if (!needle) return false;
  return list.some((entry) => entry.trim().toLowerCase() === needle);
}

/**
 * Resolves each row against the analysis the runtime returned.
 *
 * Deliberately does not recompute the slot allocation, the length ceiling or
 * the repair floor: those are runtime rules (ADR 0032, ADR 0033, ADR 0035), and
 * a second copy in React is a copy that drifts. Until the analysis arrives, rows
 * report `pending` rather than guessing.
 */
function buildVocabularyRowStates(
  entries: VocabularyHintEntry[],
  bias: TextRulesBiasPreview | undefined,
  repair: VocabularyRepairCoverage | undefined,
): Map<string, VocabularyRowState> {
  const states = new Map<string, VocabularyRowState>();

  for (const entry of entries) {
    const phrase = entry.phrase.trim();

    const recognizer: VocabularyRowState["recognizer"] = !phrase || !bias
      ? "pending"
      : containsPhrase(bias.stt_hints, phrase)
        ? "carried"
        : "not_carried";

    const repairState: VocabularyRowState["repair"] = !phrase
      ? "pending"
      : !repair
        ? "pending"
        : containsPhrase(repair.repairable, phrase)
          ? "repaired"
          : "context_only";

    states.set(entry.id, { recognizer, repair: repairState });
  }

  return states;
}

/**
 * The one line a row says about itself.
 *
 * Silent when the row does the ordinary thing — every term reaches the AI modes
 * and gets repaired, so saying so on every line would bury the cases that
 * differ. Nothing here is a warning any more: there is no longer a decision the
 * user could have got wrong.
 */
function describeVocabularyRow(
  state: VocabularyRowState | undefined,
  minRepairChars: number | undefined,
): string | null {
  if (!state) return null;

  if (state.repair === "context_only" && state.recognizer === "carried") {
    return `Under ${minRepairChars ?? 7} characters, so a close match is not evidence and it is never rewritten after the fact. Speech recognition carries it instead, which is where it still helps.`;
  }

  if (state.repair === "context_only") {
    return `Under ${minRepairChars ?? 7} characters, so a close match is not evidence and it is never rewritten after the fact. It still reaches every AI mode.`;
  }

  if (state.recognizer === "carried") {
    return "Repaired automatically when it comes back mangled, and carried into speech recognition.";
  }

  return null;
}

function formatLearnedDate(learnedAtMs: number | null | undefined) {
  if (!learnedAtMs) return null;
  const date = new Date(learnedAtMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Where a row came from and whether it has earned its place.
 *
 * The second half matters more than it looks: a term list nobody can judge is a
 * term list nobody prunes, and a learned list grows on its own.
 */
function describeVocabularyProvenance(entry: VocabularyHintEntry) {
  const learnedOn = formatLearnedDate(entry.learned_at_ms);
  const origin = entry.origin === "learned"
    ? learnedOn ? `Learned ${learnedOn}` : "Learned while dictating"
    : "Added by you";

  if (!entry.hit_count) return origin;
  return `${origin} · fixed ${entry.hit_count} ${entry.hit_count === 1 ? "time" : "times"}`;
}

function profileLibrarySummary(profile: TextProfile) {
  if (isCuratedTextProfile(profile) && profile.curation.summary.trim()) {
    return profile.curation.summary;
  }

  // Counts what the panel edits. The legacy `stt_hints` string used to be
  // counted here and always read zero after migration moved its content into
  // `vocabulary_hints`, so the summary understated every profile it described.
  const contextLines = countPromptLines(profile.prompt);
  const termCount = (profile.vocabulary_hints ?? []).filter((entry) => entry.phrase.trim()).length;
  const ruleCount = (profile.dictionary_entries ?? []).length + (profile.snippet_entries ?? []).length;
  return `${contextLines} context lines, ${termCount} words & names and ${ruleCount} rules in this profile.`;
}

function makeDictionaryEntry(): DictionaryEntry {
  return {
    id: createRuleId("dict"),
    phrase: "",
    replace_with: "",
  };
}

function makeSnippetEntry(): SnippetEntry {
  return {
    id: createRuleId("snippet"),
    label: "",
    trigger: "",
    expansion: "",
  };
}

const RULE_TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-border bg-surface-strong px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-fg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

const RULE_INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface-strong px-3 py-1.5 text-[13px] text-foreground outline-none transition-colors placeholder:text-fg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function RuleField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[12px] font-medium text-fg-dim">{label}</span>
      {children}
    </div>
  );
}

function ruleCardClass(isActive: boolean, issues: TextRulesIssue[]) {
  return cn(
    // ws-list-item-tall skips paint/layout of rule cards scrolled out of view
    // (content-visibility: auto + contain-intrinsic-size). The auto-sized
    // scrollbar fallback lets the browser cache each card's real height after
    // its first paint, so long Dictionary / Snippet lists stay smooth even in
    // fullscreen. Safe with focus management: DOM stays intact, only off-screen
    // rendering is skipped.
    "ws-list-item-tall rounded-lg border bg-card px-4 py-3.5",
    hasSeverity(issues, "error")
      ? "border-[var(--red)]"
      : hasSeverity(issues, "warning")
        ? "border-[var(--orange)]"
        : isActive
          ? "border-brand"
          : "border-border",
  );
}

function RuleInlineIssues({ entryId, issues }: { entryId: string; issues: TextRulesIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
      {issues.map((issue) => (
        <div key={`${entryId}-${issue.code}-${issue.message}`} className="flex items-start gap-2 text-[12px] leading-snug">
          <StatusBadge tone={issue.severity === "error" ? "error" : "warning"}>{issue.severity}</StatusBadge>
          <span className="text-fg-dim">{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

interface RuleCardRefRegistrar {
  (ruleId: string, element: HTMLElement | null): void;
}

interface DictionaryRuleCardProps {
  entry: DictionaryEntry;
  index: number;
  totalCount: number;
  isActive: boolean;
  issues: TextRulesIssue[];
  registerRef: RuleCardRefRegistrar;
  onMove: (id: string, direction: -1 | 1) => void;
  onChange: (id: string, key: keyof DictionaryEntry, value: string) => void;
  onRemove: (id: string) => void;
}

const DictionaryRuleCard = memo(function DictionaryRuleCard({
  entry,
  index,
  totalCount,
  isActive,
  issues,
  registerRef,
  onMove,
  onChange,
  onRemove,
}: DictionaryRuleCardProps) {
  return (
    <article
      ref={(element) => {
        registerRef(entry.id, element);
      }}
      data-active={isActive || undefined}
      className={ruleCardClass(isActive, issues)}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-[13px] font-semibold text-foreground">Replacement {index + 1}</strong>
          <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
            Runs in order. Later rules see the output of earlier ones.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => onMove(entry.id, -1)}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Move down"
            disabled={index === totalCount - 1}
            onClick={() => onMove(entry.id, 1)}
          >
            <ArrowDown className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <RuleField label="What you say">
          <Input
            aria-label="What you say"
            value={entry.phrase}
            onChange={(event) => onChange(entry.id, "phrase", event.target.value)}
            placeholder="e.g. k a"
          />
        </RuleField>
        <RuleField label="What gets written">
          <Input
            aria-label="What gets written"
            value={entry.replace_with}
            onChange={(event) => onChange(entry.id, "replace_with", event.target.value)}
            placeholder="e.g. WordScript"
          />
        </RuleField>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] leading-snug text-fg-muted">
          Literal whole-phrase match, case-insensitive. Add separate entries for variants.
        </span>
        <Button size="sm" variant="ghost" onClick={() => onRemove(entry.id)}>
          <Trash2 /> Remove
        </Button>
      </div>
      <RuleInlineIssues entryId={entry.id} issues={issues} />
    </article>
  );
});

interface SnippetRuleCardProps {
  entry: SnippetEntry;
  index: number;
  totalCount: number;
  isActive: boolean;
  issues: TextRulesIssue[];
  registerRef: RuleCardRefRegistrar;
  onMove: (id: string, direction: -1 | 1) => void;
  onChange: (id: string, key: keyof SnippetEntry, value: string) => void;
  onRemove: (id: string) => void;
}

const SnippetRuleCard = memo(function SnippetRuleCard({
  entry,
  index,
  totalCount,
  isActive,
  issues,
  registerRef,
  onMove,
  onChange,
  onRemove,
}: SnippetRuleCardProps) {
  return (
    <article
      ref={(element) => {
        registerRef(entry.id, element);
      }}
      data-active={isActive || undefined}
      className={ruleCardClass(isActive, issues)}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-[13px] font-semibold text-foreground">Snippet {index + 1}</strong>
          <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
            Runs after Dictionary. Reorder when triggers overlap or one snippet should win over another.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => onMove(entry.id, -1)}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Move down"
            disabled={index === totalCount - 1}
            onClick={() => onMove(entry.id, 1)}
          >
            <ArrowDown className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <RuleField label="Label">
          <Input
            aria-label="Label"
            value={entry.label}
            onChange={(event) => onChange(entry.id, "label", event.target.value)}
            placeholder="e.g. Support follow-up"
          />
        </RuleField>
        <RuleField label="Trigger phrase">
          <Input
            aria-label="Trigger phrase"
            value={entry.trigger}
            onChange={(event) => onChange(entry.id, "trigger", event.target.value)}
            placeholder="e.g. follow up note"
          />
        </RuleField>
        <RuleField label="Expansion" className="sm:col-span-2">
          <textarea
            aria-label="Expansion"
            className={RULE_TEXTAREA_CLASS}
            value={entry.expansion}
            onChange={(event) => onChange(entry.id, "expansion", event.target.value)}
            placeholder="e.g. Thanks for the update. We will send the next status tomorrow morning."
            rows={4}
          />
        </RuleField>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] leading-snug text-fg-muted">
          Literal trigger phrase match, case-insensitive, in the final transcript.
        </span>
        <Button size="sm" variant="ghost" onClick={() => onRemove(entry.id)}>
          <Trash2 /> Remove
        </Button>
      </div>
      <RuleInlineIssues entryId={entry.id} issues={issues} />
    </article>
  );
});

export function PromptsTab({ config, onChange, onValidationChange, onHealthChange }: Props) {
  const textProfiles = config.text_profiles?.length
    ? config.text_profiles
    : [resolveActiveTextProfile(config)];
  const activeTextProfile = textProfiles.find((profile) => profile.id === config.active_text_profile_id) ?? textProfiles[0];
  const sttHints = activeTextProfile.stt_hints ?? "";
  const vocabularyHints = activeTextProfile.vocabulary_hints ?? [];
  const dictionaryEntries = activeTextProfile.dictionary_entries ?? [];
  const snippetEntries = activeTextProfile.snippet_entries ?? [];
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
  const [analysis, setAnalysis] = useState<TextRulesAnalysis | null>(null);
  const [profileHealth, setProfileHealth] = useState<ProfileHealthStatus | null>(null);
  const [acknowledgedFlags, setAcknowledgedFlags] = useState<Set<string>>(new Set());
  const [pendingImport, setPendingImport] = useState<{
    path: string;
    resolution: TextRulesConflictResolution;
    payload: ImportTextRulesResponse;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<"context" | "dictionary" | "snippets" | "bias_policy">("context");
  const [pendingFocusRuleId, setPendingFocusRuleId] = useState<string | null>(null);
  const ruleCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const configRef = useRef(config);
  const textProfilesRef = useRef(textProfiles);
  const activeTextProfileIdRef = useRef(activeTextProfile.id);

  configRef.current = config;
  textProfilesRef.current = textProfiles;
  activeTextProfileIdRef.current = activeTextProfile.id;

  useEffect(() => {
    setAcknowledgedFlags(new Set());
    setProfileHealth(null);
  }, [activeTextProfile.id]);

  useEffect(() => {
    let cancelled = false;
    const healthRequest: GetProfileHealthRequest = {
      prompt: activeTextProfile.prompt,
      dictionary_entries: dictionaryEntries,
      acknowledged_flags: [...acknowledgedFlags],
      bias_mode: activeTextProfile.work_mode?.bias_mode ?? null,
      processing_mode: activeTextProfile.work_mode?.processing_mode ?? null,
      profile_id: activeTextProfile.id,
    };
    const biasMode = activeTextProfile.work_mode?.bias_mode ?? "conservative";
    const manualBias = activeTextProfile.work_mode?.manual_bias ?? null;
    const timeoutId = window.setTimeout(() => {
      void Promise.all([
        invoke<TextRulesAnalysis>("analyze_text_rules", {
          request: {
            prompt: activeTextProfile.prompt,
            stt_hints: sttHints,
            // The recognizer honours the per-entry opt-in, so the preview has to
            // be given the same list. Sending only the legacy field made the
            // panel show an initial prompt the provider never received.
            vocabulary_hints: vocabularyHints,
            dictionary_entries: dictionaryEntries,
            snippet_entries: snippetEntries,
            sample_text: sampleText,
            bias_mode: biasMode,
            local_prompt_strength: config.local_prompt_strength,
            local_prompt_carry: config.local_prompt_carry,
            manual_bias: manualBias
              ? {
                  cloud_include_profile_terms: manualBias.cloud_include_profile_terms,
                  local_include_profile_terms: manualBias.local_include_profile_terms,
                  stt_hints_override: manualBias.stt_hints_override,
                }
              : null,
          },
        }),
        invoke<ProfileHealthStatus>("get_profile_health", { request: healthRequest }),
      ]).then(([nextAnalysis, nextHealth]) => {
        if (cancelled) return;
        setAnalysis(nextAnalysis);
        onValidationChange?.(nextAnalysis);
        setProfileHealth(nextHealth);
        onHealthChange?.(nextHealth);
      }).catch((error) => {
        if (cancelled) return;
        setAnalysis(null);
        onValidationChange?.(null);
        setProfileHealth(null);
        onHealthChange?.(null);
        setFeedback({ ok: false, text: `Text-rule validation failed: ${error}` });
      });
    }, ANALYSIS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [acknowledgedFlags, activeTextProfile.id, activeTextProfile.prompt, activeTextProfile.work_mode?.bias_mode, activeTextProfile.work_mode?.manual_bias?.cloud_include_profile_terms, activeTextProfile.work_mode?.manual_bias?.local_include_profile_terms, activeTextProfile.work_mode?.manual_bias?.stt_hints_override, activeTextProfile.work_mode?.processing_mode, config.local_prompt_carry, config.local_prompt_strength, dictionaryEntries, onHealthChange, onValidationChange, sampleText, snippetEntries, sttHints, vocabularyHints]);

  const applyProfiles = useCallback((nextProfiles: TextProfile[], nextActiveProfileId = activeTextProfileIdRef.current) => {
    onChange(buildTextProfilesPatch(configRef.current, nextProfiles, nextActiveProfileId));
  }, [onChange]);

  const updateActiveProfile = useCallback((update: Partial<TextProfile> | ((profile: TextProfile) => TextProfile)) => {
    const activeProfileId = activeTextProfileIdRef.current;
    const nextProfiles = textProfilesRef.current.map((profile) => {
      if (profile.id !== activeProfileId) return profile;

      const nextProfile = typeof update === "function"
        ? update(profile)
        : { ...profile, ...update };

      return clearTextProfileCuration(nextProfile);
    });

    applyProfiles(nextProfiles, activeProfileId);
  }, [applyProfiles]);

  const updateActiveProfileWorkMode = useCallback(
    (updater: (workMode: NonNullable<TextProfile["work_mode"]>) => NonNullable<TextProfile["work_mode"]>) => {
      updateActiveProfile((profile) => {
        const current: NonNullable<TextProfile["work_mode"]> = profile.work_mode ?? {
          rewrite_style: "clean",
          insert_behavior: "auto_paste",
          recovery_behavior: "standard",
          processing_mode: "auto",
          enhance_sub_mode: null,
          target: null,
          bias_mode: "conservative",
          manual_bias: { cloud_include_profile_terms: false, local_include_profile_terms: false, stt_hints_override: "" },
        };
        return { ...profile, work_mode: updater(current) };
      });
    },
    [updateActiveProfile],
  );

  const updateVocabularyHint = useCallback(
    (id: string, update: Partial<VocabularyHintEntry>) => {
      updateActiveProfile((profile) => ({
        ...profile,
        vocabulary_hints: (profile.vocabulary_hints ?? []).map((entry) =>
          entry.id === id ? { ...entry, ...update } : entry,
        ),
      }));
    },
    [updateActiveProfile],
  );

  // No reordering. Order used to decide which terms won the recognizer's slots;
  // the runtime decides that now, and a move button that changes nothing is
  // worse than no button (ADR 0035).
  const removeVocabularyHint = useCallback(
    (id: string) => {
      updateActiveProfile((profile) => ({
        ...profile,
        vocabulary_hints: (profile.vocabulary_hints ?? []).filter((entry) => entry.id !== id),
      }));
    },
    [updateActiveProfile],
  );

  // Manual add stays. The list fills itself now, but knowing a term the system
  // has not seen yet is legitimate — a name you are about to start using has no
  // dictation behind it to learn from.
  const addVocabularyHint = useCallback(() => {
    updateActiveProfile((profile) => ({
      ...profile,
      vocabulary_hints: [
        ...(profile.vocabulary_hints ?? []),
        {
          id: `${profile.id}-vocab-${Date.now()}`,
          phrase: "",
          use_as_prompt_hint: false,
          origin: "user",
          learned_at_ms: null,
          hit_count: 0,
          observation_count: 0,
        },
      ],
    }));
  }, [updateActiveProfile]);

  const createProfile = () => {
    const nextProfile = createTextProfile();
    applyProfiles([...textProfiles, nextProfile], nextProfile.id);
    setActiveWorkspacePanel("context");
  };

  const duplicateProfile = () => {
    const nextProfileId = createTextProfile().id;
    const nextProfile = cloneTextProfile(activeTextProfile, {
      id: nextProfileId,
      label: activeTextProfile.label.trim() ? `${activeTextProfile.label} copy` : "Profile copy",
      curation: createTextProfile().curation,
    });
    applyProfiles([...textProfiles, nextProfile], nextProfile.id);
    setActiveWorkspacePanel("context");
  };

  const deleteActiveProfile = () => {
    if (textProfiles.length <= 1) return;

    const nextProfiles = textProfiles.filter((profile) => profile.id !== activeTextProfile.id);
    applyProfiles(nextProfiles, nextProfiles[0]?.id);
  };

  const updateDictionaryEntry = useCallback((id: string, key: keyof DictionaryEntry, value: string) => {
    updateActiveProfile((profile) => ({
      ...profile,
      dictionary_entries: (profile.dictionary_entries ?? []).map((entry) => (
        entry.id === id ? { ...entry, [key]: value } : entry
      )),
    }));
  }, [updateActiveProfile]);

  const removeDictionaryEntry = useCallback((id: string) => {
    updateActiveProfile((profile) => ({
      ...profile,
      dictionary_entries: (profile.dictionary_entries ?? []).filter((entry) => entry.id !== id),
    }));
  }, [updateActiveProfile]);

  const moveDictionaryEntry = useCallback((id: string, direction: -1 | 1) => {
    updateActiveProfile((profile) => {
      const entries = profile.dictionary_entries ?? [];
      const index = entries.findIndex((entry) => entry.id === id);
      if (index < 0) return profile;

      return {
        ...profile,
        dictionary_entries: moveItem(entries, index, direction),
      };
    });
    setActiveRuleId(id);
  }, [updateActiveProfile]);

  const updateSnippetEntry = useCallback((id: string, key: keyof SnippetEntry, value: string) => {
    updateActiveProfile((profile) => ({
      ...profile,
      snippet_entries: (profile.snippet_entries ?? []).map((entry) => (
        entry.id === id ? { ...entry, [key]: value } : entry
      )),
    }));
  }, [updateActiveProfile]);

  const removeSnippetEntry = useCallback((id: string) => {
    updateActiveProfile((profile) => ({
      ...profile,
      snippet_entries: (profile.snippet_entries ?? []).filter((entry) => entry.id !== id),
    }));
  }, [updateActiveProfile]);

  const moveSnippetEntry = useCallback((id: string, direction: -1 | 1) => {
    updateActiveProfile((profile) => {
      const entries = profile.snippet_entries ?? [];
      const index = entries.findIndex((entry) => entry.id === id);
      if (index < 0) return profile;

      return {
        ...profile,
        snippet_entries: moveItem(entries, index, direction),
      };
    });
    setActiveRuleId(id);
  }, [updateActiveProfile]);

  const setMessage = useCallback((ok: boolean, text: string) => {
    setFeedback({ ok, text });
  }, []);

  const startImport = async (resolution: TextRulesConflictResolution) => {
    setIsBusy(true);
    try {
      const selected = await open({
        multiple: false,
        title: resolution === "replace_current" ? "Replace text rules from file" : "Merge text rules from file",
        filters: [{ name: "WordScript text rules", extensions: ["json"] }],
      });
      if (typeof selected !== "string") return;

      const payload = await invoke<ImportTextRulesResponse>("import_text_rules", {
        request: {
          path: selected,
          current_prompt: activeTextProfile.prompt,
          current_stt_hints: sttHints,
          current_dictionary_entries: dictionaryEntries,
          current_snippet_entries: snippetEntries,
          sample_text: sampleText,
          resolution,
        },
      });

      setPendingImport({ path: selected, resolution, payload });
      setMessage(true, `Loaded import preview from ${selected.split(/[\\/]/).pop() ?? selected}`);
    } catch (error) {
      setPendingImport(null);
      setMessage(false, `Import preview failed: ${error}`);
    } finally {
      setIsBusy(false);
    }
  };

  const applyImport = () => {
    if (!pendingImport) return;
    updateActiveProfile({
      prompt: pendingImport.payload.document.prompt,
      stt_hints: pendingImport.payload.document.stt_hints,
      dictionary_entries: pendingImport.payload.document.dictionary_entries,
      snippet_entries: pendingImport.payload.document.snippet_entries,
    });
    setMessage(
      true,
      pendingImport.payload.analysis.blocking
        ? "Imported file loaded, but the merged result still contains blocking issues. Fix them before saving."
        : `Applied ${pendingImport.resolution === "replace_current" ? "replacement" : "merge"} import.`,
    );
    setPendingImport(null);
  };

  const exportRules = async () => {
    setIsBusy(true);
    try {
      const target = await save({
        title: "Export text rules",
        defaultPath: "wordscript-text-rules.json",
        filters: [{ name: "WordScript text rules", extensions: ["json"] }],
      });
      if (!target) return;

      const result = await invoke<ExportTextRulesResponse>("export_text_rules", {
        request: {
          path: target,
          prompt: activeTextProfile.prompt,
          stt_hints: sttHints,
          dictionary_entries: dictionaryEntries,
          snippet_entries: snippetEntries,
        },
      });

      setMessage(true, `Exported text rules to ${result.path.split(/[\\/]/).pop() ?? result.path}`);
    } catch (error) {
      setMessage(false, `Export failed: ${error}`);
    } finally {
      setIsBusy(false);
    }
  };

  const previewSource = pendingImport?.payload.analysis ?? analysis;
  const issueList = previewSource?.issues ?? EMPTY_ISSUES;
  const previewDictionaryEntries = pendingImport?.payload.document.dictionary_entries ?? dictionaryEntries;
  const previewSnippetEntries = pendingImport?.payload.document.snippet_entries ?? snippetEntries;
  const previewRuleLookup = useMemo(
    () => buildRuleLookup(previewDictionaryEntries, previewSnippetEntries),
    [previewDictionaryEntries, previewSnippetEntries],
  );
  const currentRuleLookup = useMemo(
    () => buildRuleLookup(dictionaryEntries, snippetEntries),
    [dictionaryEntries, snippetEntries],
  );
  const currentIssueMap = useMemo(
    () => buildIssueMap(analysis?.issues ?? EMPTY_ISSUES),
    [analysis?.issues],
  );
  const previewRuleChips = useMemo(
    () => (previewSource?.preview.applied_rules ?? []).map((rule) => buildPreviewRuleChip(rule, previewRuleLookup)),
    [previewRuleLookup, previewSource?.preview.applied_rules],
  );
  const biasPreview = previewSource?.transcription_bias;
  const biasDictionaryTerms = biasPreview?.dictionary_terms ?? [];
  const biasSttHints = biasPreview?.stt_hints ?? [];
  // With no terms the recognizer no longer gets an empty prompt — it gets the
  // blank-state register floor (ADR 0036). Read back from the runtime rather
  // than restated here: a second copy of that sentence is exactly how the
  // preview and the provider drifted apart before
  // (`stt-hints-bypass-the-vocabulary-opt-in.md`).
  const blankStateFloor = biasSttHints.length === 0 ? biasPreview?.cloud_prompt_preview : null;
  const profileContextBudget = previewSource?.profile_context;
  const droppedContextLines = profileContextBudget?.dropped ?? [];
  const repairCoverage = previewSource?.vocabulary_repair;
  // Every row's fate, resolved from what the runtime reported rather than from
  // the limits restated here. The status belongs beside the switch that causes
  // it; a warning further down the page is a footnote, not a control.
  const vocabularyRowStates = useMemo(
    () => buildVocabularyRowStates(vocabularyHints, biasPreview, repairCoverage),
    [biasPreview, repairCoverage, vocabularyHints],
  );
  const namedTermCount = vocabularyHints.filter((entry) => entry.phrase.trim()).length;
  const learnedTermCount = vocabularyHints.filter(
    (entry) => entry.origin === "learned" && entry.phrase.trim(),
  ).length;
  const hasImportedOnlyIssues = Boolean(pendingImport && issueList.some((entry) => entry.rule_ids.some((ruleId) => !currentRuleLookup.has(ruleId))));
  const activePromptLineCount = countPromptLines(activeTextProfile.prompt);
  const totalRuleCount = dictionaryEntries.length + snippetEntries.length;
  // One line per panel. The panel title matches its tab exactly — two names for
  // one place was the whole confusion. The "Step N of 4" framing is gone: these
  // are three independent lists, not a sequence, and the fourth step it counted
  // (Bias policy) stopped existing with ADR 0017.
  const activeWorkspaceCopy = activeWorkspacePanel === "dictionary"
    ? {
      title: "Replacements",
      summary: "For what you say on purpose: an abbreviation, and what it should be written out as.",
    }
    : activeWorkspacePanel === "snippets"
      ? {
        title: "Snippets",
        summary: "Say a short trigger phrase, get a longer block of text.",
      }
      : {
        title: "Vocabulary",
        summary: "What this profile is about, and the individual words it should get right.",
      };

  const registerRuleCardRef = useCallback((ruleId: string, element: HTMLElement | null) => {
    ruleCardRefs.current[ruleId] = element;
  }, []);

  useEffect(() => {
    if (!pendingFocusRuleId) return;

    const target = ruleCardRefs.current[pendingFocusRuleId];
    if (!target) return;

    target.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")?.focus();
    setPendingFocusRuleId(null);
  }, [activeWorkspacePanel, dictionaryEntries, pendingFocusRuleId, snippetEntries]);

  const focusRuleCard = (ruleId: string) => {
    const rule = currentRuleLookup.get(ruleId);
    if (rule?.kind === "dictionary") {
      setActiveWorkspacePanel("dictionary");
    } else if (rule?.kind === "snippet") {
      setActiveWorkspacePanel("snippets");
    }

    setActiveRuleId(ruleId);
    setPendingFocusRuleId(ruleId);
  };

  return (
    <div className="flex flex-col gap-8">
      <FormCard
        title="Profiles"
        description="Each profile carries its own vocabulary, replacements and snippets. Import and export stay local as JSON."
        bodyClassName="py-4"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void startImport("merge_imported_wins")}>
              <Upload /> Import & merge
            </Button>
            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void startImport("replace_current")}>
              <FilePlus2 /> Replace from file
            </Button>
            <Button size="sm" disabled={isBusy} onClick={() => void exportRules()}>
              <Download /> Export rules
            </Button>
          </div>
        }
      >
        <StatTiles
          items={[
            {
              label: "Active profile",
              value: activeTextProfile.label,
              hint: `${activePromptLineCount} context lines and ${totalRuleCount} rules${isCuratedTextProfile(activeTextProfile) ? ". Included by WordScript, editable like any other." : "."}`,
            },
            {
              label: "Rule order",
              value: "Repair → Replacements → Snippets",
              hint: "Words & names are repaired first, so a replacement written against the real spelling still matches. The rest is literal and case-insensitive, in the order you author it.",
            },
          ]}
        />
      </FormCard>

      {feedback && (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-[12px] leading-snug",
            feedback.ok
              ? "border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-[var(--green)]"
              : "border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-[var(--red)]",
          )}
        >
          {feedback.text}
        </p>
      )}

      {pendingImport && (
        <FormCard
          title="Pending import preview"
          description={
            pendingImport.resolution === "replace_current"
              ? "Replace mode overwrites the current context, words \u0026 names, replacements and snippets with the imported file."
              : "Merge mode preserves the current prompt and STT hints unless they are empty and lets imported phrase/trigger matches replace existing rules."
          }
          action={<StatusBadge tone="info">{pendingImport.path.split(/[\\/]/).pop() ?? pendingImport.path}</StatusBadge>}
        >
          <FormRow
            label={`${pendingImport.payload.analysis.dictionary_count} dictionary entries, ${pendingImport.payload.analysis.snippet_count} snippets after ${pendingImport.resolution === "replace_current" ? "replace" : "merge"}.`}
            divider={false}
            control={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPendingImport(null)}>
                  Discard preview
                </Button>
                <Button size="sm" disabled={pendingImport.payload.analysis.blocking} onClick={applyImport}>
                  Apply import
                </Button>
              </div>
            }
          />
        </FormCard>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <FormCard
          title="Pick the profile you want to shape"
          description="Keep switching and renaming here. Everything below edits the active profile only."
          icon={<SquarePen />}
          action={
            <StatusBadge tone={isCuratedTextProfile(activeTextProfile) ? "accent" : "neutral"} dot>
              {isCuratedTextProfile(activeTextProfile) ? (
                <>
                  <BadgeCheck className="size-3.5" /> Included
                </>
              ) : (
                "Active"
              )}
            </StatusBadge>
          }
          bodyClassName="flex-1"
        >
          <FormRow
            label="Active profile"
            htmlFor="text-profile-select"
            hint={profileLibrarySummary(activeTextProfile)}
            align="start"
            control={
              <Select
                id="text-profile-select"
                aria-label="Active profile"
                className="w-full"
                value={activeTextProfile.id}
                onChange={(event) => applyProfiles(textProfiles, event.target.value)}
              >
                {textProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {displayTextProfileLabel(profile)}
                  </option>
                ))}
              </Select>
            }
          />
          <FormRow
            label="Profile label"
            control={
              <Input
                aria-label="Profile label"
                className="w-full"
                value={activeTextProfile.label}
                onChange={(event) => updateActiveProfile({ label: event.target.value })}
                placeholder="e.g. Support reply"
              />
            }
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-border py-3">
            <Button size="sm" variant="outline" onClick={createProfile}>
              <Plus /> New profile
            </Button>
            <Button size="sm" variant="outline" onClick={duplicateProfile}>
              <Copy /> Duplicate profile
            </Button>
            <Button size="sm" variant="ghost" disabled={textProfiles.length <= 1} onClick={deleteActiveProfile}>
              <Trash2 /> Delete profile
            </Button>
          </div>
          <p className="py-3 text-[12px] leading-snug text-fg-muted">
            Each profile carries its own context, words \u0026 names, replacements, snippets and processing mode.
            Included profiles ship inside this app config on first run, and the first real edit turns them into
            regular user-owned profiles. Switch profiles here or from the sidebar footer.
          </p>
        </FormCard>

        <FormCard
          title="Profile details"
          description={displayTextProfileLabel(activeTextProfile)}
          bodyClassName="lg:w-[320px] lg:shrink-0"
        >
          {activeTextProfile.prompt.trim() && (
            <p className="mb-3 line-clamp-3 rounded-md bg-surface px-3 py-2 text-[12px] leading-snug text-fg-dim">
              {activeTextProfile.prompt.trim()}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-fg-muted">Processing mode</span>
              <span className="font-medium text-foreground">
                {modeLabelForProfile(activeTextProfile)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-fg-muted">Delivery</span>
              <span className="font-medium text-foreground">
                {activeTextProfile.work_mode?.insert_behavior === "clipboard_only" ? "Clipboard only" : "Auto-paste"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-fg-muted">Context lines</span>
              <span className="font-medium text-foreground">{activePromptLineCount}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-fg-muted">Words &amp; names</span>
              <span className="font-medium text-foreground">{namedTermCount}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-fg-muted">Replacements</span>
              <span className="font-medium text-foreground">{dictionaryEntries.length}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-fg-muted">Snippets</span>
              <span className="font-medium text-foreground">{snippetEntries.length}</span>
            </div>
          </div>
        </FormCard>
      </div>

      <div className="flex flex-col gap-3">
        <div className="px-1">
          <strong className="text-[15px] font-semibold text-foreground">{activeWorkspaceCopy.title}</strong>
          <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">{activeWorkspaceCopy.summary}</p>
        </div>
        <div
          role="tablist"
          aria-label="Text rules workspace"
          className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface p-1"
        >
          {(
            [
              {
                id: "context",
                label: "Vocabulary",
                aria: "Open vocabulary workspace",
                sub: `${activePromptLineCount} context · ${vocabularyHints.length} words & names`,
              },
              {
                id: "dictionary",
                label: "Replacements",
                aria: "Open replacements workspace",
                sub: `${dictionaryEntries.length} literal replacements`,
              },
              {
                id: "snippets",
                label: "Snippets",
                aria: "Open snippets workspace",
                sub: `${snippetEntries.length} reusable expansions`,
              },
            ] as const
          ).map((tab) => {
            const active = activeWorkspacePanel === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-label={tab.aria}
                aria-selected={active}
                onClick={() => setActiveWorkspacePanel(tab.id)}
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

        {activeWorkspacePanel === "context" && (
          <div className="flex flex-col gap-8">
            <FormCard
              title="Profile context"
              description="The topics you talk about — not spellings. One per line. This tells the AI what field it is reading, so it picks the right word where dictation is ambiguous. For individual terms, use Words & names below."
              bodyClassName="py-4"
            >
              <div className="flex flex-col gap-4">
                <textarea
                  className={RULE_TEXTAREA_CLASS}
                  value={activeTextProfile.prompt}
                  aria-label="Profile context"
                  rows={10}
                  onChange={(event) => updateActiveProfile({ prompt: event.target.value })}
                  placeholder={"platform constraints\nrelease scope\nincident response\nmigration steps"}
                />
                {profileContextBudget && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="text-fg-muted">
                        {profileContextBudget.used_chars} of {profileContextBudget.max_chars} characters sent to the
                        transform prompt
                      </span>
                      {droppedContextLines.length > 0 && (
                        <span className="font-semibold text-destructive">
                          {droppedContextLines.length} line(s) over budget
                        </span>
                      )}
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-strong">
                      <div
                        className={`h-full rounded-full ${droppedContextLines.length > 0 ? "bg-destructive" : "bg-primary"}`}
                        style={{
                          width: `${Math.min(100, Math.round((profileContextBudget.used_chars / Math.max(1, profileContextBudget.max_chars)) * 100))}%`,
                        }}
                      />
                    </div>
                    {droppedContextLines.length > 0 && (
                      <div className="rounded-lg border border-border bg-surface px-3 py-2">
                        <p className="text-[12px] leading-snug text-fg-muted">
                          These lines exceed the budget and are <strong className="text-foreground">not sent</strong> to
                          any mode. Shorten the list or the lines above them.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {droppedContextLines.map((line) => (
                            <span
                              key={`dropped-context-${line}`}
                              className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] text-fg-dim"
                            >
                              {line}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FormCard>

            <FormCard
              title="Words & names"
              description="The words this profile has learned to spell, plus anything you added yourself. Every term reaches all AI modes and is repaired automatically when speech recognition mangles it. Speech recognition itself takes only a few, and which ones is decided for you."
              bodyClassName="py-4"
              action={
                learnedTermCount > 0 ? (
                  <StatusBadge tone="accent" dot>
                    {`${learnedTermCount} learned`}
                  </StatusBadge>
                ) : undefined
              }
            >
              <div className="flex flex-col gap-4">
                <RuleField label="Words & names">
                  <div className="flex flex-col gap-2" aria-label="Words and names">
                    {vocabularyHints.map((entry, index) => {
                      const state = vocabularyRowStates.get(entry.id);
                      const note = describeVocabularyRow(state, repairCoverage?.min_chars);
                      const provenance = entry.phrase.trim()
                        ? describeVocabularyProvenance(entry)
                        : null;
                      return (
                        <div
                          key={entry.id}
                          className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              className={RULE_INPUT_CLASS}
                              value={entry.phrase}
                              aria-label={`Word or name ${index + 1}`}
                              placeholder="WordScript"
                              onChange={(event) =>
                                updateVocabularyHint(entry.id, { phrase: event.target.value })
                              }
                            />
                            {state?.recognizer === "carried" && (
                              <StatusBadge tone="info">In speech recognition</StatusBadge>
                            )}
                            <button
                              type="button"
                              className="shrink-0 text-[12px] text-fg-muted hover:text-foreground"
                              aria-label={`Remove word ${index + 1}`}
                              onClick={() => removeVocabularyHint(entry.id)}
                            >
                              Remove
                            </button>
                          </div>
                          {provenance && (
                            <p className="text-[11px] leading-snug text-fg-dim">{provenance}</p>
                          )}
                          {note && (
                            <p className="text-[11px] leading-snug text-fg-muted">{note}</p>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className="self-start rounded-lg border border-border px-3 py-1.5 text-[12px] text-fg-dim hover:text-foreground"
                      onClick={addVocabularyHint}
                    >
                      Add word or name
                    </button>
                  </div>
                </RuleField>
                <p className="text-[12px] leading-snug text-fg-muted">
                  A term lands here on its own once the AI cleanup has fixed the same word twice — that is the moment it
                  is provable, and the moment you were busy dictating. Add one yourself for a name you are about to start
                  using. Remove any row that is wrong; there is nothing else to adjust.
                </p>
              </div>
            </FormCard>

            <FormCard
              title="What travels, and what it does"
              description="Where each list lands before and after transcription, then the rules run against a sample. No microphone capture and no semantic guessing — the AI stages are not part of this preview."
              bodyClassName="py-4"
            >
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2" aria-label="Effective transcription bias preview">
                  {[
                    {
                      title: "Sent to the recognizer",
                      body: "The few words & names the runtime picked, shortest first — those are the ones that cannot be repaired afterwards. Profile context is not here by design: it holds topics, and the recognizer can only be biased toward literal words.",
                      chips: biasSttHints,
                      empty: blankStateFloor
                        ? `No words & names yet. The recognizer still gets one generic dictation line, so an empty prompt cannot pull it toward subtitle text: “${blankStateFloor}”`
                        : "No words & names yet, and this profile sends the recognizer nothing at all.",
                    },
                    {
                      title: "Corrected after transcription",
                      body: "Replacements rewrite these deterministically once the text comes back. Words & names are repaired just before them, without needing a spoken form.",
                      chips: biasDictionaryTerms,
                      empty: "No replacements are defined yet.",
                    },
                  ].map((note) => (
                    <div key={note.title} className="rounded-lg border border-border bg-surface px-3 py-2.5">
                      <strong className="text-[12px] font-semibold text-foreground">{note.title}</strong>
                      <p className="mt-1 text-[12px] leading-snug text-fg-muted">{note.body}</p>
                      {note.chips.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {note.chips.map((chip) => (
                            <span key={chip} className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] text-fg-dim">
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[12px] leading-snug text-fg-muted">{note.empty}</p>
                      )}
                    </div>
                  ))}
                </div>
                <RuleField label="Preview sample transcription">
                  <textarea
                    className={RULE_TEXTAREA_CLASS}
                    aria-label="Preview sample transcription"
                    value={sampleText}
                    onChange={(event) => setSampleText(event.target.value)}
                    placeholder="e.g. word script follow up note"
                    rows={4}
                  />
                </RuleField>
                <p className="text-[12px] leading-snug text-fg-muted">
                  Type what the recognizer is likely to return, not what you wish it meant. If one spoken idea lands in
                  several transcript forms, model those forms explicitly.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
                    <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">Resolved output</span>
                    <strong className="mt-1 block text-[13px] text-foreground">
                      {previewSource?.preview.output || "No preview yet"}
                    </strong>
                    {previewRuleChips.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {previewRuleChips.map((rule) => (
                          <span
                            key={rule.key}
                            title={rule.title}
                            className="rounded-full bg-surface-strong px-2.5 py-0.5 text-[11px] text-fg-dim"
                          >
                            {rule.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[12px] leading-snug text-fg-muted">
                        No dictionary or snippet rule matched this preview sample.
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
                    <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">
                      Validation diagnostics
                    </span>
                    {issueList.length === 0 ? (
                      <strong className="mt-1 block text-[13px] text-foreground">No blocking rule conflicts right now.</strong>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-2">
                        {issueList.map((entry) => (
                          <li key={`${entry.code}-${entry.rule_ids.join("-")}-${entry.message}`} className="flex items-start gap-2">
                            <StatusBadge tone={entry.severity === "error" ? "error" : "warning"}>{entry.severity}</StatusBadge>
                            <div className="flex min-w-0 flex-col gap-1 text-[12px] leading-snug">
                              <span className="text-fg-dim">{entry.message}</span>
                              {entry.rule_ids.length > 0 && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                  {entry.rule_ids.map((ruleId) => {
                                    const currentRule = currentRuleLookup.get(ruleId);
                                    const previewRule = previewRuleLookup.get(ruleId);
                                    const rule = previewRule ?? currentRule;

                                    if (!rule) {
                                      return (
                                        <span key={ruleId} className="text-fg-muted">
                                          Rule {ruleId}
                                        </span>
                                      );
                                    }

                                    if (!currentRule) {
                                      return (
                                        <span
                                          key={ruleId}
                                          className="text-fg-muted"
                                          title="This issue comes from the imported preview file."
                                        >
                                          {rule.label}
                                        </span>
                                      );
                                    }

                                    return (
                                      <button
                                        key={ruleId}
                                        type="button"
                                        className="font-medium text-brand-strong underline-offset-2 hover:underline"
                                        onClick={() => focusRuleCard(ruleId)}
                                      >
                                        {rule.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {hasImportedOnlyIssues && (
                      <p className="mt-2 text-[12px] leading-snug text-fg-muted">
                        Some diagnostics belong to the imported preview file. Apply that import first if you want those
                        incoming rules to appear as editable cards in this tab.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </FormCard>

            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <strong className="text-[13px] font-semibold text-foreground">How matching works</strong>
              <p className="mt-1 text-[12px] leading-snug text-fg-muted">
                All of this matches the transcript, not raw audio and not semantic intent. Words &amp; names run first
                and match by closeness, which is why they need no spoken form. Replacements and snippets run after
                them and match literally — one entry each, rather than one per way the recognizer might mishear it.
              </p>
            </div>

            {profileHealth && profileHealth.flags.length > 0 && (
              <FormCard
                title={
                  profileHealth.level === "red"
                    ? "Structural conflict detected"
                    : profileHealth.level === "yellow"
                      ? "Potential AI-Cleanup friction"
                      : "No issues found"
                }
                description="These diagnostics describe how the profile configuration may affect AI-Cleanup behavior systemically — not individual rule correctness. Acknowledge a flag to suppress it without changing anything."
                action={
                  <StatusBadge
                    tone={profileHealth.level === "red" ? "error" : profileHealth.level === "yellow" ? "warning" : "success"}
                    dot
                  >
                    Profile health
                  </StatusBadge>
                }
                bodyClassName="py-2"
              >
                {profileHealth.flags.map((flag) => {
                  const isAcknowledged = acknowledgedFlags.has(flag.kind);
                  return (
                    <FormRow
                      key={flag.kind}
                      align="start"
                      label={
                        <span className="flex items-center gap-2">
                          <StatusBadge tone={flag.kind === "form_conflict" ? "error" : "warning"}>
                            {flag.kind === "form_conflict" ? "Conflict" : "Warning"}
                          </StatusBadge>
                          {flag.kind === "length_bias" &&
                            `Length bias — ${flag.direction === "inflating" ? "expanding" : "compressing"} replacements (${flag.entry_count} entries)`}
                          {flag.kind === "form_conflict" && "Contradictory style instructions"}
                          {flag.kind === "cleanup_interference" && "Cleanup-suppressing prompt patterns"}
                        </span>
                      }
                      hint={flag.hint}
                      control={
                        <label className="flex items-center gap-1.5 text-[12px] text-fg-dim">
                          <input
                            type="checkbox"
                            checked={isAcknowledged}
                            onChange={() =>
                              setAcknowledgedFlags((prev) => {
                                const next = new Set(prev);
                                if (next.has(flag.kind)) next.delete(flag.kind);
                                else next.add(flag.kind);
                                return next;
                              })
                            }
                          />
                          Acknowledge
                        </label>
                      }
                    />
                  );
                })}
              </FormCard>
            )}
          </div>
        )}

        {activeWorkspacePanel === "dictionary" && (
          <FormCard
            title="Replacements"
            description="Spoken form → written form. For shorthand you say deliberately, like &quot;KA&quot; for &quot;Kundenanfrage&quot;. Exact and case-insensitive, applied in every mode. Misheard names do not belong here — the recognizer mangles them differently every time, so there is no left side to write down. Put those in Words & names."
            bodyClassName="py-4"
            action={
              <Button
                size="sm"
                onClick={() => updateActiveProfile({ dictionary_entries: [...dictionaryEntries, makeDictionaryEntry()] })}
              >
                <Plus /> Add replacement
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              {dictionaryEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[12px] leading-snug text-fg-muted">
                  No replacements yet. Add a shorthand you say on purpose and what it should be written out as. For a
                  name the recognizer keeps mangling, use Words &amp; names instead — there is no fixed left side to
                  write down.
                </div>
              ) : (
                dictionaryEntries.map((entry, index) => (
                  <DictionaryRuleCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    totalCount={dictionaryEntries.length}
                    isActive={activeRuleId === entry.id}
                    issues={currentIssueMap.get(entry.id) ?? EMPTY_ISSUES}
                    registerRef={registerRuleCardRef}
                    onMove={moveDictionaryEntry}
                    onChange={updateDictionaryEntry}
                    onRemove={removeDictionaryEntry}
                  />
                ))
              )}
            </div>
          </FormCard>
        )}

        {activeWorkspacePanel === "snippets" && (
          <FormCard
            title="Snippets"
            description="Say the trigger phrase, get the expansion. Exact phrase match, applied in every mode."
            bodyClassName="py-4"
            action={
              <Button
                size="sm"
                onClick={() => updateActiveProfile({ snippet_entries: [...snippetEntries, makeSnippetEntry()] })}
              >
                <Plus /> Add snippet
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              {snippetEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[12px] leading-snug text-fg-muted">
                  No snippets yet. Add a trigger phrase and the full expansion WordScript should drop into the final
                  transcript.
                </div>
              ) : (
                snippetEntries.map((entry, index) => (
                  <SnippetRuleCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    totalCount={snippetEntries.length}
                    isActive={activeRuleId === entry.id}
                    issues={currentIssueMap.get(entry.id) ?? EMPTY_ISSUES}
                    registerRef={registerRuleCardRef}
                    onMove={moveSnippetEntry}
                    onChange={updateSnippetEntry}
                    onRemove={removeSnippetEntry}
                  />
                ))
              )}
            </div>
          </FormCard>
        )}


    </div>
  );
}
