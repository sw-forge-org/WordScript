# WordScript — the implementation board

Status: 2026-08-12

**This page answers one question: what is being built right now, by whom, and
where does its sequence live.** It is the entry point for a session that is
about to write code. Nothing here is a contract — the contract is
[`spec/SPEC.md`](spec/SPEC.md) — and nothing here is a product state report,
which is [`STATUS.md`](STATUS.md). This is the order of work.

## What a track is

A track is one line of implementation that runs across many sessions, carries
its own sequence document, and files its own ADRs. Tracks run **concurrently on
`main`**, in the same working tree, with no feature branches. That is a
deliberate choice and it has a cost, stated under *Sharing `main`* below.

A track has three kinds of document and they are not interchangeable:

| Kind | What it is | Who writes it |
| --- | --- | --- |
| **Sequence** | The ordered steps, what each requires, what validates it, and what *done* observably means | The track, updated as steps land |
| **Kick-off** | The page pasted into a fresh session to start the next unit of work | The session before it |
| **Record** | What a closed unit actually did, found, and deliberately did not do | The session that closed it |

Only the sequence is a living document. A record is written once and not
updated; a kick-off is spent when its unit closes.

## The live tracks

| Track | Opened | State | Sequence | Start a session with |
| --- | --- | --- | --- | --- |
| **GUI port** | 2026-08-04 | **Leg 13 open**; Legs 0–12 closed | [`tracks/gui-port-relay.md`](tracks/gui-port-relay.md) | [`tracks/gui-port-relay-kickoff.md`](tracks/gui-port-relay-kickoff.md) |
| **Core hardening** | 2026-08-10 | **Third pass open**; two passes closed | [`tracks/core-hardening.md`](tracks/core-hardening.md) | the same file — it is both |
| **Speech** | 2026-08-11 | **Stage A closed, Stage B running**; 11 of ~26 steps done, and the first adapter has landed | [`tracks/speech-track-plan.md`](tracks/speech-track-plan.md) | [`tracks/speech-track.md`](tracks/speech-track.md) for orientation, then the plan |
| **Activation gestures** | 2026-07-29 | **Open, nothing built** — blocked on three capability gaps and the decisions they owe | [`tracks/activation-gestures.md`](tracks/activation-gestures.md) | the same file |

### GUI port

Moves the settings rework from prototype to product as a **relay**: one leg per
session, each leg reading the chain document, doing its leg completely, and
writing the next leg's brief into it before it stops. Rests on ADR 0054 (the
port overwrites, it does not migrate) and ADR 0055 (the gallery is the
acceptance surface).

Owns ADR 0054–0064, 0074–0077, 0082, 0085–0093, 0103, 0104, 0111.

**Leg 13 is open** and is two items: the caller sweep run in both directions
over the whole tree, and the row classes no instrument has reached — the panel
plane, where the port designs rather than carries.

**One commit on this track has no leg behind it.** `b330815` (the sidebar's
second width, ADR 0111) landed on 2026-08-11 while Leg 13 was open and is
neither of Leg 13's items. Whoever closes Leg 13 either adopts it or files it as
its own leg.

### Core hardening

Follows the cluster in [`known-issues/`](known-issues/) where the damage is
invisible — output that is fluent, grammatical, plausible and wrong, with
nothing downstream carrying evidence that a substitution happened. Five records
are one failure class; **none of them is closed and two never will be in the
ordinary sense**, because the rule is that lost content is reported, never
replaced.

Owns ADR 0079–0081, 0083, 0084, 0100.

What two passes bought is that the cluster went from invisible to instrumented.
The third pass's own page carries where each of the five records stands.

### Speech

The capability layer four drawn surfaces wait on: providers, streaming
recognition, the spoken output path, and the windows that carry them.

Owns ADR 0094–0102, 0105–0110, 0113–0122, 0124, 0126–0128.

**Its first stage was documentation only** — [`PROVIDERS.md`](PROVIDERS.md) and
fifteen records, no code — and the plan exists because those records order the
*adapters* and not the work in front of them. The plan is the page a session
starts on; [`tracks/speech-track.md`](tracks/speech-track.md) is stage one's
account and is not updated by later work.

Done: A1–A6 (the runtime contract), B1 (the capability seam), B3 (the model
catalogue), C3 (the soak night, which returned zero), **D1 (OpenAI — the first
adapter, and the connection that can now be chosen)**, and **B6 (what it means
to wire a drawing inherited from the demo GUI)**.

Next unblocked: **B2**, **B4**, **B5**, **C1**, **E1**, **D3** — whose
`Requires` line has read D1 and A3 since it was written, both now done — and
**D1a**, which since B6 spent its drawing half is the adapter alone and the
cheapest step in Stage D.

**What D1 left for somebody to decide was decided the next morning.** The drawn
per-job override and A4's runtime resolution disagreed about what a fresh
profile overrides; ADR 0128 answers it with a rule rather than with either
option — the config answers in the product, the drawn literal answers in the
gallery — and closes `PROVIDERS.md` disagreements 10, 11 and 13 with it. The
rule generalises past this screen: **an inherited drawing is an inventory of
intent, and what is unbuilt stays visible and inert rather than tidied away.**

### Activation gestures

The only forward-looking document that is not a running track: why one set of
shortcut defaults cannot serve three activation modes, the three capability gaps
that block a per-mode gesture, and the decisions still owed. Nothing is built.
It is listed here so it stops being invisible, not because it is scheduled.

## Sharing `main`

Three tracks work in one tree with no branches. The rules that come from that,
learned the expensive way:

- **Run `git status` and `git log --oneline -5` before you start.** Another
  track's uncommitted prose may be sitting in a document you are about to write
  to. Leg 12 committed only `src/` for exactly this reason, and its
  documentation then sat in the tree for a leg.
- **Stage your own paths. Never `git add -A`.** Whoever commits a file next
  carries whatever else is in it.
- **Never trust a "next free ADR number" written on a page.** Grep the whole
  tree, not just [`decisions/`](decisions/) — a number gets cited in source and
  in a commit message before its file lands. The relay's rule 3 carried a stale
  `0060` for sixty-three records.
- **A test count is a shared measurement.** A step that changes one says by how
  much and why. A count that moved because another track landed is that track's,
  and saying so is the difference between a baseline and a guess.
- **A documentation stage that moves a test count has done something it did not
  say it would.** Prove the suite did not move rather than that it passes.

## Where the sequence for a whole release lives

The tracks are how work is done; they are not what the product owes. That is:

- [`ROADMAP.md`](ROADMAP.md) — the V1 phases, in order, with their gates. The
  canonical phase detail.
- [`STATUS.md`](STATUS.md) — what works today and what is open.
- [`spec/SPEC.md`](spec/SPEC.md) — the authoritative contract. When an overview
  document disagrees with it, the overview is the one that drifted.

A track is not a phase. The speech track spans ROADMAP Phases 4 and 5; the GUI
port is the second half of Phase 7; core hardening serves Phase 1's promise
after Phase 1 closed.

## Closed tracks

Their sequence documents, records and spent briefs are in
[`archive/`](archive/README.md):

| Track | Ran | Outcome |
| --- | --- | --- |
| Settings surface rework (as a plan) | 2026-07 → 2026-08-04 | Spent as an instruction; kept as the derivation of why the surface is shaped the way it is. Superseded by the GUI port relay |
| UI/UX overhaul | → 2026-07-25 | The implemented UI direction and its enduring rationale. Current rules moved to [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) |
| GUI rework, third pass | → 2026-08-04 | Superseded by the GUI port relay |
| Capture shortcut lane rebuild | merged 2026-07-25 | The shortcut contract (S0–S8) and the invariants it established |
| Documentation realignment | 2026-07-24 | Established the current documentation set and American English throughout |
