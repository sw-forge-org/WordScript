# 0135: Retention is a guard rather than a timer, the copilot runs on turns, and the picker is a sentence with a sheet behind it

Date: 2026-08-14

Status: Accepted

## Context

[ADR 0131](0131-every-surface-that-starts-a-job-names-where-it-runs-and-the-drawing-already-decided-more-than-was-read.md)
closed by naming three things it deliberately did not do: answer the retention
question, decide what the copilot costs, and settle what a provider picker looks
like mid-conversation. All three are drawn with an `Open decision` badge, all
three were the owner's, and the retention one is
[`ROADMAP.md`](../ROADMAP.md)'s *Meeting capture* gate 2.

**Both meeting donors were read in full for this record**, rather than
summarised. `donors/app/meeting-notetakers/anarlog` is 616 MB of commercial
monorepo and the reading was scoped to the mechanisms these three questions
turn on. What moves all three at once is that two of the questions have a worked
answer in that tree, and the third has a **negative** answer that is worth the
same.

The donor's own product surface is the shortest description of what it does:
`docs/meetings.mdx`, `docs/data-and-privacy.mdx`, `docs/chat.mdx` and
`docs/automatic-capture.mdx` in that repository. They were read alongside the
source, and where the two disagreed the source won.

## Decision

### 1. `Until the note is saved` stands, and it is three conditions

**The drawn default is the answer and no fourth option is invented.** What was
missing is not a value but a definition, and the donor has one built.

anarlog calls the same policy `Don't save`, and it does not mean *do not
record*. `deleteProcessedAudioForRetention`
(`apps/desktop/src/services/audio-retention.ts`) deletes only when three
conditions hold together:

- `isSessionAudioIdle(sessionId)` -- the session is inactive and no live load is
  outstanding;
- the transcript has content -- `json_array_length(words_json) > 0`;
- no attachment stands at `transcript_status = 'processing'`.

**WordScript's version carries a fourth holder, because it has a pass anarlog
does not surface.** ADR 0131 read three stages of diarization off the drawing,
of which the second re-clusters the whole recording when the meeting ends. That
pass reads the audio. Deleting on *session ended* alone would pull the source
out from under it.

So: **the audio is deleted when the session has ended, a transcript with content
exists, and nothing still holds the recording** -- the notes pass, the
re-clustering pass and a running re-transcribe each count as a holder. Three
conditions and a holder set, not one event.

**Meeting audio gets its own namespace and its own sweep budget.**
[ADR 0039](0039-a-failed-recording-keeps-its-audio-until-the-retry-or-the-sweep.md)
sweeps `capture-<n>.wav` at *seven days or twenty files, whichever binds first*.
Twenty dictations are a few megabytes; twenty hours of meeting are tens of
gigabytes. The same mechanism, a second namespace, a second budget. ADR 0039's
two guards carry over unchanged and are not restated as new rules: captures are
written `0600`, and the sweep deletes only files it created, in the directory it
created them in.

**`Never` means never written, not written and then deleted.** A file that
exists for the length of the meeting and is removed at the end is a promise a
crash breaks, and the surface may not make one it cannot keep. Writing nothing
requires the transcript to be produced while the audio is in flight, so
**`Never` depends on the lane**: on a lane that cannot stream it is inert and
names the reason. That is the fourth `InertReason` kind speech-track C4 already
owes -- *this lane does not stream* -- beside no-adapter, role-denied and
no-credential. The catalogue records Groq speech as batch only, so the
connection this product ships with cannot hold `Never`.

**A failure keeps its audio whatever the option says.** ADR 0039's rule is
*keep the capture when a second attempt could survive the failure*, and an hour
of meeting does not weaken it -- it makes the second attempt more expensive to
lose. A meeting whose notes pass or whose transcription failed retains its
recording until the retry or the sweep, under `Until the note is saved` and
under `Never` alike.

**Deleting the audio is its own action and it does not delete the note.** The
donor states this in its own documentation and puts the action in the object's
`•••` menu rather than leaving it as a consequence of a sweep. WordScript
adopts both: the object survives its recording, and a person who wants the
recording gone can say so without losing the transcript, the notes or the
summary.

### 2. The copilot runs once per turn, and the row states two models

**The donor's answer is a negative one and it is worth as much as a positive
one: anarlog runs no inference during a call.** Its AI tasks are exactly two --
`enhance` (the summary) and `title` -- and both hang off `postCaptureAction` in
`stt/capture-lifecycle.ts`, which resolves after the stop. Chat is on demand and
uses the model configured under Settings. The one live path is transcription.

That does not make the copilot wrong. It settles something narrower and useful:
**the copilot is not table stakes**, so the row does not have to justify a
category, only price itself honestly.

**It runs once per finished turn, not continuously.** The drawing's phrasing --
*it compares the running transcript against the index continuously* -- is the
expensive reading and also the imprecise one, because it never says *when*. All
three things ADR 0047 permits the copilot to notice have a natural seam: a
contradiction is against a completed statement, an unanswered question is
against a completed exchange, an untouched agenda item is against elapsed time.
The seam is the turn -- the same rule the audio already follows (cut on silence,
[ADR 0107](0107-an-utterance-is-a-recording-and-the-stream-that-carries-a-conversation-outlives-every-one-of-them.md)
and ADR 0130) and the same rule the transcript half follows in `meetily`
(snap to a sentence end, ADR 0131). **Cut where a seam already exists** now
governs a third thing.

**Retrieval is not a model, and the two stages are priced separately.** The
comparison against the index is an embedding plus a nearest-neighbour lookup.
A language model is spent only when a candidate clears the threshold, which is
rare by construction, because a copilot that had something to say every turn
would violate its own *one at a time, replaces rather than stacks* rule within a
minute. The honest cost is therefore **one embedding per turn and a model call
only on a hit**, not inference for the length of the call.

**The row names both models.** ADR 0131 made every surface that starts a job
state where it runs. A control that starts two different kinds of work names
two, or it is that rule evaded by aggregation. Whether the copilot rides the
assistant's resolution or becomes its own `JobKey` stays where ADR 0131 left it
-- but the embedding stage is a consumer no axis carries today, and naming it on
the row is what will make that visible before it is built.

**It stays off by default, and the reason is ADR 0047's and not the cost.** The
copilot is *wrong sometimes*, mid-call, in the highest-cost place in the product
to be confidently wrong. That is what a default of off answers. Now that the
cost is bounded, the row may not quietly re-argue the default on price.

### 3. The picker is a sentence in the chrome and a sheet behind it

**The donor does not have one** -- both model choices live in Settings, and
neither the chat surface, the floating bar nor the meeting view carries a
picker. Two halves of the answer are there anyway and both are adopted:

- **Context chips above the input**, showing what the next call will be given
  and removable before it is sent. That is *say what you are about to do* applied
  to context instead of to the provider.
- **A `Live` / `After recording` label on every model row**
  (`apps/desktop/src/settings/ai/stt/select.tsx`). The one property that decides
  whether a surface can work at all is at the model, not in prose elsewhere.

**The resolved answer is always visible; the picker never is.** ADR 0129's
sentence -- *Using Groq · whisper-large-v3* -- belongs in the window's own
chrome, beside the state the window already carries there (in the translation
window, next to `German → English`), as one clickable line. Behind it, collapsed,
is the full ladder ADR 0129 specified: lane, vendor, credential, model. Not a
bare dropdown naming a vendor whose key is missing.

**It takes effect from the next turn.** ADR 0064 already rules that a swapped
language pair applies from the next utterance and that nothing is retranslated
retroactively. The provider is the same kind of change for the same reason, so
it inherits the rule rather than inventing a second one: the picker stays
operable during a turn and announces when the change lands.

**A produced line carries the provider that produced it.** This follows from the
rule above and the drawing does not have it yet. After a mid-conversation change
the record is a mixture, and a record that cannot say which half came from where
is the fake-state rule applied to a document. The conversation object gains a
per-line provider the way the transcript already carries a per-line speaker.

**The general form.** This is ADR 0129 and ADR 0064 laid over each other, and it
holds for every surface that inherits ADR 0131's obligation *and* runs longer
than a single request: the meeting HUD, the translation window, Live subtitles
and Client conversations. The upload intake is the degenerate case -- one
request, so there is no next turn and the sentence stands alone.

## Consequences

**`ROADMAP.md`'s *Meeting capture* gate 2 is closed by this record.** Gate 3 --
whether system-audio capture works without a per-session authorization prompt on
the target platforms -- is untouched and stays open.

**Three `Open decision` badges come off the drawing**, on `Keep the audio`
(Meeting capture), `Meeting audio` (How long things are kept) and
`What it costs` (The copilot). That edit is its own step against
`docs/prototypes/settings-rework/demo.js` and is not this record's.

**The fourth `InertReason` kind now has two callers before it exists** -- the
`Live transcript` toggle (ADR 0131) and the `Never` retention option. Whichever
step lands first builds it; the second one does not invent a second.

**The retention sweep gains a second namespace and a second budget**, which
means ADR 0039's sweep is no longer a single rule with a single pair of numbers.
The two guards it carries are the part that must not be re-derived per
namespace.

**The copilot is a consumer of an embedding model, and no axis carries one.**
`JobKey`, `ProviderRole` and the catalogue all describe transcription, chat and
speech synthesis. This record does not add the axis; it makes the gap
un-ignorable by requiring the row to name what it spends.

**A conversation line gains a provider field.** It is storage on the object ADR
0064 defined, and it lands with whichever step first lets a provider change
mid-session.

## Related

- [ADR 0039](0039-a-failed-recording-keeps-its-audio-until-the-retry-or-the-sweep.md)
  -- the sweep, its two guards, and *keep what a retry could use*. Meeting audio
  is a second namespace under it, not a second policy.
- [ADR 0047](0047-a-speakers-name-is-never-in-the-audio.md) -- the copilot's five
  rules. This record prices the fifth one and changes none of the others.
- [ADR 0063](0063-a-meeting-has-four-ways-in-one-of-them-watches-the-microphone-and-only-a-press-ends-it.md)
  -- four ways in, and only a press ends a capture.
- [ADR 0064](0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md)
  -- the next-utterance rule the picker inherits, and the object the per-line
  provider lands on.
- [ADR 0129](0129-the-provider-choice-belongs-where-the-file-is-and-it-is-the-same-stored-value.md)
  -- the resolved sentence, the collapsed ladder, and one stored value.
- [ADR 0131](0131-every-surface-that-starts-a-job-names-where-it-runs-and-the-drawing-already-decided-more-than-was-read.md)
  -- the three questions this record answers, and the rule that a surface names
  where its job runs.
- [ADR 0136](0136-what-is-taken-from-the-donor-and-the-one-thing-it-does-that-must-not-be.md)
  -- the mechanisms adopted from the same reading, and the one that is refused.
