# Kick-off — Leg 14

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 13b. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open, and **four other tracks
are working in the same tree** — core hardening, speech, runtime ownership and
context objects. Run `git log --oneline -5` AND `git status` before you start,
and **stage your own paths when you commit** rather than `git add -A`.

**Read `docs/tracks/gui-port-relay.md` first.** Your actual brief is the section
titled *"The prompt for Leg 14"*; this page is only orientation. Above it, Leg
13b's record is your starting state and its six findings are what will cost you
if you skip them. Then ADR 0092, ADR 0104, ADR 0156, `CLAUDE.md` and
`docs/spec/SPEC.md`.

**LEG 13 IS CLOSED, BOTH HALVES, AND YOUR LEG HAS A CHOICE IN IT.** 13a swept
both channels of the seam; 13b opened the panel plane — the last row class no
instrument had reached — measured it at 55 samples, and fixed the one defect it
found. Leg 14 picks **one** of three open items and says why in its record:
the two classes still unmeasured (`.ws-edit-issues p`, `.ws-flag-what p`, both
needing runtime state the owner's profile does not have), `Context.tsx`'s
never-measured row menu, or the copy budget this plane's 241 px column now
demands. The relay states the trade-off for each.

**THE PANEL PLANE HAS A NUMBER NOW AND IT IS THE NARROWEST ON THE SURFACE.**
241–292 px of text column at an 800 px window; 179 px per column at 992 px,
where the container query goes two-column and each column is narrower than the
single one was. ADR 0092's 436 px is a stacked row, not this. Quote the viewport
with every budget — `window.innerWidth` and `devicePixelRatio`, never
`tauri.conf.json`, which is in device pixels at a 1.25 scale.

**A CAPTURE MEASUREMENT IS RUNNING IN ORDINARY USE.** Runtime ownership's step 6
waits on one natural `Short` capture at about 1.5 % of captures, and
`scripts/read-capture-event.sh` still reports `0 readable`. Writing anything
under `src-tauri/` rebuilds and restarts the whole app — the process dies, the
hotkeys go with it, and a dictation in flight is interrupted. Say whether a host
is running before you touch native, and batch the edits. **Prove you did not
disturb the measurement rather than promising not to:** `wc -l
~/.config/WordScript/logs/wordscript-runtime.log` before and after your checks.
13b's checks moved it by zero; its HMR reloads moved it by 47 trigger
re-registrations and no capture ran.

**THE OWNER IS AT THE MACHINE AND RESIZED THE WINDOW MID-MEASUREMENT.** 800 →
992 CSS px between two runs, which took one finding from four lines to one. Do
not resize it back and do not raise it — price a narrow state by cloning the
node into a box of that width, which is ADR 0092's own technique.

**BOTH INSTRUMENTS OF THE LAST TWO LEGS MANUFACTURED FINDINGS BEFORE THEY
MEASURED ANY.** 13a's sweep produced three false ones; 13b's counted padding as
a line and reported a one-line foot as two, then read a cached module and
reported run 2's code as a fresh result. **Calibrate against something you
already know is there** before you believe a zero — 13b used a 3-character
string that must draw one line and a 411-character string that must draw ten.

**THE BASELINE:** `npm test` is **542 across 42 files**. **The Rust baseline is
stale** — 807 passed / 5 ignored and 15 warnings were measured on 2026-08-15,
and `be74233` landed Rust after that. Re-measure before quoting it.

**A THREE-DAY-OLD `port:diff` BROWSER WAS HOLDING 9333** on 2026-08-15 and was
left alone because this leg had no gallery screen to diff. `ss -ltnp | grep
9333` before your first batch, and kill the root PID.

**ADR NUMBERS: 0156 is this track's as of 2026-08-15 and it is the highest in
the tree.** 0155 went to runtime ownership the same day. Grep the whole tree —
source and commit messages included — never a number written on a page.

**Never `--no-verify`.** Never `pkill`. Do not raise a window past somebody
working at the machine — ask.

When you are done: commit, push to `main`, append your record to the leg log,
write the Leg 15 prompt, and **replace this page** rather than adding a numbered
one beside it.
