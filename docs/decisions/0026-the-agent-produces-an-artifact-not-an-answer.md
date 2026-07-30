# 0026: The Agent Produces an Artifact, Never an Answer

Date: 2026-07-30
Status: Accepted

## Context

Reported from live use after ADR 0023 shipped: in Agent mode the inserted text
is sometimes a chat reply to the dictation instead of the thing the dictation
asked for.

    dictated: "Hey WordScript, schreib mir bitte eine E-Mail an Jürgen,
               er soll das und jenes machen."
    inserted: "Ja, das sollte Jürgen auf jeden Fall machen, das wird er
               sicher auf die Reihe bekommen, bis heute Abend um 8 Uhr."

Two defects in one output. The mode answered where it was told to write, and
the answer carries a time nobody dictated -- a model that has decided it is in a
conversation supplies conversational filler, and the rule against inventing
facts was already in the prompt while this happened. The report describes it as
inconsistent across `communication_length` and as not bound to one register.

Three causes, all in `build_agent_system_prompt` and the block it pulls in.

### 1. The prompt never named the deliverable

Every rule the prompt carried was negative -- no preamble, no invented facts,
no profile content -- and a negative rule bounds a result it never defines. A
conversational reply satisfies all of them: it has no preamble, it derives
nothing from the profile, and "no explanation" reads as satisfied by a short
answer. The one positive line, *"carry it out precisely and completely"*, is
compatible with answering, because agreeing with an instruction is one way to
respond to it.

Nothing said what the output *is*, and nothing said who it is written to. The
addressee is the load-bearing half: a dictation names a third party ("an
Jürgen"), and if the prompt does not fix the addressee to that person, the
nearest available addressee is the user.

### 2. The user turn is formally a chat message

ADR 0023 reduced the user turn to the transcript alone. That was right for the
leak it fixed and it stays. Its side effect is that the transcript is now
formally indistinguishable from a message to an assistant, and a message to an
assistant has exactly one default prior in an instruction-tuned model: answer
it. The only counterweight was the system turn -- whose first bullet opened
with the chat verb itself, *"**Reply** with the finished result text only"*.

### 3. `Length: Full` licensed narrating the task

*"Spell out context and reasoning, with full framing."* Whose reasoning was
never said, so the nearest available answer is the model's own. This does not
cause the defect alone -- it is reported at `normal` too -- but it removes the
last thing standing against it, which is what "mal so, mal so" looks like from
outside.

There was also no stated fallback. When an instruction is not executable as
dictated, the prompt said nothing, so the model fell back to its base
behaviour, which is conversation.

## Decision

### The output contract is a named block in the system turn

`AGENT_OUTPUT_CONTRACT` (`core::agent`), first in the prompt, before the profile
context and before the style block. What the output *is* comes before what may
go into it, and both before how it is written.

- The user turn is a transcript of dictated speech, not a message addressed to
  you. Never answer it, never comment on it, never confirm, agree with or
  evaluate it, and never write to the user.
- Produce the artifact the instruction asks for -- an email, a message, a list,
  a summary, a text. Your output is that artifact alone, from its first word to
  its last.
- When the instruction names an addressee, the result is written to that
  addressee. The user is never the addressee.
- When the instruction cannot be carried out as dictated, output its content as
  plain text and nothing else. Never ask a question back, never explain why.

The fourth line is the fallback the prompt lacked. A dictation app that cannot
execute an instruction still owes the user their words; what it must never do
is start a conversation about them.

`Reply with the finished result text only` becomes `Output the finished result
text only`. The rest of that bullet is unchanged.

### The counterweight goes in the system turn, not on the transcript

The obvious alternative is to restore a prefix on the user turn -- an
`Instruction:` label that marks the transcript as material rather than as
address. Rejected. The transcript is the one part of this request that is the
user's own words, and ADR 0023's split is worth more than the marginal framing
a prefix buys: a prefix is a line the model may also read as content, and the
defect this ADR fixes is a model reading framing as content. The system turn is
where framing lives in every other mode.

Named as a constant rather than inlined so the tests and the corpus parity
driver can anchor on it, for the reason `build_agent_system_prompt` exists at
all (ADR 0023): a framing sentence that no test can name is a framing sentence
outside the check.

### Length describes the result, not the task

`CommunicationLength::Full` now says where the words go -- inside the result --
and rules out the two ways a longer text grows without the instruction growing
with it: *"Develop what the instruction gives -- its background, its framing,
what follows from it -- inside the result itself, in full sentences. Never
explain your own reasoning and never add facts the instruction does not
contain."*

`Terse` and `Normal` are untouched, and `Normal` still emits nothing.
`core::communication_style` is one producer for two modes, so this reaches
Rewrite as well. That is intended: an expansive rewrite that narrates its own
reasoning is the same defect wearing the other mode's name.

## Consequences

- Agent mode has a positive definition of its output for the first time. The
  negative rules stay; they now bound something.
- With `register = off` the style block is still absent, but the contract is
  not -- the reported case was not style-bound, and the contract is a property
  of the mode rather than of the style.
- ADR 0023 is unchanged and its assertion still holds:
  `user_turn_carries_only_the_transcript` passes as written.
- The `full` prompt text changes for Rewrite too, so a profile on
  `register != off` with `length = full` gets a different Rewrite prompt than
  before this ADR. `register = off` remains byte-identical to the pre-style
  build.

## Not measured

Prompt shape is asserted -- four new tests in `core::agent` and one in
`core::communication_style`, 513 cargo tests green. Output quality is not:
demonstrating that the mode stops replying needs a live provider across the
matrix the report spans (`length` x `register`), which is the instrument ADR
0021 describes and which has not been run for this change. Until it is, this
ADR fixes a prompt that provably has the contract in it, not a mode that has
provably stopped answering.
