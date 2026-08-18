# Track — Insert delivery

Opened 2026-08-18, out of one owner report: *"insert at cursor does not work on
this machine — nothing lands at the cursor, and it is unreliable."* This file is
both the sequence and the kick-off; paste it to the next agent.

Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. See **Sharing main** in
[`../IMPLEMENTATION.md`](../IMPLEMENTATION.md).

## The thesis

**The last step of a dictation is the only one with no way to tell whether it
worked.**

Everything upstream of the insert is measured and recorded: the capture reports
integrity and cadence, the provider reports elapsed time and coverage, the
transform reports what it changed. Then the text is handed to a driver that
returns a process exit code — and an exit code answers *did the request leave*,
not *did the text arrive*. On a Wayland session with XWayland alongside the two
answers come apart often, and the runtime recorded the wrong one as fact.

The consequence is not cosmetic. `pasted: true` in `history.json` was the app's
own statement that a dictation had been delivered, and it was recorded for runs
that delivered nothing. **How often is not known** — that is the point. The gap
is not "it fails", it is "nothing here can tell".

## The findings this track is built on

All measured 2026-08-18 on the owner's machine (`XDG_SESSION_TYPE=wayland`, KDE
Plasma 6, `DISPLAY=:0` from XWayland, `xdotool` present, no `wtype`, no
`ydotool`).

**1. There is exactly one paste driver, and its delivery is unobservable.**
`paste_driver_execution_chain` yields `[Xdotool]` and returns. Every driver that
survives on that lane injects through X11 XTEST — `xdotool` directly, `enigo`
through its default `x11rb` backend, and `paste_with_enigo` refuses outright
while `xdotool` is in `PATH`. XTEST delivers to whatever *the X server* considers
focused, and:

```
xdotool getactivewindow              -> 2097152 (0x200000)
xdotool getactivewindow getwindowname -> (empty)
```

No focused X client — a native Wayland window holds the focus.

**That does not mean the paste goes nowhere**, and concluding so cost this track
a withdrawn ADR on its first day: **KWin forwards XTEST fake input from Xwayland
into the compositor**, which delivers it to the focused Wayland window. What the
empty result establishes is only that nothing on this side can confirm delivery.
The owner's account — *"it worked, very unreliably, but now and then"* — is the
observation the model has to accommodate.

**2. The runtime reported success for every one of those runs.** Nine
consecutive `auto_paste` runs in `history.json`, all `insert_mode: direct_paste`,
`pasted: true`, `fallback_reason: null`, `active_driver: xdotool`, with
`Native insert paste strategy=xdotool elapsed_ms=27..33` in the runtime log.
Zero fallbacks. The record claims certainty the process does not have — in
either direction.

**3. The documentation described a path the code never takes.**
`PLATFORMS.md` listed KDE Plasma 6 as using a one-time RemoteDesktop portal
grant "and then direct auto-paste without repeated dialog". The portal session is
created on the first `native_insertion_status` call and its handle feeds the
diagnostics panel; `paste_driver_execution_chain` never consults it, and on any
session with a `DISPLAY` the chain ends at `[Xdotool]` before it could. Corrected
in place the same day.

**4. The one thing `PLATFORMS.md` did analyse was the benign case.** It says a
compositor that *refuses* the XTEST grant leaves no second mechanism and the run
delivers to the clipboard. That is true and it is handled: a refusal is an error,
so the fallback runs. The damaging case is the inverse — the grant is *accepted*
and lands nowhere, producing no error to fall back from.

## What has already landed

ADR 0227 made the chain **refuse** to paste when no foreign X window held the
focus. **That was withdrawn the same day by
[ADR 0229](../decisions/0229-an-unconfirmable-paste-is-still-attempted-and-what-it-costs-is-the-clipboard-restore.md)**,
because the owner had auto-paste working occasionally against native Wayland
windows and the refusal turned that into never: **KWin forwards XTEST from
Xwayland into the compositor**, so no focused X client does not mean no delivery.

What is in the tree is the probe repurposed. It does not gate the paste; it
decides whether the **clipboard restore** is safe. `auto_paste` uses the
clipboard as the transport for `Ctrl+V` and then puts the previous contents back,
so a run that did not insert left the user with neither. When delivery cannot be
confirmed the transcript stays on the clipboard.

**Nothing yet makes the insert reliable, and nothing can confirm it happened.**
That is what the rest of this track is for — and it is the strongest argument for
the portal driver, whose delivery is a call with a result rather than a keystroke
into the void.

> **Since 2026-08-18 that is no longer true on one lane.** A paste through
> `NativeInsertDriver::RemoteDesktopPortal` is a D-Bus call that returns, so a
> run against a native Wayland window can now say whether the text arrived — and
> the clipboard restore, withheld since ADR 0229 whenever delivery could not be
> confirmed, runs again on exactly that lane. The XWayland lane is unchanged:
> `xdotool` still cannot tell, and still does not claim to.

## The driver landscape, and why most of it is closed

| Candidate | Standing | Why |
| --- | --- | --- |
| `xdotool` / XTEST | **in use**, kept | Prompt-free and correct whenever a real X client has the focus. Stays first in the chain. |
| `enigo` | not a fallback | The same XTEST request through a different binding; refuses while `xdotool` is in `PATH`. An alternative, never a second attempt. |
| `wtype`, `ydotool` | **rejected by the owner**, 2026-08-18 | A compositor privilege prompt per paste — "that gets very annoying very quickly". If ever revisited they must be **sequenced**, never attempted after another fake-input driver, so one refusal does not buy a second prompt. |
| `kdotool` | unusable | Drives windows through KWin scripting; cannot inject key input at all. |
| AT-SPI | weak | The bus runs (`org.a11y.Bus`), but `toolkit-accessibility` is `false` and `QT_ACCESSIBILITY` unset on this machine, so it would work only for applications that happen to have accessibility on. |
| **`portal.RemoteDesktop`** | **chosen**, 2026-08-18 | Present here at **version 2** with `NotifyKeyboardKeysym`, `NotifyKeyboardKeycode`, `ConnectToEIS` and `AvailableDeviceTypes=7`. Its `restore_token` is the whole difference from `wtype`/`ydotool`: one grant, then a restored session injects with no prompt per paste. |

**Sequencing is a requirement, not an optimisation** (owner, 2026-08-18). The
drivers must never be tried one after another on this lane, because each
fake-input attempt is its own privilege prompt. The ADR 0227 focus probe is what
makes that possible: it decides *before* any driver is launched which single one
applies.

| Probe result | Driver | Prompt |
| --- | --- | --- |
| `Reachable` | `xdotool` | none |
| `Unreachable` | RemoteDesktop portal | once ever, then none |
| `Unknown` | `xdotool`, then clipboard fallback | none |

## The blocker the next session starts on

`core/portal.rs` talks to D-Bus by **spawning `busctl`**. That is fine for
capability probing and for creating a session whose handle only feeds
diagnostics, and it **cannot** work for pasting: a RemoteDesktop session is owned
by the D-Bus connection that created it, each `busctl` invocation is its own
connection, and the session dies when that process exits. There is nothing left
to send `NotifyKeyboardKeysym` to, and `Start` cannot be awaited across
invocations because its result arrives as a signal on the same connection.

So the driver needs a **persistent in-process D-Bus connection**, and that is a
new dependency. `ashpd` (which wraps `zbus`) is the choice: it models session
lifetime and restore tokens directly, and `ROADMAP.md` notes that enigo's
`libei_tokio` feature becomes cheap once `ashpd` is in the tree.

**`ashpd` and `zbus` are not two options to pick between per environment.**
`ashpd` *is* a layer over `zbus` and pulls it in; taking both would be a
duplication, not a fallback. The per-environment fallback is real but lives one
level up, at the injection mechanism (the probe table above), not at the D-Bus
library.

## Sequence

| Step | What | State |
| --- | --- | --- |
| 1 | Stop losing the transcript when a paste cannot be confirmed | **done** 2026-08-18, ADR 0227 → **corrected by ADR 0229** |
| 2 | Correct `PLATFORMS.md`, which described the portal path as shipped behaviour | **done** 2026-08-18 |
| 3 | Decide the dependency and the grant flow | **decided** 2026-08-18: `ashpd`. Grant flow still open, see below |
| 4 | `NativeInsertDriver::RemoteDesktopPortal` over a persistent connection, `Ctrl+V` via `NotifyKeyboardKeysym` | **done** 2026-08-18, `core/portal_session.rs` |
| 5 | Move the restore token out of `$XDG_RUNTIME_DIR` | **done** 2026-08-18, `$XDG_STATE_HOME/wordscript/remote-desktop-grant.json`, `0600` |
| 6 | Wire it into the chain behind the probe, one driver per run | **done** 2026-08-18, `PasteLane` + ADR 0228's table, with tests per row |
| 7 | Verify in the native host against a native Wayland window and an XWayland window | **half done** -- the runtime half is measured, the two pastes are owed. See below |
| 8 | Consider `ConnectToEIS`/libei as the injection call, now cheap | **considered, deferred** 2026-08-18. See below |

### What step 4-6 landed, and the two bugs they had to clear first

The driver was not the hard part. **The portal path was closed twice over on the
reporting machine, and neither closure said a word** -- which is why the log
carried no portal line at all rather than a failure:

1. `detect_compositor()` searched for `"plasma"`; this machine answers `KDE` for
   both desktop variables, so a Plasma 6 session was classified `Other`,
   `supports_remote_desktop_portal()` was false, and the caller returned without
   logging. `plasmashell 6.7.0` sat behind the branch that never ran.
2. `detect_portal_capabilities()` looked for the interface in
   `busctl --user list`, which lists **bus names**. `RemoteDesktop` is an
   interface on `org.freedesktop.portal.Desktop`; `busctl --user list | grep -ci
   remotedesktop` is `0` on every machine, while
   `get-property ... RemoteDesktop version` answers `u 2`.

Both are the same failure: a probe answering "no" for a reason unrelated to the
question. Both are fixed, and the startup path now logs the case where it does
nothing. Recorded in [ADR 0234](../decisions/0234-the-input-permission-is-asked-for-once-in-settings-and-a-desktop-that-cannot-be-named-no-longer-closes-the-path.md).

The `busctl` session creation (`request_remote_desktop_session`, `busctl_call`)
is **removed**, not repaired: it sent no `persist_mode` and never read the
`restore_token` out of `Start`, so any grant it obtained was a fresh one every
time. That is a sufficient mechanism for the owner's memory of being asked "every
damn time", though the version they remember is months old and unprovable from
the surviving log.

The grant flow the owner settled: **one button in Delivery & Insert, and no
dictation ever raises the dialog.** A refusal is remembered rather than re-asked;
the delivery mode is not changed behind the user's back. Both answers are written
into [ADR 0228](../decisions/0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md),
now Accepted.

### Step 7: what is measured, and the two pastes that are owed

**Measured on the reporting machine, 2026-08-18, app running from `main`:**

```
[WordScript] Portal grant restore phase=NotGranted session_active=false
    elapsed_ms=115 detail=Insert at cursor has no input-device permission on
    this desktop yet. Grant it once in Delivery & Insert; ...
```

That line is the whole first half: the compositor is named, the interface
answers, the grant state is read, and **no dialog appeared** -- the restore path
returns without touching the portal when there is no token. `npm test` (927),
`cargo test` (985) and `npm run build` are green.

**What is owed, and it needs the owner because it needs a human answering a
dialog:**

1. Press **Grant access** in Delivery & Insert once. The "Control input devices"
   dialog should appear exactly once.
2. Dictate into a **native Wayland window** (a KDE app, or anything not running
   under XWayland) with a profile whose delivery is *Copy and insert at cursor*.
   Expect `active_driver=remote_desktop_portal`, `insert_mode=direct_paste`, and
   the previous clipboard restored afterwards.
3. Dictate into an **XWayland window** and expect `active_driver=xdotool` --
   the probe must still choose the old lane where the old lane works.
4. **Restart the app** and press nothing. Expect
   `Portal grant restore phase=Granted session_active=true` in the log, and no
   dialog. **This is the measurement the whole driver rests on**, and it is the
   one thing here that is the compositor's behaviour rather than ours: if KWin
   re-prompts despite `ExplicitlyRevoked` and a stored token, the driver is worth
   less than it looks and ADR 0228 needs revising rather than shipping. The
   `Start` call's elapsed time is logged, so a dialog shows up as seconds where
   milliseconds belong.

Read the log with `grep -i portal ~/.config/WordScript/logs/wordscript-runtime.log`,
and `history.json` sorted by `created_at_ms` -- **the file is not in time order**.

### Step 8: considered, and deliberately not taken

`ConnectToEIS` is present here (RemoteDesktop version 2), and ADR 0228 is right
that it is the better long-term path. It is still not worth doing now: it means a
`reis` dependency and an ei event loop against a keysym call that is two D-Bus
messages and already delivers. Its own argument for deferral holds -- the call
site can be replaced later without moving the driver's position in the chain.
Revisit it if `NotifyKeyboardKeysym` turns out to drop keys under load, which
nothing so far suggests.

### Step 5 is not cosmetic

`portal_token_path()` writes under `XDG_RUNTIME_DIR`, which is cleared on reboot.
That turns "one grant ever" into "one grant per boot" — close enough to the
per-paste prompt the owner rejected that it would undo the reason this driver was
chosen. It belongs under `$XDG_STATE_HOME` (or `~/.local/state/wordscript/`),
mode `0600`.

### Open decisions for step 3

1. Is the first grant requested **lazily**, on the first `auto_paste` run that
   needs it, or offered up front in Settings as a one-time "enable insert on
   Wayland" action? Lazy raises a dialog mid-dictation on a fresh install; up
   front puts it where the user is already configuring.
2. If the grant is refused or later revoked, does `auto_paste` fall back to the
   clipboard with its stated reason (as it does now), or does it turn the
   delivery mode off and say so?

## Records this track carries

| Record | State |
| --- | --- |
| [`auto-paste-reports-success-without-inserting.md`](../known-issues/auto-paste-reports-success-without-inserting.md) | false success closed; the missing lane is this track |
| [`insert-behavior-reverts.md`](../known-issues/insert-behavior-reverts.md) | separate bug, easily confused with this one — that is the config side, this is the runtime side |
| [`ADR 0227`](../decisions/0227-every-route-into-a-native-reveal-goes-through-the-coalescer-and-a-driver-that-cannot-reach-its-target-says-so.md) | accepted |
| [`ADR 0228`](../decisions/0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md) | **accepted** 2026-08-18, with both open questions answered |
| [`ADR 0234`](../decisions/0234-the-input-permission-is-asked-for-once-in-settings-and-a-desktop-that-cannot-be-named-no-longer-closes-the-path.md) | accepted — the grant flow, and the two detection bugs that hid this path |

## What this track deliberately does not do

- **It does not add `wtype` or `ydotool`.** Rejected by the owner on prompt
  grounds, and the rejection is recorded rather than re-litigated.
- **It does not change the delivery-mode semantics.** "Copy to clipboard only"
  is untouched; this is only about what "Copy and insert at cursor" does when it
  cannot insert.
- **It does not touch macOS or Windows.** Both have working insert paths and no
  portal in this sense.
