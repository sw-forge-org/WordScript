# Rust Tests Mutate Process Globals and Fail Under Parallel Execution

Status: **Fixed (2026-07-29)** — no test mutates process state any more

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

## References

- Neither defect is caused by the trigger or activation-mode work; both are
  pre-existing and were noticed in passing during it, see
  [handoffs/HANDOFF_activation-mode-gestures-and-defaults.md](../handoffs/HANDOFF_activation-mode-gestures-and-defaults.md)
- [DEVELOPMENT.md](../DEVELOPMENT.md): the validation commands this affects
