# 0008: Double Tap Is the Default Activation Mode

Date: 2026-07-25
Status: Accepted

## Context

The default capture triggers are modifier-only: `Ctrl+Super` to start and stop,
`Ctrl+Alt` to abort. Modifier-only is allowed by the contract from two modifiers
upward (T3) and is deliberately the default, because a bare function key or a
letter combination is worse — it takes a key other applications actually use.

In `tap` mode, however, a modifier-only trigger acts on **every single press**.
Holding `Ctrl+Alt` on the way to `Ctrl+Alt+T` fires the abort shortcut. The
combination is effectively removed from the rest of the desktop, which is exactly
the complaint that started the rebuild — shortcuts that swallow keys other
applications need.

Double-tap activation (implemented in slice S6) closes that: the first edge only
arms, and nothing happens unless a second edge arrives inside
`double_tap_window_ms` (default 400 ms, clamped 150–1000). A lone `Ctrl+Alt`
does nothing, so `Ctrl+Alt+T` keeps opening a terminal.

Comparable tools do the same thing rather than grabbing a normal combination:
Wispr Flow double-taps right Shift, macOS Dictation double-taps Fn, Windows
Voice Typing uses the vendor-reserved `Win+H`.

## Decision

`double_tap` is the default `activation_mode`, defined once in
`core::config::default_activation_mode()`. `core::trigger` delegates to it, as it
already does for the default shortcut rotation (per-OS branching in the defaults
is what let the legacy migration corrupt the Windows default, D6).

This changes the default only. `AppConfig` is `#[serde(default)]`, so the value
applies when the key is absent from the config file. A config that already
records an `activation_mode` — including every existing installation — keeps it.
No migration touches the field, and nothing rewrites a value the user chose.

## Consequences

- A fresh installation starts with modifier-only triggers that do not act on a
  single press. First-run behavior matches what the defaults were chosen for.
- `tap` stays fully supported and is the right choice for a trigger that includes
  a real key (`Ctrl+F9` in tap mode needs one press, not two). The Settings row
  states this per mode rather than ranking the modes.
- Existing users see no change until they deliberately switch. The two behaviors
  differ enough that a silent switch on update would read as a bug.
- The default is not "the mode that works everywhere" — that question belongs to
  the capability matrix (ADR 0007) and is answered from measured evidence per
  session. Tap and double tap are both `Available` wherever grabs exist, so this
  choice never conflicts with the gating.
