# Kick-off — Leg 13

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 12. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open, and **two other tracks
— core-hardening and speech — are working in the same tree**. Run
`git log --oneline -5` AND `git status` before you start, and **stage your own
paths when you commit** rather than `git add -A`.

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 13 prompt is
the section titled *"The prompt for Leg 13"* and it is your actual brief — this
page is only the orientation. Above it, Leg 12's record is your starting state,
and **its findings 1 and 2 are the two that will cost you if you skip them**.
Then ADR 0103, ADR 0104, ADR 0092, `CLAUDE.md` and `docs/spec/SPEC.md`.

**START BY CHECKING WHAT IS ACTUALLY ON `main`.** Leg 12 committed only `src/`,
ADR 0103 and ADR 0104. Its **ADR index entries, its leg record, its map row and
its `DESIGN_SYSTEM.md` additions are in the working tree and not committed**,
because by the end of that leg the other two tracks had roughly 250 uncommitted
lines across ten shared documents — `docs/decisions/README.md`,
`DESIGN_SYSTEM.md`, `STATUS.md`, `CHANGELOG.md`, `REFERENCE.md`,
`ARCHITECTURE.md`, `ROADMAP.md`, `spec/SPEC.md`, `AGENTS.md`, `README.md` and
the relay itself. Staging any of those paths commits another track's prose under
your message. If those files are still dirty, whoever commits them next carries
Leg 12's entries along; do not re-write them from scratch and do not assume they
are on `main` because the ADRs are.

**Leg 12 was sent to measure rows and the defect it found was a button.** The
caller sweep had been run for four legs in one direction only — which registered
command has no `invoke(` — and every answer that question can give is dead
weight to be triaged. Run the other way it gave one name:
`load_transcription_history`, invoked by `OverlayWindow.tsx` and **registered
nowhere, ever**. The overlay's *Retry from the recording* rejected on every press
from 2026-08-03, in the commit whose entire subject was keeping a failed
dictation's audio so it could be retried. `cargo check` could not see it,
`npm run build` could not see it, and the test asserted the button **appears**
without ever pressing it (ADR 0103).

**The first pass of that sweep lied in the other direction.** A line-based
`grep` for `invoke("name")` reported **five live commands as orphans** — both
halves of the backup path among them — because `Privacy.tsx` puts the name on
the line after `invoke(`. The scan reads whole files.

**Two of the three unmeasured row classes were clean.** Diagnostics' Preview and
Logs draw every run at one line; the `Models` jobs' three-line rows are the
prototype's. The one defect was in **Profiles' editor panel** — the surface the
port designs rather than carries — where `.ws-edit-note` had `min-width: 0`
beside 110 px of buttons and drew **six lines in 68 px**, under a CSS comment
saying the panel's height never changes. It measures two lines at 194 px now.

**The rule you are most likely to break.** Calling something a defect without
reading the drawing for that screen. Leg 12 had `Ceiling` queued as an instance
of *"a row must not print the runtime text its own control displays"* — and
`demo.js` draws exactly that, deliberately, beside a badge. **The class needs
the control to be width-auto AND runtime-filled**, so the string and the width
have one cause. Two minutes in `demo.js` saved rewriting a card of the donor's
copy.

**Also: every number is a number at a CSS viewport.** The workspace lays out at
**800 × 608 CSS px** while `tauri.conf.json` declares 1000 × 760 and a minimum
of 880 — the display scale is 1.25 and the two are different units, so the
declared minimum is never reached (ADR 0104). Quote `window.innerWidth` and
`devicePixelRatio` with any measurement. **Do not touch the geometry**: that is
ADR 0100 and the core-hardening track's.

**Strike the item when you do it.** Leg 10 struck both of Leg 9's; Leg 11 struck
both of Leg 10's; Leg 12 struck both of Leg 11's.

**Not to be touched:** The prototype's copy — ADR 0092 lists the rows drawing
three lines and they are the drawing's. **Profiles → Style either**, though it
IS port-authored: its rows draw 7, 5 and 7 lines at 86–226 px and that is the
width question, not a copy question (Leg 12 finding 3). The six undecided
surfaces (ADRs 0060–0064 plus the roadmap candidate); `ia.test.tsx`'s last case
asserts none is mounted. The `settings` window label. The overlay is still rule
5, and the two commands that resized it dynamically are gone (ADR 0089). No
config migration without a backup path: `core::backup` is the pattern.

**Checks:** `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen. Watch the test
TOTAL, not the colour. Leg 12 closed at **474 frontend across 39 files,
`cargo test` 740, `cargo check` 15 warnings**. Under load the suite flakes by
about five; `npx vitest run --no-file-parallelism` is the tiebreaker and
`uptime` tells you whether to reach for it. Leg 12 ran at 1.8–2.5 and saw none.

**`npm run port:diff` TAKES GALLERY IDS OR IT MEASURES NOTHING — and a name
that is not one is dropped in silence.** The 25 are the **16 ids in
`src/windows/gallery/registry.tsx` except `ds`**, plus `models#1 agents#1
agents#2 onboarding#1`–`#6`. Read the registry rather than a prose list. Expect
24 of 25 at structural 0 | style 0 with `models` at 6 | 6 (ADR 0088) and 33 in
the soft text column. **RUN IT IN TWO OR THREE BATCHES**: a single 25-id
invocation crashed at screen 8 and, on the retry, at screen 23, with two
different exceptions — and every screen that crashed is exact when run alone.
**Check `ss -ltn | grep 9333` before each batch**, because a crashed run leaves
its own browser holding that port, which is where Leg 11's stale-browser finding
actually came from. Kill it by PID.

**Check whether a host and a dev server are already running before you start
one** — `ps -o lstart=` on the pid shows whose is whose, and
`xprop -id <window> _NET_WM_PID` maps a window to its process.
`xdotool getwindowgeometry` is good enough for a width; `xwininfo` is not
installed on this machine. `npm run tauri dev` starts its own Vite, so a
`npm run dev` you started yourself collides with it on 1420 and the host dies.
If the owner's session is already up, `port:diff` needs nothing started. Do not
kill the owner's session, and **do not raise its window past somebody working at
the machine — ask**.

**The native host is the only instrument for a drawn state**, and it has found a
defect in six consecutive legs. **But prefer the instrument to the screenshot**:
Leg 12's read 286 prose runs across 25 surface states in 37 seconds.

Four instrument notes.

- The channel out of the webview is a **POST to a loopback collector**.
  `tauri.conf.json` sets `csp: null`, so `fetch` needs no permission and lands
  in a file the shell reads immediately. Never debug through a channel whose
  failure mode is silence.
- **Guard the run with a TIMESTAMP, not a boolean.** Fast Refresh re-runs the
  mount hook on every edit, so a second walk starts while the first is still
  navigating and the two drive and measure each other — Leg 12 lost three
  payloads to that before spotting a surface labelled `hotkeys` full of `models`
  rows. A boolean latches forever when a module swap kills a walk mid-way.
- **A closed `<details>` measures zero.** `details.ws-job { open = true }` before
  sweeping, or every Models job reports nothing. A conditional state that no
  click reaches is still priced by cloning the node.
- `spectacle -a -b -n -o <file>` captures the ACTIVE WINDOW and is the only
  reliable capture. Synthetic POINTER events do not reach the webview; synthetic
  KEYS do, and must be sent bare — `xdotool key --window <id>` is silently
  dropped. In-page `element.click()` is not a synthetic pointer event and works
  fine, which is how the instrument drives tabs and Add buttons.

**Never `pkill`.** Not `-f`, which matches the agent shell's own command line
and cost Leg 6 a killed shell, and not `-P $$`, which killed Leg 11's own
subshell. Kill by PID — and stop what you started.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

**The next free ADR number is 0105** — and 0101 and 0102 were claimed by the
core-hardening track while Leg 12's checks were running, which is the third leg
in a row that sentence went stale before the commit landed. Grep the tree,
source as well as `docs/`, because a number is cited in code before its file
lands. Do not edit an existing ADR; append-only.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 14 prompt.
