# 0019 -- Every path that ends a session owes the surface that reports it

Date: 2026-07-29
Status: accepted

## Context

[ADR 0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md) made the
authoritative `wordscript-event` `transcription` commit the only thing that ends
a session, and gave it the atomic swap: `status`, `lastResult` and
`resultSurfaceOpen` move together, so no render exists in which the session is
over but no surface owns the pill.

The same ADR introduced a bounded way out for a lost authoritative event:
`NATIVE_SYNC_TIMEOUT`, armed by the native completion sync, firing after
`NATIVE_SYNC_FALLBACK_MS` (1500 ms). That fallback set `status: "idle"` and
`pendingResult: null` and stopped there. It did not set `resultSurfaceOpen`.

So the fallback ended a session without a surface, and a late authoritative
event -- one arriving after the 1500 ms -- then flipped `resultSurfaceOpen`
false to true one commit later. Two commits, the second one mounting the result
surface after the first one had already torn the pill down. On `auto_paste` the
last visible surface is `"compact"`, which `holdPreviewDuringClose` refuses to
hold, so the first commit unmounts `<OverlayPill>` and orphans its animated
children's compositor layers on WebKitGTK.

That is the gap ADR 0018 removed, re-entered through the mechanism ADR 0018
added. It is improbable in practice -- `complete_processing_session_from_
transcription` and the authoritative `app.emit` are back-to-back statements at
the same call site in `lib.rs` -- but "improbable" is not the same as "closed",
and no test covered it.

The same reading applies to a second, independent gap on the way *in*.
`pillVisualEpoch` is the string whose change forces the native repaint that
clears WebKitGTK's cached raster. It carried the delivery-dependent chrome only
as `previewClipboardOnly && renderResultPreview` -- scoped to the result
surface. On the processing preview the very same flag swaps the primary button
between Copy and Insert and toggles `pill--clipboard`, i.e. changes the pill's
visual identity with `surface` and `kind` unchanged. That is the exact case the
epoch exists for, and the preview surface was outside it.

Separately, and with a user-visible effect of its own: `load_from_disk_impl`
computed `should_save` from the legacy-secret migration, the global-to-profile
migration, the provider and the hotkeys. A `work_mode` rewrite never counted. A
non-canonical `insert_behavior` -- the legacy token `"clipboard"`, which
normalizes to `"clipboard_only"` -- was therefore corrected in memory on every
load and never written back, so it survived on disk indefinitely and forced that
profile to clipboard-only on every start regardless of what the user selected.
The diagnostic added for the P1 revert investigation recorded this 183 times
across two runtime logs, which is the same statement: the correction was
recomputed forever and never persisted.

## Decision

**Every path that ends a session commits the surface that reports it, in the
same commit.** ADR 0018 stated this for the authoritative event; it holds for
the fallback too. `NATIVE_SYNC_TIMEOUT` builds its result from the transcript
the native channel mirrored and opens the result surface under the same rule the
authoritative commit uses (`!previewStaged`, so a `clipboard_only` run that
already decided on its preview still closes without a second surface).

The mirrored transcript is kept as `RuntimeState.nativeSyncMirror` rather than
only folded into `lastTranscription`, because the fallback needs the `corrected`
flag as well, and because its presence is what identifies the case below.

**A synthesized result carries only what was actually reported.** `provider`,
`work_mode`, `delivery`, `transform` and `insertion` are owned by the
authoritative event and stay `null`. The overlay shows a transcript that was
delivered by an unknown path, which is the truth in this state; inventing a
delivery would be a fake state.

**A session that has already ended never has its surface re-decided.** A late
authoritative event takes the richer payload but leaves `resultSurfaceOpen` and
`occurred_at_ms` where they are, so an open surface is updated in place instead
of being mounted a second time, and a session the fallback closed empty-handed
does not sprout a result pill after its overlay is gone.

**The visual-identity epoch covers both decision surfaces.** The
delivery-dependent chrome enters `pillVisualEpoch` for the processing preview as
well as for result-actions.

**A leave hold paints from a frozen frame, never from live state.** The edit
hold required the live `editText` to be non-empty, so the interaction-reset
effect that runs on a new `lastResult` pulled the surface out from under it at
the instant the fade started — measured in 4 of 5 edit closes. It now reads a
snapshot captured while the surface was live, the same pattern the processing
hold already used. A hold exists because the state it replays is already gone;
keying it on that state is a contradiction.

**A normalization result is persisted, not recomputed.**
`normalize_text_profiles` reports whether it rewrote a profile's `work_mode`,
and that feeds `should_save`. A canonical config still reports no rewrite, so
this does not trade a silent revert for a config written on every load.

## Consequences

- The 1500 ms fallback is now a complete session end rather than a partial one.
  It remains the exception, not the path: everything that legitimately ends or
  restarts a session still cancels it first.
- `RuntimeState` gains one field. It earns its place by carrying the `corrected`
  flag the fallback cannot otherwise know, and by being the only marker that
  distinguishes a late authoritative event from a normal one.
- `nativeSyncMirror` is cleared at every session boundary
  (`RECORDING_STARTED`, `PROCESSING`, `TRANSCRIPTION`, `EMPTY`, `ERROR`), so it
  can never leak into the next session.
- A legacy `insert_behavior` token is now corrected once and written down. The
  P1 diagnostic keeps its value: it should fire once per legacy value and then
  never again, so a repeat is evidence of a writer, not of the migration.
- The compositor defences stay in place, unchanged: opaque pill surfaces, the
  keyed `<OverlayPill>` remount, the native 1px height oscillation and the
  coalesced reveal. This decision removes causes of unmount gaps; it does not
  make WebKitGTK's layer retention safe to ignore.
- Open, unchanged: the mode axis, and now also the question of which mechanism
  the 2026-07-29 live report actually hit. The report came from a build that
  already contained ADR 0018, and the captured diag log shows the session was
  `clipboard_only` on the `compact -> processing_preview` transition -- not the
  `compact -> result_actions` transition ADR 0011a and ADR 0018 addressed.
  Measure with the `[ov-*]` diagnostics before acting; see
  [known-issues/overlay-ghosting.md](../known-issues/overlay-ghosting.md).

## Notes on the diagnostics themselves

The `[ov-*]` trace is read to decide whether an effect ran. It was written with
one fire-and-forget `invoke` per line, and concurrent Tauri commands are not
ordered against each other, so a line could be reordered or lost -- and a
missing `[ov-repaint]` next to its `[ov-sched]` is indistinguishable from an
effect that never fired. Lines now carry a monotonic sequence number, so a gap in
the numbering is visible.

**The flush is a microtask, and that detail is load-bearing.** The first version
batched on `requestAnimationFrame`. WebKitGTK pauses rAF for the not-visible
overlay -- the reason `scheduleReveal` already avoids it -- so lines emitted
during the leave sat in the buffer until the next wake, and because the
`[epoch-ms]` prefix is the flush time, the backlog read as a 258-second stalled
leave transition. It was not: with a microtask flush the same transition measures
241-246 ms in nine of nine closes, and the heartbeat (now covering
`overlayMotion !== "idle"`) reports no stall at all.

A diagnostic that batches on the frame clock cannot be trusted in a window where
the frame clock is the suspect. That is the general form, and it cost one wrong
root cause before it was noticed.
