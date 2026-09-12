# 0269 - The desk's brain is the vendor's own CLI, started as a subprocess and paid by a plan the user already has

Date: 2026-09-11
Status: Accepted (planning direction; not implemented)

## Context

[ADR 0268](0268-the-desk-has-three-axes-and-a-target-names-only-one-of-them.md)
separated the desk into three axes. This record fills the second one: what
thinks.

**WordScript was always going to start a process it did not write.**
[ADR 0030](0030-one-orchestrator-speaks-for-every-agent.md) gives each target
role its own command template and permission profile, and has WordScript start
the orchestrator and read it. That is the existing shape, and it is the reason
this record is a choice between rows rather than a new mechanism.

**Three candidates now exist, and they are not comparable on one dimension.**

- **A locally installed harness CLI** -- Claude Code, Codex CLI -- authenticated
  by whatever the user already signed in to, run as a subprocess, headless, with
  resume.
- **The Agents API**, public beta 2026-09-10
  (`openai.com/index/introducing-the-agents-api/`, read 2026-09-11): a hosted
  session that persists state, compacts context, recovers after failures, takes
  MCP servers, and runs its compute in a managed sandbox or on infrastructure
  the caller supplies. Billed per token.
- **The subscription proxy** of
  [ADR 0102](0102-a-subscription-is-a-second-way-to-pay-for-openai-text-and-openai-is-the-only-vendor-left-where-it-is-allowed.md),
  which is on the roadmap as a credential kind already.

**The third one is not a candidate, and re-reading it is how that got settled.**
The proxy was read again on 2026-09-11 (`github.com/EvanZhouDev/openai-oauth`).
It exposes the same five endpoints it exposed on 2026-08-11 --
`/v1/responses`, `/v1/chat/completions`, `/v1/models`,
`/v1/images/generations`, `/v1/images/edits` -- against
`https://chatgpt.com/backend-api/codex`. **No audio, no `/v1/live`, and nothing
resembling the Agents API.** ADR 0102's finding is unchanged by either release.

**The economics and the risk point the same way, which is unusual enough to
write down.** An hour of agent work billed per token is billed; the same hour on
a plan the user pays for monthly is already paid. And ADR 0102's whole risk
sentence -- *enforcement lands on the account of the person using it* -- exists
because WordScript would be presenting a subscription token to a backend that
licenses it for interactive use. **Starting the vendor's own client presents
nothing.** The client authenticates itself, the way its vendor built it to, in
the shape its vendor documents. The cheaper path and the safer path are the same
path.

## Decision

**The default brain is a locally installed, officially distributed harness CLI,
started as a subprocess.** Claude Code and Codex CLI are the first two rows. They
are rows: a third harness is added by adding a row with its command template, not
by adding a branch.

**WordScript never touches a harness's credential.** It does not read a token
store, does not carry a token, does not proxy an endpoint, and does not put a key
on a command line. It starts a process and reads what the process writes. This is
the same refusal ADR 0102 already made for `~/.codex/auth.json`, generalised: the
product's relationship to a harness is the operating system's process boundary and
nothing narrower.

**The hosted brain is a second row, and it is not the default.** The Agents API
is offered for the case the local row cannot serve -- no harness installed, or
work that belongs in a sandbox that is not this machine. It is billed per token
and the surface says so beside the row, because the difference between the two
rows is not a preference but a bill.

**ADR 0102 stays accepted, stays planned, and is not the desk's path.** It pays
for the five chat jobs it was written for -- `cleanup`, `rewrite`, `translate`,
`enhance`, `assistant` -- and nothing about that changes. **This sentence exists
so a later reader does not wire the desk through the proxy because the credential
happens to be there by then.** It cannot serve the desk: there is no agent
endpoint behind it, and the path that would make it look possible is the one this
record refuses on both cost and risk.

**What each harness's own terms permit is an open question and is marked as
one.** ADR 0102 records Anthropic's clause of 2026-02-19 as governing OAuth
tokens used with third-party tools and the Agent SDK; as recorded, it does not
speak to running the vendor's own client, which is what this record does.
**That is a reading of a clause, not a rule, and it is not settled here.** Before
the first target runs, each harness's current terms are read against
non-interactive and automated use, dated, and written into
[`../PROVIDERS.md`](../PROVIDERS.md) the way every other vendor claim in this
repository is. If a harness forbids it, that harness loses its row and the
refusal is recorded rather than worked around.

## Consequences

**The desk depends on software WordScript does not ship and cannot update.** A
missing, outdated or unauthenticated CLI is a state the target card carries --
with the date it was last looked for -- not an error that surfaces when the user
speaks. A target that cannot run says so before it is asked to.

**A harness's output is not a contract.** Stdout format changes on the vendor's
release schedule, and a thread that parses prose into structure it then trusts
will break silently on an upgrade. What the desk reads from a harness is what
that harness documents as machine-readable; everything else is shown, not parsed.

**The cost model is per target, because the brain is.** Two targets on one desk
can be billed two different ways, and one of them can be free at the margin.

**A remote place needs the harness on the far side.** That is
[ADR 0271](0271-a-target-names-where-it-runs-and-a-remote-place-can-die-mid-run.md)'s
problem, and it is the reason the hosted row is kept rather than excluded: it is
the only row that needs nothing installed anywhere.

**None of this is built.** ADR 0030's target is a design; this record says which
process it starts and which it does not.
