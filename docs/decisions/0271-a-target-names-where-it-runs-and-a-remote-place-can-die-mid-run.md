# 0271 - A target names where it runs, and a remote place can die mid-run

Date: 2026-09-11
Status: Accepted (planning direction; not implemented)

## Context

[ADR 0268](0268-the-desk-has-three-axes-and-a-target-names-only-one-of-them.md)
made the place an axis. This record fills it, and it is the one of the three that
was not merely under-specified but absent.

**Phase 8's target has no place because it never needed one.** It carries a
label, a directory, a profile, a default model and three roles with a command
template each. Every one of those reads as local, and the design was written when
local was the only answer.

**It is not the answer for the work this feature exists to start.** The reported
working day is three servers plus this machine, with terminals open in an editor
across all of them. A target whose directory is assumed local describes a
fraction of that, and the fraction is not the interesting part -- the reason to
start work by voice is precisely that the work is not where the user is looking.

**ADR 0030's network rule is about the other direction and stays intact.** It
refuses a public endpoint: no remote agent reaches this machine, and a remote
agent could not reach a local microphone anyway. A place is outbound. WordScript
starts something somewhere else; nothing gets to start something here.

## Decision

**A target carries a place, and the place has two kinds.**

- **`this machine`** -- a local shell. The default, and the only one that needs
  nothing configured.
- **A named host** -- an alias the user already has in their own OpenSSH
  configuration.

**WordScript implements no SSH.** It invokes the user's `ssh` with a host alias
and inherits everything that comes with it: the user's configuration, their
agent, their keys, their `known_hosts`. **The product stores no key, prompts for
no password, manages no host key and holds no remote credential of any kind.** A
host that would need an interactive passphrase is a target that says so on its
card and does not run; the fix is the user's agent, not a text field in this
application. This is the same boundary
[ADR 0269](0269-the-desk-s-brain-is-the-vendor-s-own-cli-started-as-a-subprocess.md)
draws around a harness's credential, drawn again around a machine's.

**What crosses and what does not.** The directory is on the far side, and so is
the harness and everything it reads or writes. The profile, the thread, the
voice, the microphone and the spoken question stay here. The far side runs a
process and writes to a pipe; it knows nothing about a conversation.

**A remote command template carries no secret, ever.** ADR 0030 already composes
the command once, on the target, and never speaks it -- only the prompt argument
is dictated. On a remote place that command line crosses a machine boundary and
lands in process listings and shell histories that are not this user's to clean.
Credentials come from the far side's own environment. A template with a token in
it is refused at the point it is written, not at the point it runs.

**Losing the connection during a run is an outcome of its own. It is not a
failure and it is never retried silently.**

This is the rule the whole remote half turns on. When `ssh` dies, **the process
on the far side may still be running.** Treating that as a failed run and
starting another one means two agents writing into one repository, which is the
worst thing this feature could do and would look like a network glitch in the
log. So: the turn is marked *place unreachable*, the thread keeps it, and the
user is offered a resume. Nothing re-runs on its own.

**A writing role on a remote place requires a harness with resume**, and the
resume identity lives on the far side -- because that is where the session it
resumes is. A harness without resume may hold an `inspect` role on a remote
place, and may not hold `work`.

**Attaching to a terminal that is already open is out of scope, and the reason
is written down rather than left to be rediscovered.** The editor owns that pty.
There is no portable, supported way to inject into it and read it back, and a
design that scraped one would be inventing a contract the editor does not offer
and may change in a point release. What the desk does instead is start its own
session on the same host in the same directory. The user sees the same tree; they
do not see the same scrollback, and the thread is where the conversation lives
anyway.

**Also out: any inbound reach.** No listener, no tunnel, no remote control of
this machine. ADR 0030's rule is unchanged, and a place does not weaken it.

## Consequences

**Four places means four threads and still one voice.** ADR 0268 already makes
one spoken question at a time a rule for the whole desk rather than per target;
this is the case that makes it load-bearing. Three servers running at once can
produce three questions at once, and two of them wait. The queue is visible, or
the rule is a silent dropped question.

**Every remote turn pays a round trip, and the pause is shown rather than
filled.** The voice loop is local and unaffected -- the desk hears and speaks at
the same latency it always did -- but the gap before it has anything to say grows
with the link. A filler sentence that hides a slow link is a lie about the
runtime, which the product's own rule forbids; naming the wait is not.

**The harness has to exist on the far side, and the card says whether it did.**
Which harness was found, and the date it was last looked for. A target that
cannot run is a state before it is an error (ADR 0269).

**A permission profile stops being a formality.** A `work` role on a production
server is not the same risk as the same role on a laptop, and the profile is
already per target, which is exactly why it is per target. A place makes the
existing field mean something.

**`ssh` is a platform fact and belongs in [`../PLATFORMS.md`](../PLATFORMS.md).**
Where the client comes from, what it is called, and what is true of it on
Windows are not settled here.

**This does not make WordScript a deployment tool.** It starts one configured
process in one configured directory on one configured host. Orchestrating
machines, copying files and managing fleets are not in the product and are not
adjacent to it.
