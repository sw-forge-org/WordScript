# Raw Transcription Hallucinations

Status: **Mitigated; approved slice landed (2026-07-29)** — see
[Approved Slice](#approved-slice-2026-07-29). Not resolved: real language
identification and local segment confidence stay deferred, and **one shape of
the defect was found unreached on 2026-08-13** — a closing phrase appended to a
real sentence, which neither filter can see. See
[the addendum](#addendum-2026-08-13-the-closing-phrase-that-arrives-attached-to-a-sentence).

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

This record documented the problem only until 2026-07-29. It did not authorize
an implementation; the slice below is the separate, explicitly approved one it
asked for. Everything above this line stays as the historical record of what
was known before the fix.

## Approved Slice (2026-07-29)

Decisions: ADR 0015 (one resolved source for the transcription request),
ADR 0016 (speech gate and confidence gate before AI cleanup).

### What the investigation actually found

The largest single cause was not a model defect. **Per-profile bias policy and
every local decode setting never reached the provider.** `capture.rs` hand-built
the `audio_ready` payload and `lib.rs` hand-parsed it back, and the second
schema omitted `bias_mode`, `manual_bias`, `local_prompt_strength`,
`local_prompt_carry`, `local_beam_size`, `local_best_of` and `local_profile`.
Every recording silently ran Conservative bias with preset decode defaults no
matter what the profile said, while the preview panel showed the configured
truth. That is why profiles felt inert and why bias changes never moved the
result.

### What landed

- **One resolved source.** `NativeCaptureConfig` is serialized whole into the
  event and deserialized whole on the other side;
  `NativeCaptureConfig::resolve_transcription_request` is the only place a
  provider request is derived. A field added to the capture config now reaches
  the runtime without a second hand-maintained schema.
- **Speech gate before STT.** `trim_leading_trailing_silence` removes the quiet
  head and tail; a capture shorter than `MIN_SPEECH_MS` (200ms, overridable via
  `WORDSCRIPT_MIN_SPEECH_MS`) ends as `InputLevelVerdict::TooShort`. The gate is
  deliberately lenient and never silent: every discard surfaces in the overlay.
- **Confidence gate on the cloud lane.** The runtime asks for `verbose_json`
  again, segments are typed, and `core::confidence_gate` drops a segment on
  `no_speech_prob > 0.6 AND avg_logprob < -1.0`, or on
  `compression_ratio > 2.4` alone.
- **Local decode hardening.** The existing `--help` probe now also reports
  capabilities. `--max-context 0`, `--logprob-thold`, `--no-speech-thold` and
  the `--vad*` family are passed when supported and logged when skipped.
- **Post-STT detection stage.** `core::hallucination_detect` collapses
  character, word and phrase repetition, and filters broadcaster subtitle
  boilerplate by pattern rather than by exact string.

### The language rule

A language mismatch is **never on its own** a reason to discard anything. The
unit of analysis is a whole sentence, so a foreign-language span shorter than
its sentence is never a candidate — inline anglicisms and quoted phrases cannot
be reached by the check at all. A sentence is removed only when a mismatch is
corroborated by an independent signal: a failed confidence gate, a matched
artifact pattern, or a surviving repetition collapse. `language_locked` lowers
the bar from two signals to one, never to zero. Corpus entries
`raw_german_with_english_terms_is_untouched` and
`raw_quoted_spanish_inside_english_is_untouched` pin this as byte-identical
output.

### Research directions that remain open

- faster-whisper as an alternative local path.
- Real language identification instead of the script-family heuristic, which
  cannot separate two Latin-script languages by design.
- Segment-level confidence on the local lane; it needs whisper-cli's `-oj`
  JSON sidecar output.
- Second-pass transcription as an alternative to VAD preprocessing.

## Addendum 2026-08-13: the closing phrase that arrives attached to a sentence

Reported by the owner beside a separate defect: *"dass noch manchmal
Trainings-Artefakte am Ende der Sätze auftauchen wie thank you oder Thank you
for watching, like and subscribe."*

**The slice above covers this class and does not reach this shape.** Both
mechanisms it built are structurally unable to see an artifact that shares a
line with real speech, and the word lists in the code make it look otherwise.

### Measured, on this machine

A scan of 200 records in the developer's live `history.json` returns two with a
trailing closing phrase, and the two fail differently:

```
history-1786574234951-200   applied_rules: ['post_correction_no_change']
  raw: "Da hab ich hier drüber gesprochen Thank you"
  out: "Da hab ich hier drüber gesprochen Thank you"        <- delivered

history-1786567957095-200   applied_rules: ['post_corrected']
  raw: "… vielleicht d2 oder wie auch immer keine ahnung
        So, I'm going to go ahead and see the next one."
  out: "… vielleicht D2 oder wie auch immer, keine Ahnung."  <- artifact gone
```

The first shipped. The second lost its artifact **to the correction model, not
to a filter** — the AI stage happened to drop the foreign sentence while
cleaning. That is not a mitigation; it is the same stage this cluster elsewhere
records for inventing content, getting one right by chance.

Two in 200 is a floor from a deliberately loose pattern with a high
false-positive rate — eight of the ten matches were ordinary German containing
`danke`, `bitte` or a farewell. There is no rate for this shape.

### Why both filters miss it

| Mechanism | Reaches | Misses this because |
|---|---|---|
| `transform::is_hallucination` | The whole transcript as one unit (`transform.rs:199`) | Its `EXACT` list contains `"thank you"`, `"thank you for watching"`, `"vielen dank fürs zuschauen"` and eleven more, and its prefix list contains `"subscribe"` and `"like and subscribe"` — but the string it tests is the **entire** trimmed transcript. An artifact appended to a real sentence never equals or starts with any of them |
| `hallucination_detect::artifact_patterns` | One sentence at a time, which is the right granularity | Its nine patterns cover subtitle credits (`Untertitel von …`, `Subtitles by …`), copyright lines, and bracketed `[Musik]` / `[Applause]` markers. **The closing phrases are not among them at all** — no pattern matches `Thank you for watching`, `like and subscribe`, `Vielen Dank fürs Zuschauen` or `Tschüss` |
| The language check | A whole sentence whose dominant script differs from the expected one | English inside German is Latin script on both sides. The corpus pins this as unreachable **on purpose** (`raw_german_with_english_terms_is_untouched`), because the alternative deletes legitimate anglicisms |
| `confidence_gate` | Segments with `no_speech_prob > 0.6` and `avg_logprob < -1.0` | The only mechanism that does catch these, and its own test fixture is `segment("Thank you for watching!", 0.91, -1.4, 1.1)`. It needs `verbose_json` segment metrics, so it is **Groq-only** — the local lane returns `json` and has no segment confidence, which the slice above already lists as deferred. And it only fires when the artifact landed in a segment the decoder was unsure about |

So the artifact is caught when it arrives as its own low-confidence segment and
missed when it arrives inside a sentence the decoder was confident about. Both
happen.

### In the corpus

`recognizer_appends_a_closing_phrase`, from the first record above. It asserts
today's behaviour — that the detection stage returns the text unchanged and no
signal fires — and is deliberately **not** flagged `unchanged`, because that
flag asserts *legitimate dictation must survive byte-identical* and this is not
legitimate dictation. It is the gap, pinned so a future rule has to face it.

### What a fix has to respect

The narrow-artifact rule in `artifact_patterns` is described in its own comment
as *"the one place where rejecting on suspicion is right, because the precision
is near perfect"*, and that holds because every pattern names a credit line
nobody dictates. Closing phrases are not in that category: **`Vielen Dank` and
`Danke` are ordinary German, and `Thank you` is ordinary English.** A pattern
that strips them per sentence would delete a real sign-off from a dictated
email — which is exactly the failure mode this record exists to prevent,
committed by its own fix.

What separates the artifact from the sign-off is position and provenance, not
wording: it stands at the very end, in a language the rest of the transcript is
not, after a stretch the decoder was unsure about. Any rule here needs at least
two of those, and the corroboration machinery for that already exists in
`DriftCorroboration`. Nothing has been built.
