# 0181: The wait starts when you stop speaking, not when the file is already written

Date: 2026-08-16
Status: Accepted. Eleventh record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Corrects the start
of the interval
[ADR 0175](0175-a-tile-may-only-report-what-the-runtime-can-see-so-apps-goes-turnaround-arrives-and-the-rate-is-a-median.md)
settled, and fixes the reason the tile was empty.

## Context

The owner asked whether the turnaround is actually computed correctly. Two things
were wrong with it, and one of them meant the tile could never have shown
anything at all.

**The clock started too late.** `pipeline_started_at` is set at the top of
`handle_audio_ready` — which runs when the audio file **already exists**. Between
the reader releasing the shortcut and that moment, `stop_native_capture` drains
the buffer, downmixes it, resamples it to 16 kHz, trims the leading and trailing
silence and encodes a WAV. The reader waits through all of it with nothing on
screen, and none of it was in the figure. The end of the interval — the moment
the text exists, before the insert — is right and stays: ADR 0175's boundary, and
a clipboard delivery has no observable end.

**And the value was dropped on the floor.** `history_entry_from_insert_result`
took `turnaround_ms` as an argument and wrote `turnaround_ms: None` into the
request. Every record on the product's main path therefore reported no turnaround
at all, the histogram behind the tile could never fill, and the tile was dark on
a machine with sixty dictations in it. Found while reading the derivation rather
than by the tile complaining, because a dark tile is indistinguishable from a
tile with nothing to say.

## Decision

**`stop_native_capture` measures its own work and hands it over.**
`AudioReadyEvent` gains `export_ms`, taken on the monotonic clock from the top of
that function to after the WAV is written, and the pipeline adds it to its own
elapsed time. Monotonic and not a wall clock: the two ends are in different
threads, and a wall clock between them is a clock nobody can trust across a
suspend or a time sync.

`handle_audio_ready` is called directly by `finalize_native_capture_stop`, so the
two measurements meet with nothing but a sound cue between them.

**And the caller's value is written to the record.**

## Consequences

- The figure is the wait the reader actually experiences on both sides of the
  seam, and it is delivery-independent — the same measurement whether the text
  goes to the cursor or to the clipboard.
- It will read slightly higher than the old definition would have. Nothing is
  invalidated by that, because the old definition never produced a stored value.
- The histogram is unchanged in width and meaning, so it needs no schema bump: it
  is the same quantity, measured from the right end.
- The tile fills from the next dictation.
