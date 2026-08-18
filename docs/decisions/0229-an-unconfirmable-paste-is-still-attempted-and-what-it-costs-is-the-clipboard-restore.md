# 0229 - An unconfirmable paste is still attempted, and what it costs is the clipboard restore

Date: 2026-08-18
Status: Accepted. **Supersedes decision 2 of
[ADR 0227](0227-every-route-into-a-native-reveal-goes-through-the-coalescer-and-a-driver-that-cannot-reach-its-target-says-so.md)**,
the same day it was made.

## Context

ADR 0227 decided that "a paste driver that cannot reach its target refuses
instead of reporting a paste". On a hybrid XWayland session the chain probed the
X focus, and no focused foreign X client meant the run ended as a clipboard
fallback without attempting anything.

The reasoning was: every driver on that lane injects through XTEST, XTEST is
delivered by the X server to its focused client, and a native Wayland window is
not one. Enumerating the session's visible X windows appeared to settle it —
the complete list was WordScript's own overlay and its settings window, with the
editor, browser and terminal all native Wayland clients.

**The owner contradicted it from experience, and the experience is right:**

> Make the Target Take It hat ja davor funktioniert mit xdotool. Natürlich sehr
> unzuverlässig, aber ab und zu.

The missing fact is that **KWin forwards XTEST fake input from Xwayland into the
compositor**, which then delivers it to the focused Wayland window. The absence
of a focused X client therefore does not prove the keystroke goes nowhere. It
proves only that nothing on this side can confirm that it went somewhere.

ADR 0227's decision 2 turned "unreliable" into "never", and the report that
followed it was exactly that: auto-paste stopped working entirely, where before
it had worked occasionally.

## Decision

**1. The probe does not gate the paste.** On every lane the paste chain runs as
it did before ADR 0227. A three-valued probe whose `Unreachable` arm is
*evidence of absence* was the error; it is evidence of *absence of evidence*.

**2. What the uncertainty costs is the clipboard restore, not the paste.**
`auto_paste` uses the clipboard as the transport for `Ctrl+V` and then puts the
previous contents back a moment later (`schedule_clipboard_restore`). On a run
that did not actually insert, that leaves the user with neither the paste nor
the transcript — the one outcome with no recovery at all. So when delivery
cannot be confirmed, the transcript stays on the clipboard and the restore is
skipped, recorded as `NativeClipboardRestoreStatus::SkippedDeliveryUnverified`.

**3. Confirming a paste remains unsolved, and is not faked in either
direction.** The runtime cannot observe whether a key event was consumed by
another application. ADR 0227's finding stands — `pasted: true` off an exit code
is a claim the process cannot support — but the answer is not to invent a
refusal. It is either a driver whose delivery is observable (the portal path,
[ADR 0228](0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md))
or a record that states the uncertainty.

## What stands from ADR 0227

Decision 1 (every route into a native reveal goes through the coalescer) and
decision 3 (a watchdog outcome is named after what was observed) are untouched.
Only the paste refusal is withdrawn.

## Consequences

- Auto-paste behaves as it did before ADR 0227 — intermittently, on this lane —
  rather than not at all.
- A run whose delivery could not be confirmed leaves the transcript on the
  clipboard. That is a visible behaviour change from before ADR 0227 and it is
  the intended one: the previous clipboard contents lose to the dictation the
  user just spoke.
- The measurement in ADR 0227 that motivated the refusal is still correct as a
  measurement — nine runs recorded `pasted: true` with nothing observable behind
  it. It is the inference from it that was too strong.

## The lesson worth keeping

A complete enumeration is not a complete model. Listing every X window in the
session was a real measurement, and the conclusion drawn from it ("XTEST has no
reachable target here") was wrong because the delivery path did not end where
the enumeration looked. **The owner's "it worked sometimes" was data, and it
outranked a theory that could not accommodate it.**

## References

- [ADR 0227](0227-every-route-into-a-native-reveal-goes-through-the-coalescer-and-a-driver-that-cannot-reach-its-target-says-so.md)
- [auto-paste-reports-success-without-inserting.md](../known-issues/auto-paste-reports-success-without-inserting.md)
- [tracks/insert-delivery.md](../tracks/insert-delivery.md)
