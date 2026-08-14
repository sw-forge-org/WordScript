# Kick-off — Leg 13b

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 13a. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open, and **four other tracks
are working in the same tree** — core hardening, speech, runtime ownership and
context objects. Run `git log --oneline -5` AND `git status` before you start,
and **stage your own paths when you commit** rather than `git add -A`.

**Read `docs/tracks/gui-port-relay.md` first.** Your actual brief is the section
titled *"The prompt for Leg 13b"*; this page is only orientation. Above it, Leg
13a's record is your starting state and its five findings are what will cost you
if you skip them, along with the 2026-08-15 addendum that spends two of them.
Then ADR 0092, ADR 0104, ADR 0153, ADR 0154, `CLAUDE.md` and `docs/spec/SPEC.md`.

**LEG 13 SPLIT AND YOU ARE THE SECOND HALF.** It was two items. Item 1 — the
caller sweep in both directions over the whole tree — closed as Leg 13a on
2026-08-14 and is struck. **Item 2 is yours and it is the only thing you owe:**
the row classes no instrument has reached. Leg 12's walk covered views, sections,
sub-tabs, `<details>` jobs and the two Add panels; it never opened a row menu, a
`ConfirmPanel`, a `FlagPanel`, an `AnswerPanel`, the export answer or any error
state. `.ws-edit-question`, `.ws-edit-issues p` and `.ws-flag-what p` returned
zero samples because nothing on the walk rendered them. **The panel plane is
where the port designs rather than carries**, so read the drawing before you call
anything a defect.

**THE SEAM IS SWEPT AND IT IS NOT YOUR JOB.** `npm run sweep:commands` checks
both channels — caller with no command, command with no caller, unresolvable call
sites, listener with no emitter, emitter with no listener. Today:
`direction 1: 0 | direction 2: 5 | events 0 | 0`, **all four defect directions at
zero**. The five are the orphans ADR 0089 and ADR 0093 triaged and are dead
weight, not defects. `wordscript-native-insert` was the one event finding and was
removed on 2026-08-15 (ADR 0154). **Re-run the sweep if you add an `invoke` or a
`listen`. Do not rebuild it.**

**A CAPTURE MEASUREMENT IS RUNNING IN ORDINARY USE.** The runtime ownership
track's step 6 waits on one natural `Short` capture, at about 1.5 % of captures,
and it cannot be hurried. Writing anything under `src-tauri/` rebuilds and
restarts the whole app — the process dies, the hotkeys go with it, a dictation in
flight is interrupted, and whatever was accruing is gone. Say whether a host is
running before you touch native, and batch the edits. **Prove you did not disturb
the measurement rather than promising not to:** `wc -l
~/.config/WordScript/logs/wordscript-runtime.log` before and after your checks,
then read what landed. 13a's frontend checks moved it by zero; its native ones
restarted the app on the owner's say-so and produced one cue-stream underrun that
is machine load, not a finding.

**THE BASELINE MOVED AND IT IS NOT LEG 12'S ANY MORE.** The suite is **541
frontend tests across 42 files**, not 474 across 39 — the difference is other
tracks' 2026-08-14 work, not a regression. **`cargo test` is 807 passed / 5
ignored and `cargo check` 15 warnings**, both re-measured on 2026-08-15 — the
three `never used` are the known ones and still nobody's.

**TWO COMMITS ON THIS TRACK HAVE NO LEG BEHIND THEM AND THIS IS THE THIRD LEG
THEY HAVE BEEN ASKED ABOUT.** `b330815` — the sidebar's second width, ADR 0111 —
and the 2026-08-14 `Context.tsx` wiring recorded in `docs/tracks/context-objects.md`.
**Adopt both into your record or file them as their own leg.**

**WHAT LEG 13A FOUND OUT ABOUT INSTRUMENTS, WHICH APPLIES DIRECTLY TO YOURS.**
The sweep reproduced this repository's own failure class three times while it was
being built: it reported the five backup commands as orphans — *the exact five
ADR 0103 recorded as false* — then reported two commands as events nothing emits,
then reported a line number 35 lines off. Every one was pure artefact of the
tool. **An instrument asserted only to run is not tested.** Before you believe a
zero out of yours, make it report something you already know is there — 13a
pointed direction 1 at `git archive 4445423^ src` and watched it name Leg 12's
defect, and made direction 4 fire by deleting one listener from a copy of `src/`.

**The ADR number on the relay has gone stale four legs running.** 0153 is this
track's as of 2026-08-14 and 0154 went to runtime ownership the next day. Grep
the whole tree — source and commit messages included — never a number written on
a page.

**Never `--no-verify`.** Never `pkill`. Do not raise a window past somebody
working at the machine — ask.

When you are done: commit, push to `main`, append your record to the leg log,
write the Leg 14 prompt, and **replace this page** rather than adding a numbered
one beside it.
