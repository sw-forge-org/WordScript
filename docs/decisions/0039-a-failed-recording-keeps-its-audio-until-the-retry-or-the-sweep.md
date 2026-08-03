# 0039: A Failed Recording Keeps Its Audio Until the Retry or the Sweep

Date: 2026-08-03
Status: Accepted

## Context

The 679-second capture in ADR 0038 was not merely un-transcribed. It was
**unrecoverable within seconds of failing**, and that was a separate defect with
a separate cause.

The native pipeline ended with one unconditional line:

```rust
let _ = tokio::fs::remove_file(cleanup_path).await;
```

It ran on every path. Success, empty result, stale session, abort — and
transcription failure. By the time the error pill had rendered, the WAV was
gone. Forensic carving from free space was the only remaining option, and it
needed root, a stopped dev server and luck.

The retry that existed did not help. `retry_transcription_history_entry` re-runs
the *transform* from `raw_transcript`:

```rust
let raw_transcript = existing.raw_transcript.clone()
    .filter(|value| !value.trim().is_empty())
    .ok_or_else(|| "This history entry does not contain a raw transcript, so it cannot be re-processed.")?;
```

A transcription timeout never produces a `raw_transcript`. So the one class of
failure where the audio is the only surviving artifact was exactly the class the
retry refused, and the runtime had already deleted the artifact that would have
made it possible. The error message was accurate and useless.

The overlay's error surface reinforced it: an icon, a message, and no action.
The runtime was already emitting `retryable` and `user_action` on the error
event; the overlay ignored both.

## Decision

**Deletion follows the outcome.** The pipeline keeps the capture when the
failure is one a second attempt could survive — `error.retryable`, or
`ProviderErrorKind::Timeout`. Every other path deletes exactly as before, so the
kept files are precisely the recoverable ones and nothing else accumulates.

**The entry records where the audio is.** `TranscriptionHistoryEntry` gains
`audio_path: Option<String>`, set only by `record_transcription_failure` and only
when the capture was kept. `#[serde(default)]`, so existing history files load
unchanged.

**Retry means two things now, and which one is decided by what survived.**

- a `raw_transcript` exists → re-run the transform (the previous behaviour)
- no transcript but a kept capture → **re-transcribe from the audio**, with a
  fresh budget from ADR 0038
- neither → the old error message, which is finally true

The retry rebuilds the provider request from the *current* capture config rather
than the one the failed run used. A retry happens because something was wrong,
and the fix is often a setting changed in between.

**The error surface offers the retry.** The overlay's `ErrorPill` gains a Retry
action, rendered only when the runtime reports `audio_retained`. It goes through
`retry_transcription_history_entry` rather than a second pipeline entry point, so
the overlay and the history list run the identical path — a retry that behaves
differently depending on which button started it is two behaviours to keep true.

**Kept audio expires.** Seven days or twenty files, whichever binds first,
swept at startup and after each retained capture. These are raw recordings of
everything the microphone heard; an unbounded directory of them is a disk
problem and a privacy problem. A recording worth keeping for a retry is not
worth keeping forever, and the sweep is what makes "keep it" safe to say at all.

**Keeping a file changes what it is worth protecting.** Three guards follow from
the audio living for days rather than seconds:

- Captures are written `0600`. The default `0644` was tolerable for a file that
  existed for two seconds; a raw recording of everything the microphone heard,
  readable by every local account for a week, is not.
- The sweep deletes only files matching `capture-<n>.wav` **in the capture
  directory**. `temp_audio_dir` is user-configurable, so "every `.wav` here"
  would delete the user's own recordings the moment they point it at a folder
  that has some. A sweep may not be destructive outside what it created.
- A retry re-sends a file only if it passes that same membership test.
  `history.json` is a plain file on disk; without the check, anything able to
  write it could point a retry at an arbitrary path and have WordScript upload
  it to the transcription provider, turning a local write into an exfiltration
  path.

## Consequences

A failed transcription is now a state the user can act on from where they
already are, instead of a report about something that no longer exists.

`~/.config/WordScript/tmp/` may hold WAVs between a failure and its retry. This
is intended and bounded. A successful retry leaves its transcript in the history
entry, which makes the WAV redundant; the sweep collects it rather than a
delete-on-success path, so a user who wants a second attempt still has one.

The pipeline's final cleanup is now conditional on a flag set in one branch. That
flag is the only writer, and every other path still deletes — the invariant is
"kept only where a retry has something to work with", not "kept on failure".

`record_transcription_failure` takes one more argument. It has one caller.

## Related

- ADR 0038 — why the recording failed. This ADR is about what remains
  afterwards; the two shipped together because either alone still loses
  recordings.
- ADR 0018 / ADR 0019 — a session ends in exactly one reducer commit, and the
  native channel never sets session state. The retry is not a session: it runs
  through the history command and produces a new entry, so neither rule is
  touched.
- ADR 0020 — a control whose effect is invisible. A Retry button with nothing
  behind it would be that defect, which is why it appears only when the runtime
  says the capture survived.
