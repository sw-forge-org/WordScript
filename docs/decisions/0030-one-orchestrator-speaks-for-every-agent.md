# 0030 -- One orchestrator speaks for every agent

Date: 2026-07-31
Status: Accepted (planning direction; not implemented)

Revised 2026-08-01, before this record was first committed, after a review of
every external claim in it against primary sources (MCP specification
2026-07-28, Claude Code documentation, vendor documentation). The revision
corrected facts, replaced two arguments that were true but not for the stated
reason, and closed seven of the nine questions the first version left open.
Where a claim is only plausible, the word now appears.

## Context

ADR 0029 puts WordScript-as-an-MCP-server in scope. This record decides its
shape.

The feature has two directions. A coding agent can ask its user a question out
loud and receive the spoken answer, so clarification happens by voice instead of
by terminal turn. And the user can start work by speaking, without opening a
repository or a terminal at all. The point of both is the same: not reading.

### The first draft of this record was wrong about who asks

That draft let **every** coding agent connect to WordScript and ask directly. It
therefore required each agent, mid-task, to judge whether something is important
enough to interrupt a human by voice.

An agent cannot make that judgement. It does not know what the interruption
costs. And a channel without the judgement is *worse* than a terminal: terminal
output can be skimmed, spoken output has to be sat through. If the filter is left
to prompt engineering repeated in every repository, the feature has no product
content left -- one may as well open the repository and dictate into it, which
WordScript already does.

The decomposition that resolves it: **"am I blocked" is a state, not a
judgement.** An agent knows it with certainty and for free. "Can this question be
answered from project knowledge" is also concrete, and it is answered by looking
rather than by predicting. Only "is this worth a human's attention" is hard, and
in the shape below nobody has to answer it.

### Four levels, and the word that is no longer used for the third

The first draft used "subagent" for two different things and "child run" for a
third. The vocabulary is fixed here, because the rest of the record cannot be
read without it:

- **Level 0 -- the user.** Microphone, speaker, overlay.
- **Level 1 -- WordScript.** Holds the audio device; performs capture,
  transcription and the gates; speaks; shows the overlay; owns the threads; runs
  the MCP server; starts and supervises the orchestrator.
- **Level 2 -- the orchestrator.** *One* long-running process, *one* harness
  chosen by the user, WordScript's only MCP client. It has its own working
  directory under `core/paths.rs`, holding the generated instruction file and the
  files that carry durable knowledge.
- **Level 3 -- target runs.** Separate processes (`claude -p`, `codex exec`, ...)
  in a target's directory, each with its own context window and its own sandbox,
  started by the orchestrator as shell commands.

**"Target run" replaces "child run" throughout.** "Subagent" stays reserved for
what happens *inside* one process -- Claude Code's Task tool, for instance. That
exists both in the orchestrator and in a target run, is invisible to WordScript,
and carries no decision here.

### The model: not a realtime speech-to-speech API

The obvious reach is a realtime speech-to-speech model, and the market now
supplies several. OpenAI's GPT-Live -- wired into the ChatGPT desktop app with
Codex in July 2026 -- is still not an API product: no model id, no endpoint, no
price. `gpt-realtime` is API-available over WebSocket at $32/M audio-in and $64/M
audio-out, and independent analysis describes it as fast half-duplex with good
interruption recovery rather than true simultaneous listen-and-speak. Gemini Live
is the better realtime option on merit: natively speech-to-speech, barge-in,
roughly $3/M in and $12/M out. xAI shipped `grok-voice-think-fast-2.0` on
2026-07-29, speech-to-speech over WebSocket, wire-compatible with the OpenAI
Realtime API, at $0.08 per audio minute. Nova Sonic (SigV4/IAM) and Azure Voice
Live (an Azure resource, not an API key) remain poor fits for bring-your-own-key
on a desktop app.

None of them is needed, and the reason is stronger than the earlier one. The
earlier reason was that **barge-in does not require a realtime model**: LiveKit
Agents and Pipecat both implement it at the orchestrator level, cancelling TTS
and generation when local voice-activity detection notices speech -- and the
quality lever is VAD combined with semantic end-of-turn classification, because
an energy threshold alone cuts people off in thinking pauses. That still holds,
and most production voice systems in 2026 still use this cascaded shape for
debuggability and provider independence.

The stronger reason is structural: in the topology decided below, **no model sits
in the voice layer at all.** The orchestrator emits a question as text, WordScript
speaks it, the user answers, WordScript transcribes, the orchestrator receives
text. A speech-to-speech model would have to be inserted as a second model
between the user and the orchestrator -- which is precisely how monologue and
drift get in.

**Two latency numbers, not one.** The first draft ran them together. The bar of
**under 200ms applies to the barge-in stop** -- the user starts speaking,
playback goes quiet -- and it is reachable in the cascaded shape: a 32ms Silero
frame, two or three frames of hangover, a buffer flush and a fade-out. It comes
from conversation-analytic work on turn-taking (Stivers et al., PNAS 2009), which
measures the modal speaker-transition gap at roughly 0-200ms. **Voice-to-voice is
a different number**: LiveKit's published target is "under 500 milliseconds, it
feels like talking to a person; over 2 seconds, something feels broken," and
400-800ms end-to-end is the realistic band.

### The transport, and why it got easier

The first draft argued that stdio is 1:1 with the client process, so shared state
cannot live in the stdio process at all. That argument holds for N clients, and
this record decides exactly one -- so it no longer carries the decision. The
decision is unchanged; the reason is replaced.

**The MCP server has to live in the process that owns the audio device.**
Anything else makes it an IPC problem between an MCP child process and the
running application, bought for nothing, and lands that IPC in a process that may
be sandboxed. That the question is real rather than theoretical: Spokenly ships a
stdio bridge (`mcp-bridge.sh`) specifically for Claude Code and gives the 60s
HTTP first-byte timer as the reason. With the bounded `await` decided below, that
reason does not apply to WordScript.

What remains is the choice between an MCP server and a WordScript CLI the agent
would invoke as a shell command. The CLI is tempting -- a shell call is not bound
by MCP's timeout and lifecycle rules, and hooks execute shell commands anyway --
but it has a failure mode that is hard to diagnose: coding agents run shell
inside a sandbox, so a CLI reaching the WordScript process can be blocked and the
model sees only a failed command. Confirmed: Claude Code's sandbox isolates bash
subprocesses while MCP servers sit outside it, and localhost TCP out of that
sandbox is currently closed (an open issue reports `EPERM` on `connect()` despite
`allowedDomains` and `allowLocalBinding`); Unix sockets are blocked only under
the optional seccomp filter. Codex uses Landlock plus seccomp with network off by
default, and an open issue there shows that on Linux with `network_access=false`
even `AF_UNIX` `connect()` is refused unconditionally -- the CLI path is tighter
than assumed, which strengthens the decision against it. Whether Codex starts MCP
servers inside or outside its sandbox is **not documented and is not claimed
here**; it stays an open point.

A public endpoint buys nothing. Claude Code on the web runs in isolated
Anthropic-managed VMs with no path back into the local network; such a session
can no more reach a local daemon than it can reach the local microphone.

### The waiting problem, and the wait that is not a problem

A human takes tens of seconds to answer, and client tool timeouts are real. The
first draft named Cursor as the limiting client "at roughly 30 seconds"; that
number is not documented anywhere and is withdrawn. What is documented:

| Client | Tool-call limit |
|---|---|
| Claude Code, stdio | `MCP_TOOL_TIMEOUT` default ~28h; no per-request timer; 30min idle timeout |
| Claude Code, HTTP/SSE | additionally 60s to the first response byte; 5min idle timeout |
| Claude Code, both | auto-backgrounding after 2min in the main conversation |
| Codex CLI | `tool_timeout_sec`, default 60s, configurable |
| Gemini CLI | default 600000ms, with open reports that the value is ignored |
| opencode | `execution` 12h, overridable per server; a practical bug at ~60s |
| Zed | ~60s, hardcoded |
| Cursor, ACP/CLI path | 60s, hardcoded, not configurable (IDE path ~60min) |
| Windsurf | not documented |

The real constraint on the likeliest client is not the timeout but
**auto-backgrounding**: "An MCP tool call in the main conversation that is still
running after two minutes moves to a background task instead of blocking the
session. Claude receives the task ID immediately and keeps working." Two
documented exceptions: calls from subagents are never backgrounded, and neither
is a call with an open elicitation dialog. It is tunable through
`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`. A blocking call on Claude Code is therefore
not a blocking call after two minutes -- not a fault, but different behaviour
than "the call blocks," and something the harness preset has to carry.

The specification has moved away from blocking regardless. The 2026-07-28
revision deprecates sampling, roots and logging, replaces elicitation's
held-open wait with Multi Round-Trip Requests, and moves Tasks into an official
extension built on polling. On Tasks the first draft overclaimed: **no coding
client documents Tasks support as of 08/2026, and the official extension support
matrix does not list it** -- but that matrix has three columns (MCP Apps, OAuth
Client Credentials, Enterprise Auth) and never had one for Tasks, while the
separate client matrix does have a "long-running operation tracking" column whose
contents could not be read. That is absence of evidence, not evidence of absence.
The design does not depend on Tasks either way. Every shipped voice MCP server
found -- Spokenly's `ask_user_dictation`, the community `voice-mcp` forks --
blocks and patches around timeouts per vendor.

Both observations are about the same case: a call that waits on a *person*. A
call that waits on *nothing* -- an idle agent asking whether there is work -- has
no human latency in it, and making it return instantly only produces a hot loop.
The rule was written one level too coarse.

**Elicitation exists and is deliberately unused.** Claude Code supports it with
no configuration ("elicitation dialogs appear automatically when a server
requests them"), offers an `Elicitation` hook for answering automatically, and
does not background a call with an open dialog. It is not used here because `ask`
is constructed never to wait on a human, and a dialog in the harness would do
exactly that.

### A server can never reach an agent on its own

The first draft said the 2026-07-28 revision upgraded a recommendation to a
requirement. There was no such upgrade; the actual change is stronger.
**Server-initiated requests are abolished.** Anything a server wants to put to a
client travels as `inputRequests` inside an `InputRequiredResult`, in reply to a
call the client itself made (Multi Round-Trip Requests, SEP-2322). WordScript
cannot contact a running agent -- not because clients fail to implement it, but
because the protocol no longer has the direction.

Sampling, roots and logging are deprecated on the same date (not removed;
earliest possible removal 2027-07-28), and `notifications/elicitation/complete`
was removed outright.

This is a protocol fact about MCP, and as a *product* statement it would be
misleading, because the likeliest harness has documented channels beside MCP that
do more:

- **Remote Control** (February 2026, research preview, Max subscription): drive a
  local session from claude.ai or the mobile app. `/config` offers "Push when
  actions required," which the documentation describes as covering permission
  prompts *and questions*.
- **Channels** (research preview): "A channel is an MCP server that pushes events
  into your running Claude Code session... Channels can be two-way." It also
  carries a permission-relay capability that forwards prompts to an external
  device and plays the answer back.
- **Agent View** (May 2026, research preview): a list of all sessions with status,
  "whether the agent needs you," inline replies, `/bg`.
- **`/voice`** (March 2026): dictation only -- Claude does not speak back.

### Context in an agent that is meant to last

A single addressee that survives across tasks raises the obvious objection: its
context window fills up. The convention here has converged independently at
Anthropic, Cognition, OpenAI, LangChain and Microsoft, and it is the same shape
in all of them -- one orchestrator owns the conversation and spawns ephemeral
subagents with their own context windows, which return only a compressed summary.
Intermediate reasoning and tool output stay in the child. Durable knowledge lives
in files that accumulate across sessions rather than in the transcript.

That literature says "subagent" for what this record calls a **target run**
(level 3). The shape is the same; the word is not, and the difference matters
because WordScript also has real subagents inside those processes that it never
sees.

### Where this sits in the market

Narrowly, there is no prior art for the arbitration: Spokenly is the closest
relative and its documentation is silent on concurrency, `rmcp-mux` and similar
multiplexers solve sharing a process rather than arbitrating an exclusive
resource, and no published pattern exists for "N concurrent clients, one
microphone." The shape below does not need one. Widely, the field is not empty,
and the record needs the honest version or its reason to exist stands
unsupported. As of 08/2026:

- **Anthropic ships three adjacent features** -- Remote Control, `/voice`, Agent
  View -- all included for subscribers.
- **Paseo** (paseo.sh, AGPL-3.0, ~11k stars, solo maintainer, free, BYOK,
  self-hostable) is the nearest relative: a fully local voice stack (Parakeet,
  Kokoro, sherpa-onnx), two-way voice, and a documented "voice LLM
  orchestration: hidden agent session" -- conceptually the same intermediate
  layer, with undocumented routing logic. What it lacks is system-wide insertion
  at the cursor. Paseo is an island.
- **Omnara** (YC S25): the repository was archived on 2026-02-02 with a note that
  the CLI wrapper broke on Claude Code updates; the rebuild is closed source on
  the Agent SDK. Voice is two-way but web and mobile only, not desktop. The
  routing runs in the **opposite direction**: their voice agent answers the
  *user's* questions about status instead of filtering the *agent's* questions.
  No end-to-end encryption -- repeatedly the stated reason for not buying on
  Hacker News -- and $20/month on top.
- **AgentsRoom**: solo developer, since March 2026, no Hacker News presence;
  notifications are terminal-output parsing with no filter.

**Nobody has the agent-to-user filter.** The obvious worry is that the gap is
empty on purpose, and three serious counter-arguments exist: a filter makes
invisible mistakes; a second model structurally knows less; and the problem is
shrinking, because better defaults and permission modes mean coding agents ask
less than they used to. The first is addressable -- everything the orchestrator
answered itself stands in the thread, so the distinction is not
visible-versus-invisible but pushed-at-you versus available-to-read. The second is
framed wrongly (see the delegation rule below). The third is true, and it belongs
in the consequences as a real risk.

The actual reason the gap is empty, and the load-bearing argument of this record:

> **A voice is necessarily serial; an inbox is not.** Three notifications can be
> scanned at once; three questions cannot be heard at once. The moment speech is
> the primary channel, something has to decide which question comes first and
> which does not come at all -- not as an improvement, but because the channel
> forces it. For everyone else the filter is overhead, which is why nobody built
> it. Paseo has voice beside an IDE one can still look at; here not looking is
> the point.

And the second asymmetry, which ADR 0031 states for the scratchpad and this
record left implicit: **WordScript is the dictation app.** Of the products
surveyed, none has a filtering orchestrator, two-way voice, its own audio stack
with quality gates and system-wide insertion at the cursor at the same time.
Spokenly has the stack and the insertion and is not heading towards orchestration;
Paseo has the voice and the stack without the system integration.

## Decision

**One orchestrator is WordScript's only client.** Coding agents get no MCP entry,
no instruction snippet and no per-repository setup. They are started and driven
by the orchestrator, and for them the orchestrator *is* the human. The
orchestrator answers what it can answer and reaches the user only for what it
cannot.

A single coding agent connecting directly still works -- same server, same tools
-- but it is the degenerate case with one target. It carries no decision in this
record and must not be presented as the design.

**The voice bridge is a second delivery target, not a processing mode.** The
dictation pipeline always ends at the focused window: capture, transcribe, gates,
mode router, transform, `finalize_with_text_rules`, insert or preview, history.
The bridge shares the first half and then diverges -- it returns the transcript to
the caller and inserts nothing. Shared: capture, transcription, confidence gate,
hallucination detection. Not shared: mode router, transform, finalization,
insertion. Modelling it as a `ProcessingMode` is forbidden: ADR 0020 makes the
processing mode the only transform axis, and a bridge mode would sit on that axis
while performing no transform. Delivery is already its own axis (ADR 0011a), and
therefore **delivery = agent makes the mode axis vacuous**: the pill shows `Agent`
where the mode would otherwise stand -- no greyed-out mode, no invalid cross
product of mode and delivery. Were `Agent` listed beside `draft`, someone would
eventually ask what `finalize_with_text_rules` does in agent mode; the answer is
"nothing," which is nonsense in a list of modes and self-evident in a list of
delivery targets.

**Bridge sessions are ordinary sessions** with their own trigger, so ADR 0018 and
ADR 0019 stay intact: a session still ends in exactly one commit with the surface
that reports it. For bridge sessions the reporting surface is the overlay and the
thread in the Agents area, not the transcript history. The commit still happens;
only the sink differs. (The reducer commit of ADR 0018/0019 is neither a git
commit nor persistence -- it is the one state transition that ends a session, and
where the data goes is independent of it.)

**The microphone belongs to the user.** A request arriving while the user is
dictating gets the busy answer; the dictation hotkey pressed during a bridge
session ends it and the caller is told the user cancelled. The single-session
guard in `core/sessions.rs` is symmetric today -- whoever arrives first wins,
including against the user -- and that was never decided. It is decided here.

**The orchestrator may compose the question; it must return the answer verbatim.**
Composing is what it is for: it has weighed the options and knows the space, so it
can put the question well. Interpreting the answer is guessing. The asymmetry
follows from what the user can check -- they hear the question and notice a wrong
one; they never see what reaches the run. The source material the question came
from travels in `context`, visible in the thread and never spoken, which leaves an
audit path without a monologue.

**Two tools, and the split is what makes the waiting rule true.**

```
ask(question, options?, context?, target?) -> { question_id, status }
    Returns immediately, always. Waits for nobody.
    question: the only field that is spoken; length limited.
    options:  optional small list (2-4). Switches the answer form.
    context:  appears in the thread, is never spoken. Carries the verbatim source.
    target:   optional; without it the question goes to the "General" thread.
    status:   queued | speaking | refused
    refused carries the reason: rate_limited | muted | queue_full

await(question_ids?, timeout_hint?) -> { events[] }
    Blocking call, bounded by the harness budget.
    events: answer(question_id, transcript)
          | cancelled(question_id, reason)
          | work(prompt, target)
          | user_message(text, target?)
          | timeout
```

**No client ever waits on a human.** This replaces "the call never blocks", which
was the same intent stated one level too coarse. `ask` waits for nobody. `await`
waits on an event stream, and that an event was triggered by a person does not
change the semantics of the call -- so the rule holds literally. A call that waits
for *work* may block, because there is no human latency in it and returning
instantly only produces a polling loop. Without this split the orchestrator would
have no way back after an immediately returning `ask` except polling, which this
record rejects, or standstill, because nothing reaches a running agent unprompted.
The same shape appears in the only projects that have addressed the problem:
mcp-voice-hooks (queue plus `wait_for_utterance`), Cursor's official
recommendation (job id plus poll), and the MCP Tasks extension (polling).

**The time budget is a function of the harness, not a worst case over all
clients.** The `await` budget is stored **per harness preset** and shown in the
settings UI; "custom command" gets a conservative default. A worst case across
clients is the wrong metric for a design that decides exactly one client, which
the user picks and WordScript knows.

**A harness preset carries more than the command.** Per role a command template,
the `await` budget, and the relevant environment variables -- for Claude Code
`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`.
The record promises that nobody has to configure anything; without the presets
every user would have to find exactly this out alone.

**Nothing reaches a running agent through MCP unprompted.** The 2026-07-28
revision no longer has the direction; delivery happens at boundaries -- the agent
asks, or it finishes a step. Harness-specific channels alongside MCP (Claude
Code's Channels, hooks) can do more, but they are not portable and are not part
of this design. If interjecting into a running task proves necessary, that is
where it belongs -- as a preset extension, not as a core assumption.

**Transport is MCP.** One client, one channel. The tool schema is also the form
constraint below, which a CLI would not provide. **No public endpoint.** aider's
limit is the absence of autonomous tool use, not only the absence of MCP: it has
no native MCP client support and four open feature requests, and the "Aider MCP
Server" projects make aider a *server*, not a client.

**Authentication, port and lifecycle.** `clientInfo.name` is self-declared and
proves nothing. The real threat is any local process, including JavaScript in a
browser tab that can fetch `localhost`. Three parts:

1. A **bearer token**, generated when the feature is enabled, displayable and
   rotatable in the settings UI. WordScript writes it straight into the generated
   orchestrator configuration, so in the normal case the user never sees it.
   Rotation invalidates the old configuration, which is rewritten.
2. **Bind to `127.0.0.1`**, never `0.0.0.0`. That is what "no public endpoint"
   means in code.
3. **Check the `Origin` header and reject requests that set one** -- DNS-rebinding
   protection, the established recommendation for local MCP servers. A browser
   sets `Origin`; an MCP client does not.

**No daemon.** The MCP server lives in the Tauri process, because it has to live
in the process that holds the audio device, so its lifecycle is the application
lifecycle. The port is a fixed default, the next free one if taken, with the
actual number written to a **port file under `core/paths.rs`**; the generated
orchestrator configuration points at it and is rewritten when it changes. "The
app is not running" is excluded in the main scenario, because WordScript starts
the orchestrator itself; the degenerate case (a coding agent connecting directly)
needs only a comprehensible error message.

**The channel cannot carry a monologue.** Exactly one tool reaches the user, and
`question` is the only field that is spoken. This is enforcement, not a request
for brevity -- the same construction as the drift guard in ADR 0031. A rate limit
and a per-target mute are the hard backstop against a caller that asks too often.

**There is exactly one model-generated spoken path, and it is the guarded one.**
The closing message of a target run is **not spoken**: what is spoken is a
completion cue WordScript generates itself, carrying no model content -- a tone
plus a line such as "Target X has finished." Anyone who wants more opens the
thread or asks. Errors likewise: the text comes from WordScript, not from the
model, and names the next action.

**Two answer forms, and `options` is the switch between them.**

- **Option question** (`options` set, 2-4 entries): the transcript is matched
  against the options. On an unambiguous hit the answer goes straight out, with
  what was sent shown and a short undo window. The match is **purely lexical** --
  ordinal, option text, prefix. No model, because that would be inference on the
  speech channel again (ADR 0031). On no hit or an ambiguous one it falls back to
  the open form.
- **Open question**: the transcript is confirmed before it leaves, and the surface
  keeps `edit`. Enter sends, Escape switches to typing. The first draft of this
  record removed the confirmation; that was wrong. A misheard answer here becomes
  something an agent acts on, which makes correction more valuable than in
  dictation, not less.

`options` is therefore more than convenience: it gives the orchestrator a real
incentive to ask closed questions, and that belongs in the instruction file as a
rule.

**Spoken questions are serial.** At most one question is spoken and open at any
time; further questions wait in the list with their position visible. A spoken
answer belongs to the one open question by construction -- there is nothing to
infer. Typed answers belong to the thread they are typed in. This is the same
construction as the microphone guard and right for the same reason: exclusivity
replaces a decision nobody can make reliably.

**A gate failure produces no `answer` event.** If the confidence gate or
hallucination detection fires on a bridge answer, the question stays open,
WordScript says locally that it did not understand, and the orchestrator sees
nothing and keeps waiting in `await`. Only when the user cancels or the deadline
expires does a `cancelled` event arrive. A failed transcription is a local problem
between WordScript and the user; routing it into the agent makes it a model
problem, and the model will guess.

**Every question has a deadline.** Without one an agent hangs indefinitely.
Generous by default (order of 30 minutes), then `cancelled(reason: no_answer)`.
Whether the orchestrator then proceeds on its best assumption or stops cleanly is
decided by the generated instruction file -- exactly the kind of thing that
belongs there.

**Iterating is the normal case, not an exception.** Several `ask` calls within one
run are expected; "give me a moment" means the call returns, the orchestrator
reads what it needs, and it asks again. The unit is a conversation about a topic.

**Starting work is one primitive: a target**, and a target carries roles.

- Label
- Directory
- Profile (ADR 0021), with a bridge default for targets that have none
- Default model
- **Roles**, each with its own command template and permission profile:
  - `inspect` -- read-only, for research runs the orchestrator starts to answer a
    question itself
  - `work` -- writing, with the permission profile the user set for this target
  - `resume` -- continuation of a run

The run is headless -- `claude -p`, `codex exec`, `gemini -p` and their
equivalents take the prompt as an argument and keep MCP available -- so no PTY and
no terminal emulation is involved. stdout is captured and becomes the closing
entry in the thread. Presets ship the roles for common CLIs; no harness name is
compiled in.

**Permissions are two roles, and the mapping lives in the preset.** The harness
combinatorics (read-only, plan, accept-edits, bypass-permissions, ...) are **not**
reproduced. WordScript knows `inspect` and `work`; each harness preset records
which flags they map to. A per-target switch for "bypass permissions" exists with
a visible warning, for people who know what they are doing. Plan-only is dropped:
planning is exactly what the orchestrator does, and it needs no mode in the
target.

**Configuration hangs on the target, not on the utterance.** If model, permission
profile and context had to be spoken, speech would be used as a configuration
language, and it is not good at that. The utterance carries intent only.
Deviations are a click in the target panel, not an announcement. This is the
answer to a whole class of follow-up questions -- "how do I say it should use
Opus", "how do I say read-only" -- and it answers all of them the same way: you
do not.

**A target run is a sequence of runs, not an open connection.** `claude -p` has no
back channel: it runs until done, then it is gone. Discussion is therefore a
**sequence of runs with resume**. The orchestrator starts a run; it ends finished
or with a message ("stopped at X"). The orchestrator reads stdout, decides, and
starts the continuation with `--resume`/`--session-id` and what it has clarified.
For the orchestrator this is the same interaction, only as a sequence.

**WordScript owns the thread** and supplies it on every run, so continuation does
not *depend* on whether a harness implements resume -- but not depending on it is
not the same as not using it. Where a harness can resume, it is used; where it
cannot, the compacted thread is passed along. The compaction rule: the last n
entries verbatim, and before them a summary WordScript writes when a run closes.

**The orchestrator delegates inwards, but not for everything.** It should settle
questions itself -- from its own context, from the files in its directory, and
from `inspect` runs against the target codebase. But if *every* question first
becomes a research run, waiting time appears for things it could have said from
context. The rule for the instruction file: answer immediately from context and
files; start an `inspect` run only where something actually has to be looked up.
That is the same filter as the one facing outward, turned inward.

The common objection -- that a filter structurally has less context than the agent
whose question it filters -- is framed wrongly. The question is not who has more
context but **who can fetch it without costing the user anything**. A target run
in the middle of its work cannot spend ten minutes reading half the repository;
the orchestrator can, because waiting is all it does. From that follows a hard
line: it can settle anything that is *written down* somewhere -- in the code, the
conventions, earlier decisions. It can settle nothing that exists only in the
user's head. Those are exactly the questions that should get through.

**WordScript brings the orchestrator directory itself**, under the application
paths in `core/paths.rs`. The user picks only the harness. WordScript
**generates** the instruction file there from the target list it scans out of the
configured root directory, so the orchestrator sees exactly the repositories the
user sees in the overlay. One list, two consumers.

- The generated region is delimited by `<!-- wordscript: generated start -->` and
  `<!-- wordscript: generated end -->`. Everything outside stays untouched,
  including text between two generated blocks, and the file header says so.
- The generated region holds the target list, the delegation rule, the rules on
  asking and on `options`, and the deadline behaviour.
- The hand-written region is what this record calls **prompt engineering in
  exactly one place** -- when to ask the user. It belongs to the user, it is not
  in twenty repositories, and no coding agent is affected when it changes.

**A target is a thread.** Continuation is the default and "new thread" is an
explicit gesture, available in the picker as a second key. WordScript never
decides semantically whether an utterance is a follow-up -- inference on the
speech channel is what ADR 0031 rejects, and it is not reintroduced here.

**Compact and New Session are controls in the overlay**, not something the user
has to do inside the harness. They sit in the expanded panel rather than in the
pill: they are repair tools for "the orchestrator has become confused," not part
of normal operation, and the harnesses auto-compact by themselves anyway.

- The guardrail behind that placement: **interventions get a control, settings do
  not.** An intervention is momentary, concerns state WordScript itself owns, and
  requires WordScript to cooperate afterwards -- there is no way to do it around
  the overlay without breaking something. A setting such as model or effort
  already has a place, namely the target; a second dial in the overlay would
  create a second source of truth, and "does this hold for this run or from now
  on" would stop being answerable. **Display is unaffected**: the history shows
  per run which model it ran with, which is a record that explains a result
  afterwards, not a control.
- The general case, because it will come back: **the CLI's controls are not
  rebuilt in the overlay.** Slash commands, model choice, permission switching at
  runtime -- rebuild those and what is left is a terminal with extra steps, and
  the promise of this record (not having to look) is gone.
- **WordScript holds the state** -- which targets are running, which questions are
  open -- and replays it after a compact or a restart. That is "WordScript owns
  the thread" with a concrete reason rather than as a principle.
- **A compact during an open `await` is invalid.** Compact aborts running calls
  cleanly and WordScript replays them afterwards. (Allowing compact only at
  boundaries was the alternative and was rejected: the button would then be greyed
  out exactly when it is needed.)
- **Before compacting, the orchestrator writes what is durable into the files** in
  its directory. Otherwise the button is a delete key with a friendly name.

An orchestrator that has been running for days filters well, because it knows the
recent decisions. A fresh one is stupid. Compacting is therefore not neutral but a
loss of quality, and that has to be visible.

**Acknowledgement is immediate and local.** A cue and a thread entry when the
process starts, from WordScript, never from the model: the start is a local fact,
and asking a model to confirm it would cost a turn and several seconds to say
less.

**The start confirmation is always visible and always by key, never by voice.** It
shows target, directory, role with its permission profile, and the dictated prompt
verbatim. For a run with write permissions in a real repository, a spoken
confirmation would be the weakest form imaginable -- it would travel over the same
unreliable channel as the input. This is the one place in the feature where
something irreversible happens, and the one place where two seconds are justified.

**Interjecting is always possible; delivery happens at boundaries.** The user can
speak or type at any time. The context is established **explicitly** -- by naming
the target in the utterance, or by clicking a target in the left-hand list, which
attaches its thread as context. Never by inference (ADR 0031). But if the
orchestrator is inside a model turn, the message is not delivered; it waits until
the orchestrator next calls `await`. That is the protocol fact in its visible
form, and it belongs in the UI rather than in a footnote: a line saying the
message will be delivered when the orchestrator next comes up for air, so nobody
thinks it was swallowed.

**Rate limiting has three rules; the number is secondary.**

1. **Visible, never silent.** A suppressed question stands in the thread with its
   reason, and the orchestrator receives `refused(rate_limited)` rather than
   silence. Otherwise it is an agent hanging mutely -- the same failure class as
   the dead orchestrator this record names as a single point of failure.
2. **The threshold is a frequency, not a counter.** n questions per sliding
   window, not n per session. A run that lasts twenty minutes and asks four times
   is healthy; four questions in twenty seconds is not.
3. **The starting value is measured, not guessed.** Instrument, log, and set the
   limit once the distribution is known; warn instead of blocking until then. As a
   placeholder: one question per 60s per target on average, burst 3, plus a global
   limit.

**Supervision is process watch plus a heartbeat in the log.** An orchestrator that
is alive but never calls `await` again is just as dead, and a process watch does
not notice.

**A rate limit and a spoken output need a guard against the room.** Beyond the
microphone guard there is an **output guard**: a spoken question while the user is
in a call is a product defect. The minimum is not speaking while another process
holds the output device exclusively or another process's microphone is active
(determinable on macOS through the Core Audio process list), plus a manual "quiet"
switch with a time window.

**Background presence.** A tray/menubar state with three levels -- nothing
happening / runs in progress / someone is waiting for you -- the third with a
counter. An OS notification on an incoming question carrying the question text
and, where `options` is set, the options as action buttons, so it can be answered
without switching focus.

**Text-to-speech is chosen by time-to-first-byte, not by price.** At the lengths
this feature produces, the price difference between candidates is meaningless -- a
120-character question costs 0.0018 cents at xAI and 0.006 cents at ElevenLabs --
so the number that makes the product is TTFB.

- **Default: Cartesia Sonic-3** -- ~90ms TTFB published, $30/1M characters, plain
  API key, WebSocket with context continuation.
- **Further presets:** ElevenLabs Flash v2.5 (~75ms, more expensive, for people
  who have a key there anyway), xAI `grok-voice-tts-1.0` ($15/M characters, no
  published TTFB), Deepgram Aura-2 (~200ms, $30/1M), OpenAI.
- **Excluded on the authentication model:** Google Cloud TTS (ADC or a service
  account JSON, unreasonable for a desktop app; only the Gemini API path takes a
  plain key) and AWS Polly (SigV4). PlayHT no longer exists (Meta acquisition,
  sunset 2025-12-31).
- The field is **a preset plus "custom endpoint"**, and the **measured TTFB is
  shown in the settings UI**. All vendor numbers are P50 under ideal conditions;
  on a desktop with real internet, two to four times that is realistic, and the
  user should see what they actually have.
- **Local stays an honestly labelled privacy mode, not advertised parity.** Blind
  tests claiming local models match ElevenLabs are vendor-run and measure isolated
  utterances; no evidence was found for local TTS in interactive conversation,
  where prosody under interruption is what matters. Local uses **Kokoro-82M**
  (Apache-2.0), the only option that is permissive, CPU-capable, ONNX and
  Rust-native at once (`Kokoros` with its own phonemizer and no espeak,
  `kokoroxide`, `sherpa-onnx`). **Piper is not the default**: `rhasspy/piper` was
  archived on 2025-10-06 and stays MIT, development moved to `OHF-Voice/piper1-gpl`
  whose changelog records "Change license to GPLv3" in v1.3.0. The *reason* for
  that change is documented nowhere and is not claimed here. The nuance that was
  missing: the voice models are ONNX and separate from the code, so they are
  loadable through `sherpa-onnx` (Apache-2.0) without linking GPL code -- the
  conclusion stands, the argument is now accurate. XTTS v2 is excluded outright
  (CPML weights, non-commercial, and Coqui no longer exists to license otherwise);
  F5-TTS is CC-BY-NC; anything from roughly 0.5B parameters up is not realtime
  without a GPU.

**VAD and turn detection.**

- **Silero VAD** (MIT, ~2MB, <1ms per chunk) for voice activity, fixed windows of
  512 samples at 16kHz = 32ms. In Rust through `voice_activity_detector` or
  `sherpa-onnx`.
- **Pipecat Smart Turn v3** for semantic end-of-turn: 8M parameters, BSD-2-Clause,
  operating directly on the waveform so no STT is needed in the turn path, 12ms on
  CPU, 23 languages.
- **Not** LiveKit Turn Detector: the "LiveKit Model License" is not an OSI license
  and v1.0 is tied to LiveKit Cloud. **Not** ten-vad, whose license states
  verbatim "You may not Deploy the ten-vad in a way that competes with Agora's
  offerings."
- Supporting evidence: arXiv:2601.17270 (January 2026) measures Silero well ahead
  of WebRTC and RMS, and finds that larger windows make accuracy *worse*.

**Barge-in is cascaded and implemented natively in Rust**, cancelling playback and
generation on detected speech. Detection **starts the recording with pre-roll**:
the ring buffer is running anyway in 32ms frames, so the last ~500ms before
detection are recorded too. Without it the transcript loses its first word, which
is the classic defect in this construction. The target for the barge-in stop is
under 200ms; voice-to-voice is 400-800ms and a different number. Realtime
speech-to-speech remains available as a later addition; nothing here forecloses
it.

**The answer window is the default and needs no mode.** In this design the moment
of an answer is *known* -- the system just asked. A window of "microphone open
until the user has finished speaking or n seconds of silence" needs no wake word,
no continuous listening loop and no false-trigger discussion. Window length
follows the question type: short for option questions, long for open ones.
**Continuous listening stays an option** for hands-free initiation and carries the
visible microphone-active indicator there as a hard requirement: published work
(Schönherr et al., arXiv:2008.00508; journal version in Computer Speech & Language
2022) found hundreds of accidental smart-speaker triggers and released a dataset
of more than a thousand verified ones, including from television dialogue.

**The target carries the profile** (ADR 0021), beside label, directory, roles and
model, with a bridge default for targets that have none. The dictation path picks
the profile from the focused application; that mechanism does not apply here,
because the focused application is arbitrary. Vocabulary and context are
target-dependent, not app-dependent.

**Bridge sessions do not enter the transcript history.** They go into the thread
in the Agents area, where targets can be inspected individually and their history
scrolled -- the same view as in the overlay, only fuller. A bridge answer without
its question is unreadable in the transcript history, and the "dictation only"
filter would be permanently on there.

**`finalize_with_text_rules` does not run on bridge output.** Text rules exist for
*inserted* text -- punctuation, capitalization, replacements, formatting for a
target document. A bridge answer is not inserted; it is read by a model. A model
does not need correct punctuation, and every replacement rule is a place where the
answer diverges from what the user said, which contradicts the verbatim rule
above. SPEC step 7b gains the clause that the stage is mode-independent **within
the insertion path**. Pure vocabulary corrections -- spelling proper nouns
correctly -- belong in recognition (ADR 0017), not in finalization.

**ADR 0031's drift guard is vacuous on bridge output**: it protects a *generated*
output against its input, and bridge output is transcribed, not generated. What
does apply is the confidence gate and hallucination detection, with the failure
behaviour decided above.

**The surface is a pill with two wings.** The base is the existing edit overlay,
extended, so the user already knows how to operate it.

- **The pill** (always visible when delivery is `Agent`): microphone, waveform,
  status dot, the word `Agent`, timer. The status dot carries the most important
  information -- as long as nothing is waiting, neither panel is needed.
- **Left, expandable: targets with state.** One row per target, a status (running
  / waiting for you / done / idle) and an unread counter. Two functions: overview,
  and one click sets the context for the next interjection. A target can also be
  addressed individually from there.
- **Right, expandable: the history** -- the active thread with questions, answers
  and completion messages.

So **space on the left, time on the right**: the same split as a classic sidebar
plus content, only expandable separately, because the normal case is that the
application is not in the foreground. Rejected: a "session list" on the left. The
orchestrator chat is one continuous thing that cannot be subdivided, and it is
interleaved with subagent output. What can be subdivided is not the conversation
but the work -- hence targets, not sessions.

**Settings gains its own area, named `Agents`** -- the bridge is a service, not a
chat, and the Chat preview is not its home. It carries the enable switch, the
transport and port, the bearer token, the orchestrator harness and its preset, the
root directory, TTS provider, voice and key with the measured TTFB, the target
list with roles and profiles, the live thread list, and the generated instruction
file.

## Consequences

- The arbitration problem this record was expected to solve mostly dissolves.
  With one client, priority moves into the orchestrator, which already knows what
  is urgent. WordScript keeps only the microphone guard.
- Per-repository setup disappears. Nothing has to be installed, configured or
  written into a repository for its agent to reach the user through the
  orchestrator.
- **WordScript does not build an agent.** It builds the ear and the mouth for an
  agent it does not run. Compacting, subagents, resume and context management are
  harness behaviour, configured through a generated instruction file. What
  WordScript builds is an MCP server with two tools, process start and
  supervision, thread state, the overlay, speech playback with an answer window,
  and the generator for that file.
- **The rate limit contradicts the architecture's own justification, and the
  record carries that openly.** If the orchestrator judges well, why a backstop?
  Because: the orchestrator judges better than a single agent because it has the
  context, not because it is a different kind of thing. The judgement stays
  probabilistic, and that is why the backstop exists.
- **Headless has a latency price and it is named here.** A run that ends after
  eight minutes with an open decision has spent eight minutes. That is what is
  paid for having no PTY and no back channel.
- **The orchestrator is a single point of failure.** If it dies or is badly
  configured, the user hears nothing -- not even that something is stuck.
  WordScript therefore supervises the process and reports its absence instead of
  being silent.
- **The local TTS path is a deliberate bet on an unstable dependency.** The Rust
  ONNX bindings `ort` stand at `2.0.0-rc.12`; there is no stable 2.0 and breaking
  changes between release candidates have happened.
- **The problem may shrink.** Coding agents ask less than they used to, through
  better defaults and permission modes. If that trend continues, the filter loses
  value -- this is the most serious argument against the whole design and it is
  not answered here, only named.
- The design is wrong if either of two things holds: the orchestrator asks too
  often, in which case this is noise with an extra step; or answering by voice is
  not faster than looking, in which case it is a toy. Both are cheap to measure
  and neither requires building the voice stack first.
- The bridge and the `draft` mode (renamed from `agent`, ADR 0029) are not
  competitors, and the boundary is recorded so it is not relitigated: the mode
  delivers **at the cursor**, in one or two seconds, needing nothing but an API
  key; the orchestrator delivers into a thread and needs this whole environment.
  The mode is right when the user is standing in a text field and wants text now;
  the orchestrator is right when the task requires looking things up.
- Because the run is started from dictated text, this resembles what ADR 0029
  forbids and the difference must be stated wherever it is built: the command and
  its permission profile are configured once, only the prompt argument is
  dictated, a visible keyed confirmation precedes the start, and starting a
  process is not an MCP client call inside the dictation path.
- "Works with every agent CLI" stays false as written. aider cannot be a client,
  and under this topology it also cannot usefully be a target, because it does not
  call tools autonomously.
- Not decided here, and each for a stated reason:
  - **The rate-limit thresholds.** A measurement question, not a design question;
    handled like the drift-guard threshold in ADR 0031, which belongs with the
    corpus rather than in a record.
  - **Whether target runs ever get a mid-run channel.** Not today: they report at
    the end and the orchestrator asks. If runs turn out to break off with an open
    decision too often, the extension is that the orchestrator writes an MCP
    reference into the command at start and the target run asks *the orchestrator*
    rather than the user. That stays a client of WordScript and does not bring the
    arbitration back. It is named here so it is not a surprise later.
  - **Whether Codex starts MCP servers inside or outside its sandbox.** Not
    documented; it has to be tested, and this record does not claim it.
  - **The falsification measurement.** How often an orchestrator actually asks,
    and how many of those questions were answerable from something written down.
  - **Window lengths for the answer window** (option versus open question) and the
    silence threshold. A measurement question.

## Sources

**MCP specification** -- [versioning](https://modelcontextprotocol.io/specification/versioning),
[changelog 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/changelog.md),
[deprecated features registry](https://modelcontextprotocol.io/specification/2026-07-28/deprecated),
[Multi Round-Trip Requests (SEP-2322)](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr),
[extension support matrix](https://modelcontextprotocol.io/extensions/client-matrix),
[Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview.md).

**Claude Code** -- [MCP documentation (timeouts, backgrounding, elicitation)](https://code.claude.com/docs/en/mcp),
[Channels](https://code.claude.com/docs/en/channels),
[Remote Control](https://code.claude.com/docs/en/remote-control),
[sandboxing](https://code.claude.com/docs/en/sandboxing),
[issue #28018 -- sandbox blocks localhost](https://github.com/anthropics/claude-code/issues/28018).

**Other clients** -- [Codex MCP](https://developers.openai.com/codex/mcp),
[Codex sandboxing](https://developers.openai.com/codex/concepts/sandboxing),
[openai/codex#10797](https://github.com/openai/codex/issues/10797),
[Cursor forum -- 60s on ACP/CLI](https://forum.cursor.com/t/agent-acp-mcp-tools-call-times-out-at-60s-with-no-way-to-configure-it/163925),
[gemini-cli#7324](https://github.com/google-gemini/gemini-cli/issues/7324),
[opencode MCP](https://opencode.ai/v2/docs/mcp-servers),
[zed#32668](https://github.com/zed-industries/zed/issues/32668),
[aider#5192 -- no MCP client](https://github.com/aider-ai/aider/issues/5192).

**Voice bridges, orchestrators, market** -- [Spokenly voice for agents](https://spokenly.app/docs/macos/voice-for-agents),
[Spokenly stdio bridge for Claude Code](https://spokenly.app/blog/voice-dictation-for-developers/claude-code),
[mbailey/voicemode](https://github.com/mbailey/voicemode),
[mcp-voice-hooks](https://glama.ai/mcp/servers/johnmatthewtennant/mcp-voice-hooks),
[ttommyth/interactive-mcp](https://github.com/ttommyth/interactive-mcp),
[paseo.sh](https://paseo.sh/) and [its voice docs](https://paseo.sh/docs/voice.md),
[getpaseo/paseo](https://github.com/getpaseo/paseo),
[Omnara](https://omnara.com/) and [the archived repository](https://github.com/omnara-ai/omnara),
[Launch HN, February 2026](https://news.ycombinator.com/item?id=46991591),
[AgentsRoom](https://agentsroom.dev/),
[TechCrunch on Claude Code voice mode](https://techcrunch.com/2026/03/03/claude-code-rolls-out-a-voice-mode-capability/),
[VentureBeat on Remote Control](https://venturebeat.com/orchestration/anthropic-just-released-a-mobile-version-of-claude-code-called-remote).

**Voice stack** -- [Cartesia pricing](https://cartesia.ai/pricing),
[ElevenLabs models](https://elevenlabs.io/docs/models),
[xAI Grok STT/TTS](https://x.ai/news/grok-stt-and-tts-apis),
[Deepgram TTS latency](https://developers.deepgram.com/docs/text-to-speech-latency),
[Google Cloud TTS authentication](https://docs.cloud.google.com/text-to-speech/docs/authentication),
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M),
[Kokoros (Rust)](https://github.com/lucasjinreal/Kokoros),
[rhasspy/piper (archived, MIT)](https://github.com/rhasspy/piper),
[piper1-gpl changelog](https://github.com/OHF-Voice/piper1-gpl/blob/main/CHANGELOG.md),
[ort crate](https://github.com/pykeio/ort),
[Silero VAD](https://github.com/snakers4/silero-vad),
[Smart Turn v3](https://huggingface.co/pipecat-ai/smart-turn-v3),
[ten-vad license](https://github.com/TEN-framework/ten-vad/blob/main/LICENSE),
[arXiv:2601.17270](https://arxiv.org/html/2601.17270v1),
[LiveKit latency budget](https://livekit.com/blog/sequential-pipeline-architecture-voice-agents),
[Stivers et al., PNAS 2009](https://www.pnas.org/doi/10.1073/pnas.0903616106),
[arXiv:2008.00508 -- accidental triggers](https://arxiv.org/abs/2008.00508).
