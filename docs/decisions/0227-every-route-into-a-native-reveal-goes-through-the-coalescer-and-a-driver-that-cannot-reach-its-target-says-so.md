# 0227 - Every route into a native reveal goes through the coalescer, and a driver that cannot reach its target says so

Date: 2026-08-18
Status: Accepted, **except decision 2, which is superseded by
[ADR 0229](0229-an-unconfirmable-paste-is-still-attempted-and-what-it-costs-is-the-clipboard-restore.md)
(same day).** The refusal it introduced turned an unreliable paste into one that
never worked; the measurement behind it stands, the inference did not.

## Context

Two failures were reported together from the same session, and measuring them
turned out to answer a third.

Both had the same shape: **a mechanism that reports success while doing
nothing**, and a comment in the tree asserting the failure could not happen.

### The overlay stacked two surfaces

`docs/known-issues/overlay-ghosting.md` had four causes found and fixed since
Phase 2 (ADR 0011a, ADR 0018, ADR 0019). Its standing note from 2026-07-30 was
"Still not reproduced: the exact stacking in the screenshot" -- every earlier
cause had been found by reading code, and the file says so explicitly.

The owner supplied the missing recipe: delivery `auto_paste`, activation `hold`,
and **a new capture started while the result surface was still on screen**
(inside the `result_actions_timeout_s` window, 9 s by default).

An instrumented run (`VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1`, 4498 trace lines,
`#n` contiguous) separated the two directions cleanly:

| Transition | When | `[ov-reveal]` |
| --- | --- | --- |
| `compact -> result_actions` | a dictation ends | **1** |
| `result_actions -> compact` | **a capture starts while the result is shown** | **2** |

Four occurrences, no exceptions. The two reveals carried competing geometry:

```
#2633 [ov-sched]  flush surface=compact
#2634 [ov-reveal] req=[480,60]  outer=[480,61]
#2635 [ov-reveal] req=[480,61]  outer=[480,60]
```

In the first occurrence a reveal (`#122`) was logged **before** the frontend's
own flush (`#121`) -- only possible from a second, independent source.

That source was `apply_trigger_effect::StartCapture`, which called
`reveal_overlay_window` (direct) while React concurrently called
`sync_overlay_window_visibility` -> `reveal_overlay_window_coalesced`. Both
reach `reveal_overlay_window_impl`, and each performs its own
`OVERLAY_FLAT_REVEAL_TICK.fetch_add` -- producing exactly the multi-`set_size`
cascade with competing heights (RC1/RC3) that the coalescing exists to prevent,
and that WebKitGTK renders as the new pill stacked on the old one's raster.

The direct path was documented as safe:

> `reveal_overlay_window` (direct) -- synchronous, used by the StartCapture
> trigger (the frontend's reveal for `recording_started` only fires in the
> REACTION render, so there is no same-frame competition here).

That holds only when the overlay was **idle** before the trigger: React is not
yet active, so its reveal genuinely lands a frame later. It does not hold when a
result surface is still shown -- there React is already active, the surface swap
re-runs both reveal-requesting layout effects in the same commit, and they flush
on a microtask, i.e. the same frame as the trigger.

### Auto-paste reported success without inserting anything

On the reporting machine (`XDG_SESSION_TYPE=wayland`, KDE, `DISPLAY=:0` from
XWayland, `xdotool` present, no `wtype`/`ydotool`),
`paste_driver_execution_chain` yields `[Xdotool]` and returns immediately. That
is the session's only paste mechanism, and `PLATFORMS.md` already says so.

Every Linux paste driver that survives on that lane drives input through XTEST
(`xdotool` directly, `enigo` through its default `x11rb` backend). XTEST
delivers to whatever **the X server** considers focused. Measured:

```
xdotool getactivewindow              -> 2097152 (0x200000)
xdotool getactivewindow getwindowname -> (empty)
```

There is no focused X client. When the target is a native Wayland window, the
key event has no recipient -- and `xdotool` still exits 0, because the request
was successfully *sent*.

`history.json` shows the consequence: nine consecutive `auto_paste` runs, all
`insert_mode: direct_paste`, `pasted: true`, `fallback_reason: null`. The
runtime recorded a successful insert for every run, including those that
inserted nothing. It works "sometimes" because it works whenever the target
happens to be one of the session's XWayland clients.

`PLATFORMS.md` had described the adjacent case correctly -- a compositor that
*refuses* the XTEST grant produces an error, and the run falls back to the
clipboard. A grant that is *accepted* and lands nowhere produced no error to
fall back from, so the fallback never ran and the history record said the
opposite of what happened.

### What the same measurement said about the hold watchdog

The reported "a recording ended by itself after two minutes, I had not released
the key" was resolved by the trigger log rather than by a new hypothesis:

```
+417.5  shortcut  state=pressed        hold_provisional_start
+417.9  hold_arm  hold_session=3       committed
+537.9  hold_watchdog after_seconds=120  outcome=release_missing
+542.4  shortcut  state=released       ignored_release_without_press
```

Twice, and the same shape both times. No release was lost: it arrived ~4 s
**after** the watchdog had already stopped the session. `DEFAULT_HOLD_WATCHDOG_SECONDS`
is 120, the key was still down, and the outcome was logged as `release_missing`
-- a name that asserts a defect where the actual event is "this hold reached its
ceiling". Naming it after a failure sent one investigation looking for a lost
event that was never lost.

## Decision

**1. Every route into `reveal_overlay_window_impl` goes through the coalescer.**
The trigger path is not exempt. The tick invariant ("one `fetch_add`, therefore
one `set_size`, per frame") is a property of the call graph, not of the statics,
so it is enforced against the call graph: a test reads the production half of
`lib.rs` and fails if any caller outside `reveal_overlay_window_coalesced`
reaches the impl.

**2. A paste driver that cannot reach its target refuses instead of reporting a
paste.** On a hybrid XWayland session the chain probes the X focus once, before
attempting anything. No focused X client means the run ends as a clipboard
fallback with a stated reason, and the paste is not attempted at all.

The probe is three-valued, and only `Unreachable` refuses. A probe that could
not run reports `Unknown` and the paste proceeds: refusing on an inconclusive
probe would trade a silent failure for a silent refusal, which is the same
defect wearing the opposite sign.

**3. A watchdog outcome is named after what was observed.** `hold_limit_reached`,
not `release_missing`. The watchdog cannot distinguish a lost release from a
long dictation, and it ends both; its configured value is therefore a hard
ceiling on a single dictation, not merely a safety net.

## Consequences

- The trigger reveal now pays the coalescer's 0-ms tokio yield, the same one
  every frontend reveal already pays.
- `auto_paste` on this lane will report clipboard fallbacks where it previously
  reported successful inserts. That is not a regression: those runs never
  inserted anything. It makes the missing Wayland paste lane visible instead of
  hiding it behind a success record, and it is the precondition for a second
  driver ever being reached -- a chain whose first driver always claims success
  never advances to a second.
- The X focus probe costs one `xdotool` process launch per `auto_paste` run on
  hybrid sessions only (~30 ms against an insert that already takes ~30 ms).
  Pure X11 is not probed: there the focus is always a real X client.
- `hold_watchdog_seconds` is exposed in config and IPC but on no settings
  screen, so the 120 s ceiling is currently not adjustable by the user. Left
  open deliberately; raising the default or building the control is a product
  decision, recorded in
  [capture-shortcut-recording.md](../known-issues/capture-shortcut-recording.md).
- The still-open question is what a *working* paste lane on Wayland should be.
  `org.freedesktop.portal.RemoteDesktop` v2 is present on the reporting machine
  with `NotifyKeyboardKeysym` and `ConnectToEIS`; see
  [ROADMAP.md](../ROADMAP.md).

## References

- [ADR 0011a](0011a-one-decision-surface-per-delivery-mode.md), [ADR 0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md), [ADR 0019](0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md): the four earlier causes in this failure class
- [overlay-ghosting.md](../known-issues/overlay-ghosting.md)
- [auto-paste-reports-success-without-inserting.md](../known-issues/auto-paste-reports-success-without-inserting.md)
- [PLATFORMS.md](../PLATFORMS.md): the Linux Wayland lane and why it has exactly one paste mechanism
