# 0047 -- A speaker's name is never in the audio

Date: 2026-08-03
Status: Accepted (planning direction; not implemented)

## Context

The Notes preview has shown speaker-separated transcripts since the second pass,
with chips reading `S1` and `S2`, and nothing anywhere said how a speaker
becomes a name. The question put to this pass was whether the planned shape
would actually work.

Both donor trees answer it, and they agree.

**`donors/app/linux-dictation/voxtype/`** is Rust and therefore the relevant
one: `src/meeting/diarization/` has `simple.rs` (source-based attribution),
`ml.rs` (ECAPA-TDNN speaker embeddings over `ort`, cosine similarity,
clustering, behind an `ml-diarization` feature) and `subprocess.rs` (the same,
memory-isolated). Its `SpeakerId` is already the right enum:
`You | Remote | Unknown | Named(String) | Auto(u32)`.

**`donors/app/desktop-shells/openwhispr/`** does it in Electron over a
sherpa-onnx sidecar: pyannote-segmentation-3.0, 3D-Speaker CAMPPlus embeddings
(voxceleb, 16 kHz) and Silero VAD, with `liveSpeakerIdentifier.js` running
identification during the call at a 0.65 match threshold with a 0.03 margin,
and a re-clustering pass when the call ends.

## Decision

**Three stages, and only the first two are audio.**

| Stage | What it does | Cost | Produces |
| --- | --- | --- | --- |
| 1 · Source | Microphone is you, loopback is everyone else | free, no model | you, separated from the room |
| 2 · Cluster | Voice embeddings compared against each other | a second pass | `Speaker 1`, `Speaker 2` -- a count and a separation |
| 3 · Name | The invite, a saved voice, or a click | not audio at all | an identity |

**Stage 3 is not a model problem and must never be presented as one.** Nothing
in a recording contains a name. Anything that looks like inferring one is
matching against a list that came from somewhere else.

**A chip states which stage its name came from**, because "Sarah Chen" from the
attendee list and "Sarah Chen" that the user typed are different claims. Four
statuses, taken whole from the donor's `speakerAssignmentPolicy.js` because that
part is a product decision rather than a model:

```
provisional   a cluster with no name          Speaker 2
suggested     proposed from the invite or a saved voice
confirmed     matched a voice seen labelled before
locked        the user said so
```

**`locked` survives re-clustering, and that is the rule the whole thing rests
on.** The end-of-call pass runs over the whole recording rather than the live
window and renumbers freely. Without a status that survives it, every name typed
during a call changes after it -- which is worse than offering no names at all.
The donor enforces this with `canAutoRelabelSpeaker`; we adopt the behaviour.

**Echo is upstream of all three and is not optional.** The microphone hears the
speakers, so a remote voice arrives on both streams and stage 1 attributes part
of it to the local user. Cancellation runs before attribution; what leaks
through is caught by comparing the two streams for overlapping text, which is
what the donor's `dedupeMicAgainstSystem` does with its `likelyRenderBleed` and
`double_talk` suppression reasons.

**The expected speaker count comes from the invite where there is one.**
Clustering with a known count is a materially easier problem than clustering
without one, and this is the second thing the calendar intake buys (ADR 0046).

### The copilot

The same index that makes a name possible makes a live hint possible, so the
rules for it are decided here rather than separately.

**It never speaks.** There is one spoken path in this product and it is the
desk's, guarded and rate-limited (ADR 0030). A second voice over a live call
would also be talking into a microphone that is recording.

**It never hints without a citation, and the citation is part of the hint.**
ADR 0040 made this a contract for the assistant -- *"without the citation there
is no way to tell a grounded draft from an invented one, and an invented one is
worse than a refusal"* -- and a hint arriving mid-meeting is the highest-cost
place in the product to be confidently wrong. Without a source it is an opinion
arriving with authority.

**One at a time, replaced rather than stacked**, in a strip above the bar. A
hint in the transcript column would be anchored correctly and then scroll away
while new lines arrive, which means the hint you needed is the one you missed.

**Three kinds only:** a contradiction against an earlier object, a question
raised and not answered, and an agenda item that has not come up. Not sentiment,
not coaching, not how the meeting is going.

**Off by default.** It compares the running transcript against the index
continuously, which is inference for the length of a call rather than once at
the end, and the row that turns it on states that cost.

## Consequences

- **Stage 1 alone is worth shipping and is nearly free.** `You` against
  `Remote` needs no model, no download and no second pass, and it is most of the
  value on a two-person call. Stage 2 is what needs 100+ MB of ONNX models and
  a runtime to host them; it belongs with the local model manager (ADR 0042,
  ROADMAP Phase 5), not beside it.
- **`ort` is on the critical path again**, and ADR 0030 already recorded that
  bet: the Rust ONNX bindings sit at `2.0.0-rc.12` with breaking changes between
  release candidates. Local TTS and ML diarization now share the exposure.
- **A saved voice profile is biometric data.** It is derived from a person who
  may not be the user and may not have been asked. It stays on this machine, it
  is never an intake or a reach, it is deletable per person, and if sync is ever
  turned on it is the first thing that needs an explicit decision.
- **A name suggested from an invite can be wrong**, and the failure is quiet:
  two attendees, one speaking, and the wrong label attached with confidence.
  `suggested` exists to be visibly weaker than `confirmed` for exactly that.
- **The copilot is the most speculative surface in the product** and is drawn
  with its limits rather than its possibilities. If it cannot be made useful
  under the rules above, it is dropped -- loosening the rules to make it work is
  not the alternative.
