# 0134 -- A session ends in the runtime, not in the window that shows it

Date: 2026-08-13
Status: Accepted

## Context

`CLAUDE.md` states the seam: *"Rust owns trigger, capture, provider, transform,
**insert** and recovery. React displays, configures and explains that native
state; it must never reinvent it semantically."*
[ADR 0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md) adds that
a session ends in exactly one commit, **on every path, the timeout fallback
included**.

The insert does not obey either. Every call site that performs it is an
`invoke` from the overlay component -- `OverlayWindow.tsx:1508` (the preview
commit), `:1548`, `:1621`, `:1648`. After
`Native pipeline preview ready` the runtime does nothing on its own; `lib.rs`
has no scheduler, no deadline and no fallback behind that line. The transcript
sits in `pendingResult` until a window asks for it.

**Everything a user can later reach is created by that insert.** The clipboard
write, the `history.json` record and the Markdown transcript under
`~/WordScript/transcripts` all happen inside it -- the record id
`history-1786574199766-200` and its file's `created:` timestamp are the same
millisecond as `Native insert event emit done`. No insert means no clipboard, no
history row, no file. The text exists only in memory.

The runtime log measures the dependency directly. Across 277 previews, all
`clipboard_only`:

| | preview -> insert |
|---|---|
| median | **1.12 s** |
| p90 | 2.27 s |
| the 13 sessions with a webview reload in that window | **11.45 s to 115.11 s** |

The long tail is not a slow model call, which was the first reading. It is
exactly the set where the overlay was destroyed and rebuilt
([dev-server-reloads-the-app-mid-session.md](../known-issues/dev-server-reloads-the-app-mid-session.md)):
the commit waited for a window to come back. Three previews never reached an
insert at all -- two deliberate aborts, and **one that died with an application
restart and was never written anywhere.**

So the three mechanisms that remove the overlay
([overlay-leave-hold-dead-actions.md](../known-issues/overlay-leave-hold-dead-actions.md)'s
2026-08-13 addendum tabulates them) are not merely surface bugs. Each of them
can silently discard a finished transcript, and nothing reports it.

An earlier reading of this record claimed the transcript survives in four places
and the user merely loses *reach*. That was wrong, and it was wrong in the
direction that matters: all four places are downstream of the insert.

## Decision

**The runtime finishes the session. The window may show it and may abort it; it
may not be the thing that completes it.**

1. On `preview ready` the runtime starts a **deadline of 10 seconds**. If
   nothing has committed or aborted by then, the runtime commits: clipboard,
   history record, transcript file -- the same path a frontend commit takes.

2. The overlay keeps `commit` and `abort`. Nothing about the healthy path
   changes: at p90 = 2.27 s the deadline never fires in a session whose window
   is alive.

3. **A late frontend commit is a no-op**, by the guard that already exists --
   `take_pending_preview()` empties, per ADR 0018's one-commit rule. The 13
   delayed sessions would have committed at 10 s and the window's arrival at
   11-115 s would find nothing to do.

4. The deadline is the runtime's. It is not configurable and it is not a
   frontend timer, because a frontend timer dies with the frontend -- which is
   the entire defect.

### Why 10 s and not 1 s

An earlier draft proposed one second, on the observed median. That is the wrong
quantity: the deadline is a **safety net, not an abort window**. Sized to the
median it would fire in ordinary sessions and turn a healthy interactive
surface into a race. Sized to 10 s it is invisible whenever the window works --
more than four times p90 -- and still bounds the loss when it does not.

The owner set the range at five to ten seconds; 10 s is the conservative end of
it and the one that provably changes nothing today.

### What this costs, stated plainly

Abort after the deadline is no longer "the transcript never existed". It
becomes "delete the record that was written". Of the two aborts in the log, one
came at 2.3 s and would be unaffected; **the other came at 15.4 s and would now
land after the commit**, leaving a history row and a file to delete instead of
nothing.

That trade is accepted deliberately. A record the user deletes is recoverable
by one action; a transcript that was never written is not recoverable at all.
The rule this repo already applies to capture -- lost content is reported, never
replaced -- points the same way.

## Consequences

**The three overlay mechanisms stop being data-loss bugs.** They remain surface
bugs and keep their records; what they can no longer do is discard a finished
dictation. That is why this ADR ranks above the watcher fix in the sequence
even though the watcher is cheaper.

**`clipboard_only` gets its second route for free.** Once the record and the
file exist without the overlay, History's `copy` / `restore` / `reveal`
(`History.tsx:436-445`) are reachable, and so is the file on disk. No new
surface has to be designed. The claim in
`overlay-leave-hold-dead-actions.md` that the pill is *the only route the mode
ever offers* was true when written and is corrected by this ADR's own
consequence, not by a new door.

**A committed preview must be visibly committed.** If the deadline fires while
the window is alive but slow, the surface has to stop offering a commit it has
already lost. This is the same rule the leave hold learned in that record: a
frozen frame must not paint live-looking actions.

**The deadline needs a log line.** A commit the user did not ask for is a
runtime decision, and this repo's standing rule is that the runtime says what it
did. Emit which path completed the session -- frontend or deadline -- so the
next investigation can count them instead of inferring them from timing.

**It does not fix the freeze or the invisibility.** Those stay open in their own
records, and the re-measurement they ask for is still owed.

## References

- [ADR 0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md) -- one
  commit per session, timeout fallback included; this supplies the fallback it
  named
- [ADR 0019](0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md)
  -- every path that ends a session owes the surface that reports it; the
  deadline is a new such path and owes one too
- [overlay-leave-hold-dead-actions.md](../known-issues/overlay-leave-hold-dead-actions.md)
  -- the three mechanisms, and the "one door" framing this corrects
- [dev-server-reloads-the-app-mid-session.md](../known-issues/dev-server-reloads-the-app-mid-session.md)
  -- the reloads that produced the 11-115 s tail
- [ADR 0133](0133-the-gap-was-measured-on-the-far-side-of-our-own-lock.md) --
  the other half of the same session's finding, on the capture side
