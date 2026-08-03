# 0046 -- Intake, bridge, reach: who owns a connector

Date: 2026-08-03
Status: Accepted (planning direction; not implemented)

## Context

The product now wants to reach things outside itself: a calendar, so a meeting
has a name and attendees; a mailbox, so a follow-up can be sent; an issue
tracker, so a decision becomes a ticket. Every one of those is "an account you
link", and on a settings screen they look identical.

They are not identical, and the Integrations screen was hiding the one
difference that matters. A calendar produces material and can change nothing. A
Gmail connector changes things in the world and produces nothing.

### The question this record was asked

> Google Calendar in Integrations -- is that basically an MCP too? Where would
> it write, and where would it show anything?

The first answer given was a rule that turned out to be too coarse: *WordScript
builds no connectors; it builds the place connectors hang.* That is right about
Gmail and wrong about the calendar, because a meeting cannot be named without
one and meeting capture must not require that the user has configured an agent
CLI first.

### The desk is already an MCP client, and that is the whole argument

ADR 0030 has WordScript starting one orchestrator -- now `the desk` (ADR 0044)
-- which is an agent CLI the user chose, running in a directory WordScript
creates. That program already has an MCP client, a configuration file, a
permission model and a maintained connector ecosystem.

Building a second one inside WordScript would mean maintaining connectors
forever, for capabilities that already exist one directory away.

## Decision

**Three classes, and one question sorts every entry, present and future:**

> **Does it write anywhere?**

| Class | What it does | Who runs it | Example |
| --- | --- | --- | --- |
| **intake** | Reads. What it reads is why a context object exists. | WordScript, natively, read-only | Calendar |
| **bridge** | Answers a call from something else. | WordScript, as a server | `ask` / `await`, notes, the CLI |
| **reach** | Writes something, somewhere, on your behalf. | the desk, with its own connectors | Mail, issues, calendars |

**The calendar is the only intake, and the exception is argued rather than
assumed.** It qualifies on two grounds: it is small (events, times, attendees),
and it is the only source of a participant's name -- nothing in an audio stream
produces one (ADR 0047). Meeting capture would be materially worse without it,
and it must not depend on an agent CLI being configured.

**Mail is deliberately not an intake**, and it is the instructive case. Reading
a mailbox would be useful context and it is an OAuth scope nobody wants to hold
halfway. It stays entirely on the reach side.

**WordScript reads what a context object needs in order to exist. Everything
that happens to it afterwards is the desk's.**

**Reach is shown, never configured here.** WordScript reads the desk's MCP
configuration and lists what is attached: name, scope, and whose process runs
it. There is no "add server" button, on purpose -- a connector configurable in
two places is a connector that disagrees with itself.

**The door into the directory is ours to build.** ADR 0030 forbids *rebuilding*
the CLI's controls ("what is left is a terminal with extra steps"). A button
that opens the real directory rebuilds nothing; it hands over the original. Three
doors: a terminal in that directory, the folder, and the generated instruction
file with its markers.

**And the honesty that door owes:** the running desk is headless, with no PTY
(ADR 0030). The terminal button opens a *second* session in the same directory.
A model changed there takes effect on the next start, and the restart control
states what a restart costs -- a desk that has run for days filters well, a
fresh one is stupid.

**The privacy consequence is stated at the row that spends it** (ADR 0034).
A reach connector is network traffic under somebody else's terms. It does not
make WordScript less local -- nothing in the dictation path changes -- but
"nothing leaves this machine" stops being true for that work, and the row says so.

**MCP is for processes; the CLI is for people.** ADR 0030 rejected a CLI as an
agent transport with evidence (Claude Code's sandbox blocks loopback; Codex
refuses `AF_UNIX` with network access off). That stands. What is left is the
rule that keeps the CLI from drifting back into it: the CLI is the surface for
the user who is in a terminal rather than in the window, and the sandbox
objection does not apply to a person typing in their own shell.

## Consequences

- **§10.1's open question is narrowed, not closed.** WordScript still exposes
  two bridge surfaces -- `ask`/`await` and a notes reader -- and how they are
  kept apart is still undecided. What this record adds is that no third
  WordScript-owned surface is coming: reach is not ours.
- **The desk becomes a privacy boundary the user has to understand.** Its
  connectors run under its permissions, from its configuration, and WordScript
  cannot see what they returned. That is a real reduction in what this product
  can promise about work that crosses it, and the surface says so rather than
  discovering it later.
- **A calendar adapter is now WordScript's to build and maintain**: Google,
  Apple EventKit, CalDAV -- three authentication models, read-only, and the
  scope must stay read-only or this record has been violated.
- **"Where the text lands" left Integrations.** It answered how a transcript
  reaches the focused app, which is Delivery & Insert's question, in more detail
  and beside the live driver chain. Two screens answering one question is the
  failure §11.7 was written about.
- If a capability ever needs to be both -- read for context *and* write on
  request -- it is two connectors, one per class, and the write half is the
  desk's. Splitting it is cheaper than a connector whose scope depends on which
  screen you configured it from.
