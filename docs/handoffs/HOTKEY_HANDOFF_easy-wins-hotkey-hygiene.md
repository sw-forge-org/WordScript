# Hand-Off: Cross-Platform Hotkey Hygiene

Status: **Implemented 2026-06-10; historical scope superseded by current mode hotkeys**

## Goal

Replace restrictive `RegisterHotKey` behavior with low-level platform hooks so
start, stop, pause, and abort combinations work reliably across Windows, macOS,
and Linux. The original Windows default `ctrl_l+win+space` conflicted with the
system input-language shortcut; it was replaced with `ctrl_l+alt_l+space`.

## Delivered Principles

- The native trigger contract owns normalized shortcuts and registration state.
- Settings displays saved native shortcut truth rather than assuming its input
  string registered successfully.
- Reserved operating-system combinations require platform-aware defaults and
  honest diagnostics.
- Start, stop, pause/resume, and abort remain native actions.

## Supersession

Current configuration also contains one picker/cycler shortcut plus direct
shortcuts for auto, verbatim, cleanup, rewrite, agent, and prompt-enhance
modes. This hand-off does not document those later contracts; inspect
`src-tauri/src/core/config.rs` and the active architecture documentation
instead.
