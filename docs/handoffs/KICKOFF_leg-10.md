# Kick-off — Leg 10

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 9. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open — and **the
core-hardening track is working in the same tree**. Run `git log --oneline -5`
before you start, and **stage your own paths when you commit** rather than
`git add -A`.

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 10 prompt is
the section titled *"The prompt for Leg 10"* and it is your actual brief — this
page is only the orientation. Above it, Leg 9's record is your starting state,
and **its findings 2 and 3 will save you an hour** if you go anywhere near the
native host. Then ADR 0089, `CLAUDE.md`, `docs/spec/SPEC.md`, and
`src/screens/props.ts`.

**Leg 9 was the drift pass, and the spec was the worst offender — the one file
every other document defers to.** `docs/spec/SPEC.md` said **"none of it is
wired"** about a port where eight surfaces read and write the runtime, two more
read part of what they draw, and four carry a banner naming their phase. It
described `settings` as a pre-port shell with a 232px sidebar, when that window
has been the workspace since Leg 3. Its "Tauri commands (UI -> Rust), key
surface" list carried four commands no UI calls and two entries that are not
commands at all. All of it under a `Status:` line reading *"last drift check
2026-08-11"*. **The date was current and the content was three legs stale.**
README, ARCHITECTURE, REFERENCE, DESIGN_SYSTEM, VISION, ROADMAP, STATUS and the
plan's §0 were corrected in the same pass.

**AI Models names the title call now** (ADR 0088). ADR 0087 had priced that row
at **structural 18 | style 6** — a number measured on a `LaneJobRow`, which is a
shape ADR 0087's own ruling excludes, because "states rather than sets" means
its `<details>` would open onto an empty body. The honest shape is a flat
`JobNone`, and it costs **6 | 6**: `JobNone` renders `div.job` where
`LaneJobRow` renders `details.job`, so an appended flat row occupies its own
sibling index space and shifts no path at all. Both ends measured this leg.
`port:diff` is **24 of 25 at structural 0 | style 0**, `models` the one
departure.

**And the two caller-less commands turned out to be fourteen** (ADR 0089).
`invoke_handler` against every `invoke(` in `src/` is two greps. Applying Leg 7's
rule flatly — a primitive with no user is not part of the system — would have
deleted a lane ADR 0065 explicitly defers and a capability the product silently
lost. So they are triaged by **why** they lost a caller, which is one command:
`git log -S'"the_name"' -- src/`. Six went, eight are documented and kept.

**This leg is two items and both are decisions before they are code:**

1. **Text-rules import and export, and this is the leg's question.**
   `export_text_rules` and `import_text_rules` are complete in the runtime —
   schema version, conflict resolution, merge, analysis — and have had **no
   caller since Leg 3's shell overwrite deleted the surface that called them**.
   Nothing replaced them: `export_full_backup` writes the whole config, which is
   not a shareable rules document. This is a capability the product had and lost
   without anybody noticing, because `ARCHITECTURE.md` went on asserting the UI
   did it. Three answers are open and each is defensible: draw it on Profiles
   (it is that screen's data, and ADR 0082 already gives you the panel plane);
   fold it into Privacy & Data beside the backup (both are import/export of user
   data); or delete the runtime and record that WordScript does not share rule
   sets. **Ask the owner before deleting** — this is a product decision, not a
   cleanup.
2. **The four session commands SPEC names as contract and nothing calls.**
   `start_native_session`, `stop_native_session`, `native_session_status`,
   `complete_native_session`. The operations are alive — the Rust trigger path
   drives `start_from_native`, `processing_from_native` and the state machine
   directly — so these are command shells. `abort_native_session` is the one of
   the five that has a caller, because the overlay draws an abort. Either the
   spec stops calling them the UI surface, or something starts calling them. Leg
   9 corrected the section describing them and left the commands, because
   removing a contract is not a drift fix.

Five rules you are measured on. **Never render fake readiness (rule 7)**, in
both directions. **A document that asserts a capability is how a regression
hides** — the doc said present, the runtime said compiles, and only the caller
was gone; nothing looks at callers unless somebody greps for them. **A
drift-check date is not evidence of a drift check.** **Strike the item when you
do it** — §2.5's last bullet was discharged by Leg 2 in `db9a6dc` and re-carried
as owed by six consecutive prompts including Leg 9's own, which sent a leg to
fix something already fixed; a list nobody marks off costs more than the drift
it tracks, because a real item and a phantom one look identical. And **measure
the shape you are shipping, not the one you tried** — ADR 0087's eighteen was
honest, belonged to a row its own decision excluded, carried forward one leg as
fact, and was a third off.

Not to be touched: **Context beyond the one drawn gesture** the owner lifted on
2026-08-11, and only for that — it is still going to be done differently and the
owner still has not said how, so ask before widening it. The **six undecided
surfaces** (ADRs 0060–0064 plus one roadmap candidate); `ia.test.tsx`'s last
case asserts none is mounted. The **`settings` window label**, which names the
wrong thing on a window that is the workspace — six Rust call sites and the
window-state persistence key hang on it, so renaming is a runtime change nobody
has asked for; the docs now say what it is and why it stayed. The **overlay** is
still rule 5, and **the two commands that resized it dynamically are gone**
(ADR 0089) — that path is what the ghosting came from, do not bring it back. And
no config migration without a backup path: `core::backup` is the pattern —
snapshot, act, then answer with where the snapshot went.

Checks: `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen. **Watch the test
TOTAL, not the colour**, and **run `npm run build` even when the suite is
green** — Leg 6 shipped a mock signature `vitest run` does not typecheck and
only the build caught it. Leg 9 closed at **470 frontend across 39 files,
`cargo test` 740, `cargo check` 15 warnings**. Under load the suite flakes by
about five; `npx vitest run --no-file-parallelism` is the tiebreaker and
`uptime` tells you whether to reach for it. Leg 9 ran at 2.0–3.2 and saw none.

**`npm run port:diff` TAKES A SCREEN LIST OR IT MEASURES NOTHING.** With no
arguments it prints `ALL EXACT` over an empty set, which reads exactly like a
pass and is the easiest way to ship a departure you never saw. Serve the
prototype (`python3 -m http.server 8791 --directory
docs/prototypes/settings-rework`), run `npm run dev`, and pass every gallery id
except `ds`, plus `models#1 agents#1 agents#2 onboarding#1`–`#6` — 25
measurements. Expect **24 of 25 at structural 0 | style 0** with `models` at
**6 | 6** (ADR 0088). The 33 differences in the `text` column are the soft
category Leg 2a recorded as false positives and no leg counts.

**Check whether a host and a dev server are already running before you start
one** — `ps -o lstart=` on the pid shows whose is whose. Note that
`npm run tauri dev` starts **its own** Vite, so a `npm run dev` you started
yourself will collide with it on 1420 and the host dies with *"beforeDevCommand
terminated with a non-zero status code"*. Do not kill the owner's session, and
**do not raise its window past somebody working at the machine — ask.**

**The native host is the only instrument for a drawn state, and it has found a
defect in three consecutive legs.** Leg 9's was pure rendering: a 228-character
row description against a ≤ 90-character one-line budget, which jsdom reports as
a correct string and WebKitGTK draws as four lines against neighbours that take
one.

**Three instrument notes from Leg 9, and they replace what earlier pages said.**

- **`spectacle -a -b -n -o <file>` captures the ACTIVE WINDOW and is the only
  reliable capture.** Do **not** crop a full-desktop `spectacle -f` to an
  `xdotool` geometry — earlier pages tell you to multiply by 1.6 and that is now
  wrong in practice: `getwindowgeometry` returned three different positions for
  one window inside a single session and none matched where it was drawn, and
  `getdisplaygeometry` reports the primary monitor only while windows sit past
  its right edge. Two such crops landed on the owner's browser instead of the
  app. `xdotool getactivewindow` is trustworthy; its geometry is not.
- **Synthetic POINTER events do not reach the webview. Synthetic KEYS do.** Leg
  6 recorded that clicks are dead; the wheel is dead too — fourteen
  `xdotool click 5` over the content scrolled nothing. `Page_Down` also does
  nothing, because the scroll container never has focus. **`Tab` is the
  scroller:** 34 of them walk focus from the top of AI Models down to the
  Writing group and drag the viewport along with it.
- **The command palette takes `ctrl+k`, arrow keys and `Return`, and ignores
  `xdotool type`** — the search field stays on its placeholder. Navigate it by
  counting rows, and screenshot once to see where the highlight starts, because
  it opens on the surface you are already on rather than at the top.

Where the palette cannot reach, a temporary mount effect is still the answer,
and it has an ordering trap: setting the tab and opening a panel in the same
effect does nothing, because the screen's own clear-on-tab-change effect wipes
what you just set. Set the tab, then open the panel in a `setTimeout`. Take the
effect out before the commit and grep for it. Fast Refresh preserves component
state, so a changed `useState` default does nothing and a new hook does — and it
also **resets the scroll position**, so a hot reload costs you the 34 Tabs again.

If you write a test for something that happens after a config write, **make the
test return the write**: `patch` is a spy that does not feed the config back, so
a precondition that only breaks once a write RETURNS cannot occur in jsdom. That
is what hid two of Leg 7's defects.

**Never `pkill -f`.** The pattern matches the agent shell's own command line,
whatever the pattern is, and it cost Leg 6 a killed shell. Kill by PID — and
**stop what you started**: Leg 9 started a host for one check and shut it down
afterwards, leaving the owner's prototype server on 8791 alone.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

**The next free ADR number is 0090**, and that sentence is the first thing that
goes stale — grep the tree, source as well as `docs/`, because a number is cited
in code before its file lands. Do not edit an existing ADR; append-only.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 11 prompt.
