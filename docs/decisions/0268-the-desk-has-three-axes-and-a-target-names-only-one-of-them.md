# 0268 - The desk has three axes, and a target names only one of them

Date: 2026-09-11
Status: Accepted (planning direction; not implemented)

## Context

[ADR 0030](0030-one-orchestrator-speaks-for-every-agent.md) gave the product one
orchestrator and made it WordScript's only client.
[ADR 0043](0043-the-orchestrator-has-one-voice-and-that-voice-has-a-body.md) gave
it one voice and one body, and the settings planning pass named it *the desk*
(ADR 0044, cited for the name by
[ADR 0046](0046-intake-bridge-reach.md); [`../VISION.md`](../VISION.md) carries
it). Phase 8 in [`../ROADMAP.md`](../ROADMAP.md) carries the scope those records
produced.

Read that scope as a list of settings and it has one column. A **target** carries
a label, a directory, a profile, a default model and three roles with a command
template each; the voice is a preset row in `AI Models`; the barge-in is Phase 8's cascade in Rust, whose first
implementation behind the seam is
[ADR 0098](0098-the-recogniser-goes-deaf-while-the-machine-speaks-and-that-stretch-is-not-a-shortfall.md)'s
runtime mute. All of it is written as one design because, when it was written, it was one
design: WordScript would build the voice loop, start one harness, and do both on
the machine the user is sitting at.

**Two vendor releases on 2026-09-10 separated the first two, and the owner's own
working day falsifies the third.**

- **GPT-Live 1 went generally available** (`gpt-live-1`,
  `developers.openai.com/api/docs/models/gpt-live-1`, read 2026-09-11). A
  full-duplex session hears, takes turns, handles interruption and speaks -- and
  in its **client delegation** mode it carries no backend model at all. The voice
  loop becomes something a vendor can serve whole, with the thinking still
  somewhere else entirely.
- **The Agents API entered public beta** the same day
  (`openai.com/index/introducing-the-agents-api/`, read 2026-09-11): agent,
  environment, session, events, with MCP servers and a managed or self-hosted
  sandbox. A brain that runs nowhere near this machine.
- **And the work does not happen here.** The owner's day is three servers plus
  this machine, with terminals open in an editor. A target whose directory is
  assumed local describes about a quarter of the work it is meant to start.

None of that is a change of direction. It is the discovery that one column was
carrying three independent facts, and that each of them now has more than one
possible value.

## Decision

**The desk is configured on three axes. No axis is derived from any other.**

| Axis | What it answers | Where it is set |
| --- | --- | --- |
| **Voice loop** | who hears, who decides the turn ended, who interrupts, who speaks | once per desk |
| **Brain** | what thinks | per target |
| **Place** | where the work runs | per target |

**The voice loop is desk-wide because the microphone and the voice are.** ADR
0043 gave the orchestrator one voice; a second voice loop would be a second
voice, whatever the settings called it. One machine, one microphone, one body.
The three implementations behind that single seam are
[ADR 0270](0270-full-duplex-is-the-third-implementation-behind-the-mute-seam.md).

**The brain is per target because a target is already the thing that carries a
command.** A repository worked on with one harness and a server administered with
another is an ordinary arrangement, not an exception, and the target is where
that already lives. The rows and the default are
[ADR 0269](0269-the-desk-s-brain-is-the-vendor-s-own-cli-started-as-a-subprocess.md).

**The place is per target and is new.** It was never absent on purpose; it was
absent because it had one value.
[ADR 0271](0271-a-target-names-where-it-runs-and-a-remote-place-can-die-mid-run.md)
carries it, including the failure it introduces.

**Every combination is admissible, and the matrix is not the product's
business.** A local place with a hosted brain is a sandbox job started by voice
from this desk. A remote place with a local brain is a harness installed on that
server. Neither is a special case to be enumerated, and no axis may quietly
constrain another -- where a combination genuinely cannot work, the reason is a
capability the surface reads (ADR 0106), not a rule in a table here.

**ADR 0030 is untouched, and this record exists to keep it that way.** One
orchestrator, one voice, WordScript owning the thread and reaching the user only
for what the orchestrator cannot answer -- all of it survives the split, because
none of it was ever a statement about where the harness runs or who renders the
audio. What changes is that three facts that were spelled once are now spelled
three times, in three places, deliberately.

**One spoken question at a time is a rule across all axes, not per axis.** Phase
8 already requires serial spoken questions so an answer belongs to its question
by construction. With several places running at once that requirement gets
harder rather than looser: the queue is one queue for the whole desk. A second
place does not buy a second conversation.

## Consequences

**Phase 8's target definition grows, and that is drawn vocabulary.** A target
card gains a place and a brain, and a rail that lists four targets across four
places is not the rail ADR 0030 sketched. That goes through the gallery before it
goes into the product, the way ADR 0057 and ADR 0088 require and the way ADR 0102
restated for the credential row. The window sizes Phase 8 fixes -- 620 x 340, the
recording pill, the tab out of its left edge -- are assumptions this record does
not renegotiate, and the first drawing has to show whether they survive three
columns of state.

**The cost model splits three ways and stops being one number.** The voice loop
bills per minute of open session, the brain per token or per subscription, the
place bills nothing and can fail. A surface that states *what this costs* has to
state it per axis or it will be wrong on two of them.

**Three ADRs follow this one, one per axis.** They are filed together because
separating the axes is worth nothing until each of them says what its values are.

**This record decides a shape, not an implementation.** Nothing in the runtime
knows what a target is today; Phase 8 is planned and unbuilt. What this prevents
is the version of Phase 8 that ships one column and then has to be taken apart.
