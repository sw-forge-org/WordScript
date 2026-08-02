# 0034: A Limit Belongs to the Control That Spends It

Date: 2026-08-01
Status: Accepted

## Context

ADR 0033 fixed a silent drop: terms switched on past the recognizer's slot
budget reached neither `accepted` nor `ignored`, so no surface could name them.
The fix collected them in `over_limit` and rendered a card for them.

Reading the finished panel showed the fix stopped one step short. The switch
that spends a slot sits on a row; the budget it spends against sat in a
different card, below a textarea, under the heading "Rule check and preview".
Switching on a fifth term produced no change anywhere the user was looking. The
loss was reported, but the report was out of sight of the control, which is the
same defect one layer up: not an unreported consequence, an unfindable one.

Three smaller findings came from the same reading:

- **The order that decides the outcome could not be changed.** Which terms fit
  the budget follows list order. Words & names was the one list of the three
  with no move controls, while Replacements and Snippets — where order rarely
  decides anything — had them.
- **The preview ran a pipeline the runtime does not have.** `preview_transform`
  built its `NativeTransformConfig` with `vocabulary` defaulted to empty, so the
  repair pass ADR 0033 added never ran in the panel that exists to show what the
  rules do.
- **Copy contradicted the decision it shipped with.** The Replacements empty
  state — the first text a new user sees there — read "Add the phrases Groq
  hears wrong", the exact habit ADR 0033 exists to end, three lines under a
  description saying the opposite. The "Literal rule model" note advised adding
  one entry per transcript variant. Two counters and several labels still named
  `stt_hints`, a field the panel has not edited since ADR 0017 and whose content
  migration moved into `vocabulary_hints`, so "STT hints: 0" sat beside a
  profile with six terms.

## Decision

**A limit is stated where it is spent.** The recognizer's remaining capacity
appears on the Words & names card header, and each row says what it does: sent,
past the budget, too long for the recognizer, or too short for deterministic
repair. The two cards that reported the same facts from a distance are removed —
with the status on the row they explained nothing further, and a second copy of
a message is a second thing to keep true.

The per-row states are resolved from the analysis the runtime returned, never
recomputed. `MAX_TRANSCRIPTION_STT_HINTS`, the length ceiling and
`MIN_TERM_CHARS` are runtime rules (ADR 0032, ADR 0033); a threshold restated in
TypeScript is a threshold that drifts, and the drift is invisible because both
sides still look right in isolation. Where the analysis has not arrived, a row
reports nothing rather than guessing.

**The runtime reports its own boundaries.** `VocabularyRepairCoverage` is added
to `TextRulesAnalysis`, splitting the term list into what the deterministic layer
can act on and what it cannot. This is the mechanism that lets the panel name a
floor it does not own. `too_short` is not a defect to fix — the floor exists
because a short term has too many neighbours — so the row states the effect the
term does have rather than asking for a correction.

**Order is editable where order decides.** Words & names gets move controls.
This is not symmetry with the other two lists; it is the opposite. There, order
is a tie-break between rules that all run. Here it decides which terms travel at
all, which is the stronger reason to expose it.

**The preview runs the pipeline the runtime runs.** `analyze_text_rules` passes
the profile's full term list — not the recognizer-opted subset, since repair and
the LLM term block do not consult that switch — into the preview transform.
`analyze_document_with_context` keeps its old behaviour for the import and export
paths, where a document genuinely carries no vocabulary.

A repair now also renders as its own chip (`Repaired: <term>`) instead of
falling through to the generic "A text rule changed the preview output". ADR 0033
argued a fuzzy rewrite has more reason to be visible than an exact one; it was
the only one that could not say what it did.

## Consequences

The panel has one place per fact. Any future limit that gates a per-row control
belongs on that row by the same argument, and the runtime has to report it for
the row to be able to say so.

`stt_hints` is now absent from the panel's user-visible surface entirely. It
survives as a migration remnant only, which is what the spec already says it is.

The status line is silent for a term that does the ordinary thing. Every term
reaches every AI mode, so saying that on each row would bury the two rows that
differ. Rows report only where they deviate.

The two removed cards had tests; they are replaced by tests asserting the same
facts on the row. The distinction that mattered in ADR 0033 — too long versus
past the budget, because the fixes differ — is asserted at the new location.

## Related

- ADR 0033 — reported the over-limit loss. This ADR moves the report to the
  control and extends the argument to the repair floor and the list order.
- ADR 0032 — the context field never reaches the recognizer. Its budget meter
  already sat on the field it governs; this ADR brings the vocabulary list in
  line with that.
- ADR 0020 — a control whose effect is invisible. A control whose effect is
  visible somewhere else is the weaker form of the same problem.
