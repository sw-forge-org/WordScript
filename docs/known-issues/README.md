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
- [stt-prompt-leaks-into-the-transcript.md](stt-prompt-leaks-into-the-transcript.md):
  **open; removed from the delivery 2026-08-10 (ADR 0080), still produced by the
  recogniser** — the initial prompt WordScript sends to Whisper is echoed back as
  if it had been spoken, at the start, the end or mid-text, displacing real
  speech. Measured twice: 15 % / 9 % over 141 records, then 12.5 % / 6.6 % over
  the 136 that remained. Two findings shaped the fix: the echo is a
  **paraphrase** of what was sent, not a copy, so an exact-string strip would
  have caught almost none of it; and the owner once said the prompt text out
  loud while complaining about it, so the rule reads sentences rather than
  words. A leaked sentence reached an agent **as an instruction and was
  followed**, which is why the strip runs ahead of the mode branch. It never
  restores the displaced words — a wholly-echoed transcript comes back empty —
  and `raw_transcript` deliberately keeps the leak so the rate stays measurable.
  The uncomfortable part stands: ADR 0036's mitigation for the subtitle
  attractor is this defect's cause.
- [transcription-accuracy.md](transcription-accuracy.md): **open, partly
  measured** — dictated words come back as different words, often enough that a
  dictated brief has to be re-read before it is trusted (owner, 2026-08-10).
  Distinct from the hallucination record below: a mishearing is fluent,
  grammatical and in register, so no downstream filter can see it. Two causes
  under it now have rates and fixes (the prompt leak, the pluralized address);
  there is still no WER, so the headline complaint stays open. **The measurement
  that would join this cluster — shortfall against mishearings — was attempted
  and is not answerable**: the join works (136 of 136 records paired) but 9 of
  the 11 short captures had outlived their transcripts. That is a retention
  artifact rather than a result, and ADR 0079 removes the need for the join.
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
- [capture-loses-half-the-recording.md](capture-loses-half-the-recording.md):
  **open, cause still not located, and the most damaging entry in this
  directory** — captures record only part of their wall-clock duration and
  nothing said so. The transcript is of what was recorded, not of what was said.
  Found by comparing two counters the runtime already logged: r = 0.9999 across
  353 captures on 2026-08-03, r = 0.9986 across 338 on 2026-08-10. **It is
  ongoing: 11 affected captures rather than 8, and the worst — 54.6 % of a
  214 s dictation — happened on 2026-08-10**, its transcript reading as a
  finished piece of German at a third of the expected density. Since ADR 0079
  the capture SAYS SO: runtime log, history record with an `Audio missing`
  badge, and a tab beside the result pill at delivery time. Threshold 10 %,
  derived from a gap in the data that runs from 7.0 % to 12.0 %. The pause
  artifact in `shortfall_ratio` is fixed with it. This is what the overlay
  freeze reports were describing (2026-08-03).
- [overlay-recording-freeze.md](overlay-recording-freeze.md): largely resolved by
  attribution — the recording overlay freezes mid-capture, timer and input
  included, while the pipeline continues. The 2026-07-30 measurement did not
  reproduce it and its sightings turned out to be placement. On 2026-08-03 it
  did reproduce, on the emit axis, and the cause is not the overlay: the pill
  stops because the capture stream stopped delivering samples (see above). The
  main-thread hypotheses are dead — `[ov-beat]` stays empty while the other
  `[ov-*]` kinds log normally. What stays open is the residual signature alone:
  hover, click and drag dying while a *live* stream runs.
- [overlay-stranded-off-screen.md](overlay-stranded-off-screen.md): **reopened
  2026-08-03** — the overlay is placed where no monitor is. The ADR 0022 rescue
  works and is firing, but it does not prevent the stranding: in 82.9 hours on a
  build carrying the fix, 65 of 503 reveals found an already-visible window on no
  work area, while the mid-session check that was meant to catch it fired **zero**
  times — it runs only during an active native capture, and every observed case
  happened with the pill visible and idle. Third finding: all 482 park moves
  landed somewhere other than requested (parking works through `hide()` alone),
  and 31 of them landed on the measured dead-zone corner, which is now the
  leading candidate for the cause (originally 2026-07-30, ADR 0022).
- [overlay-leave-hold-dead-actions.md](overlay-leave-hold-dead-actions.md):
  fixed — the 240 ms leave hold replayed the `clipboard_only` preview from a
  snapshot with its buttons wired unconditionally to handlers that had already
  gone dead, so Copy rendered fully enabled and did nothing. The `edit-mode`
  branch beside it already had the rule the `processing` branch was missing
  (2026-07-30).
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
- [stt-hints-bypass-the-vocabulary-opt-in.md](stt-hints-bypass-the-vocabulary-opt-in.md):
  fixed (2026-07-30) — the Settings recognizer preview read the legacy
  `stt_hints` field while the capture path read only opted-in
  `vocabulary_hints`, so the panel rendered an initial prompt the provider never
  received and the per-entry toggle changed nothing on screen. The analysis now
  derives its phrases the way the capture path does. **The record's first
  version blamed the runtime; that was wrong** — the correction is kept in the
  file, because the direction of a UI/runtime disagreement is the whole finding.
- [profile-context-is-written-as-categories.md](profile-context-is-written-as-categories.md):
  closed 2026-08-01 — **the premise was wrong, twice over, and the correction is
  kept in the file.** It described a seed that had not shipped for two months
  (the record and ADR 0021 both read the developer's live config, not
  `curatedTextProfiles.json`), and the content it called a defect was correct:
  category labels are topics, which is what this field is for. What was broken
  was the routing — `prompt` still travelled to the recognizer, where topics
  cannot work, and the panel reported the filtered lines as rejected. See ADR
  0032. The question underneath — does profile context earn its place at all —
  survives and stays with Phase 7.
- [cleanup-invents-tokens-on-broken-input.md](cleanup-invents-tokens-on-broken-input.md):
  measured 2026-08-02, partially addressed — where the transcript is already
  damaged (spelled-out letters, an aborted word), the correction prefers a
  plausible-looking token over leaving the damage visible: `c a u d e code` →
  `CAUDE-Code`, `politi… äh…` → `politisch`. Found beside ADR 0021 and
  independent of it. 12 of 197 shipped pairs (6.1 %) verified; the one
  deterministically detectable category now has a guardrail that repairs the
  token instead of discarding the correction (ADR 0036). The other two
  categories, 10 of 14 observed tokens, stay open — no rule that only sees the
  transcript can reach them, and 2026-08-10 did not change that. What changed is
  upstream: two damage sources that feed this stage were removed before it
  (ADR 0080, ADR 0081), and `capture_integrity` on the record now makes the
  invention rate splittable by whether the audio behind the transcript was
  intact — the link that put this record in the capture cluster. Neither has
  been re-measured. Also records which look-alikes are legitimate German
  morphology, so the metric does not count them.
- [singular-address-becomes-plural.md](singular-address-becomes-plural.md):
  **narrowed, not closed** (located 2026-08-03, repaired 2026-08-10 under
  ADR 0081) — a dictated instruction to one addressee arrives addressed to
  several: `fix das bitte` ships as `fixt das bitte`. The output is well-formed
  German, so nothing marks it as damaged. Located on the **recognizer**, not on
  cleanup: in all 3 cases across 167 records the plural already stands in
  `raw_transcript`. The obvious suffix rule is unusable and the record carries
  the counter-evidence: it flags **45 tokens in 31 of 136 records, of which 3
  are the defect** — `Macht das Sinn?` is a third-person indicative and appears
  six-plus times. So the repair reads **mood** — clause-initial, not a question,
  no plural addressee, and a particle or `dir`/`dich` vouching for it — and it
  is **German-only by declaration**, gated on the detected language, because the
  bare-stem/stem-plus-`-t` pair that IS the defect exists in no other language in
  reach. `Denkt ihr …?` stays out of reach on purpose. Also qualifies the
  `switch` → `switcht` classification in the entry above.
- [style-rules-are-truncated-without-saying-so.md](style-rules-are-truncated-without-saying-so.md):
  open, found by looking (2026-08-10) — a style rule past 120 characters is cut
  with `...` appended and the budget meter stays black, because truncation is
  not a *drop* and only drops turn it red. On the owner's own profile both of
  two rules are truncated: 256 characters in the field, 247 counted, two tails
  gone and nothing on screen saying so. The meter is correct; what a black meter
  MEANS is the gap. Four possible fixes are listed, all of them product
  decisions rather than repairs.
- [macos-port-is-a-second-platform-backend.md](macos-port-is-a-second-platform-backend.md):
  open, scope record (2026-08-03) — what a macOS build actually costs. The
  conclusion "second backend, not a port" holds, but the blocker sits elsewhere
  than assumed: injection and hotkeys exist in code and are merely unrun
  (`ydotool`/`wtype` are deliberately skipped on Linux too), while the **overlay
  window strategy has no macOS path at all** — XWayland plus a KWin script,
  click-through pending layer-shell, and zero macOS branches in `lib.rs`. Second
  gap: Accessibility and Input Monitoring exist only as strings, with no probe,
  no request and no `bundle.macOS` block, so an ungranted session would render
  "ready" and paste nothing. The core is cleanly separated; the missing seam is a
  platform-window abstraction.

## Boundaries

- Architecture decisions: [decisions/](../decisions/) (append-only ADRs)
- Completed implementation specifications: [handoffs/](../handoffs/)
- Frozen donor references: [donors/](../donors/)
- Regression corpus:
  `src-tauri/tests/fixtures/regression_transcripts.json` and
  `core::regression_corpus`
