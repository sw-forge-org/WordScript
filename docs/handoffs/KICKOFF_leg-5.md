# Kick-off — Leg 5

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after the GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. **Leg 5 is yours, and it is the first leg
allowed into `src-tauri/`.**

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 5 prompt is
the section titled *"The prompt for Leg 5"* and it is your actual brief — this
page is only the orientation. Above it, Leg 4d's record is your starting state
and Leg 4c's below it carries the disabled-state rule you will be held to.
**§2.5 — the entries under Leg 2c's, 2d's, 4a's, 4b's, 4c's and 4d's headings —
is your backlog**, and it was written down as it was found rather than guessed
at the end. Then `CLAUDE.md`, `docs/spec/SPEC.md`, and `src/screens/props.ts`.

**Leg 5 is not a drawing leg.** Every screen the prototype drew stands, every
wireable one is wired, and the two surfaces the port never carried — the command
palette and Help — landed in Leg 4d. What is left is the runtime side of
promises the surface is already making honestly.

Rule 6 held for seven legs so that this leg would find a product that states
exactly what it cannot answer. It does. Every inert control names its reason on
itself, and your job is to delete those reasons by making them false.

The order, cheapest first, and the first three are days rather than weeks:

1. **The seventh `ProcessingMode`.** ADR 0041 gave Translate a slot and the enum
   has six values, so Hotkeys and Profiles each draw a disabled control for it
   today. One variant and one config field.
2. **`CommunicationStyleAnalysis` over IPC.** The runtime computes it and no
   command returns it. It closes the Style tab's budget meters — which currently
   mirror two constants and over-count — and it gives `Check against a sample`
   and `Show the effective bias` an answer to put somewhere. That second half is
   a DRAWING job first (ADR 0057).
3. **A colour-scheme config field.** The palette ships three theme rows that
   change one window and persist nothing.
4. A reveal command, the Markdown-file promise, Home's decision inbox, the three
   data commands, and the five missing editors. The relay orders them and says
   which are contracts and which are surfaces.

Three rules you are measured on. **Never render fake readiness (rule 7)** — and
now it cuts backwards too: when a control gets its command, delete the reason it
was carrying. **A control that cannot act is disabled with its reason, and the
design system has to DRAW that state** (ADR 0065/0067) — check in the native
host, not in jsdom. **A banner comes off in the commit that makes it false, and
its gallery entry goes with it** (ADR 0057, held by `registry.test.tsx`).

Not to be touched: **Context**, in any direction — the owner said on 2026-08-10
it is going to be done differently and deliberately did not say how. The
**overlay** (rule 5). The **six undecided surfaces** (ADRs 0060–0064 plus one
roadmap candidate). And no config migration without a backup path: this machine
carries six real profiles, 174 transcriptions and a communication style that was
invisible until yesterday.

Checks: `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen — the 28-screen
command is in the relay, and the expected result is 26 zeros plus two RECORDED
departures (`profiles`, ADR 0068; `history`, ADR 0070). Run the suite twice
before believing a failure.

**Before you spend 3m 43s on `npm run tauri build`, check whether a
`npm run tauri dev` host is already running on this machine.** One usually is,
it hot-reloads the working tree in about a second, and it may be the owner's own
session — do not kill it. Fast Refresh preserves component state, so drive a
surface with a temporary mount effect rather than a changed `useState` default,
and take the temporary code out before the commit. Synthetic clicks do not reach
the WebKitGTK window; synthetic scroll does. No `pkill -f vite` — it matches the
agent shell's own command line.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 6 prompt.
