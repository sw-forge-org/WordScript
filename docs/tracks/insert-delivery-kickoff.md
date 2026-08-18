# Kick-off — Leg 2: the RemoteDesktop paste driver

## State at handoff (2026-08-18, evening)

Everything Leg 1 and its part 2 produced is **committed on `main` and not
pushed** — three commits: the trigger instruments and the vendored X11 fix, the
delivery code (switches, coalescer, context menu, the ADR 0232 removal), and the
documentation stage. The tree is clean. Ask before pushing.

**Nothing in Leg 2's scope has been touched.** `core/portal.rs` still spawns
`busctl`; the blocker below is exactly as written.

**Three things are owed, none of them yours to guess at:**

1. **Two owner reproductions**, both with the instrument already in place and a
   reading key written down: a window opened mid-hold
   ([`../known-issues/capture-shortcut-recording.md`](../known-issues/capture-shortcut-recording.md))
   and a dictation carried past three minutes
   (same file, and item 6 of [`open-fixes-leg1-part2.md`](open-fixes-leg1-part2.md)).
   Until one of them runs, neither report has a cause — do not build a fix for
   either.
2. **ADR 0228 is still `Proposed`**, with the two questions below unanswered.
3. **The overlay double reveal at app start** stays open and measured, not
   fixed: same surface twice, 108 ms apart, one flush, so it entered from a
   native route. [`../known-issues/overlay-ghosting.md`](../known-issues/overlay-ghosting.md)
   carries the numbers.

**Two facts worth having before you read a log on this machine.** Sort
`history.json` by `created_at_ms` before believing its tail — the file is not
in time order, and reading `[-3:]` produced a wrong statement about the current
delivery behaviour in the session that closed part 2. Sorted, the eight most
recent runs on 2026-08-18 all record `insert_behavior=auto_paste`,
`insert_mode=direct_paste`, `pasted=true`, driver `xdotool`. And `cargo check
--tests` reports nine warnings that are all present at `HEAD` and belong to
other code — they are not this track's and not a regression.

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
