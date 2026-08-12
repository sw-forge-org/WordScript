# 0063: A meeting has four ways in, one of them watches the microphone, and only a press ends it

Date: 2026-08-05
Status: Accepted (planning direction; **blocked on a capability — nothing is built**)

## Context

Meeting capture is a second capture type: an hour long, microphone *and* system
audio, inserts nothing, ends as a note ([§10.4](../archive/plans/settings-rework.md)).
It is a roadmap **candidate** with a decision gate, and its first gate question
is the one this record answers:

> Does capture start from a hotkey, from detecting a call, or both? A detection
> prompt cannot be an OS notification — invisible in Focus mode, visible in a
> screen share — which makes it a third surface to own.

The drawn screen carries that question as an `Open decision` badge with three
answers (`Ask` / `Start recording` / `Do nothing`), and `Settings → Notes &
Meetings` carries the same row. The meeting hotkey is drawn `not set`.

**The donor answers the mechanism, and it is cheaper than the gate assumed.**
`donors/app/desktop-shells/openwhispr` was read for this decision — read for
mechanism, not copied; it is AGPL-3.0 as this product is, and no code crosses:

- `meetingProcessDetector` exists and its events are **deliberately
  context-only**: a running meeting app never triggers a prompt. Its own comment
  gives the reason — an app like FaceTime sitting in the background is a false
  positive, and this is the detector that looks most obviously right.
- The trigger is `audioActivityDetector`, and what it watches is **another
  process holding the microphone** — `pactl list source-outputs` on Linux, the
  platform equivalent elsewhere. Sustained over ~6 s polled or 2 s event-driven.
- Calendar reminders enter **the same pipeline** as microphone detections, so
  they share the gates, the queue, the cooldown and the one prompt window. The
  reminder fires 60 s before the start; a 5-minute imminence threshold decides
  whether the prompt reads *starting* or *underway*.
- The prompt is a content-protected, always-on-top window that never takes
  focus, with one action button (`Start`, or `Join` when the calendar event
  carries a join URL) and a dismiss.
- Detection is suppressed while a meeting is already running and **queued, not
  dropped, while the user is dictating**. A dismissal cools the detector down
  for five minutes; an expired prompt is not a decline.

**The consequence that changes the roadmap:** detecting that a call is happening
needs no system-audio capture at all. It is a read of which processes hold the
microphone. The expensive capability blocks *recording*, not *noticing*.

The fourth way in is already on the drawn surface and was not counted as a way
in: `Context → intake → Record` offers *Start recording*, the pane list's foot
carries *Record meeting*, and an upcoming calendar meeting carries *Record
this*.

## Decision

**Four ways in, and they all produce the same thing.**

| Way | What it is | Notes |
| --- | --- | --- |
| **The meeting hotkey** | its own key, never the dictation key | one inserts and one does not, so they must never be the same press |
| **A calendar meeting, offered shortly before** | the prompt window, naming the meeting | the object already exists; recording fills in its transcript |
| **A call detected** | the prompt window, unnamed unless a calendar event is within five minutes | the trigger is another process holding the microphone |
| **`Context → New → Record`** | the drawn intake, and *Record this* on a scheduled meeting | the ordinary deliberate path, from the list the object will land in |

**Detection watches the microphone, not the running applications.** A process
list says an app is installed and open; a held microphone says somebody is
talking to somebody. The first is the one that looks right and produces false
positives all day.

**The detection prompt is the notification window ADR 0043 already decided**,
carrying a different payload. It is always-on-top, content-protected, takes no
focus, is remembered per monitor, and is not an OS notification for exactly the
reasons ADR 0043 gives: Focus mode and screen sharing suppress those, and a
screen share is when a call is most likely to be running. **This is not a third
surface to own.** The gate's assumption that it would be is what made this
question look more expensive than it is.

**It does not inherit that notification's dismissal rule, and the difference is
the point.** A waiting agent question is blocking somebody, so it never times
out. A detection prompt is an offer about something already happening: it
**expires unanswered**, and expiring is not a decline. A dismissal cools the
detector for a few minutes so the same call does not ask twice; an expired
prompt leaves detection armed, so joining a call late still offers.

**The drawn three-answer setting stands, with `Ask` as the default.** `Start
recording` is for people who want it automatic; `Do nothing` turns the watch
off entirely, and turning it off is a real answer rather than a broken state.

**Only an explicit stop ends a capture.** The HUD's bar carries it as the
primary action while recording. Nothing infers the end of a call: the microphone
being released means somebody muted, changed device or the app crashed, and
ending an hour of recording on that guess is unrecoverable. This is the same
shape as ADR 0044's rule that the safe answer is the default answer.

**What holds its state is the context object, not the window.** A meeting is one
of ADR 0045's objects with `origin: meeting`; the HUD is a way of looking at it
while it is live. When the capture stops, the window closes and nothing is
migrated or created — the object is in Context, no longer live, exactly as the
drawn row says. That is why "the window stops being the way you look at it" is
prose rather than a transition: there is no transition to draw, because the
window was never where the state was.

**A meeting and a dictation never run at once.** A detection while dictating
queues rather than prompting; the dictation hotkey during a meeting writes into
the note rather than inserting anywhere (the drawn bar's *Talk to it*).

## Consequences

- **This is blocked on a capability and Leg 4 skips it entirely.** System-audio
  capture and echo cancellation do not exist in the runtime, and neither is a
  control that can be wired. Leg 2d's line stands: *"Leg 4 cannot wire this
  screen at all; it is a capability, not a control."*
- **The detection half is separable and is the cheap half.** A microphone watch,
  a calendar read and a prompt window are buildable without any of the capture
  work — and useless without it, since accepting the offer has nothing to start.
  Do not build it early on the grounds that it is cheap.
- **The calendar adapter is now load-bearing for two features.** §11.52 already
  owes it read-only with three authentication models; the offer-before-the-start
  path is a second caller, and the 60-second lead is a value that belongs in
  settings rather than in code.
- **The second gate question is still open**: what happens to the audio of a
  meeting nobody keeps. ADR 0038 and ADR 0039 bound a dictation's audio; an hour
  is a different size of promise. Two surfaces carry it as `Open decision`
  (`Privacy & Data`, `Notes & Meetings`) and they keep carrying it.
- **The third gate question is unchanged**: whether system-audio capture works
  without a per-session authorization prompt on the target platforms. Same gate,
  same reason, as the libei candidate.
- **The `not set` meeting hotkey is honest and stays that way.** ADR 0041 already
  recorded that the shipped defaults occupy `Alt+1`–`Alt+6` and that the next
  thing needing a key takes none rather than silently extending the row.
- Nothing here relaxes anything about the dictation pill. `focus: false`, 440 ×
  60 and every token in `overlay*.css` are untouched; the two windows are
  different objects with different obligations, which is the whole of §10.4.
