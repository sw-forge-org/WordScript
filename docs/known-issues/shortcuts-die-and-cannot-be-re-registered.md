# Bug: the capture shortcut stops arriving, and nothing in the app can rebuild it

Status: **Half fixed (2026-08-18). The self-heal is restored — the idempotency
guard no longer blocks a later re-registration. WHY the grabs stop delivering is
NOT diagnosed, and this record exists mostly to make the next occurrence
measurable.**

First reported: 2026-08-18, by the owner mid-session ("I can't start any
recording at all, no matter which setting I change")
Affected area: `core/trigger.rs`, `register_native_shortcuts`, and the
`vendor/global-hotkey` X11 backend

## Symptom

The capture key stops doing anything. No overlay, no recording, no error.
Changing settings does not help — and *specifically* does not help, which is the
part that identified the second half of the bug.

## What the log shows

The last session before the failure ran completely and cleanly — capture,
transcription, transform, clipboard write, session completed, overlay parked.
Nothing failed. Then:

```
+120.0  [trigger] event=shortcut  id=60 binding=capture state=pressed
+121.9  [trigger] event=shortcut  id=60 binding=capture state=released
+131.1  [trigger] event=register  outcome=skipped_idempotent
+131.6  [trigger] event=register  outcome=skipped_idempotent
   ... 14 more, none of them a shortcut event ...
```

**Not one `event=shortcut` afterwards.** Every event that reaches the process is
logged, including the ones that are then dropped (D12), so the absence is
evidence: the key press is not arriving at all. The grabs are gone while the
process still believes it holds them.

## Mechanism 1 — why there was no way back (fixed)

`register_native_shortcuts` carries an idempotency guard:

> Idempotency guard: skip unregister/re-register when shortcuts haven't changed.
> This prevents a brief gap where the shortcut is unregistered (and a user press
> would be silently dropped) on every concurrent startup call from multiple
> windows.

It compares `registered_hotkey`, `registered_pause_hotkey`,
`registered_abort_hotkey`, `registered_mode_hotkeys` and `hotkey_ids` — **all of
them state the process kept**, none of them the grabs the OS actually holds. A
registration that has died out from under the app therefore still looks current,
and every later attempt is skipped.

The only code path that could rebuild them is `resume_native_trigger`, which
works precisely because it clears those fields first:

```rust
// Force a real re-registration: the idempotency guard in
// `register_native_shortcuts` compares against these fields and would
// otherwise skip the work that suspending just undid.
```

and it is reachable **only through the hotkey recorder** — open the recorder for
any binding in Settings and close it again. That is the entire user-facing
recovery, it is undiscoverable, and until 2026-08-18 it was the only one short of
restarting the app.

**Fixed** by bounding the guard in time. Its stated purpose is bounded in time
already — "concurrent startup call from multiple windows" describes calls
arriving within moments of each other — so it now applies only within
`IDEMPOTENT_SKIP_WINDOW_MS` (10 s) of the last *real* registration. A request
minutes later is a deliberate act (a settings change, a repair attempt) and does
its work. Pinned by `the_idempotency_guard_only_covers_the_startup_burst`.

This restores the self-heal: changing any hotkey-relevant setting now rebuilds
the grabs.

## Mechanism 2 — why the grabs die (NOT diagnosed)

Unknown. What is established:

- **It predates the 2026-08-18 changes.** The rotated log ending 2026-08-15
  contains 296 windows with five or more setting-driven re-registrations and no
  key event in the following 60 s; the current log has 2. Whatever this is, it
  is not new.
- **It is not the pipeline.** The session before the failure completed normally
  end to end.
- **No `suspend`/`resume` was logged** around the failure, so the recorder was
  not the trigger.

Untested candidates, in the order worth testing:

1. **The binding is a bare `Shift`** on this machine
   (`event=register binding=capture shortcut=Shift`). It is the modifier most
   contended by other X clients, and `vendor/global-hotkey`'s X11 backend holds
   it as a passive `grab_key` on the root window. A competing grab, or a client
   that grabs the keyboard and exits badly, is the obvious first suspect.
2. **XWayland lost the keyboard.** The backend also listens on XInput2 raw
   events, which are device-level and focus-independent — but only for events
   Xwayland itself receives from the compositor.
3. **The backend's event loop thread died.** If the X connection breaks, no
   events arrive and nothing in the app notices; the state still says
   "registered". **See the addendum: this candidate was reachable by reading the
   file, and the silent path it named is closed.**

### Making the next occurrence measurable

The app already counts events per binding (`record_binding_observation`,
`ShortcutReleaseEvidence`: `unobserved` | `release_observed` | `release_missing`,
see [PLATFORMS.md](../PLATFORMS.md)). What it does not do is *act* on a binding
that has been registered for a long time and has never produced an event, nor
report it anywhere the user would look. That is the instrument this bug needs
before mechanism 2 can be pinned, and it does not exist yet.

## Addendum 2026-08-18 (Leg 1 part 2): candidate 3's silent path is closed, and the instrument exists

**Mechanism 2 is still not diagnosed.** Both entries below make the next
occurrence readable; neither shows which candidate happened.

**Candidate 3 did not need a reproduction.** `vendor/global-hotkey`'s X11
`events_processor` polled with
`while let Ok(Some(event)) = conn.poll_for_event()`. The `Err` arm does not match
that pattern, so a broken connection ended the inner loop and the **outer** loop
went straight back to polling a dead connection — 1 ms apart, forever. No events,
no report, the manager thread still alive, and `registered` still true everywhere
in the app. That is precisely the failure shape this record describes, arrived at
without reproducing it.

The three outcomes are separated now: `Ok(Some)` handles, `Ok(None)` breaks, and
`Err` returns a stated reason. There is nothing to retry — every grab lives on
that connection — so the thread ends instead of spinning, and the reason reaches
stderr as well as `tracing`, because the `tracing` feature is not enabled in this
tree and the only report the thread's death had was compiled out.

**This does not make candidate 3 the cause.** It makes it reportable. Candidates 1
and 2 are untouched.

**The instrument this record asked for is in.** Every registration decision is
now preceded by

```
[trigger] event=register_standing detail="age_ms=903 capture_presses=0 capture_releases=0 events_all_bindings=0"
```

The reported failure was sixteen consecutive `outcome=skipped_idempotent` lines,
and not one of them said how long the grabs had stood or whether they had ever
delivered anything — so the interval in which they were already dead was
unbounded. Logged *before* the decision on every path, because a real
registration resets the counters.

**It reports counters, not a verdict.** Zero events is equally what a binding
nobody pressed looks like. Pinned by
`a_registration_decision_reports_what_the_standing_grabs_delivered`.

## Related

- [capture-shortcut-recording.md](capture-shortcut-recording.md): the activation
  modes and the hold ceiling
- [pause-abort-interrupted-chord.md](pause-abort-interrupted-chord.md): a
  different modifier-only defect on the same backend
- [ADR 0014](../decisions/0014-every-modifier-only-binding-is-decided-at-the-release-edge.md)
