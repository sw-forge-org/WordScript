# Kick-off — after Leg 2: one measurement, then this track closes

## State at handoff (2026-08-18, night)

**Leg 2 is built.** Steps 4–8 of [`insert-delivery.md`](insert-delivery.md) are
done or deliberately deferred, on `main`, **not pushed**. `cargo test` 985,
`npm test` 927, `npm run build` green. The nine `cargo check` warnings are all
present at `HEAD` and belong to other code.

**The `busctl` blocker is gone.** `core/portal_session.rs` holds a RemoteDesktop
session open on a persistent `ashpd` connection, on one thread, for the app's
lifetime. `NativeInsertDriver::RemoteDesktopPortal` sends Ctrl+V as four
`NotifyKeyboardKeysym` calls on it. `request_remote_desktop_session` and
`busctl_call` are removed; `busctl` keeps only the capability probing.

**The grant flow the owner settled:** one button in Delivery & Insert, and no
dictation ever raises the dialog. A refusal is remembered rather than re-asked.
Both answers are in [ADR 0228](../decisions/0228-the-second-paste-driver-is-the-remotedesktop-portal-and-the-focus-probe-is-what-sequences-it.md)
(now Accepted); the flow itself and the two bugs that hid this path are
[ADR 0234](../decisions/0234-the-input-permission-is-asked-for-once-in-settings-and-a-desktop-that-cannot-be-named-no-longer-closes-the-path.md).

## The one thing that is owed, and why nobody else can do it

**Four steps with the app running. Nothing else in this track moves until they
run**, because the whole driver rests on a behaviour that is KWin's rather than
ours: that a restored grant does not prompt again.

1. Open **Delivery & Insert → Insert on Wayland** and press **Grant access**.
   The "Control input devices" dialog should appear exactly once.
2. Dictate into a **native Wayland window** with a profile set to *Copy and
   insert at cursor*. Expect `active_driver=remote_desktop_portal`,
   `insert_mode=direct_paste`, and your previous clipboard back afterwards.
3. Dictate into an **XWayland window**. Expect `active_driver=xdotool` — the
   probe must keep the old lane where the old lane works.
4. **Restart the app and press nothing.** Expect
   `Portal grant restore phase=Granted session_active=true` in the log, and **no
   dialog**. This is the measurement. If a dialog appears here, the restore token
   is not doing its job, the driver is worth much less than it looks, and ADR
   0228 needs revising rather than shipping. The `Start` call's elapsed time is
   logged, so a dialog reads as seconds where milliseconds belong.

Reading key: `grep -i portal ~/.config/WordScript/logs/wordscript-runtime.log`.
**`history.json` is not in time order — sort by `created_at_ms`.**

## Still open from Leg 1, and still not yours to guess at

- **Two owner reproductions**, instrument in place, reading key in
  [`../known-issues/capture-shortcut-recording.md`](../known-issues/capture-shortcut-recording.md):
  a window opened mid-hold, and a dictation carried past three minutes (also
  item 6 of [`open-fixes-leg1-part2.md`](open-fixes-leg1-part2.md)). **Do not
  build a fix for either until one of them has run.**
- **The overlay double reveal at app start** stays open and measured, not fixed:
  same surface twice, 108 ms apart, one flush, so it entered from a native route.
  [`../known-issues/overlay-ghosting.md`](../known-issues/overlay-ghosting.md)
  carries the numbers.

## Two things worth knowing before you touch this area

**A probe that answers "no" is not the same as a fact about the machine.** This
leg lost its first hours to two of them, both silent: `detect_compositor()`
looked for `"plasma"` in variables that read `KDE`, and the interface check
grepped a list of bus *names* for an *interface* name. Between them the portal
path had never once been entered, and the log said nothing because the early
return that closed it carried no line. If something here reports a capability as
absent, confirm it against the bus before believing it.

**A complete measurement is not a complete model** — the warning from the
previous session still stands. ADR 0227 decision 2 was withdrawn hours after it
landed (→ ADR 0229) because a complete enumeration of the session's X windows
supported a conclusion the owner's "it worked sometimes" contradicted, and the
owner was right: KWin forwards XTEST from Xwayland into the compositor. Ask
before concluding that something cannot happen.

**Replace this file when the measurement has run and the track closes.**
