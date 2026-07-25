# Hand-Off: Capture Shortcut Lane Rebuild

Status: **Active — branch `worktree-shortcut-lane-rebuild` is NOT merged.**
Date: 2026-07-25

This is an active specification, not an archived record. Do not move it into the
historical set until the branch merges.

## Where you are

You are in the git worktree `.claude/worktrees/shortcut-lane-rebuild` on branch
`worktree-shortcut-lane-rebuild`, seven commits ahead of `master`:

```
HEAD    feat(shortcuts): gate activation modes on a measured capability matrix
dffd35b docs: hand-off for the shortcut lane rebuild
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
(defects D1-D12, target contract T1-T12, slice plan S0-S8). **All slices S0-S8
are implemented and all twelve defects are addressed.** What is left is one
measurement that only a person can take, and the merge decision.

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
   `core::config`; `trigger.rs` delegates to them. This now includes
   `default_activation_mode()`.
10. **The capability matrix is measured, not tabulated** (ADR
    [0007](../decisions/0007-capability-matrix-is-measured-not-assumed.md)).
    `capability_matrix` is a pure function of the session facts plus the
    `ReleaseEvidence` the trigger lane counted. Do not add a per-OS verdict on
    hold to talk that is not backed by a measurement recorded in the known-issues
    file. A session type may contribute a caveat sentence naming a plausible
    cause; it must not set the state on its own.
11. **A mode the session cannot honor is named, never swapped.** If the stored
    `activation_mode` becomes `unavailable`, it stays selected and the row
    explains why. Auto-correcting it is the same failure class as an empty
    shortcut reverting to a default (T7).

## Open work, in priority order

### A. Physical S0 measurement — the only open work item

This is the one thing a person must do. It no longer *blocks* anything: B and C
were built so they do not depend on it (the matrix follows measured evidence per
session instead of a per-OS claim). What the measurement buys is the ability to
state something about the **platform** rather than about the current session.

The procedure is written out ready to execute, with empty tables, the probe to
use, and what each possible outcome should change, in the
[run 2 section of the record](../known-issues/capture-shortcut-recording.md).
Do not re-derive it; walk the user through that section and fill in the tables.

Two points worth repeating here because they are easy to get wrong:

- **Use the mode-select shortcut as the probe, not the capture trigger.** A lost
  release on the capture trigger starts a real recording; on mode select it costs
  nothing.
- **XTEST is exhausted.** Run 1 used `xdotool` and found nondeterministic release
  delivery, which establishes that the stranded-hold state is reachable but says
  nothing about hardware keys, and XTEST structurally cannot deliver to a
  Wayland-focused client. Do not try to automate this half.

### B. S6 — activation modes — DONE

Hold to talk keeps the watchdog (`hold_watchdog_seconds`, default 120, reason
`native_hold_watchdog`) and the deferred stop below `hold_min_ms`, so a short tap
in hold mode has defined behavior. All four timing constants (`hold_min_ms`,
`debounce_ms`, `hold_watchdog_seconds`, `double_tap_window_ms`) are reported in
`native_trigger_status` and stated in the Settings row. Double-tap activation
(`f056bd5`) is implemented, verified live, and is now the default (ADR 0008).
The selector is gated on the capability matrix from C.

### C. S7 — per-OS capability matrix — DONE

`core::shortcut::capability_matrix` derives a `CapabilityState` plus a
user-facing reason per activation mode and per key class, from
`shortcut_platform`'s session facts (now carrying a `SessionKind`) plus the
`ReleaseEvidence` measured from the trigger lane's counters. Exposed as
`shortcut_capabilities` (registered in `lib.rs`, implemented in `trigger.rs`
because it needs the trigger state). The UI disables activation options the
session cannot honor and renders the reason; the key-class rows that carry a
consequence are shown above the shortcut list. Asserted across all five session
kinds and all three evidence states.

**Read ADR
[0007](../decisions/0007-capability-matrix-is-measured-not-assumed.md) before
touching this.** The matrix deliberately contains no per-OS verdict on hold to
talk, because none has been measured — see invariant 10.

### D. Product decisions — SETTLED

- **`double_tap` is the default `activation_mode`.** Decided yes by the user on
  2026-07-25, recorded as ADR
  [0008](../decisions/0008-double-tap-is-the-default-activation-mode.md).
  Default only: `AppConfig` is `#[serde(default)]`, so an existing config keeps
  its value and no migration touches the field.
- **`Ctrl+S` and `Ctrl+1`-`Ctrl+6` stay the global grab defaults.** Reaffirmed by
  the user on 2026-07-25 after the concern was stated a second time: as global
  grabs these take Save and tab switching away from every application on first
  launch, and comparable tools avoid it entirely (Wispr Flow double-taps right
  Shift, macOS Dictation double-taps Fn, Windows Voice Typing uses the
  vendor-reserved `Win+H`). The middle ground would be an extra modifier
  (`Ctrl+Alt+S`, `Ctrl+Alt+1`…), one line per default in `core::config`.
  **Do not change this unilaterally** — it is the user's call, they have now been
  asked twice, and they kept it both times. Do not re-open it.

### E. Merge and cleanup

The branch stays unmerged, reaffirmed by the user on 2026-07-25: their everyday
build runs from the main checkout, and merging puts the rebuilt lane into daily
use before the physical verification is done. **Do not merge without asking.**
When they decide to, it is a fast-forward (`master` is 0 commits behind).
Afterwards this file moves to the archived set per [README.md](README.md), and
the worktree plus branch can be removed.

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
npm test                       # 97 tests
npm run build
cd src-tauri && cargo test     # 349 tests
```

Native host checks cannot be done in a browser preview — grabs and key delivery
need the real host. The manual checklist is in the known-issues record.

## File map

| Area | Path |
| --- | --- |
| Shortcut contract and capability matrix (single owner) | `src-tauri/src/core/shortcut.rs` |
| Trigger state machine, logging, grab lifecycle | `src-tauri/src/core/trigger.rs` |
| Config, defaults, migration, collision validation | `src-tauri/src/core/config.rs` |
| Trigger effects, window restore | `src-tauri/src/lib.rs` |
| Runtime transport, chord bookkeeping (no key table) | `src/lib/shortcuts.ts` |
| Recorder | `src/components/settings/HotkeyRecorder.tsx` |
| Shared shortcut row (Capture + Modes) | `src/components/settings/ShortcutField.tsx` |
| Test double for the runtime contract | `src/test/shortcutRuntime.ts` |
| Problem record and measurements | `docs/known-issues/capture-shortcut-recording.md` |
| Activation-mode selector and capability gating | `src/components/settings/InputTab.tsx` |
| Contract ownership decision | `docs/decisions/0006-rust-owns-the-shortcut-contract.md` |
| Capability matrix decision | `docs/decisions/0007-capability-matrix-is-measured-not-assumed.md` |
| Default activation mode decision | `docs/decisions/0008-double-tap-is-the-default-activation-mode.md` |
| Token vocabulary, defaults, activation modes, gating | `docs/REFERENCE.md` |
| Linux shortcut reality and the rendered matrix | `docs/PLATFORMS.md` |
