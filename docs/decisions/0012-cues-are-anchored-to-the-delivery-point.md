# 0012 -- Cues are anchored to the delivery point, in the session lifecycle

Date: 2026-07-27
Status: accepted

## Context

ADR 0010 settled what the cues sound like and that only `Done` reports a
finished round trip. It did not settle *where* the cues are emitted from, and
that turned out to be the part that misfired.

`Done` and `Error` were played inside `insert_transcription_from_legacy`
(`core/insertion.rs`), the helper that performs the actual insert. Three flows
call it, and they reach "finished" at three different moments:

- the `auto_paste` pipeline, immediately after the transform;
- `commit_pending_transcription_preview`, only once the user commits;
- the history retry, from the settings window.

Because the cue sat inside the helper, it fired *before* each caller's staleness
gate and before `complete_processing_session_from_transcription`. On the
`auto_paste` path that meant the completion cue sounded while the overlay was
still showing the processing pill, with the result surface appearing afterwards
-- sound ahead of picture. It also meant a session that was superseded right
after the insert still announced a delivery the runtime then silently discarded.

The `Err` arm of the pipeline's insert match (`lib.rs`) was the only failure
path in the runtime with no cue at all: the helper never returned, so the cue it
owned never ran.

`Handoff` was the first statement of `finalize_native_capture_stop`, before
`stop_native_capture`. It therefore fired on an empty capture and on a failed
stop as well, promising work in progress and contradicting itself with `Error` a
moment later -- and it landed in the same instant in which the cpal input stream
is torn down.

## Decision

**Cues are emitted by the session lifecycle, next to the event that tells the UI
the same thing.** The insert helper plays nothing.

- `Listen` -- capture is open (unchanged).
- `Handoff` -- capture is closed *and* audio was handed to the pipeline. Played
  in the `CaptureOutcome::Ready` branch, after the capture teardown. An empty
  capture or a failed stop gets no handoff.
- `Done` -- the text has reached its destination *and* the session is still
  current. Played immediately after the `transcription` event is emitted, in the
  `Ok(true)` completion arm: `auto_paste` in the pipeline, `clipboard_only` in
  the commit, plus the history retry. Both delivery modes therefore fire the
  same cue at the same meaning.
- `Error` -- in every arm that emits an `error` event, including the previously
  silent one.
- `Abort` -- unchanged.

Stale arms (`Ok(false)`) stay silent, matching the UI: nothing is shown there
either.

**Pre-emption stays as ADR 0010 defined it.** A new cue still replaces the
running one (`Player::skip_one`) rather than mixing or queueing. With the cues
moved to their real delivery points, consecutive cues are separated by the
pipeline or by a user action, so the cut no longer lands inside a cue a user is
still listening to. Changing the mixing policy would be a change to ADR 0010 and
is not warranted by anything observed here.

## Consequences

- `Done` can no longer fire for a result that the staleness gate discards.
- On `auto_paste`, the cue and the result surface now arrive together instead of
  the cue arriving first.
- A history retry keeps its cue; it just comes from the retry's own emit site
  now.
- `insertion.rs` no longer depends on `core::sound`. The insert helper reports
  outcomes; it does not narrate them.
- The 250 ms same-cue dedupe and the abort-then-error suppression in
  `CueGuard` are untouched -- they guard against two runtime paths reporting one
  user action, which is a different problem from cue placement.
