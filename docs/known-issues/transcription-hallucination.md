# Raw Transcription Hallucinations

Status: **Open; documentation only (2026-07-24)**

## Symptom

Raw speech-to-text output can lose the intended language, insert foreign-language
fragments, or emit subtitle and closing-phrase artifacts. Observed examples
include broadcast-like labels, closing phrases, music or applause markers, and
language shifts during a sentence or after silence.

The failure occurs before AI cleanup in both the Groq Whisper and local
`whisper-cli` paths. It affects every processing mode because they consume the
same raw transcription.

## Current Behavior and Limits

- Cloud requests send `language` and `prompt`; these are hints, not a hard
  language lock.
- Local requests send analogous `--language`, `--prompt`, and optional
  `--carry-initial-prompt` arguments.
- Conservative bias avoids broad profile hints in the cloud prompt, which
  prevents profile-driven language bias but cannot solve audio-driven drift.
- `is_hallucination` is a narrow post-processing string filter. It handles
  known whole-output or prefix phrases but cannot reliably remove embedded
  foreign fragments from raw STT output.
- Cleanup intentionally preserves legitimate mixed language and product terms,
  so it must not be used as an unqualified hallucination remover.

## Investigation Hypothesis

Whisper-family models are prone to this class of output with trailing silence,
background audio, low signal-to-noise input, or very short utterances. A prompt
can influence the result but cannot force language detection. This is an
investigation hypothesis, not an established provider defect.

## Research Directions

- Evaluate a local faster-whisper path with silence thresholds, disabled prior
  context, no-speech thresholds, and compression-ratio checks where supported.
- Assess `whisper.cpp` controls such as `--no-context`, bounded prompt use, and
  output-length limits.
- Design a real post-STT detection stage for repetition density, implausible
  mid-sentence language switches, and generated trailing text.
- Compare a second-pass transcription pattern against VAD preprocessing that
  removes trailing silence before STT.
- Review frozen donor material for provider orchestration, local engine, and
  streaming patterns before selecting an implementation.

## Required Evidence Before a Fix

Any proposal must first add representative sanitized cases to
`src-tauri/tests/fixtures/regression_transcripts.json` and test the relevant
prompt, bias, text-rule, and transform behavior. A correction must preserve
legitimate multilingual dictation and must not hide failure through UI-only
copy or post-insert recovery.

## Scope

This record documents the problem only. It does not authorize an implementation
or a roadmap change. A separate, explicitly approved slice must turn the
research result into a runtime contract and tests.
