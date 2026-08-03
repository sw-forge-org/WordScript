# 0038: A Recording the App Permits Is One the Pipeline Can Finish

Date: 2026-08-03
Status: Accepted

## Context

A 679-second dictation was lost on 2026-08-02. The runtime log is unambiguous
about how:

```
audio_duration_seconds=679.58  transcription_timeout_ms=35000
Groq audio.transcriptions timeout attempt=1 elapsed_ms=35011
Groq audio.transcriptions timeout attempt=2 elapsed_ms=35005
Native pipeline transcription failed kind=Timeout
```

Three separate rules disagreed with each other, and each one looked correct on
its own.

**The transcription budget stopped scaling at one minute.**
`runtime_transcription_timeout_ms` capped its input at `duration.min(60.0)`
before multiplying, so an 11-minute capture was granted exactly what a
one-minute capture was: 35 seconds. `MAX_TRANSCRIPTION_TIMEOUT_MS` was 35 s, and
with the cap in place it was unreachable-by-design above 60 s of audio — the
formula had a ceiling it could never exceed and a floor it always hit.

**The watchdog was shorter than the request it supervised.**
`PIPELINE_HARD_DEADLINE` was a fixed 120 s while a two-attempt transcription of
a long capture legitimately needs longer. On any recording where the provider
call was doing real work, the watchdog would report "the pipeline did not
complete" about a pipeline that was completing.

**The capture path never consulted either.** "Max recording" offered up to 30
minutes. Groq rejects uploads over 25 MiB, which at the export's 16 kHz mono
i16 is 13:39 of audio. Nothing in the product ever said so. `normalize_for_runtime`
even carried the arithmetic in a comment — *"Groq free tier caps at ~25 MiB ≈ 13
min"* — as a note beside a `clamp(60, 1800)` that ignored it.

The user was invited to make a recording the app could not process, and was told
only after the recording was gone.

## Decision

**One source decides what a recording may cost.**
`core::capture_budget` resolves the ceiling, the auto-stop, the transcription
wait and the watchdog deadline from the same inputs. Nothing recomputes any of
them — not the capture monitor, not the settings surface, not the overlay.

**The wait scales across the whole capture.** The 60-second cap is gone.
`MAX_TRANSCRIPTION_TIMEOUT_MS` rises to 10 minutes, enough for a capture at the
ceiling to upload and decode on a slow link. `pipeline_deadline` is derived from
the transcription budget times the attempt count plus a tail, so the watchdog
always outlasts what it watches. A watchdog that can fire before its subject
finishes is a second timeout that no message names.

**A provider states its own limits; the budget knows only their shapes.**

```rust
pub struct ProviderCaptureLimits {
    max_audio_bytes: Option<u64>,   // bound by request size
    realtime_factor: Option<f64>,   // bound by decode time
    detail: String,                 // the cause, phrased for a settings row
}
```

Dispatched through `providers::capture_limits`, the same `match ProviderId` that
`provider_status`, `transcribe_audio_file` and every other capability already
use. The cloud lane declares bytes, the local lane declares a decode factor, a
lane may declare both and the tighter one binds. **A lane that declares nothing
gets no ceiling of its own** and falls through to the configured maximum — an
unknown provider must not inherit Groq's number, because a guessed ceiling reads
as authoritative and sends the fix in the wrong direction when it is wrong.

Account plans are declared the same way (`providers::provider_tiers`). Groq
offers free (25 MiB) and developer (100 MiB); the local lane offers none, and the
settings surface renders the control only where there is something to choose. An
unrecognised plan id falls back to the provider's default rather than to its
largest: being wrong towards "you may record less" costs a retry, being wrong the
other way costs the recording.

**Three limits, three names.** They were two controls that never mentioned each
other; they are now three, ordered by how hard each one is:

| Name | What ends the recording | Owner |
| --- | --- | --- |
| Stop after silence | you stopped talking | profile |
| Auto-stop | the recording got long, and it ends here so it still goes through | profile |
| Processing limit | past this, nothing can be transcribed at all | runtime |

**The auto-stop keeps headroom under the processing limit.** The ceiling is
exact arithmetic over an estimate: the capture monitor checks on a 200 ms tick,
the export writes a header, and a provider's accounting of request size need not
match ours to the byte. An auto-stop sitting exactly on the ceiling produces
recordings that are occasionally a second too long, and a second too long costs
the entire recording. `safety_margin_for` is ten percent, clamped to 30–120 s,
and the settings surface recommends `ceiling - margin` rather than the ceiling.

**A configured value past the ceiling is reported, never rewritten.** The stepper
will not offer one, but existing configs have them. The row states that
recordings stop earlier than the saved number and why. A setting the user made is
not the runtime's to silently edit (ADR 0020).

## Consequences

`MIN_TRANSCRIPTION_TIMEOUT_MS`, `MAX_TRANSCRIPTION_TIMEOUT_MS`,
`TRANSCRIPTION_TIMEOUT_PER_AUDIO_SECOND_MS` and `PIPELINE_HARD_DEADLINE` no
longer exist in `lib.rs`. `runtime_transcription_timeout_ms` survives as a thin
forward so the call sites read unchanged.

A new provider is a declaration, not a new branch. Adding one means answering
`capture_limits` and `provider_tiers`; every surface that states a limit picks
the answer up without edits.

The recording ceiling is the *free* tier by default. A developer-tier account
selects its plan in Settings → Language Models and gets the longer ceiling. This
is a machine-wide setting, not a per-profile one: the plan belongs to the
credential, and every profile on that provider shares it.

`AppConfig` gains `provider_tier`. Absent in an existing config file it
deserializes to empty, which resolves to the provider's default — the shipped
behaviour, unchanged.

## Note on the overlay signal (added 2026-08-03)

The auto-stop tab first shipped as a threshold flash: three announcements
(start, two minutes left, thirty seconds left), each retracting after 1.9 s, in
the same left-hand slot as the learned-word nudge. Two things were wrong with
it in use, and both are worth recording because they were design choices, not
bugs:

- **It was absent when it mattered.** A deadline that retracts is not a
  deadline. The last thirty seconds are exactly when the signal has to be
  readable, and that was a moment with nothing on screen.
- **It did not fit.** The strip beside the pill is `(480 - pillWidth) / 2`, and
  "Ends 12:00" was clipped against the window edge — worsened by measuring the
  text before the webfont had loaded, which sized the shutter for the fallback
  face.

The correction to that overshot in the other direction: holding the tab open for
the entire recording put a countdown on screen for ten minutes in which nothing
was going to happen — permanent space earning its place for a few seconds of it,
on a surface whose whole argument is that it stays out of the way.

The shipped shape is the narrow one. `.ov-limit-tab` sits to the **right** of the
pill (the learned nudge is on the left, so neither has to yield a slot), is
**absent** until two minutes before the auto-stop, and then holds — a bare `m:ss`
countdown, accent, turning red and pulsing inside thirty seconds. There is no
quiet state, because a tab with nothing urgent to say does not need to exist.
Most recordings never reach it.

It was also briefly tried *inside* the pill; that widens a pill whose window is a
fixed 480px, which is the clipping defect the uniform width exists to prevent.

## Related

- ADR 0034 — a limit is stated where it is spent, and the runtime reports its own
  boundaries. This ADR is that argument applied to the capture path: the limit
  now appears on the control that spends it, and every number crossing into the
  UI is the runtime's.
- ADR 0020 — a control whose effect is invisible. A capture length whose
  consequence only appears after the recording is lost is the same defect with a
  longer delay.
- ADR 0015 — the provider request is derived from a capture. The budget is
  derived from the same place, so both move together.
- ADR 0039 — what happens to the recording when the pipeline fails anyway.
