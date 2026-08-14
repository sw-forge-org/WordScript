# 0151 -- A window that mounts late asks what is running, and is told nothing about what is over

Date: 2026-08-14
Status: Accepted

## Context

Every input to the overlay's surface arrives as an event. `recording_started`,
`processing`, `preview_ready` and `transcription` are each delivered once, to
whatever windows exist at that moment, and the reducer in `useRuntime` builds
the session state out of them. A window that was not there did not get them.

The overlay is destroyed and recreated more often than a desktop app suggests.
`npm run tauri dev` reloaded it about 1,389 times in 2.5 days before step 2
narrowed the watcher; a Vite config write restarts the server in place and every
webview loses its page; and the reopened window comes back with the reducer at
its initial state while the runtime is still recording. What it renders then is
nothing at all: `status` is `idle`, so `isActive` is false, so the pill never
mounts. The capture keeps running and the user has no pill.

[ADR 0134](0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
took the data loss out of this: the runtime now finishes a session its window
abandoned, so a lost window costs a surface rather than a transcript. What it
did not do is give the surface back, and it added an obligation while it was
there -- a window that returns after the deadline fired must not paint a commit
it has already lost.

The runtime knows all of it. `NativeSessionState` holds the stage, the session,
when it started and the staged preview; `NativeCaptureState` holds mute and
pause. Nothing asked.

## Decision

**A window asks the runtime what is running when it mounts, and repaints only
that.**

1. **One command, `native_session_snapshot`.** It answers the stage, the session
   id, when the session started, mute, pause, and the staged preview if one is
   still waiting. Not two commands: two round trips can straddle a state change,
   and a window would restore a pill for a capture that ended between them.
   The capture flags are read after the session lock is released -- the two
   mutexes are never held at once anywhere in this process, and this is not the
   place to start.

2. **It answers for what is live and for nothing else.** `capturing` restores the
   recording pill, `processing` restores the processing pill and any staged
   preview. `completed`, `aborted`, `error` and `idle` restore nothing.

3. **A session that has ended is never re-reported.**
   [ADR 0019](0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md)
   makes every path that ends a session owe the surface that reports it, and
   [ADR 0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md) allows
   exactly one such ending. A remount is not a second chance to report one. For
   the case this most obviously raises -- a preview the deadline committed --
   restoring nothing IS restoring it as committed, because that is what a
   committed `clipboard_only` preview looks like: the session closes with no
   result surface at all (ADR 0011a). The ADR 0134 obligation is met by the same
   fact that makes it invisible.

4. **The restore loses every race it is in.** It is a round trip, so a real
   event can arrive while it is in flight, and whichever of the two lands second
   the event is the newer truth. `RESTORE` therefore applies only to a state
   nothing has touched -- idle, no result, no error, no staged preview -- and is
   dropped otherwise. The guard lives in the reducer, where the rest of the
   session's atomicity already lives, rather than at the call site.

5. **A restored preview sets `previewStaged`.** It is the flag that says this
   session already had its decision surface; without it the commit that follows
   would open a second one (ADR 0018).

6. **The pill's timer is seeded from the runtime's session start.** It counted
   from zero at the first active render, which for a restored window is the
   remount -- a minute-old dictation would have shown `00:00`. On the live path
   the two instants are the same, because `RECORDING_STARTED` stamps
   `Date.now()`.

## Consequences

**Every window that reads `useRuntime` inherits this**, not only the overlay:
the settings window opened during a capture now shows the capture. That follows
from where the state lives and is the seam `AGENTS.md` states -- React displays
native state -- rather than a second mechanism for one window.

**The seed cannot be pause-aware.** The runtime records when a session began and
nothing records how long it was paused, so a window restored into a paused
capture shows the paused time as elapsed. That is one number too high in one
case, against a blank pill in every case. Recording pause duration is a change
to the capture state and is not made here.

**A restored surface is a surface, not a replay of what the user saw.** Local
interaction state -- a half-typed edit, a dismissed result, an open mode picker
-- belongs to the window that had it and is gone with it. Nothing here tries to
recover it, and a restored preview opens as an offer rather than as an edit.

**The command is a door with one caller.** `useRuntime` invokes it on mount and
nothing else does. This repository has been bitten twice by registered commands
whose callers were deleted underneath them (ADR 0089, ADR 0093), so it is worth
saying plainly which one this has.

## References

- [ADR 0134](0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
  -- the deadline, and the obligation this discharges
- [ADR 0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md),
  [ADR 0019](0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md)
  -- why a remount reports nothing about a session that ended
- [ADR 0152](0152-an-open-edit-surface-keeps-the-runtime-waiting-and-a-quiet-one-does-not.md)
  -- the epoch a restored preview carries, and what it is for
- [`../known-issues/overlay-recording-freeze.md`](../known-issues/overlay-recording-freeze.md)
  -- the record where a blank pill during a live capture is one of the reported
  shapes
- [`../tracks/runtime-ownership.md`](../tracks/runtime-ownership.md) -- step 4
