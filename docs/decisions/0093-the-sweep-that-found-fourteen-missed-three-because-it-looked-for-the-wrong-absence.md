# 0093: The sweep that found fourteen missed three, because it looked for the wrong absence

Date: 2026-08-11
Status: Accepted

## Context

ADR 0089 made the caller sweep — the `invoke_handler` list against every
`invoke(` in `src/` — a standing check in every leg that touches the runtime. It
found fourteen registered commands with no frontend caller and triaged them into
four classes. Leg 10 found the sweep had a blind spot underneath it:
`StartNativeSessionRequest` and `CompleteNativeSessionRequest` outlived the
commands that deserialized them with **no warning at all**, because a `pub` Rust
item with no user compiles silently.

Leg 11 ran the sweep with that extension and found something one level up: the
sweep's own list was short. **Three registered commands have no caller and were
not among the fourteen.**

- `read_diag_log`
- `clear_diag_log`
- `overlay_open_devtools`

All three lost their caller in **`8f9077e`** — Leg 3's shell overwrite, the same
commit that orphaned `export_text_rules` and `import_text_rules` by deleting
`PromptsTab.tsx`. Their caller was `src/components/settings/OverlayDiagPanel.tsx`,
deleted in the same 109 lines. `git log --all -S` puts all three in exactly two
commits: `37768b3`, which introduced them as the overlay's dev-only diagnose
infrastructure, and `8f9077e`, which removed the surface that used them.

**Why the sweep missed them.** They still appear in `src/` — as `case` arms in
`OverlayWindow.test.tsx`'s invoke mock, which the panel's tests needed and which
nothing removed when the panel went. A grep for the command name finds them; a
grep for `invoke(` does not, and the two greps had not been distinguished
because until now no orphan had a mock outliving its caller.

**The writer survived.** `append_diag_log` has a live caller — `OverlayWindow.tsx`
still writes every `[ov-sched]` and `[ov-render]` line to
`/tmp/kilo/overlay-diag.log` in dev builds — so WordScript writes a diagnostic
log that **no surface in the product can read**. Its comment went on saying *"The
Settings-Window Diagnose-Panel polls that file for live display"* for eight
legs, and `overlay_open_devtools`'s Rust docblock went on saying *"the frontend
only calls it under `import.meta.env.DEV` anyway"*. Both are the defect ADR 0090
named one layer down: **a comment asserting a control is indistinguishable from
the control.**

## Decision

**The three are recorded, not deleted, and the two comments that assert a
deleted surface are corrected in this commit.**

ADR 0089's question is *why did it lose its caller*, and the answer here is the
same for all three — a surface was deleted and nothing replaced it — but the
**substitutes differ**, and that is what a disposition has to turn on:

- `read_diag_log` and `clear_diag_log` serve a file at a fixed path in dev
  builds. A developer has `tail` and `rm`. The doors are convenient, not load-
  bearing.
- `overlay_open_devtools` has **no substitute at all**. A webview's inspector
  cannot be opened from outside the process; there is no shell equivalent to
  fall back to. Deleting it removes a capability rather than a convenience.

That asymmetry is a product decision of the same shape as ADR 0090's and ADR
0091's, and the owner has taken it as one: the finding lands, the disposition
waits. Nothing is deleted on a grep.

## Consequences

- **The sweep gets a third question.** It is not enough to ask which registered
  commands have no `invoke(`; a command whose name still appears in a **test
  mock** looks called to a name-grep and uncalled to a call-grep, and only the
  second is true. The check is `invoke_handler` against `invoke(` in
  non-test `src/`, and then the surviving names against the whole tree to see
  what is still asserting them.
- **A log with a writer and no reader is a drift shape of its own.** Neither
  half warns: the writer compiles because it has a caller, the readers compile
  because a registered command needs none, and the file fills up correctly the
  whole time.
- **`/tmp/kilo/overlay-diag.log` is read with `tail -f` until this is decided**,
  and `OverlayWindow.tsx` now says so where it used to name the panel.
- Leg 10's extension holds and found nothing further this leg: no `pub` type in
  `src-tauri/` is reachable only through a command that no longer exists. The
  marker Leg 10 left at `core/sessions.rs` is the pattern.
