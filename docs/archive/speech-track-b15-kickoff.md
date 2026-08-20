# Kick-off — AI Models is organised by task, not by lane (speech track, B15)

**Spent 2026-08-17.** B15 landed the same day it was written: ADR 0211 for the
model axis and ADR 0212 for the task-first screen. Kept as the record of what the
step was handed, including the one thing in it that turned out to be false — the
account deletion never carried ADR 0195's undo notice, which is what turned B14b
into an ask rather than a wait (ADR 0210). Not retconned; the corrections live in
the records it names.

Paste this into a fresh session. It is orientation only: **the brief is
[`speech-track-plan.md`](../tracks/speech-track-plan.md) § B15** and this page does not
restate it (ADR 0123).

Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. Other tracks run concurrently — read
**Sharing `main`** in [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) before your
first commit, stage your own paths by name, and grep the whole tree for the next
free ADR number rather than trusting any line that names one.

## What this is, in one paragraph

B14 made an account a stored object a profile points at. B14a fixed four faults
the owner found in the row that operates it. **B15 is not a third round of
fixes** — it is the conclusion the owner reached after both: the screen is not
badly laid out, it is organised around the wrong object. Six layout directions
were drawn at the real 569 px column and all six were rejected in one sentence,
correctly, because they all kept the lane as the spine.

## The finding you must not re-derive

**`Account` names a credential and the reader hears a bundle.**

A `Connection` is a vendor plus a credential (plus endpoint and plan). The
surface calls that *Account*. What the owner means by the word — per task a lane,
a provider and a model, switchable as a whole — **already exists and is called a
text profile**: `providers: { default, overrides: Map<JobKey, connection_id> }`
plus the model fields.

So this requirement, which the owner stated twice and stood behind — **different
providers for different tasks on one account, and going further than that,
different LANES for different tasks** — **is already satisfiable by the config as
it stands.** A connection carries its
vendor, `laneForProviderId` reads the lane off the vendor, and an override is per
`JobKey` — so dictation on Cloud, cleanup on Local and the assistant on your own
server is a state the config accepts today. Three locks in the UI forbid it. They
are listed in § B15; do not go looking for a fourth in the data model, and do not
start by changing the data model.

**And one refusal, which is the only part of the owner's proposal that is
declined:** a credential may not span vendors. ADR 0094's one security rule is
held by structure — the endpoint sits beside the token so *this server with that
key* is unrepresentable. Keep it. It says nothing about which object organises a
screen.

## Read before you touch anything

1. **[`speech-track-plan.md`](../tracks/speech-track-plan.md) § B15** — the brief: the
   three locks, what must not move, the two config decisions, the shape, and what
   *done* observably means. § B14b above it is a small step that should land
   first because it touches the same removal path.
2. **ADR 0209** — the four faults B14a fixed and, in its §4, the corrected
   premise about what an account is and is not. Read this before ADR 0208, then
   read 0208 for the object.
3. **ADR 0094** (the axis and the security rule), **ADR 0067** (a lane that is
   offered must be operable — B12 owns the lock and you must not quietly reverse
   it), **ADR 0123** (one list per fact — the used-by read-out is a derivation,
   never a stored field), **ADR 0115** (a model id lives in
   `shared/model_catalogue.json` and nowhere else), **ADR 0195** (the delete-then-
   undo notice), **ADR 0112** (this machine's stored state is disposable).
4. `src/screens/Models.tsx`, `src/components/jobProvider.tsx`,
   `src/screens/data.ts` — the three files the locks live in. Read
   `chooseLane`, `providerNames` and `ProviderChoice` specifically.
5. `src-tauri/src/core/config.rs` — `ProfileProviderSettings::resolve`,
   `speech_model()` and `chat_model_for_job()`. The last two are where the model
   axis is narrower than it looks.
6. `docs/DESIGN_SYSTEM.md` and `docs/REFERENCE.md` for the row grammar and the
   overlay/CSS invariants you are about to work inside.

## The decision that blocks you

**The model axis is coarser than the account axis, and no layout can be settled
before this is answered.** The account axis is per `JobKey` — eight. The model
axis is three stored slots, each with a `local_*` mirror, and
`chat_model_for_job` branches on local-vs-cloud and **not on the job**: cleanup,
rewrite, translate, enhance and the assistant all read `agent_model`. A task
table with a model column would draw eight selects over three values, and moving
translate's model would silently move four other jobs.

Two answers, and it is the owner's:

- **Widen the slots to one per `JobKey`**, cloud and local, behind a
  `core::backup` snapshot, lifting the existing fields onto the new ones. Then
  *a model per task* is true and the table can be honest.
- **Draw the coarse truth**, with the rows that share a slot saying so on the
  surface. No migration, and the surface stops implying a freedom that is not
  there.

A second decision rides on the first: `Connection.model` is the one place a model
lives on a credential today (`speech_model()` branches to it on the self-hosted
lane, ADR 0165). Either it stays there with the surface stating why a typed
server id is a property of the server, or it joins the task axis. **Bring a
recommendation and a two-line reason, get the answer, then build.** Everything
else in the step is yours.

## How you are measured

- **No control changes which profile is active as a side effect.** That is the
  defect at the centre of this step: `chooseLane` writes the active profile's
  default account today. The profile is selected, visibly, and nothing else moves
  it.
- **A per-task lane is ordinary, not forbidden.** The picker is over every
  account on the machine, grouped lane → provider → account. If it is still
  filtered to one lane, the step did not land.
- **Nothing becomes fake-operable** (ADR 0067, and `CLAUDE.md`'s own rule). An
  account offered on a locked lane is a false affordance; a model select over a
  shared slot is worse, because it appears to work and moves four other jobs.
- **The credential inventory carries no model control.** That is the owner's own
  constraint and the reason the two objects are separated at all.
- **The vocabulary is decided once**, in the ADR, and spelled the same way on
  every surface that says it.
- **`port:diff` will move**, because this restructures a ported screen. State
  what moved and why in the record. A moved count here is the deliverable, not
  damage — and `port:diff` with no screen name walks zero screens and reports a
  free `ALL EXACT`, so always name `models` and `models#1`.
- **Look at it.** Four defects in one earlier session on this exact card survived
  green tests and were caught by rendering it.

## Checks

```text
cd src-tauri && cargo test     # 937 passing, 6 ignored, after B14a
npm test                       # 845 passing across 52 files, after B14a
npm run build
npm run port:diff -- models    # 28 | 248 | 20 after B14a
```

**Check the baseline against the tree you actually get.** B14a's diff was written
on 2026-08-17 and may still have been uncommitted when this page was written, so
`git log --oneline -5` and a `git status` are the first two commands of the
session, not an afterthought — and the owner edits the tree between sessions.

Both totals move under you because other tracks add tests; check the number
against `git log` rather than reading a mismatch as damage. Run the suites
serially — running two at once has reported a green tree as broken here before,
and a wave of 5 s Vitest timeouts across unrelated files is machine load, not a
regression.

**Two host rules that have cost this repo real time.** Writing any file under
`src-tauri/` rebuilds and restarts the whole app, taking the hotkeys and any
dictation in flight with it — check `pgrep -af "tauri dev"`, say so, and batch
Rust edits rather than landing them one at a time. Do not write `vite.config.ts`
while a host is running. For anything shell-, window- or Tauri-bound, check in
the native host rather than a browser preview.

**Measuring the surface headlessly works and the recipe is not obvious**: the
workspace renders in a plain browser at `http://localhost:1420/#/settings` if
`__TAURI_INTERNALS__` is injected **before** load with `load_app_config`,
`save_config`, `registered_providers`, `provider_status` and
`resolve_provider_tiers` stubbed. Disable animations first or `page.screenshot`
waits forever on the orb. The real width to measure at is **625 CSS px** — the
owner's display scale puts the workspace there, which leaves a 569 px content
column against the 760 px the sheet is designed for.

## Not this step

The lane lock itself (**B12** owns it, and reversing it quietly would undo a
recorded decision). Onboarding's copy of `LANES`, beyond whatever this step must
reach or deliberately not. The 760 px-vs-569 px column, which is a `gui-port`
finding about the whole sheet and not about this card. The orphaned credential a
removed account leaves behind — that is **B14b**, small, and it should land
first.
