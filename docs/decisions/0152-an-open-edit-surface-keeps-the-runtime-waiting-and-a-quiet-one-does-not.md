# 0152 -- An open edit surface keeps the runtime waiting, and a quiet one does not

Date: 2026-08-14
Status: Accepted

## Context

[ADR 0134](0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
gave the runtime a 10 s deadline on a staged preview, and sized it on the
premise that it would be invisible whenever the window works: p90 of a healthy
commit is 2.27 s. It weighed the abort case explicitly -- a deadline commit
writes a record an abort would have to delete -- and did not weigh the edit
case. The track wrote that down as owed rather than settled: *an edit that takes
longer than ten seconds loses to the deadline*, the runtime commits the
**unedited** text, and the edit box disappears mid-typing because
`editSourceAvailable` reads `isProcessing && pendingResult` and the commit
clears both. Nothing is inconsistent and nothing is lost that was not already
delivered -- but the correction the user was making is gone, and typing for more
than ten seconds is not exotic.

**Then the deadline fired under a window that was alive.** On 2026-08-14 at
14:30:18, `native-4` committed `path=deadline` with `text_len=4`. The overlay in
that run was demonstrably not dead: `Overlay parked` is logged 240 ms after the
commit, which is exactly `OVERLAY_LEAVE_MS`, and parking has one caller --
`sync_overlay_window_visibility(visible: false)` from the webview. Two later
sessions in the same process committed `path=frontend`.

That is the pre-registered falsifier in the step's own run sheet -- *if a
healthy session ever logs `path=deadline`, the deadline is sized wrong* -- and
it fired on a reading the sheet did not have. A third explanation sits between
"the window is gone" and "the deadline is too short": **the user did not answer
within ten seconds.** The clipboard-only preview waits for a decision, and not
deciding is a thing people do.

## Decision

**An open edit surface tells the runtime it is still there, repeatedly, and the
deadline waits. A preview nobody is editing does not.**

1. **The surface renews, it does not hold.** `defer_pending_transcription_preview_commit`
   grants a *fresh* `PREVIEW_COMMIT_DEADLINE_MS` from the instant it is called.
   The overlay calls it when the edit opens and every 3 s while it is open. There
   is no release and no held flag, because the case this must not weaken is a
   window that dies mid-edit: whatever kills it also stops the renewals, and one
   ordinary deadline later the runtime finishes the session exactly as ADR 0134
   requires. **A dead window cannot leave state set that keeps a dictation
   hostage** -- that property is the whole design, and a boolean hold would not
   have it.

2. **Three requests of runway, not one.** Renewing at 3 s against a 10 s deadline
   means two consecutive requests can be lost -- to a busy main thread, to a
   dropped invoke -- before the deadline fires under a window that is genuinely
   still working. Renewing at the deadline itself would make every single
   request load-bearing, which is how a comfort feature becomes a way to lose a
   dictation.

3. **The deferral is guarded by the preview epoch**, the same guard ADR 0134 gave
   the deadline itself. A request in flight across a session change would
   otherwise extend the *next* dictation's deadline. The epoch therefore travels
   on the `preview_ready` payload and on the restore snapshot (ADR 0151), which
   is what lets a window that mounted late defer a preview it never saw staged.

4. **The deadline reads it as a value, not as a message.** The armed task wakes,
   re-reads the commit instant from the staged preview, and sleeps to it if it
   has moved. ADR 0134's rule that *the staged preview IS the cancellation
   state* is unchanged; there is still no channel to listen on.

5. **A quiet preview keeps the ten seconds it has.** The 14:30 case -- a preview
   on screen, nobody answering -- commits by deadline as before. That is the
   runtime owning the end of the session, which is what this track is for, and
   the transcript reaches the clipboard, history and disk either way. Only the
   surface that is actively being *worked in* buys time, because only there is
   something in progress that a commit would destroy.

## Consequences

**The worst-case unattended commit is unchanged at 10 s**, and the worst case
for a window that dies during an edit is 10 s from its last renewal, i.e. up to
13 s after the last keystroke. The bound moves by one renewal interval, not by
the length of an edit.

**A user can now hold a preview open indefinitely by editing it.** That is the
intent, and it is bounded by a person being there: the moment the surface
closes, by confirm, cancel, a new capture or a destroyed webview, the ordinary
deadline is what remains.

**The run sheet's falsifier needs its third clause**, and the track record now
carries it: `path=deadline` on a live window is *the user did not answer* until
the log also shows the window was working. It is only evidence of a
mis-sized deadline when a window was actively trying to finish.

**A post-delivery edit defers nothing.** The edit surface is reachable from the
result surface too, and there the session has already ended -- `preview_epoch`
is null on every finished result, which is what stops that surface from
requesting time against whatever is staged next.

## References

- [ADR 0134](0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
  -- the deadline, the epoch guard, and the case it left open
- [ADR 0151](0151-a-window-that-mounts-late-asks-what-is-running-and-is-told-nothing-about-what-is-over.md)
  -- the snapshot that carries the epoch to a window that mounted late
- [ADR 0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md) -- one
  commit body for both paths, unchanged by this
- [`../tracks/runtime-ownership.md`](../tracks/runtime-ownership.md) -- step 1's
  open question, and the 2026-08-14 finding that answered it
