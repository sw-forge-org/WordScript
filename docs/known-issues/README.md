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
- [overlay-recording-freeze.md](overlay-recording-freeze.md): open — the
  recording overlay freezes mid-capture, timer and input included, while capture
  and pipeline continue. Observed only under `tauri dev` so far; the existing
  telemetry cannot yet separate a real freeze from legitimate silence
  (2026-07-27).
- [cross-platform-shortcut-verification.md](cross-platform-shortcut-verification.md):
  open — the shortcut lane has never run on Windows or macOS. Executable run
  sheets for both, the findings already established from the vendored crate's
  source (including that the modifier-only capture defaults cannot register on
  macOS), and which questions need real hardware versus a VM or a CI runner
  (2026-07-25).

## Boundaries

- Architecture decisions: [decisions/](../decisions/) (append-only ADRs)
- Completed implementation specifications: [handoffs/](../handoffs/)
- Frozen donor references: [donors/](../donors/)
- Regression corpus:
  `src-tauri/tests/fixtures/regression_transcripts.json` and
  `core::regression_corpus`
