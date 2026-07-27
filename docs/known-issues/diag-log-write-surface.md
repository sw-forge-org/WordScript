# Hardening: The Overlay Diagnostic Log Writes to a Shared, Predictable Path

Status: **Open — hardening finding, no observed failure**

First recorded: 2026-07-27, from the `sec-check` pass on the
overlay-recording-freeze diagnostics
Affected area: `append_diag_log`, `read_diag_log`, `clear_diag_log` in
`src-tauri/src/lib.rs`

## Finding

The overlay diagnostic log lives at the compile-time constant path
`/tmp/kilo/overlay-diag.log` (`OVERLAY_DIAG_LOG_PATH`, `lib.rs:108`). Two
properties combine into a local hardening gap:

1. **The directory is shared and the name is predictable.** `/tmp` is
   world-writable. The sticky bit stops one user from deleting another user's
   entries, but it does not stop anyone from creating `/tmp/kilo` first. Both
   `std::fs::create_dir_all` and `std::fs::File::create` follow symbolic links,
   so a local user who wins that race points `/tmp/kilo` at a directory of their
   choosing and WordScript then creates, truncates and appends
   `overlay-diag.log` inside it, with WordScript's own privileges. `clear_diag_log`
   writes an empty file through the same path. This is the classic insecure
   temporary file pattern (CWE-377, CWE-59).
2. **The commands exist in release builds.** All three are registered
   unconditionally in the `invoke_handler` (`lib.rs:2323-2326`). The frontend
   only calls them under `import.meta.env.DEV` (`OverlayWindow.tsx`, `diagLog`),
   so nothing reaches them in a shipped build today — but the write path is
   compiled in rather than absent.

The path itself is a constant and carries no user input, so there is no path
traversal here. The exposure is the shared directory, not the filename.

Note on the neighbouring code: `overlay_open_devtools` is `cfg`-gated, but for an
unrelated reason that the comment above it states plainly — Tauri only exposes
`open_devtools()` under `debug_assertions` or the `devtools` feature. That gate
is API availability, not a security decision, and it should not be read as a
precedent that the diagnostic commands were deliberately left ungated after a
security assessment.

## Severity

- **Single-user desktop (the normal case): low.** No other local account exists
  to win the race.
- **Shared or multi-user Linux host: moderate.** An unprivileged local user can
  cause WordScript to truncate and append to a file of their choosing, limited
  to the name `overlay-diag.log` under an attacker-controlled directory. They
  can also read overlay state if they make the directory readable to
  themselves — that content is render context (`pillMode`, surface, motion,
  timings), not transcripts or credentials.
- **Not remotely reachable.** Tauri commands are only callable from the app's
  own webviews, which load bundled local assets. Reaching these commands from
  outside would first require script execution inside a WordScript window.

## Measures

In order of preference:

1. **Move the log next to the runtime log.** `core::paths` already resolves a
   per-user application data directory, and `wordscript-runtime.log` lives
   there. A per-user directory removes the shared-directory problem entirely
   rather than mitigating it, and it also makes the file survivable across a
   reboot for post-mortem reading. Cost: the documented path in
   `docs/DEVELOPMENT.md` and the `overlay_diag` panel copy change with it.
2. **If the file must stay in `/tmp`:** create a per-user subdirectory with
   mode `0700` and `O_EXCL` semantics, and open the log with `O_NOFOLLOW`, so a
   pre-planted symlink fails the open instead of being followed.
3. **Independently of 1 and 2:** `cfg`-gate the three commands to
   `debug_assertions` (returning an error otherwise, the shape
   `overlay_open_devtools` already uses), so a release binary carries no
   diagnostic write path at all. This is defence in depth, not a substitute —
   the developer machine is where the log actually gets written.

## Verification

- After a fix: start the app, confirm the log is created under the per-user
  directory with restrictive permissions and that the `overlay_diag` panel still
  renders the tail.
- Regression for the symlink case: pre-create the target path as a symlink to a
  scratch file and confirm the app refuses to write through it rather than
  truncating the target.
- `cd src-tauri && cargo test`.

## References

- [overlay-recording-freeze.md](overlay-recording-freeze.md): the investigation
  this log serves, and the reason its read path was bounded
- [DEVELOPMENT.md](../DEVELOPMENT.md): the Overlay Tracing section documents the
  current path
- CWE-377 (insecure temporary file), CWE-59 (link following)
