# 0014: Every Modifier-Only Binding Is Decided At The Release Edge

Date: 2026-07-29
Status: Accepted

## Context

[0009](0009-modifier-only-shortcuts-are-observed-not-grabbed.md) established that
a modifier-only shortcut is observed rather than grabbed, and that the
observation carries an interruption signal: another key going down while the
modifiers are held means this was `Ctrl+Alt` on the way to `Ctrl+Alt+T`, not a
gesture aimed at us.

That signal has a property the trigger lane did not fully respect. It is set on
the *later* raw press and reported with the release
(`vendor/global-hotkey/src/platform_impl/x11/mod.rs`); the press event itself is
always sent with `interrupted: false`, because at that moment nothing has
interrupted anything yet. **Interruption is knowable at the release edge and
nowhere else.**

The start/stop trigger was built on that fact — `tap_hotkey_uses_release_trigger`
and `double_tap_uses_release_trigger` defer a modifier-only trigger to the
release, which is then discarded when `interrupted` is set. `REFERENCE.md` stated
the rule generally ("a modifier-only trigger acts on key release rather than
press") and named all three capture-lane bindings.

Pause and abort never implemented it. They acted on the press edge in all three
activation modes, and read `interrupted` in none of them. With the shipped
modifier-only abort default `Ctrl+Alt`, reaching for any `Ctrl+Alt+<key>` chord
during a dictation discarded the capture: in tap mode the instant both modifiers
were down, in double-tap mode on the second such chord inside the window, and in
hold mode after `hold_arm_ms` of the chord being held. Recorded in
[known-issues/pause-abort-interrupted-chord.md](../known-issues/pause-abort-interrupted-chord.md).

## Decision

The release edge decides **every** modifier-only capture-lane binding, not only
start/stop. Pause and abort follow the same rule the trigger already follows:

- A modifier-only pause/abort press records its timestamp and acts on nothing.
  The decision happens on the release, where `interrupted` is finally known.
- An interrupted release is discarded (`ignored_interrupted_chord`) and counts
  toward nothing — in particular it is not a tap of a double tap.
- A binding containing a real key is unchanged: it keeps acting on the press
  edge, with the existing double-tap gate and hold arm timer, because no
  interruption question arises for it.

**In hold mode the deferred action fires on the release, not on the arm timer.**
The threshold itself is unchanged: the press must have lasted `hold_arm_ms`. Only
the measurement moves, from a timer that fires while the keys are still down to a
duration measured when they come up. This is the part of the decision that costs
something, and it is deliberate: a timer that fires mid-hold fires *before* the
interruption is knowable, so a hold-mode abort cannot be both timer-driven and
interruption-safe. Pause and abort can afford the wait — unlike start/stop, which
opens a microphone on the press edge and must be able to end what it started
(0009), they have started nothing until they fire.

## Consequences

- The shipped `Ctrl+Alt` abort default stops discarding captures under unrelated
  `Ctrl+Alt+<key>` chords, in all three activation modes. So does any
  modifier-only value a user assigns to pause or abort, which is why this is not
  fixable by changing the default.
- The code now does what `REFERENCE.md` already described. The document was
  right and the implementation was partial; no documented behaviour changes.
- A hold-mode pause or abort becomes perceptible on release rather than at the
  300 ms mark. There is no visible arm feedback today, so the user-facing
  difference is the latency of a key release.
- `TriggerEffect::DeferredHoldAction` and `arm_hold_action` stay, for pause and
  abort bindings that contain a real key. Two paths now exist for the same
  action; `clear_capture_state_for_abort` is shared between them so they cannot
  drift.
- Two new decision tokens appear in the `[trigger]` log:
  `deferred_to_release_modifier_only` on the press,
  `ignored_interrupted_chord` on a discarded release — the latter already
  existed for start/stop.
- **This fixes the defect on Linux only, and says so.** The Windows and macOS
  backends of the vendored crate hardcode `interrupted: false`, so a
  modifier-only pause/abort binding there still fires under an unrelated chord —
  now on the release edge instead of the press, which is a different moment and
  not a fix. The parser already refuses a single modifier on those platforms
  (`session_has_interruption_signal`), but two modifiers are allowed, which is
  exactly the shipped `Ctrl+Alt`. Closing it needs the observation path itself:
  [../tracks/activation-gestures.md](../tracks/activation-gestures.md),
  gap C, and it is unchanged by this decision.
