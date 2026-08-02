# 0029 -- The agent mode carries out an instruction, it does not act

Date: 2026-07-30
Status: Accepted

## Context

`ProcessingMode::Agent` is named after a word whose meaning moved. When the mode
was built, "agent" meant a model that carries out a dictated instruction. It now
generally means a model that calls tools in a loop and produces effects in the
world. WordScript's mode is the first thing and reads as the second, and that
gap is the entire reason this record exists.

What the mode actually is, measured rather than assumed. `agent::build_agent_request`
assembles exactly two messages -- a system prompt and the transcript -- and
`apply_agent_transform` makes one `create_chat_completion` call with
`temperature 0.3`, `max_tokens 2048`, a 30s timeout and one retry. There is no
`tools:` field anywhere in `src-tauri/src/`, no loop, no state carried between
sessions. On a provider error the mode returns the raw transcript with
`was_agent: false`, so the failure mode is "you get what you said" rather than
"something happened."

The pressure to extend it is real and comes from outside. MCP has clients in
every major coding CLI. Anthropic shipped voice dictation in Claude Code in
March 2026. OpenAI wired a full-duplex voice model into the ChatGPT desktop app
with Codex in July 2026. It is a reasonable-sounding step to give the agent mode
tools and let a dictation trigger a real action.

That step would break four things this product has already decided, and the
decisions are load-bearing rather than incidental:

**Latency.** The product promise is "speak, text appears." A tool loop has an
indeterminate number of rounds and a multi-second floor. That is not a slower
dictation; it is a different interaction with a different acceptance threshold.

**The session model.** ADR 0018 and ADR 0019 establish that a session ends in
exactly one reducer commit and that every path which ends a session owes the
surface reporting it. A loop with n rounds has no single end point. Supporting
one is a rewrite of the state machine, not a feature added beside it.

**The insert contract.** A session's result is text delivered at the cursor. The
whole delivery architecture -- `clipboard_only` preview before delivery,
`auto_paste` surface after it (ADR 0011a) -- presupposes a text result. An agent
that *sends* the email has no text to insert and nothing for either surface to
show.

**The confidence of the channel.** Speech is a low-confidence input. The
confidence gate and `hallucination_detect` exist because transcripts are
unreliable often enough to need machinery (ADR 0016). Wiring a low-confidence
channel directly to side-effecting tools is a category error, and the
confirmation step that would make it safe removes the speed advantage that is
the product's reason to exist.

The market supplies a concrete instance of the ambiguity risk rather than a
hypothetical one: Willow Voice reads the dictated word "delete" as an edit
command with no documented way to disable it, and Wispr Flow shipped and fixed
a bug where the utterance following a command was silently reprocessed as
another command.

## Decision

**The agent mode carries out an instruction. Text in, text out, one call.** It
gains no tool-calling surface, no execution loop and no ability to produce
effects outside the transcript it returns. This is a contract, not a current
implementation limit.

**Side-effecting tools stay out of the dictation path** for the four reasons
above. If generative tool use is ever wanted, it belongs on an explicitly
invoked asynchronous surface, where the user is not waiting on a cursor and a
confirmation step costs nothing. ADR 0030 later built exactly that surface and
placed it in its own settings area rather than in the Chat preview.

**MCP is three separate questions and gets three separate answers.** Treating it
as one thing is what makes the topic hard to decide:

- **WordScript as an MCP server: in scope.** Read-mostly, no dictation-path
  change, no session-model change. The caller is an agent that already works in
  seconds, so the latency argument does not apply. ADR 0030 decides its shape.
- **WordScript as an MCP client inside the dictation path: rejected**, on the
  four reasons above.
- **WordScript as an MCP client for vocabulary** -- pulling proper nouns from
  calendars or note tools into the dictionary and recognizer hints -- **rejected
  as its own feature.** It was considered and is not a distinct capability: it
  is the profile context with a remote source, and the profile context already
  has a shape, a width and a producer (ADR 0021). A new fetch path would add a
  network dependency and a staleness question to a surface whose only real
  problem is what the model is allowed to do with it.

**Every new context source inherits ADR 0023.** Whatever later supplies material
to a generative prompt -- a selection, a file, an MCP resource -- sits in the
system prompt behind an explicit restriction, and the user turn carries only the
transcript. ADR 0023 was written because profile context in the user turn was
read as content and came back inside generated instructions. A new source is the
same failure with a different origin, and it does not get to rediscover it.

## Consequences

- **The mode is renamed to `draft`.** This record first concluded that the name
  should stay, on the grounds that a rename buys clarity in the UI at the cost of
  a migration -- the mode is reachable by hotkey, by the cycle, by the mode
  picker and by Auto routing, it appears in configs on disk and in
  `ProcessingMode::from_str`, and the token `agent` is part of the persisted
  contract. That conclusion was overtaken by ADR 0030, which gives the product a
  settings area named `Agents` for coding agents. Two unrelated things cannot
  both be called agent, and of the two it is this one whose name was already
  wrong. `draft` states what comes out: a first version to be reviewed, which is
  the same thing ADR 0026 says when it calls the output an artifact rather than
  an answer. The migration is the price and is paid deliberately: `agent` is
  accepted as a legacy alias when reading a config and `draft` is written back,
  so no existing profile breaks. The mode itself is kept -- ADR 0030 records why
  the orchestrator does not replace it.
- The four reasons above are the standing answer to "why not just add tools."
  They should be cited rather than re-derived, and a future ADR that overrides
  them owes a reply to each one.
- **ADR 0030 starts processes from dictated text, and it carries the mechanism
  that keeps that outside this prohibition.** Two of its rules are the
  implementation of "only the prompt argument is dictated": configuration hangs
  on the target rather than on the utterance -- model, permission profile and
  context are set once in the target panel and never spoken -- and the start
  confirmation is always visible and always by key, never by voice, showing
  target, directory, role with its permission profile and the dictated prompt
  verbatim. A record that later relaxes either of them reopens this one.
- The Chat area stays a declared preview and does not become that surface. ADR
  0030 gives the tool-using surface its own settings area, because what it hosts
  is a service and a thread list, not a chat with the product.
- `docs/ROADMAP.md` currently fences MCP wholesale as V2-or-later. That fence is
  now wrong in one direction and is split by this record: server in, client out.
- Rejecting vocabulary-over-MCP does not reject improving vocabulary. The
  recognizer path (ADR 0017) and the profile context (ADR 0021) are where that
  work belongs, and `STATUS.md` already names transcription quality outside
  `General Writing` as the open product problem.
