# 0006: Rust Owns the Shortcut Contract

Date: 2026-07-25
Status: Accepted

## Context

The shortcut lane in Settings -> Capture and Settings -> Modes had two
independent owners of the same string. `config.rs` held a lossy normalizer that
lowercased unknown tokens, silently replaced an empty value with the platform
default, and truncated three specific combinations on every save. `trigger.rs`
held a strict normalizer that rejected the same unknown tokens. The React
recorder held a third, much smaller key table that mapped only modifiers,
`Space`, `F1`-`F12`, letters and digits.

The consequences are documented in
[known-issues/capture-shortcut-recording.md](../known-issues/capture-shortcut-recording.md):
a value could be persisted that could never register, a shortcut could not be
cleared, the Windows default hotkey was rewritten on every save, display strings
disagreed between layers, and the recorder could not reproduce the default abort
shortcut it was supposed to manage.

Underneath all of it, the vendored `global-hotkey` parser already accepts the
browser `event.code` vocabulary (`KeyM`, `Digit0`, `ArrowUp`, `NumpadAdd`,
`BracketLeft`, `F1`-`F24`).

## Decision

One Rust module, `core::shortcut`, owns the shortcut contract: the token
vocabulary, the canonical storage form, the human display string and every
validity rule. `core::config` and `core::trigger` parse through it and hold no
token knowledge of their own.

The UI carries no key table. It reads the vocabulary from the runtime over
`shortcut_vocabulary`, sends browser `event.code` values unchanged, and asks
`validate_shortcut` for validity and display. Because the exported vocabulary is
the runtime's own, "every token the UI can produce is registerable" is a
property asserted by a test rather than an invariant maintained by hand.

Rules the contract enforces:

- An empty value means **disabled**, for capture and mode shortcuts alike. It is
  never replaced by a platform default.
- A single bare modifier is rejected. A modifier-only shortcut needs at least
  two modifiers, so no registration can ever produce a grab with no modifier at
  all.
- A bare letter or digit is rejected. A bare function key is accepted and
  carries a warning naming it as a desktop-wide grab.
- A value that cannot be parsed is stored unchanged and surfaced as "not
  registerable". It is never rewritten into something that merely looks valid.
- Normalization runs before collision validation, never after.
- Legacy rewrites are gated on `shortcut_schema_version` and run once.

## Consequences

- `config.rs::normalize_shortcut_value` no longer takes a fallback argument and
  no longer truncates. The ungated space migration and
  `is_legacy_autofilled_space_shortcut` are gone;
  `Ctrl+Alt+Space`, `Ctrl+Super+Space` and `Ctrl+Cmd+Space` are selectable, and
  the Windows default hotkey survives a save.
- `trigger.rs` lost its own key table, its modifier list and its function-key
  check. `build_shortcut_binding` returns both the canonical and the human form.
- `src/lib/hotkeys.ts` was deleted. `src/lib/shortcuts.ts` replaces it and holds
  no key knowledge — only the transport to the runtime plus chord bookkeeping.
- The canonical storage form changed for keys the old normalizer wrote in pynput
  spelling (`ctrl_l+f9` -> `Ctrl+F9`). Existing configs are migrated on first
  load; values that were already canonical are unchanged.
- A test double (`src/test/shortcutRuntime.ts`) stands in for the runtime in UI
  tests. It is a test double, not a second contract: the rules themselves are
  asserted in `cargo test`.
- Adding a key class means adding it to `core::shortcut` only. Any future
  divergence between the UI and the runtime is a contract break, not a UI
  detail.
