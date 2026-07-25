# Hand-Off: Capture Shortcut Lane Rebuild

Status: **Active — branch `worktree-shortcut-lane-rebuild` is NOT merged.**
Date: 2026-07-25

This is an active specification, not an archived record. Do not move it into the
historical set until the branch merges.

## Where you are

You are in the git worktree `.claude/worktrees/shortcut-lane-rebuild` on branch
`worktree-shortcut-lane-rebuild`, five commits ahead of `master`:

```
f056bd5 feat(trigger): add double-tap activation
3cbc5d7 fix(overlay): confirm a per-mode hotkey on screen
9bca19d fix(shortcuts): re-register mode hotkeys on change; new default rotation
b63f0bb docs: record the first S0 shortcut measurement
7cf439f fix(shortcuts): rebuild the capture shortcut lane (S0-S5)
```

A `npm run tauri dev` build from this worktree is running in the user's own
terminal. It shares `~/.config/WordScript/config.json` with the user's everyday
instance, so **any config write you cause is a write to their real settings.**
A pre-rebuild backup is not in the repo; if you need one, make it before you
touch anything.

Do not start a second instance. Global grabs are exclusive — a second process
cannot register the same shortcuts, and the failures will look like bugs.

## What this branch delivers

The problem record is
[known-issues/capture-shortcut-recording.md](../known-issues/capture-shortcut-recording.md)
(defects D1-D12, target contract T1-T12, slice plan S0-S8). Slices **S0-S5 and
the S8 documentation are implemented**. D1-D10 and D12 are addressed; D11 is
partially addressed and is the main open thread.

Two further defects were found and fixed while verifying against the live lane,
neither of them in the original record:

- **Mode hotkeys were never re-registered.** `configure_native_trigger`
  preserved them from in-memory state, so a value changed in Settings was
  written to disk while the OS grab kept firing on the value from the last
  startup. Symptom: "mode select does nothing, no matter what I assign."
- **A per-mode hotkey confirmed nothing on screen.** The direct jump set the
  mode correctly but never revealed the overlay, so `Ctrl+1`-`Ctrl+6` read as
  dead while the mode had in fact changed.

Both are worth remembering as a *class*: in this lane the runtime is frequently
correct and the failure is that nothing is visible. Read the `[trigger]` log
before assuming the state machine is wrong.

## Invariants — do not break these

These are the point of the rebuild. Breaking one silently re-opens a defect.

1. **Rust owns the shortcut contract** (ADR
   [0006](../decisions/0006-rust-owns-the-shortcut-contract.md)).
   `src-tauri/src/core/shortcut.rs` is the single owner of the token vocabulary,
   canonical form, display strings and validity rules. **The UI carries no key
   table and re-derives no rule.** If the UI needs to know something about a
   shortcut — is it modifier-only, is it valid, how does it render — expose it
   on `ShortcutValidation` and ask the runtime. A regex over a shortcut string
   in TypeScript is a contract break.
2. **Empty means disabled**, for capture and mode shortcuts alike. Never fall
   back to a platform default for a value the user set.
3. **A single bare modifier is never registered.** Modifier-only requires two or
   more modifiers, so no grab can ever be created with no modifier at all.
4. **Normalize first, validate collisions second.** Never the other way round.
5. **Legacy rewrites are version gated** on `shortcut_schema_version`. A
   migration that runs on every save rewrites values the user just chose.
6. **A value that cannot be parsed is stored unchanged** and surfaced as "not
   registerable". Never rewrite it into something that merely looks valid.
7. **Recording really releases the OS grabs** (`pause_native_trigger` /
   `resume_native_trigger`), and the settings window restores them on close. A
   soft `paused` flag is not sufficient — a grabbed combination is delivered to
   the grab owner, not to the focused window.
8. **Trigger observability is permanent infrastructure**, not a debug patch.
   Every received event, decision, registration outcome and stranded hold is
   logged under `[trigger]`. Keep new branches logged.
9. **One default rotation for all platforms.** Per-OS branching is what let the
   legacy migration corrupt the Windows default. The defaults live in
   `core::config`; `trigger.rs` delegates to them.

## Open work, in priority order

### A. Physical S0 measurement — blocks B and C

This is the only thing a person must do, and everything else about activation
modes depends on it. The record's
[S0 measurement section](../known-issues/capture-shortcut-recording.md) has the
run-1 results, taken with XTEST-injected keys, and states their limit: XTEST is
not physical input, so a negative result there proves nothing about hardware.

What run 1 established: registration works, all ten bindings register, presses
arrive through the XWayland grab, and the migration preserves bare `F1`/`F4`.
What it could not settle: whether a **held** shortcut reliably delivers its
release. Under XTEST the counts were erratic — extra press/release pairs in some
runs, a lost release entirely in others, not scaling with hold duration.

Ask the user to run, with `tail -f ~/.config/WordScript/logs/wordscript-runtime.log | grep trigger`:

1. Hold the configured trigger physically for 1 s, 3 s and 6 s. Count
   `state=pressed` versus `state=released` per run. Fill in the table next to
   the XTEST one.
2. Press it once with an **XWayland** application focused, then once with a
   **native Wayland** application focused. Report whether both press and release
   appear in each case. XTEST cannot reach a Wayland-focused client, which is
   exactly why this half needs a human.

Record the answers in the known-issues file before designing B or C.

### B. S6 — activation modes

Currently: hold to talk stays selectable, a hold exceeding
`hold_watchdog_seconds` (default 120) is ended explicitly with reason
`native_hold_watchdog`, and the selector states whether a key release has been
observed for the configured shortcut in this session. Real per-platform
capability gating waits for A.

Double-tap activation (`f056bd5`) is implemented and verified live: two taps
within `double_tap_window_ms` (default 400, clamped 150-1000) toggle; a single
tap does nothing. The gate covers start/stop, pause and abort, each with its own
window; mode hotkeys stay single-press.

### C. S7 — per-OS capability matrix

Not started. `shortcut_platform` already reports the session facts (compositor,
session type, XWayland versus native Wayland, keys the desktop swallows), which
is the input the matrix needs. The matrix should drive which options the UI
offers, and be asserted in tests for every branch that differs per platform.

### D. Two product decisions the user has not settled

- **Should `double_tap` become the default `activation_mode`?** It fits the
  modifier-only defaults better than `tap` does: in tap mode a modifier-only
  trigger acts on every single press, which is what takes the combination away
  from other applications. Raised, not decided.
- **`Ctrl+S` and `Ctrl+1`-`Ctrl+6` as global grabs.** These are the user's own
  rotation and were made the defaults on their explicit instruction, for all
  three platforms. The concern was stated and they proceeded: as global grabs
  these take Save and tab switching away from every application on first launch.
  Comparable tools avoid this entirely — Wispr Flow double-taps right Shift,
  macOS Dictation double-taps Fn, Windows Voice Typing uses the vendor-reserved
  `Win+H`; none grab letter or digit combinations. The obvious middle ground is
  an extra modifier (`Ctrl+Alt+S`, `Ctrl+Alt+1`…), one line per default in
  `core::config`. **Do not change this unilaterally** — it is the user's call and
  they have already been asked once.

### E. Merge and cleanup

The branch is unmerged by design: the user's everyday build runs from the main
checkout, and merging puts the rebuilt lane into daily use before the physical
verification is done. When they decide to merge it is a fast-forward
(`master` is 0 commits behind). Afterwards this file moves to the archived set
per [README.md](README.md), and the worktree plus branch can be removed.

## Traps found the hard way

- **The runtime is often right and invisible.** Both bugs found during
  verification were "the effect happened, nothing was shown". Check the
  `[trigger]` log before touching the state machine.
- **`configure_native_trigger` does not carry mode hotkeys in its request.** It
  reads them from the persisted config, which the frontend has already written
  by the time it calls. If you add a field there, keep that ordering in mind.
- **Enter confirms in the recorder only when no modifier is held** — with a
  modifier down it is a chord member, which is what makes `Ctrl+Alt+Escape`
  recordable. The check-mark button is the way to confirm while still holding.
- **`workspace_context` has a flaky test pair.**
  `resolve_project_root_reads_env_var` and
  `resolve_project_root_falls_back_to_cwd_for_invalid_env` both mutate the
  process-global `WORDSCRIPT_PROJECT_ROOT` and run in parallel, so either can
  lose. Unrelated to this lane; the fix is to serialize them. If you see it
  fail, re-run before investigating.
- **`docs/donors/` was deliberately left empty for this work.** The comparable
  tools are closed source and the logic is small; nothing was downloaded. A
  donor would only be worth it for the GlobalShortcuts portal path.

## Verification

```
npm test                       # 94 tests
npm run build
cd src-tauri && cargo test     # 339 tests
```

Native host checks cannot be done in a browser preview — grabs and key delivery
need the real host. The manual checklist is in the known-issues record.

## File map

| Area | Path |
| --- | --- |
| Shortcut contract (single owner) | `src-tauri/src/core/shortcut.rs` |
| Trigger state machine, logging, grab lifecycle | `src-tauri/src/core/trigger.rs` |
| Config, defaults, migration, collision validation | `src-tauri/src/core/config.rs` |
| Trigger effects, window restore | `src-tauri/src/lib.rs` |
| Runtime transport, chord bookkeeping (no key table) | `src/lib/shortcuts.ts` |
| Recorder | `src/components/settings/HotkeyRecorder.tsx` |
| Shared shortcut row (Capture + Modes) | `src/components/settings/ShortcutField.tsx` |
| Test double for the runtime contract | `src/test/shortcutRuntime.ts` |
| Problem record and measurements | `docs/known-issues/capture-shortcut-recording.md` |
| Contract ownership decision | `docs/decisions/0006-rust-owns-the-shortcut-contract.md` |
| Token vocabulary, defaults, activation modes | `docs/REFERENCE.md` |
| Linux shortcut reality | `docs/PLATFORMS.md` |
