# 0091: The session commands are the sidecar's contract, and the sidecar is gone

Date: 2026-08-11
Status: Accepted

## Context

`docs/spec/SPEC.md` names five session commands under *"Tauri commands
(UI -> Rust), key surface"*. Four of them — `start_native_session`,
`stop_native_session`, `native_session_status`, `complete_native_session` — have
no UI caller. ADR 0089 found them in its sweep, classified them as **command
shell only**, and kept them explicitly because *"removing them is a contract
change, not a drift correction, and a drift leg does not make one."*

This leg was sent to settle it, and the first question was not *does anything
call them* but **why they were ever there**, because deleting a contract on the
strength of a grep is how a deferred lane gets removed.

**They are the Python sidecar's IPC command set.** The pre-rewrite
`wordscript/ipc.py` documents the channel in its own module docstring:

```
Commands sent by Tauri:
  {"cmd": "start_recording"}
  {"cmd": "stop_recording"}
  {"cmd": "abort_recording"}
```

The sidecar owned the session state machine in a separate process, so the host
genuinely had to drive it from outside. `febc452` — *"rewrite WordScript as
native Tauri v2 app with Rust runtime"* — carried that command surface across as
`#[tauri::command]`s, and the same commit moved trigger, capture, providers and
the pipeline **into** the Rust process. The caller those doors existed for
became internal Rust calls in the same commit that created them:
`start_from_native`, `processing_from_native`, `complete_processing_session`.

`git log --all -S` finds **no commit in the repository's history** in which any
of the four was invoked from `src/`. They are the acknowledge pair's class — a
surface never built — rather than a caller deleted. `AGENTS.md` states the rule
they fall under: *do not add product logic to the old sidecar or glue paths; the
active path is Tauri/Rust, and the Python sidecar is not a reference
implementation.*

## Decision

**The four are removed. `abort_native_session` stays.**

### Why abort is the one that survives

Abort is the one lifecycle transition a **user** makes. The overlay draws it, so
the command has a caller and a reason to be reachable from a webview. Start,
stop and completion are transitions the runtime derives — from a hotkey, from
the auto-stop, from the provider answering — and a UI door onto them is a second
owner of a lifecycle ADR 0018 gave to exactly one.

### `complete_native_session` was worse than unreached

It emitted only `wordscript-native-event`. `AGENTS.md` is explicit that this
channel mirrors session status and **must never** set `status`, `pendingResult`,
`previewStaged` or `resultSurfaceOpen`, because it arrives one commit before the
authoritative `wordscript-event` transcription. A UI that called this command
would therefore end the native session, emit the mirror, and leave the overlay
in `processing` until `NATIVE_SYNC_TIMEOUT` fired — the bounded fallback ADR
0018 introduced, entered as the normal path. `useRuntime.ts` names the caller it
was guarding against in that fallback's own comment: *"a caller that only goes
through `complete_native_session`"*.

Its `complete_current_transcription` goes with it. That method completed
whichever session happened to be processing rather than the one the result
belongs to — the session-id guard `AGENTS.md` requires, taken back out one frame
after `complete_processing_session` applies it — and the command was its only
user. Every completion path now goes through the guarded method.

### What a future caller loses: nothing

`start_from_native`, `processing_from_native`, `complete_processing_session` and
`NativeSessionState::status()` are untouched. **A `#[tauri::command]` is
reachable only from this app's own webviews** — no CLI plugin is configured and
none of the four is referenced by a test — so the roadmap's MCP bridge, which is
specified to run *in the Tauri process, no daemon, bound to `127.0.0.1`*, could
never have reached them anyway. It calls the same Rust functions the trigger
path calls, which is what those functions are for.

`StartNativeSessionRequest` and `CompleteNativeSessionRequest` go with the
commands that deserialized them.

## Consequences

- **`cargo test` is unchanged at 740 and `cargo check` unchanged at 15
  warnings.** Nothing named these; a `pub` item with no user compiles silently.
  That silence is the same property that let fourteen registered commands
  accumulate: **the toolchain never asks who wants a public thing**, so a sweep
  is the only instrument, and ADR 0089 put one in the drift pass for that reason.
- **SPEC's contract section loses four entries and gains a statement of what the
  session commands are.** A list headed *UI -> Rust* may not contain four
  entries no UI calls — Leg 9 corrected the description and left the commands,
  and this leg finishes the correction from the other end.
- **`transcribe_audio_file` stays and is a different case.** Its *function* has
  live Rust callers in `history.rs` and `lib.rs`; only the `#[tauri::command]`
  registration is unreached, so removing it is deleting an attribute rather than
  a room. It remains listed under ADR 0089's command-shell class.
- **The transferable part is that residue outlives the architecture that needed
  it, and looks identical to design.** These four read as a deliberate UI
  contract for six legs — they were named in the spec as one — and the thing that
  distinguished them from a real contract was not visible in the code at all. It
  was in a deleted Python file's docstring. `git log -S` over the commit that
  introduced a primitive answers *why* in one command, and *why* is the only
  question that separates a deferred lane from a corpse.
