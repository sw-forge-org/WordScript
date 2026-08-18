# Track — Insert delivery

**Closed 2026-08-18, and frozen.** Steps 1-7 done, 8 deliberately deferred. Both
paste lanes are measured from real dictations -- the RemoteDesktop portal into
native Wayland windows (9 ms, 2 ms) and `xdotool` into an XWayland window
(31 ms) -- and twelve app restarts restored the grant with no dialog, which is
the measurement ADR 0228 rested on. Read for derivation, not as current truth:
what the product does today is [`../STATUS.md`](../STATUS.md) and
[`../PLATFORMS.md`](../PLATFORMS.md), and the rules are the ADRs it names.

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
| 3 | Decide the dependency and the grant flow | **done** 2026-08-18: `ashpd`, and the grant flow is one button in Delivery & Insert with a refusal remembered rather than re-asked (ADR 0228's two answers, built in ADR 0234) |
| 4 | `NativeInsertDriver::RemoteDesktopPortal` over a persistent connection, `Ctrl+V` via `NotifyKeyboardKeysym` | **done** 2026-08-18, `core/portal_session.rs` |
| 5 | Move the restore token out of `$XDG_RUNTIME_DIR` | **done** 2026-08-18, `$XDG_STATE_HOME/wordscript/remote-desktop-grant.json`, `0600` |
| 6 | Wire it into the chain behind the probe, one driver per run | **done** 2026-08-18, `PasteLane` + ADR 0228's table, with tests per row |
| 7 | Verify in the native host against a native Wayland window and an XWayland window | **done** 2026-08-18 -- both windows, both drivers, from real dictations: the portal into native Wayland in 9 ms and 2 ms, `xdotool` into XWayland in 31 ms, and twelve restarts with no dialog. See below |
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

### Step 7: what is measured, and it is all of it

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

**Steps 1 and 2 are measured, on the reporting machine, 2026-08-18:**

```
[WordScript] Portal Start returned restore_token_sent=false elapsed_ms=8827
[WordScript] Portal session started devices=Keyboard restore_token_sent=false
    restore_token_stored=true restore_token_rotated=true start_elapsed_ms=8827
[WordScript] Portal grant requested phase=Granted session_active=true elapsed_ms=9012
[WordScript] Portal paste delivered elapsed_ms=9
[WordScript] Native insert paste strategy=RemoteDesktop portal elapsed_ms=9
[WordScript] Native insert state core done insert_mode=DirectPaste pasted=true
```

Read in order: the dialog appeared (8827 ms is a human reading it, and
`restore_token_sent=false` says correctly that there was nothing yet to restore
from), KDE returned a keyboard device and a token, and the token is on disk at
`~/.local/state/wordscript/remote-desktop-grant.json`, mode `0600`. Two
dictations then delivered through the portal in 9 ms and 2 ms. The chain only
reaches this driver when the focus probe answers `Unreachable`, so both landed in
a native Wayland window -- the case XTEST provably cannot serve.

**And the clipboard restore withheld since ADR 0229 came back on that lane.**
Six `Native insert delivery unconfirmed: no foreign X window held the focus`
lines precede the grant. After it, zero: the same machine, the same windows, and
a paste whose delivery is now a D-Bus call that returned `Ok`.

**Step 4 is measured, three times, and it is the good answer:**

```
[WordScript] Portal Start returned restore_token_sent=true elapsed_ms=18
[WordScript] Portal session started devices=Keyboard restore_token_sent=true
    restore_token_stored=true restore_token_rotated=false start_elapsed_ms=18
[WordScript] Portal grant restore phase=Granted session_active=true elapsed_ms=70
```

**Twelve app starts** on 2026-08-18, every one of them the dev host restarting
the process after a rebuild, nothing pressed and no dialog on screen: `Start`
returned with the stored token sent in **7 to 20 ms**, median 13, and
`rotated=false` on all twelve -- KWin handed back the token it was given. The one
`rotated=true` in the log is the original grant, where there was no token to hand
back. A rebuild restart is the same measurement as a manual one -- a new process
reading the token off disk -- and it is the stronger one for "press nothing",
because nobody was at the keyboard for any of them.

**KWin honours `ExplicitlyRevoked`, and ADR 0228 stands as written.** The
alternative reading was `elapsed_ms` in the thousands, which is a human reading a
dialog and would have made the driver worth less than it looks. The reading key,
because these numbers are the whole measurement:

```
[WordScript] Portal Start returned restore_token_sent=<bool> elapsed_ms=<n>
```

`restore_token_sent=false` would mean the grant was never persisted and the
prompt is ours, not KWin's -- a different bug with a different fix.
`restore_token_sent=true` with `elapsed_ms` in the thousands is the finding that
revises ADR 0228. In the low tens, KDE honoured the token and the driver is what
it claims. `Portal session started` repeats both alongside
`restore_token_rotated=`, which says whether the compositor handed back a
different token than the one it was given.

**Step 3 is measured up to the dictation, and that last part still needs the
owner.** Both halves of the XWayland lane were exercised on this machine on
2026-08-18 with a scratch KWrite window forced onto XWayland
(`QT_QPA_PLATFORM=xcb`), using the exact commands the runtime uses:

| Focused window | `getactivewindow getwindowname` | `getwindowpid` | Probe |
| --- | --- | --- | --- |
| KWrite (XWayland) | `step3-target.txt — KWrite` | `3614190`, not ours | `Reachable` |
| WordScript – Settings | `WordScript – Settings` | `3587753`, ours | `Unreachable` |

`Reachable` maps to `[Xdotool]` in `paste_driver_execution_chain`, which is unit
tested, and `xdotool key --clearmodifiers ctrl+v` -- the driver command itself --
put the clipboard into that XWayland window, read back out of its buffer. So the
probe answers correctly for a foreign X window, correctly refuses our own, and
the driver delivers where it says it does.

**And the dictation into an XWayland window landed on 2026-08-18 at 23:43:53**,
run by the owner, which is the row that closes this step:

```
[WordScript] Native insert clipboard strategy=wl-copy auto_paste=true
[WordScript] Native insert paste strategy=xdotool elapsed_ms=31
[WordScript] Native insert clipboard strategy=wl-copy auto_paste=false   (+217 ms)
[WordScript] Native insert state core done insert_mode=DirectPaste pasted=true
```

`history.json`: `active_driver: xdotool`, `insert_mode: direct_paste`,
`pasted: true`, **`clipboard_restore: scheduled`**. Read together those say more
than the driver name. The probe answered `Reachable`, so the chain chose the old
lane where the old lane works -- and the clipboard restore ran 180 ms later,
which happens only when delivery is confirmable. The Kate window carried its
unsaved-changes marker afterwards, so the text is in the buffer rather than
merely sent.

**The setup is worth writing down, because the first attempt measured the wrong
thing.** Four dictations went into a `kate` window that looked like the target and
was not: KDE editors are single-instance, so `QT_QPA_PLATFORM=xcb kate <file>`
hands the file to the already running Wayland instance over D-Bus and exits, and
the environment variable never reaches a process. Those four runs chose the portal
and were right to -- a native Wayland window really did hold the focus. The
command that produces a genuine X client is
`QT_QPA_PLATFORM=xcb kate --new <file>`, and the check that it worked is that the
window appears in `xdotool search --onlyvisible --name .` -- where, on this
machine, the only other entries are WordScript's own two windows.

**Nothing in the log said which way the probe answered**, which is why the first
attempt had to be diagnosed from outside the app. `Native insert paste
strategy=` names the driver, and the driver implies the probe, but only to a
reader who knows the table. If this lane is ever measured again, one line naming
the probe result and the chosen chain would make the run explain itself.

Read the log with `grep -i portal ~/.config/WordScript/logs/wordscript-runtime.log`,
and `history.json` sorted by `created_at_ms` -- **the file is not in time order**.

### The review pass over step 7, and the four defects it found

Reviewed 2026-08-18, after the driver landed. All four sat in the seam between
the session thread and what the Delivery screen is allowed to say about it, and
three of them were only reachable by a person actually pressing the button --
which is why the suite was green with them in.

1. **The grant button removed itself while its own dialog was open.** The portal
   thread serves one command at a time and the grant command waits up to two
   minutes for a human. Status reads taken during that wait timed out, and the
   timeout path answered `Unsupported` -- the phase that means "this desktop has
   no portal", which `portal_grant_for_status()` maps to `null` and the screen
   draws as nothing at all. The same window opened for the first seconds after
   app start, while the background restore held the thread. The timeout now
   answers from what is knowable without the thread: the capability gate and the
   record on disk. It never claims a live session, because that is the one fact
   only the thread holds.
2. **The row and the action disagreed about what "possible" means.**
   `status()` gated on the compositor alone; `request_grant()` also required the
   interface to be reachable. A KDE box without `xdg-desktop-portal` therefore
   drew a working-looking button that made the section disappear when pressed.
3. **A failed paste reported a failed permission.** `NotifyKeyboardKeysym`
   errors and the paste timeout both reused `StartFailed`, whose label names the
   permission call. `PasteFailed` is its own variant now.
4. **Every dictation paid for a probe whose result was thrown away.**
   `detect_insert_platform_context()` called `detect_portal_capabilities()` into
   `let _` -- pre-existing, but step 6 had just turned that call from one
   subprocess into three. Removed, and `portal_is_possible()` is now answered
   once per run rather than on every settings poll.

A fifth, found chasing "the whole app feels slow": **`detect_compositor()` was
spawning `plasmashell --version` on every call.** ~95 ms measured here, to load a
Qt binary that prints a string. It sits under `detect_portal_capabilities()` AND
under the portal thread's status read, so one `native_insertion_status` paid it
twice -- and that command is issued every time the workspace palette opens and
every time the Delivery screen mounts. A session's compositor cannot change while
the process runs, so it is answered once. The effect is not subtle: the Rust
suite went from 41 s to 5.2 s, which means the old code spawned that binary
several hundred times in one `cargo test`.

`cargo test` 990, `npm test` and `npm run build` green. Steps 3 and 4 were still
owed when this pass ended; both are measured further up now.

### The second review pass, and where the portal's waiting was being paid

Reviewed 2026-08-18 with steps 3 and 4 measured. Nothing in the driver itself was
wrong; all three findings are about **which thread pays for the portal's
timeouts**, and none of them could fail a test, because a command that blocks is
correct in isolation and only wrong about where it runs.

1. **A status read blocked the main thread, twice, for up to 1.5 s.**
   `native_insertion_status` was a synchronous Tauri command, and a synchronous
   command runs on the main thread with the webview's JS event loop behind it
   -- the rule this file already states on `insert_text_native`, from State 09.
   Since the driver landed, that command asks the portal session thread twice:
   once through `portal_grant_for_status()` for the Delivery row, once through
   `platform_status()` for `session_is_live()`. That thread serves one command at
   a time, so while the permission dialog is up **both requests are guaranteed to
   wait out their full 750 ms timeout**, and the workspace palette issues one
   status read every time it opens. Now: every command in `insertion.rs` is
   `async` and does its work on a blocking worker through one shared helper, and
   the status read asks the portal once and hands `session_active` down to the
   platform description instead of asking again.
2. **`restore_last_transcript` ran a whole insert on the main thread** --
   clipboard write (measured at up to 800 ms), focus probe, paste driver, portal
   status and portal paste. It is the recovery button, so it is what somebody
   presses when an insert has *already* failed, and it froze the window while it
   ran. Same fix.
3. **App start paid 120-215 ms of subprocess probing before the first frame.**
   `restore_grant_in_background()` answered `portal_is_possible()` in Tauri's
   `setup`, on the main thread, and only then spawned the thread it names itself
   after. Measured here: `plasmashell --version` 98-175 ms,
   `xdg-desktop-portal --version` 27 ms, two `busctl get-property` calls 13-16 ms.
   The gate moved inside the thread; the log line it produces is unchanged.

A test now fails on any synchronous `#[tauri::command]` in `insertion.rs`. The
invariant is worth asserting rather than reviewing: every command in that file
reaches `status()`, and `status()` can wait on the portal thread.

`cargo test` 991, `npm test` 937 and `npm run build` green.

### Step 8: considered, and deliberately not taken

`ConnectToEIS` is present here (RemoteDesktop version 2), and ADR 0228 is right
that it is the better long-term path. It is still not worth doing now: it means a
`reis` dependency and an ei event loop against a keysym call that is two D-Bus
messages and already delivers. Its own argument for deferral holds -- the call
site can be replaced later without moving the driver's position in the chain.
Revisit it if `NotifyKeyboardKeysym` turns out to drop keys under load, which
nothing so far suggests.

### Step 5 was not cosmetic, and it is done

`portal_token_path()` wrote under `XDG_RUNTIME_DIR`, which the system clears on
reboot. That turns "one grant ever" into "one grant per boot" — close enough to
the per-paste prompt the owner rejected that it would undo the reason this driver
was chosen. It lives under `$XDG_STATE_HOME/wordscript/remote-desktop-grant.json`
at mode `0600` in a `0700` directory, and a test fails if that path ever moves
back under the runtime dir.

### The two open decisions for step 3 are answered

Both were the owner's, both on 2026-08-18, and both are written into
[ADR 0228](../decisions/0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md)
rather than repeated here: the grant is asked for **up front**, by one button in
Delivery & Insert that no dictation can reach, and a refusal leaves `auto_paste`
falling back to the clipboard with its stated reason rather than switching the
delivery mode off behind the user's back.

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
