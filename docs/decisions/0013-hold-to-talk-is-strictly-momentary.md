# 0013: Hold to Talk Is Strictly Momentary

Date: 2026-07-29
Status: Accepted

## Context

`hold_min_ms` (300 ms) did not gate a hold — it *extended* one. A press below the
threshold did not stop the capture on release; it scheduled a `DeferredStop`
that fired once the recording had reached 300 ms. Every press therefore produced
a real recording and a real transcript, and the duration of the hold changed
nothing about the outcome. A one-millisecond brush of the trigger and a
deliberate three-second hold both ended in the same place.

That is not push-to-talk. It is tap to toggle with a 300 ms floor, which is what
a live session on 2026-07-29 showed and what made the mode feel broken to the
user even though start and stop were both working. It also corrects the older
record: D11 in
[known-issues/capture-shortcut-recording.md](../known-issues/capture-shortcut-recording.md)
claimed hold to talk did nothing at all. Both edges arrive and both act; the
defect was in what they meant, not in whether they were delivered.

Three comparable products were checked before deciding:

| Product | Model |
|---|---|
| [VoiceInk](https://tryvoiceink.com/docs/shortcuts) (open source, GPL) | Three modes. *Hybrid*: "A short press starts or stops recording. Holding for at least 0.5 seconds records until you release." |
| [Superwhisper](https://superwhisper.com/docs/get-started/settings-shortcuts) (proprietary) | One binding: "Quick click: acts as toggle recording" / "Press and hold: functions as push-to-talk" |
| [Wispr Flow](https://docs.wisprflow.ai/articles/6391241694-use-flow-hands-free) (proprietary) | Hold is push-to-talk; a **double tap** of the same key latches hands-free mode |

Only principles were taken from these; no code or asset was copied. The
convergent finding is that a hold needs a minimum duration before it counts.
The divergent part is what a short press should then do, and that is where the
three products disagree — because two of them have no double-tap mode and need
somewhere to put the latch gesture.

## Decision

Hold to talk is strictly momentary. A press below `HOLD_ARM_MS` (300 ms, a fixed
constant in `core::trigger`) is discarded: no session, no overlay, no cue, no
history entry. A press that reaches the threshold commits, and the release
stops it.

No latch gesture is added to the mode, and none is added to tap to toggle.
WordScript already ships two latching modes (ADR 0008). A hybrid branch inside a
third mode would be a second way to reach behavior the selector already offers,
and the three options would stop being disjoint. VoiceInk and Superwhisper need
Hybrid precisely because they lack a double-tap mode; that gap does not exist
here.

The threshold does not delay the microphone. The press opens the audio stream
immediately and keeps the session provisional
(`TriggerEffect::StartCaptureProvisional`); only `CommitHold` starts the session,
reveals the overlay and plays the listen cue. Arming the stream at the threshold
instead would cost the first ~300 ms of every dictation.

The same threshold gates pause/resume and abort while hold mode is selected, the
way `requires_double_tap` already gates all three capture-lane bindings in
double-tap mode. An activation mode describes the whole lane, not just
start/stop.

## The provisional phase is an explicit state

A provisional hold is the one moment in the lane where "the key is held" and "a
session is capturing" are legitimately different facts. That has to be named,
not inferred. `sync_trigger_state_with_session` runs on every incoming shortcut
event and clears `hotkey_active` whenever the session is not `Capturing` —
sound while a session always accompanied a held key, and actively harmful once
the provisional window exists. It cleared the flag mid-hold, the matching
release was then dropped as a release without a press, and the provisional
capture was stranded with the microphone open. The next press met
"A native audio capture is already active".

`HoldPhase` (`Idle` / `Provisional` / `Committed`) makes the state explicit, and
the sync leaves a provisional hold alone. Everything else derives from it: the
release is handled whenever a hold is in flight even if the held flag was lost,
a failed provisional start cancels the hold so the arm timer cannot commit a
session with no audio, and the capture monitor starts with the stream rather
than with the session so no capture is ever unsupervised.

Two consequences of the same reasoning:

- A press that arrives while the previous transcript is still processing is
  refused at the press edge (`ignored_processing`), the way tap mode already
  refuses it. Opening a microphone for 300 ms only to have the commit rejected
  produced an error banner for something the user could not act on.
- A provisional start that loses the race with a capture still shutting down is
  logged, not raised as a failed session. It is a race between two presses, not
  a device problem.

## Consequences

- A mistouch of the trigger costs nothing. Previously it cost a transcript, a
  history entry and a provider call.
- The listen cue moves from the press edge to the commit, which keeps it
  anchored to the moment the recording becomes real (ADR 0012). There is a
  deliberate ~300 ms gap between pressing and hearing the cue; that gap *is* the
  feedback that the hold registered.
- `hold_min_ms`, `DEFAULT_HOLD_MIN_MS` and `TriggerEffect::DeferredStop` are
  gone. `NativeTriggerStatus.hold_min_ms` becomes `hold_arm_ms` — the name now
  says what the number does. The frontend contract changes with it.
- The watchdog (`hold_watchdog_seconds`, ADR 0007 territory) now arms at the
  commit rather than at the press, because it guards a session and below the
  threshold there is none.
- The threshold stays a fixed constant. It is not a preference: a user-tunable
  value here would need a UI, a clamp, a migration and a per-mode explanation,
  and no evidence yet suggests 300 ms is wrong for anyone.
- Tap to toggle and double tap to toggle are untouched. Their existing tests
  pass unchanged, which is the intended proof that this decision is contained to
  one mode.
- A user who wants a recording that keeps running without a held key is pointed
  at the toggle modes, in the Settings hint for the hold option.
