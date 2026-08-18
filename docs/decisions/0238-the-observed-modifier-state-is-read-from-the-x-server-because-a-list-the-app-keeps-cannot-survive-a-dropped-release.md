# 0238 — The observed modifier state is read from the X server, because a list the app keeps cannot survive a dropped release

Date: 2026-08-19
Status: accepted
Area: `vendor/global-hotkey` X11 backend, modifier-only shortcuts

## Context

A modifier-only binding is observed through XInput2 raw events rather than
grabbed (the patch note at the top of `platform_impl/x11/mod.rs` says why: a
passive grab on a bare `Shift` would stop `Shift` typing capitals desktop-wide).
Raw events carry no modifier state, so the backend tracked it itself, in a
`held: Vec<Keycode>` that a raw press pushed to and only a matching raw release
removed from.

That list had no other writer. Not `register`, not `unregister`, not
suspend/resume, not the hotkey recorder — and `GlobalHotKeyManager::new()` runs
once per process, so the `Observer` holding it lives as long as the app does.

Raw releases do go missing here. Measured in this machine's runtime log: six
capture presses with no release before the next press, one of them a hold
committed at +148.952 whose release never arrived at all, and whose binding only
worked again because an unrelated re-registration at +156.572 reset the flag.
The cause is the session shape rather than the app — a KDE Plasma 6 Wayland
session with the app on XWayland, where the compositor can take the keyboard
exclusively (the task switcher, a global shortcut, the lock screen) and XWayland
then never sees the key come back up.

A momentary gap in the stream therefore produced a permanent fault. One stranded
modifier keycode makes `held_mask_excluding` non-empty forever, and the
observation path fires only when `state.mods == held_mask`, so a bare-`Shift`
capture matched nothing again for the life of the process. No event, no error,
`registered` still true on every binding — which is the failure recorded in
[`shortcuts-die-and-cannot-be-re-registered.md`](../known-issues/shortcuts-die-and-cannot-be-re-registered.md),
including the part that made it feel unfixable: **re-registering does not clear
it**, so the self-heal restored by bounding the idempotency guard could not
reach this fault.

## Decision

The observation path does not keep a modifier list. It asks the X server which
keys are down, per decision, with `QueryKeymap`.

- `KeyState` wraps the server's 32-byte key bitmap; `held_mask_excluding` reads
  it instead of an accumulated `Vec`.
- A press decision costs one round trip on the local socket, taken only for a
  press of a key something is actually registered on. Raw events arrive for
  every key on the system, so asking on all of them would have charged ordinary
  typing one round trip per character to build a mask nothing then read.
- `release_stranded_states` reconciles the other half: while any binding
  believes its key is down, the loop asks the server every 250 ms, and emits the
  `Released` the stream owed for a key the server says is up. That repairs the
  second stuck state — `HotKeyState.pressed` — and ends the hold session a lost
  release would otherwise leave running until a timeout.
- Reconciliation covers the grab path too. It is the same failure with a
  different door.

A failed `QueryKeymap` is a connection failure and is treated as one: the thread
ends with a stated reason. Guessing a key state would be worse than stopping —
an empty one reads as *no modifier held* and fires triggers nobody pressed.

## Consequences

The bug is not repaired at runtime; the state it needed no longer exists. There
is nothing to reset, no reconciliation timer to tune for the press path, and no
recovery gesture for a user to discover.

The cost is a round trip per press of a registered key — two keycodes on this
machine, not every keystroke. It is a local socket, so it is not measurable
against the 1 ms poll the loop already sleeps.

`modifier_only.rs`, the platform-neutral port the Windows backend uses, still
accumulates the same way and carries the same defect. It is not fixed here: the
adapter would have to supply Windows' own key-state truth (`GetAsyncKeyState`),
and that cannot be validated on this machine. It is recorded in the known-issue
document rather than half-changed.

## Pinned by

`a_modifier_whose_release_was_lost_is_not_reported_as_held`,
`a_lost_release_is_emitted_once_the_server_says_the_key_is_up`,
`a_key_that_is_still_down_is_left_alone` — all in the vendored crate, all
without an X server, because the server's answer is a parameter.
