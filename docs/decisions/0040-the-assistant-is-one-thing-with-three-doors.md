# 0040 -- The assistant is one thing with three doors

Date: 2026-08-03
Status: Accepted (planning direction; not implemented)

## Context

The product has been building the same assistant twice, on two surfaces, with
two models and two names.

**The first is the `draft` mode** (ADR 0029, renamed from `agent`): you dictate
an instruction, it returns a first version, the text lands at your cursor.

**The second was a notes-and-meetings model.** §11.20 of the settings rework
plan gave Language Models a fifth tab called Notes, holding the model that
writes a meeting summary, runs an action from a note's action bar and answers in
the Ask window. §11.30 then put a rule before that tab, because four of the five
entries were processing modes and the fifth was not -- a tab bar is a claim that
its entries are the same kind of thing, and this one was claiming that
formatting a note is a fifth way to transform a dictation.

The rule was right about the surfaces and wrong about the thing. Drawing the
boundary was cheaper than noticing that there was no boundary.

### The sentence the split cannot serve

> "Write the mail from Tuesday's meeting."

This is an ordinary thing to say into a dictation product that also records
meetings, and neither half could do it:

- **Draft** could write a mail and could not reach Tuesday's meeting. It
  assembles exactly two messages -- a system prompt and the transcript
  (`agent::build_agent_request`) -- so the meeting is not in its context and
  there is no path by which it could be.
- **Ask** could reach Tuesday's meeting and inserted nothing where you were
  typing. It is a window; the dictation path never reaches it.

Two models, both configured, both working, and the request falls between them.
The user's repair is to open Ask, ask for the mail, read it, copy it, switch
back to the mail client and paste -- which is the workflow the product exists to
delete.

### The donor separates the same way, and for a reason that does not apply

`donors/app/desktop-shells/openwhispr/src/config/inferenceScopes.ts` defines
`dictationAgent` and `chatIntelligence` as separate scopes with separate
provider and model resolution. That is a real separation and it was cited when
the fifth tab was added.

What it separates is **which model runs**, not **which assistant it is**. A
scope in the donor is a config lookup; nothing in it says that the thing behind
`dictationAgent` and the thing behind `chatIntelligence` have different
identities, different names or different rules. Reading a config split as a
product split is what produced the second model here.

## Decision

**There is one assistant.** One model, one name, one system prompt, one set of
rules from ADR 0023. It is reached through three doors:

| Door | Surface | Result |
| --- | --- | --- |
| `draft` mode | a dictation | text at your cursor |
| the Ask window | a window | an answer, inserted nowhere |
| an action on a note | the note's action bar, and the meeting HUD's | a new or edited note |

**The notes model disappears as a separate setting.** It was going to be a fifth
tab in Language Models with a rule before it; it is one row in the job list of
AI Models, named `The assistant`, and it configures the whole thing once.
§11.30's rule was there to mark a boundary between two kinds of thing; with one
thing there is no boundary to mark, and the rule is removed rather than moved.
(ADR 0042 later collapsed Language Models itself into AI Models, which is why
this record names a row rather than a tab.)

**The assistant may read your notes and transcripts.** Read-only, bounded to the
notes directory, and it cites what it used. Reading is a tool call, so it is
governed:

| Setting | What it does |
| --- | --- |
| `Never` | no lookup, on any surface |
| `On reference` (default) | one lookup, only when the dictation refers to material -- "from Tuesday's meeting", "in the release note" |
| `Always` | one lookup on every request. Correct for Ask, wrong inside a dictation |

**It never writes a note by itself**, and it never leaves the notes directory. A
note action that produces a note is the *user* running the action.

### What this takes back from ADR 0029, and what it does not

ADR 0029 states that the mode "gains no tool-calling surface, no execution loop
and no ability to produce effects outside the transcript it returns," and
requires that a record overriding its four reasons replies to each one. This
record narrows exactly one clause of that -- a **single bounded read** is
permitted -- and leaves the rest standing. The reply:

**Latency.** The lookup runs only when the dictation refers to something. A
dictation with no reference costs exactly what it costs today, because no call
is made. When one is made it is one round trip against a local index, not a
model deciding whether to call again.

**The session model.** This is the reason that decides the shape. ADR 0018 and
ADR 0019 require a session to end in exactly one reducer commit, and a loop with
*n* rounds has no single end point. So there is no loop: **one lookup, then the
generation, then the commit.** The number of stages is fixed at compile time,
not chosen by the model. That is the difference between a lookup and an agent,
and it is why this does not reopen what ADR 0029 closed.

**The insert contract.** Unchanged. The result is still text, still delivered at
the cursor, still previewable under `clipboard_only` (ADR 0011a). Reading
material to write text does not change what comes out.

**The confidence of the channel.** This is ADR 0029's strongest reason and it is
untouched, because it is an argument about *effects*. A misheard dictation that
reads the wrong note produces a draft you can see before it goes anywhere. A
misheard dictation that *sends* an email cannot be recalled. Reads stay reads:
side-effecting tools remain prohibited in the dictation path, and this record
does not weaken that by one line.

**The assistant is not the orchestrator.** ADR 0030's coding agents write code
and speak to you; this one writes text and answers you. They share no model, no
configuration and no surface. Two things called agent is what ADR 0029 renamed
the mode to avoid, and the word does not appear on the assistant's tab at all.

## Consequences

- **The writing jobs are five rows**: Cleanup, Rewrite, Translate (ADR 0041),
  Prompt Enhance and the assistant. The rule §11.30 introduced is withdrawn with
  its cause.
- **The notes model's fallback chain disappears with it.** §11.20 had
  `noteFormatting` falling back to `dictationCleanup` when unset, mirroring the
  donor, so that notes worked before anyone configured them (ADR 0036). With one
  assistant there is nothing to fall back *from*: the assistant is configured or
  it is not, and if it is not, the surfaces that need it say so and name the one
  setting that fixes all three.
- **A retrieval index is now on the critical path for a dictation mode**, and it
  was previously only behind a window. Whatever the notes search is built on has
  to answer within the latency budget of a dictation or the `On reference` path
  has to degrade to no lookup rather than to a slow one. This is the main
  implementation risk this record creates and it belongs to whoever builds it.
- **"It cites what it used" is a contract, not a preference.** A draft built
  from a meeting names the meeting. Without the citation there is no way to tell
  a grounded draft from an invented one, and an invented one is worse than a
  refusal.
- The three-way `Never` / `On reference` / `Always` control is per assistant and
  not per surface, with one documented asymmetry: `Always` is the right answer
  in Ask and the wrong one in a dictation. If that asymmetry proves to need two
  values rather than one, it is a settings change and not a change to this
  record.
- ADR 0029 stands. This record cites it rather than replacing it, and a future
  record that wants tools with effects still owes ADR 0029's four reasons a
  reply -- this one only answered them for reads.
