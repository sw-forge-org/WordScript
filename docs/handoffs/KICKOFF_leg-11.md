# Kick-off — Leg 11

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 10. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open — and **the
core-hardening track is working in the same tree**. Run `git log --oneline -5`
before you start, and **stage your own paths when you commit** rather than
`git add -A`.

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 11 prompt is
the section titled *"The prompt for Leg 11"* and it is your actual brief — this
page is only the orientation. Above it, Leg 10's record is your starting state,
and **its findings 1 and 2 are the two that will cost you if you skip them**.
Then ADR 0090, ADR 0091, `CLAUDE.md` and `docs/spec/SPEC.md`.

**Leg 10 closed both of the items Leg 9 had opened, in opposite directions.**
Text-rules import and export got a surface (ADR 0090); the four session commands
were deleted (ADR 0091). Neither had a caller. What separated them was *why*,
which is the question ADR 0089 exists to ask, and in both cases the answer was
somewhere other than the code.

**The leg's question had been answered in the prototype years before it was
asked.** Where the rules export goes was framed as three open placements. The
prototype's own Profiles comment reads *"Duplicate and Export are things you do
to a profile rarely and from the list … they are on the row's own menu."* Leg 7
built that menu with three verbs; `Profiles.tsx`'s docblock went on naming four.
**A comment asserting a control is indistinguishable from the control** — the
same defect as `ARCHITECTURE.md`'s six-leg claim, one layer down.

**The owner's rejection of the obvious fix is what produced the design.** Asked
to confirm export and import together on the row menu, they said an Import there
makes no sense — *what am I supposed to do with it then*. **Export acts on a
thing; import creates one.** So export is the fourth verb on the row menu and
writes the row it opened on, and import is on Privacy & Data, where it lands as
a **new** profile and replaces nothing — no target to choose, and no snapshot,
because nothing is replaced.

**The owner also refused a deletion on a grep**, and that is what turned up ADR
0091. The four session commands are the **Python sidecar's IPC command set**:
`wordscript/ipc.py` documents the Tauri → Python channel as `start_recording` /
`stop_recording` / `abort_recording`, and `febc452` carried it across as Tauri
commands in the same commit that moved trigger, capture and pipeline into the
Rust process. They read as a designed contract for six legs, and the fact that
separated them from one was in a deleted Python file's docstring.

This leg is one item and a sweep, and the item is a pass rather than a fix:

1. **The width defect on `General`, and every row like it.** `Input device`
   pairs a `Select` with a `Rescan` button and a runtime-conditional hint that
   draws at **six lines** in WebKitGTK. Leg 10 found it in its own screenshots
   while fixing the same defect one screen over and left it, because `General`
   was not its scope. The value is not that row — it is **every `Row` whose
   control is more than one button**. Conditional copy is the part a
   default-state check never sees, so enumerate the states rather than opening
   the screen once.
2. **The `src-tauri/` drift sweep, with the blind spot Leg 10 found.**
   `invoke_handler` against every `invoke(` in `src/` is the check ADR 0089 put
   in every leg that touches the runtime. Extend it: `StartNativeSessionRequest`
   and `CompleteNativeSessionRequest` outlived the commands that deserialized
   them with **no warning at all**, because a `pub` Rust item with no user
   compiles silently.

**The rule you are most likely to break.** A row's one-line copy budget is a
function of the control's width, and nothing in the toolchain knows that. Leg
10's rows shipped at **79 and 71 characters** — both inside the ≤ 90 budget every
other row is written to — and drew **three lines and two** against neighbours
that drew one, because `.ws-row-ctl` is `flex: none` and a `Select` plus a
button leaves the text column about thirty characters where one button leaves
fifty. jsdom reports the string and cannot report the wrap. The explanation
belongs on the section header; a row gets at most one line.

**Also: ask why a thing is there before asking whether anything calls it.** `git
log -S` over the commit that introduced a primitive answers *why*, and *why* is
the only question that separates a deferred lane from a corpse.

**Strike the item when you do it.** Leg 9 struck a bullet six briefs had
re-carried; Leg 10 struck both entries Leg 9 added. Keep it that way.

**Not to be touched:** Context beyond the one drawn gesture lifted on
2026-08-11 — ask before widening it. The six undecided surfaces (ADRs 0060–0064
plus the roadmap candidate); `ia.test.tsx`'s last case asserts none is mounted.
The `settings` window label. The overlay is still rule 5, and the two commands
that resized it dynamically are gone (ADR 0089) — do not bring that path back.
And no config migration without a backup path: `core::backup` is the pattern.
ADR 0090's rules import is not an exception — it appends and replaces nothing,
which is why it snapshots nothing, and it says so on the row.

**Checks:** `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen. Watch the test
TOTAL, not the colour, and run `npm run build` even when the suite is green.
Leg 10 closed at **473 frontend across 39 files, `cargo test` 740, `cargo check`
15 warnings**. Under load the suite flakes by about five;
`npx vitest run --no-file-parallelism` is the tiebreaker and `uptime` tells you
whether to reach for it. Leg 10 ran at 1.3–1.4 and saw none.

**`npm run port:diff` TAKES GALLERY IDS OR IT MEASURES NOTHING — and a name
that is not one is dropped in silence.** Leg 9 recorded that no arguments prints
`ALL EXACT` over an empty set. Leg 10 found the sharper version: passing the
*retired* screen names (`profiles`, `privacy`, `history`, `general`, `hotkeys`,
`delivery`, `diagnostics`, `about`, `notes`) produces no measurement and no
error, so a run can look full and be short. **The 25 are the 16 ids in
`src/windows/gallery/registry.tsx` except `ds`**, plus `models#1 agents#1
agents#2 onboarding#1`–`#6`. Read the registry rather than a prose list — the
prose goes stale every time a screen is wired and leaves the gallery. Expect 24
of 25 at structural 0 | style 0 with `models` at 6 | 6 (ADR 0088); the 33 in the
text column are the soft category Leg 2a recorded as false positives.

**Check whether a host and a dev server are already running before you start
one** — `ps -o lstart=` on the pid shows whose is whose. `npm run tauri dev`
starts its own Vite, so a `npm run dev` you started yourself collides with it on
1420 and the host dies with *"beforeDevCommand terminated with a non-zero status
code"*. If the owner's session is already up, `port:diff` needs nothing started
at all: 1420 and 8791 are both already served. Do not kill the owner's session,
and **do not raise its window past somebody working at the machine — ask**.

**The native host is the only instrument for a drawn state**, and it has found a
defect in four consecutive legs. Leg 10's was a string inside the copy budget
and a budget that was not a constant.

Three instrument notes, and they extend Leg 9's rather than replacing them.

- `spectacle -a -b -n -o <file>` captures the ACTIVE WINDOW and is the only
  reliable capture. Do not crop a full-desktop `spectacle -f` to an `xdotool`
  geometry: `getwindowgeometry` returned three different positions for one
  window in a single session and none matched where it was drawn.
  `xdotool getactivewindow` is trustworthy; its geometry is not.
- Synthetic POINTER events do not reach the webview (clicks and the wheel both).
  Synthetic KEYS do — **but they must be sent bare**. `xdotool key --window <id>
  Escape` was silently dropped; `xdotool windowactivate <id>` followed by
  `xdotool key Escape` works. That cost Leg 10 a round trip.
- The command palette takes `ctrl+k`, arrow keys and `Return`, and ignores
  `xdotool type`. Its `GO TO` block lists the four workspace views first, so
  `ctrl+k`, two `Down`s and `Return` is Profiles from Home — much cheaper than
  Leg 9's 34 Tabs. `Tab` is still the only way to reach a control, and it drags
  the viewport along: the profile row menu is at Tab 16 from the view's first
  focusable, opened with `Return` on the `More` button.

Where the palette cannot reach, a temporary mount effect is still the answer,
and it has an ordering trap: setting the tab and opening a panel in the same
effect does nothing, because the screen's own clear-on-tab-change effect wipes
what you just set. Set the tab, then open the panel in a `setTimeout`. Take the
effect out before the commit and grep for it. Fast Refresh preserves component
state, so a changed `useState` default does nothing and a new hook does — and it
resets the scroll position.

If you write a test for something that happens after a config write, make the
test return the write: `patch` is a spy that does not feed the config back, so a
precondition that only breaks once a write RETURNS cannot occur in jsdom.

**Never `pkill -f`.** The pattern matches the agent shell's own command line and
cost Leg 6 a killed shell. Kill by PID — and stop what you started.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

**The next free ADR number is 0092**, and that sentence is the first thing that
goes stale — grep the tree, source as well as `docs/`, because a number is cited
in code before its file lands. Do not edit an existing ADR; append-only.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 12 prompt.
