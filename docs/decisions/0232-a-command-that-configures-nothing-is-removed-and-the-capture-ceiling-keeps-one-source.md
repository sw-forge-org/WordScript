# 0232 - A command that configures nothing is removed, and the capture ceiling keeps one source

Date: 2026-08-18
Status: Accepted. Settles the item
[Leg 1 part 2](../archive/open-fixes-leg1-part2.md) left as the owner's call.

## Context

Chasing the owner's report of a recording cut off "at about three minutes"
established where a capture's two ceilings actually come from: every capture
builds its snapshot in `start_native_capture` from
`NativeCaptureConfig::load_from_disk()`, which resolves the **active profile's**
capture block. That snapshot carries no activation-mode and no delivery-mode
axis, so the "When a recording stops" card governs all three activation modes
and both delivery modes.

Found on the way: `configure_native_capture` reached no decision at all.

| Path | What it wrote | Who read it |
| --- | --- | --- |
| `configure_native_capture` | `NativeCaptureState::config` — `audio_device`, `max_recording_seconds`, `silence_timeout_seconds` | nobody |
| `start_native_capture` | the same field, from disk, on every capture | nobody |
| a running capture | `ActiveCapture::config`, its own snapshot | the monitor, the stop reason, the export |

`status()` exposes neither ceiling, so the field had no reader on any path, and
the frontend was sending the machine-wide `AppConfig` pair into it on every
config sync. The command looked like the configuration path and was not — which
is precisely the shape that made a three-minute abort plausible to reason about
and impossible to find.

## Decision

**Remove it, rather than leave it stated.** Gone: the `#[tauri::command]`, its
registration in `lib.rs`, `ConfigureNativeCaptureRequest`,
`NativeCaptureState::configure`, the `config` field that only that method and one
overwrite ever wrote, the `load` constructor that existed to seed it, and the
`invoke("configure_native_capture", …)` call plus its test stub on the frontend.

`NativeCaptureState` is now the counter and the running capture, constructed with
`Default`.

**The profile's capture block stays the single source of both ceilings.** If a
machine-wide override is ever wanted, it is built as a real read with a stated
precedence — not by reviving a write nothing consults.

## Consequences

- One fewer command on the UI/runtime seam, and `syncNativeRuntime` now sends
  only what a runtime actually reads.
- No behaviour changes. The removed path decided nothing before it was removed,
  which is why this is a seam decision and not a fix.
- `the_capture_ceiling_comes_from_the_active_profile_not_the_machine` keeps the
  rule under test, so a future change that makes the machine-wide pair
  authoritative again fails a test instead of a dictation.
- The stale `hold_watchdog_seconds = 120` on disk is untouched: only `== 0` is
  read, and ADR 0020 says a setting the user made is not the runtime's to edit.

## References

- [`archive/open-fixes-leg1-part2.md`](../archive/open-fixes-leg1-part2.md) — item 6, where the measurement is
- [`known-issues/capture-shortcut-recording.md`](../known-issues/capture-shortcut-recording.md)
- [ADR 0123](0123-a-fact-has-one-list-and-a-track-is-a-directory-not-a-naming-convention.md) — one list per fact
