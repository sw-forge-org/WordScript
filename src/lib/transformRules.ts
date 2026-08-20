import type { ProcessingMode } from "../types/ipc";

/**
 * THE TRANSFORM RULE VOCABULARY — what the runtime's `applied_rules` mean.
 *
 * Recovered from `components/settings/RebuildLabTab.tsx`, which Leg 3 deleted
 * with the pre-port Diagnostics area (ADR 0054: a replaced surface goes in the
 * commit that replaces it). The area was replaced; this was not. It is the one
 * place in the product that knows what `phrase_repetition_collapsed` is, and
 * losing it would mean a Diagnostics screen that prints runtime identifiers at
 * a person reading it because something is wrong.
 *
 * It is `lib/` rather than a component because it is runtime vocabulary: the
 * strings come from `src-tauri`'s transform stage, and the next surface that
 * has to explain one should read this rather than write a second table.
 *
 * A rule this table does not know is humanised rather than dropped. The runtime
 * may grow one at any time, and a rule the user cannot see is worse than a rule
 * whose description is generic.
 */

export interface AppliedRuleInfo {
  id: string;
  label: string;
  description: string;
}

function humanizeRuleId(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function describeAppliedRule(rule: string): AppliedRuleInfo {
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
        label: humanizeRuleId(rule),
        description: "A runtime text-processing rule changed or validated the transcript.",
      };
  }
}

/**
 * WHAT A PROCESSING MODE IS CALLED ON THE SURFACE, and it is not what the
 * runtime calls it in one place. `ProcessingMode::Agent` is drawn as `Draft`
 * everywhere in the ported design — Home's record, History's meta line, the
 * mode key on Hotkeys, the lane on AI Models — because "Agent" now means
 * ADR 0030's desk, which is a different feature that Agents states on itself in
 * as many words ("This is not the Draft mode").
 *
 * Here rather than in a screen for the same reason `describeAppliedRule` is:
 * three surfaces read it, and a second copy is a second chance to disagree.
 */
export const PROCESSING_MODE_LABELS: Record<ProcessingMode, string> = {
  auto: "Auto",
  verbatim: "Verbatim",
  cleanup: "Cleanup",
  rewrite: "Rewrite",
  translate: "Translate",
  agent: "Draft",
  prompt_enhance: "Prompt Enhance",
};

/**
 * THE SAME NAMES, ON THE PILL. Spread from the map above rather than written
 * out, so a mode's name can only be typed in one place.
 *
 * The overlay pill lives in a 480px window whose rounded ends clip if the pill
 * outgrows it, which is why one entry is genuinely shorter here. That is the
 * only licence this map has: an entry that differs for any other reason is
 * drift, and `processingModeLabels` in `transformRules.test.ts` fails on it.
 *
 * It exists because the pill used to carry its own private `switch` (ADR 0245).
 * It answered `Agent` for `agent` — the name ADR 0029 retired, and the name
 * ADR 0030 gives to a different feature reachable by cycling the very same
 * control. A second copy is a second chance to disagree, and this one had
 * already taken it.
 */
export const PROCESSING_MODE_SHORT_LABELS: Record<ProcessingMode, string> = {
  ...PROCESSING_MODE_LABELS,
  prompt_enhance: "Enhance",
};
