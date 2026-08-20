# 0245 - A draft does the work its instruction asks for, an echo is not a result, and the pill calls the mode what every other surface calls it

Date: 2026-08-20
Status: **Accepted.** Three defects reported from live use in one dictation, all
of them in the mode ADR 0029 renamed to `draft`.

Narrows the output contract of
[ADR 0026](0026-the-agent-produces-an-artifact-not-an-answer.md), which was
written against one defect and drawn wide enough to forbid a second, legitimate
class of instruction. Completes the rename decided in
[ADR 0029](0029-the-agent-mode-carries-out-an-instruction-it-does-not-act.md),
whose surface half had landed everywhere except the pill. Does not touch
[ADR 0023](0023-profile-context-is-a-reading-aid-and-a-register-sets-form-not-lexis.md): the profile
block stays a reading aid and the user turn stays a bare transcript.

## Context

### The dictation

Dictated into Draft on 2026-08-20 at 16:08, profile *Founder ops notes*,
assistant model `openai/gpt-oss-120b` (record `history-1787234929217-54`, 83 s
of capture, `capture_integrity: intact`).

The instruction opened with the spoken address, then set out a rule and gave the
data for it: a series of words, each paired with a number, and the closer a
word's number stands to 1 the more it is the one being pointed at. It asked the
mode to work out which word that is and to list its best guesses beside it.
About a dozen word-and-position pairs followed, from 44 up past 1000. Nothing in
that transcript is a text to be reshaped — every word of the result had to be
derived from the rule the instruction states.

The record says the run was healthy in every field that reports health:

| Field | Value |
| --- | --- |
| `effective_mode` | `agent` |
| `applied_rules` | `["agent_mode"]` |
| `corrected` | `true` |
| `transform_warning` | `null` |
| `error` | `null` |
| `turnaround_ms` | 2052 |
| `pasted` | `true` |

And the runtime log says the provider answered:
`[Agent] Execution done elapsed_ms=615 output_len=473`.

`transformed_transcript` is the dictation, word for word. 473 characters in,
473 characters out, pasted at the cursor by `remote_desktop_portal`. The user
asked a question and got their own question back, with nothing anywhere saying
so.

### Defect 1 - the contract forbade the work

Two rules in `build_agent_system_prompt` exclude this instruction, and both were
written by ADR 0026 against a different failure.

`AGENT_OUTPUT_CONTRACT`, first line: *"The user turn is a transcript of dictated
speech, not a message addressed to you. **Never answer it**"*. The instruction
is a question put to the assistant. Answering it is the task.

The head section, last line: *"All content comes from the instruction. **Do not
invent facts, names, dates or numbers the user did not dictate**"*. The words
this puzzle asks for are, by construction, content that was not dictated.

With both closed, the fourth line of the contract is the only door left open:
*"When the instruction cannot be carried out as dictated, output its content as
plain text and nothing else."* The model took it. It obeyed the prompt exactly.

**ADR 0026 conflated two different things under one word.** Its defect was an
instruction to write a named colleague an email asking them to do something,
answered with a turn addressed to the user — agreeing that the colleague should
indeed do it and would manage it — and carrying a delivery time the instruction
never named. Two wrongs there, and ADR 0026 fixed both with one rule:

1. **A conversational turn where an artifact was asked for.** Agreement
   addressed to the user is a reply, not the email that was asked for. That is
   the real defect, and forbidding it is right.
2. **An unasked-for addition.** The delivery time is a fact about the user's
   world that nobody dictated and nobody asked the model to pick. Forbidding it
   is also right.

Neither of them is *derivation*. But "never answer it" and "do not invent
anything the user did not dictate" are both wide enough to forbid derivation,
and derivation is a large share of what a first version of a text is for. The
mode named `draft` refused to draft.

The line the two defects actually draw is **asked-for versus unasked-for**:

| Instruction | Needs derivation | Contract before | Contract after |
| --- | --- | --- | --- |
| Summarize the three points just dictated | no | produced | produced |
| Write a colleague an email asking them to do X | no | produced | produced |
| …and it supplies a delivery time nobody named | — | forbidden | forbidden |
| Work out which word a list of positions points at, and rank the runners-up | **yes** | **echoed** | **produced** |
| …and the result opens by telling the user here are the guesses | — | forbidden | forbidden |

Rows 3 and 5 are what ADR 0026 exists for and they do not move. Row 4 is the
class it took out with them.

### Defect 2 - the refusal was silent, and it is the worse of the two

Defect 1 is a boundary drawn in the wrong place, and a boundary can be argued
about. This one cannot: `apply_agent_transform` returned

```rust
AgentResult { text: <the dictation>, was_agent: true, warning: None }
```

`was_agent` is the runtime's own claim that the mode did its job, and it is set
from nothing but "the HTTP call returned Ok". `corrected: true` reached the
record, `transform_warning: null` reached the record, and the echo reached the
cursor through the ordinary `direct_paste` path — indistinguishable, at every
surface, from a Draft that worked.

The product's standing rule is
[ADR 0134](0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)'s
and the repository instruction's: *show runtime truth, and when the runtime is
not ready, show the next action instead*. A refusal reported as a success is the
one thing that rule forbids. The user's next action here — rephrase, or take the
question somewhere that answers questions — depends entirely on knowing that
nothing was produced, and every field the product could have said it in said the
opposite.

**The fallback itself stays.** Returning the dictation rather than nothing is
correct: this is a dictation app, and a mode that eats 83 seconds of speech
because it disliked the instruction is worse than one that hands it back. What
was missing is the sentence saying which of the two just happened.

### Defect 3 - the pill still says Agent

ADR 0029's Consequences renamed the mode to `draft`, because ADR 0030 gives the
product a settings area named `Agents` for coding agents and two unrelated
things cannot both be called Agent. The rename landed on the surface as
`PROCESSING_MODE_LABELS` in `lib/transformRules.ts`, whose own doc comment says
`ProcessingMode::Agent` is drawn as `Draft` **everywhere** — Home's record,
History's meta line, the mode key on Hotkeys, the lane on AI Models, Onboarding,
Handoff, and `OverlayPillDrawing` in the ported prototype, which defaults to
`mode = "Draft"`.

The live overlay pill kept a second copy of that map: `modeShortLabel()` in
`components/overlay/OverlayPill.tsx`, a private `switch` returning `"Agent"`.
It is the exact failure
[ADR 0123](0123-a-fact-has-one-list-and-a-track-is-a-directory-not-a-naming-convention.md) is about — a second copy is a second
chance to disagree, and this one had already disagreed. The pill is also the
surface where the collision bites hardest: ADR 0030's delivery target is
reachable by cycling the same control and is legitimately called `Agent`, so
one chip was on its way to showing the same word for two unrelated things.

## Decision

### 1. The contract distinguishes asked-for work from unasked-for content

`AGENT_OUTPUT_CONTRACT` (`core::agent`) keeps its position — first in the system
turn, before the profile context and before the style block — and keeps every
prohibition ADR 0026 put in it. Two changes:

- **"Never answer it" becomes "never reply to it."** What ADR 0026 forbade is a
  conversational turn addressed to the user: a confirmation, an evaluation, a
  comment, a greeting. It never meant to forbid producing the result of a
  question, and the word "answer" cannot carry that distinction.
- **A new line states the positive case**, because ADR 0026's own analysis is
  that negative rules bound a result they never define, and the result was still
  undefined for one whole class of instruction: when the instruction asks the
  model to solve, decide, choose, find, rank, guess or answer, **the finished
  result of that work is the artifact**, and it is produced.

The fallback line is narrowed to what it was for. It now applies only when the
transcript carries no instruction at all, and says outright that echoing the
instruction back is not a result — otherwise it stays the cheapest way to
satisfy every other rule, which is what it just was.

The head section's last line is split along the same seam. It bounds what may be
**added** to an artifact — a fact, name, date or number about the user's world
that they neither dictated nor asked for — and states that it does not bound
work the instruction explicitly asks for. The delivery time nobody named is
still forbidden; the answer to a question is not.

### 2. An echo is detected in the runtime and reported as one

`apply_agent_transform` compares its reply to the instruction after normalising
away case, whitespace and punctuation. When the reply is the instruction, the
result is:

```rust
AgentResult { text: <the dictation>, was_agent: false, warning: Some(…) }
```

The text still goes through — nothing is lost — and every surface downstream now
reads the truth: `corrected: false`, and a `transform_warning` that History
renders ahead of its own "the AI stage ran and changed nothing" note.

**Why an exact comparison and not a similarity threshold.** A threshold would
have to fire on outputs that legitimately resemble their input — "format this as
a list", "remove the filler words" — and a false refusal notice on a working
draft costs more than a missed echo. Equality after normalisation is the only
comparison that cannot be true of work that was actually done. The one
extension is a contiguous-substring test at 80% of the instruction's length,
which catches the near-certain second shape: the instruction echoed back with
the spoken address trimmed off the front.

**`was_agent` now means what its name says.** It was set from "the call
returned Ok", which is a fact about HTTP, and read downstream as "the mode
produced something", which is a fact about the result. Those are different
claims and the field only ever wanted the second one.

### 3. The pill reads the mode's name from the one map that holds it

`modeShortLabel()` is deleted. `PROCESSING_MODE_SHORT_LABELS` is added beside
`PROCESSING_MODE_LABELS` in `lib/transformRules.ts`, spread from it so that a
name can only be written in one place, and overriding the single entry that is
genuinely shorter on a 480 px pill (`prompt_enhance` → `Enhance`). The pill
imports it.

A test walks `ProcessingMode` and asserts the two maps agree everywhere they are
not deliberately different. The drift this closes happened once already, in
silence, and the map is now read by four surfaces rather than three.

The runtime token stays `agent`. ADR 0029 holds it as the persisted contract
with `agent` accepted as a legacy alias, and nothing here reopens that — this is
the label, not the value.

## Consequences

- **Draft answers questions now, and that is the mode working rather than the
  mode overstepping.** ADR 0026's prohibitions are intact: no reply to the user,
  no addressee but the one the instruction names, no unasked-for facts. What
  changed is that "produce the artifact" now covers artifacts whose content had
  to be worked out. A record that wants to re-close this owes an answer to the
  table in Defect 1, specifically to row 4.
- **`docs/spec/SPEC.md` and `docs/REFERENCE.md` state the mode's scope**, and
  both said Draft turns a dictation into a first version of a text. That is
  still true and is now true of a wider class of dictation.
- **This does not build ADR 0040's Ask window and does not reduce the case for
  it.** Draft still assembles exactly two messages and still cannot reach a note
  or a meeting; "Write the mail from Tuesday's meeting" fails here for the
  reason ADR 0040 gives, which is context, not permission. What this record
  removes is a second, unrelated reason the same sentence would have failed.
- **The echo notice is a History surface, not an overlay one.** The overlay pill
  has no variant that carries a note beside a result, and adding one touches the
  window geometry that
  [`../known-issues/overlay-ghosting.md`](../known-issues/overlay-ghosting.md)
  and the 480 px width invariant exist to protect. The runtime now reports the
  refusal truthfully at the seam; which surface draws it is a UI decision that
  belongs to whoever next opens the result surface, and it has a correct value
  to draw when they do.
- **`was_agent` is a result claim and not a transport claim.** Any future caller
  reading it as "the provider responded" is reading it wrong; that fact lives in
  the `Err` arm and in the runtime log.
