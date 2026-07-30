//! The profile's context lines in the one shape every mode uses.
//!
//! `TextProfile.prompt` is free text a user maintains. Every mode that talks to
//! an LLM puts it into its prompt, and before ADR 0021 each did so differently:
//! Cleanup and Rewrite pushed it through the *transcription* hint filter, Agent
//! and Prompt Enhance took it raw and unbounded. That split was never decided —
//! it arrived when `filter_profile_hint_lines` was reused for the correction
//! prompt in a commit about STT bias.
//!
//! What stays here is the shape: normalized, deduplicated, truncated per line
//! and capped. What does *not* live here is how strongly a mode may lean on the
//! context — that is the instruction each caller wraps around these lines, and
//! it belongs with the mode, not with the profile.
//!
//! Deliberately no word-shape predicate. `is_profile_hint_candidate` asks "could
//! Whisper mis-hear this token", which is the right question for an initial
//! prompt (ADR 0017) and the wrong one for a chat prompt.

/// The context block is bounded in characters, not in lines.
///
/// A line count is the wrong unit: it says nothing about how much of the prompt
/// the block consumes, and any round number lands somewhere arbitrary. The
/// first version of this module capped at 8 lines, which was exactly the length
/// of every shipped curated profile — so adding one line silently dropped it.
/// A silent drop of a field the user edits is the defect class ADR 0020 exists
/// about.
///
/// 600 is roughly five times what the curated profiles use (110–120 characters)
/// and stays small next to the 1700–2400 character instruction block it sits
/// in. It exists to stop someone pasting a meeting transcript into the field,
/// not to ration normal use.
pub const MAX_CONTEXT_CHARS: usize = 600;
pub const MAX_CONTEXT_LINE_CHARS: usize = 80;

/// What the runtime does with a profile's context field, including the part it
/// will not send. The UI renders this rather than recomputing the rule.
#[derive(Debug, Clone, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
pub struct ProfileContextBudget {
    /// Lines that fit and are sent, in order.
    pub accepted: Vec<String>,
    /// Lines dropped because the budget was already spent. Never silent.
    pub dropped: Vec<String>,
    pub used_chars: usize,
    pub max_chars: usize,
}

/// Splits a profile free-text field into bounded context lines.
///
/// Empty input yields an empty vector, so a caller can drop its whole section
/// rather than emit an empty label.
pub fn profile_context_lines(value: &str) -> Vec<String> {
    profile_context_budget(value).accepted
}

/// The same split, plus what did not fit. `profile_context_lines` is the hot
/// path; this one exists so the UI can show the boundary instead of leaving the
/// user to discover it.
pub fn profile_context_budget(value: &str) -> ProfileContextBudget {
    let mut accepted: Vec<String> = Vec::new();
    let mut dropped: Vec<String> = Vec::new();
    let mut used = 0usize;

    for raw_line in value.lines() {
        let candidate = normalize_line(raw_line);
        if candidate.is_empty() {
            continue;
        }

        if accepted
            .iter()
            .chain(dropped.iter())
            .any(|existing: &String| existing.eq_ignore_ascii_case(&candidate))
        {
            continue;
        }

        let line = truncate_line(&candidate);
        // The separator the prompts join with counts against the budget too,
        // otherwise the rendered block can exceed what this promises.
        let cost = line.chars().count() + if accepted.is_empty() { 0 } else { 3 };

        if used + cost > MAX_CONTEXT_CHARS {
            dropped.push(line);
            continue;
        }

        used += cost;
        accepted.push(line);
    }

    ProfileContextBudget {
        accepted,
        dropped,
        used_chars: used,
        max_chars: MAX_CONTEXT_CHARS,
    }
}

/// The single-line rendering the prompts share, or `None` when there is nothing
/// to say.
pub fn profile_context_line(value: &str) -> Option<String> {
    let lines = profile_context_lines(value);
    if lines.is_empty() {
        return None;
    }

    Some(lines.join(" | "))
}

fn normalize_line(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn truncate_line(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= MAX_CONTEXT_LINE_CHARS {
        return trimmed.to_string();
    }

    let shortened: String = trimmed.chars().take(MAX_CONTEXT_LINE_CHARS).collect();
    format!("{shortened}...")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_multi_word_lowercase_lines_that_the_stt_filter_drops() {
        // The six lines the transcription filter rejects on the curated
        // Product-and-engineering profile. Measured against 96 real
        // transcripts: none of them ever reached a cleanup output (ADR 0021).
        let lines = profile_context_lines(
            "feature names\nbug IDs\nrelease scope\nAPI names\nplatform constraints\nservice names\nmigration steps\ninfra constraints",
        );

        assert_eq!(
            lines,
            vec![
                "feature names",
                "bug IDs",
                "release scope",
                "API names",
                "platform constraints",
                "service names",
                "migration steps",
                "infra constraints",
            ]
        );
    }

    #[test]
    fn every_curated_profile_fits_with_room_to_grow() {
        // The shipped profiles are the case the old line cap sat exactly on.
        // They must not merely fit; there has to be headroom, or the first
        // line a user adds disappears.
        let curated = "feature names\nbug IDs\nrelease scope\nAPI names\nplatform constraints\nservice names\nmigration steps\ninfra constraints";
        let budget = profile_context_budget(curated);

        assert!(budget.dropped.is_empty());
        assert_eq!(budget.accepted.len(), 8);
        assert!(
            budget.used_chars * 3 < MAX_CONTEXT_CHARS,
            "a shipped profile should use well under a third of the budget, used {}",
            budget.used_chars
        );
    }

    #[test]
    fn spends_the_budget_in_characters_and_reports_what_did_not_fit() {
        // 30 lines of 40 characters: far past the budget, nowhere near any
        // plausible line count.
        let many = (0..30)
            .map(|index| format!("{index:02} {}", "x".repeat(37)))
            .collect::<Vec<_>>()
            .join("\n");
        let budget = profile_context_budget(&many);

        assert!(budget.used_chars <= MAX_CONTEXT_CHARS);
        assert!(!budget.dropped.is_empty());
        assert_eq!(budget.accepted.len() + budget.dropped.len(), 30);
        // The rendered block must honour the number the budget advertises.
        assert!(budget.accepted.join(" | ").chars().count() <= MAX_CONTEXT_CHARS);
    }

    #[test]
    fn a_line_count_far_above_the_old_cap_still_passes_when_the_lines_are_short() {
        let many = (0..30)
            .map(|index| format!("term{index}"))
            .collect::<Vec<_>>()
            .join("\n");
        let budget = profile_context_budget(&many);

        assert!(budget.dropped.is_empty(), "30 short lines fit in 600 chars");
        assert_eq!(budget.accepted.len(), 30);
    }

    #[test]
    fn truncates_an_overlong_line() {
        let long = "x".repeat(MAX_CONTEXT_LINE_CHARS + 40);
        let lines = profile_context_lines(&long);

        assert_eq!(lines.len(), 1);
        assert!(lines[0].ends_with("..."));
        assert_eq!(lines[0].chars().count(), MAX_CONTEXT_LINE_CHARS + 3);
    }

    #[test]
    fn drops_blank_lines_and_collapses_inner_whitespace() {
        let lines = profile_context_lines("  release   scope \n\n\n  bug IDs  ");

        assert_eq!(lines, vec!["release scope", "bug IDs"]);
    }

    #[test]
    fn deduplicates_case_insensitively() {
        let lines = profile_context_lines("Release Scope\nrelease scope\nRELEASE SCOPE\nbug IDs");

        assert_eq!(lines, vec!["Release Scope", "bug IDs"]);
    }

    #[test]
    fn empty_input_yields_no_line() {
        assert!(profile_context_lines("   \n\n  ").is_empty());
        assert!(profile_context_line("   \n\n  ").is_none());
    }

    #[test]
    fn renders_one_joined_line() {
        assert_eq!(
            profile_context_line("release scope\nbug IDs").unwrap(),
            "release scope | bug IDs"
        );
    }
}
