# The recognizer preview reads the legacy stt_hints field, the runtime does not

Status: fixed 2026-07-30.

**Correction:** the first version of this record claimed the *runtime* bypassed
the `use_as_prompt_hint` opt-in. That was wrong, and wrong in the direction that
matters. The runtime is correct. The Settings preview was not. The claim came
from tracing `text_rules.rs` — the analysis path — and assuming it was the
capture path.

## What was actually wrong

Two paths derive what reaches Whisper's initial prompt, and they disagreed.

**The runtime (correct).** `NativeCaptureConfig::from_app_config`
(`capture.rs:240`) sets `stt_hints: active_profile.prompt_hint_phrases()
.join("\n")`, and `prompt_hint_phrases` (`config.rs:461`) keeps only
`vocabulary_hints` entries with `use_as_prompt_hint`. Exactly what ADR 0017
specified.

**The preview (wrong).** `PromptsTab` sent `activeTextProfile.stt_hints` — the
legacy free-text field that `migrate_vocabulary_hints` copies from but never
clears — into `analyze_text_rules`, which fed it to
`analyze_transcription_bias_with_mode` as the recognizer's "Likely phrases"
section.

So the panel rendered a cloud prompt preview the provider never received.

## Observed on the live config (2026-07-30)

Profile `curated-product-engineering`, schema version 2, `bias_mode:
conservative`, 4 `vocabulary_hints` with **none** opted in, legacy `stt_hints`
still holding `triage summary`, `release note`, `qa handoff`,
`incident update`.

| | showed / sent |
| --- | --- |
| Settings preview | `Likely phrases: triage summary; release note; qa handoff; incident update` |
| Actual request | no initial prompt at all |

Turning a vocabulary entry on or off changed nothing in the preview, because the
preview was not reading that list.

## The fix

`AnalyzeTextRulesRequest` now carries `vocabulary_hints`, and the analysis
derives the recognizer phrases with the same `prompt_hint_phrases` helper the
capture path uses, instead of reading the legacy field. One derivation, one
owner. The manual `stt_hints_override` path is unchanged.

The legacy field itself is left in place. Nothing reads it for the recognizer
any more, so clearing it is cleanup rather than a fix, and ADR 0017 already
scheduled its removal under a follow-up.

## Why it mattered

A preview whose only job is to answer "what does the provider actually get"
answered it wrongly, and it did so in the panel where the user decides whether
to opt a term in. It is the same family as ADR 0020 — a control and its
displayed effect disconnected — with the disconnect on the display side.

## Related

- ADR 0017 — moved vocabulary out of the Whisper prompt and defined the opt-in.
- ADR 0021 — the transform-side counterpart.
