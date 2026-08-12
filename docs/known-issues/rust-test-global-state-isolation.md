# Rust Tests Mutate Process Globals and Fail Under Parallel Execution

Status: **Ring buffer and env var fixed (2026-07-29). One case still open: a test
run appends to the user's real `wordscript-runtime.log`, which makes that log
unusable as field evidence — see the 2026-07-30 addendum.**

First recorded: 2026-07-29, from repeated full `cargo test` runs while working on
the trigger lane
Affected area: `src-tauri/src/core/runtime_log.rs`,
`src-tauri/src/core/workspace_context.rs`

## Finding

`cargo test` runs the tests of one binary on a thread pool by default. A test
that mutates process-wide state is therefore racing every other test in the same
binary, including its own siblings.

Two places do it:

1. **The runtime-log ring buffer.**
   `record_appends_to_in_memory_ring_buffer` and
   `recorded_entries_carry_an_epoch_and_monotonic_timestamp` both call
   `runtime_log_store().lock().unwrap()` and `clear()` the shared buffer before
   recording into it. Each one clears what the other just wrote.
2. **`WORDSCRIPT_PROJECT_ROOT`.** `resolve_project_root_reads_env_var` and
   `resolve_project_root_falls_back_to_cwd_for_invalid_env` set and remove the
   same environment variable, which is per process, not per test. When the
   second one's `remove_var` lands between the first one's `set_var` and its
   assertion, `resolve_project_root()` falls back to the working directory:

   ```
   ---- core::workspace_context::tests::resolve_project_root_reads_env_var ----
   assertion `left == right` failed
     left: Some(".../WordScript/src-tauri")
    right: Some("/tmp")
   ```

**Measured rate.** 22 consecutive full `cargo test` runs on a clean tree,
2026-07-29, on this machine: 2 failed. All three tests named above appeared as
the failing one across those two runs. The rate is not stable — it depends on
machine load and thread count, and an earlier session on the same tree saw
roughly two failures in five runs. Treat the number as "intermittent and load
dependent", not as a constant.

The failure is a false negative: the assertions are correct and the code under
test is fine. That is what makes it worth recording rather than tolerating — a
suite that fails at random trains everyone to re-run it instead of reading it,
and the next real regression in these modules arrives looking exactly like the
noise.

`std::env::set_var` is additionally unsafe in Rust 2024 for this same reason.
The edition is not yet the one this crate uses, but the direction is settled.

## Fix

Both sites took the seam, not a lock. A shared mutex across the affected tests
was rejected: it makes the suite's correctness depend on every future test
author remembering to take the lock, and it leaves the global mutation in place
so the next test that touches the same state reintroduces the failure silently.
The seam removes the shared state from the test path entirely, which is why it
also had to stay green under `--test-threads=1` — a fix that only works because
of a scheduling accident is not a fix.

**Ring buffer** (`runtime_log.rs`). `record` was split into `formatted_entry`
(timestamp plus message) and `push_bounded` (append plus trim). The two tests
that used to `clear()` the global now compose those two against a local
`VecDeque`, so they own their buffer and cannot see each other. The end-to-end
path is still covered by `record_reaches_the_shared_ring_buffer`, which calls
the real `record` and asserts **additively** on a uniquely named line — it never
clears, so it is safe against parallel siblings. A third test,
`ring_buffer_drops_the_oldest_entry_beyond_the_cap`, is new coverage the global
version could not express: the eviction at `MAX_RUNTIME_LOG_ENTRIES` was never
asserted before, because the shared buffer's length was not a test's to control.

**Project root** (`workspace_context.rs`). `resolve_project_root` now only reads
`WORDSCRIPT_PROJECT_ROOT` and hands the value to
`resolve_configured_project_root(Option<&str>)`, which holds the actual logic.
Both tests call the pure function with the value they want, so neither
`set_var` nor `remove_var` appears in the test module at all. That also removes
the Rust 2024 `unsafe` problem for this crate ahead of the edition bump. A third
case (`None`, no variable set) is new coverage.

No production behaviour changed: the composed path is byte-for-byte what
`record` and `resolve_project_root` did before.

## Verification

Measured on 2026-07-29 on the same machine as the original 22-run measurement:

- `cd src-tauri && cargo test` **10 consecutive runs, 0 failures**, 413 tests
  each. Ten was the bar because the observed rate was ~9%: three green runs
  would have been consistent with the bug still being there.
- `cargo test -- --test-threads=1` green, 413 tests.
- `cargo check --all-targets` clean; no new warnings, and neither touched file
  appears in the remaining pre-existing ones.

## Addendum 2026-07-30: the tests still write to the user's real runtime log

The status above ("no test mutates process state any more") holds for the ring
buffer and the environment variable. It does not hold for the log **file**.

`runtime_log::record` composes its path from `user_data_dir()`, which resolves
`XDG_CONFIG_HOME` or `$HOME/.config`. Under `cargo test` that is the developer's
own config directory, so a test run appends to
`~/.config/WordScript/logs/wordscript-runtime.log` — the same file a real session
writes to, and the file a maintainer reads as field evidence.

What that costs, measured on this machine: the log contained 116 lines reading
`Native insert paste driver=xdotool blocked by portal ... Authorization denied:
org.kde.kwin.RemoteDesktop.SelectDevices`, spanning three days and ending minutes
before the analysis. Read at face value that is a ~30% XTEST failure rate and a
strong case for a second paste mechanism. Every one of them was a test fixture.
The real sessions have **zero** portal denials and 37 successful `xdotool` pastes
over the same period, which `history.json` independently confirms (19
`direct_paste` entries, all `pasted: true`, no `fallback_reason`).

The discriminator is the elapsed offset in the line prefix: the whole suite runs
in under a second, so anything at `+0.0xx` is a test. Real dictations sit seconds
to minutes into a process. Two further tells: `is_wayland=false`,
`chain=[Arboard]` and `strategy=enigo` cannot occur together in a real session on
this platform.

Until the path is redirected, any analysis of this log must filter by elapsed
offset first:

```
python3 - <<'EOF'
import re
pat = re.compile(r'^\[(\d+) \+(\d+\.\d+)\]')
for line in open('logs/wordscript-runtime.log', errors='ignore'):
    m = pat.match(line)
    if m and float(m.group(2)) >= 5.0:
        print(line, end='')
EOF
```

Not yet fixed, and the repo already contains the fix for a sibling file.
`core/history.rs` routes every access through `resolved_history_file_path()`,
which consults a `#[cfg(test)]` `history_path_override()` before falling back to
`history_file_path()`. `runtime_log::runtime_log_file_path()` has no equivalent —
it composes `paths::user_data_dir()` directly. Mirroring that override is the
whole change.

Scope, checked rather than assumed: `config.json`, `history.json` and
`scratchpad.json` resolve through the same `user_data_dir()`, but no test module
reaches them. The two `AppConfig::load_from_disk()` calls in `core/history.rs`
(lines 377, 721) and the one in `v1_slice/runtime.rs` (line 302) are production
code — `history.rs`'s `mod tests` only starts at line 873. So the runtime log is
the one file a test run actually writes into.

Worth noting for whoever picks this up: since `load_from_disk` now persists a
normalized `work_mode` (ADR 0019), any future test that does call it would rewrite
the developer's real `config.json` into canonical form. Harmless in content —
`save_to_disk` serializes `without_secrets()` — but it is one more reason the
override should exist before such a test is written.

## References

- Neither defect is caused by the trigger or activation-mode work; both are
  pre-existing and were noticed in passing during it, see
  [../tracks/activation-gestures.md](../tracks/activation-gestures.md)
- [DEVELOPMENT.md](../DEVELOPMENT.md): the validation commands this affects
