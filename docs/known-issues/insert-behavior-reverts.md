# Bug: the delivery mode switches itself back to clipboard-only

Status: **One mechanism found and fixed (2026-07-29, ADR 0019): a normalized
`work_mode` was never persisted. An earlier, separate mechanism was fixed in
`92ce7f5` (2026-07-03). Whether anything else still reverts the setting is
open — the P1 diagnostic is the instrument.**

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

Check with:

```
grep -c "Config normalize rewrote insert_behavior" \
  ~/.config/WordScript/logs/wordscript-runtime.log
```

## Related

- Hybrid XWayland (KDE Plasma 6) runs the paste chain as `[Xdotool]` with no
  `Enigo` fallback (`core/insertion.rs`), so a refused XTEST injection has
  exactly one attempt before the run falls back to the clipboard. That is a real
  fragility of the insert lane, separate from this bug — see
  [PLATFORMS.md](../PLATFORMS.md).
- [ADR 0019](../decisions/0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md)
- [REFERENCE.md](../REFERENCE.md): delivery mode semantics
