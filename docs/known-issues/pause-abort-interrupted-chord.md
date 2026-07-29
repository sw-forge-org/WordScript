# Pause and Abort Act on an Interrupted Chord

Status: **Fixed in code on Linux (2026-07-29, ADR
[0014](../decisions/0014-every-modifier-only-binding-is-decided-at-the-release-edge.md)),
not yet confirmed in a native session. Windows: implemented the same day, not
compiled for its target. macOS: still open, requirements written down.**

First recorded: 2026-07-29, while planning
[handoffs/HANDOFF_activation-mode-gestures-and-defaults.md](../handoffs/HANDOFF_activation-mode-gestures-and-defaults.md)
Affected area: the `is_abort` and `is_pause` branches of
`handle_native_shortcut_event` (`src-tauri/src/core/trigger.rs:1152-1213`),
`arm_hold_action` (`trigger.rs:1673`), `double_tap_gate` (`trigger.rs:1933`)
Shipped default that triggers it: `default_abort_hotkey()` = `Ctrl+Alt`
(`src-tauri/src/core/config.rs:1300`)

## Finding

A modifier-only shortcut has no press edge that can be distinguished from the
user simply holding those modifiers on the way to a longer chord. The vendored
crate says so structurally: `on_raw_press` always sends
`GlobalHotKeyEvent { state: Pressed, interrupted: false }` and only sets
`interrupted` on the *later* raw press of another key
(`vendor/global-hotkey/src/platform_impl/x11/mod.rs:399-450`). **Interruption is
knowable at the release edge and nowhere else.**

The start/stop trigger is built around that fact. `tap_hotkey_uses_release_trigger`
and `double_tap_uses_release_trigger` (`trigger.rs:1896-1907`) defer a
modifier-only trigger to the release, and the `Released if is_hotkey` branch then
discards it when `event.interrupted` is set (`trigger.rs:1310-1330`).

**Pause and abort never received any of this.** They act on the press edge, and
`event.interrupted` is not read in either branch — not on press, where it is
always `false`, and not on release, where it would be true. What that costs
depends on the activation mode:

| Mode | Behaviour with the shipped `Ctrl+Alt` abort default |
| --- | --- |
| Tap to toggle | `requires_double_tap` and `requires_hold_arm` are both false, so `abort_session` fires the moment `Ctrl+Alt` is down — **before** the user has even pressed the third key. Every `Ctrl+Alt+<key>` chord aborts a running capture |
| Double tap | `double_tap_gate` fires on the second press inside `double_tap_window_ms` (400 ms) and never consults interruption, so two `Ctrl+Alt+…` chords in quick succession abort. `Ctrl+Alt+Left` / `Ctrl+Alt+Right` workspace switching on KDE is exactly that shape |
| Hold to talk | `arm_hold_action` starts a timer that fires after `HOLD_ARM_MS` (300 ms) while the keys are down. Reaching for `T` in `Ctrl+Alt+T` passes 300 ms easily, and the abort fires under the still-held chord |

The hand-off first recorded this as a hold-mode defect and called double tap
harmless because "arming alone does nothing". That is true of the *hold* arm and
wrong about the double-tap gate: the gate is a counter, and an interrupted press
still counts. Tap mode, not hold, is the fastest path to the misfire.

Pause is affected by the same code but not by the same default: `Ctrl+Space`
contains a real key, so no interruption question arises. The exposure is any
modifier-only value in the pause or abort slot — shipped in abort's case, and
freely assignable in both.

This is not fixable in the default value alone. A user who assigns `Ctrl+Alt`
themselves — a reasonable choice, and one the contract allows from two modifiers
upward (T3) — meets the same behaviour.

## Severity

- **Data loss, silently.** Abort discards a capture in flight. The user gets no
  transcript and no obvious reason, because the chord they pressed was aimed at
  another application entirely.
- **Reachable with the shipped configuration**, on the default activation mode
  (double tap) as well as on tap.
- **Linux-only today**, because the interruption signal only exists in the x11
  backend — but only in the sense that the other platforms cannot even report
  the problem. See gap C in the hand-off.

## What was done (2026-07-29)

Option 1 of the three that were on the table: **a modifier-only pause or abort
binding is decided at the release edge**, the way start/stop already was. The
reasoning is in ADR
[0014](../decisions/0014-every-modifier-only-binding-is-decided-at-the-release-edge.md).
It absorbs the other two options — the gate and the threshold now only ever see
uninterrupted releases, so there is nothing separate to guard.

In `src-tauri/src/core/trigger.rs`:

- `pause_uses_release_trigger` / `abort_uses_release_trigger`, mirroring
  `tap_hotkey_uses_release_trigger`. Each reads its own config slot, because the
  shipped abort default is modifier-only and the pause default is not.
- A modifier-only press stores `pause_pressed_at` / `abort_pressed_at`, logs
  `deferred_to_release_modifier_only` and acts on nothing.
- `resolve_deferred_action_release` decides the release: interrupted →
  `ignored_interrupted_chord`; no recorded press →
  `ignored_release_without_press`; otherwise tap fires, double tap runs the gate,
  hold measures the press duration against `hold_arm_ms`.
- `clear_capture_state_for_abort` is shared by the press-edge and release-edge
  abort paths so the two cannot drift.
- A binding containing a real key keeps the old path unchanged, including
  `arm_hold_action` and `DeferredHoldAction`.

Seven synthetic tests cover it (`the_shipped_abort_default_is_decided_at_the_release_edge`,
`an_interrupted_chord_never_pauses_or_aborts_in_any_mode`,
`an_interrupted_chord_does_not_count_toward_the_double_tap`,
`a_deliberate_gesture_still_pauses_and_aborts`,
`a_deferred_hold_below_the_threshold_is_discarded`,
`a_deferred_release_without_a_press_acts_on_nothing`,
`both_abort_paths_leave_the_same_capture_state_behind`). `cargo test` is green:
410 passed.

**What this does not fix.** Gap C of the hand-off, the cross-platform half. See
the correction below — the first version of this paragraph described it wrongly.

## Correction: what Windows and macOS actually did (2026-07-29)

The paragraph above originally read: *"Windows and macOS hardcode
`interrupted: false` in the vendored crate, so a modifier-only pause/abort
binding there still fires under an unrelated chord."* That was written from a
`grep` for `interrupted` and is wrong twice over. Reading the two backends in
full gave a different picture:

1. **Neither backend compiled.** Three `GlobalHotKeyEvent` literals were never
   updated when the WordScript patch added the `interrupted` field —
   `windows/mod.rs:165` and `macos/mod.rs:466` and `:519`. A struct literal
   missing a required field is E0063, so `cargo build` for either target failed
   before it could misbehave. The patch had only ever been compiled on Linux,
   which is why nobody saw it. No claim about runtime behaviour on those
   platforms could have been true.
2. **The bindings did not fire at all, spuriously or otherwise.** On Windows,
   `ll_keyboard_proc` returned early for every modifier virtual key, so a
   shortcut whose main key *is* a modifier never reached the matcher. On macOS,
   `key_to_scancode` has no entry for `ControlLeft`/`AltLeft`/`ShiftLeft`/
   `MetaLeft`, so registration failed outright with "Unknown scancode". The
   remaining `interrupted: false` sites are all grabbed real-key or media-key
   paths, where the contract in `lib.rs` *requires* false. They were never the
   defect.

So the real cross-platform state was not "aborts at the wrong moment" but
"modifier-only pause and abort do not exist, on a build that does not exist".

## What was done about it (2026-07-29)

- **All three compile errors fixed** by supplying `interrupted: false`, which is
  the contract-correct value at each of those sites (press edge, grabbed real
  key, media key).
- **The state machine was extracted**, not duplicated. `src/modifier_only.rs` in
  the vendored crate holds the platform-neutral half — held-modifier tracking,
  the exact-match rule, and what spoils a held trigger — with no OS types in it.
  It compiles and runs its own tests on Linux, which is the only reason any of
  this is checkable at all: **ten unit tests** cover the deliberate chord, the
  third key, a second modifier, the flag not leaking into the next gesture,
  auto-repeat, a wrong modifier set, a release without a press, META/SUPER
  equivalence, and duplicate registration.
  One of those tests earned its place immediately: it caught that a repeated
  `Ctrl` key-down under a held `Alt` would fire the *other* registration of the
  same combination, so one gesture reported itself twice. x11 never meets this
  because it asks the server for `DETECTABLE_AUTO_REPEAT`; the Windows hook has
  no such switch. That defect would have shipped.
- **Windows was wired to it.** `register` routes a modifier main key to the
  observer instead of the grab registry, the hook feeds every key event to it
  (including non-modifiers, which is what marks a held trigger interrupted), and
  modifier keys are still passed on with `CallNextHookEx` — observed, not
  grabbed, per ADR 0009.
- **x11 was deliberately left alone.** It is the reference implementation and
  the only backend that has actually run; rewiring it to the shared module would
  put the working platform at risk to tidy up two that do not run. The module is
  a port of its rules, not its replacement.
- **macOS was not attempted.** It would need modifier scancodes plus a real
  `FlagsChanged` path on the existing `CGEventTap`, and the per-side state has
  to come from the device-dependent modifier bits — `objc2-app-kit` is not
  fetched on this machine, so none of that API could be verified. Writing it
  blind is how the three compile errors got there in the first place. It stays
  open, with the requirements written down below rather than guessed at in code.

**Unverified, and this is the important limitation.** There is no Windows or
macOS toolchain here (no `rustup`, no cross targets), so *none* of the above was
compiled for its target. What is proven is the shared logic; what is not proven
is that the Windows adapter builds. The adapter deliberately uses only APIs
already present in that file, but that is an argument, not a compiler.
`session_has_interruption_signal` therefore still returns false for Windows: the
signal is now produced, but the validation rule that would let a *single* bare
modifier be a trigger there stays off until hardware confirms it.

**What macOS still needs**, for whoever picks it up:

- Scancodes for the eight modifier keys (`0x3B`/`0x3E` control, `0x3A`/`0x3D`
  option, `0x38`/`0x3C` shift, `0x37`/`0x36` command) and a registration branch
  that sends them to the tap instead of `RegisterEventHotKey`, which cannot
  express a modifier-only hotkey.
- `CGEventType::FlagsChanged` handled in `key_event_callback`, which currently
  ignores it entirely.
- Press versus release decided from the device-dependent modifier bits, not from
  `NSEventModifierFlags`: releasing left Control while right Control is still
  down leaves the shared flag set, so the side-agnostic flag cannot see it.
- The tap needs Accessibility permission; a refusal has to surface as a failed
  registration rather than silence.

## Verification

The code change is covered by unit tests. **The behaviour has still never been
observed in a running app**, neither before nor after — this record was written
from source, and so was the fix.

Still owed, and the reason this record is not closed:

- A native session (`npm run tauri dev`) — the trigger lane cannot be judged from
  a browser preview.
- Per activation mode, with the shipped `Ctrl+Alt` abort binding and a capture
  running: press `Ctrl+Alt+T`. The `[trigger]` block must show
  `deferred_to_release_modifier_only` on the press and
  `ignored_interrupted_chord` on the release, and the capture must survive.
- Per activation mode, the deliberate gesture: `Ctrl+Alt` alone must still abort
  — immediately in tap, on the second tap within the window in double tap, and
  after `hold_arm_ms` in hold, where it now fires when the keys come up rather
  than while they are down.
- A pause binding with a real key (the shipped `Ctrl+Space`) must behave exactly
  as before, on the press edge.
- `cd src-tauri && cargo test`.

## References

- [handoffs/HANDOFF_activation-mode-gestures-and-defaults.md](../handoffs/HANDOFF_activation-mode-gestures-and-defaults.md):
  where this was found, and the three capability gaps around it
- [capture-shortcut-recording.md](capture-shortcut-recording.md): the trigger
  observability this record's verification depends on
- [cross-platform-shortcut-verification.md](cross-platform-shortcut-verification.md):
  why Windows and macOS cannot confirm or deny any of it yet
- ADR [0009](../decisions/0009-modifier-only-shortcuts-are-observed-not-grabbed.md):
  the interruption signal and why start/stop is exempt from discarding it
- ADR [0013](../decisions/0013-hold-to-talk-is-strictly-momentary.md): the arm
  threshold the hold-mode variant runs on
