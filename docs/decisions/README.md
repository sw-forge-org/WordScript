# Architecture Decision Records

Architecture Decision Records (ADRs) are small, dated, immutable records of
individual decisions. They complement the living [architecture overview](../ARCHITECTURE.md)
and [product direction](../VISION.md); neither overview replaces ADRs.

## When to Create an ADR

Create one for a consequential, difficult-to-reverse decision: a runtime or
data contract change, provider strategy, licensing, hosting, window-chrome
strategy, authentication, or sync direction. Do not create ADRs for routine
code style or small implementation details.

## Format

Use `NNNN-short-title.md`, in ascending order. Never renumber an existing ADR.

```md
# NNNN: Title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by NNNN

## Context

## Decision

## Consequences
```

## Rules

- ADRs are never rewritten retroactively.
- A changed decision requires a new ADR that marks the prior one as superseded.
- `spec-sync` may identify a decision that needs human review, but it does not
  create an ADR without explicit confirmation.

## Existing ADRs

- [0001](0001-tauri-rust-als-runtime-owner.md): Tauri/Rust owns product runtime behavior.
- [0002](0002-cloud-first-groq-byok.md): cloud-first Groq BYOK provider strategy.
- [0003](0003-native-fensterdekorationen.md): native window decorations on every platform.
- [0004](0004-agpl-3-0-lizenz.md): AGPL-3.0 licensing.
- [0005](0005-local-first-sync-richtung.md): optional WordScript-owned local-first sync direction.
- [0006](0006-rust-owns-the-shortcut-contract.md): one Rust module owns the
  shortcut token vocabulary, display strings and validity rules; the UI carries
  no key table.
- [0007](0007-capability-matrix-is-measured-not-assumed.md): the shortcut
  capability matrix is derived from session facts plus measured press/release
  evidence, never from a per-OS assumption about hold to talk.
- [0008](0008-double-tap-is-the-default-activation-mode.md): `double_tap` is the
  default activation mode, because the default triggers are modifier-only;
  existing configs keep their chosen value.
- [0009](0009-modifier-only-shortcuts-are-observed-not-grabbed.md): a
  modifier-only shortcut is observed through the raw key stream instead of
  grabbed, so the modifier keeps working for everyone else; a shortcut with a real
  key is still grabbed.
- [0010](0010-audio-cues-are-a-synthesised-motif-on-one-persistent-stream.md):
  audio cues are synthesised from one G-major theme -- a startup signature the
  operational cues quote fragments of -- and play on a single persistent output
  stream instead of a device opened per cue.
- [0011a](0011a-one-decision-surface-per-delivery-mode.md): each delivery mode has
  exactly one surface on which the user decides -- `clipboard_only` before
  delivery, `auto_paste` after it -- and the overlay derives it from runtime
  state set in one reducer commit instead of per-mode bridge predicates.
- [0011b](0011b-the-mode-lane-sits-on-alt-not-on-ctrl.md): the mode lane -- mode
  select plus the six per-mode jumps -- moves from `Ctrl` to `Alt`, because a
  modifier-plus-key shortcut is still a global grab and `Ctrl+S` /
  `Ctrl+1`-`Ctrl+6` are taken away from every other application.
- [0012](0012-cues-are-anchored-to-the-delivery-point.md): audio cues are emitted
  by the session lifecycle next to the event that tells the UI the same thing,
  not from inside the insert helper.
- [0013](0013-hold-to-talk-is-strictly-momentary.md): hold to talk discards a
  press below `HOLD_ARM_MS` instead of extending it to that length, and gains no
  latch gesture -- the two toggle modes already own latching. The microphone
  still opens on the press edge, so committing later loses no word.
- [0014](0014-every-modifier-only-binding-is-decided-at-the-release-edge.md):
  pause and abort follow the rule start/stop already followed -- a modifier-only
  binding is decided at the release edge, where the interruption signal is
  knowable, and an interrupted chord acts on nothing. In hold mode the deferred
  action fires on the release rather than on the arm timer; the threshold is
  unchanged.
- [0015](0015-the-runtime-transcription-request-has-one-resolved-source.md): the
  capture config crosses the event boundary as one flattened value and exactly
  one function derives a provider request from it. The two hand-maintained JSON
  schemas had drifted, so per-profile bias policy and every local decode setting
  were silently dropped on every real recording.
- [0016](0016-a-speech-gate-and-confidence-gate-sit-before-ai-cleanup.md): a
  silence trim, a segment-confidence gate, capability-probed whisper.cpp decode
  flags and a repetition/artifact detection stage all run before AI cleanup.
  Thresholds are constants, not settings, and a language mismatch is never on
  its own a reason to discard anything.
- [0017](0017-vocabulary-moves-out-of-the-whisper-prompt.md): profile vocabulary
  is applied deterministically after transcription; only entries the user opts
  into per item reach Whisper's initial prompt. The `BiasMode` enum and its
  `ManualBias` flags are replaced by one per-entry toggle, dictionary terms
  leave the prompt entirely, and the four Profiles panels become three.
- [0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md): the native
  event channel mirrors session status but does not end a session. `status`,
  `pendingResult`, `previewStaged` and `resultSurfaceOpen` change only in the
  authoritative `wordscript-event` transcription commit, so the atomic swap of
  ADR 0011a holds against the event ordering too; a bounded fallback covers an
  authoritative event that never arrives.
- [0019](0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md):
  every path that ends a session also commits the surface that reports it,
  including the timeout fallback, and once ended a surface is never re-decided.
- [0020](0020-the-processing-mode-is-the-only-transform-axis.md): the processing
  mode is the only input to transform behavior. Modes are fixed presets, the three
  cleanup toggles are removed because the runtime discarded them, Auto resolves to
  exactly one entry of the flat mode list at one commit point, and neither
  Verbatim nor Rewrite is reachable from Auto. Carries the measurement that
  rejected Auto->Verbatim.
- [0021](0021-profile-context-has-one-shape-in-every-mode.md): the profile
  context reaches every mode at one width and in one shape, produced by
  `core::profile_context`; the mode decides the framing, never the width. The
  recognizer's word-shape filter stays on the recognizer path. Carries the
  96-transcript replay that licensed widening Cleanup.
- [0022](0022-a-window-on-no-monitor-is-never-a-position-the-user-chose.md): a
  stored window position that lands on no monitor is discarded rather than
  restored, because it cannot be a position the user chose.
- [0023](0023-profile-context-is-a-reading-aid-and-a-register-sets-form-not-lexis.md):
  the profile context is a reading aid for the instruction, never a source of
  content -- it moves into the Agent system prompt behind an explicit
  restriction, the user turn carries only the transcript, and snippets
  contribute trigger without expansion. Adds a per-profile communication style
  whose register sets form only: slang and youth language come from the user's
  rules and writing sample, never from the model's memory. Every prompt is now
  written in English.

- [0024](0024-the-processing-mode-has-one-source-and-every-writer-announces-it.md):
  the active profile's work mode is the only source of the effective processing
  mode. The process-global `MODE_OVERRIDE` is removed -- it was set by every
  mode-change path, cleared by none, and therefore made each later settings
  change invisible to both the overlay and the pipeline. Every writer now emits
  `wordscript-mode-event` alongside `ready`, and the overlay's fetch debounce
  coalesces to the last request instead of dropping it.

- [0025](0025-a-session-belongs-to-the-profile-it-started-in.md): the active
  profile is fixed for the duration of a session and everything derived from it
  is snapshotted at capture start; the processing mode is the single exception.
  Switching profiles mid-session is refused by the runtime, because it produced
  a transform assembled from two profiles on top of a transcription that had
  already run under the first.

## Resolved: the number 0011 was used twice

Recorded 2026-07-29, resolved the same day. Both
`0011-one-decision-surface-per-delivery-mode.md` and
`0011-the-mode-lane-sits-on-alt-not-on-ctrl.md` were filed on 2026-07-27 under
the same number; only the first was listed here until the defect was found,
which is why the collision went unnoticed. Both are accepted and neither is
wrong, so neither could simply be withdrawn.

**Resolution: a disambiguating suffix, not a new number.** The delivery-surface
record is now `0011a`, the mode-lane record `0011b`. Renumbering the second one
to the next free number was the alternative and was rejected: it would have
broken the rule above -- *never renumber an existing ADR* -- and a reader
meeting a bare "ADR 0011" in an older commit, issue or handoff would silently
land on the wrong record with no signal that anything had moved. The suffix
keeps both numbers where they were filed, so an old bare reference still points
at the right pair and merely needs one letter of disambiguation.

Both files were renamed and their title headings changed from `0011` to `0011a`
and `0011b`. That heading edit is the only change made inside either record —
the decision text itself is untouched, because *never rewrite retroactively*
governs the content, not the identifier the record is filed under, and a record
whose heading contradicts its own filename is worse than either.

This is a one-time exception for a filing accident. It is **not** a licence to
file two ADRs under one number: 0018, 0019 and 0020 are filed, the next decision
takes 0021.

Reference state after the fix, re-checked 2026-07-29 across the whole repo. The
earlier audit in this section was incomplete -- it claimed every "ADR 0011"
outside the decisions meant the delivery-surface record, and two of them do not:

- **0011a** (delivery surface): `ARCHITECTURE.md`, `REFERENCE.md`, `STATUS.md`
  (two places), `spec/SPEC.md` (two places), `known-issues/overlay-ghosting.md`,
  `CHANGELOG.md` (the overlay surface entry).
- **0011b** (mode lane): `CHANGELOG.md` (the `Ctrl`-to-`Alt` entry) and
  `handoffs/HANDOFF_activation-mode-gestures-and-defaults.md` (the migration
  pattern it cites as precedent).

All of them now carry the letter. Cite these two by number **with** the suffix.
