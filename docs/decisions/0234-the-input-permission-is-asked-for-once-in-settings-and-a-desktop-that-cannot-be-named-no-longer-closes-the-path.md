# 0234 - The input permission is asked for once, in Settings, and a desktop that cannot be named no longer closes the path

Date: 2026-08-18
Status: Accepted

## Context

[ADR 0228](0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md)
chose the RemoteDesktop portal as the second paste driver and left two questions
open, both about the one permission it needs: when it is asked for, and what
happens when the answer is no. Answering them turned up two measurements that
change what the decision is even about.

**The portal path was already closed on the reporting machine, in two places,
and neither said so.**

*One.* `detect_compositor()` searched `XDG_CURRENT_DESKTOP` and
`XDG_SESSION_DESKTOP` for the substring `"plasma"`. That machine answers `KDE`
for both:

```
XDG_CURRENT_DESKTOP=KDE
XDG_SESSION_DESKTOP=KDE
XDG_SESSION_TYPE=wayland
plasmashell 6.7.0
```

So a KDE Plasma 6 desktop fell through to the `WAYLAND_DISPLAY` arm and was
classified `Other`. `supports_remote_desktop_portal()` is false for `Other`, and
the caller returned **without logging**, because the early return for an
unsupported compositor had no log line. `plasmashell --version` — the check that
would have got it right — sits behind the branch that never ran.

*Two.* `detect_portal_capabilities()` decided whether the interface exists by
scanning `busctl --user list` for `"org.freedesktop.portal.remotedesktop"`. That
command lists **bus names**. RemoteDesktop is an **interface** on the single bus
name `org.freedesktop.portal.Desktop`, so the string is not in that output on any
machine:

```
$ busctl --user list | grep -ci remotedesktop
0
$ busctl --user get-property org.freedesktop.portal.Desktop \
      /org/freedesktop/portal/desktop \
      org.freedesktop.portal.RemoteDesktop version
u 2
```

`has_remote_desktop_portal` was therefore false everywhere, and
`diagnose_blockers()` reported the interface as "not reachable on the session
bus" on a session where it answers with a version number.

The two failures are the same shape: **a probe that answers "no" for a reason
that has nothing to do with what it was asked**, and then a consumer that treats
that as a fact about the machine. Between them, 6539 runtime-log lines contain
not one portal line — the path was not failing, it was never entered.

**And the plumbing could only have prompted every time.** The owner's memory of
an early WordScript is *"I got that damn field every single time"*. The
`busctl`-based `request_remote_desktop_session` sent no `persist_mode`, so the
portal default `DoNot` applied, and it never read the `restore_token` out of the
`Start` response — it wrote back the token it had loaded, which stores nothing
new. Any grant obtained through it was a fresh grant. Whether that is the code
they remember cannot be established (the version is months old and the log does
not reach back), but it is a sufficient mechanism and it was still in the tree.

## Decision

**1. The permission is requested in exactly one place, and it is a button.**

`request_portal_input_grant` is a Tauri command with one caller: the "Grant
access" row in Delivery & Insert. No dictation raises the dialog — not the first
one on a fresh install, not a retry after a failed paste, not a run that finds
itself without a session. A run with no grant delivers to the clipboard and names
the button.

The owner's answer was *"either properly once in the settings or not at all"*,
and the rule is written to be stronger than that sentence needs: the paste path
has **no route** to `Start`, which is the call that prompts. `paste_ctrl_v` sends
four `NotifyKeyboardKeysym` calls on an already-started session and fails
otherwise. A test asserts the absence of that route rather than trusting the
comment.

**2. An existing grant is restored at startup, on its own thread.**

The one place a dialog could still appear without a button is a restore that the
compositor decides to re-confirm. It runs at app start, before anybody is
dictating, and only when a stored token exists and no refusal is remembered. The
elapsed time of `Start` goes into the runtime log, so a compositor that ignores
the token and prompts anyway shows up as seconds where milliseconds belong.

**3. A refusal is remembered, not re-asked.**

`refused_at_ms` is stored next to the token. While it is set, nothing asks: not
startup, not a run. The Settings row stays and its button reads "Ask again",
which clears the refusal and asks once. The delivery mode is **not** changed —
turning "insert at cursor" off would be a second thing to notice on top of the
failure, and the mode remains correct for XWayland windows on the same machine.

**4. `detect_compositor()` recognises `KDE`, and the interface probe reads a
version instead of grepping a name list.**

Both corrections are the same one: ask the question that was meant. And the
startup path now logs the case where it does nothing, because a path that is not
taken has to say so — that silence is what hid the first bug.

**5. The `busctl` session creation is removed rather than repaired.**

`request_remote_desktop_session` and `busctl_call` are gone. A session that dies
with the process cannot be a paste driver and was only ever feeding a diagnostics
row that claimed it was active. `busctl` keeps the capability probing it is
adequate for. `PortalSessionSummary` is replaced by `PortalGrantStatus`, which
reports a session that actually exists.

## Consequences

- On KDE Plasma 6 and GNOME the Delivery screen grows one row with one button,
  and that button is the only thing in the product that can raise the "Control
  input devices" dialog.
- A machine that never presses it behaves exactly as it did before this leg:
  the chain on a hybrid lane is `[xdotool]` for every probe result. A test
  asserts that, so the portal's arrival cannot quietly change machines that do
  not use it.
- Reading `native_insertion_status` no longer creates anything. It used to
  request a portal session as a side effect of drawing a diagnostics panel.
- Compositors with no RemoteDesktop portal report `portal_grant: null` rather
  than an ungranted permission, so no screen offers an action that cannot work.
- The KDE Plasma 6 row in `PLATFORMS.md` describes something that exists for the
  first time.
- **What is still unverified:** that a restored session suppresses the dialog on
  KDE Plasma 6 across a restart. Everything here asks for `ExplicitlyRevoked` and
  stores what the portal returns; whether KWin honours it is its behaviour, and
  the owner's history is a reason to measure rather than assume. The measurement
  is two presses and a restart, and the log line for it is already in place.

## References

- [ADR 0228](0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md):
  the driver, its sequencing, and the two questions this answers
- [ADR 0229](0229-an-unconfirmable-paste-is-still-attempted-and-what-it-costs-is-the-clipboard-restore.md):
  why `Unknown` stays on `xdotool` instead of reaching for the portal
- [`../tracks/insert-delivery.md`](../tracks/insert-delivery.md): the measurements
  this rests on and the driver landscape
- [`../PLATFORMS.md`](../PLATFORMS.md), [`../known-issues/auto-paste-reports-success-without-inserting.md`](../known-issues/auto-paste-reports-success-without-inserting.md)
