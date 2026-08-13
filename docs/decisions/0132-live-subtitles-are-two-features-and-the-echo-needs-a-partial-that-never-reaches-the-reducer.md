# 0132: Live subtitles are two features, and the echo needs a partial that never reaches the reducer

Date: 2026-08-13

Status: Accepted

## Context

ADR 0130 and ADR 0131 both used the phrase *live transcription* for the
`Live transcript` toggle on the `Meetings` job row. The owner pointed out on
2026-08-13 that this is a third thing, and that the prototype's **Live
subtitles** screen is what he meant — a screen neither record had read.

It opens by saying the same thing, and attributes it:

> **TWO THINGS SHARE THIS NAME AND THEY ARE NOT RELATED. The owner said so in
> as many words**, and the screen is built to keep them apart rather than to
> reconcile them, because the only thing they have in common is the word
> "subtitle".

So three surfaces now carry text that arrives while somebody is still speaking,
and they are not variants of one feature:

| | Source | You are | Where it draws |
| --- | --- | --- | --- |
| **Meeting live transcript** | the meeting capture | a participant | the HUD's transcript tab |
| **Captions** | system audio | the audience | its own always-on-top strip |
| **Echo** | the microphone already open | the speaker | bare text under the dictation pill |

The screen's own closing section states what each needs and they are different
dependencies: **Captions need system-audio capture** — the same thing meeting
capture waits on — and **Echo needs partial results**, *the recogniser to emit
as it goes, which is a streaming lane the local and cloud providers expose
differently.*

## Decision

**They are built apart, and the name is not a design.** Captions is an
accessibility and comprehension surface over content this product does not own.
Echo is a memory aid inside the dictation loop. Building them as one feature
with a source switch is the mistake the prototype names in its own comment, and
this record makes it a rule rather than a remark: **different windows, different
lifetimes, different failure modes.**

**Captions carry their own ground and are never frosted.** The strip floats over
somebody else's video, which is the case ADR 0051 excludes from frost — and a
blur costs a filter pass per frame of theirs. It is opaque, it is excluded from
screen shares like the meeting window, and it shows **two lines rolling with no
history**, because a caption strip that scrolls has become a transcript window
and the transcript is what the recording is for.

**Echo is a trace of the pill, not a surface.** No card, no ground, no border —
anything with a border becomes a window that has to be positioned and dismissed,
and the dictation overlay's discipline is that it is one small object that does
not grow. It shows about one line of tail; settled text and the live tail read
at two weights, because without the split the reader re-reads the whole line
every time it changes. It is **off by default**. Its colour is measured against
whatever is behind it per redraw and is **the one place in this product where a
colour is not a token** — it sits over an application this product does not own.

**And the consequence that reaches the runtime: a partial must be displayable
without reaching the session reducer.** ADR 0018, ADR 0019 and ADR 0095 hold
that no partial result reaches the reducer, and the plan restates it as a rule
no step may break. **That rule is about the reducer and not about the screen**,
and the two are compatible — but only if D2 provides a path that says so. An
implementation that renders the echo by pushing partials through the reducer
breaks the rule while appearing to satisfy the feature.

So: **the streaming contract owes a display channel beside its result channel.**
`wordscript-native-event` is the precedent for a channel that mirrors without
deciding (ADR 0019) and it is deliberately forbidden from setting `status`,
`pendingResult`, `previewStaged` or `resultSurfaceOpen`. A partial stream is the
same shape one axis over: it may paint and it may never commit.

## Consequences

**D2 gains an obligation it did not carry.** Its entry validates that no partial
reaches the reducer; it must also deliver the path by which a partial reaches a
surface. Both halves are one test each and the second one does not exist.

**Neither feature is scheduled by this record.** Captions are blocked on
system-audio capture, which is `docs/ROADMAP.md`'s meeting dependency and not
the speech track's; Echo is blocked on D2. Both are drawn and both keep
ADR 0065's sentence until then.

**`anarlog` is the reference for both halves** and was cloned for it
(ADR 0131): `crates/listener-core/src/live_transcript/` carries a live
transcript with a `normalizer` and `segments` beside it, and `crates/overlay-kit`
is the surface family. **Read for mechanism, not structure.**

**The word *live transcription* is retired from this track's prose** where it is
ambiguous. Three things carry running text and each has a name: the meeting
live transcript, captions, and the echo. ADR 0130's and ADR 0131's uses meant
the first.

**What this does not decide:** whether the echo's partials come from the same
adapter method as the final result or from a second one — that is D2's shape and
ADR 0095 already owns it; and whether captions translate through the same pair
the translation window reads, which the drawing asserts and no runtime has yet.
