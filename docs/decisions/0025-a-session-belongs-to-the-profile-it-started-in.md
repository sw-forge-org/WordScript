# 0025: A Session Belongs to the Profile It Started In

Date: 2026-07-30
Status: Accepted

## Context

Follow-up to ADR 0024, which established that the processing mode can be
changed mid-recording and will apply to that recording. The obvious next
question is what happens to *everything else* a user might change while the
microphone is open.

Two timings exist in the pipeline, and the answer differs by which one a setting
is read on:

- **Capture start.** `NativeCaptureConfig::load_from_disk()` snapshots the
  active profile: provider, model, language, profile text, vocabulary,
  dictionary, snippets, correction model, audio device, timeouts. The session
  runs on that snapshot, so mid-recording edits to any of it simply do not apply
  — they land on the next recording.
- **Audio ready.** `handle_audio_ready` loads the config again for the mode,
  and — before this ADR — also for the profile label, the deprecated
  `stt_hints`, the agent name and the communication style.

### The destructive case: switching profiles mid-session

Only one thing genuinely breaks, and it breaks badly. Switching the active
profile changes `active_text_profile_id`, which is read on the *second* timing.
The result was a single `AgentConfig` assembled from two profiles:

| Field | Read at | Profile |
| --- | --- | --- |
| `profile_label`, `stt_hints` | audio ready | **B** |
| `profile_prompt`, `dictionary_entries`, `snippet_entries` | capture start | **A** |

And underneath it, the transcription had already run on profile A's provider,
model, language and STT bias — which no later step can undo, because the audio
is already through the recognizer.

So a mid-session profile switch could never be fully applied. It could only ever
be half-applied, and the half was not chosen, it fell out of where each value
happened to be read.

### The inconsistent case: agent name and style

The same second timing meant that editing the agent name or the communication
style during a recording *did* affect it, while editing the profile text in the
same panel did not. One rule, two answers, with nothing in the product
explaining which setting followed which.

## Decision

**The profile is fixed for the duration of a session, and everything derived
from it is snapshotted with it. The processing mode is the single exception.**

That line is not a preference; it follows from what each setting configures.
The profile configures the *recognizer*, which is committed the moment recording
starts. The mode configures *post-processing*, which has not happened yet. One
can still change, the other cannot.

### The profile is locked while a session runs

`sessions::session_is_active` (stage `Capturing` or `Processing`) guards both
paths that can change the active profile:

- `switch_active_text_profile` returns `PROFILE_LOCKED_DURING_SESSION`.
- `save_config` rejects a payload whose `active_text_profile_id` differs from
  the live one. A settings save carries the whole config, so it is a second way
  in — by selecting another profile, or by deleting the active one and letting
  normalization fall back to the first.

The guard lives in the runtime, not only in the UI. Disabling the switcher
covers one button; it does not cover the tray, a hotkey, or a path added later.
The UI disables the control and states the reason before the attempt, so it
explains itself rather than failing.

`ProfileSwitcher` also stopped applying its local patch optimistically. It now
waits for the runtime, because the previous order left the UI showing a profile
the runtime had refused.

### The snapshot is complete

`profile_label`, `agent_name` and `communication_style` move into
`NativeCaptureConfig`, alongside the profile text and vocabulary that were
already there. `NativeTransformConfig` carries them through, and the pipeline
reads them from the snapshot rather than resolving them again.

The result is one sentence a user can hold: **during a recording, only the
processing mode still changes anything. Everything else applies from the next
recording.**

The three new fields carry `#[serde(default)]`. They ride in the same event
payload as the rest of the capture config, so a missing key would fail the whole
capture rather than one setting — the failure mode ADR 0015 exists about. A test
pins that a payload without them still loads.

## Consequences

- Switching profiles during a recording is refused with an explanation instead
  of silently producing a mixed configuration.
- Editing the agent name or the communication style mid-recording no longer
  affects that recording. This is a behaviour change, and it is the point:
  previously it did, while editing the profile text next to it did not.
- Deleting the active profile while recording is refused as well, via the
  `save_config` guard. Deleting any *other* profile is still allowed.
- Not locked, deliberately: everything else in Settings. Provider, model,
  language, dictionary, snippets, hotkeys, overlay placement and audio device
  are already inert for a running session because they live in the snapshot, so
  a lock would add a refusal without preventing anything. The rule is "the
  session uses what it started with", not "the settings window freezes".
- Still true, and still unaddressed here: the transcription request is built
  from the snapshot, so nothing about the recognizer can be changed mid-session
  under any design. That is a property of recording, not a defect.
- `AgentConfig.stt_hints` is fed from the capture config's `stt_hints`, which
  since ADR 0017 holds the opt-in vocabulary phrases rather than the deprecated
  free-text field the pipeline used to read. That is a quiet improvement rather
  than a decision, and worth knowing when reading the agent prompt.
