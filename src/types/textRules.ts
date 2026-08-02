import type { DictionaryEntry, SnippetEntry } from "./ipc";

// ── Profile Health ─────────────────────────────────────────────────────────────

export type ProfileHealthLevel = "green" | "yellow" | "red";
export type LengthBiasDirection = "inflating" | "deflating";

export type ProfileHealthFlag =
  | { kind: "length_bias"; direction: LengthBiasDirection; entry_count: number; hint: string }
  | { kind: "form_conflict"; hint: string }
  | { kind: "cleanup_interference"; hint: string }
  | { kind: "bias_policy_weak"; hint: string };

export interface ProfileHealthStatus {
  level: ProfileHealthLevel;
  flags: ProfileHealthFlag[];
}

export interface GetProfileHealthRequest {
  prompt: string;
  dictionary_entries: DictionaryEntry[];
  acknowledged_flags: string[];
  bias_mode?: string | null;
  processing_mode?: string | null;
  profile_id?: string | null;
}

export type TextRulesConflictResolution = "merge_imported_wins" | "replace_current";
export type TextRulesIssueSeverity = "error" | "warning";
export type TextRulesIssueCode =
  | "empty_dictionary_phrase"
  | "empty_dictionary_replacement"
  | "empty_snippet_label"
  | "empty_snippet_trigger"
  | "empty_snippet_expansion"
  | "duplicate_dictionary_phrase"
  | "duplicate_snippet_trigger"
  | "dictionary_snippet_overlap"
  | "duplicate_rule_id"
  | "ignored_stt_hint"
  | "stt_hint_limit_reached"
  | "no_usable_stt_hints"
  | "import_schema_mismatch"
  | "import_parse_failed";

export interface TextRulesIssue {
  severity: TextRulesIssueSeverity;
  code: TextRulesIssueCode;
  message: string;
  rule_ids: string[];
}

export interface TextRulesPreview {
  input: string;
  output: string;
  applied_rules: string[];
}

/**
 * What the recognizer receives. The profile context field is deliberately
 * absent: it holds topics, and an initial prompt can only be conditioned on
 * literal tokens, so the field never travels this path (ADR 0032). The
 * profile's lexical channel is `vocabulary_hints`, which arrives here as
 * `stt_hints`.
 */
export interface TextRulesBiasPreview {
  dictionary_terms: string[];
  stt_hints: string[];
  ignored_stt_hint_lines: string[];
  /** Terms switched on for the recognizer that did not fit its slot budget. Kept
   * apart from `ignored_stt_hint_lines` because the fix differs: these need a
   * switch turned off elsewhere, not a shorter term. */
  over_limit_stt_hint_lines: string[];
  cloud_prompt_preview?: string | null;
  local_prompt_preview?: string | null;
  manual_overrides_applied: string[];
  effective_stt_hints_source: string;
}

/**
 * What the runtime does with the profile context field. Mirrors
 * `core::profile_context::ProfileContextBudget`; the UI renders it rather than
 * recomputing the budget, so the boundary shown is the one actually applied.
 */
export interface ProfileContextBudget {
  accepted: string[];
  dropped: string[];
  used_chars: number;
  max_chars: number;
}

/**
 * Which vocabulary terms the deterministic repair layer can act on. Mirrors
 * `core::text_rules::VocabularyRepairCoverage`. `too_short` is not a defect to
 * fix: below the floor a term has too many neighbours to rewrite safely (ADR
 * 0033), so the row says which of its two effects it has rather than asking for
 * a correction.
 */
export interface VocabularyRepairCoverage {
  repairable: string[];
  too_short: string[];
  min_chars: number;
}

export interface TextRulesAnalysis {
  blocking: boolean;
  issues: TextRulesIssue[];
  preview: TextRulesPreview;
  transcription_bias: TextRulesBiasPreview;
  profile_context: ProfileContextBudget;
  vocabulary_repair: VocabularyRepairCoverage;
  dictionary_count: number;
  snippet_count: number;
}

export interface TextRulesDocument {
  schema_version: number;
  prompt: string;
  stt_hints: string;
  dictionary_entries: DictionaryEntry[];
  snippet_entries: SnippetEntry[];
}

export interface ImportTextRulesResponse {
  document: TextRulesDocument;
  analysis: TextRulesAnalysis;
}

export interface ExportTextRulesResponse {
  path: string;
  analysis: TextRulesAnalysis;
}