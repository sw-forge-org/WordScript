# 0202: The preference is written after the column has moved, and the slide was never the cost

Date: 2026-08-17
Status: Accepted. Closes the investigation
[ADR 0198](0198-the-toggle-outranks-the-breakpoint-until-the-window-crosses-it-and-the-column-beside-the-sidebar-is-laid-out-once.md)
and
[ADR 0200](0200-an-analysis-depends-on-the-value-of-its-request-because-a-settled-save-replaces-every-object-in-the-config.md)
opened. **Keeps** the width transition
[ADR 0125](0125-the-sidebar-transition-is-a-clip-and-a-save-adopts-its-own-answer.md)
tuned, which an earlier draft of this record proposed deleting.

## Context

One report, five rounds. The first three each found a real defect, fixed it, and
did not fix what was reported. All three were argued from a mechanism that
explained the words rather than from a measurement of the press.

| Round | Argued | Owner's answer |
| --- | --- | --- |
| 1 | The toggle discarded its own press; the view beside the column was re-laid-out per frame (ADR 0198) | "Still juddering, and oddly only in Profiles" |
| 2 | Profiles re-asked the runtime for two analyses on every config write (ADR 0200) | "Exactly as before, nothing changed" |
| 3 | The column overlaps the view now, so each frame uncovers a strip that must be repainted; promoted it | "Still not fixed — I think it has to do with the number of items" |
| 4 | *(a draft of this ADR)* the slide is unaffordable on this host, so delete it | "You still see a small transition that should not be one — and the workarounds are not fixing it" |

The owner was right about the method, and round 4 was the worst of the four: it
gave up a designed behaviour on the strength of an argument, without ever having
measured the thing it was giving up.

### Measuring the shipped engine

Chromium had said, three times, that there was nothing to find: no long tasks,
identical React commits across views, forced layout between 1.3 and 6.3 ms, a
document of 500 nodes. **It was the wrong instrument and it was asked anyway.**

The right one was already in the tree: `append_diag_log` is a
frontend-callable command writing to `/tmp/kilo/overlay-diag.log`. A temporary
probe drove the real toggle in the running host, sampled
`requestAnimationFrame` across each press, and bisected by switching one suspect
off at a time. In half a second at 60 Hz a healthy press is about 30 frames.

**Run 1 and 2 — the CSS suspects.** Every one of them was wrong, and the run
that looked right did not reproduce:

| Profiles, per press | frames | worst gap |
| --- | --- | --- |
| baseline | 13–15 | 148–160 ms |
| without the `32cqi` pane track | 14 | 142–156 ms |
| without the size containers | 13–14 | 149–155 ms |
| with the column back in flow | 14–15 | 154–155 ms |
| without the sidebar's own transitions | 14–30 | 17–299 ms |

**Run 3 — partition the press**, which is what should have been done first. A
press does two things: it changes the DOM, and it writes the config.

| Profiles, per press | frames | worst gap |
| --- | --- | --- |
| the state change alone (attribute only) | 30–31 | 17 ms |
| **the state change WITH the width slide** | **31** | **17 ms** |
| the config write alone (nothing moves) | 31 | 17–18 ms |
| both, the way the toggle did it | 14–15 | **142–152 ms** |

Each half runs every frame. **The pair costs two consecutive frames of about
145 ms**, and the raw intervals put them immediately after the press:
`[27,134,152,7,16,16,…]`.

**Run 4 — no reader.** Every geometry-reading API in the platform
(`getBoundingClientRect`, the twelve `offset*`/`scroll*`/`client*` getters,
`getComputedStyle`) was patched and counted across a press. The count was
**zero**. Nothing in the app forces a layout; the two frames are the engine's
own work.

So: a `save_config` round trip whose settle and whose `ready` each re-render the
window, landing on frames where the sidebar's style and layout are already
dirty, costs two full passes over a view — where the same re-render on a clean
frame costs nothing. Home never showed it because Home is 38 nodes; Profiles is
the pane. **That is what "it has to do with the number of items" was.**

## Decision

**The toggle writes the preference on a 240 ms timer instead of in the press.**
The surface answers immediately — the column moves, the labels go — and the
config is told once the frame that moved it is over. It flushes on unmount, so a
press followed by a close is still the choice. This is the same bargain
`useConfigDraft` already strikes for a keystroke, and for the same reason:
nothing is gained by making a preference durable in the frame that shows it.

**The width transition stays.** Measured with the slide restored and nothing
else happening, the press runs every frame. It was never the cost.

## Consequences

**Confirmed in the shipped engine, after the change:**

| Per press | frames | worst gap |
| --- | --- | --- |
| Home | 29–30 | 25–27 ms |
| Profiles | 29–31 | 26–28 ms |

From fourteen frames and two 145 ms stalls to the figure the empty view gets.

**Two cases in `useNavRail.test.tsx` hold the seam** — the state is there before
the write, and a pending write survives an unmount. Frame timings cannot be
tested; the arrangement that produced them can.

**The general rule this is an instance of:** a durable write that a surface does
not need in order to answer belongs after the frame that answers, not in it. Any
control whose press both changes the view and saves a preference is the same
defect waiting, and the bigger the view, the louder it is.

**The method is the part worth keeping.** Four rounds were spent shipping
mechanisms and asking whether they worked; the round that landed measured the
press in the engine that has the problem, and bisected. When a host cannot be
instrumented from outside, instrument it from inside — `append_diag_log` is
there, a probe is twenty lines, and it answers in a minute what an afternoon of
argument does not. **A fix that is argued rather than measured should not be
reported as a fix**, and a designed behaviour should never be deleted on the
strength of one.
