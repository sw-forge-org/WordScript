# 0018 -- The end of a session belongs to exactly one event

Date: 2026-07-29
Status: accepted

## Context

A completed dictation is announced twice. Both real completion paths in the
runtime emit, in this order:

1. `wordscript-native-event` `transcription` / `transcription_corrected`, from
   `complete_processing_session_from_transcription` (`core/sessions.rs`) -- the
   session-state mirror, carrying nothing but `last_transcript`;
2. `wordscript-event` `transcription`, the authoritative result, carrying the
   full payload: text, provider, work mode, transform rules, history entry,
   delivery and insertion result.

They are two IPC messages, so they land in two React commits.

[ADR 0011a](0011a-one-decision-surface-per-delivery-mode.md) made the result
surface's visibility runtime state (`resultSurfaceOpen`), set in the same
reducer commit that flips `status` to `"idle"`, precisely so that no render
exists in which the session has ended but no surface owns the pill. That closed
the gap on the *effect* axis.

It stayed open on the *event* axis. `NATIVE_TRANSCRIPTION_SYNC` set
`status: "idle"` and cleared `pendingResult` when message 1 arrived, one commit
before the authoritative event supplied `lastResult` and `resultSurfaceOpen`. In
that commit the overlay saw `status === "idle"`, no `lastResult`, no staged
preview and no error. `holdPreviewDuringClose` refuses to hold a `"compact"`
surface, so nothing carried the pill: `pillState` fell to `null` and
`<OverlayPill>` unmounted for a frame. On WebKitGTK that orphans the processing
pill's animated children's compositor layers, and the result surface then mounts
on top of the stale raster -- the mechanism in
[known-issues/overlay-ghosting.md](../known-issues/overlay-ghosting.md).

The failure is structurally exclusive to `auto_paste`. A `clipboard_only` run
leaves `"processing_preview"` as the last live surface, which the leave hold
does cover, plus a content snapshot to paint from. `auto_paste` goes
compact -> result_actions with nothing in between, and that is the one
transition the hold was written to exclude.

The clipboard-only variant of the same gap was already visible in the test
suite: `useRuntime.test.tsx` asserted `status === "idle"` immediately after the
native sync, i.e. it pinned the defect rather than the contract. No test covered
the `auto_paste` ordering at all -- that test emitted only the authoritative
event.

## Decision

**The native event channel is a status mirror, not a session terminator.**

`NATIVE_TRANSCRIPTION_SYNC` updates `lastTranscription` and nothing else.
`status`, `pendingResult`, `previewStaged` and `resultSurfaceOpen` change only
in the authoritative `wordscript-event` `transcription` commit, which sets all
of them together. The atomic-swap guarantee `RECORDING_STARTED` gives on the way
into a session now holds on the way out against the event ordering as well, not
only against the effect ordering.

**The way out of a lost authoritative event is explicit, not the default.**
Receiving the native sync arms a bounded fallback (`NATIVE_SYNC_FALLBACK_MS`,
1500 ms) that dispatches `NATIVE_SYNC_TIMEOUT`, which does what the sync used to
do immediately: `status: "idle"`, `pendingResult: null`. It is cancelled by
`TRANSCRIPTION`, `EMPTY`, `ERROR`, `PROCESSING`, `RECORDING_STARTED` and by the
hook unmounting, and it no-ops unless the session is still `processing`. Without
it a dropped emit would leave the overlay in `processing` until the 120 s
pipeline watchdog fires -- a fake state, which the product does not allow.

`previewStaged` remains the key for the surface decision rather than
`pendingResult`, for the same reason as in ADR 0011a: the fallback clears
`pendingResult`, and a late authoritative event must still be able to tell that
this session already had its decision surface.

## Consequences

- The `auto_paste` path hands the pill from the compact processing surface
  straight to result-actions in one commit. There is no render without a
  surface, so nothing unmounts and no compositor layer is orphaned.
- `holdPreviewDuringClose` keeps excluding `"compact"`. That exclusion is
  correct on its own terms -- an abort or an empty capture has nothing worth
  replaying, and holding a processing pill would keep a live spinner painted
  over them. It is no longer load-bearing for `compact` -> `result_actions`.
- The compositor defences from the earlier ghosting work stay in place: opaque
  pill surfaces, the keyed `<OverlayPill>` remount, the native 1px height
  oscillation and the coalesced reveal. This decision removes a *cause* of
  unmount gaps; it does not make WebKitGTK's layer retention safe to ignore.
- Tests now pin the contract instead of the defect: the real two-message
  ordering is asserted for both delivery modes, the fallback is asserted with
  fake timers, and a cancelled fallback is asserted not to fire into the next
  session.
- Open, unchanged: the mode axis. The same failure was reported as absent in
  `Auto` and present in the other five processing modes. No code path connects
  `ProcessingMode` to surface selection or delivery, so the mode dependence is
  most likely a visibility modifier -- the ModeChip label is the only
  mode-dependent geometry in the overlay, worth roughly 27px of pill width
  between the shortest and the longest label. Measure with the `[ov-*]`
  diagnostics before acting; a geometry change is explicitly out of scope
  (it was built in `796ad59` and reverted in `37768b3` on cosmetic grounds).
