# Donor References

These frozen repositories, comparison material, and slice-planning documents
were captured on 2026-06-10. They are not active product documentation; use
them for historical rationale, pattern comparison, and UX references.

- [BENCHMARK_MATRIX.md](BENCHMARK_MATRIX.md): dictation, local-runtime, and
  desktop-utility comparison.
- [CORE_EXECUTION_PLAN.md](CORE_EXECUTION_PLAN.md): donor-to-WordScript kernel
  slice mapping as of the freeze date.

Active architecture: [ARCHITECTURE.md](../ARCHITECTURE.md)
Architecture drift signals: issues labeled `arch-drift`

## The clones themselves are not in this repository

`donors/` at the repository root is gitignored, so the trees below exist only on
a machine that cloned them. **This page is the part that is kept**: what each
one answers, and where. A session that needs a mechanism reads the table and
opens one file, instead of searching a monorepo again.

## anarlog -- the meeting reference

`donors/app/meeting-notetakers/anarlog` · `github.com/fastrepl/anarlog` · **MIT**
· formerly Hyprnote · last commit at reading 2026-08-13 · read 2026-08-13 and
2026-08-14.

Made the primary reference for meeting work by
[ADR 0131](../decisions/0131-every-surface-that-starts-a-job-names-where-it-runs-and-the-drawing-already-decided-more-than-was-read.md).
**Read it for mechanism, not for structure** -- 616 MB of commercial monorepo
carrying mobile, web, Supabase and billing, against one desktop binary here.
What was taken and what was refused is
[ADR 0136](../decisions/0136-what-is-taken-from-the-donor-and-the-one-thing-it-does-that-must-not-be.md).

### Mechanism index

| Question | File | What is there |
|---|---|---|
| When does retained audio get deleted? | `apps/desktop/src/services/audio-retention.ts` | `deleteProcessedAudioForRetention` -- three conditions together: session idle, transcript has words, no attachment `processing`. The lifecycle-tied policy, built |
| What are the retention options? | `apps/desktop/src/services/audio-retention-policy.ts` | `none · oneDay · threeDays · oneWeek · oneMonth · forever`, and `none` means *delete once processed*, not *do not record* |
| How is the sweep scheduled? | same file as above; `crates/fs-sync-core/src/audio/mod.rs` | a 60 s interval on the app side; `delete_orphaned_expired` in Rust, which only touches UUID directories without a `_meta.json` |
| What does echo cancellation actually look like? | `crates/aec/` + `crates/audio-actual/src/capture/stream.rs` | two-stage ONNX (DTLN-AEC family), `BLOCK_SIZE 512` / `BLOCK_SHIFT 128` over `realfft`, 2--24 MB of weights; cross-correlation alignment to 600 ms of lag, minimum-RMS/overlap/correlation gates, smoothed linear gain, double-talk residual test |
| How is the cancelled signal carried? | `crates/audio/src/lib.rs` | `CaptureFrame { raw_mic, raw_speaker, aec_mic: Option<...> }` -- a second view, never a replacement, with a fallback accessor |
| How is a stopped-but-unfinished session held? | `crates/listener-core/src/actors/root.rs` | `active_session_id` plus a `finalizing_sessions` map, under a `ractor` supervisor tree |
| How are live partials shaped? | `crates/listener-core/src/live_transcript.rs` | `LiveTranscriptDelta { new_words, replaced_ids, partials }` -- partials are their own field, not words with a flag |
| Where does VAD sit? | `crates/audio-chunking/src/speech.rs`, `crates/vad-masking/src/masking.rs` | a `VadChunker` with a 600 ms redemption time and **no clock at all**; masking zeroes non-speech frames in place, preserving length and timeline |
| How is a call detected and stopped? | `crates/detect/src/mic/`, `apps/desktop/src/settings/general/meeting-settings.tsx` | watches which process holds the microphone; auto-stop when the meeting app releases it; detection is a reminder and never starts a recording |
| How is recording disclosed to the other participants? | `apps/desktop/src/stt/meeting-disclosure.ts` | one line posted into the meeting chat, 30 attempts at 1 s, once per session -- and settings copy that says it *does not confirm consent* |
| Is the meeting app's own chat captured? | `apps/desktop/src/stt/meeting-chat-capture.ts` | accessibility polling every 5 s, into the memo |
| Which models are live and which are batch? | `apps/desktop/src/stt/capabilities.ts` | `getSttModelTranscriptionMode` -- **use the conclusions, not the shape**: a 90-line inline cascade with no source and no read-date, which is the drift ADR 0115 exists to prevent |
| Is content protection solved? | `plugins/windows/swift-lib/src/{FloatingBarManager,LiveCaptionManager,FloatingOverlaySettingsPanel}.swift` | `panel.sharingType = .none`, macOS only. **The whole of it.** See the platform refusal in ADR 0136 |
| What geometry does a caption strip use? | `apps/desktop/src/meeting-float/settings.ts` | opacity 0.3, width 440, one line, `topCenter`, minimized by default |
| What does the product promise the user? | `docs/*.mdx` in that repo | `meetings`, `notes`, `chat`, `automatic-capture`, `data-and-privacy`, `customize-summaries`, `offline`. Read alongside the source; **where they disagree the source wins** |

### What it does not answer

- **The transcript half of a long recording.** It summarises per session and has
  no map-reduce; `meetily` is the only worked answer in the tree (ADR 0131).
- **Anything outside macOS for the five meeting surfaces.** That is the refusal
  in ADR 0136 and the section *Meeting surfaces* in
  [PLATFORMS.md](../PLATFORMS.md).
- **A provider picker at the point of use.** Both model choices live in
  settings. The two halves it does have -- context chips above the input, and a
  `Live` / `After recording` label on the model row -- are in
  [ADR 0135](../decisions/0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md).
- **A copilot.** No inference runs during a call; its two AI tasks both hang off
  `postCaptureAction`. That absence is itself a finding and is priced in
  ADR 0135.

## meetily -- the transcript-half reference

`donors/app/meeting-notetakers/meetily` · `github.com/Zackriya-Solutions/meetily`
· **MIT** · last commit 2026-06-05 · read 2026-08-13.

| Question | File | What is there |
|---|---|---|
| How is a long transcript summarised past a context window? | `frontend/src-tauri/src/summary/processor.rs` | map-reduce: `rough_token_count` = characters × 0.35, chunks at `token_threshold - 300` with 100 tokens of overlap, each window **snapped back to the last `". "`**, then a synthesise pass over the chunk summaries |
| What must not be copied from it? | `processor.rs:369` | the single-pass branch is taken for every non-local provider **regardless of length** -- a bet that a cloud context window is always large enough. ADR 0115 makes the ceiling knowable per `(provider, model)`, so the bet is unnecessary here |

## Where the other donors are cited

`openwhispr` and `voxtype` are cited by path from the surfaces that took
something from them -- the prototype's Speakers section, ADR 0129 for the upload
intake, ADR 0130 and ADR 0131 for VAD chunking. They have no index page yet; add
one here when a second session has to search them.
