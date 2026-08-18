# 0228 - The second paste driver is the RemoteDesktop portal, and the focus probe is what sequences it

Date: 2026-08-18
Status: **Accepted 2026-08-18.** Implemented the same day; the two open questions below were answered by the owner and are recorded under *Answers*. The grant flow they settled has its own record in [ADR 0234](0234-the-input-permission-is-asked-for-once-in-settings-and-a-desktop-that-cannot-be-named-no-longer-closes-the-path.md).

## Context

[ADR 0227](0227-every-route-into-a-native-reveal-goes-through-the-coalescer-and-a-driver-that-cannot-reach-its-target-says-so.md)
stopped `auto_paste` from reporting inserts that never happened. It did not give
the lane a way to insert. On a Wayland session with XWayland alongside there is
still exactly one paste mechanism, XTEST, and it cannot reach a native Wayland
window.

What is present on the reporting machine, measured 2026-08-18 over the session
bus:

```
org.freedesktop.portal.RemoteDesktop   version 2
  .NotifyKeyboardKeysym    method  oa{sv}iu
  .NotifyKeyboardKeycode   method  oa{sv}iu
  .ConnectToEIS            method  oa{sv} -> h
  .SelectDevices / .Start / .CreateSession
  .AvailableDeviceTypes    property u = 7   (keyboard | pointer | touchscreen)
```

Options considered and their standing:

| Candidate | Standing |
| --- | --- |
| `wtype`, `ydotool` | **Rejected by the owner, 2026-08-18.** A privilege prompt per paste "gets very annoying very quickly". |
| `enigo` | Not an alternative: the same XTEST request through a different binding, and it refuses while `xdotool` is in `PATH`. |
| `kdotool` | Drives windows through KWin scripting; cannot inject key input. |
| AT-SPI | Bus runs, but `toolkit-accessibility=false` and `QT_ACCESSIBILITY` unset here. Would work only for apps that happen to have accessibility on. |
| **RemoteDesktop portal** | **Agreed with the owner, 2026-08-18.** Its `restore_token` is what separates it from `wtype`/`ydotool`: one grant, then a restored session injects with no prompt per paste. |

## Decision (proposed)

**1. Add `NativeInsertDriver::RemoteDesktopPortal`, injecting `Ctrl+V` through
`NotifyKeyboardKeysym` on a restored RemoteDesktop session.**

`NotifyKeyboardKeysym` over `ConnectToEIS`: the keysym call is two D-Bus
messages and needs no libei, no `reis`, and no new input stack. `ConnectToEIS`
is the better long-term path and can replace the call site later without
changing the driver's position in the chain.

**2. The chain stays sequenced, and the ADR 0227 focus probe is what sequences
it.** This is the part that keeps the owner's objection answered — no driver is
ever tried blind, so no run can stack prompts:

| Probe result | Driver | Prompt |
| --- | --- | --- |
| `Reachable` (a real X client holds focus) | `xdotool` | none |
| `Unreachable` (native Wayland window holds focus) | RemoteDesktop portal | once ever, then none |
| `Unknown` | `xdotool`, then clipboard fallback | none |

The two drivers are mutually exclusive per run, decided before either is
launched. They are never attempted one after the other, and `wtype`/`ydotool`
stay out of the chain entirely.

**3. The restore token moves out of `$XDG_RUNTIME_DIR`.** `portal_token_path()`
currently writes under `XDG_RUNTIME_DIR`, which is cleared on reboot — that
turns "one grant ever" into "one grant per boot", which is close enough to the
per-paste prompt the owner rejected to matter. It belongs under
`$XDG_STATE_HOME` (or `~/.local/state/wordscript/`), mode `0600`.

## The blocker this draft exists to surface

`core/portal.rs` talks to D-Bus by **spawning `busctl`** (`busctl_call`, and
`request_remote_desktop_session` on top of it). That is sufficient for what it
does today — probing capabilities and creating a session whose handle feeds the
diagnostics panel — and it cannot work for pasting.

**A RemoteDesktop session is owned by the D-Bus connection that created it.**
Each `busctl` invocation is its own connection and closes when the process
exits, so the session is destroyed on the way out. There is nothing left to send
`NotifyKeyboardKeysym` to, and `Start` cannot be awaited across invocations
because its result arrives as a signal on the same connection.

So this driver cannot be built on the existing plumbing. It needs a **persistent
in-process D-Bus connection**, which means a new dependency:

| Option | Notes |
| --- | --- |
| `ashpd` | Portal-specific, wraps `zbus`, has a `RemoteDesktop` type with session lifetime and restore tokens modelled. Highest-level fit, heaviest tree. |
| `zbus` | The layer under `ashpd`. More code here, fewer assumptions, and the portal calls are few. |

`ROADMAP.md` already notes that `ashpd` is required either way and that enigo's
`libei_tokio` feature therefore becomes cheap once it is in.

**Decided 2026-08-18: `ashpd`.** The question was put to the owner as a choice
between the two, and the answer proposed taking both, per OS or environment,
with one as a fallback. That is not available and the reason is worth recording
rather than quietly overruling: **`ashpd` is a wrapper over `zbus` and pulls it
in.** They are two layers of one stack, not two implementations of one
interface, so "both" is a duplication rather than a redundancy — and neither
exists off Linux, where this path has no counterpart at all.

The per-environment fallback the answer was reaching for is real, and it lives
one level up: at the **injection mechanism**, in the probe table above. That is
where XTEST, the portal and the clipboard take over from one another by
environment, and it is the layer where a fallback buys something.

## Consequences

- The portal path becomes the first Linux paste mechanism that works against a
  native Wayland window. `PLATFORMS.md`'s KDE Plasma 6 / GNOME rows would then
  describe reality; today they describe this driver before it exists (corrected
  in place on 2026-08-18).
- One "Control input devices" dialog on first use, per user, and then none —
  provided item 3 lands. Without it, once per boot.
- The `busctl` path stays for capability probing; it is not replaced, only
  bypassed for the parts that need a live session.
- `detect_portal_capabilities` and `PortalPromptSignal` already model the prompt,
  so the diagnostics surface does not need reworking.
- Compositors without the interface (Hyprland, Sway, KDE Plasma 5) are unchanged:
  the probe reports `Unreachable`, no portal driver exists, and the run falls
  back to the clipboard with the reason it already states today.

## Open questions for the owner

1. Should the first grant be requested **lazily** on the first `auto_paste` run
   that needs it, or offered up front in Settings as a one-time "enable insert on
   Wayland" action? Lazy means the first dictation of a fresh install raises a
   dialog mid-flow; up front means the dialog appears where the user is already
   configuring.
2. If the portal grant is refused or revoked, does `auto_paste` fall back to the
   clipboard silently (with the stated reason, as now), or does it turn the
   delivery mode off and say so?

## Answers, 2026-08-18

**1. Up front in Settings, and nowhere else.** The owner's words were "either
properly once in the settings or not at all", against a memory of an early
WordScript that asked "every damn time". Lazy was rejected on that ground, and
the rule is stronger than the question asked for: no run may raise the dialog at
all, not as a first attempt and not as a retry. The two calls that can raise one
are the Settings button and the startup restore of an existing grant. See ADR
0234 for how that is enforced rather than intended.

The same answer raised a premise worth correcting rather than accepting: *"we are
on other drivers later anyway that do not need this."* There are none. Step 8's
`ConnectToEIS`/libei runs through **this same portal session and this same
grant** — it is a different transport, not a different permission. `wtype` and
`ydotool` were rejected for prompting per paste, `enigo` is XTEST through another
binding, `kdotool` cannot inject input, and AT-SPI is off on the reporting
machine. "Not at all" would therefore have meant: native Wayland windows stay
clipboard-only permanently. The owner chose to build it.

**2. A refusal is remembered, not re-asked.** The delivery mode stays as the
profile set it and the run falls back to the clipboard with its reason — but
after a refusal WordScript does not ask again on its own. The Settings row stays
and its button reads "Ask again", which is the only route back. Turning the mode
off was rejected: a setting that changes itself is a second thing to notice on
top of the failure, and the mode is still correct for XWayland windows on the
same machine.

## What the draft assumed and the code found

Two things were measured while implementing this, both of which the draft had
taken for granted.

**The portal path was unreachable on the reporting machine before any of this.**
`detect_compositor()` searched `XDG_CURRENT_DESKTOP` and `XDG_SESSION_DESKTOP`
for `"plasma"`; that machine answers `KDE` for both, so a KDE Plasma 6 desktop
was classified `Other`, `supports_remote_desktop_portal()` was false, and
`ensure_portal_session` returned early **without logging**. Not one portal line
appears in 6539 runtime-log lines. Corrected in ADR 0234.

**The `busctl` session could only ever have prompted every time.**
`request_remote_desktop_session` sent no `persist_mode` (so the portal default,
`DoNot`, applied) and never read the `restore_token` out of the `Start` response
— it wrote back the token it had loaded, which stores nothing. A grant obtained
that way is a fresh grant on every session by construction. That is a plausible
mechanism for the owner's memory of being asked repeatedly, though the version
they remember is months old and cannot be confirmed from the surviving log. The
function is removed rather than fixed: the live session now belongs to
`core/portal_session.rs`, and `busctl` keeps only the capability probing it was
adequate for.

## What landed, against the decision

- `NativeInsertDriver::RemoteDesktopPortal`, injecting Ctrl+V as four
  `NotifyKeyboardKeysym` calls (`XK_Control_L`, `XK_v`) on a session held open by
  a persistent `ashpd` connection on its own thread — decision 1.
- `PasteLane` carries the probe result and the session's liveness into
  `paste_driver_execution_chain`, which returns **exactly one driver** on every
  Wayland lane. `Unknown` deliberately stays on `xdotool` rather than spending
  the portal on a guess, which is ADR 0229's finding kept intact — decision 2.
- The grant record moved to `$XDG_STATE_HOME/wordscript/remote-desktop-grant.json`,
  mode `0600` in a `0700` directory, with `PersistMode::ExplicitlyRevoked` asked
  of the portal — decision 3.
- A portal paste that returns `Ok` counts as **confirmed delivery**, so the
  clipboard restore runs on the one lane where XTEST could never say so. That
  was not in the draft; it is the first case since ADR 0229 where the answer is
  a fact rather than a doubt.

**Not implemented, and not silently:** `ConnectToEIS` (step 8) stays deferred.
The interface is present here at version 2, but using it means a `reis`
dependency and an ei event loop, against a keysym call that is two D-Bus
messages and already works. The ADR's own reasoning — "can replace the call site
later without changing the driver's position in the chain" — still holds, so
there is nothing to gain by doing it now.

**Still unverified, and the reason the next step is a measurement:** that a
restored session actually suppresses the dialog on KDE Plasma 6. Everything here
asks the portal for a persistent grant and stores what it hands back; whether
KWin honours it across a restart is its behaviour, not ours, and the owner's
history says do not assume. The runtime log records the elapsed time of the
`Start` call, so a dialog that appears anyway is visible as seconds where
milliseconds belong.

## References

- [ADR 0227](0227-every-route-into-a-native-reveal-goes-through-the-coalescer-and-a-driver-that-cannot-reach-its-target-says-so.md): the focus probe this sequencing depends on
- [auto-paste-reports-success-without-inserting.md](../known-issues/auto-paste-reports-success-without-inserting.md)
- [PLATFORMS.md](../PLATFORMS.md), [ROADMAP.md](../ROADMAP.md)
