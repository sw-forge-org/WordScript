# Known Issues

This directory contains living diagnostic records for open and resolved bugs.
Unlike append-only ADRs, these documents are updated as investigation and
status change. Resolved bugs remain as references for the same failure class.

## Entries

- [overlay-ghosting.md](overlay-ghosting.md): resolved WebKitGTK transition
  state bleeding (2026-07-08). The `auto_paste` unmount gap reopened on the
  event axis and was closed again on 2026-07-29 (ADR 0018): the native
  completion event no longer ends a session. Then reported again from a build
  that already contained that fix, this time on the `clipboard_only`
  `compact -> processing_preview` transition. Three further re-entry points into
  the same gap class were closed (ADR 0019), the third — the edit surface leaving
  its own hold mid-fade — found by measurement on 2026-07-30. That run also
  disproved a stalled-leave hypothesis and showed the `[ov-*]` trace itself had
  been the unreliable part (rAF flush in a window where rAF is paused; now a
  microtask). The screenshot's exact stacking is still not reproduced. The mode
  axis stays open — the same failure was reported as absent in `Auto` and present in the
  other five processing modes; the mode is most likely a visibility modifier,
  and it is to be measured before anything is changed. The separate accepted
  mode-cycling residual is recorded in the
  [accepted-state hand-off](../handoffs/OVERLAY_MODE_CYCLING_GHOSTING_ACCEPTED.md).
- [insert-behavior-reverts.md](insert-behavior-reverts.md): the delivery mode
  switching itself back to clipboard-only. Two mechanisms found and fixed
  (`92ce7f5` 2026-07-03, ADR 0019 2026-07-29); the second was a normalized
  `work_mode` that was corrected in memory on every load and never persisted,
  recorded 183 times by the P1 diagnostic. Open: whether a writer of the
  non-canonical token exists. Also documents how to tell a config revert from a
  runtime insert fallback.
- [overlay-placement-persist.md](overlay-placement-persist.md): resolved
  remembered overlay drag-position failure (2026-07-08).
- [overlay-drag-session-never-ends.md](overlay-drag-session-never-ends.md):
  resolved — the drag session never ended after the first overlay drag, which
  silently disabled both overlay layout effects and therefore the only native
  repaint trigger for a mode change. Reported as mode-picker overlay stacking;
  not a compositor problem (2026-07-27).
- [transcription-hallucination.md](transcription-hallucination.md): mitigated —
  raw transcription language drift and hallucination. The approved slice landed
  on 2026-07-29 (ADR 0015, ADR 0016): the capture config now reaches the runtime
  as one resolved source, which is what silently disabled per-profile bias and
  every local decode setting; a speech gate and a confidence gate sit before AI
  cleanup; a language mismatch alone never discards anything. Not resolved: real
  language identification and segment confidence on the local lane stay
  deferred, and everything above the slice heading remains the historical record
  of the problem.
- [capture-shortcut-recording.md](capture-shortcut-recording.md): resolved for
  the activation modes — shortcut recording, manual entry, normalization,
  registration and activation-mode failures in Capture and Modes, including the
  missing trigger observability and the rebuild plan. S0-S8 implemented and
  D1-D12 closed; D11 (hold to talk) turned out to be a threshold-semantics
  defect rather than a delivery one and was corrected under ADR 0013
  (2026-07-29). One open item: the physical half of the S0 measurement.
- [overlay-recording-freeze.md](overlay-recording-freeze.md): open — the
  recording overlay freezes mid-capture, timer and input included, while capture
  and pipeline continue. Observed only under `tauri dev` so far; the existing
  telemetry cannot yet separate a real freeze from legitimate silence
  (2026-07-27).
- [diag-log-write-surface.md](diag-log-write-surface.md): open — hardening
  finding, no observed failure. The overlay diagnostic log uses a predictable
  path in the world-writable `/tmp`, and its three commands are registered in
  release builds although only dev code calls them (2026-07-27).
- [dependency-advisories.md](dependency-advisories.md): open — one real
  advisory without an available patch (`react-router-dom` 6.x), two
  non-breaking transitive fixes, four stale Dependabot alerts, and no advisory
  coverage at all for the Rust tree (2026-07-27).
- [cross-platform-shortcut-verification.md](cross-platform-shortcut-verification.md):
  open — the shortcut lane has never run on Windows or macOS. Executable run
  sheets for both, the findings already established from the vendored crate's
  source (including that the modifier-only capture defaults cannot register on
  macOS), and which questions need real hardware versus a VM or a CI runner
  (2026-07-25).
- [pause-abort-interrupted-chord.md](pause-abort-interrupted-chord.md): fixed in
  code on Linux, not yet confirmed in a native session — pause and abort acted on
  the press edge and never read `event.interrupted`, so the shipped modifier-only
  abort default (`Ctrl+Alt`) discarded a running capture when the user was on the
  way to `Ctrl+Alt+<key>`. All three activation modes were affected. Both the
  finding and the fix come from reading `core::trigger`; nothing here has been
  observed in a running app (2026-07-29, ADR 0014).
  The cross-platform half was reopened the same day and the record's original
  claim about it corrected: the two non-Linux backends of the vendored crate did
  not compile at all (three `GlobalHotKeyEvent` literals missing the
  `interrupted` field, E0063), and modifier-only bindings never fired there —
  neither correctly nor spuriously. Compile errors fixed, the state machine
  extracted into a tested platform-neutral module, Windows wired to it, macOS
  left open with written requirements because its API could not be verified on
  this machine.
- [rust-test-global-state-isolation.md](rust-test-global-state-isolation.md):
  fixed — `core::runtime_log` and `core::workspace_context` tests mutated
  process globals (the shared ring buffer, an environment variable) and failed
  at random under parallel `cargo test`. Both now assert through a seam instead
  of the global, so the parallel default stays the normal case; 10 consecutive
  parallel runs and `--test-threads=1` green (2026-07-29).
- [auto-mode-verbatim-routing.md](auto-mode-verbatim-routing.md): closed by
  measurement (2026-07-30) — why Auto does not route to Verbatim. Two proposals
  rejected; the second looked safe by construction and was not. Over 75 real
  history entries, a "nothing to clean" proxy matched 75% of transcripts while
  cleanup still materially changed 54% of those (German verb order, discourse
  particles, capitalization, internal commas). Records what new evidence would
  reopen it, so the idea is not re-argued from intuition (ADR 0020).

## Boundaries

- Architecture decisions: [decisions/](../decisions/) (append-only ADRs)
- Completed implementation specifications: [handoffs/](../handoffs/)
- Frozen donor references: [donors/](../donors/)
- Regression corpus:
  `src-tauri/tests/fixtures/regression_transcripts.json` and
  `core::regression_corpus`
