# Kick-off — Leg 4d

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. **Leg 4d is yours.**

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 4d prompt is
the section titled *"The prompt for Leg 4d"* and it is your actual brief — this
page is only the orientation. Above it, Leg 4c's record is your starting state
and carries eight findings you will otherwise rediscover; §2.5 is the list of
what the runtime cannot answer, and you add to it rather than starting a second
one. Then `CLAUDE.md`, then `src/screens/props.ts`, which is the seam in about
110 lines.

**Leg 4d is not a wiring leg.** Every wireable screen was wired in Leg 4c. Four
rows still carry a banner and all four are unwireable by nature — Context (V2),
Notes & Meetings (V2), Agents and Integrations (Phase 8). Deleting one of those
banners is the error, not the goal.

Four items, in this order:

0. **The communication style.** ADR 0023's register, length, style rules and
   writing sample are running in the runtime and have no surface anywhere — the
   prototype points at the profile three times and never draws it. One profile
   on this machine carries a non-default register nobody can see or change.
   **Where it goes is decided: ADR 0068** — a sixth profile tab `Style` in
   second position, one card `Communication style`, and a fifth Legend row on
   Defaults stating its scope. Draw it in the gallery first, wire it second.
1. **The search bar and the command palette.** `NavSearch` is ported 1:1 and
   mounted nowhere; the palette is `demo.js:8031–8366` and is the only prototype
   surface the port never carried. It is a port, not a design. The owner has
   raised the missing search bar once already.
2. **The Help modal** (ADR 0066), three links, two of which do not exist yet.
3. **Two derivations to decide rather than guess** — the profile list's subline
   and its neighbours. Item 0 and the subline are one job.

**Three rules you will be judged on.** Never render fake readiness (rule 7). A
control that cannot act is disabled with its reason, not deleted and not left
looking settable (ADR 0065/0067) — **and check that the design system draws the
state you set**, because Leg 4c found six controls that took `disabled` and
looked entirely operable while every unit test passed. The gallery shrinks by
wiring and by nothing else; it is a test, so do not argue with it.

**Do not touch `src-tauri/` (rule 6), the overlay (rule 5), or Context in any
direction** — the owner said on 2026-08-10 that Context is going to be done
differently and deliberately did not say how.

**Checks:** `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen — the exact 28-screen
command is in the relay's Leg 4d prompt. Run the suite twice before believing a
failure. A wired screen cannot be looked at in a browser; the native-host recipe
and its timer trick are in the same section. Do not `pkill -f vite`, it kills
the agent's own shell.

**One thing about the briefs themselves.** The owner dictates them into
WordScript and its transcription is currently inaccurate — see
`docs/known-issues/transcription-accuracy.md`, opened 2026-08-10. A sentence in
a brief that matches nothing in the repository, the plan or the drawing is a
candidate mishearing and is worth one direct question rather than an hour of
searching. That has cost a round trip at least once.

**When it is done:** commit, push to `main`, append your record to the leg log,
and write the next prompt. If all four items are done, write the **Leg 5** prompt
instead — the runtime contracts, prioritised by what §2.5 says is blocking. Its
cheapest entry is already visible from two screens: a seventh `ProcessingMode`
variant and one config field, which Hotkeys and Profiles both draw a disabled
control for today.
