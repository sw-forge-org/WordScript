# 0015: The Runtime Transcription Request Has One Resolved Source

Date: 2026-07-29
Status: Accepted

## Context

The transcription request was derived twice, independently, from the same data.

`capture.rs::stop_native_capture` hand-built the `audio_ready` event with a
`serde_json::json!({...})` literal that named seventeen fields of
`NativeCaptureConfig`. `lib.rs::handle_audio_ready` then hand-parsed that JSON
back with per-key `optional_string` / `optional_u8` / `value.get(...)` lookups.
Two hand-maintained schemas for one struct, with nothing connecting them.

They had drifted. The emit side never wrote `bias_mode`, `manual_bias`,
`local_prompt_strength`, `local_prompt_carry`, `local_beam_size`,
`local_best_of` or `local_profile` at the top level; the read side looked for
exactly those keys. Every lookup fell through to its default, so **every real
recording ran `BiasMode::Conservative`, `ManualBias::default()`,
`local_prompt_strength = "profile"`, `carry = false` and the model preset's
beam/best_of, regardless of what the user had configured.**

The preview path never had this bug, because
`text_rules.rs::bias_context_from_request` builds its context from typed request
fields. So the Profiles tab rendered the configured truth while the runtime
discarded it — which is precisely why profiles felt inert and why changing the
bias policy never changed a transcript. There was no regression coverage on the
runtime path at all: the corpus only exercised the preview.

`NativeCaptureConfig::load_from_disk` was never wrong. It resolved every field
correctly from the active profile. The defect lived entirely at the
serialization boundary.

## Decision

The capture config crosses the event boundary as one value, and exactly one
function derives a provider request from it.

- `AudioReadyEvent` carries `#[serde(flatten)] config: NativeCaptureConfig`.
  `handle_audio_ready` deserializes the whole event into that same type. Adding
  a field to `NativeCaptureConfig` now reaches the runtime with no second edit.
- `NativeCaptureConfig::resolve_transcription_request` is the only place a
  `TranscribeAudioFileRequest` is built from a capture. It lives on the struct
  that owns every field it reads.
- `BiasRequestContext::from_work_mode` is the shared constructor for the bias
  policy. `text_rules` keeps its own request-shaped builder, because it analyses
  *unsaved* UI state where every field is still optional — a genuinely different
  input, not a duplicate.
- `NativeTransformConfig::from_payload` became `from_capture_config`. Its
  rewrite-style fallback was deleted rather than ported: `filter_fillers` and
  `professionalize` arrive already resolved through
  `TextProfileWorkMode::effective_*`, so re-deriving them from JSON only
  duplicated logic that `config.rs` already owns and tests.

`optional_string`, `optional_u8`, `transcription_prompt_for_request`,
`cloud_transcription_prompt_for_request`, `local_preview_prompt_for_request`,
`local_preview_prompt_carry` and `transcription_bias_preview_from_payload` are
gone. There is no untyped path left between capture and provider.

## Consequences

- Per-profile bias policy and local decode settings take effect on real
  recordings for the first time. Users who configured Manual bias or a larger
  beam size will see their transcripts change — this is the fix working, not a
  regression.
- The class of bug is closed structurally, not patched. Adding keys would have
  fixed the symptom and left the two schemas free to drift again.
- `audio_ready_round_trip_preserves_bias_policy_and_local_decode_settings` in
  `capture.rs` is the guard: it round-trips a config with non-default bias and
  decode values through the event and asserts the resolved request reflects
  them. It is the test that would have caught this on day one, and it is
  deliberately a plumbing test — the linguistic-content corpus could never have
  found a pure serialization gap.
- The cloud lane now requests `verbose_json`, which the same resolver sets. See
  ADR 0016 for what reads those segments.
