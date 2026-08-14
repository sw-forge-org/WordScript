# 0136: What is taken from the donor, and the one thing it does that must not be

Date: 2026-08-14

Status: Accepted

## Context

[ADR 0131](0131-every-surface-that-starts-a-job-names-where-it-runs-and-the-drawing-already-decided-more-than-was-read.md)
made `donors/app/meeting-notetakers/anarlog` the primary reference for the
meeting work and said to **read it for mechanism, not for structure**: a 616 MB
commercial monorepo carrying mobile, web, Supabase and billing, against one
desktop binary.
[ADR 0135](0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md)
spent that reading on three open product questions.

This record is the other half of the same reading: **what is taken, what was
only observed, and the one thing the donor does that this product may not.**
It exists so the next session does not re-derive the same answers out of the
same 616 MB, and so the refusal at the end is a decision on the record rather
than a preference somebody has to re-argue.

anarlog is MIT and this repository is AGPL-3.0, so nothing below is obstructed
in either direction. Its last commit at the time of reading was 2026-08-13; it
was formerly Hyprnote, and its team now builds a separate commercial product
while keeping this one open.

## Decision

### The drawn Context object is confirmed, not revised

`demo.js`'s `contextScreen()` draws one object with four tabs -- **Transcript,
Notes, Summary, Linked** -- over one type with five states and four origins
([ADR 0045](0045-everything-recorded-is-one-object.md)). anarlog arrives at
three of the four independently: `Transcript`, `Memos`, `Summary`, one session
object, uploads and calendar events filed into it rather than beside it, and a
calendar-backed note that exists **before** the meeting -- which is ADR 0045's
`scheduled` state under another name.

Two products reaching the same merge without contact is the strongest
confirmation the drawing has, and **nothing about the object is reopened here.**

**Two places where the drawing is ahead, and both for the same reason: it states
provenance on the surface.**

- The transcript's `who-chips` carry a status (`locked`, `suggested`,
  `provisional`) and a source (`mic`, `calendar`, `cluster`). anarlog **has the
  behaviour** -- it re-clusters at the end and protects a name the user set
  (`refine_speaker_diarization`, `crates/db-app/src/voiceprint_ops.rs`) -- and
  shows none of it. A guessed name and a confirmed one are drawn identically
  until one of them silently changes. That is exactly what
  [ADR 0047](0047-a-speakers-name-is-never-in-the-audio.md) exists to prevent.
- `Linked` is relationship **at the object**, computed on this machine from
  shared people, shared topics and the calendar series. anarlog's nearest
  equivalent is chat with context chips: search on request, and the answer goes
  through the Intelligence provider. Both answer *what connects*; only one of
  them answers it without sending anything anywhere.

### Four mechanisms are adopted

**1. The retention guard.** Recorded in ADR 0135; named here as donor-sourced so
the provenance is not lost when that record is read alone.

**2. Echo cancellation never replaces the original.** `crates/audio/src/lib.rs`
carries `CaptureFrame { raw_mic, raw_speaker, aec_mic: Option<...> }`, and
`preferred_mic()` falls back to `raw_mic` when the cancelled view is absent. On
disk the two sources stay separate files. **A bad cancellation pass must not
cost the recording** -- the same reasoning ADR 0039 applied to a failed
transcription, one stage earlier.

The shape is also specific enough to price, which
[`ROADMAP.md`](../ROADMAP.md) was not: a **two-stage ONNX model** of the
DTLN-AEC family (`crates/aec/`), `BLOCK_SIZE 512` / `BLOCK_SHIFT 128` over
`realfft`, weights embedded at build time and between 2 MB and 24 MB depending
on the variant. Around it, in `crates/audio-actual/src/capture/stream.rs`: the
speaker signal is aligned to the microphone by cross-correlation up to **600 ms
of lag**, with minimum-overlap, minimum-RMS and minimum-correlation thresholds
below which the pass is skipped rather than guessed, a smoothed linear gain, and
a double-talk residual test. The ROADMAP called this *a real component, not a
flag* without saying what the component is. It can now say.

**3. A stopped session is not a finished session, and the runtime holds both.**
`crates/listener-core/src/actors/root.rs` keeps `active_session_id` **and** a
map `finalizing_sessions`. That is the state
[ADR 0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md) and
[ADR 0134](0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
imply and neither names: exactly one commit ends a session, the runtime owns
that commit, and for a meeting the interval between *stop pressed* and *commit*
is long enough to be a state a user can see. A dictation could get away without
it. An hour of meeting with a notes pass behind it cannot.

**4. The recording disclosure is posted into the call.**
`apps/desktop/src/stt/meeting-disclosure.ts` writes one line into the meeting
chat when listening starts -- 30 attempts at one-second intervals, once per
session, remembered so a resume does not repeat it. The part worth copying is
the donor's own settings copy: *"this does not confirm consent."*

ADR 0064 makes consent a field on the conversation, set at any point, read by
whoever opens the object two years later. **A field only the recorder reads is a
record, not a disclosure.** The posted line is the other half and does not
replace the field: optional, off by default, and it makes no claim about whether
anyone agreed.

### Three genuine gaps, and one claim that was wrong

Checked against the drawing rather than assumed, which changed the count.

- **`Resume listening` -- adopted.** Attaching a second recording to a finished
  object, for a call that resumes after a break. ADR 0064 rules that closing the
  pop-out does not end a running session; a **finished** object has no such rule,
  and re-recording into a new object splits one conversation into two.
- **A picker beside `Summary`, and `Reset to default` -- adopted, and the
  drawing is otherwise ahead.** anarlog's Auto prompt is one editable field in
  settings. WordScript draws `actionsPanel()` plus `Notes & Meetings → Actions`:
  name, description, *Runs on*, prompt, **each prompt a Markdown file in
  `_actions/` beside the notes, editable in your own editor**, with two
  built-ins. What is missing is only the picker at the point of *reading* a
  summary, and a reset for the two built-ins.
- **Selective export at the object -- adopted.** `Privacy → Export → Full
  export` exists as one archive. The object's own `Export` control has no form:
  memo, summary and transcript in any combination, in the formats the object can
  produce.
- **The dictionary already reaches the recognizer, and the claim that it did not
  was wrong.** Profiles → Defaults → *Where each list lands* says
  `Words & names -- repairs mangled terms -- recognizer + AI`, drawn and per
  profile. This is recorded rather than quietly dropped because the wrong claim
  was made during this session's donor comparison, and a record that lists only
  the surviving gaps teaches the wrong lesson about checking the drawing first
  -- which is the rule ADR 0131 was written to enforce and which failed again
  here, in the smaller direction.

### The notes root becomes an optional per-profile override

Today `Notes folder` is machine-wide (`Notes & Meetings → Where notes live`,
`~/Documents/WordScript`), and everything a profile carries is a *preference*
rather than a *place*: mode, delivery, workspace context, stop rules, and the
four lists.

**A profile may name its own notes root, and the field is empty by default.**
Unset means the machine-wide root, so a single-profile install pays nothing.
Set, it means switching profiles switches the body of Markdown and audio you are
working in -- which is the difference between one person with several writing
styles and one person with several clients.

**The consequence to see before building it:** `_actions/` lives beside the
notes and every folder in the rail is a directory under the root, so a
per-profile root makes actions and folders per profile too. For a client
register that is the point; for somebody who only wanted a different default
mode it is duplication. That is why the override is **opt-in and per profile**
rather than a restructure of where notes live.

### What must not be taken: the platform dodge

In anarlog, the floating bar, the live-caption panel, content protection, the
disclosure and meeting-chat capture are **all** behind `isMacos`
(`apps/desktop/src/settings/general/meeting-settings.tsx`), and microphone
detection is off on Windows. The whole of its content protection is
`panel.sharingType = .none` in three Swift files under
`plugins/windows/swift-lib/`.

`ROADMAP.md` names content protection as scope for the meeting window **without
a platform qualifier**, and [`PLATFORMS.md`](../PLATFORMS.md) is the document
that carries per-OS reality.

**The donor is evidence of the cost, not a template for the answer.** A funded
team taking the exemption measures the price; it does not license it. A
capability that exists on one operating system and silently does not exist on
another is the fake-state rule raised to the level of a platform -- the window
either stays out of the screen share or it does not, and *on macOS* is not an
answer a person in a call can act on.

Where the capability genuinely does not exist on a platform, it is named on the
surface and in `PLATFORMS.md`, the way the insert path already names its limits.
What is refused is shipping the surface as though the guarantee were universal.

## Consequences

**[`docs/donors/README.md`](../donors/README.md) gains an anarlog entry as a
mechanism index** -- path to solved problem -- so the next session reads one
table instead of 616 MB. `donors/` is gitignored, so the index is the only part
of that tree the repository keeps.

**`PLATFORMS.md` gains the meeting surfaces per OS**, with the donor's coverage
recorded as the cost evidence beside them.

**`PROVIDERS.md` gains one independent confirmation**: anarlog's own capability
table classes Groq speech as batch, which is what the catalogue already records
from the vendor's documentation. Two sources, one conclusion, and the second one
is an implementation rather than a page.

**Four drawing changes are owed** and land as one careful pass over
`demo.js`: `Resume listening`, the summary picker with its reset, the export
form at the object, and the profile's optional notes root.

**The AEC shape is now specific enough to price and is still not scheduled.**
This record describes what would be built; the ROADMAP entry stays a candidate
behind gate 3.

**Nothing here reopens ADR 0045.** The object, its states and its origins are
confirmed by an outside implementation, not revised by one.

## Related

- [ADR 0045](0045-everything-recorded-is-one-object.md) -- the object the donor
  independently confirms.
- [ADR 0047](0047-a-speakers-name-is-never-in-the-audio.md) -- three stages, and
  why a chip has to say which one produced the name.
- [ADR 0039](0039-a-failed-recording-keeps-its-audio-until-the-retry-or-the-sweep.md)
  -- *keep what a second attempt could use*, applied one stage earlier to the
  cancellation pass.
- [ADR 0064](0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md)
  -- consent as a field; the posted disclosure is its other half.
- [ADR 0134](0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
  -- the runtime owns the end of a session; `finalizing` is the state a meeting
  makes visible.
- [ADR 0131](0131-every-surface-that-starts-a-job-names-where-it-runs-and-the-drawing-already-decided-more-than-was-read.md)
  -- read the drawing first. It failed again here, smaller, and is recorded.
- [ADR 0135](0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md)
  -- the three product answers from the same reading.
