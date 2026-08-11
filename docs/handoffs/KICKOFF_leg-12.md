# Kick-off — Leg 12

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 11. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open — and **the
core-hardening track is working in the same tree**. Run `git log --oneline -5`
before you start, and **stage your own paths when you commit** rather than
`git add -A`.

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 12 prompt is
the section titled *"The prompt for Leg 12"* and it is your actual brief — this
page is only the orientation. Above it, Leg 11's record is your starting state,
and **its findings 1 and 4 are the two that will cost you if you skip them**.
Then ADR 0092, ADR 0093, `CLAUDE.md` and `docs/spec/SPEC.md`.

**Leg 11 was sent to apply a rule and found the rule was false.** The brief said
a section header carries the explanation and a row gets at most one line. Of the
74 measurements over one line on the shipped surfaces, **62 carry the
prototype's copy verbatim** — two lines is the drawing's norm, on six screens,
consistently. Applying the rule as handed over would have rewritten sixty rows
of the donor's copy on the authority of a sentence derived from one card of two.
**A brief's rule is a claim, and checking it cost one script.**

**The budget was measurable all along.** Leg 10 said a copy budget is a function
of the control beside it and that nothing in the toolchain knows that — the
second half was the part worth acting on. A mount effect that reads
`.ws-row-hint`'s height against its computed line-height reports the drawn line
count directly, in WebKitGTK, for **123 rows and 51 conditional states** in
twenty seconds. One line holds **12 to 73 characters**. `≤ 90` was written in
four places and is wrong in all of them; one of the four also promised a lint
rule, for a number that is not knowable from the source.

**The three real defects were one mistake, and it is not a length mistake.** A
row must not print the runtime text its own control displays. `.ws-sel` is
`width: auto`, so a device name, a monitor label or a release summary is what
sets the control's width — the row spends its text column on the string and then
tries to print the string in what is left. Shortening it moves the width too:
`Input device`'s replacement ran 24 characters and still drew two lines, because
the row had **80 pixels**. That row now carries no hint at all.

This leg is one item and a sweep:

1. **The rows no instrument has reached.** `Profiles`' editor panel,
   `Diagnostics`' non-default tabs and every unexpanded `Models` job were never
   measured — the instrument only sees what is rendered, and Leg 11's pass
   caught the default state of each surface. Rebuild the instrument (it is ten
   lines; the relay's finding 1 says how), open those surfaces, and apply ADR
   0092's test to what you find: **is the copy the prototype's, or did the port
   write it?** Only the second is yours to change.
2. **The `src-tauri/` drift sweep, now with three questions rather than two.**
   `invoke_handler` against `invoke(` in **non-test** `src/`, then the survivors
   against the whole tree. That third pass is what found ADR 0093's three: a
   command whose name survives in a test mock looks called to a name-grep and
   uncalled to a call-grep, and only the second is true.

**The rule you are most likely to break.** Carrying a number instead of
measuring one. The sheet's row width changed from **542 px to 457** between two
passes in a single session, which moved a text column from 165 px to 80. Every
figure in ADR 0092's table is a figure at a window size, including the ones this
page just quoted.

**Also: a conditional state is priced by cloning the node, not by opening the
screen.** `General`'s second defect was in `Anchor`, which is only rendered in
preset placement — the machine is in manual, so no screenshot of that screen was
ever going to contain the row. It was found by reading the drawing.

**Strike the item when you do it.** Leg 9 struck a bullet six briefs had
re-carried; Leg 10 struck both of Leg 9's; Leg 11 struck both of Leg 10's.

**Not to be touched:** The prototype's copy — ADR 0092 lists the rows still
drawing three lines and they are the drawing's; tightening them is a design
decision and the owner's. Context beyond the drawn gesture lifted on 2026-08-11
and the row pass scoped the same day — ask before widening. The six undecided
surfaces (ADRs 0060–0064 plus the roadmap candidate); `ia.test.tsx`'s last case
asserts none is mounted. The `settings` window label. The overlay is still rule
5, and the two commands that resized it dynamically are gone (ADR 0089). And no
config migration without a backup path: `core::backup` is the pattern.

**Checks:** `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen. Watch the test
TOTAL, not the colour, and run `npm run build` even when the suite is green.
Leg 11 closed at **473 frontend across 39 files, `cargo test` 740, `cargo check`
15 warnings** — all three unchanged from Leg 10. Under load the suite flakes by
about five; `npx vitest run --no-file-parallelism` is the tiebreaker and
`uptime` tells you whether to reach for it. Leg 11 ran at 1.6–2.4 and saw none.

**`npm run port:diff` TAKES GALLERY IDS OR IT MEASURES NOTHING — and a name
that is not one is dropped in silence.** The 25 are the **16 ids in
`src/windows/gallery/registry.tsx` except `ds`**, plus `models#1 agents#1
agents#2 onboarding#1`–`#6`. Read the registry rather than a prose list. Expect
24 of 25 at structural 0 | style 0 with `models` at 6 | 6 (ADR 0088); the 33 in
the text column are the soft category Leg 2a recorded as false positives.
**Check `ss -ltn | grep 9333` before you run it** — the script binds that port
itself, and Leg 11 found a ten-hour-old browser from an abandoned run holding
it, which would have made a fresh run attach to stale code rather than fail.

**Check whether a host and a dev server are already running before you start
one** — `ps -o lstart=` on the pid shows whose is whose, and
`xprop -id <window> _NET_WM_PID` maps a window to its process. `npm run tauri
dev` starts its own Vite, so a `npm run dev` you started yourself collides with
it on 1420 and the host dies. If the owner's session is already up, `port:diff`
needs nothing started: 1420 and 8791 are both already served. Do not kill the
owner's session, and **do not raise its window past somebody working at the
machine — ask**.

**The native host is the only instrument for a drawn state**, and it has found a
defect in five consecutive legs. **But prefer the instrument to the
screenshot**: it reads every row on every surface in one pass, including states
no screenshot can reach.

Three instrument notes.

- The channel out of the webview is a **POST to a loopback collector**.
  `tauri.conf.json` sets `csp: null`, so `fetch` needs no permission and lands
  in a file the shell reads immediately. `append_diag_log` was tried first and
  failed silently into its own `.catch` — never debug through a channel whose
  failure mode is silence.
- `spectacle -a -b -n -o <file>` captures the ACTIVE WINDOW and is the only
  reliable capture. Do not crop a full-desktop `spectacle -f` to an `xdotool`
  geometry: `getwindowgeometry` is not trustworthy even though
  `xdotool getactivewindow` is.
- Synthetic POINTER events do not reach the webview. Synthetic KEYS do — **but
  they must be sent bare**: `xdotool key --window <id>` is silently dropped.
  `ctrl+comma` opens settings and it always opens on `General`; `ctrl+k` opens
  the palette, whose `GO TO` block lists the four workspace views first.

Where the palette cannot reach, a temporary mount effect is still the answer,
and it has an ordering trap: setting the tab and opening a panel in the same
effect does nothing, because the screen's own clear-on-tab-change effect wipes
what you just set. Set the tab, then open the panel in a `setTimeout`. Take the
effect out before the commit and grep for it — Leg 11's lived at
`src/dev/rowAudit.ts` with one hook in `WorkspaceWindow.tsx`. **Fast Refresh
preserves component state, so a changed `useState` default does nothing and a
new hook does** — which is also how you re-run an instrument: add a throwaway
hook and it fires again.

**Never `pkill`.** Not `-f`, which matches the agent shell's own command line
and cost Leg 6 a killed shell, and not `-P $$`, which killed Leg 11's own
subshell. Kill by PID — and stop what you started.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

**The next free ADR number is 0101** — and 0094 through 0100 were claimed by the
core-hardening track while Leg 11's own checks were running, which is how fast
this line rots. Grep the tree, source as well as `docs/`, because a number is
cited in code before its file lands. Do not edit an existing ADR; append-only.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 13 prompt.
