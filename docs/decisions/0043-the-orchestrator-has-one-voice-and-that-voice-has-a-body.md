# 0043 -- The orchestrator has one voice, and that voice has a body

Date: 2026-08-03
Status: Accepted (planning direction; not implemented)

## Context

ADR 0030 decided that one orchestrator speaks for every coding agent: it starts
them, it is the human as far as they are concerned, and it is WordScript's only
MCP client. Agents get no entry of their own, deliberately, because a channel
that can speak to the user is a channel that can interrupt them.

The first drawing of that surface argued against it. The agent window put three
targets in a rail, each with its own status dot, its own name and its own
state, and nothing anywhere saying that one process drives all of them. It read
as three agents talking. A surface that suggests three peers is contradicting
the record it implements.

Two further things had no drawing at all:

**How a question reaches you when nothing is open.** `await` blocks the calling
agent until the answer budget expires, so a question nobody sees is the one
failure this surface may not have. The overlay tab (§11.29) covers the case
where a dictation is running. It does not cover a closed window and no
dictation, which is the ordinary case.

**What speaking looks like.** The product draws one voice already -- the bars
on the dictation overlay -- and that voice is yours. Nothing drew the machine's.

## Decision

**One voice, one body: the orb.** A sphere, lit from below left, in two states
that are different materials rather than two brightnesses of one:

| State | Drawing | Means |
| --- | --- | --- |
| Idle | small, white, unlit, still | the process exists and is not speaking |
| Speaking | larger, warm, breathing with its own amplitude | it is speaking, and the size is the level |

A glow that is merely fainter would read as "it is saying something quietly",
which is a lie. Idle has no glow at all.

**It is singular by construction, which is the point.** Bars are plural, and
eleven of them beside three named targets is what made the window read as three
agents. One sphere cannot be misread that way. The orb sits at the head of the
target rail as the identity the rail belongs to, with the targets indented
under it as what the one voice is working on -- the same relationship the
provider list draws for accounts under a provider.

**The dash.** A strip across the foot of the agent window carrying the orb, what
is being said and the voice's own level. It is at the foot because it is a state
of the window rather than an entry in it: the sentence is already the last
message in the thread, and drawing it twice would double every question.

**The notification is WordScript's own always-on-top window**, above every
surface this product owns, carrying the orb at a larger size, the question, and
the options the agent offered. It is not an OS notification: Focus mode and
screen sharing suppress those, and a screen share is precisely when a coding
agent is likely to be running. It is content-protected, like the meeting HUD --
a question about a private repository does not belong in a shared screen. It
dismisses when answered or when the budget expires, never on a timer of its
own, because an unanswered question is still blocking somebody.

**The sound is a cue on the existing stream.** ADR 0010 settled this shape for
every other cue: one persistent output stream, a synthesised motif, no fresh
stream per sound. A question re-uses that path and gets one more motif. It does
not open its own audio and it is not the OS notification sound -- which the user
cannot mix separately and which Focus can mute. It queues while a capture is
running, because a cue during a dictation is picked up by the microphone.

**The dictation overlay is not touched.** No token, size or rule in
`overlay-pill.css` changes. The bars stay the drawing of your voice; the orb is
the drawing of the machine's; neither appears on the other's surface.

**The glow is a `box-shadow`, never `filter: blur()`.** A blur promotes the
element to its own compositor layer, and a compositor layer that outlives a
surface swap is the WebKitGTK ghosting mechanism `overlay-pill.css` documents at
length. The orb never goes on the dictation overlay, but the notification is an
always-on-top transparent window on the same engine, so it is built to the same
rule from the start rather than discovering it later.

## Consequences

- The orb is one component at two sizes, and the size is what states how much
  attention it is asking for: 18--22 px is an indicator in a window, 72--96 px
  is the whole content of a notification.
- **Reduced motion drops the breathing and keeps the state.** Whether it is
  speaking is information; the movement is not. `prefers-reduced-motion`
  removes the animation and nothing else.
- The notification is a fifth window in the family -- after Ask, the meeting
  HUD, Actions and the agent window -- and the first one that is not opened by
  the user. That is what earns it content protection and the always-on-top
  flag, and it is why it carries the least it can: a question, two options and
  a way to answer out loud.
- **A second audio motif has to be composed**, not chosen. ADR 0010's cues are
  a synthesised family and a question is a new member of it; picking a sample
  would break the family it joins.
- Voice output is rate-limited and the limit is reported to the caller when it
  bites (ADR 0030). The notification inherits that: suppressing a question
  silently would be worse than the interruption it avoids.
- The orb has no meaning outside agents. If it ever appears on a surface where
  the orchestrator is not speaking, it has become decoration and this record is
  being violated.
