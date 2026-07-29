# 0016: A Speech Gate and a Confidence Gate Sit Before AI Cleanup

Date: 2026-07-29
Status: Accepted

## Context

[known-issues/transcription-hallucination.md](../known-issues/transcription-hallucination.md)
documented the failure and explicitly withheld authorization to fix it. This is
the approved slice it asked for.

Three defences were missing, and one existing defence was too narrow.

- **No speech gate.** `capture.rs` computed RMS only for level metering and the
  silence-timeout autostop. The WAV went to the provider unconditionally,
  leading and trailing silence included. Whisper invents subtitle boilerplate
  over silence; handing it silence is handing it the trigger. Handy, the
  closest open-source comparable (Tauri + Rust), gates audio with Silero VAD for
  exactly this reason.
- **Confidence signals discarded.** `lib.rs` hardcoded `response_format: "json"`,
  overriding the `verbose_json` that `groq.rs` already defaulted to.
  `TranscriptionResponse.segments` existed but was untyped and unread, and
  `supports_segments: true` was declared and never used. Whisper's own
  `avg_logprob`, `no_speech_prob` and `compression_ratio` were fetched by the
  provider and thrown away.
- **Local decode unhardened.** `whisper_cli_args` passed `-m -f -nt -np -bs -bo`
  plus language and prompt. None of whisper.cpp's hallucination controls were
  used.
- **The filter was a closed string list.** `is_hallucination` matched exact
  lowercase strings, a punctuation guard, a prefix list and bracket tokens. It
  caught `"untertitel von"` as a whole output and missed
  `"Untertitelung des ZDF, 2020"` appended to a real sentence.

## Decision

Four stages run before the LLM cleanup ever sees the text.

**1. Speech gate, lenient and never silent.** `trim_leading_trailing_silence`
cuts the quiet head and tail from the 16 kHz mono buffer, keeping a 150 ms pad
and leaving pauses *inside* the utterance alone — a pause between words is
speech. A capture below `MIN_SPEECH_MS` (200 ms) returns
`InputLevelVerdict::TooShort`.

200 ms is far below a real word; "Ja." runs 400–600 ms. The asymmetry is
deliberate: a swallowed dictation is worse for a heavy writer than a filtered
"Vielen Dank fürs Zuschauen", because the hallucination is still catchable
downstream and the lost sentence is not. TypeWhisper issue #732 is the
documented anti-pattern — an over-eager VAD that silently ate dictations under
6–7 seconds. Every discard therefore surfaces in the overlay through the
existing `CaptureOutcome::Empty` path, matching the "No speech detected"
convention used by TypeWhisper and Claude Code's voice dictation.
`WORDSCRIPT_MIN_SPEECH_MS` is a development escape hatch, not a setting.

**2. Confidence gate, cloud lane.** Segments are typed; a segment is dropped on
`no_speech_prob > 0.6 AND avg_logprob < -1.0`, or on `compression_ratio > 2.4`
alone. The first pair is required together because a hallucination on silence is
*confidently* wrong — either signal alone would reject real speech the model
merely found difficult. Compression ratio stands alone because a highly
repetitive segment is a stuck decoder regardless of confidence. The values are
Whisper's own reference-decoder defaults.

**3. Local decode hardening.** `probe_local_whisper_runner` already ran
`whisper-cli --help` and discarded the output; it now parses capabilities from
it. No extra process, no version detection. `--max-context 0` (kills
whisper.cpp's window-to-window decode-context carry, the internal amplifier
behind stuck loops, and independent of the user's `--carry-initial-prompt`),
`--logprob-thold`, `--no-speech-thold` and the `--vad*` family are added when
supported. An unsupported flag is skipped and logged, never an error.

**4. Post-STT detection.** Character, word and phrase repetition collapse, then
a pattern-based artifact gate for broadcaster and platform subtitle boilerplate.
Repetition runs first on purpose: collapsing an echoed boilerplate line turns it
into a single line the existing exact-string filter can also match.

### Thresholds are constants, not settings

Every threshold is a hardwired constant. They are Whisper internals, and
exposing them would repeat the exact mistake the "Bias Policy" panel already
made in the Profiles tab. Diagnostics shows *what* was filtered and why, through
`applied_rules` and the runtime log. That is the visibility half; there is no
control half.

### Language is never on its own a reason to discard anything

Normal speech mixes languages inside one sentence: anglicisms in German, a
Spanish phrase quoted inside English. That is legitimate transcription and must
survive untranslated and unaltered. The distinguishing marker of a hallucination
is not "a different language" but "a language block the audio does not support".

Two mechanisms enforce this:

- **The unit of analysis is a whole sentence.** A foreign-language span shorter
  than its sentence is never a candidate, so inline code-switching cannot be
  reached by the check at all.
- **A mismatch alone only sets `language_switch_flagged`** and writes a log
  line. A sentence is removed only when an independent signal corroborates it:
  a failed confidence gate, a matched artifact pattern, or a surviving
  repetition collapse. `language_locked` lowers the requirement from two
  corroborating signals to one. It never lowers it to zero.

The script-family comparison is deliberately coarse and cannot separate two
Latin-script languages. That is a feature here, not a limitation: German with
English terms never crosses a script boundary, so it is structurally
untouchable by this path.

## Consequences

- Silence, clicks and breath noise no longer reach a provider, removing the most
  common hallucination trigger and saving the API call.
- Short real dictations still go through. The gate errs towards transcribing.
- The local lane gets no segment confidence — `whisper-cli` returns none. Its
  defence is the trim plus the decode flags. Extending the gate needs
  `whisper-cli -oj`; that is a fast-follow, stated rather than hidden.
- Corpus v2 pins each mechanism, including two entries that assert legitimate
  multilingual dictation comes back byte-identical with every corroborating
  signal deliberately set.
- The artifact list will need maintenance as new boilerplate appears. That is
  expected: the comparable open-source filter (VoicePad) uses the same
  exact-plus-pattern shape at roughly 387 entries.
