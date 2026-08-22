# 0246: A Failed Transcription Keeps Its Audio, and a Plan Does Not Raise an Attachment Limit

Date: 2026-08-21

Status: Accepted

## Context

A capture of 1066.3 seconds — 17:46, with 277.0 s of speech — was recorded on
2026-08-21 at 05:40 on the `curated-founder-ops` profile, exported to
`capture-63.wav` at 34,108,638 bytes, refused by Groq with `413` after 228 ms,
and deleted 6 ms later. The history entry is
`history-1787283653333-112`. `capture_integrity` says `intact`, `input_level`
says `ok`, the callback cadence recorded `signature=no_gaps`. Nothing about the
recording was wrong. It is simply gone.

**Two independent defects had to line up for that, and each is worth fixing on
its own.**

### The recording was permitted because a plan was read as an allowance

`capture_budget` derives the ceiling from `ProviderCaptureLimits.max_audio_bytes`,
which `groq::capture_limits` took from the selected plan: 25 MiB on `free`,
100 MiB on `dev`. The connection stores `plan: "dev"`, so the runtime computed
100 MiB ÷ 32,000 B/s = 3,276 s, clamped it to the 1,800 s configuration maximum,
and drew a 30-minute ceiling with a 28-minute headroom line on the settings card.
Every one of those numbers was arithmetic on a premise nobody had tested.

**It had never been tested because no capture had ever been large enough.** Across
113 records the longest previous recording was 475.4 s ≈ 14.5 MiB. The free/dev
distinction was declared in ADR 0038, wired into a picker, asserted by two tests
and carried on three surfaces, and the first capture that put weight on it was
the one that broke.

**Measured 2026-08-21 against the Developer-tier key**, both sides of the
boundary, with `x-ratelimit-limit-audio-seconds: 400000` on the successful
response — the account is paid, and the upload is refused anyway:

| Attachment bytes | Answer |
| --- | --- |
| 25,165,824 (24 MiB) | `200` |
| **26,214,400 (25 MiB)** | **`200`** |
| **26,738,688 (25.5 MiB)** | **`413` `request_too_large`** |
| 27,262,976 (26 MiB) | `413` `request_too_large` |
| 34,108,638 (the capture above) | `413` `request_too_large` |

Groq's documentation carries both figures and they describe different things.
*25 MB free / 100 MB developer* is a **file**-size limit; the same page states
that the **attachment** is capped at 25 MB and names the `url` parameter as the
way past it. A multipart body is the only shape `openai_compatible.rs` sends and
`url` needs hosted audio, which a local-first product does not have. So the
100 MiB row described a path this product cannot take, and the ceiling built on
it was never real.

### The audio was deleted because retention asked about the request

ADR 0039 kept a failed capture and built the retry that re-transcribes from it.
Its condition:

```rust
keep_audio = error.retryable
    || matches!(error.kind, core::providers::ProviderErrorKind::Timeout);
```

`provider_error_is_retryable` covers `RateLimited`, `Timeout`, `Network`,
`ProviderStatus` and `Io`. A `413` is `InvalidRequest`, so `keep_audio` was
false and the unconditional delete ran. The runtime log for `native-63` has no
`Native pipeline retained audio` line: **the deletion was correct behaviour under
the rule as written.**

The rule asks whether the same request would succeed if repeated. That is a
property of the request. What decides whether a recording may be thrown away is
whether anything else survived it — and after a failed transcription nothing
else ever does. There is no `raw_transcript`; the capture is the whole of what
the user said. ADR 0039 diagnosed exactly this for the timeout case and then
drew its boundary one class too narrow. The same line would have deleted the
same dictation for an expired key, a rejected model id or a parse failure.

## Decision

**A failed transcription keeps its audio, whatever failed.** `keep_audio` is
unconditional in the error arm. Retention stops being a judgement about the
error and becomes what it always described: the capture is the only artifact, so
it is kept until the retry or the sweep. Every other path — success, empty
result, stale session, abort — still deletes, unchanged.

**The attachment limit is a measured vendor fact, and no plan raises it.**
`GROQ_ATTACHMENT_MAX_AUDIO_BYTES` replaces the two plan constants, carries the
measurement and its date, and is what `validate_audio_upload_size` enforces.
Both rows of `tiers()` report it, so the ceiling no longer moves with the plan.

**The bound on kept captures becomes a size, not a count.** ADR 0039 swept at
seven days or twenty files. A count answers *how many*, which is a question
nobody has: twenty one-minute captures are 38 MiB and twenty at the ceiling are
half a gigabyte, so one number meant two things and neither was the one that
mattered. It also became the wrong bound the moment retention stopped being
conditional — an afternoon of expired-credential failures fills twenty slots
easily, and the file a count evicts first is the oldest, which is the one
somebody has been meaning to come back to. The rule is now **seven days or four
gigabytes**, which is ADR 0241's shape for the two collections it bounded:
*days are the policy, gigabytes are the backstop, files are neither.* The
ceiling is stated in decimal because the screen that displays it is decimal.

**The upload is refused before it is made.** The validator ran against 100 MiB
and therefore passed a file the vendor was always going to reject, which spent
32.5 MiB of uplink to learn something the byte count already knew. It now
refuses at the real limit, and the error carries the recovery rather than the
vendor's wording.

**A plan buys rate limit, not request size.** ADR 0167 keyed the plan to a
credential and that stands; what changes is what the value means. The Groq rows
say so, and the row hint on Models stops promising a longer recording.

## Consequences

**The Groq speech ceiling falls from 1,800 s to 819 s** — 13:39 at 16 kHz mono
i16 — and the reason on the card changes from `ConfiguredMaximum` to
`ProviderUploadLimit`. That is a real loss of usable minutes and it is the
honest number; the previous one was a ceiling the provider would not honour, and
being wrong in that direction costs the whole recording rather than a retry.

**Minutes come back through the format, not through the plan.** Groq accepts
FLAC and its own page recommends it for this case. Lossless FLAC on 16 kHz mono
speech is roughly half the bytes of PCM, so the same 25 MiB buys roughly twice
the minutes. That is a separate change to the export path and is not decided
here.

**The unbounded answer is already decided and is not this.** ADR 0130 settled
that a long recording is a sequence of turns cut on silence rather than a
chunker with a seam-stitcher, and routed it to the speech track's C1. C1 is
standing down until the runtime-ownership track's step 6 has read one natural
`Short` capture, because rewriting `core::capture` under measurement makes that
event unattributable. This record does not touch that ordering and does not
reopen it.

**`~/.config/WordScript/tmp/` will hold more WAVs than before.** What makes
that safe is the sweep, whose age bound, `0600` permissions and membership test
— only files matching `capture-<n>.wav` in the capture directory — are
unchanged; only its second bound moved from a count to a size, above. The
policy that a reader feels is still the week.

**A retry of an oversize capture still fails until something changes**, and that
is correct rather than a gap. ADR 0039 rebuilds the request from the *current*
configuration, so the retry succeeds once the profile names a lane without the
limit. What it no longer does is fail because the recording is missing.

**The Plan control's justification has narrowed and that is filed, not
resolved.** With both rows reporting one limit, the picker no longer changes any
ceiling a user can see, which is the shape ADR 0020 calls a control whose effect
is invisible. It still selects a real difference in rate limit, and whether that
is worth a control is a question for the surface that owns it.

## Related

- ADR 0039 — kept a failed capture and built the retry. This record widens its
  condition and leaves its sweep, its permissions and its membership test
  untouched.
- ADR 0038 — declared the plans and the budget this corrects.
- ADR 0034 — a limit belongs to the control that spends it, which is why
  correcting one constant moved four surfaces at once.
- ADR 0167 — a plan belongs to a credential. Unchanged; only what a plan buys
  is corrected.
- ADR 0130 — the turn model, and why it is the answer to length rather than a
  larger upload.
- ADR 0020 — the control whose effect is invisible, named above as an open
  question rather than answered.
