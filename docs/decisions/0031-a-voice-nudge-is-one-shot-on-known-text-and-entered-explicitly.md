# 0031 -- A voice nudge is one shot, on known text, entered explicitly

Date: 2026-07-30
Status: Accepted (planning direction; not implemented)

## Context

A dictation lands and is nearly right. Today the only recourse is to dictate the
whole passage again, because every recording is an independent session: capture,
transcribe, one call, insert. Nothing carries over.

The obvious reading of that gap is that conversational state is missing -- that
the product needs a session which survives across recordings so the user can
keep refining. The market says otherwise, consistently enough that building the
obvious thing would have been a mistake.

**Nobody has shipped multi-turn conversational editing.** Every shipped
implementation is one command producing one replacement: Aqua Voice's Edit Mode,
Wispr Flow's Command Mode, VoiceInk's Modes, and Handy's pending `${selected}`
pull request. Multi-turn appears only as a wishlist item -- a Superwhisper
feature request still marked pending, one Hacker News comment -- and has been
validated nowhere.

**Aqua deliberately retreated from voice commands between v1 and v2**, its
founders describing the interaction as "often strained -- not every edit or
change is easy to articulate with your voice." A paying customer reported that
recognizing and executing a voice edit "took a lot longer than making an edit
myself, which I can't do while in dictation mode." The failure is not accuracy;
it is that a voice round trip loses to two seconds of typing.

**The safety case is concrete.** A Handy user reported that the LLM
post-processing pass invented an entire unrelated business email -- fictitious
people, a fictitious marketing campaign -- from a near-silent recording, twice
in a row. A rewrite step that can do that needs a guard on the output, not only
an undo afterwards.

**Entering the mode by inference is the documented failure.** Willow Voice reads
the dictated word "delete" as an edit command with no documented way to turn it
off. Wispr Flow shipped and fixed a bug where the utterance after a command was
silently reprocessed as another command. The decades-old command grammars --
Dragon's "scratch that," Talon, the Apple and Windows dictation verbs -- avoid
this class entirely by using a fixed closed vocabulary, at the cost of
flexibility. Natural language has no reserved words, so an LLM-interpreted edit
mode cannot inherit that protection and must get its unambiguity from somewhere
else.

**Review before commit is the gap in the entire market.** Only Wispr Flow
documents anything, and it is the host application's own `Ctrl+Z` after the
replacement has already happened. No surveyed product has a review step specific
to an AI rewrite.

One structural asymmetry favours WordScript. Every competitor operates on the
operating system's text selection, because none of them retains what it
produced. WordScript does: `insertion.rs` holds `entries: Vec<ScratchpadEntry>`
and `last_transcript`. A nudge aimed at WordScript's own last output needs to
read no selection at all -- which also avoids the Wayland portal wall that
`docs/PLATFORMS.md` and `portal.rs` document at length, and which is where a
selection-based design would have spent most of its cost.

## Decision

**A voice nudge is one shot.** One spoken instruction produces one revised text.
No conversational state is introduced, and no session survives a recording.
Multi-turn refinement is not built until something validates it.

**Its scope is WordScript's own last output**, taken from the scratchpad, not
the operating system's selection. Reading the selection is not rejected forever;
it is out of the first version because it moves the feature onto the platform
layer that already carries the product's worst known issues, for a scope the
product can already address without it.

**It is entered explicitly and never inferred from the transcript.** No wake
word, no intent classifier, no "does this look like a command" heuristic on the
nudge path. The evidence above is that inference is precisely where shipped
products break, and the agent-intent heuristic that exists in `agent.rs` is not
extended to cover this.

**It commits through the existing preview surface.** `clipboard_only` already
provides review before delivery (ADR 0011a), and this is the one place in the
market where that surface is a differentiator rather than parity. The revised
text is shown before it replaces anything.

**The rewrite is guarded against drift, not only reversible.** A length and
similarity check against the input, on the pattern of the guardrail chain
`prompt_enhance` already runs, so a result unrelated to its input is refused
rather than presented. Undo alone is insufficient against the failure actually
reported: a user who does not notice the substitution has nothing to undo.

## Consequences

- The feature is deliberately smaller than the one first proposed. Conversational
  state was the assumption going in, and the research inverted it; that inversion
  is the substance of this record.
- Not building selection support means the nudge cannot revise text WordScript
  did not produce. That is a real limit and should be stated plainly in the UI
  rather than discovered.
- Explicit entry costs a binding the user must learn. That is the price of not
  having Willow's problem, and it is the cheaper side of the trade.
- The drift guard will sometimes refuse a legitimate large rewrite -- "turn this
  into three bullet points" changes length substantially. The threshold is a
  measurement question and belongs with the corpus, not in this record.
- Nothing here needs a provider change. The nudge is one more chat completion
  over text the product already holds.
- The nudge and the agent voice channel (ADR 0030) share the preview discipline
  and the rule against inferring intent from a transcript, and nothing else.
  They are separate features with separate surfaces. In ADR 0030 that rule has
  two concrete forms: spoken questions are serial, so a spoken answer belongs to
  the one open question by construction rather than by inference; and the target
  an interjection concerns is named or clicked, never guessed.
- The drift guard is vacuous on the bridge output of ADR 0030 and is not applied
  there. It protects a *generated* text against its input; a bridge answer is
  transcribed, not generated, and what guards it is the confidence gate and
  hallucination detection.
