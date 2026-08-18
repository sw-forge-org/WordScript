# Bug: auto-paste reports a successful insert while inserting nothing

Status: **Open, and the first fix for it was withdrawn the same day.**
The measurement stands: nine runs recorded `pasted: true` with nothing
observable behind it. The inference did not -- ADR 0227 made the chain REFUSE to
paste when no foreign X window held the focus, and that turned "unreliable" into
"never", because KWin forwards XTEST from Xwayland into the compositor and it
can reach a Wayland window after all. Withdrawn by
[ADR 0229](../decisions/0229-an-unconfirmable-paste-is-still-attempted-and-what-it-costs-is-the-clipboard-restore.md):
the paste is attempted as before, and what the uncertainty costs is the
clipboard restore. **Confirming a paste is still unsolved.**

First reported: 2026-08-18, by the owner ("insert at cursor does not work on
this machine -- nothing lands at the cursor, and it is unreliable")
Affected area: `core/insertion.rs`, the Linux hybrid XWayland paste lane

## Symptom

With delivery set to "Copy and insert at cursor", the transcript sometimes does
not appear at the cursor. No error, no fallback notice, no indication that
anything went wrong. Reported as intermittent -- "the cursor is not always
detected".

Easily confused with the delivery mode reverting to clipboard-only, which is a
different bug with a different mechanism; see
[insert-behavior-reverts.md](insert-behavior-reverts.md). The two are told apart
in `history.json`, and that file is where this one was finally caught.

## Mechanism

The reporting machine is `XDG_SESSION_TYPE=wayland` on KDE, with XWayland
alongside (`DISPLAY=:0`), `xdotool` in `PATH`, no `wtype`, no `ydotool`. On that
lane `paste_driver_execution_chain` yields `[Xdotool]` and returns immediately
-- one driver, no second attempt. `PLATFORMS.md` already documents why.

Every paste driver that survives there drives input through the X11 XTEST
extension, and XTEST delivers to whatever **the X server** considers focused.
Measured 2026-08-18:

```
xdotool getactivewindow              -> 2097152 (0x200000)
xdotool getactivewindow getwindowname -> (empty)
```

`_NET_ACTIVE_WINDOW` points at a placeholder with no `WM_NAME`. There is no
focused X client at all -- the focused window is a native Wayland client, and a
native Wayland client cannot receive XTEST.

**`xdotool` still exits 0.** The request was successfully *sent*; nothing in the
exit status says whether it was *delivered*. `run_paste_driver_chain` read that
zero as success, `execute_insert_request_with_io` set `pasted = true`, and the
run was recorded as a direct paste.

### The evidence

All nine `auto_paste` runs in `history.json` on 2026-08-18, during a window in
which the owner reported repeated failures:

| `work_mode.insert_behavior` | `insert_mode` | `pasted` | `fallback_reason` | `active_driver` | count |
| --- | --- | --- | --- | --- | --- |
| `auto_paste` | `direct_paste` | `true` | `null` | `xdotool` | 9 |

Zero fallbacks recorded, and `wordscript-runtime.log` shows
`Native insert paste strategy=xdotool elapsed_ms=27..33` for each. The runtime
had no idea anything had failed.

"Sometimes it works" is consistent with this and not with an intermittent
driver: it works whenever the target happens to be one of the session's XWayland
clients, and fails whenever it is a native Wayland window.

### How few XWayland clients there actually are

Enumerated later the same day, the complete list of visible X windows in that
session was:

```
"wordscript", "Wordscript" :: WordScript
"wordscript", "Wordscript" :: WordScript - Settings
```

**Both of them are ours.** The editor, the browser and the terminal are all
native Wayland clients.

**The conclusion drawn from this was wrong, and is kept here as the error it
was.** It read as "XTEST has no reachable foreign target here, so `xdotool` is
inert", and the owner contradicted it from experience -- auto-paste *had* worked
occasionally against those very windows. It can: **KWin forwards XTEST fake
input from Xwayland into the compositor**, which delivers it to the focused
Wayland window. The enumeration was accurate; the delivery path simply does not
end where the enumeration was looking. See
[ADR 0229](../decisions/0229-an-unconfirmable-paste-is-still-attempted-and-what-it-costs-is-the-clipboard-restore.md).

One real hazard did come out of it: if the focus lands on the overlay or the
settings window, `getactivewindow` returns a named X window that is **ours**. The
probe treats that as unconfirmable (`getwindowpid` vs `std::process::id()`; a
window that does not answer `_NET_WM_PID` is somebody else's, since the question
is "is this definitely us").

## Why the existing fallback did not catch it

`PLATFORMS.md` analyses the adjacent case correctly:

> So if a compositor refuses the XTEST grant, there is no independent second
> mechanism to fall back to, and the run delivers to the clipboard instead.

A **refused** grant produces an error, and the clipboard fallback runs. This bug
is the opposite: the grant is **accepted** and lands nowhere. No error, so
nothing to fall back from. The recovery path was never reached because from the
runtime's perspective there was nothing to recover from.

## What was tried, withdrawn, and kept (ADR 0227 -> ADR 0229)

**Tried:** the chain probed the X focus and REFUSED to paste when no foreign X
window held it, ending the run as a clipboard fallback with a stated reason.

**Withdrawn within hours.** The refusal made auto-paste fail every time on a lane
where it had previously worked now and then. `Unreachable` was being read as
evidence of absence when it is only absence of evidence.

**Kept:** the probe, repurposed. It no longer gates the paste; it decides whether
the **clipboard restore** is safe. `auto_paste` puts the transcript on the
clipboard as the transport for `Ctrl+V` and then restores the previous contents a
moment later -- so a run that did not insert leaves the user with neither the
paste nor the text. When delivery cannot be confirmed the transcript stays put
(`NativeClipboardRestoreStatus::SkippedDeliveryUnverified`).

Pinned by `an_unconfirmable_delivery_keeps_the_transcript_on_the_clipboard`,
which feeds the fake IO a **succeeding** xdotool because that is what the real
one does, and asserts both that the paste still ran and that nothing was
scheduled to overwrite the transcript.

## Closed on one lane, 2026-08-18: a paste that can confirm itself

`NativeInsertDriver::RemoteDesktopPortal` shipped the same day this was written
up. On a Wayland session where a **native Wayland window** holds the focus, the
paste is now a `NotifyKeyboardKeysym` call that returns a result, so the run
knows whether the compositor took the keys -- and the clipboard restore, withheld
whenever delivery could not be confirmed, runs again there.

**The XWayland lane is unchanged and still cannot confirm anything.** `xdotool`
exits 0 whether or not a client was listening, so a run that lands there still
leaves the transcript on the clipboard rather than restoring over it. That half
of this issue stays open, and it stays open on purpose: ADR 0229 established that
an unconfirmable paste is still worth attempting, and nothing here changes that.

Two things gated the fix and are worth keeping, because they explain why the
portal looked absent on a machine that has it: `detect_compositor()` classified
this KDE Plasma 6 desktop as `Other` (it looked for `"plasma"` in a variable that
reads `KDE`), and the interface probe grepped `busctl --user list` for an
interface name that can only be a bus name. Both returned "no" for reasons
unrelated to the question, and the compositor one returned it in silence. See
[ADR 0234](../decisions/0234-the-input-permission-is-asked-for-once-in-settings-and-a-desktop-that-cannot-be-named-no-longer-closes-the-path.md).

### The landscape this was chosen out of

Ruled out by product decision or by the platform:

- `wtype`, `ydotool` -- raise a compositor privilege prompt per paste. The owner
  rejected these on 2026-08-18 ("that gets very annoying very quickly"). If they
  are ever revisited they must be **sequenced**, never attempted alongside
  `xdotool`, so one refused driver does not buy a second prompt.
- `enigo` -- the same XTEST request through a different binding, and it refuses
  outright while `xdotool` is in `PATH`. An alternative, never a fallback.
- `kdotool` -- drives windows through KWin scripting, cannot inject key input.
- AT-SPI -- the bus runs (`org.a11y.Bus`), but `toolkit-accessibility` is
  `false` and `QT_ACCESSIBILITY` is unset here, so it would work only for
  applications that happen to have accessibility enabled.

The mechanism chosen, agreed with the owner on 2026-08-18 and present on this
machine: `org.freedesktop.portal.RemoteDesktop` **v2**, offering
`NotifyKeyboardKeysym`, `NotifyKeyboardKeycode` and `ConnectToEIS` (libei), with
`AvailableDeviceTypes=7`. Its `restore_token` is what distinguishes it from
`wtype`/`ydotool`: one grant, then a restored session injects without a prompt
per paste.

**Measured 2026-08-18:** the restored grant does suppress the dialog across an
app restart on KDE Plasma 6. Twelve starts with the stored token and nothing
pressed, `Start` returning in 7-20 ms and the token coming back unrotated every
time -- milliseconds is a compositor honouring `ExplicitlyRevoked`, where a
dialog somebody had to read would have been seconds. The other lane is measured too: a
dictation ending in an **XWayland** window chose `xdotool` (31 ms) with a grant
in place, and its clipboard restore ran -- which only a confirmable delivery
allows. So both halves of the sequencing are recorded rather than reasoned; see
[`../tracks/insert-delivery.md`](../tracks/insert-delivery.md).

## Related

- [ADR 0227](../decisions/0227-every-route-into-a-native-reveal-goes-through-the-coalescer-and-a-driver-that-cannot-reach-its-target-says-so.md)
- [ADR 0228](../decisions/0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md): the driver that closes the Wayland half of this
- [ADR 0234](../decisions/0234-the-input-permission-is-asked-for-once-in-settings-and-a-desktop-that-cannot-be-named-no-longer-closes-the-path.md): the grant flow, and the two probes that hid the path
- [insert-behavior-reverts.md](insert-behavior-reverts.md): the config-side bug this is easily confused with
- [PLATFORMS.md](../PLATFORMS.md): the Linux Wayland lane
- [ROADMAP.md](../ROADMAP.md): the libei / RemoteDesktop candidate
