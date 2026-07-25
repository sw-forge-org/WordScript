# Known Issues

This directory contains living diagnostic records for open and resolved bugs.
Unlike append-only ADRs, these documents are updated as investigation and
status change. Resolved bugs remain as references for the same failure class.

## Entries

- [overlay-ghosting.md](overlay-ghosting.md): resolved WebKitGTK transition
  state bleeding (2026-07-08); the separate accepted mode-cycling residual is
  recorded in the
  [accepted-state hand-off](../handoffs/OVERLAY_MODE_CYCLING_GHOSTING_ACCEPTED.md).
- [overlay-placement-persist.md](overlay-placement-persist.md): resolved
  remembered overlay drag-position failure (2026-07-08).
- [transcription-hallucination.md](transcription-hallucination.md): open raw
  transcription language drift and hallucination problem.
- [capture-shortcut-recording.md](capture-shortcut-recording.md): open shortcut
  recording, manual entry, normalization, registration and activation-mode
  failures in Capture and Modes, including the missing trigger observability
  and the rebuild plan (2026-07-25).

## Boundaries

- Architecture decisions: [decisions/](../decisions/) (append-only ADRs)
- Completed implementation specifications: [handoffs/](../handoffs/)
- Frozen donor references: [donors/](../donors/)
- Regression corpus:
  `src-tauri/tests/fixtures/regression_transcripts.json` and
  `core::regression_corpus`
