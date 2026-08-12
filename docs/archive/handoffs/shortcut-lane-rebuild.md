# Hand-Off: Capture Shortcut Lane Rebuild

Status: **Merged into `master` on 2026-07-25.** Historical record.
Date: 2026-07-25

The branch `worktree-shortcut-lane-rebuild` was fast-forwarded into `master` and
removed. This file is kept for the reasoning behind the rebuild — the invariants,
the decisions and what was deliberately left open.

**The open work did not move here with it.** It lives where an active reader will
find it:

| Open item | Where it lives now |
| --- | --- |
| Hold to talk does not work (D11, open again) | [known-issues/capture-shortcut-recording.md](../../known-issues/capture-shortcut-recording.md) |
| The physical S0 measurement (run 2) | same record, with empty tables and the procedure |
| Windows and macOS have never run this lane | [known-issues/cross-platform-shortcut-verification.md](../../known-issues/cross-platform-shortcut-verification.md) |
| Single modifier is Linux-only; right Shift inexpressible | ADR [0009](../../decisions/0009-modifier-only-shortcuts-are-observed-not-grabbed.md) and the same record |
| Product state and gaps | [STATUS.md](../../STATUS.md) |

## Where this came from

Thirteen commits in the worktree `.claude/worktrees/shortcut-lane-rebuild`,
fast-forwarded into `master`. Newest first:

```
docs: record hold to talk as open again after the first live result
feat(shortcuts): allow a single modifier where an interrupted hold is reported
feat(shortcuts): observe modifier-only shortcuts instead of grabbing them
fix(shortcuts): state the real reason a bare modifier is rejected
docs: keep the hand-off commit list stable across amends
docs: record the untested Windows and macOS shortcut paths
feat(shortcuts): gate activation modes on a measured capability matrix
docs: hand-off for the shortcut lane rebuild
feat(trigger): add double-tap activation
fix(overlay): confirm a per-mode hotkey on screen
fix(shortcuts): re-register mode hotkeys on change; new default rotation
docs: record the first S0 shortcut measurement
fix(shortcuts): rebuild the capture shortcut lane (S0-S5)
```

## What this branch delivers

The problem record is
[known-issues/capture-shortcut-recording.md](../../known-issues/capture-shortcut-recording.md)
(defects D1-D12, target contract T1-T12, slice plan S0-S8). **All slices S0-S8
are implemented.** Eleven of the twelve defects are addressed; D11, hold to talk,
is open again — a live session shows the mode still doing nothing while double tap
on the same trigger works.

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
   [0006](../../decisions/0006-rust-owns-the-shortcut-contract.md)).
   `src-tauri/src/core/shortcut.rs` is the single owner of the token vocabulary,
   canonical form, display strings and validity rules. **The UI carries no key
   table and re-derives no rule.** If the UI needs to know something about a
   shortcut — is it modifier-only, is it valid, how does it render — expose it
   on `ShortcutValidation` and ask the runtime. A regex over a shortcut string
   in TypeScript is a contract break.
2. **Empty means disabled**, for capture and mode shortcuts alike. Never fall
   back to a platform default for a value the user set.
3. **A single bare modifier depends on the session, not on taste** (ADR
   [0009](../../decisions/0009-modifier-only-shortcuts-are-observed-not-grabbed.md)).
   Modifier-only shortcuts are *observed*, not grabbed, so a lone modifier no
   longer creates a desktop-wide grab. It is allowed exactly where the session
   reports an interrupted hold — `Policy::interruption_signal`, from
   `session_has_interruption_signal`. Do not hard-code the minimum back to two, and
   do not offer a single modifier where interruption is not reported: it would fire
   on ordinary typing.
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
    [0007](../../decisions/0007-capability-matrix-is-measured-not-assumed.md)).
    `capability_matrix` is a pure function of the session facts plus the
    `ReleaseEvidence` the trigger lane counted. Do not add a per-OS verdict on
    hold to talk that is not backed by a measurement recorded in the known-issues
    file. A session type may contribute a caveat sentence naming a plausible
    cause; it must not set the state on its own.
11. **A mode the session cannot honor is named, never swapped.** If the stored
    `activation_mode` becomes `unavailable`, it stays selected and the row
    explains why. Auto-correcting it is the same failure class as an empty
    shortcut reverting to a default (T7).

## What was open at merge time

Kept as written at the moment of the merge. Current status lives in the records
linked above; if this section and a known-issues record disagree, the record is
right.

### A. Hold to talk does not work — narrowed, not diagnosed

Reported live on 2026-07-25 with a single `Shift` trigger: double tap works, hold
to talk does nothing. Because double tap counts release edges that only exist
after a counted press edge, **key delivery is ruled out for this session** — the
fault is in the hold path or in what it starts.

Four candidates and the single log block that separates them are in the
[known-issues record](../../known-issues/capture-shortcut-recording.md). Do not start
by reading the state machine: the trap at the bottom of this file applies exactly
here. One hold attempt with `[trigger]` running names the branch.

D11 is marked open again in that record. It was closed on the strength of the
watchdog, the release attribution and the evidence gating — all of which are real,
and none of which made the mode work.

### B. Physical S0 measurement

A person has to do this one. It blocks nothing: B and C
were built so they do not depend on it (the matrix follows measured evidence per
session instead of a per-OS claim). What the measurement buys is the ability to
state something about the **platform** rather than about the current session.

The procedure is written out ready to execute, with empty tables, the probe to
use, and what each possible outcome should change, in the
[run 2 section of the record](../../known-issues/capture-shortcut-recording.md).
Do not re-derive it; walk the user through that section and fill in the tables.

Two points worth repeating here because they are easy to get wrong:

- **Use the mode-select shortcut as the probe, not the capture trigger.** A lost
  release on the capture trigger starts a real recording; on mode select it costs
  nothing.
- **XTEST is exhausted.** Run 1 used `xdotool` and found nondeterministic release
  delivery, which establishes that the stranded-hold state is reachable but says
  nothing about hardware keys, and XTEST structurally cannot deliver to a
  Wayland-focused client. Do not try to automate this half.

### C. Windows and macOS have never run this lane

Separate from A and not blocked by it. The lane is implemented and unit-tested
for all three platforms; only Linux has ever executed it. Run sheets for both,
the findings already established from the vendored crate's source, and which
questions a VM or a CI runner can answer instead of owned hardware are in
[known-issues/cross-platform-shortcut-verification.md](../../known-issues/cross-platform-shortcut-verification.md).

The one item there worth knowing before reading anything else: **on macOS the
modifier-only capture defaults are expected to fail registration**, because that
platform implementation maps no modifier as a main key while X11 and Windows both
do. It is a code-level finding, needs a real macOS session to confirm, and the
fix is a product decision (accept, per-OS defaults, or patch the vendored crate)
— not an agent's call.

### D. Merge and cleanup — DONE

Merged on the user's decision of 2026-07-25, as a fast-forward (`master` was 0
commits behind, the branch 13 ahead). The rebuilt lane went into daily use with
hold to talk knowingly still broken and the physical verification still open —
that was the explicit trade, not an oversight.

## Settled — do not re-open

Delivered and decided. Listed so the next session does not redo the analysis
behind them.

### S6 — activation modes

Hold to talk keeps the watchdog (`hold_watchdog_seconds`, default 120, reason
`native_hold_watchdog`) and the deferred stop below `hold_min_ms`, so a short tap
in hold mode has defined behavior. All four timing constants (`hold_min_ms`,
`debounce_ms`, `hold_watchdog_seconds`, `double_tap_window_ms`) are reported in
`native_trigger_status` and stated in the Settings row. Double-tap activation
(`f056bd5`) is implemented, verified live, and is now the default (ADR 0008).
The selector is gated on the capability matrix from C.

### S7 — per-OS capability matrix

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
[0007](../../decisions/0007-capability-matrix-is-measured-not-assumed.md) before
touching this.** The matrix deliberately contains no per-OS verdict on hold to
talk, because none has been measured — see invariant 10.

### Product decisions

- **`double_tap` is the default `activation_mode`.** Decided yes by the user on
  2026-07-25, recorded as ADR
  [0008](../../decisions/0008-double-tap-is-the-default-activation-mode.md).
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
cd src-tauri && cargo test     # 353 tests
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
