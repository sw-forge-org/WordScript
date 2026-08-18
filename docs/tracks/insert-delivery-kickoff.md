# Kick-off — Leg 2: the RemoteDesktop paste driver

**Leg 1 closed 2026-08-18** ([`open-fixes-leg1.md`](open-fixes-leg1.md)), so
this leg is clear to start. It is the large one and is deliberately alone in its
own session.

**Your scope is steps 4–8 of [`insert-delivery.md`](insert-delivery.md).** Read
that track first — it carries the measurements, the driver landscape and why
every other candidate is closed. Do not re-derive any of it, and do not pick up
the small items from the previous session; they belong to Leg 1.

Work on `main`, no branch. A dev host may be running: check `pgrep -x wordscript`
and say so before touching `src-tauri/`.

## What you are building

A second paste driver on Linux, `NativeInsertDriver::RemoteDesktopPortal`,
injecting `Ctrl+V` through `org.freedesktop.portal.RemoteDesktop`
`NotifyKeyboardKeysym`. It is the first mechanism on this platform whose delivery
is a call with a result rather than a keystroke into the void.

## Start here — the blocker

`core/portal.rs` speaks D-Bus by **spawning `busctl`**. A RemoteDesktop session
is owned by the connection that created it, each `busctl` invocation is its own
connection, and the session dies when that process exits. There is nothing left
to send `NotifyKeyboardKeysym` to, and `Start` cannot be awaited across
invocations because its result arrives as a signal on the same connection.

So the driver needs a **persistent in-process D-Bus connection**. `ashpd` is
decided (it wraps `zbus` and models session lifetime and restore tokens).
`ashpd` and `zbus` are not two options to choose between — one is a layer over
the other.

## Before writing code

[ADR 0228](../decisions/0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md)
is **Proposed**. Accept or revise it first, and settle its two open questions
with the owner:

1. Is the first grant requested lazily on the first `auto_paste` run that needs
   it, or offered up front in Settings as a one-time action?
2. If the grant is refused or revoked, does `auto_paste` fall back to the
   clipboard with its stated reason, or turn the delivery mode off and say so?

## Two constraints that are not yours to relax

- **Sequencing.** The drivers are never tried one after another on this lane —
  each fake-input attempt is its own privilege prompt, and the owner rejected
  `wtype`/`ydotool` on exactly that ground. The focus probe decides *before* any
  driver launches which single one applies. The table is in the track.
- **The restore token leaves `$XDG_RUNTIME_DIR`** (step 5). That directory is
  cleared on reboot, which turns "one grant ever" into "one grant per boot" —
  close enough to the per-paste prompt the owner rejected to undo the reason this
  driver was chosen at all.

## One warning from the previous session

A fix here was withdrawn hours after it landed (ADR 0227 decision 2 → ADR 0229):
a complete enumeration of the session's X windows supported the conclusion that
XTEST could not reach anything, and the owner's "it worked sometimes"
contradicted it. They were right — KWin forwards XTEST from Xwayland into the
compositor. **A complete measurement is not a complete model.** Ask before
concluding that something cannot happen.

**Replace this file when the leg closes.**
