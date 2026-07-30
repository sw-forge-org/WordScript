# Bug: the delivery mode switches itself back to clipboard-only

Status: **Open. Three roots found and fixed (C1 form clobbering; C2 unlocked
resave, `92ce7f5`; F3 unpersisted normalization, ADR 0019) and the symptom is
still reported on a build containing all three, 2026-07-30. The blocker is that
`save_config` records nothing, so every root so far was found by reading rather
than measuring — see "Why this bug keeps coming back".**

Affected area: `core/config.rs` persistence, `work_mode.insert_behavior`

## Symptom

The user selects "Copy and insert at cursor" for a text profile. Some time
later — reported as "after a few minutes", in practice after the next config
load — the profile is back on "Copy to clipboard only", with no error and no
indication that anything changed.

Easily confused with a runtime insert failure, which looks similar from the
outside: an `auto_paste` run whose paste is refused falls back to the clipboard
for that one dictation. The two are distinguishable in the history file, and
that distinction is the first diagnostic step. See below.

## Mechanism 1 (fixed 2026-07-03, `92ce7f5`)

`resolve_current_processing_mode` (overlay / mode-event polling) called
`AppConfig::load_from_disk()`, which re-saved a normalized snapshot **without**
holding `CONFIG_FILE_LOCK`. That raced a concurrent `save_config` from the
settings UI: the resolve had read a stale file, wrote its snapshot over the
user's change, and the change was gone.

Fixed by splitting the loader into a lock-holding `load_from_disk()` and a
lock-free `load_from_disk_within_lock()` for callers that already hold it, and
wrapping the whole load-normalize-resave sequence in the lock. The comment at
`core/config.rs` above `load_from_disk` records this.

## Mechanism 2 (fixed 2026-07-29, ADR 0019)

`normalize_text_profile_insert_behavior_value` maps the legacy tokens
`"clipboard"` and `"manual"` onto the canonical `"clipboard_only"`, and anything
unrecognized onto `"auto_paste"`. That correction happened in memory on every
load.

It was never written back. `load_from_disk_impl` computed `should_save` from the
legacy-secret migration, the global-to-profile migration, the provider and the
hotkeys — a `work_mode` rewrite did not count. A profile carrying `"clipboard"`
on disk was therefore forced to clipboard-only on **every** start, no matter what
the user had selected, for as long as the raw token stayed in the file.

Evidence: the P1 diagnostic
`[WordScript] Config normalize rewrote insert_behavior profile=… from='clipboard'
to='clipboard_only'` appears **183 times** across the two runtime logs
(121 in `wordscript-runtime.log`, 62 in `.1`) for the profile `support`. A
correction that is genuinely applied fires once. 183 repetitions is the same
statement as "never persisted".

Fixed by having `normalize_text_profiles` report a `work_mode` rewrite and
feeding that into `should_save`. A canonical config still reports no rewrite, so
this does not trade a silent revert for a config written on every load.

## Distinguishing a revert from a runtime insert fallback

`~/.config/WordScript/history.json` records both sides per run:

- `work_mode.insert_behavior` — what the **config** said when the pipeline
  started.
- `insert_mode` / `pasted` / `fallback_reason` — what the **insert** actually
  did.

A config revert shows `work_mode.insert_behavior: "clipboard_only"` together
with `insert_mode: "clipboard_only"`. A runtime fallback shows
`work_mode.insert_behavior: "auto_paste"` with `insert_mode: "clipboard_fallback"`,
`pasted: false` and a non-null `fallback_reason`.

Measured on 2026-07-29 across 25 runs: every `auto_paste` run had
`insert_mode: "direct_paste"`, `pasted: true`, `fallback_reason: null`, with
`Native insert paste strategy=xdotool` in 27-33 ms. There was no runtime
degradation in that window; every mode change came from the config.

## What is NOT the cause

- **Driver capability going stale.** `detect_insert_platform_context()`
  (`core/insertion.rs`) re-probes the environment and `PATH` on every insert.
  There is no cached capability, no `OnceLock`, no persisted "this driver is
  broken" flag. The one process-lifetime cache
  (`NativeInsertionState::portal_session_attempted`) is never read by the insert
  path and only feeds the diagnostics panel.
- **A runtime insert failure writing to the config.** Insert results go to the
  scratchpad file and the history file. Nothing on that path touches
  `config.json`.

## Still open

Whether a *writer* of the non-canonical token exists. No current code path
writes `"clipboard"` into `insert_behavior`; the value is read-only legacy as far
as the tree goes, so it is most likely data left by a schema that predates the
canonical tokens. The P1 diagnostic is now a usable instrument for this: it
should fire once per legacy value and then never again. A repeat after
ADR 0019 is evidence of a writer.

Check with (filter test noise first — `cargo test` writes into this file, see
[rust-test-global-state-isolation.md](rust-test-global-state-isolation.md)):

```
grep -c "Config normalize rewrote insert_behavior" \
  ~/.config/WordScript/logs/wordscript-runtime.log
```

**The symptom is still reported after ADR 0019.** Observed 2026-07-30 on a build
that already contained the fix, running since ~12:57: `config.json` was written
at 13:18:25, and the dictation at 13:19:15 still ran `delivery=clipboard_only`
with all six profiles on `clipboard_only`. That write cannot be attributed from
the artifacts, which is the actual problem below.

### Why this bug keeps coming back: there is no measurement

Three roots have been found and fixed, each a different mechanism:

| | Root | Fixed |
| --- | --- | --- |
| C1 | A late `ready` from `save_config` clobbered an in-flight form edit, reverting it A→B→A→B | in-flight save counting, `SettingsWindow.tsx` |
| C2 | `resolve_current_processing_mode` re-saved a stale snapshot without the config lock | `92ce7f5` |
| F3 | A normalized `work_mode` was never persisted, so a legacy token re-applied on every load | ADR 0019 |

All three were found by **reading code**, not by measuring — because there is
nothing to measure. `save_config` (`core/config.rs:1302`) records no log line at
all: not that a save happened, not what it contained, not which command called
it. The P1 diagnostic only fires when *normalization* rewrites a value, so a save
that writes `clipboard_only` because the incoming form said so is invisible. A
bug fixed three times by inspection and reported a fourth time is a measurement
problem before it is a logic problem.

### Task: a diagnostic at the save boundary

Record every `insert_behavior` transition per profile with its before value,
after value and originating command — `save_config`,
`switch_active_text_profile`, `set_active_profile_processing_mode` and the mode
router are the write paths. Then one reproduction pins the writer instead of
another reading session.

Sequence it **after** the `runtime_log` test-path override, otherwise the new
lines drown in `cargo test` output in the same file — the failure mode that
already produced one wrong analysis in this investigation.

### Fourth candidate, from reading and not yet a finding

`switch_active_text_profile` (`core/config.rs:1329`) does a full
read-modify-write of the config and emits `ready`. The in-flight-save counter in
`SettingsWindow.tsx` suppresses the external form sync only for `save_config`
round trips, so a profile switch made after an unsaved delivery-mode change
would resync the form from disk and drop the edit. Same shape as C1, at a
different boundary. Unverified — the save-boundary diagnostic above is what would
settle it.

## Related

- Hybrid XWayland (KDE Plasma 6) runs the paste chain as `[Xdotool]`, so a
  refused XTEST injection has exactly one attempt before the run delivers to the
  clipboard instead. Calling the absent `Enigo` step the gap would be wrong:
  `enigo` is pulled with its default `x11rb` backend, which drives input through
  the same XTEST extension `xdotool` uses, and `paste_with_enigo` refuses
  outright while `xdotool` is in `PATH`. Adding it back would re-run the identical
  request and buy a second privilege prompt. The real fragility is that XTEST is
  the *only* mechanism there — see [PLATFORMS.md](../PLATFORMS.md) and the libei
  candidate in [ROADMAP.md](../ROADMAP.md). Separate from this bug either way.
- [ADR 0019](../decisions/0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md)
- [REFERENCE.md](../REFERENCE.md): delivery mode semantics
