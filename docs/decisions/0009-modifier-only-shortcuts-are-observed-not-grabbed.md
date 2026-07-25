# 0009: Modifier-Only Shortcuts Are Observed, Not Grabbed

Date: 2026-07-25
Status: Accepted

## Context

Every global shortcut was registered as an OS-level **grab**. A grab delivers the
key to the grab owner instead of to the focused window. For `Ctrl+F9` that is
exactly right: the shortcut should not also reach the editor underneath.

For a shortcut made of modifiers it is wrong, and the consequences were showing
up as three separate complaints:

- **The original report.** Shortcuts swallow keys other applications need. With
  `Ctrl+Super` as a grab, that combination is gone from the desktop.
- **A rejected single modifier read as arbitrary.** Trying to assign a bare
  `Shift` produced "a single Shift would be grabbed from every application", and
  the obvious objection followed: in double-tap mode one key is enough, that is
  the entire point of the mode. Half right — the behavioral half. The other half
  was the grab, which no activation mode can change.
- **Two platform findings.** On Windows a modifier-only shortcut registers and
  never fires, because `ll_keyboard_proc` handles every modifier virtual key
  before the hotkey registry is consulted. On macOS it never registers, because
  `key_to_scancode` maps no modifier key. Both are recorded in
  [known-issues/cross-platform-shortcut-verification.md](../known-issues/cross-platform-shortcut-verification.md).

The tools that make a modifier the trigger do not grab it. Wispr Flow
double-taps right Shift, macOS Dictation double-taps Fn — they *observe* the key
stream without consuming it. macOS's own implementation in the vendored crate
already has such a path: a `CGEventTap` created `ListenOnly`.

## Decision

The delivery mechanism follows from the shortcut, not from configuration:

| Shortcut | Delivery | Consequence |
| --- | --- | --- |
| Has a real key (`Ctrl+F9`, `F1`) | `Grab` | The combination is taken from other applications, which is what a hotkey with a real key should do |
| Modifiers only (`Ctrl+Super`, `Ctrl+Alt`) | `Observe` | The keystroke still reaches the focused window; the modifier keeps doing its ordinary job |

`core::shortcut::Delivery` names this and is derived in one place. The platform
layer applies the same rule — "main key is a modifier" — so the two cannot
disagree, and no new API is needed between them.

On Linux the observation path is XInput2 raw key events, selected on the root
window. Raw events are delivered without consuming the keystroke and without
regard to focus. Two properties are load-bearing:

- **Raw events carry no modifier state**, so the state is tracked from the raw
  stream, the way the Windows low-level hook does. Only the eight modifier
  keycodes are tracked; every other keycode is discarded on arrival without being
  recorded, forwarded or logged.
- **On XWayland this is still an X11 mechanism.** Raw events cover what the X
  server sees, so a keystroke delivered to a native Wayland client remains
  invisible. Observation removes the key theft; it does not close the Wayland
  gap.

The two-modifier minimum stays, with a changed reason. It is no longer "a bare
grab would take the key from the desktop" — that is no longer true. It is that
the trigger lane cannot distinguish a deliberate tap of a modifier from the same
modifier pressed while typing: typing "Hello World" presses Shift twice, and
inside the double-tap window that is indistinguishable from a deliberate double
tap. Two modifiers make the combination rare enough to read as intentional.

## Relationship to ADR 0006

This does not supersede [0006](0006-rust-owns-the-shortcut-contract.md). Every
rule it lists still holds, including "a single bare modifier is rejected". What
changes is the *reason* recorded there for that one rule: 0006 justified it by the
bare grab it would create, and with observation that justification no longer
applies. The rule survives on the new ground stated above. 0006 is left
unedited, as ADRs are.

## Consequences

- The modifier-only defaults `Ctrl+Super` and `Ctrl+Alt` no longer take their
  keys from the desktop. This is a behavior change on Linux, where they
  previously worked as grabs, and it is the point.
- Windows and macOS need the same routing in their platform implementations
  before this holds there. Until then modifier-only remains broken on both, in
  the two different ways recorded in the verification document. The capability
  matrix continues to report measured per-session evidence, so it does not claim
  otherwise.
- A single modifier as a trigger is now a *missing feature* rather than a
  forbidden one. It needs two further things, neither of which is in the event
  contract yet:
  1. **An interruption signal** — "was another key pressed while this modifier
     was held" — so `Ctrl+Alt` on the way to `Ctrl+Alt+T` and Shift on the way to
     a capital letter can be told apart from a deliberate tap. This means a third
     piece of state on `GlobalHotKeyEvent`, which every platform implementation
     constructs.
  2. **Side-specific modifier tokens.** `MODIFIER_TOKENS` is side-agnostic
     (`Shift`, not `ShiftLeft`/`ShiftRight`), and both `event.code` values map to
     the same token. Right Shift is usable as a trigger precisely because it is
     rarely used in typing; the contract currently cannot express it.
- A non-consuming system-wide key monitor is, structurally, a keylogger-shaped
  component. On macOS it is exactly what Input Monitoring gates, and on Windows
  the low-level hook already is one. The narrow scope above — eight modifier
  keycodes tracked, everything else discarded before it is stored — is the
  mitigation, and it belongs in the privacy documentation rather than only in
  code comments.
- The vendored `global-hotkey` patch set now covers Windows pointer types and this
  Linux observation path. Both must survive a vendor update.
